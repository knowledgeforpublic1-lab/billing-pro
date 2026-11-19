'use strict';
// Deliberately refuses production. Never deletes legacy documents, chunks or Drive versions.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { configKind } = require('../api/storage-router');
async function main() {
    const args = Object.fromEntries(process.argv.slice(2).map(value => { const at = value.indexOf('='); return at < 0 ? [value, true] : [value.slice(0, at), value.slice(at + 1)]; }));
    if (!args['--apply']) {
        const report = await require('./storage-inventory')(path.resolve(args['--backup'] || 'backups/pre-drive-first-20261118/live-firestore'));
        console.log(JSON.stringify({ mode: 'offline-dry-run', ...report }, null, 2)); return;
    }
    const expected = String(args['--staging-project'] || '');
    if (!expected || expected === 'billing-pro-e6241' || process.env.BILLING_STORAGE_STAGING_PROJECT !== expected || !process.env.FIRESTORE_EMULATOR_HOST && !process.env.FIREBASE_SERVICE_ACCOUNT) throw Error('Explicit isolated staging project/credential required; production migration is disabled in this tool');
    if (!args['--backup'] || !args['--backup-sha']) throw Error('Verified staging backup and its SHA-256 are required');
    const inventory = await require('./storage-inventory')(path.resolve(args['--backup']));
    if (inventory.projectId !== expected || inventory.backupSha256 !== args['--backup-sha']) throw Error('Backup does not match the selected staging authority');
    if (process.env.BILLING_DRIVE_TRANSPORT !== '1' || !process.env.BILLING_DRIVE_MODULES) throw Error('Staging transport and module flags required');
    if (!process.env.BILLING_DRIVE_FOLDER_ID || process.env.BILLING_DRIVE_FOLDER_ID !== process.env.BILLING_STORAGE_STAGING_FOLDER) throw Error('Explicit isolated staging Drive folder required');
    const db = require('../api/db');
    await db.connect();
    if (db.getProvider() !== 'firebase' || db.getFirestoreInstance().projectId !== expected) throw Error('Connected authority does not match isolated staging project');
    const drive = require('../api/daily-drive')({ folderEnv: 'BILLING_DRIVE_FOLDER_ID' });
    await drive.check();
    const entities = [], firestore = db.getFirestoreInstance();
    for (const collection of ['billing_states', 'reconciliation_states', 'default_configs', 'daily_progress_control']) {
        const snapshot = await firestore.collection(collection).get();
        for (const row of snapshot.docs) {
            const kind = collection === 'billing_states' ? 'bill' : collection === 'reconciliation_states' ? 'reconciliation' : collection === 'default_configs' ? configKind(row.id) : /^(report_|shared_report_|entry_event_)/.test(row.id) ? 'daily' : null;
            if (kind && db.storageEnabled(kind)) entities.push({ kind, id: row.id });
        }
    }
    const summaries = new Map((await db.listBills()).map(row => [row.dataId, row]));
    const scope = { versions: {}, expectedVersions: {}, operations: {}, resourceContractors: new Map(), authorize: async () => {
        if (firestore.projectId !== expected) throw Error('Staging authority changed');
    } };
    await db.storageContext.run(scope, async () => {
        for (const entity of entities) {
            const state = await db.storageStore.read(entity.kind, entity.id);
            if (state.mode === 'drive' || state.mode === 'deleted') continue; // Resume preserves prior successful cutovers.
            const data = { ...state.data };
            if (entity.kind === 'daily' && entity.id.startsWith('report_') && data.value?.fileId) {
                const report = await require('../api/daily-drive')().read(data.value.fileId);
                if (report.contractorId !== data.value.contractorId || report.date !== data.value.date || Number(report.version) !== Number(data.value.version)) throw Error('Legacy Daily Progress Drive identity/version mismatch');
                data.value = { ...data.value, baseReport: report };
                delete data.value.fileId;
            }
            if (entity.kind === 'bill' || entity.kind === 'reconciliation') data.rev = state.version + 1;
            const requestId = 'migration_' + crypto.createHash('sha256').update(inventory.backupSha256 + entity.kind + entity.id).digest('hex');
            const result = await db.storageStore.save(entity.kind, entity.id, data, { expectedVersion: state.version,
                expectedStamp: state.stamp, requestId, summary: entity.kind === 'bill' ? summaries.get(entity.id) || {} : {} });
            const verified = await db.storageStore.read(entity.kind, entity.id);
            if (verified.version !== result.version || JSON.stringify(verified.data) !== JSON.stringify(data)) throw Error('Post-cutover verification failed; stopped without deleting legacy data');
            console.log(JSON.stringify({ kind: entity.kind, key: db.storageResource(entity.kind, entity.id).key, version: result.version, verified: true }));
        }
    });
    console.log('Staging migration verified; no legacy cleanup performed.');
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
