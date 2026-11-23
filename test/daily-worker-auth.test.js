const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./helpers/daily-entry-fixture');
const fs = require('node:fs');
const vm = require('node:vm');

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

test('shared contractor view narrows owner sessions and cannot expand worker access', async () => {
    const f = await setup();
    const view = { 'x-dp-share-contractor': 'a' };
    try {
        f.configs.get('dailyProgressData').data = {
            contractors: [{ id: 'a', name: 'Team A', pan: 'private-a' }, { id: 'b', name: 'Team B' }],
            reports: ['a', 'b'].map(contractorId => ({ contractorId, date: '2026-11-23', quantities: {}, version: 1 })),
            issues: ['a', 'b'].map(contractorId => ({ contractorId, itemId: '15', quantity: 2 })),
            reportStates: ['a', 'b'].map(contractorId => ({ contractorId, date: '2026-11-23', state: 'final' }))
        };
        const session = await (await f.request('/api/dp-worker/session', undefined, f.ownerCookie, view)).json();
        assert.equal(session.user.role, 'worker');
        assert.deepEqual(session.user.contractorIds, ['a']);
        assert.equal(session.user.sharedView, true);
        const scoped = await (await f.request('/api/daily-progress/data', undefined, f.ownerCookie, view)).json();
        assert.deepEqual(scoped.data.contractors.map(c => c.id), ['a']);
        assert.equal(scoped.data.contractors[0].pan, undefined);
        for (const key of ['reports', 'issues', 'reportStates']) assert.ok(scoped.data[key].every(r => r.contractorId === 'a'));
        const sites = await (await f.request('/api/dp-worker/locations?contractorId=a', undefined, f.ownerCookie, view)).json();
        const report = { contractorId: 'a', date: '2026-11-24', locationId: sites.locations[0].id, version: 1, state: 'final', quantities: { '15': 2 } };
        const saved = await f.request('/api/daily-progress/data', { reports: [report] }, f.ownerCookie, view);
        assert.equal(saved.status, 200);
        assert.equal((await saved.json()).reports[0].state, 'final');
        assert.equal((await f.request('/api/daily-progress/data', { reports: [{ ...report, version: 2, quantities: { '15': 3 } }] }, f.ownerCookie, view)).status, 423);
        assert.equal((await f.request('/api/daily-progress/unlock', { contractorId: 'a', date: '2026-11-23' }, f.ownerCookie, view)).status, 403);
        assert.equal((await f.request('/api/daily-progress/data', { reports: [{ contractorId: 'b' }] }, f.ownerCookie, view)).status, 403);
        assert.equal((await f.request('/api/dp-worker/locations?contractorId=b', undefined, f.ownerCookie, view)).status, 403);
        assert.equal((await f.request('/api/daily-progress/data', undefined, '', view)).status, 401);
        await f.create();
        const cookie = await f.login();
        assert.equal((await f.request('/api/dp-worker/session', undefined, cookie, { 'x-dp-share-contractor': 'b' })).status, 403);
        await f.create('amit', ['a', 'b']);
        const assignedCookie = await f.login('amit');
        const assigned = await (await f.request('/api/dp-worker/session', undefined, assignedCookie, view)).json();
        assert.deepEqual(assigned.user.availableContractorIds, ['a', 'b']);
        assert.deepEqual(assigned.user.contractorIds, ['a']);
        const selected = await (await f.request('/api/daily-progress/data', undefined, assignedCookie, { 'x-dp-share-contractor': 'b' })).json();
        assert.deepEqual(selected.data.contractors.map(c => c.id), ['b']);
        assert.ok(selected.data.reports.every(r => r.contractorId === 'b'));
        assert.equal((await f.request('/api/dp-worker/session', undefined, f.ownerCookie, { 'x-dp-share-contractor': '*' })).status, 400);
        const owner = await (await f.request('/api/dp-worker/session', undefined, f.ownerCookie)).json();
        assert.equal(owner.user.role, 'admin');
    } finally { await f.close(); }
});
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
            password: 'SecurePassword123',
            contractorIds: ['a']
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

