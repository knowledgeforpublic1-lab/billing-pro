'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('../Reconciliation master/xlsx.full.min.js');
const JSZip = require('../js/jszip.min.js');
global.window = global;
global.XLSX = XLSX;
global.JSZip = JSZip;
require('../js/stock-importer');
const importer = global.StockImporterModule;
const file = (name, bytes) => ({ name, size: bytes.length, arrayBuffer: async () => Uint8Array.from(bytes).buffer });
const stockRows = [
    ['Contractor', 'Material', 'Description', 'UOM', 'Issue', 'MRN', 'Posting Date', 'Work Order'],
    ['Team A', '00100', 'Cable, तांबा', 'M', 10, 0, '2026-11-01', '31000001'],
    ['Team A', '00100', 'Cable, तांबा', 'M', 0, 3, '2026-11-10', '31000001'],
    ['Team A', '00200', 'Pole', 'NO', 5, 0, '2026-11-24', '31000001'],
    ['Team B', '00100', 'Cable', 'M', 20, 0, '2026-11-24', '31000002']
];
function workbook(rows = stockRows) {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Stock');
    return book;
}
function sapBook(mapping = true) {
    const book = XLSX.utils.book_new();
    if (mapping) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
        [], [], ['', 'Vendor', 'Work Order', 'Contractor'], ['', 'V1', '31000001', 'Team A']
    ]), 'SAP Code');
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
        ['Plant', '', 'Document Date', '', 'Posting Date', '', '', '', 'Material', 'Description', 'Unit', 'Qty', '', '', '', 'Doc Header'],
        [1, '', '2026-01-01', '', '2026-11-01', '', '', '', '00100', 'Cable', 'M', 10, '', '', '', '31000001'],
        [1, '', '2026-01-01', '', '2026-11-10', '', '', '', '00100', 'Cable', 'M', -3, '', '', '', '31000001']
    ]), 'Stock');
    return book;
}
const materials = data => JSON.parse(JSON.stringify(data.byContractorNorm));

test('XLSX, XLS, XLSB and UTF-8 CSV preserve contractor identities, leading-zero SAP codes, returns and posting dates', async () => {
    global.MasterSapCodeMapping = { groups: { other: { displayName: 'Other' } }, dhToGroupKey: {} };
    let expected;
    for (const extension of ['xlsx', 'xls', 'xlsb', 'csv']) {
        const bytes = XLSX.write(workbook(), { bookType: extension, type: 'buffer' });
        const parsed = await importer.parseStockFile(file('Stock.' + extension.toUpperCase(), bytes), { activeContractorName: 'Selected Team', activeContractorId: 'selected_team' });
        if (!expected) expected = materials(parsed);
        else assert.deepEqual(materials(parsed), expected, extension + ' must match the Excel ledger');
        assert.equal(parsed.byContractorNorm.teama.materials['00100'].netIssue, 7);
        assert.equal(parsed.byContractorNorm.teamb.materials['00100'].netIssue, 20);
        assert.equal(parsed.byContractorNorm.selectedteam, undefined, 'Other contractors cannot inherit the selected team alias');
        assert.equal(parsed.byContractorNorm.teama.materials['00100'].desc, 'Cable, तांबा');
        assert.deepEqual(parsed.byContractorNorm.teama.materials['00100'].txns, [['2026-11-01', 10, 0], ['2026-11-10', 0, 3]]);
    }
});

test('CSV in the full SAP layout uses saved mapping and retains date strings; missing mapping is rejected', async () => {
    const bytes = Buffer.from(XLSX.utils.sheet_to_csv(sapBook(false).Sheets.Stock), 'utf8');
    global.MasterSapCodeMapping = { groups: { teama: { displayName: 'Team A' } }, dhToGroupKey: { '31000001': 'teama' } };
    const parsed = await importer.parseStockFile(file('Stock.csv', bytes));
    assert.equal(parsed.byContractorNorm.teama.materials['00100'].netIssue, 7);
    assert.deepEqual(parsed.byContractorNorm.teama.materials['00100'].txns, [['2026-11-01', 10, 0], ['2026-11-10', 0, 3]]);
    delete global.MasterSapCodeMapping;
    await assert.rejects(importer.parseStockFile(file('Stock.csv', bytes)), /SAP mapping nahi mili/);
});

