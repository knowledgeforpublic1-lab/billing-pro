const test = require('node:test');
const assert = require('node:assert/strict');
const telegram = require('../api/telegram');

test('telegram sendMessage honors mock mode in test env', async () => {
    process.env.NODE_ENV = 'test';
    const res = await telegram.sendMessage('Hello test');
    assert.equal(res.success, true);
    assert.equal(res.mocked, true);
});

test('sendDailyProgressAlert formats contractor, manpower and materials', async () => {
    process.env.NODE_ENV = 'test';
    const res = await telegram.sendDailyProgressAlert({
        contractorName: 'Mangesh Sonwane',
        feeder: 'ANGARA',
        date: '2026-11-24',
        report: {
            quantities: { 'item1': 10, 'item2': 0 },
            manpower: { leader: 1, skilled: 4, unskilled: 5 },
            remarks: 'Pole erection done'
        },
        savedBy: 'Ramesh',
        isFinal: true,
        itemsMap: { 'item1': { name: 'RSJ Pole', unit: 'No' } }
    });
    assert.equal(res.success, true);
});

test('handleWebhookUpdate responds to /start and /help', async () => {
    process.env.NODE_ENV = 'test';
    const res = await telegram.handleWebhookUpdate({
        message: {
            chat: { id: '881238938' },
            text: '/start',
            from: { first_name: 'Atul' }
        }
    });
    assert.equal(res.ok, true);
});

test('handleWebhookUpdate responds to /today with daily summary', async () => {
    process.env.NODE_ENV = 'test';
    const mockDb = {
        readDailyProgressData: async () => ({
            reports: [
                {
                    date: '2026-11-24',
                    contractorName: 'Mangesh Sonwane',
                    feeder: 'ANGARA',
                    manpower: { leader: 1, skilled: 3, unskilled: 4 }
                }
            ],
            contractors: [{ id: 'mangesh', name: 'Mangesh Sonwane', feeder: 'ANGARA' }]
        })
    };
    const res = await telegram.handleWebhookUpdate({
        message: {
            chat: { id: '881238938' },
            text: '/today'
        }
    }, { db: mockDb });
    assert.equal(res.ok, true);
});

test('handleWebhookUpdate responds to /pending listing pending contractors', async () => {
    process.env.NODE_ENV = 'test';
    const mockDb = {
        readDailyProgressData: async () => ({
            reports: [],
            contractors: [{ id: 'mangesh', name: 'Mangesh Sonwane', feeder: 'ANGARA' }]
        })
    };
    const res = await telegram.handleWebhookUpdate({
        message: {
            chat: { id: '881238938' },
            text: '/pending'
        }
    }, { db: mockDb });
    assert.equal(res.ok, true);
});

test('handleWebhookUpdate responds to /dashboard with executive KPI summary', async () => {
    process.env.NODE_ENV = 'test';
    const mockDb = {
        readDailyProgressData: async () => ({
            reports: [
                {
                    date: '2026-11-24',
                    contractorName: 'Mangesh Sonwane',
                    contractorId: 'mangesh',
                    manpower: { leader: 1, skilled: 4, unskilled: 5 }
                }
            ],
            contractors: [{ id: 'mangesh', name: 'Mangesh Sonwane', feeder: 'ANGARA' }]
        })
    };
    const res = await telegram.handleWebhookUpdate({
        message: {
            chat: { id: '881238938' },
            text: '/dashboard'
        }
    }, { db: mockDb });
    assert.equal(res.ok, true);
    assert.match(res.text, /EXECUTIVE BOT DASHBOARD/);
});

test('handleWebhookUpdate responds to /week with weekly contractor breakdown', async () => {
    process.env.NODE_ENV = 'test';
    const mockDb = {
        readDailyProgressData: async () => ({
            reports: [
                {
                    date: '2026-11-24',
                    contractorName: 'Mangesh Sonwane',
                    contractorId: 'mangesh',
                    manpower: { leader: 1, skilled: 4, unskilled: 5 }
                }
            ],
            contractors: [{ id: 'mangesh', name: 'Mangesh Sonwane', feeder: 'ANGARA' }]
        })
    };
    const res = await telegram.handleWebhookUpdate({
        message: {
            chat: { id: '881238938' },
            text: '/week'
        }
    }, { db: mockDb });
    assert.equal(res.ok, true);
    assert.match(res.text, /WEEKLY WORK PROGRESS REPORT/);
});

test('handleWebhookUpdate responds to /month with monthly contractor and material stats', async () => {
    process.env.NODE_ENV = 'test';
    const mockDb = {
        readDailyProgressData: async () => ({
            reports: [
                {
                    date: '2026-11-24',
                    contractorName: 'Mangesh Sonwane',
                    contractorId: 'mangesh',
                    manpower: { leader: 1, skilled: 4, unskilled: 5 },
                    quantities: { 'item1': 20 }
                }
            ],
            contractors: [{ id: 'mangesh', name: 'Mangesh Sonwane', feeder: 'ANGARA' }],
            items: [{ id: 'item1', name: 'RSJ Pole', unit: 'No' }]
        })
    };
    const res = await telegram.handleWebhookUpdate({
        message: {
            chat: { id: '881238938' },
            text: '/month'
        }
    }, { db: mockDb });
    assert.equal(res.ok, true);
    assert.match(res.text, /MONTHLY PROGRESS REPORT/);
});

test('handleWebhookUpdate responds to /contractor with contractor specific detail', async () => {
    process.env.NODE_ENV = 'test';
    const mockDb = {
        readDailyProgressData: async () => ({
            reports: [
                {
                    date: '2026-11-24',
                    contractorName: 'Mangesh Sonwane',
                    contractorId: 'mangesh',
                    manpower: { leader: 1, skilled: 4, unskilled: 5 },
                    remarks: 'Pole erection'
                }
            ],
            contractors: [{ id: 'mangesh', name: 'Mangesh Sonwane', feeder: 'ANGARA' }]
        })
    };
    const res = await telegram.handleWebhookUpdate({
        message: {
            chat: { id: '881238938' },
            text: '/contractor mangesh'
        }
    }, { db: mockDb });
    assert.equal(res.ok, true);
    assert.match(res.text, /CONTRACTOR REPORT: Mangesh Sonwane/);
});
