/** Contractor-specific SAP overrides. Measurements, descriptions and rates stay in the bill. */
(function () {
    const clone = value => JSON.parse(JSON.stringify(value));
    const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
    const fields = ['itemCode', 'sapDescription', 'sapUom', 'docHeader', 'sapItems'];
    function rowsFor(groups, visit) {
        Object.entries(groups || {}).forEach(([schedule, group]) => {
            const seen = {};
            (group.materials || []).forEach(row => {
                if (!row || row.isSection || row.isSpan) return;
                const identity = JSON.stringify([String(row.no || ''), String(row.desc || '')]);
                const occurrence = seen[identity] || 0;
                seen[identity] = occurrence + 1;
                visit(schedule, JSON.stringify([identity, occurrence]), row);
            });
        });
    }
    function mapping(row) {
        const out = {};
        fields.forEach(field => { if (row[field] !== undefined) out[field] = clone(row[field]); });
        // Fixed reconciliation quantities belong to the bill, not a reusable SAP mapping.
        if (out.sapItems) out.sapItems.forEach(s => { delete s.manualQty; delete s.isManual; });
        return out;
    }
    function snapshot(groups) {
        const out = {};
        rowsFor(groups, (schedule, key, row) => {
            if (!out[schedule]) out[schedule] = {};
            out[schedule][key] = mapping(row);
        });
        return out;
    }
    window.ContractorMappingModule = {
        contractorMappingId() {
            const id = String(this.selectedContractorId || '');
            return id && id !== 'custom' ? id : '';
        },
        initializeContractorMappings() {
            if (!this.contractorMappingState || this.contractorMappingState.version !== 1) {
                this.contractorMappingState = {
                    version: 1,
                    base: {
                        activities: snapshot(window.defaultActivities || this.activities),
                        poleSchedules: snapshot(window.defaultPoleSchedules || this.poleSchedules)
                    },
                    profiles: {}
                };
            }
            this._activeMappingContractorId = this.contractorMappingId();
            this.captureContractorMapping();
        },
        captureContractorMapping(force = false) {
            const state = this.contractorMappingState;
            const id = this._activeMappingContractorId;
            if (!state || !id) return;
            const rows = { activities: {}, poleSchedules: {} };
            ['activities', 'poleSchedules'].forEach(kind => {
                rowsFor(this[kind], (schedule, key, row) => {
                    const value = mapping(row);
                    const base = state.base[kind][schedule] && state.base[kind][schedule][key];
                    if (JSON.stringify(value) !== JSON.stringify(base)) {
                        if (!rows[kind][schedule]) rows[kind][schedule] = {};
                        rows[kind][schedule][key] = value;
                    }
                });
            });
            const previous = state.profiles[id];
            if (!force && previous && JSON.stringify(previous.rows) === JSON.stringify(rows)) return;
            const hasOverrides = ['activities', 'poleSchedules'].some(kind => Object.keys(rows[kind]).length > 0);
            state.profiles[id] = { version: 1, rows, updatedAt: previous || hasOverrides ? Math.max(Date.now(), (previous && previous.updatedAt || 0) + 1) : 0, dirty: !!previous || hasOverrides };
            this.cacheContractorMapping(id, state.profiles[id]);
        },
        cacheContractorMapping(id, profile) {
            try { localStorage.setItem('billing_contractor_mapping_v1_' + id, JSON.stringify(profile)); } catch (e) {}
        },
        applyContractorMapping(profile) {
            const state = this.contractorMappingState;
            if (!state) return;
            ['activities', 'poleSchedules'].forEach(kind => {
                rowsFor(this[kind], (schedule, key, row) => {
                    const overrides = profile && profile.rows && profile.rows[kind] && profile.rows[kind][schedule];
                    const base = state.base[kind][schedule];
                    const value = own(overrides, key) ? overrides[key] : (base && base[key]);
                    // A custom row without a saved mapping for this contractor must
                    // not inherit the previous contractor's SAP codes.
                    fields.forEach(field => {
                        if (value && own(value, field)) row[field] = clone(value[field]);
                        else if (field === 'sapItems') row[field] = [];
                        else row[field] = '';
                    });
                });
            });
            this.recoRevision = (this.recoRevision || 0) + 1;
        },
        switchContractorMapping() {
            if (this._isLoading || this._loadingContractorMapping || this.isPerformingHistoryAction) return;
            if (!this.contractorMappingState) this.initializeContractorMappings();
            const id = this.contractorMappingId();
            if (id === this._activeMappingContractorId) return;
            const outgoing = this._activeMappingContractorId;
            this.captureContractorMapping();
            if (outgoing) this.persistContractorMapping(true, outgoing);
            this.showSapItemManagerModal = false;
            this.activeSapManagerItem = null;
            this._activeMappingContractorId = id;
            let profile = this.contractorMappingState.profiles[id];
            try {
                const cached = JSON.parse(localStorage.getItem('billing_contractor_mapping_v1_' + id));
                if (cached && (!profile || cached.updatedAt > profile.updatedAt)) profile = cached;
            } catch (e) {}
            if (id && profile) this.contractorMappingState.profiles[id] = profile;
            this.applyContractorMapping(profile);
            this.captureContractorMapping();
            if (id) this.loadContractorMapping(id);
        },
        async loadContractorMapping(id) {
            if (!id || this.isFinalized) return;
            const initial = JSON.stringify(this.contractorMappingState.profiles[id] || null);
            try {
                const headers = {};
                const apiKey = localStorage.getItem('billing_api_key');
                if (apiKey) headers['x-api-key'] = apiKey;
                const response = await fetch('/api/contractor-mapping?contractorId=' + encodeURIComponent(id), { headers });
                if (!response.ok) return;
                const result = await response.json();
                if (this._activeMappingContractorId !== id || this.isFinalized) return;
                const current = this.contractorMappingState.profiles[id];
                if (JSON.stringify(current || null) !== initial || (current && current.dirty)) return;
                if (result.success && result.profile && result.profile.version === 1 && result.profile.rows) {
                    const profile = result.profile;
                    if (current && current.updatedAt > profile.updatedAt) return;
                    this.contractorMappingState.profiles[id] = profile;
                    this.cacheContractorMapping(id, profile);
                    this.applyContractorMapping(profile);
                    this.saveToStorage();
                }
            } catch (e) { /* Offline: keep the bill/local contractor mapping. */ }
        },
        async persistContractorMapping(silent = true, contractorId) {
            if (!this.contractorMappingState) this.initializeContractorMappings();
            const id = contractorId || this._activeMappingContractorId;
            if (!id) {
                if (!silent) this.showToast('Mapping save karne ke liye named contractor select karein', '⚠️');
                return false;
            }
            if (id === this._activeMappingContractorId) this.captureContractorMapping();
            const profile = this.contractorMappingState.profiles[id];
            if (!profile) return false;
            if (!profile.dirty) {
                if (!silent) this.showToast('Is contractor ki mapping pehle se saved hai', '✅');
                return true;
            }
            const payload = clone(profile);
            if (!this._contractorProfileWrites) this._contractorProfileWrites = {};
            const previous = this._contractorProfileWrites[id] || Promise.resolve();
            const pending = previous.catch(() => {}).then(() => this.sendContractorMapping(id, payload, silent));
            this._contractorProfileWrites[id] = pending;
            return pending;
        },
        async sendContractorMapping(id, profile, silent) {
            const sentAt = profile.updatedAt;
            try {
                const headers = { 'Content-Type': 'application/json' };
                const apiKey = localStorage.getItem('billing_api_key');
                if (apiKey) headers['x-api-key'] = apiKey;
                const response = await fetch('/api/contractor-mapping', {
                    method: 'POST', headers,
                    body: JSON.stringify({ contractorId: id, profile }), keepalive: true
                });
                const result = response.ok && await response.json();
                if (!result || !result.success) throw new Error('Contractor mapping save failed');
                const current = this.contractorMappingState.profiles[id];
                if (current && current.updatedAt === sentAt) {
                    current.dirty = false;
                    this.cacheContractorMapping(id, current);
                }
                if (!silent) this.showToast('Is contractor ki SAP mapping save ho gayi', '✅');
                return true;
            } catch (e) {
                if (!silent) this.showToast('Mapping local mein saved hai; cloud save pending hai', '⚠️');
                return false;
            }
        }
    };
})();
