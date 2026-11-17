const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./helpers/daily-entry-fixture');

async function setup() {
    const f = fixture();
    f.configs.set('dailyProgressData', { data: { contractors: [{ id: 'a', name: 'Team A' }, { id: 'b', name: 'Team B' }], reports: [], issues: [] } });
    const server = f.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const request = async (route, body, cookie = '', extraHeaders = {}) => fetch(origin + route, { headers: { cookie, 'Content-Type': 'application/json', ...extraHeaders }, ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) });
    const create = (username = 'rahul', contractorIds = ['a']) => request('/api/dp-admin/workers', { username, name: username === 'rahul' ? 'Rahul' : 'Amit', password: 'Test-entry-password', contractorIds }, f.ownerCookie);
    const login = async (username = 'rahul', password = 'Test-entry-password') => {
        const response = await request('/api/dp-worker/login', { username, password });
        assert.equal(response.status, 200); assert.match(response.headers.get('set-cookie'), /HttpOnly/i); assert.match(response.headers.get('set-cookie'), /SameSite=Strict/i);
        return response.headers.get('set-cookie').split(';')[0];
    };
    return { ...f, request, create, login, close: () => new Promise(resolve => server.close(resolve)) };
}
test('only admin creates entry logins; hashed passwords, contractor scope, logout and revocation are enforced', async () => {
    const f = await setup();
    try {
        assert.equal((await f.request('/api/dp-admin/workers', { username: 'bad' })).status, 401);
        assert.equal((await f.create()).status, 200);
        assert.ok(!JSON.stringify([...f.records.values()]).includes('Test-entry-password'));
        assert.equal((await f.request('/api/dp-worker/login', { username: 'rahul', password: 'wrong' })).status, 401);
        const cookie = await f.login();
        assert.equal((await f.request('/api/daily-progress/data')).status, 401);
        const data = await (await f.request('/api/daily-progress/data', undefined, cookie)).json();
        assert.deepEqual(data.data.contractors.map(c => c.id), ['a']);
        assert.equal((await f.request('/api/dp-admin/workers', undefined, cookie)).status, 401);
        assert.equal((await f.request('/api/dp-admin/workers/disable', { username: 'rahul' }, f.ownerCookie)).status, 200);
        assert.equal((await f.request('/api/dp-worker/session', undefined, cookie)).status, 401);
        assert.equal((await f.request('/api/dp-admin/workers', { username: 'rahul', name: 'Rahul', password: 'New-test-password', contractorIds: ['a'], reset: true }, f.ownerCookie)).status, 200);
        const next = await f.login('rahul', 'New-test-password');
        assert.equal((await f.request('/api/dp-worker/logout', {}, next)).status, 200);
        assert.equal((await f.request('/api/dp-worker/session', undefined, next)).status, 401);
    } finally { await f.close(); }
});
test('shared entry records verified worker, server time and exact quantities; retries and stale saves cannot forge history', async () => {
    const f = await setup();
    try {
        await f.create(); const cookie = await f.login();
        const report = { contractorId: 'a', date: '2026-11-17', version: 1, quantities: { 15: 7 }, manpower: { leader: 2 }, remarks: 'Site A', savedBy: { name: 'Forged name' }, savedAt: '2000-01-01' };
        const save = body => f.request('/api/daily-progress/data', { reports: [body] }, cookie);
        assert.equal((await save({ ...report, contractorId: 'b' })).status, 403);
        const first = await (await save(report)).json(); assert.equal(first.success, true);
        assert.equal(first.reports[0].savedBy.name, 'Rahul'); assert.ok(Date.parse(first.reports[0].savedAt) > Date.parse('2026-01-01'));
        assert.equal((await save(report)).status, 200);
        const next = { ...report, version: 2, quantities: { 15: 9 } };
        assert.equal((await save(next)).status, 200);
        assert.equal((await save({ ...report, quantities: { 15: 99 } })).status, 409);
        const events = await (await f.request('/api/dp-admin/entry-history?contractorId=a', undefined, f.ownerCookie)).json();
        assert.equal(events.events.length, 2); assert.ok(events.events.every(e => e.savedBy.name === 'Rahul'));
        assert.deepEqual(events.events.map(e => e.quantities[15]).sort((a,b) => a-b), [7,9]);
        const admin = await (await f.request('/api/dp-admin/data', undefined, f.ownerCookie)).json();
        assert.equal(admin.data.reports[0].quantities[15], 9); assert.equal(admin.data.reports[0].savedBy.name, 'Rahul');
    } finally { await f.close(); }
});
test('token links also require login and contractor permission, and record the same worker identity', async () => {
    const f = await setup();
    try {
        await f.create(); const cookie = await f.login();
        const link = await (await f.request('/api/dp-admin/links', { contractor: { id: 'a', name: 'Team A' } }, f.ownerCookie)).json();
        const other = await (await f.request('/api/dp-admin/links', { contractor: { id: 'b', name: 'Team B' } }, f.ownerCookie)).json();
        const scoped = (path, body, token = link.token, c = cookie) => f.request('/api/daily-entry' + path, body, c, { 'x-dp-link': token, 'x-dp-editor': 'editor_'.padEnd(40,'x') });
            assert.equal((await scoped('/bootstrap', undefined, link.token, '')).status, 401);
            assert.equal((await scoped('/bootstrap', undefined, other.token)).status, 403);
            const state = await (await scoped('/report/2026-11-17/claim', {})).json();
            const body = { version: state.version, epoch: state.epoch, requestId: 'save-request-00000001', final: true, report: { quantities: { 15: 4 }, manpower: {}, remarks: 'Token save' } };
            assert.equal((await scoped('/report/2026-11-17/save', body)).status, 200);
            assert.equal((await scoped('/report/2026-11-17/save', body)).status, 200);
            const events = await (await f.request('/api/dp-admin/entry-history?contractorId=a', undefined, f.ownerCookie)).json();
            assert.equal(events.events.length, 1); assert.equal(events.events[0].savedBy.name, 'Rahul'); assert.equal(events.events[0].quantities[15], 4);
    } finally { await f.close(); }
});

