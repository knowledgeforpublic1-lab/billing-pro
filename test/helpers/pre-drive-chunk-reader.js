'use strict';
// Original live reader from commit 71418d4, retained to verify rollback compatibility.
const log = { error() {} };
async function readFirestoreWithChunking(docSnap) {
    if (!docSnap || !docSnap.exists) return null;
    const data = docSnap.data();
    if (!data || !data._isChunked) return data;

    const totalChunks = data.totalChunks || 0;
    const chunkVersion = data.chunkVersion;
    const chunksColl = docSnap.ref.collection('chunks');
    const readPromises = [];

    for (let i = 0; i < totalChunks; i++) {
        const docId = chunkVersion ? `${chunkVersion}_${i}` : String(i);
        readPromises.push(chunksColl.doc(docId).get());
    }
    const chunkSnaps = await Promise.all(readPromises);
    let fullJson = '';
    for (let i = 0; i < chunkSnaps.length; i++) {
        const snap = chunkSnaps[i];
        if (!snap.exists) {
            log.error('DB-CHUNK', `Missing chunk ${i}/${totalChunks} for ${docSnap.ref.path}`);
            return data;
        }
        fullJson += (snap.data().chunk || '');
    }
    try {
        const parsed = JSON.parse(fullJson);
        const merged = { ...data, ...parsed };
        delete merged._isChunked;
        delete merged.totalChunks;
        delete merged.chunkVersion;
        delete merged.byteLength;
        return merged;
    } catch (e) {
        log.error('DB-CHUNK', `Error parsing chunked document ${docSnap.ref.path}`, e);
        return data;
    }
}
module.exports = readFirestoreWithChunking;
