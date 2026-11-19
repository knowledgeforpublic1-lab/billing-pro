'use strict';

// Read-only, point-in-time Firestore export. No database write or restore commands.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { initializeApp, cert, deleteApp } = require('firebase-admin/app');

async function exportSnapshot({ projectId, readTime, request, onDocument = () => {} }) {
    const base = `projects/${projectId}/databases/(default)/documents`;
    const seen = new Set();
    const collections = [];
    async function visit(parent) {
        let pageToken;
        do {
            const result = await request(parent + ':listCollectionIds', {
                method: 'POST', body: { pageSize: 100, readTime, ...(pageToken ? { pageToken } : {}) }
            });
            for (const id of result.collectionIds || []) {
                const collection = parent + '/' + encodeURIComponent(id);
                let next, count = 0, missing = 0;
                const children = [];
                do {
                    const query = new URLSearchParams({ pageSize: '100', readTime, showMissing: 'true', ...(next ? { pageToken: next } : {}) });
                    const batch = await request(collection + '?' + query, { method: 'GET' });
                    for (const document of batch.documents || []) {
                        if (!document.name || !document.name.startsWith(base + '/') || seen.has(document.name)) throw new Error('Invalid or duplicate document in export');
                        seen.add(document.name);
                        if (!document.updateTime) missing++; else count++;
                        await onDocument(document);
                        children.push(document.name);
                    }
                    next = batch.nextPageToken;
                } while (next);
                collections.push({ path: collection.slice(base.length + 1), documents: count, missingParents: missing });
                for (const child of children) await visit(child);
            }
            pageToken = result.nextPageToken;
        } while (pageToken);
    }
    await visit(base);
    return { projectId, readTime, documents: seen.size, collections };
}

async function main() {
    const args = Object.fromEntries(process.argv.slice(2).map(v => { const i = v.indexOf('='); return [v.slice(0, i), v.slice(i + 1)]; }));
    if (!args['--credential'] || !args['--project'] || !args['--output']) throw new Error('Use --credential=FILE --project=ID --output=DIRECTORY');
    const credential = JSON.parse(fs.readFileSync(args['--credential'], 'utf8'));
    if (credential.project_id !== args['--project']) throw new Error('Credential project does not match the explicitly selected project');
    const output = path.resolve(args['--output']);
    fs.mkdirSync(output, { recursive: true });
    const archivePath = path.join(output, 'documents.ndjson');
    const descriptor = fs.openSync(archivePath, 'wx', 0o600);
    const app = initializeApp({ credential: cert(credential), projectId: credential.project_id }, 'read-only-live-backup');
    const readTime = new Date(Date.now() - 5000).toISOString();
    const hash = crypto.createHash('sha256');
    let bytes = 0;
    async function request(resource, options) {
        if (options.method !== 'GET' && !(options.method === 'POST' && resource.endsWith(':listCollectionIds'))) throw new Error('Non-read operation rejected');
        const token = await app.options.credential.getAccessToken();
        for (let attempt = 0; attempt < 4; attempt++) {
            const response = await fetch('https://firestore.googleapis.com/v1/' + resource, {
                method: options.method, headers: { Authorization: 'Bearer ' + token.access_token, 'Content-Type': 'application/json' },
                ...(options.body ? { body: JSON.stringify(options.body) } : {}), signal: AbortSignal.timeout(30000)
            });
            const result = await response.json();
            if (response.ok) return result;
            if ((response.status === 429 || response.status >= 500) && attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt)); continue;
            }
            throw new Error('Firestore read failed: HTTP ' + response.status + ' ' + (result.error?.status || ''));
        }
    }
    try {
        const manifest = await exportSnapshot({ projectId: credential.project_id, readTime, request, onDocument(document) {
            const line = Buffer.from(JSON.stringify(document) + '\n'); fs.writeSync(descriptor, line); hash.update(line); bytes += line.length;
        } });
        fs.fsyncSync(descriptor); fs.closeSync(descriptor);
        const digest = hash.digest('hex');
        const written = fs.readFileSync(archivePath);
        if (crypto.createHash('sha256').update(written).digest('hex') !== digest) throw new Error('Backup checksum mismatch');
        const rows = written.toString('utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
        if (rows.length !== manifest.documents) throw new Error('Backup count mismatch');
        fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({ ...manifest, format: 'firestore-rest-document-v1', bytes, sha256: digest, verified: true, createdAt: new Date().toISOString(), databaseWrites: 0 }, null, 2), { mode: 0o600 });
        console.log(JSON.stringify({ verified: true, projectId: manifest.projectId, readTime, documents: manifest.documents, collectionPaths: manifest.collections.length, bytes, databaseWrites: 0 }));
    } finally { try { fs.closeSync(descriptor); } catch (_) {} await deleteApp(app); }
}
module.exports = { exportSnapshot };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
