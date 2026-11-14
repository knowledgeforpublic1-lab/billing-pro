const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let time = 1000000;
let reloads = 0;
let requests = [];
let response = { ok: false, status: 401, json: async () => ({ error: 'Login required' }) };
class Clock extends Date { static now() { return time; } }
const context = {
    window: { location: { reload() { reloads++; } } }, Date: Clock,
    sessionStorage: { removeItem() {} },
    fetch: async (url, init) => { requests.push({ url, init }); return response; }
};
vm.runInNewContext(fs.readFileSync('js/auth.js', 'utf8'), context);
async function main() {
    let saves = 0;
    const app = Object.assign({}, context.window.AuthModule, {
        isPortalUnlocked: false, authReady: false, portalPasswordInput: 'not-logged-in',
        saveToStorage() { saves++; }, showToast() {},
        sessionExpiresAt: 0, adminExpiresAt: 0
    });
    assert.equal(await app.restorePortalSession(), false);
    assert.equal(app.isPortalUnlocked, false, 'A sessionStorage boolean cannot unlock the app');
    assert.equal(app.authReady, true);
    await app.verifyPortalPassword();
    assert.equal(reloads, 0, 'Wrong password keeps portal locked');
    response = { ok: true, status: 200, json: async () => ({ success: true, authenticated: true, serverTime: time, expiresAt: time + 300000, adminExpiresAt: 0 }) };
    await app.verifyPortalPassword();
    assert.equal(reloads, 1);
    assert.equal(app.portalPasswordInput, '');
    const expiry = app.sessionExpiresAt;
    time += 120000;
    app.updateAuthCountdown();
    assert.equal(app.inactivitySecondsLeft, 180, 'Countdown uses the actual deadline');
    app.adminPendingCallback = () => { throw Error('Stale callback must be cleared'); };
    time = expiry + 1;
    app.updateAuthCountdown();
    assert.equal(app.isPortalUnlocked, false);
    assert.equal(app.adminPendingCallback, null);
    assert.equal(saves, 1, 'Idle lock preserves current entries locally first');
    await app.forgotPortalPassword();
    assert.match(requests.at(-1).url, /forgot-password$/);
    assert.equal(requests.at(-1).init.body, '{}', 'Client cannot choose a different reset destination');
    console.log('Client auth: server-only unlock, expired session handling, countdown, local data preservation and reset request passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
