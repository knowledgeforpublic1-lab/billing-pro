const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function sharePage(fetcher) {
    let app;
    const storage = new Map();
    const options = {};
    const context = {
        window: { location: { search: '?contractor=intally_dynamix_private_limited&date=2026-11-17' } },
        document: { getElementById() { return {}; } },
        URLSearchParams, console, setTimeout() {}, clearTimeout() {},
        localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
        fetch: (...args) => fetcher(...args),
        Vue: { createApp(config) {
            Object.assign(options, config);
            app = Object.assign(config.data(), config.methods);
            for (const [key, fn] of Object.entries(config.computed)) Object.defineProperty(app, key, { get: () => fn.call(app) });
            return { mount() {} };
        } }
    };
    vm.runInNewContext(fs.readFileSync('js/daily-progress-standalone.js', 'utf8'), context);
    return { app, storage, options };
}

test('stock refresh replaces 5 with 10, updates balances by posting date and keeps unsaved progress', async () => {
    let blocks = {}, fail = false;
    const { app } = sharePage(async () => ({ ok: !fail, json: async () => ({ success: true, byContractorNorm: blocks }) }));
    const cid = app.selectedContractorId;
    app.contractors = [{ id: cid, name: 'Intally' }];
    app.selectedDate = '2026-11-24';
    app.reports = [{ contractorId: cid, date: '2026-11-20', quantities: { 15: 2 } }];
    app.issues = [{ contractorId: cid, date: '2026-11-20', itemId: '15', quantity: 1 }];
    app.quantities = { 15: 17 }; app.dirty = true;
    const draft = app.quantities, item = { id: '15', code: '100' };
    blocks = { intally: { contractorName: 'Intally', materials: { 100: { netIssue: 5 } } } };
    await app.ensureStock();
    assert.equal(app.getItemStock(item).sapIssued, 5);
    blocks = { intallynew: { contractorName: 'Intally', materials: {
        100: { netIssue: 15, txns: [['2026-11-20', 5, 0], ['2026-11-24', 5, 0], ['2026-11-25', 5, 0]] },
        101: { netIssue: 3 }
    } } };
    await app.ensureStock(true);
    const updated = app.getItemStock(item);
    assert.equal(updated.sapIssued, 10, 'Future issues do not enter today\'s stock');
    assert.equal(updated.totalIssued, 11);
    assert.equal(updated.totalConsumed, 2);
    assert.equal(updated.balance, 9);
    assert.equal(app.getItemStock({ id: '16', code: '101' }).sapIssued, 3);
    assert.equal(app.sapStock.byContractorNorm.intally, undefined, 'Old block is removed');
    assert.equal(app.quantities, draft); assert.equal(app.dirty, true);
    fail = true;
    await app.ensureStock(true);
    assert.equal(app.getItemStock(item).sapIssued, 10, 'Failed refresh retains the last good copy');
    fail = false; blocks = {};
    await app.ensureStock(true);
    assert.equal(app.getItemStock(item).sapIssued, 0, 'Empty replacement clears old issues');
});

test('shared requests keep the link scope and discard unrelated cached or refreshed rows', async () => {
    let requestHeaders;
    const cid = 'intally_dynamix_private_limited';
    const { app } = sharePage(async (url, options) => {
        requestHeaders = options.headers;
        return { ok: true, json: async () => ({ success: true, data: {
            reports: [{ contractorId: cid, date: '2026-11-17', version: 1 }, { contractorId: 'another', date: '2026-11-17', version: 1 }],
            reportStates: [{ contractorId: 'another' }], issues: [{ contractorId: 'another' }]
        } }) };
    });
    app.contractors = [{ id: cid, name: 'Intally' }];
    app.reports = [{ contractorId: 'another', date: '2026-11-17', pending: true }];
    await app.fetchLatestReportsSilently();
    assert.equal(decodeURIComponent(requestHeaders['X-DP-Share-Contractor']), cid);
    assert.ok(app.reports.every(r => r.contractorId === cid));
    assert.equal(app.reportStates.length, 0);
    assert.equal(app.issues.length, 0);
});

