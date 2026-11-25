const crypto = require('node:crypto');
const { promisify } = require('node:util');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { readDailyProgressData, newerReport, reportKey, controlKey, locationId: normalizeLocation } = require('./daily-progress-data');
const scrypt = promisify(crypto.scrypt);
const hash = text => crypto.createHash('sha256').update(String(text)).digest('hex');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const COOKIE = 'dp_worker_session';

module.exports = function createWorkerAuth({ db, auth, now = Date.now, drive }) {
    const router = express.Router();
    const locations = require('./daily-progress-locations')({ db });
    const read = key => db.getDailyAuthRecord && /^dp_worker_/.test(key)
        ? db.getDailyAuthRecord(key) : db.atomicDailyRecord(key, value => ({ result: value }));
    const userKey = username => 'dp_worker_user_' + hash(String(username).toLowerCase());
    const emailIndexKey = email => 'dp_worker_idx_email_' + hash(String(email).trim().toLowerCase());
    const mobileIndexKey = mobile => 'dp_worker_idx_mob_' + hash(String(mobile).replace(/[\s\-+]/g, '').slice(-10));

    const publicUser = user => ({
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email || '',
        mobile: user.mobile || '',
        contractorIds: Array.isArray(user.contractorIds) ? user.contractorIds : [],
        disabled: !!user.disabled,
        role: user.role || 'worker'
    });

    const handler = fn => async (req, res) => {
        res.set('Cache-Control', 'no-store');
        try { await fn(req, res); }
        catch (e) { res.status(e.status || 503).json({ success: false, error: e.status ? e.message : 'Entry service unavailable. Retry karein.' }); }
    };

    router.use((req, res, next) => {
        res.set('Cache-Control', 'no-store');
        if (req.method !== 'GET' && req.headers.origin) {
            try { if (new URL(req.headers.origin).host !== req.headers.host) return res.status(403).json({ success: false, error: 'Cross-origin request blocked' }); }
            catch { return res.status(403).json({ success: false, error: 'Invalid origin' }); }
        }
        next();
    });

    function setCookie(req, res, token, clear = false) {
        res.cookie(COOKIE, token || '', {
            httpOnly: true,
            sameSite: 'strict',
            secure: req.secure || req.get('x-forwarded-proto') === 'https',
            path: '/',
            maxAge: clear ? 0 : 12 * 60 * 60 * 1000
        });
    }

    async function resolveUser(rawIdentifier) {
        const raw = String(rawIdentifier || '').trim();
        if (!raw) return null;
        // 1. If email format
        if (raw.includes('@')) {
            const idx = await read(emailIndexKey(raw));
            if (idx && idx.username) {
                const u = await read(userKey(idx.username));
                if (u) return u;
            }
        }
        // 2. If phone number
        const digits = raw.replace(/[\s\-+]/g, '');
        if (/^[6-9]\d{9}$/.test(digits.slice(-10))) {
            const idx = await read(mobileIndexKey(digits.slice(-10)));
            if (idx && idx.username) {
                const u = await read(userKey(idx.username));
                if (u) return u;
            }
        }
        // 3. Direct username lookup
        const direct = await read(userKey(raw.toLowerCase()));
        if (direct && !direct.deleted) return direct;
        return null;
    }

    async function principal(req) {
        if (auth && typeof auth.sessionFor === 'function' && /(?:^|;\s*)billing_session=/.test(req.headers.cookie || '')) {
            try {
                const owner = await auth.sessionFor(req);
                return shareView(req, { id: 'owner:' + owner.uid, name: 'Admin', username: 'admin', email: 'admin@system', mobile: '', role: 'admin', contractorIds: [] });
            } catch (e) {
                if (e.status !== 401) throw e;
            }
        }
        const part = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE + '='));
        const token = part && part.slice(COOKIE.length + 1);
        if (!/^[a-f0-9]{64}$/.test(token || '')) fail(401, 'Apne entry username/email aur password se login karein.');
        const session = await read('dp_worker_session_' + hash(token));
        if (!session || session.expiresAt <= now()) fail(401, 'Entry login expire ho gaya. Dobara login karein.');
        const user = await read(userKey(session.username));
        if (!user || user.disabled || user.deleted || session.revision !== user.revision) fail(401, 'Entry login disabled ya password badal gaya hai.');
        return shareView(req, publicUser(user));
    }

    // A shared page may reduce an existing session's scope; it never grants access.
    function shareView(req, actor) {
        const header = req.headers['x-dp-share-contractor'];
        if (header === undefined) return actor;
        let cid;
        try { cid = decodeURIComponent(header); } catch { fail(400, 'Invalid contractor link.'); }
        if (!cid || cid.length > 150 || cid === '*' || cid === 'all') fail(400, 'Valid contractor link required.');
        assertContractor(actor, cid);
        return { ...actor, ...(actor.role === 'admin' ? { name: 'Contractor entry', email: '', mobile: '' } : {}), role: 'worker', contractorIds: [cid], availableContractorIds: actor.role === 'admin' ? ['*'] : actor.contractorIds, sharedView: true };
    }

    function normId(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/^m\/s\.?\s*/i, '')
            .replace(/[^a-z0-9]/g, '')
            .replace(/enterp[ei]+ses?|enterises?|eterprises?/g, 'enterprise');
    }

    function hasContractorPermission(actor, cid) {
        if (!actor) return false;
        if (actor.role === 'admin') return true;
        const list = actor.contractorIds || [];
        if (list.includes('*') || list.includes('all')) return true;
        const cidNorm = normId(cid);
        if (!cidNorm) return false;
        for (const allowedId of list) {
            if (allowedId === '*' || allowedId === 'all') return true;
            if (allowedId === cid) return true;
            if (normId(allowedId) === cidNorm) return true;
        }
        return false;
    }

    function assertContractor(actor, cid) {
        if (!hasContractorPermission(actor, cid)) {
            fail(403, 'You do not have permission to access this contractor.');
        }
    }

    function defaultContractors() {
        try {
            const vm = require('node:vm');
            const fs = require('node:fs');
            const path = require('node:path');
            const sandbox = { window: {} };
            vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/data/default-contractors.js'), 'utf8'), sandbox);
            vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/data/default-daily-progress.js'), 'utf8'), sandbox);
            const raw = sandbox.window.defaultContractorsList || sandbox.window.DefaultContractors || [];
            return [...raw, sandbox.window.DailyProgressSeed.contractor].map(c => ({ id: c.id, name: c.name || c.firmName }));
        } catch {
            return [];
        }
    }

    async function listContractors() {
        const saved = readDailyProgressData(await db.getDefaultConfig('dailyProgressData'));
        const links = await db.listDailyRecords('contractor_');
        const auxiliary = await db.listDailyRecords('aux_contractor_');
        const extra = [];
        for (const { value } of auxiliary) {
            if (value?.contractor) extra.push(value.contractor);
            else if (value?.fileId) {
                const stored = await (drive || require('./daily-drive')()).read(value.fileId);
                if (stored?.kind === 'contractor' && stored.value) extra.push(stored.value);
            }
        }
        const contractors = new Map();
        for (const c of [...defaultContractors(), ...saved.contractors, ...links.map(row => row.value), ...extra]) {
            if (c?.id && c.name) contractors.set(c.id, { id: c.id, name: c.name });
        }
        return [...contractors.values()];
    }

    async function validateContractors(values, { allowAll = false, allowEmpty = false } = {}) {
        if (!Array.isArray(values) || values.length > 500 || values.some(id => typeof id !== 'string' || !id.trim() || id.length > 150)) fail(400, 'Valid contractor selections required.');
        const ids = [...new Set(values.map(id => id.trim()))];
        if (ids.includes('*') || ids.includes('all')) {
            if (!allowAll) fail(400, 'Select individual contractors for signup.');
            return ['*'];
        }
        if (!ids.length && !allowEmpty) fail(400, 'Select at least one contractor. You can select five or more.');
        const known = new Set((await listContractors()).map(c => c.id));
        if (ids.some(id => !known.has(id))) fail(400, 'A selected contractor is unavailable. Refresh the contractor list.');
        return ids;
    }

    // Public sanitized names for the searchable signup checklist.
    router.get('/contractors', handler(async (req, res) => res.json({ success: true, contractors: await listContractors() })));

    // Public login (Email, Mobile, or Username)
    router.post('/login', rateLimit({
        windowMs: 10 * 60 * 1000,
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, error: 'Too many login attempts. Please try again after 10 minutes.' }
    }), handler(async (req, res) => {
        const identifier = String(req.body.identifier || req.body.username || req.body.email || req.body.mobile || '').trim();
        const password = req.body.password;
        if (!identifier || typeof password !== 'string' || password.length > 256) {
            fail(401, 'Incorrect email/mobile number or password.');
        }
        const user = await resolveUser(identifier);
        const salt = user && user.salt || 'unknown-entry-account';
        const derived = await scrypt(password, salt, 64);
        const expected = Buffer.from(user && user.passwordHash || '00'.repeat(64), 'hex');
        if (!user || user.disabled || user.deleted || expected.length !== derived.length || !crypto.timingSafeEqual(derived, expected)) {
            fail(401, 'Incorrect email/mobile number or password.');
        }
        const token = crypto.randomBytes(32).toString('hex');
        await db.atomicDailyRecord('dp_worker_session_' + hash(token), () => ({
            value: { username: user.username, revision: user.revision, expiresAt: now() + 12 * 60 * 60 * 1000 },
            result: null
        }));
        setCookie(req, res, token);
        res.json({ success: true, user: shareView(req, publicUser(user)) });
    }));

    // Public worker signup (Name, Email, Mobile, Password, Contractors)
    router.post('/signup', rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, error: 'Too many signup attempts. Please wait a moment and retry.' }
    }), handler(async (req, res) => {
        const body = req.body || {};
        const saved = await saveUser(body, { isPublicSignup: true });
        const user = await read(userKey(saved.username));
        const token = crypto.randomBytes(32).toString('hex');
        await db.atomicDailyRecord('dp_worker_session_' + hash(token), () => ({
            value: { username: user.username, revision: user.revision, expiresAt: now() + 12 * 60 * 60 * 1000 },
            result: null
        }));
        setCookie(req, res, token);
        res.json({ success: true, user: shareView(req, publicUser(user)) });
    }));

    router.get('/session', handler(async (req, res) => res.json({ success: true, user: await principal(req) })));
    router.get('/history', handler(async (req, res) => {
        const actor = await principal(req), cid = String(req.query.contractorId || '');
        assertContractor(actor, cid);
        res.json({ success: true, history: await history(cid) });
    }));
    router.get('/locations', handler(async (req, res) => {
        const actor = await principal(req), cid = String(req.query.contractorId || '');
        assertContractor(actor, cid);
        res.json({ success: true, locations: await locations.list(cid) });
    }));
    router.post('/locations', handler(async (req, res) => {
        const actor = await principal(req), cid = req.body.contractorId;
        assertContractor(actor, cid);
        res.json({ success: true, location: await locations.create(cid, req.body.name, actor) });
    }));

    router.post('/logout', handler(async (req, res) => {
        const part = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE + '='));
        const token = part && part.slice(COOKIE.length + 1);
        if (/^[a-f0-9]{64}$/.test(token || '')) {
            await db.atomicDailyRecord('dp_worker_session_' + hash(token), () => ({ value: { expiresAt: 0 }, result: null }));
        }
        setCookie(req, res, '', true);
        res.json({ success: true });
    }));

    router.post('/unlock', handler(async (req, res) => {
        const actor = await principal(req);
        const { contractorId, date, locationId } = req.body || {};
        const result = await unlock(actor, contractorId, date, locationId);
        res.json({ success: true, ...result });
    }));

    async function saveUser(body, options = {}) {
        if (options.isPublicSignup && body.reset) fail(400, 'Signup cannot reset an existing account. Contact admin.');
        const name = String(body.name || '').trim();
        const rawEmail = String(body.email || '').trim().toLowerCase();
        const digits = String(body.mobile || '').replace(/[\s\-+]/g, '');
        const mobile = digits.length >= 10 ? digits.slice(-10) : '';
        let username = String(body.username || '').trim().toLowerCase();

        if (!name || name.length < 2 || name.length > 80) {
            fail(400, 'Please enter your full name (2 to 80 characters).');
        }

        if (options.isPublicSignup) {
            if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(rawEmail)) {
                fail(400, 'Please enter a valid email address (e.g. name@example.com).');
            }
            if (!/^[6-9]\d{9}$/.test(mobile)) {
                fail(400, 'Please enter a valid 10-digit mobile number.');
            }
        } else {
            // Admin creation can provide username directly or email/mobile
            if (rawEmail && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(rawEmail)) {
                fail(400, 'Please enter a valid email address.');
            }
            if (mobile && !/^[6-9]\d{9}$/.test(mobile)) {
                fail(400, 'Please enter a valid 10-digit mobile number.');
            }
        }

        if (!username) {
            if (mobile) username = 'm_' + mobile;
            else if (rawEmail) username = 'u_' + hash(rawEmail).slice(0, 14);
            else fail(400, 'Username, email, or mobile number is required.');
        } else if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
            fail(400, 'Username must be 3-40 characters (a-z, 0-9, ., _, -).');
        }

        if (typeof body.password !== 'string' || body.password.length < 6 || body.password.length > 128) {
            fail(400, 'Password must be at least 6 characters.');
        }

        const contractorIds = await validateContractors(body.contractorIds, { allowAll: !options.isPublicSignup });

        // Check duplicate email
        if (rawEmail) {
            const existingEmail = await read(emailIndexKey(rawEmail));
            if (existingEmail && existingEmail.username !== username && !body.reset) {
                fail(409, 'An account with this email address already exists. Please sign in.');
            }
        }

        // Check duplicate mobile
        if (mobile) {
            const existingMobile = await read(mobileIndexKey(mobile));
            if (existingMobile && existingMobile.username !== username && !body.reset) {
                fail(409, 'An account with this mobile number already exists. Please sign in.');
            }
        }

        const salt = crypto.randomBytes(24).toString('hex');
        const passwordHash = (await scrypt(body.password, salt, 64)).toString('hex');

        const savedResult = await db.atomicDailyRecord(userKey(username), old => {
            if (old && !body.reset) fail(409, 'An account already exists. Please sign in.');
            if (!old && body.reset) fail(404, 'Account not found. Please create an account first.');
            const user = {
                id: old && old.id || crypto.randomUUID(),
                name,
                email: rawEmail || (old && old.email) || '',
                mobile: mobile || (old && old.mobile) || '',
                username,
                contractorIds,
                salt,
                passwordHash,
                revision: (old && old.revision || 0) + 1,
                disabled: false,
                role: 'worker',
                createdAt: old && old.createdAt || new Date(now()).toISOString()
            };
            return { value: user, result: publicUser(user) };
        });

        // Store lookup indices
        if (rawEmail) {
            await db.atomicDailyRecord(emailIndexKey(rawEmail), () => ({ value: { username }, result: null }));
        }
        if (mobile) {
            await db.atomicDailyRecord(mobileIndexKey(mobile), () => ({ value: { username }, result: null }));
        }

        return savedResult;
    }

    async function disableUser(username) {
        if (typeof username !== 'string' || !/^[a-z0-9._-]{3,40}$/.test(username)) fail(400, 'Valid username required');
        await db.atomicDailyRecord(userKey(username), old => {
            if (!old) fail(404, 'Login nahi mila.');
            return { value: { ...old, disabled: true, revision: old.revision + 1 }, result: null };
        });
    }

    async function assignContractors(body) {
        const username = body.username;
        if (typeof username !== 'string' || !/^[a-z0-9._-]{3,40}$/.test(username)) fail(400, 'Valid username required');
        const contractorIds = await validateContractors(body.contractorIds, { allowAll: true, allowEmpty: true });
        return db.atomicDailyRecord(userKey(username), old => {
            if (!old || old.deleted) fail(404, 'Worker login not found.');
            // Sessions read these permissions on every request; credentials and sessions stay intact.
            const user = { ...old, contractorIds, permissionsUpdatedAt: new Date(now()).toISOString() };
            return { value: user, result: publicUser(user) };
        });
    }

    async function deleteUser(username) {
        if (typeof username !== 'string' || !/^[a-z0-9._-]{3,40}$/.test(username)) fail(400, 'Valid username required');
        const user = await read(userKey(username));
        if (!user) fail(404, 'Login nahi mila.');
        if (user.email) {
            await db.atomicDailyRecord(emailIndexKey(user.email), () => ({ value: null, result: null }));
        }
        if (user.mobile) {
            await db.atomicDailyRecord(mobileIndexKey(user.mobile), () => ({ value: null, result: null }));
        }
        await db.atomicDailyRecord(userKey(username), old => {
            if (!old) return { result: null };
            return { value: { ...old, deleted: true, disabled: true, revision: (old.revision || 0) + 1 }, result: null };
        });
    }

    async function recordHistory({ contractorId, date, version, savedAt, savedBy, report, source }) {
        const stamp = Date.parse(savedAt);
        const key = 'entry_event_' + hash(contractorId) + '_' + String(9999999999999 - stamp).padStart(13, '0') + '_' + hash(source + '|' + date + '|' + normalizeLocation(report.locationId) + '|' + version);
        const value = { contractorId, date, locationId: normalizeLocation(report.locationId), locationName: report.locationName || 'Legacy / Unassigned', version, savedAt, savedBy, source, quantities: report.quantities || {}, manpower: report.manpower || {}, remarks: report.remarks || '' };
        await db.atomicDailyRecord(key, old => old ? { result: null } : { value, result: null });
    }

    async function sharedReports() {
        const legacy = (await db.listDailyRecords('shared_report_')).map(row => row.value && row.value.report).filter(Boolean);
        const controlled = (await db.listDailyRecords('control_')).map(row => row.value && (row.value.baseReport || {
            contractorId: row.value.contractorId,
            date: row.value.date,
            locationId: row.value.locationId,
            locationName: row.value.locationName,
            state: row.value.state,
            version: row.value.version,
            deleted: row.value.deleted,
            savedAt: row.value.savedAt,
            savedBy: row.value.savedBy
        })).filter(Boolean);
        return [...legacy, ...controlled];
    }

    async function history(cid) {
        if (typeof cid !== 'string' || !cid || cid.length > 150) fail(400, 'Contractor select karein.');
        return (await db.listDailyRecords('entry_event_' + hash(cid) + '_', { limit: 100 })).map(row => row.value).sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, 100);
    }

    return {
        router,
        principal,
        assertContractor,
        hasContractorPermission,
        saveUser,
        assignContractors,
        listContractors,
        disableUser,
        deleteUser,
        recordHistory,
        sharedReports,
        history,
        async listUsers() {
            return (await db.listDailyRecords('dp_worker_user_'))
                .filter(row => row.value && row.value.id && !row.value.deleted)
                .map(row => publicUser(row.value));
        },
        async saveShared(actor, incoming, previous) {
            assertContractor(actor, incoming.contractorId);
            const cid = incoming.contractorId, date = incoming.date;
            const locationId = normalizeLocation(incoming.locationId);
            const location = locationId ? await locations.get(cid, locationId) : null;
            const legacy = await read('shared_report_' + hash(reportKey({ contractorId: cid, date, locationId })));
            const digest = hash(JSON.stringify({ quantities: incoming.quantities || {}, manpower: incoming.manpower || {}, remarks: incoming.remarks || '' }));
            const isFinal = incoming.final === true || incoming.state === 'final';
            const report = await db.atomicDailyRecord(controlKey(cid, date, locationId), old => {
                if (old && actor.role !== 'admin' && (old.state === 'final' || old.fileId || old.leaseUntil > now() || old.operation?.until > now())) {
                    fail(old.state === 'final' ? 423 : 409, 'Is date ki entry save hone ke baad lock ho chuki hai. Sirf Admin hi ise unlock kar sakta hai.');
                }
                if (old?.sharedDigest === digest && old.baseReport && !old.deleted) return { result: old.baseReport };
                let base = newerReport(previous, legacy?.report);
                if (old?.version > Number(base?.version || 0)) base = { version: old.version };
                if (Number(incoming.version) !== Number(base && base.version || 0) + 1) {
                    fail(409, 'Nayi entry pehle se saved hai. Apna draft safe rakhein aur latest report load karein.');
                }
                const nextState = isFinal ? 'final' : (old?.state || 'open');
                const next = {
                    ...incoming,
                    locationId, locationName: location?.name || 'Legacy / Unassigned',
                    version: Number(base && base.version || 0) + 1,
                    state: nextState,
                    final: isFinal,
                    updatedAt: new Date(now()).toISOString(),
                    savedAt: new Date(now()).toISOString(),
                    savedBy: { id: actor.id, name: actor.name, username: actor.username, email: actor.email || '', mobile: actor.mobile || '', role: actor.role }
                };
                return { value: { ...(old || {}), contractorId: cid, date, locationId, state: nextState, version: next.version, epoch: old?.epoch || 0, baseReport: next, sharedDigest: digest, deleted: false, managed: false }, result: next };
            });
            await recordHistory({ contractorId: cid, date, version: report.version, savedAt: report.savedAt, savedBy: report.savedBy, report, source: 'share' });
            return report;
        },
        async unlock(actor, cid, date, locationId) {
            if (actor.role !== 'admin') fail(403, 'Sirf Admin hi saved entry ko unlock kar sakta hai.');
            if (typeof cid !== 'string' || !cid) fail(400, 'Contractor required.');
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) fail(400, 'Valid date required.');
            const lid = normalizeLocation(locationId);
            const key = controlKey(cid, date, lid);
            const existingRecord = await read(key);
            let fallbackReport = existingRecord?.baseReport || null;
            if (!fallbackReport && existingRecord?.fileId && drive && drive.read) {
                try { fallbackReport = await drive.read(existingRecord.fileId); } catch {}
            }
            if (!fallbackReport) {
                const legacyShared = await read('shared_report_' + hash(reportKey({ contractorId: cid, date, locationId: lid })));
                if (legacyShared?.report) fallbackReport = legacyShared.report;
            }
            if (!fallbackReport && db.getDefaultConfig) {
                try {
                    const legacyConfig = await db.getDefaultConfig('dailyProgressData');
                    const legacyData = readDailyProgressData(legacyConfig);
                    for (const row of legacyData.reports || []) {
                        if (row.contractorId === cid && row.date === date && normalizeLocation(row.locationId) === lid) {
                            fallbackReport = newerReport(fallbackReport, row);
                        }
                    }
                } catch {}
            }
            return db.atomicDailyRecord(key, old => {
                const r = { ...(old || {}), contractorId: cid, date, locationId: lid, state: 'open' };
                const base = r.baseReport || fallbackReport;
                if (base) {
                    r.baseReport = {
                        ...base,
                        contractorId: cid,
                        date,
                        locationId: lid,
                        state: 'open',
                        final: false
                    };
                }
                r.epoch = (r.epoch || 0) + 1;
                delete r.owner;
                delete r.operation;
                r.leaseUntil = 0;
                delete r.lastRequestId;
                r.audit = [...(r.audit || []), { action: 'admin_unlock', at: now(), by: actor.username }].slice(-100);
                return { value: r, result: { success: true, state: 'open', report: r.baseReport || null } };
            });
        }
    };
};
