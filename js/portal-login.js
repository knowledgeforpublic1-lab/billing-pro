(() => {
    const status = document.getElementById('status');
    const form = document.getElementById('login');
    const password = document.getElementById('password');
    const submit = document.getElementById('login-submit');
    const reset = document.getElementById('reset');
    const showPassword = document.getElementById('show-password');
    let busy = false;
    function showStatus(message, kind) {
        status.hidden = false;
        status.dataset.kind = kind;
        status.textContent = message;
    }
    function setBusy(value) {
        busy = value;
        submit.disabled = reset.disabled = showPassword.disabled = value;
        submit.textContent = value ? 'Verifying…' : '🔓 Unlock Portal & Begin Work';
    }
    async function call(action, body) {
        const response = await fetch('/api/auth/' + action, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Login service unavailable');
        return data;
    }
    form.onsubmit = async event => {
        event.preventDefault(); if (busy) return; setBusy(true);
        showStatus('Verifying…', 'info');
        try { await call('login', { password: password.value }); showStatus('Opening saved workspace…', 'success'); location.reload(); }
        catch (e) { showStatus(e.message, 'error'); }
        finally { setBusy(false); }
    };
    reset.onclick = async () => {
        if (busy) return; setBusy(true);
        reset.textContent = 'Sending reset email…';
        try { const result = await call('forgot-password', {}); showStatus(result.message, 'success'); }
        catch (e) { showStatus(e.message, 'error'); }
        finally { setBusy(false); reset.textContent = 'Forgot password?'; }
    };
    showPassword.onclick = () => {
        const visible = password.type === 'password';
        password.type = visible ? 'text' : 'password';
        showPassword.textContent = visible ? '🙈' : '👁️';
        showPassword.title = visible ? 'Hide Password' : 'Show Password';
        showPassword.setAttribute('aria-label', showPassword.title);
        showPassword.setAttribute('aria-pressed', String(visible));
    };
})();
