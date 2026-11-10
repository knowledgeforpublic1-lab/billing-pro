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
app.use(express.json({ limit: '5mb' }));

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
    billNo: { type: String, default: '' },
    raNo: { type: String, default: '' },
    workOrderNo: { type: String, default: '' },
    taxableAmount: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    billDate: { type: String, default: '' },
    contractorName: { type: String, default: '' },
    projectName: { type: String, default: '' },
    isFinalized: { type: Boolean, default: false },
    stateData: { type: Object, required: true },
    rev: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
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
        const rawDataId = (req.query && req.query.dataId && String(req.query.dataId).trim())
            ? String(req.query.dataId).trim()
            : '';
        let state = null;
        if (!rawDataId || rawDataId === 'latest') {
            state = await BillingState.findOne({}).sort({ updatedAt: -1 });
        } else {
            state = await BillingState.findOne({ dataId: rawDataId });
            // If requested dataId was not found, fallback to the latest active bill
            if (!state) {
                state = await BillingState.findOne({}).sort({ updatedAt: -1 });
            }
        }
        if (!state) {
            log.info('GET', `No billing state found for ${rawDataId || 'latest'} — returning null`);
            return res.json({ success: true, data: null, dataId: rawDataId || 'main-billing-state' });
        }
        log.info('GET', `Billing state fetched for ${state.dataId} (rev: ${state.rev || 0})`);
        res.json({ success: true, dataId: state.dataId, data: state.stateData, updatedAt: state.updatedAt, rev: (state.rev || 0) });
    } catch (err) {
        log.error('GET', 'Error fetching billing data', err);
        res.status(500).json({ success: false, error: dbErrorHint(err) });
    }
});

app.get('/api/bills', requireApiKey, async (req, res) => {
    try {
        await connectToDatabase();
        const docs = await BillingState.find({})
            .select('dataId billNo raNo workOrderNo taxableAmount gstAmount grandTotal billDate contractorName projectName isFinalized rev updatedAt createdAt stateData.projectMeta stateData.invoiceData stateData.activities stateData.activityQuantities')
            .sort({ updatedAt: -1 })
            .lean();
        
        const bills = docs.map(doc => {
            const pm = (doc.stateData && doc.stateData.projectMeta) || {};
            const inv = (doc.stateData && doc.stateData.invoiceData) || {};

            let ra = String(doc.raNo || pm.raNo || inv.raNo || '').trim();
            let billNo = String(doc.billNo || pm.billNo || inv.invoiceNo || '').trim();
            if (billNo === 'Main Bill') billNo = '';

            let displayBillNo = '';
            if (billNo) {
                displayBillNo = billNo;
            } else if (ra) {
                displayBillNo = 'RA-' + ra.padStart(2, '0');
            } else {
                displayBillNo = doc.dataId === 'main-billing-state' ? 'Main Bill' : 'Draft Bill';
            }

            const workOrderNo = doc.workOrderNo || inv.workOrderNo || pm.workOrderNo || pm.poNo || inv.poNo || '—';
            const contractor = doc.contractorName || inv.contractorName || inv.contractorFirm || pm.contractorName || pm.contractorFirm || 'Not Assigned';
            const billDate = doc.billDate || inv.invoiceDate || pm.billDate || pm.date || '—';

            let taxable = Number(doc.taxableAmount || 0);
            let gst = Number(doc.gstAmount || 0);
            let grand = Number(doc.grandTotal || 0);

            if (taxable === 0 && Array.isArray(inv.items) && inv.items.length > 0) {
                taxable = inv.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
                taxable = Math.round(taxable * 100) / 100;
            }

            if (taxable === 0 && doc.stateData && doc.stateData.activities) {
                const acts = doc.stateData.activities || {};
                const qts = doc.stateData.activityQuantities || {};
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
                    taxable = Math.round(actSum * 0.85 * 100) / 100;
                }
            }

            if (gst === 0 && taxable > 0) {
                if (inv.gstType === 'NONE') {
                    gst = 0;
                } else {
                    gst = Math.round(taxable * 0.18 * 100) / 100;
                }
            }

            if (grand === 0 && taxable > 0) {
                grand = Math.round((taxable + gst) * 100) / 100;
            }

            return {
                dataId: doc.dataId || 'main-billing-state',
                billNo: displayBillNo,
                raNo: ra,
                workOrderNo: workOrderNo,
                billDate: billDate,
                contractorName: contractor,
                projectName: doc.projectName || pm.projectName || 'Billing Project',
                taxableAmount: taxable,
                gstAmount: gst,
                totalAmount: grand,
                grandTotal: grand,
                isFinalized: doc.isFinalized !== undefined ? !!doc.isFinalized : !!(doc.stateData && doc.stateData.isFinalized),
                rev: doc.rev || 0,
                updatedAt: doc.updatedAt || new Date()
            };
        });
        res.json({ success: true, bills });
    } catch (err) {
        log.error('GET-BILLS', 'Error fetching bills list', err);
        res.status(500).json({ success: false, error: dbErrorHint(err) });
    }
});

