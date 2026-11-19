/* Versioned cloud copies for previously device-local stock and previous reco imports. */
(function (global) {
    'use strict';
    const localKey = key => 'billing_drive_dataset_' + key;
    const notices = new Map();
    const queues = new Map();
    let sequence = 0;
    const clone = value => JSON.parse(JSON.stringify(value));
    const normalize = values => Object.fromEntries(Object.entries(values || {}).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, { v: value.v, s: value.s || null }]));
    function responseBase(response) {
        try { const values = JSON.parse(response.headers.get('x-billing-storage-versions') || '{}'); return Object.keys(values).length ? normalize(values) : null; }
        catch (_) { return null; }
    }
    async function update(key, transform) {
        if (!global.BillingStorage.updateItem) throw Error('Refresh the application to load the current storage engine');
        const result = await global.BillingStorage.updateItem(localKey(key), transform);
        if (!result.saved) throw Error('Local backup failed; pending changes retained');
        return result.value;
    }
    function notice(key, message) {
        if (!global.document?.body) return;
        let card = notices.get(key);
        if (!card) {
            card = global.document.createElement('div');
            card.setAttribute('role', 'status');
            Object.assign(card.style, { position: 'fixed', right: '16px', bottom: (16 + notices.size * 125) + 'px', zIndex: '10000', maxWidth: '390px', padding: '12px', border: '1px solid #b38d41', borderRadius: '8px', background: '#fff9e8', color: '#332814', boxShadow: '0 3px 14px #0003', font: '13px sans-serif' });
            const text = global.document.createElement('p'); text.style.margin = '0 0 8px'; card.appendChild(text);
            for (const [label, action] of [['Retry save', 'retry'], ['Load cloud copy', 'cloud'], ['Replace cloud with my copy', 'local']]) {
                const button = global.document.createElement('button'); button.textContent = label; button.type = 'button';
                Object.assign(button.style, { margin: '3px', padding: '5px 7px', cursor: 'pointer' });
                button.onclick = async () => {
                    const buttons = [...card.querySelectorAll('button')]; buttons.forEach(b => { b.disabled = true; });
                    try { await resolve(key, action); } catch (error) { notice(key, error.message); }
                    finally { buttons.forEach(b => { b.disabled = false; }); }
                };
                card.appendChild(button);
            }
            global.document.body.appendChild(card); notices.set(key, card);
        }
        card.firstChild.textContent = (key === 'stockMaster' ? 'Stock' : 'Previous reconciliation') + ': ' + message;
    }
    function dismiss(key) { notices.get(key)?.remove(); notices.delete(key); }
    async function load(key, local) {
        const cached = await global.BillingStorage.getItemAsync(localKey(key));
        if (cached?.pending) { notice(key, 'Local changes are pending. Choose how to continue.'); return cached.data; }
        // Existing device-only data needs an explicit import; never silently discard it.
        if (local && (!cached || cached.localOnly)) return local;
        try {
            const response = await fetch('/api/storage/business?key=' + encodeURIComponent(key), { cache: 'no-store', credentials: 'same-origin' });
            if (response.status === 404) return local;
            const body = await response.json();
            if (!response.ok || !body.success) throw Error(body.error || 'Cloud dataset unavailable');
            if (!body.data) return cached?.cleared ? null : local;
            const saved = await update(key, current => current?.pending ? undefined : { data: body.data, pending: false, base: responseBase(response) });
            if (saved?.pending) notice(key, 'Local changes are pending. Choose how to continue.');
            return saved.data;
        } catch (error) { console.warn('[Cloud dataset]', error.message); return (await global.BillingStorage.getItemAsync(localKey(key)))?.data || local; }
    }
    async function saveInternal(key, snapshot, file, operationId) {
        const headers = { 'Content-Type': 'application/json' };
        const existing = await global.BillingStorage.getItemAsync(localKey(key));
        if (existing?.operationId !== operationId) return { enabled: true, superseded: true };
        // Pending edits keep the exact base captured when they were first made.
        let base = existing.base;
        if (!base) {
            const response = await fetch('/api/storage/business?key=' + encodeURIComponent(key), { cache: 'no-store', credentials: 'same-origin' });
            if (response.status === 404) {
                await update(key, current => current?.operationId === operationId ? { ...current, pending: false, localOnly: true } : undefined);
                return { enabled: false };
            }
            const body = await response.json();
            if (!response.ok || !body.success) throw Error(body.error || 'Cloud base unavailable; local data retained');
            base = responseBase(response);
            if (!base) throw Error('Cloud revision unavailable; pending changes retained');
            await update(key, current => current?.pending && !current.base ? { ...current, base } : undefined);
        }
        let payload = snapshot;
        if (file && global.BillingStorageTransport) {
            const sourceAsset = await global.BillingStorageTransport.archiveFile(file, 'master', key);
            if (sourceAsset) payload = { ...snapshot, sourceAsset };
        }
        const pending = await update(key, current => current?.operationId === operationId ? { ...current, data: payload, base } : undefined);
        if (pending?.operationId !== operationId) return { enabled: true, superseded: true };
        headers['x-billing-storage-versions'] = JSON.stringify(Object.fromEntries(Object.entries(base).slice(-30).map(([id, token]) => [id, { v: token.v, s: token.s || null }])));
        const response = await fetch('/api/storage/business', { method: 'POST', credentials: 'same-origin', headers, body: JSON.stringify({ key, data: payload }) });
        const body = await response.json();
        if (!response.ok || !body.success) throw Error(body.error || 'Dataset cloud save failed; pending copy retained');
        const acknowledgedBase = responseBase(response);
        if (!acknowledgedBase) throw Error('Save confirmed but revision unavailable; pending copy retained');
        const latest = await update(key, current => {
            if (current?.operationId === operationId) return { data: payload, pending: false, base: acknowledgedBase };
            // Only our acknowledged write may advance the base of the queued edit.
            if (current?.pending && JSON.stringify(normalize(current.base)) === JSON.stringify(normalize(base))) return { ...current, base: acknowledgedBase };
        });
        if (!latest?.pending) dismiss(key);
        return { enabled: true, data: payload };
    }
    async function save(key, data, file) {
        const snapshot = clone(data), operationId = Date.now() + '_' + ++sequence;
        // Persist immediately, even while an earlier cloud request is still running.
        await update(key, previous => ({ data: snapshot, pending: true, base: previous?.base || null, operationId }));
        const task = (queues.get(key) || Promise.resolve()).catch(() => {}).then(() => saveInternal(key, snapshot, file, operationId));
        queues.set(key, task);
        try { return await task; }
        catch (error) { if ((await global.BillingStorage.getItemAsync(localKey(key)))?.pending) notice(key, error.message); throw error; }
        finally { if (queues.get(key) === task) queues.delete(key); }
    }
    async function resolve(key, action) {
        const pending = await global.BillingStorage.getItemAsync(localKey(key));
        if (!pending?.pending) { dismiss(key); return; }
        let data = pending.data;
        if (action === 'retry') await save(key, data);
        else {
            const response = await fetch('/api/storage/business?key=' + encodeURIComponent(key), { cache: 'no-store', credentials: 'same-origin' });
            const body = await response.json();
            if (!response.ok || !body.success) throw Error(body.error || 'Cloud copy unavailable; pending data retained');
            if (action === 'cloud') {
                // Keep an independent conflict backup before the user's explicit replacement.
                if (!(await global.BillingStorage.setItem(localKey('conflict_' + key + '_' + Date.now()), pending)).saved) throw Error('Conflict backup failed; pending data retained');
                data = body.data;
                const changed = await update(key, current => current?.operationId === pending.operationId ? { data, pending: false, cleared: data === null, base: responseBase(response) } : undefined);
                if (changed?.pending) throw Error('Newer local edits arrived; they remain pending');
            } else if (action === 'local') {
                const base = responseBase(response);
                if (!base) throw Error('Cloud revision unavailable; pending data retained');
                const changed = await update(key, current => current?.operationId === pending.operationId ? { ...current, base } : undefined);
                if (changed?.operationId !== pending.operationId) throw Error('Newer local edits arrived; they remain pending');
                await save(key, data);
            } else throw Error('Unknown conflict action');
        }
        const latest = await global.BillingStorage.getItemAsync(localKey(key));
        if (latest?.pending) { notice(key, 'Newer local changes are still pending.'); return latest.data; }
        dismiss(key);
        data = latest?.data ?? data;
        global.dispatchEvent(new CustomEvent('billing-cloud-dataset', { detail: { key, data } }));
        return data;
    }
    global.BillingCloudDatasets = { load, save, resolve };
})(window);
