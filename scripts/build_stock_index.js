const ExcelJS = require('exceljs');
const fs = require('fs');

function normGroupKey(n) {
  if (!n) return '';
  return String(n)
    .toLowerCase()
    .replace(/^m\/s\.?\s*/i, '')
    .replace(/\(.*?\)/g, '') // remove parenthetical remarks like (VIKASH KUMAR DUBEY)
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

async function buildStockIndex() {
  console.log('1. Reading SAP Code sheet for contractor mappings...');
  const stream1 = fs.createReadStream('stock.xlsx');
  const reader1 = new ExcelJS.stream.xlsx.WorkbookReader(stream1, {});

  const groups = {}; // groupKey -> { key, displayName, vendorCode, wos: Set, dhs: Set, rawNorms: Set }
  const dhToGroupKey = {};
  const woToGroupKey = {};

  for await (const ws of reader1) {
    if (ws.name !== 'SAP Code') continue;
    let r = 0;
    for await (const row of ws) {
      r++;
      if (r < 4) continue;
      const v = row.values;
      if (!v) continue;
      const vendorCode = v[2] ? String(v[2]).trim() : '';
      const docHeaderRaw = v[3] ? String(v[3]).trim() : '';
      const name = v[4] ? String(v[4]).trim() : '';
      if (!name && !docHeaderRaw) continue;

      let key = normGroupKey(name);
      if (!key && docHeaderRaw) {
        const m = docHeaderRaw.match(/\b\d{8}\b/);
        if (m && woToGroupKey[m[0]]) key = woToGroupKey[m[0]];
      }
      if (!key) continue;

      if (!groups[key]) {
        groups[key] = {
          key,
          displayName: (name || docHeaderRaw).replace(/\n+/g, ' ').trim(),
          vendorCode: vendorCode || '',
          wos: new Set(),
          dhs: new Set(),
          rawNorms: new Set()
        };
      }

      if (name) {
        const cleanName = name.replace(/\n+/g, ' ').trim();
        groups[key].rawNorms.add(normRawKey(cleanName));
        groups[key].rawNorms.add(normGroupKey(cleanName));
        // Pick the cleanest displayName (prefer one without parentheses or cleaner capitalization)
        if (!groups[key].displayName || (groups[key].displayName.includes('(') && !cleanName.includes('('))) {
          groups[key].displayName = cleanName;
        }
      }

      if (vendorCode && !groups[key].vendorCode) {
        groups[key].vendorCode = vendorCode;
      }

      if (docHeaderRaw) {
        groups[key].dhs.add(docHeaderRaw);
        dhToGroupKey[docHeaderRaw] = key;
        const m = docHeaderRaw.match(/\b\d{8}\b/);
        if (m) {
          groups[key].wos.add(m[0]);
          woToGroupKey[m[0]] = key;
          dhToGroupKey[m[0]] = key;
        }
      }
    }
  }

  console.log(`Mapped ${Object.keys(dhToGroupKey).length} docHeaders and ${Object.keys(woToGroupKey).length} 8-digit WOs to ${Object.keys(groups).length} unique Contractor Groups.`);

  console.log('2. Streaming Sheet1 (152,860 rows) and summing into consolidated Contractor Groups...');
  const stream2 = fs.createReadStream('stock.xlsx');
  const reader2 = new ExcelJS.stream.xlsx.WorkbookReader(stream2, {});

  const groupMaterials = {};
  let txnCount = 0;
  let matchedTxns = 0;

  for await (const ws of reader2) {
    if (ws.name !== 'Sheet1') continue;
    let r = 0;
    for await (const row of ws) {
      r++;
      if (r === 1) continue;
      txnCount++;

      const dh = String(row.getCell(16).value || '').trim();
      const mat = String(row.getCell(9).value || '').trim();
      const desc = String(row.getCell(10).value || '').trim();
      const uom = String(row.getCell(11).value || '').trim();
      const qty = Number(row.getCell(12).value || 0);

      if (!dh || !mat) continue;

      let key = dhToGroupKey[dh];
      if (!key) {
        const m = dh.match(/\b\d{8}\b/);
        if (m && woToGroupKey[m[0]]) key = woToGroupKey[m[0]];
      }

      if (!key) continue;
      matchedTxns++;

      if (!groupMaterials[key]) groupMaterials[key] = {};
      if (!groupMaterials[key][mat]) {
        groupMaterials[key][mat] = {
          code: mat,
          desc: desc,
          uom: uom,
          grossIssue: 0,
          mrnReturn: 0,
          issuedQty: 0
        };
      }

      if (qty > 0) {
        groupMaterials[key][mat].grossIssue += qty;
      } else if (qty < 0) {
        groupMaterials[key][mat].mrnReturn += Math.abs(qty);
      }
      groupMaterials[key][mat].issuedQty += qty;
    }
  }

  console.log(`Matched and consolidated ${matchedTxns} contractor transactions out of ${txnCount} total rows.`);

  const outputData = {
    meta: {
      generatedAt: new Date().toISOString(),
      source: 'stock.xlsx',
      matchedTxns,
      contractorsWithIssues: Object.keys(groupMaterials).length,
      consolidatedWorkOrders: Object.keys(dhToGroupKey).length
    },
    byDocHeader: {},
    byContractorNorm: {}
  };

  for (const [key, mats] of Object.entries(groupMaterials)) {
    const g = groups[key] || {};
    const cleanMats = {};
    let totalGross = 0;
    let totalMrn = 0;
    let totalNet = 0;

    for (const [code, item] of Object.entries(mats)) {
      const gross = Math.round(item.grossIssue * 1000) / 1000;
      const mrn = Math.round(item.mrnReturn * 1000) / 1000;
      const net = Math.round(item.issuedQty * 1000) / 1000;

      if (gross !== 0 || mrn !== 0 || net !== 0) {
        cleanMats[code] = {
          code: item.code,
          desc: item.desc,
          uom: item.uom,
          grossIssue: gross,
          mrnReturn: mrn,
          netIssue: net,
          issuedQty: net
        };
        totalGross += gross;
        totalMrn += mrn;
        totalNet += net;
      }
    }

    if (Object.keys(cleanMats).length > 0) {
      const wosArray = Array.from(g.wos || []);
      const dhsArray = Array.from(g.dhs || []);
      const docHeaderDisplay = wosArray.length > 0 ? wosArray.join(', ') : (dhsArray[0] || '');

      const cRecord = {
        docHeader: docHeaderDisplay,
        allWorkOrders: wosArray,
        vendorCode: g.vendorCode || '',
        contractorName: g.displayName || '',
        materialCount: Object.keys(cleanMats).length,
        totalGrossIssue: Math.round(totalGross * 1000) / 1000,
        totalMrnReturn: Math.round(totalMrn * 1000) / 1000,
        totalNetIssue: Math.round(totalNet * 1000) / 1000,
        materials: cleanMats
      };

      // 1. Map normalized group key
      outputData.byContractorNorm[key] = cRecord;

      // 2. Map all raw name variations
      if (g.rawNorms) {
        g.rawNorms.forEach(rn => {
          outputData.byContractorNorm[rn] = cRecord;
        });
      }

      // 3. Map all 8-digit WOs
      wosArray.forEach(wo => {
        outputData.byDocHeader[wo] = cRecord;
      });

      // 4. Map all raw DocHeaders
      dhsArray.forEach(dh => {
        outputData.byDocHeader[dh] = cRecord;
      });
    }
  }

  // Also make sure every docHeader mapped in dhToGroupKey points to its consolidated record
  for (const [dh, key] of Object.entries(dhToGroupKey)) {
    if (outputData.byContractorNorm[key] && !outputData.byDocHeader[dh]) {
      outputData.byDocHeader[dh] = outputData.byContractorNorm[key];
    }
  }

  const jsContent = '/**\n * Auto-generated SAP Stock Material Issues Database from stock.xlsx\n * Features consolidated contractor aggregation (all work orders & aliases for same contractor summed together)\n * Generated: ' + new Date().toISOString() + '\n */\nwindow.ContractorSapStock = ' + JSON.stringify(outputData, null, 2) + ';\n';
  fs.writeFileSync('js/data/contractor-sap-issues.js', jsContent, 'utf8');

  const stats = fs.statSync('js/data/contractor-sap-issues.js');
  console.log(`Successfully generated consolidated js/data/contractor-sap-issues.js (${(stats.size / 1024).toFixed(1)} KB)`);
  console.log('Contractors with issues:', Object.keys(groupMaterials).length);
  console.log('Total docHeaders indexed:', Object.keys(outputData.byDocHeader).length);
  console.log('Total contractor norm keys indexed:', Object.keys(outputData.byContractorNorm).length);
}

buildStockIndex().catch(console.error);