test('contractor permission uses exact ids, not similar-name fuzzy matching', async () => {
    const f = await setup();
    try {
        await f.create('rahul', ['anjali_electrical']);
        const cookie = await f.login();
        const report = { contractorId: 'anjali_electricals', date: '2026-11-17', version: 1, quantities: { 15: 7 }, manpower: {}, remarks: 'Wrong contractor' };
        assert.equal((await f.request('/api/daily-progress/data', { reports: [report] }, cookie)).status, 403);
    } finally { await f.close(); }
});

test('public worker signup with name, email, and mobile supports login via email or mobile number', async () => {
    const f = await setup();
    try {
        // Validation tests
        const bad1 = await f.request('/api/dp-worker/signup', { name: 'A', email: 'notanemail', mobile: '1234', password: '123' });
        assert.equal(bad1.status, 400);

        // Valid signup
        const res1 = await f.request('/api/dp-worker/signup', {
            name: 'Samrat Singh',
            email: 'samrat@example.com',
            mobile: '9876543210',
            password: 'SecurePassword123',
            contractorIds: ['a']
        });
        assert.equal(res1.status, 200);
        const cookie1 = res1.headers.get('set-cookie').split(';')[0];
        const data1 = await res1.json();
        assert.equal(data1.success, true);
        assert.equal(data1.user.name, 'Samrat Singh');
        assert.equal(data1.user.email, 'samrat@example.com');
        assert.equal(data1.user.mobile, '9876543210');

        // Check active session
        const sessionRes = await f.request('/api/dp-worker/session', undefined, cookie1);
        assert.equal(sessionRes.status, 200);
        const sessionData = await sessionRes.json();
        assert.equal(sessionData.user.name, 'Samrat Singh');

        // Duplicate signup rejection
        const dupRes = await f.request('/api/dp-worker/signup', {
            name: 'Samrat Duplicate',
            email: 'samrat@example.com',
            mobile: '9876543210',
            password: 'SecurePassword123'
        });
        assert.equal(dupRes.status, 409);

        // Login using Email
        const loginEmailRes = await f.request('/api/dp-worker/login', {
            identifier: 'samrat@example.com',
            password: 'SecurePassword123'
        });
        assert.equal(loginEmailRes.status, 200);
        const emailUserData = await loginEmailRes.json();
        assert.equal(emailUserData.user.name, 'Samrat Singh');

        // Login using Mobile Number
        const loginMobileRes = await f.request('/api/dp-worker/login', {
            identifier: '9876543210',
            password: 'SecurePassword123'
        });
        assert.equal(loginMobileRes.status, 200);
        const mobileUserData = await loginMobileRes.json();
        assert.equal(mobileUserData.user.name, 'Samrat Singh');

        // Login with formatted mobile (+91)
        const loginFormattedMobileRes = await f.request('/api/dp-worker/login', {
            identifier: '+91 9876543210',
            password: 'SecurePassword123'
        });
        assert.equal(loginFormattedMobileRes.status, 200);

        // Wrong password rejection
        const badPwRes = await f.request('/api/dp-worker/login', {
            identifier: 'samrat@example.com',
            password: 'WrongPassword'
        });
        assert.equal(badPwRes.status, 401);

        // Delete user via admin endpoint
        const delRes = await f.request('/api/dp-admin/workers/delete', { username: data1.user.username }, f.ownerCookie);
        assert.equal(delRes.status, 200);

        // User should not appear in worker list
        const listRes = await f.request('/api/dp-admin/workers', undefined, f.ownerCookie);
        const listData = await listRes.json();
        assert.ok(!listData.users.some(u => u.username === data1.user.username));

        // Deleted user cannot log in anymore
        const reLoginRes = await f.request('/api/dp-worker/login', {
            identifier: 'samrat@example.com',
            password: 'SecurePassword123'
        });
        assert.equal(reLoginRes.status, 401);
    } finally { await f.close(); }
});
