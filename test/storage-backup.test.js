'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { exportSnapshot } = require('../scripts/backup-live-firestore');
const { execFileSync } = require('node:child_process');
test('backup traverses subcollections and missing parents at exactly one snapshot time, using reads only', async () => {
    const base = 'projects/isolated-test/databases/(default)/documents', readTime = '2026-11-18T07:14:36.441Z', docs = [], calls = [];
    const result = await exportSnapshot({ projectId: 'isolated-test', readTime, onDocument: doc => docs.push(doc), async request(resource, options) {
        calls.push({ resource, options });
        if (resource.endsWith(':listCollectionIds')) {
            assert.equal(options.method, 'POST'); assert.equal(options.body.readTime, readTime);
            return resource === base + ':listCollectionIds' ? { collectionIds: ['billing_states'] } : resource === base + '/billing_states/missing:listCollectionIds' ? { collectionIds: ['chunks'] } : {};
        }
        assert.equal(options.method, 'GET'); const url = new URL('https://unused.invalid/' + resource);
        assert.equal(url.searchParams.get('readTime'), readTime); assert.equal(url.searchParams.get('showMissing'), 'true');
        if (url.pathname.endsWith('/chunks')) return { documents: [{ name: base + '/billing_states/missing/chunks/v1_0', updateTime: readTime, fields: { chunk: { stringValue: 'data' } } }] };
        if (url.searchParams.get('pageToken')) return { documents: [{ name: base + '/billing_states/missing' }] };
        return { documents: [{ name: base + '/billing_states/a', updateTime: readTime, fields: { rev: { integerValue: '9007199254740993' } } }], nextPageToken: 'page2' };
    } });
    assert.equal(result.documents, 3); assert.equal(result.collections.length, 2);
    assert.equal(docs[0].fields.rev.integerValue, '9007199254740993', 'REST typed values remain lossless');
    assert.ok(calls.every(call => call.options.method === 'GET' || call.resource.endsWith(':listCollectionIds')));
});
test('migration apply refuses production before connecting or uploading', () => {
    assert.throws(() => execFileSync(process.execPath, ['scripts/migrate-drive-staging.js', '--apply', '--staging-project=billing-pro-e6241'], { stdio: 'pipe' }), error => {
        assert.match(error.stderr.toString(), /production migration is disabled/); return true;
    });
});
