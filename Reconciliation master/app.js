let rawData = null;
let currentTab = 'overview';
let topConsChart = null;
let topBalChart = null;

// Pagination configuration
const paginationLimit = 50;
const pageState = {
    contractor: 1,
    material: 1,
    debit: 1,
    alerts: 1
};

// Global Refresh Function
function refreshAppData() {
    try {
        localStorage.clear();
    } catch(e){}
    window.location.href = window.location.pathname + '?t=' + Date.now();
}

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    try {
        let savedData = localStorage.getItem('materialAppData');
        
        // Auto-detect and purge stale cached data from localStorage
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                const mb = parsed.Contractors && parsed.Contractors.find(c => c.ContractorName && c.ContractorName.toLowerCase().includes('bhawani'));
                if (mb && mb.Items && mb.Items.filter(i => i.Consumption > 0).length === 0) {
                    console.log('Outdated cache detected. Purging old localStorage data...');
                    localStorage.removeItem('materialAppData');
                    savedData = null;
                }
            } catch(e) {
                localStorage.removeItem('materialAppData');
                savedData = null;
            }
        }
        
        // Check embedded DATA (from data.js)
        if (typeof DATA !== 'undefined' && DATA) {
            if (savedData) {
                try {
                    const parsedSaved = JSON.parse(savedData);
                    // If embedded DATA is newer than cached localStorage, update cache
                    if (!parsedSaved.ExtractedAt || (DATA.ExtractedAt && new Date(DATA.ExtractedAt) >= new Date(parsedSaved.ExtractedAt))) {
                        console.log('Loaded updated data from embedded DATA (data.js)');
                        rawData = DATA;
                        localStorage.removeItem('materialAppData');
                    } else {
                        console.log('Loaded freshest uploaded data from localStorage');
                        rawData = parsedSaved;
                    }
                } catch(e) {
                    rawData = DATA;
                    localStorage.removeItem('materialAppData');
                }
            } else {
                rawData = DATA;
                console.log('Loaded data from embedded DATA (data.js)');
            }
        } else if (savedData) {
            try {
                rawData = JSON.parse(savedData);
                console.log('Loaded data from localStorage');
            } catch(e) {
                rawData = null;
                localStorage.removeItem('materialAppData');
            }
        }
        
        if (!rawData) {
            try {
                const response = await fetch('data.json?t=' + new Date().getTime()); // Prevent caching
                if (response.ok) {
                    rawData = await response.json();
                    console.log('Loaded data from data.json (fetched)');
                } else {
                    rawData = null;
                }
            } catch (e) {
                rawData = null;
            }
        }
        
        if (rawData) {
            console.log('Loaded Data:', rawData);
            setupNavigation();
            setupFilters();
            populateDropdowns();
            
            // Restore active tab and contractor selection
            const savedContractor = localStorage.getItem('selectedContractor');
            if (savedContractor) {
                const contractorSelect = document.getElementById('contractorSelect');
                if (contractorSelect) {
                    contractorSelect.value = savedContractor;
                }
            }

            const savedTab = localStorage.getItem('activeTab') || 'overview';
            const tabBtn = document.querySelector(`.tab-btn[data-tab="${savedTab}"]`);
            if (tabBtn) {
                tabBtn.click(); // This will trigger the render function for that tab
            } else {
                renderOverview();
            }
        } else {
            console.log('No data found, please upload an Excel file.');
            const kpiGrid = document.querySelector('.kpi-grid');
            if(kpiGrid) {
                kpiGrid.innerHTML = '<div style="grid-column: 1 / -1; padding: 40px; text-align: center; background: white; border-radius: 8px; border: 1px solid #e2e8f0; color: #64748b;"><h3>Data Not Found</h3><p>Please click on "Upload Excel" at the top right to upload the contractor details and populate the dashboard.</p></div>';
            }
        }
    } catch (err) {
        console.error('Error loading data:', err);
    }
});

// Navigation Handling
function setupNavigation() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const target = btn.dataset.tab;
            currentTab = target;
            localStorage.setItem('activeTab', target);
            
            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            document.getElementById(`tab-${target}`).style.display = 'block';
            
            if (target === 'overview') renderOverview();
            else if (target === 'contractor') renderContractorView();
            else if (target === 'material') renderMaterialView();
            else if (target === 'debit') renderDebitView();
            else if (target === 'alerts') renderAlertsView();
            else if (target === 'reports') renderReportsView();
        });
    });
}

// Formatters
function formatCurrency(val) {
    const num = parseFloat(val) || 0;
    return '₹ ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNum(val) {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

// KPI count-up — dashboard numbers 0 se gin kar aate hain
function animateKpiValue(id, target, formatter) {
    const el = document.getElementById(id);
    if (!el) return;
    try {
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            el.textContent = formatter(target);
            return;
        }
    } catch(e) {}
    const dur = 900, t0 = performance.now();
    function frame(t) {
        const p = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = formatter(target * e);
        if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

// Populate Select Dropdowns
let materialOptionsData = []; // store for search/filter
let selectedMaterials = new Set(); // track selected material keys

function populateDropdowns() {
    const contractorSelect = document.getElementById('contractorSelect');
    
    if (contractorSelect && rawData.Contractors) {
        contractorSelect.innerHTML = '<option value="">-- All Contractors --</option>';
        rawData.Contractors.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.ContractorName;
            opt.textContent = `${c.ContractorName} (${c.ItemCount} items)`;
            contractorSelect.appendChild(opt);
        });
    }
    
    // Build material options for custom multi-select
    if (rawData.Contractors) {
        const matMap = new Map();
        rawData.Contractors.forEach(c => {
            c.Items.forEach(i => {
                const code = i.ItemCode ? i.ItemCode.trim() : '';
                const desc = i.ItemDescription ? i.ItemDescription.trim() : '';
                
                if (code || desc) {
                    const uniqueKey = code ? code : desc;
                    if (!matMap.has(uniqueKey)) {
                        let label = '';
                        if (code && desc) label = `[${code}] ${desc}`;
                        else if (code) label = `[${code}] Unspecified Material`;
                        else label = desc;
                        
                        matMap.set(uniqueKey, { code, desc, label, key: uniqueKey });
                    }
                }
            });
        });
        
        materialOptionsData = Array.from(matMap.values()).sort((a, b) => a.label.localeCompare(b.label));
        renderMaterialOptions();
        setupMultiSelect();
    }
}

// Render material options in the dropdown
function renderMaterialOptions(filterText = '') {
    const container = document.getElementById('materialOptions');
    if (!container) return;
    container.innerHTML = '';
    
    const search = filterText.toLowerCase().trim();
    let visibleCount = 0;
    
    materialOptionsData.forEach(m => {
        const matchesSearch = !search || 
            m.label.toLowerCase().includes(search) || 
            m.code.toLowerCase().includes(search) || 
            m.desc.toLowerCase().includes(search);
        
        if (!matchesSearch) return;
        
        visibleCount++;
        
        const div = document.createElement('div');
        div.className = 'ms-option' + (selectedMaterials.has(m.key) ? ' selected' : '');
        div.dataset.key = m.key;
        div.dataset.code = m.code;
        div.dataset.desc = m.desc;
        div.dataset.label = m.label;
        
        div.innerHTML = `
            <div class="ms-checkbox">✓</div>
            <span class="ms-option-label">
                ${m.code ? `<span class="ms-option-code">[${m.code}]</span>` : ''}${m.desc || 'Unspecified Material'}
            </span>
        `;
        
        div.addEventListener('click', () => {
            toggleMaterialOption(m.key, div);
        });
        
        container.appendChild(div);
    });
    
    if (visibleCount === 0) {
        container.innerHTML = '<div class="ms-no-results">No materials found matching your search</div>';
    }
}

// Toggle a single material option
function toggleMaterialOption(key, optionEl) {
    if (selectedMaterials.has(key)) {
        selectedMaterials.delete(key);
        optionEl.classList.remove('selected');
    } else {
        selectedMaterials.add(key);
        optionEl.classList.add('selected');
    }
    updateMaterialTags();
    updateSelectedCount();
}

// Update the tags shown in the trigger
function updateMaterialTags() {
    const tagsContainer = document.getElementById('materialSelectedTags');
    tagsContainer.innerHTML = '';
    
    if (selectedMaterials.size === 0) {
        tagsContainer.innerHTML = '<span class="multi-select-placeholder">-- All Materials / Select Items --</span>';
        return;
    }
    
    const MAX_VISIBLE_TAGS = 3;
    let count = 0;
    
    for (const key of selectedMaterials) {
        if (count >= MAX_VISIBLE_TAGS) break;
        count++;
        
        const mat = materialOptionsData.find(m => m.key === key);
        if (!mat) continue;
        
        const tag = document.createElement('span');
        tag.className = 'ms-tag';
        
        const shortLabel = mat.label.length > 25 ? mat.label.substring(0, 22) + '...' : mat.label;
        tag.innerHTML = `${shortLabel} <span class="ms-tag-remove" data-key="${key}">×</span>`;
        
        tag.querySelector('.ms-tag-remove').addEventListener('click', (e) => {
            e.stopPropagation();
            selectedMaterials.delete(key);
            // Update option state in dropdown
            const optEl = document.querySelector(`.ms-option[data-key="${key}"]`);
            if (optEl) optEl.classList.remove('selected');
            updateMaterialTags();
            updateSelectedCount();
            renderMaterialView();
        });
        
        tagsContainer.appendChild(tag);
    }
    
    if (selectedMaterials.size > MAX_VISIBLE_TAGS) {
        const overflow = document.createElement('span');
        overflow.className = 'ms-tag ms-tag-overflow';
        overflow.textContent = `+${selectedMaterials.size - MAX_VISIBLE_TAGS} more`;
        tagsContainer.appendChild(overflow);
    }
}

