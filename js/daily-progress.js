/**
 * @file Daily Progress Integration Module
 * @description Manages daily construction progress registers, material consumption,
 * manpower tracking, SAP stock linking & balance verification, and Excel reports.
 *
 * @module DailyProgressModule
 * @since v2.0
 */

window.DailyProgressModule = {
    // ─── INITIALIZATION & PERSISTENCE ──────────────────────────────────────────

    async initDailyProgress() {
        if (!this.dailyProgressDate) {
            this.dailyProgressDate = this.todayDateStr || new Date().toISOString().slice(0, 10);
        }
        if (!this.dailyProgressExportFrom) {
            this.dailyProgressExportFrom = '2026-09-01';
            this.dailyProgressExportTo = '2026-09-30';
        }

        let stored = null;
        try {
            if (typeof BillingStorage !== 'undefined' && typeof BillingStorage.getItemAsync === 'function') {
                stored = await BillingStorage.getItemAsync('billing_daily_progress');
                if (typeof stored === 'string') {
                    stored = JSON.parse(stored);
                }
            }
        } catch (e) {
            console.warn('[DailyProgress] Storage load error:', e);
        }

        // Initialize with default seed data if no saved reports exist
        const seed = window.DailyProgressSeed || { contractor: {}, items: [], records: [] };
        if (!stored || !stored.reports || stored.reports.length === 0) {
            const seedContractor = seed.contractor || {
                id: 'mangesh-sonwane',
                name: 'MANGESH SONWANE',
                project: 'Gadchiroli (T-10)',
                feeder: 'ANGARA',
                engineer: 'AMIT GOMASE'
            };

            const seedReports = (seed.records || []).map(r => ({
                contractorId: seedContractor.id,
                date: r.date,
                quantities: { ...(r.quantities || {}) },
                manpower: {
                    leader: Number(r.manpower && r.manpower.leader) || 0,
                    skilled: Number(r.manpower && r.manpower.skilled) || 0,
                    unskilled: Number(r.manpower && r.manpower.unskilled) || 0,
                    tractor: Number(r.manpower && r.manpower.tractor) || 0,
                    augur: Number(r.manpower && r.manpower.augur) || 0,
                    room: Number(r.manpower && r.manpower.room) || 0
                },
                remarks: r.remarks || '',
                version: 1
            }));

            this.dailyProgressData = {
                contractors: [seedContractor],
                reports: seedReports,
                issues: []
            };

            // Dual-merge contractors from Billing Pro's contractorsList
            this.syncDailyProgressContractorsList();
            await this.saveDailyProgressData();
        } else {
            this.dailyProgressData = stored;
            this.syncDailyProgressContractorsList();
        }

        // Synchronize active contractor with Billing Pro
        this.syncWithBillingProActiveContractor();

        // Load report for active date
        this.loadDailyProgressReportForDate(this.dailyProgressDate);


    },

    syncDailyProgressContractorsList() {
        if (!this.dailyProgressData) return;
        if (!Array.isArray(this.dailyProgressData.contractors)) {
            this.dailyProgressData.contractors = [];
        }

        const existingKeys = new Set(this.dailyProgressData.contractors.map(c => this.normContractorId(c.id || c.name)));

        // Merge from Billing Pro contractorsList
        if (Array.isArray(this.contractorsList)) {
            this.contractorsList.forEach(c => {
                const norm = this.normContractorId(c.id || c.name);
                if (norm && !existingKeys.has(norm)) {
                    existingKeys.add(norm);
                    this.dailyProgressData.contractors.push({
                        id: c.id,
                        name: c.name,
                        project: this.projectMeta && this.projectMeta.zone || 'Gadchiroli (T-10)',
                        feeder: c.feederName || 'ANGARA',
                        engineer: 'SUPERVISOR'
                    });
                }
            });
        }
    },

    normContractorId(id) {
        if (!id) return '';
        return String(id).toLowerCase().replace(/^m\/s\.?\s*/i, '').replace(/[^a-z0-9]/g, '');
    },

    syncWithBillingProActiveContractor() {
        if (!this.dailyProgressData || !this.dailyProgressData.contractors) return;
        const activeId = this.selectedContractorId;
        const activeName = this.selectedContractorName;

        let matched = null;
        if (activeId && activeId !== 'custom') {
            const rawId = this.normContractorId(activeId);
            matched = this.dailyProgressData.contractors.find(c => this.normContractorId(c.id) === rawId);
        }
        if (!matched && activeName) {
            const rawName = this.normContractorId(activeName);
            matched = this.dailyProgressData.contractors.find(c => this.normContractorId(c.name) === rawName);
        }

        const prevCid = this.dailyProgressContractorId;
        if (matched && matched.id !== prevCid && (this.dailyProgressDirty || this._dpPendingSave)) {
            this.showToast('Daily Progress ki pending entry pehle save karein.', 'Alert');
            return;
        }
        if (matched) {
            this.dailyProgressContractorId = matched.id;
        } else if (this.dailyProgressData.contractors.length > 0 && !this.dailyProgressContractorId) {
            this.dailyProgressContractorId = this.dailyProgressData.contractors[0].id;
        }

        // If contractor changed or quantities not loaded yet, immediately reload report for current date
        if (this.dailyProgressContractorId !== prevCid || !this.dailyProgressQuantities) {
            this.loadDailyProgressReportForDate(this.dailyProgressDate || new Date().toISOString().slice(0, 10));
        }
    },

    async saveDailyProgressData() {
        if (!this.dailyProgressData) return false;
        if (typeof BillingStorage !== 'undefined' && typeof BillingStorage.setItem === 'function') {
            const result = await BillingStorage.setItem('billing_daily_progress', this.dailyProgressData);
            if (result && result.saved === false) throw new Error('Device storage failed. Changes abhi save nahi hue.');
        } else if (typeof localStorage !== 'undefined') {
            localStorage.setItem('billing_daily_progress', JSON.stringify(this.dailyProgressData));
        } else {
            throw new Error('Device storage unavailable');
        }
        return true;
    },

    // ─── DAILY PROGRESS NAVIGATION & STATE ────────────────────────────────────

    onDailyProgressContractorChange(cid) {
        if (this._dpPendingSave) { this.explainPendingDailyProgressSave(); return; }
        if (this.dailyProgressDirty && !confirm('Aapke paas unsaved badlav hain. Badlav chhod kar doosra contractor select karein?')) {
            return;
        }
        this.dailyProgressContractorId = cid;

        // Also sync Billing Pro header if matching contractor exists
        const norm = this.normContractorId(cid);
        const firm = (this.contractorsList || []).find(c => this.normContractorId(c.id) === norm || this.normContractorId(c.name) === norm);
        if (firm) {
            this.selectedContractorId = firm.id;
            this.selectedContractorName = firm.name;
        }

        this.loadDailyProgressReportForDate(this.dailyProgressDate);
    },

    onDailyProgressDateChange(newDate) {
        if (this._dpPendingSave) { this.explainPendingDailyProgressSave(); return; }
        if (!newDate) return;
        if (this.dailyProgressDirty && !confirm('Aapke paas unsaved badlav hain. Badlav chhod kar doosri date select karein?')) {
            return;
        }
        this.dailyProgressDate = newDate;
        this.loadDailyProgressReportForDate(newDate);
    },

    navigateDailyProgressDay(delta) {
        if (this._dpPendingSave) { this.explainPendingDailyProgressSave(); return; }
        if (this.dailyProgressDirty && !confirm('Aapke paas unsaved badlav hain. Badlav chhod kar aage badhein?')) {
            return;
        }
        const cur = new Date(this.dailyProgressDate || new Date());
        cur.setDate(cur.getDate() + delta);
        const ymd = cur.toISOString().slice(0, 10);
        this.dailyProgressDate = ymd;
        this.loadDailyProgressReportForDate(ymd);
    },

    loadDailyProgressReportForDate(date) {
        const cid = this.dailyProgressContractorId;
        const reports = (this.dailyProgressData && this.dailyProgressData.reports) || [];
        const r = reports.find(rep => rep.contractorId === cid && rep.date === date);

        if (r) {
            this.dailyProgressQuantities = { ...(r.quantities || {}) };
            this.dailyProgressManpower = {
                leader: Number(r.manpower && r.manpower.leader) || 0,
                skilled: Number(r.manpower && r.manpower.skilled) || 0,
                unskilled: Number(r.manpower && r.manpower.unskilled) || 0,
                tractor: Number(r.manpower && r.manpower.tractor) || 0,
                augur: Number(r.manpower && r.manpower.augur) || 0,
                room: Number(r.manpower && r.manpower.room) || 0
            };
            this.dailyProgressRemarks = r.remarks || '';
            this.dailyProgressVersion = r.version || 1;
        } else {
            this.dailyProgressQuantities = {};
            this.dailyProgressManpower = {
                leader: 0,
                skilled: 0,
                unskilled: 0,
                tractor: 0,
                augur: 0,
                room: 0
            };
            this.dailyProgressRemarks = '';
            this.dailyProgressVersion = 0;
        }
        this.dailyProgressDirty = false;
    },

    onDailyProgressQuantityChange(itemId, val) {
        const num = val === '' ? 0 : Number(val);
        if (isNaN(num) || num < 0) return;
        // Vue 3 compatible reactive assignment (avoids non-existent this.$set)
        const qMap = { ...(this.dailyProgressQuantities || {}) };
        qMap[itemId] = num;
        this.dailyProgressQuantities = qMap;
        this.dailyProgressDirty = true;
    },

    onDailyProgressManpowerChange(key, val) {
        const num = val === '' ? 0 : Math.max(0, Number(val) || 0);
        // Vue 3 compatible reactive assignment (avoids non-existent this.$set)
        const mMap = { ...(this.dailyProgressManpower || {}) };
        mMap[key] = num;
        this.dailyProgressManpower = mMap;
        this.dailyProgressDirty = true;
    },

    async saveDailyProgressReport() {
        if (!this.dailyProgressContractorId) {
            this.showToast('Please select a contractor first.', 'Alert');
            return;
        }
        if (!this.dailyProgressDate) {
            this.showToast('Please select a valid work date.', 'Alert');
            return;
        }

        this.dailyProgressBusy = true;
        try {
            const cid = this.dailyProgressContractorId;
            const dt = this.dailyProgressDate;
            const reports = this.dailyProgressData.reports;

            const existingIdx = reports.findIndex(r => r.contractorId === cid && r.date === dt);
            const cleanQ = {};
            for (const [k, v] of Object.entries(this.dailyProgressQuantities || {})) {
                if (Number(v) > 0) {
                    cleanQ[k] = Math.round(Number(v) * 1000) / 1000;
                }
            }

            const cleanMan = {
                leader: Math.max(0, Math.round(Number(this.dailyProgressManpower.leader || 0))),
                skilled: Math.max(0, Math.round(Number(this.dailyProgressManpower.skilled || 0))),
                unskilled: Math.max(0, Math.round(Number(this.dailyProgressManpower.unskilled || 0))),
                tractor: Math.max(0, Math.round(Number(this.dailyProgressManpower.tractor || 0) * 100) / 100),
                augur: Math.max(0, Math.round(Number(this.dailyProgressManpower.augur || 0) * 100) / 100),
                room: Math.max(0, Math.round(Number(this.dailyProgressManpower.room || 0) * 100) / 100)
            };

            const reportPayload = {
                contractorId: cid,
                date: dt,
                quantities: cleanQ,
                manpower: cleanMan,
                remarks: String(this.dailyProgressRemarks || '').trim(),
                version: (this.dailyProgressVersion || 0) + 1,
                updatedAt: new Date().toISOString()
            };

            if (existingIdx >= 0) {
                reports[existingIdx] = reportPayload;
            } else {
                reports.push(reportPayload);
            }

            await this.saveDailyProgressData();
            this.dailyProgressDirty = false;
            this.dailyProgressVersion = reportPayload.version;
            this.showToast(`Daily Progress Saved! (${this.formatDisplayDate(dt)})`, 'Check');
        } catch (e) {
            console.error('[DailyProgress] Save failed:', e);
            this.showToast('Failed to save daily progress: ' + (e.message || e), 'Alert');
        } finally {
            this.dailyProgressBusy = false;
        }
    },

    // ─── STOCK & CONSUMPTION LINKING ──────────────────────────────────────────

    /**
     * Calculates SAP stock issued, manual issues, consumption to-date, and available balance
     * for any item in the daily progress register.
     */
    getDailyProgressItemStock(item) {
        if (!item) return { sapIssued: 0, manualIssued: 0, totalIssued: 0, totalConsumed: 0, balance: 0, status: 'none' };

        const cid = this.dailyProgressContractorId;
        const curDate = this.dailyProgressDate || new Date().toISOString().slice(0, 10);
        const code = String(item.code || '').trim();

        // 1. SAP Stock Issued to Active Contractor strictly filtered up to curDate (Work Date)
        let sapIssued = 0;
        // Resolve against work date, independent of reconciliation's cutoff.
        const contractorSap = (typeof this.getContractorSapIssues === 'function')
            ? this.getContractorSapIssues.call(new Proxy(this, {
                get(target, key) {
                    if (key === 'stockAsOnDate') return curDate;
                    if (key === 'selectedContractorId') return cid;
                    const team = (target.dailyProgressData?.contractors || []).find(c => c.id === cid);
                    if (key === 'selectedContractorName') return team?.name || '';
                    if (key === 'invoiceData' || key === 'projectMeta') return { ...(target[key] || {}), workOrderNo: '', contractorName: team?.name || '' };
                    return Reflect.get(target, key);
                },
                set(target, key, value) { if (String(key).startsWith('_memoContractorSap')) return true; return Reflect.set(target, key, value); }
            })) : null;
        if (contractorSap && contractorSap.materials && code && contractorSap.materials[code]) {
            const m = contractorSap.materials[code];
            if (Array.isArray(m.txns) && m.txns.length > 0) {
                let mGross = 0;
                let mMrn = 0;
                for (const [dt, g, mrn] of m.txns) {
                    if (dt && dt <= curDate) {
                        mGross += Number(g || 0);
                        mMrn += Number(mrn || 0);
                    }
                }
                sapIssued = Math.round((mGross - mMrn) * 1000) / 1000;
            } else if (m.daily && typeof m.daily === 'object') {
                let mGross = 0;
                let mMrn = 0;
                for (const [dt, arr] of Object.entries(m.daily)) {
                    if (dt && dt <= curDate) {
                        mGross += Number((arr && arr[0]) || 0);
                        mMrn += Number((arr && arr[1]) || 0);
                    }
                }
                sapIssued = Math.round((mGross - mMrn) * 1000) / 1000;
            } else {
                sapIssued = Number(m.netIssue !== undefined ? m.netIssue : (m.issuedQty || 0));
            }
        }

        // 2. Manual stock issues recorded in Daily Progress
        const issues = (this.dailyProgressData && this.dailyProgressData.issues) || [];
        const manualIssued = issues
            .filter(iss => iss.contractorId === cid && iss.itemId === item.id && (!iss.date || iss.date <= curDate))
            .reduce((sum, iss) => sum + (Number(iss.quantity) || 0), 0);

        const totalIssued = Math.round((sapIssued + manualIssued) * 1000) / 1000;

        // 3. Material consumed across saved daily reports up to curDate
        const reports = (this.dailyProgressData && this.dailyProgressData.reports) || [];
        const totalConsumed = reports
            .filter(r => r.contractorId === cid && r.date <= curDate)
            .reduce((sum, r) => sum + (Number(r.quantities && r.quantities[item.id]) || 0), 0);

        const balance = Math.round((totalIssued - totalConsumed) * 1000) / 1000;

        let status = 'none';
        if (totalIssued > 0) {
            if (balance > 0) status = 'in_stock';
            else if (balance === 0) status = 'zero';
            else status = 'overconsumed';
        } else if (totalConsumed > 0) {
            status = 'untracked_consumption';
        } else {
            status = 'awaiting_stock';
        }

        return {
            sapIssued,
            manualIssued,
            totalIssued,
            totalConsumed: Math.round(totalConsumed * 1000) / 1000,
            balance,
            status
        };
    },

    // ─── ISSUE TRANSACTIONS & CONTRACTOR MANAGEMENT ───────────────────────────

    async addDailyProgressIssue() {
        const iss = this.dailyProgressNewIssue;
        if (!iss.itemId || !iss.quantity || Number(iss.quantity) <= 0) {
            this.showToast('Please enter a valid material and positive quantity.', 'Alert');
            return;
        }

        const cid = this.dailyProgressContractorId;
        const newRecord = {
            id: 'iss_' + Date.now(),
            contractorId: cid,
            date: iss.date || this.dailyProgressDate || this.todayDateStr,
            itemId: String(iss.itemId),
            quantity: Math.round(Number(iss.quantity) * 1000) / 1000,
            reference: String(iss.reference || '').trim()
        };

        if (!this.dailyProgressData.issues) this.dailyProgressData.issues = [];
        this.dailyProgressData.issues.push(newRecord);
        await this.saveDailyProgressData();

        this.dailyProgressNewIssue = {
            date: this.dailyProgressDate || this.todayDateStr,
            itemId: '15',
            quantity: '',
            reference: ''
        };
        this.dailyProgressModal = '';
        this.showToast('Material issue recorded successfully!', 'Check');
    },

    async addDailyProgressContractor() {
        const c = this.dailyProgressNewContractor;
        if (!c.name || !c.name.trim()) {
            this.showToast('Please enter contractor name.', 'Alert');
            return;
        }

        const cleanName = c.name.trim();
        const id = this.normContractorId(cleanName);
        const existing = this.dailyProgressData.contractors.find(x => this.normContractorId(x.id) === id);
        if (existing) {
            this.showToast('Contractor with this name already exists.', 'Alert');
            this.dailyProgressContractorId = existing.id;
            this.dailyProgressModal = '';
            return;
        }

        const newC = {
            id,
            name: cleanName,
            project: c.project || 'Gadchiroli (T-10)',
            feeder: c.feeder || 'ANGARA',
            engineer: c.engineer || 'SUPERVISOR'
        };

        this.dailyProgressData.contractors.push(newC);

        // Also add to Billing Pro contractorsList
        if (Array.isArray(this.contractorsList) && !this.contractorsList.some(k => this.normContractorId(k.id) === id)) {
            this.contractorsList.push({
                id,
                name: cleanName,
                workOrderNo: '',
                feederName: newC.feeder
            });
        }

        await this.saveDailyProgressData();
        this.dailyProgressContractorId = id;
        this.dailyProgressNewContractor = { name: '', project: 'Gadchiroli (T-10)', feeder: '', engineer: '' };
        this.dailyProgressModal = '';
        this.showToast(`Contractor "${cleanName}" added successfully!`, 'Check');
    },

    // ─── EXCEL REPORT EXPORT ──────────────────────────────────────────────────

    async downloadDailyProgressExcel() {
        if (this.dailyProgressDirty) {
            this.showToast('Pehle daily progress save karein, phir Excel download karein.', 'Alert');
            return;
        }

        const from = this.dailyProgressExportFrom;
        const to = this.dailyProgressExportTo;
        if (!from || !to || from > to) {
            this.showToast('Kripya valid From aur To date chunein.', 'Alert');
            return;
        }

        this.dailyProgressBusy = true;
        this.showToast('Excel report generate ho raha hai...', '⏳');

        try {
            const cid = this.dailyProgressContractorId;
            const contractor = (this.dailyProgressData && this.dailyProgressData.contractors || []).find(c => c.id === cid) || {
                name: this.selectedContractorName || 'Contractor',
                project: 'Gadchiroli (T-10)',
                feeder: 'ANGARA',
                engineer: 'SUPERVISOR'
            };

            const reports = (this.dailyProgressData && this.dailyProgressData.reports || []).filter(r => r.contractorId === cid);
            const seedItems = (window.DailyProgressSeed && window.DailyProgressSeed.items) || [];

            // Calculate date range list
            const days = [];
            for (let d = new Date(from + 'T00:00:00Z'); d <= new Date(to + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
                days.push(d.toISOString().slice(0, 10));
            }

            if (!days.length || days.length > 366) {
                throw new Error('1 se 366 dino ka date range chunein.');
            }

            // Load template
            let templateBuffer = null;
            try {
                const res = await fetch('/api/daily-progress/template');
                if (res.ok) {
                    templateBuffer = await res.arrayBuffer();
                } else {
                    const res2 = await fetch('/api/daily-progress/template');
                    if (res2.ok) templateBuffer = await res2.arrayBuffer();
                }
            } catch (e) {
                console.warn('[DailyProgress] Fetch template error:', e);
            }

            if (!window.ExcelJS) {
                throw new Error('ExcelJS library load nahi hai. Page refresh karein.');
            }

            const workbook = new window.ExcelJS.Workbook();
            if (templateBuffer) {
                await workbook.xlsx.load(templateBuffer);
            }

            const baseWorksheet = workbook.worksheets[0];
            const templateModel = baseWorksheet ? JSON.parse(JSON.stringify(baseWorksheet.model)) : null;
            const getColLetter = (i) => i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + i - 26);

            // Chunk days into groups of 30 days per sheet
            for (let start = 0, sheetIdx = 1; start < days.length; start += 30, sheetIdx++) {
                const chunk = days.slice(start, start + 30);
                let ws;
                if (sheetIdx === 1 && baseWorksheet) {
                    ws = baseWorksheet;
                    ws.name = `Progress 1`;
                } else if (baseWorksheet) {
                    ws = workbook.addWorksheet(`Progress ${sheetIdx}`);
                    ws.model = { ...JSON.parse(JSON.stringify(templateModel)), id: ws.id, name: `Progress ${sheetIdx}`, mergeCells: templateModel.merges };
                } else {
                    ws = workbook.addWorksheet(`Progress ${sheetIdx}`);
                }

                // Header metadata
                ws.getCell('A2').value = 'PROJECT NAME: ' + (contractor.project || 'Gadchiroli (T-10)');
                ws.getCell('A3').value = 'NAME OF FEEDER: ' + (contractor.feeder || 'ANGARA');
                ws.getCell('A4').value = 'NAME OF DEPT. LABOUR TEAM: ' + (contractor.name || '');
                ws.getCell('A5').value = 'NAME OF ENGINEER/SUPERVISOR: ' + (contractor.engineer || '');

                // Clear all dynamic data cells across all 30 day columns (E to AH) to remove any template dummy values
                for (let c = 0; c < 30; c++) {
                    const colLetter = getColLetter(c + 4);
                    ws.getCell(colLetter + '6').value = null;
                    ws.getCell(colLetter + '7').value = null;
                    for (let mpR = 8; mpR <= 13; mpR++) {
                        ws.getCell(colLetter + mpR).value = null;
                    }
                    seedItems.forEach(it => {
                        ws.getCell(colLetter + it.row).value = null;
                    });
                }

                // Fill days and manpower
                chunk.forEach((date, i) => {
                    const colLetter = getColLetter(i + 4); // Col E = 4 (0-based)
                    const r = reports.find(x => x.date === date);
                    const m = (r && r.manpower) || {};

                    // Date serial in Row 7
                    const dtObj = new Date(date + 'T00:00:00Z');
                    const serial = Math.round((dtObj.getTime() - Date.UTC(1899, 11, 30)) / 86400000);
                    ws.getCell(colLetter + '7').value = serial;

                    // Total manpower in Row 6
                    ws.getCell(colLetter + '6').value = r ? ((m.leader || 0) + (m.skilled || 0) + (m.unskilled || 0)) : null;

                    // Manpower rows 8 to 13
                    const mpKeys = ['leader', 'skilled', 'unskilled', 'tractor', 'augur', 'room'];
                    mpKeys.forEach((k, j) => {
                        ws.getCell(colLetter + (8 + j)).value = r ? (m[k] || 0) : null;
                    });

                    // Material quantities: write actual quantity if > 0, otherwise cell is clean null
                    seedItems.forEach(it => {
                        const q = r && r.quantities && Number(r.quantities[it.id]);
                        if (q && q > 0) {
                            ws.getCell(colLetter + it.row).value = q;
                        }
                    });
                });

                // Row serials and Totals in Column AI
                seedItems.forEach((it, i) => {
                    ws.getCell('A' + it.row).value = i + 1;
                    const totalConsumedInChunk = chunk.reduce((sum, d) => {
                        const rep = reports.find(x => x.date === d);
                        return sum + (Number(rep && rep.quantities && rep.quantities[it.id]) || 0);
                    }, 0);
                    ws.getCell('AI' + it.row).value = totalConsumedInChunk > 0 ? totalConsumedInChunk : null;
                });

                // Notes in AJ8
                const notesStr = chunk
                    .map(d => {
                        const rep = reports.find(x => x.date === d);
                        return rep && rep.remarks ? `${d}: ${rep.remarks}` : '';
                    })
                    .filter(Boolean)
                    .join('\n');
                ws.getCell('AJ8').value = notesStr;
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const safeCont = (contractor.name || 'Contractor').replace(/[^a-z0-9 -]/gi, '_');
            a.href = url;
            a.download = `${safeCont}_Daily_Progress_${from}_to_${to}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 10000);

            this.showToast('Daily Progress Excel report downloaded!', 'Check');
        } catch (e) {
            console.error('[DailyProgress] Export error:', e);
            this.showToast('Export failed: ' + (e.message || e), 'Alert');
        } finally {
            this.dailyProgressBusy = false;
        }
    },

    copyDailyProgressShareLink() {
        const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
        const cid = this.dailyProgressContractorId || '';
        const dt = this.dailyProgressDate || '';
        const url = `${origin}/daily-progress.html?contractor=${encodeURIComponent(cid)}&date=${encodeURIComponent(dt)}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(() => {
                if (typeof this.showToast === 'function') {
                    this.showToast('Daily Progress page link copied to clipboard! 📋', '✅');
                } else {
                    alert('Link copied to clipboard!\n' + url);
                }
            }).catch(() => {
                prompt('Copy this Daily Progress link:', url);
            });
        } else {
            prompt('Copy this Daily Progress link:', url);
        }
    }
};
