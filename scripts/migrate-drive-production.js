'use strict';
// Explicit production cutover. Offline plan by default; never deletes source data.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const readline = require('node:readline');
const { configKind } = require('../api/storage-router');
const { canonical } = require('../api/drive-first-store');
const PROJECT = 'billing-pro-e6241';
const MODULES = ['bill', 'reconciliation', 'master', 'mapping', 'daily'];
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const digest = value => hash(JSON.stringify(canonical(value)));
const clone = value => JSON.parse(JSON.stringify(value));
function kindFor(collection, id) {
    return collection === 'billing_states' ? 'bill' : collection === 'reconciliation_states' ? 'reconciliation'
        : collection === 'default_configs' ? configKind(id)
        : collection === 'daily_progress_control' && /^(report_|shared_report_|entry_event_)/.test(id) ? 'daily' : null;
}
function sourceStamp(iso) {
    const match = /^(.*?)(?:\.(\d+))?Z$/.exec(iso || '');
    if (!match) throw Error('Missing backup source update time');
    return `${Date.parse(match[1] + 'Z') / 1000}.${Number((match[2] || '').padEnd(9, '0'))}`;
}
async function planBackup(directory) {
    const inventory = await require('./storage-inventory')(directory);
    if (inventory.projectId !== PROJECT) throw Error('Production backup project mismatch');
    const entities = [];
    for await (const line of readline.createInterface({ input: fs.createReadStream(path.join(directory, 'documents.ndjson')), crlfDelay: Infinity })) {
        if (!line) continue;
        const row = JSON.parse(line), relative = row.name.split('/documents/')[1];
        const parts = relative.split('/');
        if (parts.length !== 2 || !row.updateTime) continue;
        const [collection, id] = parts, kind = kindFor(collection, id);
        if (kind) entities.push({ kind, id, collection, stamp: sourceStamp(row.updateTime) });
    }
    entities.sort((a, b) => (a.kind + '/' + a.id).localeCompare(b.kind + '/' + b.id));
    return { schemaVersion: 1, projectId: PROJECT, backupSha256: inventory.backupSha256,
        snapshotTime: inventory.snapshotTime, entities, counts: Object.fromEntries(MODULES.map(kind => [kind, entities.filter(e => e.kind === kind).length])),
        deletes: 0 };
}
function validateGates({ env, plan, planSha, evidence, modules, now = Date.now() }) {
    if (!plan || plan.schemaVersion !== 1 || plan.projectId !== PROJECT || digest(plan) !== planSha) throw Error('Reviewed production plan hash mismatch');
    const age = now - Date.parse(plan.snapshotTime);
    if (!Number.isFinite(age) || age < 0 || age > 24 * 60 * 60 * 1000) throw Error('A verified live backup less than 24 hours old is required');
    let account;
    try { account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT); } catch (_) {}
    if (account?.project_id !== PROJECT || env.BILLING_STORAGE_AUTHORITY !== 'firestore' || env.BILLING_STORAGE_STAGING_PROJECT || env.BILLING_STORAGE_STAGING_FOLDER || env.FIRESTORE_EMULATOR_HOST || env.MONGODB_URI) throw Error('Explicit isolated production Firestore authority is required');
    if (!modules?.length || new Set(modules).size !== modules.length || modules.some(m => !MODULES.includes(m)) || env.BILLING_DRIVE_TRANSPORT !== '1') throw Error('Explicit valid module batch and bounded transport required');
    if (!env.GOOGLE_DRIVE_CLIENT_ID || !env.GOOGLE_DRIVE_CLIENT_SECRET || !env.GOOGLE_DRIVE_REFRESH_TOKEN || !/^[\w-]{10,}$/.test(env.BILLING_DRIVE_FOLDER_ID || '')) throw Error('Production OAuth and private folder are required');
    if (!evidence || evidence.projectId !== PROJECT || evidence.folderId !== env.BILLING_DRIVE_FOLDER_ID || evidence.oauthClientId !== env.GOOGLE_DRIVE_CLIENT_ID || !['personal', 'in-production'].includes(evidence.oauthAudience)
        || !/^dpl_[\w]+$/.test(evidence.compatibleProductionDeployment || '') || !/^dpl_[\w]+$/.test(evidence.hostedStagingDeployment || '')
        || evidence.hostedTransportPassed !== true || evidence.twoDeviceRolesPassed !== true || evidence.productionCredentialsDeployed !== true
        || evidence.privateFolderVerified !== true || now - Date.parse(evidence.checkedAt) > 24 * 60 * 60 * 1000 || !Number.isFinite(Date.parse(evidence.checkedAt)) || Date.parse(evidence.checkedAt) > now) throw Error('Fresh hosted verification and durable production OAuth evidence required');
    const keys = new Set();
    for (const entity of plan.entities) {
        const key = entity.collection + '/' + entity.id;
        if (keys.has(key) || entity.id.includes('/') || entity.kind !== kindFor(entity.collection, entity.id) || !entity.stamp) throw Error('Invalid or duplicate migration entity');
        keys.add(key);
    }
    return true;
}
async function cutover({ db, plan, modules, journal }) {
    const selected = plan.entities.filter(e => modules.includes(e.kind)), prepared = [];
    // Check the entire selected batch before reserving or uploading its first record.
    for (const entity of selected) {
        const state = await db.storageStore.read(entity.kind, entity.id);
        if (state.mode === 'drive' || state.mode === 'deleted') {
            prepared.push({ entity, state, resumed: true }); continue;
        }
        if (!state.data || state.stamp !== entity.stamp) throw Error('Source changed since backup; take a fresh backup and plan before cutover');
        const data = clone(state.data);
        if (entity.kind === 'daily' && data.value?.fileId) throw Error('Legacy Daily Drive file must be copied and identity-verified before production cutover');
        if (entity.kind === 'daily' && Number(data.value?.leaseUntil || 0) > Date.now()) throw Error('Daily report is being edited; retry with a fresh backup after the lease ends');
        if (entity.kind === 'bill' || entity.kind === 'reconciliation') data.rev = state.version + 1;
        prepared.push({ entity, state, data });
    }
    const summaries = modules.includes('bill') ? new Map((await db.listBills()).map(row => [row.dataId, clone(row)])) : new Map();
    for (const item of prepared) {
        const { entity, state, data } = item;
        if (item.resumed) { await journal({ kind: entity.kind, key: db.storageResource(entity.kind, entity.id).key, status: state.mode, verified: true, version: state.version }); continue; }
        const requestId = 'production_migration_' + hash(plan.backupSha256 + '\0' + entity.kind + '\0' + entity.id);
        const result = await db.storageStore.save(entity.kind, entity.id, data, { expectedVersion: state.version, expectedStamp: state.stamp,
            requestId, summary: summaries.get(entity.id) || {} });
        const verified = await db.storageStore.read(entity.kind, entity.id);
        if (verified.mode !== 'drive' || verified.version !== result.version || digest(verified.data) !== digest(data)) throw Error('Committed snapshot verification failed; stop and inspect retained versions');
        await journal({ kind: entity.kind, key: db.storageResource(entity.kind, entity.id).key, status: 'drive', version: result.version,
            verified: true, dataSha256: digest(data), fileId: verified.head.fileId, fileSha256: verified.head.sha256 });
    }
    return { selected: selected.length, verified: prepared.length, deletes: 0 };
}
async function main() {
    const args = Object.fromEntries(process.argv.slice(2).map(arg => { const at = arg.indexOf('='); return at < 0 ? [arg, true] : [arg.slice(0, at), arg.slice(at + 1)]; }));
    if (!args['--backup']) throw Error('Use --backup=DIRECTORY; offline plan is the default');
    const plan = await planBackup(path.resolve(args['--backup']));
    const planSha = digest(plan);
    if (!args['--apply']) {
        if (args['--output']) fs.writeFileSync(args['--output'], JSON.stringify({ plan, planSha256: planSha }, null, 2), { flag: 'wx', mode: 0o600 });
        console.log(JSON.stringify({ mode: 'offline-plan', planSha256: planSha, counts: plan.counts, networkRequests: 0, databaseWrites: 0 })); return;
    }
    if (!args['--env-file'] || !args['--evidence'] || !args['--plan-sha'] || !args['--journal'] || !args['--modules']) throw Error('Apply requires private env, hosted evidence, reviewed plan SHA, journal and explicit modules');
    const env = require('dotenv').parse(fs.readFileSync(args['--env-file']));
    const evidence = JSON.parse(fs.readFileSync(args['--evidence'])), modules = String(args['--modules']).split(',');
    validateGates({ env, plan, planSha: args['--plan-sha'], evidence, modules });
    // No inherited Firebase, Mongo, staging or Drive credential can silently win.
    for (const key of Object.keys(process.env)) if (/^(?:FIREBASE_|FIRESTORE_|GOOGLE_DRIVE_|BILLING_|DAILY_PROGRESS_DRIVE_|MONGO)/.test(key)) delete process.env[key];
    Object.assign(process.env, env, { BILLING_DRIVE_MODULES: modules.join(',') });
    const fd = fs.openSync(args['--journal'], 'wx', 0o600);
    try {
        const db = require('../api/db');
        await db.connect();
        if (db.getProvider() !== 'firebase' || db.getFirestoreInstance().projectId !== PROJECT) throw Error('Connected authority mismatch');
        const drive = require('../api/daily-drive')({ env: process.env, folderEnv: 'BILLING_DRIVE_FOLDER_ID' }); await drive.check();
        const scope = { versions: {}, expectedVersions: {}, operations: {}, resourceContractors: new Map(), authorize: async () => {
            if (db.getFirestoreInstance().projectId !== PROJECT) throw Error('Authority changed during migration');
        } };
        const result = await db.storageContext.run(scope, () => cutover({ db, plan, modules, journal: async row => {
            fs.writeSync(fd, JSON.stringify({ ...row, checkedAt: new Date().toISOString(), planSha256: planSha }) + '\n'); fs.fsyncSync(fd);
        } }));
        console.log(JSON.stringify({ ...result, cleanupPerformed: false }));
    } finally { fs.closeSync(fd); }
}
module.exports = { planBackup, validateGates, cutover, digest, sourceStamp, kindFor };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
