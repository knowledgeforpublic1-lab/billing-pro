/**
 * @file Old Reconciliation Importer Module
 * @description High-performance in-browser parser and manager for uploaded Contractor Old / Previous Reconciliation Excel files.
 * Uses the proven, robust 40-row multi-layer header detection from Reconciliation Master, supporting multi-sheet workbooks,
 * single-contractor sheets, 2-row merged headers, and auto-derivation of consumption and net issue.
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

    cleanHeaderStr(val) {
        if (val === null || val === undefined) return '';
        return String(val)
            .replace(/[\r\n\t_]+/g, ' ')
            .replace(/[^\w\s.%-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    },

    parseQty(val) {
        if (val === null || val === undefined || val === '') return 0;
        if (typeof val === 'number') return isNaN(val) ? 0 : val;
        const clean = String(val).replace(/,/g, '').trim();
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
    },

    /**
     * Proven 40-row header detection supporting 2-row merged headers & weighted matchers.
     * Ported from Reconciliation Master engine for 100% format compatibility.
     */
    detectSheetColumnsRobust(sheetRows) {
        const matchers = {
            issue: (h) => {
                if (!h) return 0;
                if (h === 'issued qty' || h === 'issue qty' || h === 'issued quantity' || h === 'qty issued' || h === 'quantity issued' || h === 'issued nos') return 10;
                if (['net', 'amount', 'rate', 'cost', 'value', 'rs', 'inr'].some(ex => h.includes(ex))) return 0;
                if (h.includes('issued qty') || h.includes('issue qty')) return 9;
                if (h.startsWith('issued') || h.startsWith('issue') || h === 'issued') return 6;
                return 0;
            },
            mrn: (h) => {
                if (!h) return 0;
                if (h === 'mrn qty' || h === 'mrn quantity' || h === 'qty mrn' || h === 'mrn nos' || h === 'mrn') return 10;
                if (['amount', 'rate', 'cost', 'value'].some(ex => h.includes(ex))) return 0;
                if (h.includes('mrn qty') || h.includes('mrn nos')) return 9;
                if (h.includes('mrn') || h.includes('m r n') || h.includes('return')) return 7;
                return 0;
            },
            netIssue: (h) => {
                if (!h) return 0;
                if (h === 'net issued' || h === 'net issue' || h === 'net issued qty' || h === 'net issue qty' || h === 'net qty issued' || h === 'net quantity') return 10;
                if (['amount', 'rate', 'cost', 'value'].some(ex => h.includes(ex))) return 0;
                if (h.includes('net issued') || h.includes('net issue')) return 9;
                if (h.includes('net') && (h.includes('issue') || h.includes('issued'))) return 7;
                return 0;
            },
            consumption: (h) => {
                if (!h) return 0;
                if (h === 'total consumptio' || h === 'total consumption' || h === 'total consumtion' || h === 'total cosumption') return 10;
                if (['amount', 'rate', 'cost', 'value', 'percent', '%'].some(ex => h.includes(ex))) return 0;
                if (h.includes('total consumptio') || h.includes('total consumption') || h.includes('total consumtion') || h.includes('purana reco') || h.includes('prev recon')) return 9;
                if (h.includes('total') && (h.includes('consum') || h.includes('cosum') || h.includes('erect') || h.includes('reconcil'))) return 8;
                if (h === 'consumption' || h === 'consumtion' || h === 'consumed qty' || h === 'total erected' || h === 'erected qty' || h === 'purana reco' || h === 'prev recon' || h === 'reconciled') return 7;
                if (h.includes('consumption') || h.includes('consumtion') || h.includes('erected') || h.includes('reconcil')) return 5;
                if (h === 'total' || h === 'total qty' || h === 'grand total') return 4;
                return 0;
            },
            balance: (h) => {
                if (!h) return 0;
                if (h === 'total balance' || h === 'total bal' || h === 'total balance qty' || h === 'total bal qty') return 10;
                if (['amount', 'rate', 'cost', 'value', 'debit'].some(ex => h.includes(ex))) return 0;
                if (h.includes('total balance') || h.includes('total bal')) return 9;
                if (h === 'balance qty' || h === 'balance quantity' || h === 'balance stock' || h === 'balance material' || h === 'bal qty') return 8;
                if (h.includes('balance') || h.includes('bal qty')) return 6;
                return 0;
            },
            itemCode: (h) => {
                if (!h) return 0;
                if (h === 'item code' || h === 'itemcode' || h === 'material code' || h === 'mat code' || h === 'sap code' || h === 'mat no' || h === 'item no' || h === 'item no.' || h === 'row labels') return 10;
                if (['desc', 'description', 'name'].some(ex => h.includes(ex))) return 0;
                if (h.includes('item code') || h.includes('material code') || h.includes('sap code') || h.includes('mat code') || h.includes('row labels')) return 9;
                if (h === 'code') return 6;
                return 0;
            },
            itemDesc: (h) => {
                if (!h) return 0;
                if (h === 'item description' || h === 'material description' || h === 'items description' || h === 'description of material' || h === 'item desc' || h === 'material desc' || h === 'description' || h === 'material' || h === 'items' || h === 'particulars') return 10;
                if (['code', 'rate', 'uom', 'unit', 'cost', 'amount', 'val'].some(ex => h.includes(ex))) return 0;
                if (h.includes('description') || h.includes('material desc') || h.includes('item desc')) return 8;
                if (h.includes('material') || h.includes('item name')) return 6;
                return 0;
            },
            uom: (h) => {
                if (!h) return 0;
                if (h === 'uom' || h === 'unit' || h === 'unit of measurement' || h === 'u o m' || h === 'u.o.m') return 10;
                if (['rate', 'cost', 'price', 'amount'].some(ex => h.includes(ex))) return 0;
                if (h.includes('uom') || h.includes('unit')) return 7;
                return 0;
            }
        };

        const maxHeaderRows = Math.min(sheetRows.length, 40);
        let bestScore = -1;
        let bestColMap = null;
        let bestStartRow = 1;

        for (let r = 0; r < maxHeaderRows; r++) {
            const row1 = sheetRows[r] || [];
            const row2 = (r + 1 < maxHeaderRows) ? (sheetRows[r + 1] || []) : [];
            const maxCols = Math.max(row1.length, row2.length);
            if (maxCols === 0) continue;

            const tests = [
                {
                    headerArr: Array.from({ length: maxCols }, (_, c) => this.cleanHeaderStr(row1[c])),
                    nextRow: r + 1
                }
            ];
            if (row2.length > 0) {
                tests.push({
                    headerArr: Array.from({ length: maxCols }, (_, c) => this.cleanHeaderStr(row1[c] + ' ' + row2[c])),
                    nextRow: r + 2
                });
            }

            for (const test of tests) {
                const headers = test.headerArr;
                const curColMap = {
                    itemCode: -1,
                    itemDesc: -1,
                    uom: -1,
                    issue: -1,
                    mrn: -1,
                    netIssue: -1,
                    consumption: -1,
                    balance: -1
                };
                let score = 0;

                for (const key of Object.keys(matchers)) {
                    let bestMatchScore = 0;
                    let bestColIdx = -1;
                    for (let c = 0; c < headers.length; c++) {
                        const mScore = matchers[key](headers[c]);
                        if (mScore > bestMatchScore) {
                            bestMatchScore = mScore;
                            bestColIdx = c;
                        }
                    }
                    if (bestMatchScore > 0) {
                        curColMap[key] = bestColIdx;
                        score += bestMatchScore;
                    }
                }

                if (curColMap.issue !== -1) score += 5;
                if (curColMap.netIssue !== -1) score += 5;
                if (curColMap.consumption !== -1) score += 5;
                if (curColMap.balance !== -1) score += 5;

                if (score > bestScore) {
                    bestScore = score;
                    bestColMap = curColMap;
                    bestStartRow = test.nextRow;
                }
            }
        }

        let colMap = (bestColMap && bestScore >= 10) ? bestColMap : {
            itemCode: -1, itemDesc: -1, uom: -1, issue: -1, mrn: -1, netIssue: -1, consumption: -1, balance: -1
        };
        let startRow = (bestColMap && bestScore >= 10) ? bestStartRow : 1;

        // Fallback heuristics for itemCode and itemDesc if not identified from header
        if (colMap.itemCode === -1 || colMap.itemDesc === -1) {
            for (let r = startRow; r < Math.min(sheetRows.length, startRow + 25); r++) {
                const row = sheetRows[r];
                if (!row) continue;
                for (let c = 0; c < row.length; c++) {
                    const valStr = String(row[c] || '').trim();
                    if (colMap.itemCode === -1 && /^\d{6,10}$/.test(valStr)) {
                        colMap.itemCode = c;
                    }
                    if (colMap.itemDesc === -1 && valStr.length > 4 && /[a-zA-Z]/.test(valStr) && c !== colMap.itemCode) {
                        colMap.itemDesc = c;
                    }
                }
                if (colMap.itemCode !== -1 && colMap.itemDesc !== -1) break;
            }
        }

        return { colMap, startRow, score: bestScore };
    },

    /**
     * Extracts materials from a sheet using the detected columns and smart fallbacks.
     */
    extractMaterialsFromRows(sheetRows, targetMaterials) {
        const { colMap, startRow } = this.detectSheetColumnsRobust(sheetRows);
        if (colMap.itemCode === -1) return 0;

        let added = 0;
        for (let r = startRow; r < sheetRows.length; r++) {
            const row = sheetRows[r];
            if (!row) continue;

            const codeStr = String(row[colMap.itemCode] || '').trim();
            const descStr = String((colMap.itemDesc !== -1 ? row[colMap.itemDesc] : '') || '').trim();
            if (!codeStr && !descStr) continue;

            // Skip title/header repeats or totals
            const upperCode = codeStr.toUpperCase();
            const upperDesc = descStr.toUpperCase();
            if (upperCode === 'ITEM CODE' || upperCode === 'ITEM' || upperCode === 'CODE' || upperCode === 'SR. NO.' || upperCode === 'SR NO' || upperCode === 'ROW LABELS') continue;
            if (upperDesc.startsWith('TOTAL') || upperDesc.startsWith('GRAND TOTAL') || upperDesc.startsWith('SUB TOTAL')) continue;
            if (upperCode.startsWith('TOTAL') || upperCode.startsWith('GRAND TOTAL')) continue;

            const issuedQty = colMap.issue !== -1 ? this.parseQty(row[colMap.issue]) : 0;
            const mrnQty = colMap.mrn !== -1 ? this.parseQty(row[colMap.mrn]) : 0;
            let netIssue = colMap.netIssue !== -1 ? this.parseQty(row[colMap.netIssue]) : 0;
            if (netIssue === 0 && (issuedQty > 0 || mrnQty > 0)) {
                netIssue = issuedQty - mrnQty;
            }

            let cons = colMap.consumption !== -1 ? this.parseQty(row[colMap.consumption]) : 0;
            let bal = colMap.balance !== -1 ? this.parseQty(row[colMap.balance]) : (netIssue - cons);
            if (colMap.consumption === -1 && colMap.balance !== -1 && netIssue > 0) {
                cons = Math.max(0, netIssue - bal);
            }

            // Ensure clean material key
            const matCode = codeStr || descStr;
            if (!matCode) continue;

            targetMaterials[matCode] = {
                code: matCode,
                desc: descStr || matCode,
                uom: colMap.uom !== -1 ? String(row[colMap.uom] || 'No') : 'No',
                prevConsumption: Math.round(cons * 1000) / 1000,
                netIssue: Math.round(netIssue * 1000) / 1000,
                balanceQty: Math.round(bal * 1000) / 1000
            };
            added++;
        }
        return added;
    },

    /**
     * High-speed Asynchronous Parsing with live progress and zero UI blocking
     */
    async parseOldRecoExcelAsync(arrayBuffer, defaultContractorName, onProgress) {
        if (typeof XLSX === 'undefined') {
            throw new Error('XLSX parser library is not loaded. Please refresh your browser.');
        }

        const wb = XLSX.read(arrayBuffer, {
            type: 'array',
            cellStyles: false,
            cellHTML: false,
            cellFormula: false,
            cellDates: false,
            cellNF: false
        });

        const sheetNames = wb.SheetNames || [];
        if (sheetNames.length === 0) {
            throw new Error('The uploaded Excel file contains no worksheets.');
        }

        const excludeSheets = [
            'debit rate', 'gadchiroli t-10__1458', 'non working 30.06.2026', 
            'bill summary', 'contractor bill details'
        ];

        // Multi-contractor check
        const candidateSheets = sheetNames.filter(s => {
            const sLower = this.cleanHeaderStr(s);
            return sLower && !excludeSheets.includes(sLower);
        });

        const existingDb = window.ContractorOldReco || window.DefaultContractorOldReco || { byContractorNorm: {} };
        const updatedDb = {
            meta: {
                extractedAt: new Date().toISOString(),
                contractorCount: 0,
                version: 'custom_upload'
            },
            byContractorNorm: Object.assign({}, existingDb.byContractorNorm || {})
        };

        let processedContractors = 0;

        if (candidateSheets.length > 2) {
            // Priority sort: if active contractor is selected, put their sheet first!
            const activeNorm = defaultContractorName ? this.normContractorName(defaultContractorName) : '';
            if (activeNorm) {
                candidateSheets.sort((a, b) => {
                    const aMatch = this.normContractorName(a) === activeNorm;
                    const bMatch = this.normContractorName(b) === activeNorm;
                    return (bMatch ? 1 : 0) - (aMatch ? 1 : 0);
                });
            }

            for (let i = 0; i < candidateSheets.length; i++) {
                const sName = candidateSheets[i];
                const sheet = wb.Sheets[sName];
                if (!sheet) continue;

                const contractorName = String(sName).trim();
                const normKey = this.normContractorName(contractorName);
                if (!normKey) continue;

                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                if (!rows || rows.length < 2) continue;

                const materials = (updatedDb.byContractorNorm[normKey] && updatedDb.byContractorNorm[normKey].materials)
                    ? Object.assign({}, updatedDb.byContractorNorm[normKey].materials)
                    : {};

                const added = this.extractMaterialsFromRows(rows, materials);
                if (added > 0) {
                    updatedDb.byContractorNorm[normKey] = {
                        contractorName: contractorName,
                        itemCount: Object.keys(materials).length,
                        consumedCount: Object.values(materials).filter(m => m.prevConsumption > 0).length,
                        materials: materials
                    };
                    processedContractors++;
                }

                if (i % 4 === 0) {
                    if (onProgress) {
                        onProgress({ current: i + 1, total: candidateSheets.length, contractor: contractorName });
                    }
                    await new Promise(r => setTimeout(r, 0));
                }
            }
        } else {
            // Single-sheet workbook or active sheet
            const targetSheetName = candidateSheets[0] || sheetNames[0];
            const sheet = wb.Sheets[targetSheetName];
            if (!sheet) throw new Error('Worksheet not found.');

            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            if (!rows || rows.length < 2) throw new Error('Worksheet contains insufficient rows.');

            const targetContractor = defaultContractorName || targetSheetName || 'Selected Contractor';
            const normKey = this.normContractorName(targetContractor);
            if (!normKey) throw new Error('Please select a contractor before uploading.');

            const materials = (updatedDb.byContractorNorm[normKey] && updatedDb.byContractorNorm[normKey].materials)
                ? Object.assign({}, updatedDb.byContractorNorm[normKey].materials)
                : {};

            const added = this.extractMaterialsFromRows(rows, materials);
            if (added === 0) {
                throw new Error("Unable to extract material reconciliation items from sheet '" + targetSheetName + "'. Please check the sheet headers.");
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
     * Synchronous wrapper for unit tests & backward compatibility
     */
    parseOldRecoExcel(arrayBuffer, defaultContractorName) {
        if (typeof XLSX === 'undefined') {
            throw new Error('XLSX parser library is not loaded.');
        }

        const wb = XLSX.read(arrayBuffer, {
            type: 'array',
            cellStyles: false,
            cellHTML: false,
            cellFormula: false,
            cellDates: false,
            cellNF: false
        });

        const sheetNames = wb.SheetNames || [];
        if (sheetNames.length === 0) {
            throw new Error('The uploaded Excel file contains no worksheets.');
        }

        const excludeSheets = [
            'debit rate', 'gadchiroli t-10__1458', 'non working 30.06.2026', 
            'bill summary', 'contractor bill details'
        ];

        const candidateSheets = sheetNames.filter(s => {
            const sLower = this.cleanHeaderStr(s);
            return sLower && !excludeSheets.includes(sLower);
        });

        const existingDb = window.ContractorOldReco || window.DefaultContractorOldReco || { byContractorNorm: {} };
        const updatedDb = {
            meta: {
                extractedAt: new Date().toISOString(),
                contractorCount: 0,
                version: 'custom_upload'
            },
            byContractorNorm: Object.assign({}, existingDb.byContractorNorm || {})
        };

        let processedContractors = 0;

        if (candidateSheets.length > 2) {
            for (const sName of candidateSheets) {
                const sheet = wb.Sheets[sName];
                if (!sheet) continue;

                const contractorName = String(sName).trim();
                const normKey = this.normContractorName(contractorName);
                if (!normKey) continue;

                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                if (!rows || rows.length < 2) continue;

                const materials = (updatedDb.byContractorNorm[normKey] && updatedDb.byContractorNorm[normKey].materials)
                    ? Object.assign({}, updatedDb.byContractorNorm[normKey].materials)
                    : {};

                const added = this.extractMaterialsFromRows(rows, materials);
                if (added > 0) {
                    updatedDb.byContractorNorm[normKey] = {
                        contractorName: contractorName,
                        itemCount: Object.keys(materials).length,
                        consumedCount: Object.values(materials).filter(m => m.prevConsumption > 0).length,
                        materials: materials
                    };
                    processedContractors++;
                }
            }
        } else {
            const targetSheetName = candidateSheets[0] || sheetNames[0];
            const sheet = wb.Sheets[targetSheetName];
            if (!sheet) throw new Error('Worksheet not found.');

            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            if (!rows || rows.length < 2) throw new Error('Worksheet contains insufficient rows.');

            const targetContractor = defaultContractorName || targetSheetName || 'Selected Contractor';
            const normKey = this.normContractorName(targetContractor);

            const materials = (updatedDb.byContractorNorm[normKey] && updatedDb.byContractorNorm[normKey].materials)
                ? Object.assign({}, updatedDb.byContractorNorm[normKey].materials)
                : {};

            const added = this.extractMaterialsFromRows(rows, materials);
            if (added === 0) {
                throw new Error("Unable to extract materials from sheet '" + targetSheetName + "'.");
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

    // ─── INDEXEDDB PERSISTENCE ───
    async saveCustomOldRecoToDb(recoData) {
        return new Promise((resolve) => {
            if (!window.indexedDB) {
                try {
                    const str = JSON.stringify(recoData);
                    if (str.length < 1000000) {
                        localStorage.setItem('billing_custom_old_reco_v1', str);
                    }
                } catch(e) {}
                return resolve(false);
            }
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

        // 0. Direct match by selectedContractorId
        if (this.selectedContractorId && this.selectedContractorId !== 'custom') {
            const rawId = String(this.selectedContractorId).toLowerCase().replace(/[^a-z0-9]/g, '');
            if (rawId && recoDb.byContractorNorm[rawId]) {
                return recoDb.byContractorNorm[rawId];
            }
            const firm = (this.contractorsList || []).find(c => c.id === this.selectedContractorId || (c.id && c.id.startsWith(this.selectedContractorId)));
            if (firm) {
                if (firm.workOrderNo) {
                    const fWo = String(firm.workOrderNo).trim();
                    for (const rec of Object.values(recoDb.byContractorNorm)) {
                        if (rec.workOrderNo && (rec.workOrderNo === fWo || fWo.includes(rec.workOrderNo))) {
                            return rec;
                        }
                    }
                }
                const fNorm = String(firm.name || '').toLowerCase().replace(/^m\/s\.?\s*/i, '').replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
                if (fNorm && recoDb.byContractorNorm[fNorm]) return recoDb.byContractorNorm[fNorm];
            }
        }

        // 1. Try work order number from invoiceData / projectMeta
        const rawWo = (this.invoiceData && this.invoiceData.workOrderNo) || (this.projectMeta && this.projectMeta.workOrderNo) || '';
        const wo = String(rawWo).trim();
        if (wo) {
            for (const rec of Object.values(recoDb.byContractorNorm)) {
                if (rec.workOrderNo && (rec.workOrderNo === wo || wo.includes(rec.workOrderNo))) {
                    return rec;
                }
            }
        }

        // 2. Try contractor name from selectedContractorName / invoiceData / projectMeta
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
        if (typeof this.showToast === 'function') this.showToast('Reading file: ' + name + '...', '⏳');
        await new Promise(r => setTimeout(r, 60));

        try {
            const arrayBuffer = await file.arrayBuffer();
            const res = await window.OldRecoImporterModule.parseOldRecoExcelAsync(
                arrayBuffer, 
                this.selectedContractorName,
                (p) => {
                    if (p && p.contractor && typeof this.showToast === 'function') {
                        this.showToast(`Reading sheets: ${p.current}/${p.total}...`, '⏳');
                    }
                }
            );
            const updatedDb = res.updatedDb;

            if (!window.DefaultContractorOldReco && window.ContractorOldReco) {
                window.DefaultContractorOldReco = window.ContractorOldReco;
            }

            window.ContractorOldReco = updatedDb;
            await window.OldRecoImporterModule.saveCustomOldRecoToDb(updatedDb);

            this.hasCustomOldReco = true;
            this.$forceUpdate();
            if (typeof this.showToast === 'function') {
                this.showToast(`Old Reconciliation Synced! (${res.processedContractors} contractors updated)`, 'Check');
            }
        } catch (err) {
            console.error('[OldRecoUpload Error]:', err);
            alert('Old Reconciliation Upload Error:\n' + (err.message || err));
            if (typeof this.showToast === 'function') {
                this.showToast('Failed: ' + (err.message || 'Unknown error'), 'Alert');
            }
        } finally {
            this.oldRecoUploading = false;
        }
    },

    async resetToDefaultOldReco() {
        if (!confirm('Are you sure you want to reset all old reconciliation data to defaults? Any custom uploaded files and edits will be cleared.')) return;
        try {
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
