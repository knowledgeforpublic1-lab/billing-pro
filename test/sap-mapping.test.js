const assert = require('node:assert/strict');
global.window = global;
require('../js/views.js');
require('../js/pole-schedule.js');
require('../js/utils.js');

function makeApp() {
    return Object.assign({
        poleSchedules: { '907': { materials: [
            { no: '1', desc: 'RSJ Pole', unit: 'No', itemCode: '' },
            { no: '2', desc: 'V Cross Arm', unit: 'No', sapItems: [] }
        ] } },
        activities: { '907': { materials: [{ no: '1', desc: 'Activity pole', itemCode: 'KEEP' }] } },
        selectedPoleScheduleKey: '907',
        selectedActivityKey: '907',
        currentView: 'poleSchedule',
        $refs: {},
        $nextTick(fn) { fn(); },
        showToast() {},
        saveToStorage() { this.saved = JSON.stringify(this.poleSchedules); },
        scheduleMappingSync() {},
        persistPoleSchedulesToMasterFile() {},
        syncPoleScheduleToBillingAndReconciliation() { this.recalculated = true; },
        syncToMongoNow() {}
    }, window.ViewsModule, {
        getCurrentPoleSchedule: window.PoleScheduleModule.getCurrentPoleSchedule,
        getPoleScheduleMaterials: window.PoleScheduleModule.getPoleScheduleMaterials,
        getFilteredPoleScheduleMaterials: window.PoleScheduleModule.getFilteredPoleScheduleMaterials
    });
}

const sap = { code: '17000004', desc: 'SAP catalog description', uom: 'NO' };
const app = makeApp();
// Open a displayed copy, as the Pole Schedule table does.
let row = app.getFilteredPoleScheduleMaterials()[1];
app.openSapItemManager(row, row.origIndex, 'poleSchedule', '907');
app.selectSapItemForManager(sap);
assert.equal(app.getFilteredPoleScheduleMaterials()[1].itemCode, sap.code);
assert.equal(app.getFilteredPoleScheduleMaterials()[1].desc, 'V Cross Arm');
assert.equal(JSON.parse(app.saved)['907'].materials[1].itemCode, sap.code);
assert.equal(app.activities['907'].materials[0].itemCode, 'KEEP');
assert.equal(app.recalculated, true);
app.closeSapItemManager();
row = app.getFilteredPoleScheduleMaterials()[1];
app.openSapItemManager(row, row.origIndex, 'poleSchedule', '907');
assert.equal(app.activeSapManagerItem.sapItems[0].code, sap.code);
app.removeSapItemFromManager(0);
assert.equal(app.getFilteredPoleScheduleMaterials()[1].itemCode, '');
app.setSapItemNa();
assert.equal(app.getFilteredPoleScheduleMaterials()[1].itemCode, 'N/A');

// A direct source row without a display index must still save to that row.
app.openSapItemManager(app.poleSchedules['907'].materials[0], undefined, 'poleSchedule', '907');
app.selectSapItemForManager(sap);
assert.equal(JSON.parse(app.saved)['907'].materials[0].itemCode, sap.code);
assert.equal(app.poleSchedules['907'].materials[1].itemCode, 'N/A');
console.log('SAP mapping: source row, visible badge, save/reopen, remove, N/A and activity isolation passed.');

// Real 907 eight-metre pole: rendering the stock badge used to translate
// 17005037 into the unrelated ten-metre code 17001242 on the display copy.
const poleApp = makeApp();
Object.assign(poleApp, {
    isPoleScheduleItemUnissued: window.PoleScheduleModule.isPoleScheduleItemUnissued,
    isSapCodeIssuedToActiveContractor: window.PoleScheduleModule.isSapCodeIssuedToActiveContractor,
    getPoleScheduleItemStockTooltip: window.PoleScheduleModule.getPoleScheduleItemStockTooltip,
    getActiveContractorSapStock() {
        return { contractorName: 'Test contractor', materials: {
            '17005037': { netIssue: 12, uom: 'NO' }
        } };
    }
});
poleApp.poleSchedules['907'] = JSON.parse(JSON.stringify(require('../js/data/default-pole-schedules.js')['907']));
const poleIndex = poleApp.poleSchedules['907'].materials.findIndex(m => m.itemCode === '17005037');
assert.ok(poleIndex >= 0);
row = poleApp.getFilteredPoleScheduleMaterials().find(m => m.origIndex === poleIndex);
poleApp.openSapItemManager(row, row.origIndex, 'poleSchedule', '907');
poleApp.selectSapItemForManager({ code: '17005037', desc: 'RSJ POLE 100X116 MM 8 MTR', uom: 'NO' });
poleApp.closeSapItemManager();
row = poleApp.getFilteredPoleScheduleMaterials().find(m => m.origIndex === poleIndex);
assert.equal(poleApp.isPoleScheduleItemUnissued(row), false, 'Issued eight-metre code must not show Unissued');
assert.equal(row.itemCode, '17005037', 'Stock badge rendering must not replace the selected code');
assert.match(poleApp.getPoleScheduleItemStockTooltip(row), /Stock OK/);
assert.equal(JSON.parse(poleApp.saved)['907'].materials[poleIndex].itemCode, '17005037');
assert.equal(window.replaceOldSapCodeWithNew('17005037'), '17005037');
assert.equal(window.replaceOldSapCodeWithNew('17005037, 17001242'), '17005037, 17001242');
console.log('907 eight-metre pole: selected code, stock status, tooltip and saved mapping passed.');

