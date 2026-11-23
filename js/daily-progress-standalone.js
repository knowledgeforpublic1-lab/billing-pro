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

    const shareParams = new URLSearchParams(window.location.search);
    const linkContractor = shareParams.get('contractor') || shareParams.get('c') || '__link_required__';
    let requestContractor = linkContractor;
    const shareStorageKey = 'billing_daily_progress_share:' + encodeURIComponent(linkContractor);
    const readShareCache = () => localStorage.getItem(shareStorageKey) || localStorage.getItem('billing_daily_progress');
    function shareFetch(url, options = {}) {
        return fetch(url, { ...options, credentials: 'same-origin', headers: {
            ...(options.headers || {}), 'X-DP-Share-Contractor': encodeURIComponent(requestContractor)
        } });
    }

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
    function locationKey(value) { return value === 'legacy' ? '' : String(value || ''); }
    function reportKey(row) { return row.contractorId + '|' + row.date + '|' + locationKey(row.locationId); }

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
            const defaultContractor = (seed.contractor && seed.contractor.id ? seed.contractor : null) || {
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
                sidebarOpen: false,
                currentTab: 'entry', // 'entry' | 'stock' | 'history' | 'download'
                selectedDate: queryDate || getTodayStr(),
                selectedContractorId: queryContractor || defaultContractor.id,
                selectedLocationId: params.get('location') || '',
                locations: (typeof window !== 'undefined' && window.DefaultFeeders) ? [...window.DefaultFeeders.list] : [],
                newLocationName: '',
                locationError: '',
                divisionFilter: 'ALL',
                subDivisionFilter: 'ALL',
                substationFilter: 'ALL',
                feederSearch: '',
                locationDropdownOpen: false,
                locationSearchQuery: '',
                showCustomLocation: false,
                items: seed.items || [],
                sapStock: null,
                stockKeysByContractor: {},
                contractors: [defaultContractor],
                entryLoginUser: null,
                reports: [],
                reportStates: [],
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
                isDark: (typeof localStorage !== 'undefined' && (localStorage.getItem('billing_theme_mode') === 'dark' || localStorage.getItem('billing_theme') === 'dark')),
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
            activeLocationName() {
                if (this.selectedLocationId === 'legacy' || !this.selectedLocationId) return 'Legacy / Unassigned';
                const found = (this.locations || []).find(row => row.id === this.selectedLocationId);
                if (found && found.name) return found.name;
                if (typeof window !== 'undefined' && window.DefaultFeeders) {
                    const def = window.DefaultFeeders.get(this.selectedLocationId);
                    if (def && def.name) return def.name;
                }
                return '';
            },
            canEnterLocation() {
                return !!this.selectedLocationId && this.selectedLocationId !== 'legacy' && (
                    (this.locations || []).some(row => row.id === this.selectedLocationId) ||
                    (typeof window !== 'undefined' && window.DefaultFeeders && !!window.DefaultFeeders.get(this.selectedLocationId))
                );
            },
            availableSubDivisions() {
                const div = this.divisionFilter || 'ALL';
                if (typeof window !== 'undefined' && window.DefaultFeeders) return window.DefaultFeeders.getSubDivisions(div === 'ALL' ? '' : div);
                const set = new Set();
                (this.locations || []).forEach(l => {
                    if ((div === 'ALL' || l.division === div) && l.subDivision) set.add(l.subDivision);
                });
                return Array.from(set).sort();
            },
            availableSubstations() {
                const div = this.divisionFilter || 'ALL';
                const sub = this.subDivisionFilter || 'ALL';
                if (typeof window !== 'undefined' && window.DefaultFeeders) return window.DefaultFeeders.getSubstations(div === 'ALL' ? '' : div, sub === 'ALL' ? '' : sub);
                const set = new Set();
                (this.locations || []).forEach(l => {
                    if ((div === 'ALL' || l.division === div) && (sub === 'ALL' || l.subDivision === sub) && l.substation) {
                        set.add(l.substation);
                    }
                });
                return Array.from(set).sort();
            },
            filteredLocations() {
                const defaults = (typeof window !== 'undefined' && window.DefaultFeeders && window.DefaultFeeders.list) || [];
                const current = Array.isArray(this.locations) ? this.locations : [];
                const map = new Map();
                defaults.forEach(def => map.set(def.id, { ...def }));
                current.forEach(loc => {
                    if (loc && loc.id) {
                        map.set(loc.id, map.has(loc.id) ? { ...map.get(loc.id), ...loc } : loc);
                    }
                });
                const list = Array.from(map.values());

                let div = this.divisionFilter || 'ALL';
                let sub = this.subDivisionFilter || 'ALL';
                let sst = this.substationFilter || 'ALL';
                const q = String(this.feederSearch || '').trim().toLowerCase();

                if (div !== 'ALL' && sub !== 'ALL') {
                    const validSubs = typeof window !== 'undefined' && window.DefaultFeeders ? window.DefaultFeeders.getSubDivisions(div) : [];
                    if (validSubs.length && !validSubs.includes(sub)) sub = 'ALL';
                }
                if (sst !== 'ALL') {
                    const validSsts = typeof window !== 'undefined' && window.DefaultFeeders ? window.DefaultFeeders.getSubstations(div === 'ALL' ? '' : div, sub === 'ALL' ? '' : sub) : [];
                    if (validSsts.length && !validSsts.includes(sst)) sst = 'ALL';
                }

                let filtered = list.filter(loc => {
                    if (div !== 'ALL' && loc.division && loc.division !== div) return false;
                    if (sub !== 'ALL' && loc.subDivision && loc.subDivision !== sub) return false;
                    if (sst !== 'ALL' && loc.substation && loc.substation !== sst) return false;
                    if (q) {
                        const text = (loc.name + ' ' + (loc.division || '') + ' ' + (loc.subDivision || '') + ' ' + (loc.substation || '') + ' ' + (loc.feeder || '')).toLowerCase();
                        if (!text.includes(q)) return false;
                    }
                    return true;
                });

                if (!filtered.length && !q) {
                    filtered = list.filter(loc => div === 'ALL' || !loc.division || loc.division === div);
                    if (!filtered.length) filtered = list;
                }

                return filtered;
            },
            searchFilteredLocations() {
                const q = String(this.locationSearchQuery || '').trim().toLowerCase();
                if (!q) return this.filteredLocations;
                return this.filteredLocations.filter(loc => {
                    const text = (loc.name + ' ' + (loc.division || '') + ' ' + (loc.subDivision || '') + ' ' + (loc.substation || '') + ' ' + (loc.feeder || '')).toLowerCase();
                    return text.includes(q);
                });
            },
            activeLocationObj() {
                const id = this.selectedLocationId;
                if (!id || id === 'legacy') return null;
                const found = (this.locations || []).find(l => l.id === id);
                if (found) return found;
                if (typeof window !== 'undefined' && window.DefaultFeeders) return window.DefaultFeeders.get(id);
                return null;
            },
            isAdmin() {
                return false; // Administrative actions belong to the Billing dashboard, never shared links.
            },
            hasReportContent(r) {
                if (!r) return false;
                const hasQty = Object.values(r.quantities || {}).some(v => Number(v) > 0);
                const hasMp = Object.values(r.manpower || {}).some(v => Number(v) > 0);
                const hasRem = Boolean(String(r.remarks || '').trim());
                return hasQty || hasMp || hasRem;
            },
            isCurrentDateLocked() {
                const actC = this.activeContractor || {};
                const curDate = normDate(this.selectedDate);
                const locKey = locationKey(this.selectedLocationId);
                
                const stateObj = (this.reportStates || []).find(row => 
                    matchesContractor(row.contractorId, actC) && 
                    normDate(row.date) === curDate && 
                    locationKey(row.locationId) === locKey
                );

                const rep = (this.reports || []).find(r => 
                    matchesContractor(r.contractorId, actC) && 
                    normDate(r.date) === curDate && 
                    locationKey(r.locationId) === locKey
                );

                // 1. If explicit stateObj exists:
                if (stateObj) {
                    if (stateObj.state === 'open') return false;
                    if (stateObj.state === 'final') return true;
                }

                // 2. If report exists:
                if (rep) {
                    if (rep.pending) return false;
                    if (rep.state === 'open') return false;
                    if ((rep.state === 'final' || rep.final) && this.hasReportContent(rep)) return true;
                }

                return false;
            },
            isCurrentDateUnlocked() {
                if (this.isCurrentDateLocked) return false;
                const actC = this.activeContractor || {};
                const curDate = normDate(this.selectedDate);
                const locKey = locationKey(this.selectedLocationId);

                const stateObj = (this.reportStates || []).find(row => 
                    matchesContractor(row.contractorId, actC) && 
                    normDate(row.date) === curDate && 
                    locationKey(row.locationId) === locKey
                );
                if (stateObj && stateObj.state === 'open') return true;

                const rep = (this.reports || []).find(r => 
                    matchesContractor(r.contractorId, actC) && 
                    normDate(r.date) === curDate && 
                    locationKey(r.locationId) === locKey
                );
                if (rep && (rep.state === 'open' || !rep.state)) return true;

                return false;
            },
            canEditCurrentDate() {
                if (this.busy) return false;
                if (this.isCurrentDateLocked && !this.isAdmin) return false;
                return true;
            },
            shareFilteredContractors() {
                const list = this.contractors || [];
                const q = String(this.shareContractorSearch || '').trim().toLowerCase();
                if (!q) return list.filter(Boolean);
                return list.filter(c => {
                    if (!c) return false;
                    return (c.name && String(c.name).toLowerCase().includes(q)) ||
                           (c.id && String(c.id).toLowerCase().includes(q)) ||
                           (c.feeder && String(c.feeder).toLowerCase().includes(q)) ||
                           (c.engineer && String(c.engineer).toLowerCase().includes(q)) ||
                           (c.project && String(c.project).toLowerCase().includes(q));
                });
            },

            currentShareUrl() {
                const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
                const c = this.shareSelectedContractor || this.activeContractor || {};
                const cid = c.id || '';
                const dt = this.shareLinkDate || this.selectedDate || '';
                return `${origin}/daily-progress.html?contractor=${encodeURIComponent(cid)}&date=${encodeURIComponent(dt)}${cid === this.selectedContractorId && this.selectedLocationId ? "&location=" + encodeURIComponent(this.selectedLocationId) : ""}`;
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
                if (!q) return list.filter(Boolean);
                return list.filter(c => {
                    if (!c) return false;
                    return (c.name && String(c.name).toLowerCase().includes(q)) ||
                           (c.firmName && String(c.firmName).toLowerCase().includes(q)) ||
                           (c.id && String(c.id).toLowerCase().includes(q)) ||
                           (c.feeder && String(c.feeder).toLowerCase().includes(q)) ||
                           (c.engineer && String(c.engineer).toLowerCase().includes(q)) ||
                           (c.project && String(c.project).toLowerCase().includes(q));
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

            activeReportObj() {
                const actC = this.activeContractor || {};
                const curDate = normDate(this.selectedDate);
                const locKey = locationKey(this.selectedLocationId);
                return (this.reports || []).find(r => 
                    matchesContractor(r.contractorId, actC) && 
                    normDate(r.date) === curDate && 
                    locationKey(r.locationId) === locKey
                ) || null;
            },

            activeReportSavedBy() {
                const rep = this.activeReportObj;
                if (!rep || !rep.savedBy) return '';
                if (typeof rep.savedBy === 'object') {
                    const name = rep.savedBy.name || rep.savedBy.username || rep.savedBy.id || '';
                    const mobile = rep.savedBy.mobile ? `(${rep.savedBy.mobile})` : '';
                    return [name, mobile].filter(Boolean).join(' ') || '';
                }
                return String(rep.savedBy);
            },

            activeReportSavedAt() {
                const rep = this.activeReportObj;
                if (!rep || (!rep.savedAt && !rep.updatedAt)) return '';
                try {
                    const d = new Date(rep.savedAt || rep.updatedAt);
                    if (isNaN(d.getTime())) return String(rep.savedAt || rep.updatedAt);
                    return new Intl.DateTimeFormat('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', hour12: true
                    }).format(d);
                } catch (e) {
                    return rep.savedAt || rep.updatedAt;
                }
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
            async selectedContractorId(cid) {
                await this.ensureStock();
                if (cid !== this.selectedContractorId) return;
                await this.loadLocations();
                if (cid === this.selectedContractorId && !this.dirty) {
                    this.loadReportForActiveDate();
                    await this.fetchLatestReportsSilently();
                }
            },
            selectedLocationId() { this.loadReportForActiveDate(); },
            selectedDate() {
                this.loadReportForActiveDate();
            }
        },

        async mounted() {
            this.applyTheme();
            if (window.DailyWorkerAuth) this.entryLoginUser = await window.DailyWorkerAuth.ready;
            await this.initData();
            if (typeof setInterval === 'function') {
                this._refreshTimer = setInterval(() => {
                    if (!document.hidden && !this.busy && !this.dirty) this.fetchLatestReportsSilently();
                }, 45000);
            }
            if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
                document.addEventListener('click', (e) => {
                    if (this.contractorDropdownOpen && e.target && typeof e.target.closest === 'function' && !e.target.closest('.dp-contractor-picker-wrap')) {
                        this.contractorDropdownOpen = false;
                    }
                });
            }
        },

        beforeUnmount() {
            if (this._refreshTimer) clearInterval(this._refreshTimer);
        },

        methods: {
            applyTheme() {
                if (typeof document === 'undefined' || !document.documentElement) return;
                const mode = this.isDark ? 'dark' : 'light';
                if (document.documentElement.dataset) {
                    document.documentElement.dataset.theme = mode;
                }
                if (document.documentElement.classList && typeof document.documentElement.classList.toggle === 'function') {
                    document.documentElement.classList.toggle('dark', this.isDark);
                    document.documentElement.classList.toggle('dark-mode', this.isDark);
                }
                if (document.body) {
                    if (document.body.dataset) document.body.dataset.theme = mode;
                    if (document.body.classList && typeof document.body.classList.toggle === 'function') {
                        document.body.classList.toggle('dark', this.isDark);
                        document.body.classList.toggle('dark-mode', this.isDark);
                    }
                }
            },
            toggleTheme() {
                this.isDark = !this.isDark;
                const mode = this.isDark ? 'dark' : 'light';
                try {
                    if (typeof localStorage !== 'undefined') {
                        localStorage.setItem('billing_theme_mode', mode);
                        localStorage.setItem('billing_theme', mode);
                    }
                } catch(e) {}
                this.applyTheme();
                if (typeof this.showToast === 'function') {
                    this.showToast(this.isDark ? 'Dark Theme Active 🌙' : 'Light Theme Active ☀️', 'info');
                }
            },
            setDivision(div) {
                this.divisionFilter = div || 'ALL';
                this.subDivisionFilter = 'ALL';
                this.substationFilter = 'ALL';
            },
            setSubDivision(sub) {
                this.subDivisionFilter = sub || 'ALL';
                this.substationFilter = 'ALL';
            },
            setSubstation(sst) {
                this.substationFilter = sst || 'ALL';
            },
            clearLocationFilters() {
                this.divisionFilter = 'ALL';
                this.subDivisionFilter = 'ALL';
                this.substationFilter = 'ALL';
                this.feederSearch = '';
            },
            toggleLocationDropdown() {
                this.locationDropdownOpen = !this.locationDropdownOpen;
                if (this.locationDropdownOpen) {
                    this.locationSearchQuery = '';
                    this.$nextTick(() => {
                        const el = document.getElementById('location-search-input');
                        if (el) el.focus();
                    });
                }
            },
            closeLocationDropdown() {
                this.locationDropdownOpen = false;
                this.locationSearchQuery = '';
            },
            selectLocation(id) {
                this.locationDropdownOpen = false;
                this.locationSearchQuery = '';
                this.changeLocation(id);
            },
            syncFiltersFromLocation(id) {
                if (!id || id === 'legacy') return;
                const obj = (this.locations || []).find(l => l.id === id) || (typeof window !== 'undefined' && window.DefaultFeeders && window.DefaultFeeders.get(id));
                if (obj) {
                    if (obj.division) this.divisionFilter = obj.division;
                    if (obj.subDivision) this.subDivisionFilter = obj.subDivision;
                    if (obj.substation) this.substationFilter = obj.substation;
                }
            },
            async loadLocations() {
                const cid = this.selectedContractorId;
                if (this._locationContractor && this._locationContractor !== cid) this.selectedLocationId = '';
                this._locationContractor = cid;
                const defaults = (typeof window !== 'undefined' && window.DefaultFeeders && window.DefaultFeeders.list) || [];
                if ((!this.locations || !this.locations.length) && defaults.length) {
                    this.locations = [...defaults];
                }
                try {
                    const response = await shareFetch('/api/dp-worker/locations?contractorId=' + encodeURIComponent(cid), { cache: 'no-store' });
                    const data = await response.json();
                    if (!response.ok || !data.success) throw new Error(data.error || 'Locations load nahi hui.');
                    if (cid !== this.selectedContractorId) return;
                    const fetched = data.locations || [];
                    const map = new Map();
                    defaults.forEach(def => map.set(def.id, { ...def }));
                    fetched.forEach(loc => {
                        if (loc && loc.id) {
                            map.set(loc.id, map.has(loc.id) ? { ...map.get(loc.id), ...loc } : loc);
                        }
                    });
                    this.locations = Array.from(map.values());
                    if (this.selectedLocationId && this.selectedLocationId !== 'legacy' && !this.locations.some(row => row.id === this.selectedLocationId)) this.selectedLocationId = '';
                    this.locationError = '';
                    if (this.selectedLocationId) this.syncFiltersFromLocation(this.selectedLocationId);
                } catch (error) {
                    this.locationError = error.message;
                    if ((!this.locations || !this.locations.length) && defaults.length) {
                        this.locations = [...defaults];
                    }
                }
            },
            changeLocation(id) {
                if (this.busy) return;
                if (this.dirty && !confirm('Unsaved changes chhodkar location badlein?')) return;
                this.selectedLocationId = id;
                this.syncFiltersFromLocation(id);
            },
            async addLocation() {
                if (this.busy) return;
                if (this.dirty) return this.showToast('Location badalne se pehle pending entry save karein.', 'warning');
                const name = String(this.newLocationName || '').trim();
                if (!name) return this.showToast('Location name likhein.', 'warning');
                this.busy = true;
                try {
                    const response = await shareFetch('/api/dp-worker/locations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contractorId: this.selectedContractorId, name }) });
                    const data = await response.json();
                    if (!response.ok || !data.success) throw new Error(data.error || 'Location save nahi hui.');
                    await this.loadLocations();
                    this.selectedLocationId = data.location.id; this.newLocationName = '';
                    this.loadReportForActiveDate();
                } catch (error) { this.showToast(error.message, 'error'); }
                finally { this.busy = false; }
            },
            matchesContractor(a, b) { return matchesContractor(a, b); },
            normDate(d) { return normDate(d); },
            locationKey(k) { return locationKey(k); },

            onContractorSearchInput(val) {
                this.contractorSearchText = val;
                this.contractorDropdownOpen = true;
            },

            onContractorSearchFocus() {
                this.contractorDropdownOpen = true;
                this.contractorSearchText = '';
            },

            clearContractorSearch() {
                this.contractorSearchText = '';
                this.contractorDropdownOpen = true;
                const field = this.$refs.contractorPanelSearchRef || this.$refs.contractorSearchRef;
                if (field) field.focus();
            },

            toggleContractorDropdown() {
                this.contractorDropdownOpen = !this.contractorDropdownOpen;
                if (this.contractorDropdownOpen) {
                    this.contractorSearchText = '';
                    if (typeof this.$nextTick === 'function') {
                        this.$nextTick(() => {
                            const field = this.$refs.contractorPanelSearchRef || this.$refs.contractorSearchRef;
                            if (field) field.focus();
                        });
                    }
                }
            },

            closeContractorDropdown() {
                this.contractorDropdownOpen = false;
                this.contractorSearchText = '';
            },

            selectContractor(cid) {
                if (!(this.contractors || []).some(c => c.id === cid)) return;
                if (this.dirty) return this.showToast('Contractor badalne se pehle current entry save karein.', 'warning');
                requestContractor = cid;
                if (this.busy) return;
                if (this.dirty && !confirm('Unsaved changes chhodkar contractor badlein?')) return;
                if (cid !== this.selectedContractorId) { this.selectedLocationId = ''; this.locations = []; this.dirty = false; }
                this.selectedContractorId = cid;
                this.contractorDropdownOpen = false;
                this.contractorSearchText = '';
            },

            showToast(msg, type = 'info') {
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
                            const catRes = await shareFetch('/api/daily-entry/catalog', { cache: 'no-store' });
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
                        const res = await shareFetch('/api/daily-progress/data?t=' + Date.now());
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
                            const localStr = readShareCache();
                            if (localStr) loaded = JSON.parse(localStr);
                        } catch (e) { }
                    } else {
                        // A confirmed cloud read must not discard an unsent device draft.
                        try {
                            const cached = JSON.parse(readShareCache() || 'null');
                            const reports = new Map((loaded.reports || []).map(r => [reportKey(r), r]));
                            for (const r of cached && cached.reports || []) {
                                if (r.pending) reports.set(reportKey(r), r);
                            }
                            loaded.reports = [...reports.values()];
                        } catch (e) { }
                    }

                    // 3. Merge data
                    if (loaded) {
                        if (Array.isArray(loaded.contractors)) {
                            loaded.contractors.forEach(c => {
                                const n = normId(c.id || c.name);
                                if (n) contractorsMap.set(n, { ...contractorsMap.get(n), ...c });
                            });
                        }
                        this.reports = Array.isArray(loaded.reports) ? loaded.reports : [];
                        this.reportStates = Array.isArray(loaded.reportStates) ? loaded.reportStates : [];
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
                            const list = login.availableContractorIds || login.contractorIds || [];
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

                    // Keep the permitted picker while isolating device data to its assignments.
                    const allowed = cid => this.contractors.some(c => matchesContractor(cid, c));
                    this.reports = this.reports.filter(row => allowed(row.contractorId));
                    this.reportStates = this.reportStates.filter(row => allowed(row.contractorId));
                    this.issues = this.issues.filter(row => allowed(row.contractorId));
                    requestContractor = this.selectedContractorId;

                    await this.ensureStock();
                    await this.loadLocations();
                    this.loadReportForActiveDate();
                } catch (err) {
                    console.error('[DailyProgressStandalone] Init error:', err);
                    this.showToast(err.message || 'Contractor data load nahi hua. Dobara try karein.', 'error');
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
                // The public API already resolves SAP aliases and work orders for this contractor.
                for (const key of this.stockKeysByContractor[normId(actC.id)] || []) {
                    if (matchesDesiredWorkOrder(byNorm[key])) add(key, byNorm[key]);
                }
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
                    let res = await shareFetch('/api/daily-entry/stock/' + encodeURIComponent(cid), { cache: 'no-store' });
                    let payload = res.ok ? await res.json() : null;
                    if ((!payload || !payload.success || !payload.byContractorNorm || !Object.keys(payload.byContractorNorm).length) && actC.name && actC.name !== cid) {
                        res = await shareFetch('/api/daily-entry/stock/' + encodeURIComponent(actC.name), { cache: 'no-store' });
                        if (res.ok) payload = await res.json();
                    }
                    if (payload && payload.success && payload.byContractorNorm) {
                        this.stockKeysByContractor = { ...this.stockKeysByContractor, [normId(cid)]: Object.keys(payload.byContractorNorm) };
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
                    return matchesContractor(r.contractorId, actC) && normDate(r.date) === curDate && locationKey(r.locationId) === locationKey(this.selectedLocationId);
                });

                // A correction removing quantities must supersede an older, fuller report.
                matchingReps.sort((a, b) => {
                    const verDiff = Number(b.version || 0) - Number(a.version || 0);
                    if (verDiff !== 0) return verDiff;
                    return (Date.parse(b.savedAt || b.updatedAt || '') || 0) - (Date.parse(a.savedAt || a.updatedAt || '') || 0);
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
                    this.version = rep.pending ? Number(rep.version || 0) : Number(rep.version || 1);
                    this.dirty = !!rep.pending;
                } else {
                    this.quantities = {};
                    this.manpower = { leader: 0, skilled: 0, unskilled: 0, tractor: 0, augur: 0, room: 0 };
                    this.remarks = '';
                    this.version = (this.reportStates.find(row => matchesContractor(row.contractorId, actC) && row.date === curDate && locationKey(row.locationId) === locationKey(this.selectedLocationId)) || {}).version || 0;
                    this.dirty = false;

                    // Silently check if server has fresh draft/save from portal
                    if (!this._fetchingLatestReport && typeof fetch === 'function') {
                        this.fetchLatestReportsSilently();
                    }
                }
            },

            async fetchLatestReportsSilently() {
                if (this._fetchingLatestReport || this.busy || this.dirty) return;
                this._fetchingLatestReport = true;
                const cid = this.selectedContractorId, date = this.selectedDate, location = this.selectedLocationId;
                const epoch = this._dataEpoch || 0;
                try {
                    const res = await shareFetch('/api/daily-progress/data?t=' + Date.now());
                    if (res.ok) {
                        const resJson = await res.json();
                        if (this.dirty || this.busy || cid !== this.selectedContractorId || date !== this.selectedDate || location !== this.selectedLocationId || epoch !== (this._dataEpoch || 0)) return;
                        if (resJson && resJson.success && resJson.data && Array.isArray(resJson.data.reports)) {
                            const scope = this.activeContractor || {};
                            const permitted = row => this.contractors.some(c => matchesContractor(row.contractorId, c));
                            const reports = new Map(this.reports.filter(r => permitted(r) && !matchesContractor(r.contractorId, scope)).map(r => [reportKey(r), r]));
                            for (const r of resJson.data.reports.filter(r => matchesContractor(r.contractorId, scope))) reports.set(reportKey(r), r);
                            for (const r of this.reports) {
                                if (r.pending && permitted(r)) reports.set(reportKey(r), r);
                            }
                            this.reports = [...reports.values()];
                            this.reportStates = (resJson.data.reportStates || []).filter(r => matchesContractor(r.contractorId, scope));
                            if (Array.isArray(resJson.data.issues)) this.issues = resJson.data.issues.filter(r => matchesContractor(r.contractorId, scope));
                            const actC = this.activeContractor || {};
                            const curDate = normDate(this.selectedDate);
                            const matching = (this.reports || []).filter(r => matchesContractor(r.contractorId, actC) && normDate(r.date) === curDate && locationKey(r.locationId) === locationKey(this.selectedLocationId));
                            matching.sort((a, b) => {
                                return Number(b.version || 0) - Number(a.version || 0) ||
                                    (Date.parse(b.savedAt || b.updatedAt || '') || 0) - (Date.parse(a.savedAt || a.updatedAt || '') || 0);
                            });
                            const freshRep = matching[0];
                            if (!freshRep) {
                                this.quantities = {};
                                this.manpower = { leader: 0, skilled: 0, unskilled: 0, tractor: 0, augur: 0, room: 0 };
                                this.remarks = '';
                                this.version = (this.reportStates.find(row => matchesContractor(row.contractorId, actC) && row.date === curDate && locationKey(row.locationId) === locationKey(this.selectedLocationId)) || {}).version || 0;
                            } else if (!this.dirty) {
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
                if (!this.canEditCurrentDate) {
                    this.showToast('Yeh entry locked hai. Koyi change karne ke liye pehle Admin se unlock karwayein.', 'warning');
                    return;
                }
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
                if (this.busy) return;
                if (!this.canEnterLocation) return this.showToast('Pehle location add ya select karein. Legacy entries admin hi change kar sakta hai.', 'warning');
                this._dataEpoch = (this._dataEpoch || 0) + 1;
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
                        locationId: this.selectedLocationId,
                        locationName: this.activeLocationName,
                        quantities: cleanQuantities,
                        manpower: { ...this.manpower },
                        remarks: this.remarks || '',
                        state: 'final',
                        version: (this.version || 0) + 1,
                        updatedAt: new Date().toISOString()
                    };

                    const existingIdx = this.reports.findIndex(r => {
                        return matchesContractor(r.contractorId, actC) && r.date === curDate && locationKey(r.locationId) === locationKey(this.selectedLocationId);
                    });
                    if (existingIdx >= 0) {
                        this.reports[existingIdx] = reportObj;
                    } else {
                        this.reports.push(reportObj);
                    }

                    const payload = {
                        contractors: this.contractors,
                        reports: this.reports,
                        reportStates: this.reportStates,
                        issues: this.issues,
                        updatedAt: new Date().toISOString()
                    };

                    // Save locally first
                    let localSaved = false;
                    try {
                        const drafts = payload.reports.map(row => reportKey(row) === reportKey(reportObj) ? { ...row, version: this.version, pending: true } : row);
                        localStorage.setItem(shareStorageKey, JSON.stringify({ ...payload, reports: drafts }));
                        localSaved = true;
                    } catch (e) { }

                    // Save to cloud API
                    let cloudSaved = false;
                    let cloudError = '';
                    try {
                        const res = await shareFetch('/api/daily-progress/data', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            // Submit only the edited date. Old cached dates must never block this save.
                            body: JSON.stringify({ ...payload, reports: [reportObj] })
                        });
                        const resJson = await res.json().catch(() => null);
                        if (!res.ok || !resJson || resJson.success !== true) {
                            cloudError = resJson && resJson.error || 'Server par save confirm nahi hua. Dobara try karein.';
                            if (res.status === 401 && window.DailyWorkerAuth) window.DailyWorkerAuth.expired();
                        } else {
                            if (resJson && resJson.success === true) {
                                cloudSaved = true;
                                this.version = reportObj.version;
                                for (const report of resJson.reports || []) {
                                    const index = this.reports.findIndex(row => reportKey(row) === reportKey(report));
                                    if (index >= 0) this.reports[index] = report;
                                    if (report.contractorId === cid && report.date === curDate) this.version = report.version;
                                }
                                try { localStorage.setItem(shareStorageKey, JSON.stringify({ ...payload, reports: this.reports })); } catch {}
                            }
                        }
                    } catch (e) {
                        cloudError = e.message;
                        console.warn('[DailyProgressStandalone] Cloud save network error:', e);
                    }

                    if (cloudSaved) {
                        this.dirty = false;
                        this.saveStatus = 'saved';
                        this.showToast(`Daily Progress saved & synced to cloud! ✅ (${this.selectedDate})`, 'success');
                    } else {
                        const index = this.reports.findIndex(row => reportKey(row) === reportKey(reportObj));
                        if (index >= 0) this.reports[index] = { ...reportObj, version: this.version, pending: true };
                        this.dirty = true;
                        this.saveStatus = 'offline';
                        this.showToast((localSaved ? 'Draft device par safe hai. ' : 'Device par bhi save nahi hua; page khula rakhein aur entries copy karein. ') + cloudError, 'warning');
                    }
                } catch (err) {
                    this.showToast('Save failed: ' + err.message, 'error');
                } finally {
                    this.busy = false;
                }
            },

            async unlockCurrentDate() {
                if (!this.isAdmin) return this.showToast('Sirf Admin hi entry unlock kar sakta hai.', 'warning');
                const cName = this.activeContractor?.name || this.selectedContractorId;
                if (!confirm(`Kya aap ${this.selectedDate} (${cName}) ki entry unlock karna chahte hain?`)) return;
                this.busy = true;
                try {
                    const actC = this.activeContractor || {};
                    const res = await shareFetch('/api/daily-progress/unlock', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contractorId: actC.id || this.selectedContractorId,
                            date: this.selectedDate,
                            locationId: this.selectedLocationId
                        })
                    });
                    const data = await res.json();
                    if (!res.ok || !data.success) throw new Error(data.error || 'Unlock failed');
                    
                    const curDate = normDate(this.selectedDate);
                    const locKey = locationKey(this.selectedLocationId);
                    let stateObj = (this.reportStates || []).find(row => 
                        matchesContractor(row.contractorId, actC) && 
                        normDate(row.date) === curDate && 
                        locationKey(row.locationId) === locKey
                    );
                    if (stateObj) {
                        stateObj.state = 'open';
                    } else {
                        this.reportStates.push({
                            contractorId: actC.id || this.selectedContractorId,
                            date: curDate,
                            locationId: this.selectedLocationId,
                            state: 'open'
                        });
                    }
                    const rep = (this.reports || []).find(r => 
                        matchesContractor(r.contractorId, actC) && 
                        normDate(r.date) === curDate && 
                        locationKey(r.locationId) === locKey
                    );
                    if (rep) {
                        rep.state = 'open';
                        rep.final = false;
                    }

                    // Preserve and populate existing entered quantities and manpower
                    if (data.report && data.report.quantities && Object.keys(data.report.quantities).length) {
                        this.quantities = { ...(data.report.quantities || {}) };
                        if (data.report.manpower) this.manpower = { ...(data.report.manpower || {}) };
                        if (data.report.remarks) this.remarks = data.report.remarks;
                        if (data.report.version) this.version = Number(data.report.version);
                    } else if (rep && rep.quantities && Object.keys(rep.quantities).length) {
                        this.quantities = { ...(rep.quantities || {}) };
                        if (rep.manpower) this.manpower = { ...(rep.manpower || {}) };
                        if (rep.remarks) this.remarks = rep.remarks;
                        if (rep.version) this.version = Number(rep.version);
                    }
                    this.dirty = false;

                    this.showToast(`✅ Entry unlocked for ${this.selectedDate}! Ab changes save kiye ja sakte hain.`, 'success');
                } catch (err) {
                    this.showToast('Unlock error: ' + err.message, 'error');
                } finally {
                    this.busy = false;
                }
            },

            getContractorShareUrl(cid, dt) {
                const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
                return `${origin}/daily-progress.html?contractor=${encodeURIComponent(cid)}&date=${encodeURIComponent(dt || this.selectedDate || '')}${cid === this.selectedContractorId && this.selectedLocationId ? "&location=" + encodeURIComponent(this.selectedLocationId) : ""}`;
            },

            getContractorWhatsappUrl(c, dt) {
                const url = this.getContractorShareUrl(c.id, dt);
                const text = `*Daily Progress Entry Link*\nContractor: ${c.name || ''}\nDate: ${dt || this.selectedDate || ''}\nLink: ${url}`;
                return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
            },

            selectShareContractor(c) {
                this.shareSelectedContractor = c;
            },

            async copyShareUrl(url) {
                const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : null;
                let copied = false;
                try {
                    copied = window.BillingShareLink ? await window.BillingShareLink.copy(url, { clipboard })
                        : clipboard?.writeText ? await Promise.resolve(clipboard.writeText(url)).then(() => true, () => false) : false;
                } catch (_) { }
                if (!copied) {
                    const select = () => { const field = this.$refs?.shareUrlInput; if (field) { field.focus(); field.select(); } };
                    if (typeof this.$nextTick === 'function') this.$nextTick(select); else select();
                }
                this.showToast(copied ? 'Share link copied.' : 'Link field se copy karein (Ctrl+C).', copied ? 'success' : 'info');
                return copied;
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
                return this.copyShareUrl(this.currentShareUrl);
            },

            openReport(date, locationId) {
                if (date) this.selectedDate = date;
                if (locationId !== undefined && locationId !== null) {
                    this.selectedLocationId = locationId;
                    this.syncFiltersFromLocation(locationId);
                }
                this.currentTab = 'entry';
            },

            formatSavedAt(dateStr) {
                if (!dateStr) return '—';
                try {
                    const d = new Date(dateStr);
                    if (isNaN(d.getTime())) return String(dateStr);
                    return new Intl.DateTimeFormat('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', hour12: true
                    }).format(d);
                } catch (e) {
                    return String(dateStr);
                }
            },

            formatSavedBy(savedBy) {
                if (!savedBy) return 'Field Supervisor';
                if (typeof savedBy === 'object') {
                    const name = savedBy.name || savedBy.username || savedBy.id || '';
                    const mobile = savedBy.mobile ? `(${savedBy.mobile})` : '';
                    return [name, mobile].filter(Boolean).join(' ') || 'Field Supervisor';
                }
                return String(savedBy);
            },

            async submitAddContractor() {
                if (!this.isAdmin) return;
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
                if (!this.isAdmin) return;
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
                    if (filter === 'entered') {
                        return totalRangeConsumed > 0;
                    }
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
                        const res = await shareFetch('/api/daily-progress/template');
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
                        ws.getCell('A3').value = 'FEEDER: ' + (contractor.feeder || '') + ' | LOCATION: ' + (this.activeLocationName || 'Legacy / Unassigned');
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
                    link.download = `Daily_Progress_${contractor.name.replace(/[^a-z0-9]/gi, '_')}_${(this.activeLocationName || 'Legacy').replace(/[^a-z0-9]/gi, '_')}_${this.exportFrom}_to_${this.exportTo}.xlsx`;
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
