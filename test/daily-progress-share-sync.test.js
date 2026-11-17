const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const express = require('express');
const fixture = require('./helpers/daily-entry-fixture');
const copy = value => structuredClone(value);
const contractor = { id: 'shared-team', name: 'Shared Team' };
const report = quantity => ({ contractorId: contractor.id, date: '2026-11-17', version: 1, quantities: { 15: quantity }, manpower: {}, remarks: '' });

test('share POST persists a direct dataset; GET and admin recover nested historical records', async () => {
    const f = fixture();
    f.configs.set('dailyProgressData', { key: 'dailyProgressData', data: { data: { contractors: [contractor], reports: [report(7)], issues: [] } } });
    const app = f.app;
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    try {
        for (const path of ['/api/daily-progress/data', '/api/dp-admin/data']) {
            const response = await fetch(origin + path, { headers: { cookie: f.ownerCookie } });
            assert.match(response.headers.get('cache-control'), /no-store/);
            const result = await response.json(); assert.equal(result.data.reports[0].quantities[15], 7, path);
        }
        const next = { ...report(9), date: '2026-11-18' };
        const saved = await fetch(origin + '/api/daily-progress/data', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: f.ownerCookie }, body: JSON.stringify({ contractors: [contractor], reports: [next], issues: [] }) });
        assert.equal(saved.status, 200); assert.equal((await saved.json()).success, true);
        assert.equal(f.configs.get('dailyProgressData').data.reports.length, 2, 'Historical shared reports survive a later save');
        assert.equal(f.configs.get('dailyProgressData').data.data, undefined, 'No additional data wrapper');
        const result = await (await fetch(origin + '/api/dp-admin/data', { headers: { cookie: f.ownerCookie } })).json();
        assert.equal(result.data.reports.find(r => r.date === '2026-11-18').quantities[15], 9);
    } finally { await new Promise(resolve => server.close(resolve)); }
});

function adminApp(extra = {}) {
    const context = { window: {}, console, AbortSignal, crypto: require('node:crypto').webcrypto, ...extra };
    vm.runInNewContext(fs.readFileSync('js/daily-progress.js', 'utf8'), context);
    vm.runInNewContext(fs.readFileSync('js/daily-progress-access.js', 'utf8'), context);
    return Object.assign({}, context.window.DailyProgressModule, {
        dailyProgressData: { contractors: [contractor], reports: [], issues: [] },
        dailyProgressContractorId: contractor.id, dailyProgressDate: '2026-11-17',
        loadDailyProgressReportForDate() { this.visible = this.dailyProgressData.reports.find(r => r.date === this.dailyProgressDate); },
        syncDailyProgressContractorsList() {}, showToast() {}
    });
}
test('admin refresh reads aggregated share data and keeps history and displayed report current', async () => {
    const a = adminApp();
    a.dailyProgressRequest = async route => { assert.equal(route, 'data'); return { data: { contractors: [contractor], reports: [report(12)], issues: [] } }; };
    assert.equal(await a.syncDailyProgressCloudData(true), true);
    assert.equal(a.visible.quantities[15], 12);
    assert.equal(a.dailyProgressData.reports.length, 1);
});
test('background refresh does not overwrite edits begun before or during a request', async () => {
    const a = adminApp(); let calls = 0, finish;
    a.dailyProgressRequest = async () => { calls++; return new Promise(resolve => { finish = resolve; }); };
    a.dailyProgressDirty = true;
    assert.equal(await a.syncDailyProgressCloudData(true), false); assert.equal(calls, 0);
    a.dailyProgressDirty = false;
    const pending = a.syncDailyProgressCloudData(true);
    a.dailyProgressDirty = true;
    finish({ data: { reports: [report(99)], contractors: [], issues: [] } });
    assert.equal(await pending, false); assert.equal(a.dailyProgressData.reports.length, 0);
});

test('late reads cannot restore data after an admin mutation or replace a newer status response', async () => {
    const a = adminApp(); let finish;
    a.dailyProgressRequest = async () => new Promise(resolve => { finish = resolve; });
    const oldRead = a.syncDailyProgressCloudData(true);
    a.invalidateDailyProgressReads();
    finish({ data: { contractors: [], reports: [report(99)], issues: [] } });
    assert.equal(await oldRead, false);
    assert.equal(a.dailyProgressData.reports.length, 0);
    let first = true;
    a.dailyProgressRequest = async () => {
        if (first) { first = false; return new Promise(resolve => { finish = resolve; }); }
        return { state: 'open', editable: true, version: 2, report: report(20) };
    };
    const oldStatus = a.refreshDailyProgressStatus(false);
    await a.refreshDailyProgressStatus(false);
    finish({ state: 'open', editable: true, version: 1, report: report(5) });
    await oldStatus;
    assert.equal(a.dailyProgressQuantities[15], 20);
});

