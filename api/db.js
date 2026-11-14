/**
 * @file Unified Database Adapter (Firebase Firestore Primary + MongoDB Fallback)
 * @description Supports Google Firebase Firestore as primary cloud database with
 * seamless fallback to MongoDB during migration.
 * 
 * Environment Variables for Firebase:
 * - Option 1 (Recommended for Vercel): FIREBASE_SERVICE_ACCOUNT (full JSON string or path)
 * - Option 2 (Individual vars): FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 * - Option 3 (Local dev): serviceAccountKey.json file in project root
 */

const fs = require('fs');
const path = require('path');
const { cert, initializeApp, getApps, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const mongoose = require('mongoose');

const log = {
    info: (ctx, msg) => console.log(`[${new Date().toISOString()}] [INFO] [${ctx}] ${msg}`),
    warn: (ctx, msg) => console.warn(`[${new Date().toISOString()}] [WARN] [${ctx}] ${msg}`),
    error: (ctx, msg, err) => console.error(`[${new Date().toISOString()}] [ERROR] [${ctx}] ${msg}`, err || ''),
};

let firestoreDb = null;
let mongoDb = null;
let activeProvider = null; // 'firebase' | 'mongodb' | null

// Mongoose Schemas (for fallback / migration)
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
const MongoBillingState = mongoose.models.BillingState || mongoose.model('BillingState', billingStateSchema);

const reconciliationStateSchema = new mongoose.Schema({
    dataId: { type: String, default: 'main-reconciliation-state', unique: true },
    stateData: { type: Object, required: true },
    rev: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now }
});
const MongoReconciliationState = mongoose.models.ReconciliationState || mongoose.model('ReconciliationState', reconciliationStateSchema);

const defaultConfigSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    data: { type: Object },
    updatedAt: { type: Date, default: Date.now }
});
const MongoDefaultConfig = mongoose.models.DefaultConfig || mongoose.model('DefaultConfig', defaultConfigSchema);

/**
 * Initialize Firebase Firestore
 */
function tryInitFirebase() {
    if (firestoreDb) return firestoreDb;

    const saEnv = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
    const projectId = (process.env.FIREBASE_PROJECT_ID || '').trim();
    const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').trim();
    let privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').trim();

    let credential = null;

    // 1. Check raw JSON or file path in FIREBASE_SERVICE_ACCOUNT
    if (saEnv) {
        try {
            if (saEnv.startsWith('{')) {
                const saJson = JSON.parse(saEnv);
                credential = cert(saJson);
                log.info('DB-INIT', 'Firebase credential loaded from FIREBASE_SERVICE_ACCOUNT JSON env');
            } else {
                const p = path.isAbsolute(saEnv) ? saEnv : path.join(__dirname, '..', saEnv);
                if (fs.existsSync(p)) {
                    const saJson = JSON.parse(fs.readFileSync(p, 'utf8'));
                    credential = cert(saJson);
                    log.info('DB-INIT', `Firebase credential loaded from file: ${saEnv}`);
                }
            }
        } catch (err) {
            log.error('DB-INIT', 'Error parsing FIREBASE_SERVICE_ACCOUNT', err);
        }
    }

    // 2. Check individual env variables
    if (!credential && projectId && clientEmail && privateKey) {
        try {
            if (privateKey.includes('\\n')) {
                privateKey = privateKey.replace(/\\n/g, '\n');
            }
            credential = cert({
                projectId,
                clientEmail,
                privateKey
            });
            log.info('DB-INIT', 'Firebase credential loaded from individual environment variables');
        } catch (err) {
            log.error('DB-INIT', 'Error initializing Firebase from individual env vars', err);
        }
    }

    // 3. Check default local files (for local dev)
    if (!credential) {
        const rootDir = path.join(__dirname, '..');
        const defaultFiles = ['serviceAccountKey.json', 'firebase-service-account.json', 'firebase-key.json'];
        try {
            const rootFiles = fs.readdirSync(rootDir);
            const sdkFile = rootFiles.find(f => f.includes('firebase-adminsdk') && f.endsWith('.json'));
            if (sdkFile && !defaultFiles.includes(sdkFile)) {
                defaultFiles.unshift(sdkFile);
            }
        } catch (e) { }

        for (const fname of defaultFiles) {
            const p = path.join(rootDir, fname);
            if (fs.existsSync(p)) {
                try {
                    const saJson = JSON.parse(fs.readFileSync(p, 'utf8'));
                    credential = cert(saJson);
                    log.info('DB-INIT', `Firebase credential loaded from local ${fname}`);
                    break;
                } catch (err) {
                    log.warn('DB-INIT', `Failed reading ${fname}`, err);
                }
            }
        }
    }

    // 4. Default Application Credentials (GCP environment)
    if (!credential && projectId) {
        try {
            credential = applicationDefault();
            log.info('DB-INIT', 'Firebase using applicationDefault credentials');
        } catch (e) { }
    }

    if (!credential) {
        return null;
    }

    try {
        const app = getApps().length ? getApps()[0] : initializeApp({
            credential,
            databaseURL: process.env.FIREBASE_DATABASE_URL
        });
        const db = getFirestore(app);
        try {
            db.settings({ ignoreUndefinedProperties: true });
        } catch (e) { }
        firestoreDb = db;
        activeProvider = 'firebase';
        log.info('DB-INIT', '✅ Connected to Google Firebase Firestore successfully');
        return firestoreDb;
    } catch (err) {
        log.error('DB-INIT', 'Failed initializing Firebase Firestore', err);
        return null;
    }
}

