const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const createService = require('../api/daily-progress-service');
const createRoutes = require('../api/daily-progress-routes');
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
function fixture() {
    const records = new Map(), files = new Map();
    let queue = Promise.resolve(), time = 1000000, failDrive = false;
    const db = {
        atomicDailyRecord(key, fn) {
            const task = queue.then(() => {
                const result = fn(copy(records.get(key) || null));
                if (result.value !== undefined) records.set(key, copy(result.value));
                return copy(result.result);
            });
            queue = task.catch(() => {}); return task;
        },
        async listDailyRecords(prefix) { return [...records.entries()].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => ({ key, value: copy(value) })); },
        async getDefaultConfig() { return null; }
    };
    const drive = {
        configured: () => true, check: async () => ({ ready: true }),
        async write(key, value) { if (failDrive) throw Object.assign(new Error('Drive unavailable'), { status: 503 }); const id = 'file' + files.size; files.set(id, copy(value)); return id; },
        async read(id) { return copy(files.get(id)); }
    };
    const items = [{ id: '15', name: 'Sand', code: '100', unit: 'KG', row: 15 }];
    const service = createService({ db, drive, items, now: () => time });
    return { db, drive, items, service, records, files, advance: ms => time += ms, failDrive: value => failDrive = value };
}
const editor = number => ('editor_' + number + '_').padEnd(40, 'x');
const report = quantity => ({ quantities: { 15: quantity }, manpower: { leader: 1 }, remarks: 'Site work' });
const body = (state, quantity, final = false, id = 'request_0000000000000001') => ({ version: state.version, epoch: state.epoch, requestId: id, report: report(quantity), final });