test('clearing an entire location immediately removes cached dates even if another cloud refresh is pending', async () => {
    const a = adminApp({ confirm: () => true });
    a.runDailyProgressAdmin = fn => fn();
    a.dailyProgressLocationId = 'loc_aaaaaaaaaaaaaaaaaaaaaaaa';
    a.dailyProgressLocations = [{ id: a.dailyProgressLocationId, name: 'Site A' }];
    a.dailyProgressData.reports = [
        { ...report(5), locationId: a.dailyProgressLocationId },
        { ...report(3), locationId: a.dailyProgressLocationId, date: '2026-11-18' },
        { ...report(2), locationId: a.dailyProgressLocationId, date: '2026-11-19' },
        { ...report(9), locationId: 'loc_bbbbbbbbbbbbbbbbbbbbbbbb' }
    ];
    a.dailyProgressRequest = async () => ({ results: [{ date: '2026-11-17', version: 2 }, { date: '2026-11-18', version: 2 }] });
    a.syncDailyProgressCloudData = async () => false;
    a.refreshDailyProgressStatus = async () => {};
    await a.manageDailyProgressLocation('delete', true);
    assert.equal(a.dailyProgressData.reports.length, 1);
    assert.equal(a.dailyProgressData.reports[0].quantities[15], 9);
});

test('token-link status refresh updates both form and report history', async () => {
    const a = adminApp();
    a.dailyProgressRequest = async () => ({ state: 'final', editable: false, version: 2, report: report(18) });
    await a.refreshDailyProgressStatus(false);
    assert.equal(a.dailyProgressQuantities[15], 18);
    assert.equal(a.dailyProgressData.reports[0].quantities[15], 18);
    assert.equal(a.dailyProgressData.reports[0].version, 2);
});

test('admin location edit reads the server lock before reopening and claiming the selected date', async () => {
    const a = adminApp({ confirm: () => true });
    a.dailyProgressLocationId = 'loc_aaaaaaaaaaaaaaaaaaaaaaaa';
    a.dailyProgressLocations = [{ id: a.dailyProgressLocationId, name: 'Site A' }];
    a.runDailyProgressAdmin = fn => fn();
    a.dailyProgressServerState = null;
    const calls = [];
    a.dailyProgressRequest = async (route, body) => {
        calls.push({ route, body });
        if (route.startsWith('report?')) return { state: 'final', version: 3 };
        if (route === 'reopen') return { reopened: true };
        return { state: 'open', editable: true, version: 3, epoch: 2, report: { quantities: { 15: 5 }, manpower: {}, remarks: 'Site A' } };
    };
    await a.startDailyProgressLocationEntry();
    assert.equal(calls[1].route, 'reopen');
    assert.equal(calls[1].body.locationId, a.dailyProgressLocationId);
    assert.equal(calls[2].route, 'claim');
    assert.equal(a.dailyProgressQuantities[15], 5);
    assert.equal(a.dailyProgressLocked, false);
    assert.equal(a.dailyProgressBusy, false);
});

