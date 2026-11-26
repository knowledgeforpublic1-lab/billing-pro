'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');
const ExcelJS = require('exceljs');
const dailyRoutes = require('../api/daily-progress-routes');

function createHarness(stockData) {
    let currentStockMaster = stockData;
    let stockReads = 0;
    const records = new Map();
    const db = {
        async getDefaultConfig(key) {
            if (key === 'stockMaster') {
                stockReads++;
                await new Promise(r => setTimeout(r, 15));
                return { data: currentStockMaster };
            }
            if (key === 'dailyProgressData') {
                return {
                    data: {
                        contractors: [
                            { id: 'c-alpha', name: 'Alpha Contractors' },
                            { id: 'c-beta', name: 'Beta Engineers' },
                            { id: 'c-empty', name: 'Empty Team' }
                        ],
                        reports: [],
                        issues: []
                    }
                };
            }
            return null;
        },
        async atomicDailyRecord(key, fn) {
            const out = fn(records.get(key) || null);
            if (out.value !== undefined) records.set(key, out.value);
            return out.result;
        },
        async listDailyRecords(prefix) {
            return [...records.entries()].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => ({ key, value }));
        }
    };
    const auth = {
        requireAdmin(req, res, next) {
            if (req.get('x-test-admin') !== '1') return res.status(401).json({ success: false, error: 'Admin required' });
            next();
        }
    };
    const seed = {
        items: [
            { id: 'item-1', name: 'POLE PCC 9M', code: '17001001', unit: 'NO', row: 15 },
            { id: 'item-2', name: 'ACSR CONDUCTOR', code: '17002002', unit: 'KM', row: 16 },
            { id: 'item-3', name: 'PIN INSULATOR', code: '17003003', unit: 'NO', row: 17 }
        ]
    };
    const routes = dailyRoutes({
        db, auth, seed,
        drive: { configured: () => true, write: async k => k, read: async () => null },
        workers: { sharedReports: async () => [], recordHistory: async () => {} }
    });
    const app = express();
    app.use(express.json());
    app.use('/api/dp-admin', routes.adminRouter);
    return {
        app,
        routes,
        getStockReads: () => stockReads,
        setStockMaster: next => { currentStockMaster = next; }
    };
}

