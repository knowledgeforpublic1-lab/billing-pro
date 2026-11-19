'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const fakeFirestore = require('./helpers/storage-firestore');
function fixture(options = {}) {
    const file = path.resolve('api/db.js'), localRequire = createRequire(file), firestore = fakeFirestore();
    const fakeProcess = { env: { FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ project_id: 'isolated-test', client_email: 'test@example.invalid', private_key: 'unused' }) } };
    firestore.projectId = 'isolated-test';
    if (options.stagingProject) fakeProcess.env.BILLING_STORAGE_STAGING_PROJECT = options.stagingProject;
    const sandbox = { Buffer, Date, Math, JSON, process: fakeProcess, __dirname: path.dirname(file), console: { log() {}, warn() {}, error() {} }, module: { exports: {} },
        require(name) {
            if (name === 'firebase-admin/app') return { cert: () => ({}), getApps: () => [], initializeApp: () => ({}), applicationDefault: () => ({}) };
            if (name === 'firebase-admin/firestore') return { getFirestore: () => firestore };
            if (name === './storage-router') {
                const factory = options => localRequire(name)({ ...options, env: fakeProcess.env });
                factory.configKind = localRequire(name).configKind; return factory;
            }
            return localRequire(name);
        } };
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox);
    return { db: sandbox.module.exports, firestore };
}
test('native Firestore bill CAS rejects racing revision-zero creation and stale force writes', async () => {
    const f = fixture();
    const results = await Promise.allSettled([f.db.saveBillingState('a', { dataId: 'a', rev: 1, stateData: { qty: 1 } }, 0), f.db.saveBillingState('a', { dataId: 'a', rev: 1, stateData: { qty: 2 } }, 0)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
    assert.equal((await f.db.getBillingState('a')).rev, 1);
});

test('worker auth reads stay fresh without transactions and retain commit permission witnesses', async () => {
    const f = fixture(), key = 'dp_worker_user_' + 'a'.repeat(64);
    await f.firestore.seed('daily_progress_control/' + key, { value: { revision: 1 } });
    f.firestore.runTransaction = () => { throw Error('Authentication read should not lock a transaction'); };
    const witnesses = new Map();
    await f.db.storageContext.run({ authorizing: true, authorizationWitnesses: witnesses }, async () => {
        assert.equal((await f.db.getDailyAuthRecord(key)).revision, 1);
    });
    assert.equal(witnesses.size, 1);
    assert.ok([...witnesses.values()][0]);
    await f.firestore.seed('daily_progress_control/' + key, { value: { revision: 2, disabled: true } });
    assert.equal((await f.db.getDailyAuthRecord(key)).disabled, true);
    await assert.rejects(f.db.getDailyAuthRecord('report_business_data'), { status: 400 });
});
test('native UTF-8 chunk saves remain readable by the original live reader for rollback', async () => {
    const f = fixture(), text = 'मराठी🙂'.repeat(85000);
    await f.db.saveBillingState('a', { dataId: 'a', rev: 1, stateData: { text } }, 0);
    const row = await f.db.getBillingState('a');
    assert.equal(row.stateData.text, text);
    const chunks = [...f.firestore.rows.entries()].filter(([key]) => key.includes('/chunks/'));
    assert.ok(chunks.length > 1);
    assert.ok(chunks.every(([, value]) => !value.data.encoding && Buffer.byteLength(value.data.chunk) <= 700000));
    const oldReader = require('./helpers/pre-drive-chunk-reader');
    const legacyResult = await oldReader(await f.firestore.collection('billing_states').doc('a').get());
    assert.equal(legacyResult.stateData.text, text);
    // Retain read support for any base64 snapshots written during earlier staging.
    for (const [key, value] of chunks) await f.firestore.seed(key, { ...value.data, chunk: Buffer.from(value.data.chunk).toString('base64'), encoding: 'base64' });
    assert.equal((await f.db.getBillingState('a')).stateData.text, text);
});
test('native legacy writers recheck Drive mode at their final transaction boundary', async () => {
    const f = fixture(); await f.db.connect();
    for (const [kind, id, write] of [
        ['bill', 'a', () => f.db.saveBillingState('a', { rev: 1 }, 0)],
        ['reconciliation', 'main-reconciliation-state', () => f.db.saveReconciliationState({}, 1, 0)],
        ['mapping', 'contractor_mapping_a', () => f.db.saveDefaultConfig('contractor_mapping_a', {})],
        ['master', 'activitiesMaster', () => f.db.saveDefaultConfig('activitiesMaster', {})],
        ['daily', 'report_a', () => f.db.atomicDailyRecord('report_a', () => ({ value: { quantities: {} }, result: true }))]
    ]) {
        // A reservation can appear after routing chose legacy. This must still reject.
        await f.firestore.seed('billing_storage_heads/' + f.db.storageResource(kind, id).key,
            { mode: 'legacy', kind, id, version: 0, epoch: 1, operation: { id: 'reserved', until: Date.now() + 10000 } });
        await assert.rejects(write(), { status: 409 });
    }
});
test('explicit staging refuses mismatched production/other-project credentials before any database write', async () => {
    const f = fixture({ stagingProject: 'different-staging-project' });
    await assert.rejects(f.db.saveBillingState('a', { rev: 1 }, 0), { status: 503 });
    assert.equal(f.firestore.rows.size, 0);
});
