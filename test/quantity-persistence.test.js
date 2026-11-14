const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function main() {
    let diskValue;
    let cacheValue;
    const db = { transaction() { return { objectStore() { return { get() {
        const req = {};
        queueMicrotask(() => req.onsuccess({ target: req }));
        Object.defineProperty(req, 'result', { get: () => diskValue });
        return req;
    } }; } }; } };
    const indexedDB = { open() {
        const req = {};
        queueMicrotask(() => req.onsuccess({ target: { result: db } }));
        return req;
    } };
    const storageContext = { window: { indexedDB }, localStorage: { getItem() { return cacheValue; } }, console };
    vm.runInNewContext(fs.readFileSync('js/core/storage.js', 'utf8'), storageContext);
    const store = storageContext.window.BillingStorage;
    cacheValue = JSON.stringify({ savedAt: 200, poleScheduleQuantities: { '907': { 0: { 1: 23 } } } });
    diskValue = JSON.stringify({ savedAt: 100, poleScheduleQuantities: {} });
    assert.equal(await store.getItemAsync('bill'), cacheValue, 'New localStorage quantities beat a stale IndexedDB snapshot');
    [cacheValue, diskValue] = [diskValue, cacheValue];
    assert.equal(await store.getItemAsync('bill'), diskValue, 'New IndexedDB snapshot beats stale localStorage');
    cacheValue = null;
    assert.equal(await store.getItemAsync('bill'), diskValue, 'IndexedDB remains available after localStorage quota failure');

    let server;
    let local;
    let syncedHash;
    const timers = [];
    const context = {
        window: {}, console,
        localStorage: { getItem(key) { return key === 'lk_billing_app_state_v10' ? local : null; }, setItem() {} },
        fetch: async () => ({ ok: true, json: async () => ({ success: true, data: server.data, rev: server.rev }) }),
        setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {}
    };
    vm.runInNewContext(fs.readFileSync('js/sync.js', 'utf8'), context);
    const methods = context.window.SyncModule;
    function app() {
        return Object.assign({}, methods, {
            getSyncedHash() { return syncedHash; }, setSyncedHash(hash) { syncedHash = hash; },
            showToast() {}, initDefaultSampleQuantities() {}, normalizeAllContractorBanks() {}, checkAndApplyAutoGstRule() {}
        });
    }
    const old = { poleScheduleQuantities: { '907': { 0: { 1: 7 } } }, savedAt: 100, baseRev: 1 };
    const edited = { poleScheduleQuantities: { '907': { 0: { 1: 23 } } }, savedAt: 200, baseRev: 1 };
    server = { data: old, rev: 1 };
    local = JSON.stringify(edited);
    syncedHash = methods.stableStateHash(old);
    let loaded = app();
    await loaded.loadFromStorage();
    assert.equal(loaded.poleScheduleQuantities['907'][0][1], 23, 'Browser reload preserves unsynced Pole Schedule entries');

    server = { data: { ...old, poleScheduleQuantities: { '907': { 0: { 1: 11 } } }, savedAt: 300 }, rev: 2 };
    loaded = app();
    await loaded.loadFromStorage();
    assert.equal(loaded.poleScheduleQuantities['907'][0][1], 23, 'New server revision cannot discard unsynced local quantities');
    assert.equal(loaded.cloudConflict, true, 'Both-side edits stop automatic replacement');
    context.fetch = async () => { throw new Error('Conflict must not issue a cloud write'); };
    assert.equal(await loaded.syncToCloudNow(), false);

    context.fetch = async () => ({ ok: true, json: async () => ({ success: true, data: server.data, rev: server.rev }) });
    local = JSON.stringify(old);
    syncedHash = methods.stableStateHash(old);
    loaded = app();
    await loaded.loadFromStorage();
    assert.equal(loaded.poleScheduleQuantities['907'][0][1], 11, 'Clean local state still receives other-PC updates');
    assert.equal(methods.stableStateHash(old), methods.stableStateHash({ ...old, dataId: 'bill', force: true }), 'Transport fields cannot make a clean bill look dirty');

    const order = [];
    const refreshing = Object.assign({}, methods, {
        _saveTimer: 1,
        saveToStorage() { order.push('save'); },
        async loadFromStorage(opts) { assert.ok(!opts || !opts.forceServer); order.push('load'); },
        showToast() {}
    });
    await refreshing.refreshFromCloud();
    assert.deepEqual(order, ['save', 'load'], 'Toolbar Refresh persists pending quantities before using safe reload rules');
    const backupWrites = new Map();
    context.window.BillingStorage = {
        async getItemAsync(key) { return backupWrites.get(key) || local; },
        async setItem(key, value) { backupWrites.set(key, value); }
    };
    server = { data: edited, rev: 3 };
    context.fetch = async () => ({ ok: true, json: async () => ({ success: true, data: server.data, dataId: 'recover-bill', rev: 3 }) });
    local = JSON.stringify(old);
    loaded = app();
    await loaded.loadFromStorage({ dataId: 'recover-bill', forceServer: true, preserveLocalBackup: true });
    assert.ok([...backupWrites.keys()].some(key => key.startsWith('lk_billing_recovery_recover-bill_')), 'Recovery keeps the previous local snapshot');
    assert.equal(loaded.poleScheduleQuantities['907'][0][1], 23, 'Recovery opens the selected filled bill');
    console.log('Quantity persistence: newest storage copy, browser/toolbar refresh, unsynced edits and cloud conflicts passed.');
}
main().catch(err => { console.error(err); process.exitCode = 1; });
