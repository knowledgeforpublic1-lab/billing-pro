const test = require('node:test');
const assert = require('node:assert/strict');
const defaultFeeders = require('../js/data/default-feeders');

test('logged-out share pages can load fixed locations while contractor seed files remain protected', async () => {
    const fixture = require('./helpers/daily-entry-fixture')();
    const server = fixture.app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    try {
        const locations = await fetch(origin + '/js/data/default-feeders.js');
        assert.equal(locations.status, 200);
        assert.match(await locations.text(), /11KV Deulgaon/);
        assert.equal((await fetch(origin + '/js/data/default-contractors.js')).status, 401);
        assert.equal((await fetch(origin + '/js/data/contractor-sap-issues.js')).status, 401);
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('all hierarchy values and row order match the supplied location workbook', () => {
    // Independent control from Sheet1!B3:E107 in the user's location.xlsx.
    const rows = defaultFeeders.list.map(row => [row.division, row.subDivision, row.substation, row.feeder]);
    assert.equal(require('node:crypto').createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
        '19709297db40686efe7d76c132debbf01464602939ed902f43f617dde97d1c87');
    const context = { window: {} };
    require('node:vm').runInNewContext(require('node:fs').readFileSync('js/data/default-feeders.js', 'utf8'), context);
    assert.deepEqual(JSON.parse(JSON.stringify(context.window.DefaultFeeders.list)), defaultFeeders.list, 'Browser and server use identical location IDs');
});

test('defaultFeeders loads properly with 105 official feeders and correct structure', () => {
    assert.equal(defaultFeeders.list.length, 105, 'Must contain all 105 feeders');
    
    // Check all IDs match loc_[a-f0-9]{24}
    const idPattern = /^loc_[a-f0-9]{24}$/;
    defaultFeeders.list.forEach((f, i) => {
        assert.ok(idPattern.test(f.id), `Feeder ${i} (${f.name}) has invalid ID: ${f.id}`);
        assert.ok(f.name, `Feeder ${i} must have name`);
        assert.ok(f.division, `Feeder ${i} must have division`);
        assert.ok(f.subDivision, `Feeder ${i} must have subDivision`);
        assert.ok(f.substation, `Feeder ${i} must have substation`);
        assert.ok(f.feeder, `Feeder ${i} must have feeder`);
    });

    // Check all IDs are unique
    const uniqueIds = new Set(defaultFeeders.list.map(f => f.id));
    assert.equal(uniqueIds.size, 105, 'All feeder IDs must be unique');

    // Check divisions
    assert.deepEqual(defaultFeeders.divisions, ['Gadchiroli', 'Bramhapuri', 'Allapalli']);

    // Check query functions
    const gadchiroliSubs = defaultFeeders.getSubDivisions('Gadchiroli');
    assert.ok(gadchiroliSubs.includes('Armori'));
    assert.ok(gadchiroliSubs.includes('Kurkheda'));
    assert.ok(gadchiroliSubs.includes('Gadchiroli'));

    const armoriSubstations = defaultFeeders.getSubstations('Gadchiroli', 'Armori');
    assert.ok(armoriSubstations.some(s => s.includes('ARMORI')));

    const deulgaonFeeders = defaultFeeders.getFeeders('Gadchiroli', 'Armori', '33/11 KV ARMORI S/STN');
    assert.ok(deulgaonFeeders.some(f => f.feeder.includes('Deulgaon')));
});
