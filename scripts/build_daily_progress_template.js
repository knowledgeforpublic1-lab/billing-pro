// Produces a reusable template with no contractor names, dates or historical quantities.
const fs = require('node:fs');
const vm = require('node:vm');
const ExcelJS = require('exceljs');
async function main() {
    const sandbox = { window: {} };
    vm.runInNewContext(fs.readFileSync('js/data/default-daily-progress.js', 'utf8'), sandbox);
    const items = sandbox.window.DailyProgressSeed.items;
    const book = new ExcelJS.Workbook();
    if (fs.existsSync('public/template.xlsx')) await book.xlsx.readFile('public/template.xlsx');
    const sheet = book.worksheets[0] || book.addWorksheet('Daily Progress');
    for (const other of [...book.worksheets].slice(1)) book.removeWorksheet(other.id);
    sheet.eachRow({ includeEmpty: false }, row => row.eachCell({ includeEmpty: true }, cell => { cell.value = null; }));
    sheet.getCell('A1').value = 'DAILY PROGRESS REGISTER';
    ['PROJECT NAME:', 'NAME OF FEEDER:', 'NAME OF DEPT. LABOUR TEAM:', 'NAME OF ENGINEER/SUPERVISOR:'].forEach((text, i) => { sheet.getCell('A' + (i + 2)).value = text; });
    sheet.getCell('D7').value = 'Date';
    ['Team Leader', 'Skilled Labour', 'Unskilled Labour', 'Tractor Charges', 'Augur Machine Rate', 'Room Charges'].forEach((name, i) => {
        sheet.getCell('C' + (i + 8)).value = name;
        sheet.getCell('D' + (i + 8)).value = i < 3 ? 'Nos' : 'Per Day';
    });
    ['Sr. No.', 'Item Code', 'Item Description', 'Unit'].forEach((text, i) => { sheet.getCell(14, i + 1).value = text; });
    sheet.getCell('AI14').value = 'Total';
    items.forEach((item, i) => { sheet.getCell('A' + item.row).value = i + 1; sheet.getCell('B' + item.row).value = item.code; sheet.getCell('C' + item.row).value = item.name; sheet.getCell('D' + item.row).value = item.unit; });
    book.creator = 'Billing Pro'; book.lastModifiedBy = 'Billing Pro'; book.title = 'Blank daily progress template'; book.subject = ''; book.description = '';
    await book.xlsx.writeFile('public/daily-progress-template.xlsx');
    console.log('Created clean daily progress template');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
