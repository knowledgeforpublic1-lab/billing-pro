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

// ---------- Cloud (MongoDB) helpers — ye hi ab primary online save hai ----------
function reconApiHeaders(jsonBody) {
    var h = {};
    if (jsonBody) h['Content-Type'] = 'application/json';
    try { var k = localStorage.getItem('billing_api_key'); if (k) h['x-api-key'] = k; } catch (e) {}
    return h;
}

async function fetchReconCloud() {
    try {
        var res = await fetch('/api/reconciliation', { headers: reconApiHeaders(false) });
        if (!res.ok) return null;
        var j = await res.json();
        if (j && j.success && j.data) return j;
    } catch (e) { console.warn('Recon cloud load failed:', e); }
    return null;
}

function saveReconCloud(jsonPayload) {
    return fetch('/api/reconciliation', { method: 'POST', headers: reconApiHeaders(true), body: jsonPayload })
        .then(function (res) {
            if (res.status === 401) throw new Error('API key galat/missing');
            if (!res.ok) return res.json().then(function (j) { throw new Error((j && j.error) || ('HTTP ' + res.status)); });
            return res.json();
        })
        .then(function (j) { console.log('Recon cloud save OK:', j); return j; })
        .catch(function (err) {
            console.warn('Recon cloud save failed, legacy upload.php try ho raha hai:', err);
            return fetch('upload.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: jsonPayload })
                .then(function (r) { return r.json(); })
                .then(function (d) { console.log('Legacy server save response:', d); return { legacy: true, resp: d }; });
        });
}

function reconTimeMs(v) {
    if (!v) return 0;
    var t = new Date(v).getTime();
    return isNaN(t) ? 0 : t;
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

        // Cloud (MongoDB) copy — online me sabse nayi data yahan se aayegi
        let cloudUsed = false;
        const cloud = await fetchReconCloud();
        if (cloud && cloud.data) {
            const cloudHasData = Array.isArray(cloud.data.Contractors) && cloud.data.Contractors.length > 0;
            const cloudMs = reconTimeMs(cloud.updatedAt) || reconTimeMs(cloud.data.ExtractedAt);
            const localMs = rawData ? (reconTimeMs(rawData.ExtractedAt) || reconTimeMs(rawData.savedAt)) : 0;
            // Khali cloud copy kabhi jeetegi nahi — sirf tab lo jab local hi na ho ya cloud naya+bhara ho
            if ((!rawData && cloudHasData) || (cloudHasData && cloudMs > localMs) || (!rawData && cloud.data)) {
                rawData = cloud.data;
                cloudUsed = true;
                try { localStorage.setItem('materialAppData', JSON.stringify(rawData)); } catch (e) {}
                console.log('Loaded freshest data from cloud (MongoDB)');
            }
        }
        // Local jeeta (ya cloud me kuch nahi) to use cloud me push kar do — self-heal
        if (rawData && !cloudUsed) {
            const localCopy = JSON.stringify(rawData);
            setTimeout(() => { saveReconCloud(localCopy).catch(() => {}); }, 1500);
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
            else if (target === 'item-balance') renderItemBalanceView();
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
        populateItemBalanceDropdown();
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
            <td>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span>${r.desc}</span>
                    <button class="btn btn-secondary btn-xs hide-print" onclick="jumpToItemBalance('${(r.code && r.code !== '-') ? r.code : r.desc.replace(/'/g, "\\'")}')" title="Check all contractors holding this item">
                        ⚖️ Balance
                    </button>
                </div>
            </td>
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

// ============================================================================
// 2.5 ITEM BALANCE FINDER (किसके पास कितना माल बचा है)
// ============================================================================
let itemBalanceItemsList = [];
let currentItemBalKey = '';

function getItemBalanceData(itemKey) {
    if (!rawData || !rawData.Contractors || !itemKey) return null;
    
    let code = '', desc = '', uom = '', debitRate = 0;
    let totalIssued = 0, totalCons = 0, totalBal = 0, totalBalCost = 0, totalWip = 0, totalTheft = 0;
    const contractors = [];
    
    rawData.Contractors.forEach(c => {
        const foundItem = c.Items.find(i => {
            const curCode = (i.ItemCode || '').trim();
            const curDesc = (i.ItemDescription || '').trim();
            const key = curCode ? curCode : curDesc;
            return key === itemKey || curCode === itemKey || curDesc.toLowerCase() === itemKey.toLowerCase();
        });
        
        if (foundItem) {
            if (!desc) {
                desc = foundItem.ItemDescription || '';
                code = foundItem.ItemCode || '';
                uom = foundItem.UOM || '';
                debitRate = foundItem.DebitRate || 0;
            }
            totalIssued += (foundItem.NetIssue || 0);
            totalCons += (foundItem.Consumption || 0);
            totalBal += (foundItem.BalanceQty || 0);
            totalBalCost += (foundItem.BalanceCost || 0);
            totalWip += (foundItem.WIP || 0);
            totalTheft += (foundItem.Theft || 0);
            
            contractors.push({
                contractor: c.ContractorName,
                firm: c.Metadata ? (c.Metadata.FirmName || '') : '',
                activeStatus: c.Metadata ? (c.Metadata.ActiveStatus || '') : '',
                workingStatus: c.Metadata ? (c.Metadata.WorkingStatus || '') : '',
                woNo: c.Metadata ? (c.Metadata.WONo || '') : '',
                netIssue: foundItem.NetIssue || 0,
                consumption: foundItem.Consumption || 0,
                wip: foundItem.WIP || 0,
                theft: foundItem.Theft || 0,
                balanceQty: foundItem.BalanceQty || 0,
                balanceCost: foundItem.BalanceCost || 0,
                rate: foundItem.DebitRate || debitRate
            });
        }
    });
    
    return {
        key: itemKey,
        code,
        desc,
        uom,
        debitRate,
        totalIssued,
        totalCons,
        totalBal,
        totalBalCost,
        totalWip,
        totalTheft,
        contractors
    };
}

function populateItemBalanceDropdown(filterText = '') {
    if (!rawData || !rawData.Contractors) return;
    
    const matMap = new Map();
    rawData.Contractors.forEach(c => {
        c.Items.forEach(i => {
            const code = (i.ItemCode || '').trim();
            const desc = (i.ItemDescription || '').trim();
            if (!code && !desc) return;
            const key = code ? code : desc;
            
            if (!matMap.has(key)) {
                matMap.set(key, {
                    key,
                    code,
                    desc,
                    uom: i.UOM || '',
                    rate: i.DebitRate || 0,
                    totalIssued: 0,
                    totalCons: 0,
                    totalBal: 0,
                    totalBalCost: 0,
                    contractorsWithBal: 0,
                    contractorsTotal: 0
                });
            }
            const m = matMap.get(key);
            m.totalIssued += (i.NetIssue || 0);
            m.totalCons += (i.Consumption || 0);
            m.totalBal += (i.BalanceQty || 0);
            m.totalBalCost += (i.BalanceCost || 0);
            m.contractorsTotal++;
            if (i.BalanceQty > 0) m.contractorsWithBal++;
        });
    });
    
    itemBalanceItemsList = Array.from(matMap.values()).sort((a, b) => {
        return b.totalBalCost - a.totalBalCost;
    });
    
    const select = document.getElementById('itemBalSelect');
    if (!select) return;
    
    const prevVal = select.value;
    select.innerHTML = '<option value="">-- Choose Material Item --</option>';
    
    const search = filterText.toLowerCase().trim();
    itemBalanceItemsList.forEach(m => {
        const matches = !search ||
            m.desc.toLowerCase().includes(search) ||
            m.code.toLowerCase().includes(search) ||
            m.key.toLowerCase().includes(search);
        if (!matches) return;
        
        const opt = document.createElement('option');
        opt.value = m.key;
        const codePrefix = m.code ? `[${m.code}] ` : '';
        const balPrefix = m.totalBal > 0 ? `⚡ [Bal: ${formatNum(m.totalBal)} ${m.uom}] ` : `[Nil Bal] `;
        opt.textContent = `${balPrefix}${codePrefix}${m.desc}`;
        select.appendChild(opt);
    });
    
    if (prevVal && select.querySelector(`option[value="${prevVal}"]`)) {
        select.value = prevVal;
    }
    
    // Quick Chips
    const chipsContainer = document.getElementById('itemBalQuickChips');
    if (chipsContainer) {
        chipsContainer.innerHTML = '<span style="font-size: 12px; color: var(--text-muted); font-weight: 600;">🔥 Quick Items:</span>';
        const topChips = itemBalanceItemsList.filter(m => m.totalBal > 0).slice(0, 7);
        topChips.forEach(m => {
            const btn = document.createElement('button');
            btn.className = 'item-bal-chip' + (m.key === select.value ? ' active' : '');
            btn.dataset.key = m.key;
            const shortName = m.desc.length > 22 ? m.desc.slice(0, 20) + '...' : m.desc;
            btn.innerHTML = `<span>${shortName}</span> <span class="chip-qty">${formatNum(m.totalBal)} ${m.uom}</span>`;
            btn.onclick = () => {
                selectItemBalanceKey(m.key);
            };
            chipsContainer.appendChild(btn);
        });
    }
    
    // Empty state top items
    const emptyTopContainer = document.getElementById('itemBalEmptyTopItems');
    if (emptyTopContainer) {
        emptyTopContainer.innerHTML = '';
        const topItems = itemBalanceItemsList.filter(m => m.totalBalCost > 0).slice(0, 8);
        topItems.forEach(m => {
            const card = document.createElement('div');
            card.className = 'item-bal-chip';
            card.style.padding = '8px 14px';
            card.style.fontSize = '13px';
            card.innerHTML = `<strong>${m.desc}</strong> — <span class="chip-qty">${formatNum(m.totalBal)} ${m.uom}</span> (${formatCurrency(m.totalBalCost)})`;
            card.onclick = () => {
                selectItemBalanceKey(m.key);
            };
            emptyTopContainer.appendChild(card);
        });
    }
}

function selectItemBalanceKey(key) {
    const select = document.getElementById('itemBalSelect');
    if (select) {
        if (!select.querySelector(`option[value="${key}"]`)) {
            const searchInput = document.getElementById('itemBalSearchInput');
            if (searchInput) searchInput.value = '';
            populateItemBalanceDropdown('');
        }
        select.value = key;
        renderItemBalanceView(key);
    }
}

function renderItemBalanceView(preferredKey) {
    if (!rawData) return;
    
    const select = document.getElementById('itemBalSelect');
    if (!select) return;
    
    if (preferredKey) {
        select.value = preferredKey;
        currentItemBalKey = preferredKey;
    } else if (select.value) {
        currentItemBalKey = select.value;
    }
    
    const itemKey = select.value;
    const emptyState = document.getElementById('itemBalEmptyState');
    const infoCard = document.getElementById('itemBalInfoCard');
    const kpiGrid = document.getElementById('itemBalKpis');
    const tableCard = document.getElementById('itemBalTableCard');
    
    if (!itemKey) {
        if (emptyState) emptyState.style.display = 'block';
        if (infoCard) infoCard.style.display = 'none';
        if (kpiGrid) kpiGrid.style.display = 'none';
        if (tableCard) tableCard.style.display = 'none';
        return;
    }
    
    const data = getItemBalanceData(itemKey);
    if (!data) return;
    
    if (emptyState) emptyState.style.display = 'none';
    if (infoCard) infoCard.style.display = 'block';
    if (kpiGrid) kpiGrid.style.display = 'grid';
    if (tableCard) tableCard.style.display = 'block';
    
    const holdingCount = data.contractors.filter(c => c.balanceQty > 0).length;
    const totalWithItem = data.contractors.length;
    
    infoCard.innerHTML = `
        <div class="info-card-header">
            <div class="info-card-title">
                <h2>📦 ${data.desc || 'Material Details'}</h2>
                <p class="subtitle">SAP Code: <strong style="color: #60a5fa;">${data.code || 'N/A'}</strong> | Unit: <span class="badge badge-info">${data.uom || '-'}</span> | Debit Rate: <strong style="color: #10b981;">₹ ${formatNum(data.debitRate)}</strong></p>
            </div>
            <div class="info-card-badges">
                <span class="badge ${holdingCount > 0 ? 'badge-warning' : 'badge-success'}">
                    👷 ${holdingCount} Contractors Holding Stock
                </span>
                <span class="badge badge-info">
                    📋 ${totalWithItem} Total Issued
                </span>
            </div>
        </div>
    `;
    
    const erectedPct = data.totalIssued > 0 ? ((data.totalCons / data.totalIssued) * 100).toFixed(1) : 0;
    
    animateKpiValue('ibKpiIssued', data.totalIssued, formatNum);
    const subIssued = document.getElementById('ibKpiIssuedSub');
    if (subIssued) subIssued.textContent = `${data.uom || ''} issued across ${totalWithItem} contractors`;
    
    animateKpiValue('ibKpiCons', data.totalCons, formatNum);
    const subCons = document.getElementById('ibKpiConsSub');
    if (subCons) subCons.textContent = `${erectedPct}% completed / installed`;
    
    animateKpiValue('ibKpiBal', data.totalBal, formatNum);
    const subBal = document.getElementById('ibKpiBalSub');
    if (subBal) subBal.textContent = `${holdingCount} contractors currently holding ${data.uom || ''}`;
    
    animateKpiValue('ibKpiCost', data.totalBalCost, formatCurrency);
    const subCost = document.getElementById('ibKpiCostSub');
    if (subCost) subCost.textContent = `Total unerected stock value liability`;
    
    const onlyPositive = document.getElementById('itemBalOnlyPositive') ? document.getElementById('itemBalOnlyPositive').checked : true;
    const sortMode = document.getElementById('itemBalSort') ? document.getElementById('itemBalSort').value : 'bal-desc';
    const conFilter = document.getElementById('itemBalContractorFilter') ? document.getElementById('itemBalContractorFilter').value.toLowerCase().trim() : '';
    
    let filtered = data.contractors.filter(c => {
        if (onlyPositive && c.balanceQty <= 0) return false;
        if (conFilter && !c.contractor.toLowerCase().includes(conFilter) && !c.firm.toLowerCase().includes(conFilter)) return false;
        return true;
    });
    
    if (sortMode === 'bal-desc') filtered.sort((a, b) => b.balanceQty - a.balanceQty);
    else if (sortMode === 'cost-desc') filtered.sort((a, b) => b.balanceCost - a.balanceCost);
    else if (sortMode === 'name-asc') filtered.sort((a, b) => a.contractor.localeCompare(b.contractor));
    else if (sortMode === 'issue-desc') filtered.sort((a, b) => b.netIssue - a.netIssue);
    
    const liveBadge = document.getElementById('itemBalLiveBadge');
    if (liveBadge) {
        liveBadge.style.display = 'inline-flex';
        if (data.totalBal > 0) {
            liveBadge.innerHTML = `⚡ Bal: <strong style="margin-left: 4px; color: #fef08a;">${formatNum(data.totalBal)} ${data.uom || ''}</strong>`;
            liveBadge.title = `Total Balance Cost: ${formatCurrency(data.totalBalCost)}`;
        } else {
            liveBadge.innerHTML = `✓ Nil Bal (0 ${data.uom || ''})`;
            liveBadge.style.color = 'var(--success)';
        }
    }

    const tbody = document.querySelector('#itemBalTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    let sumFilteredBal = 0;
    let sumFilteredCost = 0;
    let sumFilteredIssued = 0;
    let sumFilteredCons = 0;
    let sumFilteredWip = 0;
    let sumFilteredTheft = 0;
    
    filtered.forEach((c, idx) => {
        sumFilteredBal += c.balanceQty;
        sumFilteredCost += c.balanceCost;
        sumFilteredIssued += c.netIssue;
        sumFilteredCons += c.consumption;
        sumFilteredWip += (c.wip || 0);
        sumFilteredTheft += (c.theft || 0);
        
        const pct = c.netIssue > 0 ? Math.min(100, Math.max(0, (c.consumption / c.netIssue) * 100)) : 0;
        
        let statusBadge = '';
        if (c.balanceQty > 0) {
            statusBadge = `<span class="badge badge-warning">⚠️ Holding Stock</span>`;
        } else if (c.balanceQty === 0) {
            statusBadge = `<span class="badge badge-success">✓ Fully Erected (Nil)</span>`;
        } else {
            statusBadge = `<span class="badge badge-danger">Excess Deficit</span>`;
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong class="text-muted">${idx + 1}</strong></td>
            <td>
                <div>
                    <strong style="color: var(--text-primary); cursor: pointer;" onclick="jumpToContractor('${c.contractor.replace(/'/g, "\\'")}')" title="Click to open full statement">
                        ${c.contractor}
                    </strong>
                    ${c.firm && c.firm !== c.contractor ? `<div style="font-size: 11px; color: var(--text-muted);">${c.firm}</div>` : ''}
                </div>
            </td>
            <td class="text-right">
                <span class="font-bold ${c.balanceQty > 0 ? 'text-warning' : (c.balanceQty < 0 ? 'text-danger' : 'text-success')}" style="font-size: 14px;">
                    ${formatNum(c.balanceQty)}
                </span>
                <span style="font-size: 11px; color: var(--text-muted); margin-left: 2px;">${data.uom || ''}</span>
            </td>
            <td class="text-right font-bold" style="color: ${c.balanceCost > 0 ? 'var(--text-primary)' : 'var(--text-muted)'};">
                ${formatCurrency(c.balanceCost)}
            </td>
            <td class="text-right">${formatNum(c.netIssue)}</td>
            <td class="text-right text-success">${formatNum(c.consumption)}</td>
            <td class="text-right text-info">${(c.wip || c.theft) ? `${formatNum(c.wip)} / ${formatNum(c.theft)}` : '-'}</td>
            <td class="text-center">
                <div style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">${pct.toFixed(0)}%</div>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width: ${pct}%;"></div>
                </div>
            </td>
            <td class="text-center">${statusBadge}</td>
            <td class="text-center hide-print">
                <button class="btn btn-secondary btn-xs" onclick="jumpToContractor('${c.contractor.replace(/'/g, "\\'")}')" title="View Contractor Statement">
                    👁️ View Statement
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    document.getElementById('ibTableCount').textContent = filtered.length;
    document.getElementById('ibTableBalTotal').textContent = `${formatNum(sumFilteredBal)} ${data.uom || ''} (${formatCurrency(sumFilteredCost)})`;
    document.getElementById('itemBalTableTitle').textContent = `${data.desc} — Total Balance Stock: ${formatNum(data.totalBal)} ${data.uom || ''}`;

    // Update tfoot totals
    const footBalQty = document.getElementById('ibFootBalQty');
    if (footBalQty) footBalQty.textContent = `${formatNum(sumFilteredBal)} ${data.uom || ''}`;
    const footBalCost = document.getElementById('ibFootBalCost');
    if (footBalCost) footBalCost.textContent = formatCurrency(sumFilteredCost);
    const footIssued = document.getElementById('ibFootIssued');
    if (footIssued) footIssued.textContent = formatNum(sumFilteredIssued);
    const footCons = document.getElementById('ibFootCons');
    if (footCons) footCons.textContent = formatNum(sumFilteredCons);
    const footWipTheft = document.getElementById('ibFootWipTheft');
    if (footWipTheft) footWipTheft.textContent = (sumFilteredWip || sumFilteredTheft) ? `${formatNum(sumFilteredWip)} / ${formatNum(sumFilteredTheft)}` : '-';
    const footErectedPct = document.getElementById('ibFootErectedPct');
    if (footErectedPct) footErectedPct.textContent = sumFilteredIssued > 0 ? `${((sumFilteredCons / sumFilteredIssued) * 100).toFixed(0)}%` : '0%';
    
    document.querySelectorAll('.item-bal-chip').forEach(chip => {
        if (chip.dataset.key === itemKey) chip.classList.add('active');
        else chip.classList.remove('active');
    });
}

function jumpToContractor(contractorName) {
    const sel = document.getElementById('contractorSelect');
    if (sel) {
        sel.value = contractorName;
        localStorage.setItem('selectedContractor', contractorName);
    }
    const btn = document.querySelector('.tab-btn[data-tab="contractor"]');
    if (btn) btn.click();
}

function jumpToItemBalance(itemKey) {
    const btn = document.querySelector('.tab-btn[data-tab="item-balance"]');
    if (btn) {
        btn.click();
        setTimeout(() => {
            selectItemBalanceKey(itemKey);
        }, 50);
    }
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
            <td>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span>${r.desc}</span>
                    <button class="btn btn-secondary btn-xs hide-print" onclick="jumpToItemBalance('${(r.code && r.code !== '-') ? r.code : r.desc.replace(/'/g, "\\'")}')" title="Check all contractors holding this item">
                        ⚖️ Balance
                    </button>
                </div>
            </td>
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

    // Item Balance Finder filter events
    const ibSelect = document.getElementById('itemBalSelect');
    if (ibSelect) {
        ibSelect.addEventListener('change', (e) => {
            renderItemBalanceView(e.target.value);
        });
    }
    const ibSearch = document.getElementById('itemBalSearchInput');
    if (ibSearch) {
        ibSearch.addEventListener('input', (e) => {
            populateItemBalanceDropdown(e.target.value);
        });
    }
    const ibOnlyPos = document.getElementById('itemBalOnlyPositive');
    if (ibOnlyPos) {
        ibOnlyPos.addEventListener('change', () => {
            renderItemBalanceView();
        });
    }
    const ibSort = document.getElementById('itemBalSort');
    if (ibSort) {
        ibSort.addEventListener('change', () => {
            renderItemBalanceView();
        });
    }
    const ibConFilter = document.getElementById('itemBalContractorFilter');
    if (ibConFilter) {
        ibConFilter.addEventListener('input', () => {
            renderItemBalanceView();
        });
    }

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
    else if (currentTab === 'item-balance') { tableId = 'itemBalTable'; filename = 'Item_Contractor_Balances.csv'; }
    else if (currentTab === 'material') { tableId = 'materialTable'; filename = 'Material_wise_Reconciliation.csv'; }
    else if (currentTab === 'debit') { tableId = 'debitTable'; filename = 'Master_Debit_Rates.csv'; }
    else if (currentTab === 'alerts') { tableId = 'alertsTable'; filename = 'Material_Discrepancies_Alerts.csv'; }
    else { alert('Pehle koi data tab select karo (Contractor / Item Balance / Material / Debit / Alerts)!'); return; }
    
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
    else if (currentTab === 'item-balance') {
        const itemKey = document.getElementById('itemBalSelect') ? document.getElementById('itemBalSelect').value : '';
        const itemInfo = getItemBalanceData(itemKey);
        filename = (itemInfo && itemInfo.desc ? itemInfo.desc.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30) : 'Item') + '_Contractor_Balances.xlsx';
        sheetName = 'Contractor Balances';
        
        if (itemInfo && itemInfo.contractors) {
            const onlyPos = document.getElementById('itemBalOnlyPositive') ? document.getElementById('itemBalOnlyPositive').checked : true;
            const conFilter = document.getElementById('itemBalContractorFilter') ? document.getElementById('itemBalContractorFilter').value.toLowerCase().trim() : '';
            
            itemInfo.contractors.forEach((c, idx) => {
                if (onlyPos && c.balanceQty <= 0) return;
                if (conFilter && !c.contractor.toLowerCase().includes(conFilter) && !c.firm.toLowerCase().includes(conFilter)) return;
                dataToExport.push({
                    '#': idx + 1,
                    'Contractor Name': c.contractor,
                    'Firm Name': c.firm || '-',
                    'Status': c.activeStatus || '-',
                    'Item Code': itemInfo.code || '-',
                    'Material Description': itemInfo.desc,
                    'UOM': itemInfo.uom || '-',
                    'Debit Rate': itemInfo.debitRate,
                    'Balance Stock (Qty)': c.balanceQty,
                    'Balance Cost (₹)': c.balanceCost,
                    'Net Issued': c.netIssue,
                    'Consumption (Erected)': c.consumption,
                    'WIP': c.wip,
                    'Theft': c.theft,
                    '% Erected': c.netIssue > 0 ? ((c.consumption / c.netIssue) * 100).toFixed(1) + '%' : '0%'
                });
            });
        }
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

                // Helper to safely parse numeric quantities from Excel cell (handles commas, numbers, whitespace)
                const parseQty = (val) => {
                    if (val === null || val === undefined || val === '') return 0;
                    if (typeof val === 'number') return isNaN(val) ? 0 : val;
                    const clean = String(val).replace(/,/g, '').trim();
                    const num = parseFloat(clean);
                    return isNaN(num) ? 0 : num;
                };

                const cleanHeaderStr = (val) => {
                    if (val === null || val === undefined) return '';
                    return String(val)
                        .replace(/[\r\n\t_]+/g, ' ')
                        .replace(/[^\w\s.%-]/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim()
                        .toLowerCase();
                };

                for (const cNameRaw of contractorSheets) {
                    const officialName = getOfficialName(cNameRaw);
                    const cSheet = XLSX.utils.sheet_to_json(wb.Sheets[cNameRaw], {header: 1, defval: ""});
                    
                    // Dynamic Header & Column Detection for image headings:
                    // 1. ISSUED QTY
                    // 2. MRN QTY
                    // 3. NET ISSUED
                    // 4. TOTAL Consumptio (TOTAL Consumption)
                    // 5. WIP
                    // 6. Total Balance
                    // Plus core item identifiers: Item Code, Item Description, UOM
                    
                    let colMap = {
                        itemCode: -1,
                        itemDesc: -1,
                        uom: -1,
                        issue: -1,
                        mrn: -1,
                        netIssue: -1,
                        consumption: -1,
                        wip: -1,
                        theft: -1,
                        balance: -1
                    };
                    let startRow = 1;
                    let bestScore = -1;
                    let bestColMap = null;
                    let bestStartRow = 1;

                    // Matchers for each column given a normalized string
                    const matchers = {
                        issue: (h) => {
                            if (!h) return 0;
                            if (h === 'issued qty' || h === 'issue qty' || h === 'issued quantity' || h === 'qty issued' || h === 'quantity issued' || h === 'issued nos') return 10;
                            if (['net', 'amount', 'rate', 'cost', 'value', 'rs', 'inr'].some(ex => h.includes(ex))) return 0;
                            if (h.includes('issued qty') || h.includes('issue qty')) return 9;
                            if (h.startsWith('issued') || h.startsWith('issue') || h === 'issued') return 6;
                            return 0;
                        },
                        mrn: (h) => {
                            if (!h) return 0;
                            if (h === 'mrn qty' || h === 'mrn quantity' || h === 'qty mrn' || h === 'mrn nos' || h === 'mrn') return 10;
                            if (['amount', 'rate', 'cost', 'value'].some(ex => h.includes(ex))) return 0;
                            if (h.includes('mrn qty') || h.includes('mrn nos')) return 9;
                            if (h.includes('mrn') || h.includes('m r n')) return 7;
                            return 0;
                        },
                        netIssue: (h) => {
                            if (!h) return 0;
                            if (h === 'net issued' || h === 'net issue' || h === 'net issued qty' || h === 'net issue qty' || h === 'net qty issued' || h === 'net quantity') return 10;
                            if (['amount', 'rate', 'cost', 'value'].some(ex => h.includes(ex))) return 0;
                            if (h.includes('net issued') || h.includes('net issue')) return 9;
                            if (h.includes('net') && (h.includes('issue') || h.includes('issued'))) return 7;
                            return 0;
                        },
                        consumption: (h) => {
                            if (!h) return 0;
                            // Exact matches including 'total consumptio' from image
                            if (h === 'total consumptio' || h === 'total consumption' || h === 'total consumtion' || h === 'total cosumption') return 10;
                            if (['amount', 'rate', 'cost', 'value', 'percent', '%'].some(ex => h.includes(ex))) return 0;
                            if (h.includes('total consumptio') || h.includes('total consumption') || h.includes('total consumtion')) return 9;
                            if (h.includes('total') && (h.includes('consum') || h.includes('cosum') || h.includes('erect'))) return 8;
                            if (h === 'consumption' || h === 'consumtion' || h === 'consumed qty' || h === 'total erected' || h === 'erected qty') return 7;
                            if (h.includes('consumption') || h.includes('consumtion') || h.includes('erected')) return 5;
                            return 0;
                        },
                        wip: (h) => {
                            if (!h) return 0;
                            if (h === 'wip' || h === 'w i p' || h === 'wip qty' || h === 'work in progress') return 10;
                            if (['amount', 'rate', 'cost', 'value'].some(ex => h.includes(ex))) return 0;
                            if (h.includes('wip') || h.includes('w i p') || h.includes('work in progress')) return 8;
                            return 0;
                        },
                        balance: (h) => {
                            if (!h) return 0;
                            // Exact matches including 'total balance' from image
                            if (h === 'total balance' || h === 'total bal' || h === 'total balance qty' || h === 'total bal qty') return 10;
                            if (['amount', 'rate', 'cost', 'value', 'debit'].some(ex => h.includes(ex))) return 0;
                            if (h.includes('total balance') || h.includes('total bal')) return 9;
                            if (h === 'balance qty' || h === 'balance quantity' || h === 'balance stock' || h === 'balance material' || h === 'bal qty') return 8;
                            if (h.includes('balance') || h.includes('bal qty')) return 6;
                            return 0;
                        },
                        theft: (h) => {
                            if (!h) return 0;
                            if (h === 'theft' || h === 'thef' || h === 'stolen' || h === 'theft material') return 10;
                            if (['amount', 'rate', 'cost', 'value'].some(ex => h.includes(ex))) return 0;
                            if (h.includes('theft') || h.includes('thef')) return 7;
                            return 0;
                        },
                        itemCode: (h) => {
                            if (!h) return 0;
                            if (h === 'item code' || h === 'itemcode' || h === 'material code' || h === 'mat code' || h === 'sap code' || h === 'mat no' || h === 'item no' || h === 'item no.') return 10;
                            if (['desc', 'description', 'name'].some(ex => h.includes(ex))) return 0;
                            if (h.includes('item code') || h.includes('material code') || h.includes('sap code') || h.includes('mat code')) return 9;
                            if (h === 'code') return 6;
                            return 0;
                        },
                        itemDesc: (h) => {
                            if (!h) return 0;
                            if (h === 'item description' || h === 'material description' || h === 'description of material' || h === 'item desc' || h === 'material desc' || h === 'description' || h === 'material' || h === 'items' || h === 'particulars') return 10;
                            if (['code', 'rate', 'uom', 'unit', 'cost', 'amount', 'val'].some(ex => h.includes(ex))) return 0;
                            if (h.includes('description') || h.includes('material desc') || h.includes('item desc')) return 8;
                            if (h.includes('material') || h.includes('item name')) return 6;
                            return 0;
                        },
                        uom: (h) => {
                            if (!h) return 0;
                            if (h === 'uom' || h === 'unit' || h === 'unit of measurement' || h === 'u o m' || h === 'u.o.m') return 10;
                            if (['rate', 'cost', 'price', 'amount'].some(ex => h.includes(ex))) return 0;
                            if (h.includes('uom') || h.includes('unit')) return 7;
                            return 0;
                        }
                    };

                    const maxHeaderRows = Math.min(cSheet.length, 40);

                    // Scan every potential header row (both single-row and 2-row merged headers)
                    for (let r = 0; r < maxHeaderRows; r++) {
                        const row1 = cSheet[r] || [];
                        const row2 = (r + 1 < maxHeaderRows) ? (cSheet[r + 1] || []) : [];
                        const maxCols = Math.max(row1.length, row2.length);
                        if (maxCols === 0) continue;

                        // Test A: Single row at r
                        // Test B: Multi-row combining r and r+1
                        const tests = [
                            {
                                headerArr: Array.from({length: maxCols}, (_, c) => cleanHeaderStr(row1[c])),
                                nextRow: r + 1
                            }
                        ];
                        if (row2.length > 0) {
                            tests.push({
                                headerArr: Array.from({length: maxCols}, (_, c) => cleanHeaderStr(row1[c] + ' ' + row2[c])),
                                nextRow: r + 2
                            });
                        }

                        for (const test of tests) {
                            const headers = test.headerArr;
                            const curColMap = {
                                itemCode: -1,
                                itemDesc: -1,
                                uom: -1,
                                issue: -1,
                                mrn: -1,
                                netIssue: -1,
                                consumption: -1,
                                wip: -1,
                                theft: -1,
                                balance: -1
                            };
                            let score = 0;

                            for (const key of Object.keys(matchers)) {
                                let bestMatchScore = 0;
                                let bestColIdx = -1;
                                for (let c = 0; c < headers.length; c++) {
                                    const mScore = matchers[key](headers[c]);
                                    if (mScore > bestMatchScore) {
                                        bestMatchScore = mScore;
                                        bestColIdx = c;
                                    }
                                }
                                if (bestMatchScore > 0) {
                                    curColMap[key] = bestColIdx;
                                    score += bestMatchScore;
                                }
                            }

                            // Extra weighting for key columns from the image
                            if (curColMap.issue !== -1) score += 5;
                            if (curColMap.mrn !== -1) score += 5;
                            if (curColMap.netIssue !== -1) score += 5;
                            if (curColMap.consumption !== -1) score += 5;
                            if (curColMap.wip !== -1) score += 5;
                            if (curColMap.balance !== -1) score += 5;

                            if (score > bestScore) {
                                bestScore = score;
                                bestColMap = curColMap;
                                bestStartRow = test.nextRow;
                            }
                        }
                    }

                    if (bestColMap && bestScore >= 15) {
                        colMap = bestColMap;
                        startRow = bestStartRow;
                    }

                    // Fallback heuristics for itemCode and itemDesc if not found by header
                    if (colMap.itemCode === -1 || colMap.itemDesc === -1) {
                        for (let r = startRow; r < Math.min(cSheet.length, startRow + 15); r++) {
                            const row = cSheet[r];
                            if (!row) continue;
                            for (let c = 0; c < row.length; c++) {
                                const valStr = String(row[c] || '').trim();
                                if (colMap.itemCode === -1 && /^\d{6,10}$/.test(valStr)) {
                                    colMap.itemCode = c;
                                }
                                if (colMap.itemDesc === -1 && valStr.length > 5 && /[a-zA-Z]/.test(valStr) && c !== colMap.itemCode) {
                                    colMap.itemDesc = c;
                                }
                            }
                            if (colMap.itemCode !== -1 && colMap.itemDesc !== -1) break;
                        }
                    }

                    const hasKeyColumns = (colMap.issue !== -1 || colMap.consumption !== -1 || colMap.balance !== -1);
                    if (!hasKeyColumns) {
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
                        if (!row) continue;

                        const codeStr = String((colMap.itemCode !== -1 ? row[colMap.itemCode] : '') || '').trim();
                        const descStr = String((colMap.itemDesc !== -1 ? row[colMap.itemDesc] : '') || '').trim();

                        // Skip empty rows
                        if (!codeStr && !descStr) continue;

                        // Skip repeated headers or totals
                        const upperCode = codeStr.toUpperCase();
                        const upperDesc = descStr.toUpperCase();
                        if (upperCode === 'ITEM CODE' || upperCode === 'ITEM' || upperCode === 'CODE' || upperCode === 'SR. NO.' || upperCode === 'SR NO') continue;
                        if (upperDesc.startsWith('TOTAL') || upperDesc.startsWith('GRAND TOTAL') || upperDesc.startsWith('SUB TOTAL') || upperDesc === 'DESCRIPTION' || upperDesc === 'MATERIAL') continue;
                        if (upperCode.startsWith('TOTAL') || upperCode.startsWith('GRAND TOTAL')) continue;

                        // Extract data specifically from the matched columns (as in user's image)
                        const issuedQty  = colMap.issue !== -1 ? parseQty(row[colMap.issue]) : 0;
                        const mrnQty     = colMap.mrn !== -1 ? parseQty(row[colMap.mrn]) : 0;

                        // NetIssue: read from sheet column if found, else calculate issuedQty - mrnQty
                        let netIssueRaw  = colMap.netIssue !== -1 ? parseQty(row[colMap.netIssue]) : 0;
                        if (netIssueRaw === 0 && (colMap.netIssue === -1 || (issuedQty !== 0 || mrnQty !== 0))) {
                            if (colMap.netIssue === -1 || (netIssueRaw === 0 && row[colMap.netIssue] === '')) {
                                netIssueRaw = issuedQty - mrnQty;
                            }
                        }

                        const consumptionQty = colMap.consumption !== -1 ? parseQty(row[colMap.consumption]) : 0;
                        const wipQty         = colMap.wip !== -1 ? parseQty(row[colMap.wip]) : 0;
                        const theftQty       = colMap.theft !== -1 ? parseQty(row[colMap.theft]) : 0;

                        // BalanceQty: read from sheet column if found, else calculate formula
                        let balRaw = 0;
                        if (colMap.balance !== -1) {
                            balRaw = parseQty(row[colMap.balance]);
                        } else {
                            balRaw = netIssueRaw - consumptionQty - wipQty - theftQty;
                        }

                        const item = {
                            ItemCode:        codeStr,
                            ItemDescription: descStr,
                            UOM:             String((colMap.uom !== -1 ? row[colMap.uom] : '') || ''),
                            DebitRate:       0, // Will be set from Master list
                            IssuedQty:       issuedQty,
                            MRNQty:          mrnQty,
                            NetIssue:        netIssueRaw,
                            Consumption:     consumptionQty,
                            WIP:             wipQty,
                            Theft:           theftQty,
                            BalanceQty:      balRaw,
                            BalanceCost:     0 // computed below
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
                        
                        item.BalanceCost = item.BalanceQty * item.DebitRate;
                        contractor.Items.push(item);
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
                
                // POST to cloud API (MongoDB) — upload.php sirf fallback hai (PHP servers ke liye)
                const jsonPayload = JSON.stringify(rawData);
                const finalizeBtn = (text, color) => {
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = text;
                        btn.style.background = color;
                        btn.style.borderColor = color;
                    }
                    setTimeout(() => {
                        // Force hard reload with cache busting
                        window.location.href = window.location.pathname + '?t=' + new Date().getTime();
                    }, 1500);
                };
                saveReconCloud(jsonPayload)
                .then(result => {
                    console.log('Server save response:', result);
                    finalizeBtn('<span>✅ Saved to Cloud!</span>', '#10b981');
                })
                .catch(err => {
                    console.warn('Server save failed (offline):', err);
                    finalizeBtn('<span>⚠️ Local save OK — cloud retry hoga</span>', '#f59e0b');
                });
                
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