test('choosing an assigned contractor changes request scope without enabling admin controls', async () => {
    let scope;
    const { app } = sharePage(async (url, options) => {
        scope = decodeURIComponent(options.headers['X-DP-Share-Contractor']);
        return { ok: true, json: async () => ({ success: true, data: { reports: [], reportStates: [], issues: [] } }) };
    });
    app.contractors = [{ id: app.selectedContractorId, name: 'First' }, { id: 'second', name: 'Second' }];
    app.selectContractor('second');
    await app.fetchLatestReportsSilently();
    assert.equal(scope, 'second');
    assert.equal(app.selectedContractorId, 'second');
    assert.equal(app.isAdmin, false);
    app.selectContractor('unassigned');
    assert.equal(app.selectedContractorId, 'second');
});

test('location is required for entry; same-day site quantities and legacy reports stay separate', async () => {
    let submitted;
    const { app } = sharePage(async (url, init) => {
        if (init?.method === 'POST') { submitted = JSON.parse(init.body); return { ok: true, json: async () => ({ success: true, reports: submitted.reports }) }; }
        return { ok: true, json: async () => ({ success: true, data: { reports: [] } }) };
    });
    app.contractors = [{ id: app.selectedContractorId, name: 'Contractor' }];
    const a = 'loc_aaaaaaaaaaaaaaaaaaaaaaaa', b = 'loc_bbbbbbbbbbbbbbbbbbbbbbbb';
    app.locations = [{ id: a, name: 'Site A' }, { id: b, name: 'Site B' }];
    app.reports = [
        { contractorId: app.selectedContractorId, date: app.selectedDate, locationId: a, quantities: { 15: 5 }, version: 1 },
        { contractorId: app.selectedContractorId, date: app.selectedDate, locationId: b, quantities: { 15: 9 }, version: 1 },
        { contractorId: app.selectedContractorId, date: app.selectedDate, quantities: { 15: 11 }, version: 1 }
    ];
    await app.saveProgress();
    assert.equal(submitted, undefined, 'No save without selecting a location');
    app.selectedLocationId = a; app.loadReportForActiveDate();
    assert.equal(app.quantities[15], 5);
    app.selectedLocationId = b; app.loadReportForActiveDate();
    assert.equal(app.quantities[15], 9);
    app.selectedLocationId = 'legacy'; app.loadReportForActiveDate();
    assert.equal(app.quantities[15], 11);
    assert.equal(app.canEnterLocation, false);
    app.selectedLocationId = a; app.loadReportForActiveDate(); app.onQuantityInput('15', 6);
    await app.saveProgress();
    assert.equal(submitted.reports[0].locationId, a);
    assert.equal(app.reports.find(row => row.locationId === b).quantities[15], 9);
    assert.equal(app.reports.find(row => !row.locationId).quantities[15], 11);
    assert.ok(app.getContractorShareUrl(app.selectedContractorId, app.selectedDate).includes('location=' + a));
});

test('deleted-location date uses server revision when starting a fresh entry', async () => {
    let submitted;
    const { app } = sharePage(async (url, init) => {
        if (init?.method === 'POST') { submitted = JSON.parse(init.body); return { ok: true, json: async () => ({ success: true }) }; }
        return { ok: true, json: async () => ({ success: true, data: { reports: [] } }) };
    });
    const locationId = 'loc_aaaaaaaaaaaaaaaaaaaaaaaa';
    app.locations = [{ id: locationId, name: 'Site A' }]; app.selectedLocationId = locationId;
    app.reportStates = [{ contractorId: app.selectedContractorId, locationId, date: app.selectedDate, deleted: true, version: 6 }];
    app.loadReportForActiveDate(); assert.equal(app.version, 6);
    app.onQuantityInput('15', 2); await app.saveProgress();
    assert.equal(submitted.reports[0].version, 7);
});

