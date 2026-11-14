const assert = require('node:assert/strict');
const clone = value => JSON.parse(JSON.stringify(value));
global.window = global;
const cache = new Map();
global.localStorage = { getItem: key => cache.get(key) || null, setItem: (key, value) => cache.set(key, value) };
global.defaultActivities = require('../js/data/default-activities.js');
global.defaultPoleSchedules = require('../js/data/default-pole-schedules.js');
require('../js/contractor-mapping.js');
require('../js/views.js');
require('../js/mapping.js');
require('../js/pole-schedule.js');
require('../js/sync.js');
require('../js/history.js');
const savedProfiles = new Map();
const requests = [];
global.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (options.method === 'POST') {
        const { contractorId, profile } = JSON.parse(options.body);
        savedProfiles.set(contractorId, { ...clone(profile), dirty: false });
        return { ok: true, json: async () => ({ success: true }) };
    }
    const id = new URL(url, 'http://localhost').searchParams.get('contractorId');
    return { ok: true, json: async () => ({ success: true, profile: savedProfiles.get(id) || null }) };
};
function makeApp() {
    return Object.assign({}, window.ViewsModule, window.ContractorMappingModule, {
        selectedContractorId: 'contractor_A',
        activities: clone(defaultActivities), poleSchedules: clone(defaultPoleSchedules),
        poleScheduleQuantities: { '907': { 0: { 1: 23 } } },
        activityQuantities: { '907': [[0, 23]] },
        saveToStorage() { this.captureContractorMapping(); this.saved = clone(this.contractorMappingState); },
        showToast() {}, scheduleMappingSync() {}, syncPoleScheduleToBillingAndReconciliation() {},
        persistPoleSchedulesToMasterFile: window.PoleScheduleModule.persistPoleSchedulesToMasterFile,
        persistActivitiesToMasterFile: window.MappingModule.persistActivitiesToMasterFile,
        syncToMongoNow() {}, $refs: {}, $nextTick(fn) { fn(); }
    });
}
function choose(app, id) { app.selectedContractorId = id; app.switchContractorMapping(); app.saveToStorage(); }
function mapRow(app, key, index, code, context = 'poleSchedule') {
    const group = context === 'poleSchedule' ? app.poleSchedules : app.activities;
    app.openSapItemManager({ ...group[key].materials[index], origIndex: index }, index, context, key);
    app.activeSapManagerItem.sapItems = [];
    app.selectSapItemForManager({ code, desc: 'Contractor-specific SAP item', uom: 'NO' });
    app.closeSapItemManager();
}
async function main() {
    const app = makeApp();
    app.initializeContractorMappings();
    const quantities = JSON.stringify([app.poleScheduleQuantities, app.activityQuantities]);
    const indices = {};
    for (const [key, schedule] of Object.entries(app.poleSchedules)) {
        indices[key] = schedule.materials.findIndex(row => !row.isSection && !row.isSpan);
        mapRow(app, key, indices[key], 'CODE-A-' + key);
    }
    await app.persistContractorMapping();
    choose(app, 'contractor_B');
    for (const key of Object.keys(indices)) {
        assert.notEqual(app.poleSchedules[key].materials[indices[key]].itemCode, 'CODE-A-' + key, key + ': A code cannot leak into B');
        mapRow(app, key, indices[key], 'CODE-B-' + key);
    }
    await app.persistContractorMapping();
    choose(app, 'contractor_A');
    for (const key of Object.keys(indices)) assert.equal(app.poleSchedules[key].materials[indices[key]].itemCode, 'CODE-A-' + key);
    choose(app, 'contractor_B');
    for (const key of Object.keys(indices)) assert.equal(app.poleSchedules[key].materials[indices[key]].itemCode, 'CODE-B-' + key);
    assert.equal(JSON.stringify([app.poleScheduleQuantities, app.activityQuantities]), quantities, 'Contractor selection preserves entered measurements');
    assert.equal(app.poleSchedules['907'].materials[indices['907']].rate, defaultPoleSchedules['907'].materials[indices['907']].rate, 'Rate unchanged');

    // Clearing and N/A are explicit mappings, not a request to restore shared defaults.
    const index = indices['907'];
    app.openSapItemManager(app.poleSchedules['907'].materials[index], index, 'poleSchedule', '907');
    app.removeSapItemFromManager(0);
    choose(app, 'contractor_A');
    choose(app, 'contractor_B');
    assert.equal(app.poleSchedules['907'].materials[index].itemCode, '');
    app.openSapItemManager(app.poleSchedules['907'].materials[index], index, 'poleSchedule', '907');
    app.setSapItemNa();
    choose(app, 'contractor_A');
    choose(app, 'contractor_B');
    assert.equal(app.poleSchedules['907'].materials[index].itemCode, 'N/A');

    // Activity codes are isolated too; this must not change any material description.
    const description = app.activities['907'].materials[0].desc;
    mapRow(app, '907', 0, 'ACTIVITY-B', 'activity');
    choose(app, 'contractor_A');
    assert.notEqual(app.activities['907'].materials[0].itemCode, 'ACTIVITY-B');
    choose(app, 'contractor_B');
    assert.equal(app.activities['907'].materials[0].itemCode, 'ACTIVITY-B');
    assert.equal(app.activities['907'].materials[0].desc, description);
    await app.persistContractorMapping();
    const reloaded = makeApp();
    reloaded.selectedContractorId = 'contractor_B';
    reloaded.activities = clone(app.activities);
    reloaded.poleSchedules = clone(app.poleSchedules);
    reloaded.contractorMappingState = clone(app.contractorMappingState);
    reloaded.initializeContractorMappings();
    choose(reloaded, 'contractor_A');
    assert.equal(reloaded.poleSchedules['907'].materials[index].itemCode, 'CODE-A-907', 'Profiles survive saved bill reload');

    // Another bill/device can load the saved profile from the contractor API.
    const fresh = makeApp();
    fresh.selectedContractorId = 'contractor_B';
    fresh.initializeContractorMappings();
    assert.equal(fresh.contractorMappingState.profiles.contractor_B.dirty, false);
    await fresh.loadContractorMapping('contractor_B');
    assert.equal(fresh.activities['907'].materials[0].itemCode, 'ACTIVITY-B', 'Saved contractor mapping is reusable in another bill');
    assert.equal(fresh.poleSchedules['907'].materials[index].itemCode, 'N/A');

    // A delayed response cannot replace a manual edit made while it was loading.
    const oldFetch = global.fetch;
    let resolveFetch;
    global.fetch = (url, options = {}) => options.method === 'POST'
        ? oldFetch(url, options)
        : new Promise(resolve => { resolveFetch = resolve; });
    const pending = fresh.loadContractorMapping('contractor_B');
    mapRow(fresh, '907', index, 'LATEST-MANUAL');
    resolveFetch({ ok: true, json: async () => ({ success: true, profile: savedProfiles.get('contractor_B') }) });
    await pending;
    assert.equal(fresh.poleSchedules['907'].materials[index].itemCode, 'LATEST-MANUAL');
    global.fetch = oldFetch;
    assert.ok(requests.every(r => !r.url.includes('save-default-')), 'Contractor mapping must never write shared defaults');
    assert.ok(window.SyncModule.buildSyncPayload.call(app).contractorMappingState, 'Cloud bill payload includes contractor profiles');
    app.takeSnapshot = () => {};
    app.scheduleRemoteSync = () => {};
    window.SyncModule.saveToStorage.call(app);
    const localBill = JSON.parse(localStorage.getItem('lk_billing_app_state_v10'));
    assert.ok(localBill.contractorMappingState.profiles.contractor_A, 'Actual local bill save retains other contractors');
    const boot = Object.assign(makeApp(), {
        loadFromStorage: window.SyncModule.loadFromStorage,
        stableStateHash: window.SyncModule.stableStateHash,
        getSyncedHash() { return ''; }, setSyncedHash() {},
        initDefaultSampleQuantities() {}, normalizeAllContractorBanks() {}, checkAndApplyAutoGstRule() {}
    });
    await boot.loadFromStorage();
    assert.equal(boot.selectedContractorId, 'contractor_B');
    choose(boot, 'contractor_A');
    assert.equal(boot.poleSchedules['907'].materials[index].itemCode, 'CODE-A-907', 'Actual boot/load restores contractor mappings');
    assert.equal(JSON.stringify([boot.poleScheduleQuantities, boot.activityQuantities]), quantities, 'Actual reload retains measurement quantities');
    boot.historyStack = [];
    boot.historyIndex = -1;
    window.HistoryModule.takeSnapshot.call(boot);
    const snap = boot.historyStack[0];
    mapRow(boot, '907', index, 'CHANGED-AFTER-SNAPSHOT');
    window.HistoryModule.applySnapshot.call(boot, snap);
    assert.equal(boot.poleSchedules['907'].materials[index].itemCode, 'CODE-A-907', 'Undo restores the correct contractor mapping');
    assert.equal(boot.contractorMappingState.profiles.contractor_A.dirty, true, 'Undo marks restored mapping for cloud persistence');
    console.log('Contractor mapping: all 12 schedules, A/B isolation, quantities, N/A, clearing, activity codes, reload, cross-bill reuse and delayed responses passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
