'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const createRouter = require('../api/storage-router');
const fakeFirestore = require('./helpers/storage-firestore');
function fixture(modules = '') {
    const firestore = fakeFirestore(), files = new Map(), calls = [], security = new Map(); let next = 0;
    const raw = { connect: async () => {}, getProvider: () => 'firebase', getFirestoreInstance: () => firestore,
        getDefaultConfig: async key => security.get(key), saveDefaultConfig: async (key, data) => { calls.push(key); security.set(key, { key, data }); },
        patchDefaultConfig: async () => {},
        listBills: async () => [{ dataId: 'legacy-a', billNo: 'RA-01' }, { dataId: 'legacy-b', billNo: 'RA-02' }], countBills: async () => 2,
        listDailyRecords: async () => [], updateAllBillsActivities: async () => calls.push('bulk'), updateAllBillsPoleSchedules: async () => calls.push('bulk'),
        atomicDailyRecord: async (key, change) => { calls.push(key); return change(null).result; } };
    const drive = { configured: () => true, createId: async () => 'file_' + ++next, writeBytes: async (id, name, bytes) => files.set(id, Buffer.from(bytes)), readBytes: async id => Buffer.from(files.get(id)) };
    const db = { ...raw, ...createRouter({ raw, readLegacy: async snap => snap.exists ? snap.data() : null, drive,
        env: { BILLING_DRIVE_MODULES: modules, BILLING_DRIVE_TRANSPORT: '1', BILLING_STORAGE_AUTHORITY: 'firestore' } }) };
    const scope = () => ({ versions: {}, expectedVersions: {}, operations: {}, resourceContractors: new Map(), requestId: 'request_00000000001', authorize: async () => {} });
    return { db, firestore, files, calls, security, scope };
}
test('auth, worker sessions, revocations, link tokens and unknown configs stay in their original authority', async () => {
    const f = fixture('master,mapping,daily,bill,reconciliation');
    for (const key of ['owner_email', 'auth_session_x', 'auth_session_x_revoked', 'unknown_config']) await f.db.saveDefaultConfig(key, { value: 1 });
    for (const key of ['token_x', 'contractor_x', 'dp_worker_session_x', 'dp_worker_user_x', 'location_x']) await f.db.atomicDailyRecord(key, () => ({ value: { secure: true }, result: true }));
    assert.equal(f.files.size, 0); assert.equal(f.calls.length, 9);
});
test('business keys require browser version/stamp; reads seed headers and Drive reads survive flag disable', async () => {
    const f = fixture('mapping'), key = 'contractor_mapping_a';
    await f.firestore.seed('default_configs/' + key, { key, data: { rows: [1] } });
    const scope = f.scope();
    await f.db.storageContext.run(scope, async () => {
        assert.deepEqual((await f.db.getDefaultConfig(key)).data.rows, [1]);
        await assert.rejects(f.db.saveDefaultConfig(key, { rows: [2] }), { status: 409 });
        scope.expectedVersions = { ...scope.versions };
        await f.db.saveDefaultConfig(key, { rows: [2] });
        assert.deepEqual((await f.db.getDefaultConfig(key)).data.rows, [2]);
    });
    assert.equal(f.calls.length, 0);
    const raw = { connect: async () => {}, getProvider: () => 'firebase', getFirestoreInstance: () => f.firestore };
    const reader = createRouter({ raw, readLegacy: async snap => snap.data(), env: {}, drive: { readBytes: async id => f.files.get(id) } });
    assert.deepEqual((await reader.getDefaultConfig(key)).data.rows, [2]);
});
test('new Drive-only heads never hide unrelated legacy bills by cardinality', async () => {
    const f = fixture('bill');
    await f.db.storageContext.run(f.scope(), async () => {
        await f.db.saveBillingState('new-a', { dataId: 'new-a', rev: 1, grandTotal: 3 }, 0);
        await f.db.saveBillingState('new-b', { dataId: 'new-b', rev: 1, grandTotal: 4 }, 0);
    });
    const rows = await f.db.listBills();
    assert.deepEqual(new Set(rows.map(row => row.dataId)), new Set(['legacy-a', 'legacy-b', 'new-a', 'new-b']));
    await assert.rejects(f.db.updateAllBillsActivities({}), { status: 409 });
});
test('daily history and report payloads are hydrated before pure callbacks; lease-only changes reuse snapshots', async () => {
    const f = fixture('daily');
    await f.db.storageContext.run(f.scope(), async () => {
        await f.db.atomicDailyRecord('report_a', () => ({ value: { contractorId: 'a', baseReport: { quantities: { x: 2 } }, leaseUntil: 10 }, result: true }));
        await f.db.atomicDailyRecord('report_a', value => ({ value: { ...value, leaseUntil: 20 }, result: value.baseReport }));
        assert.equal((await f.db.atomicDailyRecord('report_a', value => ({ result: value }))).leaseUntil, 20);
    });
    assert.equal(f.files.size, 1); assert.equal(f.calls.length, 0);
});
test('Daily Progress service uses one verified payload path after cutover and preserves report locks', async () => {
    const f = fixture('daily');
    const service = require('../api/daily-progress-service')({ db: f.db,
        drive: { async write() { throw Error('Duplicate unverified report upload'); }, async read() { throw Error('Unexpected legacy report read'); } },
        items: [{ id: '15' }] });
    const editor = 'editor_00000000000000000000000000000001';
    await f.db.storageContext.run(f.scope(), async () => {
        const claim = await service.access('a', '2026-11-18', editor, 'claim');
        assert.equal(claim.editable, true);
        const saved = await service.save('a', '2026-11-18', editor, { version: claim.version, epoch: claim.epoch,
            requestId: 'daily_request_0000000001', report: { quantities: { 15: 3.25 }, manpower: { leader: 1 }, remarks: 'Verified' }, final: true });
        assert.equal(saved.state, 'final');
        const loaded = await service.access('a', '2026-11-18', editor);
        assert.equal(loaded.report.quantities['15'], 3.25); assert.equal(loaded.editable, false);
        const reports = await service.reports(); assert.equal(reports.length, 1); assert.equal(reports[0].remarks, 'Verified');
    });
    assert.equal(f.files.size, 2, 'claim/audit snapshot and one final business snapshot; reservation reuses bytes');
    for (const [path, row] of f.firestore.rows) {
        if (!path.startsWith('billing_storage_heads/')) continue;
        assert.equal(row.data.baseReport, undefined); assert.equal(row.data.coordination.baseReport, undefined);
        assert.ok(Buffer.byteLength(JSON.stringify(row.data)) < 4096);
    }
});
