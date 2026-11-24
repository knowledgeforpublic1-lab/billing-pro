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
        const originalCount = result.StockSyncOriginalEntryCount ?? result.Contractors.length;
        result.StockSyncOriginalEntryCount = originalCount;
        const history = result.StockSyncArchivedEntries || [];
        const duplicates = new Map();
        result.Contractors.forEach((contractor, index) => {
            contractor.StockSyncEntryIndices = contractor.StockSyncEntryIndices || [index];
            contractor.StockSyncPrimaryEntryIndex = contractor.StockSyncPrimaryEntryIndex ?? index;
            const metadata = contractor.Metadata || {};
            if (!['PAN', 'GST', 'Aadhar', 'OwnerName'].some(key => String(metadata[key] || '').trim())) return;
            const key = norm(contractor.ContractorName) + '|' + JSON.stringify(Object.fromEntries(Object.entries(metadata).sort(([a], [b]) => a.localeCompare(b))));
            if (!duplicates.has(key)) duplicates.set(key, []);
            duplicates.get(key).push(contractor);
        });
        const excluded = new Set();
        for (const variants of duplicates.values()) {
            if (variants.length < 2) continue;
            const quality = contractor => ({ contractor, codes: new Set((contractor.Items || []).map(item => String(item.ItemCode) + '|' + unit(item.UOM))),
                errors: (contractor.Items || []).filter(item => Math.abs(number(item.NetIssue) - number(item.Consumption) - number(item.WIP) - number(item.Theft) - number(item.BalanceQty)) > 0.01).length,
                negativeWip: (contractor.Items || []).some(item => number(item.WIP) < 0) });
            const scores = variants.map(quality);
            // Resolve only a proven invalid duplicate: the formula-valid full
            // statement must cover every code/unit in each inconsistent smaller copy.
            const valid = scores.filter(candidate => !candidate.errors && !candidate.negativeWip && scores.every(other => other === candidate ||
                (other.errors > 0 && [...other.codes].every(code => candidate.codes.has(code)))));
            if (valid.length !== 1) continue;
            const primary = valid[0].contractor;
            const sourceEntries = new Set(primary.StockSyncEntryIndices);
            for (const variant of variants) {
                if (variant === primary) continue;
                history.push({ reason: 'Inconsistent duplicate snapshot; formula-valid complete statement retained', sourceExtractedAt: data.ExtractedAt, contractor: variant });
                variant.StockSyncEntryIndices.forEach(index => sourceEntries.add(index));
                excluded.add(variant);
            }
            primary.StockSyncEntryIndices = [...sourceEntries].sort((a, b) => a - b);
        }
        result.Contractors = result.Contractors.filter(contractor => !excluded.has(contractor));
        result.StockSyncArchivedEntries = history;
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
        const corrections = [];
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
                const sameCode = [...materials.values()].filter(material => material.code === code);
                const masterRates = rates.filter(rate => String(rate.ItemCode).trim() === code);
                const masterUnits = [...new Set(masterRates.map(rate => unit(rate.Unit)).filter(Boolean))];
                const confirmedRate = masterRates.some(rate => Math.abs(number(rate.DebitRate) - number(item.DebitRate)) < 0.00001);
                if (sameCode.length === 1 && factor(sameCode[0].uom, item.UOM) === undefined && masterUnits.length === 1 && masterUnits[0] === unit(sameCode[0].uom) && confirmedRate) {
                    // SAP stock and the debit-rate master independently confirm a
                    // wrong row label. Correct the label, not historical quantities.
                    item.StockUnitCorrection = { from: item.UOM, to: sameCode[0].uom, basis: 'Uploaded SAP unit agrees with debit-rate master' };
                    item.UOM = sameCode[0].uom;
                }
                if (item.StockUnitCorrection) corrections.push({ contractor: contractor.ContractorName, code, ...item.StockUnitCorrection });
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
            const nextIndex = Math.max(originalCount - 1, ...result.Contractors.flatMap(row => row.StockSyncEntryIndices || [])) + 1;
            const contractor = { ContractorName: group.block.contractorName || [...group.names][0], Metadata: { WONo: group.orders.join(', ') }, Items: [], StockSyncEntryIndices: [nextIndex], StockSyncPrimaryEntryIndex: nextIndex };
            update(contractor, [group]); result.Contractors.push(contractor);
        }
        result.ContractorCount = result.Contractors.length;
        result.StockSource = { ...result.StockSource, generatedAt: stock.meta?.uploadedAt || stock.meta?.generatedAt, uploaded: true };
        result.StockSyncWarnings = warnings;
        result.StockSyncCorrections = corrections;
        return result;
    }
    root.MasterStockSync = { apply };
})(typeof window !== 'undefined' ? window : globalThis);
