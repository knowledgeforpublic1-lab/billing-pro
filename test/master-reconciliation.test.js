const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup(fetchImpl) {
    const storage = new Map();
    const nodes = {};
    const context = { console, Blob, Intl, setTimeout() {},
        document: { querySelector: () => ({ addEventListener() {} }), addEventListener() {}, getElementById: id => nodes[id] || { value: '' } },
        window: { addEventListener() {} }, fetch: fetchImpl,
        localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
        alert(message) { throw new Error(message); } };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync('Reconciliation master/analytics.js', 'utf8'), context);
    context.MasterAnalytics = context.window.MasterAnalytics;
    vm.runInContext(fs.readFileSync('Reconciliation master/app.js', 'utf8'), context);
    return { context, storage, nodes, run: code => vm.runInContext(code, context) };
}
const row = { ItemCode: '123', ItemDescription: 'Cable', UOM: 'M', DebitRate: 10, NetIssue: 10, Consumption: 2, WIP: 1, Theft: 0, BalanceQty: 7, BalanceCost: 70 };
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

test('reconciliation API rejects stale revision and passes expected revision to atomic storage', async () => {
    let handler;
    const saves = [];
    const db = { getReconciliationState: async () => ({rev:2,stateData:{Contractors:[]}}), saveReconciliationState: async (...args) => saves.push(args), getProvider: () => 'test', getErrorHint: error => error.message };
    const source = fs.readFileSync('api/index.js','utf8');
    const route = source.slice(source.indexOf("app.post('/api/reconciliation'"),source.indexOf('// ============ Google Drive Upload Proxy'));
    vm.runInNewContext(route, { app:{post(...args){handler=args.at(-1);}}, requireApiKey(){}, writeLimiter(){}, db, log:{warn(){}, info(){}, error(){}} });
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
        const docRef={path:'test',collection(){return {doc(){return {set:async()=>{}};}};}};
        const context={Buffer,Date,Math,JSON,FIRESTORE_MAX_DOC_BYTES:threshold,log:{info(){}},firestoreDb:{async runTransaction(fn){
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

test('contractor profile starts collapsed, keeps explicit expansion while searching, and resets for another contractor', () => {
    const { context, nodes, run } = setup();
    let open = false;
    const panel = { dataset:{}, style:{}, innerHTML:'', querySelector:()=>({open}) };
    const table = {innerHTML:'',appendChild(){}};
    nodes.contractorSelect={value:'entry:0'};
    nodes.contractorSearch={value:''};
    nodes.contractorInfoPanel=panel;
    nodes.cViewCount={}; nodes.cViewBalCost={};
    context.document.querySelector=()=>table;
    context.document.createElement=()=>({innerHTML:''});
    context.updatePaginationUI=()=>{};
    context.dataset={Contractors:[{ContractorName:'A',Metadata:{},Items:[row]},{ContractorName:'B',Metadata:{},Items:[row]}]};
    run('rawData=dataset');
    context.renderContractorView();
    assert.match(panel.innerHTML,/<details class="contractor-profile" >/);
    assert.match(panel.innerHTML,/<summary class="info-card-header"/);
    assert.match(panel.innerHTML,/contractor-profile-body/);
    assert.equal(nodes.cViewCount.textContent,1);
    open=true;
    nodes.contractorSearch.value='Cable';
    context.renderContractorView();
    assert.match(panel.innerHTML,/<details class="contractor-profile" open>/);
    nodes.contractorSelect.value='entry:1';
    context.renderContractorView();
    assert.match(panel.innerHTML,/<details class="contractor-profile" >/);
    assert.equal(panel.dataset.entry,'entry:1');
});
