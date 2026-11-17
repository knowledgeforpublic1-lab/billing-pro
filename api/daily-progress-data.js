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
module.exports = { readDailyProgressData };
