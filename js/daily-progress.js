/**
 * @file Daily Progress Integration Module
 * @description Manages daily construction progress registers, material consumption,
 * manpower tracking, SAP stock linking & balance verification, and Excel reports.
 *
 * @module DailyProgressModule
 * @since v2.0
 */

window.DailyProgressModule = {
    dailyProgressLocationKey(value) { return value === 'legacy' ? '' : String(value || ''); },
    dailyProgressReportKey(row) { return row.contractorId + '|' + row.date + '|' + this.dailyProgressLocationKey(row.locationId); },
    dailyProgressLocationName(targetId) {
        const id = targetId !== undefined ? targetId : this.dailyProgressLocationId;
        if (id === 'legacy' || !id) return 'Legacy / Unassigned';
        const found = (this.dailyProgressLocations || []).find(row => row.id === id);
        if (found && found.name) return found.name;
        if (typeof window !== 'undefined' && window.DefaultFeeders) {
            const def = window.DefaultFeeders.get(id);
            if (def && def.name) return def.name;
        }
        return 'Location';
    },
    dailyProgressLocationQuery(cid) { return cid === this.dailyProgressContractorId && this.dailyProgressLocationId ? '&location=' + encodeURIComponent(this.dailyProgressLocationId) : ''; },

    dailyProgressActiveLocationObj() {
        const id = this.dailyProgressLocationId;
        if (!id || id === 'legacy') return null;
        const found = (this.dailyProgressLocations || []).find(l => l.id === id);
        if (found) return found;
        if (typeof window !== 'undefined' && window.DefaultFeeders) {
            return window.DefaultFeeders.get(id);
        }
        return null;
    },
    setDailyProgressDivision(div) {
        this.dpDivisionFilter = div || 'ALL';
        this.dpSubDivisionFilter = 'ALL';
        this.dpSubstationFilter = 'ALL';
    },
    setDailyProgressSubDivision(sub) {
        this.dpSubDivisionFilter = sub || 'ALL';
        this.dpSubstationFilter = 'ALL';
    },
    setDailyProgressSubstation(sst) {
        this.dpSubstationFilter = sst || 'ALL';
    },
    clearDailyProgressLocationFilter() {
        this.dpDivisionFilter = 'ALL';
        this.dpSubDivisionFilter = 'ALL';
        this.dpSubstationFilter = 'ALL';
        this.dpFeederSearch = '';
    },
    toggleDpLocationDropdown() {
        this.dpLocationDropdownOpen = !this.dpLocationDropdownOpen;
        if (this.dpLocationDropdownOpen) {
            this.dpLocationSearchQuery = '';
            this.$nextTick(() => {
                const el = document.getElementById('dp-location-search-input');
                if (el) el.focus();
            });
        }
    },
    closeDpLocationDropdown() {
        this.dpLocationDropdownOpen = false;
        this.dpLocationSearchQuery = '';
    },
    selectDpLocation(id) {
        this.dpLocationDropdownOpen = false;
        this.dpLocationSearchQuery = '';
        this.changeDailyProgressLocation(id);
    },
    setDailyProgressDateToday() {
        const today = this.todayDateStr || new Date().toISOString().slice(0, 10);
        this.onDailyProgressDateChange(today);
    },
    syncDailyProgressFiltersFromLocation(id) {
        if (!id || id === 'legacy') return;
        const loc = (this.dailyProgressLocations || []).find(l => l.id === id) || (typeof window !== 'undefined' && window.DefaultFeeders && window.DefaultFeeders.get(id));
        if (loc) {
            if (loc.division) this.dpDivisionFilter = loc.division;
            if (loc.subDivision) this.dpSubDivisionFilter = loc.subDivision;
            if (loc.substation) this.dpSubstationFilter = loc.substation;
        }
    },
    getFilteredDailyProgressLocations() {
        const defaults = (typeof window !== 'undefined' && window.DefaultFeeders && window.DefaultFeeders.list) || [];
        const current = Array.isArray(this.dailyProgressLocations) ? this.dailyProgressLocations : [];
        const map = new Map();
        defaults.forEach(def => map.set(def.id, { ...def }));
        current.forEach(loc => {
            if (loc && loc.id) {
                map.set(loc.id, map.has(loc.id) ? { ...map.get(loc.id), ...loc } : loc);
            }
        });
        const list = Array.from(map.values());

        let div = this.dpDivisionFilter || 'ALL';
        let sub = this.dpSubDivisionFilter || 'ALL';
        let sst = this.dpSubstationFilter || 'ALL';
        const q = String(this.dpFeederSearch || '').trim().toLowerCase();

        if (div !== 'ALL' && sub !== 'ALL') {
            const validSubs = typeof window !== 'undefined' && window.DefaultFeeders ? window.DefaultFeeders.getSubDivisions(div) : [];
            if (validSubs.length && !validSubs.includes(sub)) sub = 'ALL';
        }
        if (sst !== 'ALL') {
            const validSsts = typeof window !== 'undefined' && window.DefaultFeeders ? window.DefaultFeeders.getSubstations(div === 'ALL' ? '' : div, sub === 'ALL' ? '' : sub) : [];
            if (validSsts.length && !validSsts.includes(sst)) sst = 'ALL';
        }

        let filtered = list.filter(loc => {
            if (div !== 'ALL' && loc.division && loc.division !== div) return false;
            if (sub !== 'ALL' && loc.subDivision && loc.subDivision !== sub) return false;
            if (sst !== 'ALL' && loc.substation && loc.substation !== sst) return false;
            if (q) {
                const text = (loc.name + ' ' + (loc.division || '') + ' ' + (loc.subDivision || '') + ' ' + (loc.substation || '') + ' ' + (loc.feeder || '')).toLowerCase();
                if (!text.includes(q)) return false;
            }
            return true;
        });

        if (!filtered.length && !q) {
            filtered = list.filter(loc => div === 'ALL' || !loc.division || loc.division === div);
            if (!filtered.length) filtered = list;
        }

        return filtered;
    },
    getAvailableDailyProgressSubDivisions() {
        const div = this.dpDivisionFilter || 'ALL';
        if (typeof window !== 'undefined' && window.DefaultFeeders) {
            return window.DefaultFeeders.getSubDivisions(div === 'ALL' ? '' : div);
        }
        const set = new Set();
        (this.dailyProgressLocations || []).forEach(l => {
            if ((div === 'ALL' || l.division === div) && l.subDivision) set.add(l.subDivision);
        });
        return Array.from(set).sort();
    },
    getAvailableDailyProgressSubstations() {
        const div = this.dpDivisionFilter || 'ALL';
        const sub = this.dpSubDivisionFilter || 'ALL';
        if (typeof window !== 'undefined' && window.DefaultFeeders) {
            return window.DefaultFeeders.getSubstations(div === 'ALL' ? '' : div, sub === 'ALL' ? '' : sub);
        }
        const set = new Set();
        (this.dailyProgressLocations || []).forEach(l => {
            if ((div === 'ALL' || l.division === div) && (sub === 'ALL' || l.subDivision === sub) && l.substation) {
                set.add(l.substation);
            }
        });
        return Array.from(set).sort();
    },
    // ─── INITIALIZATION & PERSISTENCE ──────────────────────────────────────────

    async initDailyProgress() {
        if (!this.dailyProgressDate) {
            this.dailyProgressDate = this.todayDateStr || new Date().toISOString().slice(0, 10);
        }
        if (!this.dailyProgressExportFrom || this.dailyProgressExportFrom.startsWith('2026-09')) {
            this.setDailyProgressExportRange('current_month');
        }

        const localData = (async () => {
            let stored = null;
            try {
                if (typeof BillingStorage !== 'undefined' && typeof BillingStorage.getItemAsync === 'function') {
                    stored = await BillingStorage.getItemAsync('billing_daily_progress');
                    if (typeof stored === 'string') {
                        stored = JSON.parse(stored);
                    }
                }
            } catch (e) {
                console.warn('[DailyProgress] Storage load error:', e);
            }
            return stored;
        })();

        // Fetch latest cloud data to merge any reports/contractors entered via standalone link
        const cloudData = (async () => {
            try {
                if (typeof fetch === 'function') {
                    const cRes = await fetch('/api/daily-progress/data');
                    if (cRes.ok) {
                        const cData = await cRes.json();
                        if (cData && cData.success && cData.data) return cData.data;
                    }
                }
            } catch (_) { }
            return null;
        })();
        let [stored, latest] = await Promise.all([localData, cloudData]);
        const cloudLoaded = !!latest;
        if (latest) {
            stored = this.mergeDailyProgressData(stored, latest);
            stored.reports = latest.reports || [];
        }

        // Initialize with default seed data if no saved reports exist
        const seed = window.DailyProgressSeed || { contractor: {}, items: [], records: [] };
        if (!cloudLoaded && (!stored || !stored.reports || stored.reports.length === 0)) {
            const seedContractor = seed.contractor || {
                id: 'mangesh-sonwane',
                name: 'MANGESH SONWANE',
                project: 'Gadchiroli (T-10)',
                feeder: 'ANGARA',
                engineer: 'AMIT GOMASE'
            };

            const seedReports = (seed.records || []).map(r => ({
                contractorId: seedContractor.id,
                date: r.date,
                quantities: { ...(r.quantities || {}) },
                manpower: {
                    leader: Number(r.manpower && r.manpower.leader) || 0,
                    skilled: Number(r.manpower && r.manpower.skilled) || 0,
                    unskilled: Number(r.manpower && r.manpower.unskilled) || 0,
                    tractor: Number(r.manpower && r.manpower.tractor) || 0,
                    augur: Number(r.manpower && r.manpower.augur) || 0,
                    room: Number(r.manpower && r.manpower.room) || 0
                },
                remarks: r.remarks || '',
                version: 1
            }));

            this.dailyProgressData = {
                contractors: [seedContractor],
                reports: seedReports,
                issues: []
            };

            // Dual-merge contractors from Billing Pro's contractorsList
            this.syncDailyProgressContractorsList();
            await this.saveDailyProgressData();
        } else {
            this.dailyProgressData = stored;
            this.syncDailyProgressContractorsList();
        }

        // Synchronize active contractor with Billing Pro
        this.syncWithBillingProActiveContractor();

        // Load report for active date
        this.loadDailyProgressReportForDate(this.dailyProgressDate);

        // Auto-poll cloud data every 2m in background when viewing Daily Progress (avoids hammering UI/server every 15s)
        const timerFn = typeof setInterval === 'function' ? setInterval : (typeof window !== 'undefined' && typeof window.setInterval === 'function' ? window.setInterval : null);
        if (timerFn && typeof window !== 'undefined' && !window._dpAutoSyncTimer) {
            window._dpAutoSyncTimer = timerFn(() => {
                try {
                    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                        if (this.currentView === 'dailyProgress' && !this.dailyProgressDirty && !this.dailyProgressBusy) {
                            this.syncDailyProgressCloudData(true);
                        }
                    }
                } catch (_) { }
            }, 120000);
        }
    },

    syncDailyProgressContractorsList() {
        if (!this.dailyProgressData) return;
        if (!Array.isArray(this.dailyProgressData.contractors)) {
            this.dailyProgressData.contractors = [];
        }

        const sapStock = (typeof window !== 'undefined' && (window.ContractorSapStock || window.__customSapStock || window.DefaultContractorSapStock)) || null;
        if (sapStock && sapStock.byContractorNorm && Object.keys(sapStock.byContractorNorm).length > 0) {
            const defMap = new Map();
            if (Array.isArray(this.contractorsList)) {
                this.contractorsList.forEach(c => {
                    const n = this.normContractorId(c.id || c.name).replace(/eterprise/g, 'enterprise');
                    if (n && !defMap.has(n)) defMap.set(n, c);
                });
            }

            const seenNorms = new Set();
            const list = [];
            for (const [key, b] of Object.entries(sapStock.byContractorNorm)) {
                if (!b || !b.contractorName) continue;
                const name = String(b.contractorName).trim();
                const norm = this.normContractorId(name).replace(/eterprise/g, 'enterprise');
                if (!norm || seenNorms.has(norm)) continue;
                seenNorms.add(norm);
                const def = defMap.get(norm) || defMap.get(this.normContractorId(key).replace(/eterprise/g, 'enterprise'));
                const id = (def && def.id) || key;
                list.push({
                    id,
                    name,
                    project: (this.projectMeta && this.projectMeta.zone) || 'Gadchiroli (T-10)',
                    feeder: (def && (def.feederName || def.feeder)) || 'ANGARA',
                    engineer: (def && def.engineer) || 'SUPERVISOR',
                    workOrderNo: (def && def.workOrderNo) || b.docHeader || '',
                    workOrders: (b.allWorkOrders || []).join(', ')
                });
            }

            // Also preserve any contractors with saved reports
            const existingReports = this.dailyProgressData.reports || [];
            const reportCids = new Set(existingReports.map(r => this.normContractorId(r.contractorId).replace(/eterprise/g, 'enterprise')));
            (this.dailyProgressData.contractors || []).forEach(c => {
                const norm = this.normContractorId(c.id || c.name).replace(/eterprise/g, 'enterprise');
                if (norm && reportCids.has(norm) && !seenNorms.has(norm)) {
                    seenNorms.add(norm);
                    list.push(c);
                }
            });

            this.dailyProgressData.contractors = list.sort((a, b) => a.name.localeCompare(b.name));
            return;
        }

        // Fallback only if no SAP stock is loaded at all
        const existingKeys = new Set(this.dailyProgressData.contractors.map(c => this.normContractorId(c.id || c.name)));
        if (Array.isArray(this.contractorsList)) {
            this.contractorsList.forEach(c => {
                const norm = this.normContractorId(c.id || c.name);
                if (norm && !existingKeys.has(norm)) {
                    existingKeys.add(norm);
                    this.dailyProgressData.contractors.push({
                        id: c.id,
                        name: c.name,
                        project: this.projectMeta && this.projectMeta.zone || 'Gadchiroli (T-10)',
                        feeder: c.feederName || 'ANGARA',
                        engineer: 'SUPERVISOR'
                    });
                }
            });
        }
    },

    normContractorId(id) {
        if (!id) return '';
        return String(id).toLowerCase().replace(/^m\/s\.?\s*/i, '').replace(/[^a-z0-9]/g, '');
    },

    syncWithBillingProActiveContractor() {
        if (!this.dailyProgressData || !this.dailyProgressData.contractors) return;
        const activeId = this.selectedContractorId;
        const activeName = this.selectedContractorName;

        let matched = null;
        if (activeId && activeId !== 'custom') {
            const rawId = this.normContractorId(activeId);
            matched = this.dailyProgressData.contractors.find(c => this.normContractorId(c.id) === rawId);
        }
        if (!matched && activeName) {
            const rawName = this.normContractorId(activeName);
            matched = this.dailyProgressData.contractors.find(c => this.normContractorId(c.name) === rawName);
        }

        const prevCid = this.dailyProgressContractorId;
        if (matched && matched.id !== prevCid && (this.dailyProgressDirty || this._dpPendingSave)) {
            this.showToast('Daily Progress ki pending entry pehle save karein.', 'Alert');
            return;
        }
        if (matched) {
            this.dailyProgressContractorId = matched.id;
        }

        // If contractor changed or quantities not loaded yet, immediately reload report for current date
        if (this.dailyProgressContractorId !== prevCid || !this.dailyProgressQuantities) {
            this.loadDailyProgressReportForDate(this.dailyProgressDate || new Date().toISOString().slice(0, 10));
        }
    },

    mergeDailyProgressData(local, cloud) {
        if (!cloud) return local;
        if (!local) return cloud;
        const res = { ...local };
        // Merge contractors
        const cMap = new Map();
        (local.contractors || []).forEach(c => cMap.set(this.normContractorId(c.name || c.id), c));
        (cloud.contractors || []).forEach(c => {
            const n = this.normContractorId(c.name || c.id);
            if (n && !cMap.has(n)) cMap.set(n, c);
        });
        res.contractors = Array.from(cMap.values());

        // Merge reports (prefer highest version or newest update)
        const rMap = new Map();
        (local.reports || []).forEach(r => rMap.set(this.dailyProgressReportKey(r), r));
        (cloud.reports || []).forEach(r => {
            const key = this.dailyProgressReportKey(r);
            const existing = rMap.get(key);
            if (!existing || (Number(r.version || 0) >= Number(existing.version || 0))) {
                rMap.set(key, r);
            }
        });
        res.reports = Array.from(rMap.values());

        // Merge issues
        const iMap = new Map();
        (local.issues || []).forEach(i => iMap.set(i.id || (i.contractorId + '|' + i.itemId + '|' + i.date), i));
        (cloud.issues || []).forEach(i => {
            const key = i.id || (i.contractorId + '|' + i.itemId + '|' + i.date);
            if (!iMap.has(key)) iMap.set(key, i);
        });
        res.issues = Array.from(iMap.values());
        return res;
    },

    async saveDailyProgressData(syncCloud = true) {
        if (!this.dailyProgressData) return false;
        if (typeof BillingStorage !== 'undefined' && typeof BillingStorage.setItem === 'function') {
            const result = await BillingStorage.setItem('billing_daily_progress', this.dailyProgressData);
            if (result && result.saved === false) throw new Error('Device storage failed. Changes abhi save nahi hue.');
        } else if (typeof localStorage !== 'undefined') {
            localStorage.setItem('billing_daily_progress', JSON.stringify(this.dailyProgressData));
        } else {
            throw new Error('Device storage unavailable');
        }

        // Automatic background cloud sync so standalone shared links reflect latest changes
        try {
            if (syncCloud && typeof fetch === 'function') {
                const cloudSync = fetch('/api/daily-progress/data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.dailyProgressData)
                }).catch(e => console.info('[DailyProgress] Cloud auto-sync notice:', e.message));
                await cloudSync;
            }
        } catch (_) { }

        return true;
    },

    async syncDailyProgressCloudData(silent = false) {
        try {
            if (typeof fetch === 'function') {
                const cRes = await fetch('/api/daily-progress/data?t=' + Date.now());
                if (cRes.ok) {
                    const cData = await cRes.json();
                    if (cData && cData.success && cData.data) {
                        this.dailyProgressData = this.mergeDailyProgressData(this.dailyProgressData, cData.data);
                        if (typeof BillingStorage !== 'undefined' && typeof BillingStorage.setItem === 'function') {
                            await BillingStorage.setItem('billing_daily_progress', this.dailyProgressData);
                        }
                        this.loadDailyProgressReportForDate(this.dailyProgressDate);
                        if (!silent && typeof this.showToast === 'function') {
                            this.showToast('Daily Progress data cloud se sync ho gaya! ✅', 'success');
                        }
                        return true;
                    }
                }
            }
        } catch (e) {
            if (!silent && typeof this.showToast === 'function') {
                this.showToast('Sync warning: ' + (e.message || 'Network issue'), 'warning');
            }
        }
        return false;
    },

    // ─── DAILY PROGRESS NAVIGATION & STATE ────────────────────────────────────

    toggleDailyProgressContractorDropdown() {
        this.dailyProgressContractorDropdownOpen = !this.dailyProgressContractorDropdownOpen;
        if (this.dailyProgressContractorDropdownOpen) {
            this.dailyProgressContractorSearch = '';
            if (typeof this.$nextTick === 'function') {
                this.$nextTick(() => {
                    if (this.$refs.dpContractorSearchInput) {
                        this.$refs.dpContractorSearchInput.focus();
                    }
                });
            }
        }
    },

    closeDailyProgressContractorDropdown() {
        this.dailyProgressContractorDropdownOpen = false;
        this.dailyProgressContractorSearch = '';
    },

    selectDailyProgressContractor(cid) {
        this.dailyProgressContractorSearch = '';
        this.closeDailyProgressContractorDropdown();
        this.onDailyProgressContractorChange(cid);
    },

    onDailyProgressContractorChange(cid) {
        if (this._dpPendingSave) { this.explainPendingDailyProgressSave(); return; }
        const hasConfirm = typeof confirm === 'function' ? confirm : (typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm : null);
        if (this.dailyProgressDirty && hasConfirm && !hasConfirm('Aapke paas unsaved badlav hain. Badlav chhod kar doosra contractor select karein?')) {
            return;
        }
        this.dailyProgressContractorId = cid;

        // Also sync Billing Pro header if matching contractor exists
        const norm = this.normContractorId(cid);
        const firm = (this.contractorsList || []).find(c => this.normContractorId(c.id) === norm || this.normContractorId(c.name) === norm);
        if (firm) {
            this.selectedContractorId = firm.id;
            this.selectedContractorName = firm.name;
        }

        this.loadDailyProgressReportForDate(this.dailyProgressDate);
    },

    onDailyProgressDateChange(newDate) {
        if (this._dpPendingSave) { this.explainPendingDailyProgressSave(); return; }
        if (!newDate) return;
        if (this.dailyProgressDirty && !confirm('Aapke paas unsaved badlav hain. Badlav chhod kar doosri date select karein?')) {
            return;
        }
        if (!this.dailyProgressLocationId) {
            this.dailyProgressLocationId = (this.dailyProgressLocations && this.dailyProgressLocations.length === 1) ? this.dailyProgressLocations[0].id : 'legacy';
        }
        this.dailyProgressDate = newDate;
        this.loadDailyProgressReportForDate(newDate);
    },

    navigateDailyProgressDay(delta) {
        if (this._dpPendingSave) { this.explainPendingDailyProgressSave(); return; }
        if (this.dailyProgressDirty && !confirm('Aapke paas unsaved badlav hain. Badlav chhod kar aage badhein?')) {
            return;
        }
        if (!this.dailyProgressLocationId) {
            this.dailyProgressLocationId = (this.dailyProgressLocations && this.dailyProgressLocations.length === 1) ? this.dailyProgressLocations[0].id : 'legacy';
        }
        const cur = new Date(this.dailyProgressDate || new Date());
        cur.setDate(cur.getDate() + delta);
        const ymd = cur.toISOString().slice(0, 10);
        this.dailyProgressDate = ymd;
        this.loadDailyProgressReportForDate(ymd);
    },

    normalizeDailyProgressDate(d) {
        if (!d) return '';
        const str = String(d).trim();
        const m = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
        if (m) {
            return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
        }
        return str;
    },

    syncCurrentDailyProgressDraft() {
        if (this.dailyProgressLocationId !== undefined && !this.dailyProgressLocationId) return null;
        if (!this.dailyProgressData) this.dailyProgressData = { contractors: [], reports: [], issues: [] };
        if (!Array.isArray(this.dailyProgressData.reports)) this.dailyProgressData.reports = [];

        const cid = this.dailyProgressContractorId;
        const dt = this.normalizeDailyProgressDate(this.dailyProgressDate);
        if (!cid || !dt) return null;

        const cleanQ = {};
        for (const [k, v] of Object.entries(this.dailyProgressQuantities || {})) {
            const num = Number(v);
            if (num > 0) {
                cleanQ[k] = Math.round(num * 1000) / 1000;
            }
        }

        const cleanMan = {
            leader: Math.max(0, Math.round(Number(this.dailyProgressManpower && this.dailyProgressManpower.leader || 0))),
            skilled: Math.max(0, Math.round(Number(this.dailyProgressManpower && this.dailyProgressManpower.skilled || 0))),
            unskilled: Math.max(0, Math.round(Number(this.dailyProgressManpower && this.dailyProgressManpower.unskilled || 0))),
            tractor: Math.max(0, Math.round(Number(this.dailyProgressManpower && this.dailyProgressManpower.tractor || 0) * 100) / 100),
            augur: Math.max(0, Math.round(Number(this.dailyProgressManpower && this.dailyProgressManpower.augur || 0) * 100) / 100),
            room: Math.max(0, Math.round(Number(this.dailyProgressManpower && this.dailyProgressManpower.room || 0) * 100) / 100)
        };

        const reports = this.dailyProgressData.reports;
        const normC = this.normContractorId(cid);

        const existingIdx = reports.findIndex(r => {
            const rNormC = this.normContractorId(r.contractorId);
            const rNormD = this.normalizeDailyProgressDate(r.date);
            return (r.contractorId === cid || rNormC === normC) && (r.date === dt || rNormD === dt) && this.dailyProgressLocationKey(r.locationId) === this.dailyProgressLocationKey(this.dailyProgressLocationId);
        });

        const currentVer = Math.max(1, Number(this.dailyProgressVersion || 0));
        const reportPayload = {
            contractorId: cid,
            date: dt,
            locationId: this.dailyProgressLocationKey(this.dailyProgressLocationId),
            locationName: this.dailyProgressLocationName(),
            quantities: cleanQ,
            manpower: cleanMan,
            remarks: String(this.dailyProgressRemarks || '').trim(),
            version: existingIdx >= 0 ? Math.max(currentVer, Number(reports[existingIdx].version || 0) + 1) : currentVer,
            updatedAt: new Date().toISOString()
        };

        if (existingIdx >= 0) {
            reports[existingIdx] = reportPayload;
        } else {
            reports.push(reportPayload);
        }
        this.dailyProgressVersion = reportPayload.version;
        return reportPayload;
    },

    debouncedSaveDailyProgressData() {
        if (typeof setTimeout !== 'function') return;
        if (this._dpSaveTimer) clearTimeout(this._dpSaveTimer);
        this._dpSaveTimer = setTimeout(async () => {
            try {
                this.syncCurrentDailyProgressDraft();
                await this.saveDailyProgressData();
            } catch (e) {
                console.info('[DailyProgress] Debounced auto-save notice:', e.message);
            }
        }, 500);
    },

    loadDailyProgressReportForDate(date) {
        const cid = this.dailyProgressContractorId;
        const normD = this.normalizeDailyProgressDate(date);
        const normC = this.normContractorId(cid);
        const reports = (this.dailyProgressData && this.dailyProgressData.reports) || [];
        const matchingReps = reports.filter(rep => {
            const repNormC = this.normContractorId(rep.contractorId);
            const repNormD = this.normalizeDailyProgressDate(rep.date);
            return (rep.contractorId === cid || repNormC === normC) && (rep.date === date || repNormD === normD) && this.dailyProgressLocationKey(rep.locationId) === this.dailyProgressLocationKey(this.dailyProgressLocationId);
        });

        matchingReps.sort((a, b) => {
            return Number(b.version || 0) - Number(a.version || 0) ||
                (Date.parse(b.savedAt || b.updatedAt || '') || 0) - (Date.parse(a.savedAt || a.updatedAt || '') || 0);
        });

        const r = matchingReps[0];

        if (r) {
            this.dailyProgressQuantities = { ...(r.quantities || {}) };
            this.dailyProgressManpower = {
                leader: Number(r.manpower && r.manpower.leader) || 0,
                skilled: Number(r.manpower && r.manpower.skilled) || 0,
                unskilled: Number(r.manpower && r.manpower.unskilled) || 0,
                tractor: Number(r.manpower && r.manpower.tractor) || 0,
                augur: Number(r.manpower && r.manpower.augur) || 0,
                room: Number(r.manpower && r.manpower.room) || 0
            };
            this.dailyProgressRemarks = r.remarks || '';
            this.dailyProgressVersion = r.version || 1;
            this.dailyProgressLocked = r.state !== 'open';
        } else {
            this.dailyProgressQuantities = {};
            this.dailyProgressManpower = {
                leader: 0,
                skilled: 0,
                unskilled: 0,
                tractor: 0,
                augur: 0,
                room: 0
            };
            this.dailyProgressRemarks = '';
            this.dailyProgressVersion = 0;
            this.dailyProgressLocked = false;
        }
        this.dailyProgressDirty = false;
    },

    onDailyProgressQuantityChange(itemId, val) {
        const num = val === '' ? 0 : Number(val);
        if (isNaN(num) || num < 0) return;
        // Vue 3 compatible reactive assignment (avoids non-existent this.$set)
        const qMap = { ...(this.dailyProgressQuantities || {}) };
        if (num > 0) {
            qMap[itemId] = num;
        } else {
            delete qMap[itemId];
        }
        this.dailyProgressQuantities = qMap;
        this.dailyProgressDirty = true;
        this.syncCurrentDailyProgressDraft();
        this.debouncedSaveDailyProgressData();
    },

    onDailyProgressManpowerChange(key, val) {
        const num = val === '' ? 0 : Math.max(0, Number(val) || 0);
        // Vue 3 compatible reactive assignment (avoids non-existent this.$set)
        const mMap = { ...(this.dailyProgressManpower || {}) };
        mMap[key] = num;
        this.dailyProgressManpower = mMap;
        this.dailyProgressDirty = true;
        this.syncCurrentDailyProgressDraft();
        this.debouncedSaveDailyProgressData();
    },

    async saveDailyProgressReport() {
        if (!this.dailyProgressContractorId) {
            this.showToast('Please select a contractor first.', 'Alert');
            return;
        }
        if (!this.dailyProgressDate) {
            this.showToast('Please select a valid work date.', 'Alert');
            return;
        }

        if (this._dpSaveTimer) {
            clearTimeout(this._dpSaveTimer);
            this._dpSaveTimer = null;
        }
        const previousVersion = this.dailyProgressVersion;
        const previousReports = [...(this.dailyProgressData && this.dailyProgressData.reports || [])];
        this.dailyProgressBusy = true;
        try {
            const dt = this.normalizeDailyProgressDate(this.dailyProgressDate);
            const reportPayload = this.syncCurrentDailyProgressDraft();
            if (!reportPayload) {
                this.showToast('Pehle Feeder / Location select karein.', 'Alert');
                return;
            }
            await this.saveDailyProgressData();
            this.dailyProgressDirty = false;
            this.dailyProgressVersion = reportPayload.version;
            this.showToast(`Daily Progress Saved! (${this.formatDisplayDate(dt)})`, 'Check');
        } catch (e) {
            this.dailyProgressVersion = previousVersion;
            this.dailyProgressData.reports = previousReports;
            this.dailyProgressDirty = true;
            console.error('[DailyProgress] Save failed:', e);
            this.showToast('Failed to save daily progress: ' + (e.message || e), 'Alert');
        } finally {
            this.dailyProgressBusy = false;
        }
    },

    // ─── STOCK & CONSUMPTION LINKING ──────────────────────────────────────────

    /**
     * Calculates SAP stock issued, manual issues, consumption to-date, and available balance
     * for any item in the daily progress register.
     */
    getDailyProgressItemStock(item) {
        if (!item) return { sapIssued: 0, manualIssued: 0, totalIssued: 0, totalConsumed: 0, balance: 0, status: 'none' };

        const cid = this.dailyProgressContractorId;
        if (!cid) return { sapIssued: 0, manualIssued: 0, totalIssued: 0, totalConsumed: 0, balance: 0, status: 'awaiting_stock' };
        const curDate = this.dailyProgressDate || new Date().toISOString().slice(0, 10);
        const code = String(item.code || '').trim();

        const issues = (this.dailyProgressData && this.dailyProgressData.issues) || [];
        const reports = (this.dailyProgressData && this.dailyProgressData.reports) || [];
        const sapRoot = (typeof window !== 'undefined' && (window.ContractorSapStock || window.__customSapStock || window.DefaultContractorSapStock)) || null;

        // Memoize contractor-level SAP lookup across all 180+ item rows (avoids 500x Proxy/SAP scans per render)
        const memo = this._dpStockMemo;
        if (!memo || memo.cid !== cid || memo.curDate !== curDate || memo.sapRoot !== sapRoot) {
            const contractorSap = (typeof this.getContractorSapIssues === 'function')
                ? this.getContractorSapIssues.call(new Proxy(this, {
                    get(target, key) {
                        if (key === 'stockAsOnDate') return curDate;
                        if (key === 'selectedContractorId') return cid;
                        const team = (target.dailyProgressData?.contractors || []).find(c => c.id === cid);
                        if (key === 'selectedContractorName') return team?.name || '';
                        if (key === 'invoiceData' || key === 'projectMeta') return { ...(target[key] || {}), workOrderNo: '', contractorName: team?.name || '' };
                        return Reflect.get(target, key);
                    },
                    set(target, key, value) { if (String(key).startsWith('_memoContractorSap')) return true; return Reflect.set(target, key, value); }
                })) : null;
            this._dpStockMemo = { cid, curDate, sapRoot, contractorSap };
        }

        const { contractorSap } = this._dpStockMemo;

        // 1. SAP Stock Issued to Active Contractor strictly filtered up to curDate (Work Date)
        let sapIssued = 0;
        if (contractorSap && contractorSap.materials && code && contractorSap.materials[code]) {
            const m = contractorSap.materials[code];
            if (Array.isArray(m.txns) && m.txns.length > 0) {
                let mGross = 0;
                let mMrn = 0;
                for (const [dt, g, mrn] of m.txns) {
                    if (dt && dt <= curDate) {
                        mGross += Number(g || 0);
                        mMrn += Number(mrn || 0);
                    }
                }
                sapIssued = Math.round((mGross - mMrn) * 1000) / 1000;
            } else if (m.daily && typeof m.daily === 'object') {
                let mGross = 0;
                let mMrn = 0;
                for (const [dt, arr] of Object.entries(m.daily)) {
                    if (dt && dt <= curDate) {
                        mGross += Number((arr && arr[0]) || 0);
                        mMrn += Number((arr && arr[1]) || 0);
                    }
                }
                sapIssued = Math.round((mGross - mMrn) * 1000) / 1000;
            } else {
                sapIssued = Number(m.netIssue !== undefined ? m.netIssue : (m.issuedQty || 0));
            }
        }

        // 2. Manual stock issues recorded in Daily Progress
        const manualIssued = issues
            .filter(iss => iss.contractorId === cid && iss.itemId === item.id && (!iss.date || iss.date <= curDate))
            .reduce((sum, iss) => sum + (Number(iss.quantity) || 0), 0);

        const totalIssued = Math.round((sapIssued + manualIssued) * 1000) / 1000;

        // 3. Material consumed across saved daily reports up to curDate
        const totalConsumed = reports
            .filter(r => r.contractorId === cid && r.date <= curDate)
            .reduce((sum, r) => sum + (Number(r.quantities && r.quantities[item.id]) || 0), 0);

        const balance = Math.round((totalIssued - totalConsumed) * 1000) / 1000;

        let status = 'none';
        if (totalIssued > 0) {
            if (balance > 0) status = 'in_stock';
            else if (balance === 0) status = 'zero';
            else status = 'overconsumed';
        } else if (totalConsumed > 0) {
            status = 'untracked_consumption';
        } else {
            status = 'awaiting_stock';
        }

        return {
            sapIssued,
            manualIssued,
            totalIssued,
            totalConsumed: Math.round(totalConsumed * 1000) / 1000,
            balance,
            status
        };
    },

    // ─── ISSUE TRANSACTIONS & CONTRACTOR MANAGEMENT ───────────────────────────

    async addDailyProgressIssue() {
        const iss = this.dailyProgressNewIssue;
        if (!iss.itemId || !iss.quantity || Number(iss.quantity) <= 0) {
            this.showToast('Please enter a valid material and positive quantity.', 'Alert');
            return;
        }

        const cid = this.dailyProgressContractorId;
        const newRecord = {
            id: 'iss_' + Date.now(),
            contractorId: cid,
            date: iss.date || this.dailyProgressDate || this.todayDateStr,
            itemId: String(iss.itemId),
            quantity: Math.round(Number(iss.quantity) * 1000) / 1000,
            reference: String(iss.reference || '').trim()
        };

        if (!this.dailyProgressData.issues) this.dailyProgressData.issues = [];
        this.dailyProgressData.issues.push(newRecord);
        await this.saveDailyProgressData();

        this.dailyProgressNewIssue = {
            date: this.dailyProgressDate || this.todayDateStr,
            itemId: '15',
            quantity: '',
            reference: ''
        };
        this.dailyProgressModal = '';
        this.showToast('Material issue recorded successfully!', 'Check');
    },

    async addDailyProgressContractor() {
        const c = this.dailyProgressNewContractor;
        if (!c.name || !c.name.trim()) {
            this.showToast('Please enter contractor name.', 'Alert');
            return;
        }

        const cleanName = c.name.trim();
        const id = this.normContractorId(cleanName);
        const existing = this.dailyProgressData.contractors.find(x => this.normContractorId(x.id) === id);
        if (existing) {
            this.showToast('Contractor with this name already exists.', 'Alert');
            this.dailyProgressContractorId = existing.id;
            this.dailyProgressModal = '';
            return;
        }

        const newC = {
            id,
            name: cleanName,
            project: c.project || 'Gadchiroli (T-10)',
            feeder: c.feeder || 'ANGARA',
            engineer: c.engineer || 'SUPERVISOR'
        };

        this.dailyProgressData.contractors.push(newC);

        // Also add to Billing Pro contractorsList
        if (Array.isArray(this.contractorsList) && !this.contractorsList.some(k => this.normContractorId(k.id) === id)) {
            this.contractorsList.push({
                id,
                name: cleanName,
                workOrderNo: '',
                feederName: newC.feeder
            });
        }

        await this.saveDailyProgressData();
        this.dailyProgressContractorId = id;
        this.dailyProgressNewContractor = { name: '', project: 'Gadchiroli (T-10)', feeder: '', engineer: '' };
        this.dailyProgressModal = '';
        this.showToast(`Contractor "${cleanName}" added successfully!`, 'Check');
    },

    // ─── EXCEL REPORT EXPORT ──────────────────────────────────────────────────

    getDailyProgressExportFeederName() {
        const id = this.dailyProgressLocationId;
        const location = (this.dailyProgressLocations || []).find(row => row.id === id) ||
            (window.DefaultFeeders && window.DefaultFeeders.get(id));
        const contractor = (this.dailyProgressData?.contractors || []).find(row => row.id === this.dailyProgressContractorId);
        return (location && (location.feeder || location.feederName || location.name)) ||
            (contractor && (contractor.feeder || contractor.feederName)) || '';
    },

    async downloadDailyProgressExcel() {
        if (this.dailyProgressDirty) {
            this.showToast('Pehle daily progress save karein, phir Excel download karein.', 'Alert');
            return;
        }

        const from = this.dailyProgressExportFrom;
        const to = this.dailyProgressExportTo;
        if (!from || !to || from > to) {
            this.showToast('Kripya valid From aur To date chunein.', 'Alert');
            return;
        }

        this.dailyProgressBusy = true;
        this.showToast('Excel report generate ho raha hai...', '⏳');

        try {
            const cid = this.dailyProgressContractorId;
            const contractor = (this.dailyProgressData && this.dailyProgressData.contractors || []).find(c => c.id === cid) || {
                name: this.selectedContractorName || 'Contractor',
                project: 'Gadchiroli (T-10)',
                feeder: '',
                engineer: 'SUPERVISOR'
            };

            const seedItems = (window.DailyProgressSeed && window.DailyProgressSeed.items) || [];

            // Calculate date range list
            const days = [];
            for (let d = new Date(from + 'T00:00:00Z'); d <= new Date(to + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
                days.push(d.toISOString().slice(0, 10));
            }

            if (!days.length || days.length > 366) {
                throw new Error('1 se 366 dino ka date range chunein.');
            }
            const reportsByDate = new Map(days.map(date => [date, this.getDailyProgressDayReport(date)]));

            // Load template
            let templateBuffer = null;
            try {
                const res = await fetch('/api/daily-progress/template');
                if (res.ok) {
                    templateBuffer = await res.arrayBuffer();
                } else {
                    const res2 = await fetch('/api/daily-progress/template');
                    if (res2.ok) templateBuffer = await res2.arrayBuffer();
                }
            } catch (e) {
                console.warn('[DailyProgress] Fetch template error:', e);
            }

            if (!window.ExcelJS) {
                throw new Error('ExcelJS library load nahi hai. Page refresh karein.');
            }

            const workbook = new window.ExcelJS.Workbook();
            if (templateBuffer) {
                await workbook.xlsx.load(templateBuffer);
            }

            const baseWorksheet = workbook.worksheets[0];
            const templateModel = baseWorksheet ? JSON.parse(JSON.stringify(baseWorksheet.model)) : null;
            const getColLetter = (i) => i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + i - 26);

            // Chunk days into groups of 30 days per sheet
            for (let start = 0, sheetIdx = 1; start < days.length; start += 30, sheetIdx++) {
                const chunk = days.slice(start, start + 30);
                let ws;
                if (sheetIdx === 1 && baseWorksheet) {
                    ws = baseWorksheet;
                    ws.name = `Progress 1`;
                } else if (baseWorksheet) {
                    ws = workbook.addWorksheet(`Progress ${sheetIdx}`);
                    ws.model = { ...JSON.parse(JSON.stringify(templateModel)), id: ws.id, name: `Progress ${sheetIdx}`, mergeCells: templateModel.merges };
                } else {
                    ws = workbook.addWorksheet(`Progress ${sheetIdx}`);
                }

                // Header metadata & clean sheet formatting
                ws.getCell('A2').value = 'PROJECT NAME: ' + (contractor.project || 'Gadchiroli (T-10)');
                ws.getCell('A3').value = 'FEEDER: ' + (this.getDailyProgressExportFeederName() || 'Unassigned') + ' | LOCATION: ' + this.dailyProgressLocationName();
                ws.getCell('A4').value = 'NAME OF DEPT. LABOUR TEAM: ' + (contractor.name || '');
                ws.getCell('A5').value = 'NAME OF ENGINEER/SUPERVISOR: ' + (contractor.engineer || '');
                ['A2', 'A3', 'A4', 'A5'].forEach(addr => {
                    const hc = ws.getCell(addr);
                    hc.font = { ...(hc.font || {}), bold: true, size: 10 };
                    hc.alignment = { vertical: 'middle', horizontal: 'left' };
                });
                ws.views = [{ state: 'frozen', xSplit: 4, ySplit: 7 }];
                ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
                if (ws.getColumn(3)) ws.getColumn(3).width = Math.max(ws.getColumn(3).width || 0, 42);
                if (ws.getColumn(35)) ws.getColumn(35).width = Math.max(ws.getColumn(35).width || 0, 14);
                if (ws.getColumn(36)) ws.getColumn(36).width = Math.max(ws.getColumn(36).width || 0, 28);

                const thinBorder = { top: { style: 'thin', color: { argb: 'FFD1D5DB' } }, left: { style: 'thin', color: { argb: 'FFD1D5DB' } }, bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } }, right: { style: 'thin', color: { argb: 'FFD1D5DB' } } };
                const totalFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
                const grandTotalFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
                const headerTotalBorder = { top: { style: 'thin', color: { argb: 'FF94A3B8' } }, left: { style: 'thin', color: { argb: 'FF94A3B8' } }, bottom: { style: 'medium', color: { argb: 'FF475569' } }, right: { style: 'thin', color: { argb: 'FF94A3B8' } } };

                ws.getCell('C6').value = 'TOTAL MANPOWER';
                ws.getCell('C6').font = { ...(ws.getCell('C6').font || {}), bold: true, size: 10 };
                ws.getCell('D6').value = 'Nos';
                ws.getCell('D6').alignment = { vertical: 'middle', horizontal: 'center' };
                ['AI7', 'AI14'].forEach(addr => {
                    const c = ws.getCell(addr);
                    c.value = 'TOTAL';
                    c.font = { ...(c.font || {}), bold: true, size: 10, color: { argb: 'FF1E3A8A' } };
                    c.alignment = { vertical: 'middle', horizontal: 'center' };
                    c.fill = totalFill;
                    c.border = headerTotalBorder;
                });
                ['AJ7', 'AJ14'].forEach(addr => {
                    const c = ws.getCell(addr);
                    c.value = 'NOTES / REMARKS';
                    c.font = { ...(c.font || {}), bold: true, size: 10 };
                    c.alignment = { vertical: 'middle', horizontal: 'center' };
                });

                // Clear all dynamic data cells across all 30 day columns (E to AH) to remove any template dummy values
                for (let c = 0; c < 30; c++) {
                    const colLetter = getColLetter(c + 4);
                    if (ws.getColumn(c + 5)) ws.getColumn(c + 5).hidden = c >= chunk.length;
                    ws.getCell(colLetter + '6').value = null;
                    ws.getCell(colLetter + '7').value = null;
                    for (let mpR = 8; mpR <= 13; mpR++) {
                        ws.getCell(colLetter + mpR).value = null;
                    }
                    seedItems.forEach(it => {
                        ws.getCell(colLetter + it.row).value = null;
                    });
                }

                // Fill days and manpower
                let chunkManpowerGrandTotal = 0;
                const chunkMpTotals = { leader: 0, skilled: 0, unskilled: 0, tractor: 0, augur: 0, room: 0 };
                const dayMaterialTotals = new Array(chunk.length).fill(0);
                chunk.forEach((date, i) => {
                    const colLetter = getColLetter(i + 4); // Col E = 4 (0-based)
                    if (ws.getColumn(i + 5)) ws.getColumn(i + 5).width = Math.max(ws.getColumn(i + 5).width || 0, 10);
                    const r = reportsByDate.get(date);
                    const m = (r && r.manpower) || {};

                    // Date serial in Row 7
                    const dtObj = new Date(date + 'T00:00:00Z');
                    const serial = Math.round((dtObj.getTime() - Date.UTC(1899, 11, 30)) / 86400000);
                    const dtCell = ws.getCell(colLetter + '7');
                    dtCell.value = serial;
                    dtCell.numFmt = 'dd-mmm';
                    dtCell.font = { ...(dtCell.font || {}), bold: true, size: 9 };
                    dtCell.alignment = { vertical: 'middle', horizontal: 'center' };

                    // Total manpower in Row 6
                    const totMp = r ? ((Number(m.leader) || 0) + (Number(m.skilled) || 0) + (Number(m.unskilled) || 0)) : 0;
                    chunkManpowerGrandTotal += totMp;
                    const mpTotCell = ws.getCell(colLetter + '6');
                    mpTotCell.value = totMp > 0 ? totMp : null;
                    mpTotCell.font = { ...(mpTotCell.font || {}), bold: true };
                    mpTotCell.alignment = { vertical: 'middle', horizontal: 'center' };
                    mpTotCell.border = thinBorder;

                    // Manpower rows 8 to 13
                    const mpKeys = ['leader', 'skilled', 'unskilled', 'tractor', 'augur', 'room'];
                    mpKeys.forEach((k, j) => {
                        const val = r ? (Number(m[k]) || 0) : 0;
                        chunkMpTotals[k] += val;
                        const cCell = ws.getCell(colLetter + (8 + j));
                        cCell.value = val > 0 ? val : null;
                        cCell.alignment = { vertical: 'middle', horizontal: 'center' };
                        cCell.border = thinBorder;
                    });

                    // Material quantities: write actual quantity if > 0, otherwise cell is clean null
                    seedItems.forEach(it => {
                        const q = r && r.quantities && Number(r.quantities[it.id]);
                        if (q && q > 0) {
                            dayMaterialTotals[i] += q;
                            const qCell = ws.getCell(colLetter + it.row);
                            qCell.value = q;
                            qCell.numFmt = '#,##0.###';
                            qCell.alignment = { vertical: 'middle', horizontal: 'right' };
                            qCell.border = thinBorder;
                        }
                    });
                });

                // Manpower Totals in Column AI (Rows 6 and 8..13)
                const aiMpTot = ws.getCell('AI6');
                aiMpTot.value = chunkManpowerGrandTotal > 0 ? chunkManpowerGrandTotal : null;
                aiMpTot.font = { ...(aiMpTot.font || {}), bold: true, color: { argb: 'FF1E3A8A' } };
                aiMpTot.alignment = { vertical: 'middle', horizontal: 'center' };
                aiMpTot.fill = totalFill;
                aiMpTot.border = thinBorder;
                ['leader', 'skilled', 'unskilled', 'tractor', 'augur', 'room'].forEach((k, j) => {
                    const aiMp = ws.getCell('AI' + (8 + j));
                    aiMp.value = chunkMpTotals[k] > 0 ? chunkMpTotals[k] : null;
                    aiMp.font = { ...(aiMp.font || {}), bold: true, color: { argb: 'FF1E3A8A' } };
                    aiMp.alignment = { vertical: 'middle', horizontal: 'center' };
                    aiMp.fill = totalFill;
                    aiMp.border = thinBorder;
                });

                // Row serials and Totals in Column AI
                let grandTotalMaterials = 0;
                let maxItemRow = 15;
                seedItems.forEach((it, i) => {
                    if (Number(it.row) > maxItemRow) maxItemRow = Number(it.row);
                    ws.getCell('A' + it.row).value = i + 1;
                    const totalConsumedInChunk = chunk.reduce((sum, d) => {
                        const rep = reportsByDate.get(d);
                        return sum + (Number(rep && rep.quantities && rep.quantities[it.id]) || 0);
                    }, 0);
                    grandTotalMaterials += totalConsumedInChunk;
                    const aiCell = ws.getCell('AI' + it.row);
                    aiCell.value = totalConsumedInChunk > 0 ? totalConsumedInChunk : null;
                    aiCell.font = { ...(aiCell.font || {}), bold: true, color: { argb: 'FF1E3A8A' } };
                    aiCell.numFmt = '#,##0.###';
                    aiCell.alignment = { vertical: 'middle', horizontal: 'right' };
                    aiCell.fill = totalFill;
                    aiCell.border = thinBorder;
                    ws.getRow(it.row).hidden = totalConsumedInChunk <= 0;
                });

                // Bottom Grand Total Row across all exported materials
                const grandRowNum = maxItemRow + 1;
                const grandLabel = ws.getCell('C' + grandRowNum);
                grandLabel.value = 'GRAND TOTAL (ALL MATERIALS)';
                grandLabel.font = { ...(grandLabel.font || {}), bold: true, size: 10, color: { argb: 'FF1E3A8A' } };
                grandLabel.fill = grandTotalFill;
                grandLabel.border = headerTotalBorder;
                ['A', 'B', 'D'].forEach(col => {
                    const c = ws.getCell(col + grandRowNum);
                    c.fill = grandTotalFill;
                    c.border = headerTotalBorder;
                });
                dayMaterialTotals.forEach((daySum, i) => {
                    const colLetter = getColLetter(i + 4);
                    const cell = ws.getCell(colLetter + grandRowNum);
                    cell.value = daySum > 0 ? Math.round(daySum * 1000) / 1000 : null;
                    cell.font = { ...(cell.font || {}), bold: true, color: { argb: 'FF1E3A8A' } };
                    cell.numFmt = '#,##0.###';
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    cell.fill = grandTotalFill;
                    cell.border = headerTotalBorder;
                });
                const grandAiCell = ws.getCell('AI' + grandRowNum);
                grandAiCell.value = grandTotalMaterials > 0 ? Math.round(grandTotalMaterials * 1000) / 1000 : null;
                grandAiCell.font = { ...(grandAiCell.font || {}), bold: true, size: 11, color: { argb: 'FF1E3A8A' } };
                grandAiCell.numFmt = '#,##0.###';
                grandAiCell.alignment = { vertical: 'middle', horizontal: 'right' };
                grandAiCell.fill = grandTotalFill;
                grandAiCell.border = headerTotalBorder;

                // Notes in AJ8
                const notesStr = chunk
                    .map(d => {
                        const rep = reportsByDate.get(d);
                        return rep && rep.remarks ? `${d}: ${rep.remarks}` : '';
                    })
                    .filter(Boolean)
                    .join('\n');
                const ajCell = ws.getCell('AJ8');
                ajCell.value = notesStr || null;
                ajCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const safeCont = (contractor.name || 'Contractor').replace(/[^a-z0-9 -]/gi, '_');
            a.href = url;
            a.download = `${safeCont}_${this.dailyProgressLocationName().replace(/[^a-z0-9]/gi, '_')}_Daily_Progress_${from}_to_${to}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 10000);

            this.showToast('Daily Progress Excel report downloaded!', 'Check');
        } catch (e) {
            console.error('[DailyProgress] Export error:', e);
            this.showToast('Export failed: ' + (e.message || e), 'Alert');
        } finally {
            this.dailyProgressBusy = false;
        }
    },

    // ─── LIVE EXCEL SHEET PREVIEW HELPERS ──────────────────────────────────────

    getDailyProgressExportDays() {
        const from = this.dailyProgressExportFrom;
        const to = this.dailyProgressExportTo;
        if (!from || !to || from > to) return [];
        const cache = this._dpExportDaysCache;
        if (cache && cache.from === from && cache.to === to) return cache.days;
        const days = [];
        const dStart = new Date(from + 'T00:00:00Z');
        const dEnd = new Date(to + 'T00:00:00Z');
        for (let d = new Date(dStart); d <= dEnd; d.setUTCDate(d.getUTCDate() + 1)) {
            days.push(d.toISOString().slice(0, 10));
        }
        const sliced = days.slice(0, 62); // cap preview to 62 days for high performance
        this._dpExportDaysCache = { from, to, days: sliced };
        return sliced;
    },

    _getDailyProgressExportReportMap() {
        const cid = this.dailyProgressContractorId;
        const locKey = this.dailyProgressLocationKey(this.dailyProgressLocationId);
        const reports = (this.dailyProgressData && this.dailyProgressData.reports) || [];
        const now = Date.now();
        const cache = this._dpReportMapCache;
        if (cache && cache.cid === cid && cache.locKey === locKey && cache.reports === reports && cache.len === reports.length && (now - cache.ts) < 250) {
            return cache.map;
        }
        const normFn = str => String(str || '').toLowerCase().replace(/^m\/s\.?\s*/i, '').replace(/[^a-z0-9]/g, '').replace(/eterprise/g, 'enterprise');
        const targetNorm = normFn(cid);
        const map = new Map();
        for (let i = 0; i < reports.length; i++) {
            const r = reports[i];
            if (!r) continue;
            if (r.contractorId !== cid && normFn(r.contractorId) !== targetNorm) continue;
            if (this.dailyProgressLocationKey(r.locationId) !== locKey) continue;
            const normD = this.normalizeDailyProgressDate(r.date);
            if (!normD) continue;
            const prev = map.get(normD);
            if (!prev) {
                map.set(normD, r);
            } else {
                const vDiff = Number(r.version || 0) - Number(prev.version || 0);
                if (vDiff > 0 || (vDiff === 0 && (Date.parse(r.savedAt || r.updatedAt || '') || 0) > (Date.parse(prev.savedAt || prev.updatedAt || '') || 0))) {
                    map.set(normD, r);
                }
            }
        }
        this._dpReportMapCache = { cid, locKey, reports, len: reports.length, ts: now, map };
        return map;
    },

    getDailyProgressDayReport(date) {
        const normD = this.normalizeDailyProgressDate(date);
        if (!normD) return undefined;
        return this._getDailyProgressExportReportMap().get(normD);
    },

    openDailyProgressReportFromHistory(rep) {
        if (!rep) return;
        if (rep.contractorId) this.dailyProgressContractorId = rep.contractorId;
        const targetLoc = (rep.locationId && rep.locationId !== 'legacy') ? rep.locationId : '';
        this.dailyProgressLocationId = targetLoc;
        this.dailyProgressDate = rep.date;
        this.loadDailyProgressReportForDate(rep.date);
        this.dailyProgressTab = 'entry';
    },

    getDailyProgressExportQty(itemId, date) {
        const rep = this.getDailyProgressDayReport(date);
        return (rep && rep.quantities && Number(rep.quantities[itemId])) || 0;
    },

    _getDailyProgressExportTotalsMap() {
        const cid = this.dailyProgressContractorId;
        const locKey = this.dailyProgressLocationKey(this.dailyProgressLocationId);
        const from = this.dailyProgressExportFrom || '';
        const to = this.dailyProgressExportTo || '';
        const reports = (this.dailyProgressData && this.dailyProgressData.reports) || [];
        const now = Date.now();
        const cache = this._dpExportTotalsCache;
        if (cache && cache.cid === cid && cache.locKey === locKey && cache.from === from && cache.to === to && cache.reports === reports && cache.len === reports.length && (now - cache.ts) < 250) {
            return cache.totals;
        }
        const days = this.getDailyProgressExportDays();
        const reportMap = this._getDailyProgressExportReportMap();
        const totals = new Map();
        for (let i = 0; i < days.length; i++) {
            const rep = reportMap.get(days[i]);
            if (!rep || !rep.quantities) continue;
            const entries = Object.entries(rep.quantities);
            for (let j = 0; j < entries.length; j++) {
                const val = Number(entries[j][1]) || 0;
                if (val > 0) {
                    const key = String(entries[j][0]);
                    totals.set(key, (totals.get(key) || 0) + val);
                }
            }
        }
        this._dpExportTotalsCache = { cid, locKey, from, to, reports, len: reports.length, ts: now, totals };
        return totals;
    },

    getDailyProgressExportItemTotal(itemId) {
        return this._getDailyProgressExportTotalsMap().get(String(itemId)) || 0;
    },

    getDailyProgressDayManpower(date, key) {
        const rep = this.getDailyProgressDayReport(date);
        if (!rep || !rep.manpower) return 0;
        if (key === 'total') {
            return (Number(rep.manpower.leader) || 0) + (Number(rep.manpower.skilled) || 0) + (Number(rep.manpower.unskilled) || 0);
        }
        return Number(rep.manpower[key]) || 0;
    },

    getDailyProgressExportPreviewItems() {
        const items = this.dailyProgressSeedItems || [];
        const filter = this.dailyProgressExportFilter || 'active'; // 'active', 'issued', 'all'
        const q = String(this.dailyProgressExportSearch || '').trim().toLowerCase();
        const cid = this.dailyProgressContractorId;
        const locKey = this.dailyProgressLocationKey(this.dailyProgressLocationId);
        const from = this.dailyProgressExportFrom || '';
        const to = this.dailyProgressExportTo || '';
        const reports = (this.dailyProgressData && this.dailyProgressData.reports) || [];
        const now = Date.now();
        const cache = this._dpExportPreviewCache;
        if (cache && cache.cid === cid && cache.locKey === locKey && cache.from === from && cache.to === to && cache.filter === filter && cache.q === q && cache.items === items && cache.reports === reports && cache.len === reports.length && (now - cache.ts) < 250) {
            return cache.result;
        }
        const totalsMap = this._getDailyProgressExportTotalsMap();
        const result = items.filter(it => {
            if (q) {
                const matches = String(it.name || '').toLowerCase().includes(q) ||
                    String(it.code || '').toLowerCase().includes(q);
                if (!matches) return false;
            }
            if (filter === 'all') return true;
            const stock = this.getDailyProgressItemStock(it);
            const totalRangeConsumed = totalsMap.get(String(it.id)) || 0;
            if (filter === 'issued') {
                return (stock && stock.totalIssued > 0);
            }
            // default 'active': either has stock issued or has consumption in this date range
            return (stock && stock.totalIssued > 0) || totalRangeConsumed > 0;
        });
        this._dpExportPreviewCache = { cid, locKey, from, to, filter, q, items, reports, len: reports.length, ts: now, result };
        return result;
    },

    openDailyProgressExportTab() {
        this.setDailyProgressExportRange('current_month');
        this.dailyProgressTab = 'download';
    },

    setDailyProgressExportRange(rangeType) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        if (rangeType === 'current_month' || rangeType === 'this_month') {
            const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
            this.dailyProgressExportFrom = `${year}-${month}-01`;
            this.dailyProgressExportTo = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
        } else if (rangeType === 'prev_month') {
            const prev = new Date(year, now.getMonth() - 1, 1);
            const pYear = prev.getFullYear();
            const pMonth = String(prev.getMonth() + 1).padStart(2, '0');
            const pLastDay = new Date(pYear, prev.getMonth() + 1, 0).getDate();
            this.dailyProgressExportFrom = `${pYear}-${pMonth}-01`;
            this.dailyProgressExportTo = `${pYear}-${pMonth}-${String(pLastDay).padStart(2, '0')}`;
        } else if (rangeType === 'sep2026') {
            this.dailyProgressExportFrom = '2026-09-01';
            this.dailyProgressExportTo = '2026-09-30';
        } else if (rangeType === 'last7') {
            const d7 = new Date();
            d7.setDate(d7.getDate() - 6);
            this.dailyProgressExportFrom = d7.toISOString().slice(0, 10);
            this.dailyProgressExportTo = now.toISOString().slice(0, 10);
        } else if (rangeType === 'last30') {
            const d30 = new Date();
            d30.setDate(d30.getDate() - 29);
            this.dailyProgressExportFrom = d30.toISOString().slice(0, 10);
            this.dailyProgressExportTo = now.toISOString().slice(0, 10);
        }
    },

    formatShortDayHeader(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const mIdx = parseInt(parts[1], 10) - 1;
            return `${parts[2]}-${monthNames[mIdx] || parts[1]}`;
        }
        return dateStr;
    },

    selectDailyProgressShareContractor(c) {
        this.dailyProgressShareSelectedContractor = c;
    },

    async copyDailyProgressShareUrl(url) {
        const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : null;
        let copied = false;
        try {
            copied = window.BillingShareLink ? await window.BillingShareLink.copy(url, { clipboard })
                : clipboard?.writeText ? await Promise.resolve(clipboard.writeText(url)).then(() => true, () => false) : false;
        } catch (_) { }
        if (!copied) {
            const select = () => { const field = this.$refs?.dpShareUrlInput; if (field) { field.focus(); field.select(); } };
            if (typeof this.$nextTick === 'function') this.$nextTick(select); else select();
        }
        if (typeof this.showToast === 'function') this.showToast(copied ? 'Share link copied.' : 'Link field se copy karein (Ctrl+C).', copied ? 'success' : 'Alert');
        return copied;
    },

    getDailyProgressContractorShareUrl(cid, dt) {
        const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
        const normD = (this.normalizeDailyProgressDate && this.normalizeDailyProgressDate(dt || this.dailyProgressDate)) || dt || this.dailyProgressDate || '';
        return `${origin}/daily-progress.html?contractor=${encodeURIComponent(cid)}&date=${encodeURIComponent(normD)}${this.dailyProgressLocationQuery(cid)}`;
    },

    getDailyProgressContractorWhatsappUrl(c, dt) {
        const url = this.getDailyProgressContractorShareUrl(c.id, dt);
        const normD = (this.normalizeDailyProgressDate && this.normalizeDailyProgressDate(dt || this.dailyProgressDate)) || dt || this.dailyProgressDate || '';
        const text = `*Daily Progress Entry Link*\nContractor: ${c.name || ''}\nDate: ${normD}\nLink: ${url}`;
        return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    },

    openDailyProgressShareModal() {
        this.dailyProgressShareSelectedContractor = this.dailyProgressActiveContractor;
        this.dailyProgressShareSearch = '';
        this.dailyProgressShareDate = this.dailyProgressDate || (new Date().toISOString().slice(0, 10));
        this.dailyProgressModal = 'share';
        if (typeof this.$nextTick === 'function') {
            this.$nextTick(() => {
                if (this.$refs.dpShareSearchInput) {
                    this.$refs.dpShareSearchInput.focus();
                }
            });
        }
    },

    copyDailyProgressShareLink() {
        this.openDailyProgressShareModal();
        const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
        const cid = this.dailyProgressContractorId || this.selectedContractorId || (this.dailyProgressActiveContractor && this.dailyProgressActiveContractor.id) || '';
        const dt = (this.normalizeDailyProgressDate && this.normalizeDailyProgressDate(this.dailyProgressDate)) || this.dailyProgressDate || '';
        const url = `${origin}/daily-progress.html?contractor=${encodeURIComponent(cid)}&date=${encodeURIComponent(dt)}${this.dailyProgressLocationQuery(cid)}`;

        return this.copyDailyProgressShareUrl(url);
    }
};
