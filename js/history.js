/**
 * @file History / Undo-Redo Module
 * @description Snapshot-based undo/redo system for all billing state changes.
 *
 * @module HistoryModule
 * @since v2.0
 */

window.HistoryModule = {
                takeSnapshot() {
                    if (this.isPerformingHistoryAction) return;
                    const snap = JSON.stringify({
                        activities: this.activities,
                        masterAbstractList: this.masterAbstractList,
                        activityQuantities: this.activityQuantities,
                        locations: this.locations,
                        activityLocations: this.activityLocations,
                        invoiceData: this.invoiceData,
                        projectMeta: this.projectMeta,
                        selectedCompanyId: this.selectedCompanyId,
                        contractorsList: this.contractorsList,
                        selectedContractorId: this.selectedContractorId,
                        pctStage1: this.pctStage1,
                        pctStage2: this.pctStage2,
                        pctStage3: this.pctStage3,
                        selectedActivityKey: this.selectedActivityKey,
                        currentView: this.currentView,
                        mappingLocks: this.mappingLocks
                    });
                    if (this.historyIndex >= 0 && this.historyStack[this.historyIndex] === snap) {
                        return;
                    }
                    if (this.historyIndex < this.historyStack.length - 1) {
                        this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
                    }
                    this.historyStack.push(snap);
                    if (this.historyStack.length > 50) {
                        this.historyStack.shift();
                    } else {
                        this.historyIndex++;
                    }
                    this.historyIndex = this.historyStack.length - 1;
                },
                undo() {
                    if (!this.canUndo || this.isFinalized) return;
                    this.historyIndex--;
                    this.applySnapshot(this.historyStack[this.historyIndex]);
                    this.showToast('↩️ Undo: Action reverted', '↩️');
                },
                redo() {
                    if (!this.canRedo || this.isFinalized) return;
                    this.historyIndex++;
                    this.applySnapshot(this.historyStack[this.historyIndex]);
                    this.showToast('↪️ Redo: Action re-applied', '↪️');
                },
                applySnapshot(snapStr) {
                    if (!snapStr) return;
                    this.isPerformingHistoryAction = true;
                    try {
                        const state = JSON.parse(snapStr);
                        if (state.activities) this.activities = JSON.parse(JSON.stringify(state.activities));
                        if (state.masterAbstractList) this.masterAbstractList = JSON.parse(JSON.stringify(state.masterAbstractList));
                        if (state.activityQuantities) this.activityQuantities = JSON.parse(JSON.stringify(state.activityQuantities));
                        if (state.locations) this.locations = JSON.parse(JSON.stringify(state.locations));
                        if (state.activityLocations) this.activityLocations = JSON.parse(JSON.stringify(state.activityLocations));
                        if (state.invoiceData) this.invoiceData = JSON.parse(JSON.stringify(state.invoiceData));
                        if (state.projectMeta) this.projectMeta = JSON.parse(JSON.stringify(state.projectMeta));
                        if (state.selectedCompanyId) this.selectedCompanyId = state.selectedCompanyId;
                        if (state.contractorsList && Array.isArray(state.contractorsList)) {
                            this.contractorsList = JSON.parse(JSON.stringify(state.contractorsList));
                        }
                        if (state.selectedContractorId) this.selectedContractorId = state.selectedContractorId;
                        if (state.pctStage1 !== undefined) this.pctStage1 = state.pctStage1;
                        if (state.pctStage2 !== undefined) this.pctStage2 = state.pctStage2;
                        if (state.pctStage3 !== undefined) this.pctStage3 = state.pctStage3;
                        if (state.selectedActivityKey && this.activities[state.selectedActivityKey]) {
                            this.selectedActivityKey = state.selectedActivityKey;
                        }
                        if (state.currentView) this.currentView = state.currentView;
                        if (state.mappingLocks) { this.mappingLocks = { rate: state.mappingLocks.rate !== false, sap: state.mappingLocks.sap !== false, qty: state.mappingLocks.qty !== false }; try { localStorage.setItem('lk_billing_mapping_locks_v1', JSON.stringify(this.mappingLocks)); } catch(e) {} }

                        // Direct save to storage without creating another history record
                        const dataToSave = {
                            isFinalized: this.isFinalized,
                            projectMeta: this.projectMeta,
                            selectedCompanyId: this.selectedCompanyId,
                            contractorsList: this.contractorsList,
                            selectedContractorId: this.selectedContractorId,
                            pctStage1: this.pctStage1,
                            pctStage2: this.pctStage2,
                            pctStage3: this.pctStage3,
                            locations: this.locations,
                            activityLocations: this.activityLocations,
                            activities: this.activities,
                            masterAbstractList: this.masterAbstractList,
                            activityQuantities: this.activityQuantities,
                            invoiceData: this.invoiceData,
                            mappingLocks: this.mappingLocks,
                            savedAt: Date.now(),
                            baseRev: this.cloudRev
                        };
                        localStorage.setItem('lk_billing_app_state_v10', JSON.stringify(dataToSave));
                        // Cloud sync tested path se — direct fire-and-forget POST me rev/hash stale reh jata tha,
                        // agla auto-sync 409 khakar cloudConflict me phas jata tha. scheduleMappingSync rev/hash/conflict sahi handle karta hai.
                        try { this.scheduleMappingSync(); } catch(e) { console.error("Undo sync schedule failed", e); }
                    } catch (e) {
                        console.error('Failed to apply history state', e);
                    } finally {
                        this.$nextTick(() => {
                            this.isPerformingHistoryAction = false;
                        });
                    }
                }
};
