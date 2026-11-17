/* Authenticated Daily Progress workspace: per-report writes and public-link administration. */
(() => {
    const module = window.DailyProgressModule;
    const originalInit = module.initDailyProgress;
    const originalLoad = module.loadDailyProgressReportForDate;
    const originalQuantity = module.onDailyProgressQuantityChange;
    const originalManpower = module.onDailyProgressManpowerChange;
    Object.assign(module, {
        dailyProgressEntryTime(value) {
            if (!value || isNaN(Date.parse(value))) return '—';
            return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) + ' IST';
        },
        openDailyProgressLoginsTab() {
            this.dailyProgressTab = 'logins';
            return this.runDailyProgressAdmin(async () => {
                await this.loadDailyProgressLoginsAndHistory();
            });
        },
        async loadDailyProgressLoginsAndHistory() {
            try {
                const res = await this.dailyProgressRequest('workers');
                this.dailyProgressWorkers = res.users || [];
            } catch (e) {
                console.warn('Failed to load workers:', e);
            }
            await this.loadDailyProgressEntryHistory();
        },
        openAddWorkerModal() {
            this.dailyProgressWorkerForm = {
                name: '',
                email: '',
                mobile: '',
                username: '',
                password: '',
                contractorIds: [this.dailyProgressContractorId],
                reset: false
            };
            this.dailyProgressModal = 'worker';
        },
        saveDailyProgressWorker() {
            return this.runDailyProgressAdmin(async () => {
                await this.dailyProgressRequest('workers', this.dailyProgressWorkerForm);
                this.dailyProgressModal = '';
                this.dailyProgressWorkerForm = { name: '', email: '', mobile: '', username: '', password: '', contractorIds: [this.dailyProgressContractorId], reset: false };
                await this.loadDailyProgressLoginsAndHistory();
            });
        },
        resetDailyProgressWorker(user) {
            this.dailyProgressWorkerForm = {
                name: user.name,
                email: user.email || '',
                mobile: user.mobile || '',
                username: user.username,
                password: '',
                contractorIds: [...(user.contractorIds || [])],
                reset: true
            };
            this.dailyProgressModal = 'worker';
        },
        disableDailyProgressWorker(user) {
            return this.runDailyProgressAdmin(async () => {
                if (!confirm(user.name + ' ka login disable karein?')) return;
                await this.dailyProgressRequest('workers/disable', { username: user.username });
                await this.loadDailyProgressLoginsAndHistory();
            });
        },
        deleteDailyProgressWorker(user) {
            return this.runDailyProgressAdmin(async () => {
                if (!confirm(`Kya aap ${user.name} (${user.username}) ka login permanently DELETE karna chahte hain?\nIs user ka account poori tarah delete ho jayega.`)) return;
                await this.dailyProgressRequest('workers/delete', { username: user.username });
                await this.loadDailyProgressLoginsAndHistory();
            });
        },
        setDailyProgressEnteredFilter(mode) {
            this.dailyProgressEnteredFilterMode = mode;
            if (mode === 'custom' && !this.dailyProgressEnteredCustomFrom) {
                this.dailyProgressEnteredCustomFrom = this.dailyProgressDate || '';
                this.dailyProgressEnteredCustomTo = this.dailyProgressDate || '';
            }
        },
        openContractorMonthlySheet(contractorId, targetDate) {
            this.dailyProgressContractorId = contractorId;
            const dt = targetDate || this.dailyProgressDate || new Date().toISOString().slice(0, 10);
            this.dailyProgressDate = dt;
            if (typeof this.loadDailyProgressReportForDate === 'function') {
                this.loadDailyProgressReportForDate(dt);
            }
            // Set export range for that target date's month
            const year = parseInt(dt.slice(0, 4), 10);
            const month = parseInt(dt.slice(5, 7), 10);
            const lastDay = new Date(year, month, 0).getDate();
            this.dailyProgressExportFrom = dt.slice(0, 7) + '-01';
            this.dailyProgressExportTo = dt.slice(0, 7) + '-' + String(lastDay).padStart(2, '0');
            // Switch to download / export sheet view
            this.dailyProgressTab = 'download';
        },
        async loadDailyProgressEntryHistory() {
            try {
                const result = await this.dailyProgressRequest('entry-history?contractorId=' + encodeURIComponent(this.dailyProgressContractorId));
                this.dailyProgressEntryHistory = result.events || [];
            } catch (e) {
                console.warn('Failed to load entry history:', e);
            }
        },
        dailyProgressEditor() {
            if (!this._dpEditor) this._dpEditor = crypto.randomUUID() + crypto.randomUUID();
            return this._dpEditor;
        },
        async dailyProgressRequest(route, body) {
            const response = await fetch('/api/dp-admin/' + route, {
                credentials: 'same-origin', cache: 'no-store',
                headers: { 'Content-Type': 'application/json', 'x-dp-editor': this.dailyProgressEditor() },
                ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }), signal: AbortSignal.timeout(45000)
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw Object.assign(new Error(result.error || 'Daily Progress service unavailable'), { status: response.status });
            return result;
        },
        async syncDailyProgressCloudData(silent = false) {
            if (this.dailyProgressDirty || this.dailyProgressBusy || this._dpPendingSave || this._dpCloudRefreshing) return false;
            this._dpCloudRefreshing = true;
            try {
                const response = await this.dailyProgressRequest('data');
                // An edit may have started while the network request was running.
                if (this.dailyProgressDirty || this.dailyProgressBusy || this._dpPendingSave || !response.data) return false;
                const local = this.dailyProgressData || { contractors: [], reports: [], issues: [] };
                const merged = this.mergeDailyProgressData(local, response.data);
                // The aggregate endpoint includes both share-page and Drive reports.
                // Its confirmed copy takes precedence over a clean device cache.
                const reports = new Map((local.reports || []).map(row => [row.contractorId + '|' + row.date, row]));
                for (const row of response.data.reports || []) reports.set(row.contractorId + '|' + row.date, row);
                merged.reports = [...reports.values()];
                this.dailyProgressData = merged;
                this.syncDailyProgressContractorsList();
                this.loadDailyProgressReportForDate(this.dailyProgressDate);
                if (typeof BillingStorage !== 'undefined' && typeof BillingStorage.setItem === 'function') {
                    await BillingStorage.setItem('billing_daily_progress', merged);
                }
                if (!silent) this.showToast('Share link ki latest entries sync ho gayi.', 'success');
                return true;
            } catch (e) {
                this.dailyProgressAccessMessage = e.message;
                if (!silent) this.showToast('Sync failed: ' + e.message, 'Alert');
                return false;
            } finally { this._dpCloudRefreshing = false; }
        },
        async initDailyProgress() {
            try { await originalInit.call(this); }
            catch (e) { this.showToast(e.message, 'Alert'); }
            try {
                const response = await this.dailyProgressRequest('data');
                if (response.data) {
                    const local = this.dailyProgressData || { contractors: [], reports: [], issues: [] };
                    for (const kind of ['contractors', 'reports', 'issues']) {
                        const key = row => kind === 'reports' ? row.contractorId + '|' + row.date : row.id;
                        const records = new Map((local[kind] || []).map(row => [key(row), row]));
                        for (const row of response.data[kind] || []) records.set(key(row), row);
                        local[kind] = [...records.values()];
                    }
                    this.dailyProgressData = local;
                    this.syncDailyProgressContractorsList();
                    if (!this.dailyProgressDirty) this.loadDailyProgressReportForDate(this.dailyProgressDate);
                }
                await this.refreshDailyProgressAccess();
            } catch (e) { this.dailyProgressAccessMessage = e.message; }
            if (!this._dpStatusTimer) this._dpStatusTimer = setInterval(() => {
                if (this.currentView === 'dailyProgress' && !this.dailyProgressBusy) {
                    if (this.dailyProgressServerState?.editable && Date.now() - (this._dpLastInput || 0) < 30000) {
                        this.dailyProgressRequest('heartbeat', { contractorId: this.dailyProgressContractorId, date: this.dailyProgressDate }).catch(() => {});
                    }
                    this.refreshDailyProgressStatus(false);
                }
            }, 20000);
        },
        loadDailyProgressReportForDate(date) {
            originalLoad.call(this, date);
            this.dailyProgressServerState = null;
            this._dpEditVersion = null;
            this.dailyProgressLocked = true;
            if (typeof fetch === 'function' && this.currentView === 'dailyProgress') this.refreshDailyProgressStatus(false);
        },
        async explainPendingDailyProgressSave() {
            if (!this._dpPendingSave) return;
            this.showToast('Pending save pehle retry karein; contractor/date abhi change nahi hui.', 'Alert');
        },
        async refreshDailyProgressStatus(claim = false) {
            const cid = this.dailyProgressContractorId, date = this.dailyProgressDate;
            if (!cid || !date || this.dailyProgressBusy) return;
            try {
                const result = claim
                    ? await this.dailyProgressRequest('claim', { contractorId: cid, date })
                    : await this.dailyProgressRequest('report?contractorId=' + encodeURIComponent(cid) + '&date=' + encodeURIComponent(date));
                if (cid !== this.dailyProgressContractorId || date !== this.dailyProgressDate || this.dailyProgressBusy) return;
                this.dailyProgressServerState = result;
                if (!this.dailyProgressDirty) this._dpEditVersion = result.version;
                this.dailyProgressLocked = !result.editable;
                this.dailyProgressAccessMessage = result.state === 'final' ? 'Saved entry locked hai. Admin Reopen se edit kholein.' : result.occupied ? 'Koi aur is contractor/date ki entry kar raha hai. Entry read-only hai.' : result.editable ? 'Entry reserved for this session. Final Save ke baad lock lagega.' : 'Start entry dabakar reservation lein.';
                if (!this.dailyProgressDirty && result.report) {
                    const reports = this.dailyProgressData && this.dailyProgressData.reports;
                    if (Array.isArray(reports)) {
                        const report = { ...result.report, contractorId: cid, date, version: result.version, state: result.state };
                        const index = reports.findIndex(row => row.contractorId === cid && row.date === date);
                        if (index < 0) reports.push(report); else reports[index] = report;
                    }
                    this.dailyProgressQuantities = { ...(result.report.quantities || {}) };
                    this.dailyProgressManpower = { ...(result.report.manpower || {}) };
                    this.dailyProgressRemarks = result.report.remarks || '';
                    this.dailyProgressVersion = result.version;
                }
            } catch (e) { this.dailyProgressLocked = true; this.dailyProgressAccessMessage = e.message; }
        },
        onDailyProgressQuantityChange(id, value) {
            if (this.dailyProgressLocked || this.dailyProgressBusy) return;
            this._dpLastInput = Date.now();
            originalQuantity.call(this, id, value);
        },
        onDailyProgressManpowerChange(id, value) {
            if (this.dailyProgressLocked || this.dailyProgressBusy) return;
            this._dpLastInput = Date.now();
            originalManpower.call(this, id, value);
        },
        async saveDailyProgressReport() {
            if (this.dailyProgressBusy) return;
            const cid = this.dailyProgressContractorId, date = this.dailyProgressDate;
            if (!cid || !date) return this.showToast('Contractor aur date select karein.', 'Alert');
            this.dailyProgressBusy = true;
            try {
                if (!this._dpPendingSave) {
                    const status = await this.dailyProgressRequest('claim', { contractorId: cid, date });
                    if (!status.editable) throw new Error(status.state === 'final' ? 'Entry locked hai. Admin se reopen karwayein.' : 'Koi aur entry kar raha hai.');
                    if (this._dpEditVersion !== null && this._dpEditVersion !== undefined && status.version !== this._dpEditVersion) throw new Error('Newer draft mil gaya hai. Apni entries copy karke report reload karein; overwrite nahi kiya gaya.');
                    this._dpPendingSave = {
                        contractorId: cid, date, version: status.version, epoch: status.epoch, requestId: crypto.randomUUID(), final: true,
                        report: { quantities: { ...this.dailyProgressQuantities }, manpower: { ...this.dailyProgressManpower }, remarks: this.dailyProgressRemarks || '' }
                    };
                }
                const pending = this._dpPendingSave;
                if (pending.contractorId !== cid || pending.date !== date) throw new Error('Pehle pending report save retry karein.');
                const saved = await this.dailyProgressRequest('report', pending);
                const report = { ...pending.report, contractorId: cid, date, version: saved.version, state: saved.state };
                const rows = this.dailyProgressData.reports;
                const idx = rows.findIndex(r => r.contractorId === cid && r.date === date);
                if (idx < 0) rows.push(report); else rows[idx] = report;
                this._dpPendingSave = null;
                this.dailyProgressDirty = false; this.dailyProgressVersion = saved.version; this.dailyProgressLocked = true;
                try { await this.saveDailyProgressData(); } catch { this.showToast('Drive par saved hai; device cache save nahi hua.', 'Alert'); }
                this.showToast('Google Drive par saved — entry locked.', 'Check');
            } catch (e) {
                this.showToast(e.message + ' Changes pending hain.', 'Alert');
                if ([400, 409, 423].includes(e.status)) this._dpPendingSave = null;
            } finally { this.dailyProgressBusy = false; }
        },
        async refreshDailyProgressAccess() {
            try {
                const result = await this.dailyProgressRequest('status');
                this.dailyProgressLinks = result.links;
                this.dailyProgressDriveReady = result.configured;
            } catch (e) { this.dailyProgressAccessMessage = e.message; }
        },
        runDailyProgressAdmin(action) {
            const run = () => Promise.resolve().then(action).catch(e => this.showToast(e.message, 'Alert'));
            if (!this.isAdminElevated && typeof this.checkAdminElevated === 'function') return this.checkAdminElevated(run);
            return run();
        },
        createDailyProgressLink() {
            return this.runDailyProgressAdmin(async () => {
                const c = this.dailyProgressActiveContractor;
                if (!c) throw new Error('Contractor select karein.');
                if (this.dailyProgressLinks.some(link => link.id === c.id) && !confirm('Naya link banane se purana link band ho jayega. Continue?')) return;
                const result = await this.dailyProgressRequest('links', { contractor: c });
                this.dailyProgressPublicLink = location.origin + '/daily-entry#link=' + result.token;
                await this.refreshDailyProgressAccess();
            });
        },
        disableDailyProgressLink(cid) {
            return this.runDailyProgressAdmin(async () => {
                await this.dailyProgressRequest('links/disable', { contractorId: cid });
                this.dailyProgressPublicLink = ''; await this.refreshDailyProgressAccess();
                this.showToast('Contractor public link disabled.', 'Check');
            });
        },
        reopenDailyProgressEntry() {
            return this.runDailyProgressAdmin(async () => {
                if (!confirm('Selected contractor/date ko dobara entry ke liye open karein?')) return;
                await this.dailyProgressRequest('reopen', { contractorId: this.dailyProgressContractorId, date: this.dailyProgressDate });
                await this.refreshDailyProgressStatus(false);
                this.showToast('Entry reopened. Purana draft retained hai.', 'Check');
            });
        },
        checkDailyProgressDrive() {
            return this.runDailyProgressAdmin(async () => {
                await this.dailyProgressRequest('storage-check', {});
                this.showToast('Google Drive folder aur write permission verified.', 'Check');
            });
        },
        showDailyProgressAudit() {
            return this.runDailyProgressAdmin(async () => {
                const response = await this.dailyProgressRequest('audit?contractorId=' + encodeURIComponent(this.dailyProgressContractorId) + '&date=' + this.dailyProgressDate);
                this.dailyProgressAudit = response.events;
            });
        },
        importDailyProgressHistory() {
            return this.runDailyProgressAdmin(async () => {
                if (!confirm('Existing local/historical reports ko Drive mein import aur lock karein? Already saved cloud records overwrite nahi honge.')) return;
                this.dailyProgressBusy = true;
                let count = 0;
                try {
                    for (const report of this.dailyProgressData.reports || []) {
                        const result = await this.dailyProgressRequest('import', { report, requestId: crypto.randomUUID() });
                        if (!result.skipped) count++;
                    }
                    this.showToast(count + ' historical reports imported to Drive.', 'Check');
                } finally { this.dailyProgressBusy = false; await this.refreshDailyProgressStatus(false); }
            });
        },
        async addDailyProgressIssue() {
            return this.runDailyProgressAdmin(async () => {
                const value = this.dailyProgressNewIssue;
                const quantity = Number(value.quantity);
                if (!value.itemId || !Number.isFinite(quantity) || quantity <= 0 || !this.dailyProgressContractorId) throw new Error('Valid material, contractor aur positive quantity chahiye.');
                const issue = { id: 'iss_' + crypto.randomUUID(), contractorId: this.dailyProgressContractorId, date: value.date || this.dailyProgressDate, itemId: String(value.itemId), quantity, reference: value.reference || '' };
                await this.dailyProgressRequest('auxiliary', { kind: 'issue', value: issue });
                if (!this.dailyProgressData.issues) this.dailyProgressData.issues = [];
                this.dailyProgressData.issues.push(issue);
                try { await this.saveDailyProgressData(); } catch {}
                this.dailyProgressNewIssue = { date: this.dailyProgressDate, itemId: '15', quantity: '', reference: '' };
                this.dailyProgressModal = ''; this.showToast('Material issue saved.', 'Check');
            });
        },
        async addDailyProgressContractor() {
            return this.runDailyProgressAdmin(async () => {
                const value = this.dailyProgressNewContractor;
                const name = String(value.name || '').trim();
                const id = this.normContractorId(name);
                if (!id) throw new Error('Valid contractor name chahiye.');
                const existing = this.dailyProgressData.contractors.find(c => this.normContractorId(c.id) === id);
                if (existing) { this.onDailyProgressContractorChange(existing.id); this.dailyProgressModal = ''; return; }
                const contractor = { id, name, project: value.project || '', feeder: value.feeder || '', engineer: value.engineer || '' };
                await this.dailyProgressRequest('auxiliary', { kind: 'contractor', value: contractor });
                this.dailyProgressData.contractors.push(contractor);
                if (!this.contractorsList.some(c => this.normContractorId(c.id) === id)) this.contractorsList.push({ id, name, workOrderNo: '', feederName: contractor.feeder });
                try { await this.saveDailyProgressData(); } catch {}
                this.onDailyProgressContractorChange(id);
                this.dailyProgressNewContractor = { name: '', project: '', feeder: '', engineer: '' };
                this.dailyProgressModal = ''; this.showToast('Contractor saved.', 'Check');
            });
        }
    });
})();