test('signup accepts five or more contractors; admin changes assignments without resetting passwords or sessions', async () => {
    const f = await setup();
    const contractors = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => ({ id, name: 'Team ' + id.toUpperCase() }));
    f.configs.set('dailyProgressData', { data: { contractors, reports: [], issues: [] } });
    try {
        const signup = await f.request('/api/dp-worker/signup', {
            name: 'Multi Site User', email: 'multisite@example.com', mobile: '9876543222', password: 'Multi-site-password',
            contractorIds: ['a', 'b', 'c', 'd', 'e']
        });
        assert.equal(signup.status, 200);
        const user = (await signup.json()).user;
        assert.equal(user.contractorIds.length, 5);
        const cookie = signup.headers.get('set-cookie').split(';')[0];
        const recordKey = [...f.records.keys()].find(key => key.startsWith('dp_worker_user_'));
        const original = structuredClone(f.records.get(recordKey));
        const save = id => f.request('/api/daily-progress/data', { reports: [{ contractorId: id, date: '2026-11-17', version: 1, quantities: { 15: 7 }, manpower: {}, remarks: '' }] }, cookie);
        assert.equal((await save('a')).status, 200);
        assert.equal((await save('f')).status, 403);
        const assign = (ids, auth = f.ownerCookie) => f.request('/api/dp-admin/workers/contractors', { username: user.username, contractorIds: ids, role: 'admin', disabled: false }, auth);
        assert.equal((await assign(['a', 'f'], '')).status, 401);
        assert.equal((await assign(['a', 'f'], cookie)).status, 401);
        assert.equal((await assign(['a', 'b', 'c', 'd', 'e', 'f'])).status, 200);
        let session = await (await f.request('/api/dp-worker/session', undefined, cookie)).json();
        assert.equal(session.user.contractorIds.length, 6, 'Existing session sees added contractor immediately');
        assert.equal((await save('f')).status, 200);
        assert.equal((await assign(['f'])).status, 200);
        assert.equal((await save('a')).status, 403, 'Removed contractor is blocked immediately');
        const record = f.records.get(recordKey);
        for (const field of ['passwordHash', 'salt', 'revision', 'role', 'id']) assert.equal(record[field], original[field], field + ' is unchanged');
        const adminData = (await (await f.request('/api/dp-admin/data', undefined, f.ownerCookie)).json()).data;
        assert.equal(adminData.reports.find(r => r.contractorId === 'a').quantities[15], 7, 'Removing access retains reports');
        assert.equal((await assign([])).status, 200, 'Admin can revoke every assignment');
        session = await (await f.request('/api/dp-worker/session', undefined, cookie)).json();
        assert.deepEqual(session.user.contractorIds, []);
        assert.equal((await save('f')).status, 403);
        const login = await f.request('/api/dp-worker/login', { identifier: 'multisite@example.com', password: 'Multi-site-password' });
        assert.equal(login.status, 200, 'Original password still works');
    } finally { await f.close(); }
});

test('signup requires explicit known contractors and never grants wildcard access; new teams are assignable', async () => {
    const f = await setup();
    try {
        const body = { name: 'Selection User', email: 'selection@example.com', mobile: '9876543233', password: 'Selection-password' };
        assert.equal((await f.request('/api/dp-worker/signup', { ...body, contractorIds: ['a'], reset: true })).status, 400);
        for (const ids of [undefined, [], ['*'], ['all'], ['missing-contractor'], [null], 'a']) {
            const result = await f.request('/api/dp-worker/signup', { ...body, contractorIds: ids });
            assert.equal(result.status, 400, JSON.stringify(ids));
        }
        const added = await f.request('/api/dp-admin/auxiliary', { kind: 'contractor', value: { id: 'new-team', name: 'New Site Team' } }, f.ownerCookie);
        assert.equal(added.status, 200);
        const directory = (await (await f.request('/api/dp-worker/contractors')).json()).contractors;
        assert.deepEqual(directory.find(c => c.id === 'new-team'), { id: 'new-team', name: 'New Site Team' });
        const signup = await f.request('/api/dp-worker/signup', { ...body, contractorIds: ['a', 'new-team', 'a'] });
        assert.equal(signup.status, 200);
        assert.deepEqual((await signup.json()).user.contractorIds, ['a', 'new-team']);
        const bad = await f.request('/api/dp-admin/workers/contractors', { username: 'm_9876543233', contractorIds: ['unavailable'] }, f.ownerCookie);
        assert.equal(bad.status, 400);
    } finally { await f.close(); }
});