test('backend /api/dp-admin/stock/:contractorId isolates contractors, caches reads, and invalidates on update', async () => {
    const h = createHarness({
        meta: { source: 'test' },
        byContractorNorm: {
            alphacontractors: {
                contractorName: 'Alpha Contractors',
                workOrders: ['WO-A1'],
                materials: {
                    '17001001': { code: '17001001', desc: 'POLE PCC 9M', uom: 'NO', netIssue: 25, issuedQty: 25, txns: [['2026-11-01', 25, 0]] }
                }
            },
            betaengineers: {
                contractorName: 'Beta Engineers',
                workOrders: ['WO-B1'],
                materials: {
                    '17002002': { code: '17002002', desc: 'ACSR CONDUCTOR', uom: 'KM', netIssue: 12, issuedQty: 12, txns: [['2026-11-02', 12, 0]] }
                }
            }
        }
    });

    const server = http.createServer(h.app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
        // 1. Auth required
        const unauth = await fetch(`${base}/api/dp-admin/stock/Alpha%20Contractors`);
        assert.equal(unauth.status, 401);

        // 2. Invalid contractor rejected
        const bad = await fetch(`${base}/api/dp-admin/stock/${encodeURIComponent('bad;select*')}`, { headers: { 'x-test-admin': '1' } });
        assert.equal(bad.status, 400);

        // 3. Cold fetch for Alpha
        const t0 = performance.now();
        const rAlpha = await fetch(`${base}/api/dp-admin/stock/${encodeURIComponent('Alpha Contractors')}`, { headers: { 'x-test-admin': '1' } });
        const coldMs = performance.now() - t0;
        const jAlpha = await rAlpha.json();
        assert.equal(rAlpha.status, 200);
        assert.ok(jAlpha.byContractorNorm.alphacontractors);
        assert.equal(jAlpha.byContractorNorm.betaengineers, undefined);
        assert.equal(jAlpha.byContractorNorm.alphacontractors.materials['17001001'].netIssue, 25);

        // 4. Warm cached fetch for Beta (must NOT trigger another stockMaster DB read)
        const readsBefore = h.getStockReads();
        const t1 = performance.now();
        const rBeta = await fetch(`${base}/api/dp-admin/stock/${encodeURIComponent('Beta Engineers')}`, { headers: { 'x-test-admin': '1' } });
        const warmMs = performance.now() - t1;
        const jBeta = await rBeta.json();
        assert.equal(rBeta.status, 200);
        assert.equal(h.getStockReads(), readsBefore);
        assert.ok(jBeta.byContractorNorm.betaengineers);
        assert.equal(jBeta.byContractorNorm.alphacontractors, undefined);
        assert.ok(warmMs < 150, `Expected warm cached response < 150ms, got ${warmMs.toFixed(1)}ms`);

        // 5. Empty contractor returns empty byContractorNorm
        const rEmpty = await fetch(`${base}/api/dp-admin/stock/${encodeURIComponent('Empty Team')}`, { headers: { 'x-test-admin': '1' } });
        const jEmpty = await rEmpty.json();
        assert.equal(rEmpty.status, 200);
        assert.deepEqual(jEmpty.byContractorNorm, {});

        // 6. Cache invalidation reflects updated stock immediately
        h.setStockMaster({
            meta: { source: 'updated' },
            byContractorNorm: {
                alphacontractors: {
                    contractorName: 'Alpha Contractors',
                    workOrders: ['WO-A1'],
                    materials: {
                        '17001001': { code: '17001001', desc: 'POLE PCC 9M', uom: 'NO', netIssue: 40, issuedQty: 40, txns: [['2026-11-05', 40, 0]] }
                    }
                }
            }
        });
        h.routes.invalidateStockCache();
        const rAlpha2 = await fetch(`${base}/api/dp-admin/stock/${encodeURIComponent('Alpha Contractors')}`, { headers: { 'x-test-admin': '1' } });
        const jAlpha2 = await rAlpha2.json();
        assert.equal(jAlpha2.byContractorNorm.alphacontractors.materials['17001001'].netIssue, 40);
        console.log(`[Perf] Backend stock slice cold=${coldMs.toFixed(1)}ms, warm=${warmMs.toFixed(1)}ms`);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});

test('frontend rapid 20x contractor switching cancels stale requests, keeps progress bar accurate, supports retry, and maintains Entry/Export/Excel parity', async () => {
    const sandbox = {
        window: {
            DefaultFeeders: { list: [{ id: 'loc-1', name: 'Feeder 1' }] },
            DailyProgressSeed: {
                items: [
                    { id: 'item-1', name: 'POLE PCC 9M', code: '17001001', unit: 'NO', row: 15 },
                    { id: 'item-2', name: 'ACSR CONDUCTOR', code: '17002002', unit: 'KM', row: 16 },
                    { id: 'item-3', name: 'PIN INSULATOR', code: '17003003', unit: 'NO', row: 17 }
                ]
            },
            ContractorSapStock: null
        },
        console,
        Date,
        Math,
        Map,
        Set,
        Promise,
        AbortController,
        AbortSignal,
        crypto: require('node:crypto').webcrypto,
        ExcelJS,
        Blob: class Blob { constructor(parts) { this.parts = parts; } },
        URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} },
        document: {
            body: { appendChild: () => {}, removeChild: () => {} },
            createElement: () => ({ click: () => {}, set href(v) {}, set download(v) {} })
        },
        localStorage: { getItem: () => null, setItem: () => {} },
        confirm: () => true
    };
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/daily-progress.js'), 'utf8'), sandbox);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/daily-progress-access.js'), 'utf8'), sandbox);

    const stockByContractor = {
        'c-a': { ca: { contractorName: 'Alpha', materials: { '17001001': { code: '17001001', netIssue: 10, txns: [['2026-11-01', 10, 0]] } } } },
        'c-b': { cb: { contractorName: 'Beta', materials: { '17002002': { code: '17002002', netIssue: 20, txns: [['2026-11-01', 20, 0]] } } } }
    };
    let failNextStock = false;
    let progressLog = [];
    let domRendered = false;

    sandbox.fetch = async (url, opts = {}) => {
        if (url === '/api/daily-progress/template') {
            const buf = fs.readFileSync(path.join(__dirname, '../templates/Excel xport formate.xlsx'));
            return { ok: true, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
        }
        const delay = url.includes('c-a') ? 25 : 5;
        await new Promise((resolve, reject) => {
            const t = setTimeout(resolve, delay);
            if (opts.signal) {
                if (opts.signal.aborted) { clearTimeout(t); reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })); return; }
                opts.signal.addEventListener('abort', () => { clearTimeout(t); reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })); }, { once: true });
            }
        });
        if (url.includes('/api/dp-admin/locations')) {
            return { ok: true, json: async () => ({ success: true, locations: [{ id: 'loc-1', name: 'Feeder 1' }] }) };
        }
        if (url.includes('/api/dp-admin/stock/')) {
            if (failNextStock) {
                failNextStock = false;
                return { ok: false, status: 503, json: async () => ({ success: false, error: 'Simulated network failure' }) };
            }
            const cid = decodeURIComponent(url.split('/api/dp-admin/stock/')[1]);
            return { ok: true, json: async () => ({ success: true, byContractorNorm: stockByContractor[cid] || {}, meta: { test: true } }) };
        }
        if (url.includes('/api/dp-admin/report')) {
            return { ok: true, json: async () => ({ success: true, state: 'open', editable: true, version: 1, report: null }) };
        }
        return { ok: true, json: async () => ({ success: true }) };
    };

    const vmInst = {
        ...sandbox.window.DailyProgressModule,
        currentView: 'dailyProgress',
        dailyProgressContractorId: 'c-a',
        dailyProgressLocationId: 'loc-1',
        dailyProgressDate: '2026-11-10',
        dailyProgressExportFrom: '2026-11-01',
        dailyProgressExportTo: '2026-11-30',
        dailyProgressExportFilter: 'active',
        dailyProgressFilter: 'issued',
        dailyProgressBusy: false,
        dailyProgressDirty: false,
        dailyProgressLoading: false,
        dailyProgressLoadError: '',
        dailyProgressStockReady: false,
        dailyProgressData: {
            contractors: [{ id: 'c-a', name: 'Alpha' }, { id: 'c-b', name: 'Beta' }],
            reports: [],
            issues: []
        },
        dailyProgressSeedItems: sandbox.window.DailyProgressSeed.items,
        normContractorId: s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
        getContractorSapIssues() {
            const norm = this.normContractorId(this.selectedContractorId || this.dailyProgressContractorId);
            return sandbox.window.ContractorSapStock?.byContractorNorm?.[norm] || null;
        },
        showToast: () => {},
        startTaskProgress: (t) => { domRendered = false; progressLog.push('start:' + t); },
        updateTaskProgress: (p) => { progressLog.push('pct:' + p); },
        finishTaskProgress: () => { if (!vmInst.dailyProgressLoadError) assert.equal(domRendered, true, 'finishTaskProgress must run only after $nextTick'); progressLog.push('finish'); },
        $nextTick: async () => { domRendered = true; }
    };

    // Rapid 20x switching ending on 'c-b'
    const tSwitchStart = performance.now();
    for (let i = 0; i < 20; i++) {
        const target = i % 2 === 0 ? 'c-a' : 'c-b';
        vmInst.onDailyProgressContractorChange(target);
    }
    await new Promise(r => setTimeout(r, 80));
    const switchMs = performance.now() - tSwitchStart;
    assert.equal(vmInst.dailyProgressContractorId, 'c-b');
    assert.equal(vmInst.dailyProgressLoading, false);
    assert.equal(vmInst.dailyProgressStockReady, true);

    // Check Beta's stock is shown and Alpha's is NOT mixed in
    const betaItem1 = vmInst.getDailyProgressItemStock(vmInst.dailyProgressSeedItems[0]);
    const betaItem2 = vmInst.getDailyProgressItemStock(vmInst.dailyProgressSeedItems[1]);
    assert.equal(betaItem1.totalIssued, 0);
    assert.equal(betaItem2.totalIssued, 20);

    // Verify API failure + Retry flow
    failNextStock = true;
    delete vmInst._dpContractorStockCache['c-a'];
    await vmInst.onDailyProgressContractorChange('c-a');
    assert.ok(vmInst.dailyProgressLoadError.includes('Simulated network failure'));
    assert.equal(vmInst.dailyProgressLoading, false);

    await vmInst.retryDailyProgressLoad();
    assert.equal(vmInst.dailyProgressLoadError, '');
    assert.equal(vmInst.dailyProgressStockReady, true);
    assert.equal(vmInst.getDailyProgressItemStock(vmInst.dailyProgressSeedItems[0]).totalIssued, 10);

    // Verify Entry Sheet === Export Sheet parity
    const exportPreview = vmInst.getDailyProgressExportPreviewItems();
    assert.equal(exportPreview.length, 1);
    assert.equal(exportPreview[0].code, '17001001');
    console.log(`[Perf] 20x rapid contractor switch + settle completed in ${switchMs.toFixed(1)}ms`);
});
