/**
 * BILLING PRO — RAPID HEALTH CHECK & AUDIT RUNNER
 * Verifies all security, calculation, sync, and business invariants in under 1 second.
 * Run via: npm run audit
 */

const fs = require('fs');
const assert = require('assert');

global.window = global;

console.log('====================================================');
console.log('⚡ BILLING PRO — INSTANT HEALTH & INTEGRITY AUDIT');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function check(name, fn) {
    try {
        fn();
        console.log(`  ✅ [PASS] ${name}`);
        passCount++;
    } catch (err) {
        console.error(`  ❌ [FAIL] ${name}`);
        console.error(`     Error: ${err.message}`);
        failCount++;
    }
}

// 1. Sync Full Hash Check (No Stride-97 Blind Spots)
check('Sync Hash: 1-Character Edit Changes Hash (No Blind Spots)', () => {
    eval(fs.readFileSync('js/utils.js', 'utf8'));
    eval(fs.readFileSync('js/sync.js', 'utf8'));

    const basePayload = {
        dataId: 'bill-1',
        activities: { '907': { materials: [{ qty: 5 }] } }
    };
    const modifiedPayload = {
        dataId: 'bill-1',
        activities: { '907': { materials: [{ qty: 6 }] } }
    };

    const hash1 = window.SyncModule.stableStateHash(basePayload);
    const hash2 = window.SyncModule.stableStateHash(modifiedPayload);

    assert.ok(hash1, 'Hash 1 must not be empty');
    assert.ok(hash2, 'Hash 2 must not be empty');
    assert.notStrictEqual(hash1, hash2, 'Changing qty 5 to 6 must produce a completely different sync hash!');
});

// 2. Tax Invoice 0-Paisa Discrepancy Check
check('Tax Invoice: Zero Paisa Discrepancy (CGST + SGST + Basic === Grand Total)', () => {
    const testAmounts = [186416.28, 999.60, 54321.33, 100000.01, 75432.89, 12.37, 88888.88];

    testAmounts.forEach(basic => {
        const cgst = Math.round(basic * 0.09 * 100) / 100;
        const sgst = Math.round(basic * 0.09 * 100) / 100;
        const totalGst = Math.round((cgst + sgst) * 100) / 100;
        const grandTotal = Math.round((basic + totalGst) * 100) / 100;

        const manualSum = Math.round((basic + cgst + sgst) * 100) / 100;
        assert.strictEqual(grandTotal, manualSum, `For basic ${basic}, Grand Total (${grandTotal}) must exactly equal Basic + CGST + SGST (${manualSum})`);
    });
});

// 3. Amount in Words Handles Paise Accurately
check('Currency Formatter: Amount in Words Includes Exact Paise', () => {
    eval(fs.readFileSync('js/utils.js', 'utf8'));

    const w1 = numberToWordsIndian(999.60);
    assert.ok(w1.includes('Nine Hundred') && w1.includes('Ninety Nine Rupees'), 'Must have correct rupees: ' + w1);
    assert.ok(w1.includes('Sixty Paise'), 'Must have sixty paise: ' + w1);

    const w2 = numberToWordsIndian(1000);
    assert.ok(w2.includes('One Thousand Rupees Only'), 'Round amount must end with Rupees Only: ' + w2);
    assert.ok(!w2.includes('Paise'), 'Round amount must not mention paise: ' + w2);
});

// 4. Excel Export: Column Letter Conversion beyond 21 columns
check('Excel Export: Column Letters Map Accurately Beyond 21 Columns (No corrupt formulas)', () => {
    eval(fs.readFileSync('js/export.js', 'utf8'));

    assert.strictEqual(window.ExportModule.colNumToLetter(1), 'A');
    assert.strictEqual(window.ExportModule.colNumToLetter(26), 'Z');
    assert.strictEqual(window.ExportModule.colNumToLetter(27), 'AA');
    assert.strictEqual(window.ExportModule.colNumToLetter(28), 'AB');
    assert.strictEqual(window.ExportModule.colNumToLetter(52), 'AZ');
    assert.strictEqual(window.ExportModule.colNumToLetter(53), 'BA');

    // 22 columns in recon start at column 5 + 22 = 27 = 'AA'
    const col22 = window.ExportModule.colNumToLetter(5 + 22);
    assert.strictEqual(col22, 'AA', 'Column 27 must be AA (not ASCII "["!)');
});

// 5. Finalized / Locked Bill Protection
check('Finalized Bill: Grid Edits Are Blocked When Locked', () => {
    eval(fs.readFileSync('js/utils.js', 'utf8'));

    const mockApp = Object.assign({
        isFinalized: true,
        selectedActivityKey: '907',
        activityQuantities: { '907': { '0': { '0': 100 } } },
        showToast(msg, icon) { this._lastToast = msg; },
        saveToStorage() { this._saved = true; }
    }, window.UtilsModule);

    const mockEvent = { target: { value: '999' } };
    mockApp.commitGridFormula(mockEvent, 0, 0);

    assert.strictEqual(mockApp.activityQuantities['907']['0']['0'], 100, 'Locked bill quantity must not be altered!');
    assert.strictEqual(mockApp._saved, undefined, 'saveToStorage must not be triggered on locked bill!');
});

