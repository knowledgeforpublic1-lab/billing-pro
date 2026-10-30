/**
 * @file Utility Functions
 * @description Common utility functions: formatting, calculations, navigation, toasts.
 *
 * @module UtilsModule
 * @since v2.0
 */

window.UtilsModule = {
    formatDateToDDMMYYYY(val) {
        if (!val) return '';
        if (val instanceof Date && !isNaN(val)) {
            const d = String(val.getDate()).padStart(2, '0');
            const m = String(val.getMonth() + 1).padStart(2, '0');
            const y = val.getFullYear();
            return `${d}-${m}-${y}`;
        }
        const s = String(val).trim();
        // YYYY-MM-DD or YYYY/MM/DD
        const isoMatch = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
        if (isoMatch) {
            const y = isoMatch[1];
            const m = isoMatch[2].padStart(2, '0');
            const d = isoMatch[3].padStart(2, '0');
            return `${d}-${m}-${y}`;
        }
        // DD-MM-YYYY or DD/MM/YYYY
        const dmyMatch = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
        if (dmyMatch) {
            const d = dmyMatch[1].padStart(2, '0');
            const m = dmyMatch[2].padStart(2, '0');
            const y = dmyMatch[3];
            return `${d}-${m}-${y}`;
        }
        return s;
    },
    normalizeDateToYYYYMMDD(val) {
        if (!val) return '';
        if (val instanceof Date && !isNaN(val)) {
            const y = val.getFullYear();
            const m = String(val.getMonth() + 1).padStart(2, '0');
            const d = String(val.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        const s = String(val).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const isoMatch = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
        if (isoMatch) {
            return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
        }
        const dmyMatch = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
        if (dmyMatch) {
            return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
        }
        return s;
    },
                formatCurrency(val) {
                    if (val === undefined || val === null || isNaN(val)) return '0.00';
                    return Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                },
                evalFormula(input) {
                    if (input === undefined || input === null) return 0;
                    if (typeof input === 'number') return isFinite(input) ? input : 0;
                    const str = String(input).trim();
                    if (!str) return '';

                    const isFormula = str.startsWith('=') || str.startsWith('+');
                    let expr = isFormula ? str.slice(1).trim() : str;
                    if (!expr) return 0;

                    // Pure numbers (e.g. "125", "12.5", "-5")
                    if (/^[+-]?\d+(?:\.\d+)?$/.test(expr)) {
                        return parseFloat(expr);
                    }

                    // If not an explicit formula and has no math operators, return number or text
                    if (!isFormula && !/[+\-*/()]/.test(expr)) {
                        const num = parseFloat(str);
                        return isNaN(num) ? str : num;
                    }

                    try {
                        let clean = expr.replace(/,/g, '');
                        clean = clean.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)');
                        clean = clean.replace(/(\d)\s*[xX]\s*(\d)/g, '$1*$2');
                        if (!/^[0-9+\-*/().\s]+$/.test(clean)) {
                            return str;
                        }
                        if (/[+\-*/]{3,}/.test(clean.replace(/\s/g, ''))) {
                            return str;
                        }
                        const result = Function('"use strict"; return (' + clean + ')')();
                        if (typeof result === 'number' && isFinite(result)) {
                            return Math.round(result * 10000) / 10000;
                        }
                        return str;
                    } catch (e) {
                        if (typeof this.showToast === 'function' && isFormula) {
                            this.showToast('Formula error: ' + str, '⚠️');
                        }
                        return isNaN(Number(str)) ? str : Number(str);
                    }
                },
                commitGridFormula(event, rowIdx, locIdx) {
                    if (!event || !event.target) return;
                    const rawVal = event.target.value;
                    if (rawVal === '' || rawVal === null || rawVal === undefined) {
                        if (this.activityQuantities[this.selectedActivityKey] && this.activityQuantities[this.selectedActivityKey][locIdx]) {
                            this.activityQuantities[this.selectedActivityKey][locIdx][rowIdx] = '';
                        }
                        this.saveToStorage();
                        return;
                    }
                    const evaluated = this.evalFormula(rawVal);
                    const finalVal = (evaluated === '' || isNaN(evaluated)) ? '' : evaluated;
                    if (this.activityQuantities[this.selectedActivityKey] && this.activityQuantities[this.selectedActivityKey][locIdx]) {
                        this.activityQuantities[this.selectedActivityKey][locIdx][rowIdx] = finalVal;
                    }
                    event.target.value = finalVal;
                    this.saveToStorage();
                },
                onQtyCellBlur(event, rowIdx, locIdx) {
                    this.commitGridFormula(event, rowIdx, locIdx);
                },
                onQtyCellChange(event, rowIdx, locIdx) {
                    this.commitGridFormula(event, rowIdx, locIdx);
                },
                handleFormulaBlur(field, event) {
                    const val = event.target.value;
                    const result = this.evalFormula(val);
                    const num = Number(result);
                    const finalVal = isNaN(num) ? 0 : num;
                    this[field] = finalVal;
                    event.target.value = finalVal;
                    this.saveToStorage();
                },
                handleItemFormulaBlur(item, field, event) {
                    if (!item || !field || !event || !event.target) return;
                    const val = event.target.value;
                    const result = this.evalFormula(val);
                    const num = Number(result);
                    const finalVal = isNaN(num) ? 0 : num;
                    item[field] = finalVal;
                    event.target.value = finalVal;
                    this.saveToStorage();
                },
                onProjectMetaFormulaChange(field, event) {
                    if (!event || !event.target || !this.projectMeta) return;
                    const val = this.evalFormula(event.target.value);
                    const num = Number(val);
                    const finalVal = isNaN(num) ? 0 : num;
                    this.projectMeta[field] = finalVal;
                    event.target.value = finalVal;
                    this.saveToStorage();
                },
                onMasterAbstractQtyChange(act, event) {
                    if (!act || !event || !event.target) return;
                    const val = this.evalFormula(event.target.value);
                    const num = Number(val);
                    const finalVal = isNaN(num) ? 0 : num;
                    act.qty = finalVal;
                    event.target.value = finalVal;
                    this.saveToStorage();
                },
                amountInWordsIndian(val) {
                    return numberToWordsIndian(val);
                },
                showToast(msg, icon = '✅') {
                    const toast = { msg, icon };
                    this.toasts.push(toast);
                    setTimeout(() => {
                        const idx = this.toasts.indexOf(toast);
                        if (idx > -1) this.toasts.splice(idx, 1);
                    }, 3500);
                },
                handleGridKeyNav(event, rowIdx, locIdx, direction) {
                    if (event && event.target) {
                        this.commitGridFormula(event, rowIdx, locIdx);
                    }
                    let targetRow = rowIdx;
                    let targetLoc = locIdx;
                    if (direction === 'down') {
                        targetRow = rowIdx + 1;
                    } else if (direction === 'up') {
                        targetRow = rowIdx - 1;
                    } else if (direction === 'right') {
                        targetLoc = locIdx + 1;
                    } else if (direction === 'left') {
                        targetLoc = locIdx - 1;
                    }
                    const locs = this.getActLocations(this.selectedActivityKey);
                    if (targetLoc < 0) targetLoc = 0;
                    if (targetLoc >= locs.length) targetLoc = locs.length - 1;
                    this.$nextTick(() => {
                        const targetEl = document.querySelector(`input[data-row="${targetRow}"][data-loc="${targetLoc}"]`);
                        if (targetEl) {
                            targetEl.focus();
                            targetEl.select();
                        }
                    });
                },
                handleGridPaste(event, startRowIdx, startLocIdx) {
                    if (this.isFinalized) { this.showToast('Bill locked — unlock to edit', '🔒'); return; }
                    const text = (event.clipboardData || window.clipboardData).getData('text');
                    if (!text) return;
                    event.preventDefault();
                    const rows = text.split(/\r?\n/).filter(r => r.length > 0);
                    const actKey = this.selectedActivityKey;
                    const locs = this.getActLocations(actKey);
                    const act = this.activities[actKey];
                    if (!act || !act.materials || !locs.length) return;
                    if (!this.activityQuantities[actKey]) {
                        this.initQuantitiesForActivity(actKey);
                    }
                    let pasted = 0;
                    const flashed = [];
                    for (let r = 0; r < rows.length; r++) {
                        const cells = rows[r].split('\t');
                        const matIdx = startRowIdx + r;
                        for (let c = 0; c < cells.length; c++) {
                            const locIdx = startLocIdx + c;
                            if (locIdx >= locs.length) break;
                            if (!this.activityQuantities[actKey][locIdx]) {
                                this.activityQuantities[actKey][locIdx] = new Array(act.materials.length).fill('');
                            }
                            if (matIdx >= act.materials.length) break;
                            const raw = cells[c].trim().replace(/,/g, '');
                            const evaluated = this.evalFormula(raw);
                            const val = (raw === '' || evaluated === '') ? '' : Number(evaluated);
                            if (raw === '' || !isNaN(val)) {
                                this.activityQuantities[actKey][locIdx][matIdx] = (raw === '' || evaluated === '') ? '' : val;
                                pasted++;
                                if (raw !== '') flashed.push([matIdx, locIdx]);
                            }
                        }
                    }
                    if (pasted > 0) {
                        this.showToast(`Pasted ${pasted} values`, '📋');
                        this.debouncedSave();
                        const nextRow = Math.min(startRowIdx + rows.length, (act.materials || []).length - 1);
                        this.$nextTick(() => {
                            flashed.forEach(([fr, fl]) => {
                                const cell = document.querySelector(`input[data-row="${fr}"][data-loc="${fl}"]`);
                                if (cell) {
                                    cell.classList.remove('cell-flash');
                                    void cell.offsetWidth;
                                    cell.classList.add('cell-flash');
                                    setTimeout(() => cell.classList.remove('cell-flash'), 950);
                                }
                            });
                            const el = document.querySelector(`input[data-row="${nextRow}"][data-loc="${startLocIdx}"]`);
                            if (el) { el.focus(); el.select(); }
                        });
                    }
                },
                handleAbstractKeyNav(event, actIdx, colType, direction) {
                    if (event && event.target) {
                        const act = this.masterAbstractList && this.masterAbstractList[actIdx];
                        if (act) this.onMasterAbstractQtyChange(act, event);
                    }
                    let targetRow = actIdx;
                    if (direction === 'down') {
                        targetRow = actIdx + 1;
                    } else if (direction === 'up') {
                        targetRow = actIdx - 1;
                    }
                    this.$nextTick(() => {
                        const targetEl = document.querySelector(`input[data-abs-row="${targetRow}"][data-abs-col="${colType}"]`);
                        if (targetEl) {
                            targetEl.focus();
                            targetEl.select();
                        }
                    });
                },
                switchView(viewName) {
                    this.currentView = viewName;
                    try { localStorage.setItem('billing_current_view', viewName); } catch(e) {}
                    if (viewName === 'invoice') {
                        // Ensure contractor name is populated only when a firm is actually selected
                        if (this.selectedContractorId && this.selectedContractorId !== 'custom' && this.invoiceData && (!this.invoiceData.contractorName || this.invoiceData.contractorName === 'CONTRACTOR' || this.invoiceData.contractorName === 'M/s CONTRACTOR')) {
                            this.invoiceData.contractorName = this.getContractorDisplayName();
                        }
                        if (this.invoiceData && this.invoiceData.autoSync) {
                            this.updateSyncTaxInvoiceFromActivities();
                        }
                    }
                },
                printView() {
                    window.print();
                },
                getActivityCleanDesc(title) {
                    if (!title || typeof title !== 'string') return '';
                    const clean = title.replace(/^(?:Activity\s+)?([A-Za-z0-9]+)\s*:\s*/i, '').trim();
                    return clean || title;
                }
};

/**
 * Convert 1-based column index to Excel-style letter(s) (1→A, 27→AA, etc.)
 * @param {number} colIdx
 * @returns {string}
 */
window.getColLetter = getColLetter;
function getColLetter(colIdx) {
    let temp, letter = '';
    while (colIdx > 0) {
        temp = (colIdx - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        colIdx = Math.floor((colIdx - temp - 1) / 26);
    }
    return letter;
}

/**
 * Indian Number to Currency Words Converter
 * @param {number} num
 * @returns {string}
 */
function numberToWordsIndian(num) {
    if (!num || isNaN(num)) return 'Zero Rupees Only/-';
    num = Math.round(num);
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function inWords(n) {
        if ((n = n.toString()).length > 9) return 'overflow';
        const n_array = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
        if (!n_array) return '';
        let str = '';
        str += (n_array[1] != 0) ? (a[Number(n_array[1])] || b[n_array[1][0]] + ' ' + a[n_array[1][1]]) + 'Crore ' : '';
        str += (n_array[2] != 0) ? (a[Number(n_array[2])] || b[n_array[2][0]] + ' ' + a[n_array[2][1]]) + 'Lakh ' : '';
        str += (n_array[3] != 0) ? (a[Number(n_array[3])] || b[n_array[3][0]] + ' ' + a[n_array[3][1]]) + 'Thousand ' : '';
        str += (n_array[4] != 0) ? (a[Number(n_array[4])] || b[n_array[4][0]] + ' ' + a[n_array[4][1]]) + 'Hundred ' : '';
        str += (n_array[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n_array[5])] || b[n_array[5][0]] + ' ' + a[n_array[5][1]]) : '';
        return str;
    }
    const res = inWords(num);
    return res ? (res.trim() + ' Rupees Only/-') : 'Zero Rupees Only/-';
}
