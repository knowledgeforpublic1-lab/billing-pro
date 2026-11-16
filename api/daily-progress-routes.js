const express = require('express');
const rateLimit = require('express-rate-limit');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const createService = require('./daily-progress-service');
const createDrive = require('./daily-drive');
const crypto = require('node:crypto');

module.exports = function dailyRoutes({ db, auth, drive = createDrive(), seed: providedSeed } = {}) {
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
    publicRouter.use(async (req, res, next) => {
        try { req.dpContractor = await service.authorize(req.get('x-dp-link')); next(); }
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
        res.json({ success: true, ...await service.save(req.dpContractor.id, req.params.date, req.get('x-dp-editor'), req.body) });
    }));

    // Mounted after the normal session middleware. Management also needs admin elevation.
    adminRouter.get('/status', handle(async (req, res) => res.json({ success: true, configured: drive.configured(), links: await service.list() })));
    adminRouter.post('/storage-check', auth.requireAdmin, handle(async (req, res) => res.json({ success: true, ...await drive.check() })));
    adminRouter.post('/links', auth.requireAdmin, handle(async (req, res) => res.json({ success: true, ...await service.createLink(req.body.contractor || {}) })));
    adminRouter.post('/links/disable', auth.requireAdmin, handle(async (req, res) => res.json({ success: true, disabled: await service.disable(req.body.contractorId) })));
    adminRouter.post('/reopen', auth.requireAdmin, handle(async (req, res) => res.json({ success: true, reopened: await service.reopen(req.body.contractorId, req.body.date) })));
    adminRouter.get('/audit', auth.requireAdmin, handle(async (req, res) => res.json({ success: true, events: await service.audit(req.query.contractorId, req.query.date) })));
    adminRouter.get('/report', handle(async (req, res) => res.json({ success: true, ...await service.access(req.query.contractorId, req.query.date, req.get('x-dp-editor')) })));
    adminRouter.post('/claim', handle(async (req, res) => res.json({ success: true, ...await service.access(req.body.contractorId, req.body.date, req.get('x-dp-editor'), 'claim') })));
    adminRouter.post('/report', handle(async (req, res) => res.json({ success: true, ...await service.save(req.body.contractorId, req.body.date, req.get('x-dp-editor'), req.body) })));
    adminRouter.post('/heartbeat', handle(async (req, res) => res.json({ success: true, ...await service.access(req.body.contractorId, req.body.date, req.get('x-dp-editor'), 'heartbeat') })));
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
    adminRouter.get('/data', handle(async (req, res) => {
        const legacy = await db.getDefaultConfig('dailyProgressData');
        const base = legacy?.data || { contractors: [], reports: [], issues: [] };
        const reports = new Map((base.reports || []).map(r => [r.contractorId + '|' + r.date, r]));
        for (const r of await service.reports()) reports.set(r.contractorId + '|' + r.date, r);
        const contractors = new Map((base.contractors || []).map(c => [c.id, c]));
        for (const c of await service.list()) contractors.set(c.id, c);
        const aux = { contractors: [], issues: [] };
        for (const { value } of await db.listDailyRecords('aux_')) {
            const stored = await drive.read(value.fileId);
            aux[stored.kind === 'issue' ? 'issues' : 'contractors'].push(stored.value);
        }
        for (const c of aux.contractors) if (!contractors.has(c.id)) contractors.set(c.id, c);
        const issues = new Map((base.issues || []).map(i => [i.id, i]));
        for (const issue of aux.issues) issues.set(issue.id, issue);
        res.json({ success: true, data: { contractors: [...contractors.values()], reports: [...reports.values()], issues: [...issues.values()] } });
    }));
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
    return { publicRouter, adminRouter, service };
};
