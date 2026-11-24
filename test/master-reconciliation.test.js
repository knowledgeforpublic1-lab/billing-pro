const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup(fetchImpl) {
    const storage = new Map();
    const nodes = {};
    const context = { console, Blob, Intl, setTimeout() {},
        document: { querySelector: () => ({ addEventListener() {} }), addEventListener() {}, getElementById: id => nodes[id] || { value: '' } },
        window: { addEventListener() {}, BillingStorage:{setItem:async()=>({saved:true}),getItemAsync:async()=>null} }, fetch: fetchImpl,
        localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
        alert(message) { throw new Error(message); } };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync('Reconciliation master/analytics.js', 'utf8'), context);
    context.MasterAnalytics = context.window.MasterAnalytics;
    vm.runInContext(fs.readFileSync('js/stock-identity.js', 'utf8'), context);
    vm.runInContext(fs.readFileSync('Reconciliation master/stock-sync.js', 'utf8'), context);
    vm.runInContext(fs.readFileSync('Reconciliation master/app.js', 'utf8'), context);
    return { context, storage, nodes, run: code => vm.runInContext(code, context) };
}
const row = { ItemCode: '123', ItemDescription: 'Cable', UOM: 'M', DebitRate: 10, NetIssue: 10, Consumption: 2, WIP: 1, Theft: 0, BalanceQty: 7, BalanceCost: 70 };

test('a formula-valid complete statement replaces only a proven invalid duplicate, preserving history and saved entry selections', async () => {
    const { context, run } = setup();
    const metadata = { FirmName: 'Anjali Electrical', OwnerName: 'Example Owner', WONo: '8' };
    const invalid = { ContractorName: 'Anjali Electrical', Metadata: metadata, Items: [{ ...row, NetIssue: 5, Consumption: 5, WIP: -2, BalanceQty: 0 }] };
    const valid = { ContractorName: 'Anjali Electrical', Metadata: metadata, Items: [
        { ...row, NetIssue: 5, Consumption: 7, WIP: 0, BalanceQty: -2 },
        { ...row, ItemCode: '124', NetIssue: 3, Consumption: 1, WIP: 0, BalanceQty: 2 }
    ] };
    const data = { Contractors: [invalid, { ContractorName: 'Other', Items: [{ ...row }] }, valid] };
    const stock = { byContractorNorm: { anjalielectrical: { contractorName: 'Anjali Electrical', materials: { 123: { uom: 'M', netIssue: 10 }, 124: { uom: 'M', netIssue: 4 } } } } };
    const before = JSON.stringify(data);
    const result = context.window.MasterStockSync.apply(data, stock);
    assert.equal(result.Contractors.length, 2);
    const current = result.Contractors.find(c => c.ContractorName === 'Anjali Electrical');
    assert.equal(current.Items[0].Consumption, 7);
    assert.equal(current.Items[0].NetIssue, 10);
    assert.equal(current.StockSyncPrimaryEntryIndex, 2);
    assert.equal(result.StockSyncWarnings.length, 0);
    assert.equal(result.StockSyncArchivedEntries.length, 1);
    assert.equal(JSON.stringify(result.StockSyncArchivedEntries[0].contractor.Items), JSON.stringify(invalid.Items));
    assert.equal(JSON.stringify(data), before);
    context.dataset = result; run('rawData = dataset');
    assert.equal(run('selectedContractorEntry("entry:0").ContractorName'), 'Anjali Electrical');
    assert.equal(run('selectedContractorEntry("entry:2").ContractorName'), 'Anjali Electrical');
    assert.equal(run('selectedContractorEntry("entry:1").ContractorName'), 'Other');
    const repeated = context.window.MasterStockSync.apply(result, stock);
    assert.equal(repeated.StockSyncArchivedEntries.length, 1);
    assert.equal(repeated.Contractors.length, 2);
    let exported;
    context.downloadFile = (blob, filename) => { exported = { blob, filename }; };
    context.exportReconciliationHistory();
    assert.equal(exported.filename, 'Reconciliation_Corrections_History.json');
    assert.equal(JSON.parse(await exported.blob.text()).archivedEntries[0].contractor.Items[0].WIP, -2);
});

