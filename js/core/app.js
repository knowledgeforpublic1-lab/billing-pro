/**
 * @file Core Application
 * @description Main Vue 3 application definition. Combines all modules into a single Vue app.
 * This is the entry point that wires together data, computed, watchers, methods (from modules), and lifecycle hooks.
 *
 * Load order (in index.html):
 * 1. Vue 3 (CDN)
 * 2. ExcelJS (CDN)
 * 3. Data modules (js/data/*.js) - define global default* constants
 * 4. Feature modules (js/*.js) - define window.*Module objects
 * 5. THIS FILE (js/core/app.js) - creates and mounts Vue app
 *
 * @module App
 * @version 2.0.0
 */

(function() {
    'use strict';

    // Merge all modules into a single methods object
    const allMethods = Object.assign(
        {},
        window.UtilsModule || {},
        window.HistoryModule || {},
        window.SyncModule || {},
        window.BillingModule || {},
        window.MappingModule || {},
        window.ViewsModule || {},
        window.ExportModule || {}
    );

    const app = Vue.createApp({
        data() {
            return {
                isFinalized: false,
                currentView: (function() { try { return localStorage.getItem('billing_current_view') || 'detail'; } catch(e) { return 'detail'; } })(),
                selectedActivityKey: '1220',
                searchQuery: '',
                selectedLocationIdx: 'ALL',
                // ↩️ Reverse entry (reconciliation → activity) — default OFF = purana system jaisa hai wesa
                // (choice localStorage me yaad rehti hai; Mongo sync me nahi jati — sirf UI mode hai)
                reverseEntry: (function() { try { return localStorage.getItem('lk_billing_reverse_entry') === '1'; } catch(e) { return false; } })(),
                // ↩️ Reverse view ka "➕ Item ▾" dropdown + inline entry (reconciliation material)
                showReverseAddMenu: false,
                reverseAddSearch: '',
                reverseAddSelCode: '',
                reverseAddExtraMode: false, // true = item activity me nahi hai → Extra Item banega
                reverseAddAct: '',
                reverseAddQty: 1,
                reverseAddLoc: 0,
                mappingActivityFilter: 'ALL',
                mappingSearchQuery: '',
                // 🔒 Mapping locks — hamesha fix (locked) rahega, edit ke liye unlock karna hoga
                mappingLocks: (function() {
                    try {
                        const s = JSON.parse(localStorage.getItem('lk_billing_mapping_locks_v1') || 'null');
                        if (s && typeof s === 'object') return { rate: s.rate !== false, sap: s.sap !== false, qty: s.qty !== false };
                    } catch(e) {}
                    return { rate: true, sap: true, qty: true };
                })(),
                // ☁️ Mongo sync status (kam space kharch ho isliye debounce + change-check ke sath)
                syncStatus: 'local',
                lastSyncAt: '',
                lastSentHash: '',
                // Optimistic concurrency — cloudRev = GET/POST se mila latest rev;
                // cloudConflict = stale tab ne push kiya jo reject hua, Refresh zaroori
                cloudRev: 0,
                cloudConflict: false,
                sapMaterialsMaster: typeof defaultSapMaterialsMaster !== 'undefined' ? defaultSapMaterialsMaster : [],
                pctStage1: 85,
                pctStage2: 10,
                pctStage3: 5,
                showAddMaterialModal: false,
                showContractorModal: false,
                contractorModalMode: 'list', // 'list' or 'form'
                contractorSearchQuery: '',
                contractorDropdownOpen: false,
                contractorDropdownSearch: '',
                showNutBoltModal: false,
                showConcretingModal: false,
                selectedAugerSize: 22,
                nutBoltData: [
                    { size: '16×65', unit: 'nos', weight: 0.164, qty: '' },
                    { size: '16×35', unit: 'nos', weight: 0.119, qty: '' },
                    { size: '16×75', unit: 'nos', weight: 0.180, qty: '' },
                    { size: '16×150', unit: 'nos', weight: 0.299, qty: '' },
                    { size: '6×75', unit: 'nos', weight: 0.022, qty: '' },
                    { size: '6×50', unit: 'nos', weight: 0.014, qty: '' },
                    { size: '8×50', unit: 'nos', weight: 0.900, qty: '' },
                    { size: '12×140', unit: 'nos', weight: 0.173, qty: '' },
                    { size: '12×100', unit: 'nos', weight: 0.120, qty: '' },
                    { size: '12×35', unit: 'nos', weight: 0.049, qty: '' },
                    { size: '12×65', unit: 'nos', weight: 0.085, qty: '' },
                    { size: '12×150', unit: 'nos', weight: 0.173, qty: '' },
                    { size: '12×175', unit: 'nos', weight: 0.203, qty: '' },
                    { size: '12×190', unit: 'nos', weight: 0.170, qty: '' },
                    { size: '12×125', unit: 'nos', weight: 0.148, qty: '' },
                    { size: '12×225', unit: 'nos', weight: 0.159, qty: '' },
                    { size: '12×35', unit: 'nos', weight: 0.119, qty: '' }
                ],
                concretePoleData: [
                    { poleMtr: 8.0, h: 1.33, poles: '' },
                    { poleMtr: 9.0, h: 1.50, poles: '' },
                    { poleMtr: 10.0, h: 1.67, poles: '' },
                    { poleMtr: 11.0, h: 1.83, poles: '' },
                    { poleMtr: 13.0, h: 2.17, poles: '' }
                ],
                concreteMuffingData: [
                    { desc: 'HT G.I.Stay Wire 7/3.15mm (10SWG)', unit: 'Kg.', vol: 8, qty: '' },
                    { desc: 'LT G.I.Stay Wire 7/3.15mm (10SWG)', unit: 'Kg.', vol: 7, qty: '' },
                    { desc: 'Muffing 450×450 DP And DTC', unit: 'CMT', vol: 0.091, qty: '' },
                    { desc: 'Muffing 300×300 Pole', unit: 'CMT', vol: 0.027, qty: '' },
                    { desc: 'Muffing 400×400 Pole', unit: 'CMT', vol: 0.048, qty: '' },
                    { desc: 'Stay Concreting', unit: 'CMT', vol: 0.125, qty: '' },
                    { desc: 'G.I.Wire 8 SWG / 6 SWG for Pole Earthing', unit: 'Kg.', vol: 1.35, qty: '' },
                    { desc: 'G.I.Wire 8 SWG / 6 SWG for DTC Earthing', unit: 'Kg.', vol: 6.75, qty: '' },
                    { desc: 'Tree Cutting', unit: 'km', vol: 0.02, qty: '' },
                    { desc: 'Barbed Wire', unit: 'Kg.', vol: 3.5, qty: '' },
                    { desc: 'Guarding HT', unit: 'Kg./mtr', vol: 0.099, qty: '' },
                    { desc: 'Guarding LT', unit: 'Kg./mtr', vol: 0.099, qty: '' },
                    { desc: 'Jumpering', unit: 'Rmt', vol: 4.5, qty: '' }
                ],
                editingContractorId: null,
                contractorsList: JSON.parse(JSON.stringify(defaultContractorsList)),
                selectedContractorId: 'ranjeet_singh_lodhi',
                contractorForm: {
                    name: '',
                    pan: '',
                    gstin: '',
                    bankAccountName: '',
                    bankAccountNo: '',
                    bankIfsc: '',
                    bankName: '',
                    workOrderNo: '',
                    workOrderDate: '',
                    divisionName: '',
                    subDivName: '',
                    feederName: ''
                },
                toasts: [],
                companiesList: JSON.parse(JSON.stringify(defaultCompaniesList)),
                selectedCompanyId: 'ashoka_buildcon',
                projectMeta: {
                    projectName: 'RDSS T-10 GADCHIROLI',
                    contractorName: 'M/s Ranjeet Singh',
                    billNo: 'RSL/RA/02',
                    billDate: '2026-01-23',
                    contractValue: 48550000,
                    aaacDivisor: 3150
                },
                locations: [
                    { name: 'Ra-09 Bodhali' },
                    { name: 'Ra-09 Gogaon' },
                    { name: 'Ra-09 Nawegaon' }
                ],
                activityLocations: {},
                activities: (function() {
                    try {
                        const raw = localStorage.getItem('lk_billing_app_state_v10');
                        if (raw) {
                            const parsed = JSON.parse(raw);
                            if (parsed && parsed.activities && typeof parsed.activities === 'object' && Object.keys(parsed.activities).length > 0) {
                                return parsed.activities;
                            }
                        }
                    } catch(e) {}
                    return JSON.parse(JSON.stringify(defaultActivities));
                })(),
                masterAbstractList: JSON.parse(JSON.stringify(defaultMasterAbstract)),
                activityQuantities: {},
                invoiceData: JSON.parse(JSON.stringify(defaultInvoiceData)),
                editingInvoiceRow: null, // jis invoice row me user type kar raha hai — sync isko skip karega
                editingSapKey: null, // mapping me jis SAP input par focus hai — sirf uska datalist render hoga (perf)
                quickSelectedActivityKey: '',
                selectedColumnLocIdx: null,
                historyStack: [],
                historyIndex: -1,
                isPerformingHistoryAction: false,
                newMaterial: {
                    no: '',
                    desc: '',
                    unit: 'No',
                    rate: 0,
                    codeSearch: '',
                    sapCode: ''
                }
            };
        },

        computed: {
            totalMappedItemsCount() {
                let total = 0;
                if (this.activities) {
                    Object.values(this.activities).forEach(act => {
                        if (act.materials) total += act.materials.length;
                    });
                }
                return total;
            },
            filteredMappingMasterList() {
                let list = [];
                Object.keys(this.activities).forEach(actKey => {
                    if (this.mappingActivityFilter !== 'ALL' && this.mappingActivityFilter !== actKey) return;
                    const act = this.activities[actKey];
                    if (act && act.materials) {
                        act.materials.forEach(m => {
                            // Ensure sapItems array exists on each material (qty 0 ko 0 hi rehne do)
                            if (!m.sapItems) {
                                m.sapItems = m.itemCode ? [{
                                    code: m.itemCode,
                                    desc: m.sapDescription || '',
                                    uom: m.sapUom || m.unit,
                                    qty: 1,
                                    docHeader: m.docHeader || '0031006347'
                                }] : [];
                            } else {
                                m.sapItems.forEach(s => {
                                    if (s.qty === undefined || s.qty === null || s.qty === '') s.qty = 1;
                                    else { const n = Number(s.qty); s.qty = isNaN(n) ? 1 : n; }
                                });
                            }
                            list.push({
                                actKey: actKey,
                                actTitle: act.title,
                                item: m
                            });
                        });
                    }
                });
                if (!this.mappingSearchQuery) return list;
                const q = this.mappingSearchQuery.toLowerCase();
                return list.filter(r => {
                    const m = r.item;
                    const descMatch = m.desc && m.desc.toLowerCase().includes(q);
                    const actMatch = r.actKey && r.actKey.toLowerCase().includes(q);
                    const sapMatch = (m.sapItems || []).some(s =>
                        (s.code && s.code.toLowerCase().includes(q)) ||
                        (s.desc && s.desc.toLowerCase().includes(q)) ||
                        (s.docHeader && s.docHeader.toLowerCase().includes(q))
                    );
                    return descMatch || actMatch || sapMatch;
                });
            },
            pivotReconciliationData() {
                const sapMap = {}; // mapping by sap code
                const allActivityKeys = new Set();
                
                if (this.sapMaterialsMaster) {
                    this.sapMaterialsMaster.forEach(sap => {
                        sapMap[sap.code] = {
                            code: sap.code,
                            desc: sap.desc,
                            uom: sap.uom,
                            totalQty: 0,
                            activities: {}
                        };
                    });
                }

                Object.keys(this.activities).forEach(actKey => {
                    const act = this.activities[actKey];
                    if (act && act.materials) {
                        act.materials.forEach((m, mIdx) => {
                            let activitySheetQty = 0;
                            const qMatrix = this.activityQuantities[actKey] || [];
                            const numLocs = this.getActLocations(actKey).length;
                            for (let locIdx = 0; locIdx < numLocs; locIdx++) {
                                const val = (qMatrix[locIdx] && qMatrix[locIdx][mIdx] !== undefined && qMatrix[locIdx][mIdx] !== '')
                                    ? parseFloat(qMatrix[locIdx][mIdx])
                                    : 0;
                                activitySheetQty += val;
                            }

                            if (m.sapItems && m.sapItems.length > 0) {
                                m.sapItems.forEach(s => {
                                    if (!s.code) return;
                                    allActivityKeys.add(actKey);
                                    
                                    if (!sapMap[s.code]) {
                                        sapMap[s.code] = {
                                            code: s.code,
                                            desc: s.desc,
                                            uom: s.uom,
                                            totalQty: 0,
                                            activities: {}
                                        };
                                    }
                                    
                                    // Qty 0 ka matlab 0 hi hai (not-required), blank/NaN ka matlab 1
                                    let _mq = Number(s.qty);
                                    const mappingSheetQty = isNaN(_mq) ? 1 : _mq;
                                    // 🔩 Bolt: activity kg me, reconciliation nos me — wazan se convert (M12X150 → kg/pc)
                                    const _bw = this.nutBoltWeightForCode(s.code);
                                    const _conv = (_bw > 0 && this.nutBoltTargetUnitKg(m)) ? _bw : 0;
                                    const finalQty = _conv ? (activitySheetQty * mappingSheetQty / _conv) : (activitySheetQty * mappingSheetQty);
                                    
                                    sapMap[s.code].totalQty += finalQty;
                                    
                                    if (!sapMap[s.code].activities[actKey]) {
                                        sapMap[s.code].activities[actKey] = 0;
                                    }
                                    sapMap[s.code].activities[actKey] += finalQty;
                                });
                            }
                        });
                    }
                });
                
                const columns = Array.from(allActivityKeys).sort((a, b) => parseInt(a) - parseInt(b));
                const rows = Object.values(sapMap)
                    // Reverse entry ON ho to zero wali row bhi dikhao (pehli entry ke liye); OFF = purana behavior
                    .filter(row => this.reverseEntry ? true : row.totalQty > 0)
                    .sort((a, b) => a.code.localeCompare(b.code));
                
                return { columns, rows };
            },
            // ↩️ Invoice par jo activity add hain, wahi (actKey seedha ya desc se match)
            reverseInvoiceActKeys() {
                const out = [];
                const items = (this.invoiceData && this.invoiceData.items) || [];
                const actKeys = Object.keys(this.activities || {});
                items.forEach(it => {
                    if (it.actKey && this.activities[it.actKey] && out.indexOf(it.actKey) === -1) {
                        out.push(it.actKey);
                    } else if (it.desc) {
                        // Sakht match: "907: ..." ya "907 ..." se shuru ho tabhi (beech me number mile to nahi)
                        const k = actKeys.find(k => it.desc.startsWith(k + ':') || it.desc.startsWith(k + ' '));
                        if (k && out.indexOf(k) === -1) out.push(k);
                    }
                });
                return out;
            },
            // ↩️ Reverse columns: invoice wali activity × uski locations (907 me 2 location to 907 do baar)
            // 📍 Location scope ka samman — sirf wahi location jo is activity me dikhti hai
            reverseReconColumns() {
                if (!this.reverseEntry) return [];
                const out = [];
                this.reverseInvoiceActKeys.forEach(actKey => {
                    this.getActLocations(actKey).forEach((loc, locIdx) => {
                        out.push({ key: actKey + '__' + locIdx, actKey, locIdx });
                    });
                });
                return out;
            },
            reconColCount() {
                return this.reverseEntry ? this.reverseReconColumns.length : this.pivotReconciliationData.columns.length;
            },
            // Detail view: chuni activity me dikhne wali locations (global idx ke sath)
            visibleDetailLocs() {
                return this.getActLocations(this.selectedActivityKey).map((loc, idx) => ({ loc, idx }));
            },
            // ↩️ Reverse rows: invoice wali activity me jude (add kiye) material hi — poora master nahi
            reverseShownCodes() {
                const set = [];
                const self = this;
                this.reverseInvoiceActKeys.forEach(actKey => {
                    const act = self.activities[actKey];
                    if (act && act.materials) act.materials.forEach(m => {
                        if (m.sapItems) m.sapItems.forEach(s => {
                            if (s.code && set.indexOf(s.code) === -1) set.push(s.code);
                        });
                    });
                });
                return set;
            },
            reconRows() {
                if (!this.reverseEntry) return this.pivotReconciliationData.rows;
                const codes = this.reverseShownCodes;
                const cols = this.reverseReconColumns;
                // Sirf value wali row dikhao — zero wali chhupi (entry ➕ Item ▾ dropdown se)
                return this.pivotReconciliationData.rows.filter(r => {
                    if (codes.indexOf(r.code) === -1) return false;
                    let t = 0;
                    for (let i = 0; i < cols.length; i++) t += Number(this.reconCellLoc(r.code, cols[i])) || 0;
                    return t > 0;
                });
            },
            // ↩️ "➕ Item ▾" dropdown: reconciliation wale SAP material (code + desc), search ke sath
            reverseSapMenuList() {
                return this.pivotReconciliationData.rows
                    .map(r => ({ code: r.code, desc: r.desc, uom: r.uom, total: Math.round((Number(r.totalQty) || 0) * 100) / 100, acts: this.reverseActsForCode(r.code) }))
                    .sort((a, b) => String(a.code).localeCompare(String(b.code)));
            },
            // Dropdown se chuna SAP code: uski row, invoice activities, location
            reverseSelCodeDesc() {
                if (!this.reverseAddSelCode) return '';
                const r = this.pivotReconciliationData.rows.find(x => x.code === this.reverseAddSelCode);
                return r ? String(r.desc || '').substring(0, 50) : '';
            },
            reverseSelCodeActs() {
                if (!this.reverseAddSelCode) return [];
                // Extra mode: koi bhi invoice activity chun sakte ho (wahan Extra Item banega)
                if (this.reverseAddExtraMode) return this.reverseInvoiceActKeys.slice();
                return this.reverseActsForCode(this.reverseAddSelCode);
            },
            reverseSelCodeLocs() {
                if (!this.reverseAddAct) return [];
                const locs = this.getActLocations(this.reverseAddAct);
                return locs.length ? locs.map((_, i) => i) : [];
            },
            canUndo() {
                return this.historyIndex > 0;
            },
            canRedo() {
                return this.historyIndex < this.historyStack.length - 1;
            },
            currentActivity() {
                return this.activities[this.selectedActivityKey] || { title: 'Activity', materials: [] };
            },
            filteredMaterials() {
                if (!this.currentActivity || !this.currentActivity.materials) return [];
                return this.currentActivity.materials.map((m, idx) => ({ ...m, origIndex: idx }))
                    .filter(m => {
                        if (this.searchQuery) {
                            const q = this.searchQuery.toLowerCase();
                            return (m.desc && m.desc.toLowerCase().includes(q)) || String(m.no).toLowerCase().includes(q);
                        }
                        return true;
                    });
            },
            regularMaterials() {
                return this.filteredMaterials.filter(m => !m.isExtra);
            },
            extraMaterials() {
                return this.filteredMaterials.filter(m => m.isExtra);
            },
            activeTotals() {
                let amt100 = 0;
                if (this.currentActivity && this.currentActivity.materials) {
                    for (let i = 0; i < this.currentActivity.materials.length; i++) {
                        amt100 += this.calculateItemAmount(i, 1);
                    }
                }
                return {
                    amt100: amt100,
                    amtStage1: amt100 * (this.pctStage1 / 100),
                    amtStage2: amt100 * (this.pctStage2 / 100),
                    amtStage3: amt100 * (this.pctStage3 / 100)
                };
            },
            abstractTotals() {
                let amt100 = 0;
                this.masterAbstractList.forEach(item => {
                    amt100 += (Number(item.qty) || 0) * (Number(item.rate) || 0);
                });
                return {
                    amt100: amt100,
                    amtStage1: amt100 * (this.pctStage1 / 100),
                    amtStage2: amt100 * (this.pctStage2 / 100),
                    amtStage3: amt100 * (this.pctStage3 / 100)
                };
            },
            calculatedInvoiceBasic() {
                let sum = 0;
                this.invoiceData.items.forEach(it => {
                    sum += Number(it.amount) || 0;
                });
                return sum;
            },
            calculatedInvoiceCgst() {
                return this.calculatedInvoiceBasic * 0.09;
            },
            calculatedInvoiceSgst() {
                return this.calculatedInvoiceBasic * 0.09;
            },
            calculatedInvoiceIgst() {
                return this.calculatedInvoiceBasic * 0.18;
            },
            calculatedInvoiceGst() {
                if (this.invoiceData.gstType === 'NONE') return 0; // GSTIN nahi → GST zero
                if (this.invoiceData.gstType === 'CGST_SGST') {
                    return this.calculatedInvoiceCgst + this.calculatedInvoiceSgst;
                }
                return this.calculatedInvoiceIgst;
            },
            calculatedInvoiceGrandTotal() {
                return this.calculatedInvoiceBasic + this.calculatedInvoiceGst;
            },
            overallProgressPct() {
                const contractValue = Number(this.projectMeta.contractValue) || 0;
                const billed = this.calculatedInvoiceGrandTotal;
                return contractValue > 0 ? Math.min(100, Math.round((billed / contractValue) * 1000) / 10) : 0;
            },
            overallProgressOffset() {
                const circumference = 175.93;
                return circumference - (circumference * this.overallProgressPct / 100);
            },
            gstStatusBadge() {
                const contractorGstin = (this.invoiceData.contractorGstin || '').trim().toUpperCase();
                const clientGstin = (this.invoiceData.clientGstin || '').trim().toUpperCase();
                if (this.invoiceData.gstType === 'NONE' || !contractorGstin) {
                    return {
                        type: 'none',
                        text: `⚪ No GSTIN — GST 0% (sirf Basic Amount)`
                    };
                }
                const contractorState = contractorGstin.substring(0, 2) || '08';
                const clientState = clientGstin.substring(0, 2);

                if (this.invoiceData.gstType === 'IGST') {
                    if (contractorState && clientState && contractorState !== clientState) {
                        return {
                            type: 'igst',
                            text: `🔵 Inter-State (Contractor: State ${contractorState} ➔ Client: State ${clientState}) ➔ Auto IGST (18%) Applied`
                        };
                    }
                    return {
                        type: 'igst',
                        text: `🔵 Inter-State ➔ Auto IGST (18%) Applied`
                    };
                } else {
                    if (contractorState && clientState && contractorState === clientState) {
                        return {
                            type: 'cgst_sgst',
                            text: `🟢 Intra-State (Same State: ${clientState}) ➔ Auto CGST 9% + SGST 9% Applied`
                        };
                    }
                    return {
                        type: 'cgst_sgst',
                        text: `🟢 Intra-State (State 27 MH) ➔ Auto CGST 9% + SGST 9% Applied`
                    };
                }
            },
            filteredContractorsList() {
                if (!this.contractorSearchQuery) return this.contractorsList;
                const q = this.contractorSearchQuery.toLowerCase();
                return this.contractorsList.filter(f =>
                    (f.name && f.name.toLowerCase().includes(q)) ||
                    (f.pan && f.pan.toLowerCase().includes(q)) ||
                    (f.gstin && f.gstin.toLowerCase().includes(q)) ||
                    (f.divisionName && f.divisionName.toLowerCase().includes(q))
                );
            },
            sortedFilteredContractors() {
                let list = this.contractorsList;
                if (this.contractorDropdownSearch) {
                    const q = this.contractorDropdownSearch.toLowerCase();
                    list = list.filter(f =>
                        (f.name && f.name.toLowerCase().includes(q)) ||
                        (f.pan && f.pan.toLowerCase().includes(q)) ||
                        (f.gstin && f.gstin.toLowerCase().includes(q))
                    );
                }
                return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            },
            selectedContractorName() {
                if (this.selectedContractorId === 'custom') return '✏️ Custom';
                const firm = this.contractorsList.find(c => c.id === this.selectedContractorId);
                return firm ? firm.name : 'Select Contractor...';
            },
            nutBoltGrandTotal() {
                return this.nutBoltData.reduce((sum, item) => sum + (item.weight * (item.qty || 0)), 0).toFixed(3);
            },
            concreteGrandTotal() {
                const r = this.selectedAugerRadius;
                const poleTotal = this.concretePoleData.reduce((sum, item) => sum + (Math.PI * r * r * item.h * (item.poles || 0)), 0);
                const muffingTotal = this.concreteMuffingData.reduce((sum, item) => sum + (item.vol * (item.qty || 0)), 0);
                return (poleTotal + muffingTotal).toFixed(3);
            },
            selectedAugerRadius() {
                return parseFloat((this.selectedAugerSize * 0.0254 / 2).toFixed(4));
            },
            extraItemSuggestions() {
                if (!this.newMaterial.codeSearch || this.newMaterial.codeSearch.length < 1) return [];
                const q = this.newMaterial.codeSearch.toLowerCase();
                const act11 = this.activities['907'];
                if (!act11 || !act11.materials) return [];
                return act11.materials.filter(m =>
                    (m.desc && m.desc.toLowerCase().includes(q))
                ).slice(0, 10);
            }
        },

        watch: {
            activityQuantities: {
                handler() { this.debouncedSave(); },
                deep: true
            },
            activities: {
                handler() { this.debouncedSave(); },
                deep: true
            },
            masterAbstractList: {
                handler() { this.debouncedSave(); },
                deep: true
            },
            locations: {
                handler() { this.debouncedSave(); },
                deep: true
            },
            invoiceData: {
                handler() { this.debouncedSave(); },
                deep: true
            },
            projectMeta: {
                handler() { this.debouncedSave(); },
                deep: true
            },
            'invoiceData.clientGstin'(newVal) {
                this.checkAndApplyAutoGstRule();
            },
            'invoiceData.contractorGstin'(newVal) {
                this.checkAndApplyAutoGstRule();
            },
            pctStage1() { this.debouncedSave(); },
            pctStage2() { this.debouncedSave(); },
            pctStage3() { this.debouncedSave(); },
            isFinalized() { this.saveToStorage(); }
        },

        methods: allMethods,

        async mounted() {
            this._isLoading = true;
            await this.loadFromStorage();
            // Tab close/reload/switch par pending cloud sync flush — warna dusre PC par mapping nahi dikhega
            window.addEventListener('pagehide', () => { try { this.saveToStorage(); } catch(e) {} try { this.flushPendingSync(); } catch(e) {} });
            window.addEventListener('beforeunload', () => { try { this.saveToStorage(); } catch(e) {} try { this.flushPendingSync(); } catch(e) {} });
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    try { this.saveToStorage(); } catch(e) {}
                    try { this.flushPendingSync(); } catch(e) {}
                }
            });
            
            // PATCH FOR 907 & 934A MAPPINGS — sirf MISSING cheez bharo.
            // User ka saved rate/sapItems/qty kabhi overwrite mat karo (pehle replace tha — wahi reset bug tha).
            if (!localStorage.getItem('patch_907_934a_merge_v3')) {
                let patched = false;
                ['907', '934A'].forEach(code => {
                    const def = defaultActivities[code];
                    if (!def) return;
                    if (!this.activities[code]) {
                        this.activities[code] = JSON.parse(JSON.stringify(def));
                        patched = true;
                    } else {
                        if (!this.activities[code].materials) this.activities[code].materials = [];
                        if (!this.activities[code].title && def.title) { this.activities[code].title = def.title; patched = true; }
                        (def.materials || []).forEach((defMat, mIdx) => {
                            const cur = this.activities[code].materials[mIdx];
                            if (!cur) {
                                this.activities[code].materials[mIdx] = JSON.parse(JSON.stringify(defMat));
                                patched = true;
                            } else {
                                // Khali field bharo — bhari hui value ko haath mat lagao
                                if (!cur.itemCode && defMat.itemCode) { cur.itemCode = defMat.itemCode; patched = true; }
                                if (!cur.sapDescription && defMat.sapDescription) { cur.sapDescription = defMat.sapDescription; patched = true; }
                                if (!cur.sapUom && defMat.sapUom) { cur.sapUom = defMat.sapUom; patched = true; }
                                if (!cur.docHeader && defMat.docHeader) { cur.docHeader = defMat.docHeader; patched = true; }
                                if (!cur.sapItems && defMat.sapItems) { cur.sapItems = JSON.parse(JSON.stringify(defMat.sapItems)); patched = true; }
                            }
                        });
                    }
                });
                if (patched) { this._isLoading = false; this.saveToStorage(); }
                localStorage.setItem('patch_907_934a_merge_v3', 'true');
            }

            // PATCH: galat/orphan SAP mappings — ek baar, saved bill par bhi.
            // 17 codes ka sahi remap; master list me na milne wala code blank (galat code dikhega hi nahi).
            // Sirf tab chalega jab master poori load hui ho (200+ entries) — adhoori master par kuch nahi bigdega.
            if (!localStorage.getItem('patch_orphan_remap_v4')) {
                try {
                    const masterSet = {};
                    const masterDesc = {};
                    (this.sapMaterialsMaster || []).forEach(s => { if (s && s.code) { masterSet[s.code] = true; masterDesc[s.code] = s.desc || ''; } });
                    if (Object.keys(masterSet).length >= 200) {
                        const REMAP = {
                            '17000006': { code: '17001243', desc: 'RSJ POLE 100X116 MM 11 MTR' },
                            '17000005': { code: '17001242', desc: 'RSJ POLE 100X116 MM 10 MTR' },
                            '17000003': { code: '17005037', desc: 'RSJ POLE 100X116 MM 8 MTR' },
                            '17000236': { code: '17000243', desc: 'GI WIRE 8 SWG' },
                            '17000777': { code: '17000776', desc: 'PAINT BLACK BITUMINUS' },
                            '17001296': { code: '17005041', desc: 'MS-11KV TOP CLEAT-75X40X6X325-2.44KG' },
                            '17000045': { code: '17000046', desc: 'DISC INSULATOR 11KV 70KN B & S POLYMER' },
                            '17001251': { code: '17000026', desc: 'HORN GAP FUSE 11 KV' },
                            '17004590': { code: '17002274', desc: 'COPPER FLEXIBLE WIRE 2.5 SQMM' },
                            '17004591': { code: '17002274', desc: 'COPPER FLEXIBLE WIRE 2.5 SQMM' },
                            '17000216': { code: '17000120', desc: 'ACSR WEASEL CONDUCTOR' },
                            '17001398': { code: '17000056', desc: 'LT SHACKLE INSULATOR' },
                            '17001399': { code: '17000058', desc: 'LT STAY INSULATOR' },
                            '17001400': { code: '17001150', desc: 'ALUMINIUM BOBBINS' },
                            '17000650': { code: '17000700', desc: 'PG CLAMP FOR ACSR WEASEL CONDUCTOR' },
                            '23001573': { code: '17004372', desc: 'JOINTING SLEEVE AAAC RABBIT CONDUCTOR' },
                            '28000103': { code: '17005597', desc: 'COVERED CONDUCTOR 55 SQMM' }
                        };
                        // Desc-scoped rules — ye codes master me HAIN lekin galat row par lage the.
                        // scope: entry/row desc me ye text ho tabhi lagoo (sahi jagah lage codes ko haath nahi).
                        const SCOPED = [
                            { code: '17001295', has: 'V CROSS ARM', to: '17005050', toDesc: 'MS-11KV V-CROSS ARM-75X40X6X1614-11.99KG' },
                            { code: '17000700', has: 'SHACKLE', to: '17000696', toDesc: 'LT SHACKLE HARDWARE' },
                            { code: '17005051', has: 'STAY SET', to: '17005091', toDesc: 'MS-LT STAY SET 16 MM' },
                            { code: '17000776', has: 'RED OXIDE', to: '17000778', toDesc: 'RED OXIDE' },
                            { code: '17005101', has: 'CURRENT TRANSFORMER', blank: true }
                        ];
                        function scopedRule(code, desc) {
                            for (let i = 0; i < SCOPED.length; i++) {
                                const r = SCOPED[i];
                                if (r.code === code && desc && desc.toUpperCase().indexOf(r.has) !== -1) return r;
                            }
                            return null;
                        }
                        let remapped = 0, blanked = 0;
                        Object.keys(this.activities || {}).forEach(actKey => {
                            const act = this.activities[actKey];
                            (act.materials || []).forEach(m => {
                                const mIsCutPoint = (m.desc || '').indexOf('Cut Point') !== -1;
                                // row-level itemCode
                                if (m.itemCode) {
                                    if (mIsCutPoint && m.itemCode === '17001294') {
                                        m.itemCode = '17005042';
                                        m.sapDescription = 'MS-11KV CUT POINT CH-75X40X6X1310-9.35KG';
                                        remapped++;
                                    } else {
                                        const sr = scopedRule(m.itemCode, m.sapDescription);
                                        if (sr) {
                                            if (sr.blank) { m.itemCode = ''; m.sapDescription = ''; m.sapUom = ''; m.docHeader = ''; blanked++; }
                                            else { m.itemCode = sr.to; m.sapDescription = sr.toDesc; remapped++; }
                                        } else if (REMAP[m.itemCode]) {
                                            m.itemCode = REMAP[m.itemCode].code;
                                            m.sapDescription = REMAP[m.itemCode].desc;
                                            remapped++;
                                        } else if (!masterSet[m.itemCode]) {
                                            m.itemCode = ''; m.sapDescription = ''; m.sapUom = ''; m.docHeader = '';
                                            blanked++;
                                        } else if (masterDesc[m.itemCode] && m.sapDescription !== masterDesc[m.itemCode]) {
                                            m.sapDescription = masterDesc[m.itemCode];
                                            remapped++;
                                        }
                                    }
                                }
                                if (Array.isArray(m.sapItems)) {
                                    for (let i = m.sapItems.length - 1; i >= 0; i--) {
                                        const s = m.sapItems[i];
                                        if (!s || !s.code) continue;
                                        const sr = scopedRule(s.code, s.desc);
                                        if (sr) {
                                            if (sr.blank) { m.sapItems.splice(i, 1); blanked++; }
                                            else { s.code = sr.to; s.desc = sr.toDesc; remapped++; }
                                        } else if (REMAP[s.code]) {
                                            s.code = REMAP[s.code].code;
                                            s.desc = REMAP[s.code].desc;
                                            remapped++;
                                        } else if (!masterSet[s.code]) {
                                            m.sapItems.splice(i, 1);
                                            blanked++;
                                        } else if (masterDesc[s.code] && s.desc !== masterDesc[s.code]) {
                                            s.desc = masterDesc[s.code];
                                            remapped++;
                                        }
                                    }
                                }
                            });
                        });
                        if (remapped > 0 || blanked > 0) {
                            this._isLoading = false;
                            this.saveToStorage();
                            const msg = 'Mapping safai: ' + remapped + ' sahi, ' + blanked + ' blank (khud check karo)';
                            setTimeout(() => { try { this.showToast(msg, '🧹'); } catch(e) {} }, 1200);
                        }
                    }
                } catch(e) { console.error('orphan remap patch failed', e); }
                try { localStorage.setItem('patch_orphan_remap_v4', 'true'); } catch(e) {}
            }

            this._isLoading = false;
            // Initial history snapshot
            this.takeSnapshot();

            // Periodic heartbeat sync — agar koi change pending hai toh push ho jaye
            this._heartbeatTimer = setInterval(() => {
                if (this._isLoading || this.cloudConflict) return;
                if (this.syncStatus === 'syncing') return;
                try {
                    const payload = this.buildSyncPayload();
                    const json = JSON.stringify(payload);
                    if (json.length > 800 * 1024) return;
                    let h = 0;
                    for (let i = 0; i < json.length; i += 97) { h = ((h * 31) + json.charCodeAt(i)) >>> 0; }
                    const hash = json.length + ':' + h;
                    if (hash !== this.lastSentHash) {
                        console.info('Heartbeat: unsynced change detected, triggering sync');
                        this.syncToMongoNow();
                    }
                } catch(e) {}
            }, 15000);

            // Prevent mouse scroll wheel from changing numbers in active input while keeping scrolling buttery smooth
            window.addEventListener('wheel', function (e) {
                if (document.activeElement && document.activeElement.type === 'number' && e.target === document.activeElement) {
                    document.activeElement.blur();
                }
            }, { passive: true });

            // Keyboard Shortcuts for Undo (Ctrl+Z) and Redo (Ctrl+Y / Ctrl+Shift+Z)
            window.addEventListener('keydown', (e) => {
                const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
                const isCmd = isMac ? e.metaKey : e.ctrlKey;
                if (isCmd && !e.altKey) {
                    const key = e.key.toLowerCase();
                    if (key === 'z' && !e.shiftKey) {
                        e.preventDefault();
                        if (document.activeElement && typeof document.activeElement.blur === 'function') {
                            document.activeElement.blur();
                        }
                        this.undo();
                    } else if ((key === 'y' && !e.shiftKey) || (key === 'z' && e.shiftKey)) {
                        e.preventDefault();
                        if (document.activeElement && typeof document.activeElement.blur === 'function') {
                            document.activeElement.blur();
                        }
                        this.redo();
                    }
                }
            });
        }
    });

    // Custom directive: click-outside
    app.directive('click-outside', {
        mounted(el, binding) {
            el._clickOutsideHandler = (event) => {
                if (!(el === event.target || el.contains(event.target))) {
                    binding.value(event);
                }
            };
            document.addEventListener('click', el._clickOutsideHandler);
        },
        unmounted(el) {
            document.removeEventListener('click', el._clickOutsideHandler);
        }
    });

    // Mount the app
    app.mount('#app');
})();
