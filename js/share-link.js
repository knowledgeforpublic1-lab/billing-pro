(function (root) {
    'use strict';
    async function copy(text, options = {}) {
        const clipboard = options.clipboard || root.navigator?.clipboard;
        if (!clipboard || typeof clipboard.writeText !== 'function') return false;
        let timer;
        try {
            const pending = clipboard.writeText(String(text));
            return await Promise.race([
                Promise.resolve(pending).then(() => true, () => false),
                new Promise(resolve => { timer = setTimeout(() => resolve(false), options.timeoutMs ?? 1500); })
            ]);
        } catch (_) { return false; }
        finally { if (timer !== undefined) clearTimeout(timer); }
    }
    root.BillingShareLink = { copy };
    if (typeof module !== 'undefined' && module.exports) module.exports = { copy };
})(typeof window !== 'undefined' ? window : globalThis);