test('a wrong unit label is corrected only when uploaded stock and matching debit-rate master confirm the same unit', () => {
    const { context } = setup();
    const data = { DebitRates: [{ ItemCode: '123', Unit: 'L', DebitRate: 10 }], Contractors: [{ ContractorName: 'Team', Items: [{ ...row, UOM: 'SET', Theft: 1 }] }] };
    const stock = { byContractorNorm: { team: { contractorName: 'Team', materials: { 123: { uom: 'L', grossIssue: 20, mrnReturn: 2, netIssue: 18 } } } } };
    const result = context.window.MasterStockSync.apply(data, stock);
    const corrected = result.Contractors[0].Items[0];
    assert.equal(corrected.UOM, 'L');
    assert.equal(corrected.Consumption, 2); assert.equal(corrected.WIP, 1); assert.equal(corrected.Theft, 1);
    assert.equal(corrected.DebitRate, 10); assert.equal(corrected.NetIssue, 18);
    assert.equal(corrected.BalanceQty, 14); assert.equal(corrected.BalanceCost, 140);
    assert.equal(corrected.StockUnitCorrection.from, 'SET');
    assert.equal(result.StockSyncCorrections.length, 1); assert.equal(result.StockSyncWarnings.length, 0);
    assert.equal(data.Contractors[0].Items[0].UOM, 'SET');
    data.DebitRates[0].Unit = 'KG';
    const unconfirmed = context.window.MasterStockSync.apply(data, stock);
    assert.equal(unconfirmed.Contractors[0].Items[0].UOM, 'SET');
    assert.equal(unconfirmed.StockSyncWarnings.length, 1);
    data.DebitRates[0].Unit = 'L'; data.DebitRates[0].DebitRate = 999;
    assert.equal(context.window.MasterStockSync.apply(data, stock).StockSyncWarnings.length, 1);
});

test('two valid conflicting statements are not treated as an invalid duplicate', () => {
    const { context } = setup();
    const metadata = { OwnerName: 'Example Owner', WONo: '8' };
    const data = { Contractors: [{ ContractorName: 'Team', Metadata: metadata, Items: [{ ...row }] },
        { ContractorName: 'Team', Metadata: metadata, Items: [{ ...row, NetIssue: 20, BalanceQty: 17 }] }] };
    const stock = { byContractorNorm: { team: { contractorName: 'Team', materials: { 123: { uom: 'M', netIssue: 30 } } } } };
    const result = context.window.MasterStockSync.apply(data, stock);
    assert.equal(result.Contractors.length, 2); assert.equal(result.StockSyncArchivedEntries.length, 0);
    assert.equal(result.StockSyncWarnings.length, 2);
    data.Contractors[1].Items = [{ ...row, UOM: 'KG', NetIssue: 5, Consumption: 5, WIP: -2, BalanceQty: 0 }];
    const differentUnits = context.window.MasterStockSync.apply(data, stock);
    assert.equal(differentUnits.Contractors.length, 2);
    assert.equal(differentUnits.StockSyncArchivedEntries.length, 0, 'Different physical units are not evidence of a duplicate snapshot');
});

