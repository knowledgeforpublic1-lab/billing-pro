const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const db = require('./db');
const auth = require('./auth')({ db, config: require('./auth-settings') });

const app = express();
app.set('trust proxy', 1);

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
app.use(express.json({ limit: '15mb' }));

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
const dailyProgress = require('./daily-progress-routes')({ db, auth });
app.use('/api/daily-entry', dailyProgress.publicRouter);
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

// Serve the login shell before any confidential seed scripts can load.
async function servePortalPage(req, res) {
    res.set('Cache-Control', 'no-store');
    try {
        await auth.sessionFor(req);
        // Existing Vue templates and CDN libraries need the same capabilities as the static app.
        res.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://script.google.com https://script.googleusercontent.com; frame-src 'self' https://script.google.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
        const file = req.path.startsWith('/mobile') ? 'mobile.html' : req.path.startsWith('/Reconciliation') ? 'Reconciliation master/index.html' : 'index.html';
        res.sendFile(require('path').join(__dirname, '..', file));
    } catch (error) {
        res.sendFile(require('path').join(__dirname, '../portal-login.html'));
    }
}
app.get(['/', '/index.html', '/old', '/old/index.html', '/mobile', '/mobile.html', '/Reconciliation master/index.html', '/Reconciliation%20master/index.html'], servePortalPage);
app.use('/js/data', (req, res, next) => { res.set('Cache-Control', 'private, max-age=3600, must-revalidate'); next(); });
app.use('/api/auth', auth.router);
app.use(['/api', '/js/data'], (req, res, next) => {
    if (req.path === '/health' || req.path === '/daily-progress/data' || req.path === '/daily-progress') {
        return next();
    }
    return auth.middleware(req, res, next);
});
app.use('/api/dp-admin', dailyProgress.adminRouter);
app.get('/js/data/:file', (req, res) => {
    res.set('Cache-Control', 'private, max-age=3600, must-revalidate');
    if (!/^[a-zA-Z0-9_-]+\.js$/.test(req.params.file)) return res.status(404).end();
    res.sendFile(require('path').join(__dirname, '../js/data', req.params.file));
});
app.get('/api/daily-progress/template', (req, res) => res.sendFile(require('path').join(__dirname, '../public/daily-progress-template.xlsx')));

// Optional API key — Vercel/local me API_KEY set ho to POST+GET dono par required.
// Frontend localStorage 'billing_api_key' se 'x-api-key' header bhejta hai.
// API_KEY set nahi hai to check skip (backward compatible).
function requireApiKey(req, res, next) {
    try {
        if (req.authSession) return next();
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
    'selectedContractorId', 'contractorMappingState', 'pctStage1', 'pctStage2', 'pctStage3',
    'locations', 'activityLocations', 'activities', 'masterAbstractList', 'activityQuantities',
    'dataId', 'invoiceData', 'mappingLocks', 'mappingRoundMode', 'sapMaterialsMaster', 'savedAt',
    'poleSchedules', 'poleScheduleLocations', 'poleScheduleQuantities', 'selectedPoleScheduleKey', 'poleScheduleSubTab'
]);

function pickAllowedKeys(obj) {
    const out = {};
    for (const k of ALLOWED_SYNC_KEYS) {
        if (obj[k] !== undefined) out[k] = obj[k];
    }
    return out;
}

