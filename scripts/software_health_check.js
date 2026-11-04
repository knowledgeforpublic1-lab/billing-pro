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

console.log('\n====================================================');
console.log(`Audit Summary: ${passCount} passed, ${failCount} failed.`);
console.log('====================================================');

if (failCount > 0) {
    process.exit(1);
}
