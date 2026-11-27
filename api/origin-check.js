'use strict';

function isAllowedOrigin(req) {
    const origin = req && req.headers && req.headers.origin;
    if (!origin) return true;
    try {
        const originHost = new URL(origin).host.toLowerCase();
        const candidates = new Set();
        const addHost = (val) => {
            if (!val) return;
            String(val).split(',').forEach((part) => {
                const h = part.trim().toLowerCase();
                if (h) candidates.add(h);
            });
        };
        addHost(req.headers.host);
        addHost(req.headers['x-forwarded-host']);
        addHost(process.env.ALLOWED_ORIGINS || 'billing-pro-dusky.vercel.app');
        return candidates.has(originHost);
    } catch (_) {
        return false;
    }
}

module.exports = { isAllowedOrigin };
