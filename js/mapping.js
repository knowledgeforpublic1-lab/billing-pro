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
    onMappingQtyChange(sItem, event) {
        if (this.isFinalized) { return; }
        if (this.mappingLocks && this.mappingLocks.qty) { return; }
        const raw = event ? event.target.value : sItem.qty;
        const evalVal = this.evalFormula(raw);
        let v = Number(evalVal);
        if (isNaN(v) || v < 0) { v = 0; }
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
        a.download = 'LK_Electricals_SAP_Material_Mapping_Master.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.showToast('SAP Material Mapping Master Excel downloaded! 🎉', '📗');
    }
};
