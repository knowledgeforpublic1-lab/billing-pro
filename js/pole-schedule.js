/**
 * @file Pole Schedule Module
 * @description Dedicated module for managing 11 KV Pole Schedules (Activity 907 & Activity 922),
 * location-wise quantity entries, formula evaluation, SAP code mappings, and Excel export.
 * 
 * @module PoleScheduleModule
 * @since v2.0
 */

window.PoleScheduleModule = {
    getCurrentPoleSchedule() {
        const key = this.selectedPoleScheduleKey || '907';
        if (this.poleSchedules && this.poleSchedules[key]) {
            return this.poleSchedules[key];
        }
        if (typeof defaultPoleSchedules !== 'undefined' && defaultPoleSchedules[key]) {
            return defaultPoleSchedules[key];
        }
        return { title: 'Pole Schedule', materials: [] };
    },

    getPoleScheduleMaterials() {
        const s = this.getCurrentPoleSchedule();
        return (s && s.materials) ? s.materials : [];
    },

    getFilteredPoleScheduleMaterials() {
        const mats = this.getPoleScheduleMaterials();
        const q = (this.poleScheduleSearchQuery || '').trim().toLowerCase();
        if (!q) return mats.map((m, idx) => Object.assign({}, m, { origIndex: idx }));
        return mats
            .map((m, idx) => Object.assign({}, m, { origIndex: idx }))
            .filter(m => {
                if (m.isSection) return true;
                const code = String(m.itemCode || '').toLowerCase();
                const desc = String(m.desc || '').toLowerCase();
                const sapDesc = String(m.sapDescription || '').toLowerCase();
                return code.includes(q) || desc.includes(q) || sapDesc.includes(q);
            });
    },

    getPoleScheduleLocations(key) {
        const k = key || this.selectedPoleScheduleKey || '907';
        if (!this.poleScheduleLocations) this.poleScheduleLocations = {};
        if (!Array.isArray(this.poleScheduleLocations[k]) || this.poleScheduleLocations[k].length === 0) {
            if (this.activityLocations && Array.isArray(this.activityLocations[k]) && this.activityLocations[k].length > 0) {
                this.poleScheduleLocations[k] = JSON.parse(JSON.stringify(this.activityLocations[k]));
            } else if (this.locations && this.locations.length > 0) {
                this.poleScheduleLocations[k] = JSON.parse(JSON.stringify(this.locations));
            } else {
                this.poleScheduleLocations[k] = [{ name: 'Location 1' }];
            }
        }
        if (Array.isArray(this.poleScheduleLocations[k]) && this.poleScheduleLocations[k].length === 3) {
            const isDummyTrio = this.poleScheduleLocations[k][0].name === 'Ra-09 Bodhali' &&
                this.poleScheduleLocations[k][1].name === 'Ra-09 Gogaon' &&
                this.poleScheduleLocations[k][2].name === 'Ra-09 Nawegaon';
            if (isDummyTrio && !this.hasPoleScheduleQuantities(k)) {
                this.poleScheduleLocations[k] = [{ name: 'Location 1' }];
            }
        }
        return this.poleScheduleLocations[k];
    },

    ensurePoleScheduleQuantities(key) {
        const k = key || this.selectedPoleScheduleKey || '907';
        if (!this.poleScheduleQuantities) this.poleScheduleQuantities = {};
        if (!this.poleScheduleQuantities[k]) this.poleScheduleQuantities[k] = {};
        const locs = this.getPoleScheduleLocations(k);
        locs.forEach((loc, lIdx) => {
            if (!this.poleScheduleQuantities[k][lIdx]) {
                this.poleScheduleQuantities[k][lIdx] = {};
            }
        });
        return this.poleScheduleQuantities[k];
    },

    getPoleScheduleCellQty(lIdx, mIdx) {
        const k = this.selectedPoleScheduleKey || '907';
        if (!this.poleScheduleQuantities || !this.poleScheduleQuantities[k] || !this.poleScheduleQuantities[k][lIdx]) return '';
        return this.poleScheduleQuantities[k][lIdx][mIdx] || '';
    },

    setPoleScheduleCellQty(lIdx, mIdx, val) {
        const k = this.selectedPoleScheduleKey || '907';
        this.ensurePoleScheduleQuantities(k);
        this.poleScheduleQuantities[k][lIdx][mIdx] = val;
        // Vue 3 reactivity triggers
        this.poleScheduleQuantities[k] = { ...this.poleScheduleQuantities[k] };
        this.poleScheduleQuantities = { ...this.poleScheduleQuantities };
        if (typeof this.syncPoleScheduleToBillingAndReconciliation === 'function') {
            this.syncPoleScheduleToBillingAndReconciliation(k);
        }
        this.recoRevision = (this.recoRevision || 0) + 1;
        this.debouncedSave();
    },

    onPoleScheduleQtyInput(lIdx, mIdx, event) {
        if (this.isFinalized) return;
        const val = event.target.value;
        this.setPoleScheduleCellQty(lIdx, mIdx, val);
    },

    onPoleScheduleQtyBlur(lIdx, mIdx, event) {
        const raw = event.target.value.trim();
        if (raw.startsWith('=')) {
            const evaluated = typeof this.evalGridFormula === 'function' ? this.evalGridFormula(raw) : raw;
            this.setPoleScheduleCellQty(lIdx, mIdx, evaluated);
        }
        this.saveToStorage();
    },

    getPoleScheduleItemTotalQty(mIdx) {
        const k = this.selectedPoleScheduleKey || '907';
        const locs = this.getPoleScheduleLocations();
        let total = 0;
        locs.forEach((_, lIdx) => {
            const raw = this.getPoleScheduleCellQty(lIdx, mIdx);
            if (raw !== '' && raw !== null && raw !== undefined) {
                const n = typeof this.evalGridFormula === 'function' ? Number(this.evalGridFormula(String(raw))) : parseFloat(raw);
                if (!isNaN(n)) total += n;
            }
        });
        return Math.round(total * 1000) / 1000;
    },

    getPoleScheduleItemAmount100(item, mIdx) {
        if (!item || item.isSection || item.isSpan) return 0;
        const qty = this.getPoleScheduleItemTotalQty(mIdx);
        const rate = Number(item.rate) || 0;
        return qty * rate;
    },

    getPoleScheduleItemAmountStage1(item, mIdx) {
        const amt100 = this.getPoleScheduleItemAmount100(item, mIdx);
        const pct = (Number(this.pctStage1) || 85) / 100;
        return amt100 * pct;
    },

    getPoleScheduleTotalsByKey(key) {
        const k = key || this.selectedPoleScheduleKey || '907';
        const sched = (this.poleSchedules && this.poleSchedules[k]) || (typeof defaultPoleSchedules !== 'undefined' && defaultPoleSchedules[k]);
        if (!sched || !Array.isArray(sched.materials)) return { totalQty: 0, totalAmt100: 0, totalAmtStage1: 0 };
        const qMatrix = (this.poleScheduleQuantities && this.poleScheduleQuantities[k]) || {};
        let totalQty = 0;
        let totalAmt100 = 0;
        let totalAmtStage1 = 0;
        const pct1 = (Number(this.pctStage1) || 85) / 100;
        sched.materials.forEach((m, mIdx) => {
            if (m.isSection || m.isSpan) return;
            let mQty = 0;
            Object.keys(qMatrix).forEach(lIdx => {
                const raw = qMatrix[lIdx] && qMatrix[lIdx][mIdx];
                if (raw !== '' && raw !== null && raw !== undefined) {
                    const n = typeof this.evalGridFormula === 'function' ? Number(this.evalGridFormula(String(raw))) : parseFloat(raw);
                    if (!isNaN(n)) mQty += n;
                }
            });
            const rate = Number(m.rate) || 0;
            const itemAmt = mQty * rate;
            totalQty += mQty;
            totalAmt100 += itemAmt;
            totalAmtStage1 += itemAmt * pct1;
        });
        return {
            totalQty: Math.round(totalQty * 1000) / 1000,
            totalAmt100: Math.round(totalAmt100 * 100) / 100,
            totalAmtStage1: Math.round(totalAmtStage1 * 100) / 100
        };
    },

    getPoleScheduleTotals() {
        const mats = this.getPoleScheduleMaterials();
        let totalQty = 0;
        let totalAmt100 = 0;
        let totalAmtStage1 = 0;
        mats.forEach((m, idx) => {
            if (!m.isSection && !m.isSpan) {
                const q = this.getPoleScheduleItemTotalQty(idx);
                totalQty += q;
                const amt100 = q * (Number(m.rate) || 0);
                totalAmt100 += amt100;
                totalAmtStage1 += amt100 * ((Number(this.pctStage1) || 85) / 100);
            }
        });
        return {
            totalQty: Math.round(totalQty * 1000) / 1000,
            totalAmt100: Math.round(totalAmt100 * 100) / 100,
            totalAmtStage1: Math.round(totalAmtStage1 * 100) / 100
        };
    },

    addPoleScheduleLocation() {
        if (this.isFinalized) {
            this.showToast('⚠️ Bill finalized hai. Pehle unlock karein.', '🔒');
            return;
        }
        const k = this.selectedPoleScheduleKey || '907';
        const locs = this.getPoleScheduleLocations();
        const nextNum = locs.length + 1;
        const name = prompt(`Enter Location Name for Schedule ${k}:`, `Loc ${nextNum}`);
        if (!name || !name.trim()) return;
        locs.push({ name: name.trim() });
        this.saveToStorage();
        this.showToast(`Location "${name.trim()}" added to Pole Schedule ${k}`, '📍');
    },

    renamePoleScheduleLocation(lIdx) {
        if (this.isFinalized) return;
        const k = this.selectedPoleScheduleKey || '907';
        const locs = this.getPoleScheduleLocations();
        if (!locs[lIdx]) return;
        const currentName = locs[lIdx].name || `Loc ${lIdx + 1}`;
        const newName = prompt(`Rename Location:`, currentName);
        if (newName && newName.trim() && newName.trim() !== currentName) {
            locs[lIdx].name = newName.trim();
            this.saveToStorage();
            this.showToast(`Renamed to "${newName.trim()}"`, '✏️');
        }
    },

    removePoleScheduleLocation(lIdx) {
        if (this.isFinalized) return;
        const k = this.selectedPoleScheduleKey || '907';
        const locs = this.getPoleScheduleLocations();
        if (locs.length <= 1) {
            alert('Kam se kam 1 location honi chahiye.');
            return;
        }
        const name = locs[lIdx].name || `Loc ${lIdx + 1}`;
        if (!confirm(`Kya aap Pole Schedule ${k} se location "${name}" delete karna chahte hain?`)) return;

        locs.splice(lIdx, 1);
        if (this.poleScheduleQuantities && this.poleScheduleQuantities[k]) {
            delete this.poleScheduleQuantities[k][lIdx];
            const newObj = {};
            locs.forEach((_, idx) => {
                const oldIdx = idx >= lIdx ? idx + 1 : idx;
                newObj[idx] = this.poleScheduleQuantities[k][oldIdx] || {};
            });
            this.poleScheduleQuantities[k] = newObj;
        }
        this.saveToStorage();
        this.showToast(`Location "${name}" removed`, '🗑️');
    },

    onPoleScheduleChange(key) {
        this.selectedPoleScheduleKey = key;
        this.poleScheduleSubTab = 'schedule';
        this.ensurePoleScheduleQuantities(key);
        try { localStorage.setItem('billing_selected_pole_schedule_key', key); } catch(e) {}
    },

    getPoleScheduleItemTotalQtyByKey(key, mIdx) {
        const k = key || this.selectedPoleScheduleKey || '907';
        const locs = (this.poleScheduleLocations && this.poleScheduleLocations[k]) || (typeof this.getPoleScheduleLocations === 'function' ? this.getPoleScheduleLocations() : []);
        let total = 0;
        const qMatrix = (this.poleScheduleQuantities && this.poleScheduleQuantities[k]) || {};
        locs.forEach((_, lIdx) => {
            const raw = qMatrix[lIdx] && qMatrix[lIdx][mIdx];
            if (raw !== '' && raw !== null && raw !== undefined) {
                const n = typeof this.evalGridFormula === 'function' ? Number(this.evalGridFormula(String(raw))) : parseFloat(raw);
                if (!isNaN(n)) total += n;
            }
        });
        return Math.round(total * 1000) / 1000;
    },

    hasPoleScheduleQuantities(key) {
        const k = key || this.selectedPoleScheduleKey || '907';
        const qMatrix = this.poleScheduleQuantities && this.poleScheduleQuantities[k];
        if (!qMatrix) return false;
        for (const lIdx in qMatrix) {
            const row = qMatrix[lIdx];
            if (row) {
                for (const mIdx in row) {
                    const raw = row[mIdx];
                    if (raw !== '' && raw !== null && raw !== undefined) {
                        const n = typeof this.evalGridFormula === 'function' ? Number(this.evalGridFormula(String(raw))) : parseFloat(raw);
                        if (!isNaN(n) && n > 0) return true;
                    }
                }
            }
        }
        return false;
    },

    syncPoleScheduleToBillingAndReconciliation(key) {
        const k = key || this.selectedPoleScheduleKey || '907';

        // 1. Ensure locations synchronization across both Pole Schedule & Activity Billing
        const locs = (this.poleScheduleLocations && this.poleScheduleLocations[k]) || (typeof this.getPoleScheduleLocations === 'function' ? this.getPoleScheduleLocations(k) : [{ name: 'Location 1' }]);
        if (!this.activityLocations) this.activityLocations = {};
        this.activityLocations[k] = JSON.parse(JSON.stringify(locs));
        if (!this.poleScheduleLocations) this.poleScheduleLocations = {};
        this.poleScheduleLocations[k] = JSON.parse(JSON.stringify(locs));

        const sched = (this.poleSchedules && this.poleSchedules[k]) || (typeof defaultPoleSchedules !== 'undefined' && defaultPoleSchedules[k]);
        if (!sched || !Array.isArray(sched.materials)) return;

        // Ensure this.activities[k] exists
        if (!this.activities) this.activities = {};
        if (!this.activities[k]) {
            if (typeof defaultActivities !== 'undefined' && defaultActivities[k]) {
                this.activities[k] = JSON.parse(JSON.stringify(defaultActivities[k]));
            } else {
                this.activities[k] = { title: sched.title || ('Activity ' + k), materials: [] };
            }
        }
        const act = this.activities[k];
        if (!Array.isArray(act.materials)) act.materials = [];

        // Synchronize all materials from Pole Schedule into act.materials so Activity Billing has all items
        sched.materials.forEach((sm, smIdx) => {
            if (sm.isSection || sm.isSpan) return;
            let actMatIdx = act.materials.findIndex(am => {
                if (am.itemCode && sm.itemCode && String(am.itemCode).trim() === String(sm.itemCode).trim()) return true;
                if (am.desc && sm.desc && am.desc.trim().toLowerCase() === sm.desc.trim().toLowerCase()) return true;
                return false;
            });
            if (actMatIdx === -1) {
                act.materials.push({
                    no: sm.no || (act.materials.length + 1).toString(),
                    desc: sm.desc || '',
                    unit: sm.unit || 'No',
                    rate: Number(sm.rate) || 0,
                    itemCode: sm.itemCode || '',
                    sapDescription: sm.sapDescription || sm.desc || '',
                    sapUom: sm.sapUom || sm.unit || 'No',
                    docHeader: sm.docHeader || '0031006347',
                    sapItems: (sm.sapItems && sm.sapItems.length > 0) ? JSON.parse(JSON.stringify(sm.sapItems)) : [
                        { code: sm.itemCode || '', desc: sm.sapDescription || sm.desc || '', uom: sm.sapUom || sm.unit || 'No', qty: 1, docHeader: sm.docHeader || '0031006347' }
                    ]
                });
            } else {
                if (!act.materials[actMatIdx].itemCode && sm.itemCode) act.materials[actMatIdx].itemCode = sm.itemCode;
                if ((!act.materials[actMatIdx].sapItems || act.materials[actMatIdx].sapItems.length === 0) && sm.sapItems && sm.sapItems.length > 0) {
                    act.materials[actMatIdx].sapItems = JSON.parse(JSON.stringify(sm.sapItems));
                }
                if (!act.materials[actMatIdx].rate && sm.rate) act.materials[actMatIdx].rate = Number(sm.rate);
            }
        });

        // 2. Synchronize quantities into this.activityQuantities[k]
        if (!this.activityQuantities) this.activityQuantities = {};
        if (!this.activityQuantities[k] || !Array.isArray(this.activityQuantities[k])) {
            this.activityQuantities[k] = Array.from({ length: locs.length }, () => new Array(act.materials.length).fill(''));
        }
        while (this.activityQuantities[k].length < locs.length) {
            this.activityQuantities[k].push(new Array(act.materials.length).fill(''));
        }
        // Pad all rows
        this.activityQuantities[k].forEach(row => {
            while (row.length < act.materials.length) row.push('');
        });

        const qMatrix = this.poleScheduleQuantities && this.poleScheduleQuantities[k];
        if (qMatrix) {
            sched.materials.forEach((sm, smIdx) => {
                if (sm.isSection || sm.isSpan) return;
                const actMatIdx = act.materials.findIndex(am => {
                    if (am.itemCode && sm.itemCode && String(am.itemCode).trim() === String(sm.itemCode).trim()) return true;
                    if (am.desc && sm.desc && am.desc.trim().toLowerCase() === sm.desc.trim().toLowerCase()) return true;
                    return false;
                });
                if (actMatIdx !== -1) {
                    locs.forEach((_, lIdx) => {
                        const val = (qMatrix[lIdx] && qMatrix[lIdx][smIdx] !== undefined) ? qMatrix[lIdx][smIdx] : '';
                        if (this.activityQuantities[k][lIdx]) {
                            this.activityQuantities[k][lIdx][actMatIdx] = val;
                        }
                    });
                }
            });
        }

        // Vue 3 reactivity trigger
        this.activityQuantities[k] = this.activityQuantities[k].map(row => [...row]);
        this.activityQuantities = { ...this.activityQuantities };
        this.activities = { ...this.activities };

        // 3. Update Master Abstract if present
        try {
            if (this.masterAbstractList && Array.isArray(this.masterAbstractList) && typeof this.getPoleScheduleTotalsByKey === 'function') {
                const absItem = this.masterAbstractList.find(a => a.code === k);
                if (absItem) {
                    const psTotals = this.getPoleScheduleTotalsByKey(k);
                    if (psTotals && psTotals.totalAmt100 > 0) {
                        if (k === '907' && typeof this.getActivity907InvoiceQty === 'function') {
                            const q907 = this.getActivity907InvoiceQty();
                            if (q907 > 0) absItem.qty = q907;
                        }
                    }
                }
            }
        } catch(e) {}

        // 4. Update Tax Invoice immediately
        try {
            if (typeof this.updateSyncTaxInvoiceFromActivities === 'function') {
                this.updateSyncTaxInvoiceFromActivities();
            }
        } catch(e) {}

        // 5. Trigger Reconciliation Sheet re-calculation
        this.recoRevision = (this.recoRevision || 0) + 1;
    },

    syncActivityBillingToPoleSchedule(key) {
        const k = key || this.selectedActivityKey || '907';
        const sched = (this.poleSchedules && this.poleSchedules[k]) || (typeof defaultPoleSchedules !== 'undefined' && defaultPoleSchedules[k]);
        const act = this.activities && this.activities[k];
        if (!sched || !act || !this.activityQuantities || !this.activityQuantities[k]) return;

        this.ensurePoleScheduleQuantities(k);
        const locs = (this.poleScheduleLocations && this.poleScheduleLocations[k]) || (typeof this.getPoleScheduleLocations === 'function' ? this.getPoleScheduleLocations(k) : []);

        if (!this.poleScheduleQuantities) this.poleScheduleQuantities = {};
        if (!this.poleScheduleQuantities[k]) this.poleScheduleQuantities[k] = {};

        sched.materials.forEach((sm, smIdx) => {
            if (sm.isSection || sm.isSpan) return;
            const actMatIdx = act.materials.findIndex(am => {
                if (am.itemCode && sm.itemCode && String(am.itemCode).trim() === String(sm.itemCode).trim()) return true;
                if (am.desc && sm.desc && am.desc.trim().toLowerCase() === sm.desc.trim().toLowerCase()) return true;
                return false;
            });
            if (actMatIdx !== -1) {
                locs.forEach((_, lIdx) => {
                    const val = (this.activityQuantities[k][lIdx] && this.activityQuantities[k][lIdx][actMatIdx] !== undefined)
                        ? this.activityQuantities[k][lIdx][actMatIdx]
                        : '';
                    if (!this.poleScheduleQuantities[k][lIdx]) {
                        this.poleScheduleQuantities[k][lIdx] = {};
                    }
                    this.poleScheduleQuantities[k][lIdx][smIdx] = val;
                });
            }
        });

        // Vue 3 reactivity trigger
        this.poleScheduleQuantities[k] = { ...this.poleScheduleQuantities[k] };
        this.poleScheduleQuantities = { ...this.poleScheduleQuantities };
        this.recoRevision = (this.recoRevision || 0) + 1;
    },


    openPoleScheduleAddMaterialModal(insertAfterIdx = -1) {
        if (this.isFinalized) {
            this.showToast('Bill is finalized & locked. Unlock first.', '🔒');
            return;
        }
        const k = this.selectedPoleScheduleKey || '907';
        const sched = this.getCurrentPoleSchedule();
        let suggestedNo = '';
        if (insertAfterIdx >= 0 && sched && sched.materials && sched.materials[insertAfterIdx]) {
            const prev = sched.materials[insertAfterIdx];
            if (prev.no) {
                suggestedNo = this.suggestNextPsItemNo(prev.no);
            }
        } else if (sched && sched.materials) {
            suggestedNo = (sched.materials.length + 1).toString();
        }
        this.psNewMaterial = {
            no: suggestedNo,
            desc: '',
            unit: 'No.',
            rate: 0,
            codeSearch: '',
            sapCode: '',
            sapDescription: '',
            sapUom: 'No',
            insertAfterIdx: insertAfterIdx !== undefined ? insertAfterIdx : -1
        };
        this.psExtraItemSuggestions = [];
        this.showPsExtraItemSuggest = false;
        this.showPsAddMaterialModal = true;
    },

    onPsExtraItemCodeSearch() {
        const query = (this.psNewMaterial && this.psNewMaterial.codeSearch || '').trim().toLowerCase();
        if (!query) {
            this.psExtraItemSuggestions = (this.sapMaterialsMaster || []).slice(0, 15);
            this.showPsExtraItemSuggest = true;
            return;
        }
        const list = this.sapMaterialsMaster || [];
        this.psExtraItemSuggestions = list.filter(s => {
            const c = String(s.code || '').toLowerCase();
            const d = String(s.desc || '').toLowerCase();
            return c.includes(query) || d.includes(query);
        }).slice(0, 20);
        this.showPsExtraItemSuggest = true;
    },

    selectPsExtraItemCode(mat) {
        if (!mat) return;
        const code = mat.code || mat.itemCode || '';
        const desc = mat.desc || mat.sapDescription || '';
        const uom = mat.uom || mat.sapUom || 'No.';
        this.psNewMaterial.sapCode = code;
        this.psNewMaterial.codeSearch = code ? `[${code}] ${desc}` : desc;
        if (!this.psNewMaterial.desc || this.psNewMaterial.desc === '') {
            this.psNewMaterial.desc = desc;
        }
        this.psNewMaterial.sapDescription = desc;
        this.psNewMaterial.unit = uom;
        this.psNewMaterial.sapUom = uom;
        this.showPsExtraItemSuggest = false;
    },


    suggestNextPsItemNo(currentNo) {
        if (!currentNo) return '';
        currentNo = String(currentNo).trim();
        const matchLetter = currentNo.match(/^(\d+)([a-zA-Z])$/);
        if (matchLetter) {
            const prefix = matchLetter[1];
            const nextChar = String.fromCharCode(matchLetter[2].charCodeAt(0) + 1);
            return prefix + nextChar;
        }
        const matchNum = currentNo.match(/^(\d+)$/);
        if (matchNum) {
            return matchNum[1] + 'a';
        }
        return currentNo + 'a';
    },

    movePoleScheduleMaterialUp(mIdx) {
        if (this.isFinalized || mIdx <= 0) return;
        const k = this.selectedPoleScheduleKey || '907';
        const sched = this.getCurrentPoleSchedule();
        if (!sched || !Array.isArray(sched.materials)) return;

        const prevIdx = mIdx - 1;
        const tmp = sched.materials[mIdx];
        sched.materials[mIdx] = sched.materials[prevIdx];
        sched.materials[prevIdx] = tmp;

        // Swap quantities
        if (this.poleScheduleQuantities && this.poleScheduleQuantities[k]) {
            const qMat = this.poleScheduleQuantities[k];
            Object.keys(qMat).forEach(lIdx => {
                const row = qMat[lIdx];
                if (row) {
                    const v1 = row[mIdx];
                    const v2 = row[prevIdx];
                    if (v2 !== undefined) row[mIdx] = v2; else delete row[mIdx];
                    if (v1 !== undefined) row[prevIdx] = v1; else delete row[prevIdx];
                }
            });
        }

        if (this.poleSchedules) {
            this.poleSchedules[k] = sched;
            this.poleSchedules = { ...this.poleSchedules };
        }
        if (typeof this.syncPoleScheduleToBillingAndReconciliation === 'function') {
            this.syncPoleScheduleToBillingAndReconciliation(k);
        }
        this.recoRevision = (this.recoRevision || 0) + 1;
        this.saveToStorage();
    },

    movePoleScheduleMaterialDown(mIdx) {
        const k = this.selectedPoleScheduleKey || '907';
        const sched = this.getCurrentPoleSchedule();
        if (!sched || !Array.isArray(sched.materials)) return;
        if (this.isFinalized || mIdx >= sched.materials.length - 1) return;

        const nextIdx = mIdx + 1;
        const tmp = sched.materials[mIdx];
        sched.materials[mIdx] = sched.materials[nextIdx];
        sched.materials[nextIdx] = tmp;

        // Swap quantities
        if (this.poleScheduleQuantities && this.poleScheduleQuantities[k]) {
            const qMat = this.poleScheduleQuantities[k];
            Object.keys(qMat).forEach(lIdx => {
                const row = qMat[lIdx];
                if (row) {
                    const v1 = row[mIdx];
                    const v2 = row[nextIdx];
                    if (v2 !== undefined) row[mIdx] = v2; else delete row[mIdx];
                    if (v1 !== undefined) row[nextIdx] = v1; else delete row[nextIdx];
                }
            });
        }

        if (this.poleSchedules) {
            this.poleSchedules[k] = sched;
            this.poleSchedules = { ...this.poleSchedules };
        }
        if (typeof this.syncPoleScheduleToBillingAndReconciliation === 'function') {
            this.syncPoleScheduleToBillingAndReconciliation(k);
        }
        this.recoRevision = (this.recoRevision || 0) + 1;
        this.saveToStorage();
    },

    duplicatePoleScheduleMaterial(mIdx) {
        if (this.isFinalized) {
            this.showToast('Bill is finalized & locked. Unlock first.', '🔒');
            return;
        }
        const k = this.selectedPoleScheduleKey || '907';
        const sched = this.getCurrentPoleSchedule();
        if (!sched || !Array.isArray(sched.materials)) return;
        const origMat = sched.materials[mIdx];
        if (!origMat) return;

        const newMat = JSON.parse(JSON.stringify(origMat));
        newMat.no = this.suggestNextPsItemNo(origMat.no) || (origMat.no ? (origMat.no + 'a') : '');
        newMat.isCustom = true;
        newMat.isExtra = true;

        const insertIdx = mIdx + 1;
        sched.materials.splice(insertIdx, 0, newMat);

        // Shift quantities keys
        if (this.poleScheduleQuantities && this.poleScheduleQuantities[k]) {
            const qMat = this.poleScheduleQuantities[k];
            Object.keys(qMat).forEach(lIdx => {
                const row = qMat[lIdx];
                if (row) {
                    const newRow = {};
                    Object.keys(row).forEach(mStr => {
                        const m = Number(mStr);
                        if (m < insertIdx) {
                            newRow[m] = row[m];
                        } else {
                            newRow[m + 1] = row[m];
                        }
                    });
                    qMat[lIdx] = newRow;
                }
            });
        }

        if (this.poleSchedules) {
            this.poleSchedules[k] = sched;
            this.poleSchedules = { ...this.poleSchedules };
        }
        if (typeof this.syncPoleScheduleToBillingAndReconciliation === 'function') {
            this.syncPoleScheduleToBillingAndReconciliation(k);
        }
        this.recoRevision = (this.recoRevision || 0) + 1;
        this.saveToStorage();
        this.showToast(`Item "${newMat.desc}" duplicated below! 📋`, '✅');
    },

    submitAddPoleScheduleMaterial() {
        if (this.isFinalized) {
            this.showToast('Bill is finalized & locked. Unlock first.', '🔒');
            return;
        }
        if (!this.psNewMaterial || !this.psNewMaterial.desc || !this.psNewMaterial.desc.trim()) {
            alert('Please enter Material Description');
            return;
        }

        const k = this.selectedPoleScheduleKey || '907';
        const sched = this.getCurrentPoleSchedule();
        if (!sched || !Array.isArray(sched.materials)) return;

        let code = (this.psNewMaterial.sapCode || '').trim();
        if (!code && this.psNewMaterial.codeSearch) {
            const match = this.psNewMaterial.codeSearch.match(/^\[(.*?)\]/);
            if (match) {
                code = match[1].trim();
            } else if (/^\d{6,10}$/.test(this.psNewMaterial.codeSearch.trim())) {
                code = this.psNewMaterial.codeSearch.trim();
            }
        }

        let sapItem = null;
        if (code && this.sapMaterialsMaster) {
            sapItem = this.sapMaterialsMaster.find(s => s.code === code);
        }
        if (!sapItem && this.psNewMaterial.desc && this.sapMaterialsMaster) {
            const descNorm = this.psNewMaterial.desc.trim().toLowerCase();
            sapItem = this.sapMaterialsMaster.find(s => s.desc && s.desc.trim().toLowerCase() === descNorm);
            if (sapItem && !code) code = sapItem.code;
        }

        const sDesc = (sapItem && sapItem.desc) || this.psNewMaterial.sapDescription || this.psNewMaterial.desc.trim();
        const sUom = (sapItem && sapItem.uom) || this.psNewMaterial.sapUom || this.psNewMaterial.unit || 'No.';
        const itemNo = this.psNewMaterial.no || (sched.materials.length + 1).toString();

        const isSection = this.psNewMaterial.rowType === 'section';
        const newMat = isSection ? {
            no: '',
            desc: this.psNewMaterial.desc.trim(),
            unit: this.psNewMaterial.unit ? this.psNewMaterial.unit.trim() : 'Kg.',
            rate: 0,
            itemCode: '',
            isSection: true,
            isCustom: true
        } : {
            no: itemNo,
            desc: this.psNewMaterial.desc.trim(),
            unit: this.psNewMaterial.unit || sUom || 'No.',
            rate: parseFloat(this.psNewMaterial.rate) || 0,
            itemCode: code,
            sapDescription: sDesc,
            sapUom: sUom,
            docHeader: '0031006347',
            sapItems: code ? [{
                code: code,
                desc: sDesc,
                uom: sUom,
                qty: 1,
                docHeader: '0031006347'
            }] : [],
            isExtra: true,
            isCustom: true
        };

        const insertAfterIdx = Number(this.psNewMaterial.insertAfterIdx);
        if (insertAfterIdx >= 0 && insertAfterIdx < sched.materials.length) {
            const insertIdx = insertAfterIdx + 1;
            sched.materials.splice(insertIdx, 0, newMat);

            // Shift poleScheduleQuantities index keys
            if (this.poleScheduleQuantities && this.poleScheduleQuantities[k]) {
                const qMat = this.poleScheduleQuantities[k];
                Object.keys(qMat).forEach(lIdx => {
                    const row = qMat[lIdx];
                    if (row) {
                        const newRow = {};
                        Object.keys(row).forEach(mStr => {
                            const m = Number(mStr);
                            if (m < insertIdx) {
                                newRow[m] = row[m];
                            } else {
                                newRow[m + 1] = row[m];
                            }
                        });
                        qMat[lIdx] = newRow;
                    }
                });
            }
        } else {
            sched.materials.push(newMat);
        }

        // Reactive updates
        if (this.poleSchedules) {
            this.poleSchedules[k] = sched;
            this.poleSchedules = { ...this.poleSchedules };
        }
        if (typeof this.syncPoleScheduleToBillingAndReconciliation === 'function') {
            this.syncPoleScheduleToBillingAndReconciliation(k);
        }
        this.recoRevision = (this.recoRevision || 0) + 1;
        this.showPsAddMaterialModal = false;
        this.saveToStorage();
        this.showToast(`Item "${newMat.desc}" added with SAP Code [${code || 'N/A'}]! 🎉`, '✅');
    },

    removePoleScheduleMaterial(mIdx) {
        if (this.isFinalized) {
            this.showToast('Bill is finalized & locked. Unlock first.', '🔒');
            return;
        }
        const k = this.selectedPoleScheduleKey || '907';
        const sched = this.getCurrentPoleSchedule();
        if (!sched || !Array.isArray(sched.materials)) return;
        const mat = sched.materials[mIdx];
        if (!mat) return;

        const name = mat.desc || (`Item ${mIdx + 1}`);
        if (!confirm(`Kya aap "${name}" ko Pole Schedule ${k} se delete karna chahte hain?`)) return;

        sched.materials.splice(mIdx, 1);

        // Adjust quantities index keys
        if (this.poleScheduleQuantities && this.poleScheduleQuantities[k]) {
            const qMat = this.poleScheduleQuantities[k];
            Object.keys(qMat).forEach(lIdx => {
                const row = qMat[lIdx];
                if (row) {
                    const newRow = {};
                    Object.keys(row).forEach(mStr => {
                        const m = Number(mStr);
                        if (m < mIdx) {
                            newRow[m] = row[m];
                        } else if (m > mIdx) {
                            newRow[m - 1] = row[m];
                        }
                    });
                    qMat[lIdx] = newRow;
                }
            });
        }

        if (this.poleSchedules) {
            this.poleSchedules[k] = sched;
            this.poleSchedules = { ...this.poleSchedules };
        }
        if (typeof this.syncPoleScheduleToBillingAndReconciliation === 'function') {
            this.syncPoleScheduleToBillingAndReconciliation(k);
        }
        this.recoRevision = (this.recoRevision || 0) + 1;
        this.saveToStorage();
        this.showToast(`Item "${name}" removed from Pole Schedule ${k}`, '🗑️');
    },

    exportPoleScheduleExcel() {
        if (typeof XLSX === 'undefined') {
            this.showToast('XLSX library not loaded', '❌');
            return;
        }
        const k = this.selectedPoleScheduleKey || '907';
        const sched = this.getCurrentPoleSchedule();
        const mats = this.getPoleScheduleMaterials();
        const locs = this.getPoleScheduleLocations();
        const contractorName = typeof this.getContractorDisplayName === 'function' ? this.getContractorDisplayName() : 'CONTRACTOR';
        const billNo = this.effectiveBillNo || 'BILL';

        const rows = [];
        rows.push([`ASHOKA BUILDCON LIMITED — RDSS T-10 GADCHIROLI`]);
        rows.push([`${sched.title || ('Pole Schedule ' + k)}`]);
        rows.push([`Contractor: ${contractorName} | Bill No: ${billNo} | Date: ${new Date().toLocaleDateString('en-IN')}`]);
        rows.push([]);

        // Header row
        const header = ['Item No', 'SAP Code', 'Material Description', 'Unit'];
        locs.forEach(loc => header.push(loc.name || 'Location'));
        header.push('Total Qty', 'Unit Rate', '100% Amount', `${this.pctStage1}% Amount`);
        rows.push(header);

        // Data rows
        mats.forEach((m, mIdx) => {
            if (m.isSection) {
                const secRow = ['', '', m.desc || '', m.unit || ''];
                locs.forEach(() => secRow.push(''));
                secRow.push('', '', '', '');
                rows.push(secRow);
                return;
            }
            const row = [
                m.no || '',
                m.itemCode || '',
                m.desc || '',
                m.unit || ''
            ];
            locs.forEach((_, lIdx) => {
                const q = this.getPoleScheduleCellQty(lIdx, mIdx);
                const num = q !== '' ? (typeof this.evalGridFormula === 'function' ? Number(this.evalGridFormula(String(q))) : parseFloat(q)) : '';
                row.push(num !== '' && !isNaN(num) ? num : '');
            });
            const totQty = this.getPoleScheduleItemTotalQty(mIdx);
            const amt100 = this.getPoleScheduleItemAmount100(m, mIdx);
            const amtStage1 = this.getPoleScheduleItemAmountStage1(m, mIdx);
            row.push(totQty > 0 ? totQty : '');
            row.push(m.rate || 0);
            row.push(amt100 > 0 ? amt100 : '');
            row.push(amtStage1 > 0 ? amtStage1 : '');
            rows.push(row);
        });

        // Total row
        const totals = this.getPoleScheduleTotals();
        const totalRow = ['TOTAL', '', '', ''];
        locs.forEach(() => totalRow.push(''));
        totalRow.push(totals.totalQty, '', totals.totalAmt100, totals.totalAmtStage1);
        rows.push(totalRow);

        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Pole_Schedule_${k}`);

        const filename = `Pole_Schedule_${k}_${contractorName.replace(/[^a-zA-Z0-9]/g, '_')}_${billNo}.xlsx`;
        XLSX.writeFile(wb, filename);
        this.showToast(`Excel exported: ${filename}`, '📗');
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.PoleScheduleModule;
}