async function checkAllSchedules() {
    require('../js/sync.js');
    const schedules = require('../js/data/default-pole-schedules.js');
    const selectedCodes = ['17005037', '17001246', '17001244', 'CUSTOM-POLE-99'];
    const all = makeApp();
    all.poleSchedules = JSON.parse(JSON.stringify(schedules));
    Object.assign(all, {
        getPoleScheduleItemTotalQty() { return 0; },
        isPoleScheduleItemUnissued: window.PoleScheduleModule.isPoleScheduleItemUnissued,
        isSapCodeIssuedToActiveContractor: window.PoleScheduleModule.isSapCodeIssuedToActiveContractor,
        getActiveContractorSapStock() {
            return { materials: Object.fromEntries(selectedCodes.map(code => [code, { netIssue: 10 }])) };
        }
    });
    for (const key of Object.keys(schedules)) {
        all.selectedPoleScheduleKey = key;
        const index = schedules[key].materials.findIndex(m => !m.isSection && !m.isSpan);
        assert.ok(index >= 0, key + ': material row exists');
        const originalDesc = schedules[key].materials[index].desc;
        for (const code of selectedCodes) {
            // A search filter exercises display copies while retaining source indices.
            all.poleScheduleSearchQuery = originalDesc;
            const displayed = all.getFilteredPoleScheduleMaterials().find(m => m.origIndex === index);
            all.openSapItemManager(displayed, index, 'poleSchedule', key);
            all.activeSapManagerItem.sapItems = [];
            all.selectSapItemForManager({ code, desc: 'Selected contractor material', uom: 'NO' });
            all.closeSapItemManager();
            const mapped = all.getFilteredPoleScheduleMaterials().find(m => m.origIndex === index);
            assert.ok(mapped, key + ': mapped row stays visible under description search');
            assert.equal(mapped.itemCode, code, key + ': selected code displayed');
            assert.equal(all.isPoleScheduleItemUnissued(mapped), false, key + ': exact issued code checked');
            assert.equal(mapped.desc, originalDesc, key + ': description preserved');
            assert.equal(JSON.parse(all.saved)[key].materials[index].itemCode, code, key + ': code saved');
        }
        // These descriptions triggered the previous 919 load-time overrides.
        all.poleSchedules[key].materials[index].desc = 'RSJ 152x152, 13 m long';
        all.poleSchedules[key].materials[index].activityMaterialNo = 'CUSTOM-LINK';
    }

    const snapshot = {
        poleSchedules: all.poleSchedules,
        activities: {
            '919': { materials: Array.from({ length: 5 }, (_, i) => ({
                no: String(i + 1), desc: 'Flats for stay & C clamps',
                itemCode: '17001294', sapItems: [{ code: '17001294', qty: 1 }]
            })) },
            '922': { materials: [{ no: '1' }, {
                no: '2', desc: 'Flats for stay & C clamps', itemCode: '17001294',
                sapItems: [{ code: '17001294', qty: 1 }]
            }] }
        },
        poleScheduleQuantities: { '919': { 0: { 1: 7 } } }
    };
    const expected = JSON.parse(JSON.stringify(snapshot));
    const previousFetch = global.fetch;
    const previousStorage = global.localStorage;
    const previousDefaults = global.defaultActivities;
    try {
        global.defaultActivities = require('../js/data/default-activities.js');
        global.localStorage = { getItem() { return null; }, setItem() {} };
        global.fetch = async () => ({ ok: true, json: async () => ({ success: true, data: snapshot, rev: 1 }) });
        const loaded = Object.assign(makeApp(), {
            loadFromStorage: window.SyncModule.loadFromStorage,
            stableStateHash: window.SyncModule.stableStateHash,
            getSyncedHash() { return ''; }, setSyncedHash() {},
            initDefaultSampleQuantities() {}, normalizeAllContractorBanks() {}, checkAndApplyAutoGstRule() {}
        });
        await loaded.loadFromStorage({ forceServer: true });
        assert.deepEqual(loaded.poleSchedules, expected.poleSchedules, 'All mappings and custom links survive actual cloud reload');
        assert.deepEqual(loaded.activities['919'], expected.activities['919'], '919 single-code clamp mapping survives reload');
        assert.equal(loaded.activities['922'].materials[1].itemCode, '17001294', '922 selected clamp code survives reload');
        assert.deepEqual(loaded.poleScheduleQuantities, expected.poleScheduleQuantities, 'Measurement quantities preserved');
    } finally {
        global.fetch = previousFetch;
        global.localStorage = previousStorage;
        global.defaultActivities = previousDefaults;
    }
    console.log(`All ${Object.keys(schedules).length} Pole Schedules: mapping, stock status, save and cloud reload passed.`);
}
checkAllSchedules().catch(err => { console.error(err); process.exitCode = 1; });
