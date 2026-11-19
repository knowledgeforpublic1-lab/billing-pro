'use strict';
// Offline only: never loads api/db, refreshes tokens, connects, or prints secrets.
const fs = require('node:fs');
const path = require('node:path');
const modules = ['bill', 'reconciliation', 'master', 'mapping', 'daily'];
function inspect(env) {
    const checks = [];
    const check = (name, passed) => checks.push({ name, passed: !!passed });
    const project = String(env.BILLING_STORAGE_STAGING_PROJECT || '').trim();
    check('explicit-non-production-staging-project', project && project !== 'billing-pro-e6241');
    let account;
    try { account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT || ''); } catch (_) {}
    check('explicit-matching-staging-firebase-credential', account?.project_id === project && project && account?.client_email && account?.private_key);
    check('firestore-authority', env.BILLING_STORAGE_AUTHORITY === 'firestore');
    check('bounded-transport-enabled', env.BILLING_DRIVE_TRANSPORT === '1');
    const enabled = String(env.BILLING_DRIVE_MODULES || '').split(',').map(s => s.trim()).filter(Boolean);
    check('valid-module-rollout', enabled.length && enabled.every(s => modules.includes(s)));
    const folder = String(env.BILLING_DRIVE_FOLDER_ID || '').trim();
    check('explicit-matching-private-staging-folder', /^[\w-]{10,}$/.test(folder) && folder === env.BILLING_STORAGE_STAGING_FOLDER);
    const oauth = !!(env.GOOGLE_DRIVE_CLIENT_ID && env.GOOGLE_DRIVE_CLIENT_SECRET && env.GOOGLE_DRIVE_REFRESH_TOKEN);
    let serviceAccount = false;
    if (env.GOOGLE_DRIVE_SERVICE_ACCOUNT) {
        try {
            const source = env.GOOGLE_DRIVE_SERVICE_ACCOUNT;
            const value = JSON.parse(source.trim().startsWith('{') ? source : fs.readFileSync(source, 'utf8'));
            serviceAccount = !!(value.client_email && value.private_key);
        } catch (_) {}
    }
    check('explicit-drive-server-credential', oauth || serviceAccount);
    return { mode: 'offline-preflight', readyForExternalCheck: checks.every(c => c.passed),
        networkRequests: 0, databaseWrites: 0, checks,
        remaining: ['Verify private folder access using the real Drive adapter.',
            'Run upload/readback and latest-head restore in isolated staging.',
            'Verify hosted limits and two-device roles before production cutover.'] };
}
module.exports = inspect;
if (require.main === module) {
    try {
        const args = process.argv.slice(2);
        if (args.length && (args.length !== 1 || !args[0].startsWith('--env-file='))) throw Error('Usage: node scripts/storage-preflight.js [--env-file=<private staging env file>]');
        // Explicit file is isolated from inherited production settings; no automatic .env loading.
        const env = args.length ? require('dotenv').parse(fs.readFileSync(path.resolve(args[0].slice(11)))) : process.env;
        const report = inspect(env);
        console.log(JSON.stringify(report, null, 2));
        process.exitCode = report.readyForExternalCheck ? 0 : 2;
    } catch (_) { console.error('Preflight failed: verify the explicit private staging configuration file. No connection was attempted.'); process.exitCode = 1; }
}
