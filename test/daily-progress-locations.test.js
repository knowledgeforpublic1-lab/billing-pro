const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./helpers/daily-entry-fixture');

async function setup() {
    const f = fixture();
    f.configs.set('dailyProgressData', { data: { contractors: [{ id: 'a', name: 'Team A' }, { id: 'b', name: 'Team B' }], reports: [{ contractorId: 'a', date: '2026-11-15', version: 1, quantities: { 15: 11 }, manpower: {}, remarks: 'Legacy history' }], issues: [] } });
    const server = f.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const request = async (route, body, cookie = f.ownerCookie, headers = {}) => {
        const response = await fetch(origin + route, { headers: { cookie, 'Content-Type': 'application/json', 'x-dp-editor': 'location_editor_'.padEnd(40, 'x'), ...headers }, ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) });
        return { status: response.status, data: await response.json() };
    };
    await request('/api/dp-admin/workers', { username: 'siteworker', name: 'Site Worker', password: 'Location-password', contractorIds: ['a'] });
    const login = await fetch(origin + '/api/dp-worker/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'siteworker', password: 'Location-password' }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const create = async name => (await request('/api/dp-worker/locations', { contractorId: 'a', name }, cookie)).data.location;
    const save = (locationId, date, version, quantity, auth = cookie) => request('/api/daily-progress/data', { reports: [{ contractorId: 'a', date, locationId, version, quantities: { 15: quantity }, manpower: { leader: quantity }, remarks: 'Site work' }] }, auth);
    const data = async () => (await request('/api/dp-admin/data')).data.data;
    return { ...f, request, cookie, create, save, data, close: () => new Promise(resolve => server.close(resolve)) };
}

test('same contractor/date has independent location reports, locks and histories; contractor permissions remain enforced', async () => {
    const f = await setup();
    try {
        const a = await f.create('Angara Site A'), b = await f.create('Angara Site B');
        assert.notEqual(a.id, b.id);
        assert.equal((await f.create('  ANGARA   SITE A ')).id, a.id, 'Duplicate names reuse the same location');
        assert.equal((await f.request('/api/dp-worker/locations', { contractorId: 'b', name: 'Wrong team' }, f.cookie)).status, 403);
        const outsider = (await f.request('/api/dp-admin/locations', { contractorId: 'b', name: 'Other site' })).data.location;
        assert.equal((await f.save(outsider.id, '2026-11-17', 1, 99)).status, 404);
        const saved = await Promise.all([f.save(a.id, '2026-11-17', 1, 5), f.save(b.id, '2026-11-17', 1, 9)]);
        assert.ok(saved.every(result => result.status === 200));
        let rows = (await f.data()).reports;
        assert.equal(rows.find(r => r.locationId === a.id).quantities[15], 5);
        assert.equal(rows.find(r => r.locationId === b.id).quantities[15], 9);
        const link = (await f.request('/api/dp-admin/links', { contractor: { id: 'a', name: 'Team A' } })).data;
        const headers = { 'x-dp-link': link.token };
        const path = '/api/daily-entry/report/2026-11-17';
        const claim = (await f.request(path + '/claim?locationId=' + a.id, {}, f.cookie, headers)).data;
        assert.equal(claim.report.quantities[15], 5);
        assert.equal(claim.version, 1);
        assert.equal((await f.request(path + '/save?locationId=' + a.id, { version: claim.version, epoch: claim.epoch, requestId: 'location-final-request-0001', final: true, report: { quantities: { 15: 7 }, manpower: {}, remarks: 'Final A' } }, f.cookie, headers)).status, 200);
        assert.equal((await f.save(a.id, '2026-11-17', 3, 77)).status, 423);
        assert.equal((await f.save(b.id, '2026-11-17', 2, 10)).status, 200);
        rows = (await f.data()).reports;
        assert.equal(rows.find(r => r.locationId === a.id).quantities[15], 7);
        assert.equal(rows.find(r => r.locationId === b.id).quantities[15], 10);
        const history = (await f.request('/api/dp-admin/entry-history?contractorId=a&locationId=' + a.id)).data.events;
        assert.ok(history.length >= 2);
        assert.ok(history.every(row => row.locationId === a.id));
        const status = (await f.request('/api/dp-admin/report?contractorId=a&date=2026-11-17&locationId=' + a.id)).data;
        assert.equal(status.state, 'final');
        assert.equal(status.report.locationName, 'Angara Site A');
        await f.request('/api/dp-admin/reopen', { contractorId: 'a', locationId: a.id, date: '2026-11-17' });
        const adminClaim = (await f.request('/api/dp-admin/claim', { contractorId: 'a', locationId: a.id, date: '2026-11-17' })).data;
        assert.equal(adminClaim.report.quantities[15], 7);
        const changed = await f.request('/api/dp-admin/report', { contractorId: 'a', locationId: a.id, date: '2026-11-17', version: adminClaim.version, epoch: adminClaim.epoch, requestId: 'admin-location-edit-0001', final: true, report: { quantities: { 15: 8 }, manpower: { leader: 2 }, remarks: 'Admin correction' } });
        assert.equal(changed.status, 200);
        rows = (await f.data()).reports;
        assert.equal(rows.find(r => r.locationId === a.id).quantities[15], 8);
        assert.equal(rows.find(r => r.locationId === b.id).quantities[15], 10);
    } finally { await f.close(); }
});

