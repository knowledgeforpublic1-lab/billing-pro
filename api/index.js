const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Structured logging helper
const log = {
    info: (ctx, msg) => console.log(`[${new Date().toISOString()}] [INFO] [${ctx}] ${msg}`),
    warn: (ctx, msg) => console.warn(`[${new Date().toISOString()}] [WARN] [${ctx}] ${msg}`),
    error: (ctx, msg, err) => console.error(`[${new Date().toISOString()}] [ERROR] [${ctx}] ${msg}`, err || ''),
};

// Security headers
app.use(helmet());

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Rate limiting — brute-force / spam POST se bachao (serverless per-instance memory store)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests, thoda ruk kar retry karo' }
});
const writeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many saves, 1 min ruk kar retry karo' }
});
app.use('/api/', apiLimiter);

// Attach rate-limit info headers to every response
app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        if (body && typeof body === 'object') {
            body._rateLimit = {
                windowMs: req.rateLimit ? req.rateLimit.windowMs : undefined,
                remaining: req.rateLimit ? req.rateLimit.remaining : undefined,
                limit: req.rateLimit ? req.rateLimit.limit : undefined,
            };
        }
        return originalJson(body);
    };
    next();
});

// Optional API key — Vercel/local me API_KEY set ho to POST+GET dono par required.
// Frontend localStorage 'billing_api_key' se 'x-api-key' header bhejta hai.
// API_KEY set nahi hai to check skip (local dev backward compatible).
function requireApiKey(req, res, next) {
    try {
        const expected = (process.env.API_KEY || '').trim();
        if (!expected) return next();
        const got = (req.header('x-api-key') || '').trim()
            || (req.query && req.query.api_key ? String(req.query.api_key).trim() : '');
        if (got !== expected) {
            log.warn('AUTH', `Unauthorized request from ${req.ip}`);
            return res.status(401).json({ success: false, error: 'Unauthorized: valid x-api-key header required' });
        }
        next();
    } catch (err) {
        log.error('AUTH', 'Error in API key validation', err);
        next(err);
    }
}

// Sirf ye fields save honge — kachra / history / bade blob Mongo me nahi jayenge (space kam hai)
const ALLOWED_SYNC_KEYS = new Set([
    'isFinalized', 'projectMeta', 'selectedCompanyId', 'contractorsList',
    'selectedContractorId', 'pctStage1', 'pctStage2', 'pctStage3',
    'locations', 'activityLocations', 'activities', 'masterAbstractList', 'activityQuantities',
    'invoiceData', 'mappingLocks', 'savedAt'
]);

function pickAllowedKeys(obj) {
    const out = {};
    for (const k of ALLOWED_SYNC_KEYS) {
        if (obj[k] !== undefined) out[k] = obj[k];
    }
    return out;
}

// MongoDB Connection Caching for Serverless
let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb) {
        return cachedDb;
    }
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
        throw new Error('MONGODB_URI env is not defined. Vercel env variables ya local .env me set karo.');
    }

    log.info('DB', 'Connecting to MongoDB Atlas...');
    const client = await mongoose.connect(MONGODB_URI, { family: 4 });
    cachedDb = client;
    log.info('DB', 'Successfully connected to MongoDB Atlas');
    return client;
}

// 500 ka exact kaaran client tak pahuchao (password kabhi nahi bhejte — sirf hint)
function dbErrorHint(err) {
    const msg = (err && err.message ? err.message : String(err || ''));
    if (/MONGODB_URI env is not defined/.test(msg)) return 'MONGODB_URI env missing hai — Vercel env vars me dalo + redeploy karo';
    if (/bad auth|authentication failed/i.test(msg)) return 'MongoDB username/password galat hai — Atlas Database Access me check karo';
    if (/IP|whitelist|network|timed out|ECONNREFUSED|ENOTFOUND/i.test(msg)) return 'MongoDB tak network nahi pahunch raha — Atlas Network Access me 0.0.0.0/0 allow karo';
    return 'Database error — Vercel Logs me pura error dekho';
}

// Billing State Schema and Model (rev = optimistic-concurrency version;
// purana khula tab naya cloud data overwrite na kar paye)
const billingStateSchema = new mongoose.Schema({
    dataId: { type: String, default: 'main-billing-state', unique: true },
    stateData: { type: Object, required: true },
    rev: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now }
});

const BillingState = mongoose.models.BillingState || mongoose.model('BillingState', billingStateSchema);

