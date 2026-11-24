'use strict';

const crypto = require('node:crypto');
const { canonical } = require('./drive-first-store');
const CHUNK = 256 * 1024;
const UPLOAD_CHUNK = 1024 * 1024;
const TRANSFER_IDLE_MS = 30 * 60 * 1000;
const MAX = 32 * 1024 * 1024;
const MAX_ASSET = 128 * 1024 * 1024;
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = (status, message) => Object.assign(new Error(message), { status });
const allowed = path => /^\/api\/(?:billing|reconciliation|contractor-mapping|storage\/business|daily-progress(?:\/data)?|save-default-(?:activities|pole-schedules)|default-(?:activities|pole-schedules)|bills|dp-admin\/(?:data|report|import|entry-history)|daily-entry\/report\/\d{4}-\d{2}-\d{2}\/save)$/.test(path);

// Transport records contain small ownership, size, hash, offset and expiry fields.
// All business bytes (including temporary transfers) stay in private Drive files.
module.exports = function createTransport({ db, drive, workers, auth, env = process.env, now = Date.now }) {
    const enabled = () => env.BILLING_DRIVE_TRANSPORT === '1';
    const key = id => 'storage_transport_' + id;
    const validId = id => /^[a-f0-9-]{36}$/.test(id || '');
    const read = id => db.atomicDailyRecord(key(id), value => ({ result: value }));
    async function actor(req) {
        delete req.authSession;
        const who = await workers.principal(req);
        return { id: who.id, permissions: sha(JSON.stringify(canonical({ role: who.role, contractorIds: who.contractorIds || [] }))) };
    }
    async function owned(req, id, direction) {
        if (!validId(id)) throw fail(400, 'Invalid transfer identity');
        const [record, who] = await Promise.all([read(id), actor(req)]);
        if (!record || record.expiresAt <= now()) throw fail(410, 'Transfer expired; local pending copy retained');
        if (record.owner !== who.id || record.permissions !== who.permissions || record.direction !== direction) throw fail(403, 'Transfer access denied');
        return record;
    }
    const middleware = async (req, res, next) => {
        const route = req.path;
        const isTransfer = route.startsWith('/api/storage/transport');
        if (!enabled()) return isTransfer ? res.status(404).json({ success: false, error: 'Bounded storage transport is disabled' }) : next();
        try {
            if (isTransfer) {
                if (!drive.configured()) throw fail(503, 'Private Drive transport is not configured');
                res.set('Cache-Control', 'no-store');
                if (route === '/api/storage/transport' && req.method === 'GET') {
                    await actor(req);
                    return res.json({ success: true, chunkBytes: CHUNK, maxBytes: MAX, maxAssetBytes: MAX_ASSET });
                }
                if (route === '/api/storage/transport' && req.method === 'POST') {
                    const body = req.body || {}, who = await actor(req);
                    const asset = body.target === '/api/storage/assets';
                    const chunkBytes = body.chunkBytes === undefined ? CHUNK : body.chunkBytes;
                    if (![CHUNK, UPLOAD_CHUNK].includes(chunkBytes)) throw fail(400, 'Invalid upload chunk size');
                    if ((!allowed(body.target) && !asset) || !Number.isSafeInteger(body.bytes) || body.bytes < 1 || body.bytes > (asset ? MAX_ASSET : MAX) || !/^[a-f0-9]{64}$/.test(body.sha256 || '')) throw fail(400, 'Invalid bounded upload manifest');
                    if (asset) await auth.sessionFor(req);
                    const id = crypto.randomUUID(), fileId = await drive.createId();
                    const name = asset ? String(body.name || 'source.xlsx').replace(/[^\w. -]/g, '_').slice(0, 150) : 'transfer_' + id + '.json';
                    const session = await drive.beginUpload(fileId, name, body.bytes, asset ? 'application/octet-stream' : 'application/json');
                    const record = { direction: 'upload', owner: who.id, permissions: who.permissions, target: body.target,
                        fileId, session, name, chunkBytes, bytes: body.bytes, sha256: body.sha256, offset: 0, expiresAt: now() + TRANSFER_IDLE_MS };
                    await db.atomicDailyRecord(key(id), () => ({ value: record, result: null }));
                    return res.json({ success: true, id, chunkBytes });
                }
                const match = /^\/api\/storage\/transport\/([a-f0-9-]{36})$/.exec(route);
                if (!match) throw fail(404, 'Transfer endpoint not found');
                const id = match[1];
                if (req.method === 'GET') {
                    const record = await owned(req, id, 'download');
                    const offset = Number(req.query.offset);
                    if (!Number.isSafeInteger(offset) || offset < 0 || offset % CHUNK || offset >= record.bytes) throw fail(400, 'Invalid download offset');
                    const bytes = await drive.readRange(record.fileId, offset, Math.min(CHUNK, record.bytes - offset), record.bytes);
                    await db.atomicDailyRecord(key(id), old => {
                        if (!old || old.owner !== record.owner || old.permissions !== record.permissions || old.direction !== 'download') throw fail(410, 'Download transfer changed');
                        return { value: { ...old, expiresAt: now() + TRANSFER_IDLE_MS }, result: null };
                    });
                    return res.json({ success: true, offset, base64: bytes.toString('base64') });
                }
                if (req.method !== 'PUT') throw fail(405, 'Transfer method not supported');
                const record = await owned(req, id, 'upload'), body = req.body || {};
                const chunkBytes = record.chunkBytes || CHUNK;
                if (typeof body.base64 !== 'string' || body.base64.length > Math.ceil(chunkBytes / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.base64)) throw fail(400, 'Invalid bounded upload part');
                const bytes = Buffer.from(body.base64, 'base64'), offset = body.offset;
                if (!Number.isSafeInteger(offset) || offset < 0 || offset % chunkBytes || bytes.length !== Math.min(chunkBytes, record.bytes - offset) || bytes.toString('base64') !== body.base64) throw fail(400, 'Invalid upload part offset or length');
                if (record.complete) return res.json({ success: true, offset: record.bytes, complete: true });
                const operationId = crypto.randomUUID();
                await db.atomicDailyRecord(key(id), old => {
                    if (old?.operation?.until > now()) throw fail(409, 'Transfer part already in progress');
                    if (!old || old.expiresAt <= now()) throw fail(410, 'Transfer expired');
                    return { value: { ...old, expiresAt: now() + TRANSFER_IDLE_MS, operation: { id: operationId, until: now() + 120000 } }, result: null };
                });
                try {
                    // Query Drive after a lost response; never guess whether a part arrived.
                    let progress = await drive.uploadPart(record.session, Buffer.alloc(0), 0, record.bytes);
                    if (!progress.complete && progress.offset === offset) progress = await drive.uploadPart(record.session, bytes, offset, record.bytes);
                    if (progress.offset < offset + bytes.length) throw fail(409, 'Upload offset changed; restart transfer from the pending snapshot');
                    if (progress.complete) {
                        if (progress.id !== record.fileId) throw fail(503, 'Upload identity mismatch');
                        const limits = { maxBytes: record.target === '/api/storage/assets' ? MAX_ASSET : MAX };
                        const verified = await drive.verifyBytes(record.fileId, record.bytes, record.sha256, limits);
                        if (!verified) throw fail(503, 'Upload checksum mismatch');
                    }
                    const currentActor = await actor(req); // Recheck after Drive responds.
                    if (currentActor.id !== record.owner || currentActor.permissions !== record.permissions) throw fail(403, 'Transfer permissions changed');
                    await db.atomicDailyRecord(key(id), old => {
                        if (old?.operation?.id !== operationId) throw fail(409, 'Transfer operation changed');
                        const value = { ...old, offset: progress.offset, complete: progress.complete, expiresAt: now() + TRANSFER_IDLE_MS };
                        delete value.operation;
                        if (progress.complete) delete value.session;
                        return { value, result: null };
                    });
                    return res.json({ success: true, offset: progress.offset, complete: progress.complete });
                } catch (error) {
                    await db.atomicDailyRecord(key(id), old => {
                        if (old?.operation?.id !== operationId) return { result: null };
                        const value = { ...old }; delete value.operation; return { value, result: null };
                    }).catch(() => {});
                    throw error;
                }
            }
            if (route === '/api/storage/assets' && req.method === 'POST') {
                const record = await owned(req, req.body?.uploadId, 'upload');
                const entity = db.storageResource(String(req.body.kind || ''), String(req.body.id || ''));
                const session = await auth.sessionFor(req);
                if ((entity.kind === 'master' || entity.kind === 'mapping') && !(session.adminExpiresAt > now())) throw fail(403, 'Admin verification required');
                if (record.target !== route || !record.complete) throw fail(409, 'Source workbook upload incomplete');
                const id = 'source_' + req.body.uploadId;
                await db.atomicDailyRecord('storage_asset_' + id, old => {
                    if (old && (old.entityKey !== entity.key || old.owner !== record.owner)) throw fail(409, 'Source workbook already linked elsewhere');
                    return { value: old || { entityKey: entity.key, kind: entity.kind, id: entity.id, fileId: record.fileId, owner: record.owner,
                        bytes: record.bytes, sha256: record.sha256, name: record.name, createdAt: now() }, result: null };
                });
                return res.json({ success: true, asset: { id, bytes: record.bytes, sha256: record.sha256, name: record.name } });
            }
            if (req.method === 'POST' && req.body?.__billingUpload) {
                if (Object.keys(req.body).length !== 1 || !allowed(route)) throw fail(400, 'Invalid uploaded request');
                const record = await owned(req, req.body.__billingUpload, 'upload');
                if (!record.complete || record.target !== route) throw fail(409, 'Upload incomplete or route changed');
                const bytes = await drive.readBytes(record.fileId, { maxBytes: MAX });
                if (bytes.length !== record.bytes || sha(bytes) !== record.sha256) throw fail(503, 'Uploaded request checksum mismatch');
                try { req.body = JSON.parse(bytes.toString('utf8')); } catch (_) { throw fail(400, 'Uploaded request is not JSON'); }
                if (!req.body || Array.isArray(req.body) || typeof req.body !== 'object') throw fail(400, 'Uploaded JSON object required');
                req.billingBoundedUpload = true;
                const scope = db.storageContext.getStore();
                if (scope) scope.requestHash = sha(JSON.stringify(canonical(req.body)));
            }
            if (allowed(route)) {
                const json = res.json.bind(res);
                res.json = body => {
                    const bytes = Buffer.from(JSON.stringify(body));
                    if (bytes.length <= 1024 * 1024) return json(body);
                    if (req.get('x-billing-transport') !== '1') {
                        res.status(503);
                        return json({ success: false, error: 'Refresh the application to use the bounded download transport; current data retained' });
                    }
                    // Express handlers do not await res.json. Own the entire async response here.
                    (async () => {
                        if (bytes.length > MAX) throw fail(413, 'Response exceeds bounded transport budget');
                        const who = await actor(req), id = crypto.randomUUID(), fileId = await drive.createId();
                        await drive.writeBytes(fileId, 'response_' + id + '.json', bytes);
                        const verified = await drive.readBytes(fileId, { maxBytes: MAX });
                        if (verified.length !== bytes.length || sha(verified) !== sha(bytes)) throw fail(503, 'Download snapshot checksum mismatch');
                        await db.atomicDailyRecord(key(id), () => ({ value: { direction: 'download', owner: who.id, permissions: who.permissions,
                            fileId, bytes: bytes.length, sha256: sha(bytes), expiresAt: now() + 30 * 60 * 1000 }, result: null }));
                        json({ __billingDownload: { id, bytes: bytes.length, sha256: sha(bytes), chunkBytes: CHUNK } });
                    })().catch(error => { if (!res.headersSent) res.status(error.status || 503); json({ success: false, error: 'Download unavailable; current local data retained' }); });
                    return res;
                };
            }
            return next();
        } catch (error) { return res.status(error.status || 503).json({ success: false, error: error.status ? error.message : 'Storage transport unavailable; pending copy retained' }); }
    };
    return middleware;
};
module.exports.allowed = allowed;
module.exports.CHUNK = CHUNK;