test('a poll started before a save cannot overwrite the confirmed location entry afterward', async () => {
    let finish;
    const { app } = sharePage(async (url, init) => {
        if (init?.method === 'POST') return { ok: true, json: async () => ({ success: true }) };
        return new Promise(resolve => { finish = resolve; });
    });
    app.locations = [{ id: 'loc_aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Site A' }]; app.selectedLocationId = app.locations[0].id;
    const row = { contractorId: app.selectedContractorId, locationId: app.selectedLocationId, date: app.selectedDate, version: 1, quantities: { 15: 2 } };
    app.reports = [row]; app.version = 1;
    const poll = app.fetchLatestReportsSilently();
    app.onQuantityInput('15', 9);
    await app.saveProgress();
    finish({ ok: true, json: async () => ({ success: true, data: { reports: [row] } }) });
    await poll;
    assert.equal(app.quantities[15], 9);
    assert.equal(app.reports[0].version, 2);
});

test('share page resolves API SAP aliases without protected seed scripts', async () => {
    const { app } = sharePage(async url => {
        if (url.includes('/catalog')) return { ok: true, json: async () => ({ success: true,
            contractors: [{ id: 'intally_dynamix_private_limited', name: 'Intally Dynamix Private Limited' }],
            items: [{ id: '15', code: '100' }] }) };
        if (url.includes('/stock/')) return { ok: true, json: async () => ({ success: true, byContractorNorm: {
            intallydynamix: { contractorName: 'INTALLY DYNAMIX', workOrders: ['31006105'], materials: { 100: { txns: [['2026-11-16', 12, 2]] } } }
        } }) };
        return { ok: true, json: async () => ({ success: true, data: { contractors: [], reports: [], issues: [] } }) };
    });
    await app.initData();
    assert.equal(app.activeContractor.name, 'Intally Dynamix Private Limited');
    assert.equal(app.getItemStock(app.items[0]).totalIssued, 10);
});

test('failed share save preserves base version, exact server error and only retries the selected date', async () => {
    let fail = true;
    const bodies = [];
    const { app, storage } = sharePage(async (url, init) => {
        bodies.push(JSON.parse(init.body));
        return { ok: !fail, status: fail ? 409 : 200, json: async () => fail ? { success: false, error: 'Entry reserved by another editor' } : { success: true } };
    });
    app.contractors = [{ id: app.selectedContractorId, name: 'Intally' }];
    app.locations = [{ id: 'loc_aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Site A' }];
    app.selectedLocationId = app.locations[0].id;
    app.reports = [{ contractorId: app.selectedContractorId, date: '2026-11-16', version: 1, quantities: { 15: 3 } }];
    app.version = 2;
    app.quantities = { 15: 9 };
    const dashboardCache = JSON.stringify({ reports: [{ contractorId: 'another', pending: true }] });
    storage.set('billing_daily_progress', dashboardCache);
    await app.saveProgress();
    assert.equal(storage.get('billing_daily_progress'), dashboardCache, 'Shared saves preserve dashboard drafts');
    assert.equal(app.version, 2);
    assert.equal(app.dirty, true);
    assert.match(app.toastMsg, /Entry reserved by another editor/);
    assert.equal(bodies[0].reports.length, 1);
    assert.equal(bodies[0].reports[0].version, 3);
    const draft = JSON.parse(storage.get('billing_daily_progress_share:intally_dynamix_private_limited')).reports.find(r => r.date === app.selectedDate);
    assert.equal(draft.pending, true);
    assert.equal(draft.version, 2);
    fail = false;
    await app.saveProgress();
    assert.equal(bodies[1].reports[0].version, 3);
    assert.equal(app.version, 3);
    assert.equal(app.dirty, false);
    assert.equal(storage.get('billing_daily_progress'), dashboardCache);
});

