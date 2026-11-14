/** Convert conductor measurements only at the reconciliation boundary. */
window.RecoUnitModule = {
    isRecoKmUnit(unit) { return /^(?:km|kms|kilomet(?:er|re)s?)$/i.test(String(unit || '').replace(/[.\s]/g, '')); },
    getRecoTargetUnit(material, component) {
        const stock = typeof this.getContractorSapIssues === 'function' ? this.getContractorSapIssues() : null;
        const issued = stock && stock.materials && stock.materials[component && component.code];
        return issued && issued.uom || component && component.uom || material && (material.sapUom || material.unit) || 'No';
    },
    getRecoUnitDivisor(material, component, targetUnit) {
        const source = String(material && material.unit || '').replace(/[.\s]/g, '').toLowerCase();
        if (!/^(?:m|rm|rmt|mtr|mtrs|meter|meters|metre|metres|runningmeter|runningmetre)$/.test(source) || !this.isRecoKmUnit(targetUnit)) return 1;
        const master = (this.sapMaterialsMaster || []).find(row => String(row.code) === String(component && component.code));
        const text = [material.desc, material.sapDescription, component && component.desc, master && master.desc].filter(Boolean).join(' ');
        if (/\b(?:clamps?|connectors?|sleeves?|hardware|insulators?|lugs?)\b/i.test(text)) return 1;
        return /\bconductors?\b/i.test(text) && /\b(?:cover(?:ed)?|rabb?it)\b/i.test(text) ? 1000 : 1;
    },
    roundRecoQuantity(value, unit) {
        const scale = this.isRecoKmUnit(unit) ? 1000000 : 100;
        return Math.round((Number(value) || 0) * scale) / scale;
    },
    formatRecoQuantity(value, row) {
        return this.isRecoKmUnit(row && row.uom) ? String(this.roundRecoQuantity(value, row.uom)) : this.format2Dec(value);
    }
};
