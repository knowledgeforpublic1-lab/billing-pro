'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const crypto = require('node:crypto');
const context = require('../api/storage-context');
const resource = require('../api/drive-first-store').resource;
async function fixture() {
    const app = express(), heads = new Map(); let saves = 0, revoked = false;
    const db = { storageContext: context, storageResource: resource, storageRouted: async () => true,
        storageRepository: { headRef: entity => ({ get: async () => ({ exists: heads.has(entity.key), data: () => heads.get(entity.key) }) }) } };
    const auth = { async sessionFor(req) { if (revoked || req.headers.cookie !== 'owner') throw Object.assign(Error('Login required'), { status: 401 }); return { uid: 'owner', adminExpiresAt: Date.now() + 100000 }; } };
    const workers = { async principal(req) { if (req.headers.cookie !== 'worker' || revoked) throw Object.assign(Error('Worker revoked'), { status: 401 }); return { id: 'worker' }; },
        assertContractor(actor, cid) { if (cid !== 'a') throw Object.assign(Error('Wrong contractor'), { status: 403 }); } };
    const dailyProgress = { service: { authorize: async () => ({ id: 'a' }) } };
    app.use(express.json()); app.use(require('../api/storage-http')({ db, auth, workers, dailyProgress })); app.use(require('../api/storage-replay')({ db }));
    app.post('/api/billing', async (req, res) => {
        const scope = context.getStore(), entity = resource('bill', req.body.dataId);
        await scope.authorize(entity, 'commit'); saves++;
        heads.set(entity.key, { kind: 'bill', id: req.body.dataId, mode: 'drive', version: 1, lastRequestId: scope.requestId + '_1', lastDigest: scope.requestHash });
        res.json({ success: true, rev: 1 });
    });
    const router = express.Router();
    router.post('/save', async (req, res) => { await context.getStore().authorize(resource('daily', 'report_a'), 'commit'); res.json({ success: true }); });
    app.use('/api/daily-entry', router);
    app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.message }));
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    return { heads, saves: () => saves, revoke: () => { revoked = true; },
        request: (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: 'owner', 'x-billing-request-id': 'request_00000000001', ...headers }, body: JSON.stringify(body) }),
        close: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }) };
}
test('API acknowledges a committed retry before stale baseRev checks and rejects different-body replay', async t => {
    const f = await fixture(); t.after(f.close);
    const body = { dataId: 'a', baseRev: 0, qty: 1 };
    assert.equal((await (await f.request('/api/billing', body)).json()).success, true);
    assert.equal((await (await f.request('/api/billing', body)).json()).alreadySaved, true);
    assert.equal(f.saves(), 1);
    assert.equal((await f.request('/api/billing', { ...body, qty: 2 })).status, 409);
    f.revoke(); assert.equal((await f.request('/api/billing', body)).status, 401);
});
test('worker commit checks retain full route identity inside an Express mounted router', async t => {
    const f = await fixture(); t.after(f.close);
    assert.equal((await f.request('/api/daily-entry/save', { contractorId: 'a' }, { cookie: 'worker', 'x-dp-link': 'valid' })).status, 200);
    assert.equal((await f.request('/api/daily-entry/save', { contractorId: 'b' }, { cookie: 'worker', 'x-dp-link': 'valid' })).status, 403);
    f.revoke(); assert.equal((await f.request('/api/daily-entry/save', { contractorId: 'a' }, { cookie: 'worker' })).status, 401);
});
