'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const createStore = require('../api/drive-first-store');
const createRepository = require('../api/drive-first-repository');
const fakeFirestore = require('./helpers/storage-firestore');
const resource = createStore.resource;
function fixture(options = {}) {
    const db = fakeFirestore(), files = new Map(); let uploads = 0, time = Date.now();
    const repository = createRepository({ firestore: () => db, readLegacy: async snap => snap.exists ? snap.data() : null,
        legacyRef: (db, entity) => db.collection(entity.kind === 'bill' ? 'billing_states' : 'legacy').doc(entity.id), validateAuthorization: options.validateAuthorization });
    const drive = { configured: () => true, async createId() { return 'file_' + (files.size + 1); },
        async writeBytes(id, name, bytes) { uploads++; if (options.upload) await options.upload(); files.set(id, Buffer.from(bytes)); },
        async readBytes(id) { if (!files.has(id)) throw Object.assign(Error('Unavailable'), { status: 503 }); return Buffer.from(files.get(id)); } };
    const store = createStore({ repository, drive, env: { BILLING_DRIVE_MODULES: 'bill,reconciliation,master,mapping,daily', ...options.env },
        now: () => time, authorize: options.authorize });
    return { db, repository, drive, store, files, uploads: () => uploads, advance: ms => { time += ms; } };
}
const saveOptions = (version = 0, id = 'request_00000000001') => ({ expectedVersion: version, requestId: id });

test('cold restart restores latest committed data for every module with rollout disabled', async () => {
    for (const kind of ['bill', 'reconciliation', 'master', 'mapping', 'daily']) {
        const f = fixture(), id = 'restore_' + kind;
        const first = { value: { contractorId: 'a', date: '2026-11-19', quantities: { zero: 0, negative: -1.25 }, label: 'पुनर्स्थापना', leaseUntil: 10 } };
        const latest = { value: { ...first.value, label: 'नवीन', leaseUntil: 20 } };
        await f.store.save(kind, id, first, saveOptions());
        await f.store.save(kind, id, latest, saveOptions(1, 'restore_request_00000002'));
        const restarted = createStore({ repository: f.repository, drive: f.drive, env: { BILLING_DRIVE_MODULES: '' } });
        const restored = await restarted.read(kind, id);
        assert.equal(restored.mode, 'drive'); assert.equal(restored.version, 2);
        assert.deepEqual(restored.data, latest);
        const envelope = JSON.parse(f.files.get(restored.head.fileId).toString('utf8'));
        assert.equal(envelope.previous.version, 1);
        assert.ok(f.files.has(envelope.previous.fileId), 'previous immutable bytes remain available');
        f.drive.readBytes = async () => { throw Object.assign(Error('Offline'), { status: 503 }); };
        await assert.rejects(restarted.read(kind, id), { status: 503 });
    }
});