// Health endpoint — DB connection status (Firebase Firestore / MongoDB)
app.get('/api/health', async (req, res) => {
    try {
        let provider = db.getProvider();
        let connected = false;
        let dbError = null;
        try {
            const resConn = await db.connect();
            provider = resConn.provider || provider;
            connected = true;
        } catch (e) {
            connected = false;
            dbError = e ? e.message : 'Unknown connect error';
        }
        res.json({
            ok: connected,
            provider: provider || 'none',
            readyState: connected ? 'connected' : 'disconnected',
            hasFirebaseEnv: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_PROJECT_ID),
            firebaseDebug: typeof db.getFirebaseDebug === 'function' ? db.getFirebaseDebug() : undefined,
            error: dbError || undefined,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        log.error('HEALTH', 'Health check failed', err);
        res.status(500).json({ ok: false, readyState: 'error', timestamp: new Date().toISOString() });
    }
});

// Admin Password verification endpoint
app.post('/api/admin/verify', auth.requireAdmin, (req, res) => res.json({ success: true }));

// Routes
app.get('/api/billing', requireApiKey, async (req, res) => {
    try {
        const rawDataId = (req.query && req.query.dataId && String(req.query.dataId).trim())
            ? String(req.query.dataId).trim()
            : '';
        let state = null;
        if (!rawDataId || rawDataId === 'latest') {
            state = await db.getLatestBillingState();
        } else {
            state = await db.getBillingState(rawDataId);
            // A missing ID must not silently open a different contractor's bill.
        }
        if (!state) {
            log.info('GET', `No billing state found for ${rawDataId || 'latest'} — returning null`);
            return res.json({ success: true, data: null, dataId: rawDataId || 'main-billing-state' });
        }
        log.info('GET', `Billing state fetched for ${state.dataId} (rev: ${state.rev || 0}, provider: ${db.getProvider()})`);
        res.json({ success: true, dataId: state.dataId, data: state.stateData, updatedAt: state.updatedAt, rev: (state.rev || 0) });
    } catch (err) {
        log.error('GET', 'Error fetching billing data', err);
        res.status(500).json({ success: false, error: db.getErrorHint(err) });
    }
});

app.get('/api/bills', requireApiKey, async (req, res) => {
    try {
        const bills = await db.listBills();
        res.json({ success: true, bills, provider: db.getProvider() });
    } catch (err) {
        log.error('GET-BILLS', 'Error fetching bills list', err);
        res.status(500).json({ success: false, error: db.getErrorHint(err) });
    }
});

app.post('/api/billing/delete', requireApiKey, auth.requireAdmin, async (req, res) => {
    try {
        const dataId = req.body && req.body.dataId ? String(req.body.dataId).trim() : '';
        if (!dataId) {
            return res.status(400).json({ success: false, error: 'dataId is required' });
        }
        const count = await db.countBills();
        if (count <= 1) {
            return res.status(400).json({ success: false, error: 'Cannot delete the only existing bill. Database me kam se kam ek bill hona chahiye.' });
        }
        await db.deleteBillingState(dataId);
        log.info('DELETE-BILL', `Bill deleted: ${dataId} (${db.getProvider()})`);
        res.json({ success: true, message: 'Bill deleted successfully' });
    } catch (err) {
        log.error('DELETE-BILL', 'Error deleting bill', err);
        res.status(500).json({ success: false, error: db.getErrorHint(err) });
    }
});

app.post('/api/billing', requireApiKey, writeLimiter, async (req, res) => {
    try {
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
            log.warn('POST', 'Invalid payload received (not a JSON object)');
            return res.status(400).json({ success: false, error: 'Invalid payload: JSON object expected' });
        }

        const rawLen = JSON.stringify(req.body || {}).length;
        if (rawLen > 4 * 1024 * 1024) {
            log.warn('POST', `Payload too large: ${rawLen} bytes`);
            return res.status(413).json({ success: false, error: 'Payload too large (4MB limit — Vercel body limit)' });
        }

        // Input validation — payload must have at least one sync key (activities, projectMeta, etc.)
        const bodyKeys = Object.keys(req.body);
        if (bodyKeys.length === 0) {
            log.warn('POST', 'Empty payload received');
            return res.status(400).json({ success: false, error: 'Empty payload' });
        }

        let dataId = (req.body && req.body.dataId && String(req.body.dataId).trim())
            ? String(req.body.dataId).trim()
            : ((req.query && req.query.dataId && String(req.query.dataId).trim())
                ? String(req.query.dataId).trim()
                : '');
        if (!dataId || dataId === 'latest') {
            const latestDoc = await db.getLatestBillingState();
            dataId = (latestDoc && latestDoc.dataId) ? latestDoc.dataId : 'main-billing-state';
        }
        if (dataId && !/^[\w -]{1,150}$/.test(dataId)) {
            log.warn('POST', `Invalid dataId format: ${dataId}`);
            return res.status(400).json({ success: false, error: 'Invalid dataId format' });
        }

        const dataToSave = pickAllowedKeys(req.body || {});

        // Boolean normalization helper — strings like "false" or "0" must never coerce to true
        if (dataToSave.isFinalized !== undefined) {
            const fv = dataToSave.isFinalized;
            dataToSave.isFinalized = (fv === true || fv === 1 || fv === 'true' || fv === '1');
        }

        // Finalize lock — locked bill par koi bhi overwrite block.
        // Unlock ka ek hi rasta: explicit isFinalized:false bhejo (UI se Unlock dabane par).
        const existing = await db.getBillingState(dataId);
        if (existing && existing.stateData) {
            const previous = existing.stateData;
            const finalizedChanged = dataToSave.isFinalized !== undefined && Boolean(dataToSave.isFinalized) !== Boolean(previous.isFinalized);
            if (finalizedChanged && !(req.authSession && req.authSession.adminExpiresAt > Date.now())) {
                return res.status(403).json({ success: false, error: 'Admin verification required for structural/finalize changes' });
            }
        }
        if (existing && existing.stateData && existing.stateData.isFinalized && dataToSave.isFinalized !== false) {
            log.warn('POST', 'Save rejected — bill is finalized/locked');
            return res.status(423).json({ success: false, error: 'Bill is finalized/locked. Unlock first.' });
        }

        // Optimistic concurrency — stale tab/phone (purana rev) naya cloud data overwrite na kare.
        // Har client (desktop + mobile) har POST me baseRev bhejta hai (GET se mila rev).
        // Doc maujood hai aur baseRev missing/galat hai to 409 — koi silent overwrite nahi.
        // (Sirf pehla save — jab koi doc hi nahi hai — bina baseRev ke allowed hai.)
        const isForce = !!(req.body && req.body.force === true);
        const baseRevRaw = (req.body && req.body.baseRev !== undefined && req.body.baseRev !== null) ? Number(req.body.baseRev) : null;
        const baseRev = (baseRevRaw !== null && Number.isInteger(baseRevRaw) && baseRevRaw >= 0) ? baseRevRaw : (baseRevRaw !== null ? Math.floor(baseRevRaw) : null);
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

        // Missing-key preserve — purane clients (mobile/old build) sirf apne jaane hue
        // keys bhejte hain. Unka POST naye key (sapMaterialsMaster, activityLocations)
        // ko cloud se mita na de — absent key ko existing value se wapas bharo.
        // (Empty-overwrite check upar chal chuka hai — wahan intact rahega.)
        const incomingKeys = new Set(bodyKeys);
        for (const k of ALLOWED_SYNC_KEYS) {
            if (incomingKeys.has(k)) continue;
            if (existing && existing.stateData && existing.stateData[k] !== undefined) {
                dataToSave[k] = existing.stateData[k];
            }
        }

        // Shape guard — SAP Master sirf {code,desc,uom} objects ka non-empty array ho.
        // Garbage/empty aaya to cloud ki purani (sahi) copy hi rehne do.
        if (dataToSave.sapMaterialsMaster !== undefined) {
            const cat = dataToSave.sapMaterialsMaster;
            const ok = Array.isArray(cat) && cat.length > 0 && cat.length <= 5000
                && cat.every(x => x && typeof x === 'object' && !Array.isArray(x));
            if (!ok) {
                log.warn('POST', 'Invalid sapMaterialsMaster shape — keeping existing catalog');
                delete dataToSave.sapMaterialsMaster;
                if (existing && existing.stateData && existing.stateData.sapMaterialsMaster !== undefined) {
                    dataToSave.sapMaterialsMaster = existing.stateData.sapMaterialsMaster;
                }
            }
        }

        if (existing && !isForce && (baseRev === null || isNaN(baseRev) || (curRev > 0 && baseRev !== curRev))) {
            log.warn('POST', `Conflict detected — client baseRev: ${baseRev}, server rev: ${curRev}`);
            return res.status(409).json({
                success: false,
                conflict: true,
                error: 'Conflict: dusre PC/tab ne is beech naya save kiya hai. Pehle Refresh karo, phir apna change dobara karo.',
                data: existing.stateData,
                updatedAt: existing.updatedAt,
                rev: curRev
            });
        }

        // Structural force-sync safeguard: Never let a mapping force-save overwrite newer entered quantities
        if (existing && isForce && (curRev > 0 && baseRev !== null && baseRev !== curRev)) {
            if (existing.stateData && existing.stateData.activityQuantities) {
                dataToSave.activityQuantities = existing.stateData.activityQuantities;
            }
            if (existing.stateData && existing.stateData.invoiceData) {
                dataToSave.invoiceData = { ...existing.stateData.invoiceData, ...(dataToSave.invoiceData || {}) };
            }
        }

        const pm = dataToSave.projectMeta || {};
        const inv = dataToSave.invoiceData || {};

        const metaBillNo = String(pm.billNo || inv.invoiceNo || 'Main Bill').trim();
        const metaRaNo = String(pm.raNo || inv.raNo || '').trim();
        const metaWoNo = String(inv.workOrderNo || pm.workOrderNo || pm.poNo || inv.poNo || '').trim();
        const metaBillDate = String(pm.billDate || pm.date || inv.invoiceDate || inv.date || '').trim();
        const metaContractor = String(inv.contractorName || inv.contractorFirm || pm.contractorName || pm.contractorFirm || '').trim();
        const metaProject = String(pm.projectName || 'Billing Project').trim();
        const metaIsFinalized = !!dataToSave.isFinalized;

        let metaTaxable = 0;
        if (Array.isArray(inv.items) && inv.items.length > 0) {
            metaTaxable = inv.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
            metaTaxable = Math.round(metaTaxable * 100) / 100;
        } else if (dataToSave.activities) {
            const acts = dataToSave.activities || {};
            const qts = dataToSave.activityQuantities || {};
            let actSum = 0;
            Object.keys(acts).forEach(k => {
                const act = acts[k];
                if (act && act.rate) {
                    let q = 0;
                    const qRow = qts[k];
                    if (Array.isArray(qRow)) {
                        qRow.forEach(locRow => {
                            if (Array.isArray(locRow)) locRow.forEach(v => { q += Number(v) || 0; });
                            else q += Number(locRow) || 0;
                        });
                    } else if (qRow && typeof qRow === 'object') {
                        Object.values(qRow).forEach(v => { q += Number(v) || 0; });
                    } else {
                        q = Number(qRow) || 0;
                    }
                    actSum += q * (Number(act.rate) || 0);
                }
            });
            if (actSum > 0) {
                metaTaxable = Math.round(actSum * 0.85 * 100) / 100;
            }
        }

        let metaGst = 0;
        if (metaTaxable > 0) {
            if (inv.gstType === 'NONE') {
                metaGst = 0;
            } else {
                metaGst = Math.round(metaTaxable * 0.18 * 100) / 100;
            }
        }

        let metaGrand = Math.round((metaTaxable + metaGst) * 100) / 100;

        const nextRev = curRev + 1;
        await db.saveBillingState(dataId, {
            dataId,
            billNo: metaBillNo,
            raNo: metaRaNo,
            workOrderNo: metaWoNo,
            taxableAmount: metaTaxable,
            gstAmount: metaGst,
            grandTotal: metaGrand,
            billDate: metaBillDate,
            contractorName: metaContractor,
            projectName: metaProject,
            isFinalized: metaIsFinalized,
            stateData: dataToSave,
            rev: nextRev,
            updatedAt: new Date().toISOString()
        }, isForce ? null : baseRev);

        log.info('POST', `Data saved successfully for ${dataId} (rev: ${nextRev}, payload: ${rawLen} bytes, provider: ${db.getProvider()})`);
        res.json({ success: true, message: 'Data saved successfully', dataId, rev: nextRev, provider: db.getProvider() });
    } catch (err) {
        if (err && err.conflict) {
            log.warn('POST', `CAS Conflict on write: ${err.message}`);
            return res.status(409).json({
                success: false,
                conflict: true,
                error: 'Conflict: dusre PC/tab ne is beech naya save kiya hai. Pehle Refresh karo, phir apna change dobara karo.',
                data: err.currentData?.stateData || err.currentData,
                updatedAt: err.currentData?.updatedAt,
                rev: err.currentData?.rev
            });
        }
        log.error('POST', 'Error saving billing data', err);
        res.status(500).json({ success: false, error: db.getErrorHint(err) });
    }
});