/**
 * Connect to MongoDB fallback
 */
async function tryConnectMongo() {
    if (mongoDb && mongoose.connection.readyState === 1) return mongoDb;
    const uri = process.env.MONGODB_URI;
    if (!uri) return null;

    try {
        log.info('DB-INIT', 'Connecting to MongoDB Atlas (fallback)...');
        mongoDb = await mongoose.connect(uri, { family: 4 });
        activeProvider = 'mongodb';
        log.info('DB-INIT', 'Connected to MongoDB Atlas fallback successfully');
        return mongoDb;
    } catch (err) {
        log.error('DB-INIT', 'Failed connecting to MongoDB Atlas fallback', err);
        return null;
    }
}

/**
 * Connect to database (Firebase preferred, MongoDB fallback)
 */
async function connect() {
    const fb = tryInitFirebase();
    if (fb) {
        activeProvider = 'firebase';
        return { provider: 'firebase', db: fb };
    }

    const mg = await tryConnectMongo();
    if (mg) {
        activeProvider = 'mongodb';
        return { provider: 'mongodb', db: mg };
    }

    activeProvider = null;
    throw new Error('No database configured. FIREBASE_SERVICE_ACCOUNT (or FIREBASE_PROJECT_ID) ya MONGODB_URI env set karo.');
}

function getProvider() {
    if (firestoreDb) return 'firebase';
    if (mongoose.connection && mongoose.connection.readyState === 1) return 'mongodb';
    return activeProvider || 'none';
}

function getErrorHint(err) {
    const msg = (err && err.message ? err.message : String(err || ''));
    if (/No database configured/i.test(msg) || /FIREBASE_SERVICE_ACCOUNT/i.test(msg)) {
        return 'Firebase credentials missing hai — Vercel/Local me FIREBASE_SERVICE_ACCOUNT ya FIREBASE_PROJECT_ID set karein';
    }
    if (/private_key/i.test(msg) || /PEM/i.test(msg)) {
        return 'Firebase private_key format galat hai — ensure newlines (\\n) sahi hain';
    }
    if (/permission-denied|PERMISSION_DENIED/i.test(msg)) {
        return 'Firebase Firestore permission denied — Service Account roles ya Security Rules check karo';
    }
    if (/MONGODB_URI env is not defined/.test(msg)) {
        return 'Database env missing hai — FIREBASE_SERVICE_ACCOUNT ya MONGODB_URI set karein';
    }
    if (/bad auth|authentication failed/i.test(msg)) {
        return 'Database authentication failed — credentials check karo';
    }
    return 'Database error — logs me pura error dekho';
}

// Threshold below Firestore 1MB document limit (safety margin for metadata)
const FIRESTORE_MAX_DOC_SIZE = 750000;

