'use strict';
// Explicit staging only. Synthetic test records are retained; no deletes or live migration.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const createStore = require('../api/drive-first-store');
const createRepository = require('../api/drive-first-repository');
const createDrive = require('../api/daily-drive');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
async function main() {
    const env = require('dotenv').parse(fs.readFileSync('.env.drive-staging.local', 'utf8'));
    const account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT || '{}');
    if (env.BILLING_STORAGE_STAGING_PROJECT !== 'billing-pro-staging-ba9a8' || account.project_id !== env.BILLING_STORAGE_STAGING_PROJECT ||
        !require('./storage-preflight')(env).readyForExternalCheck) throw Error('Matching isolated staging configuration is required');
    const { initializeApp, cert, deleteApp } = require('firebase-admin/app');
    const { getFirestore } = require('firebase-admin/firestore');
    const run = crypto.randomUUID();
    const directory = path.join('backups', 'drive-staging-20261119', run);
    fs.mkdirSync(directory, { recursive: true });
    const report = { run, project: account.project_id, startedAt: new Date().toISOString(),
        syntheticDataOnly: true, productionChanges: 0, deletions: 0, checks: [], complete: false };
    const writeReport = () => fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
    const passed = (name, details = {}) => { report.checks.push({ name, passed: true, ...details }); writeReport(); console.log(name + ': passed'); };
    writeReport();
    const apps = [];
    function connect(name) {
        const app = initializeApp({ projectId: account.project_id, credential: cert(account) }, 'staging_' + run + '_' + name);
        apps.push(app);
        const db = getFirestore(app);
        assert.equal(db.projectId, account.project_id);
        const repository = createRepository({ firestore: () => db,
            readLegacy: async snap => snap.exists ? snap.data() : null,
            legacyRef: (database, entity) => database.collection('staging_smoke_legacy').doc(entity.key) });
        const drive = createDrive({ env, folderEnv: 'BILLING_DRIVE_FOLDER_ID' });
        return { db, repository, drive, store: createStore({ repository, drive, env }) };
    }
    try {
        const first = connect('first');
        await first.drive.check(); passed('private-folder-and-refreshed-oauth');
        const saved = [];
        for (const kind of ['bill', 'reconciliation', 'master', 'mapping', 'daily']) {
            const id = 'staging_smoke_' + run + '_' + kind;
            const original = { value: { contractorId: 'synthetic_only', date: '2026-11-19',
                label: 'परीक्षण', quantities: { zero: 0, negative: -1.25, fraction: 12.345 }, leaseUntil: 10 } };
            const latest = { value: { ...original.value, label: 'नवीन परीक्षण', leaseUntil: 20 } };
            const requestId = crypto.randomUUID();
            await first.store.save(kind, id, original, { expectedVersion: 0, requestId: crypto.randomUUID() });
            assert.deepEqual((await first.store.read(kind, id)).data, original);
            await first.store.save(kind, id, latest, { expectedVersion: 1, requestId });
            assert.equal((await first.store.save(kind, id, latest, { expectedVersion: 1, requestId })).alreadySaved, true);
            const current = await first.store.read(kind, id);
            assert.deepEqual(current.data, latest);
            assert.equal(current.version, 2);
            assert.ok(Buffer.byteLength(JSON.stringify(current.head)) < 4096);
            assert.equal(current.head.value, undefined);
            const envelope = JSON.parse((await first.drive.readBytes(current.head.fileId)).toString('utf8'));
            const previous = await first.drive.readBytes(envelope.previous.fileId);
            assert.equal(sha(previous), envelope.previous.sha256);
            saved.push({ kind, id, data: latest, version: 2 });
            passed(kind + '-save-read-retry-and-retained-history');
        }
        const raceId = 'staging_smoke_' + run + '_race';
        const race = await Promise.allSettled([1, 2].map(qty => first.store.save('mapping', raceId, { qty }, { expectedVersion: 0, requestId: crypto.randomUUID() })));
        assert.equal(race.filter(r => r.status === 'fulfilled').length, 1);
        assert.equal(race.find(r => r.status === 'rejected').reason.status, 409);
        passed('real-firestore-racing-save-rejects-stale-writer');

        const bigId = 'staging_smoke_' + run + '_large';
        const big = { value: { label: 'synthetic 8 MiB Unicode', rows: 'आ'.repeat(Math.floor(8 * 1024 * 1024 / 3)) } };
        await first.store.save('master', bigId, big, { expectedVersion: 0, requestId: crypto.randomUUID() });
        assert.deepEqual((await first.store.read('master', bigId)).data, big);
        passed('real-8mib-unicode-resumable-upload-readback', { payloadBytes: Buffer.byteLength(JSON.stringify(big)) });

        const binary = crypto.randomBytes(1024 * 1024 + 17), fileId = await first.drive.createId();
        const session = await first.drive.beginUpload(fileId, 'synthetic_source_' + run + '.bin', binary.length, 'application/octet-stream');
        for (let offset = 0; offset < binary.length; offset += 256 * 1024) {
            const part = binary.subarray(offset, offset + 256 * 1024);
            const ack = await first.drive.uploadPart(session, part, offset, binary.length);
            assert.equal(ack.offset, offset + part.length);
            if (ack.complete) assert.equal(ack.id, fileId);
        }
        const pieces = [];
        for (let offset = 0; offset < binary.length; offset += 256 * 1024) pieces.push(await first.drive.readRange(fileId, offset, Math.min(256 * 1024, binary.length - offset), binary.length));
        assert.equal(sha(Buffer.concat(pieces)), sha(binary));
        passed('real-256kib-binary-parts-and-range-download-checksum');

        // New Firestore app, repository and Drive adapter; no process-memory payload reuse.
        const restarted = connect('restore');
        const disabled = createStore({ repository: restarted.repository, drive: restarted.drive, env: { ...env, BILLING_DRIVE_MODULES: '' } });
        for (const entry of saved) {
            const restored = await disabled.read(entry.kind, entry.id);
            assert.equal(restored.version, entry.version);
            assert.deepEqual(restored.data, entry.data);
        }
        assert.deepEqual((await disabled.read('master', bigId)).data, big);
        fs.writeFileSync(path.join(directory, 'restored-synthetic-data.json'), JSON.stringify(saved, null, 2));
        passed('fresh-connections-restore-all-five-modules-with-rollout-off');
        const broken = createStore({ repository: restarted.repository,
            drive: { ...restarted.drive, readBytes: async () => Buffer.from('synthetic corrupt response') }, env });
        await assert.rejects(broken.read(saved[0].kind, saved[0].id), { status: 503 });
        passed('real-committed-head-rejects-corrupt-download-without-mutating-file');
        report.complete = true; report.finishedAt = new Date().toISOString(); writeReport();
        console.log('Real isolated staging verification complete. Report: ' + path.resolve(directory, 'report.json'));
    } catch (error) {
        report.failure = { status: Number(error.status || error.code) || null,
            reason: error instanceof assert.AssertionError ? 'verification assertion failed' : 'staging operation failed; inspect locally without logging secrets' };
        writeReport();
        throw Error('Staging verification stopped. Review the retained report; no production or legacy cleanup was performed.');
    } finally { await Promise.all(apps.map(app => deleteApp(app))); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = main;
