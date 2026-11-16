const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = require('../api/index');
test('production routing keeps billing HTML, financial seed scripts and APIs behind login', async () => {
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    try {
        for (const route of ['/', '/index.html', '/mobile', '/old/index.html']) {
            const response = await fetch(origin + route);
            const text = await response.text();
            assert.match(text, /Login required/); assert.ok(!text.includes('js/data/'));
            assert.match(response.headers.get('cache-control'), /no-store/);
        }
        for (const route of ['/js/data/default-contractors.js', '/js/data/default-invoice.js', '/js/data/default-daily-progress.js', '/js/data/contractor-sap-issues.js', '/api/billing', '/api/dp-admin/status', '/api/daily-progress/template']) {
            assert.equal((await fetch(origin + route)).status, 401, route);
        }
        assert.equal((await fetch(origin + '/api/daily-entry/bootstrap')).status, 401, 'Public data still needs scoped contractor link');
        const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
        assert.ok(!config.builds.some(build => build.use === '@vercel/static' && build.src === 'js/**'), 'Private seed scripts cannot be deployed as public static files');
        const firstFilesystem = config.routes.findIndex(route => route.handle === 'filesystem');
        assert.ok(config.routes.findIndex(route => route.src === '/js/data/(.*)') < firstFilesystem);
    } finally { await new Promise(resolve => server.close(resolve)); }
});
