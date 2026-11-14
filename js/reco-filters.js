/** Excel-style filters operate on the visible reconciliation rows, never bill data. */
window.RecoFilterModule = {
    getRecoFilterColumns() {
        return [
            { key: 'sr', label: 'SR NO.', header: 'Sr.', numeric: true },
            { key: 'code', label: 'Row Labels / SAP Code', header: 'SAP Code' },
            { key: 'desc', label: 'Items Description' },
            { key: 'unit', label: 'Unit' },
            { key: 'issue', label: 'Issue', numeric: true, sublabel: 'Gross Issue', color: '#38bdf8' },
            { key: 'mrn', label: 'MRN', numeric: true, sublabel: 'Return', color: '#f87171' },
            { key: 'net', label: 'Net Issue', numeric: true, sublabel: 'Net Issue', color: '#60a5fa' },
            ...(this.reconColumns || []).map(col => ({ key: 'activity:' + col, label: String(col), numeric: true })),
            { key: 'bill', label: 'This Bill', numeric: true, sublabel: 'Is Bill Qty', color: '#818cf8' },
            { key: 'balance', label: 'Balance', numeric: true, sublabel: 'Net - Bill', color: '#fbbf24' }
        ];
    },
    getRecoFilterValue(row, key) {
        if (key.startsWith('activity:')) return Number((row.activities || {})[key.slice(9)]) || 0;
        switch (key) {
            case 'sr': return row._recoSrNo;
            case 'code': return String(row.code || '');
            case 'desc': return String(row.desc || '');
            case 'unit': return String(row.uom || '');
            case 'issue': return Number(row.sapGrossIssue) || 0;
            case 'mrn': return Number(row.sapMrnReturn) || 0;
            case 'net': return Number(row.sapNetIssue !== undefined ? row.sapNetIssue : row.sapIssuedQty) || 0;
            case 'bill': return Number(row.totalQty) || 0;
            case 'balance': return Number(row._bal) || 0;
            default: return '';
        }
    },
    isRecoColumnFiltered(key) { return !!(this.recoColumnFilters || {})[key]; },
    applyRecoColumnFilters(rows) {
        const columns = this.getRecoFilterColumns();
        let result = rows.filter(row => columns.every(col => {
            const filter = (this.recoColumnFilters || {})[col.key];
            if (!filter) return true;
            const value = this.getRecoFilterValue(row, col.key);
            if (filter.values && !filter.values.includes(String(value))) return false;
            if (filter.text && !String(value).toLowerCase().includes(filter.text.toLowerCase())) return false;
            if (!filter.operator || filter.number === '') return true;
            const number = Number(String(filter.number).replace(/,/g, ''));
            if (!Number.isFinite(number)) return false;
            switch (filter.operator) {
                case 'eq': return value === number;
                case 'ne': return value !== number;
                case 'gt': return value > number;
                case 'ge': return value >= number;
                case 'lt': return value < number;
                case 'le': return value <= number;
                default: return true;
            }
        }));
        const sort = this.recoColumnSort;
        if (sort && columns.some(col => col.key === sort.key)) {
            const numeric = columns.find(col => col.key === sort.key).numeric;
            result = result.slice().sort((a, b) => {
                const left = this.getRecoFilterValue(a, sort.key);
                const right = this.getRecoFilterValue(b, sort.key);
                const order = numeric ? Number(left) - Number(right) : String(left).localeCompare(String(right), undefined, { numeric: true });
                return sort.direction === 'desc' ? -order : order;
            });
        }
        return result;
    },
    getRecoFilterOptions(key) {
        const col = this.getRecoFilterColumns().find(c => c.key === key);
        if (!col) return [];
        const values = new Set((this.recoBaseRows || []).map(row => String(this.getRecoFilterValue(row, key))));
        return [...values].sort((a, b) => col.numeric ? Number(a) - Number(b) : a.localeCompare(b, undefined, { numeric: true }));
    },
    openRecoColumnFilter(key, event) {
        if (this.recoFilterActiveKey === key) { this.closeRecoColumnFilter(); return; }
        const col = this.getRecoFilterColumns().find(c => c.key === key);
        if (!col) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const top = Math.max(8, Math.min(rect.bottom + 5, window.innerHeight - 480));
        this.recoFilterPosition = {
            left: Math.max(8, Math.min(rect.left, window.innerWidth - 312)) + 'px',
            top: top + 'px',
            maxHeight: Math.max(100, window.innerHeight - top - 8) + 'px'
        };
        this.recoFilterActiveKey = key;
        this.recoFilterLabel = col.label;
        this.recoFilterNumeric = !!col.numeric;
        this.recoFilterSearch = '';
        const current = (this.recoColumnFilters || {})[key];
        this.recoFilterDraft = {
            values: current && current.values ? current.values.slice() : this.getRecoFilterOptions(key),
            text: current && current.text || '',
            operator: current && current.operator || '',
            number: current && current.number !== undefined ? current.number : ''
        };
        this.$nextTick(() => { if (this.$refs.recoFilterSearchInput) this.$refs.recoFilterSearchInput.focus(); });
    },
    closeRecoColumnFilter() { this.recoFilterActiveKey = ''; },
    onRecoFilterSearchChange() {
        // Excel's value search selects its matching results. Keeping all the
        // old hidden selections made Search -> Apply appear to do nothing.
        const query = this.recoFilterSearch.trim().toLowerCase();
        this.recoFilterDraft.values = this.getRecoFilterOptions(this.recoFilterActiveKey)
            .filter(value => value.toLowerCase().includes(query));
    },
    selectAllRecoFilterValues(checked) {
        const visible = this.getRecoFilterOptions(this.recoFilterActiveKey).filter(value => value.toLowerCase().includes(this.recoFilterSearch.toLowerCase()));
        const selected = new Set(this.recoFilterDraft.values);
        visible.forEach(value => checked ? selected.add(value) : selected.delete(value));
        this.recoFilterDraft.values = [...selected];
    },
    applyRecoColumnFilter() {
        const draft = this.recoFilterDraft;
        if (draft.operator && (String(draft.number).trim() === '' || !Number.isFinite(Number(String(draft.number).replace(/,/g, ''))))) {
            this.showToast('Number filter ke liye valid quantity enter karein', '⚠️');
            return;
        }
        const all = this.getRecoFilterOptions(this.recoFilterActiveKey);
        const filter = {
            values: all.every(value => draft.values.includes(value)) ? null : draft.values.slice(),
            text: draft.text.trim(), operator: draft.operator, number: draft.number
        };
        const filters = { ...this.recoColumnFilters };
        if (filter.values !== null || filter.text || filter.operator) filters[this.recoFilterActiveKey] = filter;
        else delete filters[this.recoFilterActiveKey];
        this.recoColumnFilters = filters;
        this.closeRecoColumnFilter();
    },
    clearRecoColumnFilter() {
        const filters = { ...this.recoColumnFilters };
        delete filters[this.recoFilterActiveKey];
        this.recoColumnFilters = filters;
        this.closeRecoColumnFilter();
    },
    sortRecoColumn(direction) {
        this.recoColumnSort = { key: this.recoFilterActiveKey, direction };
        this.closeRecoColumnFilter();
    },
    clearAllRecoColumnFilters() {
        this.recoColumnFilters = {};
        this.recoColumnSort = null;
        this.closeRecoColumnFilter();
    }
};