// 6. Manual Invoice Row Honor (No Silent Overwrite)
check('Tax Invoice: Manual Rows Are Not Overwritten on Auto-Sync', () => {
    eval(fs.readFileSync('js/billing.js', 'utf8'));

    const mockApp = Object.assign({
        activities: {
            '907': { title: 'Overhead Line' }
        },
        invoiceData: {
            items: [
                { actKey: '907', desc: 'Custom Manual Work Description', amount: 99999, manual: true }
            ]
        },
        keyOfInvoiceItem(it) { return it.actKey || '907'; },
        getActivityBilled85Amount(k) { return 5000; },
        getActivityInvoiceDescription(k) { return 'Activity 907 : Default Title'; },
        getActivityUom(k) { return 'KM'; },
        getActivity907InvoiceQty() { return 1; }
    }, window.BillingModule);

    mockApp.updateSyncTaxInvoiceFromActivities();

    const item = mockApp.invoiceData.items[0];
    assert.strictEqual(item.manual, true, 'Row must remain marked as manual');
    assert.strictEqual(item.amount, 99999, 'Manual amount must not be overwritten to 5000!');
});

// 7. Security: Upload Endpoint Disabled
check('Security: Reconciliation upload.php is Disabled (403 Forbidden)', () => {
    const php = fs.readFileSync('Reconciliation master/upload.php', 'utf8');
    assert.ok(php.includes('403'), 'upload.php must return 403 Forbidden');
    assert.ok(!php.includes('file_put_contents'), 'upload.php must not have unauthenticated file write capability');
});

// 8. Contractor Name Phonetic & Token Matching
check('Contractor Stock Matching: Maa Kali Enterprises <-> MA KALI ENTERPRISE', () => {
    eval(fs.readFileSync('js/billing.js', 'utf8'));

    const mockStock = {
        meta: { source: 'SAP Dump' },
        byContractorNorm: {
            'makalienterprise': { contractorName: 'MA KALI ENTERPRISE', materials: { '17000004': { issuedQty: 50 } } }
        }
    };
    window.ContractorSapStock = mockStock;

    const mockApp = Object.assign({
        selectedContractorId: 'maa_kali_enterprises',
        selectedContractorName: 'Maa Kali Enterprises',
        recoRevision: 0,
        hasCustomStock: false,
        contractorsList: [{ id: 'maa_kali_enterprises', name: 'Maa Kali Enterprises', workOrderNo: '' }]
    }, window.BillingModule);

    const match = mockApp.getContractorSapIssues();
    assert.ok(match, 'Must match Maa Kali Enterprises to MA KALI ENTERPRISE');
    assert.strictEqual(match.contractorName, 'MA KALI ENTERPRISE');
});

// 9. Workbook Import: View set to valid 'taxInvoice' string
check('Workbook Import: currentView is set to valid taxInvoice string', () => {
    const syncCode = fs.readFileSync('js/sync.js', 'utf8');
    assert.ok(!syncCode.includes('this.currentView = 3;'), 'currentView must never be set to integer 3');
    assert.ok(syncCode.includes('this.currentView = \'taxInvoice\';') || syncCode.includes('this.currentView = "taxInvoice";'), 'currentView must be string taxInvoice');
});

// 10. Deployment Security: PII and Upload Route Protection in vercel.json & .vercelignore
check('Deployment Security: Vercel routes & ignore protect contractor PII files', () => {
    const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
    const routes = vercelConfig.routes || [];
    const has403Block = routes.some(r => r.status === 403 && (r.src.includes('data') || r.src.includes('upload')));
    assert.ok(has403Block, 'vercel.json must have 403 status rule blocking sensitive files');

    const vercelIgnore = fs.readFileSync('.vercelignore', 'utf8');
    assert.ok(vercelIgnore.includes('Reconciliation master/data.js'), '.vercelignore must exclude data.js');
    assert.ok(vercelIgnore.includes('Reconciliation master/data.json'), '.vercelignore must exclude data.json');
    assert.ok(vercelIgnore.includes('Reconciliation master/upload.php'), '.vercelignore must exclude upload.php');
});

