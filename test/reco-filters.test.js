const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
global.window = global;
require('../js/reco-filters.js');
const rows = [
    { _recoSrNo: 1, code: '17005037', desc: 'RSJ Pole', uom: 'NO', sapGrossIssue: 10, sapMrnReturn: 2, sapNetIssue: 8, totalQty: 5, _bal: 3, activities: { '907': 5 } },
    { _recoSrNo: 2, code: '17000004', desc: 'RSJ Pole 9m', uom: 'NO', sapGrossIssue: 20, sapMrnReturn: 0, sapNetIssue: 20, totalQty: 25, _bal: -5, activities: { '907': 25 } },
    { _recoSrNo: 3, code: 'WIRE', desc: 'Stay wire', uom: 'KG', sapGrossIssue: 100, sapMrnReturn: 0, sapNetIssue: 100, totalQty: 0, _bal: 100, activities: {} }
];
const original = JSON.stringify(rows);
const app = Object.assign({}, window.RecoFilterModule, {
    reconColumns: ['907'], recoBaseRows: rows, recoColumnFilters: {}, recoColumnSort: null,
    recoFilterDraft: { values: [] }, recoFilterSearch: '', showToast() {}
});
const filter = changes => app.applyRecoColumnFilters(rows);
app.recoColumnFilters = { balance: { operator: 'lt', number: '0' } };
assert.deepEqual(filter().map(r => r.code), ['17000004'], 'Negative balance filter');
app.recoColumnFilters = { desc: { text: 'pole' }, issue: { operator: 'ge', number: '15' } };
assert.deepEqual(filter().map(r => r.code), ['17000004'], 'Column filters combine with AND');
app.recoColumnFilters = { unit: { values: ['NO'] } };
assert.equal(filter().length, 2, 'Checklist filter');
app.recoColumnFilters = { code: { values: [] } };
assert.equal(filter().length, 0, 'Deselecting every value shows no rows');
app.recoColumnFilters = { 'activity:907': { operator: 'eq', number: '0' } };
assert.deepEqual(filter().map(r => r.code), ['WIRE'], 'Zero and missing activity quantities');
app.recoColumnFilters = {};
app.recoColumnSort = { key: 'balance', direction: 'asc' };
assert.deepEqual(filter().map(r => r._bal), [-5, 3, 100], 'Numeric sort');
app.recoColumnSort = { key: 'desc', direction: 'desc' };
assert.equal(filter()[0].desc, 'Stay wire', 'Text sort');
assert.deepEqual(app.getRecoFilterOptions('unit'), ['KG', 'NO'], 'Unique menu values');
app.recoFilterActiveKey = 'unit';
app.recoFilterSearch = 'kg';
app.recoFilterDraft.values = ['NO'];
app.selectAllRecoFilterValues(true);
assert.deepEqual(app.recoFilterDraft.values, ['NO', 'KG'], 'Select all applies to searched menu values');
app.selectAllRecoFilterValues(false);
assert.deepEqual(app.recoFilterDraft.values, ['NO'], 'Deselect searched values preserves other selections');
app.recoFilterDraft = { values: ['NO'], text: '', operator: '', number: '' };
app.recoColumnSort = null;
app.applyRecoColumnFilter();
assert.deepEqual(app.applyRecoColumnFilters(rows).map(r => r.code), ['17005037', '17000004']);

