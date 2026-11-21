'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { copy } = require('../js/share-link');

test('clipboard denial, exceptions, unavailable clipboard and unresolved requests do not block sharing', async () => {
    assert.equal(await copy('https://billing.test', { clipboard: { writeText: async () => {} } }), true);
    for (const clipboard of [{}, { writeText: async () => { throw Error('Denied'); } }, { writeText() { throw Error('Unavailable'); } }, { writeText: () => new Promise(() => {}) }]) {
        assert.equal(await copy('https://billing.test', { clipboard, timeoutMs: 15 }), false);
    }
});

test('opening and copying a main-page share link leaves drafts untouched and selects a manual fallback', async () => {
    let selections = 0;
    const context = { window: { location: { origin: 'https://billing.test' }, BillingShareLink: { copy: (url, options) => copy(url, { ...options, timeoutMs: 15 }) } },
        navigator: { clipboard: { writeText: () => new Promise(() => {}) } }, prompt() { throw Error('Blocking prompt must never open'); } };
    vm.runInNewContext(fs.readFileSync('js/daily-progress.js', 'utf8'), context);
    const app = { ...context.window.DailyProgressModule, dailyProgressContractorId: 'synthetic', dailyProgressDate: '2026-11-21',
        dailyProgressLocationId: 'loc_aaaaaaaaaaaaaaaaaaaaaaaa', dailyProgressActiveContractor: { id: 'synthetic', name: 'Synthetic' },
        dailyProgressData: { reports: [{ version: 7, quantities: { 15: 12 } }] }, showToast() {},
        syncCurrentDailyProgressDraft() { throw Error('Sharing must not rewrite a draft'); },
        $nextTick: fn => fn(), $refs: { dpShareUrlInput: { focus() {}, select() { selections++; } } } };
    assert.equal(await app.copyDailyProgressShareLink(), false);
    assert.equal(app.dailyProgressModal, 'share');
    assert.equal(app.dailyProgressData.reports[0].version, 7);
    assert.equal(app.dailyProgressData.reports[0].quantities[15], 12);
    assert.equal(selections, 1);
});

test('the share page remains usable after the browser denies clipboard access', async () => {
    let app, selections = 0;
    const context = { window: { location: { search: '?contractor=synthetic&date=2026-11-21', origin: 'https://billing.test' }, BillingShareLink: { copy } },
        navigator: { clipboard: { writeText: async () => { throw Error('Denied'); } } }, document: { getElementById: () => ({}) },
        URLSearchParams, console, setTimeout, clearTimeout, localStorage: { getItem: () => null },
        prompt() { throw Error('Blocking prompt must never open'); },
        Vue: { createApp(options) { app = { ...options.data(), ...options.methods };
            for (const [key, fn] of Object.entries(options.computed)) Object.defineProperty(app, key, { get: () => fn.call(app) }); return { mount() {} }; } } };
    vm.runInNewContext(fs.readFileSync('js/daily-progress-standalone.js', 'utf8'), context);
    app.$refs = { shareUrlInput: { focus() {}, select() { selections++; } } };
    app.$nextTick = fn => fn();
    app.showToast = () => {};
    await app.copyShareLink();
    assert.equal(app.showShareModal, true);
    assert.equal(selections, 1);
});
