/* Standalone public portal. No billing scripts, data stores or admin credentials. */
(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const token = new URLSearchParams(location.hash.slice(1)).get('link') || '';
    let editor;
    try { editor = sessionStorage.getItem('dp-editor'); if (!editor) { editor = crypto.randomUUID() + crypto.randomUUID(); sessionStorage.setItem('dp-editor', editor); } }
    catch { editor = crypto.randomUUID() + crypto.randomUUID(); }
    let state, items = [], contractor, date = '', draft = blank(), dirty = false, edits = 0, timer, running, pending, limit = 80;
    let locationId = '', today = '';
    let lastError = '';
    let lastActivity = Date.now(), loading = false, storageReady = false, active = false, stagedRecovery;
    const formInputs = () => document.querySelectorAll('#materials input,#manpower input,#charges input,#remarks');
    function blank() { return { quantities: {}, manpower: {}, remarks: '' }; }
    function message(text, error = false) { $('message').textContent = text; $('message').className = error ? 'error' : ''; }
    async function request(path, body) {
        if (path.startsWith('/report/') && locationId) path += (path.includes('?') ? '&' : '?') + 'locationId=' + encodeURIComponent(locationId);
        const response = await fetch('/api/daily-entry' + path, {
            method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
            headers: { 'Content-Type': 'application/json', 'x-dp-link': token, 'x-dp-editor': editor },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(45000)
        });
        const result = await response.json();
        if (response.status === 401 && window.DailyWorkerAuth) window.DailyWorkerAuth.expired();
        if (!response.ok || !result.success) throw Object.assign(new Error(result.error || 'Connection failed. Retry karein.'), { status: response.status });
        return result;
    }
    const pendingKey = () => 'daily-entry-pending:' + contractor.id + ':' + date + ':' + editor + (locationId ? ':' + locationId : '') + (window.DailyWorkerAuth && window.DailyWorkerAuth.user ? ':' + window.DailyWorkerAuth.user.id : '');
    function retain() {
        try { localStorage.setItem(pendingKey(), JSON.stringify({ draft, pending, edits })); }
        catch { message('Device backup unavailable. Page band na karein; save retry karein.', true); }
        $('copy').hidden = !dirty && !pending;
    }
    function controls() {
        const editable = active && state?.editable && state.state !== 'final' && !loading && storageReady && !(running && pending?.final);
        formInputs().forEach(input => input.disabled = !editable);
        $('final').disabled = !editable || !!running;
        $('take').hidden = !active || !state || state.state === 'final' || state.editable || state.occupied;
        $('retry').hidden = !active || (!dirty && !pending) || !!running || (!state?.editable && !pending);
        $('recover').hidden = !stagedRecovery || !editable;
        if (!storageReady) message('Google Drive storage setup pending hai. Entry abhi save nahi ho sakti.', true);
        else if (state?.state === 'final') message('Is date ki entry save aur lock ho chuki hai. Changes ke liye admin se reopen karwayein.');
        else if (state?.occupied) message('Koi aur is contractor ki is date ki entry kar raha hai. Neeche saved draft dikh raha hai; aap edit nahi kar sakte.');
        else if (state && !state.editable) message('Entry abhi read-only hai. Available hone par Start / resume entry dabayein.');
        else if (state?.editable) message('Aap is date ke editor hain. Draft automatically save hoga; final Save ke baad entry lock hogi.');
        if (lastError) message(lastError, true);
        $('copy').hidden = !dirty && !pending && !stagedRecovery;
    }
    function materials() {
        const q = $('search').value.toLowerCase().trim();
        const filtered = items.filter(item => (item.name + ' ' + item.code).toLowerCase().includes(q));
        const list = $('materials'); list.replaceChildren();
        filtered.slice(0, limit).forEach(item => {
            const row = document.createElement('div'); row.className = 'material';
            const label = document.createElement('label'); label.htmlFor = 'item-' + item.id;
            label.append(document.createTextNode(item.name));
            const small = document.createElement('small'); small.textContent = (item.code ? 'SAP ' + item.code + ' · ' : '') + item.unit; label.append(small);
            const input = document.createElement('input'); input.id = label.htmlFor; input.type = 'number'; input.min = '0'; input.step = 'any'; input.inputMode = 'decimal'; input.placeholder = '0'; input.value = draft.quantities[item.id] || '';
            input.addEventListener('input', () => change(() => { if (!input.validity.valid) return false; draft.quantities[item.id] = Number(input.value || 0); }));
            row.append(label, input); list.append(row);
        });
        $('count').textContent = Math.min(limit, filtered.length) + ' / ' + filtered.length;
        $('more').hidden = limit >= filtered.length;
        controls();
    }
    function render() {
        materials();
        for (const [id, keys] of [['manpower', ['leader', 'skilled', 'unskilled']], ['charges', ['tractor', 'augur', 'room']]]) {
            $(id).replaceChildren();
            keys.forEach(key => {
                const row = document.createElement('label'); row.className = 'man-row'; row.textContent = { leader: 'Team leader', skilled: 'Skilled', unskilled: 'Unskilled', tractor: 'Tractor', augur: 'Augur', room: 'Room' }[key];
                const input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.step = id === 'manpower' ? '1' : '.01'; input.value = draft.manpower[key] || '';
                input.addEventListener('input', () => change(() => { if (!input.validity.valid) return false; draft.manpower[key] = Number(input.value || 0); }));
                row.append(input); $(id).append(row);
            });
        }
        $('remarks').value = draft.remarks || '';
        controls();
    }
    function change(update) {
        if (!state?.editable || loading || !active) return;
        if (update() === false) return;
        lastActivity = Date.now(); edits++; dirty = true; retain();
        $('save-state').textContent = 'Changes pending…';
        clearTimeout(timer); timer = setTimeout(() => save(false).catch(() => {}), 1000);
    }
    async function save(final) {
        if (running) { await running; return save(final); }
        if ((!state?.editable && !pending) || !active) throw new Error('Read-only entry');
        if (!final && !dirty && !pending) return;
        clearTimeout(timer);
        // Retry the identical request after an uncertain response; server makes it idempotent.
        const job = pending || { requestId: crypto.randomUUID(), version: state.version, epoch: state.epoch, final,
            report: JSON.parse(JSON.stringify(draft)), editCount: edits };
        pending = job; retain();
        running = (async () => {
            try {
                const result = await request('/report/' + date + '/save', job);
                state.version = result.version; state.state = result.state;
                if (result.state === 'final') state.editable = false;
                lastError = ''; pending = null; dirty = edits !== job.editCount;
                if (!dirty) { try { localStorage.removeItem(pendingKey()); } catch {} }
                else retain();
                $('save-state').textContent = result.state === 'final' ? 'Saved to Google Drive · Entry locked' : 'Draft saved to Google Drive · v' + result.version;
                $('copy').hidden = !dirty;
                return result;
            } catch (error) {
                $('save-state').textContent = 'Not confirmed — draft retained on this device';
                lastError = error.message; message(error.message, true);
                if ([409, 423, 401].includes(error.status)) { state.editable = false; }
                throw error;
            } finally { running = null; controls(); }
        })();
        controls();
        const result = await running;
        if (final && !job.final) return save(true);
        if (dirty && state.editable) { clearTimeout(timer); timer = setTimeout(() => save(false).catch(() => {}), 1000); }
        return result;
    }
    async function open(newDate) {
        loading = true; controls();
        const oldDate = date;
        try {
            if ((dirty || pending) && state?.editable) await save(false);
            if (dirty || pending) throw new Error('Pending changes pehle save ya download karein. Date abhi change nahi hui.');
            const next = await request('/report/' + newDate + '/claim', {});
            lastError = ''; date = newDate; state = next; draft = next.report || blank(); dirty = false; pending = null; edits = 0;
            try { stagedRecovery = JSON.parse(localStorage.getItem(pendingKey()) || 'null'); } catch { stagedRecovery = null; }
            if (stagedRecovery?.pending && stagedRecovery.pending.final && next.state === 'final') {
                pending = stagedRecovery.pending; draft = stagedRecovery.draft; dirty = true; stagedRecovery = null;
            }
            $('date').value = date;
            $('save-state').textContent = state.version ? 'Saved version ' + state.version : 'New entry';
            render();
        } catch (e) { $('date').value = oldDate; lastError = e.message; message(e.message, true); }
        finally { loading = false; controls(); }
    }
    async function poll(heartbeat = false) {
        if (!date || loading || running || !active) return;
        const wantedDate = date;
        const wantedLocation = locationId;
        try {
            const next = await request('/report/' + date + (heartbeat ? '/heartbeat' : ''), heartbeat ? {} : undefined);
            if (date !== wantedDate || locationId !== wantedLocation || loading || running) return;
            const changed = next.version !== state.version;
            state = next;
            if (!dirty && !pending && changed) { draft = next.report || blank(); render(); }
            controls();
        } catch (e) { message(e.message + ' — pending changes retained.', true); if (e.status === 401) { active = false; controls(); } }
    }
    async function start() {
        try {
            const data = await request('/bootstrap'); contractor = data.contractor; items = data.items; storageReady = data.storageReady;
            today = data.today;
            $('contractor').textContent = contractor.name + (contractor.feeder ? ' · ' + contractor.feeder : '');
            active = true;
            if ($('location')) {
                renderLocations(data.locations || []);
                $('workspace').hidden = true; $('date').disabled = true; controls();
                $('date').value = today;
                message('Pehle work location add ya select karein, phir date ki entry karein.');
            } else { $('workspace').hidden = false; $('date').disabled = false; await open(data.today); }
            setInterval(() => { if (!document.hidden) poll(false); }, 30000);
            setInterval(() => { if (!document.hidden && Date.now() - lastActivity < 30000) poll(true); }, 30000);
            setInterval(() => { if (dirty && state?.editable && !running) save(false).catch(() => {}); }, 15000);
        } catch (e) { message(e.message, true); }
    }
    function renderLocations(locations) {
        $('location').replaceChildren();
        const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Choose work location…'; $('location').append(empty);
        for (const location of locations) {
            const option = document.createElement('option'); option.value = location.id; option.textContent = location.name; $('location').append(option);
        }
        $('location').value = locationId;
    }
    async function selectLocation(id) {
        if (dirty || pending || running || loading) { $('location').value = locationId; return message('Pending entry pehle save ya download karein.', true); }
        const wantedDate = $('date').value || today;
        locationId = id; date = ''; state = null; draft = blank();
        $('date').disabled = !id; $('workspace').hidden = !id;
        if (id) await open(wantedDate);
        else message('Work location select karein.');
    }
    if ($('location')) {
        $('location').addEventListener('change', event => selectLocation(event.target.value));
        $('location-add').onclick = async () => {
            try {
                if (dirty || pending || running || loading) throw new Error('Pending entry pehle save karein.');
                const saved = await request('/locations', { name: $('location-name').value });
                const list = await request('/locations');
                renderLocations(list.locations); $('location').value = saved.location.id; $('location-name').value = '';
                await selectLocation(saved.location.id);
            } catch (error) { message(error.message, true); }
        };
    }
    $('date').addEventListener('change', event => { if (event.target.value) open(event.target.value); });
    $('remarks').addEventListener('input', () => change(() => { draft.remarks = $('remarks').value; }));
    $('search').addEventListener('input', () => { limit = 80; materials(); });
    $('more').onclick = () => { limit += 80; materials(); };
    $('take').onclick = async () => {
        lastActivity = Date.now();
        if (!(dirty || pending)) return open(date);
        try {
            const next = await request('/report/' + date + '/claim', {});
            if (!next.editable) throw new Error('Entry abhi doosre editor ke paas ya locked hai. Pending draft download kar sakte hain.');
            if (next.version !== state.version) throw new Error('Newer saved draft available hai. Apni pending entry download karke report reload karein. Koi data overwrite nahi hua.');
            state = next; pending = null; lastError = ''; retain(); controls();
            await save(false);
        } catch (e) { lastError = e.message; controls(); }
    };
    $('retry').onclick = () => save(false).catch(() => {});
    $('final').onclick = async () => {
        if (![...formInputs()].every(input => input.reportValidity())) return;
        if (!confirm('Final save ke baad is date ki entry lock ho jayegi. Save karein?')) return;
        try { await save(true); } catch {}
    };
    $('recover').onclick = () => {
        if (!stagedRecovery || !state?.editable) return;
        draft = stagedRecovery.draft; dirty = true; edits++; pending = null; stagedRecovery = null;
        retain(); render(); save(false).catch(() => {});
    };
    $('copy').onclick = () => {
        const url = URL.createObjectURL(new Blob([JSON.stringify({ contractorId: contractor.id, date, locationId, ...(stagedRecovery?.draft || draft) }, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = 'pending-daily-progress-' + date + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    window.addEventListener('beforeunload', event => { if (dirty || pending) { event.preventDefault(); event.returnValue = ''; } });
    // A duplicated tab inherits sessionStorage. Web Locks prevents two tabs sharing one editor identity.
    function beginEntry() {
    if (navigator.locks) navigator.locks.request('daily-entry:' + token, { ifAvailable: true }, async lock => {
        if (!lock) { message('Ye entry link isi browser ke doosre tab mein open hai. Wahi tab use karein.', true); return; }
        await start(); await new Promise(() => {});
    });
    else { editor = crypto.randomUUID() + crypto.randomUUID(); start(); }
    }
    if (window.DailyWorkerAuth) window.DailyWorkerAuth.ready.then(beginEntry);
    else beginEntry();
})();
