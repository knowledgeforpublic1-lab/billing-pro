/**
 * @file SAP Mapping Module
 * @description Handles SAP material code mapping to activity items,
 * including add/remove SAP items, rate/qty changes, and mapping locks.
 *
 * @module MappingModule
 * @since v2.0
 */

window.MappingModule = {
    persistMappingLocks() {
        try { localStorage.setItem('lk_billing_mapping_locks_v1', JSON.stringify(this.mappingLocks)); } catch(e) {}
    },
    toggleMappingLock(field) {
        if (!this.mappingLocks) this.mappingLocks = { rate: true, sap: true, qty: true };
        this.mappingLocks[field] = !this.mappingLocks[field];
        this.persistMappingLocks();
        this.saveToStorage();
        this.scheduleMappingSync();
        const label = field === 'rate' ? 'Rate' : (field === 'sap' ? 'SAP Item' : 'Qty');
    },
    lockAllMapping() {
        this.mappingLocks = { rate: true, sap: true, qty: true };
        this.persistMappingLocks();
        this.saveToStorage();
        this.scheduleMappingSync();
    },
    // ============ 📚 SAP MATERIAL MASTER (cloud copy) ============
    openSapMasterModal() {
        this.sapMasterSearch = '';
        this.showSapMasterModal = true;
    },
    addSapMasterRow() {
        if (this.isFinalized) { this.showToast('Bill locked hai — pehle Unlock karo', '🔒'); return; }
        if (!Array.isArray(this.sapMaterialsMaster)) this.sapMaterialsMaster = [];
        this.sapMasterSearch = '';
        this.sapMaterialsMaster.unshift({ code: '', desc: '', uom: 'No' });
        this.$nextTick(() => {
            const el = document.querySelector('[data-sap-master-code]');
            if (el) { el.focus(); el.select(); }
        });
    },
    removeSapMasterRow(row) {
        if (this.isFinalized) { this.showToast('Bill locked hai — pehle Unlock karo', '🔒'); return; }
        if (!row) return;
        const label = row.code ? '[' + row.code + '] ' + (row.desc || '') : (row.desc || 'nayi row');
        if (!confirm('SAP Master se delete karein?\n' + label + '\n\nYe list cloud par sab devices par update hogi.')) return;
        const i = this.sapMaterialsMaster.indexOf(row);
        if (i > -1) {
            this.sapMaterialsMaster.splice(i, 1);
            this.persistSapMaster();
            this.showToast('Deleted: ' + label, '📚');
        }
    },
    onSapMasterRowChange(row) {
        if (!row || this.isFinalized) return;
        row.code = String(row.code || '').trim();
        row.desc = String(row.desc || '').trim();
        const u = String(row.uom || '').trim();
        row.uom = u ? u.toUpperCase() : 'No';
        if (row.code) {
            const dup = this.sapMaterialsMaster.filter(s => s !== row && s.code === row.code);
            if (dup.length) this.showToast('⚠️ SAP code [' + row.code + '] pehle se list me hai', '⚠️');
        }
        this.persistSapMaster();
    },
    persistSapMaster() {
        this.saveToStorage();
        this.scheduleMappingSync();
    },
    restoreDefaultSapMaster() {
        if (this.isFinalized) { this.showToast('Bill locked hai — pehle Unlock karo', '🔒'); return; }
        const def = (typeof defaultSapMaterialsMaster !== 'undefined' && defaultSapMaterialsMaster) ? defaultSapMaterialsMaster : [];
        if (!def.length) { this.showToast('Default list nahi mili', '⚠️'); return; }
        if (!confirm('Cloud wali SAP Master list ko DEFAULT list se badal dein?\n(' + def.length + ' items)\n\nAapke custom codes delete ho jayenge.')) return;
        this.sapMaterialsMaster = JSON.parse(JSON.stringify(def));
        this.persistSapMaster();
        this.showToast('Default SAP Master list restore ho gayi (' + def.length + ' items)', '📚');
    },
    onMappingRateChange(item, event) {
        if (this.isFinalized) { return; }
        if (this.mappingLocks && this.mappingLocks.rate) { return; }
        const raw = event ? event.target.value : item.rate;
        const evalVal = this.evalFormula(raw);
        let v = Number(evalVal);
        if (isNaN(v) || v < 0) { v = 0; }
        item.rate = v;
        if (event) event.target.value = v;
        this.saveToStorage();
        this.scheduleMappingSync();
    },
    onMappingRoundModeChange(newMode) {
        this.mappingRoundMode = newMode || 'none';
        try { localStorage.setItem('lk_billing_mapping_round_mode', this.mappingRoundMode); } catch(e) {}
        this.saveToStorage();
        if (typeof this.scheduleMappingSync === 'function') this.scheduleMappingSync();
        const modeLabels = {
            'none': 'Off (Exact Values)',
            'round': 'Nearest Integer (e.g. 12.5 → 13)',
            'ceil': 'Round Up / Ceil (e.g. 12.1 → 13)',
            'floor': 'Round Down / Floor (e.g. 12.9 → 12)',
            '2dec': '2 Decimals (e.g. 12.50)'
        };
        this.showToast(`Round Off Mode: ${modeLabels[this.mappingRoundMode] || this.mappingRoundMode}`, 'Check');
    },
    applyRoundValue(val, mode) {
        if (val === undefined || val === null || val === '') return val;
        const evalVal = (typeof this.evalFormula === 'function') ? this.evalFormula(val) : val;
        const n = Number(evalVal);
        if (isNaN(n)) return val;
        const m = mode || this.mappingRoundMode || 'none';
        if (m === 'round') return Math.round(n);
        if (m === 'ceil') return Math.ceil(n);
        if (m === 'floor') return Math.floor(n);
        if (m === '2dec') return Math.round(n * 100) / 100;
        return Math.round(n * 10000) / 10000;
    },
    roundOffAllMappingValues(targetMode) {
        if (this.isFinalized) {
            this.showToast('Bill is finalized & locked. Unlock first.', 'Lock');
            return;
        }
        const mode = targetMode || (this.mappingRoundMode !== 'none' ? this.mappingRoundMode : 'round');
        let count = 0;
        const acts = this.activities || {};
        Object.keys(acts).forEach(k => {
            const act = acts[k];
            if (act && act.materials) {
                act.materials.forEach(m => {
                    if (m.sapItems && Array.isArray(m.sapItems)) {
                        m.sapItems.forEach(s => {
                            if (s.isManual) {
                                if (s.manualQty !== undefined && s.manualQty !== null && s.manualQty !== '') {
                                    const oldVal = Number(this.evalFormula ? this.evalFormula(s.manualQty) : s.manualQty);
                                    const newVal = this.applyRoundValue(oldVal, mode);
                                    if (newVal !== oldVal) {
                                        s.manualQty = newVal;
                                        count++;
                                    }
                                }
                            } else {
                                if (s.qty !== undefined && s.qty !== null && s.qty !== '') {
                                    const oldVal = Number(this.evalFormula ? this.evalFormula(s.qty) : s.qty);
                                    const newVal = this.applyRoundValue(oldVal, mode);
                                    if (newVal !== oldVal) {
                                        s.qty = newVal;
                                        count++;
                                    }
                                }
                            }
                        });
                    }
                });
            }
        });
        this.saveToStorage();
        if (typeof this.scheduleMappingSync === 'function') this.scheduleMappingSync();
        this.showToast(`Rounded off ${count} mapping values (${mode})`, 'Check');
    },
    toggleSapItemManualMode(mat, sItem, actKey) {
        if (this.isFinalized) { return; }
        if (this.mappingLocks && this.mappingLocks.qty) {
            this.showToast('Qty locked hai — pehle 🔓 Qty par click karke unlock karein', 'Lock');
            return;
        }
        sItem.isManual = !sItem.isManual;
        if (sItem.isManual) {
            if (sItem.manualQty === undefined || sItem.manualQty === null || sItem.manualQty === '') {
                const calculated = (typeof this.getSapComponentCalculatedRecoQty === 'function')
                    ? this.getSapComponentCalculatedRecoQty(mat, sItem, actKey)
                    : (sItem.qty || 1);
                sItem.manualQty = Number(calculated) || 0;
            }
            this.showToast('Manual Reco Mode ON: Direct fixed quantity enter karein', 'Check');
        } else {
            this.showToast('Auto Ratio Mode ON: Activity quantity se multiply hoga', 'Check');
        }
        this.saveToStorage();
        if (typeof this.scheduleMappingSync === 'function') this.scheduleMappingSync();
    },
    onMappingItemRoundModeChange(sItem, newMode) {
        if (this.isFinalized) return;
        if (this.mappingLocks && this.mappingLocks.qty) {
            this.showToast('Qty locked hai — pehle 🔓 Qty par click karke unlock karein', 'Lock');
            return;
        }
        sItem.roundMode = newMode || 'default';
        this.saveToStorage();
        if (typeof this.scheduleMappingSync === 'function') this.scheduleMappingSync();
        const modeLabels = {
            'default': 'Default (Global)',
            'none': 'Off (Exact)',
            'round': 'Nearest Integer',
            'ceil': 'Round Up (Ceil)',
            'floor': 'Round Down (Floor)',
            '2dec': '2 Decimals'
        };
        this.showToast(`Material Rounding: ${modeLabels[sItem.roundMode] || sItem.roundMode}`, 'Check');
    },
    autoSetMaterialRoundModesByUnit() {
        if (this.isFinalized) {
            this.showToast('Bill is finalized & locked. Unlock first.', 'Lock');
            return;
        }
        if (this.mappingLocks && this.mappingLocks.qty) {
            this.showToast('Qty locked hai — pehle 🔓 Qty par click karke unlock karein', 'Lock');
            return;
        }
        let intCount = 0;
        let decCount = 0;
        const acts = this.activities || {};
        Object.keys(acts).forEach(k => {
            const act = acts[k];
            if (act && act.materials) {
                act.materials.forEach(m => {
                    if (m.sapItems && Array.isArray(m.sapItems)) {
                        m.sapItems.forEach(s => {
                            const uom = String(s.uom || m.sapUom || m.unit || '').trim().toLowerCase();
                            if (['no', 'nos', 'set', 'sets', 'pair', 'pc', 'pcs'].includes(uom)) {
                                s.roundMode = 'round';
                                intCount++;
                            } else if (['kg', 'mtr', 'm', 'meter', 'km', 'mt', 'ton', 'ltr', 'liter'].includes(uom)) {
                                s.roundMode = '2dec';
                                decCount++;
                            }
                        });
                    }
                });
            }
        });
        this.saveToStorage();
        if (typeof this.scheduleMappingSync === 'function') this.scheduleMappingSync();
        this.showToast(`Auto Round Set: ${intCount} Discrete (Nos/Sets → Int), ${decCount} Decimal (Kg/Mtr → 2Dec)`, 'Check');
    },
    onMappingManualQtyChange(sItem, event) {
        if (this.isFinalized) { return; }
        if (this.mappingLocks && this.mappingLocks.qty) { return; }
        const raw = event ? event.target.value : sItem.manualQty;
        const evalVal = (typeof this.evalFormula === 'function') ? this.evalFormula(raw) : raw;
        let v = Number(evalVal);
        if (isNaN(v) || v < 0) { v = 0; }
        const itemRoundMode = (sItem && sItem.roundMode && sItem.roundMode !== 'default') ? sItem.roundMode : (this.mappingRoundMode || 'none');
        if (itemRoundMode && itemRoundMode !== 'none') {
            v = this.applyRoundValue(v, itemRoundMode);
        } else {
            v = Math.round(v * 100) / 100;
        }
        sItem.manualQty = v;
        if (event) event.target.value = v;
        this.saveToStorage();
        this.scheduleMappingSync();
    },
    onMappingQtyChange(sItem, event) {
        if (this.isFinalized) { return; }
        if (this.mappingLocks && this.mappingLocks.qty) { return; }
        const raw = event ? event.target.value : sItem.qty;
        const evalVal = this.evalFormula(raw);
        let v = Number(evalVal);
        if (isNaN(v) || v < 0) { v = 0; }
        const itemRoundMode = (sItem && sItem.roundMode && sItem.roundMode !== 'default') ? sItem.roundMode : (this.mappingRoundMode || 'none');
        if (itemRoundMode && itemRoundMode !== 'none') {
            v = this.applyRoundValue(v, itemRoundMode);
        } else {
            v = Math.round(v * 10000) / 10000;
        }
        sItem.qty = v;
        if (event) event.target.value = v;
        this.saveToStorage();
        this.scheduleMappingSync();
    },
    onItemCodeManualChange(item) {
        if (!item) return;
        let rawVal = String(item.itemCode || '').trim();
        if (!rawVal) {
            item.itemCode = '';
            item.sapDescription = '';
            item.sapItems = [];
            this.saveToStorage();
            this.scheduleMappingSync();
            return;
        }
        // Extract code if format is [CODE] DESC or has code digits
        const mBracket = rawVal.match(/^\[(.*?)\]/);
        let codeClean = mBracket ? mBracket[1].trim() : rawVal;
        const mDigits = codeClean.match(/(?:^|\b)(\d{7,10})(?:$|\b)/);
        if (mDigits) codeClean = mDigits[1];

        // Check for N/A (Not Applicable)
        const cleanUpper = codeClean.toUpperCase();
        if (cleanUpper === 'N/A' || cleanUpper === 'NA' || cleanUpper === 'NOT APPLICABLE' || rawVal.toUpperCase().startsWith('[N/A]')) {
            item.itemCode = 'N/A';
            item.sapDescription = 'NOT APPLICABLE';
            item.sapUom = item.unit || 'No';
            item.sapItems = [{
                code: 'N/A',
                desc: 'NOT APPLICABLE',
                uom: item.unit || 'No',
                qty: 1,
                docHeader: item.docHeader || '0031006347'
            }];
            this.saveToStorage();
            this.scheduleMappingSync();
            return;
        }

        if (this.sapMaterialsMaster) {
            let found = this.sapMaterialsMaster.find(s => s.code === codeClean);
            if (!found) {
                const lower = rawVal.toLowerCase();
                found = this.sapMaterialsMaster.find(s => s.desc && s.desc.toLowerCase() === lower);
            }
            if (found) {
                // IMPORTANT: Work order item.desc should NOT be overwritten for regular items!
                if (item.isExtra && !item.desc) item.desc = found.desc;
                item.unit = found.uom || item.unit;
                item.sapDescription = found.desc;
                item.sapUom = found.uom;
                if (found.docHeader) item.docHeader = found.docHeader;
                if (!item.sapItems) item.sapItems = [];
                if (item.sapItems.length > 0) {
                    item.sapItems[0].code = found.code;
                    item.sapItems[0].desc = found.desc;
                    item.sapItems[0].uom = found.uom;
                    if (found.docHeader) item.sapItems[0].docHeader = found.docHeader;
                } else {
                    item.sapItems.push({
                        code: found.code,
                        desc: found.desc,
                        uom: found.uom,
                        qty: 1,
                        docHeader: found.docHeader || '0031006347'
                    });
                }
                item.itemCode = found.code;
                // Auto-fill rate — collect all rates for this code from ALL activities, pick most frequent
                const rateMap = {};
                for (const actKey in this.activities) {
                    const act = this.activities[actKey];
                    if (act && act.materials) {
                        for (const m of act.materials) {
                            if (m !== item && m.itemCode === codeClean && m.rate && m.rate > 0) {
                                rateMap[m.rate] = (rateMap[m.rate] || 0) + 1;
                            }
                        }
                    }
                }
                let bestRate = 0;
                let bestCount = 0;
                for (const rate in rateMap) {
                    if (rateMap[rate] > bestCount) {
                        bestCount = rateMap[rate];
                        bestRate = Number(rate);
                    }
                }
                if (bestRate > 0 && (!item.rate || item.rate === 0)) {
                    item.rate = bestRate;
                }
            } else {
                // Custom code entered
                item.itemCode = codeClean;
                item.sapDescription = item.sapDescription || item.desc || codeClean;
                item.sapUom = item.sapUom || item.unit || 'No';
                item.sapItems = [{
                    code: codeClean,
                    desc: item.desc || codeClean,
                    uom: item.unit || 'No',
                    qty: 1,
                    docHeader: item.docHeader || '0031006347'
                }];
            }
        }
        this.saveToStorage();
        this.scheduleMappingSync();
    },
    addSapItemToActivityMaterial(mat) {
        if (this.isFinalized) { return; }
        if (this.mappingLocks && this.mappingLocks.sap) { return; }
        if (!mat.sapItems) mat.sapItems = [];
        mat.sapItems.push({
            code: '',
            desc: '',
            uom: '',
            qty: 1,
            docHeader: '0031006347'
        });
        this.saveToStorage();
        this.scheduleMappingSync();
    },
    removeSapItemFromActivityMaterial(mat, sIdx) {
        if (this.isFinalized) { return; }
        if (this.mappingLocks && this.mappingLocks.sap) { return; }
        if (mat.sapItems && mat.sapItems.length > 0) {
            mat.sapItems.splice(sIdx, 1);
            if (mat.sapItems.length > 0) {
                mat.itemCode = mat.sapItems[0].code;
                mat.sapDescription = mat.sapItems[0].desc;
                mat.sapUom = mat.sapItems[0].uom;
            } else {
                mat.itemCode = '';
                mat.sapDescription = '';
            }
            this.saveToStorage();
            this.scheduleMappingSync();
        }
    },
    onSapItemDropdownChange(mat, sItem, event) {
        if (this.isFinalized) { if (event) event.target.value = sItem.code ? '[' + sItem.code + '] ' + sItem.desc : ''; return; }
        if (this.mappingLocks && this.mappingLocks.sap) {
            if (typeof this.showToast === 'function') this.showToast('SAP Item locked hai — upar 🔓 Item dabakar unlock karo', '🔒');
            if (event) event.target.value = sItem.code ? '[' + sItem.code + '] ' + sItem.desc : '';
            return;
        }
        let rawVal = event ? event.target.value : sItem.code;
        let inputStr = String(rawVal == null ? '' : rawVal).trim();
        
        // Agar blank kar diya to mapping clear karo
        if (!inputStr) {
            sItem.code = '';
            sItem.desc = '';
            sItem.uom = mat.unit || 'No';
            mat.itemCode = (mat.sapItems && mat.sapItems[0] && mat.sapItems[0] !== sItem) ? mat.sapItems[0].code : '';
            mat.sapDescription = (mat.sapItems && mat.sapItems[0] && mat.sapItems[0] !== sItem) ? mat.sapItems[0].desc : '';
            mat.sapUom = mat.unit || 'No';
            this.saveToStorage();
            this.scheduleMappingSync();
            return;
        }

        // Check for N/A (Not Applicable)
        const mBracket = inputStr.match(/^\[(.*?)\]/);
        let targetCode = mBracket ? mBracket[1].trim() : inputStr;
        const upperCode = targetCode.toUpperCase();
        if (upperCode === 'N/A' || upperCode === 'NA' || upperCode === 'NOT APPLICABLE' || inputStr.toUpperCase().startsWith('[N/A]')) {
            sItem.code = 'N/A';
            sItem.desc = 'NOT APPLICABLE';
            sItem.uom = sItem.uom || mat.unit || 'No';
            sItem.docHeader = sItem.docHeader || '0031006347';
            if (mat.sapItems && mat.sapItems.length > 0) {
                mat.itemCode = mat.sapItems[0].code || 'N/A';
                mat.sapDescription = mat.sapItems[0].desc || 'NOT APPLICABLE';
                mat.sapUom = mat.sapItems[0].uom || mat.unit;
                mat.docHeader = mat.sapItems[0].docHeader || '0031006347';
            }
            if (event) event.target.value = '[N/A] NOT APPLICABLE';
            this.saveToStorage();
            this.scheduleMappingSync();
            return;
        }

        // Smart resolution:
        if (!targetCode) {
            const mDigits = inputStr.match(/(?:^|\b)(\d{7,10})(?:$|\b)/);
            if (mDigits) targetCode = mDigits[1];
        }

        const master = this.sapMaterialsMaster || [];
        let found = null;
        if (targetCode) {
            found = master.find(s => s.code === targetCode);
        }
        if (!found) {
            found = master.find(s => s.code === inputStr);
        }
        if (!found) {
            const lower = inputStr.toLowerCase();
            found = master.find(s => s.desc && s.desc.toLowerCase() === lower);
        }
        if (!found) {
            const lower = inputStr.toLowerCase();
            if (lower.length >= 3) {
                found = master.find(s => s.desc && s.desc.toLowerCase().startsWith(lower)) ||
                        master.find(s => s.desc && s.desc.toLowerCase().includes(lower));
            }
        }

        // Fallback: search in ContractorSapStock if not yet in sapMaterialsMaster
        if (!found && window.ContractorSapStock) {
            const stock = window.ContractorSapStock;
            const cStock = (typeof this.getContractorSapIssues === 'function') ? this.getContractorSapIssues() : null;
            if (cStock && cStock.materials && cStock.materials[targetCode]) {
                const s = cStock.materials[targetCode];
                found = { code: s.code, desc: s.desc, uom: s.uom || 'No' };
            } else if (stock.byDocHeader) {
                for (const dh of Object.values(stock.byDocHeader)) {
                    if (dh.materials && dh.materials[targetCode]) {
                        const s = dh.materials[targetCode];
                        found = { code: s.code, desc: s.desc, uom: s.uom || 'No' };
                        break;
                    }
                }
            }
            if (found && Array.isArray(this.sapMaterialsMaster)) {
                if (!this.sapMaterialsMaster.find(s => s.code === found.code)) {
                    this.sapMaterialsMaster.push(found);
                }
            }
        }

        if (found) {
            sItem.code = found.code;
            sItem.desc = found.desc;
            sItem.uom = found.uom || sItem.uom || mat.unit || 'No';
            sItem.docHeader = found.docHeader || '0031006347';
            // Update primary fields on material from first SAP item
            if (mat.sapItems && mat.sapItems.length > 0) {
                mat.itemCode = mat.sapItems[0].code || '';
                mat.sapDescription = mat.sapItems[0].desc || '';
                mat.sapUom = mat.sapItems[0].uom || mat.unit;
                mat.docHeader = mat.sapItems[0].docHeader || '0031006347';
            }
            if (event) event.target.value = '[' + found.code + '] ' + found.desc;
            this.saveToStorage();
            this.scheduleMappingSync();
        } else {
            if (event) event.target.value = sItem.code ? '[' + sItem.code + '] ' + sItem.desc : '';
            if (typeof this.showToast === 'function') this.showToast('SAP code ya material nahi mila', '⚠️');
        }
    },
    onSapSearchFocus(key) {
        try { if (this._sapBlurTimer) { clearTimeout(this._sapBlurTimer); this._sapBlurTimer = null; } } catch(e) {}
        if (this.editingSapKey !== key) this.editingSapKey = key;
    },
    onSapSearchBlur() {
        // Datalist option click se PEHLE blur fire hota hai — turant list hatayi to option select nahi hota.
        // 250ms ruko taaki @change fire ho jaye, phir list hatao.
        try { if (this._sapBlurTimer) clearTimeout(this._sapBlurTimer); } catch(e) {}
        this._sapBlurTimer = setTimeout(() => { this._sapBlurTimer = null; this.editingSapKey = null; }, 250);
    },
    handleMappingQtyNav(event, rowIdx, sIdx, direction) {
        this.$nextTick(() => {
            const pick = (r, s) => {
                const el = document.querySelector(`input[data-map-qty="${r}_${s}"]`);
                return (el && !el.disabled) ? el : null;
            };
            let el = null;
            if (direction === 'right') el = pick(rowIdx, sIdx + 1);
            else if (direction === 'left') el = pick(rowIdx, sIdx - 1);
            else {
                const step = direction === 'up' ? -1 : 1;
                let r = rowIdx + step;
                // jab tak us number ki row exist karti hai, same sIdx (na mile to pehli qty) try karo
                while (document.querySelector(`input[data-map-qty^="${r}_"]`)) {
                    el = pick(r, sIdx) || pick(r, 0);
                    if (el) break;
                    r += step;
                }
            }
            if (el) { el.focus(); el.select(); }
        });
    },
    async exportMaterialMappingExcel() {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Billing Pro Studio';
        workbook.created = new Date();
        const ws = workbook.addWorksheet('SAP Material Mapping Master', {
            views: [{ showGridLines: true }],
            pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, verticalCentered: true, showGridLines: true, margins: { left: 0.2, right: 0.2, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } }
        });
        const thinBorder = {
            top: { style: 'thin', color: { argb: 'FF888888' } },
            left: { style: 'thin', color: { argb: 'FF888888' } },
            bottom: { style: 'thin', color: { argb: 'FF888888' } },
            right: { style: 'thin', color: { argb: 'FF888888' } }
        };
        const headerBorder = {
            top: { style: 'medium', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF888888' } },
            bottom: { style: 'medium', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF888888' } }
        };
        ws.mergeCells('A1:I1');
        const r1 = ws.getCell('A1');
        r1.value = 'LK ELECTRICALS - SAP ERP MATERIAL CODE & WORK ORDER ACTIVITY MAPPING MASTER';
        r1.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
        r1.alignment = { horizontal: 'center', vertical: 'middle' };
        r1.border = headerBorder;
        ws.getRow(1).height = 30;
        const row2 = ws.getRow(2);
        row2.values = ['Act Code', 'Sr.No.', 'Work Order Description of Material', 'Act Unit', 'Rate (Rs)', 'SAP Item Code (Material)', 'SAP Material Description', 'SAP Unit', 'Document Header Text (Ref/WO)'];
        row2.height = 26;
        row2.eachCell(cell => {
            cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = headerBorder;
        });
        let rowIdx = 3;
        const items = this.filteredMappingMasterList;
        items.forEach((rowObj, idx) => {
            const m = rowObj.item;
            const sList = (m.sapItems && m.sapItems.length > 0) ? m.sapItems : [{ code: m.itemCode || '', desc: m.sapDescription || '', uom: m.sapUom || m.unit, docHeader: m.docHeader || '0031006347' }];
            sList.forEach((s, sIdx) => {
                const row = ws.getRow(rowIdx);
                row.getCell(1).value = (sIdx === 0) ? rowObj.actKey : '';
                row.getCell(2).value = (sIdx === 0) ? m.no : '';
                row.getCell(3).value = (sIdx === 0) ? m.desc : `↳ Component ${sIdx+1}`;
                row.getCell(4).value = (sIdx === 0) ? m.unit : '';
                row.getCell(5).value = (sIdx === 0) ? m.rate : '';
                row.getCell(6).value = s.code;
                row.getCell(7).value = s.desc;
                row.getCell(8).value = s.uom;
                row.getCell(9).value = s.docHeader;
                row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
                row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
                if (sIdx === 0) row.getCell(5).numFmt = '#,##0.00';
                row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(7).alignment = { horizontal: 'left', vertical: 'middle' };
                row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
                row.eachCell(c => {
                    c.border = thinBorder;
                });
                row.height = 20;
                rowIdx++;
            });
        });
        ws.columns = [
            { width: 12 }, { width: 8 }, { width: 50 }, { width: 10 },
            { width: 12 }, { width: 18 }, { width: 45 }, { width: 12 }, { width: 22 }
        ];
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const cName = (typeof this.getContractorCleanFileName === 'function') ? this.getContractorCleanFileName() : '';
        a.download = (cName && cName !== 'Contractor') ? `${cName}_SAP_Material_Mapping_Master.xlsx` : 'SAP_Material_Mapping_Master.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.showToast('SAP Material Mapping Master Excel downloaded! 🎉', '📗');
    },

    // ─── UNMAPPED / MISMATCHED SAP STOCK HELPERS ───
    isUnmappedSapCode(code) {
        if (!code || code === 'N/A' || code === 'NA') return false;
        const set = this.allMappedSapCodesSet;
        if (!set || typeof set.has !== 'function') return false;
        return !set.has(String(code).trim());
    },

    isUnmappedContractorIssuedRow(row) {
        if (!row || !row.code) return false;
        const gross = Number(row.sapGrossIssue !== undefined ? row.sapGrossIssue : (row.sapIssuedQty || 0));
        const net = Number(row.sapNetIssue !== undefined ? row.sapNetIssue : (row.sapIssuedQty || 0));
        const hasIssue = gross > 0 || net !== 0;
        return hasIssue && this.isUnmappedSapCode(row.code);
    },

    getContractorIssueForCode(code) {
        const s = this.currentContractorSap;
        if (!s || !s.materials || !code) return null;
        const item = s.materials[code];
        if (!item) return null;
        const net = Number(item.netIssue !== undefined ? item.netIssue : (item.issuedQty || 0));
        return net !== 0 ? `${net} ${item.uom || ''}`.trim() : null;
    },

    goToMappingForCode(code, desc) {
        if (typeof this.switchView === 'function') {
            this.switchView('mapping');
        } else {
            this.currentView = 'mapping';
        }
        this.mappingActivityFilter = 'ALL';
        const token = this.getSearchTokenForMapping(code, desc);
        this.mappingSearchQuery = token;
        this.showToast(`Mapping Master: Searching for "${token}" [SAP Code: ${code}]`, '🛠️');
        this.$nextTick(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    },

    goToMappingMasterAlert() {
        if (typeof this.switchView === 'function') {
            this.switchView('mapping');
        } else {
            this.currentView = 'mapping';
        }
        this.mappingActivityFilter = 'ALL';
        this.mappingSearchQuery = '';
        const count = (this.unmappedContractorIssuedItems && this.unmappedContractorIssuedItems.length) || 0;
        this.showToast(`Mapping Master: ${count} unmapped issued items listed in Red Alert Card`, '🚨');
        this.$nextTick(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    },

    filterMappingBySearch(text) {
        if (!text) return;
        this.mappingActivityFilter = 'ALL';
        this.mappingSearchQuery = String(text).trim();
        this.showToast(`Filtering mapping table by: "${text}"`, '🔍');
        this.$nextTick(() => {
            const el = document.querySelector('.billing-table');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    },

    getSearchTokenForMapping(code, desc) {
        if (!desc) return code || '';
        const stopWords = new Set(['and', 'with', 'for', 'the', 'nos', 'mtr', 'mtrs', 'set', 'sets', 'type', 'grade', 'long', 'size', 'allied', 'material', 'activity', 'sqmm', 'mm', 'sq']);
        const words = String(desc).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !stopWords.has(w));
        return words.slice(0, 2).join(' ') || code || desc;
    },

    async copyTextToClipboard(text) {
        if (!text) return;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(String(text));
                this.showToast(`Copied [${text}] to clipboard! Paste in SAP Item box.`, '📋');
            } else {
                const ta = document.createElement('textarea');
                ta.value = String(text);
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                this.showToast(`Copied [${text}] to clipboard!`, '📋');
            }
        } catch(e) {
            this.showToast(`Code: ${text} (Use Ctrl+C to copy)`, '📋');
        }
    },

    quickMapSapCodeToActivity(actKey, matNo, sapCode, sapDesc, sapUom) {
        if (this.isFinalized) {
            this.showToast('Bill locked hai — pehle Unlock karo', '🔒');
            return;
        }
        const act = this.activities && this.activities[actKey];
        if (!act || !act.materials) {
            this.showToast(`Activity ${actKey} nahi mili`, '⚠️');
            return;
        }
        const mat = act.materials.find(m => String(m.no) === String(matNo)) || act.materials[0];
        if (!mat) {
            this.showToast(`Material #${matNo} nahi mila`, '⚠️');
            return;
        }

        const promptMsg = `Activity ${actKey} ke Material #${mat.no} (${mat.desc.substring(0, 40)}...)\n\nPar SAP Code [${sapCode}] (${sapDesc}) map karein?`;
        if (!confirm(promptMsg)) return;

        if (!Array.isArray(mat.sapItems) || mat.sapItems.length === 0) {
            mat.sapItems = [{ code: sapCode, desc: sapDesc, uom: sapUom || mat.unit || 'No', qty: 1 }];
        } else {
            if (!mat.sapItems[0].code || mat.sapItems[0].code === 'N/A') {
                mat.sapItems[0].code = sapCode;
                mat.sapItems[0].desc = sapDesc;
                mat.sapItems[0].uom = sapUom || mat.unit || 'No';
            } else {
                const existing = mat.sapItems.find(s => s.code === sapCode);
                if (existing) {
                    this.showToast(`Code [${sapCode}] pehle se mapped hai`, 'ℹ️');
                    return;
                }
                mat.sapItems.push({ code: sapCode, desc: sapDesc, uom: sapUom || mat.unit || 'No', qty: 1 });
            }
        }
        mat.itemCode = mat.sapItems[0].code;
        mat.sapDescription = mat.sapItems[0].desc;
        mat.sapUom = mat.sapItems[0].uom;

        if (Array.isArray(this.sapMaterialsMaster)) {
            if (!this.sapMaterialsMaster.find(s => s.code === sapCode)) {
                this.sapMaterialsMaster.push({ code: sapCode, desc: sapDesc, uom: sapUom || 'No' });
            }
        }

        this.saveToStorage();
        if (typeof this.scheduleMappingSync === 'function') this.scheduleMappingSync();
        this.showToast(`Successfully mapped [${sapCode}] to Activity ${actKey} #${mat.no}!`, '✅');
    }
};