// ============ Reconciliation (Excel-parsed dataset) — online copy ============

app.get('/api/reconciliation', requireApiKey, async (req, res) => {
    try {
        const state = await db.getReconciliationState();
        if (!state) {
            log.info('GET-RECON', 'No reconciliation state found — returning null');
            return res.json({ success: true, data: null });
        }
        log.info('GET-RECON', `Reconciliation state fetched (rev: ${state.rev || 0}, provider: ${db.getProvider()})`);
        res.json({ success: true, data: state.stateData, updatedAt: state.updatedAt, rev: (state.rev || 0) });
    } catch (err) {
        log.error('GET-RECON', 'Error fetching reconciliation data', err);
        res.status(500).json({ success: false, error: db.getErrorHint(err) });
    }
});

app.post('/api/reconciliation', requireApiKey, writeLimiter, async (req, res) => {
    try {
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
            return res.status(400).json({ success: false, error: 'Invalid payload: JSON object expected' });
        }
        const rawLen = JSON.stringify(req.body || {}).length;
        if (rawLen > 4 * 1024 * 1024) {
            log.warn('POST-RECON', `Payload too large: ${rawLen} bytes`);
            return res.status(413).json({ success: false, error: 'Payload too large (4MB limit — Vercel body limit)' });
        }
        const bodyKeys = Object.keys(req.body);
        if (bodyKeys.length === 0) {
            return res.status(400).json({ success: false, error: 'Empty payload' });
        }

        const incoming = req.body.data && typeof req.body.data === 'object' && !Array.isArray(req.body.data)
            ? req.body.data : req.body;
        const incomingContractors = Array.isArray(incoming.Contractors) ? incoming.Contractors : [];
        const existing = await db.getReconciliationState();
        const existingContractors = (existing && existing.stateData && Array.isArray(existing.stateData.Contractors))
            ? existing.stateData.Contractors : [];

        // Khali overwrite block — cloud me bhara data hai aur ye push khali aaya to reject
        if (existing && existingContractors.length > 0 && incomingContractors.length === 0) {
            log.warn('POST-RECON', 'Empty reconciliation overwrite blocked');
            return res.status(409).json({
                success: false,
                error: 'Empty data overwrite blocked — cloud me purana data safe hai',
                data: existing.stateData,
                updatedAt: existing.updatedAt,
                rev: existing.rev || 0
            });
        }

        const nextRev = ((existing && typeof existing.rev === 'number') ? existing.rev : 0) + 1;
        await db.saveReconciliationState(incoming, nextRev);
        log.info('POST-RECON', `Saved (rev: ${nextRev}, payload: ${rawLen} bytes, provider: ${db.getProvider()})`);
        res.json({ success: true, message: 'Reconciliation data saved', rev: nextRev, provider: db.getProvider() });
    } catch (err) {
        log.error('POST-RECON', 'Error saving reconciliation data', err);
        res.status(500).json({ success: false, error: db.getErrorHint(err) });
    }
});

