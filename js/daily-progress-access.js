/* Authenticated Daily Progress workspace: per-report writes and public-link administration. */
(() => {
    const module = window.DailyProgressModule;
    const originalInit = module.initDailyProgress;
    const originalLoad = module.loadDailyProgressReportForDate;
    const originalQuantity = module.onDailyProgressQuantityChange;
    const originalManpower = module.onDailyProgressManpowerChange;
    const originalSaveData = module.saveDailyProgressData;
    const originalContractorChange = module.onDailyProgressContractorChange;
    Object.assign(module, {
        // This workspace persists confirmed reports through the versioned report API.
        // Debounced drafts and sharing a URL must only update the device cache.
        saveDailyProgressData() {
            return originalSaveData.call(this, false);
        },
        invalidateDailyProgressReads() {
            this._dpDataEpoch = (this._dpDataEpoch || 0) + 1;
            this._dpStatusSeq = (this._dpStatusSeq || 0) + 1;
        },
        async loadDailyProgressLocations(signal) {
            const cid = this.dailyProgressContractorId;
            if (!cid) return;
            this._dpLocationsContractor = cid;
            this._dpLocationsCache = this._dpLocationsCache || {};
            const defaults = (typeof window !== 'undefined' && window.DefaultFeeders && window.DefaultFeeders.list) || [];
            if (this._dpLocationsCache[cid]) {
                this.dailyProgressLocations = this._dpLocationsCache[cid];
            } else if ((!this.dailyProgressLocations || !this.dailyProgressLocations.length) && defaults.length) {
                this.dailyProgressLocations = [...defaults];
            }
            try {
                const result = await this.dailyProgressRequest('locations?contractorId=' + encodeURIComponent(cid), undefined, signal);
                if (signal?.aborted || cid !== this.dailyProgressContractorId) return;
                const fetched = result.locations || [];
                const map = new Map();
                defaults.forEach(def => map.set(def.id, { ...def }));
                fetched.forEach(loc => {
                    if (loc && loc.id) {
                        map.set(loc.id, map.has(loc.id) ? { ...map.get(loc.id), ...loc } : loc);
                    }
                });
                const merged = Array.from(map.values());
                this._dpLocationsCache[cid] = merged;
                this.dailyProgressLocations = merged;
                if (!this.dailyProgressLocationId) {
                    if (this.dailyProgressLocations.length === 1) {
                        this.dailyProgressLocationId = this.dailyProgressLocations[0].id;
                    } else if (this.dailyProgressLocations.length === 0) {
                        this.dailyProgressLocationId = 'legacy';
                    }
                } else if (this.dailyProgressLocationId !== 'legacy' && !this.dailyProgressLocations.some(row => row.id === this.dailyProgressLocationId)) {
                    this.dailyProgressLocationId = this.dailyProgressLocations.length === 1 ? this.dailyProgressLocations[0].id : 'legacy';
                }
                if (this.dailyProgressLocationId && this.syncDailyProgressFiltersFromLocation) {
                    this.syncDailyProgressFiltersFromLocation(this.dailyProgressLocationId);
                }
            } catch (error) {
                if (error && error.name === 'AbortError') return;
                this.showToast('Locations load nahi hui: ' + error.message, 'Alert');
                if ((!this.dailyProgressLocations || !this.dailyProgressLocations.length) && defaults.length) {
                    this.dailyProgressLocations = [...defaults];
                }
                throw error;
            }
        },
        async loadDailyProgressStockForContractor(cid, signal, forceFresh = false) {
            if (!cid) return;
            this._dpContractorStockCache = this._dpContractorStockCache || {};
            if (!forceFresh && this._dpContractorStockCache[cid]) {
                return this._dpContractorStockCache[cid];
            }
            // If full stock dataset is already loaded in memory and not forcing fresh, reuse it immediately
            const fullLoaded = typeof window !== 'undefined' && (window.__heavyDataLoaded || this.hasCustomStock) &&
                window.ContractorSapStock && window.ContractorSapStock.byContractorNorm;
            if (!forceFresh && fullLoaded) {
                this._dpContractorStockCache[cid] = { cachedFromFull: true };
                this._dpStockMemo = null;
                return this._dpContractorStockCache[cid];
            }
            const result = await this.dailyProgressRequest('stock/' + encodeURIComponent(cid), undefined, signal);
            if (signal?.aborted || cid !== this.dailyProgressContractorId) return null;
            if (typeof window !== 'undefined') {
                if (!window.ContractorSapStock || typeof window.ContractorSapStock !== 'object') {
                    window.ContractorSapStock = { byContractorNorm: {}, meta: result.meta || null };
                }
                if (!window.ContractorSapStock.byContractorNorm || typeof window.ContractorSapStock.byContractorNorm !== 'object') {
                    window.ContractorSapStock.byContractorNorm = {};
                }
                Object.assign(window.ContractorSapStock.byContractorNorm, result.byContractorNorm || {});
                if (result.meta && !window.ContractorSapStock.meta) {
                    window.ContractorSapStock.meta = result.meta;
                }
            }
            this._dpContractorStockCache[cid] = result;
            this._dpStockMemo = null;
            this.recoRevision = (this.recoRevision || 0) + 1;
            return result;
        },
        async onDailyProgressContractorChange(cid) {
            if (this.dailyProgressBusy) return;
            const previous = this.dailyProgressContractorId;
            if (previous !== cid) {
                // Cancel any in-flight contractor/location/stock/report requests immediately
                if (this._dpLoadController) {
                    try { this._dpLoadController.abort(); } catch (_) {}
                }
                this._dpLoadController = typeof AbortController === 'function' ? new AbortController() : null;
                this._dpContractorSeq = (this._dpContractorSeq || 0) + 1;
                // Reset contractor-specific state immediately so old contractor's data never flashes under new contractor
                this.dailyProgressLocationId = '';
                this.dailyProgressServerState = null;
                this.dailyProgressLocked = true;
                this.dailyProgressQuantities = {};
                this.dailyProgressManpower = { leader: 0, skilled: 0, unskilled: 0, tractor: 0, augur: 0, room: 0 };
                this.dailyProgressRemarks = '';
                this.dailyProgressEntryHistory = [];
                this.dailyProgressExportDirtyDates = [];
                this._dpStockMemo = null;
                this._dpMemo = null;
                this.dailyProgressLoadError = '';
                this.dailyProgressStockReady = false;
            }
            originalContractorChange.call(this, cid);
            if (previous !== this.dailyProgressContractorId) {
                const wanted = this.dailyProgressContractorId;
                const seq = this._dpContractorSeq;
                const signal = this._dpLoadController ? this._dpLoadController.signal : undefined;
                const defaults = (typeof window !== 'undefined' && window.DefaultFeeders && window.DefaultFeeders.list) || [];
                const cached = this._dpLocationsCache && this._dpLocationsCache[wanted];
                this.dailyProgressLocations = cached ? cached : [...defaults];
                this.dailyProgressLoading = true;
                if (typeof this.startTaskProgress === 'function') {
                    this.startTaskProgress('Loading Contractor Data', 'Stock aur locations load ho rahe hain...', 20);
                }
                try {
                    await Promise.all([
                        this.loadDailyProgressLocations(signal),
                        this.loadDailyProgressStockForContractor(wanted, signal)
                    ]);
                    if (signal?.aborted || seq !== this._dpContractorSeq || wanted !== this.dailyProgressContractorId) return;
                    if (typeof this.updateTaskProgress === 'function') {
                        this.updateTaskProgress(70, 'Selected date ki entry load ho rahi hai...');
                    }
                    if (!this.dailyProgressDirty) {
                        await this.loadDailyProgressReportForDate(this.dailyProgressDate, signal);
                    }
                    if (signal?.aborted || seq !== this._dpContractorSeq || wanted !== this.dailyProgressContractorId) return;
                    this.dailyProgressStockReady = true;
                    this._dpStockMemo = null;
                    this._dpMemo = null;
                    if (typeof this.updateTaskProgress === 'function') {
                        this.updateTaskProgress(95, 'Sheet render ho rahi hai...');
                    }
                    if (typeof this.$nextTick === 'function') await this.$nextTick();
                    if (seq === this._dpContractorSeq && wanted === this.dailyProgressContractorId) {
                        this.dailyProgressLoading = false;
                        if (typeof this.finishTaskProgress === 'function') this.finishTaskProgress();
                    }
                } catch (error) {
                    if (error && error.name === 'AbortError') return;
                    if (seq === this._dpContractorSeq && wanted === this.dailyProgressContractorId) {
                        this.dailyProgressLoadError = error.message || 'Contractor data load nahi ho saka.';
                        this.dailyProgressLoading = false;
                        if (typeof this.finishTaskProgress === 'function') this.finishTaskProgress();
                    }
                }
            }
        },
        async retryDailyProgressLoad() {
            const cid = this.dailyProgressContractorId;
            if (cid) {
                if (this._dpContractorStockCache) delete this._dpContractorStockCache[cid];
                if (this._dpLocationsCache) delete this._dpLocationsCache[cid];
            }
            this._dpStockMemo = null;
            this._dpMemo = null;
            this.dailyProgressLoadError = '';
            if (!this.dailyProgressData || !(this.dailyProgressData.contractors || []).length) {
                return this.initDailyProgress();
            }
            if (this._dpLoadController) {
                try { this._dpLoadController.abort(); } catch (_) {}
            }
            this._dpLoadController = typeof AbortController === 'function' ? new AbortController() : null;
            this._dpContractorSeq = (this._dpContractorSeq || 0) + 1;
            const seq = this._dpContractorSeq;
            const signal = this._dpLoadController ? this._dpLoadController.signal : undefined;
            this.dailyProgressLoading = true;
            this.dailyProgressStockReady = false;
            if (typeof this.startTaskProgress === 'function') {
                this.startTaskProgress('Retrying Data Load', 'Stock aur locations reload ho rahe hain...', 25);
            }
            try {
                await Promise.all([
                    this.loadDailyProgressLocations(signal),
                    this.loadDailyProgressStockForContractor(cid, signal, true)
                ]);
                if (signal?.aborted || seq !== this._dpContractorSeq) return;
                if (!this.dailyProgressDirty) await this.loadDailyProgressReportForDate(this.dailyProgressDate, signal);
                if (signal?.aborted || seq !== this._dpContractorSeq) return;
                this.dailyProgressStockReady = true;
                if (typeof this.$nextTick === 'function') await this.$nextTick();
                this.dailyProgressLoading = false;
                if (typeof this.finishTaskProgress === 'function') this.finishTaskProgress();
            } catch (error) {
                if (error && error.name === 'AbortError') return;
                this.dailyProgressLoadError = error.message || 'Retry failed. Internet/server check karein.';
                this.dailyProgressLoading = false;
                if (typeof this.finishTaskProgress === 'function') this.finishTaskProgress();
            }
        },
        async changeDailyProgressLocation(id) {
            if (this.dailyProgressBusy || this._dpPendingSave) return;
            if (this.dailyProgressDirty && !confirm('Unsaved changes chhodkar location badlein?')) return;
            this.dailyProgressLocationId = id;
            if (this.syncDailyProgressFiltersFromLocation) {
                this.syncDailyProgressFiltersFromLocation(id);
            }
            if (typeof this.startTaskProgress === 'function') {
                this.startTaskProgress('Loading Location Data', 'Entry aur history load ho rahi hai...', 35);
            }
            try {
                await Promise.all([
                    this.loadDailyProgressReportForDate(this.dailyProgressDate),
                    this.loadDailyProgressEntryHistory()
                ]);
                if (typeof this.updateTaskProgress === 'function') this.updateTaskProgress(100, 'Ready!');
            } finally {
                if (typeof this.finishTaskProgress === 'function') this.finishTaskProgress();
            }
        },
        addDailyProgressLocation() {
            return this.runDailyProgressAdmin(async () => {
                const name = String(this.dailyProgressNewLocation || '').trim();
                if (!name || !this.dailyProgressContractorId) throw new Error('Contractor aur location name chahiye.');
                if (this.dailyProgressDirty || this._dpPendingSave) throw new Error('Pending entry pehle save karein.');
                const response = await this.dailyProgressRequest('locations', { contractorId: this.dailyProgressContractorId, name });
                await this.loadDailyProgressLocations();
                this.dailyProgressNewLocation = '';
                this.changeDailyProgressLocation(response.location.id);
            });
        },
        manageDailyProgressLocation(action, allDates = false) {
            return this.runDailyProgressAdmin(async () => {
                if (!this.dailyProgressLocationId) throw new Error('Pehle location select karein.');
                if (this.dailyProgressBusy || this._dpPendingSave) throw new Error('Pending save pehle complete karein.');
                const label = this.dailyProgressLocationName();
                const cid = this.dailyProgressContractorId, locationId = this.dailyProgressLocationKey(this.dailyProgressLocationId);
                const count = (this.dailyProgressData.reports || []).filter(r => r.contractorId === this.dailyProgressContractorId && this.dailyProgressLocationKey(r.locationId) === this.dailyProgressLocationKey(this.dailyProgressLocationId)).length;
                const scope = allDates ? `ALL ${count} saved dates` : this.dailyProgressDate;
                if (!confirm(`${label} — ${scope}: ${action === 'reset' ? 'quantities, manpower aur remarks reset' : 'saved progress delete'} karein? Unsaved changes bhi hat jayengi.`)) return;
                this.invalidateDailyProgressReads();
                this.dailyProgressBusy = true;
                let failure;
                const apply = (results, complete = false) => {
                    const dates = new Set(results.map(row => row.date));
                    this.dailyProgressData.reports = (this.dailyProgressData.reports || []).filter(row => !(row.contractorId === cid && this.dailyProgressLocationKey(row.locationId) === locationId && ((allDates && complete) || dates.has(row.date))));
                    if (action === 'reset') for (const result of results) this.dailyProgressData.reports.push({ contractorId: cid, locationId, locationName: label, date: result.date, version: result.version, quantities: {}, manpower: {}, remarks: '' });
                    this.dailyProgressDirty = false; this._dpEditVersion = null;
                };
                try {
                    const result = await this.dailyProgressRequest('manage-reports', { contractorId: cid, locationId, date: this.dailyProgressDate, action, allDates });
                    apply(result.results || [], true);
                } catch (error) {
                    if (!error.results?.length) throw error;
                    apply(error.results); failure = error;
                } finally { this.dailyProgressBusy = false; }
                this.loadDailyProgressReportForDate(this.dailyProgressDate);
                await this.syncDailyProgressCloudData(true);
                await this.refreshDailyProgressStatus(false);
                if (failure) throw failure;
                this.showToast('Selected location ka progress ' + (action === 'reset' ? 'reset' : 'delete') + ' ho gaya.', 'Check');
            });
        },
        deleteDailyProgressHistoryRow(row) {
            if (!row || !row.contractorId || !row.date) return;
            return this.runDailyProgressAdmin(async () => {
                if (this.dailyProgressBusy || this._dpPendingSave) throw new Error('Pending save pehle complete karein.');
                const cid = row.contractorId;
                const locationId = this.dailyProgressLocationKey(row.locationId);
                if (!confirm(`${row.contractorName} · ${row.feederName} (${row.date}) ka data permanently delete karein?`)) return;
                this.invalidateDailyProgressReads();
                this.dailyProgressBusy = true;
                if (typeof this.startTaskProgress === 'function') this.startTaskProgress('Deleting Entry...', `${row.contractorName} · ${row.date}`, 30);
                try {
                    await this.dailyProgressRequest('manage-reports', { contractorId: cid, locationId, date: row.date, version: Number(row.report && row.report.version) || 0, action: 'delete', allDates: false });
                    if (typeof this.updateTaskProgress === 'function') this.updateTaskProgress(90, 'Updating local list...');
                    const nextReports = (this.dailyProgressData.reports || []).filter(r =>
                        r !== row.report && !(r.contractorId === cid && this.dailyProgressLocationKey(r.locationId) === locationId && r.date === row.date)
                    );
                    if (row.report) row.report.deleted = true;
                    this.dailyProgressData = { ...this.dailyProgressData, reports: nextReports };
                    if (typeof BillingStorage !== 'undefined' && typeof BillingStorage.setItem === 'function') {
                        BillingStorage.setItem('billing_daily_progress', this.dailyProgressData).catch(() => {});
                    } else if (typeof BillingStorage !== 'undefined' && typeof BillingStorage.setItemAsync === 'function') {
                        BillingStorage.setItemAsync('billing_daily_progress', JSON.stringify(this.dailyProgressData)).catch(() => {});
                    }
                    if (cid === this.dailyProgressContractorId && locationId === this.dailyProgressLocationKey(this.dailyProgressLocationId) && row.date === this.dailyProgressDate) {
                        this.dailyProgressDirty = false;
                        this._dpEditVersion = null;
                        this.loadDailyProgressReportForDate(this.dailyProgressDate);
                        this.refreshDailyProgressStatus(false).catch(() => {});
                    }
                } finally {
                    this.dailyProgressBusy = false;
                    if (typeof this.finishTaskProgress === 'function') this.finishTaskProgress();
                }
                this.showToast(`${row.date} (${row.contractorName}) ka data delete ho gaya.`, 'Check');
            });
        },
        isDailyProgressHistorySelected(key) {
            return Array.isArray(this.dailyProgressHistorySelectedKeys) && this.dailyProgressHistorySelectedKeys.includes(key);
        },
        toggleDailyProgressHistoryRow(key) {
            if (!key) return;
            const list = Array.isArray(this.dailyProgressHistorySelectedKeys) ? [...this.dailyProgressHistorySelectedKeys] : [];
            const idx = list.indexOf(key);
            if (idx >= 0) list.splice(idx, 1);
            else list.push(key);
            this.dailyProgressHistorySelectedKeys = list;
        },
        toggleAllDailyProgressHistoryRows() {
            const visibleKeys = (this.dailyProgressHistoryRows || []).map(r => r.key).filter(Boolean);
            const current = new Set(this.dailyProgressHistorySelectedKeys || []);
            const allSelected = visibleKeys.length > 0 && visibleKeys.every(k => current.has(k));
            this.dailyProgressHistorySelectedKeys = allSelected ? [] : visibleKeys;
        },
        deleteSelectedDailyProgressHistoryRows() {
            const selectedSet = new Set(this.dailyProgressHistorySelectedKeys || []);
            const targets = (this.dailyProgressHistoryRows || []).filter(r => selectedSet.has(r.key));
            if (!targets.length) {
                this.showToast('Pehle delete karne ke liye entries select karein.', 'Alert');
                return;
            }
            return this.runDailyProgressAdmin(async () => {
                if (this.dailyProgressBusy || this._dpPendingSave) throw new Error('Pending save pehle complete karein.');
                if (!confirm(`Selected ${targets.length} entries ko permanently delete karein?`)) return;
                this.invalidateDailyProgressReads();
                this.dailyProgressBusy = true;
                if (typeof this.startTaskProgress === 'function') this.startTaskProgress('Deleting Selected Entries', `0 / ${targets.length} deleted...`, 5);
                const deletedKeys = new Set();
                const deletedReports = new Set();
                const deletedSignatures = new Set();
                let currentEntryAffected = false;
                const activeCid = this.dailyProgressContractorId;
                const activeLoc = this.dailyProgressLocationKey(this.dailyProgressLocationId);
                const activeDate = this.dailyProgressDate;
                try {
                    for (let i = 0; i < targets.length; i += 20) {
                        const batch = targets.slice(i, i + 20);
                        await this.dailyProgressRequest('manage-reports', {
                            action: 'delete',
                            items: batch.map(row => ({
                                contractorId: row.contractorId,
                                locationId: this.dailyProgressLocationKey(row.locationId),
                                date: row.date,
                                version: Number(row.report && row.report.version) || 0
                            }))
                        });
                        for (const row of batch) {
                            const cid = row.contractorId;
                            const locationId = this.dailyProgressLocationKey(row.locationId);
                            deletedKeys.add(row.key);
                            if (row.report) {
                                row.report.deleted = true;
                                deletedReports.add(row.report);
                            }
                            deletedSignatures.add(cid + '|' + locationId + '|' + row.date);
                            if (cid === activeCid && locationId === activeLoc && row.date === activeDate) {
                                currentEntryAffected = true;
                            }
                        }
                        const pct = Math.min(95, Math.round((deletedKeys.size / targets.length) * 95));
                        if (typeof this.updateTaskProgress === 'function') this.updateTaskProgress(pct, `${deletedKeys.size} / ${targets.length} entries deleted...`);
                    }
                } finally {
                    if (deletedKeys.size) {
                        const nextReports = (this.dailyProgressData.reports || []).filter(r => {
                            if (r && r.deleted) return false;
                            if (deletedReports.has(r)) return false;
                            const sig = (r.contractorId || '') + '|' + this.dailyProgressLocationKey(r.locationId) + '|' + (r.date || '');
                            return !deletedSignatures.has(sig);
                        });
                        this.dailyProgressData = { ...this.dailyProgressData, reports: nextReports };
                        this.dailyProgressHistorySelectedKeys = (this.dailyProgressHistorySelectedKeys || []).filter(k => !deletedKeys.has(k));
                        if (typeof BillingStorage !== 'undefined' && typeof BillingStorage.setItem === 'function') {
                            BillingStorage.setItem('billing_daily_progress', this.dailyProgressData).catch(() => {});
                        } else if (typeof BillingStorage !== 'undefined' && typeof BillingStorage.setItemAsync === 'function') {
                            BillingStorage.setItemAsync('billing_daily_progress', JSON.stringify(this.dailyProgressData)).catch(() => {});
                        }
                        if (currentEntryAffected) {
                            this.dailyProgressDirty = false;
                            this._dpEditVersion = null;
                            this.loadDailyProgressReportForDate(this.dailyProgressDate);
                            this.refreshDailyProgressStatus(false).catch(() => {});
                        }
                    }
                    this.dailyProgressBusy = false;
                    if (typeof this.finishTaskProgress === 'function') this.finishTaskProgress();
                }
                this.showToast(`${deletedKeys.size} entries delete ho gayi.`, 'Check');
            });
        },
        startDailyProgressLocationEntry() {
            return this.runDailyProgressAdmin(async () => {
                if (!this.dailyProgressLocationId) throw new Error('Pehle location select karein.');
                if (this.dailyProgressBusy || this._dpPendingSave) throw new Error('Pending save pehle complete karein.');
                const cid = this.dailyProgressContractorId, date = this.dailyProgressDate, locationId = this.dailyProgressLocationKey(this.dailyProgressLocationId);
                this.invalidateDailyProgressReads();
                this.dailyProgressBusy = true;
                try {
                    const status = await this.dailyProgressRequest('report?contractorId=' + encodeURIComponent(cid) + '&date=' + encodeURIComponent(date));
                    if (cid !== this.dailyProgressContractorId || date !== this.dailyProgressDate || locationId !== this.dailyProgressLocationKey(this.dailyProgressLocationId)) return;
                    if (status.state === 'final') {
                        if (!confirm(`${this.dailyProgressLocationName()} — ${date}: saved entry reopen karke edit karein?`)) return;
                        await this.dailyProgressRequest('reopen', { contractorId: cid, date, locationId });
                    }
                } finally { this.dailyProgressBusy = false; }
                await this.refreshDailyProgressStatus(true);
            });
        },
        dailyProgressEntryTime(value) {
            if (!value || isNaN(Date.parse(value))) return '—';
            return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) + ' IST';
        },
        filterDailyProgressWorkers(workers, search) {
            const query = String(search || '').trim().toLowerCase();
            return (workers || []).filter(user => !query || [user.name, user.username, user.email, user.mobile].some(value => String(value || '').toLowerCase().includes(query)));
        },
        isDailyProgressWorkerExpanded(user) {
            const key = user.id || user.username;
            const expanded = this.dailyProgressWorkerExpanded || {};
            if (Object.prototype.hasOwnProperty.call(expanded, key)) return expanded[key];
            return (this.dailyProgressWorkers || []).length <= 3;
        },
        toggleDailyProgressWorker(user) {
            const key = user.id || user.username;
            const next = !this.isDailyProgressWorkerExpanded(user);
            const expanded = (this.dailyProgressWorkers || []).length > 3 ? {} : this.dailyProgressWorkerExpanded || {};
            this.dailyProgressWorkerExpanded = { ...expanded, [key]: next };
        },
        collapseDailyProgressWorker(username) {
            const user = (this.dailyProgressWorkers || []).find(row => row.username === username);
            const key = user && (user.id || user.username) || username;
            if (!key) return;
            this.dailyProgressWorkerExpanded = { ...(this.dailyProgressWorkerExpanded || {}), [key]: false };
            if (typeof this.$nextTick === 'function') this.$nextTick(() => {
                if (typeof document === 'undefined') return;
                const trigger = document.getElementById('dp-worker-toggle-' + key);
                if (trigger && trigger.offsetParent !== null) trigger.focus({ preventScroll: true });
            });
        },
        openDailyProgressLoginsTab() {
            this.dailyProgressTab = 'logins';
            return this.runDailyProgressAdmin(async () => {
                await this.loadDailyProgressLoginsAndHistory();
            });
        },
        async loadDailyProgressLoginsAndHistory() {
            try {
                const [res, directory] = await Promise.all([this.dailyProgressRequest('workers'), this.dailyProgressRequest('worker-contractors')]);
                this.dailyProgressWorkers = res.users || [];
                this.dailyProgressWorkerContractors = directory.contractors || [];
            } catch (e) {
                console.warn('Failed to load workers:', e);
            }
            await this.loadDailyProgressEntryHistory();
        },
        openAddWorkerModal() {
            this.dailyProgressWorkerSearch = '';
            this.dailyProgressWorkerForm = {
                name: '',
                email: '',
                mobile: '',
                username: '',
                password: '',
                contractorIds: [this.dailyProgressContractorId],
                reset: false
            };
            this.dailyProgressModal = 'worker';
        },
        saveDailyProgressWorker() {
            return this.runDailyProgressAdmin(async () => {
                const form = this.dailyProgressWorkerForm;
                if (form.permissionsOnly) await this.dailyProgressRequest('workers/contractors', { username: form.username, contractorIds: form.contractorIds });
                else await this.dailyProgressRequest('workers', form);
                this.dailyProgressModal = '';
                this.dailyProgressWorkerForm = { name: '', email: '', mobile: '', username: '', password: '', contractorIds: [this.dailyProgressContractorId], reset: false };
                await this.loadDailyProgressLoginsAndHistory();
                this.collapseDailyProgressWorker(form.username);
                this.showToast(form.permissionsOnly ? 'Contractors updated. User Refresh Contractors dabakar nayi list dekh sakta hai.' : 'Worker login saved.', 'Check');
            });
        },
        resetDailyProgressWorker(user) {
            this.dailyProgressWorkerSearch = '';
            this.dailyProgressWorkerForm = {
                name: user.name,
                email: user.email || '',
                mobile: user.mobile || '',
                username: user.username,
                password: '',
                contractorIds: [...(user.contractorIds || [])],
                reset: true
            };
            this.dailyProgressModal = 'worker';
        },
        assignDailyProgressWorker(user) {
            this.dailyProgressWorkerSearch = '';
            this.dailyProgressWorkerForm = {
                username: user.username, name: user.name,
                contractorIds: (user.contractorIds || []).some(id => id === '*' || id === 'all') ? ['*'] : [...(user.contractorIds || [])],
                permissionsOnly: true, reset: false
            };
            this.dailyProgressModal = 'worker';
        },
        disableDailyProgressWorker(user) {
            return this.runDailyProgressAdmin(async () => {
                if (!confirm(user.name + ' ka login disable karein?')) return;
                await this.dailyProgressRequest('workers/disable', { username: user.username });
                await this.loadDailyProgressLoginsAndHistory();
                this.collapseDailyProgressWorker(user.username);
            });
        },
        deleteDailyProgressWorker(user) {
            return this.runDailyProgressAdmin(async () => {
                if (!confirm(`Kya aap ${user.name} (${user.username}) ka login permanently DELETE karna chahte hain?\nIs user ka account poori tarah delete ho jayega.`)) return;
                await this.dailyProgressRequest('workers/delete', { username: user.username });
                await this.loadDailyProgressLoginsAndHistory();
            });
        },
        setDailyProgressEnteredFilter(mode) {
            this.dailyProgressEnteredFilterMode = mode;
            if (mode === 'custom' && !this.dailyProgressEnteredCustomFrom) {
                this.dailyProgressEnteredCustomFrom = this.dailyProgressDate || '';
                this.dailyProgressEnteredCustomTo = this.dailyProgressDate || '';
            }
        },
        openContractorMonthlySheet(contractorId, targetDate) {
            this.dailyProgressContractorId = contractorId;
            const now = new Date();
            const curYear = now.getFullYear();
            const curMonth = String(now.getMonth() + 1).padStart(2, '0');
            const curLastDay = new Date(curYear, now.getMonth() + 1, 0).getDate();

            // Always open current month sheet as requested
            this.dailyProgressExportFrom = `${curYear}-${curMonth}-01`;
            this.dailyProgressExportTo = `${curYear}-${curMonth}-${String(curLastDay).padStart(2, '0')}`;

            const dt = targetDate || this.dailyProgressDate || `${curYear}-${curMonth}-${String(now.getDate()).padStart(2, '0')}`;
            this.dailyProgressDate = dt;
            if (typeof this.loadDailyProgressReportForDate === 'function') {
                this.loadDailyProgressReportForDate(dt);
            }
            // Switch to download / export sheet view
            this.dailyProgressTab = 'download';
        },
        async loadDailyProgressEntryHistory() {
            try {
                const result = await this.dailyProgressRequest('entry-history?contractorId=' + encodeURIComponent(this.dailyProgressContractorId));
                this.dailyProgressEntryHistory = result.events || [];
            } catch (e) {
                console.warn('Failed to load entry history:', e);
            }
        },
        dailyProgressEditor() {
            if (!this._dpEditor) this._dpEditor = crypto.randomUUID() + crypto.randomUUID();
            return this._dpEditor;
        },
        async dailyProgressRequest(route, body, externalSignal) {
            if (/^(report(?:\?|$)|claim$|heartbeat$|reopen$|audit\?|entry-history\?|import$|manage-reports$)/.test(route)) {
                const locationId = this.dailyProgressLocationKey(body?.locationId ?? body?.report?.locationId ?? this.dailyProgressLocationId);
                if (body === undefined) route += (route.includes('?') ? '&' : '?') + 'locationId=' + encodeURIComponent(locationId);
                else body = { ...body, locationId };
            }
            const timeoutSignal = AbortSignal.timeout(45000);
            const signal = externalSignal
                ? (typeof AbortSignal.any === 'function' ? AbortSignal.any([externalSignal, timeoutSignal]) : externalSignal)
                : timeoutSignal;
            const response = await fetch('/api/dp-admin/' + route, {
                credentials: 'same-origin', cache: 'no-store',
                headers: { 'Content-Type': 'application/json', 'x-dp-editor': this.dailyProgressEditor() },
                ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
                signal
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw Object.assign(new Error(result.error || 'Daily Progress service unavailable'), { status: response.status, results: result.results });
            return result;
        },
        async syncDailyProgressCloudData(silent = false) {
            if (this.dailyProgressDirty || this.dailyProgressBusy || this._dpPendingSave || this._dpCloudRefreshing) return false;
            this._dpCloudRefreshing = true;
            const epoch = this._dpDataEpoch || 0;
            try {
                const response = await this.dailyProgressRequest('data');
                // An edit may have started while the network request was running.
                if (this.dailyProgressDirty || this.dailyProgressBusy || this._dpPendingSave || !response.data || epoch !== (this._dpDataEpoch || 0)) return false;
                const local = this.dailyProgressData || { contractors: [], reports: [], issues: [] };
                const merged = this.mergeDailyProgressData(local, response.data);
                // The aggregate endpoint includes both share-page and Drive reports.
                // Its confirmed copy takes precedence over a clean device cache.
                const reports = new Map();
                for (const row of response.data.reports || []) reports.set(this.dailyProgressReportKey(row), row);
                merged.reports = [...reports.values()];
                this.dailyProgressData = merged;
                this.syncDailyProgressContractorsList();
                this.loadDailyProgressReportForDate(this.dailyProgressDate);
                if (typeof BillingStorage !== 'undefined' && typeof BillingStorage.setItem === 'function') {
                    const backup = await BillingStorage.setItem('billing_daily_progress', merged);
                    if (!backup?.saved) throw new Error('Cloud entries loaded, but device backup failed. Check browser storage before editing.');
                }
                if (!silent) this.showToast('Share link ki latest entries sync ho gayi.', 'success');
                return true;
            } catch (e) {
                this.dailyProgressAccessMessage = e.message;
                if (!silent) this.showToast('Sync failed: ' + e.message, 'Alert');
                return false;
            } finally { this._dpCloudRefreshing = false; }
        },
        async ensureDailyProgressStockReady(signal) {
            const cid = this.dailyProgressContractorId;
            if (cid && typeof this.loadDailyProgressStockForContractor === 'function') {
                try {
                    const res = await this.loadDailyProgressStockForContractor(cid, signal);
                    if (res) {
                        this._dpStockMemo = null;
                        if (typeof this.syncDailyProgressContractorsList === 'function') this.syncDailyProgressContractorsList();
                        return;
                    }
                } catch (e) {
                    if (e && e.name === 'AbortError') throw e;
                }
            }
            try {
                if (this._cloudDatasetsPromise) await this._cloudDatasetsPromise;
            } catch (_) {}
            const hasStock = typeof window !== 'undefined' && window.ContractorSapStock && window.ContractorSapStock.byContractorNorm && Object.keys(window.ContractorSapStock.byContractorNorm).length > 0;
            if (!hasStock && typeof this.lazyLoadHeavyData === 'function') {
                try { await this.lazyLoadHeavyData(); } catch (_) {}
            }
            this._dpStockMemo = null;
            if (typeof this.syncDailyProgressContractorsList === 'function') {
                this.syncDailyProgressContractorsList();
            }
        },
        async initDailyProgress() {
            this.dailyProgressLoading = true;
            this.dailyProgressLoadError = '';
            this.dailyProgressStockReady = false;
            if (typeof this.startTaskProgress === 'function') {
                this.startTaskProgress('Loading Daily Progress', 'Local & master data load ho raha hai...', 15);
            }
            try {
                try { await originalInit.call(this); }
                catch (e) { this.showToast(e.message, 'Alert'); }
                try {
                    if (typeof this.updateTaskProgress === 'function') {
                        this.updateTaskProgress(35, 'Contractor stock & server data load ho raha hai...');
                    }
                    const [response] = await Promise.all([
                        this.dailyProgressRequest('data'),
                        this.ensureDailyProgressStockReady()
                    ]);
                    if (response.data) {
                        const local = this.dailyProgressData || { contractors: [], reports: [], issues: [] };
                        for (const kind of ['contractors', 'reports', 'issues']) {
                            const key = row => kind === 'reports' ? this.dailyProgressReportKey(row) : row.id;
                            const records = new Map((kind === 'reports' ? [] : local[kind] || []).map(row => [key(row), row]));
                            for (const row of response.data[kind] || []) records.set(key(row), row);
                            local[kind] = [...records.values()];
                        }
                        this.dailyProgressData = local;
                        this._dpStockMemo = null;
                        this.syncDailyProgressContractorsList();
                    }
                    if (typeof this.updateTaskProgress === 'function') {
                        this.updateTaskProgress(70, 'Access links & locations load ho rahi hain...');
                    }
                    await Promise.all([
                        this.refreshDailyProgressAccess(),
                        this.loadDailyProgressLocations(),
                        this.ensureDailyProgressStockReady()
                    ]);
                    if (typeof this.updateTaskProgress === 'function') {
                        this.updateTaskProgress(90, 'Selected entry ready ho rahi hai...');
                    }
                    if (!this.dailyProgressDirty) {
                        await this.loadDailyProgressReportForDate(this.dailyProgressDate);
                    }
                    this.dailyProgressStockReady = true;
                    this._dpStockMemo = null;
                    this._dpMemo = null;
                    if (typeof this.updateTaskProgress === 'function') {
                        this.updateTaskProgress(95, 'Sheet render ho rahi hai...');
                    }
                    if (typeof this.$nextTick === 'function') await this.$nextTick();
                } catch (e) {
                    this.dailyProgressAccessMessage = e.message;
                    this.dailyProgressLoadError = e.message || 'Data load nahi ho saka.';
                }
            } finally {
                this.dailyProgressLoading = false;
                if (typeof this.finishTaskProgress === 'function') this.finishTaskProgress();
            }
            if (!this._dpStatusTimer) this._dpStatusTimer = setInterval(() => {
                if (this.currentView === 'dailyProgress' && !this.dailyProgressBusy) {
                    if (this.dailyProgressServerState?.editable && Date.now() - (this._dpLastInput || 0) < 30000) {
                        this.dailyProgressRequest('heartbeat', { contractorId: this.dailyProgressContractorId, date: this.dailyProgressDate }).catch(() => {});
                    }
                    this.refreshDailyProgressStatus(false);
                }
            }, 20000);
        },
        loadDailyProgressReportForDate(date, signal) {
            this._dpStatusSeq = (this._dpStatusSeq || 0) + 1;
            if (this.dailyProgressLocationId !== undefined && this._dpLocationsContractor !== this.dailyProgressContractorId) {
                this.dailyProgressLocationId = ''; this.dailyProgressLocations = [];
                this.loadDailyProgressLocations(signal);
            }
            originalLoad.call(this, date);
            this.dailyProgressServerState = null;
            this._dpEditVersion = null;
            this.dailyProgressLocked = true;
            if (typeof fetch === 'function' && this.currentView === 'dailyProgress') return this.refreshDailyProgressStatus(false, signal);
        },
        async explainPendingDailyProgressSave() {
            if (!this._dpPendingSave) return;
            this.showToast('Pending save pehle retry karein; contractor/date abhi change nahi hui.', 'Alert');
        },
        async refreshDailyProgressStatus(claim = false, signal) {
            const cid = this.dailyProgressContractorId, date = this.dailyProgressDate;
            const locationId = this.dailyProgressLocationKey(this.dailyProgressLocationId);
            if (this.dailyProgressLocationId !== undefined && !this.dailyProgressLocationId) return;
            if (!cid || !date || this.dailyProgressBusy) return;
            const requestSeq = this._dpStatusSeq = (this._dpStatusSeq || 0) + 1;
            try {
                const result = claim
                    ? await this.dailyProgressRequest('claim', { contractorId: cid, date }, signal)
                    : await this.dailyProgressRequest('report?contractorId=' + encodeURIComponent(cid) + '&date=' + encodeURIComponent(date), undefined, signal);
                if (signal?.aborted || cid !== this.dailyProgressContractorId || date !== this.dailyProgressDate || locationId !== this.dailyProgressLocationKey(this.dailyProgressLocationId) || this.dailyProgressBusy || requestSeq !== this._dpStatusSeq) return;
                this.dailyProgressServerState = result;
                if (!this.dailyProgressDirty) this._dpEditVersion = result.version;
                this.dailyProgressLocked = !result.editable;
                this.dailyProgressAccessMessage = result.state === 'final' ? 'Saved entry locked hai. Admin Reopen se edit kholein.' : result.occupied ? 'Koi aur is contractor/date ki entry kar raha hai. Entry read-only hai.' : result.editable ? 'Entry reserved for this session. Final Save ke baad lock lagega.' : 'Start entry dabakar reservation lein.';
                if (!this.dailyProgressDirty && result.report) {
                    const reports = this.dailyProgressData && this.dailyProgressData.reports;
                    if (Array.isArray(reports)) {
                        const report = { ...result.report, contractorId: cid, date, locationId, version: result.version, state: result.state };
                        const index = reports.findIndex(row => row.contractorId === cid && row.date === date && this.dailyProgressLocationKey(row.locationId) === locationId);
                        if (index < 0) reports.push(report); else reports[index] = report;
                    }
                    this.dailyProgressQuantities = { ...(result.report.quantities || {}) };
                    this.dailyProgressManpower = { ...(result.report.manpower || {}) };
                    this.dailyProgressRemarks = result.report.remarks || '';
                    this.dailyProgressVersion = result.version;
                }
            } catch (e) {
                if (e && e.name === 'AbortError') return;
                this.dailyProgressLocked = true;
                this.dailyProgressAccessMessage = e.message;
            }
        },
        onDailyProgressQuantityChange(id, value) {
            if (this.dailyProgressLocked || this.dailyProgressBusy) return;
            this._dpLastInput = Date.now();
            originalQuantity.call(this, id, value);
        },
        onDailyProgressManpowerChange(id, value) {
            if (this.dailyProgressLocked || this.dailyProgressBusy) return;
            this._dpLastInput = Date.now();
            originalManpower.call(this, id, value);
        },
        async saveDailyProgressReport() {
            if (this.dailyProgressBusy) return;
            if (this.dailyProgressLocationId !== undefined && !this.dailyProgressLocationId) return this.showToast('Pehle location add ya select karein.', 'Alert');
            const cid = this.dailyProgressContractorId, date = this.dailyProgressDate;
            if (!cid || !date) return this.showToast('Contractor aur date select karein.', 'Alert');
            if (this._dpSaveTimer) {
                clearTimeout(this._dpSaveTimer);
                this._dpSaveTimer = null;
            }
            this.invalidateDailyProgressReads();
            this.dailyProgressBusy = true;
            try {
                if (!this._dpPendingSave) {
                    const status = await this.dailyProgressRequest('claim', { contractorId: cid, date });
                    if (!status.editable) throw new Error(status.state === 'final' ? 'Entry locked hai. Admin se reopen karwayein.' : 'Koi aur entry kar raha hai.');
                    if (this._dpEditVersion !== null && this._dpEditVersion !== undefined && status.version !== this._dpEditVersion) throw new Error('Newer draft mil gaya hai. Apni entries copy karke report reload karein; overwrite nahi kiya gaya.');
                    this._dpPendingSave = {
                        contractorId: cid, date, locationId: this.dailyProgressLocationKey(this.dailyProgressLocationId), version: status.version, epoch: status.epoch, requestId: crypto.randomUUID(), final: true,
                        report: { quantities: { ...this.dailyProgressQuantities }, manpower: { ...this.dailyProgressManpower }, remarks: this.dailyProgressRemarks || '' }
                    };
                }
                const pending = this._dpPendingSave;
                if (pending.contractorId !== cid || pending.date !== date || this.dailyProgressLocationKey(pending.locationId) !== this.dailyProgressLocationKey(this.dailyProgressLocationId)) throw new Error('Pehle pending report save retry karein.');
                const saved = await this.dailyProgressRequest('report', pending);
                const report = { ...pending.report, contractorId: cid, date, locationId: pending.locationId, locationName: this.dailyProgressLocationName(), version: saved.version, state: saved.state };
                const rows = this.dailyProgressData.reports;
                const idx = rows.findIndex(r => r.contractorId === cid && r.date === date && this.dailyProgressLocationKey(r.locationId) === this.dailyProgressLocationKey(pending.locationId));
                if (idx < 0) rows.push(report); else rows[idx] = report;
                this._dpPendingSave = null;
                this.dailyProgressDirty = false; this.dailyProgressVersion = saved.version; this.dailyProgressLocked = true;
                try { await this.saveDailyProgressData(); } catch { this.showToast('Drive par saved hai; device cache save nahi hua.', 'Alert'); }
                this.showToast('Google Drive par saved — entry locked.', 'Check');
            } catch (e) {
                this.showToast(e.message + ' Changes pending hain.', 'Alert');
                if ([400, 409, 423].includes(e.status)) this._dpPendingSave = null;
            } finally { this.dailyProgressBusy = false; }
        },
        async refreshDailyProgressAccess() {
            try {
                const result = await this.dailyProgressRequest('status');
                this.dailyProgressLinks = result.links;
                this.dailyProgressDriveReady = result.configured;
            } catch (e) { this.dailyProgressAccessMessage = e.message; }
        },
        runDailyProgressAdmin(action) {
            const run = () => Promise.resolve().then(action).catch(e => this.showToast(e.message, 'Alert'));
            if (!this.isAdminElevated && typeof this.checkAdminElevated === 'function') return this.checkAdminElevated(run);
            return run();
        },
        createDailyProgressLink() {
            return this.runDailyProgressAdmin(async () => {
                const c = this.dailyProgressActiveContractor;
                if (!c) throw new Error('Contractor select karein.');
                if (this.dailyProgressLinks.some(link => link.id === c.id) && !confirm('Naya link banane se purana link band ho jayega. Continue?')) return;
                const result = await this.dailyProgressRequest('links', { contractor: c });
                this.dailyProgressPublicLink = location.origin + '/daily-entry#link=' + result.token;
                await this.refreshDailyProgressAccess();
            });
        },
        disableDailyProgressLink(cid) {
            return this.runDailyProgressAdmin(async () => {
                await this.dailyProgressRequest('links/disable', { contractorId: cid });
                this.dailyProgressPublicLink = ''; await this.refreshDailyProgressAccess();
                this.showToast('Contractor public link disabled.', 'Check');
            });
        },
        reopenDailyProgressEntry() {
            return this.unlockDailyProgressEntry();
        },
        unlockDailyProgressEntry() {
            return this.runDailyProgressAdmin(async () => {
                const cid = this.dailyProgressContractorId, date = this.dailyProgressDate;
                const locationId = this.dailyProgressLocationKey(this.dailyProgressLocationId);
                if (!confirm(`Selected contractor (${cid}) / date (${date}) ki entry ko unlock karein?`)) return;
                await this.dailyProgressRequest('reopen', { contractorId: cid, date, locationId });
                this.dailyProgressLocked = false;
                const reports = this.dailyProgressData && this.dailyProgressData.reports;
                if (Array.isArray(reports)) {
                    const found = reports.find(r => r.contractorId === cid && r.date === date && this.dailyProgressLocationKey(r.locationId) === locationId);
                    if (found) found.state = 'open';
                }
                await this.refreshDailyProgressStatus(false);
                this.dailyProgressLocked = false;
                this.showToast('✅ Entry unlocked! Ab changes save kiye ja sakte hain.', 'Check');
            });
        },
        checkDailyProgressDrive() {
            return this.runDailyProgressAdmin(async () => {
                await this.dailyProgressRequest('storage-check', {});
                this.showToast('Google Drive folder aur write permission verified.', 'Check');
            });
        },
        showDailyProgressAudit() {
            return this.runDailyProgressAdmin(async () => {
                const response = await this.dailyProgressRequest('audit?contractorId=' + encodeURIComponent(this.dailyProgressContractorId) + '&date=' + this.dailyProgressDate);
                this.dailyProgressAudit = response.events;
            });
        },
        importDailyProgressHistory() {
            return this.runDailyProgressAdmin(async () => {
                if (!confirm('Existing local/historical reports ko Drive mein import aur lock karein? Already saved cloud records overwrite nahi honge.')) return;
                this.dailyProgressBusy = true;
                let count = 0;
                try {
                    for (const report of this.dailyProgressData.reports || []) {
                        const result = await this.dailyProgressRequest('import', { report, requestId: crypto.randomUUID() });
                        if (!result.skipped) count++;
                    }
                    this.showToast(count + ' historical reports imported to Drive.', 'Check');
                } finally { this.dailyProgressBusy = false; await this.refreshDailyProgressStatus(false); }
            });
        },
        async addDailyProgressIssue() {
            return this.runDailyProgressAdmin(async () => {
                const value = this.dailyProgressNewIssue;
                const quantity = Number(value.quantity);
                if (!value.itemId || !Number.isFinite(quantity) || quantity <= 0 || !this.dailyProgressContractorId) throw new Error('Valid material, contractor aur positive quantity chahiye.');
                const issue = { id: 'iss_' + crypto.randomUUID(), contractorId: this.dailyProgressContractorId, date: value.date || this.dailyProgressDate, itemId: String(value.itemId), quantity, reference: value.reference || '' };
                await this.dailyProgressRequest('auxiliary', { kind: 'issue', value: issue });
                if (!this.dailyProgressData.issues) this.dailyProgressData.issues = [];
                this.dailyProgressData.issues.push(issue);
                try { await this.saveDailyProgressData(); } catch {}
                this.dailyProgressNewIssue = { date: this.dailyProgressDate, itemId: '15', quantity: '', reference: '' };
                this.dailyProgressModal = ''; this.showToast('Material issue saved.', 'Check');
            });
        },
        async addDailyProgressContractor() {
            return this.runDailyProgressAdmin(async () => {
                const value = this.dailyProgressNewContractor;
                const name = String(value.name || '').trim();
                const id = this.normContractorId(name);
                if (!id) throw new Error('Valid contractor name chahiye.');
                const existing = this.dailyProgressData.contractors.find(c => this.normContractorId(c.id) === id);
                if (existing) { this.onDailyProgressContractorChange(existing.id); this.dailyProgressModal = ''; return; }
                const contractor = { id, name, project: value.project || '', feeder: value.feeder || '', engineer: value.engineer || '' };
                await this.dailyProgressRequest('auxiliary', { kind: 'contractor', value: contractor });
                this.dailyProgressData.contractors.push(contractor);
                if (!this.contractorsList.some(c => this.normContractorId(c.id) === id)) this.contractorsList.push({ id, name, workOrderNo: '', feederName: contractor.feeder });
                try { await this.saveDailyProgressData(); } catch {}
                this.onDailyProgressContractorChange(id);
                this.dailyProgressNewContractor = { name: '', project: '', feeder: '', engineer: '' };
                this.dailyProgressModal = ''; this.showToast('Contractor saved.', 'Check');
            });
        }
    });
})();
