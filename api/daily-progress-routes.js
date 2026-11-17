const express = require('express');
const rateLimit = require('express-rate-limit');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const createService = require('./daily-progress-service');
const createDrive = require('./daily-drive');
const crypto = require('node:crypto');
const { readDailyProgressData, newerReport } = require('./daily-progress-data');

function normId(value) {
    return String(value || '').toLowerCase().replace(/^m\/s\.?\s*/i, '').replace(/[^a-z0-9]/g, '');
}
function loadScript(file, globalName) {
    const sandbox = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/data', file), 'utf8'), sandbox);
    return sandbox.window[globalName];
}
let publicContractorsCache = null;
let contractorDirectoryCache = null;
let stockCache = null;
let mappingCache = null;
function publicContractors() {
    if (publicContractorsCache) return publicContractorsCache;
    const raw = loadScript('default-contractors.js', 'defaultContractorsList') || loadScript('default-contractors.js', 'DefaultContractors') || [];
    const seen = new Map();
    for (const c of raw) {
        const id = String((c && (c.id || c.name)) || '').trim();
        const name = String((c && (c.name || c.firmName)) || '').trim();
        if (!id || !name || seen.has(id)) continue;
        seen.set(id, {
            id,
            name: name.slice(0, 200),
            project: 'Gadchiroli (T-10)',
            feeder: String((c && (c.feederName || c.feeder)) || '').slice(0, 200),
            engineer: String((c && c.engineer) || '').slice(0, 200)
        });
    }
    publicContractorsCache = [...seen.values()];
    return publicContractorsCache;
}
function stockDatabase() {
    if (stockCache) return stockCache;
    stockCache = loadScript('contractor-sap-issues.js', 'ContractorSapStock') || { byContractorNorm: {} };
    if (!stockCache.byContractorNorm) stockCache.byContractorNorm = {};
    return stockCache;
}
function sapMapping() {
    if (mappingCache) return mappingCache;
    mappingCache = loadScript('default-sap-contractor-mapping.js', 'MasterSapCodeMapping') || loadScript('default-sap-contractor-mapping.js', 'DefaultSapContractorMapping') || { groups: {} };
    return mappingCache;
}

function splitWorkOrders(value) {
    const raw = Array.isArray(value) ? value : [value];
    return [...new Set(raw.flatMap(v => String(v || '').split(/[,/|;]+/))
        .map(v => v.trim())
        .filter(Boolean))];
}

function stockBlockWorkOrders(block) {
    if (!block) return [];
    return splitWorkOrders([block.allWorkOrders, block.workOrders, block.docHeader]);
}

function contractorDirectory() {
    if (contractorDirectoryCache) return contractorDirectoryCache;
    const raw = loadScript('default-contractors.js', 'defaultContractorsList') || loadScript('default-contractors.js', 'DefaultContractors') || [];
    contractorDirectoryCache = raw.map(c => ({
        id: String((c && (c.id || c.name)) || '').trim(),
        name: String((c && (c.name || c.firmName)) || '').trim(),
        workOrderNo: (c && c.workOrderNo) || '',
        workOrderNumbers: (c && c.workOrderNumbers) || '',
        workOrders: (c && c.workOrders) || '',
        allWorkOrders: (c && c.allWorkOrders) || ''
    })).filter(c => c.id || c.name);
    return contractorDirectoryCache;
}

