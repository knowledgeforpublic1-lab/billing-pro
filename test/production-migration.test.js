'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateGates, cutover, digest, sourceStamp, kindFor } = require('../scripts/migrate-drive-production');
const createStore = require('../api/drive-first-store');
const createRepository = require('../api/drive-first-repository');
function gates() {
    const now = Date.now();
    const plan = { schemaVersion: 1, projectId: 'billing-pro-e6241', snapshotTime: new Date(now).toISOString(), entities: [] };
    const env = { FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ project_id: plan.projectId }), BILLING_STORAGE_AUTHORITY: 'firestore', BILLING_DRIVE_TRANSPORT: '1',
        GOOGLE_DRIVE_CLIENT_ID: 'client', GOOGLE_DRIVE_CLIENT_SECRET: 'secret', GOOGLE_DRIVE_REFRESH_TOKEN: 'refresh', BILLING_DRIVE_FOLDER_ID: 'private_production_folder' };
    const evidence = { projectId: plan.projectId, folderId: env.BILLING_DRIVE_FOLDER_ID, oauthClientId: env.GOOGLE_DRIVE_CLIENT_ID, oauthAudience: 'personal',
        compatibleProductionDeployment: 'dpl_compatible', hostedStagingDeployment: 'dpl_staging', hostedTransportPassed: true, twoDeviceRolesPassed: true,
        productionCredentialsDeployed: true, privateFolderVerified: true, checkedAt: new Date(now).toISOString() };
    return { env, plan, planSha: digest(plan), evidence, modules: ['master'], now };
}
test('cutover refuses stale backups, plan changes, temporary OAuth and unverified hosted deployment', () => {
    assert.equal(validateGates(gates()), true);
    for (const change of [g => { g.planSha = 'changed'; }, g => { g.now += 86400001; },
        g => { g.env.BILLING_STORAGE_STAGING_PROJECT = 'staging'; }, g => { g.env.FIREBASE_SERVICE_ACCOUNT = '{"project_id":"staging"}'; },
        g => { g.evidence.oauthAudience = 'testing'; }, g => { g.evidence.checkedAt = 'invalid'; },
        g => { g.evidence.productionCredentialsDeployed = false; }, g => { g.evidence.twoDeviceRolesPassed = false; },
        g => { g.evidence.folderId = 'other'; }, g => { g.modules = ['auth']; }]) {
        const g = gates(); change(g); assert.throws(() => validateGates(g));
    }
});
test('planning excludes all authentication data and retains nanosecond source fences', () => {
    assert.equal(kindFor('daily_progress_control', 'dp_worker_user_abc'), null);
    assert.equal(kindFor('default_configs', 'session'), null);
    assert.equal(kindFor('daily_progress_control', 'shared_report_abc'), 'daily');
    assert.equal(sourceStamp('2026-11-21T09:11:26.000001234Z'), '1795252286.1234');
    assert.equal(sourceStamp('2026-11-21T09:11:26Z'), '1795252286.0');
});
async function fixture(upload) {
    const firestore = require('./helpers/storage-firestore')(), files = new Map();
    const repository = createRepository({ firestore: () => firestore, readLegacy: async snap => snap.exists ? snap.data() : null,
        legacyRef: (db, e) => db.collection('default_configs').doc(e.id) });
    const drive = { configured: () => true, createId: async () => 'file_' + files.size,
        writeBytes: async (id, name, bytes) => { files.set(id, Buffer.from(bytes)); if (upload) await upload(firestore); }, readBytes: async id => files.get(id) };
    const store = createStore({ repository, drive, env: { BILLING_DRIVE_MODULES: 'master,daily' } });
    const db = { storageStore: store, storageResource: createStore.resource, listBills: async () => [] };
    await firestore.seed('default_configs/stockMaster', { data: { rows: [{ name: 'मराठी🙂', qty: -2.5 }, { qty: 0 }] } });
    const state = await store.read('master', 'stockMaster');
    const plan = { backupSha256: 'backup', entities: [{ kind: 'master', id: 'stockMaster', collection: 'default_configs', stamp: state.stamp }] };
    return { firestore, files, store, db, plan, original: state.data };
}
test('production cutover verifies JSON and resumes without reverting later user edits or deleting legacy data', async () => {
    const f = await fixture(), journal = [];
    await cutover({ db: f.db, plan: f.plan, modules: ['master'], journal: async row => journal.push(row) });
    assert.deepEqual((await f.store.read('master', 'stockMaster')).data, f.original);
    const edited = { data: { rows: [{ qty: 88 }] } };
    await f.store.save('master', 'stockMaster', edited, { expectedVersion: 1, requestId: 'later_user_edit_0001' });
    await cutover({ db: f.db, plan: f.plan, modules: ['master'], journal: async row => journal.push(row) });
    assert.deepEqual((await f.store.read('master', 'stockMaster')).data, edited);
    assert.ok((await f.firestore.collection('default_configs').doc('stockMaster').get()).exists);
    assert.equal(f.files.size, 2); assert.equal(journal.length, 2);
});
test('a changed source anywhere in the batch stops it before the first upload', async () => {
    const f = await fixture(); f.plan.entities.push({ kind: 'master', id: 'activitiesMaster', collection: 'default_configs', stamp: 'old' });
    await assert.rejects(cutover({ db: f.db, plan: f.plan, modules: ['master'], journal: async () => {} }), /Source changed/);
    assert.equal(f.files.size, 0);
});
test('a live edit during upload wins; the migration cannot publish stale data', async () => {
    const f = await fixture(async db => db.seed('default_configs/stockMaster', { data: { rows: [{ qty: 99 }] } }));
    await assert.rejects(cutover({ db: f.db, plan: f.plan, modules: ['master'], journal: async () => {} }), { status: 409 });
    assert.equal((await f.store.read('master', 'stockMaster')).mode, 'legacy');
    assert.equal((await f.store.read('master', 'stockMaster')).data.data.rows[0].qty, 99);
});
