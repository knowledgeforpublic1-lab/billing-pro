
/**
 * Normalizes input buffer to a valid binary ZIP / Excel buffer.
 * Automatically handles legacy comma-delimited byte strings from Apps Script ("80,75,3,4...").
 */
function normalizeToBinaryBuffer(input) {
    if (!input) return input;
    let buf;
    if (input instanceof ArrayBuffer) {
        buf = new Uint8Array(input);
    } else if (input instanceof Uint8Array) {
        buf = input;
    } else if (typeof input === 'string') {
        const enc = new TextEncoder();
        buf = enc.encode(input);
    } else {
        return input;
    }

    // Check if it starts with '80,75,3,4'
    let headerStr = '';
    const checkLen = Math.min(buf.length, 60);
    for (let i = 0; i < checkLen; i++) headerStr += String.fromCharCode(buf[i]);

    if (/^80\s*,\s*75\s*,\s*3\s*,\s*4/.test(headerStr)) {
        let fullStr = '';
        try {
            const dec = new TextDecoder('utf-8');
            fullStr = dec.decode(buf);
        } catch(e) {
            for (let i = 0; i < buf.length; i++) fullStr += String.fromCharCode(buf[i]);
        }
        const parts = fullStr.split(',');
        const u8 = new Uint8Array(parts.length);
        for (let i = 0; i < parts.length; i++) {
            let n = parseInt(parts[i], 10);
            if (isNaN(n)) continue;
            if (n < 0) n = 256 + n;
            u8[i] = n;
        }
        return u8.buffer;
    }

    if (buf.byteOffset === 0 && buf.byteLength === buf.buffer.byteLength) {
        return buf.buffer;
    }
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

/**
 * @file Cloud Sync & Local Storage Module
 * @description Handles all data persistence: localStorage save/load, MongoDB cloud sync,
 * conflict resolution, retry logic, heartbeat sync, and tab-close flush.
 * 
 * Key functions:
 * - saveToStorage(): Saves Vue state to localStorage + schedules cloud sync
 * - loadFromStorage(): Loads from MongoDB or localStorage (server-wins logic)
 * - syncToMongoNow(): Pushes current state to MongoDB via POST
 * - flushPendingSync(): Fire-and-forget sync on tab close (keepalive fetch)
 * - _scheduleSyncRetry(): Auto-retry with exponential backoff (3s→30s, max 5)
 * - Heartbeat: 15s interval checks for unsynced changes
 *
 * @module SyncModule
 * @since v2.0
 */

window.SyncModule = {
    async loadSavedBillsList() {
        this.isLoadingBills = true;
        try {
            const res = await fetch('/api/bills', {
                headers: (() => { const h = {}; try { const k = localStorage.getItem('billing_api_key'); if (k) h['x-api-key'] = k; } catch(e){} return h; })()
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.success && Array.isArray(data.bills)) {
                    this.savedBillsList = data.bills;
                }
            }
        } catch(e) {
            console.error('Failed to load bills list', e);
        } finally {
            this.isLoadingBills = false;
        }
    },
    async deleteBillFromCloud(dataId) {
        try {
            const headers = { 'Content-Type': 'application/json' };
            try { const k = localStorage.getItem('billing_api_key'); if (k) headers['x-api-key'] = k; } catch(e) {}
            const res = await fetch('/api/billing/delete', {
                method: 'POST',
                headers,
                body: JSON.stringify({ dataId })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Delete failed');
            }
            try { localStorage.removeItem('lk_billing_state_' + dataId); } catch(e) {}
            return true;
        } catch(e) {
            this.showToast('Delete failed: ' + e.message, '⚠️');
            return false;
        }
    },
    openSavedBillsManager(tab) {
        this.savedBillsSearchQuery = '';
        this.savedBillsModalTab = tab || 'drive'; // Directly connect & open Google Drive tab by default
        this.showSavedBillsModal = true;
        if (this.savedBillsModalTab === 'drive') {
            this.fetchGoogleDriveFiles();
        } else {
            this.loadSavedBillsList();
        }
    },
    switchSavedBillsTab(tab) {
        this.savedBillsModalTab = tab;
        if (tab === 'drive') {
            if (!this.gdriveFilesList || this.gdriveFilesList.length === 0) {
                this.fetchGoogleDriveFiles();
            }
        } else {
            this.loadSavedBillsList();
        }
    },
    async fetchGoogleDriveFiles() {
        this.isLoadingDriveFiles = true;
        this.gdriveFilesError = '';
        try {
            const webhookUrl = typeof this.getEffectiveDriveWebhookUrl === 'function' ? this.getEffectiveDriveWebhookUrl() : '';
            let files = null;
            let rootFolderUrl = '';

            // Attempt 1: Server proxy (/api/gdrive-files)
            try {
                const headers = {};
                try { const k = localStorage.getItem('billing_api_key'); if (k) headers['x-api-key'] = k; } catch(e) {}
                const res = await fetch('/api/gdrive-files?url=' + encodeURIComponent(webhookUrl), { headers });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data.success && Array.isArray(data.files)) {
                    files = data.files;
                    rootFolderUrl = data.rootFolderUrl || '';
                }
            } catch(e) {}

            // Attempt 2: Direct call to Google Apps Script Web App (CORS supported)
            if (!files && webhookUrl) {
                try {
                    const directUrl = webhookUrl + (webhookUrl.includes('?') ? '&' : '?') + 'action=list';
                    const directRes = await fetch(directUrl);
                    const directData = await directRes.json().catch(() => ({}));
                    if (directData && directData.ok && Array.isArray(directData.files)) {
                        files = directData.files;
                        rootFolderUrl = directData.rootFolderUrl || '';
                    }
                } catch(e) {}
            }

            if (files && files.length >= 0) {
                this.gdriveFilesList = files;
                this.gdriveRootFolderUrl = rootFolderUrl;
            } else {
                this.gdriveFilesError = 'Google Drive se connect nahi ho saka. Kripya apna internet connection ya Webhook settings check karein.';
            }
        } catch(err) {
            this.gdriveFilesError = 'Connection error: ' + (err.message || 'Drive connect nahi ho paya');
        } finally {
            this.isLoadingDriveFiles = false;
        }
    },
    async openBillFromGoogleDrive(file) {
        if (!file || !file.id) return;
        this.openingDriveFileId = file.id;
        this.showToast(`Google Drive se [${file.name}] download ho rahi hai... ⏳`, '☁️');
        try {
            const webhookUrl = typeof this.getEffectiveDriveWebhookUrl === 'function' ? this.getEffectiveDriveWebhookUrl() : '';
            let fileData = null;

            // Attempt 1: Server proxy (/api/gdrive-file)
            try {
                const headers = {};
                try { const k = localStorage.getItem('billing_api_key'); if (k) headers['x-api-key'] = k; } catch(e) {}
                const res = await fetch(`/api/gdrive-file?url=${encodeURIComponent(webhookUrl)}&fileId=${encodeURIComponent(file.id)}`, { headers });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data.success && data.fileData) {
                    fileData = data.fileData;
                }
            } catch(e) {}

            // Attempt 2: Direct call to Google Apps Script Web App
            if (!fileData && webhookUrl) {
                try {
                    const directUrl = webhookUrl + (webhookUrl.includes('?') ? '&' : '?') + `action=getFile&fileId=${encodeURIComponent(file.id)}`;
                    const directRes = await fetch(directUrl);
                    const directData = await directRes.json().catch(() => ({}));
                    if (directData && directData.ok && directData.fileData) {
                        fileData = directData.fileData;
                    }
                } catch(e) {}
            }

            if (!fileData) {
                throw new Error('Google Drive se file download nahi ho payi. File permissions ya internet check karein.');
            }

            // Convert base64 to binary buffer
            const binary = window.atob(fileData);
            const len = binary.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            const normalizedBuffer = typeof normalizeToBinaryBuffer === 'function' ? normalizeToBinaryBuffer(bytes.buffer) : bytes.buffer;
            await this.parseAndLoadBillWorkbook(normalizedBuffer, file.name);
        } catch(err) {
            console.error('Failed to open bill from Google Drive:', err);
            this.showToast('Drive file open fail: ' + (err.message || err), '❌');
            alert('Google Drive file open nahi ho payi:\n' + (err.message || err));
        } finally {
            this.openingDriveFileId = null;
        }
    },
    triggerLocalBillFileBrowse() {
        const input = document.getElementById('billFileInput');
        if (input) {
            input.value = '';
            input.click();
        }
    },
    async handleBillFileSelect(event) {
        const file = event && event.target && event.target.files && event.target.files[0];
        if (!file) return;
        this.showToast(`Loading [${file.name}]... ⏳`, '📂');
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const buffer = e.target.result;
                    await this.parseAndLoadBillWorkbook(buffer, file.name);
                } catch(err) {
                    console.error('File parsing error:', err);
                    this.showToast('File parse error: ' + (err.message || err), '❌');
                    alert('Excel file parse nahi ho payi: ' + (err.message || err));
                }
            };
            reader.onerror = () => {
                this.showToast('File read error', '❌');
            };
            reader.readAsArrayBuffer(file);
        } catch(err) {
            this.showToast('File read fail: ' + (err.message || err), '❌');
        }
    },
    async parseAndLoadBillWorkbook(buffer, fileName) {
        if (typeof normalizeToBinaryBuffer === 'function') {
            buffer = normalizeToBinaryBuffer(buffer);
        }
        this.isParsingBillFile = true;
        try {
            if (!window.ExcelJS) {
                throw new Error('ExcelJS library load nahi hai. Page refresh karein.');
            }
            const workbook = new window.ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);

            const invSheet = workbook.getWorksheet('Tax Invoice');
            if (!invSheet) {
                throw new Error('Is Excel file me "Tax Invoice" sheet nahi mili. Kripya Billing Pro dwara export ki gayi invoice file chunein.');
            }

            // Parse Project Name from Row 2
            const r2 = String(invSheet.getCell('A2').value || '');
            const pMatch = r2.match(/Project\s*Name\s*:\s*(.*)/i);
            if (pMatch && pMatch[1]) {
                if (!this.projectMeta) this.projectMeta = {};
                this.projectMeta.projectName = pMatch[1].trim();
            }

            // Parse Client Details
            const r3 = String(invSheet.getCell('A3').value || '');
            const cMatch = r3.match(/To\s*:-\s*(.*)/i);
            if (cMatch && cMatch[1]) this.invoiceData.clientName = cMatch[1].trim();
            this.invoiceData.clientAddress = String(invSheet.getCell('A4').value || '').trim();
            const r5 = String(invSheet.getCell('A5').value || '');
            const gMatch = r5.match(/GSTIN\s*:\s*(.*)/i);
            if (gMatch && gMatch[1]) this.invoiceData.clientGstin = gMatch[1].trim();

            // Parse Contractor Name
            const r6 = String(invSheet.getCell('A6').value || '');
            const contMatch = r6.match(/Name\s*of\s*Contractor\s*:-\s*(.*)/i);
            let extractedContractor = contMatch && contMatch[1] ? contMatch[1].trim() : String(invSheet.getCell('D7').value || '').trim();
            if (extractedContractor) {
                this.invoiceData.contractorName = extractedContractor;
                if (!this.projectMeta) this.projectMeta = {};
                this.projectMeta.contractorName = extractedContractor;

                // Try to match firm in contractorsList
                const firmClean = extractedContractor.replace(/^M\/[sS]\.?\s*/i, '').trim().toLowerCase();
                const matchedFirm = (this.contractorsList || []).find(c => (c.name || '').toLowerCase().includes(firmClean) || firmClean.includes((c.name || '').toLowerCase()));
                if (matchedFirm) {
                    this.selectedContractorId = matchedFirm.id;
                }
            }

            // Invoice No & RA No
            const invNo = String(invSheet.getCell('B7').value || '').trim();
            if (invNo) {
                this.invoiceData.invoiceNo = invNo;
                if (!this.projectMeta) this.projectMeta = {};
                this.projectMeta.billNo = invNo;

                const raMatch = invNo.match(/(?:RA|BILL)[\s\/\-_]*(\d+[A-Za-z0-9\-_]*)/i);
                if (raMatch && raMatch[1]) {
                    this.projectMeta.raNo = raMatch[1];
                    this.invoiceData.raNo = raMatch[1];
                }
            }

            // Work Order No & Date & Contractor GSTIN
            const r8 = String(invSheet.getCell('B8').value || '').trim();
            const woMatch = r8.match(/^(.*?)(?:\s+Dt\s*:\s*(.*))?$/i);
            if (woMatch) {
                this.invoiceData.workOrderNo = (woMatch[1] || '').trim();
                if (woMatch[2]) {
                    const rawWo = woMatch[2].trim();
                    this.invoiceData.workOrderDate = typeof this.normalizeDateToYYYYMMDD === 'function'
                        ? this.normalizeDateToYYYYMMDD(rawWo)
                        : (typeof normalizeDateToYYYYMMDD === 'function' ? normalizeDateToYYYYMMDD(rawWo) : rawWo);
                }
            }
            this.invoiceData.contractorGstin = String(invSheet.getCell('D8').value || '').trim();

            // Invoice Date & PAN (normalize to YYYY-MM-DD for HTML input)
            const rawInvDate = invSheet.getCell('B9').value;
            this.invoiceData.invoiceDate = typeof this.normalizeDateToYYYYMMDD === 'function'
                ? this.normalizeDateToYYYYMMDD(rawInvDate)
                : (typeof normalizeDateToYYYYMMDD === 'function' ? normalizeDateToYYYYMMDD(rawInvDate) : String(rawInvDate || '').trim());
            this.invoiceData.contractorPan = String(invSheet.getCell('D9').value || '').trim();

            // Division & Location
            this.invoiceData.divisionName = String(invSheet.getCell('B10').value || '').trim();
            this.invoiceData.locationName = String(invSheet.getCell('D10').value || '').trim();

            // Sub-Division & Feeder
            this.invoiceData.subDivName = String(invSheet.getCell('B11').value || '').trim();
            this.invoiceData.feederName = String(invSheet.getCell('D11').value || '').trim();

            // Items starting from Row 13
            const newItems = [];
            let rowIdx = 13;
            while (rowIdx <= invSheet.rowCount) {
                const row = invSheet.getRow(rowIdx);
                const srVal = row.getCell(1).value;
                const descVal = String(row.getCell(2).value || '').trim();
                const col4Val = String(row.getCell(4).value || '').trim();

                if (col4Val === 'Total Erection Amount' || descVal.includes('Name of Account') || srVal === 'Name of Account:') {
                    break;
                }

                if (descVal) {
                    const sr = String(srVal || (newItems.length + 1)).trim();
                    const unit = String(row.getCell(3).value || 'Nos').trim();
                    const qCell = row.getCell(4).value;
                    const qty = typeof qCell === 'object' && qCell !== null ? (qCell.result || 0) : Number(qCell || 0);
                    const aCell = row.getCell(5).value;
                    const amount = typeof aCell === 'object' && aCell !== null ? (aCell.result || 0) : Number(aCell || 0);

                    let actKey = '';
                    const actMatch = descVal.match(/^(?:Activity\s+)?([A-Za-z0-9]+)\s*:/i);
                    if (actMatch) actKey = actMatch[1];

                    newItems.push({
                        srNo: sr,
                        actKey: actKey,
                        desc: descVal,
                        unit: unit,
                        qty: isNaN(qty) ? 1 : qty,
                        amount: isNaN(amount) ? 0 : amount,
                        manual: !actKey
                    });
                }
                rowIdx++;
            }

            if (newItems.length > 0) {
                this.invoiceData.items = newItems;
            }

            // Parse Bank details & GST
            while (rowIdx <= invSheet.rowCount) {
                const row = invSheet.getRow(rowIdx);
                const c1 = String(row.getCell(1).value || '').trim();
                const c2 = String(row.getCell(2).value || '').trim();
                const c4 = String(row.getCell(4).value || '').trim();

                if (c1.includes('Name of Account') || c1.includes('Account:')) {
                    this.invoiceData.bankAccountName = c2;
                } else if (c1.includes('Bank A/C')) {
                    this.invoiceData.bankAccountNo = c2;
                } else if (c1.includes('Bank IFSC')) {
                    this.invoiceData.bankIfsc = c2;
                } else if (c1.includes('Bank Name')) {
                    this.invoiceData.bankName = c2;
                }

                if (c4.includes('CGST')) {
                    this.invoiceData.gstType = 'CGST_SGST';
                } else if (c4.includes('IGST')) {
                    this.invoiceData.gstType = 'IGST';
                }
                rowIdx++;
            }

            // Parse Activity Sheets if present
            workbook.worksheets.forEach(ws => {
                const m = ws.name.match(/^Act\s+([A-Za-z0-9]+)$/i);
                if (m && m[1]) {
                    const actKey = m[1];
                    const r6 = ws.getRow(6);
                    let numLocs = 0;
                    let c = 4;
                    while (c <= ws.columnCount) {
                        const headerVal = String(r6.getCell(c).value || '').trim();
                        if (headerVal === 'Rate' || headerVal.includes('100%') || !headerVal) break;
                        numLocs++;
                        c++;
                    }

                    if (numLocs > 0) {
                        let matRow = 7;
                        const matQtys = [];
                        while (matRow <= ws.rowCount) {
                            const row = ws.getRow(matRow);
                            const descVal = String(row.getCell(2).value || '').trim();
                            if (!descVal || descVal === 'Total' || descVal.toUpperCase().includes('TOTAL')) break;

                            const rowQtys = [];
                            for (let locIdx = 0; locIdx < numLocs; locIdx++) {
                                const val = row.getCell(4 + locIdx).value;
                                const q = (val === '' || val === null || val === undefined) ? '' : Number(val);
                                rowQtys.push(isNaN(q) ? '' : q);
                            }
                            matQtys.push(rowQtys);
                            matRow++;
                        }

                        if (matQtys.length > 0) {
                            const transposed = [];
                            for (let locIdx = 0; locIdx < numLocs; locIdx++) {
                                const locArr = [];
                                for (let matIdx = 0; matIdx < matQtys.length; matIdx++) {
                                    locArr.push(matQtys[matIdx][locIdx] !== undefined ? matQtys[matIdx][locIdx] : '');
                                }
                                transposed.push(locArr);
                            }
                            if (!this.activityQuantities) this.activityQuantities = {};
                            this.activityQuantities[actKey] = transposed;
                        }
                    }
                }
            });

            // Set up Bill ID in Database & LocalStorage
            const cleanBillNo = (this.projectMeta.billNo || 'imported_bill').replace(/[\/\\:*?"<>|\s]/g, '_');
            const dataId = 'bill-' + cleanBillNo;
            this.activeBillId = dataId;
            try { localStorage.setItem('lk_billing_active_bill_id', dataId); } catch(e) {}

            this.saveToStorage();
            if (typeof this.saveBillStateToMongo === 'function') {
                await this.saveBillStateToMongo(dataId, {
                    billNo: this.projectMeta.billNo || '',
                    raNo: this.projectMeta.raNo || '',
                    billDate: this.invoiceData.invoiceDate || '',
                    contractorName: this.projectMeta.contractorName || '',
                    projectName: this.projectMeta.projectName || ''
                });
            }

            // Switch to Tax Invoice view and close modal
            this.currentView = 3;
            this.showSavedBillsModal = false;
            this.showToast(`Invoice [${this.projectMeta.billNo || fileName}] successfully opened! 🎉`, '✅');
        } finally {
            this.isParsingBillFile = false;
        }
    },
    async openNewBillModal() {
        return await this.startNewBlankBill();
    },
    async startNewBlankBill() {
        if (this._isStartingNewBill) return;
        this._isStartingNewBill = true;
        try {
            this.showToast('Saving current bill before starting new...', '⏳');
            try { await this.syncToMongoNow({ manual: true, force: true }); } catch(e) { console.warn(e); }

            // 1. Reset all manual quantities, extra items, calculator inputs, and invoice entries
            this.resetAllManualDataKeepMapping();

            // 2. Completely blank out Bill No, RA No, Contractor, and Metadata
            this.selectedContractorId = '';
            this.contractorDropdownSearch = '';
            this.reconContractorDropdownOpen = false;
            this.contractorDropdownOpen = false;

            const today = new Date().toISOString().slice(0, 10);
            if (!this.projectMeta) this.projectMeta = {};
            this.projectMeta.billNo = '';
            this.projectMeta.raNo = '';
            this.projectMeta.billDate = today;
            this.projectMeta.contractorName = '';
            this.projectMeta.workOrderNo = '';
            if (!this.projectMeta.projectName) this.projectMeta.projectName = 'RDSS T-10 GADCHIROLI';

            if (!this.invoiceData) this.invoiceData = {};
            this.invoiceData.invoiceNo = '';
            this.invoiceData.raNo = '';
            this.invoiceData.invoiceDate = today;
            this.invoiceData.contractorName = '';
            this.invoiceData.workOrderNo = '';
            this.invoiceData.workOrderDate = '';
            this.invoiceData.contractorPan = '';
            this.invoiceData.contractorGstin = '';
            this.invoiceData.bankAccountName = '';
            this.invoiceData.bankAccountNo = '';
            this.invoiceData.bankIfsc = '';
            this.invoiceData.bankName = '';
            this.invoiceData.divisionName = '';
            this.invoiceData.subDivName = '';
            this.invoiceData.feederName = '';
            this.invoiceData.items = [];
            this.invoiceData.basicTotal = 0;
            this.invoiceData.gstTotal = 0;
            this.invoiceData.grandTotal = 0;
            this.invoiceData.words = '';

            if (this.newBillForm) {
                this.newBillForm.billNo = '';
                this.newBillForm.raNo = '';
                this.newBillForm.selectedContractorId = '';
            }

            // Keep default client company (Ashoka Buildcon Ltd.)
            const comp = (this.companiesList || []).find(c => c.id === (this.selectedCompanyId || 'ashoka_buildcon'));
            if (comp) {
                this.selectedCompanyId = comp.id;
                this.invoiceData.clientName = comp.name;
                this.invoiceData.clientAddress = comp.address;
                this.invoiceData.clientGstin = comp.gstin;
            }

            // 3. Generate unique activeBillId for clean isolation
            const newBillId = 'bill_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
            this.activeBillId = newBillId;
            this.cloudRev = 0;
            this.lastSentHash = '';
            try { localStorage.setItem('lk_billing_active_bill_id', newBillId); } catch(e) {}

            // 4. Save blank slate to local and cloud
            this.saveToStorage();
            try { await this.syncToMongoNow({ manual: true, force: true }); } catch(e) { console.warn(e); }

            // 5. Ensure modals are closed
            this.showNewBillModal = false;
            this.showSavedBillsModal = false;

            // 6. Switch view if user was not already on invoice or reconciliation
            if (this.currentView !== 'reconciliation' && this.currentView !== 'invoice') {
                if (typeof this.switchView === 'function') {
                    this.switchView('invoice');
                } else {
                    this.currentView = 'invoice';
                }
            }

            if (typeof this.loadSavedBillsList === 'function') {
                this.loadSavedBillsList();
            }
            if (typeof this.takeSnapshot === 'function') this.takeSnapshot();
            this.showToast('Pichla bill save ho gaya! Naya bill puri tarah BLANK ready hai — Contractor aur Bill No bharein.', '✅');
        } finally {
            this._isStartingNewBill = false;
        }
    },
    updateBillNo(val) {
        const clean = String(val || '').trim();
        if (!this.projectMeta) this.projectMeta = {};
        this.projectMeta.billNo = clean;
        if (!this.invoiceData) this.invoiceData = {};
        this.invoiceData.invoiceNo = clean;
        this.saveToStorage();
        if (this._billSyncDebounce) clearTimeout(this._billSyncDebounce);
        this._billSyncDebounce = setTimeout(() => {
            try { this.syncToMongoNow({ manual: false }); } catch(e) {}
        }, 1500);
    },
    updateRaNo(val) {
        const clean = String(val || '').trim();
        if (!this.projectMeta) this.projectMeta = {};
        this.projectMeta.raNo = clean;
        if (!this.invoiceData) this.invoiceData = {};
        this.invoiceData.raNo = clean;

        // Auto-sync bill number suffix with RA number so header and invoice never mismatch!
        const curBill = (this.projectMeta && this.projectMeta.billNo) || (this.invoiceData && this.invoiceData.invoiceNo) || '';
        if (clean && curBill) {
            if (/^(?:RSL\/RA\/)\d+$/i.test(curBill.trim())) {
                const updated = 'RSL/RA/' + clean;
                this.projectMeta.billNo = updated;
                this.invoiceData.invoiceNo = updated;
            } else if (/^(?:RA[\/\\-_])\d+$/i.test(curBill.trim())) {
                const updated = 'RA-' + clean;
                this.projectMeta.billNo = updated;
                this.invoiceData.invoiceNo = updated;
            }
        }
        this.saveToStorage();
        if (this._raSyncDebounce) clearTimeout(this._raSyncDebounce);
        this._raSyncDebounce = setTimeout(() => {
            try { this.syncToMongoNow({ manual: false }); } catch(e) {}
        }, 1500);
    },
    onNewBillRaNoInput() {
        if (!this.newBillForm) return;
        const ra = (this.newBillForm.raNo || '').trim();
        if (ra) {
            const cur = this.newBillForm.billNo || '';
            if (!cur || /^(?:RSL\/RA\/|RA[\-_])\d+$/i.test(cur.trim())) {
                const prefix = (cur && cur.startsWith('RSL/RA/')) ? 'RSL/RA/' : 'RA-';
                this.newBillForm.billNo = prefix + ra;
            }
        }
    },
    resetAllManualDataKeepMapping() {
        // 1. Reset all Activity Quantities across ALL activities to blank
        this.activityQuantities = {};
        if (this.activities && typeof this.activities === 'object') {
            Object.keys(this.activities).forEach(actKey => {
                const act = this.activities[actKey];
                if (!act) return;

                // Remove any dynamically added extra items (isExtra: true)
                if (Array.isArray(act.materials)) {
                    for (let i = act.materials.length - 1; i >= 0; i--) {
                        if (act.materials[i] && act.materials[i].isExtra) {
                            act.materials.splice(i, 1);
                        }
                    }

                    // Reset manual reco overrides on sapItems, but KEEP all mapping details
                    act.materials.forEach(m => {
                        if (Array.isArray(m.sapItems)) {
                            m.sapItems.forEach(s => {
                                if (s.isManual) {
                                    s.isManual = false;
                                    delete s.manualQty;
                                }
                            });
                        }
                    });

                    // Build clean blank quantity matrix for all locations
                    const numLocs = (typeof this.getActLocations === 'function') ? this.getActLocations(actKey).length : 1;
                    const matCount = act.materials.length;
                    this.activityQuantities[actKey] = Array.from({ length: numLocs }, () => new Array(matCount).fill(''));
                }
            });
        }

        // 1b. Reset Master Abstract sheet quantities
        if (Array.isArray(this.masterAbstractList)) {
            this.masterAbstractList.forEach(item => {
                item.qty = '';
            });
        }

        // 2. Reset Nut Bolt Calculator inputs
        if (Array.isArray(this.nutBoltData)) {
            this.nutBoltData.forEach(item => {
                item.qty = '';
            });
        }

        // 3. Reset Concreting Calculator inputs
        this.selectedAugerSize = 22;
        if (this.concretingData && typeof this.concretingData === 'object') {
            Object.keys(this.concretingData).forEach(k => {
                this.concretingData[k] = '';
            });
        }

        // 4. Reset Tax Invoice data
        if (!this.invoiceData) this.invoiceData = {};
        this.invoiceData.items = [];
        this.invoiceData.basicTotal = 0;
        this.invoiceData.gstTotal = 0;
        this.invoiceData.grandTotal = 0;
        this.invoiceData.words = '';

        // 5. Reset filters & UI states
        this.searchQuery = '';
        this.selectedLocationIdx = 'ALL';
        this.mappingSearchQuery = '';
        this.mappingActivityFilter = 'ALL';
        this.isFinalized = false;

        // 6. Reset history stack
        this.historyStack = [];
        this.historyIndex = -1;
    },
    resetCurrentBillQuantities() {
        if (!confirm('Kya aap current bill ki sabhi quantities aur manual entries blank karna chahte hain?\n\n(Aapka SAP Mapping Master bilkul safe rahega)')) {
            return;
        }
        this.resetAllManualDataKeepMapping();
        this.saveToStorage();
        if (typeof this.syncToMongoNow === 'function') {
            this.syncToMongoNow({ manual: true });
        }
        this.showToast('Current bill ki sabhi quantities blank kar di gayi hain! Mapping safe hai ✅', '🧹');
    },
    async createNewBill() {
        const form = this.newBillForm;
        if (!form.billNo || !form.billNo.trim()) {
            this.showToast('Please enter a Bill Number', '⚠️');
            return;
        }
        const cleanBillNo = form.billNo.trim();
        const cleanRaNo = (form.raNo || '').trim();
        const newBillId = 'bill_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

        this.showToast('Saving current bill before creating new...', '⏳');
        try { await this.syncToMongoNow({ manual: true, force: true }); } catch(e) {}

        // Reset all manual values (quantities, extra items, calculator, invoice) while keeping all SAP mappings intact
        this.resetAllManualDataKeepMapping();

        if (!this.projectMeta) this.projectMeta = {};
        this.projectMeta.billNo = cleanBillNo;
        this.projectMeta.raNo = cleanRaNo;
        this.projectMeta.billDate = form.billDate || new Date().toISOString().slice(0, 10);
        this.projectMeta.projectName = form.projectName || 'RDSS T-10 GADCHIROLI';
        this.selectedContractorId = form.selectedContractorId;
        this.selectedCompanyId = form.selectedCompanyId;

        if (!this.invoiceData) this.invoiceData = {};
        this.invoiceData.invoiceNo = cleanBillNo;
        this.invoiceData.raNo = cleanRaNo;
        this.invoiceData.invoiceDate = form.billDate || new Date().toISOString().slice(0, 10);
        this.invoiceData.items = [];

        this.activeBillId = newBillId;
        this.cloudRev = 0;
        this.lastSentHash = '';
        try { localStorage.setItem('lk_billing_active_bill_id', newBillId); } catch(e) {}

        this.saveToStorage();
        await this.syncToMongoNow({ manual: true, force: true });

        this.showNewBillModal = false;
        this.showSavedBillsModal = false;
        if (typeof this.takeSnapshot === 'function') this.takeSnapshot();
        this.showToast(`New Bill [${cleanBillNo}] created! Sabhi quantities blank, mapping safe hai 🎉`, '✨');
    },
    async openBill(dataId) {
        if (!dataId) return;
        if (dataId === this.activeBillId) {
            this.showToast(`Bill [${(this.projectMeta && this.projectMeta.billNo) || dataId}] is already active`, 'ℹ️');
            this.showSavedBillsModal = false;
            return;
        }

        this.showToast('Saving current bill before switching...', '⏳');
        try { await this.syncToMongoNow({ manual: true }); } catch(e) {}

        this._isLoading = true;
        this.activeBillId = dataId;
        this.cloudRev = 0;
        this.lastSentHash = '';
        try { localStorage.setItem('lk_billing_active_bill_id', dataId); } catch(e) {}

        await this.loadFromStorage({ forceServer: true, dataId });
        this._isLoading = false;
        this.showSavedBillsModal = false;
        this.historyStack = [];
        this.historyIndex = -1;
        if (typeof this.takeSnapshot === 'function') this.takeSnapshot();
        this.showToast(`Bill [${(this.projectMeta && this.projectMeta.billNo) || dataId}] loaded successfully! 📂`, '📄');
    },
    async duplicateBill(b) {
        if (!b) return;
        const newBillNo = prompt('Enter new Bill No for duplicate copy:', (b.billNo || 'Bill') + ' (Copy)');
        if (!newBillNo || !newBillNo.trim()) return;

        let billState = null;
        if (b.dataId === this.activeBillId) {
            billState = JSON.parse(JSON.stringify(this.buildSyncPayload()));
        } else {
            this.showToast('Fetching bill data for copy...', '⏳');
            try {
                const res = await fetch('/api/billing?dataId=' + encodeURIComponent(b.dataId), {
                    headers: (() => { const h = {}; try { const k = localStorage.getItem('billing_api_key'); if (k) h['x-api-key'] = k; } catch(e){} return h; })()
                });
                const j = await res.json();
                if (j && j.success && j.data) billState = j.data;
            } catch(e) {}
        }

        if (!billState) {
            this.showToast('Could not load source bill to duplicate', '⚠️');
            return;
        }

        const newBillId = 'bill_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        if (!billState.projectMeta) billState.projectMeta = {};
        billState.projectMeta.billNo = newBillNo.trim();
        if (!billState.invoiceData) billState.invoiceData = {};
        billState.invoiceData.invoiceNo = newBillNo.trim();
        billState.isFinalized = false;
        billState.dataId = newBillId;

        const headers = { 'Content-Type': 'application/json' };
        try { const k = localStorage.getItem('billing_api_key'); if (k) headers['x-api-key'] = k; } catch(e) {}
        await fetch('/api/billing', {
            method: 'POST',
            headers,
            body: JSON.stringify(Object.assign(billState, { dataId: newBillId, force: true, baseRev: 0 }))
        });

        this.showToast(`Duplicate bill [${newBillNo.trim()}] created! Opening...`, '📋');
        await this.openBill(newBillId);
    },
    async deleteBill(b) {
        if (!b) return;
        if (b.dataId === this.activeBillId) {
            alert('Yeh bill abhi active (open) hai. Pehle koi doosra bill open karein, phir isko delete karein.');
            return;
        }
        const ok = confirm(`Kya aap sach me Bill [${b.billNo || b.dataId}] ko database se DELETE karna chahte hain?\n\nYeh action wapas nahi hoga.`);
        if (!ok) return;

        this.showToast(`Deleting bill [${b.billNo}]...`, '⏳');
        const success = await this.deleteBillFromCloud(b.dataId);
        if (success) {
            this.showToast(`Bill [${b.billNo}] deleted from database 🗑️`, '🗑️');
            await this.loadSavedBillsList();
        }
    },
    debouncedSave() {
        if (this._isLoading) return;
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            this.saveToStorage();
        }, 120);
    },
    buildSyncPayload(extra = {}) {
        return Object.assign({
            dataId: this.activeBillId || 'main-billing-state',
            isFinalized: this.isFinalized,
            projectMeta: this.projectMeta,
            selectedCompanyId: this.selectedCompanyId,
            contractorsList: this.contractorsList,
            selectedContractorId: this.selectedContractorId,
            pctStage1: this.pctStage1,
            pctStage2: this.pctStage2,
            pctStage3: this.pctStage3,
            locations: this.locations,
            activityLocations: this.activityLocations,
            activities: this.activities,
            masterAbstractList: this.masterAbstractList,
            activityQuantities: this.activityQuantities,
            invoiceData: this.invoiceData,
            mappingLocks: this.mappingLocks,
            mappingRoundMode: this.mappingRoundMode || 'none',
            sapMaterialsMaster: this.sapMaterialsMaster,
            savedAt: Date.now(),
            baseRev: (typeof this.cloudRev === 'number' ? this.cloudRev : 0)
        }, extra);
    },
    scheduleRemoteSync() {
        this._syncRetryCount = 0; // naya edit = retry budget dobara se
        if (this._syncTimer) clearTimeout(this._syncTimer);
        this._syncTimer = setTimeout(() => { this.syncToMongoNow(); }, 2500);
    },
    scheduleMappingSync() {
        if (this._syncTimer) { clearTimeout(this._syncTimer); this._syncTimer = null; }
        if (this._mappingSyncTimer) clearTimeout(this._mappingSyncTimer);
        this.syncStatus = 'syncing';
        this._mappingSyncTimer = setTimeout(() => { this._mappingSyncTimer = null; this.syncToMongoNow(); }, 400);
    },
    stableStateHash(obj) {
        try {
            const c = Object.assign({}, obj);
            delete c.savedAt; delete c.baseRev;
            const json = JSON.stringify(c);
            let h = 0;
            for (let i = 0; i < json.length; i += 97) { h = ((h * 31) + json.charCodeAt(i)) >>> 0; }
            return json.length + ':' + h;
        } catch(e) { return ''; }
    },
    getSyncedHash() { try { return localStorage.getItem('lk_billing_synced_hash_v1') || ''; } catch(e) { return ''; } },
    setSyncedHash(h) { try { if (h) localStorage.setItem('lk_billing_synced_hash_v1', h); } catch(e) {} },
    async syncToMongoNow(opts) {
        const manual = !!(opts && opts.manual);
        const force = !!(opts && opts.force);
        if (this.cloudConflict) {
            if (manual) {
                this.syncStatus = 'error';
                this.showToast('Refresh first — another PC saved changes. Then redo your changes', '⚠️');
                return false;
            }
            console.warn('Sync blocked: cloudConflict — auto-recovering by re-fetching server rev');
            try {
                const rRes = await fetch('/api/billing', {
                    headers: (() => { const h = {}; try { const k = localStorage.getItem('billing_api_key'); if (k) h['x-api-key'] = k; } catch(e){} return h; })()
                });
                if (rRes.ok) { const rj = await rRes.json(); if (rj && typeof rj.rev === 'number') { this.cloudRev = rj.rev; this.cloudConflict = false; console.info('Auto-recovered: cloudRev updated to ' + rj.rev); } }
                else { this._scheduleSyncRetry(); return false; }
            } catch(e) { this._scheduleSyncRetry(); return false; }
        }
        try {
            const payload = this.buildSyncPayload(force ? { force: true } : {});
            const json = JSON.stringify(payload);
            if (json.length > 4 * 1024 * 1024) {
                this.syncStatus = 'error';
                console.warn('Sync skipped: payload too large (' + Math.round(json.length / 1024) + 'KB)');
                this.showToast('Data too large (' + Math.round(json.length / 1024) + 'KB) — cloud sync skipped', '⚠️');
                return false;
            }
            let h = 0;
            for (let i = 0; i < json.length; i += 97) { h = ((h * 31) + json.charCodeAt(i)) >>> 0; }
            const hash = json.length + ':' + h;
            if (hash === this.lastSentHash) {
                if (manual) this.showToast('Already synced — Refresh on other PC', '☁️');
                return true;
            }
            this.syncStatus = 'syncing';
            const res = await fetch('/api/billing', {
                method: 'POST',
                headers: (() => { const h = { 'Content-Type': 'application/json' }; try { const k = localStorage.getItem('billing_api_key'); if (k) h['x-api-key'] = k; } catch(e){} return h; })(),
                body: json
            });
            if (res.status === 423) {
                this.lastSentHash = hash;
                this.syncStatus = 'local';
                console.info('Mongo: bill locked hai, local copy safe hai');
                if (manual) this.showToast('Bill locked — Unlock first to sync', '🔒');
                return false;
            }
            if (res.status === 401) {
                this.syncStatus = 'error';
                this.showToast('Cloud sync FAIL: API key wrong/missing — changes saved locally only. Set billing_api_key in localStorage.', '🔑');
                this._scheduleSyncRetry();
                return false;
            }
            if (res.status === 429) {
                this.syncStatus = 'error';
                this.showToast('Cloud sync FAIL: Too many saves — wait 1 min', '⏳');
                this._scheduleSyncRetry();
                return false;
            }
            if (res.status === 409) {
                let rj = null;
                try { rj = await res.json(); } catch(e) {}
                if (rj && typeof rj.rev === 'number') this.cloudRev = rj.rev;
                this.lastSentHash = hash;
                this.syncStatus = 'error';
                console.warn('Sync 409 conflict: overwrite blocked, checking auto-recovery...');
                // Auto-recover if background sync or idle: pull newer cloud data directly!
                if (!manual && rj && rj.data) {
                    console.info('Auto-reloading newer cloud data after conflict...');
                    await this.loadFromStorage({ forceServer: true });
                    try { this.showToast('Cloud data synchronized from other PC ☁️', 'ℹ️'); } catch(e) {}
                    return true;
                }
                try {
                    const srvMsg = (rj && rj.error) ? String(rj.error).slice(0, 150) : '';
                    this.showToast('⚠️ ' + (srvMsg || 'Another PC saved in between! Click Refresh on toolbar to load it'), '⚠️');
                } catch(e) {}
                return false;
            }
            if (!res.ok) {
                let srv = '';
                try { const ej = await res.json(); if (ej && ej.error) srv = String(ej.error).slice(0, 140); } catch(e) {}
                throw new Error('HTTP ' + res.status + (srv ? ' — ' + srv : ''));
            }
            try { const okj = await res.json(); if (okj && typeof okj.rev === 'number') this.cloudRev = okj.rev; } catch(e) {}
            this.lastSentHash = hash;
            this.setSyncedHash(this.stableStateHash(payload));
            this.syncStatus = 'synced';
            this._syncRetryCount = 0;
            try {
                const t = new Date();
                this.lastSyncAt = ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2);
            } catch(e) {}
            if (manual) {
                this.showToast('Cloud saved! Refresh on other PC', '☁️');
                const gdriveUrl = (typeof this.getEffectiveDriveWebhookUrl === 'function' ? this.getEffectiveDriveWebhookUrl() : '')
                    || (this.gdriveWebhookUrl || '').trim()
                    || localStorage.getItem('billing_gdrive_webhook_url')
                    || (this.projectMeta && this.projectMeta.gdriveWebhookUrl);
                if (gdriveUrl && typeof this.manualSaveBillToDrive === 'function') {
                    setTimeout(() => {
                        try {
                            this.manualSaveBillToDrive();
                        } catch(e) {
                            console.warn('Auto drive upload after bill save failed:', e);
                        }
                    }, 500);
                }
            }
            return true;
        } catch (err) {
            this.syncStatus = 'error';
            console.error('Mongo sync failed (local copy safe hai):', err);
            const m = String((err && err.message) || 'network/server error').slice(0, 150);
            this.showToast('Cloud sync FAIL: ' + m + '. Local copy safe, retrying...', '⚠️');
            this._scheduleSyncRetry();
            return false;
        }
    },
    _syncRetryCount: 0,
    _syncRetryTimer: null,
    _scheduleSyncRetry() {
        if (this._syncRetryTimer) clearTimeout(this._syncRetryTimer);
        this._syncRetryCount = (this._syncRetryCount || 0) + 1;
        if (this._syncRetryCount > 5) { this._syncRetryCount = 0; return; }
        const delay = Math.min(3000 * this._syncRetryCount, 30000);
        console.info('Sync retry #' + this._syncRetryCount + ' in ' + (delay / 1000) + 's');
        this._syncRetryTimer = setTimeout(() => { this._syncRetryTimer = null; this.syncToMongoNow(); }, delay);
    },
    // Net wapas aane par turant pending sync push karo (offline tha to 5 retry khatam ho chuke hote hain)
    armOnlineRecovery() {
        if (this._onlineArmed) return;
        this._onlineArmed = true;
        window.addEventListener('online', () => {
            console.info('Browser online — pending cloud sync retry ho raha hai');
            this._syncRetryCount = 0;
            if (this.cloudConflict) return;
            setTimeout(() => { try { this.syncToMongoNow(); } catch(e) {} }, 500);
        });
    },
    async refreshFromCloud() {
        try {
            if (this._syncTimer) { clearTimeout(this._syncTimer); this._syncTimer = null; }
            if (this._mappingSyncTimer) { clearTimeout(this._mappingSyncTimer); this._mappingSyncTimer = null; }
            this.showToast('Loading fresh data from cloud...', '🔄');
            await this.loadFromStorage({ forceServer: true });
            this.showToast('Fresh data loaded', '🔄');
        } catch (e) {
            console.error('Refresh failed', e);
            this.showToast('Refresh failed — check internet', '⚠️');
        }
    },
    flushPendingSync() {
        try {
            if (this.cloudConflict) return;
            if (this._syncTimer) { clearTimeout(this._syncTimer); this._syncTimer = null; }
            if (this._mappingSyncTimer) { clearTimeout(this._mappingSyncTimer); this._mappingSyncTimer = null; }
            const payload = this.buildSyncPayload();
            const json = JSON.stringify(payload);
            if (json.length > 4 * 1024 * 1024) return;
            let h = 0;
            for (let i = 0; i < json.length; i += 97) { h = ((h * 31) + json.charCodeAt(i)) >>> 0; }
            const hash = json.length + ':' + h;
            if (hash === this.lastSentHash) return;
            try {
                const headers = { 'Content-Type': 'application/json' };
                try { const k = localStorage.getItem('billing_api_key'); if (k) headers['x-api-key'] = k; } catch(e) {}
                fetch('/api/billing', { method: 'POST', headers, body: json, keepalive: true }).catch(() => {});
            } catch(e) {}
        } catch(e) {}
    },
    saveToStorage() {
        if (this._isLoading) return;
        try {
            try {
                if (this.invoiceData && this.invoiceData.autoSync) {
                    this.updateSyncTaxInvoiceFromActivities();
                } else if (this.invoiceData && Array.isArray(this.invoiceData.items)) {
                    const q907 = this.getActivity907InvoiceQty();
                    if (q907 > 0) {
                        this.invoiceData.items.forEach(it => {
                            if (it.actKey === '907' || (it.desc && /^(?:Activity\s+)?907\s*:/i.test(it.desc))) {
                                if (!it.manual) it.qty = q907;
                            }
                        });
                    }
                }
            } catch (syncErr) {
                console.error('Invoice sync error (save still proceeds):', syncErr);
            }
            if (typeof this.cleanInvoicePlaceholderRows === 'function') {
                this.cleanInvoicePlaceholderRows();
            }
            if (this.invoiceData && this.invoiceData.invoiceNo) {
                if (!this.projectMeta) this.projectMeta = {};
                this.projectMeta.billNo = this.invoiceData.invoiceNo;
            } else if (this.projectMeta && this.projectMeta.billNo && this.invoiceData) {
                this.invoiceData.invoiceNo = this.projectMeta.billNo;
            }
            if (this.invoiceData && this.invoiceData.raNo) {
                if (!this.projectMeta) this.projectMeta = {};
                this.projectMeta.raNo = this.invoiceData.raNo;
            } else if (this.projectMeta && this.projectMeta.raNo && this.invoiceData) {
                this.invoiceData.raNo = this.projectMeta.raNo;
            }
            if (this.gdriveWebhookUrl && this.projectMeta) {
                this.projectMeta.gdriveWebhookUrl = this.gdriveWebhookUrl;
            }
            const dataToSave = {
                isFinalized: this.isFinalized,
                projectMeta: this.projectMeta,
                selectedCompanyId: this.selectedCompanyId,
                contractorsList: this.contractorsList,
                selectedContractorId: this.selectedContractorId,
                pctStage1: this.pctStage1,
                pctStage2: this.pctStage2,
                pctStage3: this.pctStage3,
                locations: this.locations,
                activityLocations: this.activityLocations,
                activities: this.activities,
                masterAbstractList: this.masterAbstractList,
                activityQuantities: this.activityQuantities,
                invoiceData: this.invoiceData,
                mappingLocks: this.mappingLocks,
                mappingRoundMode: this.mappingRoundMode || 'none',
                sapMaterialsMaster: this.sapMaterialsMaster,
                savedAt: Date.now(),
                baseRev: (typeof this.cloudRev === 'number' ? this.cloudRev : 0)
            };
            const curBillId = this.activeBillId || 'main-billing-state';
            const localKey = (curBillId && curBillId !== 'main-billing-state')
                ? ('lk_billing_state_' + curBillId)
                : 'lk_billing_app_state_v10';
            if (window.BillingStorage && typeof window.BillingStorage.setItem === 'function') {
                window.BillingStorage.setItem(localKey, JSON.stringify(dataToSave));
            } else {
                localStorage.setItem(localKey, JSON.stringify(dataToSave));
            }
            try { localStorage.setItem('lk_billing_active_bill_id', curBillId); } catch(e) {}
            try { localStorage.setItem('lk_billing_mapping_locks_v1', JSON.stringify(this.mappingLocks)); } catch(e) {}
            try { localStorage.setItem('lk_billing_mapping_round_mode', this.mappingRoundMode || 'none'); } catch(e) {}
            if (!this.isPerformingHistoryAction) {
                this.takeSnapshot();
            }
            this.scheduleRemoteSync();
        } catch (e) {
            console.error('Save error', e);
        }
    },
    async loadFromStorage(opts) {
          const forceServer = !!(opts && opts.forceServer);
          let raw = null;
          let fromMongo = false;
          // Cloud copy lao (fail ho to null — phir local hi jeetega)
          let serverRaw = null;
          let serverUpdatedAt = 0;
          const targetBillId = (opts && opts.dataId) || this.activeBillId || localStorage.getItem('lk_billing_active_bill_id') || 'main-billing-state';
          this.activeBillId = targetBillId;
          try { localStorage.setItem('lk_billing_active_bill_id', targetBillId); } catch(e) {}
          try {
              const res = await fetch('/api/billing?dataId=' + encodeURIComponent(targetBillId), {
                  headers: (() => { const h = {}; try { const k = localStorage.getItem('billing_api_key'); if (k) h['x-api-key'] = k; } catch(e){} return h; })()
              });
              if (!res.ok) {
                  try { const ej = await res.clone().json().catch(() => null); if (ej && ej.error) setTimeout(() => { try { this.showToast('☁️ Cloud load fail: ' + String(ej.error).slice(0, 140), '⚠️'); } catch(e) {} }, 600); } catch(e) {}
                  throw new Error('API Error: ' + res.status);
              }
              const json = await res.json();
              if (json && json.success && json.data) {
                  serverRaw = JSON.stringify(json.data);
                  try { serverUpdatedAt = json.updatedAt ? new Date(json.updatedAt).getTime() : 0; } catch(e) { serverUpdatedAt = 0; }
                  if (!serverUpdatedAt && json.data && json.data.savedAt) {
                      serverUpdatedAt = Number(json.data.savedAt) || 0;
                  }
                  if (typeof json.rev === 'number') this._loadedRev = json.rev;
              }
          } catch (err) {
              console.error('Failed to load from MongoDB API:', err);
          }
          // Local copy padho.
          // RULE: jo change abhi cloud me nahi gaya (unsynced local), wo reload par
          // kabhi nahi harega — chahe server timestamp naya dikhe (wahi revert bug tha).
          // Server tabhi jeetega jab us par dusre PC ka NAYA synced data ho.
          let localRaw = null;
          const localKey = (targetBillId && targetBillId !== 'main-billing-state')
              ? ('lk_billing_state_' + targetBillId)
              : 'lk_billing_app_state_v10';
          if (window.BillingStorage && typeof window.BillingStorage.getItemAsync === 'function') {
              localRaw = await window.BillingStorage.getItemAsync(localKey);
          } else {
              try { localRaw = localStorage.getItem(localKey); } catch(e) {}
          }
          let localSavedAt = 0;
          let localRev = 0;
          let localHash = '';
          if (localRaw) {
              try {
                  const lp = JSON.parse(localRaw) || {};
                  localSavedAt = Number(lp.savedAt) || 0;
                  localRev = (typeof lp.baseRev === 'number') ? lp.baseRev : 0;
                  localHash = this.stableStateHash(lp);
              } catch(e) {}
          }
          let serverHash = '';
          if (serverRaw) {
              try { serverHash = this.stableStateHash(JSON.parse(serverRaw)); } catch(e) {}
              if (typeof this._loadedRev === 'number') { /* rev neeche har branch me adopt hoga */ }
          }
          let syncedHash = this.getSyncedHash();
          if (serverHash && !syncedHash) { syncedHash = serverHash; this.setSyncedHash(serverHash); }
          const localDirty = !!(localRaw && localHash && serverHash && localHash !== serverHash && localHash !== syncedHash && serverHash === syncedHash);
          const serverRevIsNewer = (typeof this._loadedRev === 'number' && typeof localRev === 'number' && this._loadedRev > localRev);
          if (serverRaw && !forceServer && localDirty && !serverRevIsNewer) {
              // Sirf is PC me unsynced change hai, cloud purana hai → LOCAL jeetega + turant push
              raw = localRaw;
              fromMongo = false;
              if (typeof this._loadedRev === 'number') this.cloudRev = this._loadedRev;
              console.info('Unsynced local change mila — reload par local jeeta, cloud push retry hoga');
              try { this.showToast('Unsaved changes found on this PC — saving to cloud...', '🔄'); } catch(e) {}
              setTimeout(() => { try { this.syncToMongoNow({ manual: false }); } catch(e) {} }, 2000);
          } else if (serverRaw && (forceServer || !localRaw || serverRevIsNewer || serverUpdatedAt >= localSavedAt)) {
              raw = serverRaw;
              fromMongo = true;
              if (typeof this._loadedRev === 'number') this.cloudRev = this._loadedRev;
              this.cloudConflict = false;
              if (serverHash) this.setSyncedHash(serverHash);
          } else if (localRaw) {
              raw = localRaw;
              fromMongo = false;
              if (serverRaw) {
                  // Is PC ka data cloud se NAYA hai — cloud purana hai, isko push karke fix karo
                  console.info('Local copy cloud se nayi hai — sync retry schedule hua');
                  try { this.showToast('This PC has newer data — syncing to cloud...', '🔄'); } catch(e) {}
                  setTimeout(() => { try { this.syncToMongoNow({ manual: false }); } catch(e) {} }, 3000);
              }
          } else if (serverRaw) {
              raw = serverRaw;
              fromMongo = true;
              if (typeof this._loadedRev === 'number') this.cloudRev = this._loadedRev;
              this.cloudConflict = false;
          } else {
              try { this.showToast('No data found in cloud or local', 'ℹ️'); } catch(e) {}
          }
          this.syncStatus = fromMongo ? 'synced' : (serverRaw ? 'syncing' : 'local');
          if (fromMongo && raw) {
              try {
                  let h = 0;
                  for (let i = 0; i < raw.length; i += 97) { h = ((h * 31) + raw.charCodeAt(i)) >>> 0; }
                  this.lastSentHash = raw.length + ':' + h;
              } catch(e) {}
          }
          if (raw) {
            try {
                const parsed = JSON.parse(raw);
                let loadedHasCatalog = false;
                if (Array.isArray(parsed.sapMaterialsMaster) && parsed.sapMaterialsMaster.length > 0) {
                    // ☁️ SAP Material Master ka cloud copy yahan se aata hai
                    this.sapMaterialsMaster = parsed.sapMaterialsMaster;
                    loadedHasCatalog = true;
                }
                this._loadedHasCatalog = loadedHasCatalog;
                if (parsed.isFinalized !== undefined) this.isFinalized = parsed.isFinalized;
                if (parsed.projectMeta) {
                    this.projectMeta = parsed.projectMeta;
                    if (!this.projectMeta.contractValue) this.projectMeta.contractValue = 48550000;
                    if (!this.projectMeta.aaacDivisor) this.projectMeta.aaacDivisor = 3150;
                    if (this.projectMeta.gdriveWebhookUrl && this.projectMeta.gdriveWebhookUrl.includes('/exec') && !this.projectMeta.gdriveWebhookUrl.includes('AKfycbx6hHT7Xnw4SItlkrKeE3BSBuBpQDy1-gFsxq5kRdlr_3PHEK7XYjIHBPjtGWj3H9Jx')) {
                        this.gdriveWebhookUrl = this.projectMeta.gdriveWebhookUrl;
                        try { localStorage.setItem('billing_gdrive_webhook_url', this.projectMeta.gdriveWebhookUrl); } catch(e) {}
                    } else {
                        this.projectMeta.gdriveWebhookUrl = 'https://script.google.com/macros/s/AKfycbw495PuqtHzuCATbRHI3dgofeWKaMVyYrUhc0twCdf0EbaPwSlpA81i0ExHdny6MZQ/exec';
                        this.gdriveWebhookUrl = 'https://script.google.com/macros/s/AKfycbw495PuqtHzuCATbRHI3dgofeWKaMVyYrUhc0twCdf0EbaPwSlpA81i0ExHdny6MZQ/exec';
                        try { localStorage.setItem('billing_gdrive_webhook_url', 'https://script.google.com/macros/s/AKfycbw495PuqtHzuCATbRHI3dgofeWKaMVyYrUhc0twCdf0EbaPwSlpA81i0ExHdny6MZQ/exec'); } catch(e) {}
                    }
                }
                if (parsed.selectedCompanyId) this.selectedCompanyId = parsed.selectedCompanyId;
                if (parsed.contractorsList && Array.isArray(parsed.contractorsList) && parsed.contractorsList.length > 0) {
                    this.contractorsList = parsed.contractorsList;
                }
                if (parsed.selectedContractorId) this.selectedContractorId = parsed.selectedContractorId;
                if (parsed.pctStage1 !== undefined) this.pctStage1 = parsed.pctStage1;
                if (parsed.pctStage2 !== undefined) this.pctStage2 = parsed.pctStage2;
                if (parsed.pctStage3 !== undefined) this.pctStage3 = parsed.pctStage3;
                if (parsed.locations && Array.isArray(parsed.locations) && parsed.locations.length > 0) {
                    this.locations = parsed.locations;
                }
                if (parsed.activityLocations && typeof parsed.activityLocations === 'object') this.activityLocations = parsed.activityLocations;
                if (parsed.activities && typeof parsed.activities === 'object') {
                    this.activities = parsed.activities;
                    Object.keys(defaultActivities).forEach(k => {
                        if (!this.activities[k]) {
                            this.activities[k] = JSON.parse(JSON.stringify(defaultActivities[k]));
                        } else if (defaultActivities[k] && defaultActivities[k].materials) {
                            defaultActivities[k].materials.forEach((defMat, mIdx) => {
                                if (this.activities[k].materials && this.activities[k].materials[mIdx]) {
                                    const cur = this.activities[k].materials[mIdx];
                                    if (!cur.itemCode && defMat.itemCode) {
                                        cur.itemCode = defMat.itemCode;
                                        cur.sapDescription = defMat.sapDescription;
                                        cur.sapUom = defMat.sapUom;
                                        cur.docHeader = defMat.docHeader;
                                    }
                                    if (!cur.sapItems && defMat.sapItems) {
                                        cur.sapItems = JSON.parse(JSON.stringify(defMat.sapItems));
                                    }
                                }
                            });
                        }
                    });
                    // Ensure all materials (including extra items) have valid sapItems
                    Object.keys(this.activities).forEach(k => {
                        const act = this.activities[k];
                        if (act && act.materials) {
                            act.materials.forEach((m, idx) => {
                                if (!m.sapItems || !m.sapItems.length || !m.sapItems[0].code) {
                                    if (typeof this.ensureMaterialSap === 'function') {
                                        this.ensureMaterialSap(m, idx);
                                    }
                                }
                            });
                        }
                    });
                }
                if (parsed.masterAbstractList && Array.isArray(parsed.masterAbstractList) && parsed.masterAbstractList.length > 0) {
                    this.masterAbstractList = parsed.masterAbstractList;
                }
                if (parsed.activityQuantities && typeof parsed.activityQuantities === 'object') {
                    this.activityQuantities = parsed.activityQuantities;
                }
                if (parsed.invoiceData && typeof parsed.invoiceData === 'object') {
                    this.invoiceData = parsed.invoiceData;
                }
                // Contractor name suraksha - agar khali ya default CONTRACTOR hai toh active firm se bharo
                if (this.invoiceData && (!this.invoiceData.contractorName || this.invoiceData.contractorName === 'CONTRACTOR' || this.invoiceData.contractorName === 'M/s CONTRACTOR')) {
                    const firm = (this.contractorsList || []).find(c => c.id === this.selectedContractorId);
                    if (firm && firm.name) {
                        this.invoiceData.contractorName = firm.name.startsWith('M/s') ? firm.name : `M/s ${firm.name}`;
                    } else if (this.projectMeta && this.projectMeta.contractorName) {
                        this.invoiceData.contractorName = this.projectMeta.contractorName;
                    }
                }
                // Normalize existing invoice item descriptions to "Activity [k] : ..."
                if (this.invoiceData && Array.isArray(this.invoiceData.items)) {
                    // If invoice has real activities/items, clean out any leftover blank rows
                    const hasRealItems = this.invoiceData.items.some(it => it.actKey || (it.desc && it.desc.trim()) || (it.amount && Number(it.amount) > 0));
                    if (hasRealItems && this.invoiceData.items.length > 1) {
                        this.invoiceData.items = this.invoiceData.items.filter(it => {
                            const isBlank = !it.actKey && (!it.desc || !it.desc.trim()) && (!it.amount || Number(it.amount) === 0);
                            return !isBlank;
                        });
                        this.invoiceData.items.forEach((it, idx) => { it.srNo = (idx + 1).toString(); });
                    }

                    this.invoiceData.items.forEach(it => {
                        const k = it.actKey || (typeof this.keyOfInvoiceItem === 'function' ? this.keyOfInvoiceItem(it) : ((it.desc && /^(?:Activity\s+)?([A-Za-z0-9]+)\s*:/i.test(it.desc)) ? it.desc.match(/^(?:Activity\s+)?([A-Za-z0-9]+)\s*:/i)[1] : ''));
                        if (k && this.activities && this.activities[k]) {
                            it.actKey = k;
                            if (typeof this.getActivityInvoiceDescription === 'function') {
                                it.desc = this.getActivityInvoiceDescription(k);
                            }
                        }
                    });
                }
                if (parsed.mappingLocks && typeof parsed.mappingLocks === 'object') {
                    this.mappingLocks = { rate: parsed.mappingLocks.rate !== false, sap: parsed.mappingLocks.sap !== false, qty: parsed.mappingLocks.qty !== false };
                }
                if (parsed.mappingRoundMode) {
                    this.mappingRoundMode = parsed.mappingRoundMode;
                    try { localStorage.setItem('lk_billing_mapping_round_mode', this.mappingRoundMode); } catch(e) {}
                }
            } catch (e) {
                console.error('Error loading stored state', e);
            }
        }
        // Winning copy me catalog nahi tha — par is PC ke localStorage me saved hai to
        // wo prefer karo (cloud ko apni koi opinion hi nahi isi key par).
        if (this._loadedHasCatalog === false && localRaw) {
            try {
                const lpCat = JSON.parse(localRaw);
                if (lpCat && Array.isArray(lpCat.sapMaterialsMaster) && lpCat.sapMaterialsMaster.length) {
                    this.sapMaterialsMaster = lpCat.sapMaterialsMaster;
                    this._loadedHasCatalog = true;
                }
            } catch(e) {}
        }
        // Catalog cloud/local dono me naya tha (pehli baar online hua) — bundled defaults seed karke push karo
        if (raw && this._loadedHasCatalog === false && Array.isArray(this.sapMaterialsMaster) && this.sapMaterialsMaster.length) {
            try { this.scheduleMappingSync(); } catch(e) {}
        }
        this.initDefaultSampleQuantities();
        this.normalizeAllContractorBanks();
        this.checkAndApplyAutoGstRule();
        if (this.invoiceData && this.invoiceData.autoSync) {
            this.updateSyncTaxInvoiceFromActivities();
        }
        this._syncRetryCount = 0;
        if (this._syncRetryTimer) { clearTimeout(this._syncRetryTimer); this._syncRetryTimer = null; }
    },
    initDefaultSampleQuantities() {
        Object.keys(this.activities).forEach(k => {
            this.initQuantitiesForActivity(k);
        });
    },
};
