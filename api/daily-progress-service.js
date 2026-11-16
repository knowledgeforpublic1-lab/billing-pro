const crypto = require('node:crypto');
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const clone = value => JSON.parse(JSON.stringify(value));
const dateValid = date => /^\d{4}-\d{2}-\d{2}$/.test(date || '') && !isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;

module.exports = function createService({ db, drive, now = Date.now, items = [] }) {
    const LEASE = 5 * 60 * 1000;
    const itemIds = new Set(items.map(item => String(item.id)));
    const recordKey = (cid, date) => 'report_' + hash(cid) + '_' + date;
    const linkKey = cid => 'contractor_' + hash(cid);
    const read = key => db.atomicDailyRecord(key, value => ({ result: value }));
    function initial(cid, date) { return { contractorId: cid, date, state: 'open', version: 0, epoch: 0, audit: [] }; }
    function audit(record, action) {
        record.audit = [...(record.audit || []), { action, at: now() }].slice(-100);
    }
    function editorHash(editor) {
        if (!/^[\w-]{32,128}$/.test(editor || '')) fail(400, 'Valid editor session required');
        return hash(editor);
    }
    function assertDate(date) { if (!dateValid(date) || date < '2020-01-01' || date > '2100-12-31') fail(400, 'Valid work date select karein.'); }
    function cleanReport(payload) {
        if (!payload || typeof payload !== 'object') fail(400, 'Report required');
        const quantities = {};
        for (const [key, raw] of Object.entries(payload.quantities || {})) {
            if (!itemIds.has(key)) fail(400, 'Unknown material');
            const value = Number(raw);
            if (!Number.isFinite(value) || value < 0 || value > 1e9) fail(400, 'Invalid material quantity');
            if (value) quantities[key] = Math.round(value * 1000) / 1000;
        }
        const manpower = {};
        for (const key of ['leader', 'skilled', 'unskilled', 'tractor', 'augur', 'room']) {
            const value = Number(payload.manpower?.[key] || 0);
            if (!Number.isFinite(value) || value < 0 || value > 1e9 || (['leader', 'skilled', 'unskilled'].includes(key) && !Number.isInteger(value))) fail(400, 'Invalid manpower/charges');
            manpower[key] = Math.round(value * 100) / 100;
        }
        const remarks = String(payload.remarks || '').trim();
        if (remarks.length > 5000) fail(400, 'Remarks too long');
        return { quantities, manpower, remarks };
    }
    async function contractor(cid) { return read(linkKey(cid)); }
    async function authorize(token) {
        if (!/^[a-f0-9]{64}$/.test(token || '')) fail(401, 'Entry link invalid hai. Admin se naya link lein.');
        const lookup = await read('token_' + hash(token));
        const c = lookup && await contractor(lookup.contractorId);
        if (!c || c.disabled || c.tokenHash !== hash(token)) fail(401, 'Entry link disabled ya invalid hai.');
        return c;
    }
    async function access(cid, date, editor, mode = 'read') {
        assertDate(date);
        const who = editorHash(editor);
        const key = recordKey(cid, date);
        const state = await db.atomicDailyRecord(key, old => {
            const r = clone(old || initial(cid, date));
            if (mode === 'claim' && r.state !== 'final' && !(r.operation?.until > now()) && (!r.owner || r.leaseUntil <= now() || r.owner === who)) {
                if (r.owner !== who) { r.epoch++; audit(r, 'reserved'); }
                r.owner = who;
                r.leaseUntil = now() + LEASE;
                return { value: r, result: r };
            }
            if (mode === 'heartbeat' && r.owner === who && r.state !== 'final' && r.leaseUntil > now()) {
                r.leaseUntil = now() + LEASE;
                return { value: r, result: r };
            }
            return { result: r };
        });
        const report = state.fileId ? await drive.read(state.fileId) : null;
        return {
            date, version: state.version, epoch: state.epoch, state: state.state,
            editable: state.state === 'open' && state.owner === who && state.leaseUntil > now(),
            occupied: state.state !== 'final' && !!state.owner && state.leaseUntil > now() && state.owner !== who,
            processing: !!(state.operation?.until > now()), leaseUntil: state.leaseUntil || 0,
            report: report && { quantities: report.quantities, manpower: report.manpower, remarks: report.remarks }
        };
    }
    async function save(cid, date, editor, body) {
        assertDate(date);
        const who = editorHash(editor);
        if (!/^[\w-]{16,100}$/.test(body.requestId || '')) fail(400, 'Save request ID required');
        if (!Number.isInteger(body.version) || !Number.isInteger(body.epoch)) fail(400, 'Report version required');
        const payload = cleanReport(body.report);
        const digest = hash(JSON.stringify({ payload, final: !!body.final, epoch: body.epoch }));
        const key = recordKey(cid, date);
        const operationId = crypto.randomUUID();
        const reserved = await db.atomicDailyRecord(key, old => {
            const r = clone(old || initial(cid, date));
            if (r.lastRequestId === body.requestId && r.lastOwner === who && r.lastDigest === digest) return { result: { already: true, version: r.version, state: r.state } };
            if (r.state === 'final') fail(423, 'Entry save ho chuki hai. Admin se reopen karwayein.');
            if (r.owner !== who || r.leaseUntil <= now() || r.epoch !== body.epoch) fail(409, 'Editing reservation expire ya change ho gayi. Draft copy safe rakhein aur reload karein.');
            if (r.version !== body.version) fail(409, 'Newer draft available hai. Reload karein.');
            if (r.operation?.until > now()) fail(409, 'Save chal raha hai. Thodi der baad retry karein.');
            r.operation = { id: operationId, until: now() + 90000 };
            r.leaseUntil = now() + LEASE;
            return { value: r, result: { version: r.version + 1 } };
        });
        if (reserved.already) return reserved;
        let fileId;
        try {
            fileId = await drive.write(key, { ...payload, contractorId: cid, date, version: reserved.version, final: !!body.final, savedAt: new Date(now()).toISOString() });
        } catch (error) {
            await db.atomicDailyRecord(key, old => {
                if (old?.operation?.id !== operationId) return { result: null };
                const r = clone(old); delete r.operation; return { value: r, result: null };
            });
            throw error;
        }
        return db.atomicDailyRecord(key, old => {
            if (old?.operation?.id !== operationId || old.epoch !== body.epoch) fail(409, 'Reservation changed; save not confirmed. Draft retained.');
            const r = clone(old);
            r.fileId = fileId; r.version = reserved.version; r.state = body.final ? 'final' : 'open';
            r.lastRequestId = body.requestId; r.lastOwner = who; r.lastDigest = digest;
            delete r.operation;
            audit(r, body.final ? 'final_saved' : 'draft_saved');
            if (body.final) { delete r.owner; r.leaseUntil = 0; }
            return { value: r, result: { version: r.version, state: r.state } };
        });
    }
    return {
        authorize, contractor, access, save,
        async createLink(data) {
            const cid = String(data.id || '');
            if (!/^[\w -]{1,150}$/.test(cid) || !String(data.name || '').trim()) fail(400, 'Contractor ID and name required');
            const token = crypto.randomBytes(32).toString('hex');
            const tokenHash = hash(token);
            await db.atomicDailyRecord('token_' + tokenHash, () => ({ value: { contractorId: cid }, result: null }));
            await db.atomicDailyRecord(linkKey(cid), old => ({ value: {
                id: cid, name: String(data.name).trim().slice(0, 200), project: String(data.project || '').slice(0, 200),
                feeder: String(data.feeder || '').slice(0, 200), tokenHash, disabled: false, createdAt: now(),
                linkVersion: (old?.linkVersion || 0) + 1
            }, result: null }));
            return { token };
        },
        async disable(cid) {
            return db.atomicDailyRecord(linkKey(cid), old => {
                if (!old) fail(404, 'Contractor link not found');
                return { value: { ...old, disabled: true }, result: true };
            });
        },
        async reopen(cid, date, action = 'reopen') {
            assertDate(date);
            return db.atomicDailyRecord(recordKey(cid, date), old => {
                const r = clone(old || initial(cid, date));
                if (r.operation?.until > now()) fail(409, 'Save in progress. Retry after completion.');
                r.state = 'open'; r.epoch++; delete r.owner; delete r.operation; r.leaseUntil = 0;
                delete r.lastRequestId;
                audit(r, action);
                return { value: r, result: true };
            });
        },
        async list() {
            const rows = await db.listDailyRecords('contractor_');
            return rows.map(({ value: c }) => ({ id: c.id, name: c.name, project: c.project, feeder: c.feeder, disabled: c.disabled, createdAt: c.createdAt }));
        },
        async reports() {
            const rows = await db.listDailyRecords('report_');
            return Promise.all(rows.filter(row => row.value.fileId).map(async ({ value: r }) => {
                const data = await drive.read(r.fileId);
                return { ...data, state: r.state, version: r.version };
            }));
        },
        async audit(cid, date) { assertDate(date); const r = await read(recordKey(cid, date)); return r?.audit || []; }
    };
};