test('share refresh picks corrected reports, clears removed entries and protects edits during a request', async () => {
    let finish;
    const { app } = sharePage(() => new Promise(resolve => { finish = resolve; }));
    const row = { contractorId: app.selectedContractorId, date: app.selectedDate };
    app.reports = [{ ...row, version: 1, quantities: { 15: 10, 16: 5 } }, { ...row, version: 2, quantities: { 15: 2 } }];
    app.loadReportForActiveDate();
    assert.equal(app.quantities[15], 2);
    assert.equal(app.quantities[16], undefined);
    let pending = app.fetchLatestReportsSilently();
    app.onQuantityInput('15', 99);
    finish({ ok: true, json: async () => ({ success: true, data: { reports: [{ ...row, version: 3, quantities: { 15: 3 } }] } }) });
    await pending;
    assert.equal(app.quantities[15], 99);
    assert.equal(app.reports.length, 2);
    app.dirty = false;
    pending = app.fetchLatestReportsSilently();
    finish({ ok: true, json: async () => ({ success: true, data: { reports: [] } }) });
    await pending;
    assert.equal(Object.keys(app.quantities).length, 0);
    assert.equal(app.version, 0);
});

test('first unsent device draft survives reload with version zero and blocks background overwrite', async () => {
    const { app, storage } = sharePage(async url => {
        if (url.includes('/catalog')) return { ok: true, json: async () => ({ success: true,
            contractors: [{ id: 'intally_dynamix_private_limited', name: 'Intally Dynamix Private Limited' }], items: [] }) };
        if (url.includes('/stock/')) return { ok: true, json: async () => ({ success: true, byContractorNorm: {} }) };
        return { ok: true, json: async () => ({ success: true, data: { contractors: [], reports: [], issues: [] } }) };
    });
    storage.set('billing_daily_progress', JSON.stringify({ reports: [{ contractorId: app.selectedContractorId, date: app.selectedDate,
        version: 0, pending: true, quantities: { 15: 7 }, manpower: {}, remarks: 'Unsent draft' }] }));
    await app.initData();
    assert.equal(app.quantities[15], 7);
    assert.equal(app.version, 0);
    assert.equal(app.dirty, true);
    await app.fetchLatestReportsSilently();
    assert.equal(app.quantities[15], 7);
});