test('Drive round trip preserves Unicode, negative/zero quantities and duplicate contractor identities', async () => {
    const f = fixture(), payload = { stateData: { names: ['श्री गणेश', 'श्री गणेश'], rows: [{ id: 'a', qty: -12.345 }, { id: 'b', qty: 0 }] }, rev: 1 };
    const saved = await f.store.save('bill', 'bill_a', payload, saveOptions());
    assert.equal(saved.version, 1); assert.deepEqual((await f.store.read('bill', 'bill_a')).data, payload);
    const head = (await f.repository.read(resource('bill', 'bill_a'))).head;
    assert.ok(Buffer.byteLength(JSON.stringify(head)) < 4096); assert.equal(head.stateData, undefined);
});
test('flags default off; missing credentials and missing revision fail before upload', async () => {
    const f = fixture({ env: { BILLING_DRIVE_MODULES: '' } });
    await assert.rejects(f.store.save('bill', 'x', {}, saveOptions()), { status: 503 });
    const g = fixture(); g.drive.configured = () => false;
    await assert.rejects(g.store.save('bill', 'x', {}, saveOptions()), { status: 503 });
    const h = fixture(); await assert.rejects(h.store.save('bill', 'x', {}, { requestId: 'request_00000000001' }), { status: 409 });
    assert.equal(f.uploads() + g.uploads() + h.uploads(), 0);
});
test('exact retry acknowledges once; altered payload replay is rejected', async () => {
    const f = fixture(), data = { value: 42 };
    await f.store.save('master', 'activitiesMaster', data, saveOptions());
    assert.equal((await f.store.save('master', 'activitiesMaster', data, saveOptions())).alreadySaved, true);
    await assert.rejects(f.store.save('master', 'activitiesMaster', { value: 43 }, saveOptions()), { status: 409 });
    assert.equal(f.uploads(), 1);
});
test('two devices including revision zero cannot both commit', async () => {
    const f = fixture();
    const results = await Promise.allSettled([f.store.save('bill', 'x', { qty: 1 }, saveOptions()), f.store.save('bill', 'x', { qty: 2 }, saveOptions(0, 'request_00000000002'))]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
});
test('source update during upload rejects cutover and leaves original data authoritative', async () => {
    let f;
    f = fixture({ upload: async () => f.db.seed('billing_states/x', { rev: 3, qty: 99 }) });
    await f.db.seed('billing_states/x', { rev: 2, qty: 2 });
    await assert.rejects(f.store.save('bill', 'x', { rev: 3, qty: 5 }, saveOptions(2)), { status: 409 });
    assert.equal((await f.store.read('bill', 'x')).data.qty, 99);
});
test('revocation after upload and transaction authorization rejection never publish a head', async () => {
    for (const options of [{ authorize: async (entity, phase) => { if (phase === 'commit') throw Object.assign(Error('Revoked'), { status: 403 }); } },
        { validateAuthorization: async () => { throw Object.assign(Error('Permissions changed'), { status: 403 }); } }]) {
        const f = fixture(options);
        await assert.rejects(f.store.save('bill', 'x', {}, saveOptions()), { status: 403 });
        assert.notEqual((await f.repository.read(resource('bill', 'x'))).head?.mode, 'drive');
    }
});
test('lost commit response resolves by request ID; unresolved outages retain old head', async () => {
    const f = fixture(), commit = f.repository.commit;
    f.repository.commit = async (...args) => { await commit(...args); throw Error('Timeout'); };
    assert.equal((await f.store.save('bill', 'x', { qty: 8 }, saveOptions())).alreadySaved, true);
    assert.equal((await f.store.read('bill', 'x')).data.qty, 8);
    f.repository.commit = async () => { throw Error('Offline'); };
    await assert.rejects(f.store.save('bill', 'x', { qty: 9 }, saveOptions(1, 'request_00000000002')), { status: 503 });
    assert.equal((await f.store.read('bill', 'x')).data.qty, 8);
});
test('checksum corruption or missing file fails closed without stale legacy substitution', async () => {
    const f = fixture(); await f.db.seed('billing_states/x', { qty: 1 });
    await f.store.save('bill', 'x', { qty: 2 }, saveOptions());
    const [id] = f.files.keys(); f.files.set(id, Buffer.from('corrupt'));
    await assert.rejects(f.store.read('bill', 'x'), { status: 503 });
    f.files.delete(id); await assert.rejects(f.store.read('bill', 'x'), { status: 503 });
});
test('coordination-only daily updates reuse exact immutable bytes despite object key ordering', async () => {
    const f = fixture();
    await f.store.save('daily', 'report_x', { value: { contractorId: 'a', quantities: { a: 1, b: 2 }, leaseUntil: 10 } }, saveOptions());
    await f.store.save('daily', 'report_x', { value: { contractorId: 'a', quantities: { b: 2, a: 1 }, leaseUntil: 20 } }, saveOptions(1, 'request_00000000002'));
    assert.equal(f.uploads(), 1);
    const data = (await f.store.read('daily', 'report_x')).data.value;
    assert.equal(data.leaseUntil, 20); assert.deepEqual(data.quantities, { a: 1, b: 2 });
});
test('metadata cannot accidentally embed unbounded business fields', async () => {
    const f = fixture();
    await f.store.save('daily', 'entry_event_x', { value: { contractorId: 'a', customBusinessHistory: 'q'.repeat(100000) } }, saveOptions());
    assert.ok(Buffer.byteLength(JSON.stringify((await f.repository.read(resource('daily', 'entry_event_x'))).head)) < 4096);
    assert.equal((await f.store.read('daily', 'entry_event_x')).data.value.customBusinessHistory.length, 100000);
});
test('mode fence blocks legacy writes and stale source stamps including no-revision masters', async () => {
    const f = fixture(), entity = resource('master', 'activitiesMaster');
    await f.db.seed('legacy/activitiesMaster', { data: { a: 1 } });
    const state = await f.repository.read(entity);
    await f.db.seed('legacy/activitiesMaster', { data: { a: 2 } });
    await assert.rejects(f.store.save('master', entity.id, {}, { ...saveOptions(), expectedStamp: state.stamp }), { status: 409 });
    await f.store.save('master', entity.id, {}, saveOptions());
    await assert.rejects(f.db.runTransaction(tx => f.repository.assertLegacy(tx, entity)), { status: 409 });
});
test('deleted bills remain tombstoned and the last bill cannot be deleted across mixed formats', async () => {
    const f = fixture(); await f.db.seed('billing_states/a', { rev: 0 }); await f.db.seed('billing_states/b', { rev: 0 });
    await f.store.save('bill', 'a', { rev: 1 }, saveOptions());
    await f.repository.removeBill(resource('bill', 'a'), 1);
    await assert.rejects(f.store.save('bill', 'a', {}, saveOptions(2)), { status: 409 });
    await assert.rejects(f.repository.removeBill(resource('bill', 'b'), 0), { status: 400 });
});