app.post('/api/billing/delete', requireApiKey, async (req, res) => {
    try {
        await connectToDatabase();
        const dataId = req.body && req.body.dataId ? String(req.body.dataId).trim() : '';
        if (!dataId) {
            return res.status(400).json({ success: false, error: 'dataId is required' });
        }
        const count = await BillingState.countDocuments();
        if (count <= 1) {
            return res.status(400).json({ success: false, error: 'Cannot delete the only existing bill. Database me kam se kam ek bill hona chahiye.' });
        }
        await BillingState.deleteOne({ dataId });
        log.info('DELETE-BILL', `Bill deleted: ${dataId}`);
        res.json({ success: true, message: 'Bill deleted successfully' });
    } catch (err) {
        log.error('DELETE-BILL', 'Error deleting bill', err);
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
            const latestDoc = await BillingState.findOne({}).sort({ updatedAt: -1 });
            dataId = (latestDoc && latestDoc.dataId) ? latestDoc.dataId : 'main-billing-state';
        }

        const dataToSave = pickAllowedKeys(req.body || {});

        // Finalize lock — locked bill par koi bhi overwrite block.
        // Unlock ka ek hi rasta: explicit isFinalized:false bhejo (UI se Unlock dabane par).
        const existing = await BillingState.findOne({ dataId });
        if (existing && existing.stateData && existing.stateData.isFinalized && dataToSave.isFinalized !== false) {
            log.warn('POST', 'Save rejected — bill is finalized/locked');
            return res.status(423).json({ success: false, error: 'Bill is finalized/locked. Unlock first.' });
        }

        // Optimistic concurrency — stale tab/phone (purana rev) naya cloud data overwrite na kare.
        // Har client (desktop + mobile) har POST me baseRev bhejta hai (GET se mila rev).
        // Doc maujood hai aur baseRev missing/galat hai to 409 — koi silent overwrite nahi.
        // (Sirf pehla save — jab koi doc hi nahi hai — bina baseRev ke allowed hai.)
        const isForce = !!(req.body && req.body.force === true);
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
        await BillingState.findOneAndUpdate(
            { dataId },
            {
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
                updatedAt: new Date()
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        log.info('POST', `Data saved successfully for ${dataId} (rev: ${nextRev}, payload: ${rawLen} bytes)`);
        res.json({ success: true, message: 'Data saved successfully', dataId, rev: nextRev });
    } catch (err) {
        log.error('POST', 'Error saving billing data', err);
        res.status(500).json({ success: false, error: dbErrorHint(err) });
    }
});

// ============ Reconciliation (Excel-parsed dataset) — online copy ============
const reconciliationStateSchema = new mongoose.Schema({
    dataId: { type: String, default: 'main-reconciliation-state', unique: true },
    stateData: { type: Object, required: true },
    rev: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now }
});

const ReconciliationState = mongoose.models.ReconciliationState
    || mongoose.model('ReconciliationState', reconciliationStateSchema);

