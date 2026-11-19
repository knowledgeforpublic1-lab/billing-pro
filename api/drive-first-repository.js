'use strict';

const fail = (status, message) => Object.assign(new Error(message), { status });
const stamp = snap => snap?.exists && snap.updateTime ? `${snap.updateTime.seconds}.${snap.updateTime.nanoseconds}` : null;

module.exports = function createRepository({ firestore, readLegacy, legacyRef, validateAuthorization = async () => {} }) {
    const headRef = entity => firestore().collection('billing_storage_heads').doc(entity.key);
    const rawRef = entity => legacyRef(firestore(), entity);
    function version(head, legacy) { return head?.mode === 'drive' || head?.deleted ? head.version : Number(legacy?.rev || 0); }
    function validOperation(head, operationId, now) {
        if (!head?.operation || head.operation.id !== operationId || head.operation.until <= now) throw fail(409, 'Save reservation expired or changed');
    }
    return {
        headRef,
        async read(entity) {
            const [head, legacy] = await Promise.all([headRef(entity).get(), rawRef(entity).get()]);
            const value = head.exists ? head.data() : null;
            return { head: value, legacy: value?.mode === 'drive' || value?.deleted ? null : await readLegacy(legacy),
                version: version(value, legacy.exists ? legacy.data() : null), stamp: stamp(legacy) };
        },
        reserve(entity, operation) {
            return firestore().runTransaction(async transaction => {
                const h = headRef(entity), r = rawRef(entity);
                const [headSnap, legacy] = await Promise.all([transaction.get(h), transaction.get(r)]);
                const head = headSnap.exists ? headSnap.data() : null;
                const current = version(head, legacy.exists ? legacy.data() : null);
                if (head?.deleted) throw fail(409, 'Deleted record cannot be recreated by a stale save');
                if (head?.lastRequestId === operation.requestId) {
                    if (head.lastDigest !== operation.digest) throw fail(409, 'Request ID reused with different content');
                    return { alreadySaved: true, version: current };
                }
                if (current !== operation.expectedVersion) throw fail(409, 'Newer cloud revision exists; local changes retained');
                if (operation.expectedStamp !== undefined && head?.mode !== 'drive' && operation.expectedStamp !== stamp(legacy)) throw fail(409, 'Legacy data changed; refresh before saving');
                if (head?.operation?.until > operation.now) throw fail(409, 'Another save is in progress');
                const epoch = (head?.epoch || 0) + 1;
                transaction.set(h, { ...(head || { mode: 'legacy', kind: entity.kind, id: entity.id, version: current }), epoch,
                    operation: { id: operation.operationId, requestId: operation.requestId, digest: operation.digest,
                        until: operation.until, sourceStamp: stamp(legacy), version: current + 1 } });
                return { version: current + 1, epoch };
            });
        },
        attachFile(entity, operationId, fileId, now) {
            return firestore().runTransaction(async transaction => {
                const ref = headRef(entity), snap = await transaction.get(ref), head = snap.exists ? snap.data() : null;
                validOperation(head, operationId, now);
                transaction.update(ref, { 'operation.fileId': fileId });
            });
        },
        release(entity, operationId) {
            return firestore().runTransaction(async transaction => {
                const ref = headRef(entity), snap = await transaction.get(ref), head = snap.exists ? snap.data() : null;
                if (head?.operation?.id !== operationId) return;
                const next = { ...head }; delete next.operation;
                transaction.set(ref, next);
            });
        },
        commit(entity, operationId, next, now) {
            return firestore().runTransaction(async transaction => {
                const ref = headRef(entity), legacyRef = rawRef(entity);
                const [snapshot, legacy] = await Promise.all([transaction.get(ref), transaction.get(legacyRef)]);
                const membershipRef = firestore().collection('billing_storage_control').doc('bill-membership');
                const membership = entity.kind === 'bill' ? await transaction.get(membershipRef) : null;
                await validateAuthorization(transaction);
                const head = snapshot.exists ? snapshot.data() : null;
                validOperation(head, operationId, now);
                if (head.deleted || head.epoch !== next.epoch || head.operation.version !== next.version) throw fail(409, 'Save epoch/version changed');
                if (stamp(legacy) !== head.operation.sourceStamp) throw fail(409, 'Legacy writer changed the source during upload');
                const bytes = Buffer.byteLength(JSON.stringify(next));
                if (bytes > 32768) throw fail(413, 'Storage metadata exceeds its bounded size budget');
                transaction.set(ref, next);
                if (membership) transaction.set(membershipRef, { revision: (membership.exists ? membership.data().revision : 0) + 1 });
            });
        },
        async assertLegacy(transaction, entity, now = Date.now()) {
            const snap = await transaction.get(headRef(entity));
            const head = snap.exists ? snap.data() : null;
            if (head?.mode === 'drive' || head?.deleted || head?.operation?.until > now) throw fail(409, 'Storage mode changed or save is reserved; refresh before retrying');
        },
        async heads(kind) {
            const rows = await firestore().collection('billing_storage_heads').where('kind', '==', kind).get();
            return rows.docs.map(row => row.data());
        },
        async removeBill(entity, expectedVersion) {
            return firestore().runTransaction(async transaction => {
                const membership = firestore().collection('billing_storage_control').doc('bill-membership');
                const ref = headRef(entity);
                const [current, guard, legacyBills, storedHeads, original] = await Promise.all([
                    transaction.get(ref), transaction.get(membership), transaction.get(firestore().collection('billing_states').select()),
                    transaction.get(firestore().collection('billing_storage_heads').where('kind', '==', 'bill')), transaction.get(rawRef(entity))
                ]);
                const head = current.exists ? current.data() : { kind: entity.kind, id: entity.id, version: version(null, original.exists ? original.data() : null), epoch: 0 };
                await validateAuthorization(transaction);
                if ((!original.exists && head.mode !== 'drive') || head.deleted) throw fail(404, 'Bill not found');
                if (version(head, original.exists ? original.data() : null) !== expectedVersion || head.operation?.until > Date.now()) throw fail(409, 'Bill changed or a save is in progress');
                const ids = new Set(legacyBills.docs.map(row => row.id));
                for (const item of storedHeads.docs) { const h = item.data(); if (h.deleted) ids.delete(h.id); else if (h.mode === 'drive') ids.add(h.id); }
                if (ids.size <= 1) throw fail(400, 'Cannot delete the only existing bill');
                transaction.set(ref, { ...head, deleted: true, version: head.version + 1, epoch: head.epoch + 1, updatedAt: new Date().toISOString() });
                transaction.set(membership, { revision: (guard.exists ? guard.data().revision : 0) + 1 });
            });
        }
    };
};
