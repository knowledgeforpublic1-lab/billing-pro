/* Derive current issues from the uploaded stock; reconciliation consumption stays intact. */
(function (root) {
    'use strict';
    const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
    const round = value => Math.round(value * 1000000) / 1000000;
    const norm = value => String(value || '').toLowerCase().replace(/^m\/s\.?\s*/, '').replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
    const unit = value => {
        const key = String(value || '').toUpperCase().replace(/[.\s]/g, '');
        return ({ NOS: 'NO', N0: 'NO', MTR: 'M', MTRS: 'M', METRE: 'M', METER: 'M', KGS: 'KG', TON: 'MT', TONNE: 'MT' })[key] || key;
    };
    function factor(from, to) {
        from = unit(from); to = unit(to);
        if (!from || !to || from === to) return 1;
        return ({ 'M|KM': 0.001, 'KM|M': 1000, 'KG|MT': 0.001, 'MT|KG': 1000 })[from + '|' + to];
    }
    function apply(data, stock, { directory = [], referenceData } = {}) {
        if (!Array.isArray(data?.Contractors) || !stock?.byContractorNorm) return data;
        const result = JSON.parse(JSON.stringify(data));
        if (!root.BillingStockIdentity) throw new Error('Stock identity engine unavailable. Refresh the page.');
        const all = root.BillingStockIdentity.index(stock);
        const resolutions = [];
        const matches = result.Contractors.map(contractor => {
            const reference = (referenceData?.Contractors || []).filter(row => norm(row.ContractorName) === norm(contractor.ContractorName));
            const aliases = [contractor.Metadata?.FirmName, contractor.IssueStockSource?.contractor];
            if (reference.length === 1) aliases.push(reference[0].IssueStockSource?.contractor);
            const resolution = root.BillingStockIdentity.resolve(stock, { name: contractor.ContractorName, aliases, workOrderNo: contractor.Metadata?.WONo }, directory);
            resolutions.push(resolution);
            return resolution.matches;
        });
        const uses = new Map();
        for (const matching of matches) for (const group of matching) uses.set(group, (uses.get(group) || 0) + 1);
        const warnings = [];
        const rates = result.DebitRates || [];
        function update(contractor, matching) {
            const materials = new Map();
            for (const { block } of matching) for (const [code, material] of Object.entries(block.materials)) {
                const key = String(code).trim() + '|' + unit(material.uom);
                const gross = number(material.grossIssue ?? material.netIssue ?? material.issuedQty);
                const mrn = number(material.mrnReturn);
                const net = number(material.netIssue ?? material.issuedQty ?? (gross - mrn));
                const previous = materials.get(key);
                if (previous) { previous.gross += gross; previous.mrn += mrn; previous.net += net; }
                else materials.set(key, { code: String(code).trim(), desc: material.desc, uom: material.uom, gross, mrn, net });
            }
            const consumed = new Set();
            for (const item of contractor.Items || []) {
                const code = String(item.ItemCode || '').trim();
                const candidates = [...materials.entries()].filter(([key, material]) => material.code === code && factor(material.uom, item.UOM) !== undefined);
                if (candidates.length > 1 || (candidates.length && consumed.has(candidates[0][0]))) {
                    warnings.push(contractor.ContractorName + ': ambiguous material ' + code); continue;
                }
                if (!candidates.length && [...materials.values()].some(material => material.code === code)) {
                    warnings.push(contractor.ContractorName + ': unit mismatch ' + code); continue;
                }
                const [key, material] = candidates[0] || [];
                const scale = material ? factor(material.uom, item.UOM) : 1;
                if (!item.UOM && material?.uom) item.UOM = material.uom;
                item.IssuedQty = round((material?.gross || 0) * scale);
                item.MRNQty = round((material?.mrn || 0) * scale);
                item.NetIssue = round((material?.net || 0) * scale);
                item.BalanceQty = round(item.NetIssue - number(item.Consumption) - number(item.WIP) - number(item.Theft));
                item.BalanceCost = round(item.BalanceQty * number(item.DebitRate));
                if (key) consumed.add(key);
            }
            for (const [key, material] of materials) {
                if (consumed.has(key) || (contractor.Items || []).some(item => String(item.ItemCode).trim() === material.code)) continue;
                const rate = rates.find(row => String(row.ItemCode).trim() === material.code && (!row.Unit || unit(row.Unit) === unit(material.uom)));
                const debitRate = number(rate?.DebitRate);
                contractor.Items.push({ ItemCode: material.code, ItemDescription: material.desc || rate?.Description || material.code,
                    UOM: material.uom || rate?.Unit || '', DebitRate: debitRate, IssuedQty: round(material.gross), MRNQty: round(material.mrn),
                    NetIssue: round(material.net), Consumption: 0, WIP: 0, Theft: 0, BalanceQty: round(material.net), BalanceCost: round(material.net * debitRate) });
            }
            contractor.ItemCount = contractor.Items.length;
            contractor.IssueStockSource = { contractor: matching[0]?.block.contractorName || contractor.ContractorName,
                generatedAt: stock.meta?.uploadedAt || stock.meta?.generatedAt, workOrders: [...new Set(matching.flatMap(group => group.orders))], uploaded: true };
        }
        result.Contractors.forEach((contractor, index) => {
            const matching = matches[index];
            if (resolutions[index].status === 'ambiguous' || matching.some(group => uses.get(group) > 1)) { warnings.push(contractor.ContractorName + ': contractor mapping needs review'); return; }
            // Full uploaded stock also replaces missing contractors/materials with
            // zero issues; consumption/WIP/theft history remains untouched.
            update(contractor, matching);
        });
        for (const group of all) {
            if (uses.has(group)) continue;
            const contractor = { ContractorName: group.block.contractorName || [...group.names][0], Metadata: { WONo: group.orders.join(', ') }, Items: [] };
            update(contractor, [group]); result.Contractors.push(contractor);
        }
        result.ContractorCount = result.Contractors.length;
        result.StockSource = { ...result.StockSource, generatedAt: stock.meta?.uploadedAt || stock.meta?.generatedAt, uploaded: true };
        result.StockSyncWarnings = warnings;
        return result;
    }
    root.MasterStockSync = { apply };
})(typeof window !== 'undefined' ? window : globalThis);