// ============ Google Drive Upload Proxy ============
// Browser → Vercel API (same-origin, no CORS) → Google Apps Script (server-to-server, no CORS)
// Solves the GAS redirect CORS issue that blocks direct browser-to-GAS fetch calls.
// Setup guide: google-drive/README.md | Script code: google-drive/BillingDriveWebApp.gs

const DEFAULT_GDRIVE_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbw495PuqtHzuCATbRHI3dgofeWKaMVyYrUhc0twCdf0EbaPwSlpA81i0ExHdny6MZQ/exec';

function sanitizeGasUrl(url) {
    if (!url || typeof url !== 'string') return '';
    let u = url.trim().replace(/^["']|["']$/g, '');
    if (u.startsWith('http://script.google.com/')) {
        u = 'https://' + u.slice('http://'.length);
    } else if (u.startsWith('script.google.com/')) {
        u = 'https://' + u;
    }
    // Automatically redirect old retired version 2 URL to v5
    if (u.includes('AKfycbx6hHT7Xnw4SItlkrKeE3BSBuBpQDy1-gFsxq5kRdlr_3PHEK7XYjIHBPjtGWj3H9Jx')) {
        u = DEFAULT_GDRIVE_WEBHOOK_URL;
    }
    return u;
}

function validateGasUrl(webhookUrl) {
    if (!webhookUrl || typeof webhookUrl !== 'string') {
        return 'Google Drive Webhook URL missing hai — Settings me Apps Script Webhook URL lagayein';
    }
    const trimmed = webhookUrl.trim().replace(/^["']|["']$/g, '');
    if (trimmed.includes('drive.google.com')) {
        return 'Aapne Google Drive folder ka link dala hai (drive.google.com). Auto-save ke liye Apps Script Web App ka /exec URL chahiye (https://script.google.com/macros/s/.../exec).';
    }
    if (trimmed.includes('/edit')) {
        return 'Aapne Apps Script Editor ka link dala hai (.../edit). Deploy > New deployment > Web app karke "/exec" wala URL copy karein.';
    }
    if (trimmed.endsWith('/dev')) {
        return 'Aapne testing (/dev) link dala hai. New deployment > Web app karke production "/exec" wala link lagayein.';
    }
    if (!trimmed.startsWith('https://script.google.com/')) {
        return 'Invalid webhook URL — URL https://script.google.com/macros/s/.../exec format me hona chahiye.';
    }
    return null;
}

async function callGas(webhookUrl, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
        return await fetch(webhookUrl, Object.assign({ redirect: 'follow', signal: controller.signal }, options));
    } finally {
        clearTimeout(timer);
    }
}

// Connection test — app ke "🔍 Test Connection" button se GET jata hai (doGet chalta hai)
app.get('/api/gdrive-ping', requireApiKey, async (req, res) => {
    const ctx = 'GDRIVE-PING';
    try {
        const rawUrl = (req.query && req.query.url ? String(req.query.url) : '').trim();
        let effectiveWebhookUrl = sanitizeGasUrl(rawUrl);
        if (validateGasUrl(effectiveWebhookUrl)) {
            effectiveWebhookUrl = sanitizeGasUrl(process.env.GDRIVE_WEBHOOK_URL || DEFAULT_GDRIVE_WEBHOOK_URL);
        }
        const bad = validateGasUrl(effectiveWebhookUrl);
        if (bad) return res.status(400).json({ success: false, error: bad });

        const gasResponse = await callGas(effectiveWebhookUrl, { method: 'GET' });
        const text = await gasResponse.text();
        let gas;
        try { gas = JSON.parse(text); } catch (e) { gas = { raw: text.substring(0, 300) }; }

        if (gasResponse.ok && gas && (gas.ok === true || gas.status === 'success')) {
            log.info(ctx, `GAS ping OK: app=${gas.app || '?'}, root=${gas.rootFolder || '?'}`);
            return res.json({ success: true, gas });
        }
        log.warn(ctx, `GAS ping failed (${gasResponse.status}): ${text.substring(0, 200)}`);
        res.status(502).json({
            success: false,
            error: `Apps Script deployment theek nahi (HTTP ${gasResponse.status}) — New deployment → Web app → "Anyone" banao aur /exec URL use karo`,
            gas
        });
    } catch (err) {
        log.error(ctx, 'GDrive ping error', err);
        res.status(500).json({ success: false, error: 'Ping failed: ' + (err.message || 'Unknown error') });
    }
});

app.get('/api/gdrive-config', requireApiKey, async (req, res) => {
    const effectiveUrl = (process.env.GDRIVE_WEBHOOK_URL || DEFAULT_GDRIVE_WEBHOOK_URL || '').trim();
    res.json({ success: true, hasEnvWebhook: true, webhookUrl: effectiveUrl });
});

// List all bills / files in Google Drive
app.get('/api/gdrive-files', requireApiKey, async (req, res) => {
    const ctx = 'GDRIVE-FILES';
    try {
        const rawUrl = (req.query && req.query.url ? String(req.query.url) : '').trim();
        let effectiveWebhookUrl = sanitizeGasUrl(rawUrl);
        if (validateGasUrl(effectiveWebhookUrl)) {
            effectiveWebhookUrl = sanitizeGasUrl(process.env.GDRIVE_WEBHOOK_URL || DEFAULT_GDRIVE_WEBHOOK_URL);
        }
        const bad = validateGasUrl(effectiveWebhookUrl);
        if (bad) return res.status(400).json({ success: false, error: bad });

        const folderName = (req.query && req.query.folderName ? String(req.query.folderName) : 'RDSS T-10 GADCHIROLI').trim();
        const gasPayload = JSON.stringify({ action: 'list', folderName });

        const gasResponse = await callGas(effectiveWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: gasPayload
        });

        const text = await gasResponse.text();
        let json;
        try { json = JSON.parse(text); } catch (e) { json = { ok: false, error: 'Invalid response from Google Apps Script' }; }

        if (gasResponse.ok && json.ok) {
            return res.json({ success: true, files: json.files || [], rootFolder: json.rootFolder || folderName, rootFolderUrl: json.rootFolderUrl || '' });
        } else {
            return res.status(502).json({
                success: false,
                error: json.error || `Apps Script returned HTTP ${gasResponse.status}`,
                details: json
            });
        }
    } catch (err) {
        log.error(ctx, 'List files error', err);
        res.status(500).json({ success: false, error: 'Failed to list files from Google Drive: ' + (err.message || 'Unknown error') });
    }
});

// Download / retrieve file data from Google Drive
app.get('/api/gdrive-file', requireApiKey, async (req, res) => {
    const ctx = 'GDRIVE-FILE-GET';
    try {
        const rawUrl = (req.query && req.query.url ? String(req.query.url) : '').trim();
        let effectiveWebhookUrl = sanitizeGasUrl(rawUrl);
        if (validateGasUrl(effectiveWebhookUrl)) {
            effectiveWebhookUrl = sanitizeGasUrl(process.env.GDRIVE_WEBHOOK_URL || DEFAULT_GDRIVE_WEBHOOK_URL);
        }
        const bad = validateGasUrl(effectiveWebhookUrl);
        if (bad) return res.status(400).json({ success: false, error: bad });

        const fileId = (req.query && req.query.fileId ? String(req.query.fileId) : '').trim();
        if (!fileId) return res.status(400).json({ success: false, error: 'fileId is required' });

        const gasPayload = JSON.stringify({ action: 'getFile', fileId });
        const gasResponse = await callGas(effectiveWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: gasPayload
        });

        const text = await gasResponse.text();
        let json;
        try { json = JSON.parse(text); } catch (e) { json = { ok: false, error: 'Invalid response from Google Apps Script' }; }

        if (gasResponse.ok && json.ok && json.fileData) {
            let outBase64 = json.fileData;
            try {
                const rawBuf = Buffer.from(json.fileData, 'base64');
                const preview = rawBuf.slice(0, 50).toString('utf8');
                if (/^80\s*,\s*75\s*,\s*3\s*,\s*4/.test(preview)) {
                    const text = rawBuf.toString('utf8');
                    const parts = text.split(',');
                    const u8 = new Uint8Array(parts.length);
                    for (let i = 0; i < parts.length; i++) {
                        let n = parseInt(parts[i], 10);
                        if (isNaN(n)) continue;
                        if (n < 0) n = 256 + n;
                        u8[i] = n;
                    }
                    outBase64 = Buffer.from(u8).toString('base64');
                }
            } catch (e) { }
            return res.json({ success: true, fileData: outBase64, fileName: json.fileName, mimeType: json.mimeType });
        } else {
            return res.status(502).json({
                success: false,
                error: json.error || `Apps Script returned HTTP ${gasResponse.status}`,
                details: json
            });
        }
    } catch (err) {
        log.error(ctx, 'Get file error', err);
        res.status(500).json({ success: false, error: 'Failed to get file from Google Drive: ' + (err.message || 'Unknown error') });
    }
});

app.post('/api/gdrive-upload', requireApiKey, express.json({ limit: '15mb' }), async (req, res) => {
    const ctx = 'GDRIVE-PROXY';
    try {
        const { webhookUrl, folderName, folderId, contractorName, billNo, fileName, fileData, mimeType } = req.body || {};
        let effectiveWebhookUrl = sanitizeGasUrl(webhookUrl);
        if (validateGasUrl(effectiveWebhookUrl)) {
            effectiveWebhookUrl = sanitizeGasUrl(process.env.GDRIVE_WEBHOOK_URL || DEFAULT_GDRIVE_WEBHOOK_URL);
        }

        if (!effectiveWebhookUrl || !fileData || !fileName) {
            log.warn(ctx, 'Missing required fields: webhookUrl, fileData, or fileName');
            return res.status(400).json({ success: false, error: 'Missing required fields: fileData, fileName' });
        }

        const bad = validateGasUrl(effectiveWebhookUrl);
        if (bad) {
            log.warn(ctx, `Invalid webhook URL: ${String(effectiveWebhookUrl).substring(0, 50)}...`);
            return res.status(400).json({ success: false, error: bad });
        }

        // Vercel serverless request body limit 4.5MB — base64 fileData usse chhoti honi chahiye
        const MAX_BASE64 = 4.2 * 1024 * 1024;
        if (fileData.length > MAX_BASE64) {
            log.warn(ctx, `Payload too big: ${Math.round(fileData.length / 1024)}KB base64`);
            return res.status(413).json({
                success: false,
                error: `File bahut bada hai (${(fileData.length / (1024 * 1024)).toFixed(1)}MB base64, limit 4.2MB) — bill workbook chhota karo ya file seedha download karke manually Drive me daalo`
            });
        }

        const fileSizeMB = (fileData.length / (1024 * 1024)).toFixed(2);
        log.info(ctx, `Uploading to GDrive: ${fileName} (${fileSizeMB} MB base64), Contractor: ${contractorName}, Bill: ${billNo}`);

        // Forward payload to Google Apps Script — server-to-server (no CORS)
        const gasPayload = JSON.stringify({ folderName, folderId, contractorName, billNo, fileName, fileData, mimeType });

        const gasResponse = await callGas(effectiveWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: gasPayload
        });

        const responseText = await gasResponse.text();
        let responseJson;
        try {
            responseJson = JSON.parse(responseText);
        } catch (e) {
            responseJson = { status: gasResponse.ok ? 'ok' : 'error', raw: responseText.substring(0, 500) };
        }

        // GAS hamesha HTTP 200 bhejta hai — asli result JSON ke "ok"/"status" me hota hai
        const gasFailed = !gasResponse.ok || !responseJson || responseJson.ok === false || responseJson.status === 'error';
        if (gasFailed) {
            log.error(ctx, `GAS failed (${gasResponse.status}): ${responseJson && responseJson.error ? responseJson.error : responseText.substring(0, 300)}`);
            return res.status(502).json({
                success: false,
                error: (responseJson && responseJson.error) || `Google Apps Script error (${gasResponse.status})`,
                gasResponse: responseJson
            });
        }

        log.info(ctx, `GDrive upload success: ${responseJson.folder || ''}/${fileName}`);
        res.json({ success: true, message: 'File uploaded to Google Drive', gasResponse: responseJson });
    } catch (err) {
        log.error(ctx, 'GDrive proxy error', err);
        res.status(500).json({ success: false, error: 'Server-side upload failed: ' + (err.message || 'Unknown error') });
    }
});

