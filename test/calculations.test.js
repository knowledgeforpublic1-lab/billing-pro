/**
 * @file Billing Pro - Core Calculation & Logic Test Suite
 * @description Unit tests for billing calculations, percentages, GST,
 * conductor divisors, and invoice sanitation.
 * Run directly with: node test/calculations.test.js
 */

const assert = require('assert');

console.log('----------------------------------------------------');
console.log('🧪 Running Billing Pro Unit Tests...');
console.log('----------------------------------------------------');

let totalTests = 0;
let passedTests = 0;

function it(name, fn) {
    totalTests++;
    try {
        fn();
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

console.log('----------------------------------------------------');
console.log(`Results: ${passedTests} of ${totalTests} tests passed.`);
console.log('----------------------------------------------------');

if (passedTests !== totalTests) {
    process.exit(1);
}

