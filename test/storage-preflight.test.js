'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const inspect = require('../scripts/storage-preflight');
const ready = () => ({ BILLING_STORAGE_STAGING_PROJECT: 'isolated-test', BILLING_STORAGE_AUTHORITY: 'firestore',
    FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ project_id: 'isolated-test', client_email: 'test@example.invalid', private_key: 'synthetic-private-key' }),
    BILLING_DRIVE_TRANSPORT: '1', BILLING_DRIVE_MODULES: 'bill,reconciliation,master,mapping,daily',
    BILLING_DRIVE_FOLDER_ID: 'private_test_folder', BILLING_STORAGE_STAGING_FOLDER: 'private_test_folder',
    GOOGLE_DRIVE_CLIENT_ID: 'synthetic-id', GOOGLE_DRIVE_CLIENT_SECRET: 'synthetic-secret', GOOGLE_DRIVE_REFRESH_TOKEN: 'synthetic-refresh' });
test('preflight rejects missing, production and mismatched configurations without exposing secrets', () => {
    assert.equal(inspect({}).readyForExternalCheck, false);
    for (const change of [ { BILLING_STORAGE_STAGING_PROJECT: 'billing-pro-e6241' },
        { FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ project_id: 'billing-pro-e6241' }) },
        { BILLING_STORAGE_STAGING_FOLDER: 'other_folder' }, { BILLING_DRIVE_TRANSPORT: '0' },
        { BILLING_DRIVE_MODULES: 'auth' }, { GOOGLE_DRIVE_REFRESH_TOKEN: '' } ]) {
        const report = inspect({ ...ready(), ...change });
        assert.equal(report.readyForExternalCheck, false);
        assert.equal(report.networkRequests + report.databaseWrites, 0);
        assert.doesNotMatch(JSON.stringify(report), /synthetic-secret|synthetic-refresh|synthetic-private-key/);
    }
});
test('complete isolated configuration is only marked ready for external checks, not externally verified', () => {
    const report = inspect(ready());
    assert.equal(report.readyForExternalCheck, true);
    assert.equal(report.mode, 'offline-preflight');
    assert.equal(report.remaining.length, 3);
});
