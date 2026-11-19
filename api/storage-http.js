'use strict';

const crypto = require('node:crypto');
const { canonical } = require('./drive-first-store');
const fail = (status, message) => Object.assign(new Error(message), { status });
const sha = value => crypto.createHash('sha256').update(value).digest('hex');

function versions(raw) {
    if (!raw) return {};
    if (raw.length > 6000) throw fail(400, 'Storage version header exceeds limit');
    let values;
    try { values = JSON.parse(raw); } catch (_) { throw fail(400, 'Invalid storage version header'); }
    if (!values || Array.isArray(values) || typeof values !== 'object' || Object.keys(values).length > 30) throw fail(400, 'Invalid storage versions');
    for (const [key, value] of Object.entries(values)) {
        if (!/^[a-f0-9]{64}$/.test(key) || !value || !Number.isSafeInteger(value.v) || value.v < 0 || (value.s != null && !/^\d+\.\d+$/.test(value.s))) throw fail(400, 'Invalid storage version');
    }
    return values;
}

module.exports = function storageHttp({ db, auth, workers, dailyProgress }) {
    return (req, res, next) => {
        const requestPath = req.path; // Express mounted routers temporarily trim req.path.
        let expectedVersions;
        try { expectedVersions = versions(req.get('x-billing-storage-versions')); }
        catch (error) { return res.status(error.status).json({ success: false, error: error.message }); }
        const supplied = req.get('x-billing-request-id');
        if (supplied && !/^[\w-]{16,80}$/.test(supplied)) return res.status(400).json({ success: false, error: 'Invalid save request ID' });
        const scope = { expectedVersions, versions: {}, operations: {}, requestId: supplied || crypto.randomUUID(),
            requestHash: sha(JSON.stringify(canonical(req.body || {}))), resourceContractors: new Map(),
            async authorize(entity, phase) {
                scope.authorizationWitnesses = new Map();
                scope.authorizing = true;
                try {
                // Re-read session/revocation records after every upload, even if route auth cached them.
                delete req.authSession;
                if (requestPath.startsWith('/api/daily-entry/') || requestPath.startsWith('/api/dp-worker/') || requestPath === '/api/daily-progress/data' || requestPath === '/api/daily-progress') {
                    const actor = await workers.principal(req);
                    const cid = scope.resourceContractors.get(entity.key) || req.body?.contractorId || req.query.contractorId;
                    if (cid) workers.assertContractor(actor, cid);
                    if (req.get('x-dp-link')) {
                        const link = await dailyProgress.service.authorize(req.get('x-dp-link'));
                        if (cid && cid !== link.id) throw fail(403, 'Entry link contractor changed');
                    }
                    if (entity.kind !== 'daily') throw fail(403, 'Daily entry cannot write this module');
                    return;
                }
                const session = await auth.sessionFor(req);
                if ((entity.kind === 'master' || entity.kind === 'mapping' || requestPath.includes('/delete') || requestPath.startsWith('/api/dp-admin/')) && !(session.adminExpiresAt > Date.now())) throw fail(403, 'Admin verification expired; pending changes retained');
                return session;
                } finally { scope.authorizing = false; }
            } };
        const json = res.json.bind(res);
        res.json = body => {
            const encoded = JSON.stringify(scope.versions);
            if (encoded.length <= 6000 && Object.keys(scope.versions).length) res.set('X-Billing-Storage-Versions', encoded);
            res.set('X-Billing-Request-Id', scope.requestId);
            return json(body);
        };
        return db.storageContext.run(scope, next);
    };
};
module.exports.versions = versions;
