const ExcelJS = require('exceljs');
const fs = require('fs');

async function buildStockIndex() {
  console.log('1. Reading SAP Code sheet for contractor mappings...');
  const stream1 = fs.createReadStream('stock.xlsx');
  const reader1 = new ExcelJS.stream.xlsx.WorkbookReader(stream1, {});
  
  const contractorMap = {}; // docHeader -> { vendorCode, contractorName, mrn, issue }
  const validDocHeaders = new Set();
  
  for await (const worksheetReader of reader1) {
    if (worksheetReader.name !== 'SAP Code') continue;
    let r = 0;
    for await (const row of worksheetReader) {
      r++;
      if (r < 4) continue;
      const v = row.values;
      if (!v) continue;
      const vendorCode = v[2] ? String(v[2]).trim() : '';
      const docHeaderRaw = v[3] ? String(v[3]).trim() : '';
      const contractorName = v[4] ? String(v[4]).trim() : '';
      const mrn = v[7] ? String(v[7]).trim() : '';
      const issue = v[8] ? String(v[8]).trim() : '';
      
      if (docHeaderRaw) {
        contractorMap[docHeaderRaw] = { vendorCode, contractorName, mrn, issue };
        validDocHeaders.add(docHeaderRaw);
        const m = docHeaderRaw.match(/\b\d{8}\b/);
        if (m) {
          contractorMap[m[0]] = { vendorCode, contractorName, mrn, issue };
          validDocHeaders.add(m[0]);
        }
      }
    }
  }
  
  console.log('Total valid contractor doc headers:', validDocHeaders.size);

  console.log('2. Streaming Sheet1 (152,860 rows) and calculating ISSUE, MRN, and NET ISSUE...');
  const stream2 = fs.createReadStream('stock.xlsx');
  const reader2 = new ExcelJS.stream.xlsx.WorkbookReader(stream2, {});
  
  const docHeaderMaterials = {}; // docHeader -> { [matCode]: { code, desc, uom, grossIssue, mrnReturn, issuedQty } }
  let txnCount = 0;
  let matchedTxns = 0;
  
  for await (const worksheetReader of reader2) {
    if (worksheetReader.name !== 'Sheet1') continue;
    let r = 0;
    for await (const row of worksheetReader) {
      r++;
      if (r === 1) continue;
      txnCount++;
      
      const docHeader = String(row.getCell(16).value || '').trim();
      const mat = String(row.getCell(9).value || '').trim();
      const desc = String(row.getCell(10).value || '').trim();
      const uom = String(row.getCell(11).value || '').trim();
      const qty = Number(row.getCell(12).value || 0);
      
      if (!docHeader || !mat) continue;
      
      const m = docHeader.match(/\b\d{8}\b/);
      const matchedKey = (m && validDocHeaders.has(m[0])) ? m[0] : (validDocHeaders.has(docHeader) ? docHeader : null);
      
      if (!matchedKey) continue;
      matchedTxns++;
      
      if (!docHeaderMaterials[matchedKey]) docHeaderMaterials[matchedKey] = {};
      if (!docHeaderMaterials[matchedKey][mat]) {
        docHeaderMaterials[matchedKey][mat] = {
          code: mat,
          desc: desc,
          uom: uom,
          grossIssue: 0,
          mrnReturn: 0,
          issuedQty: 0
        };
      }
      
      if (qty > 0) {
        docHeaderMaterials[matchedKey][mat].grossIssue += qty;
      } else if (qty < 0) {
        docHeaderMaterials[matchedKey][mat].mrnReturn += Math.abs(qty);
      }
      docHeaderMaterials[matchedKey][mat].issuedQty += qty;
    }
  }
  
  console.log(`Matched ${matchedTxns} contractor transactions out of ${txnCount} total rows.`);

  const outputData = {
    meta: {
      generatedAt: new Date().toISOString(),
      source: 'stock.xlsx',
      matchedTxns,
      contractorsWithIssues: Object.keys(docHeaderMaterials).length
    },
    byDocHeader: {},
    byContractorNorm: {}
  };

  for (const [dh, mats] of Object.entries(docHeaderMaterials)) {
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
      const info = contractorMap[dh] || {};
      outputData.byDocHeader[dh] = {
        docHeader: dh,
        vendorCode: info.vendorCode || '',
        contractorName: info.contractorName || '',
        materialCount: Object.keys(cleanMats).length,
        totalGrossIssue: Math.round(totalGross * 1000) / 1000,
        totalMrnReturn: Math.round(totalMrn * 1000) / 1000,
        totalNetIssue: Math.round(totalNet * 1000) / 1000,
        materials: cleanMats
      };
      
      if (info.contractorName) {
        const norm = info.contractorName.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!outputData.byContractorNorm[norm]) {
          outputData.byContractorNorm[norm] = {
            contractorName: info.contractorName,
            docHeaders: [],
            materials: {},
            totalGrossIssue: 0,
            totalMrnReturn: 0,
            totalNetIssue: 0
          };
        }
        if (!outputData.byContractorNorm[norm].docHeaders.includes(dh)) {
          outputData.byContractorNorm[norm].docHeaders.push(dh);
        }
        for (const [code, mItem] of Object.entries(cleanMats)) {
          if (!outputData.byContractorNorm[norm].materials[code]) {
            outputData.byContractorNorm[norm].materials[code] = Object.assign({}, mItem);
          } else {
            const ex = outputData.byContractorNorm[norm].materials[code];
            ex.grossIssue = Math.round((ex.grossIssue + mItem.grossIssue) * 1000) / 1000;
            ex.mrnReturn = Math.round((ex.mrnReturn + mItem.mrnReturn) * 1000) / 1000;
            ex.netIssue = Math.round((ex.netIssue + mItem.netIssue) * 1000) / 1000;
            ex.issuedQty = ex.netIssue;
          }
        }
        outputData.byContractorNorm[norm].totalGrossIssue = Math.round((outputData.byContractorNorm[norm].totalGrossIssue + totalGross) * 1000) / 1000;
        outputData.byContractorNorm[norm].totalMrnReturn = Math.round((outputData.byContractorNorm[norm].totalMrnReturn + totalMrn) * 1000) / 1000;
        outputData.byContractorNorm[norm].totalNetIssue = Math.round((outputData.byContractorNorm[norm].totalNetIssue + totalNet) * 1000) / 1000;
      }
    }
  }

  const jsContent = '/**\n * Auto-generated SAP Stock Material Issues Database from stock.xlsx\n * Features ISSUE, MRN, and NET ISSUE breakdown per material & contractor\n * Generated: ' + new Date().toISOString() + '\n */\nwindow.ContractorSapStock = ' + JSON.stringify(outputData, null, 2) + ';\n';
  fs.writeFileSync('js/data/contractor-sap-issues.js', jsContent, 'utf8');
  
  const stats = fs.statSync('js/data/contractor-sap-issues.js');
  console.log(`Successfully generated js/data/contractor-sap-issues.js (${(stats.size / 1024).toFixed(1)} KB)`);
  console.log('Contractors with issues in index:', Object.keys(outputData.byContractorNorm).length);
  console.log('DocHeaders with issues in index:', Object.keys(outputData.byDocHeader).length);
}

buildStockIndex().catch(console.error);
