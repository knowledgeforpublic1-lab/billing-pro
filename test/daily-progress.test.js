const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');

test('Daily Progress Module: Seed, Contractor Linking, Stock Balances & Persistence', async () => {
    // 1. Create simulated browser environment
    const context = {
        window: {
            DailyProgressSeed: null,
            ContractorSapStock: null,
            DefaultContractorSapStock: null,
            ExcelJS: require('exceljs')
        },
        document: {
            body: { appendChild() {}, removeChild() {} },
            createElement() { return { setAttribute() {}, click() {} }; }
        },
        localStorage: {
            _s: {},
            getItem(k) { return this._s[k] || null; },
            setItem(k, v) { this._s[k] = String(v); },
            removeItem(k) { delete this._s[k]; }
        },
        console: { log() {}, warn() {}, error() {}, info() {} },
        Blob: class { constructor(parts) { this.parts = parts; } },
        URL: { createObjectURL() { return 'blob://dummy'; }, revokeObjectURL() {} },
        setTimeout: (fn) => setTimeout(fn, 0),
        clearTimeout,
        newIntl: Intl
    };
    context.window.window = context.window;
    vm.createContext(context);

    // 2. Load seed file
    const seedCode = fs.readFileSync('js/data/default-daily-progress.js', 'utf8');
    vm.runInContext(seedCode, context);
    const seed = context.window.DailyProgressSeed;

    assert.ok(seed, 'DailyProgressSeed should exist');
    assert.strictEqual(seed.contractor.id, 'mangesh-sonwane', 'Contractor should be MANGESH SONWANE');
    assert.strictEqual(seed.items.length, 401, 'Seed should contain exactly 401 items');
    assert.strictEqual(seed.records.length, 30, 'Seed should contain 30 daily reports for September 2026');

    // 3. Load DailyProgressModule
    const dpCode = fs.readFileSync('js/daily-progress.js', 'utf8');
    vm.runInContext(dpCode, context);
    const dpModule = context.window.DailyProgressModule;
    assert.ok(dpModule, 'DailyProgressModule should be defined');

    // 4. Test app instance with DailyProgressModule methods
    const app = {
        ...dpModule,
        dailyProgressTab: 'entry',
        dailyProgressDate: '2026-09-01',
        dailyProgressContractorId: 'mangesh-sonwane',
        dailyProgressData: null,
        dailyProgressQuantities: {},
        dailyProgressManpower: { leader: 0, skilled: 0, unskilled: 0, tractor: 0, augur: 0, room: 0 },
        dailyProgressRemarks: '',
        dailyProgressVersion: 0,
        dailyProgressDirty: false,
        dailyProgressBusy: false,
        selectedContractorId: 'mangesh-sonwane',
        selectedContractorName: 'MANGESH SONWANE',
        contractorsList: [{ id: 'mangesh-sonwane', name: 'MANGESH SONWANE', feederName: 'ANGARA' }],
        projectMeta: { zone: 'Gadchiroli (T-10)' },
        showToast(msg) { this.lastToast = msg; },
        formatDisplayDate(d) { return d; },
        getContractorSapIssues() {
            return {
                materials: {
                    '11000123': {
                        code: '11000123',
                        desc: 'M SAND 0-6 MM',
                        uom: 'KG',
                        netIssue: 100,
                        issuedQty: 100,
                        txns: [
                            ['2026-09-01', 100, 0],
                            ['2026-10-15', 50, 0] // Future transaction that must NOT be counted on 2026-09-01
                        ]
                    },
                    '11000336': { code: '11000336', desc: 'CEMENT GRADE OPC 53', uom: 'KG', netIssue: 50, issuedQty: 50 }
                }
            };
        }
    };

    // 5. Test initialization
    await app.initDailyProgress();
    assert.ok(app.dailyProgressData, 'dailyProgressData should be initialized');
    assert.strictEqual(app.dailyProgressData.contractors.length, 1, 'Should have initial contractor');
    assert.strictEqual(app.dailyProgressData.reports.length, 30, 'Should load 30 seed reports');

    // 6. Test loading report for 2026-09-01
    app.loadDailyProgressReportForDate('2026-09-01');
    assert.strictEqual(app.dailyProgressQuantities['15'], 3, 'Item 15 (M SAND) should have 3 KG consumed on 2026-09-01');
    assert.strictEqual(app.dailyProgressManpower.leader, 1, 'Leader should be 1');
    assert.strictEqual(app.dailyProgressManpower.skilled, 7, 'Skilled should be 7');
    assert.strictEqual(app.dailyProgressManpower.unskilled, 6, 'Unskilled should be 6');

    // 7. Test SAP Stock linking & Stock Balance calculation
    const sandItem = seed.items.find(i => i.id === '15'); // code: '11000123', M SAND
    assert.ok(sandItem, 'Sand item should exist');
    const stockInfo = app.getDailyProgressItemStock(sandItem);

    // SAP issued is 100, consumed on 2026-09-01 is 3, balance should be 97
    assert.strictEqual(stockInfo.sapIssued, 100, 'SAP issued should be 100');
    assert.strictEqual(stockInfo.totalConsumed, 3, 'Total consumed up to 2026-09-01 should be 3');
    assert.strictEqual(stockInfo.balance, 97, 'Balance should be 97');
    assert.strictEqual(stockInfo.status, 'in_stock', 'Status should be in_stock');

    // 8. Test Saving Daily Progress Report
    app.onDailyProgressQuantityChange('15', 12);
    assert.strictEqual(app.dailyProgressDirty, true, 'Dirty flag should be true after change');
    await app.saveDailyProgressReport();
    assert.strictEqual(app.dailyProgressDirty, false, 'Dirty flag should reset after save');
    assert.strictEqual(app.dailyProgressQuantities['15'], 12, 'Quantity should be updated to 12');

    // Re-verify stock balance after updated consumption
    const updatedStock = app.getDailyProgressItemStock(sandItem);
    assert.strictEqual(updatedStock.totalConsumed, 12, 'Total consumed should now be 12');
    assert.strictEqual(updatedStock.balance, 88, 'Balance should now be 88');

    // 9. Test Date Navigation
    app.navigateDailyProgressDay(1);
    assert.strictEqual(app.dailyProgressDate, '2026-09-02', 'Date should navigate to 2026-09-02');

    // 10. Test 'issued' filter logic ("jo issue ho usi ko dikhana")
    app.dailyProgressFilter = 'issued';
    app.dailyProgressSearch = '';
    const visibleIssued = seed.items.filter(it => {
        const stock = app.getDailyProgressItemStock(it);
        return (stock && stock.totalIssued > 0) || Number(app.dailyProgressQuantities[it.id]) > 0;
    });
    assert.ok(visibleIssued.length > 0, 'There should be issued items visible');
    assert.ok(visibleIssued.length < seed.items.length, 'Issued items count should be less than all 401 items');
    assert.ok(visibleIssued.some(it => it.id === '15'), 'Item 15 (M SAND with 100 SAP issue) should be in visible issued items');

    // 11. Test Vue 3 Reactivity without this.$set
    assert.strictEqual(typeof app.$set, 'undefined', '$set should NOT exist on app in Vue 3');
    app.onDailyProgressQuantityChange('15', 55);
    assert.strictEqual(app.dailyProgressQuantities['15'], 55, 'Quantity must update without $set');
    assert.strictEqual(app.dailyProgressDirty, true, 'Dirty flag must be true');
    app.onDailyProgressManpowerChange('skilled', 9);
    assert.strictEqual(app.dailyProgressManpower.skilled, 9, 'Manpower must update without $set');

    // 12. Test Date-filtered SAP stock (Future transactions excluded)
    app.dailyProgressDate = '2026-09-01';
    const stockAtSept = app.getDailyProgressItemStock(sandItem);
    assert.strictEqual(stockAtSept.sapIssued, 100, 'Future txn on 2026-10-15 must not be included on 2026-09-01');
    app.dailyProgressDate = '2026-10-20';
    const stockAtOct = app.getDailyProgressItemStock(sandItem);
    assert.strictEqual(stockAtOct.sapIssued, 150, 'Both txns (100 + 50) must be included when date is past 2026-10-15');

    // 13. Test Contractor Switch without Data Mixing
    app.dailyProgressContractorId = 'mangesh-sonwane';
    app.dailyProgressQuantities = { '15': 99 };
    app.dailyProgressData.contractors.push({ id: 'contractor-b', name: 'CONTRACTOR B', project: 'P2', feeder: 'F2' });
    app.contractorsList.push({ id: 'contractor-b', name: 'CONTRACTOR B' });
    app.selectedContractorId = 'contractor-b';
    app.selectedContractorName = 'CONTRACTOR B';
    app.dailyProgressDate = '2026-09-01';
    app.syncWithBillingProActiveContractor();
    assert.strictEqual(app.dailyProgressContractorId, 'mangesh-sonwane', 'Unsaved entry must not silently switch contractor');
    assert.strictEqual(app.dailyProgressQuantities['15'], 99, 'Unsaved quantities remain with their original contractor');
    app.dailyProgressDirty = false;
    app.syncWithBillingProActiveContractor();
    assert.strictEqual(app.dailyProgressContractorId, 'contractor-b', 'Contractor ID must update');
    assert.strictEqual(app.dailyProgressQuantities['15'], undefined, 'Previous contractor quantities must NOT leak into new contractor');

    // 14. Test Persistence Failure Handling
    context.BillingStorage = {
        setItem() { throw new Error('Simulated disk/quota failure'); }
    };
    app.dailyProgressContractorId = 'mangesh-sonwane';
    app.dailyProgressDate = '2026-09-01';
    app.dailyProgressDirty = true;
    const oldVersion = app.dailyProgressVersion;
    await app.saveDailyProgressReport();
    assert.strictEqual(app.dailyProgressDirty, true, 'Dirty flag must remain true when storage fails');
    assert.strictEqual(app.dailyProgressVersion, oldVersion, 'Version must not increment when storage fails');
    assert.ok(app.lastToast.includes('Failed to save'), 'Error toast must be shown on storage failure');

    // 15. Test Contractor Search Combo Box in Daily Progress Module
    const indexHtml = fs.readFileSync('index.html', 'utf8');
    assert.ok(indexHtml.includes('dp-search-combo-box'), 'index.html contains dp-search-combo-box');
    assert.ok(indexHtml.includes('dailyProgressContractorSearch'), 'index.html binds dailyProgressContractorSearch');

    app.dailyProgressContractorDropdownOpen = false;
    app.dailyProgressContractorSearch = '';
    app.dailyProgressDirty = false;
    app.toggleDailyProgressContractorDropdown();
    assert.strictEqual(app.dailyProgressContractorDropdownOpen, true, 'Dropdown opens on toggle');

    app.dailyProgressContractorSearch = 'mangesh';
    app.selectDailyProgressContractor('contractor-b');
    assert.strictEqual(app.dailyProgressContractorId, 'contractor-b', 'selectDailyProgressContractor updates ID');
    assert.strictEqual(app.dailyProgressContractorDropdownOpen, false, 'selectDailyProgressContractor closes dropdown');
    assert.strictEqual(app.dailyProgressContractorSearch, '', 'selectDailyProgressContractor clears search');

    app.dailyProgressContractorDropdownOpen = true;
    app.dailyProgressContractorSearch = 'temp';
    app.closeDailyProgressContractorDropdown();
    assert.strictEqual(app.dailyProgressContractorDropdownOpen, false, 'closeDailyProgressContractorDropdown closes');
    assert.strictEqual(app.dailyProgressContractorSearch, '', 'closeDailyProgressContractorDropdown clears search');

    console.log('✅ Daily Progress Module: All unit tests passed successfully.');
});