test('uploaded stock updates Master Reconciliation issues, new materials and balances without changing consumption or source data', () => {
    const { context } = setup();
    const apply = context.window.MasterStockSync.apply;
    const data = { Contractors: [{ ContractorName: 'A', Metadata: { OwnerName: 'Owner' }, Items: [{ ...row, NetIssue: 5, Theft: 1 }] }],
        DebitRates: [{ ItemCode: '456', Unit: 'NO', DebitRate: 20 }] };
    const block = { contractorName: 'A', materials: { 123: { uom: 'M', grossIssue: 12, mrnReturn: 2, netIssue: 10 }, 456: { uom: 'NO', netIssue: 3 } } };
    const stock = { meta: { uploadedAt: '2026-11-24T06:00:00Z' }, byContractorNorm: { a: block, alias_a: JSON.parse(JSON.stringify(block)) } };
    const before = JSON.stringify(data), stockBefore = JSON.stringify(stock);
    const updated = apply(data, stock);
    const item = updated.Contractors[0].Items[0];
    assert.equal(item.NetIssue, 10, 'Alias ledger is counted once and replaces the previous 5');
    assert.equal(item.IssuedQty, 12); assert.equal(item.MRNQty, 2);
    assert.equal(item.Consumption, 2); assert.equal(item.WIP, 1); assert.equal(item.Theft, 1);
    assert.equal(item.BalanceQty, 6); assert.equal(item.BalanceCost, 60);
    assert.equal(updated.Contractors[0].Metadata.OwnerName, 'Owner');
    assert.equal(updated.Contractors[0].Items[1].NetIssue, 3);
    assert.equal(updated.Contractors[0].Items[1].DebitRate, 20);
    assert.equal(JSON.stringify(data), before); assert.equal(JSON.stringify(stock), stockBefore);
    block.materials = { 456: { uom: 'NO', netIssue: 7 } };
    stock.byContractorNorm = { a: block, new_team: { contractorName: 'New Team', materials: { 456: { uom: 'NO', netIssue: 2 } } } };
    const replaced = apply(updated, stock);
    assert.equal(replaced.Contractors[0].Items[0].NetIssue, 0);
    assert.equal(replaced.Contractors[0].Items[0].Consumption, 2);
    assert.equal(replaced.Contractors[0].Items[1].NetIssue, 7);
    assert.equal(replaced.Contractors[1].ContractorName, 'New Team');
    assert.equal(replaced.Contractors[1].Items[0].NetIssue, 2);
});

test('Master stock mapping respects work orders, converts compatible units and flags ambiguous duplicate entries', () => {
    const { context } = setup();
    const data = { Contractors: [
        { ContractorName: 'A', Metadata: { WONo: '31000001' }, Items: [{ ...row }] },
        { ContractorName: 'A', Metadata: { WONo: '31000002' }, Items: [{ ...row }] },
        { ContractorName: 'Twin', Items: [{ ...row }] }, { ContractorName: 'Twin', Items: [{ ...row }] }
    ] };
    const stock = { byContractorNorm: {
        first: { contractorName: 'A', allWorkOrders: ['31000001'], materials: { 123: { uom: 'KM', netIssue: 0.01 } } },
        second: { contractorName: 'A', allWorkOrders: ['31000002'], materials: { 123: { uom: 'M', netIssue: 20 } } },
        twin: { contractorName: 'Twin', materials: { 123: { uom: 'M', netIssue: 99 } } }
    } };
    const updated = context.window.MasterStockSync.apply(data, stock);
    assert.deepEqual(Array.from(updated.Contractors, c => c.Items[0].NetIssue), [10, 20, 10, 10]);
    assert.equal(updated.StockSyncWarnings.length, 2);
    assert.equal(updated.Contractors.length, 4, 'Ambiguous stock is not assigned again as a new contractor');
});

