const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const apiRequire = createRequire(path.resolve('api/index.js'));
const records = new Map();
let bulkUpdates = 0;
const db = {
    getDefaultConfig: async key => records.get(key) || null,
    saveDefaultConfig: async (key, data) => records.set(key, { data }),
    updateAllBillsPoleSchedules() { bulkUpdates++; },
    updateAllBillsActivities() { bulkUpdates++; },
    getProvider: () => 'test'
};
const context = {
    module: { exports: {} }, __dirname: path.resolve('api'),
    process: { env: { API_KEY: 'test-key' } }, console,
    require(name) {
        if (name === './db') return db;
        if (name === './auth') return () => ({
            router: apiRequire('express').Router(),
            middleware(req, res, next) {
                if (req.headers['x-api-key'] !== 'test-key') return res.status(401).json({ success: false });
                req.authSession = { adminExpiresAt: Date.now() + 300000 };
                next();
            },
            requireAdmin(req, res, next) { next(); }
        });
        if (name === 'dotenv') return { config() {} };
        // Legacy default-master requests must not write actual source files in tests.
        if (name === 'fs') return { writeFileSync() {} };
        return apiRequire(name);
    }
};
vm.runInNewContext(fs.readFileSync('api/index.js', 'utf8'), context);
async function main() {
    const server = context.module.exports.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    async function request(url, body, authenticated = true) {
        const headers = { 'Content-Type': 'application/json' };
        if (authenticated) headers['x-api-key'] = 'test-key';
        return fetch(base + url, { headers, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) });
    }
    const profile = code => ({ version: 1, rows: { activities: {}, poleSchedules: { '907': { pole: { itemCode: code } } } }, updatedAt: 100 });
    try {
        assert.equal((await request('/api/contractor-mapping?contractorId=A', null, false)).status, 401);
        assert.equal((await request('/api/contractor-mapping', { contractorId: '__proto__', profile: profile('BAD') })).status, 400);
        assert.equal((await request('/api/contractor-mapping', { contractorId: 'A', profile: { version: 1, rows: { activities: [], poleSchedules: {} } } })).status, 400);
        assert.equal((await request('/api/contractor-mapping', { contractorId: 'A', profile: profile('A-POLE') })).status, 200);
        assert.equal((await request('/api/contractor-mapping', { contractorId: 'B', profile: profile('B-POLE') })).status, 200);
        let result = await (await request('/api/contractor-mapping?contractorId=A')).json();
        assert.equal(result.profile.rows.poleSchedules['907'].pole.itemCode, 'A-POLE');
        result = await (await request('/api/contractor-mapping?contractorId=B')).json();
        assert.equal(result.profile.rows.poleSchedules['907'].pole.itemCode, 'B-POLE');
        result = await (await request('/api/contractor-mapping?contractorId=C')).json();
        assert.equal(result.profile, null, 'New contractor has no guessed mapping');
        await request('/api/contractor-mapping', { contractorId: 'A', profile: { version: 1, rows: { activities: {}, poleSchedules: {} } } });
        result = await (await request('/api/contractor-mapping?contractorId=A')).json();
        assert.deepEqual(result.profile.rows.poleSchedules, {}, 'Cleared overrides replace old cloud data');
        assert.equal(context.pickAllowedKeys({ contractorMappingState: { version: 1 } }).contractorMappingState.version, 1, 'Bill API retains mapping profiles');
        await request('/api/save-default-pole-schedules', { poleSchedules: { '907': { materials: [] } } });
        await request('/api/save-default-activities', { activities: { '907': { materials: [] } } });
        assert.equal(bulkUpdates, 0, 'Saving defaults cannot replace mappings in existing contractor bills');
        console.log('Contractor mapping API: authentication, contractor isolation, clearing, bill persistence and no bulk bill updates passed.');
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