async function writeFirestoreWithChunking(docRef, docData) {
    const serialized = JSON.stringify(docData);
    if (serialized.length <= FIRESTORE_MAX_DOC_SIZE) {
        const toSave = { ...docData };
        if (toSave.updatedAt instanceof Date) toSave.updatedAt = toSave.updatedAt.toISOString();
        if (toSave.createdAt instanceof Date) toSave.createdAt = toSave.createdAt.toISOString();
        toSave._isChunked = false;
        await docRef.set(toSave, { merge: true });
        return;
    }

    log.info('DB-CHUNK', `Document ${docRef.path} size (${serialized.length} chars) exceeds 750KB, writing in chunks...`);
    const totalChunks = Math.ceil(serialized.length / FIRESTORE_MAX_DOC_SIZE);
    const chunksColl = docRef.collection('chunks');
    const writePromises = [];
    for (let i = 0; i < totalChunks; i++) {
        const slice = serialized.substring(i * FIRESTORE_MAX_DOC_SIZE, (i + 1) * FIRESTORE_MAX_DOC_SIZE);
        writePromises.push(chunksColl.doc(String(i)).set({ chunk: slice }));
    }
    await Promise.all(writePromises);

    // Save metadata stub on the parent document
    const stub = { ...docData };
    delete stub.stateData;
    delete stub.data;
    stub._isChunked = true;
    stub.totalChunks = totalChunks;
    if (stub.updatedAt instanceof Date) stub.updatedAt = stub.updatedAt.toISOString();
    if (stub.createdAt instanceof Date) stub.createdAt = stub.createdAt.toISOString();
    await docRef.set(stub, { merge: true });
    log.info('DB-CHUNK', `✓ Successfully saved ${docRef.path} across ${totalChunks} chunks`);
}

async function readFirestoreWithChunking(docSnap) {
    if (!docSnap || !docSnap.exists) return null;
    const data = docSnap.data();
    if (!data || !data._isChunked) return data;

    const totalChunks = data.totalChunks || 0;
    const chunksColl = docSnap.ref.collection('chunks');
    const readPromises = [];
    for (let i = 0; i < totalChunks; i++) {
        readPromises.push(chunksColl.doc(String(i)).get());
    }
    const chunkSnaps = await Promise.all(readPromises);
    let fullJson = '';
    for (const snap of chunkSnaps) {
        if (snap.exists) {
            fullJson += (snap.data().chunk || '');
        }
    }
    try {
        const parsed = JSON.parse(fullJson);
        const merged = { ...data, ...parsed };
        delete merged._isChunked;
        delete merged.totalChunks;
        return merged;
    } catch (e) {
        log.error('DB-CHUNK', `Error parsing chunked document ${docSnap.ref.path}`, e);
        return data;
    }
}

// ==========================================
// BILLING STATE OPERATIONS
// ==========================================

async function getBillingState(dataId) {
    await connect();
    if (activeProvider === 'firebase') {
        const docRef = firestoreDb.collection('billing_states').doc(dataId);
        const snap = await docRef.get();
        return await readFirestoreWithChunking(snap);
    } else {
        const doc = await MongoBillingState.findOne({ dataId }).lean();
        return doc;
    }
}

async function getLatestBillingState() {
    await connect();
    if (activeProvider === 'firebase') {
        const snap = await firestoreDb.collection('billing_states').orderBy('updatedAt', 'desc').limit(1).get();
        if (snap.empty) return null;
        return await readFirestoreWithChunking(snap.docs[0]);
    } else {
        const doc = await MongoBillingState.findOne({}).sort({ updatedAt: -1 }).lean();
        return doc;
    }
}