test('Master dashboard refresh reads uploaded stock without cloud writes or replacing a pending reconciliation import', async () => {
    let requests = 0, net = 5;
    const { context, run } = setup(async (url, options) => {
        requests++;
        assert.equal(url, '/api/storage/business?key=stockMaster');
        assert.equal(options.method, undefined);
        return { ok: true, json: async () => ({ success: true, data: { byContractorNorm: { a: { contractorName: 'A', materials: { 123: { uom: 'M', netIssue: net } } } } } }) };
    });
    context.dataset = { Contractors: [{ ContractorName: 'A', Items: [{ ...row }] }] };
    run('rawData = dataset');
    await context.refreshMasterStock(false);
    assert.equal(run('rawData.Contractors[0].Items[0].NetIssue'), 5);
    net = 10;
    await context.refreshMasterStock(false);
    assert.equal(run('rawData.Contractors[0].Items[0].NetIssue'), 10);
    assert.equal(run('rawData.Contractors[0].Items[0].Consumption'), 2);
    run('reconLocalPending = true');
    await context.refreshMasterStock(false);
    assert.equal(requests, 2);
});
test('duplicate contractor selection and CSV export preserve entry identity and all pages', async () => {
    const { context, nodes, run } = setup();
    context.dataset = { Contractors: [ { ContractorName: 'A', Items: Array.from({length: 61}, () => ({...row})) }, { ContractorName: 'A', Items: [{...row, ItemCode: 'OTHER'}] } ] };
    run('rawData = dataset; currentTab = "contractor"');
    nodes.contractorSelect = { value: 'entry:0' };
    assert.equal(run('selectedContractorEntry("A")'), null);
    assert.equal(run('selectedContractorEntry("entry:1").Items[0].ItemCode'), 'OTHER');
    let output;
    context.downloadFile = (blob, filename) => { output = {blob, filename}; };
    await context.exportActiveViewCSV();
    const text = await output.blob.text();
    assert.equal(text.trim().split('\r\n').length, 62);
    assert(!text.includes('OTHER'));
    assert(text.includes('WIP'));
    assert(text.includes('Theft'));
    assert.equal(output.filename, 'Contractor_Material_Reconciliation.csv');
});
test('cloud failures reject and retain pending backup; success sends and advances revision', async () => {
    const requests = [];
    let fail = true;
    const { context, storage, run } = setup(async (url, init) => {
        requests.push({url, body: JSON.parse(init.body)});
        return { ok: !fail, status: fail ? 409 : 200, json: async () => fail ? {error:'Conflict'} : {success:true, rev:4} };
    });
    storage.set('materialAppPending', '1');
    run('reconRevision = 3');
    await assert.rejects(context.saveReconCloud('{}'), /Conflict/);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, '/api/reconciliation');
    assert.equal(storage.get('materialAppPending'), '1');
    fail = false;
    await context.saveReconCloud('{}');
    assert.equal(requests[1].body.expectedRev, 3);
    assert.equal(run('reconRevision'), 4);
    assert(!storage.has('materialAppPending'));
});
test('quantities remain grouped by canonical unit; liability excludes deficits', () => {
    const { context, run } = setup();
    context.rows = [{uom:'NO.', netIssue:2},{uom:' NOS ', netIssue:3},{uom:'KM',netIssue:1}];
    assert.equal(run('quantitySummary(rows,"netIssue")'), '5 NO · 1 KM');
    assert.equal(context.positiveBalanceCost({...row, BalanceQty:-4}), 0);
    assert.equal(context.positiveBalanceCost(row),70);
    assert.equal(context.materialKey({...row,UOM:'Mtr'}),context.materialKey(row));
    assert.notEqual(context.materialKey({...row,UOM:'KM'}),context.materialKey(row));
});
test('CSV values guard formula injection', () => {
    const { context } = setup();
    assert.equal(context.sanitizeCsvValue('=SUM(1,2)'), '"\'=SUM(1,2)"');
});
test('KPI animations cannot briefly show negative positive-stock values or overwrite a newer selection', () => {
    const { context, nodes } = setup(); const frames = [];
    nodes.metric = { textContent: '0' }; context.performance = { now: () => 1000 };
    context.requestAnimationFrame = callback => frames.push(callback);
    context.animateKpiValue('metric', 1000, String);
    const oldFrame = frames.shift(); oldFrame(990);
    assert.equal(nodes.metric.textContent, '0', 'first frame may precede performance.now() slightly');
    context.animateKpiValue('metric', 50, String);
    const newFrame = frames.pop(); newFrame(1900);
    assert.equal(nodes.metric.textContent, '50'); oldFrame(1900);
    assert.equal(nodes.metric.textContent, '50', 'obsolete animation cannot write the old item total');
});

