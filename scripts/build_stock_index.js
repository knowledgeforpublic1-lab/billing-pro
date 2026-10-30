const ExcelJS = require('exceljs');
const fs = require('fs');

async function buildStockIndex() {
  console.log('1. Reading SAP Code sheet for contractor mappings...');
  const stream1 = fs.createReadStream('stock.xlsx');
  const reader1 = new ExcelJS.stream.xlsx.WorkbookReader(stream1, {});

  const nameToPrimaryWo = {};
  const primaryWoInfo = {}; // primaryWo -> { name, vendorCode, wo }
  const docHeaderToPrimaryWo = {};

    // Pass 1: find all direct 8-digit WOs
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

              const m = docHeaderRaw.match(/\b\d{8}\b/);
              if (m && name) {
                const pureWo = m[0];
                const norm = name.toLowerCase().replace(/^m\/s\.?\s*/i, '').replace(/[^a-z0-9]/g, '');
                if (!nameToPrimaryWo[norm]) nameToPrimaryWo[norm] = pureWo;
                if (!primaryWoInfo[pureWo]) primaryWoInfo[pureWo] = { name, vendorCode, wo: pureWo };
                docHeaderToPrimaryWo[docHeaderRaw] = pureWo;
                docHeaderToPrimaryWo[pureWo] = pureWo;
              }
            }
          }

          // Pass 2: map non-digit alias headers to primary WO via contractor name
          const stream1b = fs.createReadStream('stock.xlsx');
          const reader1b = new ExcelJS.stream.xlsx.WorkbookReader(stream1b, {});
          for await (const ws of reader1b) {
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
              if (!docHeaderRaw) continue;

              const m = docHeaderRaw.match(/\b\d{8}\b/);
              if (m) {
                docHeaderToPrimaryWo[docHeaderRaw] = m[0];
                docHeaderToPrimaryWo[m[0]] = m[0];
              } else if (name) {
                const norm = name.toLowerCase().replace(/^m\/s\.?\s*/i, '').replace(/[^a-z0-9]/g, '');
                if (nameToPrimaryWo[norm]) {
                  docHeaderToPrimaryWo[docHeaderRaw] = nameToPrimaryWo[norm];
                }
              }
            }
          }

          console.log(`Mapped ${Object.keys(docHeaderToPrimaryWo).length} docHeaders to ${Object.keys(primaryWoInfo).length} unique Primary Work Orders.`);

          console.log('2. Streaming Sheet1 (152,860 rows) and summing into consolidated Primary Work Orders...');
          const stream2 = fs.createReadStream('stock.xlsx');
          const reader2 = new ExcelJS.stream.xlsx.WorkbookReader(stream2, {});

          const woMaterials = {}; // primaryWo -> { [matCode]: { code, desc, uom, grossIssue, mrnReturn, netIssue } }
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

                  // Resolve to primary 8-digit work order
                  let primaryWo = docHeaderToPrimaryWo[dh];
                  if (!primaryWo) {
                    const m = dh.match(/\b\d{8}\b/);
                    if (m && primaryWoInfo[m[0]]) primaryWo = m[0];
                  }

                  if (!primaryWo) continue;
                  matchedTxns++;

                      if(!woMaterials[primaryWo]) woMaterials[primaryWo] = {};
                      if(!woMaterials[primaryWo][mat]) {
                        woMaterials[primaryWo][mat] = {
                          code: mat,
                          desc: desc,
                          uom: uom,
                          grossIssue: 0,
                          mrnReturn: 0,
                          issuedQty: 0
                        };
                      }
      
      if(qty > 0) {
                      woMaterials[primaryWo][mat].grossIssue += qty;
                    } else if (qty < 0) {
                      woMaterials[primaryWo][mat].mrnReturn += Math.abs(qty);
                    }
                    woMaterials[primaryWo][mat].issuedQty += qty;
                  }
                }

                console.log(`Matched and consolidated ${matchedTxns} contractor transactions out of ${txnCount} total rows.`);

                const outputData = {
                  meta: {
                    generatedAt: new Date().toISOString(),
                    source: 'stock.xlsx',
                    matchedTxns,
      contractorsWithIssues: Object.keys(woMaterials).length,
                    consolidatedWorkOrders: Object.keys(woMaterials).length
                  },
                  byDocHeader: {},
                  byContractorNorm: {}
                };

                  for (const [wo, mats] of Object.entries(woMaterials)) {
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
                        const info = primaryWoInfo[wo] || {};
                        const cRecord = {
                          docHeader: wo,
                          vendorCode: info.vendorCode || '',
                          contractorName: info.name || '',
                          materialCount: Object.keys(cleanMats).length,
                          totalGrossIssue: Math.round(totalGross * 1000) / 1000,
                          totalMrnReturn: Math.round(totalMrn * 1000) / 1000,
                          totalNetIssue: Math.round(totalNet * 1000) / 1000,
                          materials: cleanMats
                        };

                        outputData.byDocHeader[wo] = cRecord;

                        if (info.name) {
                          const norm = info.name.toLowerCase().replace(/^m\/s\.?\s*/i, '').replace(/[^a-z0-9]/g, '');
                          outputData.byContractorNorm[norm] = cRecord;
                        }
                      }
                    }

                    // Also link every alias docHeader back to the consolidated primary WO record
                    for (const [alias, primaryWo] of Object.entries(docHeaderToPrimaryWo)) {
                      if (alias !== primaryWo && outputData.byDocHeader[primaryWo]) {
                        outputData.byDocHeader[alias] = outputData.byDocHeader[primaryWo];
                      }
                    }

                    const jsContent = '/**\n * Auto-generated SAP Stock Material Issues Database from stock.xlsx\n * Features consolidated primary Work Order aggregation (all aliases & sub-codes summed together)\n * Generated: ' + new Date().toISOString() + '\n */\nwindow.ContractorSapStock = ' + JSON.stringify(outputData, null, 2) + ';\n';
                    fs.writeFileSync('js/data/contractor-sap-issues.js', jsContent, 'utf8');

                    const stats = fs.statSync('js/data/contractor-sap-issues.js');
                    console.log(`Successfully generated consolidated js/data/contractor-sap-issues.js (${(stats.size / 1024).toFixed(1)} KB)`);
                    console.log('Consolidated Work Orders:', Object.keys(outputData.byDocHeader).length);
                    console.log('Unique Contractor Names:', Object.keys(outputData.byContractorNorm).length);
                  }

                  buildStockIndex().catch(console.error);
