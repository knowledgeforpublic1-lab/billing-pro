const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
global.window = global;
global.defaultActivities = require('../js/data/default-activities.js');
global.defaultPoleSchedules = require('../js/data/default-pole-schedules.js');
const methods = require('../js/pole-schedule.js');
require('../js/billing.js');
require('../js/contractor-mapping.js');
global.localStorage = { getItem() { return null; }, setItem() {} };
let options;
vm.runInNewContext(fs.readFileSync('js/core/app.js', 'utf8'), {
    window: {}, console, document: { addEventListener() {} },
    Vue: { createApp(value) { options = value; return { directive() {}, config: {}, mount() {} }; } }
});
function app(key = '907') {
    return Object.assign({}, methods, BillingModule, ContractorMappingModule, {
        selectedPoleScheduleKey: key, selectedContractorId: 'A',
        activities: structuredClone(defaultActivities), poleSchedules: structuredClone(defaultPoleSchedules),
        activityQuantities: {}, activityLocations: {}, poleScheduleLocations: {}, poleScheduleQuantities: {},
        masterAbstractList: [], getContractorSapIssues() { return null; }, getContractorOldReco() { return null; },
        saveToStorage() {}, persistContractorMapping() {}, getPrevReconQty() { return 0; }
    });
}
function enter(a, key, desc, qty, location = 'Site 1') {
    const index = a.poleSchedules[key].materials.findIndex(m => m.desc === desc);
    assert.ok(index >= 0, desc);
    a.poleScheduleLocations[key] = [{ name: location }];
    a.poleScheduleQuantities[key] = { 0: { [index]: qty } };
    a.syncPoleScheduleToBillingAndReconciliation(key);
    return index;
}
function qty(a, key, no, location = 0) {
    const index = a.activities[key].materials.findIndex(m => String(m.no) === String(no));
    return a.activityQuantities[key]?.[location]?.[index];
}

test('ambiguous clamp can be linked, moved and cleared without duplicating activity quantities', () => {
    const a = app();
    const index = enter(a, '907', 'Side Clamp A Type', 10);
    assert.ok(a.poleScheduleTransferWarnings['907'].includes(index));
    a.setPoleScheduleActivityLink(index, '5');
    assert.equal(qty(a, '907', '5'), 10);
    assert.ok(!a.poleScheduleTransferWarnings['907'].includes(index));
    a.setPoleScheduleActivityLink(index, '6');
    assert.equal(qty(a, '907', '5'), '');
    assert.equal(qty(a, '907', '6'), 10);
    a.setPoleScheduleActivityLink(index, '');
    assert.equal(qty(a, '907', '6'), '');
    assert.ok(a.poleScheduleTransferWarnings['907'].includes(index));
    assert.equal(a.poleScheduleQuantities['907'][0][index], 10);
});

test('known sleeve and extension components have unambiguous destinations', () => {
    for (const [desc, no] of [['Sleve Joints', '12'], ['Side Clamp for 11 KV V-Cross Arm (Extension)', '5'], ['Side Clamp for Guarding Channel', '3'], ['Side Clamp for Top Clit (Extension)', '6']]) {
        const a = app();
        enter(a, '907', desc, 10);
        assert.equal(qty(a, '907', no), 10, desc);
    }
});

test('case aliases feed the canonical activity and reconcile once, including both saved aliases', () => {
    const a = app('1425a');
    enter(a, '1425a', 'PSC Pole 8 Mtr (140 KG)', 10);
    assert.equal(qty(a, '1425A', '1'), 10);
    assert.equal(a.getPoleScheduleRateLink(a.poleSchedules['1425a'].materials[1], '1425a').status, 'linked');
    let pivot = options.computed.pivotReconciliationData.call(a);
    assert.equal(pivot.rows.find(r => r.code === '17001240').totalQty, 10);
    enter(a, '1425A', 'PSC Pole 8 Mtr (140 KG)', 3, 'Site 2');
    assert.equal(a.activityLocations['1425A'].length, 2);
    assert.equal(a.activityQuantities['1425A'].reduce((sum, row) => sum + Number(row[0] || 0), 0), 13);
    a.syncPoleScheduleToBillingAndReconciliation('1425a');
    pivot = options.computed.pivotReconciliationData.call(a);
    assert.equal(pivot.rows.find(r => r.code === '17001240').totalQty, 13);
    assert.deepEqual(Array.from(pivot.columns).filter(key => key.toLowerCase() === '1425a'), ['1425A']);
    assert.equal(a.poleScheduleQuantities['1425a'][0][1], 10);
});

test('stock warning and reconciliation share historical baseline, explicit SAP zero and date cutoff', () => {
    const a = app();
    a.getContractorSapIssues = () => ({ materials: { OTHER: { netIssue: 2 } } });
    a.getContractorOldReco = () => ({ materials: { '17005046': { netIssue: 25, unit: 'NO' } } });
    const row = { itemCode: '17005046', unit: 'No' };
    let pivot = options.computed.pivotReconciliationData.call(a);
    assert.equal(pivot.rows.find(r => r.code === row.itemCode).sapNetIssue, 25);
    assert.equal(a.isPoleScheduleItemUnissued(row), false);
    assert.match(a.getPoleScheduleItemStockTooltip(row), /25 NO/);
    a.getContractorSapIssues = () => ({ materials: { '17005046': { netIssue: 0, grossIssue: 0 } } });
    assert.equal(a.isPoleScheduleItemUnissued(row), true);
    a.stockAsOnDate = '2026-10-01';
    a.getContractorSapIssues = () => null;
    assert.equal(a.isPoleScheduleItemUnissued(row), true);
    assert.equal(a.getReconciliationIssueStock().materials['17005046'].netIssue, 0);
});

test('activity links survive contractor profile reload without leaking to another contractor', () => {
    const a = app();
    a.initializeContractorMappings();
    const index = enter(a, '907', 'Side Clamp A Type', 10);
    a.setPoleScheduleActivityLink(index, '5');
    const profile = structuredClone(a.contractorMappingState.profiles.A);
    a.applyContractorMapping(null);
    assert.equal(a.poleSchedules['907'].materials[index].activityMaterialNo, undefined);
    a.applyContractorMapping(profile);
    assert.equal(a.poleSchedules['907'].materials[index].activityMaterialNo, '5');
    assert.equal(qty(a, '907', '5'), 10);
});
