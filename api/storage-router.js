'use strict';

const crypto = require('node:crypto');
const context = require('./storage-context');
const createStore = require('./drive-first-store');
const createRepository = require('./drive-first-repository');
const resource = createStore.resource;
const fail = (status, message) => Object.assign(new Error(message), { status });

function configKind(key) {
    if (/^contractor_mapping_/.test(key)) return 'mapping';
    if (['poleSchedulesMaster', 'activitiesMaster', 'sapMaterialsMaster', 'contractorsMaster', 'stockMaster', 'previousRecoMaster'].includes(key)) return 'master';
    if (key === 'dailyProgressData') return 'daily';
    return null; // Sessions, auth, revocations and unknown keys never move implicitly.
}
function dailyPayload(key) { return /^(?:shared_report_|entry_event_|report_)/.test(key); }

module.exports = function createRouter({ raw, readLegacy, env = process.env, drive }) {
    const firestore = () => raw.getFirestoreInstance();
    const repository = createRepository({ firestore, readLegacy, async validateAuthorization(tx) {
        const scope = context.getStore();
        for (const [ref, expected] of scope?.authorizationWitnesses || []) {
            const snap = await tx.get(ref);
            const actual = snap.exists && snap.updateTime ? `${snap.updateTime.seconds}.${snap.updateTime.nanoseconds}` : null;
            if (actual !== expected) throw fail(403, 'Permissions changed during save; pending changes retained');
        }
    }, legacyRef(db, entity) {
        const collection = entity.kind === 'bill' ? 'billing_states' : entity.kind === 'reconciliation' ? 'reconciliation_states' : entity.kind === 'daily' && entity.id !== 'dailyProgressData' ? 'daily_progress_control' : 'default_configs';
        return db.collection(collection).doc(entity.id);
    } });
    const store = createStore({ repository, drive, env, authorize: async (entity, phase) => {
        const scope = context.getStore();
        if (!scope?.authorize) throw fail(403, 'Authorized storage context required');
        await scope.authorize(entity, phase);
    } });
    async function ready() {
        await raw.connect();
        if (store.modules.length && env.BILLING_STORAGE_AUTHORITY !== 'firestore') throw fail(503, 'Explicit Firestore storage authority required before Drive cutover');
        if (store.modules.length && env.BILLING_DRIVE_TRANSPORT !== '1') throw fail(503, 'Enable and verify bounded Drive transport before enabling Drive modules');
        if (raw.getProvider() !== 'firebase') {
            if (store.modules.length || env.BILLING_STORAGE_AUTHORITY === 'firestore') throw fail(503, 'Drive-first coordination requires the configured Firestore authority; writable provider fallback is disabled');
            return false;
        }
        return true;
    }
    function note(kind, id, state) {
        const scope = context.getStore();
        if (scope) scope.versions[resource(kind, id).key] = { v: state.version, s: state.stamp || null, mode: state.mode };
    }
    async function read(kind, id, fallback) {
        if (!await ready()) return fallback();
        const state = await store.read(kind, id); note(kind, id, state);
        return state.data;
    }
    async function routed(kind, id) {
        if (!await ready()) return false;
        if (store.enabled(kind)) return true;
        const snap = await repository.headRef(resource(kind, id)).get();
        const head = snap.exists ? snap.data() : null;
        return head?.mode === 'drive' || !!head?.deleted;
    }
    async function save(kind, id, data, fallback, options = {}) {
        if (!await routed(kind, id)) return fallback();
        const scope = context.getStore();
        const key = resource(kind, id).key;
        const token = scope?.expectedVersions?.[key];
        const expectedVersion = options.expectedVersion ?? token?.v;
        const count = scope ? (scope.operations[key] = (scope.operations[key] || 0) + 1) : 1;
        const result = await store.save(kind, id, data, { expectedVersion,
            expectedStamp: options.expectedStamp ?? token?.s,
            requestId: options.requestId || (scope?.requestId ? scope.requestId + '_' + count : crypto.randomUUID()),
            requestHash: scope?.requestHash, summary: options.summary || {} });
        note(kind, id, { version: result.version, mode: 'drive' });
        return result;
    }
    const api = {
        storageContext: context, storageStore: store, storageRepository: repository, storageResource: resource,
        storageEnabled: store.enabled,
        storageRouted: routed,
        getBillingState: id => read('bill', id, () => raw.getBillingState(id)),
        getReconciliationState: () => read('reconciliation', 'main-reconciliation-state', () => raw.getReconciliationState()),
        saveReconciliationState: (data, rev, expectedRev) => save('reconciliation', 'main-reconciliation-state', { dataId: 'main-reconciliation-state', stateData: data, rev, updatedAt: new Date().toISOString() },
            () => raw.saveReconciliationState(data, rev, expectedRev), { expectedVersion: expectedRev }),
        saveBillingState(id, data, expectedRev) {
            const fields = ['dataId', 'billNo', 'raNo', 'workOrderNo', 'taxableAmount', 'gstAmount', 'grandTotal', 'billDate', 'contractorName', 'projectName', 'isFinalized', 'rev', 'updatedAt'];
            const summary = Object.fromEntries(fields.filter(k => data[k] !== undefined).map(k => [k, data[k] instanceof Date ? data[k].toISOString() : data[k]]));
            return save('bill', id, data, () => raw.saveBillingState(id, data, expectedRev), { expectedVersion: expectedRev, summary });
        },
        getDefaultConfig(key) {
            const kind = configKind(key);
            return kind ? read(kind, key, () => raw.getDefaultConfig(key)) : raw.getDefaultConfig(key);
        },
        saveDefaultConfig(key, data) {
            const kind = configKind(key);
            return kind ? save(kind, key, { key, data, updatedAt: new Date().toISOString() }, () => raw.saveDefaultConfig(key, data)) : raw.saveDefaultConfig(key, data);
        },
        async patchDefaultConfig(key, changes) {
            if (!configKind(key)) return raw.patchDefaultConfig(key, changes);
            const previous = await api.getDefaultConfig(key);
            return api.saveDefaultConfig(key, { ...(previous?.data || {}), ...changes });
        },
        async listBills() {
            if (!await ready()) return raw.listBills();
            const heads = await repository.heads('bill');
            const legacy = await raw.listBills();
            const rows = new Map(legacy.map(row => [row.dataId, row]));
            for (const head of heads) {
                if (head.deleted) rows.delete(head.id);
                else if (head.mode === 'drive') rows.set(head.id, { ...(head.summary || {}), dataId: head.id, rev: head.version, updatedAt: head.summary?.updatedAt || head.updatedAt, totalAmount: head.summary?.grandTotal || 0 });
            }
            return [...rows.values()].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
        },
        async countBills() { return (await api.listBills()).length; },
        async getLatestBillingState() { const rows = await api.listBills(); return rows.length ? api.getBillingState(rows[0].dataId) : null; },
        async deleteBillingState(id) {
            if (!await routed('bill', id)) return raw.deleteBillingState(id);
            const state = await store.status('bill', id);
            await context.getStore()?.authorize(resource('bill', id), 'commit');
            return repository.removeBill(resource('bill', id), state.version);
        },
        async atomicDailyRecord(key, change) {
            if (!dailyPayload(key) || !await routed('daily', key)) return raw.atomicDailyRecord(key, change);
            for (let attempt = 0; attempt < 5; attempt++) {
                const state = await store.read('daily', key);
                const changed = change(state.data?.value || null);
                if (changed.value === undefined) return changed.result;
                const cid = changed.value?.contractorId || changed.value?.report?.contractorId || changed.value?.baseReport?.contractorId;
                if (cid) context.getStore()?.resourceContractors?.set(resource('daily', key).key, cid);
                try {
                    await save('daily', key, { value: changed.value }, () => { throw fail(503, 'Storage routing changed'); }, { expectedVersion: state.version, expectedStamp: state.stamp });
                    return changed.result;
                } catch (error) { if (error.status !== 409 || attempt === 4) throw error; }
            }
        },
        async listDailyRecords(prefix, options = {}) {
            const legacy = await raw.listDailyRecords(prefix, options);
            if (!await ready()) return legacy;
            const heads = (await repository.heads('daily')).filter(h => h.id.startsWith(prefix) && h.id !== 'dailyProgressData');
            const rows = new Map(legacy.map(row => [row.key, row]));
            for (const head of heads) {
                if (head.deleted) rows.delete(head.id);
                else if (head.mode === 'drive') rows.set(head.id, { key: head.id, value: (await store.read('daily', head.id)).data?.value });
            }
            return [...rows.values()].sort((a,b) => a.key.localeCompare(b.key)).slice(0, options.limit || Infinity);
        },
        async updateAllBillsPoleSchedules() { throw fail(409, 'Shared master changes must not bulk-rewrite historical bills'); },
        async updateAllBillsActivities() { throw fail(409, 'Shared master changes must not bulk-rewrite historical bills'); }
    };
    // Preserve legacy bulk behavior while no Drive module/record is involved.
    for (const method of ['updateAllBillsPoleSchedules', 'updateAllBillsActivities']) {
        api[method] = async value => {
            if (await ready() && (store.enabled('bill') || (await repository.heads('bill')).some(h => h.mode === 'drive'))) throw fail(409, 'Bulk master updates cannot rewrite Drive-backed historical bills');
            return raw[method](value);
        };
    }
    return api;
};
module.exports.configKind = configKind;
