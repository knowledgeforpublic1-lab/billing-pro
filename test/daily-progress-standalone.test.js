const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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
    assert.equal(mockLocalStorage['billing_daily_progress'] !== undefined, true, 'Saved to localStorage');

    // 9. Share link generation
    mountedApp.copyShareLink();
    assert.ok(sandbox._copiedUrl, 'Share link copied');
    assert.ok(sandbox._copiedUrl.includes('/daily-progress.html?contractor=mangesh-sonwane'), 'Generates proper shareable link');

    // 10. Switch contractor
    mountedApp.selectedContractorId = 'maa-kali';
    mountedApp.loadReportForActiveDate();
    assert.equal(mountedApp.activeContractor.name, 'MAA KALI ENTERPRISES');
    // Maa kali has no entries yet
    assert.equal(mountedApp.quantities['1'], undefined, 'Contractor change isolates report quantities');
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
