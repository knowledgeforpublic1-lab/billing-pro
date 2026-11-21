'use strict';
// Local, one-time user OAuth. No production config, DB connection or folder writes.
const fs = require('node:fs');
const http = require('node:http');
const crypto = require('node:crypto');
const { OAuth2Client } = require('google-auth-library');
const redirect = 'http://127.0.0.1:53682/oauth2callback';
const scope = 'https://www.googleapis.com/auth/drive.file';
function validate(client, env) {
    if (!client || client.project_id !== 'billing-pro-staging-ba9a8' ||
        env.BILLING_STORAGE_STAGING_PROJECT !== client.project_id ||
        JSON.parse(env.FIREBASE_SERVICE_ACCOUNT || '{}').project_id !== client.project_id ||
        !client.redirect_uris?.includes(redirect) || !client.client_secret ||
        !/^[\w-]+\.apps\.googleusercontent\.com$/.test(client.client_id || '')) throw Error('Explicit matching staging OAuth client and Firebase credential required');
    if (env.GOOGLE_DRIVE_REFRESH_TOKEN) throw Error('Staging OAuth is already configured; existing credentials were retained');
}
function patchPrivateEnv(original, values) {
    let next = original;
    for (const [key, value] of Object.entries(values)) {
        if (!/^[A-Z_]+$/.test(key) || typeof value !== 'string' || /['\r\n]/.test(value)) throw Error('Invalid credential format');
        const line = key + "='" + value + "'";
        const pattern = new RegExp('^' + key + '=.*$', 'm');
        next = pattern.test(next) ? next.replace(pattern, () => line) : next.replace(/\s*$/, '') + '\n' + line + '\n';
    }
    return next;
}
function matchesState(expected, actual) {
    return typeof actual === 'string' && Buffer.byteLength(actual) === Buffer.byteLength(expected) &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}
async function start({ clientFile, envFile = '.env.drive-staging.local', validateSetup = validate, label = 'staging' }) {
    if (!['staging', 'production'].includes(label)) throw Error('Unknown OAuth setup environment');
    const client = JSON.parse(fs.readFileSync(clientFile, 'utf8')).web;
    const original = fs.readFileSync(envFile, 'utf8');
    validateSetup(client, require('dotenv').parse(original));
    const oauth = new OAuth2Client(client.client_id, client.client_secret, redirect);
    const verifier = await oauth.generateCodeVerifierAsync();
    let state, cookie, active = false, busy = false;
    const server = http.createServer(async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('Content-Security-Policy', "default-src 'none'; base-uri 'none'; frame-ancestors 'none'");
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        const reply = (status, text) => { res.writeHead(status); res.end(text); };
        if (req.headers.host !== '127.0.0.1:53682' || req.method !== 'GET' || req.url.length > 16384) return reply(400, 'Invalid local request');
        const url = new URL(req.url, redirect);
        if (url.pathname === '/connect') {
            if (busy) return reply(409, 'Authorization is being completed.');
            state = crypto.randomBytes(32).toString('hex'); cookie = crypto.randomBytes(32).toString('hex'); active = true;
            const target = oauth.generateAuthUrl({ access_type: 'offline', prompt: 'consent select_account', scope: [scope],
                state, code_challenge: verifier.codeChallenge, code_challenge_method: 'S256', include_granted_scopes: false });
            res.setHeader('Set-Cookie', 'billing_drive_setup=' + cookie + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=900');
            res.writeHead(302, { Location: target }); res.end(); return;
        }
        if (url.pathname !== '/oauth2callback') return reply(404, 'Open /connect to start ' + label + ' Drive authorization.');
        const actualCookie = /(?:^|;\s*)billing_drive_setup=([\w-]+)/.exec(req.headers.cookie || '')?.[1];
        if (!active || busy || !matchesState(state, url.searchParams.get('state')) || !matchesState(cookie, actualCookie)) return reply(403, 'Invalid or expired login. Open /connect again.');
        active = false; busy = true;
        if (url.searchParams.has('error')) { busy = false; return reply(400, 'Google authorization was not completed. No credentials changed. Open /connect to retry.'); }
        try {
            const code = url.searchParams.get('code');
            if (!code) throw Error('Missing code');
            const { tokens } = await oauth.getToken({ code, codeVerifier: verifier.codeVerifier, redirect_uri: redirect });
            if (!tokens.refresh_token || !(tokens.scope || '').split(' ').includes(scope)) throw Error('Offline Drive access was not granted');
            if (fs.readFileSync(envFile, 'utf8') !== original) throw Error('Configuration changed during login');
            const updated = patchPrivateEnv(original, { GOOGLE_DRIVE_CLIENT_ID: client.client_id,
                GOOGLE_DRIVE_CLIENT_SECRET: client.client_secret, GOOGLE_DRIVE_REFRESH_TOKEN: tokens.refresh_token });
            const temporary = envFile + '.oauth-tmp';
            fs.writeFileSync(temporary, updated, { flag: 'wx', mode: 0o600 });
            fs.renameSync(temporary, envFile);
            reply(200, 'Drive ' + label + ' authorization saved locally. You can close this tab and return to Codex. No hosted settings or business data changed.');
            console.log('Drive ' + label + ' OAuth saved in ignored private configuration. No token values logged.');
            server.close(); clearTimeout(expiry);
        } catch (_) {
            busy = false;
            reply(502, 'Authorization could not be saved. Return to Codex. No production settings changed.');
            console.error('Staging authorization failed; secret details withheld.');
        }
    });
    const expiry = setTimeout(() => { console.log('Local staging authorization window expired.'); server.close(); }, 15 * 60 * 1000);
    expiry.unref();
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(53682, '127.0.0.1', resolve); });
    console.log('Open http://127.0.0.1:53682/connect and choose the Google account that owns the Drive folder.');
    return server;
}
module.exports = { validate, patchPrivateEnv, matchesState, start };
if (require.main === module) {
    const clientFile = process.argv[2];
    if (!clientFile) { console.error('Supply the downloaded staging OAuth client JSON file path.'); process.exitCode = 1; }
    else start({ clientFile }).catch(() => { console.error('Local staging OAuth setup could not start. Verify client/configuration files and callback port.'); process.exitCode = 1; });
}
