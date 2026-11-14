const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ExcelJS = require('exceljs');
global.window = global;
require('../js/reco-units.js');
require('../js/views.js');
require('../js/export.js');
let options;
vm.runInNewContext(fs.readFileSync('js/core/app.js', 'utf8'), {
    window: {}, console,
    Vue: { createApp(o) { options = o; return { directive() {}, config: {}, mount() { return {}; } }; } }
});
function material(code, desc, unit = 'Rmt', component = {}) {
    return { no: code, desc, unit, sapItems: [{ code, desc, uom: 'KM', qty: 1, ...component }] };
}
const covered = material('COVER', 'Covered Conductor 55 SQMM');
const rabbit = material('RABBIT', 'AAAC Rabbit Conductor');
const inKm = material('ALREADY-KM', 'Covered Conductor', 'KM');
const manual = material('MANUAL', 'Rabbit Conductor', 'mtr', { isManual: true, manualQty: 0.123456 });
const app = Object.assign({}, window.RecoUnitModule, window.ViewsModule, {
    activities: { '922': { materials: [material('ACTIVITY', 'Rabbit Conductor', 'MTR')] } },
    activityQuantities: { '922': [[2.75]] },
    poleSchedules: { '907': { materials: [covered, rabbit, inKm, manual] } },
    poleScheduleQuantities: { '907': { 0: { 0: 1000, 1: 1500, 2: 1.25, 3: 5000 }, 1: { 0: 125.5, 1: 0.25 } } },
    sapMaterialsMaster: [{ code: 'COVER', desc: covered.desc, uom: 'MTR' }],
    getContractorSapIssues() { return { materials: { COVER: { uom: 'KM', netIssue: 10 } } }; },
    getActLocations() { return [{}]; },
    format2Dec(value) { return Number(value).toFixed(2); }
});
const unchanged = JSON.stringify([app.poleScheduleQuantities, app.activityQuantities, app.poleSchedules]);
const result = options.computed.pivotReconciliationData.call(app);
const row = code => result.rows.find(r => r.code === code);
assert.equal(row('COVER').uom, 'KM', 'Issued-stock UOM takes priority over stale master UOM');
assert.equal(row('COVER').totalQty, 1.1255, '1125.5 metres -> 1.1255 KM');
assert.equal(row('RABBIT').totalQty, 1.50025, 'Rabbit conductor metres converted once');
assert.equal(row('ACTIVITY').totalQty, 0.00275, 'Activity fallback path converts without losing short lengths');
assert.equal(row('ALREADY-KM').totalQty, 1.25, 'Already-KM quantities must not be divided again');
assert.equal(row('MANUAL').totalQty, 0.123456, 'Manual reconciliation override already uses target units');
assert.equal(app.getRecoUnitDivisor(material('CLAMP', 'PG Clamp for ACSR Rabbit Conductor'), { code: 'CLAMP' }, 'KM'), 1, 'Conductor accessories excluded');
assert.equal(app.getRecoUnitDivisor(covered, covered.sapItems[0], 'MTR'), 1, 'No conversion when issue is in metres');
assert.equal(JSON.stringify([app.poleScheduleQuantities, app.activityQuantities, app.poleSchedules]), unchanged, 'Original metre entries and mappings remain unchanged');
assert.equal(app.formatRecoQuantity(row('ACTIVITY').totalQty, row('ACTIVITY')), '0.00275');
app.activeSapManagerItem = covered;
app.activeSapManagerContextType = 'poleSchedule';
app.activeSapManagerContextKey = '907';
app.activeSapManagerOrigIndex = 0;
assert.equal(app.getSapComponentCalculatedRecoQty(covered, covered.sapItems[0]), '1.1255', 'SAP mapping preview matches reconciliation KM');

window.sanitizeExcelText = value => value;
app.pivotReconciliationData = result;
app.reconRows = result.rows;
app.getContractorDisplayName = () => 'Unit Test';
const workbook = new ExcelJS.Workbook();
const sheet = window.ExportModule.addStyledReconciliationToWorkbook.call(app, workbook);
const excelIndex = result.rows.findIndex(r => r.code === 'ACTIVITY') + 3;
const activityCol = 8 + result.columns.indexOf('922');
assert.equal(sheet.getCell(excelIndex, activityCol).value, 0.00275, 'Excel uses converted KM, not metre values');
assert.equal(sheet.getCell(excelIndex, activityCol).numFmt, '#,##0.######', 'Excel preserves KM precision');
app.reconRows = [];
const empty = window.ExportModule.addStyledReconciliationToWorkbook.call(app, new ExcelJS.Workbook());
assert.match(String(empty.getCell(3, 1).value), /0 Items/, 'An empty filter does not export unfiltered data');
console.log('Conductor units: metre -> KM, issued UOM, multiple locations, precision, manual/already-KM handling, previews and Excel passed.');