test('Daily Progress Standalone Page & Net Issue Verification', async (t) => {
    // 1. Verify daily-progress.html exists and references standalone assets
    const html = fs.readFileSync(path.join(__dirname, '../daily-progress.html'), 'utf8');
    assert.ok(html.includes('daily-standalone.css'), 'Loads daily-standalone.css');
    assert.ok(html.includes('daily-progress-standalone.js'), 'Loads daily-progress-standalone.js');
    assert.ok(html.includes('Net Issue'), 'Displays Net Issue column header');
    assert.ok(html.includes('CONTRACTOR / LABOUR TEAM'), 'Provides contractor team selection');

    // 2. Setup mock browser environment
    let mountedApp = null;
    const mockLocalStorage = {};
    const mockStorage = {
        getItem(k) { return mockLocalStorage[k] || null; },
        setItem(k, v) { mockLocalStorage[k] = String(v); },
        removeItem(k) { delete mockLocalStorage[k]; }
    };

    const sandbox = {
        window: {
            location: { search: '?contractor=mangesh-sonwane&date=2026-11-16', origin: 'https://billing-pro.local' },
            DailyProgressSeed: {
                contractor: { id: 'mangesh-sonwane', name: 'MANGESH SONWANE', project: 'Gadchiroli (T-10)', feeder: 'ANGARA' },
                items: [
                    { id: '1', code: '17000004', name: 'RSJ POLE 100X116 MM 9 MTR', unit: 'NO', row: 15 },
                    { id: '2', code: '17005037', name: 'RSJ POLE 100X116 MM 8 MTR', unit: 'NO', row: 16 }
                ],
                records: []
            },
            DefaultContractors: [
                { id: 'mangesh-sonwane', name: 'MANGESH SONWANE' },
                { id: 'maa-kali', name: 'MAA KALI ENTERPRISES' }
            ],
            ContractorSapStock: {
                byContractorNorm: {
                    'mangeshsonwane': {
                        materials: {
                            '17000004': {
                                txns: [
                                    ['2026-11-10', 100, 10], // 90 net issued on 10th
                                    ['2026-11-20', 50, 0]    // future issue on 20th
                                ]
                            }
                        }
                    }
                }
            }
        },
        document: {
            getElementById() { return {}; }
        },
        localStorage: mockStorage,
        navigator: {
            clipboard: {
                writeText: async (t) => { sandbox._copiedUrl = t; }
            }
        },
        fetch: async (url, opts) => {
            if (url.includes('/api/daily-progress/data')) {
                if (opts && opts.method === 'POST') {
                    sandbox._savedCloudPayload = JSON.parse(opts.body);
                    return { ok: true, json: async () => ({ success: true }) };
                }
                return { ok: true, json: async () => ({ success: true, data: null }) };
            }
            return { ok: false, status: 404 };
        },
        URLSearchParams: require('url').URLSearchParams,
        Intl,
        Date,
        Math,
        Number,
        String,
        Array,
        Object,
        Map,
        Set,
        clearTimeout,
        setTimeout,
        console
    };

    sandbox.Vue = {
        createApp(options) {
            mountedApp = Object.assign({}, options.data(), options.methods, {
                $computed: options.computed
            });
            // Bind computed properties
            for (const [k, fn] of Object.entries(options.computed)) {
                Object.defineProperty(mountedApp, k, {
                    get() { return fn.call(mountedApp); }
                });
            }
            return {
                mount() {
                    if (typeof options.mounted === 'function') {
                        options.mounted.call(mountedApp);
                    }
                }
            };
        }
    };

    // 3. Execute standalone JS in sandbox
    const js = fs.readFileSync(path.join(__dirname, '../js/daily-progress-standalone.js'), 'utf8');
    vm.runInNewContext(js, sandbox);

    assert.ok(mountedApp, 'App mounted successfully');
    await mountedApp.initData();
    mountedApp.locations = [{ id: 'loc_aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Site A' }];
    mountedApp.selectedLocationId = mountedApp.locations[0].id;

    // 4. Contractor selection and date initialization from URL
    assert.equal(mountedApp.selectedContractorId, 'mangesh-sonwane', 'Contractor auto-selected from URL');
    assert.equal(mountedApp.selectedDate, '2026-11-16', 'Date set from URL');
    assert.equal(mountedApp.activeContractor.name, 'MANGESH SONWANE');

    // 5. Net Issue calculation (USER REQUIREMENT: "net balance na dikha kar net issue dikhao")
    const testItem = mountedApp.items[0];
    const stock = mountedApp.getItemStock(testItem);

    // Only transaction up to 2026-11-16 (100 - 10 = 90) must be included, excluding future 2026-11-20
    assert.equal(stock.totalIssued, 90, 'Net Issue strictly filters up to work date (90 NO)');
    assert.equal(stock.sapIssued, 90, 'SAP Issued is 90');

    // 6. Enter daily consumption
    mountedApp.onQuantityInput('1', 5);
    assert.equal(mountedApp.quantities['1'], 5);
    assert.equal(mountedApp.dirty, true);
    assert.equal(mountedApp.enteredCount, 1);

    // 7. Manpower entry
    mountedApp.manpower.leader = 1;
    mountedApp.manpower.skilled = 6;
    mountedApp.manpower.unskilled = 5;
    assert.equal(mountedApp.totalManpower, 12);

    // 8. Save daily progress
    await mountedApp.saveProgress();
    assert.equal(mountedApp.saveStatus, 'saved');
    assert.equal(mountedApp.dirty, false);
    assert.ok(sandbox._savedCloudPayload, 'Saved payload to cloud API');
    assert.equal(sandbox._savedCloudPayload.reports[0].quantities['1'], 5);
    assert.equal(mockLocalStorage['billing_daily_progress_share:mangesh-sonwane'] !== undefined, true, 'Saved to localStorage');

    const workingFetch = sandbox.fetch;
    for (const failedResponse of [
        { ok: false, status: 503, json: async () => ({ success: false }) },
        { ok: true, status: 200, json: async () => { throw new Error('Invalid JSON'); } }
    ]) {
        sandbox.fetch = async () => failedResponse;
        await mountedApp.saveProgress();
        assert.equal(mountedApp.saveStatus, 'offline', 'Unconfirmed cloud responses must not claim a save');
        assert.equal(mountedApp.dirty, true, 'Unsynced entry remains pending for retry');
    }
    sandbox.fetch = workingFetch;
    await mountedApp.saveProgress();
    assert.equal(mountedApp.saveStatus, 'saved');
    assert.equal(mountedApp.dirty, false);

    // 9. Share link generation
    mountedApp.copyShareLink();
    assert.ok(sandbox._copiedUrl, 'Share link copied');
    assert.ok(sandbox._copiedUrl.includes('/daily-progress.html?contractor=mangesh-sonwane'), 'Generates proper shareable link');

    // Assigned contractors remain selectable while shared administrative actions stay off.
    assert.ok(mountedApp.contractors.some(c => c.id === 'maa-kali'));
    mountedApp.selectContractor('not-assigned');
    assert.equal(mountedApp.selectedContractorId, 'mangesh-sonwane');
    mountedApp.entryLoginUser = { role: 'admin' };
    assert.equal(mountedApp.isAdmin, false, 'Shared links never expose administrative actions');

    // 11. Contractor Search Combo Box verification
    assert.ok(html.includes('dp-search-combo-box'), 'HTML contains dp-search-combo-box');
    assert.ok(html.includes('contractorSearchText'), 'HTML binds contractorSearchText');
    mountedApp.contractorDropdownOpen = false;
    mountedApp.toggleContractorDropdown();
    assert.equal(mountedApp.contractorDropdownOpen, true, 'Dropdown opens on toggle');

    // Search for a specific contractor
    mountedApp.contractorSearchText = 'maa';
    assert.ok(mountedApp.filteredContractors.some(c => c.id === 'maa-kali'), 'Permitted contractors remain searchable');
    mountedApp.contractorSearchText = 'mangesh';
    assert.equal(mountedApp.filteredContractors.length, 1);

    // Select contractor via search
    const firstMatch = mountedApp.filteredContractors[0];
    mountedApp.selectContractor(firstMatch.id);
    assert.equal(mountedApp.selectedContractorId, firstMatch.id, 'selectContractor updates selectedContractorId');
    assert.equal(mountedApp.contractorDropdownOpen, false, 'selectContractor closes dropdown');
    assert.equal(mountedApp.contractorSearchText, '', 'selectContractor clears search text');

    // Test closeContractorDropdown resets search text
    mountedApp.contractorDropdownOpen = true;
    mountedApp.contractorSearchText = 'dummy query';
    mountedApp.closeContractorDropdown();
    assert.equal(mountedApp.contractorDropdownOpen, false, 'closeContractorDropdown closes dropdown');
    assert.equal(mountedApp.contractorSearchText, '', 'closeContractorDropdown clears search text');
});