test('signup checkbox selections survive search and submit six contractors without a wildcard', async () => {
    class Element {
        constructor() { this.children = []; this.style = {}; this.value = ''; this.textContent = ''; this.nodes = new Map(); }
        setAttribute() {}
        removeAttribute() {}
        focus() {}
        append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
        appendChild(node) { this.children.push(node); node.parentNode = this; }
        prepend(node) { this.children.unshift(node); node.parentNode = this; }
        replaceChildren() { this.children = []; }
        contains(node) { return this.children.includes(node); }
        remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(node => node !== this); this.parentNode = null; }
        get childElementCount() { return this.children.length; }
        querySelector(selector) { if (!this.nodes.has(selector)) this.nodes.set(selector, new Element()); return this.nodes.get(selector); }
        querySelectorAll() { return []; }
    }
    const root = new Element(), body = new Element();
    const signup = root.querySelector('[data-form="signup"]');
    const login = root.querySelector('[data-form="login"]');
    signup.elements = Object.fromEntries(['name', 'email', 'mobile', 'password'].map(key => [key, new Element()]));
    login.elements = Object.fromEntries(['identifier', 'password'].map(key => [key, new Element()]));
    const directory = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => ({ id, name: 'Team ' + id.toUpperCase() }));
    let submitted, finishLogin;
    let directoryRequests = 0;
    let first = true;
    const context = { window: { location: { search: '?contractor=' } }, URLSearchParams, AbortSignal, location: { reload() {} }, alert() {},
        document: { createElement() { if (first) { first = false; return root; } return new Element(); }, body, getElementById: () => null, querySelector: () => null },
        fetch: async (url, init) => {
            if (url.endsWith('/contractors')) { directoryRequests++; return { ok: true, json: async () => ({ success: true, contractors: directory }) }; }
            if (url.endsWith('/session')) return { ok: false, json: async () => ({ success: false, error: 'Login required' }) };
            if (url.endsWith('/login')) return new Promise(resolve => { finishLogin = () => resolve({ ok: false, json: async () => ({ success: false, error: 'Incorrect password' }) }); });
            submitted = JSON.parse(init.body);
            return { ok: true, json: async () => ({ success: true, user: { name: submitted.name, role: 'worker', contractorIds: submitted.contractorIds } }) };
        } };
    vm.runInNewContext(fs.readFileSync('js/daily-worker-auth.js', 'utf8'), context);
    for (let n = 0; n < 10; n++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(directoryRequests, 0, 'Sign-in screen does not start the signup directory request');
    const loginButton = login.querySelector('button[type="submit"]');
    loginButton.textContent = 'Sign In & Continue';
    login.elements.identifier.value = 'test@example.invalid';
    login.elements.password.value = 'synthetic';
    const loginPending = login.onsubmit({ preventDefault() {} });
    assert.equal(loginButton.disabled, true);
    assert.equal(loginButton.textContent, 'Signing in…', 'Immediate progress while the login request is pending');
    finishLogin(); await loginPending;
    assert.equal(loginButton.disabled, false);
    assert.equal(loginButton.textContent, 'Sign In & Continue');
    assert.equal(directoryRequests, 0);
    root.querySelector('[data-tab="signup"]').onclick();
    root.querySelector('[data-tab="signup"]').onclick();
    for (let n = 0; n < 10; n++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(directoryRequests, 1, 'Repeated signup clicks share one directory load');
    const list = root.querySelector('[data-contractor-list]');
    const search = root.querySelector('[data-contractor-search]');
    const count = root.querySelector('[data-contractor-count]');
    assert.equal(count.textContent, '0 selected', 'Empty share-link contractor does not select the first company');
    for (const row of list.children.slice(0, 5)) { row.children[0].checked = true; row.children[0].onchange(); }
    assert.equal(count.textContent, '5 selected');
    search.value = 'Team F'; search.oninput();
    assert.equal(list.children.length, 1);
    list.children[0].children[0].checked = true; list.children[0].children[0].onchange();
    search.value = ''; search.oninput();
    assert.equal(list.children.filter(row => row.children[0].checked).length, 6);
    Object.assign(signup.elements.name, { value: 'Preview User' });
    Object.assign(signup.elements.email, { value: 'preview@example.com' });
    Object.assign(signup.elements.mobile, { value: '9876543244' });
    Object.assign(signup.elements.password, { value: 'Preview-password' });
    await signup.onsubmit({ preventDefault() {} });
    assert.deepEqual(submitted.contractorIds, ['a', 'b', 'c', 'd', 'e', 'f']);
    assert.equal(signup.elements.password.value, '');
});

test('admin assignment form sends only username and contractor IDs, without password reset', async () => {
    const context = { window: { DailyProgressModule: {} } };
    vm.runInNewContext(fs.readFileSync('js/daily-progress-access.js', 'utf8'), context);
    const calls = [];
    const admin = { ...context.window.DailyProgressModule,
        runDailyProgressAdmin: fn => fn(), showToast() {}, async loadDailyProgressLoginsAndHistory() {},
        async dailyProgressRequest(route, body) { calls.push({ route, body }); }
    };
    admin.assignDailyProgressWorker({ username: 'site_user', name: 'Site User', contractorIds: ['a'] });
    assert.equal(admin.dailyProgressWorkerForm.permissionsOnly, true);
    admin.dailyProgressWorkerForm.contractorIds.push('b', 'c', 'd', 'e', 'f');
    await admin.saveDailyProgressWorker();
    assert.equal(calls[0].route, 'workers/contractors');
    assert.deepEqual(Object.keys(calls[0].body).sort(), ['contractorIds', 'username']);
    assert.equal(calls[0].body.contractorIds.length, 6);
});