function stockKeysForQuery(query) {
    const byNorm = stockDatabase().byContractorNorm;
    const mapping = sapMapping();
    const qNorm = normId(query);
    if (!qNorm || qNorm.length < 2) return [];

    const contractors = publicContractors();
    const c = contractors.find(item => normId(item.id) === qNorm || normId(item.name) === qNorm);
    const candidateNames = [query];
    if (c) {
        if (c.id && !candidateNames.includes(c.id)) candidateNames.push(c.id);
        if (c.name && !candidateNames.includes(c.name)) candidateNames.push(c.name);
    }
    const qNorms = [...new Set(candidateNames.map(normId).filter(n => n.length >= 2))];

    const directoryMatch = contractorDirectory().find(item => qNorms.includes(normId(item.id)) || qNorms.includes(normId(item.name)));
    const desiredWos = splitWorkOrders(directoryMatch ? [
        directoryMatch.workOrderNo,
        directoryMatch.workOrderNumbers,
        directoryMatch.workOrders,
        directoryMatch.allWorkOrders
    ] : []);
    const matchesDesiredWorkOrder = block => {
        if (!desiredWos.length) return true;
        const blockWos = stockBlockWorkOrders(block);
        if (!blockWos.length) return true;
        return blockWos.some(wo => desiredWos.includes(wo));
    };

    const keys = new Set();
    for (const q of qNorms) {
        if (byNorm[q] && matchesDesiredWorkOrder(byNorm[q])) keys.add(q);
    }

    const groups = (mapping && mapping.groups) || {};
    for (const [gKey, group] of Object.entries(groups)) {
        const names = [gKey, group && group.displayName, ...((group && group.rawNorms) || [])].map(normId).filter(Boolean);
        const groupWos = splitWorkOrders((group && group.wos) || []);
        const matchesGroup = names.some(n => qNorms.includes(n)) || groupWos.some(wo => desiredWos.includes(wo));
        if (!matchesGroup) continue;
        for (const [key, block] of Object.entries(byNorm)) {
            const blockWos = stockBlockWorkOrders(block);
            if ((names.includes(key) || blockWos.some(wo => groupWos.includes(wo))) && matchesDesiredWorkOrder(block)) keys.add(key);
        }
    }

    for (const [key, block] of Object.entries(byNorm)) {
        const cName = normId(block && block.contractorName);
        if (qNorms.includes(cName) && matchesDesiredWorkOrder(block)) keys.add(key);
    }

    return [...keys];
}

