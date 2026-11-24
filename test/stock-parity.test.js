'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global;
require('../js/stock-identity');
require('../js/billing');
require('../Reconciliation master/stock-sync');
const row = (code, net = 5) => ({ ItemCode: code, UOM: 'NO', NetIssue: net, Consumption: 2, WIP: 1, Theft: 0, DebitRate: 10 });
const record = (name, order, net) => ({ contractorName: name, allWorkOrders: [order], docHeader: order,
    materials: { 100: { code: '100', uom: 'NO', grossIssue: net + 3, mrnReturn: 3, netIssue: net } } });
const application = (stock, directory, id, name) => {
    global.ContractorSapStock = stock;
    return { ...BillingModule, hasCustomStock: true, selectedContractorId: id, selectedContractorName: name,
        contractorsList: directory, recoRevision: 1, stockAsOnDate: '', getContractorOldReco: () => ({ materials: { OLD1: { netIssue: 2 }, OLD2: { netIssue: 1 } } }) };
};

test('Maa Bhawani departmental label updates the same master entry and both screens omit superseded historical issues', () => {
    const block = record('MAA BHAWANI CONSTRUCTION', '31006347', 10);
    const stock = { byContractorNorm: { maabhawaniconstruction: block }, byDocHeader: { 31006347: block } };
    const directory = [{ id: 'maa_bhawani_construction', name: 'Maa Bhawani Construction', workOrderNo: '31006347' }];
    const app = application(stock, directory, directory[0].id, directory[0].name);
    const materials = app.getReconciliationIssueStock().materials;
    assert.equal(materials[100].netIssue, 10);
    assert.equal(materials.OLD1, undefined); assert.equal(materials.OLD2, undefined);
    const master = MasterStockSync.apply({ Contractors: [{ ContractorName: 'Maa Bhawani Construction (Departmental)', Items: [row('100'), row('OLD1', 2), row('OLD2', 1)] }] }, stock, { directory });
    assert.equal(master.Contractors.length, 1, 'Never append a duplicate Maa Bhawani stock entry');
    assert.equal(master.Contractors[0].Items.reduce((sum, item) => sum + item.NetIssue, 0), 10);
    assert.equal(master.Contractors[0].Items[1].Consumption, 2);
    assert.equal(master.Contractors[0].Items[1].NetIssue, 0);
});

test('explicit work orders beat similar contractor aliases on both screens', () => {
    const first = record('Anjali Electricals Dayashankar', '31005169', 10);
    const second = record('Anjali Electricals', '31005172', 50);
    const stock = { byContractorNorm: { anjalielectrical: second, anjalielectricals: second, anjalielectricalsdayashankar: first } };
    const directory = [{ id: 'anjali_electrical', name: 'Anjali Electrical', workOrderNo: '31005169' }];
    const app = application(stock, directory, directory[0].id, directory[0].name);
    assert.equal(app.getReconciliationIssueStock().materials[100].netIssue, 10);
    const master = MasterStockSync.apply({ Contractors: [{ ContractorName: 'Anjali Electrical', Items: [row('100')] }] }, stock, { directory });
    assert.equal(master.Contractors[0].Items[0].NetIssue, 10);
    assert.equal(master.Contractors[1].Items[0].NetIssue, 50, 'Other work order remains separate');
});

test('missing stock cannot match another firm through a common word, a single-record fallback or an unrelated work order', () => {
    const block = record('MAA BHAWANI CONSTRUCTION', '31006347', 10);
    const stock = { byContractorNorm: { maabhawaniconstruction: block } };
    const directory = [{ id: 'bab_construction', name: 'Bab Construction', workOrderNo: '31005261' }];
    const app = application(stock, directory, directory[0].id, directory[0].name);
    assert.equal(app.getContractorSapIssues(), null);
    assert.equal(Object.keys(app.getReconciliationIssueStock().materials).length, 0);
    const master = MasterStockSync.apply({ Contractors: [{ ContractorName: 'Bab Construction', Items: [row('100')] }] }, stock, { directory });
    assert.equal(master.Contractors[0].Items[0].NetIssue, 0);
    assert.equal(master.Contractors[0].Items[0].Consumption, 2);
    assert.equal(master.Contractors[1].Items[0].NetIssue, 10);
});

test('explicit historical stock aliases restore renamed master entries without using fuzzy name guesses', () => {
    const block = record('MK. INFRA', '31005498', 10);
    const stock = { byContractorNorm: { mkinfra: block } };
    const base = { Contractors: [{ ContractorName: 'M K Infra Foundation', Items: [row('100')] }] };
    const referenceData = { Contractors: [{ ContractorName: 'M K Infra Foundation', IssueStockSource: { contractor: 'MK. INFRA' } }] };
    const master = MasterStockSync.apply(base, stock, { referenceData });
    assert.equal(master.Contractors.length, 1);
    assert.equal(master.Contractors[0].Items[0].NetIssue, 10);
    assert.deepEqual(master.Contractors[0].IssueStockSource.workOrders, ['31005498']);
});

test('issue fallback cache invalidates when a full uploaded snapshot becomes authoritative', () => {
    const block = record('Team', '31000001', 10);
    const app = { ...BillingModule, getContractorSapIssues: () => block, getContractorOldReco: () => ({ materials: { OLD: { netIssue: 3 } } }) };
    assert.equal(app.getReconciliationIssueStock().materials.OLD.netIssue, 3);
    app.hasCustomStock = true;
    assert.equal(app.getReconciliationIssueStock().materials.OLD, undefined);
});

test('a named CSV ledger without work orders still resolves to its exact contractor', () => {
    const block = record('Team B', '', 20);
    const other = record('Team A', '31000001', 10);
    const stock = { byContractorNorm: { teama: other, teamb: block } };
    const directory = [{ id: 'team_b', name: 'Team B', workOrderNo: '31000002' }];
    const app = application(stock, directory, 'team_b', 'Team B');
    assert.equal(app.getReconciliationIssueStock().materials[100].netIssue, 20);
});

test('published identity-only aliases resolve a legacy spelling without the private master snapshot', () => {
    const block = record('NITESH NAMDEV ABHARE', '31005981', 10);
    const stock = { byContractorNorm: { niteshnamdevabhare: block } };
    global.ReconciliationStockAliases = { Contractors: [{ ContractorName: 'NITESH ABHERE', IssueStockSource: { contractor: 'NITESH NAMDEV ABHARE' } }] };
    const app = application(stock, [], 'legacy_name', 'NITESH ABHERE');
    assert.equal(app.getReconciliationIssueStock().materials[100].netIssue, 10);
    delete global.ReconciliationStockAliases;
});

test('a configured contractor work order stays authoritative when upload adds a profile with a stock alias', () => {
    const first = record('MK. INFRA', '31005498', 10), second = record('MK. INFRA', '31007558', 50);
    const stock = { byContractorNorm: { mkinfra: first, second_order: second } };
    const directory = [{ id: 'm_k_infra_foundation', name: 'M K Infra Foundation', workOrderNo: '31005498' },
        { id: 'mkinfra', name: 'MK. INFRA', workOrderNo: '31007558' }];
    const referenceData = { Contractors: [{ ContractorName: 'M K Infra Foundation', IssueStockSource: { contractor: 'MK. INFRA' } }] };
    const master = MasterStockSync.apply({ Contractors: [{ ContractorName: 'M K Infra Foundation', Items: [row('100')] }] }, stock, { directory, referenceData });
    assert.equal(master.Contractors[0].Items[0].NetIssue, 10);
});