test('mobile user cards expand small lists, keep large lists compact and close only after a confirmed save', async () => {
    const context = { window: { DailyProgressModule: {} } };
    vm.runInNewContext(fs.readFileSync('js/daily-progress-access.js', 'utf8'), context);
    const users = Array.from({ length: 50 }, (_, i) => ({ id: 'user-' + i, username: 'worker_' + i, name: i === 37 ? 'Rakesh Site Supervisor' : 'Site User ' + i, email: 'user' + i + '@example.com', mobile: '987654' + String(i).padStart(4, '0'), contractorIds: ['a'] }));
    let fail = false;
    const admin = { ...context.window.DailyProgressModule, dailyProgressWorkers: users.slice(0, 2), dailyProgressWorkerExpanded: {},
        runDailyProgressAdmin: fn => fn(), showToast() {}, async loadDailyProgressLoginsAndHistory() {},
        async dailyProgressRequest() { if (fail) throw new Error('Save unavailable'); }
    };
    assert.equal(admin.isDailyProgressWorkerExpanded(users[0]), true);
    admin.toggleDailyProgressWorker(users[0]);
    assert.equal(admin.isDailyProgressWorkerExpanded(users[0]), false);
    admin.dailyProgressWorkers = users;
    admin.dailyProgressWorkerExpanded = {};
    assert.equal(users.some(user => admin.isDailyProgressWorkerExpanded(user)), false);
    assert.equal(admin.filterDailyProgressWorkers(users, '  RAKESH  ')[0].id, 'user-37');
    assert.equal(admin.filterDailyProgressWorkers(users, 'user49@example.com')[0].id, 'user-49');
    assert.equal(admin.filterDailyProgressWorkers(users, 'not a user').length, 0);
    assert.equal(admin.filterDailyProgressWorkers(users, '').length, 50);
    admin.toggleDailyProgressWorker(users[37]);
    assert.equal(admin.isDailyProgressWorkerExpanded(users[37]), true);
    admin.toggleDailyProgressWorker(users[49]);
    assert.equal(admin.isDailyProgressWorkerExpanded(users[37]), false, 'Large lists show one expanded user at a time');
    admin.assignDailyProgressWorker(users[49]);
    fail = true;
    await assert.rejects(admin.saveDailyProgressWorker(), /Save unavailable/);
    assert.equal(admin.isDailyProgressWorkerExpanded(users[49]), true, 'Failed save keeps the user details open');
    assert.equal(admin.dailyProgressModal, 'worker');
    fail = false;
    await admin.saveDailyProgressWorker();
    assert.equal(admin.isDailyProgressWorkerExpanded(users[49]), false);
    assert.equal(admin.dailyProgressModal, '');
});

test('admin unlock preserves entered quantities, manpower, and remarks without deletion', async () => {
    const f = await setup();
    try {
        await f.create('testuser', ['a']);
        const cookie = await f.login('testuser', 'Test-entry-password');
        
        // 1. Worker saves an entry with quantities and manpower
        const saveRes = await f.request('/api/daily-progress/data', {
            reports: [{
                contractorId: 'a',
                date: '2026-11-23',
                version: 1,
                quantities: { 15: 12.5 },
                manpower: { leader: 1, skilled: 4, unskilled: 8 },
                remarks: 'Pole erection completed',
                state: 'final',
                final: true
            }]
        }, cookie);
        assert.equal(saveRes.status, 200);

        // 2. Data check — verified saved
        let dataRes = await (await f.request('/api/daily-progress/data', undefined, f.ownerCookie)).json();
        let rep = dataRes.data.reports.find(r => r.contractorId === 'a' && r.date === '2026-11-23');
        assert.ok(rep);
        assert.equal(rep.quantities['15'], 12.5);
        assert.equal(rep.manpower.skilled, 4);
        assert.equal(rep.remarks, 'Pole erection completed');

        // 3. Admin unlocks the entry
        const unlockRes = await f.request('/api/daily-progress/unlock', {
            contractorId: 'a',
            date: '2026-11-23'
        }, f.ownerCookie);
        assert.equal(unlockRes.status, 200);
        const unlockData = await unlockRes.json();
        assert.equal(unlockData.success, true);
        assert.equal(unlockData.state, 'open');

        // 4. Data check — MUST PRESERVE all quantities, manpower, remarks
        dataRes = await (await f.request('/api/daily-progress/data', undefined, f.ownerCookie)).json();
        rep = dataRes.data.reports.find(r => r.contractorId === 'a' && r.date === '2026-11-23');
        assert.ok(rep, 'Report must still exist');
        assert.equal(rep.state, 'open', 'State must be open');
        assert.equal(rep.quantities['15'], 12.5, 'Quantities must be intact');
        assert.equal(rep.manpower.skilled, 4, 'Manpower must be intact');
        assert.equal(rep.remarks, 'Pole erection completed', 'Remarks must be intact');
    } finally { await f.close(); }
});
