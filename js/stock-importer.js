/**
 * @file Stock Importer Module
 * @description In-browser parser and manager for uploaded SAP Stock Excel files.
 * Parses 150k+ transactions in seconds using SheetJS, consolidates multiple
 * work orders per contractor, and persists custom stock to IndexedDB.
 *
 * @module StockImporterModule
 * @since v2.0
 */

window.StockImporterModule = {
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
     * Parses an uploaded Excel ArrayBuffer into the standard ContractorSapStock object.
     * @param {ArrayBuffer} arrayBuffer
     * @returns {Object} Standard ContractorSapStock data structure
     */
    parseStockExcel(arrayBuffer) {
        if (typeof XLSX === 'undefined') {
            throw new Error('XLSX parser library is not loaded. Please check your internet connection and refresh.');
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

        const sapCodeSheetName = sheetNames.find(s => s.toLowerCase().replace(/[^a-z0-9]/g, '').includes('sapcode'));
        const txnSheetName = sheetNames.find(s => {
            const clean = s.toLowerCase().replace(/[^a-z0-9]/g, '');
            return clean.includes('sheet1') || clean.includes('stock') || clean.includes('issue') || clean.includes('transaction');
        });

        if (sapCodeSheetName && txnSheetName) {
            return this.parseFullSapDump(wb, sapCodeSheetName, txnSheetName);
        } else {
            return this.parseGenericStockSheet(wb, sheetNames[0]);
        }
    },

    /**
     * Format 1: Full SAP Dump with "SAP Code" (contractor mappings) and "Sheet1" (transactions)
     */
    parseFullSapDump(wb, sapCodeSheetName, txnSheetName) {
        const sapWs = wb.Sheets[sapCodeSheetName];
        if (!sapWs) throw new Error(`Sheet "${sapCodeSheetName}" could not be opened.`);

        const groups = {};
        const dhToGroupKey = {};
        const woToGroupKey = {};

        let sapRangeEnd = 500;
        if (sapWs['!ref']) {
            const range = XLSX.utils.decode_range(sapWs['!ref']);
            sapRangeEnd = Math.min(range.e.r + 1, 3000);
        }

        for (let r = 4; r <= sapRangeEnd; r++) {
            const vendorCell = sapWs['B' + r];
            const dhCell = sapWs['C' + r];
            const nameCell = sapWs['D' + r];

            const vendor = vendorCell ? String(vendorCell.v).trim() : '';
            const dh = dhCell ? String(dhCell.v).trim() : '';
            const name = nameCell ? String(nameCell.v).trim() : '';

            if (!dh && !name) continue;

            let key = this.normContractorName(name);
            if (!key && dh) {
                const m = dh.match(/\b\d{8}\b/);
                if (m && woToGroupKey[m[0]]) key = woToGroupKey[m[0]];
            }
            if (!key) continue;

            if (!groups[key]) {
                groups[key] = {
                    key,
                    displayName: (name || dh).replace(/\n+/g, ' ').trim(),
                    vendorCode: vendor,
                    wos: new Set(),
                    dhs: new Set(),
                    rawNorms: new Set()
                };
            }

            if (name) {
                const cleanName = name.replace(/\n+/g, ' ').trim();
                groups[key].rawNorms.add(this.normRawKey(cleanName));
                groups[key].rawNorms.add(this.normContractorName(cleanName));
                if (!groups[key].displayName || (groups[key].displayName.includes('(') && !cleanName.includes('('))) {
                    groups[key].displayName = cleanName;
                }
            }

            if (vendor && !groups[key].vendorCode) {
                groups[key].vendorCode = vendor;
            }

            if (dh) {
                groups[key].dhs.add(dh);
                dhToGroupKey[dh] = key;
                const m = dh.match(/\b\d{8}\b/);
                if (m) {
                    groups[key].wos.add(m[0]);
                    woToGroupKey[m[0]] = key;
                    dhToGroupKey[m[0]] = key;
                }
            }
        }

        const s1 = wb.Sheets[txnSheetName];
        if (!s1) throw new Error(`Transaction sheet "${txnSheetName}" could not be opened.`);

        let txnRangeEnd = 200000;
        if (s1['!ref']) {
            const range = XLSX.utils.decode_range(s1['!ref']);
            txnRangeEnd = range.e.r + 1;
        }

        const groupMaterials = {};
        let matchedTxns = 0;

        for (let r = 2; r <= txnRangeEnd; r++) {
            const dhCell = s1['P' + r];
            const matCell = s1['I' + r];
            if (!dhCell || !matCell) continue;

            const dh = String(dhCell.v).trim();
            const mat = String(matCell.v).trim();
            if (!dh || !mat) continue;

            let key = dhToGroupKey[dh];
            if (!key) {
                const m = dh.match(/\b\d{8}\b/);
                if (m && woToGroupKey[m[0]]) key = woToGroupKey[m[0]];
            }
            if (!key) continue;

            matchedTxns++;
            const descCell = s1['J' + r];
            const uomCell = s1['K' + r];
            const qtyCell = s1['L' + r];

            const desc = descCell ? String(descCell.v).trim() : mat;
            const uom = uomCell ? String(uomCell.v).trim() : 'No';
            const qty = qtyCell ? Number(qtyCell.v) || 0 : 0;

            if (!groupMaterials[key]) groupMaterials[key] = {};
            if (!groupMaterials[key][mat]) {
                groupMaterials[key][mat] = {
                    code: mat,
                    desc,
                    uom,
                    grossIssue: 0,
                    mrnReturn: 0,
                    issuedQty: 0
                };
            }

            if (qty > 0) {
                groupMaterials[key][mat].grossIssue += qty;
            } else if (qty < 0) {
                groupMaterials[key][mat].mrnReturn += Math.abs(qty);
            }
            groupMaterials[key][mat].issuedQty += qty;
        }

        return this.buildOutputRecord(groups, dhToGroupKey, groupMaterials, matchedTxns, 'Full SAP Dump');
    },

    /**
     * Format 2: Generic / Single-Sheet Stock Summary
     */
    parseGenericStockSheet(wb, sheetName) {
        const ws = wb.Sheets[sheetName];
        if (!ws) throw new Error(`Worksheet "${sheetName}" could not be opened.`);

        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (rows.length < 2) {
            throw new Error(`Sheet "${sheetName}" does not contain enough data rows.`);
        }

        let headerRowIdx = 0;
        let cNameCol = -1, woCol = -1, matCol = -1, descCol = -1, uomCol = -1, grossCol = -1, mrnCol = -1, netCol = -1;

        for (let r = 0; r < Math.min(rows.length, 5); r++) {
            const h = (rows[r] || []).map(cell => String(cell || '').toLowerCase().trim());
            cNameCol = h.findIndex(c => c.includes('contractor') || c.includes('vendor') || c.includes('party'));
            woCol = h.findIndex(c => c.includes('work order') || c.includes('wo') || c.includes('order no') || c.includes('doc header'));
            matCol = h.findIndex(c => c.includes('material') || c.includes('sap code') || c.includes('item code') || c.includes('row label'));
            descCol = h.findIndex(c => c.includes('description') || c.includes('item name') || c.includes('particular'));
            uomCol = h.findIndex(c => c.includes('unit') || c.includes('uom'));
            grossCol = h.findIndex(c => (c.includes('gross') && c.includes('issue')) || c === 'issue' || c === 'gross');
            mrnCol = h.findIndex(c => c.includes('mrn') || c.includes('return'));
            netCol = h.findIndex(c => c.includes('net issue') || c === 'net' || c.includes('total issue'));

            if (matCol !== -1 && (grossCol !== -1 || netCol !== -1)) {
                headerRowIdx = r;
                break;
            }
        }

        if (matCol === -1) {
            throw new Error('Could not identify Material Code column in uploaded sheet. Please ensure headers like "Material", "Issue", "MRN", "Net Issue" exist.');
        }

        const groups = {};
        const dhToGroupKey = {};
        const groupMaterials = {};
        let matchedTxns = 0;

        for (let r = headerRowIdx + 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;

            const mat = String(row[matCol] || '').trim();
            if (!mat || mat.toLowerCase() === 'total' || mat.toLowerCase() === 'sum') continue;

            const name = cNameCol !== -1 ? String(row[cNameCol] || '').trim() : 'Uploaded Stock';
            const wo = woCol !== -1 ? String(row[woCol] || '').trim() : '';
            const desc = descCol !== -1 ? String(row[descCol] || '').trim() : mat;
            const uom = uomCol !== -1 ? String(row[uomCol] || '').trim() : 'No';

            let gross = grossCol !== -1 ? Number(row[grossCol]) || 0 : 0;
            let mrn = mrnCol !== -1 ? Number(row[mrnCol]) || 0 : 0;
            let net = netCol !== -1 ? Number(row[netCol]) || 0 : (gross - mrn);

            if (grossCol === -1 && netCol !== -1) gross = net + mrn;

            const key = this.normContractorName(name) || 'uploadedstock';
            if (!groups[key]) {
                groups[key] = {
                    key,
                    displayName: name,
                    vendorCode: '',
                    wos: new Set(),
                    dhs: new Set(),
                    rawNorms: new Set([this.normRawKey(name), key])
                };
            }

            if (wo) {
                groups[key].dhs.add(wo);
                dhToGroupKey[wo] = key;
                const m = wo.match(/\b\d{8}\b/);
                if (m) {
                    groups[key].wos.add(m[0]);
                    dhToGroupKey[m[0]] = key;
                }
            }

            if (!groupMaterials[key]) groupMaterials[key] = {};
            if (!groupMaterials[key][mat]) {
                groupMaterials[key][mat] = {
                    code: mat,
                    desc,
                    uom,
                    grossIssue: 0,
                    mrnReturn: 0,
                    issuedQty: 0
                };
            }

            groupMaterials[key][mat].grossIssue += gross;
            groupMaterials[key][mat].mrnReturn += mrn;
            groupMaterials[key][mat].issuedQty += net;
            matchedTxns++;
        }

        return this.buildOutputRecord(groups, dhToGroupKey, groupMaterials, matchedTxns, 'Generic Stock Summary');
    },

    buildOutputRecord(groups, dhToGroupKey, groupMaterials, matchedTxns, source) {
        const outputData = {
            meta: {
                uploadedAt: new Date().toISOString(),
                source,
                matchedTxns,
                contractorsWithIssues: Object.keys(groupMaterials).length,
                consolidatedWorkOrders: Object.keys(dhToGroupKey).length
            },
            byDocHeader: {},
            byContractorNorm: {}
        };

        for (const [key, mats] of Object.entries(groupMaterials)) {
            const g = groups[key] || {};
            const cleanMats = {};
            let totalGross = 0;
            let totalMrn = 0;
            let totalNet = 0;

            for (const [code, item] of Object.entries(mats)) {
                const gross = Math.round(item.grossIssue * 1000) / 1000;
                const mrn = Math.round(item.mrnReturn * 1000) / 1000;
                const net = Math.round(item.issuedQty * 1000) / 1000;

                if (gross !== 0 || mrn !== 0 || net !== 0) {
                    cleanMats[code] = {
                        code: item.code,
                        desc: item.desc,
                        uom: item.uom,
                        grossIssue: gross,
                        mrnReturn: mrn,
                        netIssue: net,
                        issuedQty: net
                    };
                    totalGross += gross;
                    totalMrn += mrn;
                    totalNet += net;
                }
            }

            if (Object.keys(cleanMats).length > 0) {
                const wosArray = Array.from(g.wos || []);
                const dhsArray = Array.from(g.dhs || []);
                const docHeaderDisplay = wosArray.length > 0 ? wosArray.join(', ') : (dhsArray[0] || '');

                const cRecord = {
                    docHeader: docHeaderDisplay,
                    allWorkOrders: wosArray,
                    vendorCode: g.vendorCode || '',
                    contractorName: g.displayName || '',
                    materialCount: Object.keys(cleanMats).length,
                    totalGrossIssue: Math.round(totalGross * 1000) / 1000,
                    totalMrnReturn: Math.round(totalMrn * 1000) / 1000,
                    totalNetIssue: Math.round(totalNet * 1000) / 1000,
                    materials: cleanMats
                };

                outputData.byContractorNorm[key] = cRecord;
                if (g.rawNorms) {
                    g.rawNorms.forEach(rn => { outputData.byContractorNorm[rn] = cRecord; });
                }
                wosArray.forEach(wo => { outputData.byDocHeader[wo] = cRecord; });
                dhsArray.forEach(dh => { outputData.byDocHeader[dh] = cRecord; });
            }
        }

        for (const [dh, key] of Object.entries(dhToGroupKey)) {
            if (outputData.byContractorNorm[key] && !outputData.byDocHeader[dh]) {
                outputData.byDocHeader[dh] = outputData.byContractorNorm[key];
            }
        }

        return outputData;
    },

    // ─── VUE METHODS (merged into allMethods) ─────────────────────────
    async handleStockFileUpload(e) {
        const file = e && e.target && e.target.files && e.target.files[0];
        if (!file) return;
        if (e.target) e.target.value = '';

        const name = file.name || 'file.xlsx';
        if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
            this.showToast('Please upload an Excel file (.xlsx or .xls)', 'Alert');
            return;
        }

        this.stockUploading = true;
        this.showToast('Reading and parsing stock file: ' + name + ' (Please wait)...', '⏳');
        await new Promise(r => setTimeout(r, 100));

        try {
            const arrayBuffer = await file.arrayBuffer();
            const stockData = window.StockImporterModule.parseStockExcel(arrayBuffer);

            if (!window.DefaultContractorSapStock && window.ContractorSapStock) {
                window.DefaultContractorSapStock = window.ContractorSapStock;
            }

            if (typeof BillingStorage !== 'undefined') {
                await BillingStorage.setItem('billing_custom_sap_stock', stockData);
            }

            window.ContractorSapStock = stockData;
            this.hasCustomStock = true;
            this.customStockMeta = stockData.meta;

            this.$forceUpdate();
            const count = stockData.meta.contractorsWithIssues || Object.keys(stockData.byContractorNorm || {}).length;
            this.showToast(`Stock Updated! ${count} contractors synced (${stockData.meta.matchedTxns || 0} items).`, 'Check');
        } catch (err) {
            console.error('[StockUpload Error]:', err);
            alert('Stock Upload Error:\n' + (err.message || err));
            this.showToast('Failed to process stock Excel: ' + (err.message || 'Unknown error'), 'Alert');
        } finally {
            this.stockUploading = false;
        }
    },

    async resetToDefaultStock() {
        if (!confirm('Are you sure you want to reset to the default built-in stock database?')) return;
        try {
            if (typeof BillingStorage !== 'undefined') {
                await BillingStorage.removeItem('billing_custom_sap_stock');
            }
            if (window.DefaultContractorSapStock) {
                window.ContractorSapStock = window.DefaultContractorSapStock;
            }
            this.hasCustomStock = false;
            this.customStockMeta = null;
            this.$forceUpdate();
            this.showToast('Reset to default built-in stock database.', 'Check');
        } catch (e) {
            console.error('Reset stock error:', e);
        }
    }
};