// Contractor overrides never update another contractor's bill or the shared defaults.
function contractorMappingKey(id) {
    if (typeof id !== 'string' || !id.trim() || id.length > 160 || ['custom', '__proto__', 'constructor', 'prototype'].includes(id)) return null;
    return 'contractor_mapping_' + encodeURIComponent(id);
}
app.get('/api/contractor-mapping', requireApiKey, async (req, res) => {
    const key = contractorMappingKey(req.query.contractorId);
    if (!key) return res.status(400).json({ success: false, error: 'Valid contractorId required' });
    try {
        const record = await db.getDefaultConfig(key);
        const profile = record && record.data && record.data.serialized ? JSON.parse(record.data.serialized) : null;
        res.json({ success: true, profile });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Contractor mapping load failed' });
    }
});
app.post('/api/contractor-mapping', requireApiKey, async (req, res) => {
    const { contractorId, profile } = req.body || {};
    const key = contractorMappingKey(contractorId);
    if (!key || !profile || profile.version !== 1 || !profile.rows ||
        !profile.rows.activities || !profile.rows.poleSchedules ||
        typeof profile.rows.activities !== 'object' || typeof profile.rows.poleSchedules !== 'object') {
        return res.status(400).json({ success: false, error: 'Valid contractorId and mapping profile required' });
    }
    const validRows = ['activities', 'poleSchedules'].every(kind =>
        !Array.isArray(profile.rows[kind]) && Object.values(profile.rows[kind]).every(schedule =>
            schedule && typeof schedule === 'object' && !Array.isArray(schedule) && Object.values(schedule).every(row =>
                row && typeof row === 'object' && !Array.isArray(row) &&
                (row.sapItems === undefined || (Array.isArray(row.sapItems) && row.sapItems.every(item => item && typeof item === 'object'))) &&
                ['itemCode', 'sapDescription', 'sapUom', 'docHeader', 'activityMaterialNo'].every(field => row[field] === undefined || typeof row[field] === 'string')
            )
        )
    );
    if (!validRows) return res.status(400).json({ success: false, error: 'Invalid material mapping rows' });
    try {
        const stored = { version: 1, rows: profile.rows, updatedAt: Number(profile.updatedAt) || Date.now(), dirty: false };
        // A string replaces the complete override map even on Firestore merge writes.
        await db.saveDefaultConfig(key, { serialized: JSON.stringify(stored) });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Contractor mapping save failed' });
    }
});

