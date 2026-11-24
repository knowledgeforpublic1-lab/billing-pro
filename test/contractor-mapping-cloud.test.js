const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture(fetch) {
    const cache = new Map();
    const context = { window: {}, AbortSignal, fetch, localStorage: { getItem: key => cache.get(key) || null, setItem: (key, value) => cache.set(key, value) } };
    vm.runInNewContext(fs.readFileSync('js/contractor-mapping.js', 'utf8'), context);
    const profile = { version: 1, updatedAt: 123, dirty: true, rows: { activities: {}, poleSchedules: {} } };
    const app = Object.assign({}, context.window.ContractorMappingModule, {
        selectedContractorId: 'team', _activeMappingContractorId: 'team',
        contractorMappingState: { version: 1, profiles: { team: profile } },
        captureContractorMapping() {}, showToast(message) { this.toast = message; }
    });
    return { app, profile, context, cache };
}

test('large SAP mapping uses a normal acknowledged upload and concurrent saves share one request', async () => {
    let requests = 0, release;
    const wait = new Promise(resolve => { release = resolve; });
    const { app, profile } = fixture(async (url, options) => {
        requests++; assert.equal(url, '/api/contractor-mapping');
        assert.ok(Buffer.byteLength(options.body) > 65536);
        assert.notEqual(options.keepalive, true, 'Normal mapping uploads must not use the restricted unload transport');
        assert.equal(options.credentials, 'same-origin'); assert.ok(options.signal);
        await wait; return { ok: true, status: 200, json: async () => ({ success: true }) };
    });
    profile.rows.poleSchedules['1220'] = { material: { sapItems: Array.from({ length: 1000 }, (_, i) => ({ code: 'SAP-' + i, desc: 'A detailed material specification for component ' + i, qty: 1 })) } };
    const first = app.persistContractorMapping(false), second = app.persistContractorMapping(false);
    await new Promise(resolve => setImmediate(resolve)); assert.equal(requests, 1);
    release(); assert.deepEqual(await Promise.all([first, second]), [true, true]);
    assert.equal(profile.dirty, false); assert.equal(app.mappingCloudStatus, 'synced');
});

test('failed SAP cloud save shows the actual error, retains dirty mapping and allows retry', async () => {
    let fail = true;
    const { app, profile } = fixture(async () => fail
        ? { ok: false, status: 503, json: async () => ({ success: false, error: 'Database unavailable' }) }
        : { ok: true, status: 200, json: async () => ({ success: true }) });
    assert.equal(await app.persistContractorMapping(false), false);
    assert.equal(profile.dirty, true); assert.equal(app.mappingCloudStatus, 'error');
    assert.match(app.mappingCloudError, /HTTP 503: Database unavailable/);
    assert.match(app.toast, /Database unavailable/);
    fail = false; assert.equal(await app.persistContractorMapping(false), true);
    assert.equal(profile.dirty, false); assert.equal(app.mappingCloudError, '');
});

test('expired admin access defers background mapping saves without a failed request or password popup', async () => {
    let requests = 0, dialogs = 0, resume;
    const { app, profile, cache } = fixture(async () => { requests++; return { ok: true, status: 200, json: async () => ({ success: true }) }; });
    Object.assign(app, { isPortalUnlocked: true, isAdminElevated: true, adminExpiresAt: 900, authNow: () => 1000,
        openAdminModal(callback) { dialogs++; this.showAdminModal = true; resume = callback; } });
    assert.equal(await app.persistContractorMapping(true), false);
    assert.equal(requests, 0); assert.equal(dialogs, 0);
    assert.equal(app.mappingCloudStatus, 'verification-required'); assert.equal(profile.dirty, true);
    assert.equal(JSON.parse(cache.get('billing_contractor_mapping_v1_team')).dirty, true);
    assert.equal(await app.persistContractorMapping(false), false);
    assert.equal(dialogs, 1); assert.equal(requests, 0);
    assert.equal(await app.persistContractorMapping(false), false);
    assert.equal(dialogs, 1, 'Repeated Save clicks share the same verification dialog');
    app.showAdminModal = false; app.isAdminElevated = true; app.adminExpiresAt = 5000;
    assert.equal(await resume(), true);
    assert.equal(requests, 1); assert.equal(profile.dirty, false); assert.equal(app.mappingCloudStatus, 'synced');
});