// Update selected count in footer
function updateSelectedCount() {
    const countEl = document.getElementById('materialSelectedCount');
    if (countEl) {
        countEl.textContent = `${selectedMaterials.size} selected`;
    }
}

// Setup multi-select component interactions
function setupMultiSelect() {
    const trigger = document.getElementById('materialSelectTrigger');
    const dropdown = document.getElementById('materialDropdown');
    const searchInput = document.getElementById('materialDropdownSearch');
    const selectAllBtn = document.getElementById('materialSelectAll');
    const clearAllBtn = document.getElementById('materialClearAll');
    const applyBtn = document.getElementById('materialApplyFilter');
    
    // Toggle dropdown
    trigger.addEventListener('click', () => {
        const isOpen = dropdown.classList.contains('show');
        if (isOpen) {
            closeMultiSelectDropdown();
        } else {
            dropdown.classList.add('show');
            trigger.classList.add('active');
            searchInput.focus();
        }
    });
    
    // Search filter
    searchInput.addEventListener('input', () => {
        renderMaterialOptions(searchInput.value);
    });
    
    // Prevent dropdown close when clicking inside
    dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // Select All (visible only)
    selectAllBtn.addEventListener('click', () => {
        const visibleOptions = document.querySelectorAll('.ms-option:not(.hidden)');
        visibleOptions.forEach(opt => {
            const key = opt.dataset.key;
            selectedMaterials.add(key);
            opt.classList.add('selected');
        });
        // Also add items from materialOptionsData that match current search
        const search = searchInput.value.toLowerCase().trim();
        materialOptionsData.forEach(m => {
            const matchesSearch = !search || 
                m.label.toLowerCase().includes(search) || 
                m.code.toLowerCase().includes(search) || 
                m.desc.toLowerCase().includes(search);
            if (matchesSearch) selectedMaterials.add(m.key);
        });
        updateMaterialTags();
        updateSelectedCount();
    });
    
    // Clear All
    clearAllBtn.addEventListener('click', () => {
        selectedMaterials.clear();
        document.querySelectorAll('.ms-option.selected').forEach(opt => {
            opt.classList.remove('selected');
        });
        updateMaterialTags();
        updateSelectedCount();
    });
    
    // Apply Filter
    applyBtn.addEventListener('click', () => {
        closeMultiSelectDropdown();
        pageState.material = 1;
        renderMaterialView();
    });
    
    // Close on outside click
    document.addEventListener('click', (e) => {
        const wrapper = document.getElementById('materialMultiSelect');
        if (wrapper && !wrapper.contains(e.target)) {
            closeMultiSelectDropdown();
        }
    });
}

function closeMultiSelectDropdown() {
    const dropdown = document.getElementById('materialDropdown');
    const trigger = document.getElementById('materialSelectTrigger');
    if (dropdown) dropdown.classList.remove('show');
    if (trigger) trigger.classList.remove('active');
}


// 1. OVERVIEW DASHBOARD
function renderOverview() {
    if (!rawData) return;
    
    let totalContractors = rawData.ContractorCount || 0;
    let totalItemsTracked = 0;
    let totalNetIssueCost = 0;
    let totalBalanceCost = 0;
    let totalConsumptionQty = 0;
    
    const matConsMap = {};
    const contractorBalMap = {};
    
    rawData.Contractors.forEach(c => {
        let cBalCost = 0;
        c.Items.forEach(i => {
            totalItemsTracked++;
            const issueCost = i.NetIssue * i.DebitRate;
            totalNetIssueCost += issueCost;
            totalBalanceCost += i.BalanceCost;
            totalConsumptionQty += i.Consumption;
            cBalCost += i.BalanceCost;
            
            const matName = i.ItemDescription.trim().toUpperCase();
            matConsMap[matName] = (matConsMap[matName] || 0) + i.Consumption;
        });
        contractorBalMap[c.ContractorName] = cBalCost;
    });
    
    animateKpiValue('kpi-contractors', totalContractors, v => Math.round(v).toLocaleString('en-IN'));
    animateKpiValue('kpi-items', totalItemsTracked, v => Math.round(v).toLocaleString('en-IN'));
    animateKpiValue('kpi-issue-cost', totalNetIssueCost, formatCurrency);
    animateKpiValue('kpi-balance-cost', totalBalanceCost, formatCurrency);
    
    renderOverviewCharts(matConsMap, contractorBalMap);
}

function renderOverviewCharts(matConsMap, contractorBalMap) {
    // Top 8 Consumed Materials
    const topMats = Object.entries(matConsMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
        
    const matLabels = topMats.map(m => m[0].length > 25 ? m[0].substring(0, 22) + '...' : m[0]);
    const matData = topMats.map(m => m[1]);
    
    const ctx1 = document.getElementById('chartCons').getContext('2d');
    if (topConsChart) topConsChart.destroy();
    
    topConsChart = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: matLabels,
            datasets: [{
                label: 'Total Quantity Consumed / Erected',
                data: matData,
                backgroundColor: 'rgba(59, 130, 246, 0.75)',
                borderColor: '#3b82f6',
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 900, easing: 'easeOutQuart' },
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: '#1e293b', titleColor: '#fff', bodyColor: '#cbd5e1' }
            },
            scales: {
                x: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { display: false } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
    
    // Top 8 Contractors by Balance Liability
    const topContractors = Object.entries(contractorBalMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
        
    const conLabels = topContractors.map(c => c[0].length > 20 ? c[0].substring(0, 18) + '...' : c[0]);
    const conData = topContractors.map(c => c[1]);
    
    const ctx2 = document.getElementById('chartBal').getContext('2d');
    if (topBalChart) topBalChart.destroy();
    
    topBalChart = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: conLabels,
            datasets: [{
                data: conData,
                backgroundColor: [
                    '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
                    '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'
                ],
                borderWidth: 2,
                borderColor: '#151c2c'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { animateRotate: true, animateScale: true, duration: 900, easing: 'easeOutQuart' },
            onClick: (event, elements, chart) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const contractorName = topContractors[index][0];
                    openContractorModal(contractorName);
                }
            },
            plugins: {
                legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            return `${ctx.label}: ${formatCurrency(ctx.raw)}`;
                        }
                    }
                }
            }
        }
    });
}

