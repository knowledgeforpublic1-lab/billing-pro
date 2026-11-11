const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

function normGroupKey(n) {
  if (!n) return '';
  return String(n)
    .toLowerCase()
    .replace(/^m\/s\.?\s*/i, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function extractAndMergeMasterData(stockFilePath = 'stock.xlsx') {
  if (!fs.existsSync(stockFilePath)) {
    throw new Error('File not found: ' + stockFilePath);
  }

  console.log('1. Reading current default-sap-materials.js...');
  const sapFileContent = fs.readFileSync('js/data/default-sap-materials.js', 'utf8');
  let currentSapList = [];
  try {
    const fn = new Function(sapFileContent + '; return defaultSapMaterialsMaster;');
    currentSapList = fn();
  } catch (e) {
    console.warn('Could not parse current default-sap-materials:', e.message);
  }

  const sapMap = new Map();
  // Preserve N/A as first item
  currentSapList.forEach(item => {
    if (item && item.code) sapMap.set(String(item.code).trim(), { ...item });
  });

  console.log('2. Reading current default-contractors.js...');
  const contFileContent = fs.readFileSync('js/data/default-contractors.js', 'utf8');
  let currentContList = [];
  try {
    const fn = new Function(contFileContent + '; return defaultContractorsList;');
    currentContList = fn();
  } catch (e) {
    console.warn('Could not parse current default-contractors:', e.message);
  }

  const contMap = new Map();
  currentContList.forEach(c => {
    if (!c) return;
    const key = normGroupKey(c.name || c.id);
    if (key) contMap.set(key, { ...c });
    if (c.workOrderNo) contMap.set(String(c.workOrderNo).trim(), { ...c });
  });

  console.log('3. Streaming stock.xlsx (SAP Code & Sheet1)...');
  const stream = fs.createReadStream(stockFilePath);
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(stream, {});

  let newMatsCount = 0;
  let newContsCount = 0;
  const newContractorsFound = [];

  for await (const ws of reader) {
    if (ws.name === 'SAP Code') {
      let r = 0;
      for await (const row of ws) {
        r++;
        if (r < 4) continue;
        const vendor = String(row.getCell(2).value || '').trim();
        const dh = String(row.getCell(3).value || '').trim();
        const name = String(row.getCell(4).value || '').replace(/\n+/g, ' ').trim();
        if (!name && !dh) continue;

        const key = normGroupKey(name);
        const woMatch = dh.match(/\b\d{8}\b/);
        const woNo = woMatch ? woMatch[0] : (dh || '');

        let existing = (key && contMap.get(key)) || (woNo && contMap.get(woNo));
        if (existing) {
          if (!existing.workOrderNo && woNo) existing.workOrderNo = woNo;
          if (name && (!existing.name || existing.name.length < name.length)) existing.name = name;
        } else if (key) {
          const newEntry = {
            id: key,
            name: name || ('Contractor ' + woNo),
            pan: '',
            gstin: '',
            bankAccountName: name || '',
            bankAccountNo: '',
            bankIfsc: '',
            bankName: '',
            workOrderNo: woNo,
            workOrderDate: '',
            divisionName: '',
            subDivName: '',
            feederName: ''
          };
          contMap.set(key, newEntry);
          if (woNo) contMap.set(woNo, newEntry);
          newContractorsFound.push(newEntry);
          newContsCount++;
        }
      }
    } else if (ws.name === 'Sheet1') {
      let r = 0;
      for await (const row of ws) {
        r++;
        if (r === 1) continue;
        const code = String(row.getCell(9).value || '').trim();
        const desc = String(row.getCell(10).value || '').replace(/\n+/g, ' ').trim();
        const uom = String(row.getCell(11).value || '').trim();

        if (code && !sapMap.has(code)) {
          sapMap.set(code, {
            code,
            desc: desc || code,
            uom: uom || 'No'
          });
          newMatsCount++;
        }
      }
    }
  }

  console.log(`4. Found ${newMatsCount} new SAP Materials. Total SAP Materials: ${sapMap.size}`);
  console.log(`   Found ${newContsCount} new Contractors. Total unique Contractor keys: ${contMap.size}`);

  // Build sorted SAP Materials Array
  const naItem = sapMap.get('N/A') || { code: 'N/A', desc: 'NOT APPLICABLE', uom: 'No' };
  sapMap.delete('N/A');
  const sortedSap = [naItem, ...Array.from(sapMap.values()).sort((a, b) => String(a.code).localeCompare(String(b.code)))];

  const sapOutContent = `/**
 * @file SAP Materials Master Data
 * @description Approved list of SAP material codes with descriptions, UOMs, and categories.
 * Auto-extracted and merged from SAP stock dump (stock.xlsx).
 * Total Master Materials: ${sortedSap.length}
 * 
 * @global {Array} defaultSapMaterialsMaster
 * @readonly
 * @since v1.0
 */

const defaultSapMaterialsMaster = ${JSON.stringify(sortedSap, null, 2)};

if (typeof window !== "undefined") {
    window.defaultSapMaterialsMaster = defaultSapMaterialsMaster;
}
if (typeof module !== "undefined" && module.exports) {
    module.exports = defaultSapMaterialsMaster;
}
`;
  fs.writeFileSync('js/data/default-sap-materials.js', sapOutContent, 'utf8');
  console.log(`✅ Updated js/data/default-sap-materials.js with ${sortedSap.length} materials`);

  // Build unique Contractors Array (deduplicated by key)
  const uniqueConts = [];
  const seenKeys = new Set();
  // Keep original currentContList order first, then append newly found contractors
  currentContList.forEach(c => {
    const k = normGroupKey(c.name || c.id);
    if (k && !seenKeys.has(k)) {
      seenKeys.add(k);
      const updated = contMap.get(k) || c;
      uniqueConts.push(updated);
    }
  });
  newContractorsFound.forEach(c => {
    const k = normGroupKey(c.name || c.id);
    if (k && !seenKeys.has(k)) {
      seenKeys.add(k);
      uniqueConts.push(c);
    }
  });

  const contOutContent = `/**
 * @file Default Contractors Database
 * @description Complete list of contractor firms with PAN, GSTIN, bank details, work orders.
 * Auto-extracted and merged from SAP stock dump (stock.xlsx).
 * Total Contractors: ${uniqueConts.length}
 * 
 * @global {Array} defaultContractorsList
 * @readonly
 * @since v1.0
 */

const defaultContractorsList = ${JSON.stringify(uniqueConts, null, 2)};

if (typeof window !== "undefined") {
    window.defaultContractorsList = defaultContractorsList;
}
if (typeof module !== "undefined" && module.exports) {
    module.exports = defaultContractorsList;
}
`;
  fs.writeFileSync('js/data/default-contractors.js', contOutContent, 'utf8');
  console.log(`✅ Updated js/data/default-contractors.js with ${uniqueConts.length} contractors`);

  return {
    materialsCount: sortedSap.length,
    contractorsCount: uniqueConts.length,
    newMatsCount,
    newContsCount
  };
}

if (require.main === module) {
  extractAndMergeMasterData()
    .then(r => console.log('Master extraction complete:', r))
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}

module.exports = { extractAndMergeMasterData };