test('admin typing and sharing never publish inflated draft versions through the legacy dataset API', async () => {
    const uploads = [], calls = [];
    const context = { window: { location: { origin: 'https://billing.test' } }, console, AbortSignal,
        crypto: require('node:crypto').webcrypto, setTimeout: () => 1, clearTimeout() {},
        BillingStorage: { async setItem() { return { saved: true }; } },
        fetch: async (...args) => { uploads.push(args); return { ok: true, json: async () => ({ success: true }) }; } };
    vm.runInNewContext(fs.readFileSync('js/daily-progress.js', 'utf8'), context);
    vm.runInNewContext(fs.readFileSync('js/daily-progress-access.js', 'utf8'), context);
    const a = Object.assign({}, context.window.DailyProgressModule, {
        dailyProgressData: { contractors: [contractor], reports: [report(1)], issues: [] },
        dailyProgressContractorId: contractor.id, dailyProgressDate: '2026-11-17',
        dailyProgressQuantities: {15: 1}, dailyProgressManpower: {}, dailyProgressVersion: 1,
        dailyProgressActiveContractor: contractor, dailyProgressLocked: false, _dpEditVersion: 1,
        showToast() {}, copyDailyProgressShareUrl() {},
        async dailyProgressRequest(route, body) {
            calls.push({ route, body });
            return route === 'claim' ? { editable: true, version: 1, epoch: 1 } : { version: 2, state: 'final' };
        }
    });
    a.onDailyProgressQuantityChange('15', 2);
    a.onDailyProgressQuantityChange('15', 3);
    await a.saveDailyProgressData();
    a.copyDailyProgressShareLink();
    assert.equal(uploads.length, 0, 'Neither a draft nor copying a share link uploads the dataset');
    await a.saveDailyProgressReport();
    assert.deepEqual(calls.map(c => c.route), ['claim', 'report']);
    assert.equal(calls[1].body.version, 1, 'Final save uses the confirmed server version');
    assert.equal(calls[1].body.report.quantities[15], 3);
    assert.equal(a.dailyProgressVersion, 2);
    assert.equal(uploads.length, 0, 'Confirmed Drive save only updates the device cache');
});

test('share entries seed admin editing; newer legacy reports survive old Drive copies, dates and locks stay isolated', async () => {
    const f = fixture();
    f.configs.set('dailyProgressData', { data: { contractors: [contractor], reports: [report(20)], issues: [] } });
    const server = f.app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const editor = 'share_sync_editor_'.padEnd(40, 'x');
    const request = async (route, body, cookie = f.ownerCookie) => {
        const response = await fetch(origin + route, { headers: { cookie, 'Content-Type': 'application/json', 'x-dp-editor': editor },
            ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) });
        return { status: response.status, data: await response.json() };
    };
    try {
        await request('/api/dp-admin/workers', { username: 'siteworker', name: 'Site Worker', password: 'test-password-123', contractorIds: [contractor.id] });
        const login = await fetch(origin + '/api/dp-worker/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'siteworker', password: 'test-password-123' }) });
        const cookie = login.headers.get('set-cookie').split(';')[0];
        const shared = await request('/api/daily-progress/data', { reports: [{ ...report(25), version: 2 }] }, cookie);
        assert.equal(shared.status, 200);
        const claim = (await request('/api/dp-admin/claim', { contractorId: contractor.id, date: '2026-11-17' })).data;
        assert.equal(claim.report.quantities[15], 25);
        assert.equal(claim.version, 2);
        const saved = await request('/api/dp-admin/report', { contractorId: contractor.id, date: '2026-11-17', version: claim.version, epoch: claim.epoch,
            requestId: 'admin-round-trip-request', final: true, report: { quantities: { 15: 30 }, manpower: {}, remarks: '' } });
        assert.equal(saved.status, 200);
        let data = (await request('/api/daily-progress/data', undefined, cookie)).data.data;
        assert.equal(data.reports[0].quantities[15], 30);
        assert.equal(data.reports[0].version, 3);
        const locked = await request('/api/daily-progress/data', { reports: [{ ...report(99), version: 4 }] }, cookie);
        assert.equal(locked.status, 423);
        const nextDate = await request('/api/daily-progress/data', { reports: [{ ...report(8), date: '2026-11-18' }] }, cookie);
        assert.equal(nextDate.status, 200);
        // Historical admin/cache data can be newer than an older Drive record.
        await request('/api/daily-progress/data', { reports: [{ ...report(40), version: 4 }] });
        data = (await request('/api/dp-admin/data')).data.data;
        assert.equal(data.reports.find(r => r.date === '2026-11-17').quantities[15], 40);
        assert.equal(data.reports.find(r => r.date === '2026-11-18').quantities[15], 8);
        const status = (await request('/api/dp-admin/report?contractorId=shared-team&date=2026-11-17')).data;
        assert.equal(status.report.quantities[15], 40);
        assert.equal(status.state, 'final');
        const catalog = (await request('/api/daily-entry/catalog', undefined, '')).data;
        assert.equal(catalog.contractors.find(c => c.id === contractor.id).name, contractor.name);
    } finally { await new Promise(resolve => server.close(resolve)); }
});
