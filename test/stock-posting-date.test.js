const assert = require('node:assert/strict');
global.window = global;
global.XLSX = require('xlsx');
require('../js/stock-importer.js');
require('../js/billing.js');
const importer = window.StockImporterModule;
function workbook(rows) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Stock');
    return wb;
}
const wb = workbook([
    ['Contractor', 'Material', 'Issue', 'MRN', 'Document Date', 'Posting Date'],
    ['Test', '100', 10, 0, '01.10.2026', '05.10.2026'],
    ['Test', '100', 0, 3, '01.10.2026', '10.10.2026'],
    ['Test', '100', 5, 0, '01.10.2026', '01.11.2026'],
    ['Test', '200', 7, 0, '01.10.2026', ''],
]);
const stock = importer.parseGenericStockSheet(wb, 'Stock');
window.ContractorSapStock = stock;
const app = { selectedContractorId: 'test', stockAsOnDate: '2026-10-05' };
const get = () => BillingModule.getContractorSapIssues.call(app);
assert.equal(get().materials['100'].netIssue, 10);
assert.equal(get().materials['200'].netIssue, 0, 'Undated rows excluded from cutoff');
app.stockAsOnDate = '2026-10-10';
assert.equal(get().materials['100'].netIssue, 7, 'Inclusive posting date and return');
app.stockAsOnDate = '2026-10-01';
assert.equal(get().materials['100'].netIssue, 0, 'Document date must not include future postings');
app.stockAsOnDate = '';
assert.equal(get().materials['100'].netIssue, 12);
assert.equal(get().materials['200'].netIssue, 7, 'Unfiltered totals retain undated stock');

window.MasterSapCodeMapping = {
    groups: { test: { key: 'test', displayName: 'Test' } }, dhToGroupKey: { '31000000': 'test' }
};
const headers = ['Plant', '', 'Document Date', 'Ignored', 'Posting Date', '', '', '', 'Material', 'Description', 'Unit', 'Qty', '', '', '', 'Doc Header'];
const full = workbook([headers, [1, '', '01.10.2026', '', '15.10.2026', '', '', '', '100', 'Item', 'NO', 9, '', '', '', '31000000']]);
const parsed = importer.parseFullSapDump(full, null, 'Stock');
assert.deepEqual(parsed.byContractorNorm.test.materials['100'].txns, [['2026-10-15', 9, 0]], 'Posting Date located by header');
assert.equal(importer.parseDateToYmd(46340), '2026-11-14', 'Excel serial dates');
const fs = require('node:fs');
const vm = require('node:vm');
let options;
vm.runInNewContext(fs.readFileSync('js/core/app.js', 'utf8'), {
    window: {}, console, document: { addEventListener() {} },
    Vue: { createApp(value) { options = value; return { directive() {}, config: {}, mount() {} }; } }
});
app.stockAsOnDate = '2026-10-01';
app.getContractorSapIssues = get;
app.getContractorOldReco = () => ({ materials: {
    '100': { netIssue: 99 }, '300': { netIssue: 50 }
} });
app.getPrevReconQty = () => 1;
const pivot = options.computed.pivotReconciliationData.call(app);
assert.equal(pivot.rows.find(r => r.code === '100').sapNetIssue, 0, 'Old reco cannot restore a future posting');
assert.equal(pivot.rows.find(r => r.code === '300').sapNetIssue, 0, 'Undated baseline cannot bypass cutoff');
console.log('Posting date import and cutoff tests passed');
