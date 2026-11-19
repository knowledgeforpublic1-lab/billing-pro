/* Shared same-origin storage transport. Existing module caches own pending business data. */
(function (global) {
    'use strict';
    if (!global.fetch || global.BillingStorageTransport) return;
    const originalFetch = global.fetch.bind(global), CHUNK = 256 * 1024, MAX = 32 * 1024 * 1024;
    const revisions = global.BillingStorageVersions = global.BillingStorageVersions || {};
    const inflightIds = new Map();
    let capability;
    const allowed = path => /^\/api\/(?:billing|reconciliation|contractor-mapping|storage\/business|daily-progress(?:\/data)?|save-default-(?:activities|pole-schedules)|default-(?:activities|pole-schedules)|bills|dp-admin\/(?:data|report|import|entry-history)|daily-entry\/report\/\d{4}-\d{2}-\d{2}\/save)$/.test(path);
    async function hash(bytes) { return Array.from(new Uint8Array(await global.crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join(''); }
    function encode(bytes) { let text = ''; for (const b of bytes) text += String.fromCharCode(b); return global.btoa(text); }
    function decode(text) { return Uint8Array.from(global.atob(text), c => c.charCodeAt(0)); }
    function capture(response) {
        let values;
        try { values = JSON.parse(response.headers.get('x-billing-storage-versions') || '{}'); } catch (_) { return; }
        for (const [key, token] of Object.entries(values)) {
            if (!/^[a-f0-9]{64}$/.test(key) || !Number.isSafeInteger(token.v)) continue;
            const previous = revisions[key];
            if (previous && token.v < previous.v) continue;
            if (previous && token.v === previous.v && token.s && previous.s) {
                const a = token.s.split('.').map(Number), b = previous.s.split('.').map(Number);
                if (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])) continue;
            }
            delete revisions[key]; revisions[key] = token;
        }
    }
    // Store only request identity/hash, never another large copy or credentials.
    async function identity(key, remove) {
        if (!global.indexedDB) return;
        return new Promise(resolve => {
            let settled = false;
            const finish = value => { if (!settled) { settled = true; resolve(value); } };
            const request = global.indexedDB.open('billing-storage-requests', 1);
            request.onupgradeneeded = () => request.result.createObjectStore('requests');
            request.onerror = () => finish();
            request.onblocked = () => finish();
            request.onsuccess = () => {
                if (settled) { request.result.close(); return; }
                const db = request.result, tx = db.transaction('requests', 'readwrite'), store = tx.objectStore('requests');
                let id;
                if (remove) store.delete(key);
                else {
                    const get = store.get(key);
                    get.onsuccess = () => { id = get.result?.id || global.crypto.randomUUID(); store.put({ id, createdAt: Date.now() }, key); };
                }
                tx.oncomplete = () => { db.close(); finish(id); };
                tx.onerror = tx.onabort = () => { db.close(); finish(); };
            };
        });
    }
    async function capabilities(headers, signal) {
        if (!capability) capability = originalFetch('/api/storage/transport', { credentials: 'same-origin', headers, signal })
            .then(async response => {
                if (response.status === 404) return null;
                if (!response.ok) throw new Error('Storage transport unavailable; pending copy retained');
                return response.json();
            }).catch(error => { capability = undefined; throw error; });
        return capability;
    }
    async function jsonFetch(url, init) {
        const response = await originalFetch(url, init);
        let data; try { data = await response.json(); } catch (_) { throw new Error('Storage transfer response unreadable; pending copy retained'); }
        if (!response.ok || !data.success) throw new Error(data.error || 'Storage transfer failed; pending copy retained');
        return data;
    }
    async function upload(target, bytes, headers, signal, metadata = {}) {
        const common = { credentials: 'same-origin', headers, signal };
        const begin = await jsonFetch('/api/storage/transport', { ...common, method: 'POST', body: JSON.stringify({ ...metadata, target, bytes: bytes.length, sha256: await hash(bytes) }) });
        for (let offset = 0; offset < bytes.length; offset += CHUNK) {
            const result = await jsonFetch('/api/storage/transport/' + begin.id, { ...common, method: 'PUT', body: JSON.stringify({ offset, base64: encode(bytes.subarray(offset, offset + CHUNK)) }) });
            if (result.offset < Math.min(offset + CHUNK, bytes.length)) throw new Error('Storage upload offset mismatch; pending copy retained');
        }
        return begin.id;
    }
    async function expand(response, headers, signal) {
        if (!response.headers.get('content-type')?.includes('application/json')) return response;
        const body = await response.clone().json();
        if (!body?.__billingDownload) return response;
        const manifest = body.__billingDownload;
        if (!/^[a-f0-9-]{36}$/.test(manifest.id || '') || !Number.isSafeInteger(manifest.bytes) || manifest.bytes < 1 || manifest.bytes > MAX || manifest.chunkBytes !== CHUNK || !/^[a-f0-9]{64}$/.test(manifest.sha256 || '')) throw new Error('Invalid storage download manifest');
        const bytes = new Uint8Array(manifest.bytes);
        for (let offset = 0; offset < bytes.length; offset += CHUNK) {
            const part = await jsonFetch('/api/storage/transport/' + manifest.id + '?offset=' + offset, { credentials: 'same-origin', headers, signal });
            const decoded = decode(part.base64);
            if (part.offset !== offset || decoded.length !== Math.min(CHUNK, bytes.length - offset)) throw new Error('Download part mismatch; current data retained');
            bytes.set(decoded, offset);
        }
        if (await hash(bytes) !== manifest.sha256) throw new Error('Download checksum mismatch; current data retained');
        const resultHeaders = new Headers(response.headers); resultHeaders.delete('content-length');
        return new Response(bytes, { status: response.status, statusText: response.statusText, headers: resultHeaders });
    }
    async function storageFetch(input, options = {}) {
        const url = new URL(typeof input === 'string' ? input : input.url, global.location.href);
        const method = String(options.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
        if (url.origin !== global.location.origin || !allowed(url.pathname) || !['GET', 'POST'].includes(method) || (typeof input !== 'string' && !(input instanceof URL))) return originalFetch(input, options);
        const headers = new Headers(options.headers || {});
        headers.set('x-billing-transport', '1');
        // Snapshot revisions before asynchronous upload. Later reads cannot change this save's base.
        if (!headers.has('x-billing-storage-versions')) headers.set('x-billing-storage-versions', JSON.stringify(Object.fromEntries(Object.entries(revisions).slice(-30).map(([key, value]) => [key, { v: value.v, s: value.s || null }]))));
        let body = options.body, identityKey;
        let keepalive = options.keepalive;
        if (method === 'POST' && typeof body === 'string' && global.crypto?.subtle) {
            const bytes = new TextEncoder().encode(body);
            // Browsers bound keepalive bodies at about 64 KiB. Larger saves use
            // ordinary requests; existing IndexedDB pending state survives closing.
            if (bytes.length > 48 * 1024) keepalive = false;
            identityKey = await hash(new TextEncoder().encode(url.pathname + '\0' + body));
            let id = inflightIds.get(identityKey) || await identity(identityKey) || global.crypto.randomUUID();
            inflightIds.set(identityKey, id); headers.set('x-billing-request-id', id);
            if (bytes.length > MAX) throw new Error('Dataset exceeds storage size budget; pending copy retained');
            if (bytes.length > 1024 * 1024) {
                const supported = await capabilities(headers, options.signal);
                if (supported?.success) { headers.set('Content-Type', 'application/json'); body = JSON.stringify({ __billingUpload: await upload(url.pathname, bytes, headers, options.signal) }); }
                else if (bytes.length > 4 * 1024 * 1024) throw new Error('Large-file cloud transport is disabled; local pending copy retained');
            }
        }
        let response = await originalFetch(input, { ...options, headers, body, ...(keepalive !== undefined ? { keepalive } : {}) });
        response = await expand(response, headers, options.signal);
        // Error reads may carry newer cloud revisions; a failed POST must not advance the
        // pending edit's base, which would let an automatic retry overwrite that revision.
        if (method === 'GET' || response.ok) capture(response);
        if (identityKey && response.ok) {
            const data = await response.clone().json().catch(() => null);
            if (data?.success) { inflightIds.delete(identityKey); await identity(identityKey, true); }
        }
        return response;
    }
    async function archiveFile(file, kind, id) {
        const headers = new Headers({ 'Content-Type': 'application/json' });
        const supported = await capabilities(headers);
        if (!supported?.success) return null;
        const maxAsset = Math.min(128 * 1024 * 1024, supported.maxAssetBytes || MAX);
        if (file.size > maxAsset) throw new Error('Source workbook exceeds the original-file storage budget; local copy retained');
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (bytes.length > maxAsset) throw new Error('Source workbook exceeds the original-file storage budget; local copy retained');
        const uploadId = await upload('/api/storage/assets', bytes, headers, undefined, { name: file.name });
        return (await jsonFetch('/api/storage/assets', { method: 'POST', credentials: 'same-origin', headers, body: JSON.stringify({ uploadId, kind, id }) })).asset;
    }
    global.BillingStorageTransport = { fetch: storageFetch, capture, revisions, archiveFile };
    global.fetch = storageFetch;
})(window);
