const assert = require('node:assert/strict');
global.window = global;
const methods = require('../js/pole-schedule.js');
const defaults = require('../js/data/default-pole-schedules.js');
const item = desc => ({ desc, itemCode: 'CONTRACTOR-SPECIFIC-CODE' });
for (const desc of ['H.T.Stay Set', 'HT Stay Set', 'H T Stay sets', 'Stay Set HT']) {
    assert.equal(methods.isPoleScheduleStayItem(item(desc)), true, desc);
}
for (const desc of ['Stay CL', 'Stay Clamp', 'Stay Set clamp A type', 'Stay Set clamp B type', 'HT Stay Set clamp', 'HT Stay Set CL', 'HT Stay Set wire', 'Stay', 'L.T. Stay sets', 'LT Stay Set', 'Stay Insulators', 'Stay rod', 'Stay Wire 7/8']) {
    assert.equal(methods.isPoleScheduleStayItem(item(desc)), false, desc + ' must not count as HT stay');
}
for (const desc of ['RSJ 116x100, 11 m long', 'RSJ 116*100 09m Pole', '11M RSJ Pole', 'PSC Pole 8 Mtr (140 KG)', 'Steel Tubular Pole 9 m']) {
    assert.equal(methods.isPoleSchedulePoleItem(item(desc)), true, desc);
}
for (const desc of ['Stay Clamp for RSJ 100x 116 mm', 'Side Clamp for RSJ 100x 116 mm', 'PSC Stay Clamp A Type (Top)', 'PSC Side Clamp B Type (Bottom)', 'Barbed Wire Clamp for RSJ 100x 116 mm', 'Danger Board Clamp for RSJ 100x 116 mm', '11 KV Guarding For Single Pole', 'Painting/Hardware & support with numbering of pole', '11kV Gang operated Three pole double throw change over switch', 'Pole mounted transformer', 'RSJ pole erection', 'Concreting ration 1:3:6', 'Muffing', 'Earthing for RSJ Pole']) {
    assert.equal(methods.isPoleSchedulePoleItem(item(desc)), false, desc + ' must not count as a pole');
}

for (const key of Object.keys(defaults)) {
    const app = Object.assign({}, methods, {
        selectedPoleScheduleKey: key,
        poleSchedules: { [key]: JSON.parse(JSON.stringify(defaults[key])) },
        poleScheduleLocations: { [key]: [{ name: 'Test location' }] },
        poleScheduleQuantities: { [key]: { 0: {} } },
        selectedAugerSize: 22, stayConcretingUnitVol: 0.125,
        psAutoPole: true, psAutoStay: true, psAutoMuffing: true,
        saveToStorage() {}, syncPoleScheduleToBillingAndReconciliation() {}, showToast() {}
    });
    const rows = app.poleSchedules[key].materials;
    const values = app.poleScheduleQuantities[key][0];
    rows.forEach((row, index) => {
        if (app.isPoleSchedulePoleItem(row)) values[index] = 2;
        else if (app.isPoleScheduleStayItem(row)) values[index] = 3;
    });
    const expected = app.calculateLocationConcreting(key, 0);
    rows.forEach((row, index) => {
        if (!app.isPoleSchedulePoleItem(row) && !app.isPoleScheduleStayItem(row)) values[index] = 9999;
    });
    assert.deepEqual(app.calculateLocationConcreting(key, 0), expected, key + ': accessory/output quantities cannot add concrete or muffing');
    app.recalculatePoleScheduleConcreting(key);
    rows.forEach((row, index) => {
        if (app.isPoleSchedulePoleItem(row) || app.isPoleScheduleStayItem(row)) values[index] = 0;
    });
    app.recalculatePoleScheduleLocationConcreting(key, 0);
    rows.forEach((row, index) => {
        if (app.isPoleScheduleConcreteItem(row) && index === rows.findIndex(r => app.isPoleScheduleConcreteItem(r))) assert.equal(values[index], '', key + ': no stale concrete after removing final source');
        if (app.isPoleScheduleMuffingItem(row)) assert.equal(values[index], '', key + ': no stale muffing after removing final pole');
    });
    app.recalculatePoleScheduleConcreting(key);
    assert.equal(app.calculateLocationConcreting(key, 0).totalVol, 0, key + ': unrelated items alone contribute zero');
}
console.log('Concreting: HT Stay Set and physical poles only; clamps, LT stays, accessories and stale concrete/muffing excluded across all 12 schedules.');
