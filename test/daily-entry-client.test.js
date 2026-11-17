const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const createService = require('../api/daily-progress-service');
const settle = async () => { for (let i = 0; i < 15; i++) await new Promise(resolve => setImmediate(resolve)); };

function service() {
    const rows = new Map(), files = new Map(); let tail = Promise.resolve();
    const db = {
        async listDailyRecords(prefix) { return [...rows.entries()].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => ({ key, value: structuredClone(value) })); },
        atomicDailyRecord(key, change) { const task = tail.then(() => { const next = change(structuredClone(rows.get(key) || null)); if (next.value !== undefined) rows.set(key, structuredClone(next.value)); return structuredClone(next.result); }); tail = task.catch(() => {}); return task; }
    };
    const drive = { async read(id) { return structuredClone(files.get(id)); }, async write(key, data) { const id = 'file' + files.size; files.set(id, structuredClone(data)); return id; } };
    return { api: createService({ db, drive, items: [{ id: '15' }] }), files };
}
async function page(api, options = {}) {
    const nodes = new Map(), timers = [], storage = new Map();
    class Element {
        constructor(tag = 'div') { this.tagName = tag; this.children = []; this.listeners = {}; this.value = ''; this.hidden = false; this.validity = { valid: true }; }
        append(...children) { this.children.push(...children); }
        replaceChildren(...children) { this.children = children; }
        addEventListener(name, callback) { this.listeners[name] = callback; }
        reportValidity() { return true; }
        click() {}
    }
    for (const id of ['contractor', 'date', 'message', 'take', 'retry', 'recover', 'copy', 'workspace', 'search', 'count', 'materials', 'manpower', 'charges', 'remarks', 'save-state', 'final', 'more']) nodes.set(id, new Element());
    if (options.withLocations) for (const id of ['location', 'location-name', 'location-add']) nodes.set(id, new Element());
    const descendants = node => [node, ...node.children.filter(c => c instanceof Element).flatMap(descendants)];
    let loseFinalResponse = !!options.loseFinalResponse;
    const context = {
        document: {
            getElementById: id => nodes.get(id), createElement: tag => new Element(tag), createTextNode: text => text,
            querySelectorAll: () => ['materials', 'manpower', 'charges'].flatMap(id => descendants(nodes.get(id)).filter(n => n.tagName === 'input')).concat(nodes.get('remarks'))
        },
        location: { hash: '#link=' + 'a'.repeat(64) }, navigator: {}, crypto,
        sessionStorage: { getItem: () => null, setItem() {} }, localStorage: { setItem: (k, v) => storage.set(k, v), getItem: k => storage.get(k), removeItem: k => storage.delete(k) },
        URLSearchParams, AbortSignal, console, confirm: () => true,
        window: { addEventListener() {} },
        setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {}, setInterval() {},
        fetch: async (url, init) => {
            const request = init.body ? JSON.parse(init.body) : {};
            const editor = init.headers['x-dp-editor'];
            try {
                let result;
                if (url.endsWith('/bootstrap')) result = { contractor: { id: 'a', name: 'Team A' }, items: [{ id: '15', name: 'Sand', code: '100', unit: 'KG' }], today: '2026-11-16', storageReady: true, locations: options.locations || [] };
                else {
                    const parsed = new URL(url, 'https://billing.test');
                    const [, date, action] = parsed.pathname.match(/\/report\/([\d-]+)(?:\/(\w+))?$/);
                    const locationId = parsed.searchParams.get('locationId') || '';
                    result = action === 'save' ? await api.save('a', date, editor, { ...request, locationId }) : await api.access('a', date, editor, action || 'read', locationId);
                    if (action === 'save' && request.final && loseFinalResponse) { loseFinalResponse = false; throw new TypeError('Network response lost'); }
                }
                return { ok: true, status: 200, json: async () => ({ success: true, ...result }) };
            } catch (error) {
                if (!error.status) throw error;
                return { ok: false, status: error.status, json: async () => ({ error: error.message }) };
            }
        }
    };
    vm.runInNewContext(fs.readFileSync('js/public-daily-entry.js', 'utf8'), context);
    await settle();
    return { nodes, timers, storage, materialInput: () => nodes.get('materials').children[0].children[1] };
}
test('public editor autosaves, second viewer is read-only, final response-loss retry is idempotent', async () => {
    const { api, files } = service();
    const first = await page(api, { loseFinalResponse: true });
    assert.equal(first.materialInput().disabled, false);
    const input = first.materialInput(); input.value = '7'; input.listeners.input();
    assert.equal(first.storage.size, 1, 'Draft backed up immediately before network save');
    await first.timers.at(-1)(); await settle();
    assert.equal(files.size, 1);
    const second = await page(api);
    assert.equal(second.materialInput().disabled, true);
    assert.equal(second.materialInput().value, 7);
    assert.match(second.nodes.get('message').textContent, /Koi aur/);
    await first.nodes.get('final').onclick(); await settle();
    assert.equal(files.size, 2, 'Final reached Drive even though response was lost');
    assert.equal(first.nodes.get('retry').hidden, false);
    await first.nodes.get('retry').onclick(); await settle();
    assert.equal(files.size, 2, 'Retry must not create a second final version');
    assert.match(first.nodes.get('save-state').textContent, /Entry locked/);
    assert.equal(first.materialInput().disabled, true);
    assert.equal(first.storage.size, 0);
});

test('token editor requires a location and independently resumes each site on the same date', async () => {
    const { api, files } = service();
    const a = await api.locations.create('a', 'Site A'), b = await api.locations.create('a', 'Site B');
    const view = await page(api, { withLocations: true, locations: [a, b] });
    assert.equal(view.nodes.get('workspace').hidden, true);
    assert.equal(view.nodes.get('date').disabled, true);
    const choose = async id => { view.nodes.get('location').value = id; await view.nodes.get('location').listeners.change({ target: view.nodes.get('location') }); await settle(); };
    await choose(a.id);
    assert.equal(view.nodes.get('date').disabled, false);
    let input = view.materialInput(); input.value = '5'; input.listeners.input();
    await view.timers.at(-1)(); await settle();
    await choose(b.id);
    assert.equal(view.materialInput().value, '');
    input = view.materialInput(); input.value = '9'; input.listeners.input();
    await view.timers.at(-1)(); await settle();
    await choose(a.id);
    assert.equal(view.materialInput().value, 5);
    assert.equal(files.size, 2);
});
