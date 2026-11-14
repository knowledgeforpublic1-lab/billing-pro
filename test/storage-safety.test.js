const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const quiet = { log() {}, info() {}, warn() {}, error() {} };
function engine(cacheOk, dbOk) {
    const context = { console: quiet, localStorage: { setItem() { if (!cacheOk) throw Error('Quota'); } }, window: { indexedDB: { open() {
        const request = {};
        queueMicrotask(() => request.onsuccess({ target: { result: { transaction() {
            const tx = { objectStore() { return { put() { queueMicrotask(() => dbOk ? tx.oncomplete() : tx.onabort()); } }; } };
            return tx;
        } } } }));
        return request;
    } } } };
    vm.runInNewContext(fs.readFileSync('js/core/storage.js','utf8'), context);
    return context.window.BillingStorage;
}
async function main() {
    for (const [cache,db] of [[true,true],[true,false],[false,true],[false,false]]) {
        const result = await engine(cache,db).setItem('bill','snapshot');
        assert.equal(result.saved, cache || db);
        assert.equal(result.localStorage,cache);
        assert.equal(result.indexedDB,db);
    }
    let status = 409, requests = 0, retries = 0;
    const context = { window: {}, console: quiet, clearTimeout() {}, localStorage: { setItem() {}, getItem() { return null; } }, fetch: async () => { requests++; return { status, ok: status === 200, json: async () => ({success:true,rev:99}) }; } };
    vm.runInNewContext(fs.readFileSync('js/sync.js','utf8'),context);
    const methods = context.window.SyncModule;
    const app = Object.assign({},methods,{ cloudRev:1,lastSentHash:'old',buildSyncPayload(){return {qty:23,baseRev:this.cloudRev};},showToast(){},setSyncedHash(){},_scheduleSyncRetry(){retries++;} });
    assert.equal(await app.syncToCloudNow(),false);
    assert.equal(app.cloudConflict,true);
    assert.equal(app.cloudRev,1,'Conflict must not adopt the newer cloud revision for retry');
    assert.equal(retries,0);
    assert.equal(await app.syncToCloudNow({force:true}),false);
    assert.equal(requests,1,'Neither automatic nor force saves bypass conflict protection');
    app.cloudConflict=false;status=423;
    assert.equal(await app.syncToCloudNow(),false);
    assert.equal(app.lastSentHash,'old','Rejected locked write cannot advance last saved hash');
    status=200;
    assert.equal(await app.syncToCloudNow(),true);
    assert.equal(requests,3,'Unlocking retries the previously rejected payload');
    assert.equal(app.syncStatus,'synced');
    let warning='';
    const local = Object.assign({},methods,{showToast(message){warning=message;},takeSnapshot(){},scheduleRemoteSync(){} });
    context.window.BillingStorage={setItem:async()=>({saved:false})};
    local.saveToStorage();await local._localSavePromise;
    assert.equal(local.localSaveFailed,true);
    assert.match(warning,/Local save FAIL/);
    context.window.BillingStorage={setItem:async()=>({saved:true})};
    local.saveToStorage();await local._localSavePromise;
    assert.equal(local.localSaveFailed,false,'A confirmed later local save clears the failure warning');
    context.window.BillingStorage={setItem:async()=>{throw Error('Disk failed');}};
    local.saveToStorage();await local._localSavePromise;
    assert.equal(local.localSaveFailed,true,'Rejected storage promise is handled and surfaced');
    app.cloudConflict = true;
    app.dismissConflictBanner();
    assert.equal(app.cloudConflict,true,'Dismissing banner must not re-enable cloud writes');
    context.window.confirm = () => true;
    let writes = 0;
    const resolving = Object.assign({}, methods, {cloudConflict:true,showToast(){},async backupConflictCopies(){throw Error('Disk full');},async syncToCloudNow(){writes++;return true;} });
    await resolving.resolveConflictKeepLocal();
    assert.equal(writes,0,'Failed backup blocks destructive conflict resolution');
    assert.equal(resolving.cloudConflict,true);
    const steps=[];
    resolving.backupConflictCopies=async()=>{steps.push('backup');};
    resolving.syncToCloudNow=async()=>{steps.push('write');return false;};
    await resolving.resolveConflictKeepLocal();
    assert.deepEqual(steps,['backup','write']);
    assert.equal(resolving.cloudConflict,true,'Failed resolution remains blocked');
    resolving.loadFromStorage=async opts=>{assert.equal(opts.preserveLocalBackup,true);assert.equal(opts.forceServer,true);};
    await resolving.resolveConflictLoadCloud();
    let loads = 0;
    const refreshing = Object.assign({}, methods, {
        async saveToStorage() { await Promise.resolve(); this.localSaveFailed = true; },
        async loadFromStorage() { loads++; }, showToast() {}
    });
    await refreshing.refreshFromCloud();
    assert.equal(loads, 0, 'Toolbar refresh waits for disk result and cannot replace data after failed save');
    console.log('Storage safety: partial/total disk failures, visible warnings, conflict write blocking and locked-write retry passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