// 2. CONTRACTOR VIEW
function renderContractorView() {
    const selected = document.getElementById('contractorSelect').value;
    const search = document.getElementById('contractorSearch').value.toLowerCase();
    const tbody = document.querySelector('#contractorTable tbody');
    const infoPanel = document.getElementById('contractorInfoPanel');
    tbody.innerHTML = '';
    
    if (!rawData) return;

    // Handle Contractor Info Card display
    if (selected) {
        const conData = rawData.Contractors.find(c => c.ContractorName === selected);
        if (conData && conData.Metadata) {
            const meta = conData.Metadata;
            
            const getStatusBadge = (status) => {
                if (!status) return `<span class="badge badge-info">N/A</span>`;
                let cls = 'badge-info';
                const s = status.toLowerCase();
                if (s.includes('active') || s === 'working' || s === 'y' || s === 'yes') {
                    cls = 'badge-success';
                } else if (s.includes('inactive') || s.includes('nonworking') || s === 'n' || s === 'no') {
                    cls = 'badge-danger';
                } else if (s.includes('notice') || s.includes('pending')) {
                    cls = 'badge-warning';
                }
                return `<span class="badge ${cls}">${status}</span>`;
            };

            infoPanel.innerHTML = `
                <div class="info-card-header">
                    <div class="info-card-title">
                        <h2>👷 ${conData.ContractorName}</h2>
                        <p class="subtitle">${meta.FirmName !== conData.ContractorName ? meta.FirmName : 'Sub-Contractor Statement'} | WO No: <strong>${meta.WONo || 'N/A'}</strong></p>
                    </div>
                    <div class="info-card-badges">
                        ${getStatusBadge(meta.ActiveStatus)}
                        ${getStatusBadge(meta.WorkingStatus)}
                        ${meta.ChequeSubmitted ? `<span class="badge badge-success">Cheque: ${meta.ChequeSubmitted}</span>` : ''}
                    </div>
                </div>
                <div class="info-card-grid">
                    <!-- Group 1: General Info -->
                    <div class="info-group">
                        <h4>General Details</h4>
                        <div class="info-item"><span>Owner/Contact:</span> <strong>${meta.OwnerName || 'N/A'}</strong></div>
                        <div class="info-item"><span>Phone Number:</span> <strong>${meta.ContactNumbers || 'N/A'}</strong></div>
                        <div class="info-item"><span>Office Address:</span> <span class="text-sm">${meta.Address || 'N/A'}</span></div>
                        <div class="info-item"><span>Supervisor/In-charge:</span> <span class="text-sm">${[meta.ProjectIncharge, meta.Supervisor].filter(Boolean).join(' / ') || 'N/A'}</span></div>
                    </div>

                    <!-- Group 2: Compliance & Registration -->
                    <div class="info-group">
                        <h4>Compliance & Registration</h4>
                        <div class="info-item"><span>GSTIN:</span> <code>${meta.GST || 'N/A'}</code></div>
                        <div class="info-item"><span>PAN:</span> <code>${meta.PAN || 'N/A'}</code></div>
                        <div class="info-item"><span>Aadhar No:</span> <code>${meta.Aadhar || 'N/A'}</code></div>
                        <div class="info-item"><span>PF Reg / Licence No:</span> <code>${[meta.PFRegNo, meta.LicenceNo].filter(Boolean).join(' / ') || 'N/A'}</code></div>
                    </div>

                    <!-- Group 3: Financial Summary -->
                    <div class="info-group">
                        <h4>Contract Value & Billing</h4>
                        <div class="info-item"><span>WO Value:</span> <strong>₹ ${formatNum(meta.WOValue)}</strong></div>
                        <div class="info-item"><span>Work Completed:</span> <strong class="text-success">₹ ${formatNum(meta.ValueWorkCompleted)}</strong></div>
                        <div class="info-item"><span>Total Payable:</span> <strong>₹ ${formatNum(meta.TotalPayableAmount)}</strong></div>
                        <div class="info-item"><span>Retention Amount:</span> <span class="text-sm">₹ ${formatNum(meta.Retention5 + meta.Retention10 + meta.Retention15)}</span></div>
                    </div>

                    <!-- Group 4: Liability & Risk -->
                    <div class="info-group">
                        <h4>Liability & Risk Alerts</h4>
                        <div class="info-item"><span>Balance Material Cost:</span> <strong class="${meta.BalanceMaterialCost > 0 ? 'text-warning' : 'text-success'}">₹ ${formatNum(meta.BalanceMaterialCost)}</strong></div>
                        <div class="info-item"><span>Recovery Amount:</span> <strong class="text-danger">₹ ${formatNum(meta.RecoveryAmount)}</strong></div>
                        <div class="info-item"><span>Physical Balance:</span> <strong>${meta.PhysicalMaterialBalance || 'N/A'}</strong></div>
                        <div class="info-item"><span>Notices Sent:</span> <span class="text-sm">${[meta.Notice1SentDate ? '1st Notice' : '', meta.Notice2SentDate ? '2nd Notice' : ''].filter(Boolean).join(', ') || 'None'}</span></div>
                    </div>
                </div>
                ${meta.Remarks ? `
                <div class="info-card-remarks">
                    <strong>Remarks & Tracking:</strong> <span>${meta.Remarks}</span>
                </div>
                ` : ''}
            `;
            infoPanel.style.display = 'block';
        } else {
            infoPanel.style.display = 'none';
        }
    } else {
        infoPanel.style.display = 'none';
    }
    
    let filteredContractors = rawData.Contractors;
    if (selected) {
        filteredContractors = filteredContractors.filter(c => c.ContractorName === selected);
    }
    
    let totalIssueCost = 0;
    let totalBalCost = 0;
    
    const rows = [];
    filteredContractors.forEach(c => {
        c.Items.forEach(i => {
            if (search && !c.ContractorName.toLowerCase().includes(search) &&
                !i.ItemDescription.toLowerCase().includes(search) &&
                !i.ItemCode.toLowerCase().includes(search)) {
                return;
            }
            
            totalIssueCost += (i.NetIssue * i.DebitRate);
            totalBalCost += i.BalanceCost;
            
            let statusBadge = '<span class="badge badge-success">Balanced</span>';
            if (i.BalanceQty > 0) statusBadge = '<span class="badge badge-warning">Stock Held</span>';
            else if (i.BalanceQty < 0) statusBadge = '<span class="badge badge-danger">Excess Erected</span>';
            
            rows.push({
                contractor: c.ContractorName,
                code: i.ItemCode || '-',
                desc: i.ItemDescription,
                uom: i.UOM || '-',
                rate: i.DebitRate,
                issued: i.IssuedQty,
                mrn: i.MRNQty,
                netIssue: i.NetIssue,
                consumption: i.Consumption,
                wip: i.WIP,
                theft: i.Theft,
                balanceQty: i.BalanceQty,
                balanceCost: i.BalanceCost,
                statusHtml: statusBadge
            });
        });
    });
    
    document.getElementById('cViewCount').textContent = rows.length;
    document.getElementById('cViewBalCost').textContent = formatCurrency(totalBalCost);

    // Render paginated page
    const tabKey = 'contractor';
    const limit = paginationLimit;
    const totalPages = Math.ceil(rows.length / limit) || 1;
    if (pageState[tabKey] > totalPages) pageState[tabKey] = totalPages;
    if (pageState[tabKey] < 1) pageState[tabKey] = 1;

    const startIdx = (pageState[tabKey] - 1) * limit;
    const endIdx = startIdx + limit;
    const pageRows = rows.slice(startIdx, endIdx);

    pageRows.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="hide-print"><strong>${r.contractor}</strong></td>
            <td><code>${r.code}</code></td>
            <td>${r.desc}</td>
            <td><span class="badge badge-info">${r.uom}</span></td>
            <td class="text-right">₹ ${formatNum(r.rate)}</td>
            <td class="text-right">${formatNum(r.issued)}</td>
            <td class="text-right">${formatNum(r.mrn)}</td>
            <td class="text-right font-bold">${formatNum(r.netIssue)}</td>
            <td class="text-right text-success">${formatNum(r.consumption)}</td>
            <td class="text-right text-info">${formatNum(r.wip)}</td>
            <td class="text-right text-danger">${formatNum(r.theft)}</td>
            <td class="text-right font-bold ${r.balanceQty > 0 ? 'text-warning' : (r.balanceQty < 0 ? 'text-danger' : '')}">${formatNum(r.balanceQty)}</td>
            <td class="text-right font-bold">${formatCurrency(r.balanceCost)}</td>
            <td class="text-center hide-print">${r.statusHtml}</td>
        `;
        tbody.appendChild(tr);
    });

    updatePaginationUI(tabKey, pageState[tabKey], totalPages);
}

// 3. MATERIAL RECONCILIATION VIEW
function renderMaterialView() {
    const tbody = document.querySelector('#materialTable tbody');
    tbody.innerHTML = '';
    
    if (!rawData) return;
    
    let totalNetIssue = 0;
    let totalCons = 0;
    let totalBal = 0;
    let totalBalCost = 0;
    
    const hasSelection = selectedMaterials.size > 0;
    
    const rows = [];
    rawData.Contractors.forEach(c => {
        c.Items.forEach(i => {
            const itemCode = (i.ItemCode || '').trim();
            const itemDesc = (i.ItemDescription || '').trim();
            
            // Multi-select filter: match selected items by code or description
            if (hasSelection) {
                const itemKey = itemCode ? itemCode : itemDesc;
                if (!selectedMaterials.has(itemKey)) return;
            }
            
            totalNetIssue += i.NetIssue;
            totalCons += i.Consumption;
            totalBal += i.BalanceQty;
            totalBalCost += i.BalanceCost;
            
            rows.push({
                contractor: c.ContractorName,
                code: i.ItemCode || '-',
                desc: i.ItemDescription,
                uom: i.UOM || '-',
                rate: i.DebitRate,
                netIssue: i.NetIssue,
                consumption: i.Consumption,
                wip: i.WIP,
                theft: i.Theft,
                balanceQty: i.BalanceQty,
                balanceCost: i.BalanceCost
            });
        });
    });
    
    document.getElementById('mSumIssue').textContent = formatNum(totalNetIssue);
    document.getElementById('mSumCons').textContent = formatNum(totalCons);
    document.getElementById('mSumBal').textContent = formatNum(totalBal);
    document.getElementById('mSumCost').textContent = formatCurrency(totalBalCost);

    // Render paginated page
    const tabKey = 'material';
    const limit = paginationLimit;
    const totalPages = Math.ceil(rows.length / limit) || 1;
    if (pageState[tabKey] > totalPages) pageState[tabKey] = totalPages;
    if (pageState[tabKey] < 1) pageState[tabKey] = 1;

    const startIdx = (pageState[tabKey] - 1) * limit;
    const endIdx = startIdx + limit;
    const pageRows = rows.slice(startIdx, endIdx);

    pageRows.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${r.contractor}</strong></td>
            <td><code>${r.code}</code></td>
            <td>${r.desc}</td>
            <td><span class="badge badge-info">${r.uom}</span></td>
            <td class="text-right">₹ ${formatNum(r.rate)}</td>
            <td class="text-right">${formatNum(r.netIssue)}</td>
            <td class="text-right text-success">${formatNum(r.consumption)}</td>
            <td class="text-right text-info">${formatNum(r.wip)}</td>
            <td class="text-right text-danger">${formatNum(r.theft)}</td>
            <td class="text-right font-bold ${r.balanceQty > 0 ? 'text-warning' : (r.balanceQty < 0 ? 'text-danger' : '')}">${formatNum(r.balanceQty)}</td>
            <td class="text-right font-bold">${formatCurrency(r.balanceCost)}</td>
        `;
        tbody.appendChild(tr);
    });

    updatePaginationUI(tabKey, pageState[tabKey], totalPages);
}

