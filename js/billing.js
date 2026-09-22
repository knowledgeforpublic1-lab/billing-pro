/**
 * @file Billing, Invoice & Contractor Module
 * @description Handles all billing calculations, tax invoice generation,
 * GST management, and contractor database CRUD operations.
 *
 * @module BillingModule
 * @since v2.0
 */

window.BillingModule = {

    // ─── INVOICE METHODS ───────────────────────────────────────────

    addSpecificActivityToInvoice(actKey) {
        if (this.isFinalized) {
            this.showToast('Bill is locked. Please unlock first.', 'Lock');
            return;
        }
        if (!this.activities[actKey]) return;

        // Un-exclude if it was previously excluded
        if (this.invoiceData.excludedActKeys) {
            const idx = this.invoiceData.excludedActKeys.indexOf(actKey);
            if (idx > -1) this.invoiceData.excludedActKeys.splice(idx, 1);
        }

        const amt85 = this.getActivityBilled85Amount(actKey);
        const actTitle = this.activities[actKey].title;
        const uom = this.getActivityUom(actKey);
        let actQty = 1.00;
        if (actKey === '907') {
            const q907 = this.getActivity907InvoiceQty();
            actQty = q907 > 0 ? q907 : 1.00;
        }

        // Check if already in items
        const existing = this.invoiceData.items.find(it => it.actKey === actKey || (it.desc && it.desc.startsWith(actKey + ':')));
        if (existing) {
            existing.amount = Math.round(amt85 * 100) / 100;
            existing.unit = uom;
            if (actKey === '907') {
                const q907 = this.getActivity907InvoiceQty();
                if (q907 > 0) existing.qty = q907;
            }
            this.showToast(`Activity ${actKey} already in invoice! Amount updated: ${this.formatCurrency(existing.amount)}`, 'Refresh');
        } else {
            // Remove initial blank row if it exists
            if (this.invoiceData.items.length === 1 && !this.invoiceData.items[0].desc && !this.invoiceData.items[0].amount) {
                this.invoiceData.items = [];
            }
            const nextSr = (this.invoiceData.items.length + 1).toString();
            this.invoiceData.items.push({
                srNo: nextSr,
                actKey: actKey,
                desc: `${actKey}: ${actTitle}`,
                unit: uom,
                qty: actQty,
                amount: Math.round(amt85 * 100) / 100
            });
            this.showToast(`Activity ${actKey} added to invoice (${this.formatCurrency(amt85)})!`, 'Check');
        }
        this.syncInvoiceLocationNames();
        this.saveToStorage();
    },

    onQuickAddActivitySelect() {
        if (this.quickSelectedActivityKey) {
            this.addSpecificActivityToInvoice(this.quickSelectedActivityKey);
            this.quickSelectedActivityKey = '';
        }
    },

    syncInvoiceLocationNames() {
        const excluded = this.invoiceData.excludedActKeys || [];
        const allLocNames = new Set();
        this.invoiceData.items.forEach(it => {
            if (it.actKey && this.activities[it.actKey] && !excluded.includes(it.actKey)) {
                this.getActLocations(it.actKey).forEach(loc => {
                    if (loc.name && loc.name.trim()) allLocNames.add(loc.name.trim());
                });
            }
        });
        if (allLocNames.size > 0) {
            this.invoiceData.locationName = [...allLocNames].join(', ');
        }
    },

    onInvoiceFieldBlur(it, field, event) {
        this.handleItemFormulaBlur(it, field, event);
        if (this.editingInvoiceRow === it) this.editingInvoiceRow = null;
    },

    onInvoiceRowEdit(it) {
        if (this.isFinalized) { this.showToast('Bill is locked. Please unlock first.', 'Lock'); return; }
        if (this.editingInvoiceRow === it) this.editingInvoiceRow = null;
        if (it && it.actKey && !it.manual) {
            it.manual = true;
            this.showToast('Row set to manual - auto-sync won\'t overwrite', 'Edit');
        }
        this.saveToStorage();
    },

    toggleInvoiceRowMode(it) {
        if (this.isFinalized) { this.showToast('Bill is locked. Please unlock first.', 'Lock'); return; }
        it.manual = !it.manual;
        if (!it.manual && it.actKey) {
            this.updateSyncTaxInvoiceFromActivities();
        }
        this.saveToStorage();
        this.showToast(it.manual ? 'Manual lock - this row is fixed' : 'Auto sync on - refreshed from billing', it.manual ? 'Edit' : 'Refresh');
    },

    updateSyncTaxInvoiceFromActivities() {
        if (!this.invoiceData.autoSync) return;
        if (!this.invoiceData.excludedActKeys) {
            this.invoiceData.excludedActKeys = [];
        }

        const keyOf = (it) => it.actKey || ((it.desc && /^[A-Za-z0-9]+:/.test(it.desc)) ? it.desc.split(':')[0] : '');
        const excluded = this.invoiceData.excludedActKeys || [];
        const billedKeys = Object.keys(this.activities).filter(k => !excluded.includes(k) && this.getActivityBilled85Amount(k) > 0);
        const billedSet = new Set(billedKeys);
        const qtyFor = (k) => {
            if (k === '907') { const q = this.getActivity907InvoiceQty(); return q > 0 ? q : 1.00; }
            return 1.00;
        };
        const seen = new Set();
        const newItems = [];
        this.invoiceData.items.forEach(it => {
            const k = keyOf(it);
            if (k && billedSet.has(k) && !seen.has(k)) {
                seen.add(k);
                if (it === this.editingInvoiceRow) { newItems.push(it); return; }
                if (it.manual) { it.actKey = k; newItems.push(it); return; }
                it.actKey = k;
                it.desc = `${k}: ${this.activities[k].title}`;
                it.unit = this.getActivityUom(k);
                it.qty = qtyFor(k);
                it.amount = Math.round(this.getActivityBilled85Amount(k) * 100) / 100;
                it.manual = false;
                newItems.push(it);
            } else if (k && this.activities[k] && it.manual && !seen.has(k)) {
                seen.add(k);
                newItems.push(it);
            } else if (!k || !this.activities[k]) {
                newItems.push(it);
            }
        });
        billedKeys.forEach(k => {
            if (!seen.has(k)) {
                seen.add(k);
                newItems.push({
                    srNo: '',
                    actKey: k,
                    desc: `${k}: ${this.activities[k].title}`,
                    unit: this.getActivityUom(k),
                    qty: qtyFor(k),
                    amount: Math.round(this.getActivityBilled85Amount(k) * 100) / 100,
                    manual: false
                });
            }
        });
        newItems.forEach((it, idx) => { it.srNo = (idx + 1).toString(); });

        if (newItems.length > 0) {
            const same = newItems.length === this.invoiceData.items.length && newItems.every((it, i) => it === this.invoiceData.items[i]);
            if (!same) this.invoiceData.items = newItems;
        } else if (this.invoiceData.items.length === 0) {
            this.invoiceData.items = [
                {
                    srNo: '1',
                    desc: '',
                    unit: 'Nos',
                    qty: 1,
                    amount: 0,
                    manual: true
                }
            ];
        }
        this.syncInvoiceLocationNames();
    },

    addInvoiceItem() {
        if (this.isFinalized) {
            this.showToast('Bill is locked. Please unlock first.', 'Lock');
            return;
        }
        const nextSr = (this.invoiceData.items.length + 1).toString();
        this.invoiceData.items.push({
            srNo: nextSr,
            desc: '',
            unit: 'Nos',
            qty: 1,
            amount: 0,
            manual: true
        });
        this.saveToStorage();
        this.showToast('Added new blank item row to invoice', 'Plus');
    },

    removeInvoiceItem(idx) {
        if (this.isFinalized) {
            this.showToast('Bill is locked. Please unlock first.', 'Lock');
            return;
        }
        const item = this.invoiceData.items[idx];
        if (item && item.actKey) {
            const actKey = item.actKey;
            if (!this.invoiceData.excludedActKeys) {
                this.invoiceData.excludedActKeys = [];
            }
            if (!this.invoiceData.excludedActKeys.includes(actKey)) {
                this.invoiceData.excludedActKeys.push(actKey);
            }
            // Clear activity location quantities
            if (this.activityQuantities[actKey]) {
                const matCount = this.activities[actKey] ? this.activities[actKey].materials.length : 0;
                this.activityQuantities[actKey] = this.getActLocations(actKey).map(() => new Array(matCount).fill(''));
            }
            const absItem = this.masterAbstractList.find(a => a.code === actKey);
            if (absItem) absItem.qty = 1;
        }
        this.invoiceData.items.splice(idx, 1);
        if (this.invoiceData.items.length === 0) {
            this.invoiceData.items.push({
                srNo: '1',
                desc: '',
                unit: 'Nos',
                qty: 1,
                amount: 0
            });
        } else {
            this.invoiceData.items.forEach((it, i) => {
                it.srNo = (i + 1).toString();
            });
        }
        this.saveToStorage();
        this.showToast('Activity / Item removed from invoice', 'Trash');
    },

    syncInvoiceFromBilling() {
        if (this.invoiceData.excludedActKeys) {
            this.invoiceData.excludedActKeys = [];
        }
        // Force sync - linked rows ka manual lock khol do taaki fresh billing se refresh ho
        this.invoiceData.items.forEach(it => { if (it.actKey) it.manual = false; });
        this.updateSyncTaxInvoiceFromActivities();
        this.saveToStorage();
        this.showToast('Tax Invoice updated with all active billed activities (85%)!', 'Invoice');
    },

    getMissingInvoiceMeta() {
        const missing = [];
        const v = this.invoiceData || {};
        if (!String(v.invoiceNo || '').trim()) missing.push('Invoice No');
        if (!String(v.workOrderNo || '').trim()) missing.push('Work Order No');
        if (!String(v.workOrderDate || '').trim()) missing.push('WO Dt');
        if (!String(v.invoiceDate || '').trim()) missing.push('Invoice Date');
        if (!String(v.divisionName || '').trim()) missing.push('Name of Division');
        if (!String(v.subDivName || '').trim()) missing.push('Name of Sub-Div');
        return missing;
    },

    // ─── GST METHODS ───────────────────────────────────────────────

    checkAndApplyAutoGstRule() {
        if (this.invoiceData.gstManual) return;
        if (this.isFinalized) return;
        const contractorGstin = (this.invoiceData.contractorGstin || '').trim().toUpperCase();
        const clientGstin = (this.invoiceData.clientGstin || '').trim().toUpperCase();
        // Contractor ka GSTIN nahi/sahi nahi -> GST zero (NONE). GSTIN format: 22AAAAA0000A1Z5
        if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9][Z][0-9A-Z]$/.test(contractorGstin)) {
            if (this.invoiceData.gstType !== 'NONE') {
                this.invoiceData.gstType = 'NONE';
            }
            return;
        }
        const contractorState = contractorGstin.substring(0, 2);
        const clientState = clientGstin.substring(0, 2);

        if (contractorState.length === 2 && clientState.length === 2) {
            if (contractorState === clientState) {
                // Same state (e.g. 27 to 27 or 08 to 08) -> Intra-state -> CGST 9% + SGST 9%
                this.invoiceData.gstType = 'CGST_SGST';
            } else {
                // Different states (e.g. 08 Rajasthan contractor to 27 Maharashtra client) -> Inter-state -> IGST 18%
                this.invoiceData.gstType = 'IGST';
            }
        } else if (contractorState.length === 2 && contractorState !== '27') {
            if (clientState.length >= 2 && clientState !== contractorState) {
                this.invoiceData.gstType = 'IGST';
            }
        } else if (clientState.length >= 2) {
            if (clientState === '27') {
                this.invoiceData.gstType = 'CGST_SGST';
            } else {
                this.invoiceData.gstType = 'IGST';
            }
        }
    },

    onGstTypeManualChange() {
        if (this.isFinalized) { this.showToast('Bill is locked. Please unlock first.', 'Lock'); return; }
        this.invoiceData.gstManual = true;
        this.saveToStorage();
        this.showToast('GST type manual lock - auto-rule won\'t change', 'Edit');
    },

    toggleGstMode() {
        if (this.isFinalized) { this.showToast('Bill is locked. Please unlock first.', 'Lock'); return; }
        this.invoiceData.gstManual = !this.invoiceData.gstManual;
        if (!this.invoiceData.gstManual) this.checkAndApplyAutoGstRule();
        this.saveToStorage();
        this.showToast(this.invoiceData.gstManual ? 'GST manual lock - fixed' : 'GST auto mode - set from GSTIN', this.invoiceData.gstManual ? 'Edit' : 'Refresh');
    },

    // ─── CONTRACTOR METHODS ────────────────────────────────────────

    openContractorManager() {
        this.contractorModalMode = 'list';
        this.contractorSearchQuery = '';
        this.showContractorModal = true;
    },

    openAddContractorForm() {
        this.contractorForm = {
            name: '',
            pan: '',
            gstin: '',
            bankAccountName: '',
            bankAccountNo: '',
            bankIfsc: '',
            bankName: '',
            workOrderNo: this.invoiceData.workOrderNo || '31006345',
            workOrderDate: this.invoiceData.workOrderDate || '29.08.25',
            divisionName: this.invoiceData.divisionName || 'ALLAPALLI',
            subDivName: this.invoiceData.subDivName || 'Chamorshi',
            feederName: this.invoiceData.feederName || '11 KV Yenapur, Gogaon'
        };
        this.editingContractorId = null;
        this.contractorModalMode = 'form';
    },

    openEditContractor(firm) {
        this.contractorForm = JSON.parse(JSON.stringify(firm));
        this.editingContractorId = firm.id;
        this.contractorModalMode = 'form';
    },

    saveContractorProfile() {
        if (!this.contractorForm.name || !this.contractorForm.pan || !this.contractorForm.gstin) {
            alert('Please fill Name, PAN, and GSTIN.');
            return;
        }
        this.contractorForm.pan = (this.contractorForm.pan || '').trim().toUpperCase();
        this.contractorForm.gstin = (this.contractorForm.gstin || '').trim().toUpperCase();
        this.contractorForm.bankIfsc = (this.contractorForm.bankIfsc || '').trim().toUpperCase();

        const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
        if (!panPattern.test(this.contractorForm.pan)) {
            alert('Invalid PAN format. Expected: AAAAA9999A (e.g. CTZPS1380P)');
            return;
        }

        const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9][Z][0-9A-Z]$/;
        if (!gstinPattern.test(this.contractorForm.gstin)) {
            alert('Invalid GSTIN format. Expected: 2 digits + PAN + 1 check digit + Z + 1 alphanumeric (15 chars total)');
            return;
        }

        if (this.editingContractorId) {
            const idx = this.contractorsList.findIndex(c => c.id === this.editingContractorId);
            if (idx !== -1) {
                this.contractorsList[idx] = { ...this.contractorForm, id: this.editingContractorId };
                this.showToast(`Updated firm: ${this.contractorForm.name}`, 'Edit');
                if (this.selectedContractorId === this.editingContractorId) {
                    this.applyContractorProfile(this.editingContractorId);
                }
            }
        } else {
            const newId = 'firm_' + Date.now();
            const newFirm = { ...this.contractorForm, id: newId };
            this.contractorsList.push(newFirm);
            this.showToast(`Added new firm: ${newFirm.name} to Database!`, 'Celebrate');
            this.applyContractorProfile(newId);
        }
        this.contractorModalMode = 'list';
        this.saveToStorage();
    },

    deleteContractorProfile(firmId) {
        if (this.contractorsList.length <= 1) {
            alert('Database must have at least one firm profile.');
            return;
        }
        const firm = this.contractorsList.find(c => c.id === firmId);
        if (confirm(`Are you sure you want to delete firm "${firm ? firm.name : firmId}" from Database?`)) {
            this.contractorsList = this.contractorsList.filter(c => c.id !== firmId);
            if (this.selectedContractorId === firmId) {
                this.selectedContractorId = this.contractorsList[0].id;
                this.applyContractorProfile(this.selectedContractorId);
            }
            this.saveToStorage();
            this.showToast('Firm profile removed from Database.', 'Trash');
        }
    },

    applyContractorProfile(firmId) {
        this.selectedContractorId = firmId;
        const firm = this.contractorsList.find(c => c.id === firmId);
        if (firm) {
            const firmName = firm.name.startsWith('M/s') ? firm.name : `M/s ${firm.name}`;
            this.invoiceData.contractorName = firmName;
            this.invoiceData.contractorPan = firm.pan;
            this.invoiceData.contractorGstin = firm.gstin;
            this.invoiceData.bankAccountName = firm.bankAccountName || firmName;
            this.invoiceData.bankAccountNo = firm.bankAccountNo || '';
            this.invoiceData.bankIfsc = firm.bankIfsc || '';
            this.invoiceData.bankName = firm.bankName || '';
            // Manual suraksha: haath se bhare field ko contractor badalne par overwrite MAT karo - sirf khali ho to bharo
            if (firm.workOrderNo && !this.invoiceData.workOrderNo) this.invoiceData.workOrderNo = firm.workOrderNo;
            if (firm.workOrderDate && !this.invoiceData.workOrderDate) this.invoiceData.workOrderDate = firm.workOrderDate;
            if (firm.divisionName && !this.invoiceData.divisionName) this.invoiceData.divisionName = firm.divisionName;
            if (firm.subDivName && !this.invoiceData.subDivName) this.invoiceData.subDivName = firm.subDivName;
            if (firm.feederName && !this.invoiceData.feederName) this.invoiceData.feederName = firm.feederName;

            this.projectMeta.contractorName = firmName;
            this.checkAndApplyAutoGstRule();
            this.saveToStorage();
            this.showToast(`Applied Firm: ${firm.name} (PAN: ${firm.pan}, GST: ${firm.gstin})`, 'Check');
        }
        this.showContractorModal = false;
    },

    toggleContractorDropdown() {
        if (this.isFinalized) return;
        this.contractorDropdownOpen = !this.contractorDropdownOpen;
        if (this.contractorDropdownOpen) {
            this.contractorDropdownSearch = '';
            this.$nextTick(() => {
                if (this.$refs.contractorSearchInput) this.$refs.contractorSearchInput.focus();
            });
        }
    },

    closeContractorDropdown() {
        this.contractorDropdownOpen = false;
        this.contractorDropdownSearch = '';
    },

    selectContractor(firmId) {
        this.selectedContractorId = firmId;
        this.closeContractorDropdown();
        if (firmId === 'custom') {
            this.showToast('Custom Contractor Mode: Details directly editable.', 'Edit');
            return;
        }
        this.applyContractorProfile(firmId);
    },

    onContractorDropdownChange() {
        this.applyContractorProfile(this.selectedContractorId);
    },

    onCompanySelect() {
        if (this.selectedCompanyId === 'custom') {
            this.showToast('Custom Company Mode: Details directly editable.', 'Edit');
            return;
        }
        const comp = this.companiesList.find(c => c.id === this.selectedCompanyId);
        if (comp) {
            this.invoiceData.clientName = comp.name;
            this.invoiceData.clientAddress = comp.address;
            this.invoiceData.clientGstin = comp.gstin;
            this.checkAndApplyAutoGstRule();
            this.saveToStorage();
            this.showToast(`Company selected: ${comp.name}`, 'Building');
        }
    },

    normalizeAllContractorBanks() {
        if (!Array.isArray(this.contractorsList)) return;
        let fixed = 0;
        this.contractorsList.forEach(c => {
            if (!c || typeof c.bankName !== 'string' || c.bankName.indexOf('\n') === -1) return;
            const lines = c.bankName.split('\n').map(s => (s || '').trim()).filter(Boolean);
            let acc = '', ifsc = '';
            const nameParts = [];
            lines.forEach(ln => {
                const mIfsc = ln.match(/\b[A-Z]{4}0[A-Z0-9]{6}\b/);
                const digits = ln.replace(/\D/g, '');
                if (mIfsc && !c.bankIfsc) { ifsc = mIfsc[0]; return; }
                if (!mIfsc && digits.length >= 9 && digits.length <= 22 && !c.bankAccountNo) { acc = digits; return; }
                nameParts.push(ln);
            });
            if (acc) { c.bankAccountNo = acc; fixed++; }
            if (ifsc) { c.bankIfsc = ifsc; fixed++; }
            if (nameParts.length > 0) c.bankName = nameParts.join(' ');
        });
        if (fixed > 0) { this.saveToStorage(); this.showToast(`${fixed} bank fields cleaned`, 'Bank'); }
    },

    getContractorDisplayName() {
        const name = this.invoiceData.contractorName || 'CONTRACTOR';
        if (name.toLowerCase().startsWith('m/s') || name.toLowerCase().startsWith('ms')) return name;
        return 'M/s ' + name;
    },

    // ─── BILLING UTILITY METHODS ───────────────────────────────────

    saveActivityExplicit() {
        if (this.isFinalized) {
            this.showToast('Bill is locked. Please unlock first to make edits.', 'Lock');
            return;
        }
        this.saveToStorage();
        const amt85 = this.getActivityBilled85Amount(this.selectedActivityKey);
        this.showToast(`Activity ${this.selectedActivityKey} saved! 85% Amount (${this.formatCurrency(amt85)}) updated in Invoice.`, 'Disk');
    },

    finalizeBill() {
        const billedActKeys = Object.keys(this.activities).filter(k => this.getActivityBilled85Amount(k) > 0);
        if (billedActKeys.length === 0) {
            if (!confirm('Abhi kisi bhi activity mein data / amount nahi hai. Kya aap phir bhi Bill Finalize karna chahte hain?')) {
                return;
            }
        } else {
            if (!confirm(`Kya aap sabhi ${billedActKeys.length} activities ke sath Bill Finalize aur Lock karna chahte hain?\n\nActivities: ${billedActKeys.join(', ')}\nTotal Invoice Basic (85%): ${this.formatCurrency(this.calculatedInvoiceBasic)}`)) {
                return;
            }
        }
        this.isFinalized = true;
        this.updateSyncTaxInvoiceFromActivities();
        this.saveToStorage();
        this.showToast(`Final Bill locked successfully with all ${billedActKeys.length} activities!`, 'Lock');
    },

    unlockBill() {
        if (confirm('Kya aap Bill ko editing ke liye unlock karna chahte hain?')) {
            this.isFinalized = false;
            this.saveToStorage();
            this.showToast('Bill unlocked for editing.', 'Edit');
        }
    },

    getActivityBilled85Amount(actKey) {
        const act = this.activities[actKey];
        let totalAmt100 = 0;
        if (act && act.materials && this.activityQuantities[actKey]) {
            const qMatrix = this.activityQuantities[actKey];
            for (let mIdx = 0; mIdx < act.materials.length; mIdx++) {
                let itemQty = 0;
                for (let locIdx = 0; locIdx < this.getActLocations(actKey).length; locIdx++) {
                    if (qMatrix[locIdx] && qMatrix[locIdx][mIdx] !== undefined && qMatrix[locIdx][mIdx] !== '') {
                        const v = parseFloat(qMatrix[locIdx][mIdx]);
                        if (!isNaN(v)) itemQty += v;
                    }
                }
                totalAmt100 += itemQty * (Number(act.materials[mIdx].rate) || 0);
            }
        }
        // Fallback: If no location quantity entered in detail, check if master abstract has quantity
        if (totalAmt100 === 0) {
            const absItem = this.masterAbstractList.find(a => a.code === actKey);
            if (absItem && Number(absItem.qty) > 0) {
                totalAmt100 = (Number(absItem.qty) || 0) * (Number(absItem.rate) || 0);
            }
        }
        return totalAmt100 * (this.pctStage1 / 100);
    },

    getActivityTotals(actKey) {
        const act = this.activities[actKey];
        let amt100 = 0;
        if (act && act.materials && this.activityQuantities[actKey]) {
            const qMatrix = this.activityQuantities[actKey];
            for (let mIdx = 0; mIdx < act.materials.length; mIdx++) {
                let itemQty = 0;
                for (let locIdx = 0; locIdx < this.getActLocations(actKey).length; locIdx++) {
                    if (qMatrix[locIdx] && qMatrix[locIdx][mIdx] !== undefined && qMatrix[locIdx][mIdx] !== '') {
                        const v = parseFloat(qMatrix[locIdx][mIdx]);
                        if (!isNaN(v)) itemQty += v;
                    }
                }
                amt100 += itemQty * (Number(act.materials[mIdx].rate) || 0);
            }
        }
        if (amt100 === 0) {
            const absItem = this.masterAbstractList.find(a => a.code === actKey);
            if (absItem && Number(absItem.qty) > 0) {
                amt100 = (Number(absItem.qty) || 0) * (Number(absItem.rate) || 0);
            }
        }
        return {
            amt100: amt100,
            amtStage1: amt100 * (this.pctStage1 / 100),
            amtStage2: amt100 * (this.pctStage2 / 100),
            amtStage3: amt100 * (this.pctStage3 / 100)
        };
    },

    getActivityUom(actKey) {
        const found = this.masterAbstractList.find(a => a.code === actKey);
        return found ? found.uom : 'Nos';
    },

    getActivity907AaacTotalRmt() {
        const act = this.activities && this.activities['907'];
        if (!act || !act.materials) return 0;
        let matIdx = act.materials.findIndex(m => {
            if (!m || !m.desc) return false;
            const d = m.desc.toUpperCase();
            const u = (m.unit || '').toUpperCase();
            return d.includes('AAAC') && (u.includes('RMT') || u.includes('MTR') || d.includes('55 MM2'));
        });
        if (matIdx === -1) {
            matIdx = act.materials.findIndex(m => {
                if (!m || !m.desc) return false;
                const d = m.desc.toUpperCase();
                return d.includes('AAAC') && !d.includes('HARDWARE') && !d.includes('JOINT') && !d.includes('CONNECTOR');
            });
        }
        if (matIdx === -1) return 0;

        let totalAaacRmt = 0;
        const qMatrix = this.activityQuantities ? this.activityQuantities['907'] : null;
        if (qMatrix && Array.isArray(qMatrix)) {
            for (let locIdx = 0; locIdx < this.getActLocations('907').length; locIdx++) {
                if (qMatrix[locIdx] && qMatrix[locIdx][matIdx] !== undefined && qMatrix[locIdx][matIdx] !== '') {
                    const val = parseFloat(qMatrix[locIdx][matIdx]);
                    if (!isNaN(val)) totalAaacRmt += val;
                }
            }
        }
        return totalAaacRmt;
    },

    getActivity907InvoiceQty() {
        const rmt = this.getActivity907AaacTotalRmt();
        const div = Number(this.projectMeta.aaacDivisor) || 3150;
        if (rmt > 0) {
            return Math.round((rmt / div) * 1000) / 1000;
        }
        return 0;
    },

    calculateTotalQty(itemIndex) {
        const qMatrix = this.activityQuantities[this.selectedActivityKey];
        const curLocs = this.getActLocations(this.selectedActivityKey);
        if (!qMatrix) return 0;
        let total = 0;
        for (let locIdx = 0; locIdx < curLocs.length; locIdx++) {
            if (qMatrix[locIdx] && qMatrix[locIdx][itemIndex] !== undefined) {
                const val = parseFloat(qMatrix[locIdx][itemIndex]);
                if (!isNaN(val)) total += val;
            }
        }
        return total;
    },

    calculateItemAmount(itemIndex, factor = 1) {
        const totalQty = this.calculateTotalQty(itemIndex);
        const mat = this.currentActivity.materials[itemIndex];
        if (!mat) return 0;
        return totalQty * (Number(mat.rate) || 0) * factor;
    },

    initQuantitiesForActivity(actKey) {
        const act = this.activities[actKey];
        const matCount = act && act.materials ? act.materials.length : 0;
        const numLocs = this.getActLocations(actKey).length;

        if (!this.activityQuantities[actKey] || !Array.isArray(this.activityQuantities[actKey])) {
            this.activityQuantities[actKey] = Array.from({ length: numLocs }, () => new Array(matCount).fill(''));
        } else {
            while (this.activityQuantities[actKey].length < numLocs) {
                this.activityQuantities[actKey].push(new Array(matCount).fill(''));
            }
            for (let locIdx = 0; locIdx < this.activityQuantities[actKey].length; locIdx++) {
                if (!Array.isArray(this.activityQuantities[actKey][locIdx])) {
                    this.activityQuantities[actKey][locIdx] = new Array(matCount).fill('');
                } else {
                    while (this.activityQuantities[actKey][locIdx].length < matCount) {
                        this.activityQuantities[actKey][locIdx].push('');
                    }
                }
            }
        }
    },

    onActivityChange() {
        this.initQuantitiesForActivity(this.selectedActivityKey);
        this.saveToStorage();
    },

    resetFilters() {
        this.searchQuery = '';
        this.selectedLocationIdx = 'ALL';
        // Remove extra items from current activity
        if (this.currentActivity && this.currentActivity.materials) {
            const extraIndices = [];
            this.currentActivity.materials.forEach((m, idx) => {
                if (m.isExtra) extraIndices.push(idx);
            });
            // Remove from end to preserve indices
            for (let i = extraIndices.length - 1; i >= 0; i--) {
                this.currentActivity.materials.splice(extraIndices[i], 1);
                if (this.activityQuantities[this.selectedActivityKey]) {
                    this.activityQuantities[this.selectedActivityKey].forEach(locArr => {
                        locArr.splice(extraIndices[i], 1);
                    });
                }
            }
        }
        // Reset all quantities to zero for current activity
        if (this.activityQuantities[this.selectedActivityKey]) {
            this.activityQuantities[this.selectedActivityKey].forEach(locArr => {
                for (let i = 0; i < locArr.length; i++) {
                    locArr[i] = '';
                }
            });
        }
        this.saveToStorage();
        this.showToast('Reset done - Extra items removed & quantities cleared', 'Check');
    },

    openActivityDetail(code) {
        if (this.activities[code]) {
            this.selectedActivityKey = code;
            this.currentView = 'detail';
            this.initQuantitiesForActivity(code);
        }
    }
};
