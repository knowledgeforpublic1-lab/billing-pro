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
        window.ExportModule || {},
        window.StockImporterModule || {},
        window.OldRecoImporterModule || {}
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
                // 📚 SAP Material Master editor (cloud copy)
                showSapMasterModal: false,
                sapMasterSearch: '',
                showSapItemManagerModal: false,
                activeSapManagerItem: null,
                activeSapManagerOrigIndex: -1,
                sapManagerSearchQuery: '',
                sapManagerSuggestions: [],
                mappingRoundMode: (function() { try { return localStorage.getItem('lk_billing_mapping_round_mode') || 'none'; } catch(e) { return 'none'; } })(),
                // 🔒 Mapping locks — edit ke liye unlock karna hoga (sap mapping default unlocked hai taaki mapping asani se ho sake)
                mappingLocks: (function() {
                    try {
                        const s = JSON.parse(localStorage.getItem('lk_billing_mapping_locks_v1') || 'null');
                        if (s && typeof s === 'object') return { rate: s.rate !== false, sap: s.sap === true, qty: s.qty !== false };
                    } catch(e) {}
                    return { rate: true, sap: false, qty: true };
                })(),
                reconFilterZeroOnly: false,
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
                reconContractorDropdownOpen: false,
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
                stockUploading: false,
                hasCustomStock: false,
                customStockMeta: null,
                oldRecoUploading: false,
                showOldRecoModal: false,
                oldRecoModalSearch: '',
                hasCustomOldReco: false,
                customOldRecoEdits: {},
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
                },
                showExtraItemSuggest: false,
                showGDriveModal: false,
                showScriptCodeBox: false,
                gdriveWebhookUrl: (function() {
                    try {
                        const local = localStorage.getItem('billing_gdrive_webhook_url');
                        if (local && local.includes('/exec')) return local;
                    } catch(e) {}
                    return 'https://script.google.com/macros/s/AKfycbw495PuqtHzuCATbRHI3dgofeWKaMVyYrUhc0twCdf0EbaPwSlpA81i0ExHdny6MZQ/exec';
                })(),
                activeBillId: (function() { try { return localStorage.getItem('lk_billing_active_bill_id') || 'main-billing-state'; } catch(e) { return 'main-billing-state'; } })(),
                savedBillsList: [],
                isLoadingBills: false,
                showSavedBillsModal: false,
                savedBillsModalTab: 'drive', // 'drive' | 'database' (Defaults to Google Drive!)
                gdriveFilesList: [],
                isLoadingDriveFiles: false,
                gdriveFilesError: '',
                gdriveRootFolderUrl: '',
                isParsingBillFile: false,
                openingDriveFileId: null,
                savedBillsSearchQuery: '',
                showNewBillModal: false,
                newBillForm: {
                    billNo: '',
                    billDate: '',
                    projectName: '',
                    selectedContractorId: 'ranjeet_singh_lodhi',
                    selectedCompanyId: 'ashoka_buildcon',
                    mode: 'copy_master'
                }
            };
        },

        computed: {
            appsScriptRawCode() { return window.APPS_SCRIPT_SOURCE_CODE || ""; },
            hasDriveConnected() {
                const raw = (this.gdriveWebhookUrl || '').trim()
                    || localStorage.getItem('billing_gdrive_webhook_url')
                    || (this.projectMeta && this.projectMeta.gdriveWebhookUrl)
                    || '';
                const u = raw.replace(/^["']|["']$/g, '');
                return !!(u && (u.startsWith('https://script.google.com/') || u.startsWith('script.google.com/')) && u.includes('/exec'));
            },
            effectiveBillNo() {
                return (this.invoiceData && this.invoiceData.invoiceNo) || (this.projectMeta && this.projectMeta.billNo) || '';
            },
            effectiveRaNo() {
                if (this.projectMeta && this.projectMeta.raNo) {
                    return String(this.projectMeta.raNo).trim();
                }
                const b = (this.invoiceData && this.invoiceData.invoiceNo) || (this.projectMeta && this.projectMeta.billNo) || '';
                const m = b.match(/(?:RA|BILL)[\s\/\-_]*(\d+[A-Za-z0-9\-_]*)/i);
                if (m && m[1]) return m[1];
                if (/^\d+$/.test(b.trim())) return b.trim();
                return '';
            },
            filteredSavedBills() {
                const list = this.savedBillsList || [];
                const q = (this.savedBillsSearchQuery || '').trim().toLowerCase();
                if (!q) return list;
                return list.filter(b => {
                    const no = String(b.billNo || '').toLowerCase();
                    const c = String(b.contractorName || '').toLowerCase();
                    const p = String(b.projectName || '').toLowerCase();
                    const d = String(b.billDate || '').toLowerCase();
                    return no.includes(q) || c.includes(q) || p.includes(q) || d.includes(q);
                });
            },
            filteredGdriveFiles() {
                const list = this.gdriveFilesList || [];
                const q = (this.savedBillsSearchQuery || '').trim().toLowerCase();
                if (!q) return list;
                return list.filter(f => {
                    const n = String(f.name || '').toLowerCase();
                    const c = String(f.contractor || '').toLowerCase();
                    return n.includes(q) || c.includes(q);
                });
            },
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
                            // Ensure sapItems array exists on each material (hamesha kam se kam 1 item render ho taaki mapping input dikhe)
                            if (!m.sapItems || m.sapItems.length === 0) {
                                m.sapItems = [{
                                    code: m.itemCode || '',
                                    desc: m.sapDescription || '',
                                    uom: m.sapUom || m.unit || 'No',
                                    qty: 1,
                                    docHeader: m.docHeader || '0031006347'
                                }];
                            } else {
                                m.sapItems.forEach(s => {
                                    if (s.isManual) {
                                        if (s.manualQty === undefined || s.manualQty === null || s.manualQty === '') {
                                            s.manualQty = (s.qty !== undefined && s.qty !== null && s.qty !== '') ? s.qty : 1;
                                        } else {
                                            const evalVal = (typeof this.evalFormula === 'function') ? this.evalFormula(s.manualQty) : s.manualQty;
                                            const n = Number(evalVal);
                                            s.manualQty = isNaN(n) ? 0 : n;
                                        }
                                    } else {
                                        if (s.qty === undefined || s.qty === null || s.qty === '') s.qty = 1;
                                        else {
                                            const evalVal = (typeof this.evalFormula === 'function') ? this.evalFormula(s.qty) : s.qty;
                                            const n = Number(evalVal);
                                            s.qty = isNaN(n) ? 1 : n;
                                        }
                                    }
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
            // 📚 SAP Master editor ka filtered list — same object references (edit direct master par)
            filteredSapMasterList() {
                const list = Array.isArray(this.sapMaterialsMaster) ? this.sapMaterialsMaster : [];
                const q = String(this.sapMasterSearch || '').trim().toLowerCase();
                if (!q) return list;
                return list.filter(s =>
                    (s.code && String(s.code).toLowerCase().includes(q)) ||
                    (s.desc && String(s.desc).toLowerCase().includes(q)) ||
                    (s.uom && String(s.uom).toLowerCase().includes(q))
                );
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
                            sapIssuedQty: 0,
                            sapGrossIssue: 0,
                            sapMrnReturn: 0,
                            sapNetIssue: 0,
                            activities: {}
                        };
                    });
                }

                // ⚡ Auto-sync SAP Stock Issues for active contractor / work order
                const contractorSap = typeof this.getContractorSapIssues === 'function' ? this.getContractorSapIssues() : null;
                const sapIssuesMap = (contractorSap && contractorSap.materials) || {};

                // Pre-populate / inject all issued materials from SAP stock for this contractor
                Object.keys(sapIssuesMap).forEach(matCode => {
                    const sItem = sapIssuesMap[matCode];
                    const numQty = Number(sItem.issuedQty || sItem.netIssue || 0);
                    const grossQty = Number(sItem.grossIssue !== undefined ? sItem.grossIssue : numQty);
                    const mrnQty = Number(sItem.mrnReturn !== undefined ? sItem.mrnReturn : 0);
                    const netQty = Number(sItem.netIssue !== undefined ? sItem.netIssue : numQty);
                    if (!sapMap[matCode]) {
                        sapMap[matCode] = {
                            code: matCode,
                            desc: sItem.desc || matCode,
                            uom: sItem.uom || 'No',
                            totalQty: 0,
                            sapIssuedQty: numQty,
                            sapGrossIssue: grossQty,
                            sapMrnReturn: mrnQty,
                            sapNetIssue: netQty,
                            activities: {}
                        };
                    } else {
                        sapMap[matCode].sapIssuedQty = numQty;
                        sapMap[matCode].sapGrossIssue = grossQty;
                        sapMap[matCode].sapMrnReturn = mrnQty;
                        sapMap[matCode].sapNetIssue = netQty;
                    }
                });

                // 📋 Auto-sync Contractor Old Reconciliation (Purana Reco baseline / custom upload)
                const contractorOldReco = typeof this.getContractorOldReco === 'function' ? this.getContractorOldReco() : null;
                const oldRecoMats = (contractorOldReco && contractorOldReco.materials) || {};

                Object.keys(oldRecoMats).forEach(matCode => {
                    const oItem = oldRecoMats[matCode];
                    const oNet = Number(oItem.netIssue !== undefined ? oItem.netIssue : (oItem.issuedQty || 0));
                    const oGross = Number(oItem.grossIssue !== undefined ? oItem.grossIssue : oNet);
                    const oMrn = Number(oItem.mrnReturn !== undefined ? oItem.mrnReturn : 0);

                    if (!sapMap[matCode]) {
                        sapMap[matCode] = {
                            code: matCode,
                            desc: oItem.desc || oItem.description || matCode,
                            uom: oItem.uom || oItem.unit || 'No',
                            totalQty: 0,
                            sapIssuedQty: oNet,
                            sapGrossIssue: oGross,
                            sapMrnReturn: oMrn,
                            sapNetIssue: oNet,
                            activities: {}
                        };
                    } else {
                        // If sapMap has 0 net issue (e.g. not in active SAP dump), populate baseline net issue from purana reco
                        if ((!sapMap[matCode].sapNetIssue || sapMap[matCode].sapNetIssue === 0) && oNet > 0) {
                            sapMap[matCode].sapNetIssue = oNet;
                            sapMap[matCode].sapGrossIssue = oGross;
                            sapMap[matCode].sapMrnReturn = oMrn;
                            sapMap[matCode].sapIssuedQty = oNet;
                        }
                    }
                });

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

                            // ✏️ Ensure SAP mapping exists for extra items or any unmapped items
                            if (!m.sapItems || m.sapItems.length === 0 || !m.sapItems[0].code) {
                                if (typeof this.ensureMaterialSap === 'function') {
                                    this.ensureMaterialSap(m, mIdx);
                                }
                            }

                            if (m.sapItems && m.sapItems.length > 0) {
                                m.sapItems.forEach(s => {
                                    if (!s.code) return;
                                    allActivityKeys.add(actKey);
                                    
                                    if (!sapMap[s.code]) {
                                        const sStockItem = sapIssuesMap[s.code] || {};
                                        const numQty = Number(sStockItem.issuedQty || sStockItem.netIssue || 0);
                                        sapMap[s.code] = {
                                            code: s.code,
                                            desc: s.desc || m.sapDescription || m.desc || s.code,
                                            uom: s.uom || m.sapUom || m.unit || 'No',
                                            totalQty: 0,
                                            sapIssuedQty: numQty,
                                            sapGrossIssue: Number(sStockItem.grossIssue !== undefined ? sStockItem.grossIssue : numQty),
                                            sapMrnReturn: Number(sStockItem.mrnReturn || 0),
                                            sapNetIssue: Number(sStockItem.netIssue !== undefined ? sStockItem.netIssue : numQty),
                                            activities: {}
                                        };
                                    }
                                    
                                    let finalQty = 0;
                                    if (s.isManual) {
                                        const mRaw = (s.manualQty !== undefined && s.manualQty !== null && s.manualQty !== '') ? s.manualQty : s.qty;
                                        const evalVal = (typeof this.evalFormula === 'function') ? this.evalFormula(mRaw) : mRaw;
                                        const mq = Number(evalVal);
                                        finalQty = isNaN(mq) ? 0 : mq;
                                    } else {
                                        const evalVal = (typeof this.evalFormula === 'function') ? this.evalFormula(s.qty) : s.qty;
                                        let _mq = Number(evalVal);
                                        const mappingSheetQty = isNaN(_mq) ? 1 : _mq;
                                        const _bw = this.nutBoltWeightForCode(s.code);
                                        const _conv = (_bw > 0 && this.nutBoltTargetUnitKg(m)) ? _bw : 0;
                                        finalQty = _conv ? (activitySheetQty * mappingSheetQty / _conv) : (activitySheetQty * mappingSheetQty);
                                    }
                                    const itemRoundMode = (s.roundMode && s.roundMode !== 'default') ? s.roundMode : (this.mappingRoundMode || 'none');
                                    if (itemRoundMode && itemRoundMode !== 'none' && typeof this.applyRoundValue === 'function') {
                                        finalQty = this.applyRoundValue(finalQty, itemRoundMode);
                                    }
                                    
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
                    .filter(row => Object.keys(row.activities).length > 0 || (row.sapIssuedQty && row.sapIssuedQty !== 0) || (row.sapGrossIssue && row.sapGrossIssue !== 0))
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
                        // Sakht match: "Activity 907 : ...", "907: ..." ya "907 ..." se shuru ho tabhi
                        const k = actKeys.find(k => it.desc.startsWith('Activity ' + k) || it.desc.startsWith(k + ':') || it.desc.startsWith(k + ' '));
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
                    if (act && act.materials) act.materials.forEach((m, mIdx) => {
                        if (!m.sapItems || !m.sapItems.length) {
                            if (typeof self.ensureMaterialSap === 'function') self.ensureMaterialSap(m, mIdx);
                        }
                        if (m.sapItems) m.sapItems.forEach(s => {
                            if (s.code && set.indexOf(s.code) === -1) set.push(s.code);
                        });
                    });
                });
                const sapStock = this.currentContractorSap;
                if (sapStock && sapStock.materials) {
                    Object.keys(sapStock.materials).forEach(code => {
                        if (set.indexOf(code) === -1) set.push(code);
                    });
                }
                return set;
            },
            
            currentContractorSap() {
                return (typeof this.getContractorSapIssues === 'function') ? this.getContractorSapIssues() : null;
            },
            currentContractorSapInfo() {
                const s = this.currentContractorSap;
                if (!s) return '';
                if (s.docHeader) return (s.contractorName || 'Contractor') + ' (WO: ' + s.docHeader + ')';
                if (s.contractorName) return s.contractorName;
                return 'SAP Stock Synced';
            },
            currentContractorSapCount() {
                const s = this.currentContractorSap;
                return s && s.materials ? Object.keys(s.materials).length : 0;
            },

            currentContractorOldReco() {
                return (typeof this.getContractorOldReco === 'function') ? this.getContractorOldReco() : null;
            },
            currentContractorOldRecoInfo() {
                const r = this.currentContractorOldReco;
                if (!r) return '';
                return r.contractorName || 'Old Reco Synced';
            },
            currentContractorOldRecoCount() {
                const r = this.currentContractorOldReco;
                return r && r.materials ? Object.keys(r.materials).length : 0;
            },
            currentContractorOldRecoConsumedCount() {
                const r = this.currentContractorOldReco;
                if (!r || !r.materials) return 0;
                return Object.values(r.materials).filter(m => (Number(m.prevConsumption) || 0) > 0).length;
            },
            filteredOldRecoModalItems() {
                const rows = this.reconRows || [];
                const q = (this.oldRecoModalSearch || '').trim().toLowerCase();
                let list = [];
                if (rows.length > 0) {
                    list = rows.map(r => ({
                        code: r.code,
                        desc: r.desc,
                        uom: r.uom,
                        netIssue: r.sapNetIssue !== undefined ? r.sapNetIssue : (r.sapIssuedQty || 0)
                    }));
                } else {
                    const oldR = this.currentContractorOldReco;
                    if (oldR && oldR.materials) {
                        list = Object.values(oldR.materials).map(m => ({
                            code: m.code,
                            desc: m.desc,
                            uom: m.uom,
                            netIssue: m.netIssue || 0
                        }));
                    }
                }
                if (!q) return list;
                return list.filter(it => 
                    (it.code && it.code.toLowerCase().includes(q)) || 
                    (it.desc && it.desc.toLowerCase().includes(q))
                );
            },

            // 🏷️ Set of all mapped SAP codes across all activities
            allMappedSapCodesSet() {
                const set = new Set();
                if (!this.activities) return set;
                Object.values(this.activities).forEach(act => {
                    if (act && Array.isArray(act.materials)) {
                        act.materials.forEach(m => {
                            if (Array.isArray(m.sapItems)) {
                                m.sapItems.forEach(s => {
                                    const c = String((s && s.code) || '').trim();
                                    if (c && c !== 'N/A' && c !== 'NA') set.add(c);
                                });
                            }
                        });
                    }
                });
                return set;
            },

            // 📋 Flat list of all activity materials for quick searching & fuzzy mismatch detection
            allActivityMaterialsFlat() {
                const list = [];
                if (!this.activities) return list;
                const stopWords = new Set(['and', 'with', 'for', 'the', 'nos', 'mtr', 'mtrs', 'set', 'sets', 'type', 'grade', 'long', 'size', 'allied', 'material', 'activity', 'sqmm', 'mm', 'sq']);
                Object.entries(this.activities).forEach(([actKey, act]) => {
                    if (act && Array.isArray(act.materials)) {
                        act.materials.forEach((m, mIdx) => {
                            const codes = [];
                            if (Array.isArray(m.sapItems)) {
                                m.sapItems.forEach(s => {
                                    const c = String((s && s.code) || '').trim();
                                    if (c && c !== 'N/A' && c !== 'NA') codes.push(c);
                                });
                            }
                            const words = String(m.desc || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));
                            list.push({
                                actKey,
                                actTitle: act.title || '',
                                matIdx: mIdx,
                                matNo: m.no,
                                desc: m.desc || '',
                                unit: m.unit || '',
                                mappedCodes: codes,
                                words: words
                            });
                        });
                    }
                });
                return list;
            },

            // 🚨 List of all materials issued in SAP stock for the selected contractor that are UNMAPPED or MISMATCHED
            unmappedContractorIssuedItems() {
                const contractorSap = this.currentContractorSap;
                if (!contractorSap || !contractorSap.materials) return [];
                const mappedSet = this.allMappedSapCodesSet;
                const allMats = this.allActivityMaterialsFlat;
                const stopWords = new Set(['and', 'with', 'for', 'the', 'nos', 'mtr', 'mtrs', 'set', 'sets', 'type', 'grade', 'long', 'size', 'allied', 'material', 'activity', 'sqmm', 'mm', 'sq']);
                const unmapped = [];

                Object.entries(contractorSap.materials).forEach(([code, item]) => {
                    const gross = Number(item.grossIssue !== undefined ? item.grossIssue : (item.issuedQty || 0));
                    const net = Number(item.netIssue !== undefined ? item.netIssue : (item.issuedQty || 0));
                    const isIssued = gross > 0 || net !== 0;

                    if (!isIssued) return;
                    if (mappedSet.has(code)) return;

                    const itemWords = String(item.desc || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));
                    let potentialMatch = null;
                    let bestScore = 0;

                    allMats.forEach(m => {
                        let common = 0;
                        itemWords.forEach(w => {
                            if (m.words.includes(w)) common++;
                        });
                        if (common >= 2 && common > bestScore) {
                            bestScore = common;
                            potentialMatch = {
                                actKey: m.actKey,
                                actTitle: m.actTitle,
                                matNo: m.matNo,
                                matIdx: m.matIdx,
                                desc: m.desc,
                                currentCodes: m.mappedCodes.join(', ')
                            };
                        }
                    });

                    const searchWords = itemWords.filter(w => w.length >= 4).slice(0, 2);
                    const searchKey = searchWords.join(' ') || item.desc || code;

                    unmapped.push({
                        code: code,
                        desc: item.desc || code,
                        uom: item.uom || 'No',
                        grossIssue: gross,
                        mrnReturn: Number(item.mrnReturn || 0),
                        netIssue: net,
                        potentialMatch: potentialMatch,
                        searchKey: searchKey
                    });
                });

                return unmapped.sort((a, b) => Math.abs(b.netIssue) - Math.abs(a.netIssue));
            },
            
            reconTotals() {
                const rows = this.reconRows || [];
                let grossIssue = 0;
                let mrnReturn = 0;
                let netIssue = 0;
                let prevReconTotal = 0;
                let thisBillTotal = 0;
                let cumulativeReconTotal = 0;
                let balanceTotal = 0;
                const actTotals = {};
                (this.pivotReconciliationData.columns || []).forEach(col => { actTotals[col] = 0; });
                const revTotals = {};
                if (this.reverseEntry && this.reverseReconColumns) {
                    this.reverseReconColumns.forEach(rc => { revTotals[rc.key] = 0; });
                }

                rows.forEach(r => {
                    const gross = Number(r.sapGrossIssue !== undefined ? r.sapGrossIssue : (r.sapIssuedQty > 0 ? r.sapIssuedQty : 0));
                    const mrn = Number(r.sapMrnReturn || 0);
                    const net = Number(r.sapNetIssue !== undefined ? r.sapNetIssue : (r.sapIssuedQty || 0));
                    const prevR = (typeof this.getPrevReconQty === 'function') ? this.getPrevReconQty(r.code) : 0;
                    const thisB = Number(r.totalQty) || 0;
                    const cum = (typeof this.getCumulativeReconQty === 'function') ? this.getCumulativeReconQty(r) : (prevR + thisB);
                    const bal = (typeof this.getReconBalanceQty === 'function') ? this.getReconBalanceQty(r) : (net - cum);

                    grossIssue += gross;
                    mrnReturn += mrn;
                    netIssue += net;
                    prevReconTotal += prevR;
                    thisBillTotal += thisB;
                    cumulativeReconTotal += cum;
                    balanceTotal += bal;

                    if (r.activities) {
                        Object.keys(r.activities).forEach(k => {
                            actTotals[k] = (actTotals[k] || 0) + (Number(r.activities[k]) || 0);
                        });
                    }
                    if (this.reverseEntry && this.reverseReconColumns) {
                        this.reverseReconColumns.forEach(rc => {
                            const val = Number(this.reconCellLoc(r.code, rc)) || 0;
                            revTotals[rc.key] = (revTotals[rc.key] || 0) + val;
                        });
                    }
                });

                return {
                    grossIssue: Math.round(grossIssue * 1000) / 1000,
                    mrnReturn: Math.round(mrnReturn * 1000) / 1000,
                    netIssue: Math.round(netIssue * 1000) / 1000,
                    prevRecon: Math.round(prevReconTotal * 1000) / 1000,
                    thisBill: Math.round(thisBillTotal * 1000) / 1000,
                    cumulativeRecon: Math.round(cumulativeReconTotal * 1000) / 1000,
                    balance: Math.round(balanceTotal * 1000) / 1000,
                    activities: actTotals,
                    reverseTotals: revTotals
                };
            },
            reconRows() {
                if (!this.reverseEntry) {
                    if (this.reconFilterZeroOnly) {
                        return this.pivotReconciliationData.rows.filter(r => (
                            r.totalQty > 0 || 
                            (r.sapIssuedQty && r.sapIssuedQty !== 0) || 
                            (r.sapGrossIssue && r.sapGrossIssue !== 0) ||
                            ((typeof this.getPrevReconQty === 'function') && this.getPrevReconQty(r.code) > 0)
                        ));
                    }
                    return this.pivotReconciliationData.rows;
                }
                const codes = this.reverseShownCodes;
                const cols = this.reverseReconColumns;
                return this.pivotReconciliationData.rows.filter(r => {
                    if (codes.indexOf(r.code) === -1) return false;
                    if (this.reconFilterZeroOnly) {
                        let t = 0;
                        for (let i = 0; i < cols.length; i++) t += Number(this.reconCellLoc(r.code, cols[i])) || 0;
                        return (t > 0 || (r.sapIssuedQty && r.sapIssuedQty !== 0) || ((typeof this.getPrevReconQty === 'function') && this.getPrevReconQty(r.code) > 0));
                    }
                    return true;
                });
            },
            reconNonZeroCount() {
                return (this.pivotReconciliationData.rows || []).filter(r => (
                    r.totalQty > 0 || 
                    (r.sapIssuedQty && r.sapIssuedQty !== 0) || 
                    ((typeof this.getPrevReconQty === 'function') && this.getPrevReconQty(r.code) > 0)
                )).length;
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
                let list = this.contractorsList || [];
                const rawQ = String(this.contractorDropdownSearch || '').trim().toLowerCase();
                const cleanQ = rawQ.replace(/^m\/s\.?\s*/i, '').trim();

                if (rawQ) {
                    const tokens = cleanQ.split(/\s+/).filter(Boolean);
                    list = list.filter(f => {
                        const name = (f.name || '').toLowerCase();
                        const pan = (f.pan || '').toLowerCase();
                        const gstin = (f.gstin || '').toLowerCase();
                        const wo = String(f.workOrderNo || '').toLowerCase();
                        const div = (f.divisionName || '').toLowerCase();
                        const combined = name + ' ' + pan + ' ' + gstin + ' ' + wo + ' ' + div;
                        
                        if (combined.includes(rawQ) || combined.includes(cleanQ)) return true;
                        return tokens.every(tok => combined.includes(tok));
                    });
                }

                // ⚡ Deduplicate: Only drop identical duplicate records (same WO + PAN/Name, or same ID)
                const seenKeys = new Set();
                const uniqueList = [];

                list.forEach(firm => {
                    const id = firm.id || '';
                    const rawWo = String(firm.workOrderNo || '').trim();
                    const m = rawWo.match(/\b\d{8}\b/);
                    const wo = m ? m[0] : (rawWo.length >= 6 ? rawWo : '');
                    const pan = (firm.pan || '').trim().toUpperCase();
                    const normName = (firm.name || '').toLowerCase().replace(/^m\/s\.?\s*/i, '').replace(/[^a-z0-9]/g, '');

                    const dedupeKey = wo ? (wo + '_' + (pan || normName)) : (id + '_' + normName);
                    if (seenKeys.has(dedupeKey)) return;
                    seenKeys.add(dedupeKey);
                    uniqueList.push(firm);
                });

                return uniqueList.sort((a, b) => {
                    const aName = (a.name || '').toLowerCase();
                    const bName = (b.name || '').toLowerCase();
                    if (cleanQ) {
                        const aStarts = aName.startsWith(cleanQ);
                        const bStarts = bName.startsWith(cleanQ);
                        if (aStarts && !bStarts) return -1;
                        if (!aStarts && bStarts) return 1;
                    }
                    return aName.localeCompare(bName);
                });
            },
            selectedContractorName() {
                if (this.selectedContractorId === 'custom') return '✏️ Custom';
                if (!this.selectedContractorId) {
                    if (this.invoiceData && this.invoiceData.contractorName && this.invoiceData.contractorName !== 'CONTRACTOR' && this.invoiceData.contractorName !== 'M/s CONTRACTOR') {
                        return this.invoiceData.contractorName;
                    }
                    return 'Select Contractor...';
                }
                const firm = (this.contractorsList || []).find(c => c.id === this.selectedContractorId || (c.id && c.id.startsWith(this.selectedContractorId)));
                return firm ? firm.name : ((this.invoiceData && this.invoiceData.contractorName && this.invoiceData.contractorName !== 'CONTRACTOR' && this.invoiceData.contractorName !== 'M/s CONTRACTOR') ? this.invoiceData.contractorName : 'Select Contractor...');
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
                const q = (this.newMaterial.codeSearch || '').toLowerCase().trim();
                const list = [];
                const seen = new Set();

                // 0. N/A Option (Not Applicable)
                if (!q || 'n/a'.includes(q) || 'not applicable'.includes(q) || 'na'.includes(q)) {
                    list.push({
                        desc: 'NOT APPLICABLE (No SAP Code)',
                        itemCode: 'N/A',
                        code: 'N/A',
                        unit: 'No',
                        rate: 0,
                        sapDescription: 'NOT APPLICABLE',
                        sapUom: 'No',
                        docHeader: '0031006347',
                        sapItems: [{ code: 'N/A', desc: 'NOT APPLICABLE', uom: 'No', qty: 1, docHeader: '0031006347' }]
                    });
                    seen.add('N/A__not applicable (no sap code)');
                }

                // 1. Collect materials from all activities
                Object.keys(this.activities || {}).forEach(ak => {
                    const act = this.activities[ak];
                    if (act && act.materials) {
                        act.materials.forEach(m => {
                            if (!m || !m.desc) return;
                            const key = (m.itemCode || '') + '__' + m.desc.toLowerCase();
                            if (seen.has(key)) return;
                            seen.add(key);
                            if (!q || m.desc.toLowerCase().includes(q) || (m.itemCode && m.itemCode.toLowerCase().includes(q))) {
                                list.push({
                                    desc: m.desc,
                                    itemCode: m.itemCode || '',
                                    unit: m.unit || 'No',
                                    rate: m.rate || 0,
                                    sapDescription: m.sapDescription,
                                    sapUom: m.sapUom,
                                    docHeader: m.docHeader,
                                    sapItems: m.sapItems
                                });
                            }
                        });
                    }
                });

                // 2. Also match from sapMaterialsMaster
                (this.sapMaterialsMaster || []).forEach(sap => {
                    if (!sap || !sap.desc) return;
                    const key = sap.code + '__' + sap.desc.toLowerCase();
                    if (seen.has(key)) return;
                    if (q && (sap.desc.toLowerCase().includes(q) || (sap.code && sap.code.toLowerCase().includes(q)))) {
                        seen.add(key);
                        list.push({
                            desc: sap.desc,
                            itemCode: sap.code,
                            code: sap.code,
                            unit: sap.uom || 'No',
                            rate: 0,
                            sapDescription: sap.desc,
                            sapUom: sap.uom,
                            docHeader: sap.docHeader || '0031006347',
                            sapItems: [{ code: sap.code, desc: sap.desc, uom: sap.uom || 'No', qty: 1, docHeader: sap.docHeader || '0031006347' }]
                        });
                    }
                });

                return list.slice(0, 30);
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
            sapMaterialsMaster: {
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
            
            // Backup default stock & check for custom uploaded stock in IndexedDB
            if (!window.DefaultContractorSapStock && window.ContractorSapStock) {
                window.DefaultContractorSapStock = window.ContractorSapStock;
            }
            if (!window.DefaultContractorOldReco && window.ContractorOldReco) {
                window.DefaultContractorOldReco = window.ContractorOldReco;
            }
            try {
                if (typeof window.OldRecoImporterModule !== 'undefined') {
                    const customOldReco = await window.OldRecoImporterModule.loadCustomOldRecoFromDb();
                    if (customOldReco && customOldReco.byContractorNorm && Object.keys(customOldReco.byContractorNorm).length > 0) {
                        window.ContractorOldReco = customOldReco;
                        this.hasCustomOldReco = true;
                        console.log('[OldRecoImporter] Custom old reco loaded from IndexedDB:', customOldReco.meta);
                    }
                }
                const editsJson = localStorage.getItem('billing_custom_old_reco_edits_v1');
                if (editsJson) {
                    this.customOldRecoEdits = JSON.parse(editsJson);
                    this.hasCustomOldReco = true;
                }
            } catch (e) {
                console.warn('[OldRecoImporter] Error loading custom old reco:', e);
            }
            try {
                if (typeof BillingStorage !== 'undefined') {
                    const customStockJson = await BillingStorage.getItemAsync('billing_custom_sap_stock');
                    if (customStockJson) {
                        const customStock = typeof customStockJson === 'string' ? JSON.parse(customStockJson) : customStockJson;
                        if (customStock && customStock.byContractorNorm && Object.keys(customStock.byContractorNorm).length > 0) {
                            window.ContractorSapStock = customStock;
                            this.hasCustomStock = true;
                            this.customStockMeta = customStock.meta;
                            console.log('[StockImporter] Custom stock loaded from storage:', customStock.meta);
                        }
                    }
                }
            } catch (e) {
                console.warn('[StockImporter] Error loading custom stock:', e);
            }
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

            // Ensure N/A option is always available in sapMaterialsMaster
            if (Array.isArray(this.sapMaterialsMaster) && !this.sapMaterialsMaster.some(s => s && s.code === 'N/A')) {
                this.sapMaterialsMaster.unshift({
                    code: 'N/A',
                    desc: 'NOT APPLICABLE',
                    uom: 'No'
                });
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
                            '17001296': { code: '17005041', desc: 'MS-11KV TOP CLEAT-75X40X6X325-2.44KG' },
                            '17000045': { code: '17000046', desc: 'DISC INSULATOR 11KV 70KN B & S POLYMER' },
                            '17001251': { code: '17000026', desc: 'HORN GAP FUSE 11 KV' },
                            '17000216': { code: '17000120', desc: 'ACSR WEASEL CONDUCTOR' },
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
                                            if (s.code !== 'N/A' && !String(s.code).startsWith('EXTRA-')) {
                                                m.sapItems.splice(i, 1);
                                                blanked++;
                                            }
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

            // PATCH: remove 10 excluded SAP items (GI wire, Lug, Bituminous paint, Stay set clamps, MS angle 50x50x6, Shackle/Stay/Bobbin insulators, Copper flexible wire)
            if (!localStorage.getItem('patch_remove_10_sap_items_v1')) {
                try {
                    const excludedCodes = new Set([
                        '17000236', '17000243',
                        '17000656',
                        '17000777', '17000776',
                        '17001312',
                        '17001313',
                        '17001390',
                        '17001398', '17000056',
                        '17001399', '17000058',
                        '17001400', '17001150',
                        '17002274', '17004590', '17004591'
                    ]);
                    let cleaned = 0;
                    Object.keys(this.activities || {}).forEach(actKey => {
                        const act = this.activities[actKey];
                        (act.materials || []).forEach(m => {
                            let shouldBlank = false;
                            if (excludedCodes.has(m.itemCode)) shouldBlank = true;
                            if (Array.isArray(m.sapItems)) {
                                for (let i = m.sapItems.length - 1; i >= 0; i--) {
                                    if (excludedCodes.has(m.sapItems[i].code)) {
                                        shouldBlank = true;
                                        m.sapItems.splice(i, 1);
                                    }
                                }
                            }
                            if (shouldBlank) {
                                m.itemCode = '';
                                m.sapDescription = '';
                                m.sapUom = '';
                                m.docHeader = '';
                                m.sapItems = [];
                                cleaned++;
                            }
                        });
                    });
                    if (cleaned > 0) {
                        this._isLoading = false;
                        this.saveToStorage();
                    }
                    localStorage.setItem('patch_remove_10_sap_items_v1', 'true');
                } catch(e) {
                    console.warn('patch_remove_10_sap_items_v1 error:', e);
                }
            }

            // Standardize all activity titles and existing invoice items to "Activity [code] : ..."
            let actTitlesFixed = false;
            if (this.activities) {
                Object.keys(this.activities).forEach(k => {
                    const act = this.activities[k];
                    if (act && act.title) {
                        let clean = act.title.replace(/^(?:Activity\s+)?([A-Za-z0-9]+)\s*:\s*/i, '').replace(/^(?:Activity\s+)?([A-Za-z0-9]+)\s*:\s*/i, '').trim();
                        const desired = `Activity ${k} : ${clean}`;
                        if (act.title !== desired) {
                            act.title = desired;
                            actTitlesFixed = true;
                        }
                    }
                });
            }
            if (typeof this.cleanInvoicePlaceholderRows === 'function') {
                this.cleanInvoicePlaceholderRows();
            }
            if (this.invoiceData && Array.isArray(this.invoiceData.items)) {
                // If invoice has real activities/items, clean out any leftover blank rows
                const hasRealItems = this.invoiceData.items.some(it => it.actKey || (it.desc && it.desc.trim()) || (it.amount && Number(it.amount) > 0));
                if (hasRealItems && this.invoiceData.items.length > 1) {
                    const beforeLen = this.invoiceData.items.length;
                    this.invoiceData.items = this.invoiceData.items.filter(it => {
                        const isBlank = !it.actKey && (!it.desc || !it.desc.trim()) && (!it.amount || Number(it.amount) === 0);
                        return !isBlank;
                    });
                    if (this.invoiceData.items.length !== beforeLen) {
                        this.invoiceData.items.forEach((it, idx) => { it.srNo = (idx + 1).toString(); });
                        actTitlesFixed = true;
                    }
                }

                this.invoiceData.items.forEach(it => {
                    const k = it.actKey || (typeof this.keyOfInvoiceItem === 'function' ? this.keyOfInvoiceItem(it) : ((it.desc && /^(?:Activity\s+)?([A-Za-z0-9]+)\s*:/i.test(it.desc)) ? it.desc.match(/^(?:Activity\s+)?([A-Za-z0-9]+)\s*:/i)[1] : ''));
                    if (k && this.activities && this.activities[k]) {
                        it.actKey = k;
                        const desired = typeof this.getActivityInvoiceDescription === 'function' ? this.getActivityInvoiceDescription(k) : `Activity ${k} : ${(this.activities[k].title || '').replace(/^(?:Activity\s+)?([A-Za-z0-9]+)\s*:\s*/i, '').trim()}`;
                        if (it.desc !== desired) {
                            it.desc = desired;
                            actTitlesFixed = true;
                        }
                    }
                });
            }
            if (actTitlesFixed) {
                this._isLoading = false;
                this.saveToStorage();
            }

            // Migration: Top & Bottom MS Channel item 3 in Activity 907 auto-setup if missing/extra
            try {
                if (this.activities && this.activities['907'] && Array.isArray(this.activities['907'].materials)) {
                    const m3 = this.activities['907'].materials[2];
                    if (m3 && (m3.itemCode === 'EXTRA-3' || m3.itemCode === '17002007' || !m3.sapItems || m3.sapItems.length < 2)) {
                        m3.itemCode = '17005060, 17005059';
                        m3.sapDescription = 'MS-11KV TR BASE CH-100X50X6X2700-25.81KG | MS-11KV TOP CH-100X50X6X2700-25.81KG';
                        m3.sapUom = 'NO';
                        m3.docHeader = '0031006347';
                        m3.sapItems = [
                            { code: '17005060', desc: 'MS-11KV TR BASE CH-100X50X6X2700-25.81KG', uom: 'NO', qty: 1, docHeader: '0031006347' },
                            { code: '17005059', desc: 'MS-11KV TOP CH-100X50X6X2700-25.81KG', uom: 'NO', qty: 1, docHeader: '0031006347' }
                        ];
                    }
                }
            } catch(e) {}

            this._isLoading = false;
            // Initial history snapshot
            this.takeSnapshot();

            // Auto-load GDrive Webhook URL from server env or projectMeta
            try {
                const isValidGas = (val) => {
                    if (!val || typeof val !== 'string') return false;
                    let s = val.trim().replace(/^["']|["']$/g, '');
                    if (s.startsWith('http://script.google.com/')) s = 'https://' + s.slice('http://'.length);
                    else if (s.startsWith('script.google.com/')) s = 'https://' + s;
                    return s.startsWith('https://script.google.com/') && s.includes('/exec');
                };
                const DEFAULT_GAS = 'https://script.google.com/macros/s/AKfycbw495PuqtHzuCATbRHI3dgofeWKaMVyYrUhc0twCdf0EbaPwSlpA81i0ExHdny6MZQ/exec';

                if (!isValidGas(this.gdriveWebhookUrl)) {
                    const local = localStorage.getItem('billing_gdrive_webhook_url');
                    const meta = this.projectMeta && this.projectMeta.gdriveWebhookUrl;
                    if (isValidGas(local)) {
                        this.gdriveWebhookUrl = local;
                    } else if (isValidGas(meta)) {
                        this.gdriveWebhookUrl = meta;
                    } else {
                        this.gdriveWebhookUrl = DEFAULT_GAS;
                        try { localStorage.setItem('billing_gdrive_webhook_url', DEFAULT_GAS); } catch(e) {}
                        if (this.projectMeta) this.projectMeta.gdriveWebhookUrl = DEFAULT_GAS;
                    }
                }
                fetch('/api/gdrive-config', {
                    headers: (() => { const h = {}; try { const k = localStorage.getItem('billing_api_key'); if (k) h['x-api-key'] = k; } catch(e){} return h; })()
                }).then(r => r.json()).then(d => {
                    if (d && d.webhookUrl && isValidGas(d.webhookUrl)) {
                        if (!isValidGas(this.gdriveWebhookUrl) || this.gdriveWebhookUrl === DEFAULT_GAS) {
                            this.gdriveWebhookUrl = d.webhookUrl;
                            try { localStorage.setItem('billing_gdrive_webhook_url', d.webhookUrl); } catch(e) {}
                        }
                    }
                }).catch(() => {});
            } catch(e) {}

            // Net wapas aaye to pending sync turant push ho jaye
            this.armOnlineRecovery();

            // Periodic heartbeat sync — check cloud updates first, then push local changes
            this._heartbeatTimer = setInterval(async () => {
                if (this._isLoading || this.cloudConflict) return;
                if (this.syncStatus === 'syncing') return;
                try {
                    // 1. Check if another PC saved changes to cloud, auto-pull them!
                    if (typeof this.cloudRev === 'number') {
                        const curBillId = this.activeBillId || 'main-billing-state';
                        const headRes = await fetch('/api/billing?dataId=' + encodeURIComponent(curBillId), {
                            headers: (() => { const h = {}; try { const k = localStorage.getItem('billing_api_key'); if (k) h['x-api-key'] = k; } catch(e){} return h; })()
                        });
                        if (headRes.ok) {
                            const headData = await headRes.json();
                            if (headData && typeof headData.rev === 'number' && headData.rev > this.cloudRev) {
                                console.info(`Heartbeat: newer cloud rev detected (${headData.rev} > ${this.cloudRev}), loading updates...`);
                                await this.loadFromStorage({ forceServer: true, dataId: curBillId });
                                try { this.showToast('Cloud updates received from another PC ☁️', 'ℹ️'); } catch(e) {}
                                return;
                            }
                        }
                    }
                    // 2. If already up to date, check if we have local changes to push
                    const payload = this.buildSyncPayload();
                    const json = JSON.stringify(payload);
                    if (json.length <= 4 * 1024 * 1024) {
                        let h = 0;
                        for (let i = 0; i < json.length; i += 97) { h = ((h * 31) + json.charCodeAt(i)) >>> 0; }
                        const hash = json.length + ':' + h;
                        if (hash !== this.lastSentHash) {
                            console.info('Heartbeat: unsynced change detected, pushing to cloud');
                            await this.syncToMongoNow();
                        }
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
