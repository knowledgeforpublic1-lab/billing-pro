const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ExcelJS = require('exceljs');
const createDailyRoutes = require('../api/daily-progress-routes');

function makeDb(seedReports, seedIssues = []) {
    const control = new Map();
    for (const r of seedReports) {
        const { controlKey } = require('../api/daily-progress-data');
        const key = controlKey(r.contractorId, r.date, r.locationId || '');
        control.set(key, {
            contractorId: r.contractorId,
            date: r.date,
            locationId: r.locationId || '',
            state: 'final',
            version: r.version || 1,
            deleted: !!r.deleted,
            baseReport: r
        });
    }
    return {
        async getDefaultConfig(key) {
            if (key === 'dailyProgressData') return { data: { contractors: [{ id: 'c1', name: 'M/S PARTH ENTERPRISES' }, { id: 'c2', name: 'M/S AKASH' }], reports: [], issues: seedIssues } };
            if (key === 'stockMaster') return { data: { byContractorNorm: {} } };
            return null;
        },
        async atomicDailyRecord(key, change) {
            const res = change(control.get(key) || null);
            if (res.value !== undefined) control.set(key, res.value);
            return res.result;
        },
        async listDailyRecords(prefix) {
            return [...control.entries()].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => ({ key, value }));
        },
        async listDailyReportsInRange({ startDate, endDate } = {}) {
            return [...control.entries()]
                .filter(([k, v]) => {
                    if (!k.startsWith('report_') || !v || v.deleted) return false;
                    const d = (v.baseReport && v.baseReport.date) || '';
                    if (startDate && d < startDate) return false;
                    if (endDate && d > endDate) return false;
                    return true;
                })
                .map(([key, value]) => ({ key, value }));
        }
    };
}

function loadFrontendMethods(contextExtras = {}) {
    const seedCode = fs.readFileSync(path.join(__dirname, '../js/data/default-daily-progress.js'), 'utf8');
    const dpCode = fs.readFileSync(path.join(__dirname, '../js/daily-progress.js'), 'utf8');
    const sandbox = {
        window: { ExcelJS },
        console,
        Date,
        Math,
        Map,
        Set,
        Array,
        Object,
        String,
        Number,
        JSON,
        URLSearchParams,
        setTimeout,
        Blob: class FakeBlob { constructor(parts) { this.buffer = parts[0]; } },
        URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} },
        document: {
            createElement: () => ({ click: () => {}, href: '', download: '' }),
            body: { appendChild: () => {}, removeChild: () => {} }
        },
        ...contextExtras
    };
    vm.runInNewContext(seedCode + '\n' + dpCode, sandbox);
    return { methods: sandbox.window.DailyProgressModule, seed: sandbox.window.DailyProgressSeed };
}