test('admin expiry reported during upload retains the mapping and resumes the original contractor after verification', async () => {
    let authorized = false, resume;
    const ids = [];
    const { app, profile } = fixture(async (url, options) => {
        ids.push(JSON.parse(options.body).contractorId);
        return authorized ? { ok: true, status: 200, json: async () => ({ success: true }) }
            : { ok: false, status: 403, json: async () => ({ success: false, error: 'Admin verification expired; pending changes retained' }) };
    });
    Object.assign(app, { isPortalUnlocked: true, isAdminElevated: true, adminExpiresAt: 5000, authNow: () => 1000,
        openAdminModal(callback) { this.showAdminModal = true; resume = callback; } });
    assert.equal(await app.persistContractorMapping(false), false);
    assert.equal(app.isAdminElevated, false); assert.equal(app.mappingCloudStatus, 'verification-required');
    assert.equal(profile.dirty, true); assert.equal(app.showAdminModal, true);
    authorized = true; app.isAdminElevated = true; app.adminExpiresAt = 5000; app.showAdminModal = false;
    app._activeMappingContractorId = 'other'; app.selectedContractorId = 'other'; app.mappingCloudStatus = 'idle';
    assert.equal(await resume(), true);
    assert.deepEqual(ids, ['team', 'team']); assert.equal(profile.dirty, false);
    assert.equal(app.mappingCloudStatus, 'idle', 'Retry cannot change the other contractor status');
});

test('a generic 403 permission failure cannot trigger admin re-verification or discard mapping changes', async () => {
    let dialogs = 0;
    const { app, profile } = fixture(async () => ({ ok: false, status: 403, json: async () => ({ success: false, error: 'Contractor access denied' }) }));
    Object.assign(app, { isPortalUnlocked: true, isAdminElevated: true, adminExpiresAt: 5000, authNow: () => 1000, openAdminModal() { dialogs++; } });
    assert.equal(await app.persistContractorMapping(false), false);
    assert.equal(dialogs, 0); assert.equal(profile.dirty, true); assert.equal(app.isAdminElevated, true);
    assert.equal(app.mappingCloudStatus, 'error'); assert.match(app.mappingCloudError, /Contractor access denied/);
});

test('successful admin verification automatically saves pending profiles once without hiding the mapping acknowledgement', async () => {
    const savedIds = [], messages = [];
    const { app, profile, context } = fixture(async (url, options) => {
        if (url === '/api/auth/admin') return { ok: true, status: 200, json: async () => ({ success: true, serverTime: Date.now(), expiresAt: Date.now() + 600000, adminExpiresAt: Date.now() + 600000 }) };
        savedIds.push(JSON.parse(options.body).contractorId);
        return { ok: true, status: 200, json: async () => ({ success: true }) };
    });
    vm.runInNewContext(fs.readFileSync('js/auth.js', 'utf8'), context);
    Object.assign(app, context.window.AuthModule, { initPortalWatchdog() {}, isPortalUnlocked: true, isAdminElevated: false, showToast(message) { messages.push(message); } });
    app.contractorMappingState.profiles.other = { ...structuredClone(profile), updatedAt: 124 };
    app.adminPasswordInput = 'example';
    app.adminPendingCallback = () => app.persistContractorMapping(false, 'team');
    await app.verifyAdminPassword();
    assert.deepEqual(savedIds, ['team', 'other']);
    assert.equal(profile.dirty, false); assert.equal(app.contractorMappingState.profiles.other.dirty, false);
    assert.equal(app.adminPendingCallback, null); assert.equal(app.adminPasswordInput, '');
    assert.equal(app.authBusy, false); assert.equal(app.isAdminElevated, true);
    assert.match(messages[0], /Admin access verified/);
    assert.match(messages.at(-1), /mapping save ho gayi/);
});