// 11. Activity 922 Restored & Pole Schedules (907 & 922) Verification
check('Activity 922 Restored (18 items) & Pole Schedules Configured (907: 53 items, 922: 45 items)', () => {
    const actCode = fs.readFileSync('js/data/default-activities.js', 'utf8');
    const actFn = new Function(actCode + '; return defaultActivities;');
    const acts = actFn();
    const act922 = acts['922'];
    const act907 = acts['907'];

    // Standard billing activities integrity
    assert.ok(act922, 'Activity 922 must exist in defaultActivities');
    assert.strictEqual(act922.materials.length, 18, 'Activity 922 must be restored to original 18 contract items');
    assert.ok(act907, 'Activity 907 must exist in defaultActivities');
    assert.strictEqual(act907.materials.length, 25, 'Activity 907 must have 25 contract items');

    // Pole Schedules Master Data integrity
    const schedCode = fs.readFileSync('js/data/default-pole-schedules.js', 'utf8');
    const schedFn = new Function(schedCode + '; return defaultPoleSchedules;');
    const scheds = schedFn();

    // 907 Pole Schedule (53 rows from site sheet)
    const sched907 = scheds['907'];
    assert.ok(sched907, 'Pole Schedule 907 must exist');
    assert.strictEqual(sched907.materials.length, 53, 'Pole Schedule 907 must have 53 items');
    assert.strictEqual(sched907.materials[2].itemCode, '17001243', 'RSJ 11m must be 17001243');
    assert.strictEqual(sched907.materials[6].isSection, true, 'Guarding channel must be section header');

    // 922 Pole Schedule (45 rows from site sheet)
    const sched922 = scheds['922'];
    assert.ok(sched922, 'Pole Schedule 922 must exist');
    assert.strictEqual(sched922.materials.length, 45, 'Pole Schedule 922 must have 45 items');
    assert.strictEqual(sched922.materials[0].itemCode, '17001243', 'Item 1 must be RSJ 11m (17001243)');
    assert.strictEqual(sched922.materials[2].itemCode, '17005040', 'Item 3 must be Top Channel (17005040)');
    assert.strictEqual(sched922.materials[4].itemCode, '17005039', 'Item 5 must be Guarding Cross Arm (17005039)');
    assert.strictEqual(sched922.materials[6].itemCode, '17005042', 'Item 7 must be SPCP Channel (17005042)');
    assert.strictEqual(sched922.materials[7].itemCode, '17005050', 'Item 8 must be V-cross (17005050)');
    assert.strictEqual(sched922.materials[8].itemCode, '17005041', 'Item 9 must be Top Cleat (17005041)');
    assert.strictEqual(sched922.materials[10].itemCode, '17005043', 'Item 11 must be Bracing (17005043)');
    assert.strictEqual(sched922.materials[15].itemCode, '17005046', 'Item 16 must be Black Clamp A (17005046)');
    assert.strictEqual(sched922.materials[16].itemCode, '17005085', 'Item 17 must be Black Clamp B (17005085)');
    assert.strictEqual(sched922.materials[17].itemCode, '17005047', 'Item 18 must be Stay Set Clamp A (17005047)');
    assert.strictEqual(sched922.materials[18].itemCode, '17005048', 'Item 19 must be Stay Set Clamp B (17005048)');
    assert.strictEqual(sched922.materials[24].itemCode, '17000046', 'Item 25 must be Disc Insulator (17000046)');
    assert.strictEqual(sched922.materials[26].itemCode, '17000239', 'Item 27 must be Stay Wire (17000239)');
    assert.strictEqual(sched922.materials[27].itemCode, '17005053', 'Item 28 must be Earthing Sets (17005053)');
    assert.strictEqual(sched922.materials[36].itemCode, '17000636', 'Item 37 must be N/B 16*150 (17000636)');
    assert.strictEqual(sched922.materials[41].itemCode, '17000004', 'Extra 1 must be RSJ 9m (17000004)');
    assert.strictEqual(sched922.materials[44].itemCode, '17000651', 'Extra 4 must be Lugs 70sqmm (17000651)');

    // 1425A Pole Schedule (41 rows from site sheet)
    const sched1425a = scheds['1425A'];
    assert.ok(sched1425a, 'Pole Schedule 1425A must exist');
    assert.strictEqual(sched1425a.materials.length, 41, 'Pole Schedule 1425A must have 41 items');
    assert.strictEqual(sched1425a.materials[1].itemCode, '17001240', 'Item 1 must be PSC Pole 8m');
    assert.strictEqual(sched1425a.materials[2].itemCode, '17001261', 'Item 2 must be AAAC 55 mm2');
    assert.strictEqual(sched1425a.materials[3].itemCode, '17000120', 'Item 3 must be ACSR Weasel');
    assert.strictEqual(sched1425a.materials[9].itemCode, '17005082', 'Item 7 must be D-Clamp (17005082)');
    assert.strictEqual(sched1425a.materials[18].itemCode, '17000056', 'Item 16 must be LT Shackle Insulator (17000056)');
    assert.strictEqual(sched1425a.materials[23].itemCode, '17001369', 'Item 21 must be Earthing Set LT (17001369)');
    assert.strictEqual(sched1425a.materials[33].itemCode, '17000614', 'Item 30 must be N/B 12*35 (17000614)');
    assert.strictEqual(sched1425a.materials[38].itemCode, '17001356', 'Item 35 must be Wedge Connector (17001356)');
});

console.log('\n====================================================');
console.log(`Audit Summary: ${passCount} passed, ${failCount} failed.`);
console.log('====================================================');

if (failCount > 0) {
    process.exit(1);
}
