/* Versioned cloud copies for previously device-local stock and previous reco imports. */
(function (global) {
    'use strict';
    const localKey = key => 'billing_drive_dataset_' + key;
    const notices = new Map();
    const queues = new Map();
    const saving = new Map();
    const noticeTimers = new Map();
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
    function notice(key, message, { success = false } = {}) {
        if (!global.document?.body) return;
        if (noticeTimers.has(key)) { global.clearTimeout(noticeTimers.get(key)); noticeTimers.delete(key); }
        let card = notices.get(key);
        if (!card) {
            card = global.document.createElement('div');
            card.setAttribute('role', 'status');
            Object.assign(card.style, { position: 'fixed', right: '16px', bottom: (16 + notices.size * 125) + 'px', zIndex: '10000', maxWidth: '390px', padding: '12px', border: '1px solid #b38d41', borderRadius: '8px', background: '#fff9e8', color: '#332814', boxShadow: '0 3px 14px #0003', font: '13px sans-serif' });
            const text = global.document.createElement('p'); text.style.margin = '0 0 8px'; card.appendChild(text);
            global.document.body.appendChild(card); notices.set(key, card);
        }
        card.firstChild.textContent = (key === 'stockMaster' ? 'Stock' : 'Previous reconciliation') + ': ' + message;
        card.style.background = success ? '#ecfdf3' : '#fff9e8';
        card.style.borderColor = success ? '#16803b' : '#b38d41';
        if (success && global.setTimeout) noticeTimers.set(key, global.setTimeout(() => dismiss(key), 8000));
    }
    function pendingNotice(key, cached) {
        if (saving.has(key)) notice(key, 'Uploading to cloud. Please keep this page open until save is confirmed.');
        else notice(key, 'Update nahi hua. ' + (cached.errorMessage || 'Previous upload is not confirmed.') + ' Local copy safe hai; file dobara upload karein.');
    }
    function dismiss(key) {
        if (noticeTimers.has(key)) { global.clearTimeout(noticeTimers.get(key)); noticeTimers.delete(key); }
        notices.get(key)?.remove(); notices.delete(key);
    }
    async function load(key, local) {
        const cached = await global.BillingStorage.getItemAsync(localKey(key));
        if (cached?.pending) { pendingNotice(key, cached); return cached.data; }
        // Existing device-only data needs an explicit import; never silently discard it.
        if (local && (!cached || cached.localOnly)) return local;
        try {
            const response = await fetch('/api/storage/business?key=' + encodeURIComponent(key), { cache: 'no-store', credentials: 'same-origin' });
            if (response.status === 404) return local;
            const body = await response.json();
            if (!response.ok || !body.success) throw Error(body.error || 'Cloud dataset unavailable');
            if (!body.data) return cached?.cleared ? null : local;
            const saved = await update(key, current => current?.pending ? undefined : { data: body.data, pending: false, base: responseBase(response) });
            if (saved?.pending) pendingNotice(key, saved);
            return saved.data;
        } catch (error) { console.warn('[Cloud dataset]', error.message); return (await global.BillingStorage.getItemAsync(localKey(key)))?.data || local; }
    }
    async function saveInternal(key, snapshot, file, operationId) {
        const headers = { 'Content-Type': 'application/json' };
        const existing = await global.BillingStorage.getItemAsync(localKey(key));
        if (existing?.operationId !== operationId) return { enabled: true, superseded: true };
        // Pending edits keep the exact base captured when they were first made.
        let base = existing.base;
        if (!base || existing.replaceCloud) {
            const response = await fetch('/api/storage/business?key=' + encodeURIComponent(key), { cache: 'no-store', credentials: 'same-origin' });
            if (response.status === 404) {
                if (existing.replaceCloud) throw Error('Cloud storage is disabled; upload could not be confirmed');
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
            const sourceAsset = await global.BillingStorageTransport.archiveFile(file, 'master', key, progress => {
                if (saving.get(key) === 1) notice(key, 'Uploading Excel: ' + Math.floor(progress.loaded * 100 / progress.total) + '%.' + (progress.restarted ? ' Transfer restarted automatically.' : '') + ' Please keep this page open.');
            });
            if (sourceAsset) payload = { ...snapshot, sourceAsset };
            if (saving.get(key) === 1) notice(key, 'Excel upload complete. Saving stock data to cloud; please wait for confirmation.');
        }
        const pending = await update(key, current => current?.operationId === operationId ? { ...current, data: payload, base } : undefined);
        if (pending?.operationId !== operationId) return { enabled: true, superseded: true };
        let response, body;
        for (let attempt = 0; ; attempt++) {
            const current = await global.BillingStorage.getItemAsync(localKey(key));
            if (current?.operationId !== operationId) return { enabled: true, superseded: true };
            headers['x-billing-storage-versions'] = JSON.stringify(Object.fromEntries(Object.entries(base).slice(-30).map(([id, token]) => [id, { v: token.v, s: token.s || null }])));
            response = await fetch('/api/storage/business', { method: 'POST', credentials: 'same-origin', headers: { ...headers }, body: JSON.stringify({ key, data: payload }) });
            body = await response.json();
            if (response.status !== 409 || !existing.replaceCloud || attempt >= 2) break;
            // A newly uploaded file is the user's final choice. Rebase only that
            // explicit upload, without changing or merging its material quantities.
            const latest = await fetch('/api/storage/business?key=' + encodeURIComponent(key), { cache: 'no-store', credentials: 'same-origin' });
            const cloud = await latest.json();
            if (!latest.ok || !cloud.success) throw Error(cloud.error || 'Cloud revision unavailable; upload not confirmed');
            base = responseBase(latest);
            if (!base) throw Error('Cloud revision unavailable; upload not confirmed');
            await update(key, value => value?.operationId === operationId ? { ...value, base } : undefined);
        }
        if (!response.ok || !body.success) throw Object.assign(Error(body.error || 'Dataset cloud save failed; pending copy retained'), { status: response.status });
        const acknowledgedBase = responseBase(response);
        if (!acknowledgedBase) throw Error('Save confirmed but revision unavailable; pending copy retained');
        const latest = await update(key, current => {
            if (current?.operationId === operationId) return { data: payload, pending: false, base: acknowledgedBase };
            // Only our acknowledged write may advance the base of the queued edit.
            if (current?.pending && JSON.stringify(normalize(current.base)) === JSON.stringify(normalize(base))) return { ...current, base: acknowledgedBase };
        });
        if (!latest?.pending) notice(key, 'Update ho gaya. Uploaded data successfully saved to cloud.', { success: true });
        return { enabled: true, data: payload };
    }
    async function save(key, data, file, { replaceCloud = !!file } = {}) {
        const snapshot = clone(data), operationId = Date.now() + '_' + ++sequence;
        saving.set(key, (saving.get(key) || 0) + 1);
        let task;
        try {
            // Persist immediately, even while an earlier cloud request is still running.
            await update(key, previous => ({ data: snapshot, pending: true, base: previous?.base || null, operationId, replaceCloud }));
            pendingNotice(key, {});
            task = (queues.get(key) || Promise.resolve()).catch(() => {}).then(() => saveInternal(key, snapshot, file, operationId));
            queues.set(key, task);
            return await task;
        } catch (error) {
            // Keep the actual failure across reloads, attached only to this edit.
            await update(key, current => current?.pending && current.operationId === operationId
                ? { ...current, errorMessage: error.message, errorStatus: error.status || null } : undefined).catch(() => {});
            const pending = await global.BillingStorage.getItemAsync(localKey(key));
            if (pending?.pending && pending.operationId === operationId) notice(key, 'Update nahi hua. ' + error.message + ' Local copy safe hai; file dobara upload karein.');
            throw error;
        } finally {
            const remaining = saving.get(key) - 1;
            if (remaining) saving.set(key, remaining); else saving.delete(key);
            if (queues.get(key) === task) queues.delete(key);
        }
    }
    async function resolve(key, action) {
        const pending = await global.BillingStorage.getItemAsync(localKey(key));
        if (!pending?.pending) { dismiss(key); return; }
        if (saving.has(key)) { pendingNotice(key, pending); return pending.data; }
        let data = pending.data;
        if (action === 'retry') await save(key, data, undefined, { replaceCloud: !!pending.replaceCloud });
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
        if (latest?.pending) { pendingNotice(key, latest); return latest.data; }
        dismiss(key);
        data = latest?.data ?? data;
        global.dispatchEvent(new CustomEvent('billing-cloud-dataset', { detail: { key, data } }));
        return data;
    }
    global.BillingCloudDatasets = { load, save, resolve };
})(window);
