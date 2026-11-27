const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ExcelJS = require('exceljs');

test('dashboard reads device and cloud progress concurrently and still adopts confirmed cloud reports', async () => {
    let releaseLocal, releaseCloud;
    const localGate = new Promise(resolve => { releaseLocal = resolve; });
    const cloudGate = new Promise(resolve => { releaseCloud = resolve; });
    const started = [];
    const latest = { contractors: [], reports: [{ contractorId: 'a', date: '2026-11-24', quantities: { 15: 7 } }], issues: [] };
    const context = { window: {}, console,
        BillingStorage: { async getItemAsync() { started.push('local'); await localGate; return { contractors: [], reports: [], issues: [] }; } },
        fetch: async () => { started.push('cloud'); await cloudGate; return { ok: true, json: async () => ({ success: true, data: latest }) }; }
    };
    vm.runInNewContext(fs.readFileSync('js/daily-progress.js', 'utf8'), context);
    const app = { ...context.window.DailyProgressModule, dailyProgressDate: '2026-11-24', dailyProgressExportFrom: '2026-11-01',
        syncDailyProgressContractorsList() {}, syncWithBillingProActiveContractor() {}, loadDailyProgressReportForDate() {} };
    const loading = app.initDailyProgress();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(started, ['local', 'cloud']);
    releaseLocal(); releaseCloud(); await loading;
    assert.equal(app.dailyProgressData.reports[0].quantities[15], 7);
});

