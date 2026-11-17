/* Shared-entry login & signup. Passwords/tokens are never stored in browser storage. */
(() => {
    let resolveReady;
    const state = { user: null, ready: new Promise(resolve => { resolveReady = resolve; }) };
    window.DailyWorkerAuth = state;

    const root = document.createElement('div');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Entry login & signup');
    root.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,0.65);backdrop-filter:blur(4px);display:grid;place-items:center;padding:16px;color:#0f172a;font:14px system-ui,-apple-system,sans-serif;box-sizing:border-box;overflow-y:auto;';

    root.innerHTML = `
    <div style="width:min(100%,430px);box-sizing:border-box;padding:26px;background:#ffffff;border:1px solid #cbd5e1;border-radius:14px;box-shadow:0 20px 45px rgba(15,23,42,0.18);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <div style="font-size:26px;">📋</div>
            <div>
                <h1 style="font-size:20px;font-weight:700;margin:0;color:#0f172a;">Daily Progress Portal</h1>
                <p style="font-size:12px;margin:2px 0 0;color:#64748b;">Site Work Entry &amp; Consumption Diary</p>
            </div>
        </div>

        <!-- Mode Tabs -->
        <div style="display:grid;grid-template-columns:1fr 1fr;background:#f1f5f9;padding:4px;border-radius:8px;margin-bottom:16px;">
            <button type="button" data-tab="login" style="padding:8px;border:0;border-radius:6px;font:inherit;font-weight:600;cursor:pointer;background:#ffffff;color:#0f172a;box-shadow:0 1px 3px rgba(0,0,0,0.08);transition:all .15s;">Login</button>
            <button type="button" data-tab="signup" style="padding:8px;border:0;border-radius:6px;font:inherit;font-weight:600;cursor:pointer;background:transparent;color:#64748b;transition:all .15s;">Naya Signup</button>
        </div>

        <p data-desc style="line-height:1.45;color:#475569;font-size:13px;margin:0 0 16px;">Apne Email / Mobile number aur password se login karein.</p>

        <!-- Login Form -->
        <form data-form="login" style="display:block;">
            <label style="display:block;margin-bottom:14px;font-weight:500;font-size:13px;color:#334155;">
                Email ya Mobile Number
                <input name="identifier" autocomplete="username" required maxlength="80" autocapitalize="none" placeholder="e.g. 9876543210 ya name@example.com" style="display:block;width:100%;box-sizing:border-box;padding:11px 12px;margin-top:5px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;color:#0f172a;outline:none;">
            </label>
            <label style="display:block;margin-bottom:14px;font-weight:500;font-size:13px;color:#334155;">
                Password
                <input name="password" type="password" autocomplete="current-password" required maxlength="128" placeholder="Apna password daalein" style="display:block;width:100%;box-sizing:border-box;padding:11px 12px;margin-top:5px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;color:#0f172a;outline:none;">
            </label>
            <p data-error role="alert" style="color:#dc2626;font-size:13px;line-height:1.4;margin:10px 0 14px;empty-cells:hide;display:none;"></p>
            <button type="submit" style="width:100%;padding:12px;background:#2563eb;color:#ffffff;border:0;border-radius:7px;font:inherit;font-weight:600;cursor:pointer;box-shadow:0 2px 6px rgba(37,99,235,0.25);">Login &amp; Enter Progress</button>
            <p style="text-align:center;font-size:13px;color:#64748b;margin:14px 0 0;">
                Naya account banana hai? <a href="#" data-switch="signup" style="color:#2563eb;text-decoration:none;font-weight:600;">Signup karein</a>
            </p>
        </form>

        <!-- Signup Form -->
        <form data-form="signup" style="display:none;">
            <label style="display:block;margin-bottom:12px;font-weight:500;font-size:13px;color:#334155;">
                Pura Naam (Full Name) <span style="color:#dc2626;">*</span>
                <input name="name" required maxlength="80" placeholder="e.g. Ramesh Kumar" style="display:block;width:100%;box-sizing:border-box;padding:11px 12px;margin-top:4px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;color:#0f172a;outline:none;">
            </label>
            <label style="display:block;margin-bottom:12px;font-weight:500;font-size:13px;color:#334155;">
                Email ID <span style="color:#dc2626;">*</span>
                <input name="email" type="email" required maxlength="80" autocapitalize="none" placeholder="e.g. ramesh@example.com" style="display:block;width:100%;box-sizing:border-box;padding:11px 12px;margin-top:4px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;color:#0f172a;outline:none;">
            </label>
            <label style="display:block;margin-bottom:12px;font-weight:500;font-size:13px;color:#334155;">
                Mobile Number (10 Digit) <span style="color:#dc2626;">*</span>
                <input name="mobile" type="tel" required maxlength="10" pattern="[6-9][0-9]{9}" placeholder="e.g. 9876543210" style="display:block;width:100%;box-sizing:border-box;padding:11px 12px;margin-top:4px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;color:#0f172a;outline:none;">
            </label>
            <label style="display:block;margin-bottom:12px;font-weight:500;font-size:13px;color:#334155;">
                Password (min 6 characters) <span style="color:#dc2626;">*</span>
                <input name="password" type="password" required minlength="6" maxlength="128" placeholder="Kam se kam 6 character" style="display:block;width:100%;box-sizing:border-box;padding:11px 12px;margin-top:4px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;color:#0f172a;outline:none;">
            </label>
            <label style="display:block;margin-bottom:14px;font-weight:500;font-size:13px;color:#334155;">
                Contractor / Agency
                <select name="contractorId" style="display:block;width:100%;box-sizing:border-box;padding:10px 12px;margin-top:4px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;background:#ffffff;color:#0f172a;outline:none;">
                    <option value="">-- All / Auto Select --</option>
                </select>
            </label>
            <p data-error role="alert" style="color:#dc2626;font-size:13px;line-height:1.4;margin:10px 0 14px;empty-cells:hide;display:none;"></p>
            <button type="submit" style="width:100%;padding:12px;background:#059669;color:#ffffff;border:0;border-radius:7px;font:inherit;font-weight:600;cursor:pointer;box-shadow:0 2px 6px rgba(5,150,105,0.25);">Account Banayein &amp; Shuru Karein</button>
            <p style="text-align:center;font-size:13px;color:#64748b;margin:14px 0 0;">
                Pehle se account hai? <a href="#" data-switch="login" style="color:#2563eb;text-decoration:none;font-weight:600;">Login karein</a>
            </p>
        </form>
    </div>`;

    document.body.appendChild(root);

    const loginTab = root.querySelector('[data-tab="login"]');
    const signupTab = root.querySelector('[data-tab="signup"]');
    const loginForm = root.querySelector('[data-form="login"]');
    const signupForm = root.querySelector('[data-form="signup"]');
    const desc = root.querySelector('[data-desc]');
    const contractorSelect = root.querySelector('select[name="contractorId"]');

    function setTab(mode) {
        clearError();
        if (mode === 'signup') {
            signupTab.style.background = '#ffffff';
            signupTab.style.color = '#0f172a';
            signupTab.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
            loginTab.style.background = 'transparent';
            loginTab.style.color = '#64748b';
            loginTab.style.boxShadow = 'none';
            signupForm.style.display = 'block';
            loginForm.style.display = 'none';
            desc.textContent = 'Apna Naam, Email aur Mobile number daal kar naya account banayein.';
            signupForm.elements.name.focus();
        } else {
            loginTab.style.background = '#ffffff';
            loginTab.style.color = '#0f172a';
            loginTab.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
            signupTab.style.background = 'transparent';
            signupTab.style.color = '#64748b';
            signupTab.style.boxShadow = 'none';
            loginForm.style.display = 'block';
            signupForm.style.display = 'none';
            desc.textContent = 'Apne Email / Mobile number aur password se login karein.';
            loginForm.elements.identifier.focus();
        }
    }

    loginTab.onclick = () => setTab('login');
    signupTab.onclick = () => setTab('signup');
    root.querySelector('[data-switch="signup"]').onclick = e => { e.preventDefault(); setTab('signup'); };
    root.querySelector('[data-switch="login"]').onclick = e => { e.preventDefault(); setTab('login'); };

    function showError(form, msg) {
        const err = form.querySelector('[data-error]');
        if (err) {
            err.textContent = msg;
            err.style.display = 'block';
        }
    }

    function clearError() {
        root.querySelectorAll('[data-error]').forEach(err => {
            err.textContent = '';
            err.style.display = 'none';
        });
    }

    const workspace = document.getElementById('app') || document.querySelector('main');
    if (workspace) workspace.inert = true;

    async function request(path, body) {
        const response = await fetch('/api/dp-worker/' + path, {
            credentials: 'same-origin',
            cache: 'no-store',
            ...(body === undefined ? {} : {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            }),
            signal: AbortSignal.timeout(20000)
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Entry service unavailable. Retry karein.');
        }
        return data;
    }

    // Populate contractors for dropdown
    async function loadContractors() {
        try {
            if (window.defaultContractorsList && Array.isArray(window.defaultContractorsList)) {
                populateContractorOptions(window.defaultContractorsList);
            }
            const res = await request('contractors');
            if (res.contractors && res.contractors.length) {
                populateContractorOptions(res.contractors);
            }
        } catch {}
    }

    function populateContractorOptions(list) {
        const existing = new Set();
        contractorSelect.innerHTML = '<option value="">-- Sabhi / Auto Select --</option>';
        for (const c of list) {
            if (c.id && !existing.has(c.id)) {
                existing.add(c.id);
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name || c.id;
                contractorSelect.appendChild(opt);
            }
        }
    }
    loadContractors();

    function enter(user) {
        if (state.user) {
            location.reload();
            return;
        }
        state.user = user;
        root.remove();
        if (workspace) workspace.inert = false;

        const bar = document.createElement('div');
        bar.style.cssText = 'position:sticky;top:0;z-index:100;background:#f0fdf4;border-bottom:1px solid #bbf7d0;color:#166534;padding:7px 14px;font:13px system-ui,sans-serif;display:flex;justify-content:space-between;gap:10px;align-items:center;';
        const label = document.createElement('span');
        const details = [user.name, user.mobile || user.email].filter(Boolean).join(' • ');
        label.innerHTML = '<strong>👤 Logged in:</strong> ' + details;
        bar.appendChild(label);

        if (user.role !== 'admin') {
            const logout = document.createElement('button');
            logout.type = 'button';
            logout.textContent = 'Logout';
            logout.style.cssText = 'padding:4px 10px;border:1px solid #86efac;border-radius:5px;background:#ffffff;color:#15803d;font-weight:600;cursor:pointer;font-size:12px;';
            logout.onclick = async () => {
                try {
                    await request('logout', {});
                    location.reload();
                } catch (e) {
                    alert(e.message);
                }
            };
            bar.appendChild(logout);
        }
        document.body.prepend(bar);
        resolveReady(user);
    }

    state.expired = () => {
        showError(loginForm, 'Login expire ho gaya. Kripya dobara login karein.');
        if (workspace) workspace.inert = true;
        document.body.appendChild(root);
        setTab('login');
    };

    loginForm.onsubmit = async event => {
        event.preventDefault();
        clearError();
        const btn = loginForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        try {
            const result = await request('login', {
                identifier: loginForm.elements.identifier.value.trim(),
                password: loginForm.elements.password.value
            });
            loginForm.elements.password.value = '';
            enter(result.user);
        } catch (e) {
            showError(loginForm, e.message);
        } finally {
            btn.disabled = false;
        }
    };

    signupForm.onsubmit = async event => {
        event.preventDefault();
        clearError();
        const btn = signupForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        try {
            const selectedCid = signupForm.elements.contractorId.value;
            const contractorIds = selectedCid ? [selectedCid] : [];
            const result = await request('signup', {
                name: signupForm.elements.name.value.trim(),
                email: signupForm.elements.email.value.trim(),
                mobile: signupForm.elements.mobile.value.trim(),
                password: signupForm.elements.password.value,
                contractorIds
            });
            signupForm.elements.password.value = '';
            enter(result.user);
        } catch (e) {
            showError(signupForm, e.message);
        } finally {
            btn.disabled = false;
        }
    };

    request('session')
        .then(result => enter(result.user))
        .catch(() => {
            loginForm.elements.identifier.focus();
        });
})();