test('Backend queryExportData + Frontend Export Sheet + ExcelJS match across all date filters', async () => {
    const reports = [
        { contractorId: 'c1', locationId: 'f1', date: '2026-10-15', quantities: { '15': 5 }, remarks: 'Oct work', version: 1 },
        { contractorId: 'c1', locationId: 'f1', date: '2026-11-02', quantities: { '15': 3 }, remarks: 'Nov 2 work', version: 1 },
        { contractorId: 'c1', locationId: 'f1', date: '2026-11-08', quantities: { '15': 4 }, remarks: 'Nov 8 work', version: 1 },
        { contractorId: 'c1', locationId: 'f1', date: '2026-11-15', quantities: { '15': 7 }, remarks: 'Nov 15 work', version: 1 },
        { contractorId: 'c1', locationId: 'f1', date: '2026-11-27', quantities: { '15': 2 }, remarks: 'Nov 27 work', version: 1 },
        { contractorId: 'c2', locationId: 'f1', date: '2026-11-15', quantities: { '15': 99 }, remarks: 'Other contractor', version: 1 }
    ];
    const db = makeDb(reports);
    const workers = { sharedReports: async () => [], listContractors: async () => [] };
    const routes = createDailyRoutes({ db, auth: { requireAdmin: (req, res, next) => next() }, workers });

    // 1. Single Date: 15-11-2026
    const single = await routes.queryExportData({ startDate: '2026-11-15', endDate: '2026-11-15', contractorId: 'c1', locationId: 'f1' });
    assert.equal(single.count, 1);
    assert.equal(single.reports[0].quantities['15'], 7);

    // 2. Range: 01-11-2026 to 10-11-2026
    const nov1to10 = await routes.queryExportData({ startDate: '2026-11-01', endDate: '2026-11-10', contractorId: 'c1', locationId: 'f1' });
    assert.equal(nov1to10.count, 2);
    assert.equal(nov1to10.reports.reduce((s, r) => s + r.quantities['15'], 0), 7);

    // 3. This Month (through 2026-11-28)
    const thisMonth = await routes.queryExportData({ startDate: '2026-11-01', endDate: '2026-11-28', contractorId: 'c1', locationId: 'f1' });
    assert.equal(thisMonth.count, 4);
    assert.equal(thisMonth.reports.reduce((s, r) => s + r.quantities['15'], 0), 16);

    // 4. Last Month (October 2026)
    const lastMonth = await routes.queryExportData({ startDate: '2026-10-01', endDate: '2026-10-31', contractorId: 'c1', locationId: 'f1' });
    assert.equal(lastMonth.count, 1);
    assert.equal(lastMonth.reports[0].quantities['15'], 5);

    // 5. Contractor Isolation (c2)
    const c2Only = await routes.queryExportData({ startDate: '2026-11-01', endDate: '2026-11-28', contractorId: 'c2', locationId: 'f1' });
    assert.equal(c2Only.count, 1);
    assert.equal(c2Only.reports[0].quantities['15'], 99);

    // 6. Empty Date Range
    const empty = await routes.queryExportData({ startDate: '2026-08-01', endDate: '2026-08-10', contractorId: 'c1', locationId: 'f1' });
    assert.equal(empty.count, 0);

    // 7. Frontend Preview + ExcelJS Download parity
    let downloadedBuffer = null;
    const templateBuf = fs.readFileSync(path.join(__dirname, '../public/daily-progress-template.xlsx'));
    const toasts = [];
    const { methods } = loadFrontendMethods({
        fetch: async (url) => {
            if (url.includes('/api/daily-progress/template')) {
                return { ok: true, arrayBuffer: async () => templateBuf };
            }
            if (url.includes('/api/daily-progress/export-data')) {
                const u = new URL('http://localhost' + url);
                const data = await routes.queryExportData({
                    startDate: u.searchParams.get('startDate'),
                    endDate: u.searchParams.get('endDate'),
                    contractorId: u.searchParams.get('contractorId'),
                    locationId: u.searchParams.get('locationId')
                });
                return { ok: true, json: async () => ({ success: true, ...data }) };
            }
            return { ok: false };
        },
        Blob: class CaptureBlob { constructor(parts) { downloadedBuffer = parts[0]; } }
    });

    const vmState = {
        ...methods,
        todayDateStr: '2026-11-28',
        dailyProgressContractorId: 'c1',
        dailyProgressLocationId: 'f1',
        dailyProgressDate: '2026-11-27',
        dailyProgressExportFilter: 'active',
        dailyProgressData: {
            contractors: [{ id: 'c1', name: 'M/S PARTH ENTERPRISES', project: 'Gadchiroli' }],
            reports,
            issues: []
        },
        normalizeDailyProgressDate: d => String(d || '').slice(0, 10),
        dailyProgressLocationKey: id => (id === 'legacy' ? '' : String(id || '')),
        dailyProgressLocationName: () => 'Feeder 1',
        showToast: (msg, type) => toasts.push({ msg, type })
    };

    // Preset checks
    vmState.setDailyProgressExportRange('current_month');
    assert.equal(vmState.dailyProgressExportFrom, '2026-11-01');
    assert.equal(vmState.dailyProgressExportTo, '2026-11-28');
    assert.equal(vmState.getDailyProgressExportItemTotal('15'), 16);

    vmState.setDailyProgressExportRange('prev_month');
    assert.equal(vmState.dailyProgressExportFrom, '2026-10-01');
    assert.equal(vmState.dailyProgressExportTo, '2026-10-31');
    assert.equal(vmState.getDailyProgressExportItemTotal('15'), 5);

    // Custom range 01-11-2026 to 10-11-2026 -> ExcelJS output check
    vmState.dailyProgressExportFrom = '2026-11-01';
    vmState.dailyProgressExportTo = '2026-11-10';
    assert.equal(vmState.getDailyProgressExportItemTotal('15'), 7);
    await vmState.downloadDailyProgressExcel();
    assert.ok(downloadedBuffer, 'Excel buffer should be generated');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(downloadedBuffer);
    const ws = wb.worksheets[0];
    assert.match(String(ws.getCell('A2').value), /01-11-2026 to 10-11-2026/);
    assert.ok(toasts.some(t => /downloaded/i.test(t.msg)), 'Success toast after generation');
    // Verify remark dates in Excel are dd-mm-yyyy and only Nov 2 & Nov 8 remarks appear
    const remarkTexts = [];
    for (let r = 15; r <= ws.rowCount; r++) {
        const val = String(ws.getCell('A' + r).value || '');
        if (val.includes('Nov 2 work') || val.includes('Nov 8 work')) remarkTexts.push(val);
    }
    assert.equal(remarkTexts.length, 2);
    assert.equal(remarkTexts[0], '02-11-2026: Nov 2 work');
    assert.equal(remarkTexts[1], '08-11-2026: Nov 8 work');

    // Empty range -> No Data Found toast, no file generated
    downloadedBuffer = null;
    vmState.dailyProgressExportFrom = '2026-08-01';
    vmState.dailyProgressExportTo = '2026-08-10';
    await vmState.downloadDailyProgressExcel();
    assert.equal(downloadedBuffer, null);
    assert.ok(toasts.some(t => /No Data Found/i.test(t.msg)));
});