test('Daily Progress Standalone Shared Link contractor matching with defaultContractorsList', async (t) => {
    let mountedApp = null;
    const mockStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
    const sandbox = {
        window: {
            location: { search: '?contractor=intally_dynamix_private_limited&date=2026-11-16', origin: 'https://billing-pro.local' },
            DailyProgressSeed: {
                contractor: { id: 'mangesh-sonwane', name: 'MANGESH SONWANE', project: 'Gadchiroli (T-10)', feeder: 'ANGARA' },
                items: [
                    { id: '1', code: '17005037', name: 'RSJ POLE 100X116 MM 8 MTR', unit: 'NO', row: 18 }
                ],
                records: []
            },
            defaultContractorsList: [
                { id: 'intally_dynamix_private_limited', name: 'Intally Dynamix Private Limited' },
                { id: 'amruta_electrical_cont', name: 'Amruta Electrical & Cont.' }
            ],
            ContractorSapStock: {
                byContractorNorm: {
                    'intallydynamixprivatelimited': {
                        contractorName: 'Intally Dynamix Private Limited',
                        materials: {
                            '17005037': {
                                txns: [['2026-11-15', 10, 0]]
                            }
                        }
                    }
                }
            }
        },
        document: { getElementById() { return {}; } },
        localStorage: mockStorage,
        navigator: { clipboard: { writeText: async () => {} } },
        fetch: async (url, opts) => ({ ok: true, json: async () => ({ success: true, data: null }) }),
        URLSearchParams: require('url').URLSearchParams,
        Intl, Date, Math, Number, String, Array, Object, Map, Set, clearTimeout, setTimeout, console
    };

    sandbox.Vue = {
        createApp(options) {
            mountedApp = Object.assign({}, options.data(), options.methods, { $computed: options.computed });
            for (const [k, fn] of Object.entries(options.computed)) {
                Object.defineProperty(mountedApp, k, { get() { return fn.call(mountedApp); } });
            }
            return { mount() {} };
        }
    };

    const js = fs.readFileSync(path.join(__dirname, '../js/daily-progress-standalone.js'), 'utf8');
    vm.runInNewContext(js, sandbox);
    await mountedApp.initData();

    assert.equal(mountedApp.selectedContractorId, 'intally_dynamix_private_limited');
    assert.equal(mountedApp.activeContractor.name, 'Intally Dynamix Private Limited');
    assert.ok(mountedApp.contractors.some(c => c.id === 'intally_dynamix_private_limited'));

    const item = mountedApp.items[0];
    const stock = mountedApp.getItemStock(item);
    assert.equal(stock.totalIssued, 10, 'Net Issue is 10 for Intally Dynamix');
});

