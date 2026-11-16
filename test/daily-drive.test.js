const test = require('node:test');
const assert = require('node:assert/strict');
const createDrive = require('../api/daily-drive');
test('Drive credentials are server-only; uploads are separate immutable versions in selected folder', async () => {
    const calls = [];
    const drive = createDrive({ env: { DAILY_PROGRESS_DRIVE_FOLDER_ID: 'private_folder_123', GOOGLE_DRIVE_CLIENT_ID: 'client', GOOGLE_DRIVE_CLIENT_SECRET: 'secret', GOOGLE_DRIVE_REFRESH_TOKEN: 'refresh' },
        fetchImpl: async (url, init) => {
            calls.push({ url, init });
            if (url.includes('/token')) return { ok: true, json: async () => ({ access_token: 'test-private-token', expires_in: 3600 }) };
            if (url.includes('/upload/')) return { ok: true, json: async () => ({ id: 'saved_file_' + calls.length }) };
            return { ok: true, json: async () => ({ mimeType: 'application/vnd.google-apps.folder', capabilities: { canAddChildren: true } }) };
        } });
    assert.equal((await drive.check()).ready, true);
    const first = await drive.write('report', { version: 1, quantities: { 15: 3 } });
    const second = await drive.write('report', { version: 2, quantities: { 15: 5 } });
    assert.notEqual(first, second);
    assert.equal(calls.filter(c => c.url.includes('/token')).length, 1, 'Access token cached server-side');
    for (const call of calls.filter(c => c.url.includes('/upload/'))) {
        assert.equal(call.init.method, 'POST'); assert.match(call.url, /supportsAllDrives=true/);
        assert.ok(call.init.body.includes('private_folder_123')); assert.ok(!call.init.body.includes('refresh'));
    }
});
test('missing Drive configuration and rejected uploads never claim success', async () => {
    const absent = createDrive({ env: {} });
    assert.equal(absent.configured(), false);
    await assert.rejects(absent.write('x', {}), { status: 503 });
    const drive = createDrive({ env: { DAILY_PROGRESS_DRIVE_FOLDER_ID: 'folder_12345678', GOOGLE_DRIVE_CLIENT_ID: 'c', GOOGLE_DRIVE_CLIENT_SECRET: 's', GOOGLE_DRIVE_REFRESH_TOKEN: 'r' }, fetchImpl: async url => ({ ok: url.includes('/token'), json: async () => ({ access_token: 't' }) }) });
    await assert.rejects(drive.write('x', {}), { status: 503 });
});
