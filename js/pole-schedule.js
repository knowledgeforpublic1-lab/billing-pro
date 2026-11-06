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
        const qtyFilter = this.poleScheduleFilterQty || 'ALL';
        const sapFilter = this.poleScheduleFilterSap || 'ALL';
        const unitFilter = (this.poleScheduleFilterUnit || 'ALL').trim().toUpperCase();
        const colFilters = this.poleScheduleColumnFilters || {};
        const sortCol = this.poleScheduleSortCol;
        const sortDir = this.poleScheduleSortDir || 'asc';

        const isFiltering = !!(q || qtyFilter !== 'ALL' || sapFilter !== 'ALL' || unitFilter !== 'ALL' || Object.values(colFilters).some(v => v && String(v).trim()));

        // Map items with origIndex
        const mapped = mats.map((m, idx) => Object.assign({}, m, { origIndex: idx }));

        if (!isFiltering && !sortCol) {
            return mapped;
        }

        // Filter items
        let filtered = mapped.filter(m => {
            if (m.isSection) return true; // section header handled below

            // 1. Text Search query (Item No, SAP Code, Description, SAP Description, Unit)
            if (q) {
                const code = String(m.itemCode || '').toLowerCase();
                const desc = String(m.desc || '').toLowerCase();
                const sapDesc = String(m.sapDescription || '').toLowerCase();
                const no = String(m.no || '').toLowerCase();
                const unit = String(m.unit || '').toLowerCase();
                if (!code.includes(q) && !desc.includes(q) && !sapDesc.includes(q) && !no.includes(q) && !unit.includes(q)) {
                    return false;
                }
            }

            // 2. Quantity Filter
            const totQty = this.getPoleScheduleItemTotalQty(m.origIndex);
            if (qtyFilter === 'WITH_QTY') {
                if (totQty <= 0) return false;
            } else if (qtyFilter === 'ZERO_QTY') {
                if (totQty > 0) return false;
            }

            // 3. SAP Mapping Filter
            const hasSap = !!(m.itemCode && String(m.itemCode).trim());
            if (sapFilter === 'MAPPED') {
                if (!hasSap) return false;
            } else if (sapFilter === 'UNMAPPED') {
                if (hasSap) return false;
            }

            // 4. Unit Filter
            if (unitFilter !== 'ALL') {
                const mUnit = String(m.unit || '').trim().toUpperCase();
                if (mUnit !== unitFilter) return false;
            }

            // 5. Individual Column Filters
            if (colFilters.itemNo && String(m.no || '').toLowerCase().indexOf(String(colFilters.itemNo).toLowerCase()) === -1) return false;
            if (colFilters.itemCode && String(m.itemCode || '').toLowerCase().indexOf(String(colFilters.itemCode).toLowerCase()) === -1) return false;
            if (colFilters.desc && String(m.desc || '').toLowerCase().indexOf(String(colFilters.desc).toLowerCase()) === -1) return false;
            if (colFilters.unit && String(m.unit || '').toLowerCase().indexOf(String(colFilters.unit).toLowerCase()) === -1) return false;
            if (colFilters.totalQty) {
                const cf = String(colFilters.totalQty).trim();
                if (cf === '>0' && totQty <= 0) return false;
                if (cf === '=0' && totQty > 0) return false;
                if (!isNaN(parseFloat(cf)) && Math.abs(totQty - parseFloat(cf)) > 0.001) return false;
            }
            if (colFilters.rate) {
                const cr = String(colFilters.rate).trim();
                const r = Number(m.rate) || 0;
                if (cr === '>0' && r <= 0) return false;
                if (cr === '=0' && r > 0) return false;
                if (!isNaN(parseFloat(cr)) && Math.abs(r - parseFloat(cr)) > 0.001) return false;
            }
            if (colFilters.amt100) {
                const ca = String(colFilters.amt100).trim();
                const a = this.getPoleScheduleItemAmount100(m, m.origIndex);
                if (ca === '>0' && a <= 0) return false;
                if (ca === '=0' && a > 0) return false;
            }

            return true;
        });

        // 6. Section Header Clean-up: If filtering is active, only show section headers that have at least 1 matching item underneath
        if (isFiltering) {
            const result = [];
            let currentSection = null;
            let sectionHasItems = false;

            filtered.forEach(item => {
                if (item.isSection) {
                    currentSection = item;
                    sectionHasItems = false;
                } else {
                    if (currentSection && !sectionHasItems) {
                        result.push(currentSection);
                        sectionHasItems = true;
                    }
                    result.push(item);
                }
            });
            filtered = result;
        }

        // 7. Column Sorting (if active)
        if (sortCol) {
            const nonSections = filtered.filter(m => !m.isSection);
            nonSections.sort((a, b) => {
                let vA, vB;
                if (sortCol === 'no') {
                    vA = parseFloat(a.no) || 0;
                    vB = parseFloat(b.no) || 0;
                } else if (sortCol === 'itemCode') {
                    vA = String(a.itemCode || '');
                    vB = String(b.itemCode || '');
                } else if (sortCol === 'desc') {
                    vA = String(a.desc || '').toLowerCase();
                    vB = String(b.desc || '').toLowerCase();
                } else if (sortCol === 'unit') {
                    vA = String(a.unit || '').toLowerCase();
                    vB = String(b.unit || '').toLowerCase();
                } else if (sortCol === 'totalQty') {
                    vA = this.getPoleScheduleItemTotalQty(a.origIndex);
                    vB = this.getPoleScheduleItemTotalQty(b.origIndex);
                } else if (sortCol === 'rate') {
                    vA = Number(a.rate) || 0;
                    vB = Number(b.rate) || 0;
                } else if (sortCol === 'amt100') {
                    vA = this.getPoleScheduleItemAmount100(a, a.origIndex);
                    vB = this.getPoleScheduleItemAmount100(b, b.origIndex);
                } else if (sortCol === 'amtStage1') {
                    vA = this.getPoleScheduleItemAmountStage1(a, a.origIndex);
                    vB = this.getPoleScheduleItemAmountStage1(b, b.origIndex);
                }
                if (vA < vB) return sortDir === 'asc' ? -1 : 1;
                if (vA > vB) return sortDir === 'asc' ? 1 : -1;
                return 0;
            });
            return nonSections;
        }

        return filtered;
    },

    getFilteredPoleScheduleTotals() {
        const mats = typeof this.getFilteredPoleScheduleMaterials === 'function' ? this.getFilteredPoleScheduleMaterials() : [];
        let totalQty = 0;
        let totalAmt100 = 0;
        let totalAmtStage1 = 0;
        mats.forEach(m => {
            if (!m.isSection && !m.isSpan) {
                const q = this.getPoleScheduleItemTotalQty(m.origIndex);
                totalQty += q;
                const amt100 = this.getPoleScheduleItemAmount100(m, m.origIndex);
                totalAmt100 += amt100;
                totalAmtStage1 += this.getPoleScheduleItemAmountStage1(m, m.origIndex);
            }
        });
        return {
            totalQty: Math.round(totalQty * 100) / 100,
            totalAmt100: Math.round(totalAmt100 * 100) / 100,
            totalAmtStage1: Math.round(totalAmtStage1 * 100) / 100,
            count: mats.filter(m => !m.isSection).length
        };
    },

    getPoleScheduleUniqueUnits() {
        const mats = this.getPoleScheduleMaterials();
        const set = new Set();
        mats.forEach(m => {
            if (!m.isSection && m.unit && String(m.unit).trim()) {
                set.add(String(m.unit).trim().toUpperCase());
            }
        });
        return ['ALL', ...Array.from(set).sort()];
    },

    resetPoleScheduleFilters() {
        this.poleScheduleSearchQuery = '';
        this.poleScheduleFilterQty = 'ALL';
        this.poleScheduleFilterSap = 'ALL';
        this.poleScheduleFilterUnit = 'ALL';
        this.poleScheduleColumnFilters = {};
        this.poleScheduleActiveFilterCol = null;
        this.poleScheduleSortCol = null;
        this.poleScheduleSortDir = 'asc';
        this.showToast('All filters reset (showing full schedule) 🔄', 'info');
    },

    togglePoleScheduleFilterCol(col) {
        if (this.poleScheduleActiveFilterCol === col) {
            this.poleScheduleActiveFilterCol = null;
        } else {
            this.poleScheduleActiveFilterCol = col;
        }
    },

    closePoleScheduleColFilter() {
        this.poleScheduleActiveFilterCol = null;
    },

    setPoleScheduleSort(col, dir) {
        this.poleScheduleSortCol = col;
        this.poleScheduleSortDir = dir || 'asc';
        this.poleScheduleActiveFilterCol = null;
    },

    clearPoleScheduleSort() {
        this.poleScheduleSortCol = null;
        this.poleScheduleSortDir = 'asc';
        this.poleScheduleActiveFilterCol = null;
    },

    setPoleScheduleColFilter(col, val) {
        if (!this.poleScheduleColumnFilters) this.poleScheduleColumnFilters = {};
        this.poleScheduleColumnFilters = Object.assign({}, this.poleScheduleColumnFilters, { [col]: val });
        this.poleScheduleActiveFilterCol = null;
    },

    clearPoleScheduleColFilter(col) {
        if (this.poleScheduleColumnFilters) {
            const updated = Object.assign({}, this.poleScheduleColumnFilters);
            delete updated[col];
            this.poleScheduleColumnFilters = updated;
        }
        this.poleScheduleActiveFilterCol = null;
    },

    copyFilteredPoleScheduleToClipboard() {
        const mats = (typeof this.getFilteredPoleScheduleMaterials === 'function' ? this.getFilteredPoleScheduleMaterials() : []).filter(m => !m.isSection);
        if (mats.length === 0) {
            this.showToast('No items to copy', '⚠️');
            return;
        }
        const locs = this.getPoleScheduleLocations();
        const header = ['Item No', 'SAP Code', 'Material Description', 'Unit'];
        locs.forEach(loc => header.push(loc.name || 'Location'));
        header.push('Total Qty', 'Unit Rate', '100% Amount', (this.pctStage1 || 85) + '% Amount');

        const rows = [header.join('\t')];
        mats.forEach(m => {
            const r = [
                m.no || '',
                m.itemCode || '',
                m.desc || '',
                m.unit || ''
            ];
            locs.forEach((_, lIdx) => {
                const q = this.getPoleScheduleCellQty(lIdx, m.origIndex);
                r.push(q !== '' && q !== null && q !== undefined ? q : '');
            });
            const totQty = this.getPoleScheduleItemTotalQty(m.origIndex);
            const amt100 = this.getPoleScheduleItemAmount100(m, m.origIndex);
            const amtStage1 = this.getPoleScheduleItemAmountStage1(m, m.origIndex);
            r.push(totQty > 0 ? totQty : '');
            r.push(m.rate || 0);
            r.push(amt100 > 0 ? amt100 : '');
            r.push(amtStage1 > 0 ? amtStage1 : '');
            rows.push(r.join('\t'));
        });

        const text = rows.join('\n');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                this.showToast('📋 ' + mats.length + ' Filtered items copied! Paste directly into Excel (Ctrl+V)', '✅');
            }).catch(() => {
                this.fallbackCopyToClipboard(text, mats.length);
            });
        } else {
            this.fallbackCopyToClipboard(text, mats.length);
        }
    },

    fallbackCopyToClipboard(text, count) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            this.showToast('📋 ' + count + ' Filtered items copied! Paste directly into Excel (Ctrl+V)', '✅');
        } catch(e) {
            this.showToast('Could not copy to clipboard', '❌');
        }
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

    setPoleScheduleCellQty(lIdx, mIdx, val, skipAutoConcrete = false) {
        const k = this.selectedPoleScheduleKey || '907';
        this.ensurePoleScheduleQuantities(k);
        this.poleScheduleQuantities[k][lIdx][mIdx] = val;

        // Auto-recalculate concreting if pole or stay item was changed
        if (!skipAutoConcrete && this.poleScheduleAutoConcreting) {
            const sched = (this.poleSchedules && this.poleSchedules[k]) || (typeof defaultPoleSchedules !== 'undefined' && defaultPoleSchedules[k]);
            if (sched && sched.materials && sched.materials[mIdx]) {
                const item = sched.materials[mIdx];
                if (typeof this.isPoleSchedulePoleItem === 'function' && typeof this.isPoleScheduleStayItem === 'function') {
                    if (this.isPoleSchedulePoleItem(item) || this.isPoleScheduleStayItem(item)) {
                        this.recalculatePoleScheduleLocationConcreting(k, lIdx);
                    }
                }
            }
        }

        // Vue 3 reactivity triggers
        this.poleScheduleQuantities[k] = { ...this.poleScheduleQuantities[k] };
        this.poleScheduleQuantities = { ...this.poleScheduleQuantities };
        if (typeof this.syncPoleScheduleToBillingAndReconciliation === 'function') {
            this.syncPoleScheduleToBillingAndReconciliation(k);
        }
        this.recoRevision = (this.recoRevision || 0) + 1;
        this.debouncedSave();
    },

    commitPoleScheduleCell(lIdx, mIdx, rawVal) {
        if (this.isFinalized) return;
        if (rawVal === '' || rawVal === null || rawVal === undefined) {
            this.setPoleScheduleCellQty(lIdx, mIdx, '');
            return '';
        }
        const str = String(rawVal).trim();
        let evaluated = str;
        if (typeof this.evalFormula === 'function') {
            evaluated = this.evalFormula(str);
        } else if (typeof this.evalGridFormula === 'function') {
            evaluated = this.evalGridFormula(str);
        }
        const num = Number(evaluated);
        const finalVal = (evaluated === '' || isNaN(num)) ? (isNaN(Number(str)) ? str : Number(str)) : (Math.round(num * 100) / 100);
        this.setPoleScheduleCellQty(lIdx, mIdx, finalVal);
        return finalVal;
    },

    onPoleScheduleQtyInput(lIdx, mIdx, event) {
        if (this.isFinalized) return;
        const val = event.target.value;
        this.setPoleScheduleCellQty(lIdx, mIdx, val);
    },

    onPoleScheduleQtyBlur(lIdx, mIdx, event) {
        if (!event || !event.target) return;
        const finalVal = this.commitPoleScheduleCell(lIdx, mIdx, event.target.value);
        if (finalVal !== undefined) {
            event.target.value = finalVal;
        }
        this.saveToStorage();
    },

    onPoleScheduleQtyChange(lIdx, mIdx, event) {
        this.onPoleScheduleQtyBlur(lIdx, mIdx, event);
    },

    handlePoleScheduleKeyNav(event, mIdx, lIdx, direction) {
        if (event && event.target) {
            this.onPoleScheduleQtyBlur(lIdx, mIdx, event);
        }
        let targetMIdx = mIdx;
        let targetLIdx = lIdx;
        const mats = this.getPoleScheduleMaterials();
        const locs = this.getPoleScheduleLocations();

        if (direction === 'down') {
            targetMIdx = mIdx + 1;
            while (targetMIdx < mats.length && mats[targetMIdx].isSection) targetMIdx++;
        } else if (direction === 'up') {
            targetMIdx = mIdx - 1;
            while (targetMIdx >= 0 && mats[targetMIdx].isSection) targetMIdx--;
        } else if (direction === 'right') {
            targetLIdx = lIdx + 1;
            if (targetLIdx >= locs.length) {
                targetLIdx = 0;
                targetMIdx = mIdx + 1;
                while (targetMIdx < mats.length && mats[targetMIdx].isSection) targetMIdx++;
            }
        } else if (direction === 'left') {
            targetLIdx = lIdx - 1;
            if (targetLIdx < 0) {
                targetLIdx = locs.length - 1;
                targetMIdx = mIdx - 1;
                while (targetMIdx >= 0 && mats[targetMIdx].isSection) targetMIdx--;
            }
        }

        if (targetLIdx < 0) targetLIdx = 0;
        if (targetLIdx >= locs.length) targetLIdx = locs.length - 1;
        if (targetMIdx < 0) targetMIdx = 0;
        if (targetMIdx >= mats.length) targetMIdx = mats.length - 1;

        this.$nextTick(() => {
            const targetEl = document.querySelector(`input[data-ps-row="${targetMIdx}"][data-ps-loc="${targetLIdx}"]`);
            if (targetEl) {
                targetEl.focus();
                targetEl.select();
            }
        });
    },

    handlePoleSchedulePaste(event, startMIdx, startLIdx) {
        if (this.isFinalized) {
            this.showToast('Bill locked — unlock to edit', '🔒');
            return;
        }
        const text = (event.clipboardData || window.clipboardData).getData('text');
        if (!text) return;
        event.preventDefault();
        const rows = text.split(/\r?\n/).filter(r => r.length > 0);
        const mats = this.getPoleScheduleMaterials();
        const locs = this.getPoleScheduleLocations();
        if (!mats.length || !locs.length) return;

        let pasted = 0;
        let curMIdx = startMIdx;

        for (let r = 0; r < rows.length; r++) {
            while (curMIdx < mats.length && mats[curMIdx].isSection) {
                curMIdx++;
            }
            if (curMIdx >= mats.length) break;

            const cells = rows[r].split('\t');
            for (let c = 0; c < cells.length; c++) {
                const curLIdx = startLIdx + c;
                if (curLIdx >= locs.length) break;

                const raw = cells[c].trim().replace(/,/g, '');
                let evaluated = raw;
                if (typeof this.evalFormula === 'function') {
                    evaluated = this.evalFormula(raw);
                }
                const num = Number(evaluated);
                const val = (raw === '' || isNaN(num)) ? '' : (Math.round(num * 100) / 100);
                this.setPoleScheduleCellQty(curLIdx, curMIdx, val);
                pasted++;
            }
            curMIdx++;
        }

        if (pasted > 0) {
            this.showToast(`Pasted ${pasted} values into Pole Schedule`, '📋');
            const k = this.selectedPoleScheduleKey || '907';
            if (typeof this.syncPoleScheduleToBillingAndReconciliation === 'function') {
                this.syncPoleScheduleToBillingAndReconciliation(k);
            }
            this.saveToStorage();
        }
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
        return Math.round(total * 100) / 100;
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
            totalQty: Math.round(totalQty * 100) / 100,
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
            totalQty: Math.round(totalQty * 100) / 100,
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
        const locs = this.getPoleScheduleLocations(k);
        const nextNum = locs.length + 1;
        const name = prompt(`Enter Location Name for Schedule ${k}:`, `Loc ${nextNum}`);
        if (!name || !name.trim()) return;

        locs.push({ name: name.trim() });

        // Ensure poleScheduleQuantities has an entry for the new location
        if (!this.poleScheduleQuantities) this.poleScheduleQuantities = {};
        if (!this.poleScheduleQuantities[k]) this.poleScheduleQuantities[k] = {};
        const newLIdx = locs.length - 1;
        if (!this.poleScheduleQuantities[k][newLIdx]) {
            this.poleScheduleQuantities[k][newLIdx] = {};
        }

        // Synchronize with activityLocations
        if (!this.activityLocations) this.activityLocations = {};
        this.activityLocations[k] = JSON.parse(JSON.stringify(locs));

        // Ensure activityQuantities has a row for this new location
        if (!this.activityQuantities) this.activityQuantities = {};
        if (!this.activityQuantities[k] || !Array.isArray(this.activityQuantities[k])) {
            this.activityQuantities[k] = [];
        }
        const matCount = (this.activities && this.activities[k] && this.activities[k].materials) ? this.activities[k].materials.length : 0;
        while (this.activityQuantities[k].length < locs.length) {
            this.activityQuantities[k].push(new Array(matCount).fill(''));
        }

        // Trigger reactivity
        this.poleScheduleLocations = { ...this.poleScheduleLocations };
        this.activityLocations = { ...this.activityLocations };
        this.poleScheduleQuantities = { ...this.poleScheduleQuantities };
        this.activityQuantities = { ...this.activityQuantities };

        // Recalculate concreting if active
        if (this.poleScheduleAutoConcreting && typeof this.recalculatePoleScheduleLocationConcreting === 'function') {
            this.recalculatePoleScheduleLocationConcreting(k, newLIdx);
        }

        this.syncPoleScheduleToBillingAndReconciliation(k);
        this.recoRevision = (this.recoRevision || 0) + 1;
        this.saveToStorage();
        this.showToast(`Location "${name.trim()}" added to Pole Schedule ${k} & Activity Billing`, '📍');
    },

    renamePoleScheduleLocation(lIdx) {
        if (this.isFinalized) return;
        const k = this.selectedPoleScheduleKey || '907';
        const locs = this.getPoleScheduleLocations(k);
        if (!locs[lIdx]) return;
        const currentName = locs[lIdx].name || `Loc ${lIdx + 1}`;
        const newName = prompt(`Rename Location:`, currentName);
        if (newName && newName.trim() && newName.trim() !== currentName) {
            locs[lIdx].name = newName.trim();
            if (!this.activityLocations) this.activityLocations = {};
            this.activityLocations[k] = JSON.parse(JSON.stringify(locs));
            this.poleScheduleLocations = { ...this.poleScheduleLocations };
            this.activityLocations = { ...this.activityLocations };
            this.syncPoleScheduleToBillingAndReconciliation(k);
            this.saveToStorage();
            this.showToast(`Renamed to "${newName.trim()}"`, '✏️');
        }
    },

    removePoleScheduleLocation(lIdx) {
        if (this.isFinalized) return;
        const k = this.selectedPoleScheduleKey || '907';
        const locs = this.getPoleScheduleLocations(k);
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

        if (!this.activityLocations) this.activityLocations = {};
        this.activityLocations[k] = JSON.parse(JSON.stringify(locs));
        if (this.activityQuantities && this.activityQuantities[k] && Array.isArray(this.activityQuantities[k])) {
            this.activityQuantities[k].splice(lIdx, 1);
        }

        this.poleScheduleLocations = { ...this.poleScheduleLocations };
        this.activityLocations = { ...this.activityLocations };
        this.poleScheduleQuantities = { ...this.poleScheduleQuantities };
        this.activityQuantities = { ...this.activityQuantities };

        this.syncPoleScheduleToBillingAndReconciliation(k);
        this.recoRevision = (this.recoRevision || 0) + 1;
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
        return Math.round(total * 100) / 100;
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
                    const actMat = act.materials[actMatIdx];
                    let ratio = 1;
                    if (actMat) {
                        if (actMat.poleRatio !== undefined && actMat.poleRatio !== null && !isNaN(Number(actMat.poleRatio)) && Number(actMat.poleRatio) > 0) {
                            ratio = Number(actMat.poleRatio);
                        } else if (actMat.poleRatioDivisor && Number(actMat.poleRatioDivisor) > 0) {
                            ratio = 1 / Number(actMat.poleRatioDivisor);
                        } else if (actMat.unit && actMat.unit.toLowerCase().includes('set') && sm.unit && sm.unit.toLowerCase().includes('no') && sm.desc && sm.desc.toLowerCase().includes('cut point')) {
                            ratio = 0.5;
                            actMat.poleRatio = 0.5;
                            actMat.poleRatioDivisor = 2;
                            actMat.poleRatioMode = 'divisor';
                        }
                    }
                    locs.forEach((_, lIdx) => {
                        const val = (qMatrix[lIdx] && qMatrix[lIdx][smIdx] !== undefined) ? qMatrix[lIdx][smIdx] : '';
                        if (this.activityQuantities[k][lIdx]) {
                            if (val === '' || val === null || val === undefined) {
                                this.activityQuantities[k][lIdx][actMatIdx] = '';
                            } else {
                                const num = typeof this.evalGridFormula === 'function' ? Number(this.evalGridFormula(String(val))) : parseFloat(val);
                                if (!isNaN(num)) {
                                    const converted = num * ratio;
                                    const rounded = Math.round(converted * 1000) / 1000;
                                    this.activityQuantities[k][lIdx][actMatIdx] = rounded;
                                } else {
                                    this.activityQuantities[k][lIdx][actMatIdx] = val;
                                }
                            }
                        }
                    });
                }
            });
        }

        // Vue 3 reactivity trigger
        this.activityLocations = { ...this.activityLocations };
        this.poleScheduleLocations = { ...this.poleScheduleLocations };
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
        const locs = (this.activityLocations && this.activityLocations[k]) || (this.poleScheduleLocations && this.poleScheduleLocations[k]) || (typeof this.getPoleScheduleLocations === 'function' ? this.getPoleScheduleLocations(k) : []);

        if (!this.poleScheduleLocations) this.poleScheduleLocations = {};
        this.poleScheduleLocations[k] = JSON.parse(JSON.stringify(locs));

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
                const actMat = act.materials[actMatIdx];
                let ratio = 1;
                if (actMat) {
                    if (actMat.poleRatio !== undefined && actMat.poleRatio !== null && !isNaN(Number(actMat.poleRatio)) && Number(actMat.poleRatio) > 0) {
                        ratio = Number(actMat.poleRatio);
                    } else if (actMat.poleRatioDivisor && Number(actMat.poleRatioDivisor) > 0) {
                        ratio = 1 / Number(actMat.poleRatioDivisor);
                    }
                }
                locs.forEach((_, lIdx) => {
                    const val = (this.activityQuantities[k][lIdx] && this.activityQuantities[k][lIdx][actMatIdx] !== undefined)
                        ? this.activityQuantities[k][lIdx][actMatIdx]
                        : '';
                    if (!this.poleScheduleQuantities[k][lIdx]) {
                        this.poleScheduleQuantities[k][lIdx] = {};
                    }
                    if (val === '' || val === null || val === undefined) {
                        this.poleScheduleQuantities[k][lIdx][smIdx] = '';
                    } else {
                        const num = typeof this.evalGridFormula === 'function' ? Number(this.evalGridFormula(String(val))) : parseFloat(val);
                        if (!isNaN(num) && ratio > 0) {
                            const poleVal = Math.round((num / ratio) * 1000) / 1000;
                            this.poleScheduleQuantities[k][lIdx][smIdx] = poleVal;
                        } else {
                            this.poleScheduleQuantities[k][lIdx][smIdx] = val;
                        }
                    }
                });
            }
        });

        // Vue 3 reactivity trigger
        this.poleScheduleLocations = { ...this.poleScheduleLocations };
        this.poleScheduleQuantities[k] = { ...this.poleScheduleQuantities[k] };
        this.poleScheduleQuantities = { ...this.poleScheduleQuantities };
        this.recoRevision = (this.recoRevision || 0) + 1;
    },

    // =========================================================================
    // 📐 POLE SCHEDULE ➔ ACTIVITY RATIO MAPPING SUITE (User requested)
    // =========================================================================

    getItemPoleRatio(item) {
        if (!item) return 1;
        if (item.poleRatio !== undefined && item.poleRatio !== null && !isNaN(Number(item.poleRatio)) && Number(item.poleRatio) > 0) {
            return Number(item.poleRatio);
        }
        if (item.poleRatioDivisor && Number(item.poleRatioDivisor) > 0) {
            return 1 / Number(item.poleRatioDivisor);
        }
        return 1;
    },

    getItemPoleRatioDivisor(item) {
        if (!item) return 1;
        if (item.poleRatioDivisor && Number(item.poleRatioDivisor) > 0) {
            return Number(item.poleRatioDivisor);
        }
        if (item.poleRatio && Number(item.poleRatio) > 0 && Number(item.poleRatio) !== 1) {
            return Math.round((1 / Number(item.poleRatio)) * 1000) / 1000;
        }
        return 1;
    },

    formatPoleRatioBadge(item) {
        if (!item) return '';
        const ratio = this.getItemPoleRatio(item);
        if (ratio === 1) return '';
        const div = this.getItemPoleRatioDivisor(item);
        if (div > 1) {
            return `1 ${item.unit || 'Set'} = ${div} Nos (÷${div})`;
        }
        return `Ratio ×${ratio}`;
    },

    getMatchedPoleMaterial(actKey, actMat) {
        if (!actMat) return null;
        const k = actKey || this.selectedActivityKey || '907';
        const sched = (this.poleSchedules && this.poleSchedules[k]) || (typeof defaultPoleSchedules !== 'undefined' && defaultPoleSchedules[k]);
        if (!sched || !Array.isArray(sched.materials)) return null;
        return sched.materials.find(sm => {
            if (sm.isSection || sm.isSpan) return false;
            if (sm.itemCode && actMat.itemCode && String(sm.itemCode).trim() === String(actMat.itemCode).trim()) return true;
            if (sm.desc && actMat.desc && sm.desc.trim().toLowerCase() === sm.desc.trim().toLowerCase()) return true;
            return false;
        }) || null;
    },

    openPoleRatioModal(actKey) {
        this.selectedPoleRatioActKey = actKey || this.selectedActivityKey || '907';
        this.poleRatioSearchQuery = '';
        this.showPoleRatioModal = true;
    },

    openItemPoleRatioPrompt(item, origIndex) {
        if (this.isFinalized) {
            this.showToast('Bill locked — unlock to edit ratio', '🔒');
            return;
        }
        const k = this.selectedActivityKey || '907';
        const curDiv = this.getItemPoleRatioDivisor(item);
        const promptMsg = `Set Pole Schedule Ratio for "${item.desc}"\n\nEnter how many Pole Schedule units equal 1 Activity ${item.unit || 'Unit'}:\n(e.g., enter 2 for '2 Nos = 1 Set' so Activity Qty = Pole Qty / 2, or 1 for 1:1 direct):`;
        const input = prompt(promptMsg, String(curDiv || 1));
        if (input === null) return;
        const num = parseFloat(input);
        if (!isNaN(num) && num > 0) {
            item.poleRatioDivisor = num;
            item.poleRatio = Math.round((1 / num) * 10000) / 10000;
            item.poleRatioMode = 'divisor';
            this.syncPoleScheduleToBillingAndReconciliation(k);
            this.saveToStorage();
            this.showToast(`Ratio updated: 1 ${item.unit || 'Unit'} = ${num} Pole Units`, '📐');
        } else {
            this.showToast('Invalid ratio number entered', '⚠️');
        }
    },

    updateItemPoleRatioMode(item, mode) {
        if (!item) return;
        item.poleRatioMode = mode;
        if (mode === 'multiplier') {
            item.poleRatio = item.poleRatio || (item.poleRatioDivisor ? (Math.round((1 / item.poleRatioDivisor) * 10000) / 10000) : 1);
        } else {
            item.poleRatioDivisor = item.poleRatioDivisor || (item.poleRatio ? (Math.round((1 / item.poleRatio) * 10000) / 10000) : 1);
        }
    },

    updateItemPoleRatioValue(item, rawVal) {
        if (!item) return;
        const val = parseFloat(rawVal);
        if (isNaN(val) || val <= 0) return;
        if (item.poleRatioMode === 'multiplier') {
            item.poleRatio = val;
            item.poleRatioDivisor = Math.round((1 / val) * 10000) / 10000;
        } else {
            item.poleRatioDivisor = val;
            item.poleRatio = Math.round((1 / val) * 10000) / 10000;
        }
    },

    setItemPoleRatioPreset(item, mode, val) {
        if (!item) return;
        item.poleRatioMode = mode;
        if (mode === 'divisor') {
            item.poleRatioDivisor = val;
            item.poleRatio = Math.round((1 / val) * 10000) / 10000;
        } else {
            item.poleRatio = val;
            item.poleRatioDivisor = Math.round((1 / val) * 10000) / 10000;
        }
        const k = this.selectedPoleRatioActKey || this.selectedActivityKey || '907';
        this.syncPoleScheduleToBillingAndReconciliation(k);
        this.saveToStorage();
    },

    getPoleRatioPreviewText(item) {
        if (!item) return '1 ➔ 1';
        const div = this.getItemPoleRatioDivisor(item);
        if (div > 1) {
            return `Pole: ${div} ➔ Act: 1`;
        }
        const mult = this.getItemPoleRatio(item);
        if (mult !== 1) {
            return `Pole: 1 ➔ Act: ${mult}`;
        }
        return 'Direct 1:1';
    },

    getFilteredPoleRatioMaterials() {
        const k = this.selectedPoleRatioActKey || this.selectedActivityKey || '907';
        const act = this.activities && this.activities[k];
        if (!act || !Array.isArray(act.materials)) return [];
        const q = (this.poleRatioSearchQuery || '').trim().toLowerCase();
        return act.materials.filter((m, idx) => {
            if (m.isSection || m.isSpan) return false;
            m.origIndex = idx;
            if (!q) return true;
            return (m.desc && m.desc.toLowerCase().includes(q)) || (m.itemCode && String(m.itemCode).toLowerCase().includes(q));
        });
    },

    applyItemPoleRatioChange(actKey) {
        const k = actKey || this.selectedPoleRatioActKey || this.selectedActivityKey || '907';
        this.syncPoleScheduleToBillingAndReconciliation(k);
        this.saveToStorage();
    },

    saveAndApplyPoleRatios(actKey) {
        const k = actKey || this.selectedPoleRatioActKey || this.selectedActivityKey || '907';
        this.syncPoleScheduleToBillingAndReconciliation(k);
        this.saveToStorage();
        this.showPoleRatioModal = false;
        this.showToast('Pole Schedule mapping ratios applied & quantities updated!', '📐');
    },

    // =========================================================================
    // 🧱 AUTO-CONCRETING & AUGER CALCULATION SUITE (User requested)
    // =========================================================================

    getPoleScheduleAugerRadius(size) {
        const s = Number(size) || Number(this.selectedAugerSize) || 22;
        return parseFloat((s * 0.0254 / 2).toFixed(4));
    },

    getPoleFoundationDepth(desc) {
        const d = String(desc || '').toLowerCase();
        if (d.includes('13 m') || d.includes('13m') || d.includes('13 mtr')) return 2.17;
        if (d.includes('11 m') || d.includes('11m') || d.includes('11 mtr')) return 1.83;
        if (d.includes('10 m') || d.includes('10m') || d.includes('10 mtr')) return 1.67;
        if (d.includes('9 m') || d.includes('9m') || d.includes('9 mtr')) return 1.50;
        if (d.includes('8 m') || d.includes('8m') || d.includes('8 mtr')) return 1.33;
        return 1.83;
    },

    isPoleSchedulePoleItem(item) {
        if (!item || item.isSection || item.isSpan) return false;
        const d = String(item.desc || '').toLowerCase();
        if (d.includes('rsj') || d.includes('psc')) return true;
        if (d.includes('pole') && !d.includes('earthing') && !d.includes('clamp') && !d.includes('top') && !d.includes('bracket') && !d.includes('cap')) {
            return true;
        }
        return false;
    },

    isPoleScheduleStayItem(item) {
        if (!item || item.isSection || item.isSpan) return false;
        const d = String(item.desc || '').toLowerCase();
        if (d.includes('stay set') || (d.includes('stay') && !d.includes('wire') && !d.includes('clamp') && !d.includes('insulator') && !d.includes('bow'))) {
            return true;
        }
        return false;
    },

    isPoleScheduleConcreteItem(item) {
        if (!item || item.isSection || item.isSpan) return false;
        const d = String(item.desc || '').toLowerCase();
        if (item.itemCode === '11000336') return true;
        if (d.includes('concreting') || d.includes('cement concrete') || d.includes('concrete ratio') || d.includes('concreting ration')) {
            return true;
        }
        return false;
    },

    calculateLocationConcreting(key, lIdx) {
        const k = key || this.selectedPoleScheduleKey || '907';
        const sched = (this.poleSchedules && this.poleSchedules[k]) || (typeof defaultPoleSchedules !== 'undefined' && defaultPoleSchedules[k]);
        if (!sched || !Array.isArray(sched.materials)) return { totalPoles: 0, poleVol: 0, totalStays: 0, stayVol: 0, totalVol: 0 };

        const qMatrix = (this.poleScheduleQuantities && this.poleScheduleQuantities[k]) || {};
        const locRow = qMatrix[lIdx] || {};

        const augerSize = Number(this.selectedAugerSize) || 22;
        const r = parseFloat((augerSize * 0.0254 / 2).toFixed(4));
        const stayUnitVol = Number(this.stayConcretingUnitVol) || 0.125;

        let totalPoles = 0;
        let poleVol = 0;
        let totalStays = 0;
        let stayVol = 0;

        sched.materials.forEach((m, mIdx) => {
            if (m.isSection || m.isSpan) return;
            const raw = locRow[mIdx];
            let q = 0;
            if (raw !== '' && raw !== null && raw !== undefined) {
                const n = typeof this.evalGridFormula === 'function' ? Number(this.evalGridFormula(String(raw))) : parseFloat(raw);
                if (!isNaN(n)) q = n;
            }
            if (q <= 0) return;

            if (this.isPoleSchedulePoleItem(m)) {
                totalPoles += q;
                const h = this.getPoleFoundationDepth(m.desc);
                poleVol += q * Math.PI * r * r * h;
            } else if (this.isPoleScheduleStayItem(m)) {
                totalStays += q;
                stayVol += q * stayUnitVol;
            }
        });

        const totalVol = Math.round((poleVol + stayVol) * 1000) / 1000;
        return {
            totalPoles,
            poleVol: Math.round(poleVol * 1000) / 1000,
            totalStays,
            stayVol: Math.round(stayVol * 1000) / 1000,
            totalVol,
            augerSize,
            r
        };
    },

    recalculatePoleScheduleLocationConcreting(key, lIdx) {
        if (!this.poleScheduleAutoConcreting) return;
        const k = key || this.selectedPoleScheduleKey || '907';
        const sched = (this.poleSchedules && this.poleSchedules[k]) || (typeof defaultPoleSchedules !== 'undefined' && defaultPoleSchedules[k]);
        if (!sched || !Array.isArray(sched.materials)) return;

        const concreteIdx = sched.materials.findIndex(m => this.isPoleScheduleConcreteItem(m));
        if (concreteIdx === -1) return;

        this.ensurePoleScheduleQuantities(k);
        const res = this.calculateLocationConcreting(k, lIdx);
        this.poleScheduleQuantities[k][lIdx][concreteIdx] = res.totalVol > 0 ? res.totalVol : '';
    },

    recalculatePoleScheduleConcreting(key, force = false) {
        const k = key || this.selectedPoleScheduleKey || '907';
        const sched = (this.poleSchedules && this.poleSchedules[k]) || (typeof defaultPoleSchedules !== 'undefined' && defaultPoleSchedules[k]);
        if (!sched || !Array.isArray(sched.materials)) return;

        const concreteIdx = sched.materials.findIndex(m => this.isPoleScheduleConcreteItem(m));
        if (concreteIdx === -1) {
            if (force) this.showToast('Schedule ' + k + ' me koi Concreting line item nahi mila', 'ℹ️');
            return;
        }

        const locs = this.getPoleScheduleLocations(k);
        this.ensurePoleScheduleQuantities(k);

        let grandVol = 0;
        locs.forEach((_, lIdx) => {
            const res = this.calculateLocationConcreting(k, lIdx);
            if (res.totalVol > 0 || force) {
                this.poleScheduleQuantities[k][lIdx][concreteIdx] = res.totalVol > 0 ? res.totalVol : '';
            }
            grandVol += res.totalVol;
        });

        this.poleScheduleQuantities[k] = { ...this.poleScheduleQuantities[k] };
        this.poleScheduleQuantities = { ...this.poleScheduleQuantities };
        this.syncPoleScheduleToBillingAndReconciliation(k);
        this.recoRevision = (this.recoRevision || 0) + 1;
        this.saveToStorage();

        if (force) {
            this.showToast(`🧱 Auger ${this.selectedAugerSize}" Concreting: ${Math.round(grandVol * 1000) / 1000} m³ auto-calculated across ${locs.length} locations`, '✅');
        }
    },

    getPoleScheduleConcretingSummary(key) {
        const k = key || this.selectedPoleScheduleKey || '907';
        const locs = (this.poleScheduleLocations && this.poleScheduleLocations[k]) || (typeof this.getPoleScheduleLocations === 'function' ? this.getPoleScheduleLocations(k) : []);
        let totalPoles = 0;
        let poleVol = 0;
        let totalStays = 0;
        let stayVol = 0;
        let totalVol = 0;
        locs.forEach((_, lIdx) => {
            const res = this.calculateLocationConcreting(k, lIdx);
            totalPoles += res.totalPoles;
            poleVol += res.poleVol;
            totalStays += res.totalStays;
            stayVol += res.stayVol;
            totalVol += res.totalVol;
        });
        return {
            totalPoles,
            poleVol: Math.round(poleVol * 1000) / 1000,
            totalStays,
            stayVol: Math.round(stayVol * 1000) / 1000,
            totalVol: Math.round(totalVol * 1000) / 1000,
            augerSize: Number(this.selectedAugerSize) || 22,
            locCount: locs.length
        };
    },

    getRecoCellTitle(row, col) {
        if (!row || !row.activities || !row.activities[col]) return `Activity ${col}: 0 ${row.uom || ''}`;
        const tot = typeof this.format2Dec === 'function' ? this.format2Dec(row.activities[col]) : row.activities[col];
        const actLocs = (typeof this.getActLocations === 'function') ? this.getActLocations(col) : [];
        if (actLocs.length <= 1) {
            return `Activity ${col}: ${tot} ${row.uom || ''}`;
        }
        const lines = [`Activity ${col} (Total: ${tot} ${row.uom || ''}):`];
        const qMatrix = (this.poleScheduleQuantities && this.poleScheduleQuantities[col]) || null;
        const actQ = (this.activityQuantities && this.activityQuantities[col]) || null;
        const sched = (this.poleSchedules && this.poleSchedules[col]) || (typeof defaultPoleSchedules !== 'undefined' && defaultPoleSchedules[col]);
        const act = this.activities && this.activities[col];

        actLocs.forEach((loc, lIdx) => {
            const locName = loc.name || `Loc ${lIdx + 1}`;
            let lQty = 0;
            if (qMatrix && sched && sched.materials) {
                sched.materials.forEach((m, mIdx) => {
                    if (m.isSection || m.isSpan) return;
                    const hasCode = (m.sapItems && m.sapItems.some(s => s.code === row.code)) || m.itemCode === row.code;
                    if (hasCode) {
                        const raw = qMatrix[lIdx] && qMatrix[lIdx][mIdx];
                        if (raw !== '' && raw !== null && raw !== undefined) {
                            const n = Number(raw);
                            if (!isNaN(n)) lQty += n;
                        }
                    }
                });
            } else if (actQ && act && act.materials && actQ[lIdx]) {
                act.materials.forEach((m, mIdx) => {
                    const hasCode = (m.sapItems && m.sapItems.some(s => s.code === row.code)) || m.itemCode === row.code;
                    if (hasCode) {
                        const raw = actQ[lIdx][mIdx];
                        if (raw !== '' && raw !== null && raw !== undefined) {
                            const n = Number(raw);
                            if (!isNaN(n)) lQty += n;
                        }
                    }
                });
            }
            lines.push(`• ${locName}: ${typeof this.format2Dec === 'function' ? this.format2Dec(lQty) : lQty} ${row.uom || ''}`);
        });
        return lines.join('\n');
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
        if (typeof this.persistPoleSchedulesToMasterFile === "function") this.persistPoleSchedulesToMasterFile(true);
        if (typeof this.syncToMongoNow === "function") this.syncToMongoNow({ manual: true }); // added duplicate trigger
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
        if (typeof this.persistPoleSchedulesToMasterFile === 'function') {
            this.persistPoleSchedulesToMasterFile(true);
        }
        if (typeof this.syncToMongoNow === 'function') {
            this.syncToMongoNow({ manual: true });
        }
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
        if (typeof this.persistPoleSchedulesToMasterFile === "function") this.persistPoleSchedulesToMasterFile(true);
        this.showToast(`Item "${name}" removed from Pole Schedule ${k}`, '🗑️');
    },

        async persistPoleSchedulesToMasterFile(silent = false) {
        try {
            if (!this.poleSchedules || typeof this.poleSchedules !== "object" || Object.keys(this.poleSchedules).length === 0) {
                if (!silent && typeof this.showToast === "function") this.showToast("No pole schedules found to save", "⚠️");
                return false;
            }

            // 1. Keep localStorage updated
            try {
                localStorage.setItem("lk_billing_pole_schedules_v1", JSON.stringify(this.poleSchedules));
            } catch(e) {}

            // 2. Keep in-memory window.defaultPoleSchedules updated
            if (typeof window !== "undefined") {
                window.defaultPoleSchedules = JSON.parse(JSON.stringify(this.poleSchedules));
            }

            // 3. Send to API to hardcode directly to js/data/default-pole-schedules.js on disk & Cloud
            let savedToFile = false;
            const payload = JSON.stringify({ poleSchedules: this.poleSchedules });
            const headers = { "Content-Type": "application/json" };
            try {
                const k = localStorage.getItem("billing_api_key");
                if (k) headers["x-api-key"] = k;
            } catch(e) {}

            const endpoints = [
                "/api/save-default-pole-schedules",
                "http://localhost:3000/api/save-default-pole-schedules"
            ];

            for (const ep of endpoints) {
                try {
                    const res = await fetch(ep, {
                        method: "POST",
                        headers,
                        body: payload
                    });
                    if (res.ok) {
                        const json = await res.json().catch(() => null);
                        if (json && json.success) {
                            savedToFile = true;
                            break;
                        }
                    }
                } catch(netErr) {}
            }

            // 4. Also trigger background sync to MongoDB Cloud so all PCs get it immediately
            if (typeof this.syncToMongoNow === "function") {
                try { this.syncToMongoNow({ manual: false }); } catch(e) {}
            }

            if (savedToFile) {
                if (!silent && typeof this.showToast === "function") {
                    this.showToast("💾 Default master pole schedules hard-coded to disk & cloud successfully!", "✅");
                }
                return true;
            } else {
                if (!silent) {
                    this.downloadDefaultPoleSchedulesFile();
                    if (typeof this.showToast === "function") {
                        this.showToast("💾 Downloaded default-pole-schedules.js. Replace file in js/data/ to hard-code.", "ℹ️");
                    }
                }
                return false;
            }
        } catch(err) {
            console.error("persistPoleSchedulesToMasterFile error:", err);
            if (!silent && typeof this.showToast === "function") {
                this.showToast("Save failed: " + (err.message || "Unknown error"), "❌");
            }
            return false;
        }
    },

    downloadDefaultPoleSchedulesFile() {
        try {
            if (!this.poleSchedules || typeof this.poleSchedules !== "object") {
                if (typeof this.showToast === "function") this.showToast("No pole schedules to download", "⚠️");
                return;
            }
            const content = "/**\n * @file Default Pole Schedules Master Data\n * @description Standard bill-of-materials pole schedules for 11 KV RSJ/PSC line activities.\n * Hard-coded Master Defaults (Auto-updated from UI Mapping).\n */\n\nconst defaultPoleSchedules = " + JSON.stringify(this.poleSchedules, null, 2) + ";\n\nif (typeof window !== \"undefined\") {\n    window.defaultPoleSchedules = defaultPoleSchedules;\n}\nif (typeof module !== \"undefined\" && module.exports) {\n    module.exports = defaultPoleSchedules;\n}\n";
            const blob = new Blob([content], { type: "application/javascript;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "default-pole-schedules.js";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch(err) {
            console.error("downloadDefaultPoleSchedulesFile error:", err);
            if (typeof this.showToast === "function") this.showToast("Download failed: " + (err.message || "Unknown"), "❌");
        }
    },

    resetPoleScheduleToDefault(key) {
        const k = key || this.selectedPoleScheduleKey || '907';
        if (typeof defaultPoleSchedules === 'undefined' || !defaultPoleSchedules[k]) {
            if (typeof this.showToast === 'function') this.showToast('Default schedule for ' + k + ' not found', '⚠️');
            return;
        }
        const count = defaultPoleSchedules[k].materials ? defaultPoleSchedules[k].materials.length : 0;
        if (!confirm('Kya aap Pole Schedule ' + k + ' ko official default master data se reset karna chahte hain?\n\n(Total ' + count + ' items load honge)')) return;
        if (!this.poleSchedules) this.poleSchedules = {};
        this.poleSchedules[k] = JSON.parse(JSON.stringify(defaultPoleSchedules[k]));
        if (typeof this.syncPoleScheduleToBillingAndReconciliation === 'function') {
            this.syncPoleScheduleToBillingAndReconciliation(k);
        }
        this.recoRevision = (this.recoRevision || 0) + 1;
        this.saveToStorage();
        if (typeof this.persistPoleSchedulesToMasterFile === 'function') {
            this.persistPoleSchedulesToMasterFile(true);
        }
        if (typeof this.showToast === 'function') this.showToast('Pole Schedule ' + k + ' successfully reset to official default master (' + count + ' items)!', '✅');
    },

    exportPoleScheduleExcel(onlyFiltered = false) {
        if (typeof XLSX === 'undefined') {
            this.showToast('XLSX library not loaded', '❌');
            return;
        }
        const k = this.selectedPoleScheduleKey || '907';
        const sched = this.getCurrentPoleSchedule();
        const mats = (onlyFiltered && typeof this.getFilteredPoleScheduleMaterials === 'function')
            ? this.getFilteredPoleScheduleMaterials()
            : this.getPoleScheduleMaterials();
        const locs = this.getPoleScheduleLocations();
        const contractorName = typeof this.getContractorDisplayName === 'function' ? this.getContractorDisplayName() : 'CONTRACTOR';
        const billNo = this.effectiveBillNo || 'BILL';

        const rows = [];
        rows.push([`ASHOKA BUILDCON LIMITED — RDSS T-10 GADCHIROLI`]);
        rows.push([`${sched.title || ('Pole Schedule ' + k)} ${onlyFiltered ? '(FILTERED ITEMS)' : ''}`]);
        rows.push([`Contractor: ${contractorName} | Bill No: ${billNo} | Date: ${new Date().toLocaleDateString('en-IN')}`]);
        rows.push([]);

        // Header row
        const header = ['Item No', 'SAP Code', 'Material Description', 'Unit'];
        locs.forEach(loc => header.push(loc.name || 'Location'));
        header.push('Total Qty', 'Unit Rate', '100% Amount', `${this.pctStage1 || 85}% Amount`);
        rows.push(header);

        let runningTotQty = 0;
        let runningAmt100 = 0;
        let runningAmtStage1 = 0;

        // Data rows
        mats.forEach((m, mIdx) => {
            const origIdx = m.origIndex !== undefined ? m.origIndex : mIdx;
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
                const q = this.getPoleScheduleCellQty(lIdx, origIdx);
                const num = q !== '' ? (typeof this.evalGridFormula === 'function' ? Number(this.evalGridFormula(String(q))) : parseFloat(q)) : '';
                row.push(num !== '' && !isNaN(num) ? num : '');
            });
            const totQty = this.getPoleScheduleItemTotalQty(origIdx);
            const amt100 = this.getPoleScheduleItemAmount100(m, origIdx);
            const amtStage1 = this.getPoleScheduleItemAmountStage1(m, origIdx);
            row.push(totQty > 0 ? totQty : '');
            row.push(m.rate || 0);
            row.push(amt100 > 0 ? amt100 : '');
            row.push(amtStage1 > 0 ? amtStage1 : '');
            rows.push(row);

            if (!m.isSection && !m.isSpan) {
                runningTotQty += totQty;
                runningAmt100 += amt100;
                runningAmtStage1 += amtStage1;
            }
        });

        // Total row
        const totalRow = [onlyFiltered ? 'TOTAL (FILTERED)' : 'TOTAL', '', '', ''];
        locs.forEach(() => totalRow.push(''));
        totalRow.push(Math.round(runningTotQty * 100) / 100, '', Math.round(runningAmt100 * 100) / 100, Math.round(runningAmtStage1 * 100) / 100);
        rows.push(totalRow);

        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        const sheetName = onlyFiltered ? `Filtered_${k}` : `Pole_Schedule_${k}`;
        XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));

        const filterSuffix = onlyFiltered ? `_Filtered_${mats.filter(m => !m.isSection).length}_Items` : '';
        const filename = `Pole_Schedule_${k}_${contractorName.replace(/[^a-zA-Z0-9]/g, '_')}_${billNo}${filterSuffix}.xlsx`;
        XLSX.writeFile(wb, filename);
        this.showToast(`Excel exported: ${filename}`, '📗');
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.PoleScheduleModule;
}