test('confirmed local cache acknowledgement survives reload of a stale dirty bill snapshot', () => {
    const { app, profile, cache } = fixture(async () => {});
    const confirmed = { ...profile, dirty: false };
    cache.set('billing_contractor_mapping_v1_team', JSON.stringify(confirmed));
    app.contractorMappingState.base = { activities: {}, poleSchedules: {} };
    app.initializeContractorMappings();
    assert.equal(app.contractorMappingState.profiles.team.dirty, false);
});

test('manual Cloud Save cannot claim success when SAP mapping was rejected', async () => {
    const { app, context } = fixture(async () => ({ ok: false, status: 401, json: async () => ({ success: false, error: 'Login required' }) }));
    vm.runInNewContext(fs.readFileSync('js/sync.js', 'utf8'), context);
    const saved = await context.window.SyncModule.performCloudSync.call(app, { manual: true });
    assert.equal(saved, false); assert.equal(app.syncStatus, 'error');
    assert.match(app.mappingCloudError, /Login session expire/);
});

test('refresh restores newer cached SAP mappings before capturing an older bill catalogue', () => {
    const { context, cache } = fixture(async () => { throw new Error('Offline'); });
    const defaults = { '1220': { materials: [{ no: '4', desc: 'AB Switch support channel', itemCode: 'BASE', sapItems: [{ code: 'BASE', qty: 1 }] }] } };
    context.window.defaultActivities = structuredClone(defaults); context.window.defaultPoleSchedules = {};
    const methods = context.window.ContractorMappingModule;
    const create = extra => Object.assign({}, methods, { selectedContractorId: 'team', activities: structuredClone(defaults), poleSchedules: {}, showToast() {} }, extra);
    const original = create(); original.initializeContractorMappings();
    const olderBill = { activities: structuredClone(original.activities), contractorMappingState: structuredClone(original.contractorMappingState) };
    original.activities['1220'].materials[0].sapItems = [{ code: 'USER-A', qty: 1 }, { code: 'USER-B', qty: 0.5 }];
    original.activities['1220'].materials[0].itemCode = 'USER-A, USER-B';
    original.captureContractorMapping();
    const cachedBeforeReload = cache.get('billing_contractor_mapping_v1_team');
    for (const state of [olderBill, {}]) {
        cache.set('billing_contractor_mapping_v1_team', cachedBeforeReload);
        const refreshed = create(structuredClone(state)); refreshed.initializeContractorMappings();
        assert.equal(refreshed.activities['1220'].materials[0].itemCode, 'USER-A, USER-B');
        assert.equal(refreshed.activities['1220'].materials[0].sapItems[1].qty, 0.5);
        assert.equal(cache.get('billing_contractor_mapping_v1_team'), cachedBeforeReload, 'Boot must not replace the newer recovery copy');
    }
});

test('opening a finalized historical bill cannot overwrite a newer contractor mapping cache', () => {
    const { app, profile, cache, context } = fixture(async () => {});
    const confirmed = { ...profile, updatedAt: 999, dirty: false };
    const raw = JSON.stringify(confirmed);
    cache.set('billing_contractor_mapping_v1_team', raw);
    app.isFinalized = true;
    app.contractorMappingState.base = { activities: {}, poleSchedules: {} };
    // Use the real capture implementation rather than this fixture's save stub.
    app.captureContractorMapping = context.window.ContractorMappingModule.captureContractorMapping;
    app.initializeContractorMappings(); app.captureContractorMapping();
    assert.equal(cache.get('billing_contractor_mapping_v1_team'), raw);
});
