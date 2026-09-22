/**
 * @file Utility Functions
 * @description Common utility functions: formatting, calculations, navigation, toasts.
 *
 * @module UtilsModule
 * @since v2.0
 */

window.UtilsModule = {
                formatCurrency(val) {
                    if (val === undefined || val === null || isNaN(val)) return '0.00';
                    return Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                },
                evalFormula(input) {
                    if (typeof input !== 'string') return input;
                    const trimmed = input.trim();
                    if (!trimmed.startsWith('=') && !trimmed.startsWith('+')) return input;
                    const expr = trimmed.slice(1).trim();
                    if (!expr) return input;
                    try {
                        const sanitized = expr.replace(/[^0-9+\-*/().,% ]/g, '');
                        if (!sanitized || /[+\-*/]{2,}/.test(sanitized.replace(/\s/g, ''))) return input;
                        const result = Function('"use strict"; return (' + sanitized + ')')();
                        if (typeof result === 'number' && isFinite(result)) {
                            return Math.round(result * 100) / 100;
                        }
                        return input;
                    } catch (e) {
                        return input;
                    }
                },
                handleFormulaBlur(field, event) {
                    const val = event.target.value;
                    if (typeof val === 'string' && (val.startsWith('=') || val.startsWith('+'))) {
                        const result = this.evalFormula(val);
                        if (result !== val) {
                            this[field] = result;
                            event.target.value = result;
                        }
                    }
                },
                handleItemFormulaBlur(item, field, event) {
                    const val = event.target.value;
                    if (typeof val === 'string' && (val.startsWith('=') || val.startsWith('+'))) {
                        const result = this.evalFormula(val);
                        if (result !== val) {
                            item[field] = Number(result);
                            event.target.value = result;
                        }
                    }
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
                    let targetRow = rowIdx;
                    let targetLoc = locIdx;
                    if (direction === 'down') {
                        targetRow = rowIdx + 1;
                    } else if (direction === 'up') {
                        targetRow = rowIdx - 1;
                    }
                    this.$nextTick(() => {
                        const targetEl = document.querySelector(`input[data-row="${targetRow}"][data-loc="${targetLoc}"]`);
                        if (targetEl) {
                            targetEl.focus();
                            targetEl.select();
                        }
                    });
                },
                handleAbstractKeyNav(event, actIdx, colType, direction) {
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
                        if (this.invoiceData.autoSync) {
                            this.updateSyncTaxInvoiceFromActivities();
                        }
                    }
                },
                printView() {
                    window.print();
                }
};

/**
 * Convert 1-based column index to Excel-style letter(s) (1→A, 27→AA, etc.)
 * @param {number} colIdx
 * @returns {string}
 */
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