test('Daily Progress text and action colors have readable contrast in light, dark and soft themes', () => {
    const css = fs.readFileSync('css/daily-progress.css', 'utf8');
    const tokens = selector => {
        const start = css.indexOf(selector);
        assert.ok(start >= 0, selector);
        const block = css.slice(start, css.indexOf('}', start));
        return Object.fromEntries([...block.matchAll(/(--dp-[\w-]+):\s*(#[0-9a-f]{6})/gi)].map(match => [match[1], match[2]]));
    };
    const base = tokens(':root {');
    const luminance = hex => {
        const rgb = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    const contrast = (fg, bg) => (Math.max(luminance(fg), luminance(bg)) + 0.05) / (Math.min(luminance(fg), luminance(bg)) + 0.05);
    for (const [theme, overrides] of [['light', {}], ['dark', tokens('body.dark-mode {')], ['soft', tokens('html[data-theme="soft"], html.soft {')]]) {
        const palette = { ...base, ...overrides };
        for (const fg of ['--dp-text-main', '--dp-text-muted', '--dp-text-dim', '--dp-accent-blue', '--dp-accent-green', '--dp-accent-amber', '--dp-accent-red']) {
            for (const bg of ['--dp-card-bg', '--dp-surface-bg', '--dp-input-bg']) {
                const ratio = contrast(palette[fg], palette[bg]);
                assert.ok(ratio >= 4.5, `${theme}: ${fg} on ${bg} has contrast ${ratio.toFixed(2)}`);
            }
        }
        assert.ok(contrast(palette['--dp-action-text'], palette['--dp-action-bg']) >= 4.5, theme + ' action label');
    }
});

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
        dailyProgressLocationId: 'loc_aaaaaaaaaaaaaaaaaaaaaaaa', dailyProgressLocations: [{ id: 'loc_aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Site A' }],
        dailyProgressData: { contractors: [{ id: 'a', name: 'Test' }], reports: [
            { contractorId: 'a', locationId: 'loc_aaaaaaaaaaaaaaaaaaaaaaaa', date: '2026-11-01', quantities: { 15: 4 }, manpower: { leader: 1 } },
            { contractorId: 'a', locationId: 'loc_aaaaaaaaaaaaaaaaaaaaaaaa', date: '2026-12-01', quantities: { 15: 8 }, manpower: { leader: 2 } },
            { contractorId: 'a', locationId: 'loc_bbbbbbbbbbbbbbbbbbbbbbbb', date: '2026-11-01', quantities: { 15: 999 }, manpower: { leader: 99 } }
        ] }, showToast(message) { this.toast = message; } };
    await app.downloadDailyProgressExcel();
    assert.ok(output, app.toast);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(output);
    assert.equal(book.worksheets.length, 2);
    const [first, second] = book.worksheets;
    assert.equal(first.getCell('E15').value, 4); assert.equal(second.getCell('E15').value, 8);
    assert.match(first.getCell('A3').value, /LOCATION: Site A/);
    assert.equal(second.getCell('F15').value, null); assert.equal(second.getCell('F7').value, null);
    assert.equal(second.getCell('C15').value, first.getCell('C15').value);
    assert.deepEqual(second.model.merges, first.model.merges);
    assert.equal(second.getColumn(3).width, first.getColumn(3).width);
    assert.equal(first.getCell('AI15').value.result, 4); assert.equal(second.getCell('AI15').value.result, 8);
    assert.equal(first.getCell('AI15').value.formula, 'SUM(E15:AH15)');
});

test('Excel export handles 28-day Feb, 29-day leap Feb, 30-day, and 31-day months with Item Code mapping, formulas, and no sample data', async () => {
    const cases = [
        { from: '2026-02-01', to: '2026-02-28', days: 28, totalCol: 'AI', lastDayCol: 'AF' },
        { from: '2024-02-01', to: '2024-02-29', days: 29, totalCol: 'AI', lastDayCol: 'AG' },
        { from: '2026-11-01', to: '2026-11-30', days: 30, totalCol: 'AI', lastDayCol: 'AH' },
        { from: '2026-10-01', to: '2026-10-31', days: 31, totalCol: 'AJ', lastDayCol: 'AI' }
    ];
    for (const tc of cases) {
        let output;
        const context = {
            window: { ExcelJS, DailyProgressSeed: { items: [{ id: 'sand-id', row: 99, name: 'M SAND 0-6 MM', code: '11000123', unit: 'KG' }] } }, console,
            fetch: async () => ({ ok: true, arrayBuffer: async () => fs.readFileSync('templates/Excel xport formate.xlsx') }),
            Blob: class { constructor(parts) { output = Buffer.from(parts[0]); } },
            URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
            document: { body: { appendChild() {}, removeChild() {} }, createElement: () => ({ click() {} }) }, setTimeout: fn => fn()
        };
        vm.runInNewContext(fs.readFileSync('js/daily-progress.js', 'utf8'), context);
        const app = {
            ...context.window.DailyProgressModule,
            dailyProgressExportFrom: tc.from, dailyProgressExportTo: tc.to, dailyProgressContractorId: 'c1',
            dailyProgressLocationId: 'loc1', dailyProgressLocations: [{ id: 'loc1', name: 'Feeder 1' }],
            dailyProgressData: {
                contractors: [{ id: 'c1', name: 'Team 1', project: 'Proj X', engineer: 'Eng Y' }],
                reports: [{ contractorId: 'c1', locationId: 'loc1', date: tc.to, quantities: { 'sand-id': 12.5 }, manpower: { leader: 1, skilled: 2, unskilled: 3, tractor: 1 }, remarks: 'Done ' + tc.to }]
            },
            showToast() {}
        };
        await app.downloadDailyProgressExcel();
        const book = new ExcelJS.Workbook(); await book.xlsx.load(output);
        assert.equal(book.worksheets.length, 1, `${tc.days}-day month fits on 1 sheet`);
        const ws = book.worksheets[0];
        assert.equal(ws.name, 'Progress 1');
        assert.equal(ws.getCell(tc.lastDayCol + '15').value, 12.5, 'Maps by Item Code 11000123 to row 15');
        assert.equal(ws.getCell(tc.totalCol + '15').value.result, 12.5);
        assert.equal(ws.getCell(tc.lastDayCol + '6').value.result, 6);
        assert.equal(ws.getCell(tc.totalCol + '6').value.result, 6);
        assert.equal(ws.getCell('X8').value, null, 'Sample manpower from template is cleared');
        assert.equal(ws.getCell('X6').value.formula, 'SUM(X8:X10)');
        assert.equal(ws.getCell('X6').value.result || 0, 0);
        assert.equal(ws.getCell('A18').value, 'Remark Date wise');
        assert.equal(ws.getCell('A19').value, `${tc.to}: Done ${tc.to}`);
    }
});

for (const page of ['dashboard', 'shared']) {
    test(`${page} Excel exports the latest saved quantity for the selected feeder, including legacy date/id formats`, async () => {
        let output, app;
        const seed = { contractor: {}, records: [], items: [{ id: '15', row: 15, name: 'Sand', code: '100', unit: 'KG' }] };
        const context = {
            window: { ExcelJS, DailyProgressSeed: seed, location: { search: '?contractor=team-a' } },
            console, URLSearchParams,
            fetch: async () => ({ ok: true, arrayBuffer: async () => fs.readFileSync('public/daily-progress-template.xlsx') }),
            Blob: class { constructor(parts) { output = Buffer.from(parts[0]); } },
            URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
            document: { body: { appendChild() {}, removeChild() {} }, createElement: () => ({ click() {} }) },
            localStorage: { getItem() { return null; }, setItem() {} },
            setTimeout: fn => fn(), clearTimeout() {}, alert(message) { throw Error(message); },
            Vue: { createApp(options) {
                app = { ...options.data(), ...options.methods };
                for (const [key, getter] of Object.entries(options.computed)) Object.defineProperty(app, key, { get: () => getter.call(app) });
                return { mount() {}, directive() {} };
            } }
        };
        const contractors = [{ id: 'team-a', name: 'Team A', feeder: 'OLD FEEDER' }];
        const locations = [{ id: 'site-a', name: 'Selected Site', feeder: 'CORRECT FEEDER' }, { id: 'site-b', name: 'Other Site', feeder: 'OTHER FEEDER' }];
        const reports = [
            { contractorId: 'team-a', date: '2026-11-24', locationId: 'site-b', quantities: { 15: 999 }, version: 50 },
            { contractorId: 'team-a', date: '2026-11-24', locationId: 'site-a', quantities: {}, version: 1 },
            { contractorId: 'M/s Team-A', date: '24/11/2026', locationId: 'site-a', quantities: { 15: 7.5 }, manpower: { leader: 2 }, version: 3 },
            { contractorId: 'team-a', date: '2026-11-24', locationId: 'site-a', quantities: { 15: 5 }, version: 2, updatedAt: '2026-11-25T00:00:00Z' },
            { contractorId: 'team-b', date: '2026-11-24', locationId: 'site-a', quantities: { 15: 888 }, version: 99 },
            { contractorId: 'team-a', date: '2026-11-24', quantities: { 15: 444 }, version: 99 }
        ];
        if (page === 'dashboard') {
            vm.runInNewContext(fs.readFileSync('js/daily-progress.js', 'utf8'), context);
            app = { ...context.window.DailyProgressModule, dailyProgressContractorId: 'team-a', dailyProgressLocationId: 'site-a',
                dailyProgressLocations: locations, dailyProgressData: { contractors, reports },
                dailyProgressExportFrom: '2026-11-24', dailyProgressExportTo: '2026-11-25', showToast(message) { this.toast = message; } };
            assert.equal(app.getDailyProgressExportQty('15', '2026-11-24'), 7.5);
            await app.downloadDailyProgressExcel();
        } else {
            vm.runInNewContext(fs.readFileSync('js/daily-progress-standalone.js', 'utf8'), context);
            Object.assign(app, { contractors, reports, locations, selectedContractorId: 'team-a', selectedLocationId: 'site-a',
                exportFrom: '2026-11-24', exportTo: '2026-11-25', showToast(message) { this.toast = message; } });
            assert.equal(app.getExportDayQty('15', '2026-11-24'), 7.5);
            await app.downloadExcelReport();
        }
        assert.ok(output, app.toast);
        const book = new ExcelJS.Workbook(); await book.xlsx.load(output);
        const sheet = book.worksheets[0];
        assert.equal(sheet.getCell('E15').value, 7.5);
        assert.equal(sheet.getCell('F15').value, null, 'No report stays blank');
        assert.equal(sheet.getCell('AI15').value.result, 7.5);
        assert.equal(sheet.getCell('E8').value, 2);
        assert.equal(sheet.getCell('A3').value, 'FEEDER: CORRECT FEEDER | LOCATION: Selected Site');
        if (page === 'dashboard') {
            app.dailyProgressLocationId = 'legacy';
            assert.equal(app.getDailyProgressExportQty('15', '2026-11-24'), 444);
        } else {
            app.selectedLocationId = 'legacy';
            assert.equal(app.getExportDayQty('15', '2026-11-24'), 444);
        }
        assert.deepEqual(reports[2].quantities, { 15: 7.5 }, 'Export never mutates saved entries');
    });
}
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
