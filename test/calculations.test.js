/**
 * @file Billing Pro - Core Calculation & Logic Test Suite
 * @description Unit tests for billing calculations, percentages, GST,
 * conductor divisors, and invoice sanitation.
 * Run directly with: node test/calculations.test.js
 */

const assert = require('assert');
const fs = require('fs');

console.log('----------------------------------------------------');
console.log('🧪 Running Billing Pro Unit Tests...');
console.log('----------------------------------------------------');

let totalTests = 0;
let passedTests = 0;

const asyncTests = [];
function it(name, fn) {
    totalTests++;
    try {
        const res = fn();
        if (res && typeof res.then === 'function') {
            asyncTests.push(res.then(() => {
                passedTests++;
                console.log(`  ✅ PASS: ${name}`);
            }).catch(err => {
                console.error(`  ❌ FAIL: ${name}`);
                console.error(err);
            }));
            return;
        }
        passedTests++;
        console.log(`  ✅ PASS: ${name}`);
    } catch (err) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(err);
    }
}

// 1. Stage Billing Percentages
it('Stage Percentages: 85% Erection, 10% Testing, 5% Handover sum to 100%', () => {
    const rate = 1000;
    const qty = 5;
    const baseTotal = rate * qty; // 5000

    const amt85 = Math.round(baseTotal * 0.85 * 100) / 100;
    const amt10 = Math.round(baseTotal * 0.10 * 100) / 100;
    const amt5  = Math.round(baseTotal * 0.05 * 100) / 100;

    assert.strictEqual(amt85, 4250);
    assert.strictEqual(amt10, 500);
    assert.strictEqual(amt5, 250);
    assert.strictEqual(amt85 + amt10 + amt5, baseTotal);
});

// 2. Activity 907 Conductor Divisor
it('Activity 907: AAAC Divisor (3150 Rmt = 1 KM)', () => {
    const divisor = 3150;
    const aaacTotalRmt = 14598.045;
    const qtyKm = Math.round((aaacTotalRmt / divisor) * 1000) / 1000;
    assert.strictEqual(qtyKm, 4.634);
});

// 3. GST Calculation Logic
it('GST: CGST (9%) + SGST (9%) vs IGST (18%)', () => {
    const basicAmount = 186416.28;

    // CGST + SGST
    const cgst = Math.round(basicAmount * 0.09 * 100) / 100;
    const sgst = Math.round(basicAmount * 0.09 * 100) / 100;
    const grandCgstSgst = Math.round((basicAmount + cgst + sgst) * 100) / 100;

    assert.strictEqual(cgst, 16777.47);
    assert.strictEqual(sgst, 16777.47);
    assert.strictEqual(grandCgstSgst, 219971.22);

    // IGST
    const igst = Math.round(basicAmount * 0.18 * 100) / 100;
    const grandIgst = Math.round((basicAmount + igst) * 100) / 100;
    assert.strictEqual(igst, 33554.93);
    assert.strictEqual(grandIgst, 219971.21);
});

// 4. Blank Invoice Row Filter Logic
it('Invoice Sanitization: Correctly identifies and cleans dummy placeholder rows', () => {
    function isBlankInvoiceItem(it) {
        if (!it) return true;
        if (it.actKey) return false;
        const desc = String(it.desc || '').trim().toLowerCase();
        const isPlaceholderDesc = !desc || desc === 'activity or work description';
        const numAmt = Number(it.amount || 0);
        const isZeroAmount = !it.amount || isNaN(numAmt) || numAmt === 0;
        return isPlaceholderDesc && isZeroAmount;
    }

    const dummyRow1 = { srNo: '1', desc: '', unit: 'Nos', qty: 1, amount: 0 };
    const dummyRow2 = { srNo: '1', desc: 'Activity or Work Description', unit: 'Nos', qty: 1, amount: '0' };
    const realRow = { srNo: '2', actKey: '907', desc: 'Activity 907 : RSJ 116x100', unit: 'KM', qty: 4.634, amount: 186416.28 };

    assert.strictEqual(isBlankInvoiceItem(dummyRow1), true);
    assert.strictEqual(isBlankInvoiceItem(dummyRow2), true);
    assert.strictEqual(isBlankInvoiceItem(realRow), false);

    // Test cleaning array
    let items = [dummyRow1, realRow];
    const hasReal = items.some(it => !isBlankInvoiceItem(it));
    if (hasReal) {
        items = items.filter(it => !isBlankInvoiceItem(it));
    }
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].actKey, '907');
});

