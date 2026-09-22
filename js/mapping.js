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
    onMappingRateChange(item) {
        if (this.isFinalized) { return; }
        if (this.mappingLocks && this.mappingLocks.rate) { return; }
        let v = Number(item.rate);
        if (isNaN(v) || v < 0) { v = 0; item.rate = 0; }
        else item.rate = v;
        this.saveToStorage();
        this.scheduleMappingSync();
    },
    onMappingQtyChange(sItem) {
        if (this.isFinalized) { return; }
        if (this.mappingLocks && this.mappingLocks.qty) { return; }
        let v = Number(sItem.qty);
        if (isNaN(v) || v < 0) { v = 0; sItem.qty = 0; }
        else sItem.qty = v;
        this.saveToStorage();
        this.scheduleMappingSync();
    },
    onItemCodeManualChange(item) {
        if (item.itemCode && this.sapMaterialsMaster) {
            const codeClean = String(item.itemCode).trim();
            const found = this.sapMaterialsMaster.find(s => s.code === codeClean);
            if (found) {
                item.desc = found.desc;
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
                    item.itemCode = found.code;
                }
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
                if (bestRate > 0) {
                    item.rate = bestRate;
                }
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
        if (this.mappingLocks && this.mappingLocks.sap) { if (event) event.target.value = sItem.code ? '[' + sItem.code + '] ' + sItem.desc : ''; return; }
        let rawVal = event ? event.target.value : sItem.code;
        let newCode = String(rawVal == null ? '' : rawVal).trim();
        // Extract code if it's in the [CODE] DESC format
        const match = newCode.match(/^\[(.*?)\]/);
        if (match) {
            newCode = match[1];
        }
        const found = this.sapMaterialsMaster.find(s => s.code === newCode);
        if (found) {
            sItem.code = found.code;
            sItem.desc = found.desc;
            sItem.uom = found.uom;
            sItem.docHeader = found.docHeader || '0031006347';
            // Update primary fields from first SAP item
            mat.itemCode = mat.sapItems[0] ? mat.sapItems[0].code : '';
            mat.sapDescription = mat.sapItems[0] ? mat.sapItems[0].desc : '';
            mat.sapUom = mat.sapItems[0] ? mat.sapItems[0].uom : mat.unit;
            mat.docHeader = mat.sapItems[0] ? mat.sapItems[0].docHeader : '0031006347';
            this.saveToStorage();
            this.scheduleMappingSync();
        } else {
            if (event) event.target.value = sItem.code ? '[' + sItem.code + '] ' + sItem.desc : '';
        }
    },
    async exportMaterialMappingExcel() {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Billing Pro Studio';
        workbook.created = new Date();
        const ws = workbook.addWorksheet('SAP Material Mapping Master', {
            views: [{ showGridLines: true }],
            pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, verticalCentered: true, margins: { left: 0.2, right: 0.2, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } }
        });
        const titleFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF222222' } };
        const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
        const zebraFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        const thinBorder = {
            top: { style: 'thin', color: { argb: 'FF888888' } },
            left: { style: 'thin', color: { argb: 'FF888888' } },
            bottom: { style: 'thin', color: { argb: 'FF888888' } },
            right: { style: 'thin', color: { argb: 'FF888888' } }
        };
        ws.mergeCells('A1:I1');
        const r1 = ws.getCell('A1');
        r1.value = 'LK ELECTRICALS - SAP ERP MATERIAL CODE & WORK ORDER ACTIVITY MAPPING MASTER';
        r1.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        r1.fill = titleFill;
        r1.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(1).height = 30;
        const row2 = ws.getRow(2);
        row2.values = ['Act Code', 'Sr.No.', 'Work Order Description of Material', 'Act Unit', 'Rate (Rs)', 'SAP Item Code (Material)', 'SAP Material Description', 'SAP Unit', 'Document Header Text (Ref/WO)'];
        row2.height = 26;
        row2.eachCell(cell => {
            cell.fill = headerFill;
            cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = thinBorder;
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
                    if (idx % 2 === 1) c.fill = zebraFill;
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
