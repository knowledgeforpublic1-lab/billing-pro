'use strict';
// Resolve a lost successful response before the route rejects its now-old baseRev.
module.exports = function replay({ db }) {
    return async (req, res, next) => {
        if (req.method !== 'POST' || !req.get('x-billing-request-id')) return next();
        const body = req.body || {}, entities = [];
        if (req.path === '/api/billing' && typeof body.dataId === 'string') entities.push(['bill', body.dataId]);
        else if (req.path === '/api/reconciliation') entities.push(['reconciliation', 'main-reconciliation-state']);
        else if (req.path === '/api/contractor-mapping' && typeof body.contractorId === 'string') entities.push(['mapping', 'contractor_mapping_' + encodeURIComponent(body.contractorId)]);
        else if (req.path === '/api/storage/business' && ['stockMaster', 'previousRecoMaster', 'contractorsMaster'].includes(body.key)) entities.push(['master', body.key]);
        else if (req.path === '/api/save-default-pole-schedules') entities.push(['master', 'poleSchedulesMaster']);
        else if (req.path === '/api/save-default-activities') {
            if (body.activities) entities.push(['master', 'activitiesMaster']);
            if (body.sapMaterialsMaster) entities.push(['master', 'sapMaterialsMaster']);
        }
        if (!entities.length) return next();
        try {
            const scope = db.storageContext.getStore(), heads = [];
            for (const [kind, id] of entities) {
                if (!await db.storageRouted(kind, id)) return next();
                const entity = db.storageResource(kind, id);
                const snap = await db.storageRepository.headRef(entity).get(), head = snap.exists ? snap.data() : null;
                if (head?.mode !== 'drive' || head.deleted || head.lastRequestId !== scope.requestId + '_1') return next();
                await scope.authorize(entity, 'write');
                if (head.lastDigest !== scope.requestHash) return res.status(409).json({ success: false, error: 'Save request ID was reused with different contents' });
                heads.push(head);
            }
            // No new mutation. Acknowledge precisely the previously committed operation.
            for (const head of heads) scope.versions[db.storageResource(head.kind, head.id).key] = { v: head.version, s: null, mode: 'drive' };
            return res.json({ success: true, alreadySaved: true, rev: heads[0].version,
                ...(entities[0][0] === 'bill' ? { dataId: entities[0][1] } : {}), cloudSaved: true, diskSaved: false, files: [] });
        } catch (error) { return res.status(error.status || 503).json({ success: false, error: error.status ? error.message : 'Save confirmation unavailable; pending copy retained' }); }
    };
};
