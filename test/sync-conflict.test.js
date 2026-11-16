const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/sync.js', 'utf8');
function setup(fetchImpl) {
    const storage = new Map();
    const context = { window: {}, console, fetch: fetchImpl,
        localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
        setTimeout: () => 1, clearTimeout() {} };
    vm.runInNewContext(source, context);
    const methods = context.window.SyncModule;
    const app = { ...methods, cloudRev: 1, activeBillId: 'bill-a', showToast() {}, _scheduleSyncRetry() {},
        quantity: { value: 7 }, buildSyncPayload(extra) { return { dataId: this.activeBillId, quantity: this.quantity, baseRev: this.cloudRev, savedAt: Date.now(), ...extra }; } };
    return { app, methods, context, storage };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('same-tab saves serialize; queued edits use the acknowledged revision', async () => {
    const requests = []; let release;
    const firstResponse = new Promise(resolve => release = resolve);
    const { app } = setup(async (url, init) => {
        requests.push(JSON.parse(init.body));
        if (requests.length === 1) await firstResponse;
        return { ok: true, status: 200, json: async () => ({ success: true, rev: requests.length + 1 }) };
    });
    const firstHash = app.stableStateHash(app.buildSyncPayload());
    const first = app.syncToCloudNow();
    await tick();
    app.quantity.value = 23;
    const second = app.syncToCloudNow();
    const third = app.syncToCloudNow({ manual: true });
    assert.equal(requests.length, 1, 'Only one HTTP save may be in flight');
    release();
    assert.equal(await first, true);
    assert.equal(app.getSyncedHash(), firstHash, 'Acknowledgement must hash the sent snapshot, not later edits');
    await Promise.all([second, third]);
    assert.equal(requests.length, 2, 'Queued duplicate calls do not create an extra revision');
    assert.equal(requests[1].baseRev, 2);
    assert.equal(requests[1].quantity.value, 23);
    assert.equal(app.cloudConflict, undefined);
});
test('lost response with identical cloud contents is acknowledged without overwrite', async () => {
    let responseData;
    const { app } = setup(async () => ({ ok: false, status: 409, json: async () => ({ success: false, conflict: true, data: responseData, rev: 2 }) }));
    responseData = JSON.parse(JSON.stringify(app.buildSyncPayload()));
    assert.equal(await app.syncToCloudNow(), true);
    assert.equal(app.cloudRev, 2);
    assert.equal(app.syncStatus, 'synced');
    assert.equal(app.cloudConflict, undefined);
    app.quantity.value = 30;
    assert.equal(await app.syncToCloudNow(), false, 'Different local/cloud quantities remain a genuine conflict');
    assert.equal(app.cloudConflict, true);
});
test('hashes ignore object order/timestamps and acknowledgements are scoped to each bill', () => {
    const { app } = setup();
    const first = { savedAt: 100, activities: { a: { quantity: 3, name: 'A' } }, baseRev: 1 };
    const reordered = { baseRev: 9, activities: { a: { name: 'A', quantity: 3 } }, savedAt: 999 };
    assert.equal(app.stableStateHash(first), app.stableStateHash(reordered));
    app.setSyncedHash('hash-a');
    app.activeBillId = 'bill-b'; assert.equal(app.getSyncedHash(), '');
    app.setSyncedHash('hash-b');
    app.activeBillId = 'bill-a'; assert.equal(app.getSyncedHash(), 'hash-a');
});
test('explicit keep-local resolution sends even when contents equal the last sent snapshot', async () => {
    let requests = 0;
    const { app } = setup(async () => { requests++; return { ok: true, status: 200, json: async () => ({ success: true, rev: 4 }) }; });
    app.lastSentHash = app.stableStateHash(app.buildSyncPayload());
    await app.syncToCloudNow(); assert.equal(requests, 0);
    await app.syncToCloudNow({ force: true, manual: true }); assert.equal(requests, 1);
});
test('reload preserves later local edits without reporting this PCs own acknowledged save as another-PC conflict', async () => {
    const server = { poleScheduleQuantities: { 907: { 0: { 1: 7 } } }, savedAt: 100 };
    const local = { ...server, poleScheduleQuantities: { 907: { 0: { 1: 23 } } }, baseRev: 1, savedAt: 200 };
    const { app, storage } = setup(async () => ({ ok: true, json: async () => ({ success: true, dataId: 'bill-a', data: server, rev: 2 }) }));
    storage.set('lk_billing_state_bill-a', JSON.stringify(local));
    app.setSyncedHash(app.stableStateHash(server));
    Object.assign(app, { initDefaultSampleQuantities() {}, normalizeAllContractorBanks() {}, checkAndApplyAutoGstRule() {} });
    await app.loadFromStorage();
    assert.equal(app.poleScheduleQuantities['907'][0][1], 23);
    assert.equal(app.cloudConflict, false);
    assert.equal(app.cloudRev, 2);
});
test('unload does not send an unchanged timestamp-only snapshot or race an in-flight save', () => {
    let requests = 0;
    const { app } = setup(async () => { requests++; });
    app.lastSentHash = app.stableStateHash(app.buildSyncPayload());
    app.flushPendingSync(); assert.equal(requests, 0);
    app.quantity.value = 99; app._cloudSyncPromise = Promise.resolve();
    app.flushPendingSync(); assert.equal(requests, 0);
});
test('visibility change plus unload share one acknowledged keepalive request', async () => {
    let release, requests = 0;
    const wait = new Promise(resolve => release = resolve);
    const { app } = setup(async (url, init) => {
        requests++; assert.equal(init.keepalive, true); await wait;
        return { ok: true, status: 200, json: async () => ({ success: true, rev: 2 }) };
    });
    app.flushPendingSync(); app.flushPendingSync();
    assert.equal(requests, 1);
    const done = app._cloudSyncPromise; release(); await done; await tick();
    assert.equal(app.cloudRev, 2);
    app.flushPendingSync(); assert.equal(requests, 1, 'A later pagehide must not save unchanged data again');
});
