/**
 * @file Excel Export Module
 * @description Generates styled Excel workbooks for tax invoices, activity details,
 * master abstracts, material mapping, and reconciliation sheets using ExcelJS.
 *
 * @module ExportModule
 * @since v2.0
 */

window.ExportModule = {
                async exportMaterialMappingExcel() {
                    const workbook = new ExcelJS.Workbook();
                    workbook.creator = 'Billing Pro Studio';
                    workbook.created = new Date();
                    const ws = workbook.addWorksheet('SAP Material Mapping Master', {
                        views: [{ showGridLines: true }],
                        pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, verticalCentered: true, margins: { left: 0.2, right: 0.2, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } }
                    });
                    const titleFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF222222' } };
                    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
                    const zebraFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
                    const thinBorder = {
                        top: { style: 'thin', color: { argb: 'FF888888' } },
                        left: { style: 'thin', color: { argb: 'FF888888' } },
                        bottom: { style: 'thin', color: { argb: 'FF888888' } },
                        right: { style: 'thin', color: { argb: 'FF888888' } }
                    };
                    ws.mergeCells('A1:I1');
                    const r1 = ws.getCell('A1');
                    r1.value = 'LK ELECTRICALS - SAP ERP MATERIAL CODE & WORK ORDER ACTIVITY MAPPING MASTER';
                    r1.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
                    r1.fill = titleFill;
                    r1.alignment = { horizontal: 'center', vertical: 'middle' };
                    ws.getRow(1).height = 30;
                    const row2 = ws.getRow(2);
                    row2.values = ['Act Code', 'Sr.No.', 'Work Order Description of Material', 'Act Unit', 'Rate (Rs)', 'SAP Item Code (Material)', 'SAP Material Description', 'SAP Unit', 'Document Header Text (Ref/WO)'];
                    row2.height = 26;
                    row2.eachCell(cell => {
                        cell.fill = headerFill;
                        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                        cell.border = thinBorder;
                    });
                    let rowIdx = 3;
                    const items = this.filteredMappingMasterList;
                    items.forEach((rowObj, idx) => {
                        const m = rowObj.item;
                        const sList = (m.sapItems && m.sapItems.length > 0) ? m.sapItems : [{ code: m.itemCode || '', desc: m.sapDescription || '', uom: m.sapUom || m.unit, docHeader: m.docHeader || '0031006347' }];
                        sList.forEach((s, sIdx) => {
                            const row = ws.getRow(rowIdx);
                            row.getCell(1).value = (sIdx === 0) ? rowObj.actKey : '';
                            row.getCell(2).value = (sIdx === 0) ? m.no : '';
                            row.getCell(3).value = (sIdx === 0) ? m.desc : `↳ Component ${sIdx+1}`;
                            row.getCell(4).value = (sIdx === 0) ? m.unit : '';
                            row.getCell(5).value = (sIdx === 0) ? m.rate : '';
                            row.getCell(6).value = s.code;
                            row.getCell(7).value = s.desc;
                            row.getCell(8).value = s.uom;
                            row.getCell(9).value = s.docHeader;
                            row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
                            row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
                            row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
                            row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
                            row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
                            if (sIdx === 0) row.getCell(5).numFmt = '#,##0.00';
                            row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
                            row.getCell(7).alignment = { horizontal: 'left', vertical: 'middle' };
                            row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
                            row.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
                            row.eachCell(c => {
                                c.border = thinBorder;
                                if (idx % 2 === 1) c.fill = zebraFill;
                            });
                            row.height = 20;
                            rowIdx++;
                        });
                    });
                    ws.columns = [
                        { width: 12 }, { width: 8 }, { width: 50 }, { width: 10 },
                        { width: 12 }, { width: 18 }, { width: 45 }, { width: 12 }, { width: 22 }
                    ];
                    const buffer = await workbook.xlsx.writeBuffer();
                    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'LK_Electricals_SAP_Material_Mapping_Master.xlsx';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    this.showToast('SAP Material Mapping Master Excel downloaded! 🎉', '📗');
                },
                async exportReconciliationExcel() {
                    this.showToast('Exporting Pivot Reconciliation Sheet...', '⏳');
                    const workbook = new ExcelJS.Workbook();
                    workbook.creator = 'Billing Pro Studio';
                    workbook.created = new Date();
                    const ws = workbook.addWorksheet('Reconciliation Sheet', {
                        views: [{ showGridLines: true }],
                        pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, verticalCentered: true, margins: { left: 0.2, right: 0.2, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } }
                    });
                    const titleFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF222222' } };
                    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
                    const zebraFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
                    const thinBorder = {
                        top: { style: 'thin', color: { argb: 'FF888888' } },
                        left: { style: 'thin', color: { argb: 'FF888888' } },
                        bottom: { style: 'thin', color: { argb: 'FF888888' } },
                        right: { style: 'thin', color: { argb: 'FF888888' } }
                    };
                    
                    const pData = this.pivotReconciliationData;
                    // ↩️ Reverse ON ho to screen wali sheet export karo (invoice-activity × location columns, filtered rows)
                    const revOn = !!this.reverseEntry;
                    const rcols = revOn ? this.reverseReconColumns : [];
                    const expRows = revOn ? this.reconRows : pData.rows;
                    const expHeaders = revOn
                        ? ['SR NO.', 'Row Labels', 'ITEMS DESCRIPTION', 'UNIT', 'ISSUE'].concat(rcols.map(c => c.actKey + ' / ' + ((this.getActLocations(c.actKey)[c.locIdx] || {}).name || ('Loc ' + (c.locIdx + 1)))))
                        : ['SR NO.', 'Row Labels', 'ITEMS DESCRIPTION', 'UNIT', 'ISSUE'].concat(pData.columns);
                    const totalCols = 5 + (revOn ? rcols.length : pData.columns.length);
                    
                    // Title Row
                    ws.mergeCells(1, 1, 1, totalCols);
                    const r1 = ws.getCell(1, 1);
                    r1.value = `${this.getContractorDisplayName().toUpperCase()} MATERIAL RECONCILIATION SHEET`;
                    r1.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
                    r1.fill = titleFill;
                    r1.alignment = { horizontal: 'center', vertical: 'middle' };
                    ws.getRow(1).height = 30;
                    
                    // Header Row
                    const row2 = ws.getRow(2);
                    const headers = expHeaders;
                    row2.values = headers;
                    row2.height = 26;
                    row2.eachCell((cell, colNum) => {
                        cell.fill = headerFill;
                        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                        cell.border = thinBorder;
                    });
                    
                    // Data Rows
                    let rowIdx = 3;
                    expRows.forEach((rowObj, idx) => {
                        const row = ws.getRow(rowIdx);
                        row.getCell(1).value = idx + 1;
                        row.getCell(2).value = rowObj.code;
                        row.getCell(3).value = rowObj.desc;
                        row.getCell(4).value = rowObj.uom;
                        row.getCell(5).value = rowObj.totalQty || '';

                        if (revOn) {
                            rcols.forEach((rc, cIdx) => {
                                row.getCell(6 + cIdx).value = this.reconCellLoc(rowObj.code, rc) || '';
                            });
                        } else {
                            pData.columns.forEach((col, cIdx) => {
                                row.getCell(6 + cIdx).value = rowObj.activities[col] || '';
                            });
                        }
                        
                        row.eachCell((c, colNum) => {
                            c.border = thinBorder;
                            if (idx % 2 === 1) c.fill = zebraFill;
                            
                            c.alignment = { vertical: 'middle' };
                            if (colNum === 3) {
                                c.alignment.horizontal = 'left';
                                c.alignment.wrapText = true;
                            } else if (colNum === 5) {
                                c.alignment.horizontal = 'right';
                                c.font = { bold: true };
                            } else {
                                c.alignment.horizontal = 'center';
                            }
                        });
                        row.height = 20;
                        rowIdx++;
                    });
                    
                    // Column Widths
                    const cols = [
                        { width: 8 }, { width: 12 }, { width: 45 }, { width: 8 }, { width: 10 }
                    ];
                    (revOn ? rcols : pData.columns).forEach(() => cols.push({ width: 14 }));
                    ws.columns = cols;
                    
                    const buffer = await workbook.xlsx.writeBuffer();
                    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'LK_Electricals_Pivot_Reconciliation_Sheet.xlsx';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    this.showToast(revOn ? 'Reverse Reconciliation Excel downloaded! 🎉' : 'Pivot Reconciliation Excel downloaded! 🎉', '📊');
                },
                addStyledTaxInvoiceToWorkbook(workbook) {
                    const ws = workbook.addWorksheet('Tax Invoice', {
                        views: [{ showGridLines: true }],
                        pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, verticalCentered: true, margins: { left: 0.2, right: 0.2, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } }
                    });

                    const borderThin = {
                        top: { style: 'thin', color: { argb: 'FF000000' } },
                        left: { style: 'thin', color: { argb: 'FF000000' } },
                        bottom: { style: 'thin', color: { argb: 'FF000000' } },
                        right: { style: 'thin', color: { argb: 'FF000000' } }
                    };

                    const titleFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF222222' } };
                    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
                    const metaLabelFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
                    const zebraFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
                    const totalFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD0D0D0' } };

                    // Row 1: Title
                    ws.mergeCells('A1:E1');
                    const r1 = ws.getCell('A1');
                    r1.value = 'Tax Invoice';
                    r1.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
                    r1.fill = titleFill;
                    r1.alignment = { horizontal: 'center', vertical: 'middle' };
                    ws.getRow(1).height = 28;

                    // Row 2: Project Name
                    ws.mergeCells('A2:E2');
                    const r2 = ws.getCell('A2');
                    r2.value = `Project Name : ${this.projectMeta.projectName}`.toUpperCase();
                    r2.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
                    r2.fill = titleFill;
                    r2.alignment = { horizontal: 'center', vertical: 'middle' };
                    ws.getRow(2).height = 22;

                    // Row 3,4,5: Client Details
                    ws.mergeCells('A3:E3');
                    ws.getCell('A3').value = `To :- ${this.invoiceData.clientName}`;
                    ws.getCell('A3').font = { name: 'Arial', size: 11, bold: true };
                    ws.getCell('A3').fill = metaLabelFill;

                    ws.mergeCells('A4:E4');
                    ws.getCell('A4').value = `${this.invoiceData.clientAddress}`;
                    ws.getCell('A4').font = { name: 'Arial', size: 11, bold: true };
                    ws.getCell('A4').fill = metaLabelFill;

                    ws.mergeCells('A5:E5');
                    ws.getCell('A5').value = `GSTIN : ${this.invoiceData.clientGstin}`;
                    ws.getCell('A5').font = { name: 'Arial', size: 11, bold: true };
                    ws.getCell('A5').fill = metaLabelFill;

                    // Row 6: Contractor Name Banner
                    ws.mergeCells('A6:E6');
                    const r6 = ws.getCell('A6');
                    r6.value = `Name of Contractor :- ${this.getContractorDisplayName()}`;
                    r6.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
                    r6.fill = headerFill;
                    r6.alignment = { horizontal: 'center', vertical: 'middle' };
                    ws.getRow(6).height = 22;

                    // Row 7 to 11: 2-Column Meta Table
                    const metaRows = [
                        ['Invoice No :', this.invoiceData.invoiceNo, 'Name of Contractor :', this.getContractorDisplayName()],
                        ['Work Order No :', `${this.invoiceData.workOrderNo}    Dt:${this.invoiceData.workOrderDate}`, 'GSTIN :', this.invoiceData.contractorGstin],
                        ['Invoice Date :', this.invoiceData.invoiceDate, 'PAN No :', this.invoiceData.contractorPan],
                        ['Name of Division :', this.invoiceData.divisionName, 'Location :', this.invoiceData.locationName],
                        ['Name of Sub-Div :', this.invoiceData.subDivName, 'Name of Feeder :', this.invoiceData.feederName]
                    ];

                    let curRow = 7;
                    metaRows.forEach(mr => {
                        const row = ws.getRow(curRow);
                        row.height = 22;

                        row.getCell(1).value = mr[0];
                        row.getCell(1).font = { name: 'Arial', size: 11, bold: true };
                        row.getCell(1).fill = metaLabelFill;
                        row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

                        row.getCell(2).value = mr[1];
                        row.getCell(2).font = { name: 'Arial', size: 11 };
                        row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };

                        row.getCell(3).value = mr[2];
                        row.getCell(3).font = { name: 'Arial', size: 11, bold: true };
                        row.getCell(3).fill = metaLabelFill;
                        row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };

                        ws.mergeCells(curRow, 4, curRow, 5);
                        row.getCell(4).value = mr[3];
                        row.getCell(4).font = { name: 'Arial', size: 11 };
                        row.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' };

                        curRow++;
                    });

                    // Row 12: Item Headers
                    const itemHeaderRow = ws.getRow(curRow);
                    itemHeaderRow.values = ['Sr. No.', 'Description of Goods', 'Unit', 'Qty', 'Amount'];
                    itemHeaderRow.eachCell(c => {
                        c.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
                        c.fill = headerFill;
                        c.alignment = { horizontal: 'center', vertical: 'middle' };
                    });
                    itemHeaderRow.height = 24;
                    curRow++;

                    const itemsStartRow = curRow;
                    this.invoiceData.items.forEach((it, idx) => {
                        const row = ws.getRow(curRow);
                        row.getCell(1).value = Number(it.srNo) || it.srNo;
                        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
                        row.getCell(2).value = it.desc;
                        row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
                        row.getCell(3).value = it.unit;
                        row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
                        row.getCell(4).value = Number(it.qty) || 0;
                        row.getCell(4).numFmt = (Number(it.qty) % 1 !== 0) ? '#,##0.000' : '#,##0.00';
                        row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
                        row.getCell(5).value = Number(it.amount) || 0;
                        row.getCell(5).numFmt = '#,##0.00';
                        row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
                        row.getCell(5).font = { name: 'Arial', size: 11, bold: true };
                        
                        if (idx % 2 !== 0) {
                            for (let c = 1; c <= 5; c++) {
                                row.getCell(c).fill = zebraFill;
                            }
                        }
                        
                        row.height = 30;
                        curRow++;
                    });
                    const itemsEndRow = curRow - 1;

                    // Summary Block
                    // Total Erection Amount Row
                    const rErect = ws.getRow(curRow);
                    ws.mergeCells(curRow, 1, curRow, 3);
                    rErect.getCell(4).value = 'Total Erection Amount';
                    rErect.getCell(4).font = { name: 'Arial', size: 11, bold: true };
                    rErect.getCell(5).value = { formula: `SUM(E${itemsStartRow}:E${itemsEndRow})`, result: this.calculatedInvoiceBasic };
                    rErect.getCell(5).font = { name: 'Arial', size: 11, bold: true };
                    rErect.getCell(5).numFmt = '#,##0.00';
                    rErect.getCell(5).alignment = { horizontal: 'right' };
                    const basicRowIdx = curRow;
                    curRow++;

                    // Bank Account / Basic Amount Row
                    const rBank1 = ws.getRow(curRow);
                    rBank1.getCell(1).value = 'Name of Account:';
                    rBank1.getCell(1).font = { name: 'Arial', size: 11, bold: true };
                    ws.mergeCells(curRow, 2, curRow, 3);
                    rBank1.getCell(2).value = this.invoiceData.bankAccountName;
                    rBank1.getCell(2).font = { name: 'Arial', size: 11, bold: true };
                    rBank1.getCell(4).value = 'Basic Amount';
                    rBank1.getCell(4).font = { name: 'Arial', size: 11, bold: true };
                    rBank1.getCell(5).value = { formula: `E${basicRowIdx}`, result: this.calculatedInvoiceBasic };
                    rBank1.getCell(5).font = { name: 'Arial', size: 11, bold: true };
                    rBank1.getCell(5).numFmt = '#,##0.00';
                    rBank1.getCell(5).alignment = { horizontal: 'right' };
                    curRow++;

                    if (this.invoiceData.gstType === 'CGST_SGST') {
                        // Bank A/C / CGST 9% Row
                        const rBank2 = ws.getRow(curRow);
                        rBank2.getCell(1).value = 'Bank A/C:';
                        rBank2.getCell(1).font = { name: 'Arial', size: 11, bold: true };
                        ws.mergeCells(curRow, 2, curRow, 3);
                        rBank2.getCell(2).value = this.invoiceData.bankAccountNo;
                        rBank2.getCell(2).font = { name: 'Arial', size: 11, bold: true };
                        rBank2.getCell(4).value = 'CGST @ 9%';
                        rBank2.getCell(4).font = { name: 'Arial', size: 11, bold: true };
                        rBank2.getCell(5).value = { formula: `E${basicRowIdx}*0.09`, result: this.calculatedInvoiceCgst };
                        rBank2.getCell(5).font = { name: 'Arial', size: 11, bold: true };
                        rBank2.getCell(5).numFmt = '#,##0.00';
                        rBank2.getCell(5).alignment = { horizontal: 'right' };
                        const cgstRowIdx = curRow;
                        curRow++;

                        // Bank IFSC / SGST 9% Row
                        const rBank3 = ws.getRow(curRow);
                        rBank3.getCell(1).value = 'Bank IFSC:';
                        rBank3.getCell(1).font = { name: 'Arial', size: 11, bold: true };
                        ws.mergeCells(curRow, 2, curRow, 3);
                        rBank3.getCell(2).value = this.invoiceData.bankIfsc;
                        rBank3.getCell(2).font = { name: 'Arial', size: 11, bold: true };
                        rBank3.getCell(4).value = 'SGST @ 9%';
                        rBank3.getCell(4).font = { name: 'Arial', size: 11, bold: true };
                        rBank3.getCell(5).value = { formula: `E${basicRowIdx}*0.09`, result: this.calculatedInvoiceSgst };
                        rBank3.getCell(5).font = { name: 'Arial', size: 11, bold: true };
                        rBank3.getCell(5).numFmt = '#,##0.00';
                        rBank3.getCell(5).alignment = { horizontal: 'right' };
                        const sgstRowIdx = curRow;
                        curRow++;

                        // Bank Name / Grand Total Row
                        const rBank4 = ws.getRow(curRow);
                        rBank4.getCell(1).value = 'Bank Name :';
                        rBank4.getCell(1).font = { name: 'Arial', size: 11, bold: true };
                        ws.mergeCells(curRow, 2, curRow, 3);
                        rBank4.getCell(2).value = this.invoiceData.bankName;
                        rBank4.getCell(2).font = { name: 'Arial', size: 11, bold: true };
                        rBank4.getCell(4).value = 'Total Amount';
                        rBank4.getCell(4).font = { name: 'Arial', size: 11, bold: true };
                        rBank4.getCell(5).value = { formula: `E${basicRowIdx}+E${cgstRowIdx}+E${sgstRowIdx}`, result: this.calculatedInvoiceGrandTotal };
                        rBank4.getCell(5).font = { name: 'Arial', size: 11, bold: true };
                        rBank4.getCell(5).numFmt = '#,##0.00';
                        rBank4.getCell(5).alignment = { horizontal: 'right' };
                        curRow++;
                    } else if (this.invoiceData.gstType === 'IGST') {
                        // Bank A/C / IGST Row
                        const rBank2 = ws.getRow(curRow);
                        rBank2.getCell(1).value = 'Bank A/C:';
                        rBank2.getCell(1).font = { name: 'Arial', size: 11, bold: true };
                        ws.mergeCells(curRow, 2, curRow, 3);
                        rBank2.getCell(2).value = this.invoiceData.bankAccountNo;
                        rBank2.getCell(2).font = { name: 'Arial', size: 11, bold: true };
                        rBank2.getCell(4).value = 'IGST @ 18%';
                        rBank2.getCell(4).font = { name: 'Arial', size: 11, bold: true };
                        rBank2.getCell(5).value = { formula: `E${basicRowIdx}*0.18`, result: this.calculatedInvoiceIgst };
                        rBank2.getCell(5).font = { name: 'Arial', size: 11, bold: true };
                        rBank2.getCell(5).numFmt = '#,##0.00';
                        rBank2.getCell(5).alignment = { horizontal: 'right' };
                        const gstRowIdx = curRow;
                        curRow++;

                        // Bank IFSC Row
                        const rBank3 = ws.getRow(curRow);
                        rBank3.getCell(1).value = 'Bank IFSC:';
                        rBank3.getCell(1).font = { name: 'Arial', size: 11, bold: true };
                        ws.mergeCells(curRow, 2, curRow, 3);
                        rBank3.getCell(2).value = this.invoiceData.bankIfsc;
                        rBank3.getCell(2).font = { name: 'Arial', size: 11, bold: true };
                        curRow++;

                        // Bank Name / Grand Total Row
                        const rBank4 = ws.getRow(curRow);
                        rBank4.getCell(1).value = 'Bank Name :';
                        rBank4.getCell(1).font = { name: 'Arial', size: 11, bold: true };
                        ws.mergeCells(curRow, 2, curRow, 3);
                        rBank4.getCell(2).value = this.invoiceData.bankName;
                        rBank4.getCell(2).font = { name: 'Arial', size: 11, bold: true };
                        rBank4.getCell(4).value = 'Total Amount';
                        rBank4.getCell(4).font = { name: 'Arial', size: 11, bold: true };
                        rBank4.getCell(5).value = { formula: `E${basicRowIdx}+E${gstRowIdx}`, result: this.calculatedInvoiceGrandTotal };
                        rBank4.getCell(5).font = { name: 'Arial', size: 11, bold: true };
                        rBank4.getCell(5).numFmt = '#,##0.00';
                        rBank4.getCell(5).alignment = { horizontal: 'right' };
                        curRow++;
                    } else {
                        // NONE (No GSTIN) — GST 0%, Total = Basic only
                        const rNone1 = ws.getRow(curRow);
                        rNone1.getCell(1).value = 'Bank A/C:';
                        rNone1.getCell(1).font = { name: 'Arial', size: 11, bold: true };
                        ws.mergeCells(curRow, 2, curRow, 3);
                        rNone1.getCell(2).value = this.invoiceData.bankAccountNo;
                        rNone1.getCell(2).font = { name: 'Arial', size: 11, bold: true };
                        rNone1.getCell(4).value = 'GST @ 0% (No GSTIN)';
                        rNone1.getCell(4).font = { name: 'Arial', size: 11, bold: true };
                        rNone1.getCell(5).value = 0;
                        rNone1.getCell(5).font = { name: 'Arial', size: 11, bold: true };
                        rNone1.getCell(5).numFmt = '#,##0.00';
                        rNone1.getCell(5).alignment = { horizontal: 'right' };
                        const noneGstRowIdx = curRow;
                        curRow++;

                        // Bank IFSC Row
                        const rNone2 = ws.getRow(curRow);
                        rNone2.getCell(1).value = 'Bank IFSC:';
                        rNone2.getCell(1).font = { name: 'Arial', size: 11, bold: true };
                        ws.mergeCells(curRow, 2, curRow, 3);
                        rNone2.getCell(2).value = this.invoiceData.bankIfsc;
                        rNone2.getCell(2).font = { name: 'Arial', size: 11, bold: true };
                        curRow++;

                        // Bank Name / Grand Total Row (= Basic)
                        const rNone3 = ws.getRow(curRow);
                        rNone3.getCell(1).value = 'Bank Name :';
                        rNone3.getCell(1).font = { name: 'Arial', size: 11, bold: true };
                        ws.mergeCells(curRow, 2, curRow, 3);
                        rNone3.getCell(2).value = this.invoiceData.bankName;
                        rNone3.getCell(2).font = { name: 'Arial', size: 11, bold: true };
                        rNone3.getCell(4).value = 'Total Amount';
                        rNone3.getCell(4).font = { name: 'Arial', size: 11, bold: true };
                        rNone3.getCell(5).value = { formula: `E${basicRowIdx}+E${noneGstRowIdx}`, result: this.calculatedInvoiceGrandTotal };
                        rNone3.getCell(5).font = { name: 'Arial', size: 11, bold: true };
                        rNone3.getCell(5).numFmt = '#,##0.00';
                        rNone3.getCell(5).alignment = { horizontal: 'right' };
                        curRow++;
                    }

                    // Apply totalFill to summary rows (Rows itemsEndRow+1 to curRow-1)
                    for (let r = itemsEndRow + 1; r < curRow; r++) {
                        const row = ws.getRow(r);
                        for (let c = 1; c <= 5; c++) {
                            row.getCell(c).fill = totalFill;
                        }
                    }

                    // Amount in words row
                    ws.mergeCells(curRow, 1, curRow, 5);
                    const rWords = ws.getCell(`A${curRow}`);
                    rWords.value = `Amount in Words :  ${this.amountInWordsIndian(this.calculatedInvoiceGrandTotal)}`;
                    rWords.font = { name: 'Arial', size: 11, bold: true };
                    curRow++;

                    // Declaration & Signatures
                    ws.mergeCells(curRow, 1, curRow + 4, 3);
                    const rDecl = ws.getCell(`A${curRow}`);
                    rDecl.value = `Declaration :\n. Any Complaint/Dispute regarding this sheet should be\n  communicated within 7 days from date of receipt of bill.`;
                    rDecl.font = { name: 'Arial', size: 9.5 };
                    rDecl.alignment = { wrapText: true, vertical: 'top' };

                    ws.mergeCells(curRow, 4, curRow, 5);
                    ws.getCell(`D${curRow}`).value = `For, ${this.getContractorDisplayName()}`;
                    ws.getCell(`D${curRow}`).font = { name: 'Arial', size: 11, bold: true };

                    ws.mergeCells(curRow + 4, 4, curRow + 4, 5);
                    ws.getCell(`D${curRow + 4}`).value = 'Proprietor';
                    ws.getCell(`D${curRow + 4}`).font = { name: 'Arial', size: 11, bold: true };
                    ws.getCell(`D${curRow + 4}`).alignment = { horizontal: 'right' };

                    const totalEndRow = curRow + 4;

                    // Apply Borders Across all table cells, correctly handling merged cells
                    for (let r = 1; r <= totalEndRow; r++) {
                        const row = ws.getRow(r);
                        for (let c = 1; c <= 5; c++) {
                            const cell = row.getCell(c);
                            if (cell.isMerged && cell.master !== cell) {
                                // Inherit fill from master cell so merged cell background is fully solid
                                if (cell.master.fill) {
                                    cell.fill = cell.master.fill;
                                }
                                // Skip border for inner merged cells to prevent lines from appearing inside merged regions
                                continue;
                            }
                            cell.border = borderThin;
                        }
                    }

                    // Column Widths (Optimized so no label or text gets clipped/truncated)
                    ws.columns = [
                        { width: 22 }, // Col A: Labels ("Name of Division :", "Work Order No :", "Sr. No.")
                        { width: 46 }, // Col B: Description of Goods & Meta values
                        { width: 22 }, // Col C: Labels ("Name of Contractor :", "Name of Feeder :", "Unit")
                        { width: 24 }, // Col D: Qty & Summary Labels ("Total Erection Amount", etc.)
                        { width: 24 }  // Col E: Amount with currency formatting
                    ];
                },

                // EXCELJS RICH FORMATTED TAX INVOICE EXPORT (WITH ALL ADDED ACTIVITIES AS SEPARATE SHEETS)
                // Khali meta field par Tax Invoice Excel rok — pehle haath se bharo
                getMissingInvoiceMeta() {
                    const missing = [];
                    const v = this.invoiceData || {};
                    if (!String(v.invoiceNo || '').trim()) missing.push('Invoice No');
                    if (!String(v.workOrderNo || '').trim()) missing.push('Work Order No');
                    if (!String(v.workOrderDate || '').trim()) missing.push('WO Dt');
                    if (!String(v.invoiceDate || '').trim()) missing.push('Invoice Date');
                    if (!String(v.divisionName || '').trim()) missing.push('Name of Division');
                    if (!String(v.subDivName || '').trim()) missing.push('Name of Sub-Div');
                    return missing;
                },
                async exportTaxInvoiceExcel() {
                    const missing = this.getMissingInvoiceMeta();
                    if (missing.length) {
                        this.showToast('⚠️ Fill these first: ' + missing.join(', '), '⛔');
                        alert('Excel export ruk gaya.\n\nPehle Tax Invoice me ye field haath se bharo:\n• ' + missing.join('\n• '));
                        return;
                    }
                    this.showToast('Generating Tax Invoice & Added Activity Sheets...', '⏳');

                    const workbook = new ExcelJS.Workbook();
                    workbook.creator = 'Billing Pro Studio';
                    workbook.created = new Date();

                    // 1. Add Exact Formatted Tax Invoice Sheet
                    this.addStyledTaxInvoiceToWorkbook(workbook);

                    // 2. Identify all added / active activities in the invoice / project
                    const addedActKeys = [];

                    // Collect activities explicitly listed in invoice items
                    this.invoiceData.items.forEach(it => {
                        if (it.actKey && this.activities[it.actKey] && !addedActKeys.includes(it.actKey)) {
                            addedActKeys.push(it.actKey);
                        } else if (it.desc) {
                            const matchedKey = Object.keys(this.activities).find(k =>
                                it.desc.startsWith(k + ':') || it.desc.startsWith(k + ' ') || it.desc.includes(k)
                            );
                            if (matchedKey && !addedActKeys.includes(matchedKey)) {
                                addedActKeys.push(matchedKey);
                            }
                        }
                    });

                    // Also include any activities that have billed amount / entered quantities
                    Object.keys(this.activities).forEach(actKey => {
                        if (!addedActKeys.includes(actKey) && this.getActivityBilled85Amount(actKey) > 0) {
                            addedActKeys.push(actKey);
                        }
                    });

                    // If still empty, include all project activities
                    if (addedActKeys.length === 0) {
                        Object.keys(this.activities).forEach(actKey => {
                            addedActKeys.push(actKey);
                        });
                    }

                    // Add detailed separate sheets for each added activity with live formulas & values
                    addedActKeys.forEach(actKey => {
                        this.addStyledActivityDetailToWorkbook(workbook, actKey);
                    });

                    // 3. Add Reconciliation Sheet
                    this.addReconciliationToWorkbook(workbook, addedActKeys);

                    const buffer = await workbook.xlsx.writeBuffer();
                    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    const cleanInvNo = (this.invoiceData.invoiceNo || 'Draft').replace(/[\/\\:*?"<>|]/g, '_');
                    const fileName = `Tax_Invoice_${cleanInvNo}_All_Sheets.xlsx`;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    this.showToast(`Tax Invoice downloaded with ${addedActKeys.length} activity sheets + Reconciliation! 🎉`, '🧾');
                },

                addReconciliationToWorkbook(workbook, actKeys) {
                    const ws = workbook.addWorksheet('Reconciliation', {
                        views: [{ showGridLines: true }],
                        pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, verticalCentered: true, margins: { left: 0.2, right: 0.2, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } }
                    });
                    const titleFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF222222' } };
                    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
                    const zebraFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
                    const thinBorder = {
                        top: { style: 'thin', color: { argb: 'FF888888' } },
                        left: { style: 'thin', color: { argb: 'FF888888' } },
                        bottom: { style: 'thin', color: { argb: 'FF888888' } },
                        right: { style: 'thin', color: { argb: 'FF888888' } }
                    };

                    const columns = actKeys.slice().sort((a, b) => parseInt(a) - parseInt(b));
                    const totalCols = 5 + columns.length;

                    ws.mergeCells(1, 1, 1, totalCols);
                    const r1 = ws.getCell(1, 1);
                    r1.value = `${this.getContractorDisplayName().toUpperCase()} MATERIAL RECONCILIATION SHEET`;
                    r1.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
                    r1.fill = titleFill;
                    r1.alignment = { horizontal: 'center', vertical: 'middle' };
                    ws.getRow(1).height = 30;

                    const row2 = ws.getRow(2);
                    const headers = ['SR NO.', 'Row Labels', 'ITEMS DESCRIPTION', 'UNIT', 'TOTAL QTY', ...columns];
                    row2.values = headers;
                    row2.height = 26;
                    row2.eachCell((cell) => {
                        cell.fill = headerFill;
                        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                        cell.border = thinBorder;
                    });

                    const pData = this.pivotReconciliationData;
                    let rowIdx = 3;

                    pData.rows.forEach((rowObj, idx) => {
                        const row = ws.getRow(rowIdx);
                        row.getCell(1).value = idx + 1;
                        row.getCell(2).value = rowObj.code;
                        row.getCell(3).value = rowObj.desc;
                        row.getCell(4).value = rowObj.uom;

                        const actColStart = 6;
                        columns.forEach((col, cIdx) => {
                            const actColIdx = actColStart + cIdx;
                            const val = rowObj.activities[col] || 0;
                            row.getCell(actColIdx).value = val;
                        });

                        const actEndCol = String.fromCharCode(64 + 5 + columns.length);
                        row.getCell(5).value = { formula: `SUM(F${rowIdx}:${actEndCol}${rowIdx})` };

                        row.eachCell((c, colNum) => {
                            c.border = thinBorder;
                            if (idx % 2 === 1) c.fill = zebraFill;
                            c.alignment = { vertical: 'middle' };
                            if (colNum === 3) {
                                c.alignment = { horizontal: 'left', wrapText: true };
                            } else if (colNum === 5) {
                                c.font = { bold: true };
                                c.alignment = { horizontal: 'right' };
                            } else {
                                c.alignment = { horizontal: 'center' };
                            }
                            if (colNum >= 5) {
                                c.numFmt = '#,##0.00';
                            }
                        });
                        row.height = 20;
                        rowIdx++;
                    });

                    const cols = [
                        { width: 8 }, { width: 12 }, { width: 45 }, { width: 8 }, { width: 12 }
                    ];
                    columns.forEach(() => cols.push({ width: 10 }));
                    ws.columns = cols;
                },

                // EXCEL EXPORT METHODS
                async exportExcelWithExcelJS(exportMode = 'single_activity') {
                    const workbook = new ExcelJS.Workbook();
                    workbook.creator = 'Billing Pro Studio';
                    workbook.created = new Date();

                    let fileName = '';

                    if (exportMode === 'single_activity') {
                        this.showToast(`Exporting Activity ${this.selectedActivityKey} Excel...`, '⏳');
                        this.addStyledActivityDetailToWorkbook(workbook, this.selectedActivityKey);
                        fileName = `Activity_${this.selectedActivityKey}_Billing.xlsx`;
                    } else if (exportMode === 'abstract_only') {
                        this.showToast('Exporting Master Abstract Excel...', '⏳');
                        this.addStyledMasterAbstractToWorkbook(workbook);
                        fileName = `LK_Electrical_Master_Abstract.xlsx`;
                    } else if (exportMode === 'all_activities') {
                        this.showToast('Exporting Complete Workbook (All Activities)...', '⏳');
                        this.addStyledMasterAbstractToWorkbook(workbook);
                        Object.keys(this.activities).forEach(actKey => {
                            this.addStyledActivityDetailToWorkbook(workbook, actKey);
                        });
                        fileName = `LK_Electrical_Master_Billing_All_Activities.xlsx`;
                    }

                    const buffer = await workbook.xlsx.writeBuffer();
                    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    this.showToast(`Downloaded ${fileName} 🎉`, '📗');
                },

                addStyledMasterAbstractToWorkbook(workbook) {
                    const ws = workbook.addWorksheet('Master Abstract', {
                        views: [{ showGridLines: true }],
                        pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, verticalCentered: true, margins: { left: 0.2, right: 0.2, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } }
                    });

                    const titleFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF222222' } };
                    const subFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF404040' } };
                    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
                    const totalFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD0D0D0' } };
                    const zebraFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

                    const thinBorder = {
                        top: { style: 'thin', color: { argb: 'FF888888' } },
                        left: { style: 'thin', color: { argb: 'FF888888' } },
                        bottom: { style: 'thin', color: { argb: 'FF888888' } },
                        right: { style: 'thin', color: { argb: 'FF888888' } }
                    };

                    ws.mergeCells('A1:I1');
                    const r1 = ws.getCell('A1');
                    r1.value = `PROJECT: ${this.projectMeta.projectName.toUpperCase()} - MASTER BILLING ABSTRACT`;
                    r1.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
                    r1.fill = titleFill;
                    r1.alignment = { horizontal: 'center', vertical: 'middle' };
                    ws.getRow(1).height = 32;

                    ws.mergeCells('A2:I2');
                    const r2 = ws.getCell('A2');
                    r2.value = `Contractor: ${this.getContractorDisplayName()}  |  Bill No: ${this.invoiceData.invoiceNo}  |  Bill Date: ${this.invoiceData.invoiceDate}  |  Stage Split: ${this.pctStage1}% / ${this.pctStage2}% / ${this.pctStage3}%`;
                    r2.font = { name: 'Calibri', size: 11, italic: true, color: { argb: 'FFFFFFFF' } };
                    r2.fill = subFill;
                    r2.alignment = { horizontal: 'center', vertical: 'middle' };
                    ws.getRow(2).height = 22;

                    ws.getRow(3).height = 10;

                    const headers = [
                        'Act No',
                        'Activity Description',
                        'UoM',
                        'Total Qty',
                        'Unit Rate',
                        'Total Amt',
                        `${this.pctStage1}% Amt`,
                        `${this.pctStage2}% Amt`,
                        `${this.pctStage3}% Amt`
                    ];

                    const row4 = ws.getRow(4);
                    row4.values = headers;
                    row4.height = 28;
                    row4.eachCell((cell) => {
                        cell.fill = headerFill;
                        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                        cell.border = thinBorder;
                    });

                    let rowIdx = 5;
                    const startRow = 5;
                    const s1Factor = this.pctStage1 / 100;
                    const s2Factor = this.pctStage2 / 100;
                    const s3Factor = this.pctStage3 / 100;

                    this.masterAbstractList.forEach((act, idx) => {
                        const row = ws.getRow(rowIdx);
                        const qtyVal = Number(act.qty) || 0;
                        const rateVal = Number(act.rate) || 0;
                        const estTotal = qtyVal * rateVal;

                        row.getCell(1).value = act.code;
                        row.getCell(2).value = act.desc;
                        row.getCell(3).value = act.uom;
                        row.getCell(4).value = qtyVal;
                        row.getCell(5).value = rateVal;

                        row.getCell(6).value = { formula: `D${rowIdx}*E${rowIdx}`, result: estTotal };
                        row.getCell(7).value = { formula: `F${rowIdx}*${s1Factor}`, result: estTotal * s1Factor };
                        row.getCell(8).value = { formula: `F${rowIdx}*${s2Factor}`, result: estTotal * s2Factor };
                        row.getCell(9).value = { formula: `F${rowIdx}*${s3Factor}`, result: estTotal * s3Factor };

                        row.height = 24;

                        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
                        row.getCell(1).font = { name: 'Calibri', size: 11, bold: true };

                        row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
                        row.getCell(2).font = { name: 'Calibri', size: 11 };

                        row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
                        row.getCell(3).font = { name: 'Calibri', size: 11 };

                        row.getCell(4).numFmt = '#,##0.00';
                        row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };

                        row.getCell(5).numFmt = '#,##0.00';
                        row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };

                        row.getCell(6).numFmt = '#,##0.00';
                        row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
                        row.getCell(6).font = { name: 'Calibri', size: 11, bold: true };

                        row.getCell(7).numFmt = '#,##0.00';
                        row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
                        row.getCell(7).font = { name: 'Calibri', size: 11, bold: true };

                        row.getCell(8).numFmt = '#,##0.00';
                        row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
                        row.getCell(8).font = { name: 'Calibri', size: 11 };

                        row.getCell(9).numFmt = '#,##0.00';
                        row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
                        row.getCell(9).font = { name: 'Calibri', size: 11 };

                        row.eachCell((cell) => {
                            cell.border = thinBorder;
                            if (idx % 2 === 1) cell.fill = zebraFill;
                        });

                        rowIdx++;
                    });

                    const endRow = rowIdx - 1;

                    const totalRow = ws.getRow(rowIdx);
                    ws.mergeCells(`A${rowIdx}:E${rowIdx}`);
                    totalRow.getCell(1).value = 'GRAND TOTAL';
                    totalRow.getCell(6).value = { formula: `SUM(F${startRow}:F${endRow})`, result: this.abstractTotals.amt100 };
                    totalRow.getCell(7).value = { formula: `SUM(G${startRow}:G${endRow})`, result: this.abstractTotals.amtStage1 };
                    totalRow.getCell(8).value = { formula: `SUM(H${startRow}:H${endRow})`, result: this.abstractTotals.amtStage2 };
                    totalRow.getCell(9).value = { formula: `SUM(I${startRow}:I${endRow})`, result: this.abstractTotals.amtStage3 };

                    totalRow.height = 26;

                    totalRow.eachCell((cell, colNum) => {
                        cell.fill = totalFill;
                        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
                        cell.border = {
                            top: { style: 'medium', color: { argb: 'FF222222' } },
                            bottom: { style: 'double', color: { argb: 'FF222222' } },
                            left: { style: 'thin', color: { argb: 'FF888888' } },
                            right: { style: 'thin', color: { argb: 'FF888888' } }
                        };
                        if (colNum >= 6) {
                            cell.numFmt = '#,##0.00';
                            cell.alignment = { horizontal: 'right', vertical: 'middle' };
                        }
                    });
                    totalRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };

                    ws.columns = [
                        { width: 12 },
                        { width: 62 },
                        { width: 10 },
                        { width: 14 },
                        { width: 16 },
                        { width: 18 },
                        { width: 18 },
                        { width: 16 },
                        { width: 16 }
                    ];
                },

                addStyledActivityDetailToWorkbook(workbook, actKey) {
                    const act = this.activities[actKey];
                    if (!act) return;

                    const safeSheetName = `Act ${actKey}`.substring(0, 31);
                    const ws = workbook.addWorksheet(safeSheetName, {
                        views: [{ showGridLines: true }],
                        pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, verticalCentered: false, margins: { left: 0.2, right: 0.2, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } }
                    });

                    const numLocs = this.getActLocations(actKey).length;
                    const totalCols = 3 + numLocs + 5;

                    const locStartCol = 4;
                    const locEndCol = 3 + numLocs;
                    const rateCol = 4 + numLocs;
                    const amt100Col = 5 + numLocs;
                    const amt85Col = 6 + numLocs;
                    const amt10Col = 7 + numLocs;
                    const amt5Col = 8 + numLocs;

                    const locStartLet = getColLetter(locStartCol);
                    const locEndLet = getColLetter(locEndCol);
                    const rateLet = getColLetter(rateCol);
                    const amt100Let = getColLetter(amt100Col);
                    const amt85Let = getColLetter(amt85Col);
                    const amt10Let = getColLetter(amt10Col);
                    const amt5Let = getColLetter(amt5Col);

                    const titleFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF222222' } };
                    const subFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF404040' } };
                    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
                    const locFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF555555' } };
                    const totalFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD0D0D0' } };
                    const zebraFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

                    const thinBorder = {
                        top: { style: 'thin', color: { argb: 'FF888888' } },
                        left: { style: 'thin', color: { argb: 'FF888888' } },
                        bottom: { style: 'thin', color: { argb: 'FF888888' } },
                        right: { style: 'thin', color: { argb: 'FF888888' } }
                    };

                    ws.mergeCells(1, 1, 1, totalCols);
                    const r1 = ws.getCell(1, 1);
                    const companyObj = this.companiesList.find(c => c.id === this.selectedCompanyId);
                    const companyName = companyObj ? companyObj.name : '';
                    r1.value = companyName;
                    r1.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
                    r1.fill = titleFill;
                    r1.alignment = { horizontal: 'center', vertical: 'middle' };
                    ws.getRow(1).height = 30;

                    const metaLabelFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
                    const metaLabelFont = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF111111' } };

                    const metaStartRow = 2;
                    const metaRows = [
                        { label: 'Name of Contractor :-', value: this.getContractorDisplayName() },
                        { label: 'Name of Feeder:', value: this.invoiceData.feederName || '' },
                        { label: 'RA BILL NO.-', value: this.invoiceData.invoiceNo || '' }
                    ];

                    metaRows.forEach((m, i) => {
                        const r = metaStartRow + i;
                        ws.mergeCells(r, 1, r, totalCols);
                        const labelCell = ws.getCell(r, 1);
                        labelCell.value = `${m.label} ${m.value}`;
                        labelCell.font = metaLabelFont;
                        labelCell.fill = metaLabelFill;
                        labelCell.alignment = { horizontal: 'left', vertical: 'middle' };
                        labelCell.border = thinBorder;
                        ws.getRow(r).height = 22;
                    });

                    const r5 = ws.getCell(5, 1);
                    ws.mergeCells(5, 1, 5, totalCols);
                    r5.value = act.title;
                    r5.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF111111' } };
                    r5.fill = metaLabelFill;
                    r5.alignment = { horizontal: 'left', vertical: 'middle' };
                    r5.border = thinBorder;
                    ws.getRow(5).height = 22;

                    ws.getRow(6).height = 10;

                    const qMatrix = this.activityQuantities[actKey] || [];
                    const s1Factor = this.pctStage1 / 100;
                    const s2Factor = this.pctStage2 / 100;
                    const s3Factor = this.pctStage3 / 100;

                    const regularMats = [];
                    const extraMats = [];
                    act.materials.forEach((mat, idx) => {
                        if (mat.isExtra) extraMats.push({ mat, idx, rowNo: extraMats.length + 1 });
                        else regularMats.push({ mat, idx, rowNo: regularMats.length + 1 });
                    });

                    let rowIdx = 7;

                    const renderTable = (itemsList, isExtra) => {
                        if (itemsList.length === 0) return;

                        // Web jaisa "✏️ Extra Items" banner — extra table ke upar merged heading
                        if (isExtra) {
                            ws.mergeCells(rowIdx, 1, rowIdx, totalCols);
                            const banCell = ws.getCell(rowIdx, 1);
                            banCell.value = `✏️ Extra Items (${itemsList.length} items added separately)`;
                            banCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF4F46E5' } };
                            banCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E9FD' } };
                            banCell.alignment = { horizontal: 'left', vertical: 'middle' };
                            banCell.border = thinBorder;
                            ws.getRow(rowIdx).height = 24;
                            rowIdx++;
                        }

                        let headerValues = ['Sr.No.', 'Description of Material', 'Unit'];
                        this.getActLocations(actKey).forEach(l => headerValues.push(isExtra ? 'Erected Qty.' : l.name));
                        headerValues.push('Rate', '100% Amt', `${this.pctStage1}% Amt`, `${this.pctStage2}% Amt`, `${this.pctStage3}% Amt`);

                        const rowH = ws.getRow(rowIdx);
                        rowH.values = headerValues;
                        rowH.height = 28;
                        rowH.eachCell((cell, colIdx) => {
                            cell.fill = (colIdx >= 4 && colIdx <= locEndCol) ? locFill : headerFill;
                            cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
                            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                            cell.border = thinBorder;
                        });
                        rowIdx++;

                        const startRow = rowIdx;

                        itemsList.forEach((itemObj, listIdx) => {
                            const { mat, idx, rowNo } = itemObj;
                            const row = ws.getRow(rowIdx);
                            row.getCell(1).value = rowNo;
                            row.getCell(2).value = mat.desc;
                            row.getCell(3).value = mat.unit;

                            let itemTotalQty = 0;
                            for (let locIdx = 0; locIdx < numLocs; locIdx++) {
                                const val = (qMatrix[locIdx] && qMatrix[locIdx][idx] !== undefined && qMatrix[locIdx][idx] !== '')
                                    ? parseFloat(qMatrix[locIdx][idx])
                                    : 0;
                                row.getCell(locStartCol + locIdx).value = val;
                                if (!isNaN(val)) itemTotalQty += val;
                            }

                            const rateVal = Number(mat.rate) || 0;
                            row.getCell(rateCol).value = rateVal;

                            const est100 = itemTotalQty * rateVal;
                            const sumLocFormula = numLocs === 1
                                ? `${locStartLet}${rowIdx}`
                                : `SUM(${locStartLet}${rowIdx}:${locEndLet}${rowIdx})`;

                            row.getCell(amt100Col).value = { formula: `(${sumLocFormula})*${rateLet}${rowIdx}`, result: est100 };
                            row.getCell(amt85Col).value = { formula: `${amt100Let}${rowIdx}*${s1Factor}`, result: est100 * s1Factor };
                            row.getCell(amt10Col).value = { formula: `${amt100Let}${rowIdx}*${s2Factor}`, result: est100 * s2Factor };
                            row.getCell(amt5Col).value = { formula: `${amt100Let}${rowIdx}*${s3Factor}`, result: est100 * s3Factor };

                            row.height = 22;

                            row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
                            row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
                            row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };

                            for (let c = 4; c <= totalCols; c++) {
                                row.getCell(c).numFmt = '#,##0.00';
                                row.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
                            }

                            row.getCell(amt100Col).font = { name: 'Calibri', size: 11, bold: true };
                            row.getCell(amt85Col).font = { name: 'Calibri', size: 11, bold: true };
                            row.getCell(amt10Col).font = { name: 'Calibri', size: 11 };
                            row.getCell(amt5Col).font = { name: 'Calibri', size: 11 };

                            row.eachCell(cell => {
                                cell.border = thinBorder;
                                if (listIdx % 2 === 1) cell.fill = zebraFill;
                                else if (isExtra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F2FE' } };
                            });

                            rowIdx++;
                        });

                        const endRow = rowIdx - 1;

                        const totalRow = ws.getRow(rowIdx);
                        ws.mergeCells(rowIdx, 1, rowIdx, rateCol);
                        totalRow.getCell(1).value = isExtra ? 'Total =' : 'ACTIVITY TOTAL';

                        const subAmt100 = itemsList.reduce((sum, it) => sum + (it.mat.rate * (qMatrix.reduce((qsum, loc) => qsum + (parseFloat(loc[it.idx]) || 0), 0))), 0);
                        totalRow.getCell(amt100Col).value = { formula: `SUM(${amt100Let}${startRow}:${amt100Let}${endRow})`, result: subAmt100 };
                        totalRow.getCell(amt85Col).value = { formula: `SUM(${amt85Let}${startRow}:${amt85Let}${endRow})`, result: subAmt100 * s1Factor };
                        totalRow.getCell(amt10Col).value = { formula: `SUM(${amt10Let}${startRow}:${amt10Let}${endRow})`, result: subAmt100 * s2Factor };
                        totalRow.getCell(amt5Col).value = { formula: `SUM(${amt5Let}${startRow}:${amt5Let}${endRow})`, result: subAmt100 * s3Factor };

                        totalRow.height = 26;

                        totalRow.eachCell((cell, colNum) => {
                            cell.fill = totalFill;
                            cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
                            cell.border = {
                                top: { style: 'medium', color: { argb: 'FF222222' } },
                                bottom: { style: 'double', color: { argb: 'FF222222' } },
                                left: { style: 'thin', color: { argb: 'FF888888' } },
                                right: { style: 'thin', color: { argb: 'FF888888' } }
                            };
                            if (colNum >= amt100Col) {
                                cell.numFmt = '#,##0.00';
                                cell.alignment = { horizontal: 'right', vertical: 'middle' };
                            }
                        });
                        totalRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
                        rowIdx++;
                    };

                    renderTable(regularMats, false);

                    if (extraMats.length > 0) {
                        rowIdx++; // Empty row gap between tables
                        renderTable(extraMats, true);
                    }

                    let widths = [{ width: 8 }, { width: 50 }, { width: 8 }];
                    this.getActLocations(actKey).forEach(() => widths.push({ width: 16 }));
                    widths.push({ width: 14 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 16 });
                    ws.columns = widths;
                },

                exportCurrentActivityStyledExcel() {
                    this.exportExcelWithExcelJS('single_activity');
                },

                exportMasterAbstractStyledExcel() {
                    this.exportExcelWithExcelJS('abstract_only');
                },

                exportMasterWorkbookStyledExcel() {
                    this.exportExcelWithExcelJS('all_activities');
                }
};