module.exports = function dailyRoutes({ db, auth, drive = createDrive(), seed: providedSeed, workers = require('./daily-worker-auth')({ db, auth }) } = {}) {
    let seed = providedSeed;
    if (!seed) {
        const sandbox = { window: {} };
        vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/data/default-daily-progress.js'), 'utf8'), sandbox);
        seed = sandbox.window.DailyProgressSeed;
    }
    const items = (seed.items || []).map(({ id, name, code, unit, row }) => ({ id, name, code, unit, row }));
    const service = createService({ db, drive, items });
    const publicRouter = express.Router();
    const adminRouter = express.Router();
    const handle = fn => async (req, res) => {
        res.set('Cache-Control', 'no-store');
        try { await fn(req, res); }
        catch (error) { res.status(error.status || 503).json({ success: false, error: error.status ? error.message : 'Daily Progress service unavailable. Draft safe rakhein aur retry karein.' }); }
    };
    publicRouter.use(rateLimit({ windowMs: 60000, max: 1200, standardHeaders: true, legacyHeaders: false }));
    function sameOrigin(req, res, next) {
        if (req.headers.origin) {
            try { if (new URL(req.headers.origin).host !== req.headers.host) return res.status(403).json({ error: 'Cross-origin request blocked' }); }
            catch { return res.status(403).json({ error: 'Invalid origin' }); }
        }
        next();
    }
    publicRouter.use(sameOrigin);

    // Public, sanitized read-only data for the shareable /daily-progress.html page.
    // No PAN, GSTIN, bank details or other contractor records are exposed.
    publicRouter.get('/catalog', handle(async (req, res) => {
        const contractors = new Map(publicContractors().map(c => [c.id, c]));
        // Saved teams may not exist in the shipped contractor directory.
        const saved = readDailyProgressData(await db.getDefaultConfig('dailyProgressData'));
        for (const c of [...saved.contractors, ...await service.list()]) {
            if (!c.id || !c.name) continue;
            contractors.set(c.id, { id: c.id, name: c.name, project: c.project || '', feeder: c.feeder || '', engineer: c.engineer || '' });
        }
        res.json({ success: true, contractors: [...contractors.values()], items });
    }));
    publicRouter.get('/stock/:contractorId', handle(async (req, res) => {
        const query = String(req.params.contractorId || '').trim();
        if (!query || query.length > 150 || !/^[\w .&(),'/-]+$/.test(query)) {
            return res.status(400).json({ success: false, error: 'Invalid contractor' });
        }
        const byNorm = stockDatabase().byContractorNorm;
        const out = {};
        for (const key of stockKeysForQuery(query)) {
            const block = byNorm[key];
            if (!block) continue;
            out[key] = {
                contractorName: block.contractorName || '',
                workOrders: stockBlockWorkOrders(block),
                materials: block.materials || {}
            };
        }
        res.json({ success: true, byContractorNorm: out });
    }));

    publicRouter.use(async (req, res, next) => {
        try {
            req.dpWorker = await workers.principal(req);
            req.dpContractor = await service.authorize(req.get('x-dp-link'));
            workers.assertContractor(req.dpWorker, req.dpContractor.id);
            next();
        }
        catch (e) { res.status(e.status || 503).json({ success: false, error: e.status ? e.message : 'Entry service unavailable' }); }
    });
    publicRouter.get('/bootstrap', handle(async (req, res) => {
        const c = req.dpContractor;
        res.json({ success: true, contractor: { id: c.id, name: c.name, project: c.project, feeder: c.feeder }, items,
            today: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
            storageReady: drive.configured() });
    }));
    publicRouter.get('/report/:date', handle(async (req, res) => {
        res.json({ success: true, ...await service.access(req.dpContractor.id, req.params.date, req.get('x-dp-editor')) });
    }));
    for (const action of ['claim', 'heartbeat']) {
        publicRouter.post('/report/:date/' + action, handle(async (req, res) => {
            res.json({ success: true, ...await service.access(req.dpContractor.id, req.params.date, req.get('x-dp-editor'), action) });
        }));
    }
    publicRouter.post('/report/:date/save', handle(async (req, res) => {
        const saved = await service.save(req.dpContractor.id, req.params.date, req.get('x-dp-editor'), req.body, req.dpWorker);
        if (saved.savedBy && saved.savedAt) await workers.recordHistory({ contractorId: req.dpContractor.id, date: req.params.date, version: saved.version, savedAt: saved.savedAt, savedBy: saved.savedBy, report: saved.report, source: 'token' });
        res.json({ success: true, ...saved });
    }));

    // Mounted after the normal session middleware. Management also needs admin elevation.
    adminRouter.get('/status', handle(async (req, res) => res.json({ success: true, configured: drive.configured(), links: await service.list() })));
    adminRouter.get('/workers', auth.requireAdmin, handle(async (req, res) => res.json({ success: true, users: await workers.listUsers() })));
    adminRouter.post('/workers', auth.requireAdmin, handle(async (req, res) => res.json({ success: true, user: await workers.saveUser(req.body) })));
    adminRouter.post('/workers/disable', auth.requireAdmin, handle(async (req, res) => { await workers.disableUser(req.body.username); res.json({ success: true }); }));
    adminRouter.post('/workers/delete', auth.requireAdmin, handle(async (req, res) => { await workers.deleteUser(req.body.username); res.json({ success: true }); }));
    adminRouter.get('/entry-history', auth.requireAdmin, handle(async (req, res) => res.json({ success: true, events: await workers.history(req.query.contractorId) })));
    adminRouter.post('/storage-check', auth.requireAdmin, handle(async (req, res) => res.json({ success: true, ...await drive.check() })));
    adminRouter.post('/links', auth.requireAdmin, handle(async (req, res) => res.json({ success: true, ...await service.createLink(req.body.contractor || {}) })));
    adminRouter.post('/links/disable', auth.requireAdmin, handle(async (req, res) => res.json({ success: true, disabled: await service.disable(req.body.contractorId) })));
    adminRouter.post('/reopen', auth.requireAdmin, handle(async (req, res) => res.json({ success: true, reopened: await service.reopen(req.body.contractorId, req.body.date) })));
    adminRouter.get('/audit', auth.requireAdmin, handle(async (req, res) => res.json({ success: true, events: await service.audit(req.query.contractorId, req.query.date) })));
    adminRouter.get('/report', auth.requireAdmin, handle(async (req, res) => res.json({ success: true, ...await service.access(req.query.contractorId, req.query.date, req.get('x-dp-editor')) })));
    adminRouter.post('/claim', auth.requireAdmin, handle(async (req, res) => res.json({ success: true, ...await service.access(req.body.contractorId, req.body.date, req.get('x-dp-editor'), 'claim') })));
    adminRouter.post('/report', auth.requireAdmin, handle(async (req, res) => {
        const actor = { id: 'owner:' + (req.authSession && req.authSession.uid || 'admin'), name: 'Admin', username: 'admin', role: 'admin' };
        const saved = await service.save(req.body.contractorId, req.body.date, req.get('x-dp-editor'), req.body, actor);
        if (saved.savedBy && saved.savedAt) await workers.recordHistory({ contractorId: req.body.contractorId, date: req.body.date, version: saved.version, savedAt: saved.savedAt, savedBy: saved.savedBy, report: saved.report, source: 'token' });
        res.json({ success: true, ...saved });
    }));
    adminRouter.post('/heartbeat', auth.requireAdmin, handle(async (req, res) => res.json({ success: true, ...await service.access(req.body.contractorId, req.body.date, req.get('x-dp-editor'), 'heartbeat') })));
    adminRouter.post('/import', auth.requireAdmin, handle(async (req, res) => {
        const report = req.body.report;
        if (!report || typeof report.contractorId !== 'string') throw Object.assign(new Error('Historical report required'), { status: 400 });
        const editor = req.get('x-dp-editor');
        const status = await service.access(report.contractorId, report.date, editor, 'claim');
        if (status.version || status.state === 'final') return res.json({ success: true, skipped: true });
        if (!status.editable) throw Object.assign(new Error('Another editor is active. Historical import stopped.'), { status: 409 });
        const saved = await service.save(report.contractorId, report.date, editor, {
            report, final: true, version: status.version, epoch: status.epoch, requestId: req.body.requestId
        });
        res.json({ success: true, ...saved });
    }));
    async function readData() {
        const legacy = await db.getDefaultConfig('dailyProgressData');
        const base = readDailyProgressData(legacy);
        const reports = new Map((base.reports || []).map(r => [r.contractorId + '|' + r.date, r]));
        for (const r of [...await workers.sharedReports(), ...await service.reports()]) {
            const key = r.contractorId + '|' + r.date;
            reports.set(key, newerReport(reports.get(key), r));
        }
        const contractors = new Map((base.contractors || []).map(c => [c.id, c]));
        for (const c of await service.list()) contractors.set(c.id, c);
        const aux = { contractors: [], issues: [] };
        const auxRecords = await db.listDailyRecords('aux_');
        const auxDocs = await Promise.all(auxRecords.map(async ({ value }) => {
            if (!value?.fileId) return null;
            return drive.read(value.fileId);
        }));
        for (const stored of auxDocs) {
            if (stored?.value) aux[stored.kind === 'issue' ? 'issues' : 'contractors'].push(stored.value);
        }
        for (const c of aux.contractors) if (!contractors.has(c.id)) contractors.set(c.id, c);
        const issues = new Map((base.issues || []).map(i => [i.id, i]));
        for (const issue of aux.issues) issues.set(issue.id, issue);
        return { contractors: [...contractors.values()], reports: [...reports.values()], issues: [...issues.values()] };
    }
    adminRouter.get('/data', handle(async (req, res) => res.json({ success: true, data: await readData() })));
    adminRouter.post('/auxiliary', auth.requireAdmin, handle(async (req, res) => {
        const body = req.body;
        if (body.kind !== 'contractor' && body.kind !== 'issue') throw Object.assign(new Error('Invalid record type'), { status: 400 });
        const value = body.value || {};
        if (typeof value.id !== 'string' || !/^[\w -]{1,150}$/.test(value.id)) throw Object.assign(new Error('Invalid record ID'), { status: 400 });
        let clean;
        if (body.kind === 'contractor') {
            if (!String(value.name || '').trim()) throw Object.assign(new Error('Name required'), { status: 400 });
            clean = { id: value.id, name: String(value.name).slice(0, 200), project: String(value.project || '').slice(0, 200), feeder: String(value.feeder || '').slice(0, 200), engineer: String(value.engineer || '').slice(0, 200) };
        } else {
            if (!items.some(i => i.id === value.itemId) || !Number.isFinite(value.quantity) || value.quantity <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(value.date || '') || typeof value.contractorId !== 'string') throw Object.assign(new Error('Invalid issue'), { status: 400 });
            clean = { id: value.id, itemId: value.itemId, quantity: value.quantity, date: value.date, contractorId: value.contractorId, reference: String(value.reference || '').slice(0, 500) };
        }
        const digest = crypto.createHash('sha256').update(JSON.stringify(clean)).digest('hex');
        const key = 'aux_' + body.kind + '_' + crypto.createHash('sha256').update(clean.id).digest('hex');
        const existing = await db.atomicDailyRecord(key, old => ({ result: old }));
        if (existing && existing.digest !== digest) throw Object.assign(new Error('Record ID already exists'), { status: 409 });
        if (!existing) {
            const fileId = await drive.write(key, { kind: body.kind, value: clean, version: 1 });
            await db.atomicDailyRecord(key, old => {
                if (old && old.digest !== digest) throw Object.assign(new Error('Record ID already exists'), { status: 409 });
                return old ? { result: null } : { value: { fileId, digest }, result: null };
            });
        }
        res.json({ success: true });
    }));
    return { publicRouter, adminRouter, service, readData };
};
