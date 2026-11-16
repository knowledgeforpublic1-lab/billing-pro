const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ExcelJS = require('exceljs');

test('failed device storage stays a failure, Vue 3 entry works without $set', async () => {
    const context = { window: {}, console, BillingStorage: { async setItem() { return { saved: false }; } } };
    vm.runInNewContext(fs.readFileSync('js/daily-progress.js', 'utf8'), context);
    const app = { ...context.window.DailyProgressModule, dailyProgressData: { reports: [] }, dailyProgressQuantities: {}, dailyProgressManpower: {} };
    app.onDailyProgressQuantityChange('15', '8');
    app.onDailyProgressManpowerChange('leader', '3');
    assert.equal(app.dailyProgressQuantities['15'], 8); assert.equal(app.dailyProgressManpower.leader, 3);
    await assert.rejects(app.saveDailyProgressData(), /storage failed/);
});
test('work-date stock is independent of reconciliation cutoff and excludes undated transactions', () => {
    const context = { window: {}, console };
    vm.runInNewContext(fs.readFileSync('js/billing.js', 'utf8'), context);
    vm.runInNewContext(fs.readFileSync('js/daily-progress.js', 'utf8'), context);
    context.window.ContractorSapStock = { byContractorNorm: { a: { materials: { 100: { code: '100', txns: [['2026-10-01', 10, 0], ['2026-11-01', 20, 0], ['', 90, 0]], netIssue: 120 } } } } };
    const app = { ...context.window.BillingModule, ...context.window.DailyProgressModule,
        selectedContractorId: 'a', dailyProgressContractorId: 'a', dailyProgressDate: '2026-10-05', stockAsOnDate: '2026-09-01', dailyProgressData: { reports: [], issues: [] } };
    // Populate the reconciliation memo with its earlier date before Daily Progress reads it.
    app.getContractorSapIssues();
    const value = app.getDailyProgressItemStock({ id: '15', code: '100' });
    assert.equal(value.sapIssued, 10); assert.equal(app.stockAsOnDate, '2026-09-01');
});
test('31-day Excel export clears old data and preserves labels, merges and styles on every sheet', async () => {
    let output;
    const context = {
        window: { ExcelJS, DailyProgressSeed: { items: [{ id: '15', row: 15, name: 'Sand', code: '100', unit: 'KG' }] } }, console,
        fetch: async () => ({ ok: true, arrayBuffer: async () => fs.readFileSync('public/daily-progress-template.xlsx') }),
        Blob: class { constructor(parts) { output = Buffer.from(parts[0]); } },
        URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
        document: { body: { appendChild() {}, removeChild() {} }, createElement: () => ({ click() {} }) }, setTimeout: fn => fn()
    };
    vm.runInNewContext(fs.readFileSync('js/daily-progress.js', 'utf8'), context);
    const app = { ...context.window.DailyProgressModule,
        dailyProgressExportFrom: '2026-11-01', dailyProgressExportTo: '2026-12-01', dailyProgressContractorId: 'a',
        dailyProgressData: { contractors: [{ id: 'a', name: 'Test' }], reports: [
            { contractorId: 'a', date: '2026-11-01', quantities: { 15: 4 }, manpower: { leader: 1 } },
            { contractorId: 'a', date: '2026-12-01', quantities: { 15: 8 }, manpower: { leader: 2 } }
        ] }, showToast(message) { this.toast = message; } };
    await app.downloadDailyProgressExcel();
    assert.ok(output, app.toast);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(output);
    assert.equal(book.worksheets.length, 2);
    const [first, second] = book.worksheets;
    assert.equal(first.getCell('E15').value, 4); assert.equal(second.getCell('E15').value, 8);
    assert.equal(second.getCell('F15').value, null); assert.equal(second.getCell('F7').value, null);
    assert.equal(second.getCell('C15').value, first.getCell('C15').value);
    assert.deepEqual(second.model.merges, first.model.merges);
    assert.equal(second.getColumn(3).width, first.getColumn(3).width);
    assert.equal(first.getCell('AI15').value, 4); assert.equal(second.getCell('AI15').value, 8);
});
test('production Mongo CAS adapter serializes concurrent updates across instances', async () => {
    const source = fs.readFileSync('api/db.js', 'utf8');
    const functions = source.slice(source.indexOf('async function atomicDailyRecord'), source.indexOf('module.exports = {'));
    const rows = new Map();
    const collection = {
        async findOne({ _id }) { const r = rows.get(_id); return r && structuredClone(r); },
        async insertOne(row) { if (rows.has(row._id)) throw Object.assign(new Error('duplicate'), { code: 11000 }); rows.set(row._id, structuredClone(row)); },
        async updateOne(query, update) {
            const row = rows.get(query._id);
            if (!row || row.revision !== query.revision) return { modifiedCount: 0 };
            row.value = structuredClone(update.$set.value); row.revision++; return { modifiedCount: 1 };
        }
    };
    const context = { connect: async () => {}, activeProvider: 'mongodb', mongoose: { connection: { collection: () => collection } }, structuredClone };
    vm.runInNewContext(functions, context);
    await Promise.all(Array.from({ length: 10 }, () => context.atomicDailyRecord('same', old => ({ value: { count: (old?.count || 0) + 1 }, result: true }))));
    assert.equal(rows.get('same').value.count, 10);
});