// 4. DEBIT RATE MASTER VIEW
function renderDebitView() {
    const search = document.getElementById('debitSearch').value.toLowerCase();
    const tbody = document.querySelector('#debitTable tbody');
    tbody.innerHTML = '';
    
    if (!rawData || !rawData.DebitRates) return;
    
    const rows = [];
    rawData.DebitRates.forEach(d => {
        if (search && !d.ItemCode.toLowerCase().includes(search) && !d.Description.toLowerCase().includes(search)) return;
        
        rows.push(d);
    });
    
    document.getElementById('debitCount').textContent = rows.length;

    // Render paginated page
    const tabKey = 'debit';
    const limit = paginationLimit;
    const totalPages = Math.ceil(rows.length / limit) || 1;
    if (pageState[tabKey] > totalPages) pageState[tabKey] = totalPages;
    if (pageState[tabKey] < 1) pageState[tabKey] = 1;

    const startIdx = (pageState[tabKey] - 1) * limit;
    const endIdx = startIdx + limit;
    const pageRows = rows.slice(startIdx, endIdx);

    pageRows.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><code>${r.ItemCode}</code></td>
            <td><strong>${r.Description}</strong></td>
            <td><span class="badge badge-info">${r.Unit}</span></td>
            <td class="text-right font-bold text-success">₹ ${formatNum(r.DebitRate)}</td>
        `;
        tbody.appendChild(tr);
    });

    updatePaginationUI(tabKey, pageState[tabKey], totalPages);
}

// 5. ALERTS & DISCREPANCY CENTER
function renderAlertsView() {
    const search = document.getElementById('alertSearch').value.toLowerCase();
    const alertType = document.getElementById('alertTypeSelect').value;
    const tbody = document.querySelector('#alertsTable tbody');
    tbody.innerHTML = '';
    
    if (!rawData) return;
    
    let totalRiskVal = 0;
    const rows = [];
    
    rawData.Contractors.forEach(c => {
        c.Items.forEach(i => {
            if (i.BalanceQty === 0) return; // skip balanced items
            
            if (alertType === 'holding' && i.BalanceQty <= 0) return;
            if (alertType === 'excess' && i.BalanceQty >= 0) return;
            
            if (search && !c.ContractorName.toLowerCase().includes(search) &&
                !i.ItemDescription.toLowerCase().includes(search)) return;
                
            totalRiskVal += Math.abs(i.BalanceCost);
            
            const isHolding = i.BalanceQty > 0;
            const badge = isHolding 
                ? '<span class="badge badge-warning">Unused Material Stock</span>' 
                : '<span class="badge badge-danger">Excess Consumption Deficit</span>';
                
            rows.push({
                contractor: c.ContractorName,
                code: i.ItemCode || '-',
                desc: i.ItemDescription,
                netIssue: i.NetIssue,
                consumption: i.Consumption,
                wip: i.WIP,
                theft: i.Theft,
                balanceQty: i.BalanceQty,
                uom: i.UOM,
                balanceCost: i.BalanceCost,
                badgeHtml: badge,
                isHolding: isHolding
            });
        });
    });
    
    document.getElementById('alertTotalCount').textContent = rows.length;
    document.getElementById('alertTotalCost').textContent = formatCurrency(totalRiskVal);

    // Render paginated page
    const tabKey = 'alerts';
    const limit = paginationLimit;
    const totalPages = Math.ceil(rows.length / limit) || 1;
    if (pageState[tabKey] > totalPages) pageState[tabKey] = totalPages;
    if (pageState[tabKey] < 1) pageState[tabKey] = 1;

    const startIdx = (pageState[tabKey] - 1) * limit;
    const endIdx = startIdx + limit;
    const pageRows = rows.slice(startIdx, endIdx);

    pageRows.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${r.contractor}</strong></td>
            <td><code>${r.code}</code></td>
            <td>${r.desc}</td>
            <td class="text-right">${formatNum(r.netIssue)}</td>
            <td class="text-right">${formatNum(r.consumption)}</td>
            <td class="text-right text-info">${formatNum(r.wip)}</td>
            <td class="text-right text-danger">${formatNum(r.theft)}</td>
            <td class="text-right font-bold ${r.isHolding ? 'text-warning' : 'text-danger'}">${formatNum(r.balanceQty)} ${r.uom}</td>
            <td class="text-right font-bold">${formatCurrency(r.balanceCost)}</td>
            <td class="text-center">${r.badgeHtml}</td>
        `;
        tbody.appendChild(tr);
    });

    updatePaginationUI(tabKey, pageState[tabKey], totalPages);
}

// Global Filters Event Handlers
function setupFilters() {
    document.getElementById('contractorSelect').addEventListener('change', (e) => {
        pageState.contractor = 1;
        localStorage.setItem('selectedContractor', e.target.value);
        renderContractorView();
    });
    document.getElementById('contractorSearch').addEventListener('input', () => {
        pageState.contractor = 1;
        renderContractorView();
    });
    
    // Material multi-select events are handled in setupMultiSelect()
    
    document.getElementById('debitSearch').addEventListener('input', () => {
        pageState.debit = 1;
        renderDebitView();
    });
    
    document.getElementById('alertSearch').addEventListener('input', () => {
        pageState.alerts = 1;
        renderAlertsView();
    });
    document.getElementById('alertTypeSelect').addEventListener('change', () => {
        pageState.alerts = 1;
        renderAlertsView();
    });

    // Initialize pagination handlers
    setupPaginationEvents('contractor', renderContractorView);
    setupPaginationEvents('material', renderMaterialView);
    setupPaginationEvents('debit', renderDebitView);
    setupPaginationEvents('alerts', renderAlertsView);
}

// Robust file download helper - works on both file:// and http://
function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 200);
}

