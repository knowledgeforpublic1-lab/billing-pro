const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

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

// Optional API key — Vercel/local me API_KEY set ho to POST+GET dono par required.
// Frontend localStorage 'billing_api_key' se 'x-api-key' header bhejta hai.
// API_KEY set nahi hai to check skip (local dev backward compatible).
function requireApiKey(req, res, next) {
    const expected = (process.env.API_KEY || '').trim();
    if (!expected) return next();
    const got = (req.header('x-api-key') || '').trim()
        || (req.query && req.query.api_key ? String(req.query.api_key).trim() : '');
    if (got !== expected) {
        return res.status(401).json({ success: false, error: 'Unauthorized: valid x-api-key header required' });
    }
    next();
}

// Sirf ye fields save honge — kachra / history / bade blob Mongo me nahi jayenge (space kam hai)
const ALLOWED_SYNC_KEYS = new Set([
    'isFinalized', 'projectMeta', 'selectedCompanyId', 'contractorsList',
    'selectedContractorId', 'pctStage1', 'pctStage2', 'pctStage3',
    'locations', 'activities', 'masterAbstractList', 'activityQuantities',
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
    
    // Connect to database
    const client = await mongoose.connect(MONGODB_URI, { family: 4 });
    cachedDb = client;
    console.log('Successfully connected to MongoDB Atlas!');
    return client;
}

// Billing State Schema and Model
const billingStateSchema = new mongoose.Schema({
    dataId: { type: String, default: 'main-billing-state', unique: true },
    stateData: { type: Object, required: true },
    updatedAt: { type: Date, default: Date.now }
});

const BillingState = mongoose.models.BillingState || mongoose.model('BillingState', billingStateSchema);

// Routes
app.get('/api/billing', requireApiKey, async (req, res) => {
    try {
        await connectToDatabase();
        const state = await BillingState.findOne({ dataId: 'main-billing-state' });
        if (!state) {
            return res.json({ success: true, data: null });
        }
        res.json({ success: true, data: state.stateData, updatedAt: state.updatedAt });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch data' });
    }
});

app.post('/api/billing', requireApiKey, writeLimiter, async (req, res) => {
    try {
        await connectToDatabase();
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
            return res.status(400).json({ success: false, error: 'Invalid payload: JSON object expected' });
        }
        const rawLen = JSON.stringify(req.body || {}).length;
        if (rawLen > 800 * 1024) {
            return res.status(413).json({ success: false, error: 'Payload too large (800KB limit, Mongo me jagah kam hai)' });
        }
        const dataToSave = pickAllowedKeys(req.body || {});
        // Finalize lock — locked bill par koi bhi overwrite block.
        // Unlock ka ek hi rasta: explicit isFinalized:false bhejo (UI se Unlock dabane par).
        const existing = await BillingState.findOne({ dataId: 'main-billing-state' });
        if (existing && existing.stateData && existing.stateData.isFinalized && dataToSave.isFinalized !== false) {
            return res.status(423).json({ success: false, error: 'Bill is finalized/locked. Unlock first.' });
        }
        
        await BillingState.findOneAndUpdate(
            { dataId: 'main-billing-state' },
            { 
                stateData: dataToSave,
                updatedAt: new Date()
            },
            { upsert: true, new: true }
        );
        
        res.json({ success: true, message: 'Data saved successfully' });
    } catch (err) {
        console.error('Error saving data:', err);
        res.status(500).json({ success: false, error: 'Failed to save data' });
    }
});

// Export the app for Vercel
module.exports = app;

