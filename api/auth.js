const express = require('express');
const crypto = require('node:crypto');
const rateLimit = require('express-rate-limit');

const COOKIE = 'billing_session';
const MAX_MS = 24 * 60 * 60 * 1000;

module.exports = function createAuth({ db, config, env = process.env, fetchImpl = global.fetch, now = Date.now }) {
    const router = express.Router();
    // Idle lock window: default 4 hours — chai/lunch break ke baad refresh par dobara login nahi.
    // AUTH_IDLE_MINUTES env se tune karo (5 minute security floor rakha hai).
    const IDLE_MS = Math.max(5, Number(env.AUTH_IDLE_MINUTES) || 240) * 60 * 1000;
    const secret = env.AUTH_SESSION_SECRET || env.MONGODB_URI || env.FIREBASE_PRIVATE_KEY || env.FIREBASE_SERVICE_ACCOUNT;
    const encryptionKey = secret && crypto.createHash('sha256').update('billing-auth-v1\0' + secret).digest();
    const encrypt = value => {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
        const bytes = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
        return [iv, cipher.getAuthTag(), bytes].map(v => v.toString('base64url')).join('.');
    };
    const decrypt = value => {
        const [iv, tag, bytes] = value.split('.').map(v => Buffer.from(v, 'base64url'));
        const cipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv);
        cipher.setAuthTag(tag);
        return JSON.parse(Buffer.concat([cipher.update(bytes), cipher.final()]).toString('utf8'));
    };
    const error = (status, message) => Object.assign(new Error(message), { status });
    function cookieToken(req) {
        const value = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE + '='));
        const token = value && value.slice(COOKIE.length + 1);
        return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
    }
    const sessionKey = token => 'portal_session_' + crypto.createHash('sha256').update(token).digest('hex');
    const saveSession = session => db.saveDefaultConfig(session.key, session);
    const patchSession = (session, changes) => db.patchDefaultConfig(session.key, changes);
    function setCookie(req, res, token, clear = false) {
        res.cookie(COOKIE, token || '', {
            httpOnly: true, sameSite: 'strict', path: '/',
            secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
            maxAge: clear ? 0 : MAX_MS
        });
    }
    function view(session) {
        return {
            authenticated: true,
            serverTime: now(),
            expiresAt: Math.min(session.lastActivityAt + IDLE_MS, session.maxExpiresAt),
            adminExpiresAt: session.adminExpiresAt || 0,
            idleMinutes: Math.round(IDLE_MS / 60000)
        };
    }
    async function ownerEmail() {
        if (!encryptionKey || !config.apiKey) throw error(503, 'Login configuration incomplete');
        const record = await db.getDefaultConfig('portalAuthOwnerV1');
        const email = String(env.AUTH_REGISTERED_EMAIL || record && record.data && record.data.email || '').trim().toLowerCase();
        if (!email || !email.includes('@')) throw error(503, 'Registered recovery email is not configured');
        return email;
    }
    async function firebase(action, body) {
        let response;
        try {
            response = await fetchImpl('https://identitytoolkit.googleapis.com/v1/accounts:' + action + '?key=' + encodeURIComponent(config.apiKey), {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(12000)
            });
        } catch (e) { throw error(503, 'Login service unavailable. Please retry.'); }
        const data = await response.json();
        if (!response.ok) {
            const code = data.error && data.error.message || '';
            if (/CONFIGURATION_NOT_FOUND|OPERATION_NOT_ALLOWED|API_KEY_INVALID/.test(code)) throw error(503, 'Firebase Email/Password login is not configured');
            throw error(401, 'Email/password invalid or session expired');
        }
        return data;
    }
    async function sessionFor(req) {
        if (req.authSession) return req.authSession;
        const token = cookieToken(req);
        if (!token) throw error(401, 'Login required');
        const [record, revoked] = await Promise.all([
            db.getDefaultConfig(sessionKey(token)), db.getDefaultConfig(sessionKey(token) + '_revoked')
        ]);
        if (revoked) throw error(401, 'Session expired. Login again.');
        const session = record && record.data;
        if (!session || session.revoked || now() >= session.lastActivityAt + IDLE_MS || now() >= session.maxExpiresAt) throw error(401, 'Session expired. Login again.');
        const email = await ownerEmail();
        let tokens;
        try { tokens = decrypt(session.tokens); } catch (e) { throw error(401, 'Session expired. Login again.'); }
        if (now() >= session.tokenExpiresAt - 30000) {
            let response;
            try {
                response = await fetchImpl('https://securetoken.googleapis.com/v1/token?key=' + encodeURIComponent(config.apiKey), {
                    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken }).toString(), signal: AbortSignal.timeout(12000)
                });
            } catch (e) { throw error(503, 'Login service unavailable. Please retry.'); }
            if (!response.ok) throw error(401, 'Session expired. Login again.');
            const refreshed = await response.json();
            tokens = { idToken: refreshed.id_token, refreshToken: refreshed.refresh_token };
            session.tokens = encrypt(tokens);
            session.tokenExpiresAt = now() + Number(refreshed.expires_in) * 1000;
            await patchSession(session, { tokens: session.tokens, tokenExpiresAt: session.tokenExpiresAt });
        }
        // Lookup detects password resets/account disabling; a reset invalidates
        // existing sessions instead of accepting an old client-side unlock flag.
        const lookup = await firebase('lookup', { idToken: tokens.idToken });
        const user = lookup.users && lookup.users[0];
        if (!user || user.disabled || String(user.email).toLowerCase() !== email || user.localId !== session.uid ||
            Number(user.passwordUpdatedAt || 0) !== session.passwordUpdatedAt) throw error(401, 'Session expired. Login again.');
        req.authSession = session;
        return session;
    }
    function handler(fn) {
        return async (req, res, next) => {
            try { await fn(req, res, next); }
            catch (e) { res.status(e.status || 503).json({ success: false, error: e.status ? e.message : 'Authentication service unavailable' }); }
        };
    }
    router.use((req, res, next) => {
        res.setHeader('Cache-Control', 'no-store');
        const origin = req.headers.origin;
        if (req.method === 'POST' && origin) {
            try { if (new URL(origin).host !== req.headers.host) return res.status(403).json({ success: false, error: 'Cross-origin authentication request blocked' }); }
            catch (e) { return res.status(403).json({ success: false, error: 'Invalid origin' }); }
        }
        next();
    });
    const loginLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 15, standardHeaders: true, legacyHeaders: false, message: { success: false, error: 'Too many attempts. Please wait before retrying.' } });
    const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 3, standardHeaders: true, legacyHeaders: false, message: { success: false, error: 'Too many reset requests. Please try later.' } });
    router.post('/login', loginLimiter, handler(async (req, res) => {
        const email = await ownerEmail();
        const password = req.body && req.body.password;
        if (typeof password !== 'string' || !password || password.length > 256) throw error(401, 'Valid password required');
        const result = await firebase('signInWithPassword', { email, password, returnSecureToken: true });
        if (String(result.email).toLowerCase() !== email) throw error(401, 'Account not authorized');
        const lookup = await firebase('lookup', { idToken: result.idToken });
        const user = lookup.users && lookup.users[0];
        if (!user || user.disabled || user.localId !== result.localId) throw error(401, 'Account not authorized');
        const token = crypto.randomBytes(32).toString('hex');
        const session = {
            key: sessionKey(token), uid: result.localId, lastActivityAt: now(), maxExpiresAt: now() + MAX_MS,
            adminExpiresAt: 0, passwordUpdatedAt: Number(user.passwordUpdatedAt || 0),
            tokenExpiresAt: now() + Number(result.expiresIn) * 1000,
            tokens: encrypt({ idToken: result.idToken, refreshToken: result.refreshToken })
        };
        await saveSession(session);
        setCookie(req, res, token);
        res.json({ success: true, ...view(session) });
    }));
    router.get('/session', handler(async (req, res) => res.json({ success: true, ...view(await sessionFor(req)) })));
    router.post('/activity', handler(async (req, res) => {
        const session = await sessionFor(req);
        session.lastActivityAt = now();
        await patchSession(session, { lastActivityAt: session.lastActivityAt });
        res.json({ success: true, ...view(session) });
    }));
    router.post('/admin', loginLimiter, handler(async (req, res) => {
        const session = await sessionFor(req);
        const password = req.body && req.body.password;
        if (typeof password !== 'string' || !password || password.length > 256) throw error(401, 'Valid password required');
        await firebase('signInWithPassword', { email: await ownerEmail(), password, returnSecureToken: true });
        session.adminExpiresAt = now() + IDLE_MS;
        await patchSession(session, { adminExpiresAt: session.adminExpiresAt });
        res.json({ success: true, ...view(session) });
    }));
    router.post('/admin/lock', handler(async (req, res) => {
        const session = await sessionFor(req);
        session.adminExpiresAt = 0;
        await patchSession(session, { adminExpiresAt: 0 });
        res.json({ success: true });
    }));
    router.post('/logout', handler(async (req, res) => {
        const token = cookieToken(req);
        if (token) await db.saveDefaultConfig(sessionKey(token) + '_revoked', { revoked: true });
        setCookie(req, res, null, true);
        res.json({ success: true });
    }));
    router.post('/forgot-password', resetLimiter, handler(async (req, res) => {
        await firebase('sendOobCode', { requestType: 'PASSWORD_RESET', email: await ownerEmail() });
        res.json({ success: true, message: 'Password reset confirmation registered email par bhej diya gaya hai. Inbox/Spam check karein.' });
    }));
    const middleware = handler(async (req, res, next) => {
        if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin) {
            try { if (new URL(req.headers.origin).host !== req.headers.host) throw error(403, 'Cross-origin write blocked'); }
            catch (e) { throw error(403, 'Cross-origin write blocked'); }
        }
        await sessionFor(req);
        next();
    });
    const requireAdmin = handler(async (req, res, next) => {
        const session = await sessionFor(req);
        if (!(session.adminExpiresAt > now())) throw error(403, 'Admin verification required');
        next();
    });
    return { router, middleware, requireAdmin };
};
