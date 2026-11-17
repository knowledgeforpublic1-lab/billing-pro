const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRequire } = require('node:module');
const express = require('express');
const copy = value => structuredClone(value);
module.exports = function fixture() {
    const records = new Map(), configs = new Map(), files = new Map(); let tail = Promise.resolve();
    const db = {
        async getDefaultConfig(key) { return copy(configs.get(key) || null); },
        async saveDefaultConfig(key, data) { configs.set(key, { key, data: copy(data) }); },
        atomicDailyRecord(key, fn) {
            const task = tail.then(() => { const change = fn(copy(records.get(key) || null)); if (change.value !== undefined) records.set(key, copy(change.value)); return copy(change.result); });
            tail = task.catch(() => {}); return task;
        },
        async listDailyRecords(prefix, options = {}) { return [...records.entries()].filter(([key]) => key.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b)).slice(0, options.limit || Infinity).map(([key, value]) => ({ key, value: copy(value) })); }
    };
    const ownerCookie = 'billing_session=test-owner';
    const auth = {
        router: express.Router(),
        async sessionFor(req) {
            if (!(req.headers.cookie || '').includes(ownerCookie)) throw Object.assign(new Error('Login required'), { status: 401 });
            return req.authSession = { uid: 'owner', adminExpiresAt: Date.now() + 300000 };
        },
        middleware(req, res, next) { auth.sessionFor(req).then(() => next()).catch(e => res.status(e.status).json({ success: false, error: e.message })); },
        requireAdmin(req, res, next) { auth.middleware(req, res, next); }
    };
    const drive = { configured: () => true, async read(id) { return copy(files.get(id)); }, async write(key, value) { const id = 'file-' + files.size; files.set(id, copy(value)); return id; } };
    const file = path.resolve('api/index.js'), apiRequire = createRequire(file);
    const context = { console, process, Buffer, URL, setTimeout, clearTimeout, __dirname: path.dirname(file), module: { exports: {} },
        require(name) {
            if (name === './db') return db;
            if (name === './auth') return () => auth;
            if (name === './daily-worker-auth') return args => apiRequire(name)({ ...args, drive });
            if (name === 'dotenv') return { config() {} };
            if (name === './daily-progress-routes') return args => apiRequire(name)({ ...args, drive, seed: { items: [{ id: '15', name: 'Sand', code: '100', unit: 'KG', row: 15 }] } });
            return apiRequire(name);
        }
    };
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), context);
    return { app: context.module.exports, db, configs, records, files, drive, auth, ownerCookie };
};
