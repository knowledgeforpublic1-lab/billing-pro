const crypto = require('node:crypto');
const { readDailyProgressData, newerReport, locationId: normalizeLocation, reportKey, controlKey } = require('./daily-progress-data');
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const clone = value => JSON.parse(JSON.stringify(value));
const dateValid = date => /^\d{4}-\d{2}-\d{2}$/.test(date || '') && !isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;

module.exports = function createService({ db, drive, now = Date.now, items = [] }) {
    const LEASE = 5 * 60 * 1000;
    const itemIds = new Set(items.map(item => String(item.id)));
    const recordKey = controlKey;
    const locations = require('./daily-progress-locations')({ db });
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
        if (c.expiresAt && c.expiresAt <= now()) fail(401, 'Entry link expire ho chuka hai. Admin se naya link lein.');
        return c;
    }
    async function access(cid, date, editor, mode = 'read', locationId = '') {
        assertDate(date);
        locationId = normalizeLocation(locationId);
        const location = locationId ? await locations.get(cid, locationId) : null;
        const who = editorHash(editor);
        const key = recordKey(cid, date, locationId);
        const legacy = readDailyProgressData(db.getDefaultConfig ? await db.getDefaultConfig('dailyProgressData') : null);
        const shared = await read('shared_report_' + hash(reportKey({ contractorId: cid, date, locationId })));
        let inherited = null;
        for (const row of legacy.reports) {
            if (row.contractorId === cid && row.date === date && normalizeLocation(row.locationId) === locationId) inherited = newerReport(inherited, row);
        }
        inherited = newerReport(inherited, shared && shared.report);
        const state = await db.atomicDailyRecord(key, old => {
            const r = clone(old || initial(cid, date));
            // Start admin/token editing from the same report shown on the share page.
            if (inherited && !r.deleted && !r.managed && (!r.owner || r.leaseUntil <= now()) &&
                (Number(inherited.version || 0) > r.version || (!r.fileId && Number(inherited.version || 0) >= r.version))) {
                r.version = Number(inherited.version || 0);
                r.baseReport = inherited;
                delete r.fileId;
            }
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
        const report = state.fileId ? await drive.read(state.fileId) : state.baseReport || null;
        return {
            date, locationId, locationName: location?.name || 'Legacy / Unassigned', deleted: !!state.deleted, version: state.version, epoch: state.epoch, state: state.state,
            editable: state.state === 'open' && state.owner === who && state.leaseUntil > now(),
            occupied: state.state !== 'final' && !!state.owner && state.leaseUntil > now() && state.owner !== who,
            processing: !!(state.operation?.until > now()), leaseUntil: state.leaseUntil || 0,
            report: !state.deleted && report ? { ...report, locationId, locationName: location?.name || 'Legacy / Unassigned' } : null
        };
    }
    async function save(cid, date, editor, body, actor = null) {
        assertDate(date);
        const locationId = normalizeLocation(body.locationId || body.report?.locationId);
        const location = locationId ? await locations.get(cid, locationId) : null;
        const who = editorHash(editor);
        if (!/^[\w-]{16,100}$/.test(body.requestId || '')) fail(400, 'Save request ID required');
        if (!Number.isInteger(body.version) || !Number.isInteger(body.epoch)) fail(400, 'Report version required');
        const payload = { ...cleanReport(body.report), locationId, locationName: location?.name || 'Legacy / Unassigned' };
        const digest = hash(JSON.stringify({ payload, final: !!body.final, epoch: body.epoch }));
        const key = recordKey(cid, date, locationId);
        const operationId = crypto.randomUUID();
        const reserved = await db.atomicDailyRecord(key, old => {
            const r = clone(old || initial(cid, date));
            if (r.lastRequestId === body.requestId && r.lastOwner === who && r.lastDigest === digest) return { result: { already: true, version: r.version, state: r.state, savedAt: r.savedAt, savedBy: r.savedBy } };
            if (r.state === 'final') fail(423, 'Entry save ho chuki hai. Admin se reopen karwayein.');
            if (r.version >= 500) fail(400, 'Max revision limit reached for this daily report. Admin se contact karein.');
            if (r.owner !== who || r.leaseUntil <= now() || r.epoch !== body.epoch) fail(409, 'Editing reservation expire ya change ho gayi. Draft copy safe rakhein aur reload karein.');
            if (r.version !== body.version) fail(409, 'Newer draft available hai. Reload karein.');
            if (r.operation?.until > now()) fail(409, 'Save chal raha hai. Thodi der baad retry karein.');
            r.operation = { id: operationId, until: now() + 90000 };
            r.leaseUntil = now() + LEASE;
            return { value: r, result: { version: r.version + 1 } };
        });
        if (reserved.already) return { ...reserved, report: payload };
        const savedAt = new Date(now()).toISOString();
        const savedBy = actor ? { id: actor.id, name: actor.name, username: actor.username, role: actor.role } : null;
        const snapshot = { ...payload, contractorId: cid, date, locationId, locationName: location?.name || 'Legacy / Unassigned', version: reserved.version, final: !!body.final, savedAt, savedBy };
        // The shared router already uploads, verifies and commits the full business
        // snapshot. Avoid a second unverified report file behind that verified head.
        const routedSnapshot = db.storageRouted && await db.storageRouted('daily', key);
        let fileId;
        try {
            if (!routedSnapshot) fileId = await drive.write(key, snapshot);
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
            if (routedSnapshot) { r.baseReport = snapshot; delete r.fileId; }
            else r.fileId = fileId;
            r.version = reserved.version; r.state = body.final ? 'final' : 'open';
            r.locationId = locationId; r.locationName = location?.name || 'Legacy / Unassigned'; r.deleted = false; r.managed = false;
            r.lastRequestId = body.requestId; r.lastOwner = who; r.lastDigest = digest;
            r.savedAt = savedAt; r.savedBy = savedBy;
            delete r.operation;
            audit(r, body.final ? 'final_saved' : 'draft_saved');
            if (body.final) { delete r.owner; r.leaseUntil = 0; }
            return { value: r, result: { version: r.version, state: r.state, savedAt, savedBy, report: payload } };
        });
    }
    return {
        authorize, contractor, access, save, locations,
        async createLink(data) {
            const cid = String(data.id || '');
            if (!/^[\w -]{1,150}$/.test(cid) || !String(data.name || '').trim()) fail(400, 'Contractor ID and name required');
            const token = crypto.randomBytes(32).toString('hex');
            const tokenHash = hash(token);
            const ttlDays = Number(data.ttlDays) > 0 ? Number(data.ttlDays) : 90;
            const expiresAt = now() + (ttlDays * 24 * 60 * 60 * 1000);
            await db.atomicDailyRecord('token_' + tokenHash, () => ({ value: { contractorId: cid }, result: null }));
            await db.atomicDailyRecord(linkKey(cid), old => ({
                value: {
                    id: cid, name: String(data.name).trim().slice(0, 200), project: String(data.project || '').slice(0, 200),
                    feeder: String(data.feeder || '').slice(0, 200), tokenHash, disabled: false, createdAt: now(),
                    expiresAt,
                    linkVersion: (old?.linkVersion || 0) + 1
                }, result: null
            }));
            return { token, expiresAt };
        },
        async disable(cid) {
            return db.atomicDailyRecord(linkKey(cid), old => {
                if (!old) fail(404, 'Contractor link not found');
                return { value: { ...old, disabled: true }, result: true };
            });
        },
        async reopen(cid, date, action = 'reopen', locationId = '') {
            assertDate(date);
            locationId = normalizeLocation(locationId);
            if (locationId) await locations.get(cid, locationId);
            return db.atomicDailyRecord(recordKey(cid, date, locationId), old => {
                const r = clone(old || initial(cid, date));
                if (r.operation?.until > now()) fail(409, 'Save in progress. Retry after completion.');
                r.state = 'open'; r.epoch++; delete r.owner; delete r.operation; r.leaseUntil = 0;
                delete r.lastRequestId;
                if (r.baseReport) {
                    r.baseReport.state = 'open';
                    r.baseReport.final = false;
                }
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
            return Promise.all(rows.filter(row => row.value.fileId || row.value.baseReport || row.value.deleted).map(async ({ value: r }) => {
                const data = r.fileId ? await drive.read(r.fileId) : r.baseReport || r;
                return { ...data, state: r.state, version: r.version, deleted: !!r.deleted, managed: !!r.managed };
            }));
        },
        async audit(cid, date, locationId = '') { assertDate(date); const r = await read(recordKey(cid, date, normalizeLocation(locationId))); return r?.audit || []; },
        async manage(cid, date, locationId, action, previous) {
            assertDate(date);
            locationId = normalizeLocation(locationId);
            const location = locationId ? await locations.get(cid, locationId) : null;
            if (!['delete', 'reset'].includes(action)) fail(400, 'Invalid report action.');
            return db.atomicDailyRecord(recordKey(cid, date, locationId), old => {
                const r = clone(old || initial(cid, date));
                if (r.operation?.until > now()) fail(409, 'Save chal raha hai. Thodi der baad retry karein.');
                r.version = Math.max(r.version || 0, previous?.version || 0) + 1;
                r.epoch++; r.leaseUntil = 0; r.state = 'open'; r.deleted = action === 'delete';
                r.managed = true;
                r.locationId = locationId; r.locationName = location?.name || 'Legacy / Unassigned';
                delete r.fileId; delete r.owner; delete r.operation; delete r.lastRequestId; delete r.sharedDigest;
                r.baseReport = { contractorId: cid, date, locationId, locationName: r.locationName, quantities: {}, manpower: {}, remarks: '', version: r.version, updatedAt: new Date(now()).toISOString() };
                audit(r, action);
                return { value: r, result: { date, version: r.version, deleted: r.deleted } };
            });
        }
    };
};