async function listBills() {
    await connect();
    if (activeProvider === 'firebase') {
        const snap = await firestoreDb.collection('billing_states').orderBy('updatedAt', 'desc').get();
        return snap.docs.map(doc => {
            const d = doc.data();
            const pm = (d.stateData && d.stateData.projectMeta) || {};
            const inv = (d.stateData && d.stateData.invoiceData) || {};

            let ra = String(d.raNo || pm.raNo || inv.raNo || '').trim();
            let billNo = String(d.billNo || pm.billNo || inv.invoiceNo || '').trim();
            if (billNo === 'Main Bill') billNo = '';

            let displayBillNo = '';
            if (billNo) {
                displayBillNo = billNo;
            } else if (ra) {
                displayBillNo = 'RA-' + ra.padStart(2, '0');
            } else {
                displayBillNo = d.dataId === 'main-billing-state' ? 'Main Bill' : 'Draft Bill';
            }

            const workOrderNo = d.workOrderNo || inv.workOrderNo || pm.workOrderNo || pm.poNo || inv.poNo || '—';
            const contractor = d.contractorName || inv.contractorName || inv.contractorFirm || pm.contractorName || pm.contractorFirm || 'Not Assigned';
            const billDate = d.billDate || inv.invoiceDate || pm.billDate || pm.date || '—';

            let taxable = Number(d.taxableAmount || 0);
            let gst = Number(d.gstAmount || 0);
            let grand = Number(d.grandTotal || 0);

            if (taxable === 0 && Array.isArray(inv.items) && inv.items.length > 0) {
                taxable = inv.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
                taxable = Math.round(taxable * 100) / 100;
            }

            if (gst === 0 && taxable > 0) {
                gst = (inv.gstType === 'NONE') ? 0 : Math.round(taxable * 0.18 * 100) / 100;
            }
            if (grand === 0 && taxable > 0) {
                grand = Math.round((taxable + gst) * 100) / 100;
            }

            return {
                dataId: d.dataId || 'main-billing-state',
                billNo: displayBillNo,
                raNo: ra,
                workOrderNo: workOrderNo,
                billDate: billDate,
                contractorName: contractor,
                projectName: d.projectName || pm.projectName || 'Billing Project',
                taxableAmount: taxable,
                gstAmount: gst,
                totalAmount: grand,
                grandTotal: grand,
                isFinalized: d.isFinalized !== undefined ? !!d.isFinalized : !!(d.stateData && d.stateData.isFinalized),
                rev: d.rev || 0,
                updatedAt: d.updatedAt || new Date().toISOString()
            };
        });
    } else {
        const docs = await MongoBillingState.find({})
            .select('dataId billNo raNo workOrderNo taxableAmount gstAmount grandTotal billDate contractorName projectName isFinalized rev updatedAt createdAt stateData.projectMeta stateData.invoiceData stateData.activities stateData.activityQuantities')
            .sort({ updatedAt: -1 })
            .lean();
        return docs.map(doc => {
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

            if (gst === 0 && taxable > 0) {
                gst = (inv.gstType === 'NONE') ? 0 : Math.round(taxable * 0.18 * 100) / 100;
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
    }
}

async function countBills() {
    await connect();
    if (activeProvider === 'firebase') {
        const snap = await firestoreDb.collection('billing_states').count().get();
        return snap.data().count;
    } else {
        return await MongoBillingState.countDocuments();
    }
}

async function deleteBillingState(dataId) {
    await connect();
    if (activeProvider === 'firebase') {
        await firestoreDb.collection('billing_states').doc(dataId).delete();
    } else {
        await MongoBillingState.deleteOne({ dataId });
    }
}

async function saveBillingState(dataId, updateDoc) {
    await connect();
    if (activeProvider === 'firebase') {
        const docRef = firestoreDb.collection('billing_states').doc(dataId);
        await writeFirestoreWithChunking(docRef, updateDoc);
    } else {
        await MongoBillingState.findOneAndUpdate(
            { dataId },
            updateDoc,
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    }
}

async function updateAllBillsPoleSchedules(poleSchedules) {
    await connect();
    if (activeProvider === 'firebase') {
        const snap = await firestoreDb.collection('billing_states').get();
        const batch = firestoreDb.batch();
        snap.docs.forEach(doc => {
            const currentRev = (doc.data() && doc.data().rev) || 0;
            batch.update(doc.ref, {
                'stateData.poleSchedules': poleSchedules,
                updatedAt: new Date().toISOString(),
                rev: currentRev + 1
            });
        });
        await batch.commit();
    } else {
        await MongoBillingState.updateMany(
            {},
            { $set: { 'stateData.poleSchedules': poleSchedules, updatedAt: new Date() }, $inc: { rev: 1 } }
        );
    }
}

async function updateAllBillsActivities(activities) {
    await connect();
    if (activeProvider === 'firebase') {
        const snap = await firestoreDb.collection('billing_states').get();
        const batch = firestoreDb.batch();
        snap.docs.forEach(doc => {
            const currentRev = (doc.data() && doc.data().rev) || 0;
            batch.update(doc.ref, {
                'stateData.activities': activities,
                updatedAt: new Date().toISOString(),
                rev: currentRev + 1
            });
        });
        await batch.commit();
    } else {
        await MongoBillingState.updateMany(
            {},
            { $set: { 'stateData.activities': activities, updatedAt: new Date() }, $inc: { rev: 1 } }
        );
    }
}

// ==========================================
// RECONCILIATION STATE OPERATIONS
// ==========================================

async function getReconciliationState() {
    await connect();
    if (activeProvider === 'firebase') {
        const snap = await firestoreDb.collection('reconciliation_states').doc('main-reconciliation-state').get();
        return await readFirestoreWithChunking(snap);
    } else {
        return await MongoReconciliationState.findOne({ dataId: 'main-reconciliation-state' }).lean();
    }
}

async function saveReconciliationState(stateData, nextRev) {
    await connect();
    const docData = {
        dataId: 'main-reconciliation-state',
        stateData,
        rev: nextRev,
        updatedAt: new Date().toISOString()
    };
    if (activeProvider === 'firebase') {
        const docRef = firestoreDb.collection('reconciliation_states').doc('main-reconciliation-state');
        await writeFirestoreWithChunking(docRef, docData);
    } else {
        await MongoReconciliationState.findOneAndUpdate(
            { dataId: 'main-reconciliation-state' },
            { stateData, rev: nextRev, updatedAt: new Date() },
            { upsert: true, new: true }
        );
    }
}

// ==========================================
// DEFAULT CONFIG OPERATIONS
// ==========================================

async function getDefaultConfig(key) {
    await connect();
    if (activeProvider === 'firebase') {
        const snap = await firestoreDb.collection('default_configs').doc(key).get();
        if (!snap.exists) return null;
        return snap.data();
    } else {
        return await MongoDefaultConfig.findOne({ key }).lean();
    }
}

async function saveDefaultConfig(key, data) {
    await connect();
    const docData = {
        key,
        data,
        updatedAt: new Date().toISOString()
    };
    if (activeProvider === 'firebase') {
        await firestoreDb.collection('default_configs').doc(key).set(docData, { merge: true });
    } else {
        await MongoDefaultConfig.findOneAndUpdate(
            { key },
            { key, data, updatedAt: new Date() },
            { upsert: true, new: true }
        );
    }
}

async function patchDefaultConfig(key, changes) {
    await connect();
    if (activeProvider === 'firebase') {
        await firestoreDb.collection('default_configs').doc(key).set({ key, data: changes, updatedAt: new Date().toISOString() }, { merge: true });
    } else {
        const fields = { updatedAt: new Date() };
        Object.entries(changes).forEach(([field, value]) => { fields['data.' + field] = value; });
        await MongoDefaultConfig.updateOne({ key }, { $set: fields });
    }
}

module.exports = {
    patchDefaultConfig,
    connect,
    getProvider,
    isConnected: () => Boolean(firestoreDb || (mongoDb && mongoose.connection && mongoose.connection.readyState === 1)),
    getErrorHint,
    // Billing State
    getBillingState,
    getLatestBillingState,
    listBills,
    countBills,
    deleteBillingState,
    saveBillingState,
    updateAllBillsPoleSchedules,
    updateAllBillsActivities,
    // Reconciliation State
    getReconciliationState,
    saveReconciliationState,
    // Default Config
    getDefaultConfig,
    saveDefaultConfig,
    // Direct instances (if needed for migration)
    getFirestoreInstance: () => firestoreDb,
    getMongoModels: () => ({ MongoBillingState, MongoReconciliationState, MongoDefaultConfig })
};