test('reconciliation API rejects stale revision and passes expected revision to atomic storage', async () => {
    let handler;
    const saves = [];
    const db = { getReconciliationState: async () => ({rev:2,stateData:{Contractors:[]}}), saveReconciliationState: async (...args) => saves.push(args), getProvider: () => 'test', getErrorHint: error => error.message };
    const source = fs.readFileSync('api/index.js','utf8');
    const route = source.slice(source.indexOf("app.post('/api/reconciliation'"),source.indexOf('// ============ Google Drive Upload Proxy'));
    vm.runInNewContext(route, { Buffer, app:{post(...args){handler=args.at(-1);}}, requireApiKey(){}, writeLimiter(){}, db, log:{warn(){}, info(){}, error(){}} });
    const invoke = async expectedRev => {
        const response = { statusCode:200,status(code){this.statusCode=code;return this;},json(value){this.value=value;return this;} };
        await handler({body:{data:{Contractors:[{ContractorName:'A',Items:[row]}]},expectedRev}},response);
        return response;
    };
    assert.equal((await invoke(1)).statusCode,409);
    assert.equal((await invoke(undefined)).statusCode,409);
    assert.equal(saves.length,0);
    assert.equal((await invoke(2)).value.rev,3);
    assert.equal(saves[0][2],2);
    db.saveReconciliationState=async()=>{const error=new Error('race');error.status=409;throw error;};
    assert.equal((await invoke(2)).statusCode,409);
});

test('Mongo reconciliation compare-and-set rejects a racing writer', async () => {
    const source=fs.readFileSync('api/db.js','utf8');
    const start=source.indexOf('async function saveReconciliationState(');
    const end=source.indexOf('// ==========================================',start);
    let revision=2;
    const context={connect:async()=>{},activeProvider:'mongodb',Date,MongoReconciliationState:{async findOneAndUpdate(filter, value){
        if(filter.rev!==revision)return null;
        revision=value.rev;
        return {rev:revision};
    }}};
    vm.runInNewContext(source.slice(start,end),context);
    const results=await Promise.allSettled([context.saveReconciliationState({},3,2),context.saveReconciliationState({},3,2)]);
    assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
    assert.equal(results.find(result=>result.status==='rejected').reason.status,409);
});

test('Firestore commits revision and chunk pointer in one transaction', async () => {
    const source=fs.readFileSync('api/db.js','utf8');
    const start=source.indexOf('async function writeFirestoreWithChunking(');
    const end=source.indexOf('async function readFirestoreWithChunking',start);
    for(const threshold of [700000,20]){
        let revision=2, writes=0, committed;
        const docRef={path:'test',parent:{id:'reconciliation_states'}, id:'main-reconciliation-state',collection(){return {doc(){return {set:async()=>{}};}};}};
        const context={Buffer,Date,Math,JSON,assertLegacyStorage:async()=>{},FIRESTORE_MAX_DOC_BYTES:threshold,log:{info(){}},firestoreDb:{collection(){return{doc(){return {};}};},async runTransaction(fn){
            return fn({get:async()=>({exists:true,data:()=>({rev:revision})}),set(ref,value){writes++;revision=value.rev;committed=value;}});
        }}};
        vm.runInNewContext(source.slice(start,end),context);
        await context.writeFirestoreWithChunking(docRef,{rev:3,stateData:{text:'data'}},2);
        assert.equal(writes,1);
        assert.equal(committed.rev,3);
        assert.equal(committed._isChunked,threshold===20);
        await assert.rejects(context.writeFirestoreWithChunking(docRef,{rev:3,stateData:{}},2),error=>error.status===409);
        assert.equal(writes,1);
    }
});

