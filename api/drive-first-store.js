'use strict';

const crypto = require('node:crypto');
const failure = (status, message) => Object.assign(new Error(message), { status });
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
        if (value instanceof Date) return value.toISOString();
        return Object.fromEntries(Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => [k, canonical(value[k])]));
    }
    return value;
}
function resource(kind, id) {
    if (!['bill', 'reconciliation', 'master', 'mapping', 'daily'].includes(kind) || typeof id !== 'string' || !id || id.length > 500 || /[\x00-\x1f]/.test(id)) throw failure(400, 'Invalid storage resource');
    return { kind, id, key: sha(kind + '\0' + id) };
}
function configuredModules(env) {
    const names = String(env.BILLING_DRIVE_MODULES || '').split(',').map(s => s.trim()).filter(Boolean);
    const allowed = new Set(['bill', 'reconciliation', 'master', 'mapping', 'daily']);
    if (names.some(name => !allowed.has(name))) throw new Error('Invalid BILLING_DRIVE_MODULES value');
    return new Set(names);
}

// No Drive side effects occur inside repository transactions. The repository owns
// revision/epoch checks and expiring operation fences; Drive objects are immutable.
module.exports = function createStore({ repository, drive, env = process.env, now = Date.now, authorize = async () => {} }) {
    const modules = configuredModules(env);
    const limit = Number(env.BILLING_DRIVE_MAX_BYTES || 32 * 1024 * 1024);
    if (!Number.isSafeInteger(limit) || limit < 1024 || limit > 128 * 1024 * 1024) throw new Error('Invalid BILLING_DRIVE_MAX_BYTES');
    const leaseMs = 5 * 60 * 1000;
    const enabled = kind => modules.has(kind);
    async function read(kind, id) {
        const entity = resource(kind, id);
        const state = await repository.read(entity);
        if (state.head?.deleted) return { data: null, version: state.head.version, mode: 'deleted', head: state.head };
        if (state.head?.mode !== 'drive') return { data: state.legacy, version: state.version, mode: 'legacy', stamp: state.stamp };
        const head = state.head;
        if (head.schemaVersion !== 1 || !head.fileId || !Number.isSafeInteger(head.bytes) || head.bytes < 1 || head.bytes > limit) throw failure(503, 'Stored Drive reference is invalid');
        const bytes = await drive.readBytes(head.fileId, { maxBytes: limit });
        if (bytes.length !== head.bytes || sha(bytes) !== head.sha256) throw failure(503, 'Drive checksum verification failed; current data was not substituted');
        let envelope;
        try { envelope = JSON.parse(bytes.toString('utf8')); } catch (_) { throw failure(503, 'Drive snapshot is not valid JSON'); }
        if (envelope.schemaVersion !== 1 || envelope.kind !== kind || envelope.id !== id || envelope.version !== (head.fileVersion || head.version)) throw failure(503, 'Drive snapshot identity/version mismatch');
        const data = kind === 'daily' && head.coordination ? { ...envelope.data, value: { ...envelope.data.value, ...head.coordination } } : envelope.data;
        return { data, version: head.version, mode: 'drive', head };
    }
    async function save(kind, id, data, { expectedVersion, expectedStamp, requestId, requestHash, summary = {} } = {}) {
        const entity = resource(kind, id);
        await authorize(entity, 'write');
        const state = await repository.read(entity);
        if (state.head?.deleted) throw failure(409, 'Record was deleted; refresh before creating another record');
        if (!enabled(kind) && state.head?.mode !== 'drive') throw failure(503, 'Drive storage is not enabled for this module');
        if (!drive.configured()) throw failure(503, 'Configure the private Billing Drive folder and server credentials before enabling this module');
        if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw failure(409, 'Refresh required: storage revision is missing');
        const digest = requestHash || sha(JSON.stringify(canonical(data)));
        if (!/^[\w-]{16,100}$/.test(requestId || '')) throw failure(400, 'A stable save request ID is required');
        if (state.head?.lastRequestId === requestId) {
            if (state.head.lastDigest !== digest) throw failure(409, 'Request ID was reused with different data');
            return { version: state.head.version, alreadySaved: true };
        }
        const operationId = crypto.randomUUID();
        const reserved = await repository.reserve(entity, { expectedVersion, expectedStamp, operationId, requestId, digest, until: now() + leaseMs, now: now() });
        if (reserved.alreadySaved) return reserved;
        let payload = data, coordination;
        if (kind === 'daily' && data?.value) {
            const small = new Set(['contractorId', 'date', 'locationId', 'locationName', 'state', 'version', 'epoch', 'owner', 'leaseOwner', 'leaseUntil', 'operation', 'lastRequestId', 'lastOwner', 'lastDigest', 'savedAt', 'savedBy', 'sharedDigest', 'deleted', 'managed', 'fileId', 'updatedAt']);
            coordination = Object.fromEntries(Object.entries(data.value).filter(([key]) => small.has(key)));
            payload = { ...data, value: Object.fromEntries(Object.entries(data.value).filter(([key]) => !small.has(key))) };
        }
        const payloadDigest = sha(JSON.stringify(canonical(payload)));
        const reuse = state.head?.mode === 'drive' && state.head.payloadDigest === payloadDigest;
        const fileVersion = reuse ? state.head.fileVersion || state.head.version : reserved.version;
        const previous = state.head?.mode === 'drive' ? { fileId: state.head.fileId, version: state.head.version,
            fileVersion: state.head.fileVersion || state.head.version, bytes: state.head.bytes, sha256: state.head.sha256 } : undefined;
        const envelope = { schemaVersion: 1, kind, id, version: fileVersion, ...(previous ? { previous } : {}), data: payload };
        const bytes = Buffer.from(JSON.stringify(envelope));
        if (bytes.length > limit) { await repository.release(entity, operationId); throw failure(413, 'Dataset exceeds the configured storage limit'); }
        let fileId = reuse ? state.head.fileId : null;
        try {
            if (!reuse) {
                fileId = await drive.createId();
                await repository.attachFile(entity, operationId, fileId, now());
                await drive.writeBytes(fileId, kind + '_' + entity.key.slice(0, 16) + '_v' + reserved.version + '.json', bytes);
                const verified = await drive.readBytes(fileId, { maxBytes: limit });
                if (verified.length !== bytes.length || sha(verified) !== sha(bytes)) throw failure(503, 'Uploaded snapshot read-back verification failed');
            }
            await authorize(entity, 'commit');
        } catch (error) {
            // Uploaded but uncommitted files are retained for recovery, never deleted here.
            await repository.release(entity, operationId).catch(() => {});
            throw error;
        }
        const head = { schemaVersion: 1, mode: 'drive', kind, id, version: reserved.version, epoch: reserved.epoch,
            fileId, fileVersion, payloadDigest, ...(coordination ? { coordination } : {}), bytes: reuse ? state.head.bytes : bytes.length, sha256: reuse ? state.head.sha256 : sha(bytes), updatedAt: new Date(now()).toISOString(),
            lastRequestId: requestId, lastDigest: digest, summary };
        try {
            await repository.commit(entity, operationId, head, now());
        } catch (error) {
            // A timeout does not establish whether commit happened. Resolve by request ID.
            let status;
            try { status = await repository.read(entity); } catch (_) { throw failure(503, 'Save confirmation unavailable. Keep the pending copy and check this request before retrying'); }
            if (status.head?.lastRequestId === requestId && status.head.lastDigest === digest) return { version: status.head.version, alreadySaved: true };
            if ([400, 403, 409, 413].includes(error.status)) {
                await repository.release(entity, operationId).catch(() => {});
                throw error;
            }
            throw failure(503, 'Save not confirmed. Pending copy retained; retry with the same request ID');
        }
        return { version: head.version, fileId, mode: 'drive' };
    }
    async function status(kind, id, requestId) {
        const entity = resource(kind, id); await authorize(entity, 'read');
        const state = await repository.read(entity);
        return { version: state.head?.mode === 'drive' || state.head?.deleted ? state.head.version : state.version, mode: state.head?.deleted ? 'deleted' : state.head?.mode || 'legacy',
            committed: !!requestId && state.head?.lastRequestId === requestId, pending: state.head?.operation?.until > now() };
    }
    return { enabled, read, save, status, resource, modules: [...modules] };
};
module.exports.resource = resource;
module.exports.canonical = canonical;
