'use strict';
// Reuses the tested loopback PKCE/cookie flow; never changes hosted settings.
const { start } = require('./connect-drive-staging');
function validate(client, env) {
    let account;
    try { account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT || '{}'); } catch (_) {}
    if (client?.project_id !== 'billing-pro-e6241' || account?.project_id !== client.project_id ||
        env.BILLING_STORAGE_AUTHORITY !== 'firestore' || env.BILLING_STORAGE_STAGING_PROJECT || env.BILLING_STORAGE_STAGING_FOLDER ||
        !client.redirect_uris?.includes('http://127.0.0.1:53682/oauth2callback') || !client.client_secret ||
        !/^[\w-]+\.apps\.googleusercontent\.com$/.test(client.client_id || '')) throw Error('Matching production OAuth client, explicit Firebase authority and local callback required');
    if (env.GOOGLE_DRIVE_REFRESH_TOKEN) throw Error('Production OAuth is already configured; existing credentials retained');
}
module.exports = { validate };
if (require.main === module) {
    const [clientFile, envFile] = process.argv.slice(2);
    if (!clientFile || !envFile) { console.error('Supply production client JSON and private production env file paths'); process.exitCode = 1; }
    else start({ clientFile, envFile, validateSetup: validate, label: 'production' }).catch(() => {
        console.error('Production Drive OAuth setup could not start; verify private configuration and local callback port'); process.exitCode = 1;
    });
}