test('CSV supports quoted thousands, semicolon-separated exports and reordered columns using saved work-order mapping', async () => {
    global.MasterSapCodeMapping = { groups: { teama: { displayName: 'Team A' } }, dhToGroupKey: { '31000001': 'teama' } };
    const csv = '\uFEFFPosting Date;Material;Quantity;Doc Header\n2026-11-01;00100;1,234.5;31000001\n2026-11-10;00100;-3.5;31000001';
    const parsed = await importer.parseStockFile(file('Stock.csv', Buffer.from(csv, 'utf8')), { activeContractorName: 'Other' });
    const material = parsed.byContractorNorm.teama.materials['00100'];
    assert.equal(material.grossIssue, 1234.5); assert.equal(material.mrnReturn, 3.5); assert.equal(material.netIssue, 1231);
    assert.equal(parsed.byContractorNorm.other, undefined);
    assert.deepEqual(material.txns, [['2026-11-01', 1234.5, 0], ['2026-11-10', 0, 3.5]]);
});

test('ZIP preserves an XLSB workbook and supports a separate stock CSV plus SAP Code.csv', async () => {
    delete global.MasterSapCodeMapping;
    const book = sapBook();
    const zippedWorkbook = new JSZip().file('folder/Stock.xlsb', XLSX.write(book, { bookType: 'xlsb', type: 'buffer' }));
    const first = await importer.parseStockFile(file('Stock.zip', await zippedWorkbook.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })));
    const zippedCsv = new JSZip().file('folder/Stock.csv', '\uFEFF' + XLSX.utils.sheet_to_csv(book.Sheets.Stock))
        .file('folder/SAP Code.csv', XLSX.utils.sheet_to_csv(book.Sheets['SAP Code'])).file('readme.txt', 'Stock export');
    const second = await importer.parseStockFile(file('Stock.zip', await zippedCsv.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })));
    assert.deepEqual(materials(second), materials(first));
    assert.equal(second.byContractorNorm.teama.materials['00100'].netIssue, 7);
});

test('ZIP rejects corrupt archives, oversized expansion and ambiguous stock files without silently choosing one', async () => {
    await assert.rejects(importer.parseStockFile(file('Stock.zip', Buffer.from('not a zip'))), /Invalid ZIP/);
    const ambiguous = new JSZip().file('first.csv', 'Material,Issue\n100,5').file('second.csv', 'Material,Issue\n100,10');
    await assert.rejects(importer.parseStockFile(file('Stock.zip', await ambiguous.generateAsync({ type: 'nodebuffer' }))), /ek stock CSV/);
    const bytes = await new JSZip().file('Stock.csv', 'Material,Issue\n100,5').generateAsync({ type: 'nodebuffer' });
    const entry = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    bytes.writeUInt32LE(129 * 1024 * 1024, entry + 24);
    await assert.rejects(importer.parseStockFile(file('Stock.zip', bytes)), /expanded size/);
    await assert.rejects(importer.parseStockFile({ name: 'Stock.csv', size: 129 * 1024 * 1024 }), /128 MB/);
    await assert.rejects(importer.parseStockFile(file('Stock.pdf', Buffer.from('stock'))), /Supported stock formats/);
});

test('CSV upload follows the same local backup, cloud confirmation and display update path as Excel', async () => {
    const bytes = XLSX.write(workbook(), { bookType: 'csv', type: 'buffer' });
    const uploaded = file('Stock.csv', bytes), order = [], messages = [];
    global.BillingStorage = { async setItem(key, data) { order.push('local'); assert.equal(data.byContractorNorm.teama.materials['00100'].netIssue, 7); return { saved: true }; } };
    global.BillingCloudDatasets = { async save(key, data, source) { order.push('cloud'); assert.equal(key, 'stockMaster'); assert.equal(source, uploaded); } };
    const app = { selectedContractorName: 'Team A', selectedContractorId: 'teama', sapMaterialsMaster: [], contractorsList: [],
        showToast(message) { messages.push(message); }, $forceUpdate() { order.push('display'); } };
    await importer.handleStockFileUpload.call(app, { target: { files: [uploaded], value: 'Stock.csv' } });
    assert.deepEqual(order, ['local', 'cloud', 'display']);
    assert.equal(app.hasCustomStock, true); assert.equal(app.stockUploading, false);
    assert.equal(global.ContractorSapStock.byContractorNorm.teama.materials['00100'].netIssue, 7);
    assert.ok(messages.some(message => message.includes('Stock Updated!')));
});