// Dedicated Daily Progress Data API — completely isolated from Billing state
app.get('/api/daily-progress/data', async (req, res) => {
    try {
        const legacy = await db.getDefaultConfig('dailyProgressData');
        res.json({ success: true, data: legacy?.data || legacy || null });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
app.post('/api/daily-progress/data', express.json({ limit: '15mb' }), async (req, res) => {
    try {
        const payload = req.body && req.body.data !== undefined ? req.body.data : req.body;
        if (!payload || typeof payload !== 'object') {
            return res.status(400).json({ success: false, error: 'Invalid payload' });
        }

        // Server-side smart merge — prevents whole-dataset overwrite across multiple site devices
        const existingRec = await db.getDefaultConfig('dailyProgressData');
        const existingData = existingRec?.data || existingRec || { contractors: [], reports: [], issues: [] };

        const cMap = new Map();
        (existingData.contractors || []).forEach(c => cMap.set(String(c.id || c.name).toLowerCase(), c));
        (payload.contractors || []).forEach(c => {
            const key = String(c.id || c.name).toLowerCase();
            if (key) cMap.set(key, c);
        });

        const rMap = new Map();
        (existingData.reports || []).forEach(r => rMap.set(String(r.contractorId).toLowerCase() + '|' + r.date, r));
        (payload.reports || []).forEach(r => {
            const key = String(r.contractorId).toLowerCase() + '|' + r.date;
            const prev = rMap.get(key);
            if (!prev || (Number(r.version || 0) >= Number(prev.version || 0))) {
                rMap.set(key, r);
            }
        });

        const iMap = new Map();
        (existingData.issues || []).forEach(i => iMap.set(i.id || (i.contractorId + '|' + i.itemId + '|' + i.date), i));
        (payload.issues || []).forEach(i => {
            const key = i.id || (i.contractorId + '|' + i.itemId + '|' + i.date);
            iMap.set(key, i);
        });

        const merged = {
            contractors: Array.from(cMap.values()),
            reports: Array.from(rMap.values()),
            issues: Array.from(iMap.values()),
            updatedAt: new Date().toISOString()
        };

        await db.saveDefaultConfig('dailyProgressData', { data: merged, updatedAt: new Date().toISOString() });
        res.json({ success: true, count: merged.reports.length });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
app.get('/api/daily-progress', (req, res) => res.redirect(307, '/api/daily-progress/data'));
app.post('/api/daily-progress', (req, res) => res.redirect(307, '/api/daily-progress/data'));

// POST: Save shared pole schedule defaults without overwriting existing bills.
app.post('/api/save-default-pole-schedules', requireApiKey, auth.requireAdmin, express.json({ limit: '15mb' }), async (req, res) => {
    const ctx = 'SAVE-DEFAULT-POLE-SCHEDULES';
    try {
        const { poleSchedules } = req.body || {};
        if (!poleSchedules || typeof poleSchedules !== 'object' || Object.keys(poleSchedules).length === 0) {
            return res.status(400).json({ success: false, error: 'poleSchedules object is required' });
        }
        const fsMod = require('fs');
        const pathMod = require('path');
        const targetPath = pathMod.join(__dirname, '..', 'js', 'data', 'default-pole-schedules.js');

        const content = '/**\n * @file Default Pole Schedules Master Data\n * @description Standard bill-of-materials pole schedules for 11 KV RSJ/PSC line activities.\n * Hard-coded Master Defaults (Auto-updated from UI Mapping).\n */\n\nconst defaultPoleSchedules = ' + JSON.stringify(poleSchedules, null, 2) + ';\n\nif (typeof window !== \'undefined\') {\n    window.defaultPoleSchedules = defaultPoleSchedules;\n}\nif (typeof module !== \'undefined\' && module.exports) {\n    module.exports = defaultPoleSchedules;\n}\n';

        let diskSaved = false;
        let cloudSaved = false;
        try {
            fsMod.writeFileSync(targetPath, content, 'utf8');
            diskSaved = true;
            log.info(ctx, `Successfully written ${Object.keys(poleSchedules).length} pole schedules to default-pole-schedules.js on disk`);
        } catch (fsErr) {
            log.warn(ctx, `Disk file write failed (e.g. read-only serverless environment): ${fsErr.message}`);
        }

        // Also persist to Cloud Database for cross-PC synchronization
        try {
            await db.saveDefaultConfig('poleSchedulesMaster', poleSchedules);
            cloudSaved = true;
            log.info(ctx, `Successfully synced pole schedules to Cloud Database (${db.getProvider()}) for cross-PC persistence`);
        } catch (dbErr) {
            log.warn(ctx, `Cloud backup skipped/failed: ${dbErr.message}`);
        }

        if (!diskSaved && !cloudSaved) {
            return res.status(500).json({ success: false, error: 'Disk aur Cloud dono jagah save fail ho gaya. Data update nahi hua.' });
        }

        return res.json({
            success: true,
            diskSaved,
            cloudSaved,
            message: 'Hard-coded default-pole-schedules.js updated successfully!',
            count: Object.keys(poleSchedules).length
        });
    } catch (err) {
        log.error(ctx, 'Failed to save default-pole-schedules.js', err);
        return res.status(500).json({ success: false, error: err.message || 'Unknown error' });
    }
});

// GET: Fetch default pole schedules from Cloud or File
app.get('/api/default-pole-schedules', async (req, res) => {
    try {
        try {
            const record = await db.getDefaultConfig('poleSchedulesMaster');
            if (record && record.data && Object.keys(record.data).length > 0) {
                return res.json({ success: true, poleSchedules: record.data, source: db.getProvider() });
            }
        } catch (e) { }

        const targetPath = require('path').join(__dirname, '..', 'js', 'data', 'default-pole-schedules.js');
        if (require('fs').existsSync(targetPath)) {
            delete require.cache[require.resolve(targetPath)];
            const fileData = require(targetPath);
            return res.json({ success: true, poleSchedules: fileData, source: 'disk' });
        }
        res.status(404).json({ success: false, error: 'Default pole schedules not found' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST: UI Mapping ↔ hardcode default-activities.js (+ SAP master) on disk & Cloud Database
app.post('/api/save-default-activities', requireApiKey, auth.requireAdmin, express.json({ limit: '15mb' }), async (req, res) => {
    const ctx = 'SAVE-DEFAULT-ACTIVITIES';
    try {
        const body = req.body || {};
        const { activities, sapMaterialsMaster } = body;
        const isActObj = activities && typeof activities === 'object' && Object.keys(activities).length > 0;
        const isSapArr = sapMaterialsMaster && typeof sapMaterialsMaster === 'object' &&
            (Array.isArray(sapMaterialsMaster) || Object.keys(sapMaterialsMaster).length > 0);
        if (!isActObj && !isSapArr) {
            return res.status(400).json({ success: false, error: 'activities object ya sapMaterialsMaster array required hai' });
        }

        const fsMod = require('fs');
        const pathMod = require('path');
        let wroteFiles = [];

        if (isActObj) {
            const targetPath = pathMod.join(__dirname, '..', 'js', 'data', 'default-activities.js');
            const content = '/**\n * @file Activities Master Data\n * @description Master configuration for all 11 activities with material specifications,\n * units, rates, SAP codes, and default item mappings.\n * Hard-coded Master Defaults (Auto-updated from UI Mapping via /api/save-default-activities).\n *\n * @global {Object} defaultActivities\n * @since v2.0\n */\n\nconst defaultActivities = ' + JSON.stringify(activities, null, 2) + ';\n\nif (typeof window !== \'undefined\') {\n    window.defaultActivities = defaultActivities;\n}\nif (typeof module !== \'undefined\' && module.exports) {\n    module.exports = defaultActivities;\n}\n';
            try {
                fsMod.writeFileSync(targetPath, content, 'utf8');
                wroteFiles.push('default-activities.js');
                log.info(ctx, `Successfully wrote ${Object.keys(activities).length} activities to default-activities.js on disk`);
            } catch (fsErr) {
                log.warn(ctx, `Disk file write failed (e.g. read-only serverless environment): ${fsErr.message}`);
            }
        }

        if (isSapArr) {
            try {
                const sapPath = pathMod.join(__dirname, '..', 'js', 'data', 'default-sap-materials.js');
                const list = Array.isArray(sapMaterialsMaster) ? sapMaterialsMaster : (sapMaterialsMaster.items || []);
                const content = '/**\n * @file SAP Materials Master Data\n * @description Approved list of SAP material codes with descriptions, UOMs, and categories.\n * Hard-coded Master Defaults (Auto-updated from UI Mapping).\n *\n * @global {Array} defaultSapMaterialsMaster\n * @since v1.0\n */\n\nconst defaultSapMaterialsMaster = ' + JSON.stringify(list, null, 2) + ';\n\nif (typeof window !== \'undefined\') {\n    window.defaultSapMaterialsMaster = defaultSapMaterialsMaster;\n}\nif (typeof module !== \'undefined\' && module.exports) {\n    module.exports = defaultSapMaterialsMaster;\n}\n';
                fsMod.writeFileSync(sapPath, content, 'utf8');
                wroteFiles.push('default-sap-materials.js');
                log.info(ctx, `Successfully wrote ${list.length} SAP master items to default-sap-materials.js on disk`);
            } catch (fsErr) {
                log.warn(ctx, `SAP master disk write failed: ${fsErr.message}`);
            }
        }

        // Cloud Database DefaultConfig — cross-PC master persistence
        let cloudSaved = false;
        try {
            if (isActObj) {
                await db.saveDefaultConfig('activitiesMaster', activities);
            }
            if (isSapArr) {
                await db.saveDefaultConfig('sapMaterialsMaster', Array.isArray(sapMaterialsMaster) ? sapMaterialsMaster : (sapMaterialsMaster.items || []));
            }
            cloudSaved = true;
            log.info(ctx, `Successfully synced activities mapping to Cloud Database (${db.getProvider()})`);
        } catch (dbErr) {
            log.warn(ctx, `Cloud backup skipped/failed: ${dbErr.message}`);
        }

        if (wroteFiles.length === 0 && !cloudSaved) {
            return res.status(500).json({ success: false, error: 'Disk aur Cloud dono jagah mapping save fail ho gayi.' });
        }

        return res.json({
            success: true,
            message: 'Mapping master disk & cloud me save ho gayi!',
            files: wroteFiles,
            cloudSaved,
            provider: db.getProvider(),
            count: isActObj ? Object.keys(activities).length : 0
        });
    } catch (err) {
        log.error(ctx, 'Failed to save default-activities mapping', err);
        return res.status(500).json({ success: false, error: err.message || 'Unknown error' });
    }
});

// GET: Fetch default activities mapping from Cloud ya disk file
app.get('/api/default-activities', async (req, res) => {
    try {
        try {
            const record = await db.getDefaultConfig('activitiesMaster');
            if (record && record.data && Object.keys(record.data).length > 0) {
                return res.json({ success: true, activities: record.data, source: db.getProvider() });
            }
        } catch (e) { }

        const targetPath = require('path').join(__dirname, '..', 'js', 'data', 'default-activities.js');
        if (require('fs').existsSync(targetPath)) {
            delete require.cache[require.resolve(targetPath)];
            const fileData = require(targetPath);
            return res.json({ success: true, activities: fileData, source: 'disk' });
        }
        res.status(404).json({ success: false, error: 'Default activities mapping not found' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Unknown portal URLs also show the login gate; never fall through to static index.html.
app.get('/{*rest}', (req, res) => {
    if (req.path.startsWith('/api/') || /\.[a-z0-9]+$/i.test(req.path)) return res.status(404).json({ success: false, error: 'Not found' });
    return servePortalPage(req, res);
});

// Express JSON body errors (jaise 5MB limit) → Hinglish JSON message (HTML ki jagah)
app.use((err, req, res, next) => {
    if (err && err.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            error: 'Request body limit (5MB) exceed — file bahut bada hai. Bill workbook chhota karo ya seedha download karke manually upload karo.'
        });
    }
    if (err) {
        log.error('MIDDLEWARE', `Error on ${req.method} ${req.path}`, err);
        return res.status(500).json({ success: false, error: 'Server error: ' + (err.message || 'Unknown') });
    }
    next();
});

// Export the app for Vercel
module.exports = app;

