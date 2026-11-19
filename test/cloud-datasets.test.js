'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function fixture() {
    const cache = new Map(), requests = [], events = []; let status = 200, remote = { qty: 1 }, version = 1, offline = false, postGate, postCount = 0;
    const key = 'a'.repeat(64);
    const global = { BillingStorageVersions: { [key]: { v: version, s: null } },
        BillingStorage: { async getItemAsync(id) { return structuredClone(cache.get(id)); }, async setItem(id, data) { cache.set(id, structuredClone(data)); return { saved: true }; },
            async updateItem(id, fn) { const next = fn(structuredClone(cache.get(id))); if (next !== undefined) cache.set(id, structuredClone(next)); return { saved: true, value: structuredClone(cache.get(id)) }; } },
        dispatchEvent: event => events.push(event) };
    const fetch = async (path, options = {}) => {
        requests.push({ path, options });
        if (offline) throw Error('Network unavailable');
        if (options.method === 'POST') {
            if (postGate) await postGate(++postCount);
            if (status === 200) { version++; remote = JSON.parse(options.body).data; }
            return { ok: status === 200, status, headers: new Headers({ 'x-billing-storage-versions': JSON.stringify({ [key]: { v: version, s: null } }) }), json: async () => status === 200 ? { success: true } : { success: false, error: 'New cloud revision exists' } };
        }
        global.BillingStorageVersions[key] = { v: version, s: null };
        return { ok: true, status: 200, headers: new Headers({ 'x-billing-storage-versions': JSON.stringify({ [key]: { v: version, s: null } }) }), json: async () => ({ success: true, data: structuredClone(remote) }) };
    };
    vm.runInNewContext(fs.readFileSync('js/cloud-datasets.js', 'utf8'), { window: global, fetch, console, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } } });
    return { api: global.BillingCloudDatasets, cache, requests, events, key, setStatus: value => { status = value; }, updateRemote: data => { remote = data; version++; },
        setOffline: value => { offline = value; }, postGate: fn => { postGate = fn; } };
}
test('pending stock survives refresh without fetching a newer base; retry keeps its original version', async () => {
    const f = fixture(); f.setStatus(409);
    await assert.rejects(f.api.save('stockMaster', { qty: 2 }));
    const pending = f.cache.get('billing_drive_dataset_stockMaster'); assert.equal(pending.pending, true);
    f.updateRemote({ qty: 3 }); const before = f.requests.length;
    assert.equal((await f.api.load('stockMaster', null)).qty, 2); assert.equal(f.requests.length, before);
    await assert.rejects(f.api.resolve('stockMaster', 'retry'));
    const posted = f.requests.at(-1); assert.equal(JSON.parse(posted.options.headers['x-billing-storage-versions'])[f.key].v, 1);
});
test('explicit use-cloud resolution preserves an independent conflict backup before replacing pending data', async () => {
    const f = fixture(); f.setStatus(409); await assert.rejects(f.api.save('stockMaster', { qty: 2 }));
    f.updateRemote({ qty: 3 }); await f.api.resolve('stockMaster', 'cloud');
    assert.equal(f.cache.get('billing_drive_dataset_stockMaster').data.qty, 3);
    assert.equal(f.cache.get('billing_drive_dataset_stockMaster').pending, false);
    assert.equal([...f.cache.entries()].find(([key]) => key.includes('conflict_'))[1].data.qty, 2);
    assert.equal(f.events.at(-1).detail.data.qty, 3);
});
test('explicit keep-local resolution fetches the new base and acknowledges only that chosen data', async () => {
    const f = fixture(); f.setStatus(409); await assert.rejects(f.api.save('previousRecoMaster', { qty: 2 }));
    f.updateRemote({ qty: 3 }); f.setStatus(200); await f.api.resolve('previousRecoMaster', 'local');
    assert.equal(JSON.parse(f.requests.at(-1).options.headers['x-billing-storage-versions'])[f.key].v, 2);
    assert.equal(f.cache.get('billing_drive_dataset_previousRecoMaster').pending, false);
    assert.equal(f.cache.get('billing_drive_dataset_previousRecoMaster').data.qty, 2);
});
test('offline before the initial revision read still persists pending data and recovers after reload', async () => {
    const f = fixture(); f.setOffline(true);
    await assert.rejects(f.api.save('stockMaster', { qty: 9 }), /Network unavailable/);
    const pending = f.cache.get('billing_drive_dataset_stockMaster');
    assert.equal(pending.pending, true); assert.equal(pending.base, null); assert.equal(pending.data.qty, 9);
    assert.equal((await f.api.load('stockMaster', null)).qty, 9);
    f.setOffline(false); await f.api.resolve('stockMaster', 'retry');
    assert.equal(f.cache.get('billing_drive_dataset_stockMaster').pending, false);
});
test('overlapping saves serialize cloud writes and an earlier acknowledgment cannot replace a later pending edit', async () => {
    const f = fixture();
    let entered1, entered2, release1, release2;
    const start1 = new Promise(resolve => entered1 = resolve), start2 = new Promise(resolve => entered2 = resolve);
    const gate1 = new Promise(resolve => release1 = resolve), gate2 = new Promise(resolve => release2 = resolve);
    f.postGate(async index => { if (index === 1) { entered1(); await gate1; } else { entered2(); await gate2; } });
    const first = f.api.save('stockMaster', { qty: 2 }); await start1;
    const second = f.api.save('stockMaster', { qty: 3 });
    assert.equal(f.cache.get('billing_drive_dataset_stockMaster').data.qty, 3);
    assert.equal(f.requests.filter(request => request.options.method === 'POST').length, 1);
    release1(); await first; await start2;
    const pending = f.cache.get('billing_drive_dataset_stockMaster');
    assert.equal(pending.pending, true); assert.equal(pending.data.qty, 3); assert.equal(pending.base[f.key].v, 2);
    release2(); await second;
    assert.equal(f.cache.get('billing_drive_dataset_stockMaster').data.qty, 3);
    assert.equal(f.cache.get('billing_drive_dataset_stockMaster').pending, false);
    assert.equal(JSON.parse(f.requests.filter(request => request.options.method === 'POST')[1].options.headers['x-billing-storage-versions'])[f.key].v, 2);
});
