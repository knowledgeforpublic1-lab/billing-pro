const assert = require('node:assert/strict');
const express = require('express');
const createAuth = require('../api/auth');
const clone = value => JSON.parse(JSON.stringify(value));
const records = new Map([['portalAuthOwnerV1', { data: { email: 'owner@example.test' } }]]);
let time = 1000000;
let passwordUpdatedAt = 1000;
const emailRequests = [];
const db = {
    async getDefaultConfig(key) { return records.has(key) ? clone(records.get(key)) : null; },
    async saveDefaultConfig(key, data) { records.set(key, { data: clone(data) }); },
    async patchDefaultConfig(key, changes) { Object.assign(records.get(key).data, clone(changes)); }
};
const firebase = async (url, request) => {
    const body = JSON.parse(request.body);
    if (url.includes('signInWithPassword')) {
        if (body.password !== 'server-verified-test-password') return { ok: false, json: async () => ({ error: { message: 'INVALID_LOGIN_CREDENTIALS' } }) };
        assert.equal(body.email, 'owner@example.test');
        return { ok: true, json: async () => ({ email: body.email, localId: 'owner-uid', idToken: 'private-id-token', refreshToken: 'private-refresh-token', expiresIn: '3600' }) };
    }
    if (url.includes('lookup')) return { ok: true, json: async () => ({ users: [{ email: 'owner@example.test', localId: 'owner-uid', passwordUpdatedAt }] }) };
    if (url.includes('sendOobCode')) { emailRequests.push(body); return { ok: true, json: async () => ({}) }; }
    throw new Error('Unexpected Firebase operation');
};
async function main() {
    const auth = createAuth({ db, config: { apiKey: 'public-test-key' }, env: { AUTH_SESSION_SECRET: 'test-only-secret-with-enough-randomness', AUTH_IDLE_MINUTES: '5' }, fetchImpl: firebase, now: () => time });
    const app = express();
    app.use(express.json());
    app.use('/api/auth', auth.router);
    app.get('/protected', auth.middleware, (req, res) => res.json({ success: true }));
    app.post('/admin-only', auth.middleware, auth.requireAdmin, (req, res) => res.json({ success: true }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    let cookie;
    async function request(route, body, extraHeaders = {}) {
        return fetch(origin + route, {
            headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...extraHeaders },
            ...(body !== undefined ? { method: 'POST', body: JSON.stringify(body) } : {})
        });
    }
    async function login() {
        const response = await request('/api/auth/login', { password: 'server-verified-test-password' });
        assert.equal(response.status, 200);
        const header = response.headers.get('set-cookie');
        assert.match(header, /HttpOnly/i);
        assert.match(header, /SameSite=Strict/i);
        cookie = header.split(';')[0];
        const result = await response.json();
        assert.equal(result.adminExpiresAt, 0);
        assert.ok(!('idToken' in result) && !('refreshToken' in result));
        return result;
    }
    try {
        assert.equal((await request('/protected')).status, 401, 'API cannot be opened by a browser unlock flag/API key');
        assert.equal((await request('/api/auth/login', { password: 'wrong' })).status, 401);
        assert.equal((await request('/api/auth/login', { password: 'wrong' }, { Origin: 'https://attacker.test' })).status, 403);
        let logged = await login();
        assert.equal((await request('/protected')).status, 200);
        assert.ok(!JSON.stringify([...records.values()]).includes('private-id-token'), 'Provider tokens are encrypted at rest');
        assert.ok(!JSON.stringify([...records.values()]).includes('private-refresh-token'));
        time += 120000;
        let session = await (await request('/api/auth/session')).json();
        assert.equal(session.expiresAt, logged.expiresAt, 'Refresh/session lookup does not restart the five-minute timer');
        session = await (await request('/api/auth/activity', {})).json();
        assert.equal(session.expiresAt, time + 300000, 'Real activity extends server idle expiry');
        assert.equal((await request('/admin-only', {})).status, 403);
        assert.equal((await request('/api/auth/admin', { password: 'wrong' })).status, 401);
        assert.equal((await request('/api/auth/admin', { password: 'server-verified-test-password' })).status, 200);
        assert.equal((await request('/admin-only', {})).status, 200);
        time += 240000;
        await request('/api/auth/activity', {});
        time += 61000;
        assert.equal((await request('/protected')).status, 200, 'Portal remains active after admin elevation expires');
        assert.equal((await request('/admin-only', {})).status, 403, 'Admin expiry is enforced server-side');
        await request('/api/auth/forgot-password', { email: 'attacker@example.test' });
        assert.deepEqual(emailRequests, [{ requestType: 'PASSWORD_RESET', email: 'owner@example.test' }], 'Reset destination is fixed to registered owner, never request input');
        passwordUpdatedAt++;
        assert.equal((await request('/protected')).status, 401, 'Password reset invalidates existing sessions');
        logged = await login();
        const oldSession = clone([...records.values()].map(r => r.data).find(s => s.lastActivityAt === time));
        const logout = await request('/api/auth/logout', {});
        assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
        await db.saveDefaultConfig(oldSession.key, oldSession);
        assert.equal((await request('/protected')).status, 401, 'A delayed activity write cannot revive a logged-out session');
        await login();
        time += 300001;
        assert.equal((await request('/api/auth/session')).status, 401, 'Session expires after five minutes idle');
        assert.equal((await request('/api/auth/activity', {})).status, 401, 'Activity cannot revive an expired session');
        console.log('Server auth: password verification, HttpOnly cookies, idle expiry, admin expiry, encrypted tokens, fixed reset email and logout/reset revocation passed.');
    } finally { await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
