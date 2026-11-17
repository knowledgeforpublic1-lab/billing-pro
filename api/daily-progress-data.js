// Older writes wrapped the dataset twice inside default_configs.data.
// Accept those records as well as the current direct dataset without losing reports.
function readDailyProgressData(record) {
    let data = record;
    for (let depth = 0; depth < 6 && data && typeof data === 'object'; depth++) {
        if (['contractors', 'reports', 'issues'].some(key => Array.isArray(data[key]))) {
            return { contractors: Array.isArray(data.contractors) ? data.contractors : [], reports: Array.isArray(data.reports) ? data.reports : [], issues: Array.isArray(data.issues) ? data.issues : [] };
        }
        data = data.data;
    }
    return { contractors: [], reports: [], issues: [] };
}
let ids;
function publicItemIds() {
    if (!ids) {
        const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
        const context = { window: {} };
        vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/data/default-daily-progress.js'), 'utf8'), context);
        ids = (context.window.DailyProgressSeed.items || []).map(item => String(item.id));
    }
    return ids;
}
function newerReport(previous, incoming) {
    if (!previous) return incoming;
    if (!incoming) return previous;
    const version = Number(incoming.version || 0) - Number(previous.version || 0);
    if (version) return version > 0 ? incoming : previous;
    const stamp = row => Date.parse(row.savedAt || row.updatedAt || '') || 0;
    return stamp(incoming) >= stamp(previous) ? incoming : previous;
}
function locationId(value) { return value === 'legacy' ? '' : String(value || ''); }
function reportKey(row) { const id = locationId(row.locationId); return row.contractorId + '|' + row.date + (id ? '|' + id : ''); }
function controlKey(cid, date, lid) {
    const hash = value => require('node:crypto').createHash('sha256').update(String(value)).digest('hex');
    return 'report_' + hash(cid) + '_' + date + (locationId(lid) ? '_' + hash(locationId(lid)) : '');
}
module.exports = { readDailyProgressData, publicItemIds, newerReport, locationId, reportKey, controlKey };
