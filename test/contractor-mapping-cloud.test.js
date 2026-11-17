const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture(fetch) {
    const cache = new Map();
    const context = { window: {}, AbortSignal, fetch, localStorage: { getItem: key => cache.get(key) || null, setItem: (key, value) => cache.set(key, value) } };
    vm.runInNewContext(fs.readFileSync('js/contractor-mapping.js', 'utf8'), context);
    const profile = { version: 1, updatedAt: 123, dirty: true, rows: { activities: {}, poleSchedules: {} } };
    const app = Object.assign({}, context.window.ContractorMappingModule, {
        selectedContractorId: 'team', _activeMappingContractorId: 'team',
        contractorMappingState: { version: 1, profiles: { team: profile } },
        captureContractorMapping() {}, showToast(message) { this.toast = message; }
    });
    return { app, profile, context, cache };
}

test('large SAP mapping uses a normal acknowledged upload and concurrent saves share one request', async () => {
    let requests = 0, release;
    const wait = new Promise(resolve => { release = resolve; });
    const { app, profile } = fixture(async (url, options) => {
        requests++; assert.equal(url, '/api/contractor-mapping');
        assert.ok(Buffer.byteLength(options.body) > 65536);
        assert.notEqual(options.keepalive, true, 'Normal mapping uploads must not use the restricted unload transport');
        assert.equal(options.credentials, 'same-origin'); assert.ok(options.signal);
        await wait; return { ok: true, status: 200, json: async () => ({ success: true }) };
    });
    profile.rows.poleSchedules['1220'] = { material: { sapItems: Array.from({ length: 1000 }, (_, i) => ({ code: 'SAP-' + i, desc: 'A detailed material specification for component ' + i, qty: 1 })) } };
    const first = app.persistContractorMapping(false), second = app.persistContractorMapping(false);
    await new Promise(resolve => setImmediate(resolve)); assert.equal(requests, 1);
    release(); assert.deepEqual(await Promise.all([first, second]), [true, true]);
    assert.equal(profile.dirty, false); assert.equal(app.mappingCloudStatus, 'synced');
});

test('failed SAP cloud save shows the actual error, retains dirty mapping and allows retry', async () => {
    let fail = true;
    const { app, profile } = fixture(async () => fail
        ? { ok: false, status: 503, json: async () => ({ success: false, error: 'Database unavailable' }) }
        : { ok: true, status: 200, json: async () => ({ success: true }) });
    assert.equal(await app.persistContractorMapping(false), false);
    assert.equal(profile.dirty, true); assert.equal(app.mappingCloudStatus, 'error');
    assert.match(app.mappingCloudError, /HTTP 503: Database unavailable/);
    assert.match(app.toast, /Database unavailable/);
    fail = false; assert.equal(await app.persistContractorMapping(false), true);
    assert.equal(profile.dirty, false); assert.equal(app.mappingCloudError, '');
});

test('confirmed local cache acknowledgement survives reload of a stale dirty bill snapshot', () => {
    const { app, profile, cache } = fixture(async () => {});
    const confirmed = { ...profile, dirty: false };
    cache.set('billing_contractor_mapping_v1_team', JSON.stringify(confirmed));
    app.contractorMappingState.base = { activities: {}, poleSchedules: {} };
    app.initializeContractorMappings();
    assert.equal(app.contractorMappingState.profiles.team.dirty, false);
});

test('manual Cloud Save cannot claim success when SAP mapping was rejected', async () => {
    const { app, context } = fixture(async () => ({ ok: false, status: 401, json: async () => ({ success: false, error: 'Login required' }) }));
    vm.runInNewContext(fs.readFileSync('js/sync.js', 'utf8'), context);
    const saved = await context.window.SyncModule.performCloudSync.call(app, { manual: true });
    assert.equal(saved, false); assert.equal(app.syncStatus, 'error');
    assert.match(app.mappingCloudError, /Login session expire/);
});
