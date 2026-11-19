'use strict';
// Loopback-only visual fixture. All writes stay in memory. Never imports api/db,
// dotenv, Firebase credentials or server.js; never proxies to production.
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const vm = require('node:vm');
const express = require('express');
const fixture = require('./helpers/daily-entry-fixture');
const root = path.resolve(__dirname, '..');
const copy = value => value == null ? value : structuredClone(value);
function decode(value) {
    if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, data]) => [key, decode(data)]));
    if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
    if ('integerValue' in value) return Number(value.integerValue);
    for (const type of ['stringValue', 'doubleValue', 'booleanValue', 'timestampValue', 'nullValue']) if (type in value) return value[type];
    throw Error('Unsupported fixture field type');
}
async function baseline() {
    const archive = path.join(root, 'backups/pre-drive-first-20261118/live-firestore/documents.ndjson');
    const documents = new Map(); let firstBill;
    for await (const line of readline.createInterface({ input: fs.createReadStream(archive), crlfDelay: Infinity })) {
        const raw = JSON.parse(line), relative = raw.name.split('/documents/')[1];
        if (relative.startsWith('reconciliation_states/')) documents.set(relative, raw);
        if (/^billing_states\/[^/]+$/.test(relative) && !firstBill && raw.fields?.stateData) firstBill = raw;
    }
    const record = documents.get('reconciliation_states/main-reconciliation-state');
    const header = decode({ mapValue: { fields: record.fields } });
    let reconciliation = header;
    if (header._isChunked) {
        const parts = [];
        for (let index = 0; index < header.totalChunks; index++) {
            const id = header.chunkVersion ? header.chunkVersion + '_' + index : index;
            const part = documents.get('reconciliation_states/main-reconciliation-state/chunks/' + id);
            if (!part) throw Error('Offline visual fixture chunk missing');
            const data = decode({ mapValue: { fields: part.fields } });
            parts.push(Buffer.from(data.chunk, data.encoding === 'base64' ? 'base64' : 'utf8'));
        }
        reconciliation = JSON.parse(Buffer.concat(parts).toString('utf8'));
    }
    if (!firstBill || !reconciliation.stateData?.Contractors?.length) throw Error('Verified offline baseline required for visual review');
    return { bill: decode({ mapValue: { fields: firstBill.fields } }), reconciliation };
}
async function main() {
    const seedContext = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'js/data/default-daily-progress.js'), 'utf8'), seedContext);
    const snapshot = await baseline(), f = fixture({ seed: seedContext.window.DailyProgressSeed }), bills = new Map([[snapshot.bill.dataId, snapshot.bill]]);
    Object.assign(f.db, {
        connect: async () => {}, isConnected: () => true, getProvider: () => 'visual-fixture', getErrorHint: error => error.message,
        getBillingState: async id => copy(bills.get(id) || null), getLatestBillingState: async () => copy([...bills.values()][0]),
        listBills: async () => [...bills.values()].map(row => ({ ...row, stateData: undefined })), countBills: async () => bills.size,
        async saveBillingState(id, data, rev) {
            if ((bills.get(id)?.rev || 0) !== rev) throw Object.assign(Error('Fixture conflict'), { status: 409 }); bills.set(id, copy(data));
        }, async deleteBillingState(id) { if (bills.size < 2) throw Error('Last fixture bill'); bills.delete(id); },
        getReconciliationState: async () => copy(snapshot.reconciliation),
        async saveReconciliationState(data, rev, expected) {
            if (snapshot.reconciliation.rev !== expected) throw Object.assign(Error('Fixture conflict'), { status: 409 });
            snapshot.reconciliation = { ...snapshot.reconciliation, stateData: copy(data), rev };
        }
    });
    // Use the real legacy summary projection, including its invoice fallbacks.
    const source = fs.readFileSync(path.join(root, 'api/db.js'), 'utf8');
    const listing = { connect: async () => {}, activeProvider: 'firebase', firestoreDb: { collection: () => ({ orderBy: () => ({ get: async () => ({ docs: [...bills.values()].map(value => ({ data: () => copy(value) })) }) }) }) } };
    vm.runInNewContext(source.slice(source.indexOf('async function listBills('), source.indexOf('async function countBills(')), listing);
    f.db.listBills = listing.listBills;
    const session = () => ({ success: true, serverTime: Date.now(), expiresAt: Date.now() + 8 * 3600000, adminExpiresAt: Date.now() + 8 * 3600000, idleMinutes: 480 });
    f.auth.router.get('/session', (req, res) => res.json(session()));
    for (const action of ['activity', 'admin-unlock', 'admin-lock', 'logout']) f.auth.router.post('/' + action, (req, res) => res.json(session()));
    const app = express();
    app.use((req, res, next) => {
        req.headers.cookie = (req.headers.cookie || '') + ';' + f.ownerCookie;
        res.setHeader('X-Visual-Fixture', 'memory-only; no production connection');
        next();
    });
    app.get('/review/login.html', (req, res) => res.sendFile(path.join(root, 'portal-login.html')));
    app.get('/review/storage.html', (req, res) => res.sendFile(path.join(root, 'test/visual-storage-check.html')));
    app.use('/api/gdrive', (req, res) => res.status(503).json({ success: false, error: 'External Drive actions are disabled in the visual fixture' }));
    app.use('/api/storage', (req, res) => res.status(404).json({ success: false, error: 'Drive rollout is disabled in the visual fixture' }));
    app.use(['/js', '/css'], (req, res, next) => next());
    app.use('/js', express.static(path.join(root, 'js')));
    app.use('/css', express.static(path.join(root, 'css')));
    app.use(['/Reconciliation master', '/Reconciliation%20master'], express.static(path.join(root, 'Reconciliation master'), { index: false }));
    app.get('/daily-progress.html', (req, res) => res.sendFile(path.join(root, 'daily-progress.html')));
    app.get('/daily-entry.html', (req, res) => res.sendFile(path.join(root, 'daily-entry.html')));
    app.use(f.app);
    const port = Number(process.env.VISUAL_REVIEW_PORT || 4318);
    app.listen(port, '127.0.0.1', () => console.log(JSON.stringify({ url: 'http://127.0.0.1:' + port, provider: 'memory-only visual fixture', contractors: snapshot.reconciliation.stateData.Contractors.length, productionWrites: 0 })));
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