let options;
const directives = {};
const clickListeners = new Set();
const context = {
    window: { RecoFilterModule: window.RecoFilterModule }, console,
    document: { addEventListener(type, fn) { if (type === "click") clickListeners.add(fn); }, removeEventListener(type, fn) { if (type === "click") clickListeners.delete(fn); } },
    Vue: { createApp(value) { options = value; return { directive(name, directive) { directives[name] = directive; }, config: {}, mount() { return {}; } }; } }
};
vm.runInNewContext(fs.readFileSync('js/core/app.js', 'utf8'), context);
app.pivotReconciliationData = { columns: ['907'] };
app.reconRows = app.applyRecoColumnFilters(rows);
const totals = options.computed.reconTotals.call(app);
assert.equal(totals.grossIssue, 30);
assert.equal(totals.thisBill, 30);
assert.equal(totals.balance, -2, 'Footer totals use filtered rows');
assert.equal(JSON.stringify(rows), original, 'Filtering and sorting never mutate source entries');
app.clearAllRecoColumnFilters();
assert.equal(app.applyRecoColumnFilters(rows).length, 3);
assert.equal(app.recoColumnSort, null);
app.recoFilterActiveKey = 'desc';
app.recoFilterSearch = 'wire';
app.recoFilterDraft = { values: app.getRecoFilterOptions('desc'), text: '', operator: '', number: '' };
app.onRecoFilterSearchChange();
app.applyRecoColumnFilter();
assert.deepEqual(app.applyRecoColumnFilters(rows).map(row => row.code), ['WIRE'], 'Search then Apply filters to matching values');
app.clearAllRecoColumnFilters();
assert.equal(app.applyRecoColumnFilters(rows).length, 3, 'Clearing restores all rows without changing data');
console.log('Reco column filters: text, checklists, numeric conditions, activity quantities, sorting, filtered totals and source data preservation passed.');

// Exercise the real Vue directive lifecycle, including re-renders before close.
const outside = directives['click-outside'];
const insideTarget = {};
const element = { contains(target) { return target === insideTarget; } };
let oldCalls = 0, newCalls = 0;
outside.mounted(element, { value() { oldCalls++; } });
outside.updated(element, { value() { newCalls++; } });
for (const fn of clickListeners) fn({ target: insideTarget });
assert.equal(newCalls, 0, 'Checkbox/search clicks inside the menu keep it open');
for (const fn of clickListeners) fn({ target: {} });
assert.equal(newCalls, 1, 'Outside click uses the current callback after a render');
assert.equal(oldCalls, 0, 'Updates do not retain the old callback');
outside.unmounted(element);
assert.equal(clickListeners.size, 0, 'Closing a rendered popup removes its document listener');
for (let i = 0; i < 5; i++) {
    outside.mounted(element, { value() { newCalls++; } });
    outside.updated(element, { value() { newCalls++; } });
    outside.unmounted(element);
}
assert.equal(clickListeners.size, 0, 'Reopening filters never accumulates stale listeners');

app.clearAllRecoColumnFilters();
app.recoColumnFilters = { desc: { text: 'pole' } };
assert.deepEqual(app.getRecoFilterOptions('unit'), ['NO'], 'Menu choices follow other active filters');
assert.deepEqual(app.getRecoFilterOptions('desc'), ['RSJ Pole', 'RSJ Pole 9m', 'Stay wire'], 'A column keeps its own excluded values available for editing');
app.removeRecoColumnFilter('desc');
app.recoFilterActiveKey = 'desc';
app.recoFilterSearch = '  WIRE  ';
app.recoFilterDraft = { values: [], text: '', operator: '', number: '' };
app.onRecoFilterSearchChange();
assert.deepEqual(app.getRecoFilterSearchOptions(), ['Stay wire'], 'Search and checklist use the same trimmed case-insensitive query');
app.applyRecoColumnFilter();
assert.deepEqual(app.applyRecoColumnFilters(rows).map(r => r.code), ['WIRE']);
assert.deepEqual(app.getActiveRecoFilters(), [{key:'desc',label:'Items Description',summary:'1 selected'}], 'Active filter labels identify their columns');
app.recoColumnFilters.balance = { operator: 'lt', number: 0 };
app.removeRecoColumnFilter('desc');
assert.deepEqual(app.applyRecoColumnFilters(rows).map(r => r.code), ['17000004'], 'Removing one filter retains other columns');
app.recoFilterActiveKey = 'balance';
app.clearRecoColumnFilter();
assert.equal(app.applyRecoColumnFilters(rows).length, 3);
app.recoFilterActiveKey = 'issue';
app.recoFilterDraft = { values: ['10','20','100'], text: '', operator: 'gt', number: ',,,' };
app.applyRecoColumnFilter();
assert.equal(app.recoFilterActiveKey, 'issue', 'Invalid numeric input keeps menu open for correction');
assert.equal(app.isRecoColumnFiltered('issue'), false);
console.log('Reco filters: repeated popup lifecycle, cascading choices, active column indicators and individual clearing passed.');
