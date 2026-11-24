/* Resolve uploaded stock using explicit contractor identities and SAP work orders. */
(function (root) {
    'use strict';
    const cache = new WeakMap();
    const normalize = value => String(value || '').toLowerCase().replace(/^m\/s\.?\s*/, '').replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
    const workOrders = value => [...new Set((Array.isArray(value) ? value.flat().join(' ') : String(value || '')).match(/\b\d{8}\b/g) || [])].sort();
    function index(stock) {
        const cached = cache.get(stock);
        if (cached?.source === stock.byContractorNorm) return cached.groups;
        const groups = new Map();
        for (const [key, block] of Object.entries(stock.byContractorNorm || {})) {
            if (!block?.materials) continue;
            const signature = JSON.stringify([block.contractorName, block.docHeader, block.allWorkOrders, block.materials]);
            if (!groups.has(signature)) groups.set(signature, { block, names: new Set(), orders: workOrders([block.docHeader, block.allWorkOrders || [], block.workOrders || []]) });
            groups.get(signature).names.add(normalize(key));
            groups.get(signature).names.add(normalize(block.contractorName));
        }
        const result = [...groups.values()]; cache.set(stock, { source: stock.byContractorNorm, groups: result }); return result;
    }
    function resolve(stock, identity, directory = []) {
        const primaryNames = new Set([identity.id, identity.name].map(normalize).filter(Boolean));
        const names = new Set([...primaryNames, ...(identity.aliases || []).map(normalize).filter(Boolean)]);
        const reference = (root.ReconciliationStockAliases?.Contractors || []).filter(row => normalize(row.ContractorName) === normalize(identity.name));
        if (reference.length === 1 && reference[0].IssueStockSource?.contractor) names.add(normalize(reference[0].IssueStockSource.contractor));
        // IDs take precedence over similar display names. Never use substring or
        // single-word matches (e.g. "Construction") to select another firm's stock.
        const idMatches = identity.id ? directory.filter(row => normalize(row.id) === normalize(identity.id)) : [];
        const namedProfiles = directory.filter(row => primaryNames.has(normalize(row.name)));
        const profiles = idMatches.length ? idMatches : namedProfiles.length ? namedProfiles : directory.filter(row => names.has(normalize(row.name)));
        const explicitOrders = workOrders(identity.workOrderNo);
        const profileOrders = profiles.length === 1 ? workOrders([profiles[0].workOrderNo, profiles[0].workOrderNumbers, profiles[0].allWorkOrders || []]) : [];
        const orders = explicitOrders.length ? explicitOrders : profileOrders;
        for (const profile of profiles) { names.add(normalize(profile.id)); names.add(normalize(profile.name)); }
        const all = index(stock);
        const exactName = group => [...names].some(name => name && group.names.has(name));
        let matching = orders.length ? all.filter(group => group.orders.some(order => orders.includes(order))) : all.filter(exactName);
        // Name-only CSV summaries may omit work orders. A different explicit work
        // order is never substituted, but an unscoped exact firm name is valid.
        if (orders.length && !matching.length) matching = all.filter(group => !group.orders.length && exactName(group));
        return { matches: matching, orders, status: matching.length > 1 ? 'ambiguous' : matching.length ? 'matched' : 'missing' };
    }
    root.BillingStockIdentity = { normalize, workOrders, index, resolve };
})(typeof window !== 'undefined' ? window : globalThis);
