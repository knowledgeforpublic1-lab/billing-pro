const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// MongoDB Connection Caching for Serverless
let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb) {
        return cachedDb;
    }
    const MONGODB_URI = 'mongodb://knowledgeforpublic1_db_user:nkvbtaiz7lQCtqOi@ac-hsacnlz-shard-00-00.vqvlilu.mongodb.net:27017,ac-hsacnlz-shard-00-01.vqvlilu.mongodb.net:27017,ac-hsacnlz-shard-00-02.vqvlilu.mongodb.net:27017/billingPro?ssl=true&replicaSet=atlas-y6nh3m-shard-0&authSource=admin&retryWrites=true&w=majority';
    if (!MONGODB_URI) {
        throw new Error('MONGODB_URI is not defined');
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
app.get('/api/billing', async (req, res) => {
    try {
        await connectToDatabase();
        const state = await BillingState.findOne({ dataId: 'main-billing-state' });
        if (!state) {
            return res.json({ success: true, data: null });
        }
        res.json({ success: true, data: state.stateData });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch data' });
    }
});

app.post('/api/billing', async (req, res) => {
    try {
        await connectToDatabase();
        const dataToSave = req.body;
        
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