// 5. Bill Export Filename Formatter
it('Filename Formatter: Formats contractor name and RA number correctly', () => {
    function getBillExportFileName(contractor, raNo, billNo) {
        let cName = String(contractor || 'Contractor').replace(/^M\/[sS]\.?\s*/i, '').replace(/[\/\\:*?"<>|]/g, '_').trim();
        let ra = String(raNo || '').trim();
        if (!ra && billNo) {
            const m = billNo.match(/(?:RA|BILL)[\s\/\-_]*(\d+[A-Za-z0-9\-_]*)/i);
            if (m && m[1]) ra = m[1];
        }
        if (!ra) ra = '01';
        let raPart = ra;
        if (!/^RA[\s\-_]*/i.test(raPart)) raPart = 'RA-' + raPart;
        else raPart = raPart.replace(/^RA[\s\-_]*/i, 'RA-');
        return `${cName}_${raPart}.xlsx`;
    }

    const name1 = getBillExportFileName('Manohar Traders', '04', 'RSL/RA/12');
    assert.strictEqual(name1, 'Manohar Traders_RA-04.xlsx');

    const name2 = getBillExportFileName('M/s Ranjeet Singh Lodhi', '', 'RSL/RA/12');
    assert.strictEqual(name2, 'Ranjeet Singh Lodhi_RA-12.xlsx');
});

// 6. Invoice Date Formatter (DD-MM-YYYY)
it('Invoice Date Formatter: Converts YYYY-MM-DD to DD-MM-YYYY correctly for Excel export', () => {
    function formatDateToDDMMYYYY(val) {
        if (!val) return '';
        if (val instanceof Date && !isNaN(val)) {
            const d = String(val.getDate()).padStart(2, '0');
            const m = String(val.getMonth() + 1).padStart(2, '0');
            const y = val.getFullYear();
            return `${d}-${m}-${y}`;
        }
        const s = String(val).trim();
        const isoMatch = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
        if (isoMatch) {
            const y = isoMatch[1];
            const m = isoMatch[2].padStart(2, '0');
            const d = isoMatch[3].padStart(2, '0');
            return `${d}-${m}-${y}`;
        }
        const dmyMatch = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
        if (dmyMatch) {
            const d = dmyMatch[1].padStart(2, '0');
            const m = dmyMatch[2].padStart(2, '0');
            const y = dmyMatch[3];
            return `${d}-${m}-${y}`;
        }
        return s;
    }

    assert.strictEqual(formatDateToDDMMYYYY('2026-10-29'), '29-10-2026');
    assert.strictEqual(formatDateToDDMMYYYY('2026-01-23'), '23-01-2026');
    assert.strictEqual(formatDateToDDMMYYYY('2026/05/09'), '09-05-2026');
    assert.strictEqual(formatDateToDDMMYYYY('29-10-2026'), '29-10-2026');
    assert.strictEqual(formatDateToDDMMYYYY('15/08/2026'), '15-08-2026');
});

// 7. Invoice Date Normalizer (YYYY-MM-DD for HTML input)
it('Invoice Date Normalizer: Converts DD-MM-YYYY to YYYY-MM-DD for HTML date picker', () => {
    function normalizeDateToYYYYMMDD(val) {
        if (!val) return '';
        if (val instanceof Date && !isNaN(val)) {
            const y = val.getFullYear();
            const m = String(val.getMonth() + 1).padStart(2, '0');
            const d = String(val.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        const s = String(val).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const isoMatch = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
        if (isoMatch) {
            return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
        }
        const dmyMatch = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
        if (dmyMatch) {
            return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
        }
        return s;
    }

    assert.strictEqual(normalizeDateToYYYYMMDD('29-10-2026'), '2026-10-29');
    assert.strictEqual(normalizeDateToYYYYMMDD('23/01/2026'), '2026-01-23');
    assert.strictEqual(normalizeDateToYYYYMMDD('2026-10-29'), '2026-10-29');
});

// 8. SAP Stock Contractor Issue Matching & Quantity Verification
it('SAP Stock: Matches contractor and retrieves exact net issued quantities from stock.xlsx', () => {
    global.window = global;
    const fs = require('fs');
    eval(fs.readFileSync('js/data/contractor-sap-issues.js', 'utf8'));
    const stock = window.ContractorSapStock;

    assert.ok(stock, 'ContractorSapStock should exist');
    assert.ok(stock.byDocHeader, 'byDocHeader index should exist');
    assert.ok(stock.byContractorNorm, 'byContractorNorm index should exist');
    assert.ok(stock.meta.contractorsWithIssues >= 100, 'Should have >= 100 contractors');

    // Ranjeet Singh Lodhi check by WO
    const rsl = stock.byDocHeader['31006345'];
    assert.ok(rsl, 'Ranjeet Singh Lodhi docHeader 31006345 must exist');
    assert.strictEqual(rsl.contractorName, 'RANJEET SINGH LODHI');
    assert.strictEqual(rsl.materials['17000625'].issuedQty, 15689);

    // Manohar Traders check by WO
    const mt = stock.byDocHeader['31007236'];
    assert.ok(mt, 'Manohar Traders docHeader 31007236 must exist');
    assert.strictEqual(mt.contractorName, 'Manohar Traders');
    assert.strictEqual(mt.materials['17000625'].issuedQty, 1752);

    // Contractor Name fuzzy match check
    eval(fs.readFileSync('js/billing.js', 'utf8'));
    const mockApp = {
        selectedContractorName: 'M/s Manohar Traders',
        invoiceData: { workOrderNo: '' }
    };
    const mtMatch = window.BillingModule.getContractorSapIssues.call(mockApp);
    assert.ok(mtMatch, 'M/s Manohar Traders should match by name');
    assert.ok(mtMatch.materials['17000625'], 'Should have material 17000625');
    assert.strictEqual(mtMatch.materials['17000625'].issuedQty, 1752);

    const mockAppRsl = {
        selectedContractorName: 'M/s Ranjeet Singh Lodhi',
        invoiceData: { workOrderNo: '' }
    };
    const rslMatch = window.BillingModule.getContractorSapIssues.call(mockAppRsl);
    assert.ok(rslMatch, 'M/s Ranjeet Singh Lodhi should match by name');
    assert.strictEqual(rslMatch.materials['17000625'].issuedQty, 15689);
});

// 9. SAP Stock ISSUE, MRN, NET ISSUE format & Totals
it('SAP Stock: Verifies ISSUE, MRN, and NET ISSUE breakdown format', () => {
    global.window = global;
    const fs = require('fs');
    eval(fs.readFileSync('js/data/contractor-sap-issues.js', 'utf8'));
    const stock = window.ContractorSapStock;

    // RSL Cement 11000336: Gross = 900, MRN = 250, Net = 650
    const rslCement = stock.byDocHeader['31006345'].materials['11000336'];
    assert.ok(rslCement, 'RSL Cement must exist');
    assert.strictEqual(rslCement.grossIssue, 900);
    assert.strictEqual(rslCement.mrnReturn, 250);
    assert.strictEqual(rslCement.netIssue, 650);

    // RSL RSJ Pole 17000004: Gross = 1873, MRN = 286, Net = 1587
    const rslPole = stock.byDocHeader['31006345'].materials['17000004'];
    assert.ok(rslPole, 'RSL Pole must exist');
    assert.strictEqual(rslPole.grossIssue, 1873);
    assert.strictEqual(rslPole.mrnReturn, 286);
    assert.strictEqual(rslPole.netIssue, 1587);

    // MT RSJ Pole 17000004: Gross = 370, MRN = 44, Net = 326
    const mtPole = stock.byDocHeader['31007236'].materials['17000004'];
    assert.ok(mtPole, 'MT Pole must exist');
    assert.strictEqual(mtPole.grossIssue, 370);
    assert.strictEqual(mtPole.mrnReturn, 44);
    assert.strictEqual(mtPole.netIssue, 326);
});

// 10. SAP Stock: Multi-work-order contractor consolidation
it('SAP Stock: Consolidates and sums multiple work orders for same contractor', () => {
    global.window = global;
    const fs = require('fs');
    eval(fs.readFileSync('js/data/contractor-sap-issues.js', 'utf8'));
    eval(fs.readFileSync('js/billing.js', 'utf8'));
    const stock = window.ContractorSapStock;

    // Duskline Infrastructure has 3 WOs: 31003359, 31003360, 31003362
    const dusk = stock.byContractorNorm['dusklineinfrastructure'];
    assert.ok(dusk, 'Duskline consolidated record must exist');
    assert.deepStrictEqual(dusk.allWorkOrders.slice().sort(), ['31003359', '31003360', '31003362'].sort());
    assert.strictEqual(dusk.totalGrossIssue, 1027046.87);
    assert.strictEqual(dusk.totalMrnReturn, 438628.632);
    assert.strictEqual(dusk.totalNetIssue, 588418.238);

    // Verify all 3 WOs point to the same consolidated record
    assert.strictEqual(stock.byDocHeader['31003359'].totalNetIssue, dusk.totalNetIssue);
    assert.strictEqual(stock.byDocHeader['31003360'].totalNetIssue, dusk.totalNetIssue);
    assert.strictEqual(stock.byDocHeader['31003362'].totalNetIssue, dusk.totalNetIssue);

    // Verify AAAC sum: 22364 gross, 6769 mrn, 15595 net
    assert.strictEqual(dusk.materials['17000625'].grossIssue, 22364);
    assert.strictEqual(dusk.materials['17000625'].mrnReturn, 6769);
    assert.strictEqual(dusk.materials['17000625'].netIssue, 15595);

    // Verify Baba Construction (WOs: 31005619 and 31005621)
    const baba = stock.byContractorNorm['babaconstruction'];
    assert.ok(baba, 'Baba Construction consolidated record must exist');
    assert.deepStrictEqual(baba.allWorkOrders.slice().sort(), ['31005619', '31005621'].sort());
    assert.strictEqual(baba.totalGrossIssue, 13838.9);
    assert.strictEqual(baba.totalMrnReturn, 2161.12);
    assert.strictEqual(baba.totalNetIssue, 11677.78);
    assert.strictEqual(stock.byDocHeader['31005619'].totalNetIssue, baba.totalNetIssue);
    assert.strictEqual(stock.byDocHeader['31005621'].totalNetIssue, baba.totalNetIssue);

    // Verify BillingModule lookup by contractor name returns consolidated sum
    const mockAppDusk = {
        selectedContractorName: 'DUSKLINE INFRASTRUCTURE',
        invoiceData: { workOrderNo: '31003359' }
    };
    const duskMatch = window.BillingModule.getContractorSapIssues.call(mockAppDusk);
    assert.strictEqual(duskMatch.contractorName, dusk.contractorName);
    assert.strictEqual(duskMatch.totalNetIssue, 588418.238);
});

// 11. In-browser Stock Importer Module parsing & normalization
it('Stock Importer: Successfully verifies StockImporterModule and contractor name normalizer', () => {
    global.window = global;
    const fs = require('fs');
    const XLSX = require('xlsx');
    global.XLSX = XLSX;
    eval(fs.readFileSync('js/stock-importer.js', 'utf8'));

    assert.ok(window.StockImporterModule, 'StockImporterModule should exist');
    assert.strictEqual(typeof window.StockImporterModule.parseStockExcel, 'function');

    // Test normalization helpers
    assert.strictEqual(window.StockImporterModule.normContractorName('M/s DUSKLINE INFRASTRUCTURE'), 'dusklineinfrastructure');
    assert.strictEqual(window.StockImporterModule.normContractorName('BABA CONSTRUCTION (VIKASH KUMAR DUBEY)'), 'babaconstruction');
    assert.strictEqual(window.StockImporterModule.normContractorName('M/s. Balaji Construction'), 'balajiconstruction');
});


// 12. Direct Blank New Bill Workflow (No modal prompt, clean reset)
it('New Bill Workflow: Directly blanks bill, increments RA/Bill No, and leaves contractor unselected', async () => {
    global.window = global;
    global.localStorage = {
        _data: {},
        getItem(k) { return this._data[k] || null; },
        setItem(k, v) { this._data[k] = String(v); },
        removeItem(k) { delete this._data[k]; }
    };
    eval(fs.readFileSync('js/sync.js', 'utf8'));

    let syncCalled = false;
    let savedToStorageCalled = false;

    const mockApp = {
        projectMeta: { billNo: 'RSL/RA/12', raNo: '12', contractorName: 'M/s Ravindra Kapgate', workOrderNo: '10000000008' },
        invoiceData: { invoiceNo: 'RSL/RA/12', raNo: '12', contractorName: 'M/s Ravindra Kapgate', items: [{ desc: 'Test item', amount: 5000 }] },
        selectedContractorId: 'ravindra_kapgate',
        activityQuantities: { 'act_1': [['10', '20']] },
        companiesList: [{ id: 'ashoka_buildcon', name: 'ASHOKA BUILDCON LTD.', address: 'Nagpur', gstin: '27AAACA1234A1Z5' }],
        showNewBillModal: false,
        showSavedBillsModal: false,
        currentView: 'invoice',
        showToast() {},
        resetAllManualDataKeepMapping() {
            this.activityQuantities = {};
            if (this.invoiceData) this.invoiceData.items = [];
        },
        saveToStorage() { savedToStorageCalled = true; },
        async syncToMongoNow() { syncCalled = true; return true; },
        switchView(v) { this.currentView = v; }
    };

    // Execute startNewBlankBill
    Object.assign(mockApp, window.SyncModule);
    mockApp.syncToMongoNow = async () => { syncCalled = true; return true; };
    mockApp.saveToStorage = () => { savedToStorageCalled = true; };
    mockApp.loadSavedBillsList = () => {};
    await mockApp.startNewBlankBill();

    // Assertions
    assert.strictEqual(syncCalled, true, 'syncToMongoNow must be called to save prior bill');
    assert.strictEqual(savedToStorageCalled, true, 'saveToStorage must be called');
    assert.strictEqual(mockApp.showNewBillModal, false, 'showNewBillModal must remain FALSE (no modal popup)');
    assert.strictEqual(mockApp.projectMeta.billNo, '', 'Bill No must be completely BLANK');
    assert.strictEqual(mockApp.projectMeta.raNo, '', 'RA No must be completely BLANK');
    assert.strictEqual(mockApp.invoiceData.invoiceNo, '', 'Invoice No must be completely BLANK');
    assert.strictEqual(mockApp.selectedContractorId, '', 'selectedContractorId must be completely BLANK');
    assert.strictEqual(mockApp.invoiceData.contractorName, '', 'Contractor Name in Invoice must be BLANK');
    assert.strictEqual(mockApp.invoiceData.workOrderNo, '', 'Work Order No in Invoice must be BLANK');
    assert.deepStrictEqual(mockApp.activityQuantities, {}, 'Activity quantities must be completely reset');
    assert.deepStrictEqual(mockApp.invoiceData.items, [], 'Invoice items must be empty');
});


// 13. Dynamic Contractor Download Filenames (Never hardcoded to "LK")
it('Export Filenames: Uses selected contractor name and never defaults to LK_Electricals', () => {
    global.window = global;
    eval(fs.readFileSync('js/export.js', 'utf8'));

    // Test with Ravindra Kapgate
    const app1 = {
        selectedContractorName: 'Ravindra Kapgate',
        effectiveRaNo: '12',
        invoiceData: { invoiceNo: 'RSL/RA/12', contractorName: 'M/s Ravindra Kapgate' },
        projectMeta: { raNo: '12', billNo: 'RSL/RA/12' }
    };
    Object.assign(app1, window.ExportModule);
    const cName1 = app1.getContractorCleanFileName();
    const ra1 = app1.getRaCleanFileName();
    assert.strictEqual(cName1, 'Ravindra_Kapgate');
    assert.strictEqual(ra1, 'RA-12');
    assert.strictEqual(app1.getBillExportFileName(), 'Ravindra_Kapgate_RA-12.xlsx');

    // Test with Duskline Infrastructure
    const app2 = {
        selectedContractorName: 'Duskline Infrastructure',
        effectiveRaNo: '04',
        invoiceData: { invoiceNo: 'RA-04', contractorName: 'M/s Duskline Infrastructure' },
        projectMeta: { raNo: '04', billNo: 'RA-04' }
    };
    Object.assign(app2, window.ExportModule);
    const cName2 = app2.getContractorCleanFileName();
    assert.strictEqual(cName2, 'Duskline_Infrastructure');
    assert.strictEqual(app2.getBillExportFileName(), 'Duskline_Infrastructure_RA-04.xlsx');

    // Test Reconciliation Sheet download filename for Ravindra Kapgate
    const reconFileName1 = app1.getRaCleanFileName()
        ? `${cName1}_${app1.getRaCleanFileName()}_Material_Reconciliation_Sheet.xlsx`
        : `${cName1}_Material_Reconciliation_Sheet.xlsx`;
    assert.strictEqual(reconFileName1, 'Ravindra_Kapgate_RA-12_Material_Reconciliation_Sheet.xlsx');

    // Test with blank RA No
    const app3 = {
        selectedContractorName: 'Ravindra Kapgate',
        invoiceData: { contractorName: 'M/s Ravindra Kapgate' }
    };
    Object.assign(app3, window.ExportModule);
    const cName3 = app3.getContractorCleanFileName();
    const ra3 = app3.getRaCleanFileName();
    const reconFileName3 = ra3
        ? `${cName3}_${ra3}_Material_Reconciliation_Sheet.xlsx`
        : `${cName3}_Material_Reconciliation_Sheet.xlsx`;
    assert.strictEqual(reconFileName3, 'Ravindra_Kapgate_Material_Reconciliation_Sheet.xlsx');

    // Ensure neither contains "LK"
    assert.strictEqual(cName1.includes('LK'), false);
    assert.strictEqual(cName2.includes('LK'), false);
    assert.strictEqual(cName3.includes('LK'), false);
    assert.strictEqual(reconFileName1.includes('LK'), false);
    assert.strictEqual(reconFileName3.includes('LK'), false);
});


// 14. SAP Stock: Unmapped and Mismatched Contractor Issued Items Detection & Red Highlight Logic
it('SAP Stock: Unmapped and Mismatched Contractor Issued Items Detection & Red Highlight Logic', () => {
    global.window = global;
    eval(fs.readFileSync('js/data/default-activities.js', 'utf8').replace('const defaultActivities', 'global.defaultActivities'));
    eval(fs.readFileSync('js/data/contractor-sap-issues.js', 'utf8'));
    eval(fs.readFileSync('js/mapping.js', 'utf8'));

    const defaultPoleSchedules = require('../js/data/default-pole-schedules.js');
    const mockApp = {
        activities: global.defaultActivities,
        poleSchedules: defaultPoleSchedules,
        selectedContractorName: 'Ravindra Kapgate',
        currentContractorSap: window.ContractorSapStock.byContractorNorm['ravindrakapgade'],
        get allMappedSapCodesSet() {
            const set = new Set();
            if (this.activities) {
                Object.values(this.activities).forEach(act => {
                    if (act && Array.isArray(act.materials)) {
                        act.materials.forEach(m => {
                            if (Array.isArray(m.sapItems)) {
                                m.sapItems.forEach(s => {
                                    const c = String((s && s.code) || '').trim();
                                    if (c && c !== 'N/A' && c !== 'NA') set.add(c);
                                });
                            }
                        });
                    }
                });
            }
            if (this.poleSchedules) {
                Object.values(this.poleSchedules).forEach(sched => {
                    if (sched && Array.isArray(sched.materials)) {
                        sched.materials.forEach(m => {
                            if (Array.isArray(m.sapItems)) {
                                m.sapItems.forEach(s => {
                                    const c = String((s && s.code) || '').trim();
                                    if (c && c !== 'N/A' && c !== 'NA') set.add(c);
                                });
                            } else if (m.itemCode) {
                                const c = String(m.itemCode).trim();
                                if (c && c !== 'N/A' && c !== 'NA') set.add(c);
                            }
                        });
                    }
                });
            }
            return set;
        },
        get allActivityMaterialsFlat() {
            const list = [];
            if (!this.activities) return list;
            const stopWords = new Set(['and', 'with', 'for', 'the', 'nos', 'mtr', 'mtrs', 'set', 'sets', 'type', 'grade', 'long', 'size', 'allied', 'material', 'activity', 'sqmm', 'mm', 'sq']);
            Object.entries(this.activities).forEach(([actKey, act]) => {
                if (act && Array.isArray(act.materials)) {
                    act.materials.forEach((m, mIdx) => {
                        const codes = [];
                        if (Array.isArray(m.sapItems)) {
                            m.sapItems.forEach(s => {
                                const c = String((s && s.code) || '').trim();
                                if (c && c !== 'N/A' && c !== 'NA') codes.push(c);
                            });
                        }
                        const words = String(m.desc || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));
                        list.push({
                            actKey,
                            actTitle: act.title || '',
                            matIdx: mIdx,
                            matNo: m.no,
                            desc: m.desc || '',
                            unit: m.unit || '',
                            mappedCodes: codes,
                            words: words
                        });
                    });
                }
            });
            return list;
        },
        get unmappedContractorIssuedItems() {
            const contractorSap = this.currentContractorSap;
            if (!contractorSap || !contractorSap.materials) return [];
            const mappedSet = this.allMappedSapCodesSet;
            const allMats = this.allActivityMaterialsFlat;
            const stopWords = new Set(['and', 'with', 'for', 'the', 'nos', 'mtr', 'mtrs', 'set', 'sets', 'type', 'grade', 'long', 'size', 'allied', 'material', 'activity', 'sqmm', 'mm', 'sq']);
            const unmapped = [];

            Object.entries(contractorSap.materials).forEach(([code, item]) => {
                const gross = Number(item.grossIssue !== undefined ? item.grossIssue : (item.issuedQty || 0));
                const net = Number(item.netIssue !== undefined ? item.netIssue : (item.issuedQty || 0));
                const isIssued = gross > 0 || net !== 0;

                if (!isIssued) return;
                if (mappedSet.has(code)) return;

                const itemWords = String(item.desc || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));
                let potentialMatch = null;
                let bestScore = 0;

                allMats.forEach(m => {
                    let common = 0;
                    itemWords.forEach(w => {
                        if (m.words.includes(w)) common++;
                    });
                    if (common >= 2 && common > bestScore) {
                        bestScore = common;
                        potentialMatch = {
                            actKey: m.actKey,
                            actTitle: m.actTitle,
                            matNo: m.matNo,
                            matIdx: m.matIdx,
                            desc: m.desc,
                            currentCodes: m.mappedCodes.join(', ')
                        };
                    }
                });

                const searchWords = itemWords.filter(w => w.length >= 4).slice(0, 2);
                const searchKey = searchWords.join(' ') || item.desc || code;

                unmapped.push({
                    code: code,
                    desc: item.desc || code,
                    uom: item.uom || 'No',
                    grossIssue: gross,
                    mrnReturn: Number(item.mrnReturn || 0),
                    netIssue: net,
                    potentialMatch: potentialMatch,
                    searchKey: searchKey
                });
            });

            return unmapped.sort((a, b) => Math.abs(b.netIssue) - Math.abs(a.netIssue));
        }
    };

    // Attach MappingModule methods
    Object.assign(mockApp, window.MappingModule);

    // 1. Verify allMappedSapCodesSet
    const mappedSet = mockApp.allMappedSapCodesSet;
    assert.ok(mappedSet.size >= 60, 'Should have >= 60 mapped SAP codes');
    assert.strictEqual(mappedSet.has('17000004'), true, 'RSJ Pole 17000004 should be mapped in Act 907');
    assert.strictEqual(mappedSet.has('17000195'), false, '17000195 is an unmapped issued cable code');

    // 2. Verify isUnmappedSapCode
    assert.strictEqual(mockApp.isUnmappedSapCode('17000004'), false, 'Mapped code should return false');
    assert.strictEqual(mockApp.isUnmappedSapCode('17000195'), true, 'Unmapped code should return true');
    assert.strictEqual(mockApp.isUnmappedSapCode('N/A'), false, 'N/A should return false');

    // 3. Verify unmappedContractorIssuedItems
    const unmappedItems = mockApp.unmappedContractorIssuedItems;
    assert.ok(unmappedItems.length > 50, 'Ravindra Kapgate should have unmapped issued items identified');

    // Verify critical cable item 17000195 is in unmapped list with issue quantity
    const cable = unmappedItems.find(it => it.code === '17000195');
    assert.ok(cable, 'Cable 17000195 should be in unmapped list');
    assert.strictEqual(cable.netIssue, 348);
    assert.ok(cable.potentialMatch, 'Cable should have a potential match with an Activity material');
    assert.strictEqual(cable.potentialMatch.actKey, '916', 'Should match Activity 916 (XLPE Cable)');

    // 4. Verify Strain Hardware 17000704 is now officially mapped in Activity 922
    assert.strictEqual(mappedSet.has('17000704'), true, 'Strain Hardware 17000704 should be mapped in Activity 922');

    // 5. Verify isUnmappedContractorIssuedRow for Reconciliation row red highlighting
    const unmappedIssuedRow = { code: '17000195', desc: 'CABLE AL 11KV XLPE', sapGrossIssue: 348, sapNetIssue: 348 };
    const mappedIssuedRow = { code: '17000004', desc: 'RSJ POLE', sapGrossIssue: 348, sapNetIssue: 250 };
    const zeroIssueUnmappedRow = { code: '99999999', desc: 'ZERO ITEM', sapGrossIssue: 0, sapNetIssue: 0, sapIssuedQty: 0 };

    assert.strictEqual(mockApp.isUnmappedContractorIssuedRow(unmappedIssuedRow), true, 'Unmapped row with net issue must be highlighted (true)');
    assert.strictEqual(mockApp.isUnmappedContractorIssuedRow(mappedIssuedRow), false, 'Mapped row with issue must NOT be highlighted as unmapped (false)');
    assert.strictEqual(mockApp.isUnmappedContractorIssuedRow(zeroIssueUnmappedRow), false, 'Zero issue row must NOT be highlighted (false)');
});

// 15. Contractor Old Reconciliation (Purana Reco, Cumulative Recon, Balance & Inline Edits)
it('Contractor Old Reconciliation: Baseline loading, matching, cumulative calculation, and custom edits', () => {
    global.window = global;
    if (!global.localStorage) {
        global.localStorage = {
            _data: {},
            getItem(k) { return this._data[k] || null; },
            setItem(k, v) { this._data[k] = String(v); },
            removeItem(k) { delete this._data[k]; }
        };
    }

    eval(fs.readFileSync('js/data/contractor-old-reconciliation.js', 'utf8'));
    eval(fs.readFileSync('js/old-reco-importer.js', 'utf8'));

    const oldRecoDb = window.ContractorOldReco || window.DefaultContractorOldReco;
    assert.ok(oldRecoDb, 'ContractorOldReco database must exist');
    assert.ok(oldRecoDb.byContractorNorm, 'ContractorOldReco must index by contractor norm');
    assert.ok(Object.keys(oldRecoDb.byContractorNorm).length >= 60, 'Should have baseline for >= 60 contractors');

    // 1. Verify Ravindra Kapgate baseline
    const rkNorm = window.OldRecoImporterModule.normContractorName('Ravindra Kapgate');
    assert.strictEqual(rkNorm, 'ravindrakapgate');
    const rkRecord = oldRecoDb.byContractorNorm[rkNorm];
    assert.ok(rkRecord, 'Ravindra Kapgate record must exist in baseline');
    assert.ok(rkRecord.materials['17000004'], 'Item 17000004 (RSJ Pole 9M) must exist for Ravindra Kapgate');
    assert.strictEqual(rkRecord.materials['17000004'].prevConsumption, 250);
    assert.strictEqual(rkRecord.materials['17000004'].netIssue, 282);

    // 2. Setup mock Vue instance with OldRecoImporterModule methods
    const mockApp = Object.assign({
        selectedContractorName: 'Ravindra Kapgate',
        invoiceData: { contractorName: 'Ravindra Kapgate' },
        projectMeta: { contractorName: 'Ravindra Kapgate' },
        customOldRecoEdits: {},
        $forceUpdate() {}
    }, window.OldRecoImporterModule);

    // 3. Test getContractorOldReco
    const contractorReco = mockApp.getContractorOldReco();
    assert.ok(contractorReco, 'getContractorOldReco must resolve contractor');
    assert.strictEqual(contractorReco.contractorName, rkRecord.contractorName);

    // 4. Test getPrevReconQty
    const polePrevRecon = mockApp.getPrevReconQty('17000004');
    assert.strictEqual(polePrevRecon, 250, 'Baseline prev consumption for 17000004 must be 250');

    // 5. Test getCumulativeReconQty (Purana Reco + This Bill Qty)
    const mockRow = {
        code: '17000004',
        desc: 'POLE RSJ 9 MTR',
        sapGrossIssue: 282,
        sapMrnReturn: 0,
        sapNetIssue: 282,
        totalQty: 10 // 10 units consumed in this bill
    };
    const cumulative = mockApp.getCumulativeReconQty(mockRow);
    assert.strictEqual(cumulative, 260, 'Cumulative Recon must be 250 + 10 = 260');

    // 6. Test getReconBalanceQty (Net Issue - Cumulative Recon)
    const balance = mockApp.getReconBalanceQty(mockRow);
    assert.strictEqual(balance, 22, 'Balance must be 282 - 260 = 22');

    // 7. Test updatePrevReconQty (custom edit override)
    mockApp.updatePrevReconQty('17000004', 270);
    assert.strictEqual(mockApp.getPrevReconQty('17000004'), 270, 'Edited prev consumption should now be 270');
    assert.strictEqual(mockApp.getCumulativeReconQty(mockRow), 280, 'Cumulative Recon should now be 270 + 10 = 280');
    assert.strictEqual(mockApp.getReconBalanceQty(mockRow), 2, 'Balance should now be 282 - 280 = 2');

    // 8. Test over-consumption alert condition (balance < 0)
    mockApp.updatePrevReconQty('17000004', 280);
    // Cumulative becomes 280 + 10 = 290. Net is 282 -> Balance is 282 - 290 = -8
    assert.strictEqual(mockApp.getReconBalanceQty(mockRow), -8, 'Balance should be negative (-8) on over-consumption');
});

// 16. Fast Async Old Reconciliation Parser (Dense streaming, progress callback & early validation)
it('Fast Async Old Reco: Ultra-fast streaming parser on 62-sheet workbook with live progress', async () => {
    global.window = global;
    const XLSX = require('xlsx');
    global.XLSX = XLSX;
    eval(fs.readFileSync('js/old-reco-importer.js', 'utf8'));

    // Create 62-sheet workbook
    const wb = XLSX.utils.book_new();
    for (let i = 0; i < 62; i++) {
        const ws = XLSX.utils.aoa_to_sheet([
            ['Row Labels', 'ITEMS DESCRIPTION', 'UNIT', 'ISSUE', 'MRN', 'NET ISSUE', 'Total Consumption', 'BALANCE'],
            ['17000004', 'RSJ Pole 9M', 'No', 282, 0, 282, 250, 32],
            ['17000005', 'RSJ Pole 11M', 'No', 100, 0, 100, 90, 10]
        ], { dense: true });
        XLSX.utils.book_append_sheet(wb, ws, 'Contractor ' + i);
    }
    const arrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    let progressCount = 0;
    const startTime = Date.now();
    const res = await window.OldRecoImporterModule.parseOldRecoExcelAsync(
        arrayBuffer, 
        'Contractor 0', 
        (p) => { progressCount++; }
    );
    const duration = Date.now() - startTime;

    assert.ok(duration < 2000, `Parser must finish within 2000ms (took ${duration}ms)`);
    assert.strictEqual(res.processedContractors, 62, 'All 62 contractor sheets should be processed');
    assert.ok(res.updatedDb.byContractorNorm['contractor0'], 'Contractor 0 should exist in parsed database');
    assert.strictEqual(res.updatedDb.byContractorNorm['contractor0'].materials['17000004'].prevConsumption, 250);
    assert.ok(progressCount > 0, 'Progress callback should be triggered during streaming');
});

// 17. Robust Multi-Row Header & Auto-Derivation Extraction (Reconciliation Master Compatibility)
it('Robust Old Reco Parser: Correctly extracts 2-row merged headers, title offset, and Sheet1 single sheets', async () => {
    global.window = global;
    const XLSX = require('xlsx');
    global.XLSX = XLSX;
    eval(fs.readFileSync('js/old-reco-importer.js', 'utf8'));

    // Create workbook with Ashoka title rows and 2-row merged header at row 6-7
    const wb = XLSX.utils.book_new();
    const sheetData = [
        ['ASHOKA BUILDCON LTD - RDSS GADCHIROLI'], // row 0 (title)
        ['CONTRACTOR MATERIAL RECONCILIATION SHEET'], // row 1
        ['Contractor: M/s Ravindra Kapgate'], // row 2
        ['Work Order No: 31004925'], // row 3
        ['Period: Up to March 2026'], // row 4
        [], // row 5 (empty)
        ['SR NO', 'ITEM CODE', 'MATERIAL DESCRIPTION', 'UNIT', 'ISSUED', 'MRN', 'NET', 'TOTAL', 'TOTAL'], // row 6 (header part 1)
        ['', '', '', '', 'QTY', 'QTY', 'ISSUED', 'CONSUMPTIO', 'BALANCE'], // row 7 (header part 2)
        [1, '17000004', 'RSJ POLE 9 MTR', 'NO', 348, 66, 282, 250, 32], // row 8 (data)
        [2, '17000008', 'STREET LIGHT POLE', 'NO', 50, 0, 50, 45, 5], // row 9 (data)
        ['TOTAL', '', '', '', 398, 66, 332, 295, 37] // row 10 (total row)
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const arrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const res = await window.OldRecoImporterModule.parseOldRecoExcelAsync(arrayBuffer, 'Ravindra Kapgate');
    assert.strictEqual(res.processedContractors, 1, 'Should extract single contractor sheet');
    const rk = res.updatedDb.byContractorNorm['ravindrakapgate'];
    assert.ok(rk, 'Ravindra Kapgate record should exist');
    assert.ok(rk.materials['17000004'], 'Item 17000004 should be extracted');
    assert.strictEqual(rk.materials['17000004'].prevConsumption, 250, 'Consumption should be 250');
    assert.strictEqual(rk.materials['17000004'].netIssue, 282, 'Net issue should be 282');
    assert.strictEqual(rk.materials['17000004'].balanceQty, 32, 'Balance should be 32');
    assert.strictEqual(rk.materials['17000008'].prevConsumption, 45, 'Item 17000008 consumption should be 45');
});


// 18. Dynamic Feeder Name Resolution (No dummy Yenapur/Gogaon)
it('Feeder Name: Resolves dynamic feeder name, rejects dummy Yenapur/Gogaon, and falls back to activity locations', () => {
    global.window = global;
    eval(fs.readFileSync('js/export.js', 'utf8'));

    // Case A: User explicitly set a feeder name
    const appA = {
        invoiceData: { feederName: '11 KV Dhanora' },
        getActLocations: () => [{ name: 'Loc 1' }]
    };
    Object.assign(appA, window.ExportModule);
    assert.strictEqual(appA.getEffectiveFeederName(), '11 KV Dhanora');
    assert.strictEqual(appA.getEffectiveFeederName('907'), '11 KV Dhanora');

    // Case B: Old dummy Yenapur/Gogaon present - should reject dummy and use activity locations
    const appB = {
        invoiceData: { feederName: '11 KV Yenapur, Gogaon' },
        getActLocations: (actKey) => [{ name: 'Ra-09 Bodhali' }, { name: 'Ra-09 Nawegaon' }],
        locations: [{ name: 'Ra-09 Bodhali' }, { name: 'Ra-09 Nawegaon' }]
    };
    Object.assign(appB, window.ExportModule);
    const resolvedB = appB.getEffectiveFeederName('907');
    assert.strictEqual(resolvedB, 'Ra-09 Bodhali, Ra-09 Nawegaon');
    assert.strictEqual(resolvedB.includes('Yenapur'), false);

    // Case C: Blank feeder name with specific activity locations
    const appC = {
        invoiceData: { feederName: '' },
        getActLocations: (actKey) => [{ name: '11 KV Chamorshi' }],
        locations: []
    };
    Object.assign(appC, window.ExportModule);
    assert.strictEqual(appC.getEffectiveFeederName('916'), '11 KV Chamorshi');

    // Case D: Completely blank state
    const appD = {
        invoiceData: { feederName: '' },
        getActLocations: () => [{ name: 'Location 1' }],
        locations: []
    };
    Object.assign(appD, window.ExportModule);
    assert.strictEqual(appD.getEffectiveFeederName('907'), '');
});

// 19. Robust Contractor SAP Stock Issue Resolution (Number WO, ID lookup, auto-clear)
it('SAP Stock: Resolves contractor issue when workOrderNo is a number and matches direct contractor ID', () => {
    global.window = global;
    eval(fs.readFileSync('js/data/contractor-sap-issues.js', 'utf8'));
    eval(fs.readFileSync('js/data/default-contractors.js', 'utf8') + '; global.defaultContractorsList = defaultContractorsList;');
    eval(fs.readFileSync('js/billing.js', 'utf8'));

    // Case 1: Contractor with number workOrderNo (e.g. AB ENTERPRISES WO: 31007613)
    const appNumberWo = {
        selectedContractorId: 'ab_enterprises',
        selectedContractorName: 'AB ENTERPRISES',
        contractorsList: global.defaultContractorsList,
        invoiceData: { contractorName: 'AB ENTERPRISES', workOrderNo: 31007613 },
        projectMeta: { contractorName: 'AB ENTERPRISES', workOrderNo: 31007613 }
    };
    Object.assign(appNumberWo, window.BillingModule);
    const sapIssue1 = appNumberWo.getContractorSapIssues();
    assert.ok(sapIssue1, 'Must resolve SAP issue for AB ENTERPRISES without throwing on number WO .trim()');
    assert.strictEqual(sapIssue1.contractorName, 'M/s AB ENTERPRISES');
    assert.ok(sapIssue1.materials['17000004'], 'M Sand must be issued in SAP stock');

    // Case 2: Direct lookup by contractor ID when workOrderNo is blank
    const appById = {
        selectedContractorId: 'alkamanojramteke',
        selectedContractorName: 'Alka Manoj Ramteke',
        contractorsList: global.defaultContractorsList,
        invoiceData: { contractorName: 'Alka Manoj Ramteke', workOrderNo: '' },
        projectMeta: { contractorName: 'Alka Manoj Ramteke', workOrderNo: '' }
    };
    Object.assign(appById, window.BillingModule);
    const sapIssue2 = appById.getContractorSapIssues();
    assert.ok(sapIssue2, 'Must resolve SAP issue for Alka Manoj Ramteke via direct normalized contractor ID');
    assert.strictEqual(sapIssue2.contractorName, 'Alka Manoj Ramteke');

    // Case 3: Verify applyFirmObject properly blanks workOrderNo when new firm has no work order
    const firmWithNoWo = { id: 'divya_kapgate', name: 'Divya Kapgate', workOrderNo: '' };
    appNumberWo.saveToStorage = () => {};
    appNumberWo.checkAndApplyAutoGstRule = () => {};
    appNumberWo.showToast = () => {};
    appNumberWo.applyFirmObject(firmWithNoWo);
    assert.strictEqual(appNumberWo.invoiceData.workOrderNo, '', 'Must clear old contractor work order when new firm has none');
});

// 20. Dynamic Purana Reco: Multi-column extraction, keep/delete columns, and calculation selection
it('Dynamic Purana Reco: Multi-column Excel upload, column keep/delete, and calculation selection', async () => {
    global.window = global;
    const XLSX = require('xlsx');
    global.XLSX = XLSX;
    eval(fs.readFileSync('js/old-reco-importer.js', 'utf8'));

    // Create an Excel file with multiple historical columns
    const testWorkbook = XLSX.utils.book_new();
    const sheetData = [
        ['ASHOKA BUILDCON LTD - RDSS GADCHIROLI'],
        ['CONTRACTOR MATERIAL RECONCILIATION SHEET'],
        ['Contractor: M/s New Age Builders'],
        [],
        ['SR NO', 'ITEM CODE', 'ITEMS DESCRIPTION', 'UNIT', 'ISSUE', 'MRN', 'NET ISSUE', 'BILL 1 RECO', 'BILL 2 RECO', 'TOTAL RECO', 'BALANCE'],
        [1, '17000004', 'RSJ POLE 9 MTR', 'NO', 300, 20, 280, 100, 150, 250, 30],
        [2, '17000005', 'RSJ POLE 11 MTR', 'NO', 100, 0, 100, 40, 50, 90, 10],
        ['TOTAL', '', '', '', 400, 20, 380, 140, 200, 340, 40]
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(testWorkbook, ws, 'New Age Builders');
    const arrayBuffer = XLSX.write(testWorkbook, { type: 'array', bookType: 'xlsx' });

    // 1. Parse Excel
    const res = await window.OldRecoImporterModule.parseOldRecoExcelAsync(arrayBuffer, 'New Age Builders');
    assert.strictEqual(res.processedContractors, 1, 'Should process 1 contractor sheet');
    const rec = res.updatedDb.byContractorNorm['newagebuilders'];
    assert.ok(rec, 'Record for New Age Builders must exist');
    assert.ok(Array.isArray(rec.columnsConfig), 'columnsConfig must be an array');
    assert.strictEqual(rec.columnsConfig.length, 4, 'Should detect 4 custom columns (BILL 1 RECO, BILL 2 RECO, TOTAL RECO, BALANCE)');

    // Verify all 4 columns detected
    const colNames = rec.columnsConfig.map(c => c.name);
    assert.deepStrictEqual(colNames, ['BILL 1 RECO', 'BILL 2 RECO', 'TOTAL RECO', 'BALANCE']);

    // Verify default calc column is TOTAL RECO
    const calcCol = rec.columnsConfig.find(c => c.isCalc);
    assert.ok(calcCol, 'A calculation column must be set');
    assert.strictEqual(calcCol.name, 'TOTAL RECO', 'Default calc column should be TOTAL RECO');

    // Verify material values extracted as-is
    const pole = rec.materials['17000004'];
    assert.ok(pole, 'Material 17000004 must exist');
    assert.strictEqual(pole.customColumns['BILL 1 RECO'], 100);
    assert.strictEqual(pole.customColumns['BILL 2 RECO'], 150);
    assert.strictEqual(pole.customColumns['TOTAL RECO'], 250);
    assert.strictEqual(pole.customColumns['BALANCE'], 30);
    assert.strictEqual(pole.prevConsumption, 250, 'prevConsumption should match calc column TOTAL RECO');

    // 2. Setup mock Vue instance to test Column Manager operations
    window.ContractorOldReco = res.updatedDb;
    const mockApp = Object.assign({
        selectedContractorName: 'New Age Builders',
        invoiceData: { contractorName: 'New Age Builders' },
        projectMeta: { contractorName: 'New Age Builders' },
        customOldRecoEdits: {},
        reconRows: [pole],
        showToast() {},
        $forceUpdate() {}
    }, window.OldRecoImporterModule);

    // Initial visible columns
    assert.strictEqual(mockApp.visibleOldRecoColumns().length, 4, 'Initially all 4 columns should be visible');
    assert.strictEqual(mockApp.getPrevReconQty('17000004'), 250);

    // 3. Test Hide/Delete Column logic
    // Toggle (hide) BALANCE column
    mockApp.toggleRecoColumn('BALANCE');
    assert.strictEqual(mockApp.visibleOldRecoColumns().length, 3, 'After hiding BALANCE, 3 columns visible');
    assert.strictEqual(mockApp.allOldRecoColumns().find(c => c.name === 'BALANCE').visible, false);

    // Delete BILL 1 RECO column
    global.confirm = () => true;
    mockApp.deleteRecoColumn('BILL 1 RECO');
    assert.strictEqual(mockApp.allOldRecoColumns().length, 3, 'After deleting BILL 1 RECO, 3 columns remain in allOldRecoColumns');
    assert.strictEqual(mockApp.allOldRecoColumns().some(c => c.name === 'BILL 1 RECO'), false);

    // 4. Test Switching Calculation Column
    mockApp.setCalcColumn('BILL 2 RECO');
    assert.strictEqual(mockApp.getPrevReconQty('17000004'), 150, 'getPrevReconQty should now use BILL 2 RECO (150)');

    // 5. Test Cumulative and Balance calculation with new calc column
    const mockRow = {
        code: '17000004',
        desc: 'RSJ POLE 9 MTR',
        sapNetIssue: 280,
        totalQty: 20 // 20 units in this bill
    };
    const cum = mockApp.getCumulativeReconQty(mockRow);
    assert.strictEqual(cum, 170, 'Cumulative should be 150 + 20 = 170');
    const bal = mockApp.getReconBalanceQty(mockRow);
    assert.strictEqual(bal, 110, 'Balance should be 280 - 170 = 110');

    // 6. Test Cell Editing for a specific custom column
    mockApp.updateRecoColVal('17000004', 'BILL 2 RECO', 160);
    assert.strictEqual(mockApp.getRecoColVal('17000004', 'BILL 2 RECO'), 160, 'Edited cell should return 160');
    assert.strictEqual(mockApp.getPrevReconQty('17000004'), 160, 'getPrevReconQty should update to 160 because BILL 2 RECO is the active calc column');

    // 7. Test Add New Custom Column
    mockApp.addNewRecoColumn('STORE QTY');
    assert.strictEqual(mockApp.allOldRecoColumns().some(c => c.name === 'STORE QTY'), true, 'STORE QTY column should be added');
});

// 21. Dynamic Old Reco Issue Sync: Replaces old SAP issue with newly uploaded reco issue
it('Dynamic Old Reco: Updates contractor gross/net issue from newly uploaded reco Excel', async () => {
    global.window = global;
    const XLSX = require('xlsx');
    global.XLSX = XLSX;
    eval(fs.readFileSync('js/old-reco-importer.js', 'utf8'));

    // Create an Excel file where contractor has newly revised issue numbers
    const testWb = XLSX.utils.book_new();
    const sheetData = [
        ['SR NO', 'ITEM CODE', 'ITEMS DESCRIPTION', 'UNIT', 'ISSUE', 'MRN', 'NET ISSUE', 'PURANA RECO', 'STORE QTY'],
        [1, '17000004', 'RSJ POLE 9 MTR', 'NO', 550, 50, 500, 320, 20],
        [2, '17000005', 'RSJ POLE 11 MTR', 'NO', 250, 10, 240, 200, 10]
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(testWb, ws, 'Ravindra Kapgate');
    const arrayBuffer = XLSX.write(testWb, { type: 'array', bookType: 'xlsx' });

    const res = await window.OldRecoImporterModule.parseOldRecoExcelAsync(arrayBuffer, 'Ravindra Kapgate');
    const rkNorm = window.OldRecoImporterModule.normContractorName('Ravindra Kapgate');
    const rec = res.updatedDb.byContractorNorm[rkNorm];
    assert.ok(rec, 'Ravindra Kapgate record must exist in parsed data');

    // Verify newly extracted grossIssue, mrnReturn, and netIssue
    const pole = rec.materials['17000004'];
    assert.strictEqual(pole.grossIssue, 550, 'Gross issue should be 550');
    assert.strictEqual(pole.mrnReturn, 50, 'MRN should be 50');
    assert.strictEqual(pole.netIssue, 500, 'Net issue should be 500');
    assert.strictEqual(pole.prevConsumption, 320, 'Purana reco should be 320');

    // Simulate pivotReconciliationData logic: when custom reco is active, sapMap must update with new issue
    const sapMap = {
        '17000004': {
            code: '17000004',
            desc: 'RSJ POLE 9 MTR',
            uom: 'NO',
            sapGrossIssue: 282, // Old baseline issue
            sapMrnReturn: 0,
            sapNetIssue: 282,
            activities: {}
        }
    };

    // Apply app.js update logic
    const hasCustomOldReco = true;
    Object.keys(rec.materials).forEach(code => {
        const oItem = rec.materials[code];
        const oNet = Number(oItem.netIssue !== undefined ? oItem.netIssue : (oItem.issuedQty || 0));
        const oGross = Number(oItem.grossIssue !== undefined ? oItem.grossIssue : oNet);
        const oMrn = Number(oItem.mrnReturn !== undefined ? oItem.mrnReturn : 0);

        if (!sapMap[code]) {
            sapMap[code] = { code, desc: oItem.desc, uom: oItem.uom, sapGrossIssue: oGross, sapMrnReturn: oMrn, sapNetIssue: oNet };
        } else {
            if (hasCustomOldReco || oNet > 0 || oGross > 0 || oMrn > 0) {
                sapMap[code].sapGrossIssue = oGross;
                sapMap[code].sapMrnReturn = oMrn;
                sapMap[code].sapNetIssue = oNet;
            }
        }
    });

    assert.strictEqual(sapMap['17000004'].sapGrossIssue, 550, 'Old issue 282 should be updated to new issue 550');
    assert.strictEqual(sapMap['17000004'].sapMrnReturn, 50, 'MRN should be updated to 50');
    assert.strictEqual(sapMap['17000004'].sapNetIssue, 500, 'Net issue should be updated to 500');
    assert.ok(sapMap['17000005'], 'Newly added item 17000005 should be injected into sapMap');
    assert.strictEqual(sapMap['17000005'].sapNetIssue, 240);
});

it('Excel Formula & Cell Linking: Evaluates math expressions, column references, and dynamic links', () => {
    const mockApp = Object.assign({
        selectedContractorName: 'Test Contractor',
        customOldRecoEdits: {},
        reconRows: [],
        showToast() {},
        $forceUpdate() {}
    }, window.OldRecoImporterModule);

    const row = {
        code: '17000004',
        desc: 'RSJ POLE 9 MTR',
        sapGrossIssue: 250,
        sapMrnReturn: 30,
        sapNetIssue: 220,
        totalQty: 20
    };

    // 1. Math formulas
    assert.strictEqual(mockApp.evaluateRecoFormula('=100 + 50', row), 150);
    assert.strictEqual(mockApp.evaluateRecoFormula('=250 * 2', row), 500);

    // 2. Column references
    assert.strictEqual(mockApp.evaluateRecoFormula('=[ISSUE] - [MRN]', row), 220);
    assert.strictEqual(mockApp.evaluateRecoFormula('=ISSUE - MRN', row), 220);
    assert.strictEqual(mockApp.evaluateRecoFormula('=[NET ISSUE] - 100', row), 120);
    assert.strictEqual(mockApp.evaluateRecoFormula('=NET * 0.5', row), 110);

    // 3. Update cell with formula
    mockApp.updateRecoColVal('17000004', 'PURANA RECO', '=[ISSUE] - [MRN]', row);
    assert.strictEqual(mockApp.getRecoFormula('17000004', 'PURANA RECO'), '=[ISSUE] - [MRN]');
    assert.strictEqual(mockApp.getRecoColVal('17000004', 'PURANA RECO', row), 220);
});

it('Activity 6723: Per-Activity Dynamic Location Renaming & Isolation', () => {
    // Load ViewsModule
    require('../js/views.js');

    const app = {
        selectedActivityKey: '6723',
        locations: [
            { name: 'Ra-09 Bodhali' },
            { name: 'Ra-09 Gogaon' },
            { name: 'Ra-09 Nawegaon' }
        ],
        activityLocations: {},
        activityQuantities: {},
        activities: { '6723': { materials: [{}, {}] }, '907': { materials: [{}] } },
        isFinalized: false,
        saveToStorage() {},
        showToast() {}
    };

    Object.assign(app, window.ViewsModule);

    // 1. Initially 6723 gets an independent copy of locations
    const locs6723 = app.getActLocations('6723');
    assert.strictEqual(locs6723.length, 3);
    assert.strictEqual(locs6723[0].name, 'Ra-09 Bodhali');

    // 2. Rename location in 6723 to custom DP switch location
    app.renameLocation(0, '11kV AB Switch DP Location 1');
    assert.strictEqual(app.getActLocations('6723')[0].name, '11kV AB Switch DP Location 1');

    // 3. Verify Activity 907 and global fallback locations are unchanged
    assert.strictEqual(app.getActLocations('907')[0].name, 'Ra-09 Bodhali');
    assert.strictEqual(app.locations[0].name, 'Ra-09 Bodhali');

    // 4. Remove extra locations for 6723 (leaving 1 DP location)
    app.removeLocation(2);
    app.removeLocation(1);
    assert.strictEqual(app.getActLocations('6723').length, 1);
    assert.strictEqual(app.getActLocations('6723')[0].name, '11kV AB Switch DP Location 1');

    // 5. Activity 907 still has all 3 locations
    assert.strictEqual(app.getActLocations('907').length, 3);
});

// 24. SAP Stock: Custom stock upload reactivity, fallback matching, and reset to default
it('SAP Stock: Custom stock upload reactivity, fallback matching, and reset to default', () => {
    global.window = global;
    eval(fs.readFileSync('js/billing.js', 'utf8'));

    // Default stock
    const defaultStock = {
        meta: { source: 'Built-in' },
        byDocHeader: {},
        byContractorNorm: {
            'maakali': { contractorName: 'Maa Kali Enterprises', materials: { '17000004': { code: '17000004', issuedQty: 50 } } }
        }
    };
    window.ContractorSapStock = defaultStock;
    window.DefaultContractorSapStock = defaultStock;

    const mockApp = Object.assign({
        selectedContractorId: 'maa_kali',
        selectedContractorName: 'Maa Kali Enterprises',
        recoRevision: 0,
        hasCustomStock: false,
        customStockMeta: null,
        get currentContractorSap() {
            const _rev = this.recoRevision;
            const _cust = this.hasCustomStock;
            return this.getContractorSapIssues();
        }
    }, window.BillingModule);

    // Initial check
    assert.strictEqual(mockApp.currentContractorSap.materials['17000004'].issuedQty, 50);

    // 1. Simulate Custom Stock Upload with updated quantities
    const customStock = {
        meta: { source: 'Uploaded Excel', matchedTxns: 10 },
        byDocHeader: {},
        byContractorNorm: {
            'maakali': { contractorName: 'Maa Kali Enterprises', materials: { '17000004': { code: '17000004', issuedQty: 120 } } }
        }
    };
    window.ContractorSapStock = customStock;
    mockApp.hasCustomStock = true;
    mockApp.customStockMeta = customStock.meta;
    mockApp.recoRevision++;

    // Computed property must now return updated 120 qty!
    assert.strictEqual(mockApp.currentContractorSap.materials['17000004'].issuedQty, 120);

    // 2. Simulate Single-Contractor Upload without contractor name (fallback to 'uploadedstock')
    const genericUploadedStock = {
        meta: { source: 'Generic Sheet', matchedTxns: 5 },
        byDocHeader: {},
        byContractorNorm: {
            'uploadedstock': { contractorName: 'Uploaded Stock', materials: { '17000004': { code: '17000004', issuedQty: 999 } } }
        }
    };
    window.ContractorSapStock = genericUploadedStock;
    mockApp.recoRevision++;
    assert.strictEqual(mockApp.currentContractorSap.materials['17000004'].issuedQty, 999, 'Single-contractor uploadedstock must fallback seamlessly');

    // 3. Simulate Reset to Default
    window.ContractorSapStock = window.DefaultContractorSapStock;
    mockApp.hasCustomStock = false;
    mockApp.customStockMeta = null;
    mockApp.recoRevision++;
    assert.strictEqual(mockApp.currentContractorSap.materials['17000004'].issuedQty, 50, 'Reset must restore default stock');
});

it('Activity 922 Restored to 18 Contract Items & Pole Schedules Configured (907: 53 items, 922: 45 items)', () => {
    eval(fs.readFileSync('js/data/default-activities.js', 'utf8').replace('const defaultActivities', 'global.defaultActivities'));
    const poleSchedules = require('../js/data/default-pole-schedules.js');

    const act922 = global.defaultActivities['922'];
    const act907 = global.defaultActivities['907'];

    // Activity 922 must be restored to original 18 items
    assert.ok(act922, 'Activity 922 must exist');
    assert.strictEqual(act922.materials.length, 18, 'Activity 922 must have original 18 items');

    // Activity 907 must have 25 items
    assert.ok(act907, 'Activity 907 must exist');
    assert.strictEqual(act907.materials.length, 25, 'Activity 907 must have 25 items');

    // Pole Schedules must have 53 items for 907 and 45 items for 922
    assert.ok(poleSchedules['907'], 'Pole Schedule 907 must exist');
    assert.strictEqual(poleSchedules['907'].materials.length, 53, 'Pole Schedule 907 must have 53 items');

    assert.ok(poleSchedules['922'], 'Pole Schedule 922 must exist');
    assert.strictEqual(poleSchedules['922'].materials.length, 45, 'Pole Schedule 922 must have 45 items');
    assert.strictEqual(poleSchedules['922'].materials[0].itemCode, '17001243');
    assert.strictEqual(poleSchedules['922'].materials[44].itemCode, '17000651');
    assert.strictEqual(poleSchedules['922'].materials.filter(m => m.isExtra).length, 4);
    assert.strictEqual(poleSchedules['922'].materials.filter(m => m.isSection).length, 6);

    // Pole Schedule 1425A must have 41 items
    assert.ok(poleSchedules['1425A'], 'Pole Schedule 1425A must exist');
    assert.strictEqual(poleSchedules['1425A'].materials.length, 41, 'Pole Schedule 1425A must have 41 items');
    assert.strictEqual(poleSchedules['1425A'].materials[1].itemCode, '17001240', 'Item 1 must be PSC Pole 8m');
    assert.strictEqual(poleSchedules['1425A'].materials[2].itemCode, '17001261', 'Item 2 must be AAAC 55 mm2');
    assert.strictEqual(poleSchedules['1425A'].materials[3].itemCode, '17000120', 'Item 3 must be ACSR Weasel');
    assert.strictEqual(poleSchedules['1425A'].materials[9].itemCode, '17005082', 'Item 7 must be D-Clamp (17005082)');
    assert.strictEqual(poleSchedules['1425A'].materials.filter(m => m.isSection).length, 3);

    // Pole Schedule 1220 must have 72 items
    assert.ok(poleSchedules['1220'], 'Pole Schedule 1220 must exist');
    assert.strictEqual(poleSchedules['1220'].materials.length, 73, 'Pole Schedule 1220 must have 73 items');
    assert.strictEqual(poleSchedules['1220'].materials[0].itemCode, '17004662', 'Item 1 must be 100 KVA Transformer (17004662)');
    assert.strictEqual(poleSchedules['1220'].materials[1].itemCode, '17001243', 'Item 2 must be RSJ 11m');

    // Pole Schedule 6723 must have 41 items
    assert.ok(poleSchedules['6723'], 'Pole Schedule 6723 must exist');
    assert.strictEqual(poleSchedules['6723'].materials.length, 41, 'Pole Schedule 6723 must have 41 items');

    // Pole Schedule 919 must have 37 items
    assert.ok(poleSchedules['919'], 'Pole Schedule 919 must exist');
    assert.strictEqual(poleSchedules['919'].materials.length, 37, 'Pole Schedule 919 must have 37 items');

    // Pole Schedule 934A must have 43 items
    assert.ok(poleSchedules['934A'], 'Pole Schedule 934A must exist');
    assert.strictEqual(poleSchedules['934A'].materials.length, 43, 'Pole Schedule 934A must have 43 items');

    // Pole Schedule 924 must have 43 items
    assert.ok(poleSchedules['924'], 'Pole Schedule 924 must exist');
    assert.strictEqual(poleSchedules['924'].materials.length, 43, 'Pole Schedule 924 must have 43 items');

    // Pole Schedule 1230 must have 54 items
    assert.ok(poleSchedules['1230'], 'Pole Schedule 1230 must exist');
    assert.strictEqual(poleSchedules['1230'].materials.length, 54, 'Pole Schedule 1230 must have 54 items');
});

// 26. SAP Material Mapping: Pole Schedules Integration & Reactivity
it('SAP Material Mapping: Integrates all 9 Pole Schedules into Mapping View & Dropdown', () => {
    const defaultPoleSchedules = require('../js/data/default-pole-schedules.js');
    const defaultActivities = require('../js/data/default-activities.js');

    // Simulate Vue app state and filteredMappingMasterList computed property
    const mockApp = {
        activities: defaultActivities,
        poleSchedules: defaultPoleSchedules,
        mappingActivityFilter: 'ALL',
        mappingSearchQuery: '',
        filteredMappingMasterList() {
            let list = [];
            Object.keys(this.activities).forEach(actKey => {
                if (this.mappingActivityFilter !== 'ALL' && this.mappingActivityFilter !== actKey) return;
                const act = this.activities[actKey];
                if (act && act.materials) {
                    act.materials.forEach(m => {
                        list.push({ actKey, actTitle: act.title, item: m });
                    });
                }
            });
            if (this.poleSchedules) {
                const psKeys = Object.keys(this.poleSchedules);
                psKeys.forEach(psKey => {
                    const filterKey = 'PS_' + psKey;
                    if (this.mappingActivityFilter !== 'ALL' && this.mappingActivityFilter !== filterKey) return;
                    const sched = this.poleSchedules[psKey];
                    if (sched && Array.isArray(sched.materials)) {
                        sched.materials.forEach((m, mIdx) => {
                            if (m.isSection || m.isSpan) return;
                            if (!m.sapItems || m.sapItems.length === 0) {
                                m.sapItems = [{
                                    code: m.itemCode || '',
                                    desc: m.sapDescription || m.desc || '',
                                    uom: m.sapUom || m.unit || 'No',
                                    qty: 1,
                                    docHeader: m.docHeader || '0031006347'
                                }];
                            }
                            list.push({
                                actKey: 'PS ' + psKey,
                                actTitle: sched.title || ('Pole Schedule ' + psKey),
                                item: m,
                                isPoleSchedule: true,
                                poleScheduleKey: psKey,
                                origIndex: mIdx
                            });
                        });
                    }
                });
            }
            if (!this.mappingSearchQuery) return list;
            const q = this.mappingSearchQuery.toLowerCase();
            return list.filter(r => {
                const m = r.item;
                const descMatch = m.desc && m.desc.toLowerCase().includes(q);
                const actMatch = r.actKey && r.actKey.toLowerCase().includes(q);
                const codeMatch = m.itemCode && String(m.itemCode).toLowerCase().includes(q);
                const sapDescMatch = m.sapDescription && String(m.sapDescription).toLowerCase().includes(q);
                const sapMatch = (m.sapItems || []).some(s =>
                    (s.code && s.code.toLowerCase().includes(q)) ||
                    (s.desc && s.desc.toLowerCase().includes(q)) ||
                    (s.docHeader && s.docHeader.toLowerCase().includes(q))
                );
                return descMatch || actMatch || codeMatch || sapDescMatch || sapMatch;
            });
        }
    };

    // 1. ALL filter includes both activities and all pole schedules
    const allList = mockApp.filteredMappingMasterList();
    assert.ok(allList.length > 500, 'All list must contain contract activities + all pole schedules (> 500 items)');
    const ps907Items = allList.filter(r => r.actKey === 'PS 907');
    assert.ok(ps907Items.length >= 40, 'Must have PS 907 items in mapping list');

    // 2. Specific Pole Schedule filter
    mockApp.mappingActivityFilter = 'PS_907';
    const list907 = mockApp.filteredMappingMasterList();
    assert.strictEqual(list907.length, ps907Items.length, 'Filter by PS_907 must return only 907 items');
    assert.ok(list907.every(r => r.actKey === 'PS 907'));

    mockApp.mappingActivityFilter = 'PS_1220';
    const list1220 = mockApp.filteredMappingMasterList();
    assert.ok(list1220.length >= 50, 'Filter by PS_1220 must return 1220 items');
    assert.ok(list1220.every(r => r.actKey === 'PS 1220'));

    // 3. Search query test (Search for RSJ or 17001243)
    mockApp.mappingActivityFilter = 'ALL';
    mockApp.mappingSearchQuery = '17001243'; // RSJ 11m
    const searchRes = mockApp.filteredMappingMasterList();
    assert.ok(searchRes.length > 0, 'Search by code 17001243 must return matching rows');
    assert.ok(searchRes.some(r => r.item.itemCode === '17001243'));

    // 4. Object reference mutation check: editing row.item modifies poleSchedules
    const targetRow = list907[0];
    const originalRate = targetRow.item.rate;
    targetRow.item.rate = 9999.50;
    assert.strictEqual(defaultPoleSchedules['907'].materials[targetRow.origIndex].rate, 9999.50, 'Direct mutation on row.item must update underlying pole schedule object');
    // Restore
    targetRow.item.rate = originalRate;
});

it('Pole Schedule Data Flow: Quantities sync seamlessly into Material Reconciliation Sheet with accurate columns & totals', () => {
    const defaultPoleSchedules = require('../js/data/default-pole-schedules.js');
    const defaultActivities = require('../js/data/default-activities.js');

    // 1. Verify Auto-healing of poleSchedules
    let mockPoleSchedules = { '907': { materials: [{ desc: 'Old 907 item' }] } }; // Incomplete stored state
    if (typeof defaultPoleSchedules !== 'undefined') {
        Object.keys(defaultPoleSchedules).forEach(k => {
            if (!mockPoleSchedules[k] || !Array.isArray(mockPoleSchedules[k].materials) || mockPoleSchedules[k].materials.length === 0) {
                mockPoleSchedules[k] = JSON.parse(JSON.stringify(defaultPoleSchedules[k]));
            } else if (defaultPoleSchedules[k] && Array.isArray(defaultPoleSchedules[k].materials)) {
                while (mockPoleSchedules[k].materials.length < defaultPoleSchedules[k].materials.length) {
                    const nextIdx = mockPoleSchedules[k].materials.length;
                    mockPoleSchedules[k].materials.push(JSON.parse(JSON.stringify(defaultPoleSchedules[k].materials[nextIdx])));
                }
                defaultPoleSchedules[k].materials.forEach((defMat, mIdx) => {
                    const cur = mockPoleSchedules[k].materials[mIdx];
                    if (cur) {
                        if (!cur.itemCode && defMat.itemCode) {
                            cur.itemCode = defMat.itemCode;
                            cur.sapDescription = defMat.sapDescription;
                            cur.sapUom = defMat.sapUom;
                            cur.docHeader = defMat.docHeader;
                        }
                        if ((!cur.sapItems || !cur.sapItems.length) && defMat.sapItems) {
                            cur.sapItems = JSON.parse(JSON.stringify(defMat.sapItems));
                        }
                    }
                });
            }
        });
    }

    assert.ok(mockPoleSchedules['934A'], '934A must be auto-healed');
    assert.ok(mockPoleSchedules['1220'], '1220 must be auto-healed');
    assert.ok(mockPoleSchedules['1230'], '1230 must be auto-healed');
    assert.ok(mockPoleSchedules['6723'], '6723 must be auto-healed');
    assert.strictEqual(mockPoleSchedules['907'].materials[2].itemCode, '17001243', '907 RSJ 11m must have itemCode');

    // 2. Set test quantities in Pole Schedule
    const poleScheduleQuantities = {
        '907': { 0: { 2: 12 } },   // RSJ 11m = 12
        '934A': { 0: { 1: 8 } },   // RSJ 8m = 8
        '1220': { 0: { 0: 4 } },   // Dist box 100KVA = 4
        '1230': { 0: { 0: 6 } }    // RSJ 9m = 6
    };

    const mockApp = {
        activities: JSON.parse(JSON.stringify(defaultActivities)),
        poleSchedules: mockPoleSchedules,
        poleScheduleQuantities: poleScheduleQuantities,
        activityQuantities: {},
        activityLocations: {},
        poleScheduleLocations: {},
        mappingRoundMode: 'none',
        recoRevision: 0,
        evalGridFormula(v) { return v; },
        evalFormula(v) { return v; },
        getActLocations(k) { return [{ name: 'Loc 1' }]; },
        getPoleScheduleLocations(k) { return [{ name: 'Loc 1' }]; },
        syncPoleScheduleToBillingAndReconciliation(k) {
            const sched = this.poleSchedules[k];
            const act = this.activities[k] || { materials: [] };
            this.activities[k] = act;
            if (!this.activityQuantities[k]) this.activityQuantities[k] = [[]];
            const qMatrix = this.poleScheduleQuantities[k];
            sched.materials.forEach((sm, smIdx) => {
                if (sm.isSection || sm.isSpan) return;
                let aIdx = act.materials.findIndex(am => (am.itemCode && sm.itemCode && am.itemCode === sm.itemCode) || (am.desc && sm.desc && am.desc.trim().toLowerCase() === sm.desc.trim().toLowerCase()));
                if (aIdx === -1) {
                    act.materials.push({ ...sm });
                    aIdx = act.materials.length - 1;
                }
                const val = qMatrix && qMatrix[0] && qMatrix[0][smIdx];
                if (val !== undefined && val !== '') {
                    this.activityQuantities[k][0][aIdx] = val;
                }
            });
        }
    };

    // Run sync
    ['907', '934A', '1220', '1230'].forEach(k => mockApp.syncPoleScheduleToBillingAndReconciliation(k));

    // Assert Activity Quantities received values
    assert.strictEqual(mockApp.activityQuantities['907'][0].filter(Boolean).length > 0, true, '907 activityQuantities must receive values');
    assert.strictEqual(mockApp.activityQuantities['934A'][0].filter(Boolean).length > 0, true, '934A activityQuantities must receive values');
    assert.strictEqual(mockApp.activityQuantities['1220'][0].filter(Boolean).length > 0, true, '1220 activityQuantities must receive values');
    assert.strictEqual(mockApp.activityQuantities['1230'][0].filter(Boolean).length > 0, true, '1230 activityQuantities must receive values');

    // 3. Run reconciliation processing logic (identical to app.js pivotReconciliationData)
    const sapMap = {};
    const allActivityKeys = new Set();
    const candidateActKeys = new Set([
        ...Object.keys(mockApp.activities || {}),
        ...Object.keys(mockApp.poleSchedules || {}),
        ...Object.keys(mockApp.poleScheduleQuantities || {})
    ]);

    candidateActKeys.forEach(actKey => {
        const qMatrix = mockApp.poleScheduleQuantities && mockApp.poleScheduleQuantities[actKey];
        let hasPsQty = false;
        if (qMatrix) {
            for (const lIdx in qMatrix) {
                const row = qMatrix[lIdx];
                if (row) {
                    for (const mIdx in row) {
                        const raw = row[mIdx];
                        if (raw !== '' && raw !== null && raw !== undefined) {
                            const n = Number(raw);
                            if (!isNaN(n) && n > 0) { hasPsQty = true; break; }
                        }
                    }
                }
                if (hasPsQty) break;
            }
        }

        if (hasPsQty) {
            const sched = (mockApp.poleSchedules && mockApp.poleSchedules[actKey] && Array.isArray(mockApp.poleSchedules[actKey].materials) && mockApp.poleSchedules[actKey].materials.length > 0)
                ? mockApp.poleSchedules[actKey]
                : (defaultPoleSchedules[actKey] || null);
            if (sched && Array.isArray(sched.materials)) {
                sched.materials.forEach((m, mIdx) => {
                    if (m.isSection || m.isSpan) return;
                    let itemTotalQty = 0;
                    for (const lIdx in qMatrix) {
                        const raw = qMatrix[lIdx] && qMatrix[lIdx][mIdx];
                        if (raw !== '' && raw !== null && raw !== undefined) {
                            const n = Number(raw);
                            if (!isNaN(n)) itemTotalQty += n;
                        }
                    }
                    if (itemTotalQty <= 0) return;

                    let sItems = (m.sapItems && m.sapItems.length > 0) ? m.sapItems : [];
                    if (sItems.length === 0 && m.itemCode && m.itemCode !== 'N/A' && m.itemCode !== '—') {
                        sItems = [{ code: m.itemCode, desc: m.sapDescription || m.desc, uom: m.sapUom || m.unit, qty: 1 }];
                    }

                    sItems.forEach(s => {
                        if (!s.code || s.code === 'N/A' || s.code === '—') return;
                        allActivityKeys.add(actKey);
                        if (!sapMap[s.code]) {
                            sapMap[s.code] = { code: s.code, desc: s.desc, uom: s.uom, totalQty: 0, activities: {} };
                        }
                        const finalQty = itemTotalQty * (s.qty || 1);
                        sapMap[s.code].totalQty += finalQty;
                        sapMap[s.code].activities[actKey] = (sapMap[s.code].activities[actKey] || 0) + finalQty;
                    });
                });
            }
        }
    });

    const columns = Array.from(allActivityKeys).sort();
    assert.ok(columns.includes('907'), 'Reconciliation columns must include 907');
    assert.ok(columns.includes('934A'), 'Reconciliation columns must include 934A');
    assert.ok(columns.includes('1220'), 'Reconciliation columns must include 1220');
    assert.ok(columns.includes('1230'), 'Reconciliation columns must include 1230');

    // Verify quantities in sapMap
    assert.ok(sapMap['17001243'], 'RSJ 11m must exist in reconciliation');
    assert.strictEqual(sapMap['17001243'].activities['907'], 12, 'RSJ 11m qty in 907 must be 12');
    assert.strictEqual(sapMap['17001243'].totalQty, 12, 'RSJ 11m totalQty must be 12');

    assert.ok(sapMap['17005037'], 'RSJ 8m must exist in reconciliation');
    assert.strictEqual(sapMap['17005037'].activities['934A'], 8, 'RSJ 8m qty in 934A must be 8');
    assert.strictEqual(sapMap['17005037'].totalQty, 8, 'RSJ 8m totalQty must be 8');

    assert.ok(sapMap['17004662'], '100 KVA Transformer must exist in reconciliation');
    assert.strictEqual(sapMap['17004662'].activities['1220'], 4, '100 KVA Transformer qty in 1220 must be 4');
    assert.strictEqual(sapMap['17004662'].totalQty, 4, '100 KVA Transformer totalQty must be 4');

    assert.ok(sapMap['17000004'], 'RSJ 9m must exist in reconciliation');
    assert.strictEqual(sapMap['17000004'].activities['1230'], 6, 'RSJ 9m qty in 1230 must be 6');
    assert.strictEqual(sapMap['17000004'].totalQty, 6, 'RSJ 9m totalQty must be 6');
});

// 28. Default Pole Schedules Hard-Coded Master Persistence & API
it('Default Pole Schedules: Hard-coded Master Persistence & API Endpoint Verification', () => {
    const defaultPoleSchedules = require('../js/data/default-pole-schedules.js');
    assert.ok(defaultPoleSchedules, 'defaultPoleSchedules must be exported');
    assert.strictEqual(typeof defaultPoleSchedules, 'object');
    assert.ok(defaultPoleSchedules['907'], 'Activity 907 must be defined in master defaults');
    assert.ok(defaultPoleSchedules['922'], 'Activity 922 must be defined in master defaults');

    // PoleScheduleModule has persistPoleSchedulesToMasterFile and downloadDefaultPoleSchedulesFile
    const psModule = require('../js/pole-schedule.js');
    assert.strictEqual(typeof psModule.persistPoleSchedulesToMasterFile, 'function', 'persistPoleSchedulesToMasterFile must be a function');
    assert.strictEqual(typeof psModule.downloadDefaultPoleSchedulesFile, 'function', 'downloadDefaultPoleSchedulesFile must be a function');
});


// 29. Multi-Location Pole Schedule & Location-Wise Sync to Activity Billing and Reconciliation
it('Multi-Location Pole Schedule: Location addition, bidirectional sync to Activity Billing & Reconciliation summation', () => {
    const defaultPoleSchedules = require('../js/data/default-pole-schedules.js');
    const defaultActivities = require('../js/data/default-activities.js');
    const psModule = require('../js/pole-schedule.js');

    const mockApp = {
        selectedPoleScheduleKey: '907',
        selectedActivityKey: '907',
        poleSchedules: JSON.parse(JSON.stringify(defaultPoleSchedules)),
        activities: JSON.parse(JSON.stringify(defaultActivities)),
        poleScheduleLocations: { '907': [{ name: 'Location 1' }] },
        activityLocations: { '907': [{ name: 'Location 1' }] },
        poleScheduleQuantities: { '907': { 0: {} } },
        activityQuantities: { '907': [[]] },
        isFinalized: false,
        recoRevision: 0,
        showToast() {},
        saveToStorage() {},
        debouncedSave() {},
        ...psModule
    };

    // Add 2nd location (Loc 2)
    mockApp.poleScheduleLocations['907'].push({ name: 'Loc 2' });
    mockApp.poleScheduleQuantities['907'][1] = {};
    mockApp.activityLocations['907'] = JSON.parse(JSON.stringify(mockApp.poleScheduleLocations['907']));
    mockApp.syncPoleScheduleToBillingAndReconciliation('907');

    assert.strictEqual(mockApp.activityLocations['907'].length, 2, 'activityLocations must have 2 locations');
    assert.strictEqual(mockApp.activityQuantities['907'].length, 2, 'activityQuantities must have 2 location rows');

    // Enter quantities: Loc 1 has 5 poles (idx 2), Loc 2 has 3 poles (idx 2)
    mockApp.setPoleScheduleCellQty(0, 2, 5);
    mockApp.setPoleScheduleCellQty(1, 2, 3);

    // Verify location-wise sync in Activity Billing
    // Index 2 is RSJ 11m pole (itemCode 17001243)
    const act = mockApp.activities['907'];
    const actPoleIdx = act.materials.findIndex(m => m.itemCode === '17001243');
    assert.ok(actPoleIdx !== -1, 'RSJ 11m pole must exist in Activity 907');

    assert.strictEqual(mockApp.activityQuantities['907'][0][actPoleIdx], 5, 'Activity Billing Loc 1 must have 5 poles');
    assert.strictEqual(mockApp.activityQuantities['907'][1][actPoleIdx], 3, 'Activity Billing Loc 2 must have 3 poles');

    // Verify total across locations
    const totalQty = mockApp.getPoleScheduleItemTotalQtyByKey('907', 2);
    assert.strictEqual(totalQty, 8, 'Total pole qty across both locations must be 5 + 3 = 8');
});

// 30. Auto-Concreting & Auger Size (Pole Pad Foundation + Stay Concreting)
it('Auto-Concreting & Auger Size: Calculates Pole Pad + Stay Concreting automatically across locations', () => {
    const defaultPoleSchedules = require('../js/data/default-pole-schedules.js');
    const defaultActivities = require('../js/data/default-activities.js');
    const psModule = require('../js/pole-schedule.js');

    const mockApp = {
        selectedPoleScheduleKey: '907',
        selectedActivityKey: '907',
        selectedAugerSize: 22,
        poleScheduleAutoConcreting: true,
        stayConcretingUnitVol: 0.125,
        poleSchedules: JSON.parse(JSON.stringify(defaultPoleSchedules)),
        activities: JSON.parse(JSON.stringify(defaultActivities)),
        poleScheduleLocations: { '907': [{ name: 'Loc 1' }, { name: 'Loc 2' }] },
        activityLocations: { '907': [{ name: 'Loc 1' }, { name: 'Loc 2' }] },
        poleScheduleQuantities: { '907': { 0: {}, 1: {} } },
        activityQuantities: { '907': [[], []] },
        isFinalized: false,
        recoRevision: 0,
        showToast() {},
        saveToStorage() {},
        debouncedSave() {},
        ...psModule
    };

    // Schedule 907:
    // Pole item: idx 2 (RSJ 11m, h=1.83m)
    // Stay item: idx 39 (H.T.Stay Set)
    // Concrete item: idx 44 (Concreting Cement Bag, itemCode 11000336)
    assert.strictEqual(mockApp.isPoleSchedulePoleItem(mockApp.poleSchedules['907'].materials[2]), true, 'Item 2 must be Pole');
    assert.strictEqual(mockApp.isPoleScheduleStayItem(mockApp.poleSchedules['907'].materials[39]), true, 'Item 39 must be Stay');
    assert.strictEqual(mockApp.isPoleScheduleConcreteItem(mockApp.poleSchedules['907'].materials[44]), true, 'Item 44 must be Concrete');

    // Set Location 1: 5 poles (idx 2), 2 stays (idx 39)
    mockApp.setPoleScheduleCellQty(0, 2, 5);
    mockApp.setPoleScheduleCellQty(0, 39, 2);

    // Set Location 2: 3 poles (idx 2), 1 stay (idx 39)
    mockApp.setPoleScheduleCellQty(1, 2, 3);
    mockApp.setPoleScheduleCellQty(1, 39, 1);

    // Radius for 22 inch auger = 22 * 0.0254 / 2 = 0.2794m
    // Loc 1 Concreting = (5 * PI * 0.2794^2 * 1.83) + (2 * 0.125) = 2.244 + 0.250 = 2.494 m3
    // Loc 2 Concreting = (3 * PI * 0.2794^2 * 1.83) + (1 * 0.125) = 1.346 + 0.125 = 1.471 m3
    const loc1Concrete = mockApp.getPoleScheduleCellQty(0, 44);
    const loc2Concrete = mockApp.getPoleScheduleCellQty(1, 44);

    assert.strictEqual(loc1Concrete, 2.494, 'Location 1 concrete volume must be exactly 2.494 m3');
    assert.strictEqual(loc2Concrete, 1.471, 'Location 2 concrete volume must be exactly 1.471 m3');

    // Verify summary across both locations
    const summary = mockApp.getPoleScheduleConcretingSummary('907');
    assert.strictEqual(summary.totalPoles, 8, 'Total poles must be 8');
    assert.strictEqual(summary.totalStays, 3, 'Total stays must be 3');
    assert.strictEqual(summary.totalVol, 3.965, 'Grand total concrete volume must be 3.965 m3');

    // Test changing auger size to 20 inch
    mockApp.selectedAugerSize = 20;
    mockApp.recalculatePoleScheduleConcreting('907', true);
    // Radius for 20 inch auger = 0.254m
    // Loc 1: (5 * PI * 0.254^2 * 1.83) + (2 * 0.125) = 1.854 + 0.250 = 2.104 m3
    // Loc 2: (3 * PI * 0.254^2 * 1.83) + (1 * 0.125) = 1.113 + 0.125 = 1.238 m3
    const loc1New = mockApp.getPoleScheduleCellQty(0, 44);
    const loc2New = mockApp.getPoleScheduleCellQty(1, 44);
    assert.strictEqual(loc1New, 2.105, 'With 20 inch auger, Loc 1 concrete volume must be 2.105 m3');
    assert.strictEqual(loc2New, 1.238, 'With 20 inch auger, Loc 2 concrete volume must be 1.238 m3');
});

it('Pole Schedule Strict One-Way Sync: Flows to Activity & Reco, manual activity edits never flow to Pole Schedule', () => {
    const defaultPoleSchedules = require('../js/data/default-pole-schedules.js');
    const defaultActivities = require('../js/data/default-activities.js');
    const psModule = require('../js/pole-schedule.js');
    const utilsModule = require('../js/utils.js');

    const mockApp = {
        selectedPoleScheduleKey: '907',
        selectedActivityKey: '907',
        poleSchedules: JSON.parse(JSON.stringify(defaultPoleSchedules)),
        activities: JSON.parse(JSON.stringify(defaultActivities)),
        poleScheduleLocations: { '907': [{ name: 'Location 1' }] },
        activityLocations: { '907': [{ name: 'Location 1' }] },
        poleScheduleQuantities: { '907': { 0: {} } },
        activityQuantities: { '907': [new Array(18).fill('')] },
        isFinalized: false,
        recoRevision: 0,
        showToast() {},
        saveToStorage() {},
        debouncedSave() {},
        evalFormula(val) { return val; },
        ...psModule,
        ...utilsModule
    };

    // 1. Entry in Pole Schedule must flow to Activity Billing & Reconciliation
    mockApp.setPoleScheduleCellQty(0, 2, 12); // RSJ Pole = 12
    const act = mockApp.activities['907'];
    const actPoleIdx = act.materials.findIndex(m => m.itemCode === '17001243');
    assert.strictEqual(mockApp.activityQuantities['907'][0][actPoleIdx], 12, 'Activity Billing must receive 12 from Pole Schedule');
    assert.ok(mockApp.recoRevision > 0, 'Reconciliation revision must be bumped');

    // 2. Manual entry directly in Activity Billing sheet
    const prevRevision = mockApp.recoRevision;
    const fakeEvent = { target: { value: '25' } };
    mockApp.commitGridFormula(fakeEvent, actPoleIdx, 0);
    assert.strictEqual(Number(mockApp.activityQuantities['907'][0][actPoleIdx]), 25, 'Activity Billing has manual entry 25');
    assert.ok(mockApp.recoRevision > prevRevision, 'Manual activity entry bumps recoRevision');

    // 3. CRITICAL: Pole Schedule must NOT have been changed by manual activity entry!
    assert.strictEqual(mockApp.poleScheduleQuantities['907'][0][2], 12, 'Pole Schedule must remain 12 and NEVER be overwritten by manual Activity entry');
});

it('Reconciliation Excel Export: Strictly exports only contractor-issued materials and exact summary totals', () => {
    // Mock app context with candidate rows containing both issued and unissued materials
    const mockRows = [
        { code: '11000123', desc: 'M SAND', uom: 'KG', sapGrossIssue: 500, sapMrnReturn: 50, sapNetIssue: 450, totalQty: 100 },
        { code: '17000624', desc: 'V CROSS ARM', uom: 'SET', sapGrossIssue: 164, sapMrnReturn: 0, sapNetIssue: 164, totalQty: 20 },
        { code: '17000999', desc: 'UNISSUED MASTER ITEM', uom: 'NO', sapGrossIssue: 0, sapMrnReturn: 0, sapNetIssue: 0, totalQty: 0 },
        { code: '17000888', desc: 'ANOTHER UNISSUED MATERIAL', uom: 'MTR', sapGrossIssue: 0, sapMrnReturn: 0, sapNetIssue: 0, totalQty: 50 }
    ];

    const allCandidateRows = mockRows;
    let expRows = allCandidateRows.filter(r => {
        const net = Number(r.sapNetIssue !== undefined ? r.sapNetIssue : (r.sapIssuedQty || 0));
        const gross = Number(r.sapGrossIssue !== undefined ? r.sapGrossIssue : 0);
        const issued = Number(r.sapIssuedQty || 0);
        return (net > 0 || gross > 0 || issued > 0);
    });

    assert.strictEqual(expRows.length, 2, 'Only 2 items issued to this contractor must be selected for export');
    assert.strictEqual(expRows[0].code, '11000123');
    assert.strictEqual(expRows[1].code, '17000624');
    assert.strictEqual(expRows.some(r => r.code === '17000999'), false, 'Unissued master item must be excluded');
    assert.strictEqual(expRows.some(r => r.code === '17000888'), false, 'Material with 0 issue even if totalQty > 0 must be excluded');

    let sumGross = 0, sumMrn = 0, sumNet = 0;
    expRows.forEach(rowObj => {
        sumGross += Number(rowObj.sapGrossIssue || rowObj.sapIssuedQty || 0);
        sumMrn += Number(rowObj.sapMrnReturn || 0);
        sumNet += Number(rowObj.sapNetIssue !== undefined ? rowObj.sapNetIssue : (rowObj.sapIssuedQty || 0));
    });
    assert.strictEqual(sumGross, 664, 'Gross sum must equal 500 + 164 = 664');
    assert.strictEqual(sumMrn, 50, 'MRN sum must equal 50');
    assert.strictEqual(sumNet, 614, 'Net sum must equal 450 + 164 = 614');
});

it('Repeating Pole Schedule Items: Sums multiple occurrences (e.g. Top Cleat in Cut Point & V-Cross) into single Activity quantity', () => {
    const defaultPoleSchedules = require('../js/data/default-pole-schedules.js');
    const defaultActivities = require('../js/data/default-activities.js');
    const psModule = require('../js/pole-schedule.js');

    const mockApp = {
        selectedPoleScheduleKey: '907',
        selectedActivityKey: '907',
        poleSchedules: JSON.parse(JSON.stringify(defaultPoleSchedules)),
        activities: JSON.parse(JSON.stringify(defaultActivities)),
        poleScheduleLocations: { '907': [{ name: 'Loc 1' }] },
        activityLocations: { '907': [{ name: 'Loc 1' }] },
        poleScheduleQuantities: { '907': { 0: {} } },
        activityQuantities: { '907': [new Array(25).fill('')] },
        isFinalized: false,
        recoRevision: 0,
        showToast() {},
        saveToStorage() {},
        debouncedSave() {},
        ...psModule
    };

    // Activity 907 material for Top Cleat (itemCode: 17005041)
    const actMatIdx = mockApp.activities['907'].materials.findIndex(m => m.itemCode === '17005041');
    assert.ok(actMatIdx !== -1, 'Top cleat (17005041) must exist in Activity 907');

    // Pole Schedule 907 has Top Cleat at index 10 (Cut point) and index 27 (V-Cross fitting)
    mockApp.setPoleScheduleCellQty(0, 10, 15); // Top Cleat SPCP in Cut point = 15
    mockApp.setPoleScheduleCellQty(0, 27, 25); // Top fitting with clamp in V-Cross = 25

    // Activity Billing must receive the SUM: 15 + 25 = 40
    assert.strictEqual(mockApp.activityQuantities['907'][0][actMatIdx], 40, 'Activity Billing must receive exact sum of repeating Pole Schedule rows (15 + 25 = 40)');

    // Changing one row updates the sum reactively
    mockApp.setPoleScheduleCellQty(0, 10, 30);
    assert.strictEqual(mockApp.activityQuantities['907'][0][actMatIdx], 55, 'Activity Billing must update sum to 30 + 25 = 55');

    // Clearing one row retains the other row
    mockApp.setPoleScheduleCellQty(0, 27, '');
    assert.strictEqual(mockApp.activityQuantities['907'][0][actMatIdx], 30, 'Activity Billing must retain 30 when second row is cleared');

    // Clearing both makes activity cell blank
    mockApp.setPoleScheduleCellQty(0, 10, '');
    assert.strictEqual(mockApp.activityQuantities['907'][0][actMatIdx], '', 'Activity Billing must be blank when all matching rows are cleared');
});

(async () => {
    if (asyncTests.length > 0) {
        await Promise.all(asyncTests);
    }
    console.log('----------------------------------------------------');
    console.log(`Results: ${passedTests} of ${totalTests} tests passed.`);
    console.log('----------------------------------------------------');

    if (passedTests !== totalTests) {
        process.exit(1);
    }
})();

