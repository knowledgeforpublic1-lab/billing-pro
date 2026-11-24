'use strict';
// Read-only comparison of a saved cloud snapshot against both production views.
// Snapshot JSON: { stock: <stockMaster.data>, reconciliation: <stateData> }.
const fs = require('node:fs');
const path = require('node:path');
global.window = global;
require('../js/data/default-contractors');
require('../js/data/reconciliation-stock-aliases');
require('../js/stock-identity');
require('../js/billing');
require('../Reconciliation master/stock-sync');

const args = process.argv.slice(2);
const input = args[args.indexOf('--snapshot') + 1];
if (!args.includes('--snapshot') || !input) throw Error('Usage: node scripts/audit-stock-parity.js --snapshot snapshot.json [--out report.json]');
const snapshot = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
if (!snapshot.stock?.byContractorNorm || !Array.isArray(snapshot.reconciliation?.Contractors)) throw Error('Stock and reconciliation snapshots are required');
const normalize = BillingStockIdentity.normalize;
const directory = [...defaultContractorsList];
const known = new Set(directory.map(row => normalize(row.name)));
for (const [id, block] of Object.entries(snapshot.stock.byContractorNorm)) {
    if (known.has(normalize(block.contractorName))) continue;
    known.add(normalize(block.contractorName)); directory.push({ id, name: block.contractorName, workOrderNo: block.docHeader });
}
global.ContractorSapStock = snapshot.stock;
const master = MasterStockSync.apply(snapshot.reconciliation, snapshot.stock, { directory, referenceData: ReconciliationStockAliases });
const unit = value => {
    const key = String(value || '').toUpperCase().replace(/[.\s]/g, '');
    return ({ NOS: 'NO', N0: 'NO', MTR: 'M', MTRS: 'M', METRE: 'M', METER: 'M', KGS: 'KG', TON: 'MT', TONNE: 'MT' })[key] || key;
};
const scale = (from, to) => unit(from) === unit(to) ? 1 : ({ 'M|KM': 0.001, 'KM|M': 1000, 'KG|MT': 0.001, 'MT|KG': 1000 })[unit(from) + '|' + unit(to)];
const num = value => Number(value) || 0;
const differences = [], preservationErrors = [], formulaErrors = [], entries = [];
const ledgerUse = new Map();
for (const current of master.Contractors) {
    const name = current.IssueStockSource?.contractor || current.ContractorName;
    const profile = directory.find(row => normalize(row.name) === normalize(current.ContractorName));
    const app = { ...BillingModule, contractorsList: directory, selectedContractorId: profile?.id || normalize(current.ContractorName), selectedContractorName: current.ContractorName,
        invoiceData: { workOrderNo: current.Metadata?.WONo || '' }, hasCustomStock: true, stockAsOnDate: '', recoRevision: 1 };
    const ledger = app.getContractorSapIssues();
    if (ledger) ledgerUse.set(ledger, (ledgerUse.get(ledger) || 0) + 1);
    const expected = app.getReconciliationIssueStock()?.materials || {};
    const before = differences.length;
    for (const code of new Set([...Object.keys(expected), ...current.Items.map(item => String(item.ItemCode))])) {
        const source = expected[code], rows = current.Items.filter(row => String(row.ItemCode) === code);
        const quantity = rows.reduce((sum, row) => sum + num(row.NetIssue), 0), expectedQty = num(source?.netIssue);
        const conversion = source && rows.length ? scale(source.uom, rows[0].UOM) : 1;
        if (conversion === undefined || Math.abs(quantity - expectedQty * conversion) > 0.00001) differences.push({ contractor: current.ContractorName, code,
            stockUnit: source?.uom, masterUnit: rows[0]?.UOM, stockQty: expectedQty, masterQty: quantity });
    }
    const original = snapshot.reconciliation.Contractors[current.StockSyncPrimaryEntryIndex];
    if (original) (original.Items || []).forEach((item, index) => {
        for (const field of ['Consumption', 'WIP', 'Theft', 'DebitRate']) if (num(item[field]) !== num(current.Items[index]?.[field])) preservationErrors.push({ contractor: current.ContractorName, code: item.ItemCode, field });
    });
    for (const item of current.Items) if (Math.abs(num(item.NetIssue) - num(item.Consumption) - num(item.WIP) - num(item.Theft) - num(item.BalanceQty)) > 0.00001) formulaErrors.push({ contractor: current.ContractorName, code: item.ItemCode });
    entries.push({ contractor: current.ContractorName, stockContractor: name, sourceEntries: current.StockSyncEntryIndices, itemCount: current.Items.length, differences: differences.length - before });
}
const historyErrors = (master.StockSyncArchivedEntries || []).filter(entry => {
    const original = snapshot.reconciliation.Contractors[entry.contractor.StockSyncPrimaryEntryIndex];
    return original && (JSON.stringify(original.Items) !== JSON.stringify(entry.contractor.Items) || JSON.stringify(original.Metadata) !== JSON.stringify(entry.contractor.Metadata));
}).length;
const summary = { sourceEntries: snapshot.reconciliation.Contractors.length, currentEntries: master.Contractors.length,
    stockLedgers: BillingStockIdentity.index(snapshot.stock).length, checkedItems: master.Contractors.reduce((sum, entry) => sum + entry.Items.length, 0),
    uncoveredStockLedgers: BillingStockIdentity.index(snapshot.stock).filter(group => !ledgerUse.has(group.block)).length,
    duplicateLedgerAssignments: [...ledgerUse.values()].filter(count => count > 1).length,
    mismatchedEntries: entries.filter(entry => entry.differences).length, itemDifferences: differences.length,
    consumptionOrRateChanges: preservationErrors.length, balanceFormulaErrors: formulaErrors.length,
    correctedUnitLabels: master.StockSyncCorrections.length, archivedDuplicates: master.StockSyncArchivedEntries.length,
    alteredHistory: historyErrors, unresolvedWarnings: master.StockSyncWarnings.length };
if (args.includes('--out')) fs.writeFileSync(path.resolve(args[args.indexOf('--out') + 1]), JSON.stringify({ summary, entries, differences, preservationErrors, formulaErrors,
    unitCorrections: master.StockSyncCorrections, archivedDuplicates: master.StockSyncArchivedEntries.map(entry => ({ reason: entry.reason, contractor: entry.contractor.ContractorName, sourceEntries: entry.contractor.StockSyncEntryIndices })), warnings: master.StockSyncWarnings }, null, 2));
console.log(JSON.stringify(summary));
if (differences.length || preservationErrors.length || formulaErrors.length || historyErrors || master.StockSyncWarnings.length || summary.uncoveredStockLedgers || summary.duplicateLedgerAssignments) process.exitCode = 1;
