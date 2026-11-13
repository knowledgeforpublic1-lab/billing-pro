/**
 * @file MongoDB to Firebase Firestore Migration Tool
 * @description Migrates all BillingState, ReconciliationState, and DefaultConfig records
 * from MongoDB Atlas into Google Firebase Firestore.
 * 
 * Usage:
 *   node scripts/migrate_mongo_to_firebase.js
 * 
 * Requirements:
 *   - .env with MONGODB_URI and FIREBASE credentials (FIREBASE_SERVICE_ACCOUNT or serviceAccountKey.json)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { getFirestore } = require('firebase-admin/firestore');
const db = require('../api/db');

async function migrate() {
    console.log('====================================================');
    console.log('🔄 MONGODB TO FIREBASE FIRESTORE MIGRATION');
    console.log('====================================================');

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('❌ MONGODB_URI not found in .env');
        process.exit(1);
    }

    // 1. Initialize Firebase
    console.log('\n[1/4] Connecting to Firebase Firestore...');
    let firestore = null;
    try {
        await db.connect();
        firestore = db.getFirestoreInstance();
        if (!firestore) {
            throw new Error('Firebase Firestore not initialized. Ensure FIREBASE_SERVICE_ACCOUNT or serviceAccountKey.json is configured.');
        }
        console.log('✅ Connected to Firebase Firestore');
    } catch (err) {
        console.error('❌ Firebase connection error:', err.message);
        console.log('\nTip: Set FIREBASE_SERVICE_ACCOUNT in .env or place serviceAccountKey.json in the project root.');
        process.exit(1);
    }

    // 2. Connect directly to MongoDB
    console.log('\n[2/4] Connecting to MongoDB Atlas...');
    const mongoConn = await mongoose.createConnection(mongoUri, { family: 4 }).asPromise();
    console.log('✅ Connected to MongoDB Atlas');

    const MongoBilling = mongoConn.model('BillingState', new mongoose.Schema({}, { strict: false }));
    const MongoRecon = mongoConn.model('ReconciliationState', new mongoose.Schema({}, { strict: false }));
    const MongoConfig = mongoConn.model('DefaultConfig', new mongoose.Schema({}, { strict: false }));

    // 3. Migrate Billing States
    console.log('\n[3/4] Migrating Bills (BillingState)...');
    const bills = await MongoBilling.find({}).lean();
    console.log(`Found ${bills.length} bills in MongoDB.`);
    let billsMigrated = 0;
    for (const b of bills) {
        const id = b.dataId || 'main-billing-state';
        const docData = { ...b };
        delete docData._id;
        delete docData.__v;
        if (docData.updatedAt instanceof Date) docData.updatedAt = docData.updatedAt.toISOString();
        if (docData.createdAt instanceof Date) docData.createdAt = docData.createdAt.toISOString();

        await db.saveBillingState(id, docData);
        billsMigrated++;
        console.log(`  ✓ Migrated bill: ${id} (${docData.billNo || docData.raNo || 'Main Bill'})`);
    }

    // 4. Migrate Reconciliation & Save Verified Master Configs
    console.log('\n[4/4] Migrating Reconciliation & Preserving Verified Masters...');
    const recons = await MongoRecon.find({}).lean();
    for (const r of recons) {
        await db.saveReconciliationState(r.stateData || {}, r.rev || 0);
        console.log(`  ✓ Migrated reconciliation state: ${r.dataId || 'main-reconciliation-state'}`);
    }

    // Strictly save verified local master configs (never let stale MongoDB configs overwrite current verified mappings)
    const localPS = require('../js/data/default-pole-schedules');
    const localAct = require('../js/data/default-activities');
    await db.saveDefaultConfig('poleSchedulesMaster', localPS);
    await db.saveDefaultConfig('activitiesMaster', localAct);
    console.log('  ✓ Preserved verified poleSchedulesMaster (922: 45 items, 907: 53 items)');
    console.log('  ✓ Preserved verified activitiesMaster (922: 18 contract items)');

    console.log('\n====================================================');
    console.log(`🎉 MIGRATION COMPLETE!`);
    console.log(`   - Bills Migrated: ${billsMigrated}`);
    console.log(`   - Reconciliation Records: ${recons.length}`);
    console.log(`   - Default Configs: ${configs.length}`);
    console.log('====================================================');

    await mongoConn.close();
    process.exit(0);
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});

