/**
 * @file Daily Progress Standalone Application
 * @description Completely decoupled, shareable Daily Progress register.
 * Provides contractor selection, net stock issue verification, daily consumption entry,
 * manpower tracking, and multi-sheet Excel export.
 * 
 * STRICT RULE: Completely isolated from Billing Pro billing states and RA bills.
 */

(function () {
    'use strict';

    function getTodayStr() {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());
    }

    function normId(str) {
        if (!str) return '';
        return String(str).toLowerCase().replace(/^m\/s\.?\s*/i, '').replace(/[^a-z0-9]/g, '');
    }

    function normDate(d) {
        if (!d) return '';
        const str = String(d).trim();
        const m = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
        if (m) {
            return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
        }
        return str;
    }

    function splitWorkOrders(value) {
        const raw = Array.isArray(value) ? value : [value];
        return [...new Set(raw.flatMap(v => String(v || '').split(/[,/|;]+/))
            .map(v => v.trim())
            .filter(Boolean))];
    }

    const stockBlockWorkOrderCache = new WeakMap();

    function stockBlockWorkOrders(block) {
        if (!block) return [];
        const cached = stockBlockWorkOrderCache.get(block);
        if (cached) return cached;
        const workOrders = splitWorkOrders([block.allWorkOrders, block.workOrders, block.docHeader]);
        stockBlockWorkOrderCache.set(block, workOrders);
        return workOrders;
    }

    function matchesContractor(reportCid, actC) {
        if (!reportCid || !actC) return false;
        if (typeof actC === 'string') actC = { id: actC, name: actC };
        if (reportCid === actC.id || reportCid === actC.name) return true;
        const rNorm = normId(reportCid);
        if (!rNorm) return false;
        return rNorm === normId(actC.id) || rNorm === normId(actC.name);
    }

    const app = Vue.createApp({
        data() {
            const seed = window.DailyProgressSeed || { contractor: {}, items: [], records: [] };
            const defaultContractor = seed.contractor || {
                id: 'mangesh-sonwane',
                name: 'MANGESH SONWANE',
                project: 'Gadchiroli (T-10)',
                feeder: 'ANGARA',
                engineer: 'AMIT GOMASE'
            };

            // URL query parameters
            const params = new URLSearchParams(window.location.search);
            const queryContractor = params.get('contractor') || params.get('c') || '';
            const queryDate = normDate(params.get('date') || params.get('d') || '');

            return {
                currentTab: 'entry', // 'entry' | 'stock' | 'history' | 'download'
                selectedDate: queryDate || getTodayStr(),
                selectedContractorId: queryContractor || defaultContractor.id,
                items: seed.items || [],
                sapStock: null,
                contractors: [defaultContractor],
                entryLoginUser: null,
                reports: [],
                issues: [],
                // Current entry state
                quantities: {},
                manpower: { leader: 0, skilled: 0, unskilled: 0, tractor: 0, augur: 0, room: 0 },
                remarks: '',
                version: 0,
                dirty: false,
                filterMode: 'issued', // 'issued' (DEFAULT - Net Issue > 0) | 'all' | 'entered'
                searchQuery: '',
                visibleLimit: 80,
                busy: false,
                saveStatus: 'ready', // 'ready' | 'saving' | 'saved'
                toastMsg: '',
                toastType: 'info',
                toastTimer: null,
                showAddContractorModal: false,
                showAddIssueModal: false,
                newContractorForm: { name: '', project: 'Gadchiroli (T-10)', feeder: '', engineer: '' },
                newIssueForm: { date: getTodayStr(), itemId: '', quantity: '', reference: '' },
                exportFrom: (function() {
                    const now = new Date();
                    const y = now.getFullYear();
                    const m = String(now.getMonth() + 1).padStart(2, '0');
                    return `${y}-${m}-01`;
                })(),
                exportTo: (function() {
                    const now = new Date();
                    const y = now.getFullYear();
                    const m = String(now.getMonth() + 1).padStart(2, '0');
                    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
                    return `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
                })(),
                exportFilter: 'active',
                exportSearch: '',
                contractorDropdownOpen: false,
                contractorSearchText: '',
                showShareModal: false,
                shareContractorSearch: '',
                shareSelectedContractor: null,
                shareLinkDate: getTodayStr()
            };
        },

        computed: {
            shareFilteredContractors() {
                const list = this.contractors || [];
                const q = String(this.shareContractorSearch || '').trim().toLowerCase();
                if (!q) return list;
                return list.filter(c => {
                    return (c.name && c.name.toLowerCase().includes(q)) ||
                           (c.id && c.id.toLowerCase().includes(q)) ||
                           (c.feeder && c.feeder.toLowerCase().includes(q)) ||
                           (c.engineer && c.engineer.toLowerCase().includes(q)) ||
                           (c.project && c.project.toLowerCase().includes(q));
                });
            },

            currentShareUrl() {
                const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
                const c = this.shareSelectedContractor || this.activeContractor || {};
                const cid = c.id || '';
                const dt = this.shareLinkDate || this.selectedDate || '';
                return `${origin}/daily-progress.html?contractor=${encodeURIComponent(cid)}&date=${encodeURIComponent(dt)}`;
            },

            whatsappShareUrl() {
                const c = this.shareSelectedContractor || this.activeContractor || {};
                const dt = this.shareLinkDate || this.selectedDate || '';
                const text = `*Daily Progress Entry Link*\nContractor: ${c.name || ''}\nDate: ${dt}\nLink: ${this.currentShareUrl}`;
                return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
            },

            filteredContractors() {
                const list = this.contractors || [];
                const q = String(this.contractorSearchText || '').trim().toLowerCase();
                if (!q) return list;
                return list.filter(c => {
                    return (c.name && c.name.toLowerCase().includes(q)) ||
                           (c.firmName && c.firmName.toLowerCase().includes(q)) ||
                           (c.id && c.id.toLowerCase().includes(q)) ||
                           (c.feeder && c.feeder.toLowerCase().includes(q)) ||
                           (c.engineer && c.engineer.toLowerCase().includes(q)) ||
                           (c.project && c.project.toLowerCase().includes(q));
                });
            },

            activeContractor() {
                const curId = this.selectedContractorId;
                const norm = normId(curId);
                const list = this.contractors || [];
                const found = list.find(c => normId(c.id) === norm || normId(c.name) === norm || c.id === curId);
                if (found) return found;
                if (curId) {
                    const niceName = String(curId).replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    return { id: curId, name: niceName, project: 'Gadchiroli (T-10)', feeder: 'ANGARA' };
                }
                return list[0] || { id: 'mangesh-sonwane', name: 'MANGESH SONWANE', project: 'Gadchiroli (T-10)', feeder: 'ANGARA' };
            },

            contractorReports() {
                const actC = this.activeContractor || {};
                return (this.reports || []).filter(r => matchesContractor(r.contractorId, actC));
            },

            totalManpower() {
                return (Number(this.manpower.leader) || 0) + (Number(this.manpower.skilled) || 0) + (Number(this.manpower.unskilled) || 0);
            },

            enteredCount() {
                return Object.values(this.quantities).filter(q => Number(q) > 0).length;
            },

            issuedItemsCount() {
                return this.items.filter(item => {
                    const st = this.getItemStock(item);
                    return st.totalIssued > 0;
                }).length;
            },

            filteredItems() {
                const q = (this.searchQuery || '').toLowerCase().trim();
                return this.items.filter(item => {
                    const matchSearch = !q || (item.name || '').toLowerCase().includes(q) || String(item.code || '').toLowerCase().includes(q);
                    if (!matchSearch) return false;

                    if (this.filterMode === 'entered') {
                        return Number(this.quantities[item.id]) > 0;
                    }
                    if (this.filterMode === 'issued') {
                        const st = this.getItemStock(item);
                        return st.totalIssued > 0;
                    }
                    return true;
                });
            }
        },

        watch: {
            currentTab(newTab) {
                if (newTab === 'download') {
                    if (!this.exportFrom || this.exportFrom.startsWith('2026-09')) {
                        this.setExportRange('current_month');
                    }
                }
            },
            selectedContractorId() {
                this.ensureStock().then(() => this.loadReportForActiveDate());
            },
            selectedDate() {
                this.loadReportForActiveDate();
            }
        },

        async mounted() {
            if (window.DailyWorkerAuth) this.entryLoginUser = await window.DailyWorkerAuth.ready;
            await this.initData();
            if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
                document.addEventListener('click', (e) => {
                    if (this.contractorDropdownOpen && e.target && typeof e.target.closest === 'function' && !e.target.closest('.dp-contractor-picker-wrap')) {
                        this.contractorDropdownOpen = false;
                    }
                });
            }
        },

        methods: {
            toggleContractorDropdown() {
                this.contractorDropdownOpen = !this.contractorDropdownOpen;
                if (this.contractorDropdownOpen) {
                    this.contractorSearchText = '';
                    if (typeof this.$nextTick === 'function') {
                        this.$nextTick(() => {
                            if (this.$refs.contractorSearchRef) {
                                this.$refs.contractorSearchRef.focus();
                            }
                        });
                    }
                }
            },

            closeContractorDropdown() {
                this.contractorDropdownOpen = false;
                this.contractorSearchText = '';
            },

            selectContractor(cid) {
                this.selectedContractorId = cid;
                this.contractorDropdownOpen = false;
                this.contractorSearchText = '';
            },

            showToast(msg, type = 'info') {
                if (type !== 'error' && type !== 'warning') return;
                this.toastMsg = msg;
                this.toastType = type;
                if (this.toastTimer) clearTimeout(this.toastTimer);
                this.toastTimer = setTimeout(() => { this.toastMsg = ''; }, 4000);
            },

            async initData() {
                this.busy = true;
                try {
                    // 1. Build initial contractors list from defaultContractorsList + seed + SAP Stock
                    const contractorsMap = new Map();
                    const seed = window.DailyProgressSeed || {};
                    if (seed.contractor) {
                        contractorsMap.set(normId(seed.contractor.id), { ...seed.contractor });
                    }
                    const srcList = (typeof window !== 'undefined' && (window.defaultContractorsList || window.DefaultContractors)) || [];
                    if (Array.isArray(srcList)) {
                        srcList.forEach(c => {
                            const n = normId(c.id || c.name);
                            if (!n) return;
                            const workOrders = {
                                workOrderNo: c.workOrderNo || '',
                                workOrderNumbers: c.workOrderNumbers || '',
                                workOrders: c.workOrders || '',
                                allWorkOrders: c.allWorkOrders || ''
                            };
                            const existing = contractorsMap.get(n);
                            if (existing) {
                                Object.keys(workOrders).forEach(k => {
                                    if (!existing[k] && workOrders[k]) existing[k] = workOrders[k];
                                });
                                return;
                            }
                            contractorsMap.set(n, {
                                id: c.id || n,
                                name: c.name || c.firmName,
                                project: 'Gadchiroli (T-10)',
                                feeder: c.feederName || c.feeder || '',
                                engineer: c.engineer || '',
                                ...workOrders
                            });
                        });
                    }

                    if (window.ContractorSapStock && window.ContractorSapStock.byContractorNorm) {
                        for (const [key, block] of Object.entries(window.ContractorSapStock.byContractorNorm)) {
                            if (!contractorsMap.has(key) && block && block.contractorName) {
                                contractorsMap.set(key, {
                                    id: key,
                                    name: block.contractorName,
                                    project: 'Gadchiroli (T-10)',
                                    feeder: '',
                                    engineer: ''
                                });
                            }
                        }
                    }

                    const mappingGroups = (window.DefaultSapContractorMapping || window.MasterSapCodeMapping || {}).groups;
                    if (mappingGroups) {
                        for (const [key, group] of Object.entries(mappingGroups)) {
                            if (!contractorsMap.has(key) && group && group.displayName) {
                                contractorsMap.set(key, {
                                    id: key,
                                    name: group.displayName,
                                    project: 'Gadchiroli (T-10)',
                                    feeder: '',
                                    engineer: ''
                                });
                            }
                        }
                    }

                    // 1b. Public sanitized catalog (contractor names + materials) for logged-out share links.
                    if (!this.items.length || this.contractors.length < 2) {
                        try {
                            const catRes = await fetch('/api/daily-entry/catalog', { cache: 'no-store' });
                            if (catRes.ok) {
                                const catalog = await catRes.json();
                                if (catalog && catalog.success) {
                                    if (Array.isArray(catalog.items) && catalog.items.length) this.items = catalog.items;
                                    (catalog.contractors || []).forEach(c => {
                                        const n = normId(c.id || c.name);
                                        if (n && !contractorsMap.has(n)) contractorsMap.set(n, c);
                                    });
                                }
                            }
                        } catch (e) {
                            console.info('[DailyProgressStandalone] Public catalog unavailable:', e.message);
                        }
                    }

                    // 2. Fetch cloud data or localStorage
                    let loaded = null;
                    try {
                        const res = await fetch('/api/daily-progress/data?t=' + Date.now());
                        if (res.ok) {
                            const resJson = await res.json();
                            if (resJson && resJson.success && resJson.data) {
                                loaded = resJson.data;
                            }
                        }
                    } catch (e) {
                        console.info('[DailyProgressStandalone] Cloud load error, falling back to local:', e.message);
                    }

                    if (!loaded) {
                        try {
                            const localStr = localStorage.getItem('billing_daily_progress');
                            if (localStr) loaded = JSON.parse(localStr);
                        } catch (e) { }
                    }

                    // 3. Merge data
                    if (loaded) {
                        if (Array.isArray(loaded.contractors)) {
                            loaded.contractors.forEach(c => {
                                const n = normId(c.id || c.name);
                                if (n) contractorsMap.set(n, c);
                            });
                        }
                        this.reports = Array.isArray(loaded.reports) ? loaded.reports : [];
                        this.issues = Array.isArray(loaded.issues) ? loaded.issues : [];
                    } else if (seed.records && seed.contractor) {
                        // Seed default September 2026 reports
                        this.reports = seed.records.map(r => ({
                            contractorId: seed.contractor.id,
                            date: r.date,
                            quantities: { ...(r.quantities || {}) },
                            manpower: { ...(r.manpower || {}) },
                            remarks: r.remarks || '',
                            version: 1
                        }));
                    }

                    this.contractors = Array.from(contractorsMap.values());
                    const login = window.DailyWorkerAuth && window.DailyWorkerAuth.user;
                    if (login && login.role !== 'admin') {
                        const hasPerm = cid => {
                            const list = login.contractorIds || [];
                            if (list.includes('*') || list.includes('all')) return true;
                            return list.some(allowedId => matchesContractor(allowedId, { id: cid, name: cid }));
                        };
                        this.contractors = this.contractors.filter(c => hasPerm(c.id));
                        this.reports = this.reports.filter(row => hasPerm(row.contractorId));
                        this.issues = this.issues.filter(row => hasPerm(row.contractorId));
                        if (!this.contractors.length) throw new Error('Aapke login ke liye contractor available nahi hai. Admin se contact karein.');
                        if (!this.contractors.some(c => c.id === this.selectedContractorId)) this.selectedContractorId = this.contractors[0].id;
                    }

                    // If URL param matched a contractor, select it
                    const params = new URLSearchParams(window.location.search);
                    const qCid = params.get('contractor') || params.get('c');
                    if (qCid) {
                        let matched = this.contractors.find(c => matchesContractor(qCid, c));
                        if (matched) {
                            this.selectedContractorId = matched.id;
                        } else {
                            if (login && login.role !== 'admin') throw new Error('Is contractor ka link aapke login mein allowed nahi hai. Admin se sahi link lein.');
                            const niceName = qCid.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                            const fallbackContractor = {
                                id: qCid,
                                name: niceName,
                                project: 'Gadchiroli (T-10)',
                                feeder: 'ANGARA',
                                engineer: 'SUPERVISOR'
                            };
                            this.contractors.push(fallbackContractor);
                            this.selectedContractorId = fallbackContractor.id;
                        }
                    }

                    await this.ensureStock();
                    this.loadReportForActiveDate();
                } catch (err) {
                    console.error('[DailyProgressStandalone] Init error:', err);
                } finally {
                    this.busy = false;
                }
            },

            findContractorStockBlocks(actC) {
                actC = actC || this.activeContractor || {};
                const sapStock = this.sapStock || window.ContractorSapStock;
                const byNorm = sapStock && sapStock.byContractorNorm;
                if (!byNorm || !actC) return [];

                const candidateNames = [actC.id, actC.name].filter(Boolean);
                const qNorms = [...new Set(candidateNames.map(normId).filter(n => n.length >= 2))];
                const desiredWos = splitWorkOrders([
                    actC.workOrderNo,
                    actC.workOrderNumbers,
                    actC.workOrders,
                    actC.allWorkOrders
                ]);
                const cacheKey = qNorms.join('|') + '#' + desiredWos.join(',');
                if (this._stockBlocksCache && this._stockBlocksCacheKey === cacheKey && this._stockBlocksCacheRef === byNorm) {
                    return this._stockBlocksCache;
                }

                const candidates = new Map();
                const add = (key, block) => {
                    if (!block) return;
                    const blockWos = stockBlockWorkOrders(block).slice().sort();
                    const identity = blockWos.length ? 'wo:' + blockWos.join(',') : 'key:' + key;
                    const previous = candidates.get(identity);
                    const size = Object.keys(block.materials || {}).length;
                    const previousSize = previous ? Object.keys(previous.block.materials || {}).length : -1;
                    if (!previous || size > previousSize) candidates.set(identity, { key, block });
                };
                const matchesDesiredWorkOrder = block => {
                    if (!desiredWos.length) return true;
                    const blockWos = stockBlockWorkOrders(block);
                    if (!blockWos.length) return true;
                    return blockWos.some(wo => desiredWos.includes(wo));
                };

                // 1. Exact contractor id/name keys. Never let a wrong work order win over master data.
                for (const q of qNorms) {
                    const block = byNorm[q];
                    if (block && matchesDesiredWorkOrder(block)) add(q, block);
                }

                // 2. Exact mapping groups only.
                const mapGroups = (window.DefaultSapContractorMapping || window.MasterSapCodeMapping || {}).groups || {};
                for (const [gKey, group] of Object.entries(mapGroups)) {
                    const names = [gKey, group && group.displayName, ...((group && group.rawNorms) || [])].map(normId).filter(Boolean);
                    const groupWos = splitWorkOrders((group && group.wos) || []);
                    if (!names.some(n => qNorms.includes(n)) && !groupWos.some(wo => desiredWos.includes(wo))) continue;
                    if (byNorm[gKey] && matchesDesiredWorkOrder(byNorm[gKey])) add(gKey, byNorm[gKey]);
                    for (const [key, block] of Object.entries(byNorm)) {
                        const blockWos = stockBlockWorkOrders(block);
                        const groupMatch = names.includes(key) || blockWos.some(wo => groupWos.includes(wo));
                        if (groupMatch && matchesDesiredWorkOrder(block)) add(key, block);
                    }
                }

                // 3. Exact contractor name only (no substring or token matching).
                for (const [key, block] of Object.entries(byNorm)) {
                    const cName = normId(block && block.contractorName);
                    if (qNorms.includes(cName) && matchesDesiredWorkOrder(block)) add(key, block);
                }

                const result = [...candidates.values()].map(entry => entry.block);
                this._stockBlocksCache = result;
                this._stockBlocksCacheKey = cacheKey;
                this._stockBlocksCacheRef = byNorm;
                return result;
            },

            findContractorStockBlock(actC) {
                return this.findContractorStockBlocks(actC)[0] || null;
            },

            async ensureStock() {
                const actC = this.activeContractor || {};
                const cid = actC.id || this.selectedContractorId || '';
                if (!cid) return;
                if (this.findContractorStockBlock(actC)) return;
                const reqKey = normId(cid) + '_' + normId(actC.name || '');
                if (this._stockRequest === reqKey) return;
                this._stockRequest = reqKey;
                try {
                    let res = await fetch('/api/daily-entry/stock/' + encodeURIComponent(cid), { cache: 'no-store' });
                    let payload = res.ok ? await res.json() : null;
                    if ((!payload || !payload.success || !payload.byContractorNorm || !Object.keys(payload.byContractorNorm).length) && actC.name && actC.name !== cid) {
                        res = await fetch('/api/daily-entry/stock/' + encodeURIComponent(actC.name), { cache: 'no-store' });
                        if (res.ok) payload = await res.json();
                    }
                    if (payload && payload.success && payload.byContractorNorm) {
                        const existing = (this.sapStock || window.ContractorSapStock || {}).byContractorNorm || {};
                        this.sapStock = { byContractorNorm: { ...existing, ...payload.byContractorNorm } };
                    }
                } catch (e) {
                    console.info('[DailyProgressStandalone] Public stock unavailable:', e.message);
                } finally {
                    this._stockRequest = '';
                }
            },

            loadReportForActiveDate() {
                const actC = this.activeContractor || {};
                const curDate = normDate(this.selectedDate);

                const matchingReps = (this.reports || []).filter(r => {
                    return matchesContractor(r.contractorId, actC) && normDate(r.date) === curDate;
                });

                // Pick the report with highest entered quantities, highest version, and freshest update
                matchingReps.sort((a, b) => {
                    const qA = Object.values(a.quantities || {}).filter(q => Number(q) > 0).length;
                    const qB = Object.values(b.quantities || {}).filter(q => Number(q) > 0).length;
                    if (qB !== qA) return qB - qA;
                    const verDiff = Number(b.version || 0) - Number(a.version || 0);
                    if (verDiff !== 0) return verDiff;
                    return (new Date(b.updatedAt || 0)) - (new Date(a.updatedAt || 0));
                });

                const rep = matchingReps[0];
                if (rep) {
                    this.quantities = { ...(rep.quantities || {}) };
                    this.manpower = {
                        leader: Number(rep.manpower && rep.manpower.leader) || 0,
                        skilled: Number(rep.manpower && rep.manpower.skilled) || 0,
                        unskilled: Number(rep.manpower && rep.manpower.unskilled) || 0,
                        tractor: Number(rep.manpower && rep.manpower.tractor) || 0,
                        augur: Number(rep.manpower && rep.manpower.augur) || 0,
                        room: Number(rep.manpower && rep.manpower.room) || 0
                    };
                    this.remarks = rep.remarks || '';
                    this.version = rep.version || 1;
                    this.dirty = false;
                } else {
                    this.quantities = {};
                    this.manpower = { leader: 0, skilled: 0, unskilled: 0, tractor: 0, augur: 0, room: 0 };
                    this.remarks = '';
                    this.version = 0;
                    this.dirty = false;

                    // Silently check if server has fresh draft/save from portal
                    if (!this._fetchingLatestReport && typeof fetch === 'function') {
                        this.fetchLatestReportsSilently();
                    }
                }
            },

            async fetchLatestReportsSilently() {
                if (this._fetchingLatestReport) return;
                this._fetchingLatestReport = true;
                try {
                    const res = await fetch('/api/daily-progress/data?t=' + Date.now());
                    if (res.ok) {
                        const resJson = await res.json();
                        if (resJson && resJson.success && resJson.data && Array.isArray(resJson.data.reports)) {
                            this.reports = resJson.data.reports;
                            const actC = this.activeContractor || {};
                            const curDate = normDate(this.selectedDate);
                            const matching = (this.reports || []).filter(r => matchesContractor(r.contractorId, actC) && normDate(r.date) === curDate);
                            matching.sort((a, b) => {
                                const qA = Object.values(a.quantities || {}).filter(q => Number(q) > 0).length;
                                const qB = Object.values(b.quantities || {}).filter(q => Number(q) > 0).length;
                                if (qB !== qA) return qB - qA;
                                return Number(b.version || 0) - Number(a.version || 0);
                            });
                            const freshRep = matching[0];
                            if (freshRep && !this.dirty) {
                                this.quantities = { ...(freshRep.quantities || {}) };
                                this.manpower = {
                                    leader: Number(freshRep.manpower && freshRep.manpower.leader) || 0,
                                    skilled: Number(freshRep.manpower && freshRep.manpower.skilled) || 0,
                                    unskilled: Number(freshRep.manpower && freshRep.manpower.unskilled) || 0,
                                    tractor: Number(freshRep.manpower && freshRep.manpower.tractor) || 0,
                                    augur: Number(freshRep.manpower && freshRep.manpower.augur) || 0,
                                    room: Number(freshRep.manpower && freshRep.manpower.room) || 0
                                };
                                this.remarks = freshRep.remarks || '';
                                this.version = freshRep.version || 1;
                            }
                        }
                    }
                } catch (_) {}
                finally {
                    this._fetchingLatestReport = false;
                }
            },

            onQuantityInput(itemId, val) {
                const num = Number(val);
                if (num > 0) {
                    this.quantities = { ...this.quantities, [itemId]: num };
                } else {
                    const copy = { ...this.quantities };
                    delete copy[itemId];
                    this.quantities = copy;
                }
                this.dirty = true;
            },

            navigateDay(step) {
                if (!this.selectedDate) this.selectedDate = getTodayStr();
                const d = new Date(this.selectedDate + 'T00:00:00Z');
                d.setUTCDate(d.getUTCDate() + step);
                this.selectedDate = d.toISOString().slice(0, 10);
            },

            setToday() {
                this.selectedDate = getTodayStr();
            },

            /**
             * Calculates Net Issued and consumption for any material item.
             * USER INSTRUCTION: "net balance na dikha kar net issue dikhao"
             */
            getItemStock(item) {
                if (!item) return { sapIssued: 0, manualIssued: 0, totalIssued: 0, totalConsumed: 0, balance: 0 };

                const actC = this.activeContractor || {};
                const cidNorm = normId(actC.id || '');
                const cNameNorm = normId(actC.name || '');
                const curDate = this.selectedDate || getTodayStr();
                const code = String(item.code || '').trim();

                let sapIssued = 0;
                if (code) {
                    for (const contractorBlock of this.findContractorStockBlocks(actC)) {
                        if (!contractorBlock || !contractorBlock.materials || !contractorBlock.materials[code]) continue;
                        const m = contractorBlock.materials[code];
                        if (Array.isArray(m.txns) && m.txns.length > 0) {
                            let mGross = 0, mMrn = 0;
                            for (const [dt, g, mrn] of m.txns) {
                                if (dt && dt <= curDate) {
                                    mGross += Number(g || 0);
                                    mMrn += Number(mrn || 0);
                                }
                            }
                            sapIssued += mGross - mMrn;
                        } else if (m.daily && typeof m.daily === 'object') {
                            let mGross = 0, mMrn = 0;
                            for (const [dt, arr] of Object.entries(m.daily)) {
                                if (dt && dt <= curDate) {
                                    mGross += Number((arr && arr[0]) || 0);
                                    mMrn += Number((arr && arr[1]) || 0);
                                }
                            }
                            sapIssued += mGross - mMrn;
                        } else {
                            sapIssued += Number(m.netIssue !== undefined ? m.netIssue : (m.issuedQty !== undefined ? m.issuedQty : (m.net || 0)));
                        }
                    }
                    sapIssued = Math.round(sapIssued * 1000) / 1000;
                }

                // 2. Manual Issues
                const manualIssued = (this.issues || [])
                    .filter(iss => matchesContractor(iss.contractorId, actC) && String(iss.itemId) === String(item.id) && (!iss.date || iss.date <= curDate))
                    .reduce((sum, iss) => sum + (Number(iss.quantity) || 0), 0);

                const totalIssued = Math.round((sapIssued + manualIssued) * 1000) / 1000;

                // 3. Total Consumed
                const totalConsumed = (this.reports || [])
                    .filter(r => matchesContractor(r.contractorId, actC) && r.date <= curDate)
                    .reduce((sum, r) => sum + (Number(r.quantities && r.quantities[item.id]) || 0), 0);

                const balance = Math.round((totalIssued - totalConsumed) * 1000) / 1000;

                return {
                    sapIssued,
                    manualIssued,
                    totalIssued,
                    totalConsumed,
                    balance
                };
            },

            async saveProgress() {
                this.busy = true;
                this.saveStatus = 'saving';
                try {
                    const actC = this.activeContractor || {};
                    const cid = actC.id || this.selectedContractorId;
                    const cidNorm = normId(cid);
                    const cNameNorm = normId(actC.name || '');
                    const curDate = this.selectedDate;

                    const cleanQuantities = {};
                    for (const [k, v] of Object.entries(this.quantities)) {
                        const num = Number(v);
                        if (num > 0) cleanQuantities[k] = num;
                    }

                    const reportObj = {
                        contractorId: cid,
                        date: curDate,
                        quantities: cleanQuantities,
                        manpower: { ...this.manpower },
                        remarks: this.remarks || '',
                        version: (this.version || 0) + 1,
                        updatedAt: new Date().toISOString()
                    };

                    const existingIdx = this.reports.findIndex(r => {
                        return matchesContractor(r.contractorId, actC) && r.date === curDate;
                    });
                    if (existingIdx >= 0) {
                        this.reports[existingIdx] = reportObj;
                    } else {
                        this.reports.push(reportObj);
                    }

                    this.version = reportObj.version;
                    this.dirty = false;

                    const payload = {
                        contractors: this.contractors,
                        reports: this.reports,
                        issues: this.issues,
                        updatedAt: new Date().toISOString()
                    };

                    // Save locally first
                    try {
                        localStorage.setItem('billing_daily_progress', JSON.stringify(payload));
                    } catch (e) { }

                    // Save to cloud API
                    let cloudSaved = false;
                    try {
                        const res = await fetch('/api/daily-progress/data', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        if (res.ok) {
                            const resJson = await res.json().catch(() => null);
                            if (resJson && resJson.success === true) {
                                cloudSaved = true;
                                for (const report of resJson.reports || []) {
                                    const index = this.reports.findIndex(row => row.contractorId === report.contractorId && row.date === report.date);
                                    if (index >= 0) this.reports[index] = report;
                                    if (report.contractorId === cid && report.date === curDate) this.version = report.version;
                                }
                                try { localStorage.setItem('billing_daily_progress', JSON.stringify({ ...payload, reports: this.reports })); } catch {}
                            }
                        }
                    } catch (e) {
                        console.warn('[DailyProgressStandalone] Cloud save network error:', e);
                    }

                    if (cloudSaved) {
                        this.saveStatus = 'saved';
                        this.showToast(`Daily Progress saved & synced to cloud! ✅ (${this.selectedDate})`, 'success');
                    } else {
                        this.dirty = true;
                        this.saveStatus = 'offline';
                        this.showToast(`Device par save hua, cloud sync fail hua. Internet check karein. ⚠️`, 'warning');
                    }
                } catch (err) {
                    this.showToast('Save failed: ' + err.message, 'error');
                } finally {
                    this.busy = false;
                }
            },

            getContractorShareUrl(cid, dt) {
                const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
                return `${origin}/daily-progress.html?contractor=${encodeURIComponent(cid)}&date=${encodeURIComponent(dt || this.selectedDate || '')}`;
            },

            getContractorWhatsappUrl(c, dt) {
                const url = this.getContractorShareUrl(c.id, dt);
                const text = `*Daily Progress Entry Link*\nContractor: ${c.name || ''}\nDate: ${dt || this.selectedDate || ''}\nLink: ${url}`;
                return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
            },

            selectShareContractor(c) {
                this.shareSelectedContractor = c;
            },

            copyShareUrl(url) {
                if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(url).then(() => {
                        this.showToast('Daily Progress page link copied to clipboard! 📋', 'success');
                    }).catch(() => {
                        prompt('Copy this Daily Progress link:', url);
                    });
                } else {
                    prompt('Copy this Daily Progress link:', url);
                }
            },

            openShareModal() {
                this.shareSelectedContractor = this.activeContractor;
                this.shareContractorSearch = '';
                this.shareLinkDate = this.selectedDate || getTodayStr();
                this.showShareModal = true;
                if (typeof this.$nextTick === 'function') {
                    this.$nextTick(() => {
                        if (this.$refs.shareSearchInput) {
                            this.$refs.shareSearchInput.focus();
                        }
                    });
                }
            },

            copyShareLink() {
                this.openShareModal();
                this.copyShareUrl(this.currentShareUrl);
            },

            openReport(date) {
                this.selectedDate = date;
                this.currentTab = 'entry';
            },

            async submitAddContractor() {
                const name = (this.newContractorForm.name || '').trim();
                if (!name) return;
                const id = normId(name);
                const contractorObj = {
                    id: id,
                    name: name,
                    project: this.newContractorForm.project || 'Gadchiroli (T-10)',
                    feeder: this.newContractorForm.feeder || '',
                    engineer: this.newContractorForm.engineer || ''
                };
                this.contractors.push(contractorObj);
                this.selectedContractorId = id;
                this.showAddContractorModal = false;
                this.newContractorForm = { name: '', project: 'Gadchiroli (T-10)', feeder: '', engineer: '' };
                await this.saveProgress();
                this.showToast(`Contractor team [${name}] added!`, 'success');
            },

            submitAddIssue() {
                const qty = Number(this.newIssueForm.quantity);
                if (!this.newIssueForm.itemId || !(qty > 0)) {
                    alert('Material aur valid quantity zaroori hai!');
                    return;
                }
                const issueObj = {
                    id: 'iss_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                    contractorId: this.activeContractor.id,
                    date: this.newIssueForm.date || this.selectedDate,
                    itemId: this.newIssueForm.itemId,
                    quantity: qty,
                    reference: (this.newIssueForm.reference || '').trim()
                };
                this.issues.push(issueObj);
                this.showAddIssueModal = false;
                this.newIssueForm = { date: getTodayStr(), itemId: '', quantity: '', reference: '' };
                this.saveProgress();
                this.showToast('Material issue record added! 📦', 'success');
            },

            getExportDays() {
                if (!this.exportFrom || !this.exportTo || this.exportFrom > this.exportTo) return [];
                const days = [];
                const dStart = new Date(this.exportFrom + 'T00:00:00Z');
                const dEnd = new Date(this.exportTo + 'T00:00:00Z');
                for (let d = new Date(dStart); d <= dEnd; d.setUTCDate(d.getUTCDate() + 1)) {
                    days.push(d.toISOString().slice(0, 10));
                }
                return days.slice(0, 62);
            },

            getExportDayReport(date) {
                return this.contractorReports.find(r => r.date === date);
            },

            getExportDayQty(itemId, date) {
                const rep = this.getExportDayReport(date);
                return (rep && rep.quantities && Number(rep.quantities[itemId])) || 0;
            },

            getExportItemTotal(itemId) {
                const days = this.getExportDays();
                return days.reduce((sum, d) => sum + this.getExportDayQty(itemId, d), 0);
            },

            getExportDayManpower(date, key) {
                const rep = this.getExportDayReport(date);
                if (!rep || !rep.manpower) return 0;
                if (key === 'total') {
                    return (Number(rep.manpower.leader) || 0) + (Number(rep.manpower.skilled) || 0) + (Number(rep.manpower.unskilled) || 0);
                }
                return Number(rep.manpower[key]) || 0;
            },

            getExportPreviewItems() {
                const items = this.items || [];
                const filter = this.exportFilter || 'active';
                const q = String(this.exportSearch || '').trim().toLowerCase();

                return items.filter(it => {
                    if (q) {
                        const matches = String(it.name || '').toLowerCase().includes(q) ||
                            String(it.code || '').toLowerCase().includes(q);
                        if (!matches) return false;
                    }
                    if (filter === 'all') return true;
                    const stock = this.getItemStock(it);
                    const totalRangeConsumed = this.getExportItemTotal(it.id);
                    if (filter === 'issued') {
                        return (stock && stock.totalIssued > 0);
                    }
                    return (stock && stock.totalIssued > 0) || totalRangeConsumed > 0;
                });
            },

            openExportTab() {
                this.setExportRange('current_month');
                this.currentTab = 'download';
            },

            setExportRange(rangeType) {
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                if (rangeType === 'current_month' || rangeType === 'this_month') {
                    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
                    this.exportFrom = `${year}-${month}-01`;
                    this.exportTo = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
                } else if (rangeType === 'prev_month') {
                    const prev = new Date(year, now.getMonth() - 1, 1);
                    const pYear = prev.getFullYear();
                    const pMonth = String(prev.getMonth() + 1).padStart(2, '0');
                    const pLastDay = new Date(pYear, prev.getMonth() + 1, 0).getDate();
                    this.exportFrom = `${pYear}-${pMonth}-01`;
                    this.exportTo = `${pYear}-${pMonth}-${String(pLastDay).padStart(2, '0')}`;
                } else if (rangeType === 'sep2026') {
                    this.exportFrom = '2026-09-01';
                    this.exportTo = '2026-09-30';
                } else if (rangeType === 'last30') {
                    const d30 = new Date();
                    d30.setDate(d30.getDate() - 29);
                    this.exportFrom = d30.toISOString().slice(0, 10);
                    this.exportTo = now.toISOString().slice(0, 10);
                }
            },

            formatShortDay(dateStr) {
                if (!dateStr) return '';
                const parts = dateStr.split('-');
                if (parts.length === 3) {
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const mIdx = parseInt(parts[1], 10) - 1;
                    return `${parts[2]}-${monthNames[mIdx] || parts[1]}`;
                }
                return dateStr;
            },

            async downloadExcelReport() {
                if (!window.ExcelJS) {
                    alert('ExcelJS library load ho rahi hai... Kripya 2 second baad dobara dabayein.');
                    return;
                }
                this.busy = true;
                try {
                    const days = [];
                    const startD = new Date(this.exportFrom + 'T00:00:00Z');
                    const endD = new Date(this.exportTo + 'T00:00:00Z');
                    for (let d = new Date(startD); d <= endD; d.setUTCDate(d.getUTCDate() + 1)) {
                        days.push(d.toISOString().slice(0, 10));
                    }
                    if (!days.length || days.length > 366) {
                        alert('1 se 366 dino ka date range chunein.');
                        return;
                    }

                    let templateBuffer = null;
                    try {
                        const res = await fetch('/api/daily-progress/template');
                        if (res.ok) templateBuffer = await res.arrayBuffer();
                    } catch (e) { }

                    const workbook = new window.ExcelJS.Workbook();
                    if (templateBuffer) {
                        await workbook.xlsx.load(templateBuffer);
                    }

                    const baseWorksheet = workbook.worksheets[0];
                    const templateModel = baseWorksheet ? JSON.parse(JSON.stringify(baseWorksheet.model)) : null;
                    const getColLetter = (i) => i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + i - 26);
                    const contractor = this.activeContractor;

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

                        // Header info
                        ws.getCell('A2').value = 'PROJECT NAME: ' + (contractor.project || 'Gadchiroli (T-10)');
                        ws.getCell('A3').value = 'NAME OF FEEDER: ' + (contractor.feeder || '');
                        ws.getCell('A4').value = 'NAME OF DEPT. LABOUR TEAM: ' + (contractor.name || '');
                        ws.getCell('A5').value = 'NAME OF ENGINEER/SUPERVISOR: ' + (contractor.engineer || '');

                        // Clear sample values in chunk range
                        for (let r = 6; r <= 420; r++) {
                            if (r === 14) continue;
                            for (let c = 5; c <= 35; c++) {
                                const cell = ws.getCell(r, c);
                                if (cell && cell.value !== undefined) cell.value = null;
                            }
                        }

                        chunk.forEach((dt, i) => {
                            const colLetter = getColLetter(i + 4);
                            const rep = this.contractorReports.find(x => x.date === dt);
                            const mp = rep?.manpower || {};

                            ws.getCell(colLetter + '7').value = dt;
                            ws.getCell(colLetter + '6').value = rep ? ((mp.leader || 0) + (mp.skilled || 0) + (mp.unskilled || 0)) : null;

                            ['leader', 'skilled', 'unskilled', 'tractor', 'augur', 'room'].forEach((k, j) => {
                                ws.getCell(colLetter + (8 + j)).value = rep ? (mp[k] || 0) : null;
                            });

                            this.items.forEach(it => {
                                const q = rep?.quantities && rep.quantities[it.id];
                                if (Number(q) > 0) {
                                    ws.getCell(colLetter + it.row).value = Number(q);
                                }
                            });
                        });

                        // Sum formula on AI column
                        this.items.forEach(it => {
                            const total = chunk.reduce((sum, d) => {
                                const rep = this.contractorReports.find(x => x.date === d);
                                return sum + (Number(rep?.quantities && rep.quantities[it.id]) || 0);
                            }, 0);
                            const aiCell = ws.getCell('AI' + it.row);
                            aiCell.value = total > 0 ? total : null;
                        });
                    }

                    const outBuffer = await workbook.xlsx.writeBuffer();
                    const blob = new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                    const blobUrl = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = `Daily_Progress_${contractor.name.replace(/[^a-z0-9]/gi, '_')}_${this.exportFrom}_to_${this.exportTo}.xlsx`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
                    this.showToast('Excel report successfully downloaded! 📊', 'success');
                } catch (err) {
                    alert('Export error: ' + err.message);
                } finally {
                    this.busy = false;
                }
            }
        }
    });

    if (typeof app.directive === 'function') {
        app.directive('click-outside', {
            beforeMount(el, binding) {
                el._clickOutsideHandler = (event) => {
                    if (!(el === event.target || el.contains(event.target))) {
                        binding.value(event);
                    }
                };
                if (typeof document !== 'undefined') {
                    document.addEventListener('click', el._clickOutsideHandler);
                }
            },
            unmounted(el) {
                if (typeof document !== 'undefined' && el._clickOutsideHandler) {
                    document.removeEventListener('click', el._clickOutsideHandler);
                }
            }
        });
    }

    app.mount('#app');
})();
