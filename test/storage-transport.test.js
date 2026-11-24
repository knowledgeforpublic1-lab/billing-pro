'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const crypto = require('node:crypto');
const vm = require('node:vm');
const fs = require('node:fs');
const createTransport = require('../api/storage-transport');
const context = require('../api/storage-context');
const createStore = require('../api/drive-first-store');
const { versions } = require('../api/storage-http');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function fixture({ intercept } = {}) {
    const records = new Map(), files = new Map(), sessions = new Map(); let next = 0, permissions = ['a'], tail = Promise.resolve();
    const drive = { configured: () => true, createId: async () => 'file_' + ++next,
        async beginUpload(id, name, total) { const url = 'https://www.googleapis.com/upload/drive/' + id; sessions.set(url, { id, total, bytes: Buffer.alloc(0) }); return url; },
        async uploadPart(url, bytes, offset, total) {
            const session = sessions.get(url);
            if (bytes.length) { assert.equal(offset, session.bytes.length); session.bytes = Buffer.concat([session.bytes, bytes]); }
            if (session.bytes.length === total) { files.set(session.id, session.bytes); return { offset: total, complete: true, id: session.id }; }
            return { offset: session.bytes.length, complete: false };
        },
        async writeBytes(id, name, bytes) { files.set(id, Buffer.from(bytes)); },
        async readBytes(id) { return Buffer.from(files.get(id)); },
        async verifyBytes(id, bytes, hash) { const stored = files.get(id); return stored.length === bytes && sha(stored) === hash; },
        async readRange(id, offset, length) { return Buffer.from(files.get(id).subarray(offset, offset + length)); } };
    const db = { storageContext: context, storageResource: createStore.resource,
        atomicDailyRecord(key, fn) {
            const task = tail.then(() => { const result = fn(structuredClone(records.get(key) || null)); if (result.value !== undefined) records.set(key, structuredClone(result.value)); return structuredClone(result.result); });
            tail = task.catch(() => {}); return task;
        } };
    const workers = { async principal(req) {
        if (!req.headers.cookie) throw Object.assign(Error('Login required'), { status: 401 });
        return { id: req.headers.cookie, role: 'admin', contractorIds: permissions };
    } };
    const auth = { async sessionFor(req) { await workers.principal(req); return { adminExpiresAt: Date.now() + 600000 }; } };
    const app = express(); app.use(express.json({ limit: '400kb' }));
    app.use((req, res, next) => context.run({ versions: {}, operations: {} }, next));
    app.use(createTransport({ db, drive, workers, auth, env: { BILLING_DRIVE_TRANSPORT: '1' } }));
    let dataset;
    app.post('/api/billing', (req, res) => { dataset = req.body; res.json({ success: true, rev: 1 }); });
    app.get('/api/billing', (req, res) => res.json({ success: true, data: dataset }));
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    const requests = [], responses = [];
    async function request(url, options = {}) {
        requests.push({ url, bytes: Buffer.byteLength(options.body || ''), keepalive: options.keepalive });
        const headers = new Headers(options.headers); if (!headers.has('cookie')) headers.set('cookie', 'owner-a');
        const response = await fetch(new URL(url, base), { ...options, headers });
        responses.push((await response.clone().arrayBuffer()).byteLength);
        return intercept ? intercept(url, options, response) : response;
    }
    const global = { fetch: request, location: { origin: base, href: base + '/' }, crypto: crypto.webcrypto, btoa, atob, setTimeout: fn => setTimeout(fn, 0) };
    vm.runInNewContext(fs.readFileSync('js/storage-transport.js', 'utf8'), { window: global, URL, Headers, Response, TextEncoder, Uint8Array, console });
    return { app, request, client: global, base, records, files, requests, responses, drive, changePermissions: next => { permissions = next; },
        close: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }) };
}
test('8 MB Unicode JSON crosses both directions with bounded HTTP bodies and exact SHA-256', async t => {
    const f = await fixture(); t.after(f.close);
    const payload = { dataId: 'bill_a', quantities: [-5.75, 0, 10.123], name: 'श्री गणेश', text: 'क'.repeat(2800000) };
    const saved = await f.client.fetch('/api/billing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    assert.equal((await saved.json()).success, true);
    const loaded = await f.client.fetch('/api/billing');
    assert.deepEqual((await loaded.json()).data, payload);
    assert.ok(f.requests.every(row => row.bytes < 400 * 1024));
    assert.ok(f.responses.every(size => size < 1024 * 1024));
    for (const record of f.records.values()) assert.ok(Buffer.byteLength(JSON.stringify(record)) < 4096);
});
test('actual desktop sync sends an 8 MB bill through bounded transport instead of the obsolete 4 MB guard', async t => {
    const f = await fixture(); t.after(f.close);
    vm.runInNewContext(fs.readFileSync('js/sync.js', 'utf8'), { window: f.client, fetch: f.client.fetch, console, TextEncoder,
        localStorage: { getItem() { return null; }, setItem() {} }, setTimeout: () => 1, clearTimeout() {} });
    const text = 'q'.repeat(8 * 1024 * 1024);
    const app = { ...f.client.SyncModule, cloudRev: 0, activeBillId: 'bill_a', showToast() {}, _scheduleSyncRetry() {},
        buildSyncPayload() { return { dataId: 'bill_a', baseRev: this.cloudRev, text }; } };
    assert.equal(await app.syncToCloudNow(), true); assert.equal(app.cloudRev, 1);
    assert.ok(f.requests.every(row => row.bytes < 400 * 1024));
});
test('medium saves do not use browser keepalive beyond its body budget', async t => {
    const f = await fixture(); t.after(f.close);
    await f.client.fetch('/api/billing', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'q'.repeat(100000) }) });
    assert.equal(f.requests.find(row => row.url === '/api/billing').keepalive, false);
});
test('source workbook is retained as exact binary and returned reference omits credentials/file IDs', async t => {
    const f = await fixture(); t.after(f.close);
    const bytes = crypto.randomBytes(700000);
    const asset = await f.client.BillingStorageTransport.archiveFile({ name: 'source.xlsx', arrayBuffer: async () => bytes }, 'reconciliation', 'main-reconciliation-state');
    assert.equal(asset.sha256, sha(bytes)); assert.equal(asset.bytes, bytes.length); assert.equal(asset.fileId, undefined);
    const record = [...f.records.entries()].find(([key]) => key.startsWith('storage_asset_'))[1];
    assert.deepEqual(f.files.get(record.fileId), bytes);
});
test('original workbooks above 32 MB use their separate asset budget while JSON remains bounded', async t => {
    const f = await fixture(); t.after(f.close);
    const bytes = Buffer.alloc(33 * 1024 * 1024, 23);
    f.drive.readBytes = async () => { throw Error('Final source chunk must not download the entire workbook'); };
    const asset = await f.client.BillingStorageTransport.archiveFile({ name: 'large-stock.xlsx', size: bytes.length, arrayBuffer: async () => bytes }, 'master', 'stockMaster');
    assert.equal(asset.bytes, bytes.length); assert.equal(asset.sha256, sha(bytes));
    assert.ok(f.requests.every(row => row.bytes < 400 * 1024));
    const rejected = await f.request('/api/storage/transport', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: '/api/billing', bytes: bytes.length, sha256: sha(bytes) }) });
    assert.equal(rejected.status, 400, 'large source assets must not raise the JSON dataset limit');
});

