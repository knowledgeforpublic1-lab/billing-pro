(() => {
    const status = document.getElementById('status');
    const form = document.getElementById('login');
    let busy = false;
    async function call(action, body) {
        const response = await fetch('/api/auth/' + action, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Login service unavailable');
        return data;
    }
    form.onsubmit = async event => {
        event.preventDefault(); if (busy) return; busy = true;
        status.textContent = 'Verifying…';
        try { await call('login', { password: document.getElementById('password').value }); location.reload(); }
        catch (e) { status.textContent = e.message; }
        finally { busy = false; }
    };
    document.getElementById('reset').onclick = async () => {
        if (busy) return; busy = true;
        try { const result = await call('forgot-password', {}); status.textContent = result.message; }
        catch (e) { status.textContent = e.message; }
        finally { busy = false; }
    };
})();