test('item finder retains repeated rows and separates materials by unit', () => {
    const { context, run } = setup();
    context.dataset={Contractors:[{ContractorName:'A',Items:[row,{...row,UOM:'Mtr'}, {...row,UOM:'KM',BalanceQty:1,BalanceCost:10}]}]};
    run('rawData=dataset');
    const metres=context.getItemBalanceData('123|M');
    assert.equal(metres.totalBal,14);
    assert.equal(metres.totalBalCost,140);
    assert.equal(metres.contractors.length,2);
    assert.equal(context.getItemBalanceData('123|KM').totalBal,1);
});
test('item holding-stock KPIs do not cancel one contractor positive stock against another deficit', () => {
    const { context, run } = setup();
    context.dataset = { Contractors: [
        { ContractorName: 'Holding', Items: [{ ...row, BalanceQty: 12, BalanceCost: 120 }] },
        { ContractorName: 'Deficit', Items: [{ ...row, BalanceQty: -5, BalanceCost: -50 }] }
    ] };
    const before = JSON.stringify(context.dataset); run('rawData=dataset');
    const data = context.getItemBalanceData('123|M');
    assert.equal(data.totalBal, 7, 'signed source balance remains available');
    assert.equal(data.positiveBal, 12); assert.equal(data.positiveBalCost, 120); assert.equal(data.deficitQty, 5);
    assert.equal(data.contractors.filter(row => row.balanceQty > 0).reduce((sum, row) => sum + row.balanceQty, 0), data.positiveBal);
    assert.equal(data.contractors.filter(row => row.balanceQty > 0).reduce((sum, row) => sum + row.balanceCost, 0), data.positiveBalCost);
    assert.equal(JSON.stringify(context.dataset), before, 'source data is unchanged');
});

test('data checks export exposes actual source differences without changing the snapshot', async () => {
    const { context, run, nodes } = setup();
    const dataset=JSON.parse(fs.readFileSync('Reconciliation master/data.json','utf8'));
    const before=JSON.stringify(dataset);
    context.dataset=dataset;
    nodes.reconciliationStatus={textContent:''};
    run('rawData=dataset');
    context.updateDataQuality();
    assert.match(nodes.reconciliationStatus.textContent,/2026-11-11/);
    assert.match(nodes.reconciliationStatus.textContent,/2026-09-02/);
    assert.match(nodes.reconciliationStatus.textContent,/11 balance formula differences/);
    let output;
    context.downloadFile=blob=>{output=blob;};
    context.exportDataChecks();
    const csv=await output.text();
    assert.match(csv,/Missing rate/);
    assert.match(csv,/Balance formula difference/);
    assert.match(csv,/Negative balance/);
    assert.equal(JSON.stringify(dataset),before);
});

test('all contractor basic details remain visible when selecting, searching and switching contractors', () => {
    const { context, nodes, run } = setup();
    const panel = { style:{}, innerHTML:'' };
    const table = {innerHTML:'',appendChild(){}};
    nodes.contractorSelect={value:'entry:0'};
    nodes.contractorSearch={value:''};
    nodes.contractorInfoPanel=panel;
    nodes.cViewCount={}; nodes.cViewBalCost={};
    context.document.querySelector=()=>table;
    context.document.createElement=()=>({innerHTML:''});
    context.updatePaginationUI=()=>{};
    context.dataset={Contractors:[{ContractorName:'A',Metadata:{OwnerName:'Owner A',GST:'GST-A',Address:'Full office address'},Items:[row]},{ContractorName:'B',Metadata:{OwnerName:'Owner B',GST:'GST-B'},Items:[row]}]};
    run('rawData=dataset');
    context.renderContractorView();
    for (const text of ['General Details','Compliance & Registration','Contract Value & Billing','Liability & Risk Alerts','Owner A','GST-A','Full office address']) assert(panel.innerHTML.includes(text));
    assert(!panel.innerHTML.includes('<details'));
    assert.equal(nodes.cViewCount.textContent,1);
    nodes.contractorSearch.value='Cable';
    context.renderContractorView();
    assert(panel.innerHTML.includes('Owner A'));
    nodes.contractorSelect.value='entry:1';
    context.renderContractorView();
    assert(panel.innerHTML.includes('Owner B'));
    assert(panel.innerHTML.includes('GST-B'));
    assert(!panel.innerHTML.includes('Owner A'));
    assert.equal(panel.style.display,'block');
});

