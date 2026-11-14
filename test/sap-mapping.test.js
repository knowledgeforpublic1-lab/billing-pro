const assert = require('node:assert/strict');
global.window = global;
require('../js/views.js');
require('../js/pole-schedule.js');

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
