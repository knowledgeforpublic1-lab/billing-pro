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
    debouncedSave() {
        if (this._isLoading) return;
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            this.saveToStorage();
        }, 120);
    },
    buildSyncPayload() {
        return {
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
            savedAt: Date.now(),
            baseRev: this.cloudRev
        };
    },
    scheduleRemoteSync() {
        if (this._syncTimer) clearTimeout(this._syncTimer);
        this._syncTimer = setTimeout(() => { this.syncToMongoNow(); }, 2500);
    },
    scheduleMappingSync() {
        if (this._syncTimer) { clearTimeout(this._syncTimer); this._syncTimer = null; }
        if (this._mappingSyncTimer) clearTimeout(this._mappingSyncTimer);
        this.syncStatus = 'syncing';
        this._mappingSyncTimer = setTimeout(() => { this._mappingSyncTimer = null; this.syncToMongoNow(); }, 800);
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
            const payload = this.buildSyncPayload();
            const json = JSON.stringify(payload);
            if (json.length > 800 * 1024) {
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
                console.warn('Sync 409 conflict: overwrite blocked, cloud data safe hai');
                try {
                    const srvMsg = (rj && rj.error) ? String(rj.error).slice(0, 150) : '';
                    this.showToast('⚠️ ' + (srvMsg || 'Another PC saved in between! Refresh, then redo your changes'), '⚠️');
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
            if (manual) this.showToast('Cloud saved! Refresh on other PC', '☁️');
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
            if (json.length > 800 * 1024) return;
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
                            if (it.actKey === '907' || (it.desc && it.desc.startsWith('907:'))) {
                                if (!it.manual) it.qty = q907;
                            }
                        });
                    }
                }
            } catch (syncErr) {
                console.error('Invoice sync error (save still proceeds):', syncErr);
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
                savedAt: Date.now()
            };
            localStorage.setItem('lk_billing_app_state_v10', JSON.stringify(dataToSave));
            try { localStorage.setItem('lk_billing_mapping_locks_v1', JSON.stringify(this.mappingLocks)); } catch(e) {}
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
          try {
              const res = await fetch('/api/billing', {
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
          try { localRaw = localStorage.getItem('lk_billing_app_state_v10'); } catch(e) {}
          let localSavedAt = 0;
          let localHash = '';
          if (localRaw) {
              try {
                  const lp = JSON.parse(localRaw) || {};
                  localSavedAt = Number(lp.savedAt) || 0;
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
          if (serverRaw && !forceServer && localDirty) {
              // Sirf is PC me unsynced change hai, cloud purana hai → LOCAL jeetega + turant push
              raw = localRaw;
              fromMongo = false;
              if (typeof this._loadedRev === 'number') this.cloudRev = this._loadedRev;
              console.info('Unsynced local change mila — reload par local jeeta, cloud push retry hoga');
              try { this.showToast('Unsaved changes found on this PC — saving to cloud...', '🔄'); } catch(e) {}
              setTimeout(() => { try { this.syncToMongoNow({ manual: false }); } catch(e) {} }, 2000);
          } else if (serverRaw && (forceServer || !localRaw || serverUpdatedAt >= localSavedAt)) {
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
                if (parsed.isFinalized !== undefined) this.isFinalized = parsed.isFinalized;
                if (parsed.projectMeta) {
                    this.projectMeta = parsed.projectMeta;
                    if (!this.projectMeta.contractValue) this.projectMeta.contractValue = 48550000;
                    if (!this.projectMeta.aaacDivisor) this.projectMeta.aaacDivisor = 3150;
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
                if (parsed.mappingLocks && typeof parsed.mappingLocks === 'object') {
                    this.mappingLocks = { rate: parsed.mappingLocks.rate !== false, sap: parsed.mappingLocks.sap !== false, qty: parsed.mappingLocks.qty !== false };
                }
            } catch (e) {
                console.error('Error loading stored state', e);
            }
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
