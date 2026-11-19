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
test('Billing snapshots upload with resumable byte ranges and preallocated immutable identity', async () => {
    const calls = [], bytes = Buffer.alloc(2300000, 7);
    const drive = createDrive({ folderEnv: 'BILLING_DRIVE_FOLDER_ID', env: { BILLING_DRIVE_FOLDER_ID: 'folder_12345678', GOOGLE_DRIVE_CLIENT_ID: 'c', GOOGLE_DRIVE_CLIENT_SECRET: 's', GOOGLE_DRIVE_REFRESH_TOKEN: 'r' },
        fetchImpl: async (url, init) => {
            calls.push({ url, init });
            if (url.includes('/token')) return { ok: true, json: async () => ({ access_token: 'private' }) };
            if (!init.method) return { ok: true, json: async () => ({ mimeType: 'application/vnd.google-apps.folder', capabilities: { canAddChildren: true } }) };
            if (init.method === 'POST') return { ok: true, headers: new Headers({ location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=test' }) };
            const range = /bytes (\d+)-(\d+)\/(\d+)/.exec(init.headers['Content-Range']);
            const end = Number(range[2]), total = Number(range[3]);
            return end + 1 === total ? { ok: true, status: 200, json: async () => ({ id: 'immutable_id' }) } : { ok: false, status: 308, headers: new Headers({ range: 'bytes=0-' + end }) };
        } });
    await drive.writeBytes('immutable_id', 'snapshot.json', bytes);
    const parts = calls.filter(call => call.init.method === 'PUT');
    assert.equal(parts.length, 3); assert.deepEqual(Buffer.concat(parts.map(part => part.init.body)), bytes);
    assert.ok(parts.slice(0, -1).every(part => part.init.body.length % (256 * 1024) === 0));
    assert.ok(calls.find(call => call.url.includes('/upload/') && call.init.method === 'POST').init.body.includes('immutable_id'));
});
test('resumable session URLs cannot redirect server credentials to another host', async () => {
    const drive = createDrive({ env: {} });
    await assert.rejects(drive.uploadPart('https://attacker.example/upload/drive/file', Buffer.from('x'), 0, 1), /Invalid resumable upload session/);
});
test('Billing folder checks reject public sharing and service-account My Drive ownership', async () => {
    const base = { BILLING_DRIVE_FOLDER_ID: 'folder_12345678', GOOGLE_DRIVE_CLIENT_ID: 'c', GOOGLE_DRIVE_CLIENT_SECRET: 's', GOOGLE_DRIVE_REFRESH_TOKEN: 'r' };
    const publicFolder = createDrive({ folderEnv: 'BILLING_DRIVE_FOLDER_ID', env: base, fetchImpl: async url => ({ ok: true, json: async () => url.includes('/token') ? { access_token: 'private' } : url.includes('/permissions') ? { permissions: [{ type: 'anyone' }] } : { mimeType: 'application/vnd.google-apps.folder', capabilities: { canAddChildren: true } } }) });
    await assert.rejects(publicFolder.check(), /must not allow public/);
    const privateKey = require('node:crypto').generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ format: 'pem', type: 'pkcs8' });
    const serviceAccount = createDrive({ folderEnv: 'BILLING_DRIVE_FOLDER_ID', env: { BILLING_DRIVE_FOLDER_ID: base.BILLING_DRIVE_FOLDER_ID,
        GOOGLE_DRIVE_SERVICE_ACCOUNT: JSON.stringify({ client_email: 'test@example.invalid', private_key: privateKey }) },
        fetchImpl: async url => ({ ok: true, json: async () => url.includes('/token') ? { access_token: 'private' } : { mimeType: 'application/vnd.google-apps.folder', capabilities: { canAddChildren: true } } }) });
    await assert.rejects(serviceAccount.check(), /requires a Shared Drive folder/);
});