test('location deletion cannot race an in-flight save; invalid names and dates do not mutate reports', async () => {
    const f = await setup();
    let release;
    try {
        for (const name of ['', {}, 'a'.repeat(121), 'bad\u0000name']) assert.equal((await f.request('/api/dp-worker/locations', { contractorId: 'a', name }, f.cookie)).status, 400);
        const location = await f.create('Active site');
        const claim = (await f.request('/api/dp-admin/claim', { contractorId: 'a', locationId: location.id, date: '2026-11-17' })).data;
        let started;
        const began = new Promise(resolve => { started = resolve; });
        const wait = new Promise(resolve => { release = resolve; });
        const write = f.drive.write;
        f.drive.write = async (...args) => { started(); await wait; return write(...args); };
        const pending = f.request('/api/dp-admin/report', { contractorId: 'a', locationId: location.id, date: '2026-11-17', version: claim.version, epoch: claim.epoch, requestId: 'concurrent-location-save', final: true, report: { quantities: { 15: 12 }, manpower: {}, remarks: 'Saving' } });
        await began;
        const rejected = await f.request('/api/dp-admin/manage-reports', { contractorId: 'a', locationId: location.id, date: '2026-11-17', action: 'delete' });
        assert.equal(rejected.status, 409);
        release();
        assert.equal((await pending).status, 200);
        assert.equal((await f.data()).reports.find(row => row.locationId === location.id).quantities[15], 12);
        const badDate = await f.request('/api/dp-admin/manage-reports', { contractorId: 'a', locationId: location.id, date: '2026-02-30', action: 'reset' });
        assert.equal(badDate.status, 400);
    } finally { if (release) release(); await f.close(); }
});

test('admin reset/delete affect exactly one location/date; stale saves cannot resurrect data and fresh entries can be created', async () => {
    const f = await setup();
    try {
        const a = await f.create('Site A'), b = await f.create('Site B');
        await f.save(a.id, '2026-11-17', 1, 5);
        await f.save(a.id, '2026-11-18', 1, 3);
        await f.save(b.id, '2026-11-17', 1, 9);
        const manage = (action, allDates = false, cookie = f.ownerCookie) => f.request('/api/dp-admin/manage-reports', { contractorId: 'a', locationId: a.id, date: '2026-11-17', action, allDates }, cookie);
        assert.equal((await manage('delete', false, f.cookie)).status, 401);
        assert.equal((await manage('reset')).data.count, 1);
        let data = await f.data();
        const reset = data.reports.find(r => r.locationId === a.id && r.date === '2026-11-17');
        assert.deepEqual(reset.quantities, {});
        assert.equal(reset.version, 2);
        assert.equal(data.reports.find(r => r.locationId === b.id).quantities[15], 9);
        assert.equal((await f.save(a.id, '2026-11-17', 2, 50)).status, 409);
        assert.equal((await f.save(a.id, '2026-11-17', 3, 4)).status, 200);
        assert.equal((await manage('delete')).data.count, 1);
        data = await f.data();
        assert.ok(!data.reports.some(r => r.locationId === a.id && r.date === '2026-11-17'));
        const deleted = data.reportStates.find(r => r.locationId === a.id && r.date === '2026-11-17');
        assert.equal(deleted.deleted, true);
        assert.equal((await f.save(a.id, '2026-11-17', 1, 5)).status, 409);
        assert.equal((await f.save(a.id, '2026-11-17', deleted.version + 1, 2)).status, 200);
        assert.equal((await manage('delete', true)).data.count, 2);
        data = await f.data();
        assert.ok(!data.reports.some(r => r.locationId === a.id));
        assert.equal(data.reports.find(r => r.locationId === b.id).quantities[15], 9);
        assert.equal(data.reports.find(r => !r.locationId).quantities[15], 11, 'Legacy reports remain separate');
        assert.equal((await f.save(a.id, '2026-11-17', 999, 99, f.ownerCookie)).status, 409, 'Admin share-page saves also obey version fencing');
        const audit = (await f.request('/api/dp-admin/audit?contractorId=a&date=2026-11-17&locationId=' + a.id)).data.events;
        assert.ok(audit.some(event => event.action === 'reset'));
        assert.ok(audit.some(event => event.action === 'delete'));
    } finally { await f.close(); }
});