test('a lost chunk response and transient 503 retry the same upload without duplicating bytes', async t => {
    let failures = 0;
    const f = await fixture({ intercept(url, options, response) {
        if (options.method === 'PUT' && failures++ < 2) {
            if (failures === 1) throw TypeError('Connection lost after Drive accepted the chunk');
            return new Response(JSON.stringify({ success: false, error: 'Temporary storage failure' }), { status: 503 });
        }
        return response;
    } });
    t.after(f.close);
    const bytes = crypto.randomBytes(300000);
    const asset = await f.client.BillingStorageTransport.archiveFile({ name: 'stock.xlsx', size: bytes.length, arrayBuffer: async () => bytes }, 'master', 'stockMaster');
    assert.equal(asset.sha256, sha(bytes));
    const parts = f.requests.filter(row => row.url.startsWith('/api/storage/transport/') && row.bytes);
    assert.equal(parts.length, 4);
    assert.equal(new Set(parts.map(row => row.url)).size, 1);
});

test('permission failures are not retried and persistent outages stop after three attempts', async t => {
    for (const status of [403, 503]) {
        let attempts = 0;
        const f = await fixture({ intercept(url, options, response) {
            if (options.method !== 'PUT') return response;
            attempts++;
            return new Response(JSON.stringify({ success: false, error: 'Upload rejected' }), { status });
        } });
        t.after(f.close);
        const bytes = Buffer.from('stock');
        await assert.rejects(f.client.BillingStorageTransport.archiveFile({ name: 'stock.xlsx', arrayBuffer: async () => bytes }, 'master', 'stockMaster'), /Upload rejected/);
        assert.equal(attempts, status === 403 ? 1 : 3);
        assert.equal([...f.records.keys()].some(key => key.startsWith('storage_asset_')), false);
    }
});
test('upload rejects another user, revoked permissions, incorrect lengths and wrong destination', async t => {
    const f = await fixture(); t.after(f.close); const bytes = Buffer.from('{"x":1}');
    const headers = { 'Content-Type': 'application/json' };
    const begin = await f.request('/api/storage/transport', { method: 'POST', headers, body: JSON.stringify({ target: '/api/billing', bytes: bytes.length, sha256: sha(bytes) }) });
    const { id } = await begin.json();
    const part = JSON.stringify({ offset: 0, base64: bytes.toString('base64') });
    assert.equal((await f.request('/api/storage/transport/' + id, { method: 'PUT', headers: { ...headers, cookie: 'owner-b' }, body: part })).status, 403);
    f.changePermissions(['b']);
    assert.equal((await f.request('/api/storage/transport/' + id, { method: 'PUT', headers, body: part })).status, 403);
    f.changePermissions(['a']);
    assert.equal((await f.request('/api/storage/transport/' + id, { method: 'PUT', headers, body: JSON.stringify({ offset: 0, base64: 'eA==' }) })).status, 400);
    assert.equal((await f.request('/api/storage/transport/' + id, { method: 'PUT', headers, body: part })).status, 200);
    assert.equal((await f.request('/api/reconciliation', { method: 'POST', headers, body: JSON.stringify({ __billingUpload: id }) })).status, 409);
});
test('bad upload checksum never reaches the business save handler', async t => {
    const f = await fixture(); t.after(f.close); const bytes = Buffer.from('{"x":1}'); const headers = { 'Content-Type': 'application/json' };
    const begin = await (await f.request('/api/storage/transport', { method: 'POST', headers, body: JSON.stringify({ target: '/api/billing', bytes: bytes.length, sha256: '0'.repeat(64) }) })).json();
    assert.equal((await f.request('/api/storage/transport/' + begin.id, { method: 'PUT', headers, body: JSON.stringify({ offset: 0, base64: bytes.toString('base64') }) })).status, 503);
    assert.equal((await f.request('/api/billing', { method: 'POST', headers, body: JSON.stringify({ __billingUpload: begin.id }) })).status, 409);
});
test('request revisions are bounded and malformed headers cannot reach the store', () => {
    for (const value of ['[]', 'null', '{bad', JSON.stringify({ invalid: { v: 1 } }), JSON.stringify({ ['a'.repeat(64)]: { v: -1 } }), 'x'.repeat(6001)]) assert.throws(() => versions(value), { status: 400 });
    assert.deepEqual(versions(JSON.stringify({ ['a'.repeat(64)]: { v: 0, s: '123.0' } })), { ['a'.repeat(64)]: { v: 0, s: '123.0' } });
});
