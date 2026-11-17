const crypto = require('node:crypto');
const { promisify } = require('node:util');
const express = require('express');
const rateLimit = require('express-rate-limit');
const scrypt = promisify(crypto.scrypt);
const hash = text => crypto.createHash('sha256').update(String(text)).digest('hex');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const COOKIE = 'dp_worker_session';

module.exports = function createWorkerAuth({ db, auth, now = Date.now }) {
    const router = express.Router();
    const read = key => db.atomicDailyRecord(key, value => ({ result: value }));
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
        // 4. Fallback check as email or mobile without strict formatting
        if (raw.includes('@')) {
            const directEmailUser = await read(userKey(raw.toLowerCase()));
            if (directEmailUser && !directEmailUser.deleted) return directEmailUser;
        }
        return null;
    }

    async function principal(req) {
        if (auth && typeof auth.sessionFor === 'function' && /(?:^|;\s*)billing_session=/.test(req.headers.cookie || '')) {
            try {
                const owner = await auth.sessionFor(req);
                return { id: 'owner:' + owner.uid, name: 'Admin', username: 'admin', email: 'admin@system', mobile: '', role: 'admin', contractorIds: [] };
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
        return publicUser(user);
    }

    function assertContractor(actor, cid) {
        if (!actor || (actor.role !== 'admin' && !actor.contractorIds.includes(cid))) {
            fail(403, 'Is contractor ki entry aapke login mein allowed nahi hai.');
        }
    }

    // Public available contractor list for signup
    router.get('/contractors', handler(async (req, res) => {
        const raw = await db.getDefaultConfig('dailyProgressData');
        const contractors = (raw && raw.data && raw.data.contractors || []).map(c => ({ id: c.id, name: c.name }));
        res.json({ success: true, contractors });
    }));

    // Public login (Email, Mobile, or Username)
    router.post('/login', rateLimit({
        windowMs: 10 * 60 * 1000,
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, error: 'Bahut login attempts hue. 10 minute baad retry karein.' }
    }), handler(async (req, res) => {
        const identifier = String(req.body.identifier || req.body.username || req.body.email || req.body.mobile || '').trim();
        const password = req.body.password;
        if (!identifier || typeof password !== 'string' || password.length > 256) {
            fail(401, 'Email / Mobile number ya password galat hai.');
        }
        const user = await resolveUser(identifier);
        const salt = user && user.salt || 'unknown-entry-account';
        const derived = await scrypt(password, salt, 64);
        const expected = Buffer.from(user && user.passwordHash || '00'.repeat(64), 'hex');
        if (!user || user.disabled || expected.length !== derived.length || !crypto.timingSafeEqual(derived, expected)) {
            fail(401, 'Email / Mobile number ya password galat hai.');
        }
        const token = crypto.randomBytes(32).toString('hex');
        await db.atomicDailyRecord('dp_worker_session_' + hash(token), () => ({
            value: { username: user.username, revision: user.revision, expiresAt: now() + 12 * 60 * 60 * 1000 },
            result: null
        }));
        setCookie(req, res, token);
        res.json({ success: true, user: publicUser(user) });
    }));

    // Public worker signup (Name, Email, Mobile, Password, Contractors)
    router.post('/signup', rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, error: 'Bahut signup attempts hue. Thoda ruk kar retry karein.' }
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
        res.json({ success: true, user: publicUser(user) });
    }));

    router.get('/session', handler(async (req, res) => res.json({ success: true, user: await principal(req) })));

    router.post('/logout', handler(async (req, res) => {
        const part = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE + '='));
        const token = part && part.slice(COOKIE.length + 1);
        if (/^[a-f0-9]{64}$/.test(token || '')) {
            await db.atomicDailyRecord('dp_worker_session_' + hash(token), () => ({ value: { expiresAt: 0 }, result: null }));
        }
        setCookie(req, res, '', true);
        res.json({ success: true });
    }));

    async function saveUser(body, options = {}) {
        const name = String(body.name || '').trim();
        const rawEmail = String(body.email || '').trim().toLowerCase();
        const digits = String(body.mobile || '').replace(/[\s\-+]/g, '');
        const mobile = digits.length >= 10 ? digits.slice(-10) : '';
        let username = String(body.username || '').trim().toLowerCase();

        if (!name || name.length < 2 || name.length > 80) {
            fail(400, 'Kripya apna pura naam (2 se 80 character) daalein.');
        }

        if (options.isPublicSignup) {
            if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(rawEmail)) {
                fail(400, 'Kripya sahi email address daalein (e.g. name@example.com).');
            }
            if (!/^[6-9]\d{9}$/.test(mobile)) {
                fail(400, 'Kripya sahi 10-digit mobile number daalein.');
            }
        } else {
            // Admin creation can provide username directly or email/mobile
            if (rawEmail && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(rawEmail)) {
                fail(400, 'Kripya valid email address daalein.');
            }
            if (mobile && !/^[6-9]\d{9}$/.test(mobile)) {
                fail(400, 'Kripya valid 10-digit mobile number daalein.');
            }
        }

        if (!username) {
            if (mobile) username = 'm_' + mobile;
            else if (rawEmail) username = 'u_' + hash(rawEmail).slice(0, 14);
            else fail(400, 'Username, email ya mobile number zaroori hai.');
        } else if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
            fail(400, 'Username 3–40 characters ka hona chahiye (a-z, 0-9, ., _, -).');
        }

        if (typeof body.password !== 'string' || body.password.length < 6 || body.password.length > 128) {
            fail(400, 'Password kam se kam 6 character ka hona chahiye.');
        }

        let contractorIds = Array.isArray(body.contractorIds) ? [...new Set(body.contractorIds)].filter(id => typeof id === 'string' && id && id.length <= 150) : [];
        if (!contractorIds.length) {
            const raw = await db.getDefaultConfig('dailyProgressData');
            const list = (raw && raw.data && raw.data.contractors || []).map(c => c.id);
            contractorIds = list.length ? list : ['default'];
        }

        // Check duplicate email
        if (rawEmail) {
            const existingEmail = await read(emailIndexKey(rawEmail));
            if (existingEmail && existingEmail.username !== username && !body.reset) {
                fail(409, 'Is email se account pehle se registered hai. Login karein.');
            }
        }

        // Check duplicate mobile
        if (mobile) {
            const existingMobile = await read(mobileIndexKey(mobile));
            if (existingMobile && existingMobile.username !== username && !body.reset) {
                fail(409, 'Is mobile number se account pehle se registered hai. Login karein.');
            }
        }

        const salt = crypto.randomBytes(24).toString('hex');
        const passwordHash = (await scrypt(body.password, salt, 64)).toString('hex');

        const savedResult = await db.atomicDailyRecord(userKey(username), old => {
            if (old && !body.reset) fail(409, 'Account pehle se bana hai. Login karein ya reset option use karein.');
            if (!old && body.reset) fail(404, 'Login nahi mila. Pehle naya login banayein.');
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
        const key = 'entry_event_' + hash(contractorId) + '_' + String(9999999999999 - stamp).padStart(13, '0') + '_' + hash(source + '|' + date + '|' + version);
        const value = { contractorId, date, version, savedAt, savedBy, source, quantities: report.quantities || {}, manpower: report.manpower || {}, remarks: report.remarks || '' };
        await db.atomicDailyRecord(key, old => old ? { result: null } : { value, result: null });
    }

    async function sharedReports() {
        return (await db.listDailyRecords('shared_report_')).map(row => row.value.report).filter(Boolean);
    }

    async function history(cid) {
        if (typeof cid !== 'string' || !cid || cid.length > 150) fail(400, 'Contractor select karein.');
        return (await db.listDailyRecords('entry_event_' + hash(cid) + '_', { limit: 100 })).map(row => row.value).sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, 100);
    }

    return {
        router,
        principal,
        assertContractor,
        saveUser,
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
            const controlled = await read('report_' + hash(cid) + '_' + date);
            if (controlled && (controlled.state === 'final' || controlled.fileId || controlled.leaseUntil > now())) {
                fail(controlled.state === 'final' ? 423 : 409, 'Is date ki entry reserved/locked hai. Admin se reopen ya sahi entry link lein.');
            }
            const digest = hash(JSON.stringify({ quantities: incoming.quantities || {}, manpower: incoming.manpower || {}, remarks: incoming.remarks || '' }));
            const report = await db.atomicDailyRecord('shared_report_' + hash(cid + '|' + date), old => {
                if (old && old.digest === digest) return { result: old.report };
                const base = old && old.report || previous;
                if (Number(incoming.version) !== Number(base && base.version || 0) + 1) {
                    fail(409, 'Nayi entry pehle se saved hai. Apna draft safe rakhein aur latest report load karein.');
                }
                const next = {
                    ...incoming,
                    version: Number(base && base.version || 0) + 1,
                    updatedAt: new Date(now()).toISOString(),
                    savedAt: new Date(now()).toISOString(),
                    savedBy: { id: actor.id, name: actor.name, username: actor.username, email: actor.email || '', mobile: actor.mobile || '', role: actor.role }
                };
                return { value: { digest, report: next }, result: next };
            });
            await recordHistory({ contractorId: cid, date, version: report.version, savedAt: report.savedAt, savedBy: report.savedBy, report, source: 'share' });
            return report;
        }
    };
};