test('contractor name toggles details on successive clicks and remembers the choice per entry', () => {
    const { context, nodes, run } = setup();
    const attributes = {'aria-expanded':'true'};
    const content = {setAttribute(key,value){this[key]=value;},inert:false};
    const profile = {dataset:{entry:'entry:0'},classList:{toggle(name,enabled){this[name]=enabled;}},querySelector:()=>content};
    const button = {closest:()=>profile,getAttribute:key=>attributes[key],setAttribute:(key,value)=>attributes[key]=value};
    context.toggleContractorProfile(button);
    assert.equal(attributes['aria-expanded'],'false');
    assert.equal(content['aria-hidden'],'true');
    assert.equal(content.inert,true);
    assert.equal(profile.classList['profile-is-collapsed'],true);
    assert.equal(button.title,'Show contractor details');
    const panel={style:{},innerHTML:''};
    nodes.contractorSelect={value:'entry:0'}; nodes.contractorSearch={value:'Cable'};
    nodes.contractorInfoPanel=panel; nodes.cViewCount={}; nodes.cViewBalCost={};
    context.document.querySelector=()=>({innerHTML:'',appendChild(){}});
    context.document.createElement=()=>({innerHTML:''});
    context.updatePaginationUI=()=>{};
    context.dataset={Contractors:[{ContractorName:'A',Metadata:{},Items:[row]},{ContractorName:'B',Metadata:{},Items:[row]}]};
    run('rawData=dataset');
    context.renderContractorView();
    assert.match(panel.innerHTML,/contractor-profile profile-is-collapsed/);
    nodes.contractorSelect.value='entry:1';
    context.renderContractorView();
    assert(!panel.innerHTML.includes('profile-is-collapsed'));
    context.toggleContractorProfile(button);
    assert.equal(attributes['aria-expanded'],'true');
    assert.equal(content['aria-hidden'],'false');
    assert.equal(content.inert,false);
    assert.equal(profile.classList['profile-is-collapsed'],false);
    nodes.contractorSelect.value='entry:0';
    context.renderContractorView();
    assert(!panel.innerHTML.includes('profile-is-collapsed'));
    assert.match(panel.innerHTML,/aria-expanded="true"/);
});

function attachIndexedStorage(context, records = new Map()) {
    const state = { failWrites:false, localWrites:0 };
    context.localStorage.setItem=()=>{state.localWrites++;throw new Error('QuotaExceededError');};
    context.window.indexedDB={open(){
        const request={};
        queueMicrotask(()=>request.onsuccess({target:{result:{transaction(){
            const transaction={objectStore(){return {
                put(value,key){queueMicrotask(()=>{
                    if(state.failWrites) {transaction.error=new Error('Disk full');transaction.onabort();}
                    else {records.set(key,JSON.parse(JSON.stringify(value)));transaction.oncomplete();}
                });},
                get(key){const read={};queueMicrotask(()=>{read.result=records.get(key);read.onsuccess();});return read;}
            };}};
            return transaction;
        }}}}));
        return request;
    }};
    vm.runInContext(fs.readFileSync('js/core/storage.js','utf8'),context);
    return {records,state};
}

test('large reconciliation backup survives full localStorage and reload with atomic pending status', async () => {
    const {context,run,storage}=setup();
    const {records,state}=attachIndexedStorage(context);
    storage.set('unrelated-bill','keep');
    storage.set('materialAppData','old');
    storage.set('materialAppPending','1');
    const dataset={Contractors:[{ContractorName:'A',Items:[row]}],largePayload:'x'.repeat(3000000)};
    await context.persistReconLocal(dataset,true);
    assert.equal(state.localWrites,0,'Large snapshot must never be sent to localStorage');
    assert.equal(records.get('billing_master_reconciliation').pending,true);
    assert.equal(storage.get('unrelated-bill'),'keep');
    assert(!storage.has('materialAppData'));
    run('reconLocalPending=false');
    const loaded=await context.loadReconLocal();
    assert.equal(loaded.largePayload.length,3000000);
    assert.equal(run('reconLocalPending'),true);
    assert.equal(loaded.Contractors[0].Items[0].BalanceQty,7);
    state.failWrites=true;
    await assert.rejects(context.persistReconLocal({Contractors:[]},false),/could not be saved/);
    assert.equal(records.get('billing_master_reconciliation').data.largePayload.length,3000000);
    assert.equal(records.get('billing_master_reconciliation').pending,true);
    assert.equal(run('reconLocalPending'),true);
});