// Export to CSV Function
function exportActiveViewCSV() {
    let tableId = '';
    let filename = '';
    
    if (currentTab === 'contractor') { tableId = 'contractorTable'; filename = 'Contractor_Material_Reconciliation.csv'; }
    else if (currentTab === 'material') { tableId = 'materialTable'; filename = 'Material_wise_Reconciliation.csv'; }
    else if (currentTab === 'debit') { tableId = 'debitTable'; filename = 'Master_Debit_Rates.csv'; }
    else if (currentTab === 'alerts') { tableId = 'alertsTable'; filename = 'Material_Discrepancies_Alerts.csv'; }
    else { alert('Pehle koi data tab select karo (Contractor / Material / Debit / Alerts)!'); return; }
    
    const table = document.getElementById(tableId);
    if (!table) { alert('Table not found!'); return; }
    
    let csv = [];
    const rows = table.querySelectorAll('tr');
    
    if (rows.length <= 1) { alert('No data to export!'); return; }
    
    rows.forEach(row => {
        const cols = row.querySelectorAll('th, td');
        const rowData = [];
        cols.forEach(col => {
            let text = col.innerText.replace(/"/g, '""').trim();
            rowData.push(`"${text}"`);
        });
        csv.push(rowData.join(','));
    });
    
    const blob = new Blob(['\uFEFF' + csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    downloadFile(blob, filename);
}

// Export to Excel (XLSX)
// Export Missing Rates (Debit Rate = 0)
function exportMissingRates() {
    if (!rawData || !rawData.Contractors) {
        alert("No data available to export.");
        return;
    }

    const missingItemsMap = new Map();

    rawData.Contractors.forEach(c => {
        c.Items.forEach(i => {
            if (i.DebitRate === 0) {
                // Use ItemCode as key if available, else ItemDescription
                const key = (i.ItemCode || '') + '_' + (i.ItemDescription || '').toLowerCase();
                if (!missingItemsMap.has(key)) {
                    missingItemsMap.set(key, {
                        'Item Code': i.ItemCode,
                        'Item Description': i.ItemDescription,
                        'UOM': i.UOM,
                        'Found In Contractor': c.ContractorName
                    });
                }
            }
        });
    });

    const missingItems = Array.from(missingItemsMap.values());

    if (missingItems.length === 0) {
        alert("Great! All items have a valid Debit Rate assigned.");
        return;
    }

    // Convert to CSV
    const headers = ['Item Code', 'Item Description', 'UOM', 'Found In Contractor'];
    let csvContent = headers.join(',') + '\n';

    missingItems.forEach(item => {
        const row = [
            `"${item['Item Code'] || ''}"`,
            `"${item['Item Description'] || ''}"`,
            `"${item['UOM'] || ''}"`,
            `"${item['Found In Contractor'] || ''}"`
        ];
        csvContent += row.join(',') + '\n';
    });

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Missing_Debit_Rates_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.csv`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Export to Excel
async function exportActiveViewExcel() {
    let filename = '';
    let sheetName = 'Reconciliation';
    let dataToExport = [];
    
    if (!rawData) {
        alert('No data available. Please upload the Excel file first.');
        return;
    }

    if (currentTab === 'contractor') { 
        filename = 'Contractor_Material_Reconciliation.xlsx';
        const search = document.getElementById('contractorSearch') ? document.getElementById('contractorSearch').value.toLowerCase() : '';
        const selected = document.getElementById('contractorSelect') ? document.getElementById('contractorSelect').value : '';
        
        rawData.Contractors.forEach(c => {
            if (selected && c.ContractorName !== selected) return;
            c.Items.forEach(i => {
                if (search && !c.ContractorName.toLowerCase().includes(search) && !i.ItemDescription.toLowerCase().includes(search) && !i.ItemCode.toLowerCase().includes(search)) return;
                dataToExport.push({
                    'Contractor': c.ContractorName,
                    'Item Code': i.ItemCode || '-',
                    'Material Description': i.ItemDescription,
                    'UOM': i.UOM || '-',
                    'Debit Rate': i.DebitRate,
                    'Issued Qty': i.IssuedQty,
                    'MRN Qty': i.MRNQty,
                    'Net Issue': i.NetIssue,
                    'Consumption (Erected)': i.Consumption,
                    'Balance Qty': i.BalanceQty,
                    'Balance Cost': i.BalanceCost
                });
            });
        });
    }
    else if (currentTab === 'material') { 
        filename = 'Material_wise_Reconciliation.xlsx';
        const hasSelection = typeof selectedMaterials !== 'undefined' && selectedMaterials.size > 0;
        
        rawData.Contractors.forEach(c => {
            c.Items.forEach(i => {
                const itemCode = (i.ItemCode || '').trim();
                const itemDesc = (i.ItemDescription || '').trim();
                if (hasSelection) {
                    const itemKey = itemCode ? itemCode : itemDesc;
                    if (!selectedMaterials.has(itemKey)) return;
                }
                dataToExport.push({
                    'Contractor Name': c.ContractorName,
                    'Item Code': i.ItemCode || '-',
                    'Material Description': i.ItemDescription,
                    'UOM': i.UOM || '-',
                    'Debit Rate': i.DebitRate,
                    'Net Issue Qty': i.NetIssue,
                    'Consumption': i.Consumption,
                    'Balance Stock': i.BalanceQty,
                    'Balance Cost': i.BalanceCost
                });
            });
        });
    }
    else if (currentTab === 'debit') { 
        filename = 'Master_Debit_Rates.xlsx';
        const search = document.getElementById('debitSearch') ? document.getElementById('debitSearch').value.toLowerCase() : '';
        rawData.DebitRates.forEach(d => {
            if (search && !d.ItemCode.toLowerCase().includes(search) && !d.Description.toLowerCase().includes(search)) return;
            dataToExport.push({
                'Item Code': d.ItemCode,
                'Material Description': d.Description,
                'UOM': d.Unit,
                'Debit Rate (₹)': d.DebitRate
            });
        });
    }
    else if (currentTab === 'alerts') { 
        filename = 'Material_Discrepancies_Alerts.xlsx';
        const search = document.getElementById('alertSearch') ? document.getElementById('alertSearch').value.toLowerCase() : '';
        const alertType = document.getElementById('alertTypeSelect') ? document.getElementById('alertTypeSelect').value : 'all';
        
        rawData.Contractors.forEach(c => {
            c.Items.forEach(i => {
                if (i.BalanceQty === 0) return;
                if (alertType === 'holding' && i.BalanceQty <= 0) return;
                if (alertType === 'excess' && i.BalanceQty >= 0) return;
                if (search && !c.ContractorName.toLowerCase().includes(search) && !i.ItemDescription.toLowerCase().includes(search)) return;
                
                dataToExport.push({
                    'Contractor Name': c.ContractorName,
                    'Item Code': i.ItemCode || '-',
                    'Material Description': i.ItemDescription,
                    'Net Issued': i.NetIssue,
                    'Erected': i.Consumption,
                    'Variance Qty': i.BalanceQty,
                    'UOM': i.UOM || '-',
                    'Financial Risk': i.BalanceCost,
                    'Alert Classification': i.BalanceQty > 0 ? 'Unused Stock Held' : 'Excess Consumption Deficit'
                });
            });
        });
    }
    else { alert('Please select a valid tab to export.'); return; }
    
    if (typeof ExcelJS === 'undefined') {
        alert('ExcelJS library not loaded! Internet connection check karo aur page refresh karo.');
        return;
    }
    
    if (dataToExport.length === 0) {
        alert('No data to export with the current filters!');
        return;
    }
    
    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Material Reconciliation Portal';
        workbook.created = new Date();
        
        const ws = workbook.addWorksheet(sheetName, {
            pageSetup: { 
                paperSize: 9, // A4
                orientation: 'landscape', 
                fitToPage: true, 
                fitToWidth: 1, 
                fitToHeight: 0, // 0 = as many pages tall as needed
                margins: {
                    left: 0.25, right: 0.25,
                    top: 0.75, bottom: 0.75,
                    header: 0.3, footer: 0.3
                },
                printTitlesRow: '1:1' // Repeat header row on every printed page
            },
            views: [
                // Freeze the top row (headers)
                { state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2', activeCell: 'A2' }
            ]
        });
        
        // Setup columns dynamically
        const keys = Object.keys(dataToExport[0]);
        ws.columns = keys.map(k => {
            let width = Math.max(k.length + 5, 15);
            if (k.toLowerCase().includes('description')) width = 45;
            if (k.toLowerCase().includes('contractor')) width = 35;
            return { header: k, key: k, width: width };
        });
        
        // Add data rows
        ws.addRows(dataToExport);
        
        // Style Header Row (Row 1)
        const headerRow = ws.getRow(1);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; // White text
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1E3A8A' } // Dark blue header background (#1e3a8a)
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });
        headerRow.height = 30; // Slightly taller header
        
        // Style Data Rows
        ws.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Skip header
            
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                // Add soft borders to all cells
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                    left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                    bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
                    right: { style: 'thin', color: { argb: 'FFDDDDDD' } }
                };
                
                // Align numbers to right, text to left
                if (typeof cell.value === 'number') {
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    // Apply Number / Currency Formatting
                    const headerText = keys[colNumber - 1].toLowerCase();
                    if (headerText.includes('rate') || headerText.includes('cost') || headerText.includes('risk') || headerText.includes('₹')) {
                        cell.numFmt = '₹ #,##0.00';
                    } else if (headerText.includes('qty') || headerText.includes('issue') || headerText.includes('balance') || headerText.includes('erected')) {
                        cell.numFmt = '#,##0.00';
                    }
                } else {
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                }
            });
        });
        
        // Write out file and trigger download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadFile(blob, filename);
        
    } catch (err) {
        console.error('Excel export error:', err);
        alert('Excel export failed: ' + err.message);
    }
}

// Pagination setup helper
function setupPaginationEvents(tabKey, renderFunc) {
    const container = document.getElementById(`pagination-${tabKey}`);
    if (!container) return;

    const prevBtn = container.querySelector('.prev-btn');
    const nextBtn = container.querySelector('.next-btn');

    prevBtn.addEventListener('click', () => {
        if (pageState[tabKey] > 1) {
            pageState[tabKey]--;
            renderFunc();
        }
    });

    nextBtn.addEventListener('click', () => {
        pageState[tabKey]++;
        renderFunc();
    });
}

// Pagination UI update helper
function updatePaginationUI(tabKey, currentPage, totalPages) {
    const container = document.getElementById(`pagination-${tabKey}`);
    if (!container) return;

    const prevBtn = container.querySelector('.prev-btn');
    const nextBtn = container.querySelector('.next-btn');
    const info = container.querySelector('.page-info');

    info.textContent = `Page ${currentPage} of ${totalPages}`;
    prevBtn.disabled = (currentPage === 1);
    nextBtn.disabled = (currentPage === totalPages);
}

// --- EXCEL UPLOAD HANDLING ---
function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Reset file input IMMEDIATELY so same file can be re-uploaded
    const fileInput = event.target;
    
    // Show processing UI
    const btn = document.getElementById('uploadExcelBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳ Processing...</span>';
        btn.style.background = '#f59e0b';
        btn.style.borderColor = '#f59e0b';
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        // Use setTimeout to allow the browser to render the "Processing..." state
        setTimeout(() => {
            try {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, {type: 'array'});
                
                const parsedData = {
                    ExtractedAt: new Date().toISOString(),
                    ContractorCount: 0,
                    DebitRates: [],
                    Contractors: []
                };
                
                // 1. Parse Debit Rates
                if (wb.Sheets['Debit Rate']) {
                    const drSheet = XLSX.utils.sheet_to_json(wb.Sheets['Debit Rate'], {header: 1});
                    let headerRow = 0;
                    let hmap = { code: 1, desc: 2, unit: 3, rate: 4 };
                    for (let r=0; r<5; r++) {
                        if (!drSheet[r]) continue;
                        const h = drSheet[r].map(x => String(x||'').toLowerCase().replace(/\s+/g, ' ').trim());
                        if (h.some(x => x && (x.includes('item code') || x.includes('description')))) {
                            headerRow = r;
                            const findC = (keys) => {
                                for (const k of keys) {
                                    let idx = h.findIndex(x => x && x.includes(k));
                                    if (idx !== -1) return idx;
                                }
                                return -1;
                            };
                            let iCode = findC(['item code']);
                            if(iCode !== -1) hmap.code = iCode;
                            let iDesc = findC(['description', 'material']);
                            if(iDesc !== -1) hmap.desc = iDesc;
                            let iUnit = findC(['unit', 'uom']);
                            if(iUnit !== -1) hmap.unit = iUnit;
                            let iRate = findC(['debit rate', 'rate']);
                            if(iRate !== -1) hmap.rate = iRate;
                            break;
                        }
                    }
                    for (let i = headerRow + 1; i < drSheet.length; i++) {
                        const row = drSheet[i];
                        if (row && row[hmap.code]) {
                            parsedData.DebitRates.push({
                                ItemCode: String(row[hmap.code]),
                                Description: row[hmap.desc] || '',
                                Unit: row[hmap.unit] || '',
                                DebitRate: parseFloat(row[hmap.rate]) || 0
                            });
                        }
                    }
                }
                
                // 2. Parse Contractors
                const excludeSheets = [
                    'debit rate', 'gadchiroli t-10__1458', 'non working 30.06.2026', 
                    'bill summary', 'sheet1', 'contractor bill details'
                ];
                
                const contractorSheets = wb.SheetNames.filter(s => {
                    const sLower = s.trim().toLowerCase();
                    // Skip if in exclude list OR if it's a blank/empty sheet name
                    return sLower && !excludeSheets.includes(sLower);
                });
                
                // --- Extract Master Firm Names and Details ---
                const masterFirmNames = [];
                const masterFirmDetails = {};
                if (wb.Sheets['Gadchiroli T-10__1458']) {
                    const gadSheet = XLSX.utils.sheet_to_json(wb.Sheets['Gadchiroli T-10__1458'], {header: 1});
                    let headerRow = 0;
                    let hmap = { name: -1, owner: 5, contact: 6, addr: 7, pan: 8, aadhar: 9, gst: 10, lic: 11, pf: 12, wo: 15, proj: 23, sup: 24 };
                    
                    for (let r=0; r<5; r++) {
                        if (!gadSheet[r]) continue;
                        const h = gadSheet[r].map(x => String(x||'').toLowerCase().replace(/\s+/g, ' ').trim());
                        const nameIdx = h.findIndex(x => x && typeof x === 'string' && (x.includes('name of firm') || x.includes('contractor name')));
                        
                        if (nameIdx !== -1) {
                            headerRow = r;
                            hmap.name = nameIdx;
                            const findC = (keys) => {
                                for (const k of keys) {
                                    let idx = h.findIndex(x => x && x.includes(k));
                                    if (idx !== -1) return idx;
                                }
                                return -1;
                            };
                            
                            let iOwner = findC(['owner']); if(iOwner!==-1) hmap.owner = iOwner;
                            let iCont = findC(['contact', 'mobile', 'phone']); if(iCont!==-1) hmap.contact = iCont;
                            let iAddr = findC(['address']); if(iAddr!==-1) hmap.addr = iAddr;
                            let iPan = findC(['pan']); if(iPan!==-1) hmap.pan = iPan;
                            let iAadhar = findC(['aadhar', 'adhar']); if(iAadhar!==-1) hmap.aadhar = iAadhar;
                            let iGst = findC(['gst']); if(iGst!==-1) hmap.gst = iGst;
                            let iLic = findC(['licence', 'license']); if(iLic!==-1) hmap.lic = iLic;
                            let iPf = findC(['pf reg']); if(iPf!==-1) hmap.pf = iPf;
                            let iWo = findC(['wo no', 'work order']); if(iWo!==-1) hmap.wo = iWo;
                            let iProj = findC(['project incharge', 'incharge']); if(iProj!==-1) hmap.proj = iProj;
                            let iSup = findC(['supervisor']); if(iSup!==-1) hmap.sup = iSup;
                            break;
                        }
                    }
                    
                    if (hmap.name !== -1) {
                        for (let i = headerRow + 1; i < gadSheet.length; i++) {
                            const row = gadSheet[i];
                            if (row && row[hmap.name]) {
                                const firmName = String(row[hmap.name]).trim();
                                masterFirmNames.push(firmName);
                                masterFirmDetails[firmName] = {
                                    OwnerName: String(row[hmap.owner] || ''),
                                    ContactNumbers: String(row[hmap.contact] || ''),
                                    Address: String(row[hmap.addr] || ''),
                                    PAN: String(row[hmap.pan] || ''),
                                    Aadhar: String(row[hmap.aadhar] || ''),
                                    GST: String(row[hmap.gst] || ''),
                                    LicenceNo: String(row[hmap.lic] || ''),
                                    PFRegNo: String(row[hmap.pf] || ''),
                                    WONo: String(row[hmap.wo] || ''),
                                    ProjectIncharge: String(row[hmap.proj] || ''),
                                    Supervisor: String(row[hmap.sup] || '')
                                };
                            }
                        }
                    }
                }
                
                function getOfficialName(rawName) {
                    if (!rawName) return rawName;
                    const sn = String(rawName).toLowerCase().replace(/[^a-z0-9]/g, '');
                    // 1. Exact match (ignoring case/spaces)
                    for (const m of masterFirmNames) {
                        if (m.toLowerCase().replace(/[^a-z0-9]/g, '') === sn) return m;
                    }
                    // 2. Partial match
                    for (const m of masterFirmNames) {
                        if (m.toLowerCase().replace(/[^a-z0-9]/g, '').includes(sn)) return m;
                    }
                    for (const m of masterFirmNames) {
                        if (sn.includes(m.toLowerCase().replace(/[^a-z0-9]/g, ''))) return m;
                    }
                    return rawName; // fallback
                }
                
                let missingColumnsContractors = [];
                
                const billDetails = {};
                if (wb.Sheets['Contractor bill Details']) {
                    const billSheet = XLSX.utils.sheet_to_json(wb.Sheets['Contractor bill Details'], {header: 1});
                    let headerRow = 1;
                    let hmap = { cname: 3, woval: 9, workcomp: 11, payable: 20, ret15: 13, ret10: 14, ret5: 15, remarks: 21 };
                    
                    for (let r=0; r<5; r++) {
                        if (!billSheet[r]) continue;
                        const h = billSheet[r].map(x => String(x||'').toLowerCase().replace(/\s+/g, ' ').trim());
                        const nameIdx = h.findIndex(x => x && typeof x === 'string' && (x.includes('name of contractor') || x.includes('contractor name')));
                        if (nameIdx !== -1) {
                            headerRow = r;
                            hmap.cname = nameIdx;
                            const findC = (keys) => {
                                for (const k of keys) {
                                    let idx = h.findIndex(x => x && x.includes(k));
                                    if (idx !== -1) return idx;
                                }
                                return -1;
                            };
                            let iWo = findC(['amount 100%', 'w.o.value', 'wo value', 'order value']); if(iWo!==-1) hmap.woval = iWo;
                            let iWc = findC(['amount 10%', 'value of work completed', 'work completed']); if(iWc!==-1) hmap.workcomp = iWc;
                            let iPay = findC(['payable amount', 'total payable']); if(iPay!==-1) hmap.payable = iPay;
                            let iR15 = findC(['retention 15%', 'retention 15']); if(iR15!==-1) hmap.ret15 = iR15;
                            let iR10 = findC(['retention 10%', 'retention 10']); if(iR10!==-1) hmap.ret10 = iR10;
                            let iR5 = findC(['retention 5%', 'retention 5']); if(iR5!==-1) hmap.ret5 = iR5;
                            let iRem = findC(['remark', 'remarks']); if(iRem!==-1) hmap.remarks = iRem;
                            break;
                        }
                    }
                    
                    for (let i = headerRow + 1; i < billSheet.length; i++) {
                        const row = billSheet[i];
                        if (row && row[hmap.cname]) {
                            const cNameRaw = String(row[hmap.cname]).trim();
                            const officialName = getOfficialName(cNameRaw);
                            billDetails[officialName] = {
                                WOValue: parseFloat(row[hmap.woval]) || 0,
                                ValueWorkCompleted: parseFloat(row[hmap.workcomp]) || 0,
                                TotalPayableAmount: parseFloat(row[hmap.payable]) || 0,
                                Retention15: parseFloat(row[hmap.ret15]) || 0,
                                Retention10: parseFloat(row[hmap.ret10]) || 0,
                                Retention5: parseFloat(row[hmap.ret5]) || 0,
                                Remarks: row[hmap.remarks] || ''
                            };
                        }
                    }
                }

                for (const cNameRaw of contractorSheets) {
                    const officialName = getOfficialName(cNameRaw);
                    const cSheet = XLSX.utils.sheet_to_json(wb.Sheets[cNameRaw], {header: 1, defval: ""});
                    
                    // Check for required columns
                    let hasRequiredColumns = false;
                    let colMap = { itemCode: 1, itemDesc: 2, uom: 3, debitRate: 4, issue: 5, mrn: 6, netIssue: 7, consumption: 8, balance: 9 };
                    let startRow = 2;
                    for (let r = 0; r < Math.min(cSheet.length, 15); r++) {
                        const rowStr = (cSheet[r] || []).join(' ').toLowerCase();
                        if ((rowStr.includes('item') || rowStr.includes('material') || rowStr.includes('desc')) && (rowStr.includes('issue') || rowStr.includes('qty') || rowStr.includes('mrn') || rowStr.includes('balance'))) {
                            const headers = cSheet[r].map(h => String(h || '').toLowerCase().replace(/\s+/g, ' ').trim());
                            
                            const findCol = (keywords, exclude = []) => {
                                for (const k of keywords) {
                                    let idx = headers.findIndex(h => h && h === k);
                                    if (idx !== -1) return idx;
                                }
                                for (const k of keywords) {
                                    for (let i = headers.length - 1; i >= 0; i--) {
                                        const h = headers[i];
                                        if (h && h.includes(k)) {
                                            if (exclude.some(ex => h.includes(ex))) continue;
                                            return i;
                                        }
                                    }
                                }
                                return -1;
                            };
                            
                            const iItemCode = findCol(['item code']);
                            const iItemDesc = findCol(['items', 'item description', 'description', 'material']);
                            const iUOM = findCol(['uom', 'unit']);
                            
                            const iIssued = findCol(['issued qty', 'issue'], ['net', 'cost', 'amount', 'value', 'rate']);
                            const iMrn = findCol(['mrn', 'mrn qty']);
                            const iNet = findCol(['net issue', 'net issued'], ['cost', 'amount', 'value', 'rate']);
                            const iCons = findCol(['total consumtion', 'total consumption', 'total cosumption', 'consumption', 'consumtion', 'cosumption', 'consumed', 'consumed qty', 'erected', 'erection', 'erected qty', 'total erected'], ['cost', 'amount', 'value', 'rate']);
                            const iWip = findCol(['wip', 'w.i.p', 'work in progress'], ['cost', 'amount', 'value', 'rate']);
                            const iTheft = findCol(['theft', 'thef', 'stolen', 'theft material', 'thef material'], ['cost', 'amount', 'value', 'rate']);
                            const iBal = findCol(['total bal', 'total balance', 'balance material', 'balance', 'balance stock', 'balance qty', 'bal qty'], ['cost', 'amount', 'value', 'rate']);
                            
                            if (iItemCode !== -1 && iItemDesc !== -1) {
                                hasRequiredColumns = true;
                                startRow = r + 1;
                                if(iItemCode !== -1) colMap.itemCode = iItemCode; else colMap.itemCode = -1;
                                if(iItemDesc !== -1) colMap.itemDesc = iItemDesc; else colMap.itemDesc = -1;
                                if(iUOM !== -1) colMap.uom = iUOM; else colMap.uom = -1;
                                if(iIssued !== -1) colMap.issue = iIssued; else colMap.issue = -1;
                                if(iMrn !== -1) colMap.mrn = iMrn; else colMap.mrn = -1;
                                if(iNet !== -1) colMap.netIssue = iNet; else colMap.netIssue = -1;
                                if(iCons !== -1) colMap.consumption = iCons; else colMap.consumption = -1;
                                if(iWip !== -1) colMap.wip = iWip; else colMap.wip = -1;
                                if(iTheft !== -1) colMap.theft = iTheft; else colMap.theft = -1;
                                if(iBal !== -1) colMap.balance = iBal; else colMap.balance = -1;
                                break;
                            }
                        }
                    }
                    
                    if (!hasRequiredColumns) {
                        missingColumnsContractors.push(officialName);
                    }

                    const contractor = {
                        ContractorName: officialName,
                        ItemCount: 0,
                        Items: [],
                        Metadata: {
                            FirmName: officialName,
                            ...(masterFirmDetails[officialName] || {}),
                            ...(billDetails[officialName] || {}),
                            ActiveStatus: 'Working'
                        }
                    };
                    
                    for (let i = startRow; i < cSheet.length; i++) {
                        const row = cSheet[i];
                        if (row && (colMap.itemCode === -1 || row[colMap.itemCode]) && (colMap.itemDesc === -1 || row[colMap.itemDesc]) && String(row[colMap.itemCode] || '').trim().toUpperCase() !== 'ITEM CODE') {
                            const issuedQty  = parseFloat(row[colMap.issue])       || 0;
                            const mrnQty     = parseFloat(row[colMap.mrn])         || 0;
                            // NetIssue: read from sheet column, but if missing/zero calculate from formula
                            let netIssueRaw  = parseFloat(row[colMap.netIssue])    || 0;
                            if (netIssueRaw === 0 && colMap.netIssue === -1) {
                                netIssueRaw = issuedQty - mrnQty;
                            }

                            const item = {
                                ItemCode:        String(row[colMap.itemCode] || '').trim(),
                                ItemDescription: String(row[colMap.itemDesc] || '').trim(),
                                UOM:             String(row[colMap.uom]      || ''),
                                DebitRate:       0, // Will be set from Master list
                                IssuedQty:       issuedQty,
                                MRNQty:          mrnQty,
                                NetIssue:        netIssueRaw,
                                Consumption:     parseFloat(row[colMap.consumption]) || 0,
                                WIP:             parseFloat(row[colMap.wip])         || 0,
                                Theft:           parseFloat(row[colMap.theft])       || 0,
                                BalanceQty:      0, // computed below
                                BalanceCost:     0  // computed below
                            };
                            
                            // ALWAYS use Master Debit Rate — match by ItemCode first, then Description
                            const masterMatch = parsedData.DebitRates.find(d => {
                                const mCode  = String(d.ItemCode    || '').trim().toLowerCase();
                                const iCode  = String(item.ItemCode || '').trim().toLowerCase();
                                // BUG FIX: field in DebitRates is 'Description', not 'ItemDescription'
                                const mDesc  = String(d.Description        || '').trim().toLowerCase();
                                const iDesc  = String(item.ItemDescription || '').trim().toLowerCase();
                                
                                return (iCode && mCode === iCode) || (iDesc && iDesc.length > 2 && mDesc === iDesc);
                            });
                            
                            if (masterMatch) {
                                item.DebitRate = masterMatch.DebitRate;
                            }
                            
                            // BalanceQty: read dynamically from sheet. If column missing, calculate.
                            let balRaw = parseFloat(row[colMap.balance]);
                            if (isNaN(balRaw) && colMap.balance === -1) {
                                balRaw = item.NetIssue - item.Consumption - item.WIP - item.Theft;
                            } else if (isNaN(balRaw)) {
                                balRaw = 0;
                            }
                            
                            item.BalanceQty  = balRaw;
                            item.BalanceCost = item.BalanceQty * item.DebitRate;
                            contractor.Items.push(item);
                        }
                    }
                    contractor.ItemCount = contractor.Items.length;
                    parsedData.Contractors.push(contractor);
                }
                
                parsedData.ContractorCount = parsedData.Contractors.length;
                rawData = parsedData;
                
                // SAVE to localStorage FIRST (so reload always gets fresh data)
                try {
                    localStorage.setItem('materialAppData', JSON.stringify(rawData));
                    console.log('Data saved to localStorage successfully.');
                } catch(storageErr) {
                    console.warn('localStorage save failed (data too large?):', storageErr);
                }
                
                // Re-render UI
                populateDropdowns();
                if (currentTab === 'overview') renderOverview();
                else if (currentTab === 'contractor') renderContractorView();
                else if (currentTab === 'material') renderMaterialView();
                else if (currentTab === 'debit') renderDebitView();
                else if (currentTab === 'alerts') renderAlertsView();
                else if (currentTab === 'reports') renderReportsView();
                
                // POST data to upload.php (for InfinityFree/PHP servers)
                const jsonPayload = JSON.stringify(rawData);
                fetch('upload.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: jsonPayload
                })
                .then(res => res.json())
                .then(data => console.log('Server save response:', data))
                .catch(err => console.warn('Server save failed (offline or no PHP):', err));
                
                // Restore button
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<span>✅ Uploaded & Saved!</span>';
                    btn.style.background = '#10b981'; // Green
                    btn.style.borderColor = '#10b981';
                    
                    setTimeout(() => {
                        // Force hard reload with cache busting
                        window.location.href = window.location.pathname + '?t=' + new Date().getTime();
                    }, 1500);
                }
                
                if (missingColumnsContractors.length > 0) {
                    alert('⚠️ Alert: In contractors ki sheet mein "Issue", "MRN", "Net Issue", "Consumption", ya "Balance" column nahi mila:\n\n' + missingColumnsContractors.join('\n'));
                }
                
            } catch (err) {
                console.error(err);
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<span>❌ Error</span>';
                    btn.style.background = '#ef4444'; // Red
                    btn.style.borderColor = '#ef4444';
                }
                alert('Error parsing Excel file. Details: ' + err.message + '\n\n' + err.stack);
            }
            
            // Reset file input so same file can be re-selected
            fileInput.value = '';
        }, 50); // 50ms delay to let the UI paint
    };
    reader.readAsArrayBuffer(file);
}

// ======================================
// 6. REPORTS VIEW LOGIC
// ======================================
let currentReportType = 'mgmt';

function initReportsUI() {
    document.querySelectorAll('.report-nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.report-nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.report-view').forEach(v => v.style.display = 'none');
            
            btn.classList.add('active');
            currentReportType = btn.getAttribute('data-report');
            document.getElementById('report-' + currentReportType).style.display = 'block';
            
            if (currentTab === 'reports') {
                renderReportsView();
            }
        });
    });
}

function renderReportsView() {
    if (!rawData) return;
    
    if (currentReportType === 'mgmt') {
        let totalWO = 0, totalWork = 0, totalRet = 0, overallRisk = 0;
        rawData.Contractors.forEach(c => {
            const m = c.Metadata;
            totalWO += (m.WOValue || 0);
            totalWork += (m.ValueWorkCompleted || 0);
            totalRet += ((m.Retention5||0) + (m.Retention10||0) + (m.Retention15||0));
            
            let balCost = 0;
            c.Items.forEach(i => balCost += i.BalanceCost);
            if (balCost > 0) overallRisk += balCost;
        });
        
        document.getElementById('rMgmtWO').textContent = formatCurrency(totalWO);
        document.getElementById('rMgmtWork').textContent = formatCurrency(totalWork);
        document.getElementById('rMgmtRet').textContent = formatCurrency(totalRet);
        document.getElementById('rMgmtRisk').textContent = formatCurrency(overallRisk);
    } 
    else if (currentReportType === 'risk') {
        const tbody = document.querySelector('#reportRiskTable tbody');
        tbody.innerHTML = '';
        
        const riskData = rawData.Contractors.map(c => {
            let balCost = 0;
            c.Items.forEach(i => balCost += i.BalanceCost);
            
            const retMoney = (c.Metadata.Retention5||0) + (c.Metadata.Retention10||0) + (c.Metadata.Retention15||0);
            const netBuffer = retMoney - balCost;
            return {
                name: c.ContractorName,
                status: c.Metadata.ActiveStatus || 'Unknown',
                balCost: balCost,
                recovery: netBuffer < 0 ? Math.abs(netBuffer) : 0
            };
        }).filter(d => d.recovery > 0 || d.balCost > 0).sort((a, b) => b.recovery - a.recovery);
        
        riskData.forEach(d => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${d.name}</strong></td>
                <td><span class="badge ${d.status.toLowerCase().includes('working') ? 'badge-success' : 'badge-danger'}">${d.status}</span></td>
                <td class="text-right text-warning">? ${formatNum(d.balCost)}</td>
                <td class="text-right font-bold text-danger">? ${formatNum(d.recovery)}</td>
            `;
            tbody.appendChild(tr);
        });
    }
    else if (currentReportType === 'idle') {
        const tbody = document.querySelector('#reportIdleTable tbody');
        tbody.innerHTML = '';
        
        const idleItems = [];
        rawData.Contractors.forEach(c => {
            c.Items.forEach(i => {
                if (i.IssuedQty > 0 && i.Consumption === 0 && i.BalanceCost > 0) {
                    idleItems.push({
                        cName: c.ContractorName,
                        code: i.ItemCode,
                        desc: i.ItemDescription,
                        issued: i.IssuedQty,
                        cons: i.Consumption,
                        cost: i.BalanceCost
                    });
                }
            });
        });
        
        idleItems.sort((a, b) => b.cost - a.cost).forEach(d => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${d.cName}</strong></td>
                <td><code>${d.code}</code></td>
                <td>${d.desc}</td>
                <td class="text-right">${d.issued}</td>
                <td class="text-right text-danger">${d.cons}</td>
                <td class="text-right font-bold text-warning">? ${formatNum(d.cost)}</td>
            `;
            tbody.appendChild(tr);
        });
    }
    else if (currentReportType === 'retention') {
        const tbody = document.querySelector('#reportRetentionTable tbody');
        tbody.innerHTML = '';
        
        const retData = rawData.Contractors.map(c => {
            let balCost = 0;
            c.Items.forEach(i => balCost += i.BalanceCost);
            const retMoney = (c.Metadata.Retention5||0) + (c.Metadata.Retention10||0) + (c.Metadata.Retention15||0);
            const netBuffer = retMoney - balCost;
            
            return {
                name: c.ContractorName,
                ret: retMoney,
                cost: balCost,
                buffer: netBuffer
            };
        }).sort((a, b) => a.buffer - b.buffer);
        
        retData.forEach(d => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${d.name}</strong></td>
                <td class="text-right text-success">? ${formatNum(d.ret)}</td>
                <td class="text-right text-warning">? ${formatNum(d.cost)}</td>
                <td class="text-right font-bold ${d.buffer < 0 ? 'text-danger' : 'text-success'}">? ${formatNum(d.buffer)}</td>
                <td class="text-center">
                    <span class="badge ${d.buffer < 0 ? 'badge-danger' : 'badge-success'}">
                        ${d.buffer < 0 ? '?? UNSAFE' : '? SAFE'}
                    </span>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function exportReportCSV(type) {
    alert('This feature uses the standard ExcelJS export in a full implementation. For now, data is shown on screen!');
}

document.addEventListener('DOMContentLoaded', () => {
    initReportsUI();
});



async function exportForPowerBI() {
    if (!rawData || !rawData.Contractors) {
        alert("No data available to export.");
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("RawData_PowerBI");

    sheet.columns = [
        { header: "Contractor Name", key: "cName", width: 30 },
        { header: "Owner Name", key: "owner", width: 20 },
        { header: "Contact Numbers", key: "contact", width: 20 },
        { header: "PAN", key: "pan", width: 15 },
        { header: "GST", key: "gst", width: 20 },
        { header: "Work Order No", key: "wo", width: 15 },
        { header: "Item Code", key: "code", width: 15 },
        { header: "Item Description", key: "desc", width: 40 },
        { header: "UOM", key: "uom", width: 10 },
        { header: "Debit Rate", key: "rate", width: 12 },
        { header: "Issued Qty", key: "issued", width: 12 },
        { header: "MRN Qty", key: "mrn", width: 12 },
        { header: "Net Issue", key: "netIssue", width: 12 },
        { header: "Total Consumption", key: "cons", width: 15 },
        { header: "WIP", key: "wip", width: 12 },
        { header: "Theft", key: "theft", width: 12 },
        { header: "Balance Qty", key: "balQty", width: 15 },
        { header: "Total Balance Cost", key: "balCost", width: 20 }
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B82F6" } };
    sheet.getRow(1).font = { color: { argb: "FFFFFFFF" }, bold: true };

    rawData.Contractors.forEach(contractor => {
        const meta = contractor.Metadata || {};
        contractor.Items.forEach(item => {
            sheet.addRow({
                cName: contractor.ContractorName,
                owner: meta.OwnerName || "",
                contact: meta.ContactNumbers || "",
                pan: meta.PAN || "",
                gst: meta.GST || "",
                wo: meta.WONo || "",
                code: item.ItemCode,
                desc: item.ItemDescription,
                uom: item.UOM,
                rate: item.DebitRate || 0,
                issued: item.IssuedQty || 0,
                mrn: item.MRNQty || 0,
                netIssue: item.NetIssue || 0,
                cons: item.Consumption || 0,
                wip: item.WIP || 0,
                theft: item.Theft || 0,
                balQty: item.BalanceQty || 0,
                balCost: item.BalanceCost || 0
            });
        });
    });

    try {
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "PowerBI_RawData_Material_Reconciliation.xlsx";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        console.error("Power BI export error:", err);
        alert("Failed to export: " + err.message);
    }
}


// --- MODAL AND PRINT LOGIC ---

let currentModalContractor = "";

function openContractorModal(contractorName) {
    currentModalContractor = contractorName;
    const modal = document.getElementById("contractorModal");
    const title = document.getElementById("modalContractorName");
    const tbody = document.getElementById("modalTableBody");
    
    // Find the contractor data
    const contractor = DATA.Contractors.find(c => c.ContractorName === contractorName);
    if (!contractor) return;

    title.textContent = "Balance Material: " + contractorName;
    tbody.innerHTML = "";
    
    // Filter items with positive balance cost or quantity
    const items = (contractor.Items || []).filter(item => item.BalanceQty > 0 || item.BalanceCost > 0);
    
    if (items.length === 0) {
        tbody.innerHTML = "<tr><td colspan=\"7\" style=\"text-align: center;\">No balance materials found.</td></tr>";
    } else {
        items.forEach(item => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${item.ItemCode || ""}</td>
                <td style="text-align: left;">${item.ItemDescription || ""}</td>
                <td>${item.UOM || ""}</td>
                <td>${(item.NetIssue || 0).toFixed(2)}</td>
                <td>${(item.Consumption || 0).toFixed(2)}</td>
                <td style="font-weight: bold; color: #3b82f6;">${(item.BalanceQty || 0).toFixed(2)}</td>
                <td style="font-weight: bold;">${formatCurrency(item.BalanceCost)}</td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    modal.style.display = "block";
}

function closeContractorModal() {
    document.getElementById("contractorModal").style.display = "none";
}

// Close modal when clicking on X
document.querySelector(".close-btn").addEventListener("click", closeContractorModal);

// Close modal when clicking outside of it
window.addEventListener("click", (event) => {
    const modal = document.getElementById("contractorModal");
    if (event.target == modal) {
        closeContractorModal();
    }
});

function downloadModalCSV() {
    if (!currentModalContractor) return;
    const contractor = DATA.Contractors.find(c => c.ContractorName === currentModalContractor);
    if (!contractor) return;
    
    const items = (contractor.Items || []).filter(item => item.BalanceQty > 0 || item.BalanceCost > 0);
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Item Code,Description,UOM,Net Issue,Consumption,Balance Qty,Balance Cost\n";
    
    items.forEach(item => {
        let desc = (item.ItemDescription || "").replace(/"/g, '""');
        let row = [
            item.ItemCode,
            `"${desc}"`,
            item.UOM,
            item.NetIssue,
            item.Consumption,
            item.BalanceQty,
            item.BalanceCost
        ].join(",");
        csvContent += row + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Balance_Material_" + currentModalContractor.replace(/\s+/g, "_") + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function printModal() {
    const printWindow = window.open("", "_blank");
    const title = document.getElementById("modalContractorName").textContent;
    const tableHtml = document.getElementById("modalTableContainer").innerHTML;
    
    printWindow.document.write(`
        <html>
        <head>
            <title>Print - ${title}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h2 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                th { background-color: #f2f2f2; text-align: center; }
                td:nth-child(2) { text-align: left; }
                @media print {
                    @page { margin: 0.5cm; }
                }
            </style>
        </head>
        <body>
            <h2>${title}</h2>
            ${tableHtml}
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}