test('10 different contractors save concurrently without losing records', async () => {
    const f = fixture();
    await Promise.all(Array.from({ length: 10 }, async (_, n) => {
        const cid = 'contractor-' + n;
        const state = await f.service.access(cid, '2026-11-16', editor(n), 'claim');
        const saved = await f.service.save(cid, '2026-11-16', editor(n), body(state, n + 1, true));
        assert.equal(saved.state, 'final');
    }));
    const rows = await f.service.reports();
    assert.equal(rows.length, 10);
    for (let n = 0; n < 10; n++) assert.equal(rows.find(r => r.contractorId === 'contractor-' + n).quantities['15'], n + 1);
});
test('same contractor/date: only first opener edits, others see live saved draft', async () => {
    const { service } = fixture();
    const states = await Promise.all([1, 2, 3].map(n => service.access('a', '2026-11-16', editor(n), 'claim')));
    assert.equal(states.filter(s => s.editable).length, 1);
    assert.equal(states[1].occupied, true);
    await assert.rejects(service.save('a', '2026-11-16', editor(2), body(states[1], 999)), { status: 409 });
    await service.save('a', '2026-11-16', editor(1), body(states[0], 7));
    const viewer = await service.access('a', '2026-11-16', editor(2));
    assert.equal(viewer.report.quantities['15'], 7);
    assert.equal(viewer.editable, false);
    const otherDay = await service.access('a', '2026-11-17', editor(2), 'claim');
    assert.equal(otherDay.editable, true);
});
test('final is locked; retries are idempotent; explicit admin reopen fences old editor', async () => {
    const { service, files } = fixture();
    let state = await service.access('a', '2026-11-16', editor(1), 'claim');
    const request = body(state, 5, true);
    await service.save('a', '2026-11-16', editor(1), request);
    assert.equal((await service.save('a', '2026-11-16', editor(1), request)).already, true);
    assert.equal(files.size, 1);
    await assert.rejects(service.save('a', '2026-11-16', editor(1), { ...request, requestId: 'another_request_000001' }), { status: 423 });
    await service.reopen('a', '2026-11-16');
    state = await service.access('a', '2026-11-16', editor(2), 'claim');
    assert.equal(state.report.quantities['15'], 5, 'Reopen retains existing report');
    await assert.rejects(service.save('a', '2026-11-16', editor(1), request), { status: 409 });
    await service.save('a', '2026-11-16', editor(2), body(state, 9, true));
    assert.equal(files.size, 2, 'Drive retains immutable older version');
    assert.equal((await service.audit('a', '2026-11-16')).some(e => e.action === 'reopen'), true);
});
test('Drive failure never locks or confirms save; expired lease cannot overwrite new editor', async () => {
    const f = fixture();
    const old = await f.service.access('a', '2026-11-16', editor(1), 'claim');
    f.failDrive(true);
    await assert.rejects(f.service.save('a', '2026-11-16', editor(1), body(old, 3, true)), { status: 503 });
    let state = await f.service.access('a', '2026-11-16', editor(1));
    assert.equal(state.state, 'open'); assert.equal(state.version, 0);
    f.failDrive(false); f.advance(300001);
    state = await f.service.access('a', '2026-11-16', editor(2), 'claim');
    assert.equal(state.editable, true);
    await assert.rejects(f.service.save('a', '2026-11-16', editor(1), body(old, 100)), { status: 409 });
    await f.service.save('a', '2026-11-16', editor(2), body(state, 4));
    await assert.rejects(f.service.save('a', '2026-11-16', editor(2), body(state, 5, false, 'request_000000000002')), { status: 409 });
});
test('link revocation, validation and API boundary protect other contractors/admin functions', async () => {
    const f = fixture();
    const auth = {
        requireAdmin(req, res, next) { if (req.get('x-test-admin') !== 'yes') return res.status(403).json({ error: 'Admin verification required' }); next(); }
    };
    const workers = {
        async principal(req) { if (req.get('x-test-worker') !== 'yes') throw Object.assign(new Error('Worker login required'), { status: 401 }); return { id: 'worker', name: 'Worker', role: 'worker', contractorIds: ['a'] }; },
        assertContractor(actor, cid) { if (!actor.contractorIds.includes(cid)) throw Object.assign(new Error('Contractor not allowed'), { status: 403 }); },
        async recordHistory() {}, async sharedReports() { return []; }
    };
    const routes = createRoutes({ db: f.db, drive: f.drive, seed: { items: f.items }, auth, workers });
    const app = express(); app.use(express.json());
    app.use('/api/daily-entry', routes.publicRouter);
    app.use('/api', (req, res, next) => req.get('x-test-login') === 'yes' ? next() : res.status(401).json({ error: 'Login required' }));
    app.use('/api/dp-admin', routes.adminRouter);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const request = (route, body, headers = {}) => fetch(origin + route, { headers: { 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) });
    try {
        const link = await routes.service.createLink({ id: 'a', name: 'Contractor A' });
        await routes.service.createLink({ id: 'b', name: 'SECRET CONTRACTOR B' });
        const h = { 'x-dp-link': link.token, 'x-dp-editor': editor(1), 'x-test-worker': 'yes' };
        assert.equal((await request('/api/dp-admin/status', undefined, h)).status, 401);
        assert.equal((await request('/api/dp-admin/links', { contractor: { id: 'c', name: 'C' } }, { 'x-test-login': 'yes' })).status, 403);
        assert.equal((await request('/api/daily-entry/bootstrap')).status, 401);
        const boot = await (await request('/api/daily-entry/bootstrap', undefined, h)).json();
        assert.equal(boot.contractor.id, 'a'); assert.ok(!JSON.stringify(boot).includes('SECRET'));
        const state = await (await request('/api/daily-entry/report/2026-11-16/claim', {}, h)).json();
        await request('/api/daily-entry/report/2026-11-16/save', { ...body(state, 6, true), contractorId: 'b' }, h);
        const data = await routes.service.reports();
        assert.equal(data[0].contractorId, 'a', 'Request body cannot switch contractor');
        assert.equal((await request('/api/daily-entry/report/2026-11-18/claim', {}, { ...h, Origin: 'https://attacker.test' })).status, 403);
        assert.equal((await request('/api/daily-entry/report/2026-02-30/claim', {}, h)).status, 400);
        await routes.service.disable('a');
        assert.equal((await request('/api/daily-entry/bootstrap', undefined, h)).status, 401);
        const expLink = await routes.service.createLink({ id: 'exp-c', name: 'Expired Co', ttlDays: -1 });
        // Manually expire for test
        await f.db.atomicDailyRecord('contractor_' + require('node:crypto').createHash('sha256').update('exp-c').digest('hex'), old => ({ value: { ...old, expiresAt: 1 }, result: null }));
        const expH = { 'x-dp-link': expLink.token, 'x-dp-editor': editor(1) };
        assert.equal((await request('/api/daily-entry/bootstrap', undefined, expH)).status, 401);
        const replacement = await routes.service.createLink({ id: 'a', name: 'A' });
        await assert.rejects(routes.service.authorize(link.token), { status: 401 });
        assert.equal((await routes.service.authorize(replacement.token)).id, 'a');
    } finally { await new Promise(resolve => server.close(resolve)); }
});
test('public catalog and contractor stock are served without login and never expose confidential fields', async () => {
    const f = fixture();
    const routes = createRoutes({ db: f.db, drive: f.drive, seed: { items: f.items }, auth: { requireAdmin(req, res, next) { next(); } } });
    const app = express();
    app.use('/api/daily-entry', routes.publicRouter);
    app.use('/api', (req, res) => res.status(401).json({ error: 'Login required' }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    try {
        const catalogRes = await fetch(origin + '/api/daily-entry/catalog');
        assert.equal(catalogRes.status, 200);
        const catalog = await catalogRes.json();
        assert.equal(catalog.success, true);
        assert.ok(catalog.items.length > 0, 'Materials are available without login');
        const saurabh = catalog.contractors.find(c => c.id === 'saurabh_dehariya');
        assert.ok(saurabh, 'Contractor name is available without login');
        assert.deepEqual(Object.keys(saurabh).sort(), ['engineer', 'feeder', 'id', 'name', 'project']);
        assert.ok(!/"pan"|"gstin"|"bankAccount|"bankIfsc"/i.test(JSON.stringify(catalog)), 'No confidential contractor fields');

        const stockRes = await fetch(origin + '/api/daily-entry/stock/saurabh_dehariya');
        assert.equal(stockRes.status, 200);
        const stock = await stockRes.json();
        const keys = Object.keys(stock.byContractorNorm);
        assert.ok(keys.length > 0, 'Contractor stock block is available without login');
        const block = stock.byContractorNorm[keys[0]];
        assert.equal(block.contractorName, 'Saurabh Dehariya');
        assert.ok(block.materials['17000004'], 'Material issue ledger present');
        assert.equal(block.docHeader, undefined);
        assert.equal(block.vendorCode, undefined);
        assert.ok(Array.isArray(block.workOrders), 'Sanitized stock includes work-order metadata');

        const intallyRes = await fetch(origin + '/api/daily-entry/stock/intally_dynamix_private_limited');
        const intally = await intallyRes.json();
        const intallyKeys = Object.keys(intally.byContractorNorm);
        assert.deepEqual(intallyKeys, ['intallydynamix'], 'Only the master work-order block is returned');
        assert.deepEqual(intally.byContractorNorm.intallydynamix.workOrders, ['31006105']);
        assert.equal((await fetch(origin + '/api/daily-entry/stock/' + encodeURIComponent('<script>'))).status, 400);
    } finally { await new Promise(resolve => server.close(resolve)); }
});
