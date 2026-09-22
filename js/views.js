/**
 * @file View-specific Methods
 * @description Methods for reconciliation, reverse entry, locations, extra items, and calculators.
 *
 * @module ViewsModule
 * @since v2.0
 */

window.ViewsModule = {
    toggleReverseEntry() {
        if (this.isFinalized) { this.showToast('⚠️ Bill is locked. Please unlock first.', '🔒'); return; }
        this.reverseEntry = !this.reverseEntry;
        try { localStorage.setItem('lk_billing_reverse_entry', this.reverseEntry ? '1' : '0'); } catch(e) {}
        this.showToast(this.reverseEntry ? 'Reverse ON — enter from reconciliation to activity' : 'Reverse OFF — old system (enter from activity)', '↩️');
    },
    closeReverseAddMenu() {
        this.showReverseAddMenu = false;
    },
    reverseActsForCode(sapCode) {
        const out = [];
        this.reverseInvoiceActKeys.forEach(actKey => {
            const act = this.activities ? this.activities[actKey] : null;
            if (!act || !act.materials) return;
            const hit = act.materials.some(m => (m.sapItems || []).some(s => {
                if (!s.code || s.code !== sapCode) return false;
                const mq = Number(s.qty);
                return isNaN(mq) ? true : mq !== 0;
            }));
            if (hit) out.push(actKey);
        });
        return out;
    },
    onReconItemSelect(event) {
        const val = event.target.value;
        if (!val) return;
        const found = this.reverseSapMenuList.find(r => r.code === val);
        if (found) {
            this.pickReverseSap(found.code);
        }
        event.target.value = '';
    },
    pickReverseSap(sapCode) {
        if (this.isFinalized) { this.showToast('⚠️ Bill is locked. Please unlock first.', '🔒'); return; }
        const acts = this.reverseActsForCode(sapCode);
        this.reverseAddSelCode = sapCode;
        this.reverseAddQty = 1;
        if (!acts.length) {
            // Item activity me nahi hai → Extra Item mode (activity chun kar jodo)
            if (!this.reverseInvoiceActKeys.length) { this.showToast('Add activity to Tax Invoice first', 'ℹ️'); this.reverseAddSelCode = ''; return; }
            this.reverseAddExtraMode = true;
            this.reverseAddAct = this.reverseInvoiceActKeys[0];
        } else {
            this.reverseAddExtraMode = false;
            this.reverseAddAct = acts[0];
        }
        const locs = this.reverseSelCodeLocs;
        this.reverseAddLoc = locs.length ? locs[0] : 0;
        this.showReverseAddMenu = false;
    },
    submitReverseSapQty() {
        if (this.isFinalized) { return; }
        const code = this.reverseAddSelCode;
        if (!code) return;
        const q = Number(this.reverseAddQty);
        if (isNaN(q) || q <= 0) { return; }
        if (this.reverseAddLoc < 0 || this.reverseAddLoc >= this.getActLocations(this.reverseAddAct).length) { return; }
        // ✏️ EXTRA MODE: item activity me nahi hai → rate sheet ke Extra Item me jodo
        if (this.reverseAddExtraMode) {
            if (this.mappingLocks && this.mappingLocks.sap) { return; }
            if (this.reverseInvoiceActKeys.indexOf(this.reverseAddAct) === -1) { return; }
            const act = this.activities[this.reverseAddAct];
            if (!act || !act.materials) return;
            const row = this.pivotReconciliationData.rows.find(x => x.code === code) || {};
            const mf = (this.sapMaterialsMaster || []).find(x => x.code === code) || {};
            let maxNo = act.materials.length;
            act.materials.forEach(mm => { const n = parseInt(mm.no, 10); if (!isNaN(n) && n > maxNo) maxNo = n; });
            const newMat = {
                no: String(maxNo + 1),
                desc: row.desc || mf.desc || code,
                unit: row.uom || mf.uom || 'No',
                rate: 0,
                itemCode: code,
                sapDescription: row.desc || mf.desc || code,
                sapUom: row.uom || mf.uom || '',
                docHeader: mf.docHeader || '0031006347',
                sapItems: [{ code: code, desc: row.desc || mf.desc || code, uom: row.uom || mf.uom || '', qty: 1, docHeader: mf.docHeader || '0031006347' }],
                isExtra: true
            };
            act.materials.push(newMat);
            this.initQuantitiesForActivity(this.reverseAddAct);
            this.activityQuantities[this.reverseAddAct][this.reverseAddLoc][act.materials.length - 1] = q;
            this.saveToStorage();
            this.reverseAddSelCode = '';
            this.reverseAddExtraMode = false;
            return;
        }
        if (this.reverseActsForCode(code).indexOf(this.reverseAddAct) === -1) { return; }
        // Qty usi location me likho (row me value aate hi table me dikhegi)
        this.applyReverseEntryLoc(code, this.reverseAddAct, this.reverseAddLoc, q);
        this.reverseAddSelCode = '';
        this.reverseAddExtraMode = false;
    },
    nutBoltWeightForCode(sapCode) {
        if (!sapCode || !this.nutBoltData) return 0;
        let desc = '';
        const acts = this.activities || {};
        outer: for (const ak in acts) {
            const act = acts[ak];
            if (!act || !act.materials) continue;
            for (const m of act.materials) {
                if (!m.sapItems) continue;
                for (const s of m.sapItems) {
                    if (s.code === sapCode && s.desc) { desc = s.desc; break outer; }
                }
            }
        }
        if (!desc) {
            const f = (this.sapMaterialsMaster || []).find(x => x.code === sapCode);
            if (f) desc = f.desc;
        }
        if (!desc) return 0;
        const mm = String(desc).toUpperCase().match(/M(\d+)\s*X\s*(\d+)/);
        if (!mm) return 0;
        const key = parseInt(mm[1], 10) + 'x' + parseInt(mm[2], 10);
        const hit = this.nutBoltData.find(n => String(n.size || '').toLowerCase().replace(/×/g, 'x').replace(/\s+/g, '') === key);
        const w = hit ? Number(hit.weight) : 0;
        return (w > 0) ? w : 0;
    },
    nutBoltTargetUnitKg(mat) {
        return !!mat && /kg/i.test(String(mat.unit || ''));
    },
    reconCellLoc(sapCode, rcol) {
        const act = this.activities[rcol.actKey];
        if (!act || !act.materials) return 0;
        const qMatrix = this.activityQuantities[rcol.actKey] || [];
        const locArr = qMatrix[rcol.locIdx] || [];
        let total = 0;
        act.materials.forEach((m, mIdx) => {
            if (!m.sapItems) return;
            // 🔩 kg-material + wazan mila to cell (kg) ko nos me dikhao
            const _bw = this.nutBoltWeightForCode(sapCode);
            const _conv = (_bw > 0 && this.nutBoltTargetUnitKg(m)) ? _bw : 0;
            m.sapItems.forEach(s => {
                if (!s.code || s.code !== sapCode) return;
                const mq = Number(s.qty);
                const factor = isNaN(mq) ? 1 : mq;
                if (factor === 0) return;
                const raw = locArr[mIdx];
                const v = (raw === '' || raw === null || raw === undefined) ? 0 : parseFloat(raw);
                if (!isNaN(v)) total += _conv ? (v * factor / _conv) : (v * factor);
            });
        });
        return Math.round(total * 100) / 100;
    },
    applyReverseEntryLoc(sapCode, actKey, locIdx, targetVal) {
        if (this.isFinalized) { this.showToast('⚠️ Bill is locked. Please unlock first.', '🔒'); return; }
        const t = parseFloat(targetVal);
        if (isNaN(t) || t < 0) { this.showToast('Enter valid qty (0 or more)', '⛔'); return; }
        const act = this.activities[actKey];
        if (!act || !act.materials || !act.materials.length) return;
        if (locIdx < 0 || locIdx >= this.getActLocations(actKey).length) return;
        // Is activity me ye SAP code kin item se juda hai (factor 0 = not-required → bahar)
        const mapped = [];
        act.materials.forEach((m, mIdx) => {
            if (m.sapItems) m.sapItems.forEach(s => {
                if (!s.code || s.code !== sapCode) return;
                const mq = Number(s.qty);
                const factor = isNaN(mq) ? 1 : mq;
                if (factor !== 0) {
                    // 🔩 kg-material + wazan mila to nos → kg convert hoga
                    const _bw = this.nutBoltWeightForCode(sapCode);
                    mapped.push({ mIdx, factor, mat: m, w: (_bw > 0 && this.nutBoltTargetUnitKg(m)) ? _bw : 0 });
                }
            });
        });
        if (!mapped.length) { return; }
        const qMatrix = this.activityQuantities[actKey] || [];
        const locArr = qMatrix[locIdx] || [];
        // Sirf isi location ke cell dekho — formula ho to ruko
        const cur = mapped.map(mp => {
            const raw = (locArr[mp.mIdx] !== undefined) ? locArr[mp.mIdx] : '';
            if (typeof raw === 'string' && (raw.trim().startsWith('=') || raw.trim().startsWith('+'))) {
                return { mp, formula: true, v: 0, contrib: 0 };
            }
            const v = (raw === '' || raw === null) ? 0 : parseFloat(raw);
            const vv = isNaN(v) ? 0 : v;
            // 🔩 hissa SAP unit (nos) me naapo taaki baant sahi ho
            return { mp, formula: false, v: vv, contrib: vv * mp.factor / (mp.w || 1) };
        });
        if (cur.some(c => c.formula)) { return; }
        const totalContrib = cur.reduce((a, c) => a + c.contrib, 0);
        let shares;
        if (totalContrib > 0) {
            shares = cur.map(c => t * (c.contrib / totalContrib));
        } else if (cur.length === 1) {
            shares = [t];
        } else {
            shares = cur.map(() => t / cur.length);
            this.showToast(`${cur.length} items split equally (no prior data in this location)`, 'ℹ️');
        }
        // Matrix pakka karo, sirf isi location me likho — baaki location ko haath nahi
        this.initQuantitiesForActivity(actKey);
        const m2 = this.activityQuantities[actKey];
        const converted = cur.some(c => c.mp.w);
        cur.forEach((c, i) => {
            // 🔩 nos → kg (wazan se); warna seedha factor se
            const want = shares[i] / c.mp.factor * (c.mp.w || 1);
            m2[locIdx][c.mp.mIdx] = (want === 0) ? '' : (Math.round(want * 100) / 100);
        });
        this.saveToStorage(); // invoice auto-sync isi se judta hai
        const locName = (this.getActLocations(actKey)[locIdx] && this.getActLocations(actKey)[locIdx].name) || ('Loc ' + (locIdx + 1));
        this.showToast(sapCode + ' → Activity ' + actKey + ' / ' + locName + (converted ? ' (converted to kg)' : '') + ' (invoice updated)', '✅');
    },
    async exportReconciliationExcel() {
        this.showToast('Exporting Pivot Reconciliation Sheet...', '⏳');
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Billing Pro Studio';
        workbook.created = new Date();
        const ws = workbook.addWorksheet('Reconciliation Sheet', {
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
        
        const pData = this.pivotReconciliationData;
        // ↩️ Reverse ON ho to screen wali sheet export karo (invoice-activity × location columns, filtered rows)
        const revOn = !!this.reverseEntry;
        const rcols = revOn ? this.reverseReconColumns : [];
        const expRows = revOn ? this.reconRows : pData.rows;
        const expHeaders = revOn
            ? ['SR NO.', 'Row Labels', 'ITEMS DESCRIPTION', 'UNIT', 'ISSUE'].concat(rcols.map(c => c.actKey + ' / ' + ((this.getActLocations(c.actKey)[c.locIdx] || {}).name || ('Loc ' + (c.locIdx + 1)))))
            : ['SR NO.', 'Row Labels', 'ITEMS DESCRIPTION', 'UNIT', 'ISSUE'].concat(pData.columns);
        const totalCols = 5 + (revOn ? rcols.length : pData.columns.length);
        
        // Title Row
        ws.mergeCells(1, 1, 1, totalCols);
        const r1 = ws.getCell(1, 1);
        r1.value = `${this.getContractorDisplayName().toUpperCase()} MATERIAL RECONCILIATION SHEET`;
        r1.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        r1.fill = titleFill;
        r1.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(1).height = 30;
        
        // Header Row
        const row2 = ws.getRow(2);
        const headers = expHeaders;
        row2.values = headers;
        row2.height = 26;
        row2.eachCell((cell, colNum) => {
            cell.fill = headerFill;
            cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = thinBorder;
        });
        
        // Data Rows
        let rowIdx = 3;
        expRows.forEach((rowObj, idx) => {
            const row = ws.getRow(rowIdx);
            row.getCell(1).value = idx + 1;
            row.getCell(2).value = rowObj.code;
            row.getCell(3).value = rowObj.desc;
            row.getCell(4).value = rowObj.uom;
            row.getCell(5).value = rowObj.totalQty || '';

            if (revOn) {
                rcols.forEach((rc, cIdx) => {
                    row.getCell(6 + cIdx).value = this.reconCellLoc(rowObj.code, rc) || '';
                });
            } else {
                pData.columns.forEach((col, cIdx) => {
                    row.getCell(6 + cIdx).value = rowObj.activities[col] || '';
                });
            }
            
            row.eachCell((c, colNum) => {
                c.border = thinBorder;
                if (idx % 2 === 1) c.fill = zebraFill;
                
                c.alignment = { vertical: 'middle' };
                if (colNum === 3) {
                    c.alignment.horizontal = 'left';
                    c.alignment.wrapText = true;
                } else if (colNum === 5) {
                    c.alignment.horizontal = 'right';
                    c.font = { bold: true };
                } else {
                    c.alignment.horizontal = 'center';
                }
            });
            row.height = 20;
            rowIdx++;
        });
        
        // Column Widths
        const cols = [
            { width: 8 }, { width: 12 }, { width: 45 }, { width: 8 }, { width: 10 }
        ];
        (revOn ? rcols : pData.columns).forEach(() => cols.push({ width: 14 }));
        ws.columns = cols;
        
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'LK_Electricals_Pivot_Reconciliation_Sheet.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.showToast(revOn ? 'Reverse Reconciliation Excel downloaded! 🎉' : 'Pivot Reconciliation Excel downloaded! 🎉', '📊');
    },
    getActLocations(actKey) {
        if (this.activityLocations && this.activityLocations[actKey]) return this.activityLocations[actKey];
        return this.locations;
    },
    addLocation() {
        if (this.isFinalized) {
            this.showToast('⚠️ Bill is locked. Please unlock first.', '🔒');
            return;
        }
        const actKey = this.selectedActivityKey;
        const curLocs = this.getActLocations(actKey);
        const locName = `Location ${curLocs.length + 1}`;
        if (!this.activityLocations[actKey]) {
            this.activityLocations[actKey] = JSON.parse(JSON.stringify(curLocs));
        }
        this.activityLocations[actKey].push({ name: locName });
        const matCount = this.activities[actKey] ? this.activities[actKey].materials.length : 0;
        if (!this.activityQuantities[actKey]) {
            this.activityQuantities[actKey] = [];
        }
        this.activityQuantities[actKey].push(new Array(matCount).fill(''));
        this.saveToStorage();
        this.showToast(`Added location "${locName}" in activity ${this.selectedActivityKey}`, '📍');
    },
    removeLocation(index) {
        if (this.isFinalized) {
            this.showToast('⚠️ Bill is locked. Please unlock first.', '🔒');
            return;
        }
        const actKey = this.selectedActivityKey;
        const curLocs = this.getActLocations(actKey);
        if (curLocs.length <= 1) return;
        const name = curLocs[index].name;
        if (this.activityLocations[actKey]) {
            this.activityLocations[actKey].splice(index, 1);
        } else {
            this.locations.splice(index, 1);
        }
        if (this.activityQuantities[actKey] && this.activityQuantities[actKey][index]) {
            this.activityQuantities[actKey].splice(index, 1);
        }
        this.saveToStorage();
        this.showToast(`Removed location "${name}" from activity ${actKey}`, '🗑️');
    },
    renameLocation(locIdx, newName) {
        const actKey = this.selectedActivityKey;
        const curLocs = this.getActLocations(actKey);
        if (curLocs[locIdx]) {
            if (!this.activityLocations[actKey]) {
                this.activityLocations[actKey] = JSON.parse(JSON.stringify(curLocs));
            }
            this.activityLocations[actKey][locIdx].name = newName;
            this.saveToStorage();
        }
    },
    onExtraItemCodeSearch() {
        // suggestions are handled by computed extraItemSuggestions
    },
    selectExtraItemCode(mat) {
        this.newMaterial.desc = mat.desc;
        this.newMaterial.unit = mat.unit || 'No';
        this.newMaterial.rate = mat.rate || 0;
        this.newMaterial.sapCode = mat.itemCode || '';
        this.newMaterial.codeSearch = mat.desc;
    },
    submitAddMaterial() {
        if (this.isFinalized) {
            this.showToast('⚠️ Bill is locked. Please unlock first.', '🔒');
            return;
        }
        if (!this.newMaterial.desc) {
            alert('Please enter material description');
            return;
        }
        const itemNo = this.newMaterial.no || (this.currentActivity.materials.length + 1).toString();
        const newMat = {
            no: itemNo,
            desc: this.newMaterial.desc,
            unit: this.newMaterial.unit || 'No',
            rate: parseFloat(this.newMaterial.rate) || 0,
            itemCode: this.newMaterial.sapCode || '',
            isExtra: true
        };
        this.currentActivity.materials.push(newMat);
        const qMatrix = this.activityQuantities[this.selectedActivityKey];
        if (qMatrix) {
            qMatrix.forEach(locArr => locArr.push(''));
        }
        this.showAddMaterialModal = false;
        this.newMaterial = { no: '', desc: '', unit: 'No', rate: 0, codeSearch: '', sapCode: '' };
        this.saveToStorage();
        this.showToast('Extra item added at bottom ✨', '✅');
    },
    removeItem(itemIndex) {
        if (this.isFinalized) {
            this.showToast('⚠️ Bill is locked. Please unlock first.', '🔒');
            return;
        }
        if (confirm('Are you sure you want to delete this row?')) {
            this.currentActivity.materials.splice(itemIndex, 1);
            const qMatrix = this.activityQuantities[this.selectedActivityKey];
            if (qMatrix) {
                qMatrix.forEach(locArr => locArr.splice(itemIndex, 1));
            }
            this.saveToStorage();
            this.showToast('Item deleted', '🗑️');
        }
    },
    openNutBoltCalculator() {
        this.showNutBoltModal = true;
    },
    openConcretingCalculator() {
        this.showConcretingModal = true;
    },
    resetNutBolt() {
        this.nutBoltData.forEach(item => item.qty = '');
    },
    resetConcrete() {
        this.concretePoleData.forEach(item => item.poles = '');
        this.concreteMuffingData.forEach(item => item.qty = '');
    }
};
