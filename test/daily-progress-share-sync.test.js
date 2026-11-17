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

function adminApp() {
    const context = { window: {}, console, AbortSignal, crypto: require('node:crypto').webcrypto };
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

test('token-link status refresh updates both form and report history', async () => {
    const a = adminApp();
    a.dailyProgressRequest = async () => ({ state: 'final', editable: false, version: 2, report: report(18) });
    await a.refreshDailyProgressStatus(false);
    assert.equal(a.dailyProgressQuantities[15], 18);
    assert.equal(a.dailyProgressData.reports[0].quantities[15], 18);
    assert.equal(a.dailyProgressData.reports[0].version, 2);
});
