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
    document: { getElementById() { return null; } },
    sessionStorage: { removeItem() {} },
    fetch: async (url, init) => { requests.push({ url, init }); return response; }
};
vm.runInNewContext(fs.readFileSync('js/auth.js', 'utf8'), context);
async function main() {
    let saves = 0;
    let initializes = 0;
    let finishLoading;
    const app = Object.assign({}, context.window.AuthModule, {
        isPortalUnlocked: false, authReady: false, portalPasswordInput: 'not-logged-in',
        saveToStorage() { saves++; }, showToast() {},
        workspaceReady: false, workspaceLoading: false,
        initPortalWatchdog() {}, $nextTick: async () => {},
        initializeWorkspace() { initializes++; return new Promise(resolve => { finishLoading = resolve; }); },
        sessionExpiresAt: 0, adminExpiresAt: 0
    });
    assert.equal(await app.restorePortalSession(), false);
    assert.equal(app.isPortalUnlocked, false, 'A sessionStorage boolean cannot unlock the app');
    assert.equal(app.authReady, true);
    await app.verifyPortalPassword();
    assert.equal(reloads, 0, 'Wrong password keeps portal locked');
    response = { ok: true, status: 200, json: async () => ({ success: true, authenticated: true, serverTime: time, expiresAt: time + 300000, adminExpiresAt: 0 }) };
    const login = app.verifyPortalPassword();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(app.workspaceLoading, true);
    assert.equal(app.workspaceReady, false, 'Workspace stays covered until saved quantities finish loading');
    assert.equal(app.authBusy, true);
    const concurrentLoad = app.preparePortalWorkspace();
    assert.equal(initializes, 1, 'Concurrent entry shares the same initialization');
    finishLoading();
    await Promise.all([login, concurrentLoad]);
    assert.equal(app.workspaceReady, true);
    assert.equal(app.workspaceLoading, false);
    assert.equal(reloads, 0, 'Successful login opens workspace without a reload or second session check');
    assert.equal(requests.filter(r => r.url.endsWith('/session')).length, 1);
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
    app.poleScheduleQuantities = { '907': { 0: { 1: 37 } } };
    await app.verifyPortalPassword();
    assert.equal(initializes, 1, 'Re-login resumes existing workspace instead of loading over unsynced work');
    assert.equal(app.poleScheduleQuantities['907'][0][1], 37);
    app.workspaceReady = false;
    app.initializeWorkspace = async () => { throw new Error('Bill unavailable'); };
    await app.preparePortalWorkspace();
    assert.equal(app.workspaceReady, false, 'Failed initialization never reveals empty defaults');
    assert.equal(app.workspaceLoading, false);
    assert.equal(app._workspacePromise, null, 'Failed loading allows retry');
    app.initializeWorkspace = async () => {};
    await app.preparePortalWorkspace();
    assert.equal(app.workspaceReady, true);
    await app.forgotPortalPassword();
    assert.match(requests.at(-1).url, /forgot-password$/);
    assert.equal(requests.at(-1).init.body, '{}', 'Client cannot choose a different reset destination');
    console.log('Client auth: server-only unlock, expired session handling, countdown, local data preservation and reset request passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
