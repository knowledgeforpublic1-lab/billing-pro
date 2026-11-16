/**
 * @file SAP Code & Work Order Mapping Module
 * @description Manages contractor Document Headers (Work Orders) and Vendor Codes.
 * Provides interactive listing, searching, editing, adding, and deleting
 * of SAP Code mappings directly from the UI with persistence in storage.
 *
 * @module SapWorkOrdersModule
 * @since v6.0
 */

window.SapWorkOrdersModule = {
    openAddSapWoModal() {
        if (!this.isPortalUnlocked) return;
        this.newSapWoForm = { docHeader: '', contractorName: '', vendorCode: '' };
        this.showAddSapWoModal = true;
    },

    submitAddSapWorkOrder() {
        const dh = String(this.newSapWoForm.docHeader || '').trim();
        const name = String(this.newSapWoForm.contractorName || '').trim();
        const vendor = String(this.newSapWoForm.vendorCode || '').trim();
        if (!dh) {
            alert('Document Header / Work Order No zaroori hai!');
            return;
        }
        if (!name) {
            alert('Contractor Name zaroori hai!');
            return;
        }
        const groupKey = window.StockImporterModule ? window.StockImporterModule.normContractorName(name) : name.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (!this.customSapWorkOrders) this.customSapWorkOrders = {};
        this.customSapWorkOrders[dh] = {
            docHeader: dh,
            contractorName: name,
            vendorCode: vendor,
            groupKey: groupKey,
            updatedAt: new Date().toISOString()
        };

        // Update runtime MasterSapCodeMapping immediately
        if (window.MasterSapCodeMapping) {
            if (!window.MasterSapCodeMapping.byDocHeader) window.MasterSapCodeMapping.byDocHeader = {};
            if (!window.MasterSapCodeMapping.dhToGroupKey) window.MasterSapCodeMapping.dhToGroupKey = {};
            if (!window.MasterSapCodeMapping.woToGroupKey) window.MasterSapCodeMapping.woToGroupKey = {};
            if (!window.MasterSapCodeMapping.groups) window.MasterSapCodeMapping.groups = {};

            window.MasterSapCodeMapping.byDocHeader[dh] = {
                docHeader: dh,
                vendorCode: vendor,
                contractorName: name,
                groupKey: groupKey
            };
            window.MasterSapCodeMapping.dhToGroupKey[dh] = groupKey;
            const m = dh.match(/^\s*(\d{8})\s*$/);
            if (m) window.MasterSapCodeMapping.woToGroupKey[m[1]] = groupKey;

            if (!window.MasterSapCodeMapping.groups[groupKey]) {
                window.MasterSapCodeMapping.groups[groupKey] = {
                    key: groupKey,
                    displayName: name,
                    vendorCode: vendor,
                    wos: [],
                    dhs: [dh],
                    rawNorms: [groupKey]
                };
            }
            if (!window.MasterSapCodeMapping.groups[groupKey].dhs.includes(dh)) {
                window.MasterSapCodeMapping.groups[groupKey].dhs.push(dh);
            }
            if (m && !window.MasterSapCodeMapping.groups[groupKey].wos.includes(m[1])) {
                window.MasterSapCodeMapping.groups[groupKey].wos.push(m[1]);
            }
        }

        this.saveCustomSapWorkOrders();
        this.showAddSapWoModal = false;
        if (typeof this.showToast === 'function') {
            this.showToast('Work Order ' + dh + ' (' + name + ') added!', '✅');
        }
    },

    startEditSapWorkOrder(item) {
        this.sapWoEditingKey = item.docHeader;
        this.sapWoEditForm = {
            docHeader: item.docHeader,
            contractorName: item.contractorName,
            vendorCode: item.vendorCode
        };
    },

    cancelEditSapWorkOrder() {
        this.sapWoEditingKey = null;
        this.sapWoEditForm = { docHeader: '', contractorName: '', vendorCode: '' };
    },

    saveEditSapWorkOrder(origDocHeader) {
        const dh = String(this.sapWoEditForm.docHeader || '').trim();
        const name = String(this.sapWoEditForm.contractorName || '').trim();
        const vendor = String(this.sapWoEditForm.vendorCode || '').trim();
        if (!dh || !name) {
            alert('WO No aur Contractor Name dono zaroori hain!');
            return;
        }
        const groupKey = window.StockImporterModule ? window.StockImporterModule.normContractorName(name) : name.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (!this.customSapWorkOrders) this.customSapWorkOrders = {};
        if (origDocHeader !== dh) {
            this.customSapWorkOrders[origDocHeader] = { deleted: true };
            if (window.MasterSapCodeMapping && window.MasterSapCodeMapping.byDocHeader) {
                delete window.MasterSapCodeMapping.byDocHeader[origDocHeader];
                delete window.MasterSapCodeMapping.dhToGroupKey[origDocHeader];
            }
        }
        this.customSapWorkOrders[dh] = {
            docHeader: dh,
            contractorName: name,
            vendorCode: vendor,
            groupKey: groupKey,
            updatedAt: new Date().toISOString()
        };
        if (window.MasterSapCodeMapping) {
            if (!window.MasterSapCodeMapping.byDocHeader) window.MasterSapCodeMapping.byDocHeader = {};
            if (!window.MasterSapCodeMapping.dhToGroupKey) window.MasterSapCodeMapping.dhToGroupKey = {};
            window.MasterSapCodeMapping.byDocHeader[dh] = {
                docHeader: dh,
                vendorCode: vendor,
                contractorName: name,
                groupKey: groupKey
            };
            window.MasterSapCodeMapping.dhToGroupKey[dh] = groupKey;
        }
        this.saveCustomSapWorkOrders();
        this.sapWoEditingKey = null;
        if (typeof this.showToast === 'function') {
            this.showToast('Work Order ' + dh + ' updated!', '✅');
        }
    },

    deleteSapWorkOrder(docHeader) {
        if (!confirm('Kya aap sach me Work Order ' + docHeader + ' ki mapping hatana chahte hain?')) return;
        if (!this.customSapWorkOrders) this.customSapWorkOrders = {};
        this.customSapWorkOrders[docHeader] = { deleted: true };
        if (window.MasterSapCodeMapping && window.MasterSapCodeMapping.byDocHeader) {
            delete window.MasterSapCodeMapping.byDocHeader[docHeader];
            delete window.MasterSapCodeMapping.dhToGroupKey[docHeader];
        }
        this.saveCustomSapWorkOrders();
        if (typeof this.showToast === 'function') {
            this.showToast('Work Order ' + docHeader + ' deleted', '🗑️');
        }
    },

    resetSapWorkOrdersToDefault() {
        if (!confirm('Kya aap sabhi custom SAP Work Order updates reset karke official default master restore karna chahte hain?')) return;
        this.customSapWorkOrders = {};
        try {
            localStorage.removeItem('lk_billing_custom_sap_wo_mapping_v1');
            if (window.BillingStorage && window.BillingStorage.removeItem) {
                window.BillingStorage.removeItem('lk_billing_custom_sap_wo_mapping_v1');
            }
        } catch(e) {}
        if (window.MasterSapCodeMapping && window.MasterSapCodeMapping.__original) {
            window.MasterSapCodeMapping = JSON.parse(JSON.stringify(window.MasterSapCodeMapping.__original));
        }
        if (typeof this.showToast === 'function') {
            this.showToast('SAP Work Orders reset to official master default!', '↺');
        }
    },

    saveCustomSapWorkOrders() {
        try {
            const data = JSON.stringify(this.customSapWorkOrders || {});
            localStorage.setItem('lk_billing_custom_sap_wo_mapping_v1', data);
            if (window.BillingStorage && window.BillingStorage.setItem) {
                window.BillingStorage.setItem('lk_billing_custom_sap_wo_mapping_v1', data);
            }
        } catch(e) {
            console.warn('Could not save custom SAP work orders:', e);
        }
    },

    loadCustomSapWorkOrders() {
        try {
            let data = null;
            if (window.BillingStorage && window.BillingStorage.getItem) {
                data = window.BillingStorage.getItem('lk_billing_custom_sap_wo_mapping_v1');
            }
            if (!data) data = localStorage.getItem('lk_billing_custom_sap_wo_mapping_v1');
            if (data) {
                const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                this.customSapWorkOrders = parsed || {};
                if (window.MasterSapCodeMapping) {
                    for (const [dh, item] of Object.entries(this.customSapWorkOrders)) {
                        if (item.deleted) {
                            if (window.MasterSapCodeMapping.byDocHeader) delete window.MasterSapCodeMapping.byDocHeader[dh];
                            if (window.MasterSapCodeMapping.dhToGroupKey) delete window.MasterSapCodeMapping.dhToGroupKey[dh];
                        } else {
                            if (!window.MasterSapCodeMapping.byDocHeader) window.MasterSapCodeMapping.byDocHeader = {};
                            if (!window.MasterSapCodeMapping.dhToGroupKey) window.MasterSapCodeMapping.dhToGroupKey = {};
                            window.MasterSapCodeMapping.byDocHeader[dh] = {
                                docHeader: dh,
                                vendorCode: item.vendorCode || '',
                                contractorName: item.contractorName || '',
                                groupKey: item.groupKey || ''
                            };
                            window.MasterSapCodeMapping.dhToGroupKey[dh] = item.groupKey || '';
                        }
                    }
                }
            }
        } catch(e) {
            console.warn('Could not load custom SAP work orders:', e);
        }
    }
};
