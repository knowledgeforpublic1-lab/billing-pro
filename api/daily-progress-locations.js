const crypto = require('node:crypto');
const defaultFeeders = require('../js/data/default-feeders');
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

module.exports = function locations({ db }) {
    const prefix = cid => 'dp_location_' + hash(cid) + '_';
    return {
        async list(cid) {
            const custom = (await db.listDailyRecords(prefix(cid))).map(row => row.value).filter(Boolean);
            const customIds = new Set(custom.map(c => c.id));
            const defaults = (defaultFeeders.list || []).map(f => ({
                id: f.id,
                contractorId: cid,
                name: f.name,
                division: f.division,
                subDivision: f.subDivision,
                substation: f.substation,
                feeder: f.feeder,
                isDefault: true
            })).filter(f => !customIds.has(f.id));
            return [...custom, ...defaults].sort((a, b) => a.name.localeCompare(b.name));
        },
        async get(cid, id) {
            if (!/^loc_[a-f0-9]{24}$/.test(id || '')) fail(400, 'Valid location select karein.');
            const value = await db.atomicDailyRecord(prefix(cid) + id, old => ({ result: old }));
            if (value) {
                if (value.contractorId !== cid) fail(404, 'Location is contractor ki nahi hai. Sahi location select karein.');
                return value;
            }
            const def = defaultFeeders.get(id);
            if (def) {
                return {
                    id: def.id,
                    contractorId: cid,
                    name: def.name,
                    division: def.division,
                    subDivision: def.subDivision,
                    substation: def.substation,
                    feeder: def.feeder,
                    isDefault: true
                };
            }
            fail(404, 'Location is contractor ki nahi hai. Sahi location select karein.');
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
