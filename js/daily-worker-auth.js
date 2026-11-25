/* Shared-entry login & signup. Passwords/tokens are never stored in browser storage. */
(() => {
    let resolveReady;
    const state = { user: null, ready: new Promise(resolve => { resolveReady = resolve; }) };
    window.DailyWorkerAuth = state;

    const root = document.createElement('div');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Sign In or Create Account');
    root.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,0.65);backdrop-filter:blur(4px);display:none;place-items:center;padding:16px;color:#0f172a;font:14px system-ui,-apple-system,sans-serif;box-sizing:border-box;overflow-y:auto;';

    root.innerHTML = `
    <div style="width:min(100%,430px);max-height:calc(100dvh - 32px);overflow-y:auto;box-sizing:border-box;padding:26px;background:#ffffff;border:1px solid #cbd5e1;border-radius:14px;box-shadow:0 20px 45px rgba(15,23,42,0.18);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <div style="font-size:26px;">📋</div>
            <div>
                <h1 style="font-size:20px;font-weight:700;margin:0;color:#0f172a;">Daily Progress Portal</h1>
                <p style="font-size:12px;margin:2px 0 0;color:#64748b;">Site Work Entry &amp; Material Diary</p>
            </div>
        </div>

        <!-- Mode Tabs -->
        <div style="display:grid;grid-template-columns:1fr 1fr;background:#f1f5f9;padding:4px;border-radius:8px;margin-bottom:16px;">
            <button type="button" data-tab="login" style="padding:8px;border:0;border-radius:6px;font:inherit;font-weight:600;cursor:pointer;background:#ffffff;color:#0f172a;box-shadow:0 1px 3px rgba(0,0,0,0.08);transition:all .15s;">Sign In</button>
            <button type="button" data-tab="signup" style="padding:8px;border:0;border-radius:6px;font:inherit;font-weight:600;cursor:pointer;background:transparent;color:#64748b;transition:all .15s;">Create Account</button>
        </div>

        <p data-desc style="line-height:1.45;color:#475569;font-size:13px;margin:0 0 16px;">Sign in with your Email, Mobile Number, or Username.</p>

        <!-- Login Form -->
        <form data-form="login" style="display:block;">
            <label style="display:block;margin-bottom:14px;font-weight:500;font-size:13px;color:#334155;">
                Email or Mobile Number
                <input name="identifier" autocomplete="username" required maxlength="80" autocapitalize="none" placeholder="e.g. 9876543210 or user@example.com" style="display:block;width:100%;box-sizing:border-box;padding:11px 12px;margin-top:5px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;color:#0f172a;outline:none;">
            </label>
            <label style="display:block;margin-bottom:14px;font-weight:500;font-size:13px;color:#334155;">
                Password
                <input name="password" type="password" autocomplete="current-password" required maxlength="128" placeholder="Enter your password" style="display:block;width:100%;box-sizing:border-box;padding:11px 12px;margin-top:5px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;color:#0f172a;outline:none;">
            </label>
            <p data-error role="alert" style="color:#dc2626;font-size:13px;line-height:1.4;margin:10px 0 14px;empty-cells:hide;display:none;"></p>
            <button type="submit" style="width:100%;padding:12px;background:#2563eb;color:#ffffff;border:0;border-radius:7px;font:inherit;font-weight:600;cursor:pointer;box-shadow:0 2px 6px rgba(37,99,235,0.25);">Sign In &amp; Continue</button>
            <p style="text-align:center;font-size:13px;color:#64748b;margin:14px 0 0;">
                Don't have an account? <a href="#" data-switch="signup" style="color:#2563eb;text-decoration:none;font-weight:600;">Create an account</a>
            </p>
        </form>

        <!-- Signup Form -->
        <form data-form="signup" style="display:none;">
            <label style="display:block;margin-bottom:12px;font-weight:500;font-size:13px;color:#334155;">
                Full Name <span style="color:#dc2626;">*</span>
                <input name="name" required maxlength="80" placeholder="e.g. Ramesh Kumar" style="display:block;width:100%;box-sizing:border-box;padding:11px 12px;margin-top:4px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;color:#0f172a;outline:none;">
            </label>
            <label style="display:block;margin-bottom:12px;font-weight:500;font-size:13px;color:#334155;">
                Email Address <span style="color:#dc2626;">*</span>
                <input name="email" type="email" required maxlength="80" autocapitalize="none" placeholder="e.g. user@example.com" style="display:block;width:100%;box-sizing:border-box;padding:11px 12px;margin-top:4px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;color:#0f172a;outline:none;">
            </label>
            <label style="display:block;margin-bottom:12px;font-weight:500;font-size:13px;color:#334155;">
                Mobile Number (10 Digits) <span style="color:#dc2626;">*</span>
                <input name="mobile" type="tel" required maxlength="10" pattern="[6-9][0-9]{9}" placeholder="e.g. 9876543210" style="display:block;width:100%;box-sizing:border-box;padding:11px 12px;margin-top:4px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;color:#0f172a;outline:none;">
            </label>
            <label style="display:block;margin-bottom:12px;font-weight:500;font-size:13px;color:#334155;">
                Password (min 6 characters) <span style="color:#dc2626;">*</span>
                <input name="password" type="password" required minlength="6" maxlength="128" placeholder="Minimum 6 characters" style="display:block;width:100%;box-sizing:border-box;padding:11px 12px;margin-top:4px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;color:#0f172a;outline:none;">
            </label>
            <fieldset style="margin:0 0 14px;padding:0;border:0;min-width:0;color:#334155;">
                <legend style="font-weight:600;font-size:13px;margin-bottom:5px;">Choose Contractors / Agencies *</legend>
                <p style="font-size:12px;line-height:1.4;margin:0 0 8px;">Select one or more contractors. You can choose 5 or more. Admin can update your assignments later.</p>
                <input type="search" data-contractor-search aria-label="Search contractors" placeholder="Search contractor name..." style="width:100%;box-sizing:border-box;padding:10px;font-size:16px;border:1px solid #cbd5e1;border-radius:6px;">
                <div data-contractor-list style="max-height:190px;overflow-y:auto;margin-top:6px;border:1px solid #cbd5e1;border-radius:6px;">Loading contractors...</div>
                <p data-contractor-count aria-live="polite" style="font-size:12px;margin:6px 0 0;">0 selected</p>
            </fieldset>
            <p data-error role="alert" style="color:#dc2626;font-size:13px;line-height:1.4;margin:10px 0 14px;empty-cells:hide;display:none;"></p>
            <button type="submit" style="width:100%;padding:12px;background:#059669;color:#ffffff;border:0;border-radius:7px;font:inherit;font-weight:600;cursor:pointer;box-shadow:0 2px 6px rgba(5,150,105,0.25);">Register &amp; Get Started</button>
            <p style="text-align:center;font-size:13px;color:#64748b;margin:14px 0 0;">
                Already have an account? <a href="#" data-switch="login" style="color:#2563eb;text-decoration:none;font-weight:600;">Sign in</a>
            </p>
        </form>
    </div>`;

    const loginTab = root.querySelector('[data-tab="login"]');
    const signupTab = root.querySelector('[data-tab="signup"]');
    const loginForm = root.querySelector('[data-form="login"]');
    const signupForm = root.querySelector('[data-form="signup"]');
    const desc = root.querySelector('[data-desc]');
    const contractorList = root.querySelector('[data-contractor-list]');
    const contractorSearch = root.querySelector('[data-contractor-search]');
    const contractorCount = root.querySelector('[data-contractor-count]');
    const selectedContractors = new Set();
    let signupContractors = [];
    let contractorsLoading, contractorsLoaded = false;
    const queryContractor = new URLSearchParams(window.location.search).get('contractor') || new URLSearchParams(window.location.search).get('c') || '';
    let queryContractorApplied = false;

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
            desc.textContent = 'Register your account with your Full Name, Email, and Mobile number.';
            signupForm.elements.name.focus();
            if (!contractorsLoaded) loadContractors();
        } else {
            loginTab.style.background = '#ffffff';
            loginTab.style.color = '#0f172a';
            loginTab.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
            signupTab.style.background = 'transparent';
            signupTab.style.color = '#64748b';
            signupTab.style.boxShadow = 'none';
            loginForm.style.display = 'block';
            signupForm.style.display = 'none';
            desc.textContent = 'Sign in with your Email, Mobile Number, or Username.';
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

    const getWorkspace = () => document.getElementById('app') || document.querySelector('main');

    function showAuthModal() {
        if (!document.body.contains(root)) {
            document.body.appendChild(root);
        }
        root.style.display = 'grid';
        const ws = getWorkspace();
        if (ws) ws.inert = true;
        setTab('login');
    }

    function hideAuthModal() {
        root.style.display = 'none';
        if (root.parentNode) root.remove();
        const ws = getWorkspace();
        if (ws) ws.inert = false;
    }

    async function request(path, body) {
        const headers = body === undefined ? {} : { 'Content-Type': 'application/json' };
        if (typeof queryContractor === 'string' && queryContractor && queryContractor.toLowerCase() !== 'all') {
            headers['X-DP-Share-Contractor'] = encodeURIComponent(queryContractor);
        }
        const response = await fetch('/api/dp-worker/' + path, {
            credentials: 'same-origin',
            cache: 'no-store',
            ...(body === undefined ? {} : {
                method: 'POST',
                body: JSON.stringify(body)
            }),
            headers,
            signal: AbortSignal.timeout(20000)
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Service temporarily unavailable. Please retry.');
        }
        return data;
    }

    // Populate contractors for dropdown
    async function loadContractors() {
        if (contractorsLoading) return contractorsLoading;
        contractorsLoading = (async () => {
        try {
            if (window.defaultContractorsList && Array.isArray(window.defaultContractorsList)) {
                populateContractorOptions(window.defaultContractorsList);
            }
            const res = await request('contractors');
            if (Array.isArray(res.contractors)) {
                populateContractorOptions(res.contractors);
            }
            contractorsLoaded = true;
        } catch {
            if (!signupContractors.length) contractorList.textContent = 'Contractors could not load. Refresh the page and retry.';
        }
        })();
        try { await contractorsLoading; } finally { contractorsLoading = null; }
    }

    function populateContractorOptions(list) {
        const existing = new Set();
        signupContractors = [];
        for (const c of list) {
            if (c.id && !existing.has(c.id)) {
                existing.add(c.id);
                signupContractors.push({ id: c.id, name: c.name || c.id });
            }
        }
        if (queryContractor && !queryContractorApplied) {
            const norm = value => String(value).toLowerCase().replace(/^m\/s\.?\s*/i, '').replace(/[^a-z0-9]/g, '');
            const match = signupContractors.find(c => norm(c.id) === norm(queryContractor));
            if (match) { selectedContractors.add(match.id); queryContractorApplied = true; }
        }
        renderContractors();
    }

    function renderContractors() {
        const q = contractorSearch.value.trim().toLowerCase();
        contractorList.replaceChildren();
        for (const c of signupContractors.filter(c => !q || (c.name + ' ' + c.id).toLowerCase().includes(q))) {
            const row = document.createElement('label');
            row.style.cssText = 'display:flex;align-items:center;gap:9px;padding:10px;min-height:44px;border-bottom:1px solid #e2e8f0;font-size:13px;cursor:pointer;';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.name = 'contractorIds';
            checkbox.value = c.id;
            checkbox.checked = selectedContractors.has(c.id);
            checkbox.onchange = () => {
                if (checkbox.checked) selectedContractors.add(c.id); else selectedContractors.delete(c.id);
                contractorCount.textContent = selectedContractors.size + ' selected';
            };
            const label = document.createElement('span');
            label.textContent = c.name;
            row.append(checkbox, label);
            contractorList.appendChild(row);
        }
        if (!contractorList.childElementCount) contractorList.textContent = 'No contractors match your search.';
        contractorCount.textContent = selectedContractors.size + ' selected';
    }
    contractorSearch.oninput = renderContractors;

    function enter(user) {
        state.user = user;
        hideAuthModal();

        if (!document.getElementById('dp-worker-user-bar')) {
            const bar = document.createElement('div');
            bar.id = 'dp-worker-user-bar';
            bar.style.cssText = 'position:sticky;top:0;z-index:100;background:#f0fdf4;border-bottom:1px solid #bbf7d0;color:#166534;padding:7px 14px;font:13px system-ui,sans-serif;display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:center;';
            const label = document.createElement('span');
            const details = [user.name, user.mobile || user.email].filter(Boolean).join(' • ');
            const ids = user.contractorIds || [];
            const scope = user.sharedView ? 'Limited contractor access' : (user.role === 'admin' || ids.some(id => id === '*' || id === 'all') ? 'All contractors' : ids.length + ' contractors assigned');
            label.className = 'dp-session-label';
            label.title = details + ' · ' + scope;
            label.textContent = user.sharedView ? '👤 Limited access · ' + (user.name === 'Contractor entry' ? 'Contractor' : user.name) : '👤 Signed In: ' + details + ' · ' + scope;
            bar.appendChild(label);

            if (user.role !== 'admin') {
                const refresh = document.createElement('button');
                refresh.type = 'button';
                refresh.className = 'dp-session-refresh';
                refresh.setAttribute('aria-label', 'Refresh contractors');
                refresh.title = 'Refresh contractors';
                refresh.textContent = 'Refresh Contractors';
                refresh.style.cssText = 'padding:4px 12px;border:1px solid #86efac;border-radius:5px;background:#ffffff;color:#15803d;font-weight:600;cursor:pointer;font-size:12px;';
                refresh.onclick = () => location.reload();
                bar.appendChild(refresh);
                const logout = document.createElement('button');
                logout.type = 'button';
                logout.className = 'dp-session-signout';
                logout.textContent = 'Sign Out';
                logout.style.cssText = 'padding:4px 12px;border:1px solid #86efac;border-radius:5px;background:#ffffff;color:#15803d;font-weight:600;cursor:pointer;font-size:12px;';
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
        }
        resolveReady(user);
    }

    state.expired = () => {
        showAuthModal();
        showError(loginForm, 'Your session has expired. Please sign in again.');
    };

    loginForm.onsubmit = async event => {
        event.preventDefault();
        clearError();
        const btn = loginForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        const originalLabel = btn.textContent;
        btn.textContent = 'Signing in…';
        loginForm.setAttribute('aria-busy', 'true');
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
            btn.textContent = originalLabel;
            loginForm.removeAttribute('aria-busy');
        }
    };

    signupForm.onsubmit = async event => {
        event.preventDefault();
        clearError();
        const btn = signupForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        try {
            const contractorIds = [...selectedContractors];
            if (!contractorIds.length) throw new Error('Select at least one contractor. You can choose five or more.');
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

    // Check existing session without flashing the dialog
    request('session')
        .then(result => enter(result.user))
        .catch(() => {
            showAuthModal();
        });
})();