test('Logged-out share link loads contractor name and net issue from the public sanitized API', async (t) => {
    let mountedApp = null;
    const sandbox = {
        window: {
            location: { search: '?contractor=saurabh_dehariya&date=2026-11-16', origin: 'https://billing-pro.local' }
        },
        document: { getElementById() { return {}; } },
        localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
        navigator: { clipboard: { writeText: async () => {} } },
        fetch: async (url) => {
            if (url.includes('/api/daily-entry/catalog')) {
                return { ok: true, json: async () => ({
                    success: true,
                    contractors: [{ id: 'saurabh_dehariya', name: 'Saurabh Dehariya', project: 'Gadchiroli (T-10)', feeder: '', engineer: '' }],
                    items: [{ id: '1', code: '17000004', name: 'RSJ POLE 100X116 MM 9 MTR', unit: 'NO', row: 15 }]
                }) };
            }
            if (url.includes('/api/daily-entry/stock/saurabh_dehariya')) {
                return { ok: true, json: async () => ({
                    success: true,
                    byContractorNorm: {
                        saurabhdehariya: {
                            contractorName: 'Saurabh Dehariya',
                            materials: { '17000004': { txns: [['2026-11-10', 100, 10], ['2026-11-20', 50, 0]] } }
                        }
                    }
                }) };
            }
            return { ok: false, status: 401, json: async () => ({ success: false }) };
        },
        URLSearchParams: require('url').URLSearchParams,
        Intl, Date, Math, Number, String, Array, Object, Map, Set, clearTimeout, setTimeout, console
    };
    sandbox.Vue = {
        createApp(options) {
            mountedApp = Object.assign({}, options.data(), options.methods, { $computed: options.computed });
            for (const [k, fn] of Object.entries(options.computed)) {
                Object.defineProperty(mountedApp, k, { get() { return fn.call(mountedApp); } });
            }
            return { mount() {} };
        }
    };
    const js = fs.readFileSync(path.join(__dirname, '../js/daily-progress-standalone.js'), 'utf8');
    vm.runInNewContext(js, sandbox);
    await mountedApp.initData();

    assert.equal(mountedApp.selectedContractorId, 'saurabh_dehariya');
    assert.equal(mountedApp.activeContractor.name, 'Saurabh Dehariya', 'Contractor name loads without login');
    assert.equal(mountedApp.items.length, 1, 'Materials load without login');
    const stock = mountedApp.getItemStock(mountedApp.items[0]);
    assert.equal(stock.totalIssued, 90, 'Net Issue loads without login and respects work date');
});

