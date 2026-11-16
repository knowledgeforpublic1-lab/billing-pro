const crypto = require('node:crypto');
const fs = require('node:fs');

// Credentials stay server-side. Each save creates an immutable JSON version.
module.exports = function createDrive({ env = process.env, fetchImpl = fetch } = {}) {
    let cachedToken;
    const folder = () => {
        const id = String(env.DAILY_PROGRESS_DRIVE_FOLDER_ID || '').trim();
        if (!/^[\w-]{10,}$/.test(id)) throw Object.assign(new Error('Daily Progress Drive folder configure karein.'), { status: 503 });
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
    return {
        configured() { return !!env.DAILY_PROGRESS_DRIVE_FOLDER_ID && !!(env.GOOGLE_DRIVE_SERVICE_ACCOUNT || (env.GOOGLE_DRIVE_REFRESH_TOKEN && env.GOOGLE_DRIVE_CLIENT_ID && env.GOOGLE_DRIVE_CLIENT_SECRET)); },
        async check() {
            const data = await request('https://www.googleapis.com/drive/v3/files/' + folder() + '?fields=id,mimeType,capabilities(canAddChildren)&supportsAllDrives=true');
            if (data.mimeType !== 'application/vnd.google-apps.folder' || !data.capabilities?.canAddChildren) throw Object.assign(new Error('Drive folder par write access nahi hai.'), { status: 503 });
            return { ready: true };
        },
        async write(key, report) {
            const boundary = 'daily_' + crypto.randomBytes(18).toString('hex');
            const metadata = { name: key + '_v' + report.version + '_' + crypto.randomUUID() + '.json', parents: [folder()], mimeType: 'application/json' };
            const body = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) +
                '\r\n--' + boundary + '\r\nContent-Type: application/json\r\n\r\n' + JSON.stringify(report) + '\r\n--' + boundary + '--';
            const data = await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id&supportsAllDrives=true', {
                method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body
            });
            if (!data.id) throw Object.assign(new Error('Drive save confirmation missing.'), { status: 503 });
            return data.id;
        },
        async read(id) {
            if (!/^[\w-]+$/.test(id)) throw new Error('Invalid Drive file reference');
            return request('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media&supportsAllDrives=true');
        }
    };
};
