const crypto = require('node:crypto');
const fs = require('node:fs');

const driveReadCache = new Map();

// Credentials stay server-side. Each save creates an immutable JSON version.
module.exports = function createDrive({ env = process.env, fetchImpl = fetch, folderEnv = 'DAILY_PROGRESS_DRIVE_FOLDER_ID' } = {}) {
    let cachedToken;
    let folderCheckedUntil = 0;
    const folderId = () => env[folderEnv] || (folderEnv === 'DAILY_PROGRESS_DRIVE_FOLDER_ID' && String(env.BILLING_DRIVE_MODULES || '').split(',').map(s => s.trim()).includes('daily') ? env.BILLING_DRIVE_FOLDER_ID : '');
    const folder = () => {
        const id = String(folderId() || '').trim();
        if (!/^[\w-]{10,}$/.test(id)) throw Object.assign(new Error('Daily Progress Drive folder configure karein.'), { status: 503 });
        if (env.BILLING_STORAGE_STAGING_PROJECT && (!env.BILLING_STORAGE_STAGING_FOLDER || id !== env.BILLING_STORAGE_STAGING_FOLDER)) throw Object.assign(new Error('Staging Drive folder mismatch; upload/read blocked'), { status: 503 });
        return id;
    };
    async function token() {
        if (cachedToken && cachedToken.until > Date.now() + 60000) return cachedToken.value;
        let body;
        if (env.GOOGLE_DRIVE_REFRESH_TOKEN && env.GOOGLE_DRIVE_CLIENT_ID && env.GOOGLE_DRIVE_CLIENT_SECRET) {
            body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: env.GOOGLE_DRIVE_REFRESH_TOKEN,
                client_id: env.GOOGLE_DRIVE_CLIENT_ID, client_secret: env.GOOGLE_DRIVE_CLIENT_SECRET });
        } else {
            let raw = env.GOOGLE_DRIVE_SERVICE_ACCOUNT || '';
            if (!raw) throw Object.assign(new Error('Google Drive server credentials configure karein.'), { status: 503 });
            if (!raw.trim().startsWith('{')) raw = fs.readFileSync(raw, 'utf8');
            const account = JSON.parse(raw);
            const now = Math.floor(Date.now() / 1000);
            const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
            const unsigned = encode({ alg: 'RS256', typ: 'JWT' }) + '.' + encode({
                iss: account.client_email, scope: 'https://www.googleapis.com/auth/drive.file',
                aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600
            });
            const assertion = unsigned + '.' + crypto.sign('RSA-SHA256', Buffer.from(unsigned), account.private_key).toString('base64url');
            body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion });
        }
        const response = await fetchImpl('https://oauth2.googleapis.com/token', {
            method: 'POST', body, signal: AbortSignal.timeout(15000)
        });
        const data = await response.json();
        if (!response.ok || !data.access_token) throw Object.assign(new Error('Google Drive authentication failed.'), { status: 503 });
        cachedToken = { value: data.access_token, until: Date.now() + Number(data.expires_in || 3600) * 1000 };
        return cachedToken.value;
    }
    async function request(url, init = {}) {
        folder();
        const response = await fetchImpl(url, { ...init, headers: { ...init.headers, Authorization: 'Bearer ' + await token() }, signal: AbortSignal.timeout(25000) });
        if (!response.ok) throw Object.assign(new Error('Google Drive read/save failed. Data pending hai; retry karein.'), { status: 503 });
        return response.json();
    }
    function sessionUrl(url) {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' || parsed.hostname !== 'www.googleapis.com' || !parsed.pathname.startsWith('/upload/drive/')) throw new Error('Invalid resumable upload session');
        return parsed.href;
    }
    async function checkFolder() {
        const data = await request('https://www.googleapis.com/drive/v3/files/' + folder() + '?fields=id,driveId,mimeType,capabilities(canAddChildren)&supportsAllDrives=true');
        if (data.mimeType !== 'application/vnd.google-apps.folder' || !data.capabilities?.canAddChildren) throw Object.assign(new Error('Drive folder par write access nahi hai.'), { status: 503 });
        if ((folderEnv === 'BILLING_DRIVE_FOLDER_ID' || !env[folderEnv]) && env.GOOGLE_DRIVE_SERVICE_ACCOUNT && !env.GOOGLE_DRIVE_REFRESH_TOKEN && !data.driveId) throw Object.assign(new Error('Service-account storage requires a Shared Drive folder; My Drive requires user OAuth'), { status: 503 });
        if (folderEnv === 'BILLING_DRIVE_FOLDER_ID' || !env[folderEnv]) {
            let pageToken, pages = 0;
            do {
                const query = new URLSearchParams({ fields: 'nextPageToken,permissions(type,role)', pageSize: '100', supportsAllDrives: 'true', ...(pageToken ? { pageToken } : {}) });
                const access = await request('https://www.googleapis.com/drive/v3/files/' + folder() + '/permissions?' + query);
                if ((access.permissions || []).some(permission => permission.type === 'anyone')) throw Object.assign(new Error('Billing storage folder must not allow public/anyone access'), { status: 503 });
                pageToken = access.nextPageToken;
                if (++pages > 100) throw Object.assign(new Error('Drive folder privacy could not be verified'), { status: 503 });
            } while (pageToken);
        }
        folderCheckedUntil = Date.now() + 300000;
        return { ready: true };
    }
    async function beginUpload(id, name, size, mimeType = 'application/json') {
        if (!/^[\w-]+$/.test(id) || !Number.isSafeInteger(size) || size < 1) throw new Error('Invalid upload metadata');
        if (folderCheckedUntil <= Date.now()) await checkFolder();
        const response = await fetchImpl('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id&supportsAllDrives=true', {
            method: 'POST', headers: { Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json', 'X-Upload-Content-Type': mimeType, 'X-Upload-Content-Length': String(size) },
            body: JSON.stringify({ id, name, parents: [folder()], mimeType, appProperties: { billingStorage: 'v1' } }), signal: AbortSignal.timeout(25000)
        });
        if (!response.ok || !response.headers.get('location')) throw Object.assign(new Error('Drive upload session unavailable'), { status: 503 });
        return sessionUrl(response.headers.get('location'));
    }
    async function uploadPart(url, bytes, offset, total) {
        const response = await fetchImpl(sessionUrl(url), { method: 'PUT', headers: { Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/octet-stream',
            'Content-Range': bytes.length ? `bytes ${offset}-${offset + bytes.length - 1}/${total}` : `bytes */${total}` }, body: bytes,
            signal: AbortSignal.timeout(25000) });
        if (response.status === 308) {
            const range = response.headers.get('range');
            if (range && !/^bytes=0-\d+$/.test(range)) throw Object.assign(new Error('Invalid Drive upload acknowledgment'), { status: 503 });
            return { offset: range ? Number(range.split('-')[1]) + 1 : 0, complete: false };
        }
        if (!response.ok) throw Object.assign(new Error('Drive upload incomplete; retain pending copy'), { status: 503 });
        const file = await response.json();
        if (!file.id) throw Object.assign(new Error('Drive upload confirmation missing'), { status: 503 });
        return { offset: total, complete: true, id: file.id };
    }
    return {
        beginUpload, uploadPart,
        async verifyBytes(id, bytes, sha256, { maxBytes = 32 * 1024 * 1024 } = {}) {
            if (!/^[\w-]+$/.test(id) || !Number.isSafeInteger(bytes) || bytes < 1 || bytes > maxBytes || !/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Invalid file verification');
            // Drive computes this checksum from stored content. Avoid downloading a large
            // source workbook again inside the final chunk request's timeout budget.
            const file = await request('https://www.googleapis.com/drive/v3/files/' + id + '?fields=id,size,sha256Checksum&supportsAllDrives=true');
            if (file.id !== id || Number(file.size) !== bytes) return false;
            if (file.sha256Checksum) return file.sha256Checksum === sha256;
            // Older files may have no checksum metadata; never skip verification.
            const content = await this.readBytes(id, { maxBytes });
            return content.length === bytes && crypto.createHash('sha256').update(content).digest('hex') === sha256;
        },
        configured() { return !!folderId() && !!(env.GOOGLE_DRIVE_SERVICE_ACCOUNT || (env.GOOGLE_DRIVE_REFRESH_TOKEN && env.GOOGLE_DRIVE_CLIENT_ID && env.GOOGLE_DRIVE_CLIENT_SECRET)); },
        async createId() {
            const data = await request('https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive&type=files');
            if (!data.ids?.[0]) throw Object.assign(new Error('Drive file identity missing'), { status: 503 });
            return data.ids[0];
        },
        async writeBytes(id, name, bytes) {
            const url = await beginUpload(id, name, bytes.length);
            let offset = 0, result;
            while (offset < bytes.length) {
                const part = bytes.subarray(offset, offset + 1024 * 1024);
                result = await uploadPart(url, part, offset, bytes.length);
                if (result.offset !== offset + part.length) throw Object.assign(new Error('Drive upload offset mismatch'), { status: 503 });
                offset = result.offset;
            }
            if (!result?.complete || result.id !== id) throw Object.assign(new Error('Drive file identity confirmation mismatch'), { status: 503 });
            return id;
        },
        async readRange(id, offset, length, total) {
            if (!/^[\w-]+$/.test(id) || !Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 1 || length > 256 * 1024 || offset + length > total) throw new Error('Invalid bounded download');
            folder();
            const response = await fetchImpl('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media&supportsAllDrives=true', {
                headers: { Authorization: 'Bearer ' + await token(), Range: `bytes=${offset}-${offset + length - 1}` }, signal: AbortSignal.timeout(25000)
            });
            if (response.status !== 206 || response.headers.get('content-range') !== `bytes ${offset}-${offset + length - 1}/${total}`) throw Object.assign(new Error('Drive bounded download was not honored'), { status: 503 });
            const bytes = Buffer.from(await response.arrayBuffer());
            if (bytes.length !== length) throw Object.assign(new Error('Drive download length mismatch'), { status: 503 });
            return bytes;
        },
        async readBytes(id, { maxBytes = 32 * 1024 * 1024 } = {}) {
            if (!/^[\w-]+$/.test(id)) throw new Error('Invalid Drive file reference');
            folder();
            const response = await fetchImpl('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media&supportsAllDrives=true', {
                headers: { Authorization: 'Bearer ' + await token() }, signal: AbortSignal.timeout(25000)
            });
            if (!response.ok) throw Object.assign(new Error('Drive snapshot read failed; pending data retained'), { status: 503 });
            if (Number(response.headers?.get('content-length') || 0) > maxBytes) throw Object.assign(new Error('Drive snapshot exceeds size limit'), { status: 413 });
            const chunks = []; let total = 0;
            if (response.body?.getReader) {
                const reader = response.body.getReader();
                try {
                    while (true) {
                        const part = await reader.read(); if (part.done) break;
                        total += part.value.byteLength;
                        if (total > maxBytes) { await reader.cancel(); throw Object.assign(new Error('Drive snapshot exceeds size limit'), { status: 413 }); }
                        chunks.push(Buffer.from(part.value));
                    }
                } finally { reader.releaseLock(); }
            } else {
                const bytes = Buffer.from(await response.arrayBuffer());
                if (bytes.length > maxBytes) throw Object.assign(new Error('Drive snapshot exceeds size limit'), { status: 413 });
                chunks.push(bytes);
            }
            return Buffer.concat(chunks);
        },
        check: checkFolder,
        async write(key, report) {
            const boundary = 'daily_' + crypto.randomBytes(18).toString('hex');
            const metadata = { name: key + '_v' + report.version + '_' + crypto.randomUUID() + '.json', parents: [folder()], mimeType: 'application/json' };
            const body = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) +
                '\r\n--' + boundary + '\r\nContent-Type: application/json\r\n\r\n' + JSON.stringify(report) + '\r\n--' + boundary + '--';
            const data = await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id&supportsAllDrives=true', {
                method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body
            });
            if (!data.id) throw Object.assign(new Error('Drive save confirmation missing.'), { status: 503 });
            driveReadCache.set(data.id, report);
            return data.id;
        },
        async read(id) {
            if (!/^[\w-]+$/.test(id)) throw new Error('Invalid Drive file reference');
            if (driveReadCache.has(id)) return driveReadCache.get(id);
            const data = await request('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media&supportsAllDrives=true');
            if (driveReadCache.size > 2000) {
                const firstKey = driveReadCache.keys().next().value;
                driveReadCache.delete(firstKey);
            }
            driveReadCache.set(id, data);
            return data;
        }
    };
};
