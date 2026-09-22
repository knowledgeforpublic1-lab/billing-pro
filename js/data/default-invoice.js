/**
 * @file Default Invoice Data
 * @description Template invoice data with GST settings and item structure.
 * @global {Object} defaultInvoiceData
 * @readonly
 */

const defaultInvoiceData = {
    clientName: 'ASHOKA BUILDCON LTD.',
    clientAddress: 'S.No. 861, Ashoka House, Ashoka Marg, Wadala, Nashik. 422011',
    clientGstin: '27AABCA9292J1ZA',
    contractorName: 'M/s Ranjeet Singh',
    contractorGstin: '08CTZPS1380P1ZF',
    contractorPan: 'CTZPS1380P',
    invoiceNo: '',
    workOrderNo: '',
    workOrderDate: '',
    invoiceDate: '',
    divisionName: '',
    subDivName: '',
    locationName: '',
    feederName: '11 KV Yenapur, Gogaon',
    bankAccountName: 'M/s Ranjeet Singh',
    bankAccountNo: '746520110000351',
    bankIfsc: 'BKID0007465',
    bankName: 'Bank of India',
    gstType: 'CGST_SGST', // CGST_SGST (separate rows: CGST 9% + SGST 9%) or IGST (18%)
    gstManual: false, // true = user ne hath se GST type lock kiya, auto-rule skip hoga
    autoSync: true, // Auto-accumulate 85% of all billed activities into invoice
    items: [
        {
            srNo: '1',
            desc: '',
            unit: 'Nos',
            qty: 1,
            amount: 0
        }
    ]
};
