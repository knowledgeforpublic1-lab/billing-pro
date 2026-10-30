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

    // Execute startNewBlankBill via openNewBillModal
    Object.assign(mockApp, window.SyncModule);
    mockApp.syncToMongoNow = async () => { syncCalled = true; return true; };
    mockApp.saveToStorage = () => { savedToStorageCalled = true; };
    mockApp.loadSavedBillsList = () => {};
    await mockApp.openNewBillModal();

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

    // Ensure neither contains "LK"
    assert.strictEqual(cName1.includes('LK'), false);
    assert.strictEqual(cName2.includes('LK'), false);
});


// 14. SAP Stock: Unmapped and Mismatched Contractor Issued Items Detection & Red Highlight Logic
it('SAP Stock: Unmapped and Mismatched Contractor Issued Items Detection & Red Highlight Logic', () => {
    global.window = global;
    eval(fs.readFileSync('js/data/default-activities.js', 'utf8').replace('const defaultActivities', 'global.defaultActivities'));
    eval(fs.readFileSync('js/data/contractor-sap-issues.js', 'utf8'));
    eval(fs.readFileSync('js/mapping.js', 'utf8'));

    const mockApp = {
        activities: global.defaultActivities,
        selectedContractorName: 'Ravindra Kapgate',
        currentContractorSap: window.ContractorSapStock.byContractorNorm['ravindrakapgade'],
        get allMappedSapCodesSet() {
            const set = new Set();
            if (!this.activities) return set;
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

    // 4. Verify Strain Hardware mismatch 17000704
    const strain = unmappedItems.find(it => it.code === '17000704');
    assert.ok(strain, 'Strain Hardware 17000704 should be in unmapped list');
    assert.strictEqual(strain.netIssue, 1702);
    assert.ok(strain.potentialMatch, 'Strain Hardware should have potential match');
    assert.strictEqual(strain.potentialMatch.actKey, '907', 'Should match Activity 907 (Strain Hardware)');

    // 5. Verify isUnmappedContractorIssuedRow for Reconciliation row red highlighting
    const unmappedIssuedRow = { code: '17000195', desc: 'CABLE AL 11KV XLPE', sapGrossIssue: 348, sapNetIssue: 348 };
    const mappedIssuedRow = { code: '17000004', desc: 'RSJ POLE', sapGrossIssue: 348, sapNetIssue: 250 };
    const zeroIssueUnmappedRow = { code: '99999999', desc: 'ZERO ITEM', sapGrossIssue: 0, sapNetIssue: 0, sapIssuedQty: 0 };

    assert.strictEqual(mockApp.isUnmappedContractorIssuedRow(unmappedIssuedRow), true, 'Unmapped row with net issue must be highlighted (true)');
    assert.strictEqual(mockApp.isUnmappedContractorIssuedRow(mappedIssuedRow), false, 'Mapped row with issue must NOT be highlighted as unmapped (false)');
    assert.strictEqual(mockApp.isUnmappedContractorIssuedRow(zeroIssueUnmappedRow), false, 'Zero issue row must NOT be highlighted (false)');
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

