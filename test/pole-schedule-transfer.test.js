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
require('../js/views.js');
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

test('normal 1220 uses only Activity 1220; departmental rates and quantities stay independent', () => {
    const a = app('1220');
    const index = enter(a, '1220', 'Dist. Transformer 100 KVA, 11/0.43 kv', 2);
    const row = a.poleSchedules['1220'].materials[index];
    const activityIndex = a.activities['1220'].materials.findIndex(m => String(m.no) === '1');
    a.activities['1220'].materials[activityIndex].rate = 321;
    assert.equal(qty(a, '1220', '1'), 2);
    assert.equal(a.getPoleScheduleRateValue(row, '1220'), 321);
    const before = JSON.stringify([a.activityQuantities, a.activityLocations]);
    const dept = a.poleSchedules.dept_1220A.materials.find(m => !m.isSection && !m.isSpan);
    dept.rate = 99999;
    dept.activityMaterialNo = '1';
    a.poleScheduleQuantities.dept_1220A = { 0: { 0: 100 } };
    a.syncPoleScheduleToBillingAndReconciliation('dept_1220A');
    assert.equal(JSON.stringify([a.activityQuantities, a.activityLocations]), before);
    assert.equal(a.getPoleScheduleRateLink(dept, 'dept_1220A').status, 'departmental');
    assert.equal(a.getPoleScheduleRateValue(dept, 'dept_1220A'), 99999);
    assert.equal(a.getPoleScheduleActivityLink(dept, 'dept_1220A'), '');
    assert.deepEqual(a.getPoleScheduleActivityMaterials('dept_1220A'), []);
    assert.equal(a.getPoleScheduleRateValue({ itemCode: 'MISSING', rate: 99999 }, '1220'), 0);
    const pivot = options.computed.pivotReconciliationData.call(a);
    assert.ok(!Array.from(pivot.columns).some(k => /^dept_/i.test(k)));
    assert.equal(pivot.rows.find(r => r.code === row.itemCode).totalQty, 2);
});

test('departmental locations and flag-based schedules never inherit or update activity data', () => {
    const a = app('dept_1220A');
    const before = JSON.stringify([a.activities, a.activityQuantities, a.activityLocations]);
    a.locations = [{ name: 'Normal billing location' }];
    a.psAutoPole = a.psAutoStay = a.psAutoMuffing = false;
    a.showToast = () => {};
    assert.deepEqual(a.getPoleScheduleLocations('dept_1220A'), [{ name: 'Location 1' }]);
    const oldPrompt = global.prompt, oldConfirm = global.confirm;
    try {
        global.prompt = () => 'Department location'; global.confirm = () => true;
        a.addPoleScheduleLocation();
        a.renamePoleScheduleLocation(0);
        a.removePoleScheduleLocation(1);
    } finally { global.prompt = oldPrompt; global.confirm = oldConfirm; }
    assert.equal(JSON.stringify([a.activities, a.activityQuantities, a.activityLocations]), before);
    a.poleSchedules['1220'].isDepartmental = true;
    a.selectedPoleScheduleKey = '1220';
    assert.deepEqual(a.getPoleScheduleActivityMaterials('1220'), []);
    const index = a.poleSchedules['1220'].materials.findIndex(m => !m.isSection && !m.isSpan);
    a.setPoleScheduleActivityLink(index, '1');
    assert.equal(a.poleSchedules['1220'].materials[index].activityMaterialNo, undefined);
});

test('1220 activity row adds second and third SAP components and preserves them on save/reopen', () => {
    const a = Object.assign(app('1220'), ViewsModule, {
        selectedActivityKey: '1220', currentView: 'detail', $refs: {},
        $nextTick(fn) { fn(); }, showToast() {}, scheduleMappingSync() {},
        syncToMongoNow() {}, saveToStorage() { this.savedActivity = structuredClone(this.activities['1220']); }
    });
    const index = a.activities['1220'].materials.findIndex(m => String(m.no) === '4');
    const source = a.activities['1220'].materials[index];
    assert.match(source.desc, /AB Switch, HG Fuse, LTDB Channel/);
    const first = source.sapItems[0].code;
    source.sapItems[0].qty = 0.5;
    a.openSapItemManager({ ...source, origIndex: index }, index, 'activity', '1220');
    a.selectSapItemForManager({ code: '17005063', desc: 'Support channel', uom: 'NO' });
    a.selectSapItemForManager({ code: '17005069', desc: 'Support angle', uom: 'NO' });
    a.selectSapItemForManager({ code: '17005063', desc: 'Support channel', uom: 'NO' });
    assert.deepEqual(source.sapItems.map(s => s.code), [first, '17005063', '17005069']);
    assert.equal(source.sapItems[0].qty, 0.5);
    a.closeSapItemManager();
    a.activities['1220'] = structuredClone(a.savedActivity);
    a.openSapItemManager({ ...a.activities['1220'].materials[index], origIndex: index }, index, 'activity', '1220');
    assert.equal(a.activeSapManagerItem.sapItems.length, 3);
    assert.equal(a.activeSapManagerItem.itemCode, [first, '17005063', '17005069'].join(', '));
    a.removeSapItemFromManager(1);
    assert.deepEqual(a.activities['1220'].materials[index].sapItems.map(s => s.code), [first, '17005069']);
});

test('every activity and pole schedule can add multiple SAP codes starting with one code', () => {
    const a = Object.assign(app(), ViewsModule, {
        $refs: {}, $nextTick(fn) { fn(); }, showToast() {}, scheduleMappingSync() {},
        syncToMongoNow() {}, persistPoleSchedulesToMasterFile() {}, syncPoleScheduleToBillingAndReconciliation() {}
    });
    for (const [kind, context] of [['activities', 'activity'], ['poleSchedules', 'poleSchedule']]) {
        for (const [key, group] of Object.entries(a[kind])) {
            const index = group.materials.findIndex(row => !row.isSection && !row.isSpan);
            const row = group.materials[index];
            row.sapItems = [{ code: 'FIRST', desc: 'Existing', qty: 0.25 }];
            row.itemCode = 'FIRST';
            a.openSapItemManager({ ...row, origIndex: index }, index, context, key);
            for (const code of ['SECOND', 'THIRD', 'SECOND']) a.selectSapItemForManager({ code, desc: code, uom: 'NO' });
            assert.deepEqual(row.sapItems.map(s => s.code), ['FIRST', 'SECOND', 'THIRD'], context + ' ' + key);
            assert.equal(row.sapItems[0].qty, 0.25);
            a.closeSapItemManager();
            a.openSapItemManager({ ...row, origIndex: index }, index, context, key);
            assert.equal(a.activeSapManagerItem.sapItems.length, 3);
            a.closeSapItemManager();
        }
    }
});
