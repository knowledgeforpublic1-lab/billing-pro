const crypto = require('node:crypto');
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

module.exports = function locations({ db }) {
    const prefix = cid => 'dp_location_' + hash(cid) + '_';
    return {
        async list(cid) {
            return (await db.listDailyRecords(prefix(cid))).map(row => row.value).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
        },
        async get(cid, id) {
            if (!/^loc_[a-f0-9]{24}$/.test(id || '')) fail(400, 'Valid location select karein.');
            const value = await db.atomicDailyRecord(prefix(cid) + id, old => ({ result: old }));
            if (!value || value.contractorId !== cid) fail(404, 'Location is contractor ki nahi hai. Sahi location select karein.');
            return value;
        },
        async create(cid, rawName, actor) {
            if (typeof cid !== 'string' || !cid || cid.length > 150) fail(400, 'Contractor required.');
            if (typeof rawName !== 'string') fail(400, 'Location name required.');
            const name = String(rawName || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
            if (!name || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name)) fail(400, 'Location name 1–120 characters ka hona chahiye.');
            const id = 'loc_' + hash(cid + '|' + name.toLowerCase()).slice(0, 24);
            return db.atomicDailyRecord(prefix(cid) + id, old => old ? { result: old } : {
                value: { id, contractorId: cid, name, createdAt: new Date().toISOString(), createdBy: actor?.id || '' },
                result: { id, contractorId: cid, name }
            });
        }
    };
};
