'use strict';
// Optional real-workbook check. Each parser runs in a separate process so memory is
// released between reads. Only hashes/counts are logged; source files are read-only.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
if (process.argv[2] === '--worker') {
    const xlsx = require(path.resolve(process.argv[3]));
    const workbook = xlsx.read(fs.readFileSync(process.argv[4]), { type: 'buffer', cellText: false, cellStyles: false, cellHTML: false, cellFormula: false, cellDates: false, cellNF: false });
    const sheets = workbook.SheetNames.map(name => {
        const sheet = workbook.Sheets[name], hash = crypto.createHash('sha256'); let cells = 0;
        for (const address of Object.keys(sheet).sort()) {
            if (address.startsWith('!')) continue;
            const cell = sheet[address];
            hash.update(JSON.stringify([address, cell.t, cell.v]) + '\n'); cells++;
        }
        hash.update(JSON.stringify({ ref: sheet['!ref'], merges: sheet['!merges'] || [] }));
        return { name, cells, ref: sheet['!ref'], sha256: hash.digest('hex') };
    });
    console.log(JSON.stringify({ version: xlsx.version, sheets }));
} else {
    const baseline = path.resolve('backups/pre-drive-first-20261118/xlsx-0.18.5.full.min.cjs'), current = require.resolve('xlsx');
    if (!fs.existsSync(baseline) || process.argv.length < 3) throw Error('Use node test/parser-compatibility.js WORKBOOK... with the preserved baseline parser');
    const results = [];
    for (const file of process.argv.slice(2)) {
        const read = library => JSON.parse(execFileSync(process.execPath, ['--max-old-space-size=4096', __filename, '--worker', library, path.resolve(file)], { encoding: 'utf8', maxBuffer: 1024 * 1024 }));
        const old = read(baseline), next = read(current);
        if (JSON.stringify(old.sheets) !== JSON.stringify(next.sheets)) throw Error('Workbook compatibility mismatch: ' + path.basename(file));
        const result = { file: path.basename(file), bytes: fs.statSync(file).size, oldVersion: old.version, newVersion: next.version, worksheets: next.sheets.length,
            cells: next.sheets.reduce((sum, sheet) => sum + sheet.cells, 0), exactValuesAndTypes: true, sheets: next.sheets };
        results.push(result); console.log(JSON.stringify({ ...result, sheets: undefined }));
    }
    fs.writeFileSync('backups/pre-drive-first-20261118/parser-compatibility.json', JSON.stringify(results, null, 2));
}
