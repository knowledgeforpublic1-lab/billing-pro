'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validate, patchPrivateEnv, matchesState } = require('../scripts/connect-drive-staging');
const project = 'billing-pro-staging-ba9a8';
test('OAuth setup rejects production, wrong callback, and existing refresh credentials', () => {
    const client = { project_id: project, client_id: 'synthetic.apps.googleusercontent.com', client_secret: 'synthetic', redirect_uris: ['http://127.0.0.1:53682/oauth2callback'] };
    const env = { BILLING_STORAGE_STAGING_PROJECT: project, FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ project_id: project }) };
    assert.doesNotThrow(() => validate(client, env));
    assert.throws(() => validate({ ...client, project_id: 'billing-pro-e6241' }, env));
    assert.throws(() => validate({ ...client, redirect_uris: [] }, env));
    assert.throws(() => validate(client, { ...env, GOOGLE_DRIVE_REFRESH_TOKEN: 'existing' }));
});
test('OAuth config update preserves Firebase JSON exactly and round-trips literal token characters', () => {
    const original = "FIREBASE_SERVICE_ACCOUNT='" + JSON.stringify({ project_id: project, private_key: 'synthetic\nkey\n' }) + "'\nGOOGLE_DRIVE_REFRESH_TOKEN=''\n";
    const next = patchPrivateEnv(original, { GOOGLE_DRIVE_REFRESH_TOKEN: 'synthetic$&token', GOOGLE_DRIVE_CLIENT_ID: 'synthetic.apps.googleusercontent.com' });
    const parse = require('dotenv').parse;
    assert.equal(parse(next).FIREBASE_SERVICE_ACCOUNT, parse(original).FIREBASE_SERVICE_ACCOUNT);
    assert.equal(parse(next).GOOGLE_DRIVE_REFRESH_TOKEN, 'synthetic$&token');
    assert.throws(() => patchPrivateEnv(original, { GOOGLE_DRIVE_REFRESH_TOKEN: "bad\nvalue" }));
    assert.equal(matchesState('abc', 'abc'), true); assert.equal(matchesState('abc', 'abd'), false);
    assert.equal(matchesState('abc', undefined), false);
});
