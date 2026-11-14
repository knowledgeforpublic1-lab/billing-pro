/** Server-verified Firebase login; only HttpOnly session cookies authenticate APIs. */
(function () {
    if (typeof window.fetch === 'function' && !window._billingAuthFetchInstalled) {
        const originalFetch = window.fetch.bind(window);
        window.fetch = async function (input, init) {
            const response = await originalFetch(input, init);
            try {
                const url = new URL(input && input.url || input, window.location.href);
                if (response.status === 401 && url.origin === window.location.origin && url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth/')) {
                    window.dispatchEvent(new Event('billing-session-expired'));
                }
            } catch (e) {}
            return response;
        };
        window._billingAuthFetchInstalled = true;
    }
    window.AuthModule = {
        authNow() { return Date.now() + (this._authClockOffset || 0); },
        async authRequest(path, body) {
            const response = await fetch('/api/auth/' + path, {
                credentials: 'same-origin', cache: 'no-store',
                ...(body !== undefined ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw Object.assign(new Error(result.error || 'Login service unavailable'), { status: response.status });
            return result;
        },
        applyAuthSession(result) {
            this._authClockOffset = Number(result.serverTime || Date.now()) - Date.now();
            this.sessionExpiresAt = result.expiresAt;
            this.adminExpiresAt = result.adminExpiresAt || 0;
            this.isPortalUnlocked = true;
            this.isAdminElevated = this.adminExpiresAt > this.authNow();
            this.isAdminUnlocked = this.isAdminElevated;
            this.updateAuthCountdown();
        },
        async restorePortalSession() {
            try {
                this.applyAuthSession(await this.authRequest('session'));
                return true;
            } catch (e) {
                this.isPortalUnlocked = false;
                if (e.status !== 401) this.portalPasswordError = 'Login service se connection nahi hua. Internet check karke retry karein.';
                return false;
            } finally {
                this.authReady = true;
                try { sessionStorage.removeItem('billing_portal_unlocked'); } catch (e) {}
            }
        },
        async verifyPortalPassword() {
            if (this.authBusy) return;
            this.authBusy = true;
            this.portalPasswordError = '';
            try {
                this.applyAuthSession(await this.authRequest('login', { password: this.portalPasswordInput }));
                this.portalPasswordInput = '';
                this.showPortalPasswordText = false;
                window.location.reload();
            } catch (e) {
                this.portalPasswordError = e.message || 'Login nahi hua. Dobara try karein.';
            } finally { this.authBusy = false; }
        },
        async forgotPortalPassword() {
            if (this.resetBusy) return;
            this.resetBusy = true;
            this.passwordResetMessage = '';
            this.portalPasswordError = '';
            try {
                const result = await this.authRequest('forgot-password', {});
                this.passwordResetMessage = result.message;
            } catch (e) {
                this.portalPasswordError = e.message || 'Reset email send nahi hua. Dobara try karein.';
            } finally { this.resetBusy = false; }
        },
        lockPortalLocally() {
            if (this.isPortalUnlocked) {
                try { this.saveToStorage(); } catch (e) {}
            }
            this.isPortalUnlocked = false;
            this.isAdminElevated = false;
            this.isAdminUnlocked = false;
            this.showAdminModal = false;
            this.adminPendingCallback = null;
            this.adminPasswordInput = '';
            this.portalPasswordInput = '';
            this.showAdminPasswordText = false;
            this.showPortalPasswordText = false;
            this.inactivitySecondsLeft = 0;
            if (this._adminElevatedTimer) clearTimeout(this._adminElevatedTimer);
            try { sessionStorage.removeItem('billing_portal_unlocked'); } catch (e) {}
        },
        async logoutPortal() {
            if (this.authBusy) return;
            this.authBusy = true;
            try {
                this.saveToStorage();
                await this.syncToMongoNow({ manual: false });
            } catch (e) {}
            try { await this.authRequest('logout', {}); } catch (e) {}
            this.lockPortalLocally();
            this.authBusy = false;
            this.showToast('Portal locked. Kaam local storage mein rakha gaya hai.', 'info');
        },
        openAdminModal(callback) {
            this.adminPendingCallback = typeof callback === 'function' ? callback : null;
            this.adminPasswordInput = '';
            this.adminPasswordError = '';
            this.showAdminPasswordText = false;
            this.showAdminModal = true;
            this.$nextTick(() => { const input = document.getElementById('adminPasswordModalInput'); if (input) input.focus(); });
        },
        closeAdminModal() {
            this.showAdminModal = false;
            this.adminPendingCallback = null;
            this.adminPasswordInput = '';
            this.adminPasswordError = '';
            this.showAdminPasswordText = false;
        },
        async verifyAdminPassword() {
            if (this.authBusy) return;
            this.authBusy = true;
            this.adminPasswordError = '';
            try {
                this.applyAuthSession(await this.authRequest('admin', { password: this.adminPasswordInput }));
                this.adminPasswordInput = '';
                this.showAdminPasswordText = false;
                this.showAdminModal = false;
                const callback = this.adminPendingCallback;
                this.adminPendingCallback = null;
                if (typeof callback === 'function') callback();
                this.showToast('Admin access 5 minute ke liye verified hai', '✅');
            } catch (e) {
                this.adminPasswordError = e.message || 'Admin verification nahi hua.';
            } finally { this.authBusy = false; }
        },
        startAdminElevatedTimer() { this.updateAuthCountdown(); },
        async lockAdminMode() {
            this.isAdminElevated = false;
            this.isAdminUnlocked = false;
            this.adminExpiresAt = 0;
            this.adminPendingCallback = null;
            try { await this.authRequest('admin/lock', {}); } catch (e) {}
        },
        onUserChipClick() {
            if (this.isAdminElevated) this.lockAdminMode();
            else this.openAdminModal();
        },
        checkAdminElevated(callback) {
            if (this.isPortalUnlocked && this.isAdminElevated && this.adminExpiresAt > this.authNow()) {
                if (typeof callback === 'function') callback();
                return true;
            }
            this.openAdminModal(callback);
            return false;
        },
        checkAdminAccess(callback) { return this.checkAdminElevated(callback); },
        formatTimerDisplay(seconds) {
            const total = Math.max(0, Math.floor(Number(seconds) || 0));
            return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
        },
        updateAuthCountdown() {
            if (!this.isPortalUnlocked) return;
            this.inactivitySecondsLeft = Math.max(0, Math.ceil((this.sessionExpiresAt - this.authNow()) / 1000));
            this.adminElevatedSecondsLeft = Math.max(0, Math.ceil((this.adminExpiresAt - this.authNow()) / 1000));
            if (!this.adminElevatedSecondsLeft) { this.isAdminElevated = false; this.isAdminUnlocked = false; }
            if (!this.inactivitySecondsLeft) this.lockPortalLocally();
        },
        async recordPortalActivity() {
            if (!this.isPortalUnlocked || this.authNow() >= this.sessionExpiresAt) { this.updateAuthCountdown(); return; }
            if (this._authTouchPending || Date.now() - (this._authLastTouch || 0) < 20000) return;
            this._authTouchPending = true;
            this._authLastTouch = Date.now();
            try { this.applyAuthSession(await this.authRequest('activity', {})); }
            catch (e) { if (e.status === 401) this.lockPortalLocally(); }
            finally { this._authTouchPending = false; }
        },
        initPortalWatchdog() {
            if (this._authWatchdogInstalled) return;
            this._authWatchdogInstalled = true;
            ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'].forEach(event => window.addEventListener(event, () => this.recordPortalActivity(), { passive: true }));
            window.addEventListener('billing-session-expired', () => this.lockPortalLocally());
            document.addEventListener('visibilitychange', () => this.updateAuthCountdown());
            window.addEventListener('focus', () => this.updateAuthCountdown());
            this._countdownTicker = setInterval(() => this.updateAuthCountdown(), 1000);
            this.updateAuthCountdown();
        }
    };
})();
