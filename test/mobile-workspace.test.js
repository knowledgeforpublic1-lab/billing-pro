const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('mobile.html', 'utf8');
const source = fs.readFileSync('js/mobile.js', 'utf8');
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)); };
async function workspace(options = {}) {
    const nodes = new Map(), storage = new Map(options.storage || []), timers = new Map(), requests = [], events = {};
    let timerId = 0, revision = 1;
    const state = {
        isFinalized: !!options.locked, projectMeta: { projectName: 'Test Project', raNo: 'RA-03', billNo: 'B-10' },
        invoiceData: { contractorName: 'Fallback Name', workOrderNo: '31001234' },
        contractorsList: [{ id: 'contractor-a', name: 'Example Contractor' }], selectedContractorId: 'contractor-a',
        pctStage1: 85, locations: [{ name: 'Long location name which should wrap on a narrow phone screen' }],
        activities: { 907: { title: '11 KV line material', materials: [
            { no: 1, itemCode: '100', desc: 'Pole material with a full descriptive name', unit: 'Nos', rate: 100 },
            { no: 2, itemCode: '200', desc: 'Cement material', unit: 'KG', rate: 10 }
        ] } }, activityQuantities: { 907: [[2, 3]] }, masterAbstractList: [], mappingLocks: {}
    };
    class Element {
        constructor() { this.listeners = {}; this.dataset = {}; this.style = {}; this.value = ''; this.children = []; this.hidden = false; this.classList = { toggle() {}, contains: () => true }; }
        addEventListener(name, fn) { this.listeners[name] = fn; }
        appendChild(child) { this.children.push(child); }
        setAttribute(key, value) { this[key] = value; }
        getAttribute(key) { return this[key]; }
        querySelectorAll() { return []; }
        closest() { return null; }
    }
    for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) nodes.set(id, new Element());
    const root = new Element(); root.dataset.theme = 'light';
    const context = {
        console, URLSearchParams, Number, Math,
        location: { search: '?billId=bill-a', href: '' },
        document: { getElementById: id => nodes.get(id), createElement: () => new Element(), documentElement: root, body: new Element() },
        window: { addEventListener(name, fn) { events[name] = fn; } },
        localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
        setTimeout(fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout(id) { timers.delete(id); }, setInterval() { return 1; },
        fetch: async (url, init = {}) => {
            requests.push({ url, init });
            if (url === '/api/auth/session' || url === '/api/auth/activity') return { ok: !options.expired, status: options.expired ? 401 : 200, json: async () => ({ success: !options.expired, expiresAt: Date.now() + 300000 }) };
            if (init.method === 'POST') {
                if (options.conflict) return { ok: false, status: 409, json: async () => ({ success: false, conflict: true, data: state, rev: 5 }) };
                Object.assign(state, JSON.parse(init.body)); revision++;
                return { ok: true, status: 200, json: async () => ({ success: true, rev: revision }) };
            }
            return { ok: true, status: 200, json: async () => ({ success: true, data: structuredClone(state), dataId: 'bill-a', rev: revision }) };
        }
    };
    vm.runInNewContext(source, context); await settle();
    const edit = async value => {
        const input = new Element(); input.value = String(value); input.disabled = false;
        input.getAttribute = key => key === 'data-loc' ? '0' : '0';
        nodes.get('cards').listeners.input({ target: input }); await settle();
    };
    return { nodes, state, storage, requests, timers, events, context, edit };
}
test('mobile clearly shows contractor/bill, complete item names, separate units and consistent activity totals', async () => {
    const { nodes, requests, timers, context } = await workspace();
    assert.equal(nodes.get('contractorName').textContent, 'Example Contractor');
    assert.equal(nodes.get('billNumber').textContent, 'RA-03 · B-10');
    assert.equal(nodes.get('workOrder').textContent, '31001234');
    assert.match(nodes.get('cards').innerHTML, /Pole material with a full descriptive name/);
    assert.match(nodes.get('cards').innerHTML, /aria-label="Quantity in Nos/);
    assert.equal(nodes.get('totAmt').textContent, '230.00');
    assert.equal(nodes.get('totInv').textContent, '195.50');
    assert.match(nodes.get('unitTotals').innerHTML, /Nos/); assert.match(nodes.get('unitTotals').innerHTML, /KG/);
    assert.equal(nodes.get('totQty').textContent, '2 / 2 items entered · All activity locations');
    assert.equal(requests.filter(r => r.url.startsWith('/api/billing?')).length, 1, 'Mobile boots only once');
    assert.ok(requests.some(r => r.url === '/api/billing?dataId=bill-a'));
    nodes.get('search').listeners.input({ target: { value: 'Cement' } });
    await [...timers.values()].at(-1)();
    assert.ok(!nodes.get('cards').innerHTML.includes('Pole material with a full descriptive name'));
    assert.equal(nodes.get('totAmt').textContent, '230.00', 'Searching must not change the activity amount');
    nodes.get('tabSummary').listeners.click();
    assert.equal(context.document.body.dataset.mobileTab, 'summary');
    assert.equal(nodes.get('tabSummary')['aria-selected'], 'true');
});
test('quantity edits save to the displayed bill and phone cache never replaces the desktop snapshot', async () => {
    const page = await workspace();
    page.storage.set('lk_billing_state_bill-a', 'desktop snapshot');
    await page.edit(4);
    assert.equal(page.nodes.get('totAmt').textContent, '430.00');
    assert.equal(page.nodes.get('totInv').textContent, '365.50');
    assert.equal(JSON.parse(page.storage.get('billing_mobile_state_bill-a')).mobilePending, true);
    page.nodes.get('btnSave').listeners.click(); await settle();
    const post = page.requests.find(r => r.init.method === 'POST' && r.url === '/api/billing');
    assert.ok(post); const payload = JSON.parse(post.init.body);
    assert.equal(payload.dataId, 'bill-a'); assert.equal(payload.baseRev, 1);
    assert.equal(payload.activityQuantities['907'][0][0], 4);
    assert.equal(page.storage.get('lk_billing_state_bill-a'), 'desktop snapshot');
    assert.equal(JSON.parse(page.storage.get('billing_mobile_state_bill-a')).mobilePending, false);
    assert.equal(page.nodes.get('syncTxt').textContent, 'Saved online');
});
test('refresh never discards pending entries after a genuine cloud conflict', async () => {
    const page = await workspace({ conflict: true });
    await page.edit(8);
    const reads = page.requests.filter(r => r.url.startsWith('/api/billing?')).length;
    await page.nodes.get('btnRefresh').listeners.click(); await settle();
    assert.equal(page.requests.filter(r => r.url.startsWith('/api/billing?')).length, reads);
    const pending = JSON.parse(page.storage.get('billing_mobile_state_bill-a'));
    assert.equal(pending.activityQuantities['907'][0][0], 8); assert.equal(pending.mobilePending, true);
    assert.equal(page.nodes.get('conflictNotice').hidden, false);
});
test('expired sessions show login guidance, and finalized bills reject mobile edits', async () => {
    const expired = await workspace({ expired: true });
    assert.equal(expired.nodes.get('sessionNotice').hidden, false);
    assert.equal(expired.requests.filter(r => r.url.startsWith('/api/billing')).length, 0);
    const locked = await workspace({ locked: true });
    assert.equal(locked.nodes.get('lockBar').hidden, false);
    assert.match(locked.nodes.get('cards').innerHTML, / disabled/);
    await locked.edit(999);
    assert.equal(locked.nodes.get('totAmt').textContent, '230.00');
});
test('mobile redirects preserve bill identity and Daily Progress opens its responsive workspace', () => {
    const index = fs.readFileSync('index.html', 'utf8');
    const bootstrap = index.match(/<script>([\s\S]*?)<\/script>/)[1];
    const redirects = [];
    const context = { URLSearchParams, navigator: { userAgent: 'iPhone Mobile' },
        location: { search: '?billId=bill-a', replace: path => redirects.push(path) },
        localStorage: { getItem: () => '', setItem() {} },
        document: { documentElement: { dataset: {}, classList: { toggle() {} } } }
    };
    vm.runInNewContext(bootstrap, context);
    assert.equal(redirects[0], '/mobile.html?billId=bill-a');
    redirects.length = 0; context.location.search = '?tab=dailyProgress';
    vm.runInNewContext(bootstrap, context);
    assert.equal(redirects.length, 0, 'Daily Progress cannot redirect back to the quantity-only page');
    const core = fs.readFileSync('js/core/app.js', 'utf8');
    const initializer = core.match(/currentView: (\(function\(\) \{[\s\S]*?\}\)\(\))/)[1];
    assert.equal(vm.runInNewContext(initializer, { window: { location: { search: '?tab=dailyProgress' } }, URLSearchParams, localStorage: context.localStorage }), 'dailyProgress');
});
