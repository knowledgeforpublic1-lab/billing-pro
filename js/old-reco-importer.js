/**
 * @file Old Reconciliation Importer Module
 * @description In-browser parser and manager for uploaded Contractor Old / Previous Reconciliation Excel files.
 * Supports multi-sheet master reconciliation workbooks and single-contractor reconciliation sheets.
 * Persists custom reconciliation data to IndexedDB and provides inline editing.
 *
 * @module OldRecoImporterModule
 * @since v2.0
 */

window.OldRecoImporterModule = {
    normContractorName(n) {
        if (!n) return '';
        return String(n)
            .toLowerCase()
            .replace(/^m\/s\.?\s*/i, '')
            .replace(/\(.*?\)/g, '')
            .replace(/[^a-z0-9]/g, '')
            .trim();
    },

    normRawKey(n) {
        if (!n) return '';
        return String(n)
            .toLowerCase()
            .replace(/^m\/s\.?\s*/i, '')
            .replace(/[^a-z0-9]/g, '')
            .trim();
    },

    /**
     * Parses an uploaded Excel ArrayBuffer into the standard ContractorOldReco structure.
     * @param {ArrayBuffer} arrayBuffer
     * @param {string} [defaultContractorName]
     * @returns {Object} Standard ContractorOldReco data structure
     */
    parseOldRecoExcel(arrayBuffer, defaultContractorName) {
        if (typeof XLSX === 'undefined') {
            throw new Error('XLSX parser library is not loaded. Please check your network connection and refresh.');
        }

        const wb = XLSX.read(arrayBuffer, {
            type: 'array',
            cellStyles: false,
            cellHTML: false,
            cellFormula: false
        });

        const sheetNames = wb.SheetNames || [];
        if (sheetNames.length === 0) {
            throw new Error('The uploaded Excel file contains no worksheets.');
        }

        const cleanHeader = (val) => {
            if (val === null || val === undefined) return '';
            return String(val)
                .replace(/[\r\n\t_]+/g, ' ')
                .replace(/[^\w\s.%-]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase();
        };

        const parseQty = (val) => {
            if (val === null || val === undefined || val === '') return 0;
            if (typeof val === 'number') return isNaN(val) ? 0 : val;
            const clean = String(val).replace(/,/g, '').trim();
            const num = parseFloat(clean);
            return isNaN(num) ? 0 : num;
        };

        const existingDb = window.ContractorOldReco || window.DefaultContractorOldReco || { byContractorNorm: {} };
        const updatedDb = {
            meta: {
                extractedAt: new Date().toISOString(),
                contractorCount: 0,
                version: 'custom_upload'
            },
            byContractorNorm: JSON.parse(JSON.stringify(existingDb.byContractorNorm || {}))
        };

        const excludeSheets = [
            'debit rate', 'gadchiroli t-10__1458', 'non working 30.06.2026', 
            'bill summary', 'sheet1', 'contractor bill details'
        ];

        // Check if multi-contractor workbook (multiple sheets matching contractor names)
        const candidateContractorSheets = sheetNames.filter(s => {
            const sLower = cleanHeader(s);
            return sLower && !excludeSheets.includes(sLower) && sLower !== 'sheet1';
        });

        const isMultiContractorWorkbook = candidateContractorSheets.length > 2;
        let processedContractors = 0;

        if (isMultiContractorWorkbook) {
            // Case A: Multi-Contractor Master Workbook
            for (const sName of candidateContractorSheets) {
                const sheet = wb.Sheets[sName];
                if (!sheet) continue;
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                if (!rows || rows.length < 2) continue;

                const contractorName = String(sName).trim();
                const normKey = this.normContractorName(contractorName);
                if (!normKey) continue;

                const colMap = this.detectRecoColumns(rows, cleanHeader);
                if (colMap.code === -1) continue;

                const materials = (updatedDb.byContractorNorm[normKey] && updatedDb.byContractorNorm[normKey].materials) 
                    ? updatedDb.byContractorNorm[normKey].materials 
                    : {};

                for (let r = colMap.startRow; r < rows.length; r++) {
                    const row = rows[r];
                    if (!row || !row[colMap.code]) continue;
                    const code = String(row[colMap.code]).trim();
                    if (!code || code === '0' || code.toLowerCase() === 'total') continue;

                    const cons = colMap.consumption !== -1 ? parseQty(row[colMap.consumption]) : 0;
                    const net = colMap.netIssue !== -1 ? parseQty(row[colMap.netIssue]) : (materials[code] ? materials[code].netIssue : 0);
                    const desc = (colMap.desc !== -1 && row[colMap.desc]) ? String(row[colMap.desc]).trim() : (materials[code] ? materials[code].desc : code);
                    const uom = (colMap.uom !== -1 && row[colMap.uom]) ? String(row[colMap.uom]).trim() : (materials[code] ? materials[code].uom : 'No');

                    materials[code] = {
                        code: code,
                        desc: desc,
                        uom: uom,
                        prevConsumption: Math.round(cons * 1000) / 1000,
                        netIssue: Math.round(net * 1000) / 1000,
                        balanceQty: Math.round((net - cons) * 1000) / 1000
                    };
                }

                updatedDb.byContractorNorm[normKey] = {
                    contractorName: contractorName,
                    itemCount: Object.keys(materials).length,
                    consumedCount: Object.values(materials).filter(m => m.prevConsumption > 0).length,
                    materials: materials
                };
                processedContractors++;
            }
        } else {
            // Case B: Single Contractor Sheet (e.g. exported reconciliation sheet or single active sheet)
            const targetSheetName = sheetNames[0];
            const sheet = wb.Sheets[targetSheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            if (!rows || rows.length < 2) {
                throw new Error('The uploaded worksheet contains insufficient rows.');
            }

            const targetContractor = defaultContractorName || sheetNames[0] || 'Selected Contractor';
            const normKey = this.normContractorName(targetContractor);
            if (!normKey) {
                throw new Error('Please select a contractor before uploading a single-contractor reconciliation sheet.');
            }

            const colMap = this.detectRecoColumns(rows, cleanHeader);
            if (colMap.code === -1) {
                throw new Error('Could not identify SAP Item Code / Row Labels column in the uploaded Excel.');
            }

            const materials = (updatedDb.byContractorNorm[normKey] && updatedDb.byContractorNorm[normKey].materials) 
                ? updatedDb.byContractorNorm[normKey].materials 
                : {};

            for (let r = colMap.startRow; r < rows.length; r++) {
                const row = rows[r];
                if (!row || !row[colMap.code]) continue;
                const code = String(row[colMap.code]).trim();
                if (!code || code === '0' || code.toLowerCase() === 'total' || code.toLowerCase().includes('total')) continue;

                const cons = colMap.consumption !== -1 ? parseQty(row[colMap.consumption]) : 0;
                const net = colMap.netIssue !== -1 ? parseQty(row[colMap.netIssue]) : (materials[code] ? materials[code].netIssue : 0);
                const desc = (colMap.desc !== -1 && row[colMap.desc]) ? String(row[colMap.desc]).trim() : (materials[code] ? materials[code].desc : code);
                const uom = (colMap.uom !== -1 && row[colMap.uom]) ? String(row[colMap.uom]).trim() : (materials[code] ? materials[code].uom : 'No');

                materials[code] = {
                    code: code,
                    desc: desc,
                    uom: uom,
                    prevConsumption: Math.round(cons * 1000) / 1000,
                    netIssue: Math.round(net * 1000) / 1000,
                    balanceQty: Math.round((net - cons) * 1000) / 1000
                };
            }

            updatedDb.byContractorNorm[normKey] = {
                contractorName: targetContractor,
                itemCount: Object.keys(materials).length,
                consumedCount: Object.values(materials).filter(m => m.prevConsumption > 0).length,
                materials: materials
            };
            processedContractors = 1;
        }

        updatedDb.meta.contractorCount = Object.keys(updatedDb.byContractorNorm).length;
        return { updatedDb, processedContractors };
    },

    /**
     * Detects column indices for Item Code, Description, UOM, and Consumption.
     */
    detectRecoColumns(rows, cleanHeader) {
        let colMap = { code: -1, desc: -1, uom: -1, consumption: -1, netIssue: -1, startRow: 1 };
        for (let r = 0; r < Math.min(8, rows.length); r++) {
            if (!rows[r]) continue;
            const h = rows[r].map(x => cleanHeader(x));
            const codeIdx = h.findIndex(x => x && (x === 'row labels' || x === 'item code' || x === 'sap code' || x === 'material code' || x === 'material' || x === 'code'));
            if (codeIdx !== -1) {
                colMap.code = codeIdx;
                colMap.startRow = r + 1;

                colMap.desc = h.findIndex(x => x && (x.includes('description') || x.includes('desc') || x.includes('item name')));
                colMap.uom = h.findIndex(x => x && (x === 'unit' || x === 'uom'));
                
                // Consumption / Previous Reconciled column
                let consIdx = h.findIndex(x => x && (
                    x.includes('purana reco') ||
                    x.includes('prev recon') ||
                    x.includes('previous recon') ||
                    x.includes('pichla') ||
                    x === 'total consumptio' ||
                    x === 'total consumption' ||
                    x === 'total consumtion' ||
                    x === 'consumption' ||
                    x === 'reconciled' ||
                    x === 'total qty' ||
                    x === 'consumed qty' ||
                    x === 'total'
                ));
                if (consIdx !== -1) colMap.consumption = consIdx;

                let netIdx = h.findIndex(x => x && (x.includes('net issue') || x.includes('net issued')));
                if (netIdx !== -1) colMap.netIssue = netIdx;

                break;
            }
        }
        return colMap;
    },

    // ─── INDEXEDDB PERSISTENCE ───
    async saveCustomOldRecoToDb(recoData) {
        try {
            localStorage.setItem('billing_custom_old_reco_v1', JSON.stringify(recoData));
        } catch(e) {
            // LocalStorage fallback quota exceeded, IndexedDB primary
        }

        return new Promise((resolve) => {
            if (!window.indexedDB) return resolve(false);
            const req = indexedDB.open('billing_pro_db', 3);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('custom_old_reconciliation')) {
                    db.createObjectStore('custom_old_reconciliation', { keyPath: 'id' });
                }
            };
            req.onsuccess = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('custom_old_reconciliation')) {
                    return resolve(false);
                }
                const tx = db.transaction(['custom_old_reconciliation'], 'readwrite');
                const store = tx.objectStore('custom_old_reconciliation');
                store.put({ id: 'active_old_reco', data: recoData, updatedAt: new Date().toISOString() });
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            };
            req.onerror = () => resolve(false);
        });
    },

    async loadCustomOldRecoFromDb() {
        return new Promise((resolve) => {
            // Try IndexedDB first
            if (window.indexedDB) {
                const req = indexedDB.open('billing_pro_db', 3);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('custom_old_reconciliation')) {
                        db.createObjectStore('custom_old_reconciliation', { keyPath: 'id' });
                    }
                };
                req.onsuccess = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('custom_old_reconciliation')) {
                        return this.fallbackLocalStorageOldReco(resolve);
                    }
                    const tx = db.transaction(['custom_old_reconciliation'], 'readonly');
                    const store = tx.objectStore('custom_old_reconciliation');
                    const getReq = store.get('active_old_reco');
                    getReq.onsuccess = () => {
                        if (getReq.result && getReq.result.data) {
                            resolve(getReq.result.data);
                        } else {
                            this.fallbackLocalStorageOldReco(resolve);
                        }
                    };
                    getReq.onerror = () => this.fallbackLocalStorageOldReco(resolve);
                };
                req.onerror = () => this.fallbackLocalStorageOldReco(resolve);
            } else {
                this.fallbackLocalStorageOldReco(resolve);
            }
        });
    },

    fallbackLocalStorageOldReco(resolve) {
        try {
            const raw = localStorage.getItem('billing_custom_old_reco_v1');
            if (raw) {
                return resolve(JSON.parse(raw));
            }
        } catch(e) {}
        resolve(null);
    },

    async clearCustomOldRecoFromDb() {
        try { localStorage.removeItem('billing_custom_old_reco_v1'); } catch(e) {}
        return new Promise((resolve) => {
            if (!window.indexedDB) return resolve(true);
            const req = indexedDB.open('billing_pro_db', 3);
            req.onsuccess = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('custom_old_reconciliation')) return resolve(true);
                const tx = db.transaction(['custom_old_reconciliation'], 'readwrite');
                const store = tx.objectStore('custom_old_reconciliation');
                store.delete('active_old_reco');
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            };
            req.onerror = () => resolve(false);
        });
    },

    // ─── VUE METHODS (merged into allMethods) ─────────────────────────
    getContractorOldReco() {
        const recoDb = window.ContractorOldReco || window.DefaultContractorOldReco;
        if (!recoDb || !recoDb.byContractorNorm) return null;

        let cName = this.selectedContractorName;
        if (!cName || cName === 'Select Contractor...' || cName.includes('Custom')) {
            cName = (this.invoiceData && this.invoiceData.contractorName) || (this.projectMeta && this.projectMeta.contractorName) || '';
        }
        if (!cName) return null;

        const cleanName = String(cName).toLowerCase().replace(/^m\/s\.?\s*/i, '');
        const norm = cleanName.replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
        const rawNorm = cleanName.replace(/[^a-z0-9]/g, '');
        if (!norm && !rawNorm) return null;

        if (norm && recoDb.byContractorNorm[norm]) {
            return recoDb.byContractorNorm[norm];
        }
        if (rawNorm && recoDb.byContractorNorm[rawNorm]) {
            return recoDb.byContractorNorm[rawNorm];
        }

        for (const [k, v] of Object.entries(recoDb.byContractorNorm)) {
            if (k.length >= 4 && ((norm && (k.includes(norm) || norm.includes(k))) || (rawNorm && (k.includes(rawNorm) || rawNorm.includes(k))))) {
                return v;
            }
        }
        return null;
    },

    getContractorNormKey() {
        let cName = this.selectedContractorName;
        if (!cName || cName === 'Select Contractor...' || cName.includes('Custom')) {
            cName = (this.invoiceData && this.invoiceData.contractorName) || (this.projectMeta && this.projectMeta.contractorName) || '';
        }
        if (!cName) return '';
        return String(cName).toLowerCase().replace(/^m\/s\.?\s*/i, '').replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '').trim();
    },

    getPrevReconQty(code) {
        if (!code) return 0;
        const cKey = this.getContractorNormKey();
        if (cKey && this.customOldRecoEdits && this.customOldRecoEdits[cKey] && this.customOldRecoEdits[cKey][code] !== undefined) {
            const editVal = Number(this.customOldRecoEdits[cKey][code]);
            return isNaN(editVal) ? 0 : editVal;
        }
        const oldReco = (typeof this.getContractorOldReco === 'function') ? this.getContractorOldReco() : null;
        if (oldReco && oldReco.materials && oldReco.materials[code]) {
            const m = oldReco.materials[code];
            const val = Number(m.prevConsumption !== undefined ? m.prevConsumption : (m.consumption !== undefined ? m.consumption : 0));
            return isNaN(val) ? 0 : val;
        }
        return 0;
    },

    updatePrevReconQty(code, rawVal) {
        if (!code) return;
        const cKey = this.getContractorNormKey();
        if (!cKey) {
            if (typeof this.showToast === 'function') this.showToast('Please select a contractor first', 'Alert');
            return;
        }
        const num = parseFloat(String(rawVal).replace(/,/g, '').trim());
        const finalVal = isNaN(num) ? 0 : Math.round(num * 1000) / 1000;

        if (!this.customOldRecoEdits) this.customOldRecoEdits = {};
        if (!this.customOldRecoEdits[cKey]) this.customOldRecoEdits[cKey] = {};
        this.customOldRecoEdits[cKey][code] = finalVal;

        const recoDb = window.ContractorOldReco;
        if (recoDb && recoDb.byContractorNorm && recoDb.byContractorNorm[cKey]) {
            if (!recoDb.byContractorNorm[cKey].materials) recoDb.byContractorNorm[cKey].materials = {};
            if (recoDb.byContractorNorm[cKey].materials[code]) {
                recoDb.byContractorNorm[cKey].materials[code].prevConsumption = finalVal;
            } else {
                recoDb.byContractorNorm[cKey].materials[code] = {
                    code: code,
                    desc: code,
                    uom: 'No',
                    prevConsumption: finalVal,
                    netIssue: 0,
                    balanceQty: -finalVal
                };
            }
        }

        this.hasCustomOldReco = true;
        try {
            localStorage.setItem('billing_custom_old_reco_edits_v1', JSON.stringify(this.customOldRecoEdits));
        } catch(e) {}
        this.$forceUpdate();
    },

    getCumulativeReconQty(row) {
        if (!row) return 0;
        const prevR = (typeof this.getPrevReconQty === 'function') ? this.getPrevReconQty(row.code) : 0;
        const thisB = Number(row.totalQty) || 0;
        return Math.round((prevR + thisB) * 1000) / 1000;
    },

    getReconBalanceQty(row) {
        if (!row) return 0;
        const net = Number(row.sapNetIssue !== undefined ? row.sapNetIssue : (row.sapIssuedQty || 0));
        const cum = (typeof this.getCumulativeReconQty === 'function') ? this.getCumulativeReconQty(row) : 0;
        return Math.round((net - cum) * 1000) / 1000;
    },

    async handleOldRecoFileUpload(e) {
        const file = e && e.target && e.target.files && e.target.files[0];
        if (!file) return;
        if (e.target) e.target.value = '';

        const name = file.name || 'file.xlsx';
        if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
            if (typeof this.showToast === 'function') this.showToast('Please upload an Excel file (.xlsx or .xls)', 'Alert');
            return;
        }

        this.oldRecoUploading = true;
        if (typeof this.showToast === 'function') this.showToast('Reading old reconciliation file: ' + name + ' (Please wait)...', '⏳');
        await new Promise(r => setTimeout(r, 100));

        try {
            const arrayBuffer = await file.arrayBuffer();
            const res = window.OldRecoImporterModule.parseOldRecoExcel(arrayBuffer, this.selectedContractorName);
            const updatedDb = res.updatedDb;

            if (!window.DefaultContractorOldReco && window.ContractorOldReco) {
                window.DefaultContractorOldReco = window.ContractorOldReco;
            }

            window.ContractorOldReco = updatedDb;
            if (typeof BillingStorage !== 'undefined') {
                await BillingStorage.setItem('billing_custom_old_reco_db', updatedDb);
            } else {
                await window.OldRecoImporterModule.saveCustomOldRecoToDb(updatedDb);
            }

            this.hasCustomOldReco = true;
            this.$forceUpdate();
            if (typeof this.showToast === 'function') {
                this.showToast(`Purana Reconciliation Synced! (${res.processedContractors} contractors updated)`, 'Check');
            }
        } catch (err) {
            console.error('[OldRecoUpload Error]:', err);
            alert('Old Reconciliation Upload Error:\n' + (err.message || err));
            if (typeof this.showToast === 'function') {
                this.showToast('Failed to process Excel: ' + (err.message || 'Unknown error'), 'Alert');
            }
        } finally {
            this.oldRecoUploading = false;
        }
    },

    async resetToDefaultOldReco() {
        if (!confirm('Are you sure you want to reset all old reconciliation data to defaults? Any custom uploaded files and edits will be cleared.')) return;
        try {
            if (typeof BillingStorage !== 'undefined') {
                await BillingStorage.removeItem('billing_custom_old_reco_db');
            }
            await window.OldRecoImporterModule.clearCustomOldRecoFromDb();
            try { localStorage.removeItem('billing_custom_old_reco_edits_v1'); } catch(e) {}
            this.customOldRecoEdits = {};
            if (window.DefaultContractorOldReco) {
                window.ContractorOldReco = JSON.parse(JSON.stringify(window.DefaultContractorOldReco));
            }
            this.hasCustomOldReco = false;
            this.$forceUpdate();
            if (typeof this.showToast === 'function') {
                this.showToast('Reset to default built-in old reconciliation baseline.', 'Check');
            }
        } catch(e) {
            console.error('Reset old reco error:', e);
        }
    },

    openOldRecoModal() {
        this.oldRecoModalSearch = '';
        this.showOldRecoModal = true;
    },

    closeOldRecoModal() {
        this.showOldRecoModal = false;
    }
};