app.get('/api/reconciliation', requireApiKey, async (req, res) => {
    try {
        await connectToDatabase();
        const state = await ReconciliationState.findOne({ dataId: 'main-reconciliation-state' });
        if (!state) {
            log.info('GET-RECON', 'No reconciliation state found — returning null');
            return res.json({ success: true, data: null });
        }
        log.info('GET-RECON', `Reconciliation state fetched (rev: ${state.rev || 0})`);
        res.json({ success: true, data: state.stateData, updatedAt: state.updatedAt, rev: (state.rev || 0) });
    } catch (err) {
        log.error('GET-RECON', 'Error fetching reconciliation data', err);
        res.status(500).json({ success: false, error: dbErrorHint(err) });
    }
});

app.post('/api/reconciliation', requireApiKey, writeLimiter, async (req, res) => {
    try {
        await connectToDatabase();

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
        const existing = await ReconciliationState.findOne({ dataId: 'main-reconciliation-state' });
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
        await ReconciliationState.findOneAndUpdate(
            { dataId: 'main-reconciliation-state' },
            { stateData: incoming, rev: nextRev, updatedAt: new Date() },
            { upsert: true, new: true }
        );
        log.info('POST-RECON', `Saved (rev: ${nextRev}, payload: ${rawLen} bytes)`);
        res.json({ success: true, message: 'Reconciliation data saved', rev: nextRev });
    } catch (err) {
        log.error('POST-RECON', 'Error saving reconciliation data', err);
        res.status(500).json({ success: false, error: dbErrorHint(err) });
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
        try { json = JSON.parse(text); } catch(e) { json = { ok: false, error: 'Invalid response from Google Apps Script' }; }

        if (gasResponse.ok && json.ok) {
            return res.json({ success: true, files: json.files || [], rootFolder: json.rootFolder || folderName, rootFolderUrl: json.rootFolderUrl || '' });
        } else {
            return res.status(502).json({
                success: false,
                error: json.error || `Apps Script returned HTTP ${gasResponse.status}`,
                details: json
            });
        }
    } catch(err) {
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
        try { json = JSON.parse(text); } catch(e) { json = { ok: false, error: 'Invalid response from Google Apps Script' }; }

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
            } catch(e) {}
            return res.json({ success: true, fileData: outBase64, fileName: json.fileName, mimeType: json.mimeType });
        } else {
            return res.status(502).json({
                success: false,
                error: json.error || `Apps Script returned HTTP ${gasResponse.status}`,
                details: json
            });
        }
    } catch(err) {
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

// POST: Save pole schedules permanently to js/data/default-pole-schedules.js on disk & Cloud
app.post('/api/save-default-pole-schedules', requireApiKey, express.json({ limit: '15mb' }), async (req, res) => {
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
        
        try {
            fsMod.writeFileSync(targetPath, content, 'utf8');
            log.info(ctx, `Successfully written ${Object.keys(poleSchedules).length} pole schedules to default-pole-schedules.js on disk`);
        } catch (fsErr) {
            log.warn(ctx, `Disk file write failed (e.g. read-only serverless environment): ${fsErr.message}`);
        }

        // Also persist to MongoDB for cross-PC synchronization
        try {
            await connectToDatabase();
            const DefaultConfig = mongoose.models.DefaultConfig || mongoose.model('DefaultConfig', new mongoose.Schema({
                key: { type: String, unique: true },
                data: { type: Object },
                updatedAt: { type: Date, default: Date.now }
            }));
            await DefaultConfig.findOneAndUpdate(
                { key: 'poleSchedulesMaster' },
                { key: 'poleSchedulesMaster', data: poleSchedules, updatedAt: new Date() },
                { upsert: true, new: true }
            );

            // Also update all BillingState documents so live bills immediately inherit updated schedules
            await BillingState.updateMany(
                {},
                { $set: { 'stateData.poleSchedules': poleSchedules, updatedAt: new Date() }, $inc: { rev: 1 } }
            );
            log.info(ctx, 'Successfully synced pole schedules to MongoDB Atlas for cross-PC default persistence');
        } catch (dbErr) {
            log.warn(ctx, `MongoDB backup skipped/failed: ${dbErr.message}`);
        }

        return res.json({
            success: true,
            message: 'Hard-coded default-pole-schedules.js updated on disk & cloud successfully!',
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
            await connectToDatabase();
            const DefaultConfig = mongoose.models.DefaultConfig || mongoose.model('DefaultConfig', new mongoose.Schema({
                key: { type: String, unique: true },
                data: { type: Object },
                updatedAt: { type: Date, default: Date.now }
            }));
            const record = await DefaultConfig.findOne({ key: 'poleSchedulesMaster' });
            if (record && record.data && Object.keys(record.data).length > 0) {
                return res.json({ success: true, poleSchedules: record.data, source: 'mongodb' });
            }
        } catch (e) {}

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

// POST: UI Mapping ↔ hardcode default-activities.js (+ SAP master) on disk & MongoDB
// Pole-schedules flow jaisa hi — Mapping tab ke push/sync par user ki mapping
// MongoDB DefaultConfig me master save hoti hai taaki har PC/phone par same mile.
app.post('/api/save-default-activities', requireApiKey, express.json({ limit: '15mb' }), async (req, res) => {
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

        // MongoDB DefaultConfig — cross-PC master persistence
        let mongoSaved = false;
        try {
            await connectToDatabase();
            const DefaultConfig = mongoose.models.DefaultConfig || mongoose.model('DefaultConfig', new mongoose.Schema({
                key: { type: String, unique: true },
                data: { type: Object },
                updatedAt: { type: Date, default: Date.now }
            }));
            if (isActObj) {
                await DefaultConfig.findOneAndUpdate(
                    { key: 'activitiesMaster' },
                    { key: 'activitiesMaster', data: activities, updatedAt: new Date() },
                    { upsert: true, new: true }
                );
            }
            if (isSapArr) {
                await DefaultConfig.findOneAndUpdate(
                    { key: 'sapMaterialsMaster' },
                    { key: 'sapMaterialsMaster', data: Array.isArray(sapMaterialsMaster) ? sapMaterialsMaster : (sapMaterialsMaster.items || []) , updatedAt: new Date() },
                    { upsert: true, new: true }
                );
            }

            // Live bills ko turant updated mapping do (pole-schedules jaisa hi behavior)
            if (isActObj) {
                await BillingState.updateMany(
                    {},
                    { $set: { 'stateData.activities': activities, updatedAt: new Date() }, $inc: { rev: 1 } }
                );
            }
            mongoSaved = true;
            log.info(ctx, 'Successfully synced activities mapping to MongoDB Atlas (DefaultConfig + live bills)');
        } catch (dbErr) {
            log.warn(ctx, `MongoDB backup skipped/failed: ${dbErr.message}`);
        }

        return res.json({
            success: true,
            message: 'Mapping master disk & cloud me save ho gayi!',
            files: wroteFiles,
            mongoSaved,
            count: isActObj ? Object.keys(activities).length : 0
        });
    } catch (err) {
        log.error(ctx, 'Failed to save default-activities mapping', err);
        return res.status(500).json({ success: false, error: err.message || 'Unknown error' });
    }
});

// GET: Fetch default activities mapping from Cloud (MongoDB) ya disk file
app.get('/api/default-activities', async (req, res) => {
    try {
        try {
            await connectToDatabase();
            const DefaultConfig = mongoose.models.DefaultConfig || mongoose.model('DefaultConfig', new mongoose.Schema({
                key: { type: String, unique: true },
                data: { type: Object },
                updatedAt: { type: Date, default: Date.now }
            }));
            const record = await DefaultConfig.findOne({ key: 'activitiesMaster' });
            if (record && record.data && Object.keys(record.data).length > 0) {
                return res.json({ success: true, activities: record.data, source: 'mongodb' });
            }
        } catch (e) {}

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