// Health endpoint — DB connection status
app.get('/api/health', async (req, res) => {
    try {
        const ready = mongoose.connection.readyState === 1;
        res.json({
            ok: ready,
            readyState: ready ? 'connected' : 'disconnected',
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        log.error('HEALTH', 'Health check failed', err);
        res.status(500).json({ ok: false, readyState: 'error', error: err.message, timestamp: new Date().toISOString() });
    }
});

// Routes
app.get('/api/billing', requireApiKey, async (req, res) => {
    try {
        await connectToDatabase();
        const state = await BillingState.findOne({ dataId: 'main-billing-state' });
        if (!state) {
            log.info('GET', 'No billing state found — returning null');
            return res.json({ success: true, data: null });
        }
        log.info('GET', `Billing state fetched (rev: ${state.rev || 0})`);
        res.json({ success: true, data: state.stateData, updatedAt: state.updatedAt, rev: (state.rev || 0) });
    } catch (err) {
        log.error('GET', 'Error fetching billing data', err);
        res.status(500).json({ success: false, error: dbErrorHint(err) });
    }
});

app.post('/api/billing', requireApiKey, writeLimiter, async (req, res) => {
    try {
        await connectToDatabase();

        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
            log.warn('POST', 'Invalid payload received (not a JSON object)');
            return res.status(400).json({ success: false, error: 'Invalid payload: JSON object expected' });
        }

        const rawLen = JSON.stringify(req.body || {}).length;
        if (rawLen > 800 * 1024) {
            log.warn('POST', `Payload too large: ${rawLen} bytes`);
            return res.status(413).json({ success: false, error: 'Payload too large (800KB limit, Mongo me jagah kam hai)' });
        }

        // Input validation — required fields for sync
        if (!req.body.docId || req.body.state === undefined || typeof req.body.baseRev !== 'number') {
            log.warn('POST', `Missing required fields — docId: ${!!req.body.docId}, state: ${req.body.state !== undefined}, baseRev type: ${typeof req.body.baseRev}`);
            return res.status(400).json({ success: false, error: 'Missing required fields: docId, state, baseRev' });
        }

        const dataToSave = pickAllowedKeys(req.body || {});

        // Finalize lock — locked bill par koi bhi overwrite block.
        // Unlock ka ek hi rasta: explicit isFinalized:false bhejo (UI se Unlock dabane par).
        const existing = await BillingState.findOne({ dataId: 'main-billing-state' });
        if (existing && existing.stateData && existing.stateData.isFinalized && dataToSave.isFinalized !== false) {
            log.warn('POST', 'Save rejected — bill is finalized/locked');
            return res.status(423).json({ success: false, error: 'Bill is finalized/locked. Unlock first.' });
        }

        // Optimistic concurrency — stale tab/phone (purana rev) naya cloud data overwrite na kare.
        // Har client (desktop + mobile) har POST me baseRev bhejta hai (GET se mila rev).
        // Doc maujood hai aur baseRev missing/galat hai to 409 — koi silent overwrite nahi.
        // (Sirf pehla save — jab koi doc hi nahi hai — bina baseRev ke allowed hai.)
        const baseRev = (req.body && req.body.baseRev !== undefined && req.body.baseRev !== null)
            ? Number(req.body.baseRev) : null;
        const curRev = (existing && typeof existing.rev === 'number') ? existing.rev : 0;

        // Khali-state overwrite block — cloud me bhara data hai aur ye push khali aaya
        // (fresh/default state, corrupt copy) to reject. Koi reset nahi hoga.
        const incomingActs = (dataToSave.activities && typeof dataToSave.activities === 'object' && !Array.isArray(dataToSave.activities)) ? dataToSave.activities : {};
        const existingActs = (existing && existing.stateData && existing.stateData.activities && typeof existing.stateData.activities === 'object' && !Array.isArray(existing.stateData.activities)) ? existing.stateData.activities : {};
        if (existing && Object.keys(existingActs).length > 0 && Object.keys(incomingActs).length === 0) {
            log.warn('POST', 'Empty data overwrite blocked');
            return res.status(409).json({
                success: false,
                error: 'Empty data overwrite blocked — cloud me tumhara purana data safe hai. Pehle Refresh karo.',
                data: existing.stateData,
                updatedAt: existing.updatedAt,
                rev: curRev
            });
        }

        if (existing && (baseRev === null || isNaN(baseRev) || baseRev !== curRev)) {
            log.warn('POST', `Conflict detected — client baseRev: ${baseRev}, server rev: ${curRev}`);
            return res.status(409).json({
                success: false,
                error: 'Conflict: dusre PC/tab ne is beech naya save kiya hai. Pehle Refresh karo, phir apna change dobara karo.',
                data: existing.stateData,
                updatedAt: existing.updatedAt,
                rev: curRev
            });
        }

        const nextRev = curRev + 1;
        await BillingState.findOneAndUpdate(
            { dataId: 'main-billing-state' },
            {
                stateData: dataToSave,
                rev: nextRev,
                updatedAt: new Date()
            },
            { upsert: true, new: true }
        );

        log.info('POST', `Data saved successfully (rev: ${nextRev}, payload: ${rawLen} bytes)`);
        res.json({ success: true, message: 'Data saved successfully', rev: nextRev });
    } catch (err) {
        log.error('POST', 'Error saving billing data', err);
        res.status(500).json({ success: false, error: dbErrorHint(err) });
    }
});

// Export the app for Vercel
module.exports = app;