test('Contractor work order chooses the correct stock block and exact ids isolate reports', async () => {
    let mountedApp = null;
    const sandbox = {
        window: {
            location: { search: '?contractor=intally_dynamix_private_limited&date=2026-11-16', origin: 'https://billing-pro.local' },
            DailyProgressSeed: {
                contractor: { id: 'intally_dynamix_private_limited', name: 'Intally Dynamix Private Limited' },
                items: [{ id: '1', code: '17005037', name: 'RSJ POLE', unit: 'NO', row: 18 }],
                records: []
            },
            DefaultContractors: [
                { id: 'intally_dynamix_private_limited', name: 'Intally Dynamix Private Limited', workOrderNo: '31006105' },
                { id: 'anjali_electrical', name: 'ANJALI ELECTRICAL' },
                { id: 'anjali_electricals', name: 'ANJALI ELECTRICALS' }
            ],
            DefaultSapContractorMapping: {
                groups: {
                    intallydynamix: { displayName: 'INTALLY DYNAMIX', wos: ['31006105'], rawNorms: ['intallydynamix'] },
                    intallydynamixprivatelimited: { displayName: 'Intally Dynamix Private Limited', wos: ['31007558'], rawNorms: ['intallydynamixprivatelimited'] }
                }
            },
            ContractorSapStock: {
                byContractorNorm: {
                    intallydynamixprivatelimited: {
                        contractorName: 'Intally Dynamix Private Limited',
                        docHeader: '31007558',
                        allWorkOrders: ['31007558'],
                        materials: { '17005037': { txns: [['2026-11-15', 999, 0]] } }
                    },
                    intallydynamix: {
                        contractorName: 'INTALLY DYNAMOX',
                        docHeader: '31006105',
                        allWorkOrders: ['31006105'],
                        materials: { '17005037': { txns: [['2026-11-15', 100, 10]] } }
                    }
                }
            }
        },
        document: { getElementById() { return {}; } },
        localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
        navigator: { clipboard: { writeText: async () => {} } },
        fetch: async () => ({ ok: true, json: async () => ({ success: true, data: null }) }),
        URLSearchParams: require('url').URLSearchParams,
        Intl, Date, Math, Number, String, Array, Object, Map, Set, clearTimeout, setTimeout, console
    };

    sandbox.Vue = {
        createApp(options) {
            mountedApp = Object.assign({}, options.data(), options.methods, { $computed: options.computed });
            for (const [k, fn] of Object.entries(options.computed)) {
                Object.defineProperty(mountedApp, k, { get() { return fn.call(mountedApp); } });
            }
            return { mount() {} };
        }
    };

    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/daily-progress-standalone.js'), 'utf8'), sandbox);
    await mountedApp.initData();

    const stock = mountedApp.getItemStock(mountedApp.items[0]);
    assert.equal(stock.totalIssued, 90, 'Master work order 31006105 wins over same-name block 31007558');
    assert.equal(mountedApp.findContractorStockBlocks(mountedApp.activeContractor).length, 1, 'Only one work-order block is selected');

    mountedApp.reports = [
        { contractorId: 'anjali_electricals', date: '2026-11-16', quantities: { 1: 77 }, version: 1 },
        { contractorId: 'anjali_electrical', date: '2026-11-16', quantities: { 1: 5 }, version: 1 }
    ];
    mountedApp.selectedContractorId = 'anjali_electrical';
    mountedApp.loadReportForActiveDate();
    assert.equal(mountedApp.quantities['1'], 5, 'Similar contractor name does not load another contractor report');

    mountedApp.locations = [{ id: 'loc_aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Site A' }];
    mountedApp.selectedLocationId = mountedApp.locations[0].id;
    mountedApp.reports.forEach(report => { report.locationId = mountedApp.selectedLocationId; });
    mountedApp.onQuantityInput('1', 6);
    await mountedApp.saveProgress();
    assert.equal(mountedApp.reports.find(r => r.contractorId === 'anjali_electricals').quantities['1'], 77, 'Other contractor report remains untouched');
    assert.equal(mountedApp.reports.find(r => r.contractorId === 'anjali_electrical').quantities['1'], 6, 'Exact contractor report is updated');
});