test('legacy reconciliation backup migrates only after IndexedDB commit; failed migration preserves the original', async () => {
    const {context,storage,run}=setup();
    const {records,state}=attachIndexedStorage(context);
    const legacy=JSON.stringify({Contractors:[{ContractorName:'Legacy',Items:[row]}]});
    storage.set('materialAppData',legacy);storage.set('materialAppPending','1');
    state.failWrites=true;
    assert.equal((await context.loadReconLocal()).Contractors[0].ContractorName,'Legacy');
    assert.equal(storage.get('materialAppData'),legacy);
    assert.equal(storage.get('materialAppPending'),'1');
    assert.equal(run('reconLocalPending'),true);
    state.failWrites=false;
    await context.loadReconLocal();
    assert.equal(records.get('billing_master_reconciliation').pending,true);
    assert(!storage.has('materialAppData'));
    assert(!storage.has('materialAppPending'));
});

test('cloud rejection retains IndexedDB pending copy and success acknowledges that same snapshot', async () => {
    let fail=true;
    const {context,run}=setup(async()=>({ok:!fail,status:fail?409:200,json:async()=>fail?{error:'Conflict'}:{success:true,rev:4}}));
    const {records}=attachIndexedStorage(context);
    const dataset={Contractors:[{ContractorName:'A',Items:[row]}]};
    await context.persistReconLocal(dataset,true);
    run('reconRevision=3');
    await assert.rejects(context.saveReconCloud(JSON.stringify(dataset)),/Conflict/);
    assert.equal(records.get('billing_master_reconciliation').pending,true);
    fail=false;
    await context.saveReconCloud(JSON.stringify(dataset));
    assert.equal(records.get('billing_master_reconciliation').pending,false);
    assert.deepEqual(records.get('billing_master_reconciliation').data,dataset);
    assert.equal(run('reconLocalPending'),false);
});

test('Excel upload reaches cloud after an IndexedDB backup even when localStorage quota is exhausted', async () => {
    let requests=0, scheduled;
    const {context,nodes,run}=setup(async()=>{requests++;return {ok:true,json:async()=>({success:true,rev:2})};});
    const {records,state}=attachIndexedStorage(context);
    const sheet=[['Item Code','Item Description','UOM','Issued Qty','MRN Qty','Net Issue','Consumption','WIP','Theft','Balance Qty'],['12345678','Test material','NO',10,0,10,2,1,0,7]];
    context.XLSX={read:()=>({SheetNames:['Test Contractor'],Sheets:{'Test Contractor':sheet}}),utils:{sheet_to_json:value=>value}};
    context.FileReader=class{readAsArrayBuffer(){this.onload({target:{result:new ArrayBuffer(0)}});}};
    context.setTimeout=fn=>{scheduled=fn;};
    context.populateDropdowns=()=>{};context.renderOverview=()=>{};
    nodes.uploadExcelBtn={style:{},disabled:false};
    run('reconRevision=1');
    context.handleExcelUpload({target:{files:[{}],value:'test.xlsx'}});
    await scheduled();
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(requests,1);
    assert.equal(state.localWrites,0);
    const saved=records.get('billing_master_reconciliation');
    assert.equal(saved.data.Contractors[0].ContractorName,'Test Contractor');
    assert.equal(saved.data.Contractors[0].Items[0].BalanceQty,7);
    assert.equal(saved.pending,false);
});
