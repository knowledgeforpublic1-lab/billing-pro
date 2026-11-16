const ExcelJS = require('exceljs');
const fs = require('fs');

function normContractorName(n) {
  if (!n) return '';
  return String(n)
    .toLowerCase()
    .replace(/^m\/s\.?\s*/i, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function normRawKey(n) {
  if (!n) return '';
  return String(n)
    .toLowerCase()
    .replace(/^m\/s\.?\s*/i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function generateMapping() {
  const stream = fs.createReadStream('stock.xlsx');
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(stream, {});

  const groups = {};
  const byDocHeader = {};
  const dhToGroupKey = {};
  const woToGroupKey = {};

  for await (const ws of reader) {
    if (ws.name === 'SAP Code') {
      let r = 0;
      for await (const row of ws) {
        r++;
        if (r < 4) continue;
        const v = row.values;
        if (!v) continue;
        const vendor = v[2] ? String(v[2]).trim() : '';
        const dh = v[3] ? String(v[3]).trim() : '';
        const name = v[4] ? String(v[4]).replace(/\n+/g, ' ').trim() : '';
        if (!name && !dh) continue;

        let key = normContractorName(name);
        if (!key && dh) {
          const m = dh.match(/\b\d{8}\b/);
          if (m && woToGroupKey[m[0]]) key = woToGroupKey[m[0]];
        }
        if (!key) continue;

        if (!groups[key]) {
          groups[key] = {
            key,
            displayName: (name || dh).replace(/\n+/g, ' ').trim(),
            vendorCode: vendor,
            wos: [],
            dhs: [],
            rawNorms: []
          };
        }

        if (name) {
          const cleanName = name.replace(/\n+/g, ' ').trim();
          if (!groups[key].rawNorms.includes(normRawKey(cleanName))) groups[key].rawNorms.push(normRawKey(cleanName));
          if (!groups[key].rawNorms.includes(normContractorName(cleanName))) groups[key].rawNorms.push(normContractorName(cleanName));
          if (!groups[key].displayName || (groups[key].displayName.includes('(') && !cleanName.includes('('))) {
            groups[key].displayName = cleanName;
          }
        }

        if (vendor && !groups[key].vendorCode) {
          groups[key].vendorCode = vendor;
        }

        if (dh) {
          if (!groups[key].dhs.includes(dh)) groups[key].dhs.push(dh);
          dhToGroupKey[dh] = key;
          const m = dh.match(/^\s*(\d{8})\s*$/);
          if (m) {
            if (!groups[key].wos.includes(m[1])) groups[key].wos.push(m[1]);
            woToGroupKey[m[1]] = key;
            dhToGroupKey[m[1]] = key;
          }
          byDocHeader[dh] = {
            docHeader: dh,
            vendorCode: vendor,
            contractorName: name || groups[key].displayName,
            groupKey: key
          };
        }
      }
    }
  }

  console.log('Contractor Groups count:', Object.keys(groups).length);
  console.log('byDocHeader count:', Object.keys(byDocHeader).length);

  const fileContent = `/**
 * @file Master SAP Code Contractor Mapping
 * @description Permanent master extracted from "SAP Code" sheet of stock.xlsx.
 * Maps all 211 Document Headers (Work Orders) and Vendor Codes to Contractor Groups.
 * This eliminates the need to provide or upload the "SAP Code" sheet with future stock dumps.
 * Users can upload raw stock transaction sheets (Sheet1) directly!
 */

(function(global) {
    global.MasterSapCodeMapping = ${JSON.stringify({
      meta: {
        source: 'stock.xlsx (SAP Code worksheet)',
        extractedAt: new Date().toISOString(),
        totalWorkOrders: Object.keys(byDocHeader).length,
        totalContractorGroups: Object.keys(groups).length
      },
      byDocHeader,
      dhToGroupKey,
      woToGroupKey,
      groups
    }, null, 2)};
})(typeof window !== "undefined" ? window : global);
`;

  fs.writeFileSync('js/data/default-sap-contractor-mapping.js', fileContent, 'utf8');
  console.log('Written to js/data/default-sap-contractor-mapping.js, size:', (fs.statSync('js/data/default-sap-contractor-mapping.js').size / 1024).toFixed(1) + ' KB');
}

generateMapping().catch(err => {
  console.error('Generation failed:', err);
  process.exit(1);
});
