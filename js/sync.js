/**
 * @file Cloud Sync & Local Storage Module
 * @description Handles all data persistence: localStorage save/load, MongoDB cloud sync,
 * conflict resolution, retry logic, heartbeat sync, and tab-close flush.
 * 
 * Key functions:
 * - saveToStorage(): Saves Vue state to localStorage + schedules cloud sync
 * - loadFromStorage(): Loads from MongoDB or localStorage (server-wins logic)
 * - syncToMongoNow(): Pushes current state to MongoDB via POST
 * - flushPendingSync(): Fire-and-forget sync on tab close (keepalive fetch)
 * - _scheduleSyncRetry(): Auto-retry with exponential backoff (3s→30s, max 5)
 * - Heartbeat: 15s interval checks for unsynced changes
 *
 * @module SyncModule
 * @since v2.0
 */

window.SyncModule = {
    async loadSavedBillsList() {
        this.isLoadingBills = true;
        try {
            const res = await fetch('/api/bills', {
                headers: (() => { const h = {}; try { const k = localStorage.getItem('billing_api_key'); if (k) h['x-api-key'] = k; } catch(e){} return h; })()
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.success && Array.isArray(data.bills)) {
                    this.savedBillsList = data.bills;
                }
            }
        } catch(e) {
            console.error('Failed to load bills list', e);
        } finally {
            this.isLoadingBills = false;
        }
    },
    async deleteBillFromCloud(dataId) {
        try {
            const headers = { 'Content-Type': 'application/json' };
            try { const k = localStorage.getItem('billing_api_key'); if (k) headers['x-api-key'] = k; } catch(e) {}
            const res = await fetch('/api/billing/delete', {
                method: 'POST',
                headers,
                body: JSON.stringify({ dataId })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Delete failed');
            }
            try { localStorage.removeItem('lk_billing_state_' + dataId); } catch(e) {}
            return true;
        } catch(e) {
            this.showToast('Delete failed: ' + e.message, '⚠️');
            return false;
        }
    },
    openSavedBillsManager() {
        this.savedBillsSearchQuery = '';
        this.showSavedBillsModal = true;
        this.loadSavedBillsList();
    },
    openNewBillModal() {
        let nextBill = 'RSL/RA/01';
        let nextRa = '01';
        const curBill = (this.projectMeta && this.projectMeta.billNo) || (this.invoiceData && this.invoiceData.invoiceNo) || '';
        const curRa = (typeof this.effectiveRaNo === 'string' ? this.effectiveRaNo : (this.projectMeta && this.projectMeta.raNo) || '');
        if (curRa && /^\d+$/.test(curRa.trim())) {
            const num = parseInt(curRa.trim(), 10) + 1;
            nextRa = String(num).padStart(curRa.trim().length, '0');
        }
        if (curBill) {
            const numMatch = curBill.match(/^(.*?)(\d+)(\s*)$/);
            if (numMatch) {
                const prefix = numMatch[1];
                const num = parseInt(numMatch[2], 10);
                const padLen = numMatch[2].length;
                const nextNum = String(num + 1).padStart(padLen, '0');
                nextBill = prefix + nextNum + numMatch[3];
                if (!curRa) nextRa = nextNum;
            } else {
                nextBill = curBill + ' - 02';
            }
        }
        const today = new Date().toISOString().slice(0, 10);
        this.newBillForm = {
            raNo: nextRa,
            billNo: nextBill,
            billDate: today,
            projectName: (this.projectMeta && this.projectMeta.projectName) || 'RDSS T-10 GADCHIROLI',
            selectedContractorId: this.selectedContractorId || (this.contractorsList && this.contractorsList[0] && this.contractorsList[0].id) || '',
            selectedCompanyId: this.selectedCompanyId || 'ashoka_buildcon',
            mode: 'copy_master'
        };
        this.showNewBillModal = true;
    },
    updateRaNo(val) {
        const clean = String(val || '').trim();
        if (!this.projectMeta) this.projectMeta = {};
        this.projectMeta.raNo = clean;
        if (this.invoiceData) {
            this.invoiceData.raNo = clean;
        }
        this.saveToStorage();
        if (this._raSyncDebounce) clearTimeout(this._raSyncDebounce);
        this._raSyncDebounce = setTimeout(() => {
            try { this.syncToMongoNow({ manual: false }); } catch(e) {}
        }, 1500);
    },
    onNewBillRaNoInput() {
        if (!this.newBillForm) return;
        const ra = (this.newBillForm.raNo || '').trim();
        if (ra) {
            const cur = this.newBillForm.billNo || '';
            if (!cur || /^(?:RSL\/RA\/|RA[\-_])\d+$/i.test(cur.trim())) {
                const prefix = (cur && cur.startsWith('RSL/RA/')) ? 'RSL/RA/' : 'RA-';
                this.newBillForm.billNo = prefix + ra;
            }
        }
    },
    async createNewBill() {
        const form = this.newBillForm;
        if (!form.billNo || !form.billNo.trim()) {
            this.showToast('Please enter a Bill Number', '⚠️');
            return;
        }
        const cleanBillNo = form.billNo.trim();
        const cleanRaNo = (form.raNo || '').trim();
        const newBillId = 'bill_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

        this.showToast('Saving current bill before creating new...', '⏳');
        try { await this.syncToMongoNow({ manual: true, force: true }); } catch(e) {}

        if (form.mode === 'copy_master') {
            // Keep activities & SAP mappings intact, reset quantities to 0 for fresh cycle
            this.activityQuantities = {};
            this.isFinalized = false;
            if (!this.projectMeta) this.projectMeta = {};
            this.projectMeta.billNo = cleanBillNo;
            this.projectMeta.raNo = cleanRaNo;
            this.projectMeta.billDate = form.billDate || new Date().toISOString().slice(0, 10);
            this.projectMeta.projectName = form.projectName;
            this.selectedContractorId = form.selectedContractorId;
            this.selectedCompanyId = form.selectedCompanyId;
            if (!this.invoiceData) this.invoiceData = {};
            this.invoiceData.invoiceNo = cleanBillNo;
            this.invoiceData.raNo = cleanRaNo;
            this.invoiceData.invoiceDate = form.billDate;
            this.invoiceData.items = [];
        } else if (form.mode === 'fresh_default') {
            if (typeof defaultActivities !== 'undefined') {
                this.activities = JSON.parse(JSON.stringify(defaultActivities));
            }
            this.activityQuantities = {};
            this.isFinalized = false;
            if (!this.projectMeta) this.projectMeta = {};
            this.projectMeta.billNo = cleanBillNo;
            this.projectMeta.billDate = form.billDate || new Date().toISOString().slice(0, 10);
            this.projectMeta.projectName = form.projectName;
            this.selectedContractorId = form.selectedContractorId;
            this.selectedCompanyId = form.selectedCompanyId;
            if (typeof defaultInvoiceData !== 'undefined') {
                this.invoiceData = JSON.parse(JSON.stringify(defaultInvoiceData));
            }
            if (this.invoiceData) {
                this.invoiceData.invoiceNo = cleanBillNo;
                this.invoiceData.invoiceDate = form.billDate;
            }
        } else if (form.mode === 'full_clone') {
            this.isFinalized = false;
            if (this.projectMeta) {
                this.projectMeta.billNo = cleanBillNo;
                this.projectMeta.billDate = form.billDate;
                this.projectMeta.projectName = form.projectName;
            }
            if (this.invoiceData) {
                this.invoiceData.invoiceNo = cleanBillNo;
                this.invoiceData.invoiceDate = form.billDate;
            }
        }

        this.activeBillId = newBillId;
        this.cloudRev = 0;
        this.lastSentHash = '';
        try { localStorage.setItem('lk_billing_active_bill_id', newBillId); } catch(e) {}

        this.saveToStorage();
        await this.syncToMongoNow({ manual: true, force: true });

        this.showNewBillModal = false;
        this.showSavedBillsModal = false;
        this.historyStack = [];
        this.historyIndex = -1;
        if (typeof this.takeSnapshot === 'function') this.takeSnapshot();
        this.showToast(`New Bill [${cleanBillNo}] created & saved to Cloud! 🎉`, '✨');
    },
    async openBill(dataId) {
        if (!dataId) return;
        if (dataId === this.activeBillId) {
            this.showToast(`Bill [${(this.projectMeta && this.projectMeta.billNo) || dataId}] is already active`, 'ℹ️');
            this.showSavedBillsModal = false;
            return;
        }

        this.showToast('Saving current bill before switching...', '⏳');
        try { await this.syncToMongoNow({ manual: true }); } catch(e) {}

        this._isLoading = true;
        this.activeBillId = dataId;
        this.cloudRev = 0;
        this.lastSentHash = '';
        try { localStorage.setItem('lk_billing_active_bill_id', dataId); } catch(e) {}

        await this.loadFromStorage({ forceServer: true, dataId });
        this._isLoading = false;
        this.showSavedBillsModal = false;
        this.historyStack = [];
        this.historyIndex = -1;
        if (typeof this.takeSnapshot === 'function') this.takeSnapshot();
        this.showToast(`Bill [${(this.projectMeta && this.projectMeta.billNo) || dataId}] loaded successfully! 📂`, '📄');
    },
    async duplicateBill(b) {
        if (!b) return;
        const newBillNo = prompt('Enter new Bill No for duplicate copy:', (b.billNo || 'Bill') + ' (Copy)');
        if (!newBillNo || !newBillNo.trim()) return;

        let billState = null;
        if (b.dataId === this.activeBillId) {
            billState = JSON.parse(JSON.stringify(this.buildSyncPayload()));
        } else {
            this.showToast('Fetching bill data for copy...', '⏳');
            try {
                const res = await fetch('/api/billing?dataId=' + encodeURIComponent(b.dataId), {
                    headers: (() => { const h = {}; try { const k = localStorage.getItem('billing_api_key'); if (k) h['x-api-key'] = k; } catch(e){} return h; })()
                });
                const j = await res.json();
                if (j && j.success && j.data) billState = j.data;
            } catch(e) {}
        }

        if (!billState) {
            this.showToast('Could not load source bill to duplicate', '⚠️');
            return;
        }

        const newBillId = 'bill_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        if (!billState.projectMeta) billState.projectMeta = {};
        billState.projectMeta.billNo = newBillNo.trim();
        if (!billState.invoiceData) billState.invoiceData = {};
        billState.invoiceData.invoiceNo = newBillNo.trim();
        billState.isFinalized = false;
        billState.dataId = newBillId;

        const headers = { 'Content-Type': 'application/json' };
        try { const k = localStorage.getItem('billing_api_key'); if (k) headers['x-api-key'] = k; } catch(e) {}
        await fetch('/api/billing', {
            method: 'POST',
            headers,
            body: JSON.stringify(Object.assign(billState, { dataId: newBillId, force: true, baseRev: 0 }))
        });

        this.showToast(`Duplicate bill [${newBillNo.trim()}] created! Opening...`, '📋');
        await this.openBill(newBillId);
    },
    async deleteBill(b) {
        if (!b) return;
        if (b.dataId === this.activeBillId) {
            alert('Yeh bill abhi active (open) hai. Pehle koi doosra bill open karein, phir isko delete karein.');
            return;
        }
        const ok = confirm(`Kya aap sach me Bill [${b.billNo || b.dataId}] ko database se DELETE karna chahte hain?\n\nYeh action wapas nahi hoga.`);
        if (!ok) return;

        this.showToast(`Deleting bill [${b.billNo}]...`, '⏳');
        const success = await this.deleteBillFromCloud(b.dataId);
        if (success) {
            this.showToast(`Bill [${b.billNo}] deleted from database 🗑️`, '🗑️');
            await this.loadSavedBillsList();
        }
    },
    debouncedSave() {
        if (this._isLoading) return;
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            this.saveToStorage();
        }, 120);
    },
    buildSyncPayload(extra = {}) {
        return Object.assign({
            dataId: this.activeBillId || 'main-billing-state',
            isFinalized: this.isFinalized,
            projectMeta: this.projectMeta,
            selectedCompanyId: this.selectedCompanyId,
            contractorsList: this.contractorsList,
            selectedContractorId: this.selectedContractorId,
            pctStage1: this.pctStage1,
            pctStage2: this.pctStage2,
            pctStage3: this.pctStage3,
            locations: this.locations,
            activityLocations: this.activityLocations,
            activities: this.activities,
            masterAbstractList: this.masterAbstractList,
            activityQuantities: this.activityQuantities,
            invoiceData: this.invoiceData,
            mappingLocks: this.mappingLocks,
            mappingRoundMode: this.mappingRoundMode || 'none',
            sapMaterialsMaster: this.sapMaterialsMaster,
            savedAt: Date.now(),
            baseRev: (typeof this.cloudRev === 'number' ? this.cloudRev : 0)
        }, extra);
    },
    scheduleRemoteSync() {
        this._syncRetryCount = 0; // naya edit = retry budget dobara se
        if (this._syncTimer) clearTimeout(this._syncTimer);
        this._syncTimer = setTimeout(() => { this.syncToMongoNow(); }, 2500);
    },
    scheduleMappingSync() {
        if (this._syncTimer) { clearTimeout(this._syncTimer); this._syncTimer = null; }
        if (this._mappingSyncTimer) clearTimeout(this._mappingSyncTimer);
        this.syncStatus = 'syncing';
        this._mappingSyncTimer = setTimeout(() => { this._mappingSyncTimer = null; this.syncToMongoNow(); }, 400);
    },
    stableStateHash(obj) {
        try {
            const c = Object.assign({}, obj);
            delete c.savedAt; delete c.baseRev;
            const json = JSON.stringify(c);
            let h = 0;
            for (let i = 0; i < json.length; i += 97) { h = ((h * 31) + json.charCodeAt(i)) >>> 0; }
            return json.length + ':' + h;
        } catch(e) { return ''; }
    },
    getSyncedHash() { try { return localStorage.getItem('lk_billing_synced_hash_v1') || ''; } catch(e) { return ''; } },
    setSyncedHash(h) { try { if (h) localStorage.setItem('lk_billing_synced_hash_v1', h); } catch(e) {} },
    async syncToMongoNow(opts) {
        const manual = !!(opts && opts.manual);
        const force = !!(opts && opts.force);
        if (this.cloudConflict) {
            if (manual) {
                this.syncStatus = 'error';
                this.showToast('Refresh first — another PC saved changes. Then redo your changes', '⚠️');
                return false;
            }
            console.warn('Sync blocked: cloudConflict — auto-recovering by re-fetching server rev');
            try {
                const rRes = await fetch('/api/billing', {
                    headers: (() => { const h = {}; try { const k = localStorage.getItem('billing_api_key'); if (k) h['x-api-key'] = k; } catch(e){} return h; })()
                });
                if (rRes.ok) { const rj = await rRes.json(); if (rj && typeof rj.rev === 'number') { this.cloudRev = rj.rev; this.cloudConflict = false; console.info('Auto-recovered: cloudRev updated to ' + rj.rev); } }
                else { this._scheduleSyncRetry(); return false; }
            } catch(e) { this._scheduleSyncRetry(); return false; }
        }
        try {
            const payload = this.buildSyncPayload(force ? { force: true } : {});
            const json = JSON.stringify(payload);
            if (json.length > 4 * 1024 * 1024) {
                this.syncStatus = 'error';
                console.warn('Sync skipped: payload too large (' + Math.round(json.length / 1024) + 'KB)');
                this.showToast('Data too large (' + Math.round(json.length / 1024) + 'KB) — cloud sync skipped', '⚠️');
                return false;
            }
            let h = 0;
            for (let i = 0; i < json.length; i += 97) { h = ((h * 31) + json.charCodeAt(i)) >>> 0; }
            const hash = json.length + ':' + h;
            if (hash === this.lastSentHash) {
                if (manual) this.showToast('Already synced — Refresh on other PC', '☁️');
                return true;
            }
            this.syncStatus = 'syncing';
            const res = await fetch('/api/billing', {
                method: 'POST',
                headers: (() => { const h = { 'Content-Type': 'application/json' }; try { const k = localStorage.getItem('billing_api_key'); if (k) h['x-api-key'] = k; } catch(e){} return h; })(),
                body: json
            });
            if (res.status === 423) {
                this.lastSentHash = hash;
                this.syncStatus = 'local';
                console.info('Mongo: bill locked hai, local copy safe hai');
                if (manual) this.showToast('Bill locked — Unlock first to sync', '🔒');
                return false;
            }
            if (res.status === 401) {
                this.syncStatus = 'error';
                this.showToast('Cloud sync FAIL: API key wrong/missing — changes saved locally only. Set billing_api_key in localStorage.', '🔑');
                this._scheduleSyncRetry();
                return false;
            }
            if (res.status === 429) {
                this.syncStatus = 'error';
                this.showToast('Cloud sync FAIL: Too many saves — wait 1 min', '⏳');
                this._scheduleSyncRetry();
                return false;
            }
            if (res.status === 409) {
                let rj = null;
                try { rj = await res.json(); } catch(e) {}
                if (rj && typeof rj.rev === 'number') this.cloudRev = rj.rev;
                this.lastSentHash = hash;
                this.syncStatus = 'error';
                console.warn('Sync 409 conflict: overwrite blocked, checking auto-recovery...');
                // Auto-recover if background sync or idle: pull newer cloud data directly!
                if (!manual && rj && rj.data) {
                    console.info('Auto-reloading newer cloud data after conflict...');
                    await this.loadFromStorage({ forceServer: true });
                    try { this.showToast('Cloud data synchronized from other PC ☁️', 'ℹ️'); } catch(e) {}
                    return true;
                }
                try {
                    const srvMsg = (rj && rj.error) ? String(rj.error).slice(0, 150) : '';
                    this.showToast('⚠️ ' + (srvMsg || 'Another PC saved in between! Click Refresh on toolbar to load it'), '⚠️');
                } catch(e) {}
                return false;
            }
            if (!res.ok) {
                let srv = '';
                try { const ej = await res.json(); if (ej && ej.error) srv = String(ej.error).slice(0, 140); } catch(e) {}
                throw new Error('HTTP ' + res.status + (srv ? ' — ' + srv : ''));
            }
            try { const okj = await res.json(); if (okj && typeof okj.rev === 'number') this.cloudRev = okj.rev; } catch(e) {}
            this.lastSentHash = hash;
            this.setSyncedHash(this.stableStateHash(payload));
            this.syncStatus = 'synced';
            this._syncRetryCount = 0;
            try {
                const t = new Date();
                this.lastSyncAt = ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2);
            } catch(e) {}
            if (manual) {
                this.showToast('Cloud saved! Refresh on other PC', '☁️');
                const gdriveUrl = (typeof this.getEffectiveDriveWebhookUrl === 'function' ? this.getEffectiveDriveWebhookUrl() : '')
                    || (this.gdriveWebhookUrl || '').trim()
                    || localStorage.getItem('billing_gdrive_webhook_url')
                    || (this.projectMeta && this.projectMeta.gdriveWebhookUrl);
                if (gdriveUrl && typeof this.manualSaveBillToDrive === 'function') {
                    setTimeout(() => {
                        try {
                            this.manualSaveBillToDrive();
                        } catch(e) {
                            console.warn('Auto drive upload after bill save failed:', e);
                        }
                    }, 500);
                }
            }
            return true;
        } catch (err) {
            this.syncStatus = 'error';
            console.error('Mongo sync failed (local copy safe hai):', err);
            const m = String((err && err.message) || 'network/server error').slice(0, 150);
            this.showToast('Cloud sync FAIL: ' + m + '. Local copy safe, retrying...', '⚠️');
            this._scheduleSyncRetry();
            return false;
        }
    },
    _syncRetryCount: 0,
    _syncRetryTimer: null,
    _scheduleSyncRetry() {
        if (this._syncRetryTimer) clearTimeout(this._syncRetryTimer);
        this._syncRetryCount = (this._syncRetryCount || 0) + 1;
        if (this._syncRetryCount > 5) { this._syncRetryCount = 0; return; }
        const delay = Math.min(3000 * this._syncRetryCount, 30000);
        console.info('Sync retry #' + this._syncRetryCount + ' in ' + (delay / 1000) + 's');
        this._syncRetryTimer = setTimeout(() => { this._syncRetryTimer = null; this.syncToMongoNow(); }, delay);
    },
    // Net wapas aane par turant pending sync push karo (offline tha to 5 retry khatam ho chuke hote hain)
    armOnlineRecovery() {
        if (this._onlineArmed) return;
        this._onlineArmed = true;
        window.addEventListener('online', () => {
            console.info('Browser online — pending cloud sync retry ho raha hai');
            this._syncRetryCount = 0;
            if (this.cloudConflict) return;
            setTimeout(() => { try { this.syncToMongoNow(); } catch(e) {} }, 500);
        });
    },
    async refreshFromCloud() {
        try {
            if (this._syncTimer) { clearTimeout(this._syncTimer); this._syncTimer = null; }
            if (this._mappingSyncTimer) { clearTimeout(this._mappingSyncTimer); this._mappingSyncTimer = null; }
            this.showToast('Loading fresh data from cloud...', '🔄');
            await this.loadFromStorage({ forceServer: true });
            this.showToast('Fresh data loaded', '🔄');
        } catch (e) {
            console.error('Refresh failed', e);
            this.showToast('Refresh failed — check internet', '⚠️');
        }
    },
    flushPendingSync() {
        try {
            if (this.cloudConflict) return;
            if (this._syncTimer) { clearTimeout(this._syncTimer); this._syncTimer = null; }
            if (this._mappingSyncTimer) { clearTimeout(this._mappingSyncTimer); this._mappingSyncTimer = null; }
            const payload = this.buildSyncPayload();
            const json = JSON.stringify(payload);
            if (json.length > 4 * 1024 * 1024) return;
            let h = 0;
            for (let i = 0; i < json.length; i += 97) { h = ((h * 31) + json.charCodeAt(i)) >>> 0; }
            const hash = json.length + ':' + h;
            if (hash === this.lastSentHash) return;
            try {
                const headers = { 'Content-Type': 'application/json' };
                try { const k = localStorage.getItem('billing_api_key'); if (k) headers['x-api-key'] = k; } catch(e) {}
                fetch('/api/billing', { method: 'POST', headers, body: json, keepalive: true }).catch(() => {});
            } catch(e) {}
        } catch(e) {}
    },
    saveToStorage() {
        if (this._isLoading) return;
        try {
            try {
                if (this.invoiceData && this.invoiceData.autoSync) {
                    this.updateSyncTaxInvoiceFromActivities();
                } else if (this.invoiceData && Array.isArray(this.invoiceData.items)) {
                    const q907 = this.getActivity907InvoiceQty();
                    if (q907 > 0) {
                        this.invoiceData.items.forEach(it => {
                            if (it.actKey === '907' || (it.desc && /^(?:Activity\s+)?907\s*:/i.test(it.desc))) {
                                if (!it.manual) it.qty = q907;
                            }
                        });
                    }
                }
            } catch (syncErr) {
                console.error('Invoice sync error (save still proceeds):', syncErr);
            }
            if (this.gdriveWebhookUrl && this.projectMeta) {
                this.projectMeta.gdriveWebhookUrl = this.gdriveWebhookUrl;
            }
            const dataToSave = {
                isFinalized: this.isFinalized,
                projectMeta: this.projectMeta,
                selectedCompanyId: this.selectedCompanyId,
                contractorsList: this.contractorsList,
                selectedContractorId: this.selectedContractorId,
                pctStage1: this.pctStage1,
                pctStage2: this.pctStage2,
                pctStage3: this.pctStage3,
                locations: this.locations,
                activityLocations: this.activityLocations,
                activities: this.activities,
                masterAbstractList: this.masterAbstractList,
                activityQuantities: this.activityQuantities,
                invoiceData: this.invoiceData,
                mappingLocks: this.mappingLocks,
                mappingRoundMode: this.mappingRoundMode || 'none',
                sapMaterialsMaster: this.sapMaterialsMaster,
                savedAt: Date.now(),
                baseRev: (typeof this.cloudRev === 'number' ? this.cloudRev : 0)
            };
            const curBillId = this.activeBillId || 'main-billing-state';
            const localKey = (curBillId && curBillId !== 'main-billing-state')
                ? ('lk_billing_state_' + curBillId)
                : 'lk_billing_app_state_v10';
            localStorage.setItem(localKey, JSON.stringify(dataToSave));
            try { localStorage.setItem('lk_billing_active_bill_id', curBillId); } catch(e) {}
            try { localStorage.setItem('lk_billing_mapping_locks_v1', JSON.stringify(this.mappingLocks)); } catch(e) {}
            try { localStorage.setItem('lk_billing_mapping_round_mode', this.mappingRoundMode || 'none'); } catch(e) {}
            if (!this.isPerformingHistoryAction) {
                this.takeSnapshot();
            }
            this.scheduleRemoteSync();
        } catch (e) {
            console.error('Save error', e);
        }
    },
    async loadFromStorage(opts) {
          const forceServer = !!(opts && opts.forceServer);
          let raw = null;
          let fromMongo = false;
          // Cloud copy lao (fail ho to null — phir local hi jeetega)
          let serverRaw = null;
          let serverUpdatedAt = 0;
          const targetBillId = (opts && opts.dataId) || this.activeBillId || localStorage.getItem('lk_billing_active_bill_id') || 'main-billing-state';
          this.activeBillId = targetBillId;
          try { localStorage.setItem('lk_billing_active_bill_id', targetBillId); } catch(e) {}
          try {
              const res = await fetch('/api/billing?dataId=' + encodeURIComponent(targetBillId), {
                  headers: (() => { const h = {}; try { const k = localStorage.getItem('billing_api_key'); if (k) h['x-api-key'] = k; } catch(e){} return h; })()
              });
              if (!res.ok) {
                  try { const ej = await res.clone().json().catch(() => null); if (ej && ej.error) setTimeout(() => { try { this.showToast('☁️ Cloud load fail: ' + String(ej.error).slice(0, 140), '⚠️'); } catch(e) {} }, 600); } catch(e) {}
                  throw new Error('API Error: ' + res.status);
              }
              const json = await res.json();
              if (json && json.success && json.data) {
                  serverRaw = JSON.stringify(json.data);
                  try { serverUpdatedAt = json.updatedAt ? new Date(json.updatedAt).getTime() : 0; } catch(e) { serverUpdatedAt = 0; }
                  if (!serverUpdatedAt && json.data && json.data.savedAt) {
                      serverUpdatedAt = Number(json.data.savedAt) || 0;
                  }
                  if (typeof json.rev === 'number') this._loadedRev = json.rev;
              }
          } catch (err) {
              console.error('Failed to load from MongoDB API:', err);
          }
          // Local copy padho.
          // RULE: jo change abhi cloud me nahi gaya (unsynced local), wo reload par
          // kabhi nahi harega — chahe server timestamp naya dikhe (wahi revert bug tha).
          // Server tabhi jeetega jab us par dusre PC ka NAYA synced data ho.
          let localRaw = null;
          const localKey = (targetBillId && targetBillId !== 'main-billing-state')
              ? ('lk_billing_state_' + targetBillId)
              : 'lk_billing_app_state_v10';
          try { localRaw = localStorage.getItem(localKey); } catch(e) {}
          let localSavedAt = 0;
          let localRev = 0;
          let localHash = '';
          if (localRaw) {
              try {
                  const lp = JSON.parse(localRaw) || {};
                  localSavedAt = Number(lp.savedAt) || 0;
                  localRev = (typeof lp.baseRev === 'number') ? lp.baseRev : 0;
                  localHash = this.stableStateHash(lp);
              } catch(e) {}
          }
          let serverHash = '';
          if (serverRaw) {
              try { serverHash = this.stableStateHash(JSON.parse(serverRaw)); } catch(e) {}
              if (typeof this._loadedRev === 'number') { /* rev neeche har branch me adopt hoga */ }
          }
          let syncedHash = this.getSyncedHash();
          if (serverHash && !syncedHash) { syncedHash = serverHash; this.setSyncedHash(serverHash); }
          const localDirty = !!(localRaw && localHash && serverHash && localHash !== serverHash && localHash !== syncedHash && serverHash === syncedHash);
          const serverRevIsNewer = (typeof this._loadedRev === 'number' && typeof localRev === 'number' && this._loadedRev > localRev);
          if (serverRaw && !forceServer && localDirty && !serverRevIsNewer) {
              // Sirf is PC me unsynced change hai, cloud purana hai → LOCAL jeetega + turant push
              raw = localRaw;
              fromMongo = false;
              if (typeof this._loadedRev === 'number') this.cloudRev = this._loadedRev;
              console.info('Unsynced local change mila — reload par local jeeta, cloud push retry hoga');
              try { this.showToast('Unsaved changes found on this PC — saving to cloud...', '🔄'); } catch(e) {}
              setTimeout(() => { try { this.syncToMongoNow({ manual: false }); } catch(e) {} }, 2000);
          } else if (serverRaw && (forceServer || !localRaw || serverRevIsNewer || serverUpdatedAt >= localSavedAt)) {
              raw = serverRaw;
              fromMongo = true;
              if (typeof this._loadedRev === 'number') this.cloudRev = this._loadedRev;
              this.cloudConflict = false;
              if (serverHash) this.setSyncedHash(serverHash);
          } else if (localRaw) {
              raw = localRaw;
              fromMongo = false;
              if (serverRaw) {
                  // Is PC ka data cloud se NAYA hai — cloud purana hai, isko push karke fix karo
                  console.info('Local copy cloud se nayi hai — sync retry schedule hua');
                  try { this.showToast('This PC has newer data — syncing to cloud...', '🔄'); } catch(e) {}
                  setTimeout(() => { try { this.syncToMongoNow({ manual: false }); } catch(e) {} }, 3000);
              }
          } else if (serverRaw) {
              raw = serverRaw;
              fromMongo = true;
              if (typeof this._loadedRev === 'number') this.cloudRev = this._loadedRev;
              this.cloudConflict = false;
          } else {
              try { this.showToast('No data found in cloud or local', 'ℹ️'); } catch(e) {}
          }
          this.syncStatus = fromMongo ? 'synced' : (serverRaw ? 'syncing' : 'local');
          if (fromMongo && raw) {
              try {
                  let h = 0;
                  for (let i = 0; i < raw.length; i += 97) { h = ((h * 31) + raw.charCodeAt(i)) >>> 0; }
                  this.lastSentHash = raw.length + ':' + h;
              } catch(e) {}
          }
          if (raw) {
            try {
                const parsed = JSON.parse(raw);
                let loadedHasCatalog = false;
                if (Array.isArray(parsed.sapMaterialsMaster) && parsed.sapMaterialsMaster.length > 0) {
                    // ☁️ SAP Material Master ka cloud copy yahan se aata hai
                    this.sapMaterialsMaster = parsed.sapMaterialsMaster;
                    loadedHasCatalog = true;
                }
                this._loadedHasCatalog = loadedHasCatalog;
                if (parsed.isFinalized !== undefined) this.isFinalized = parsed.isFinalized;
                if (parsed.projectMeta) {
                    this.projectMeta = parsed.projectMeta;
                    if (!this.projectMeta.contractValue) this.projectMeta.contractValue = 48550000;
                    if (!this.projectMeta.aaacDivisor) this.projectMeta.aaacDivisor = 3150;
                    if (this.projectMeta.gdriveWebhookUrl && this.projectMeta.gdriveWebhookUrl.includes('/exec')) {
                        this.gdriveWebhookUrl = this.projectMeta.gdriveWebhookUrl;
                        try { localStorage.setItem('billing_gdrive_webhook_url', this.projectMeta.gdriveWebhookUrl); } catch(e) {}
                    } else {
                        this.projectMeta.gdriveWebhookUrl = 'https://script.google.com/macros/s/AKfycbx6hHT7Xnw4SItlkrKeE3BSBuBpQDy1-gFsxq5kRdlr_3PHEK7XYjIHBPjtGWj3H9Jx/exec';
                        this.gdriveWebhookUrl = 'https://script.google.com/macros/s/AKfycbx6hHT7Xnw4SItlkrKeE3BSBuBpQDy1-gFsxq5kRdlr_3PHEK7XYjIHBPjtGWj3H9Jx/exec';
                        try { localStorage.setItem('billing_gdrive_webhook_url', 'https://script.google.com/macros/s/AKfycbx6hHT7Xnw4SItlkrKeE3BSBuBpQDy1-gFsxq5kRdlr_3PHEK7XYjIHBPjtGWj3H9Jx/exec'); } catch(e) {}
                    }
                }
                if (parsed.selectedCompanyId) this.selectedCompanyId = parsed.selectedCompanyId;
                if (parsed.contractorsList && Array.isArray(parsed.contractorsList) && parsed.contractorsList.length > 0) {
                    this.contractorsList = parsed.contractorsList;
                }
                if (parsed.selectedContractorId) this.selectedContractorId = parsed.selectedContractorId;
                if (parsed.pctStage1 !== undefined) this.pctStage1 = parsed.pctStage1;
                if (parsed.pctStage2 !== undefined) this.pctStage2 = parsed.pctStage2;
                if (parsed.pctStage3 !== undefined) this.pctStage3 = parsed.pctStage3;
                if (parsed.locations && Array.isArray(parsed.locations) && parsed.locations.length > 0) {
                    this.locations = parsed.locations;
                }
                if (parsed.activityLocations && typeof parsed.activityLocations === 'object') this.activityLocations = parsed.activityLocations;
                if (parsed.activities && typeof parsed.activities === 'object') {
                    this.activities = parsed.activities;
                    Object.keys(defaultActivities).forEach(k => {
                        if (!this.activities[k]) {
                            this.activities[k] = JSON.parse(JSON.stringify(defaultActivities[k]));
                        } else if (defaultActivities[k] && defaultActivities[k].materials) {
                            defaultActivities[k].materials.forEach((defMat, mIdx) => {
                                if (this.activities[k].materials && this.activities[k].materials[mIdx]) {
                                    const cur = this.activities[k].materials[mIdx];
                                    if (!cur.itemCode && defMat.itemCode) {
                                        cur.itemCode = defMat.itemCode;
                                        cur.sapDescription = defMat.sapDescription;
                                        cur.sapUom = defMat.sapUom;
                                        cur.docHeader = defMat.docHeader;
                                    }
                                    if (!cur.sapItems && defMat.sapItems) {
                                        cur.sapItems = JSON.parse(JSON.stringify(defMat.sapItems));
                                    }
                                }
                            });
                        }
                    });
                    // Ensure all materials (including extra items) have valid sapItems
                    Object.keys(this.activities).forEach(k => {
                        const act = this.activities[k];
                        if (act && act.materials) {
                            act.materials.forEach((m, idx) => {
                                if (!m.sapItems || !m.sapItems.length || !m.sapItems[0].code) {
                                    if (typeof this.ensureMaterialSap === 'function') {
                                        this.ensureMaterialSap(m, idx);
                                    }
                                }
                            });
                        }
                    });
                }
                if (parsed.masterAbstractList && Array.isArray(parsed.masterAbstractList) && parsed.masterAbstractList.length > 0) {
                    this.masterAbstractList = parsed.masterAbstractList;
                }
                if (parsed.activityQuantities && typeof parsed.activityQuantities === 'object') {
                    this.activityQuantities = parsed.activityQuantities;
                }
                if (parsed.invoiceData && typeof parsed.invoiceData === 'object') {
                    this.invoiceData = parsed.invoiceData;
                }
                // Contractor name suraksha - agar khali ya default CONTRACTOR hai toh active firm se bharo
                if (this.invoiceData && (!this.invoiceData.contractorName || this.invoiceData.contractorName === 'CONTRACTOR' || this.invoiceData.contractorName === 'M/s CONTRACTOR')) {
                    const firm = (this.contractorsList || []).find(c => c.id === this.selectedContractorId);
                    if (firm && firm.name) {
                        this.invoiceData.contractorName = firm.name.startsWith('M/s') ? firm.name : `M/s ${firm.name}`;
                    } else if (this.projectMeta && this.projectMeta.contractorName) {
                        this.invoiceData.contractorName = this.projectMeta.contractorName;
                    }
                }
                // Normalize existing invoice item descriptions to "Activity [k] : ..."
                if (this.invoiceData && Array.isArray(this.invoiceData.items)) {
                    this.invoiceData.items.forEach(it => {
                        const k = it.actKey || (typeof this.keyOfInvoiceItem === 'function' ? this.keyOfInvoiceItem(it) : ((it.desc && /^(?:Activity\s+)?([A-Za-z0-9]+)\s*:/i.test(it.desc)) ? it.desc.match(/^(?:Activity\s+)?([A-Za-z0-9]+)\s*:/i)[1] : ''));
                        if (k && this.activities && this.activities[k]) {
                            it.actKey = k;
                            if (typeof this.getActivityInvoiceDescription === 'function') {
                                it.desc = this.getActivityInvoiceDescription(k);
                            }
                        }
                    });
                }
                if (parsed.mappingLocks && typeof parsed.mappingLocks === 'object') {
                    this.mappingLocks = { rate: parsed.mappingLocks.rate !== false, sap: parsed.mappingLocks.sap !== false, qty: parsed.mappingLocks.qty !== false };
                }
                if (parsed.mappingRoundMode) {
                    this.mappingRoundMode = parsed.mappingRoundMode;
                    try { localStorage.setItem('lk_billing_mapping_round_mode', this.mappingRoundMode); } catch(e) {}
                }
            } catch (e) {
                console.error('Error loading stored state', e);
            }
        }
        // Winning copy me catalog nahi tha — par is PC ke localStorage me saved hai to
        // wo prefer karo (cloud ko apni koi opinion hi nahi isi key par).
        if (this._loadedHasCatalog === false && localRaw) {
            try {
                const lpCat = JSON.parse(localRaw);
                if (lpCat && Array.isArray(lpCat.sapMaterialsMaster) && lpCat.sapMaterialsMaster.length) {
                    this.sapMaterialsMaster = lpCat.sapMaterialsMaster;
                    this._loadedHasCatalog = true;
                }
            } catch(e) {}
        }
        // Catalog cloud/local dono me naya tha (pehli baar online hua) — bundled defaults seed karke push karo
        if (raw && this._loadedHasCatalog === false && Array.isArray(this.sapMaterialsMaster) && this.sapMaterialsMaster.length) {
            try { this.scheduleMappingSync(); } catch(e) {}
        }
        this.initDefaultSampleQuantities();
        this.normalizeAllContractorBanks();
        this.checkAndApplyAutoGstRule();
        if (this.invoiceData && this.invoiceData.autoSync) {
            this.updateSyncTaxInvoiceFromActivities();
        }
        this._syncRetryCount = 0;
        if (this._syncRetryTimer) { clearTimeout(this._syncRetryTimer); this._syncRetryTimer = null; }
    },
    initDefaultSampleQuantities() {
        Object.keys(this.activities).forEach(k => {
            this.initQuantitiesForActivity(k);
        });
    },
};
