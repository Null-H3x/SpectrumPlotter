// unit_frequencies.js - Unit Frequency Assignments Viewer

let unitsData = [];
let currentFilters = {
    search: '',
    unit: '',
    type: '',
    expiry: ''
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadUnits();
    setupEventListeners();
});

function setupEventListeners() {
    // Refresh button
    document.getElementById('refreshBtn')?.addEventListener('click', loadUnits);

    // Export button
    document.getElementById('exportBtn')?.addEventListener('click', exportFrequencies);

    // Search
    document.getElementById('frequencySearch')?.addEventListener('input', function(e) {
        currentFilters.search = e.target.value.toLowerCase();
        applyFilters();
    });

    // Filters
    document.getElementById('unitFilter')?.addEventListener('change', function(e) {
        currentFilters.unit = e.target.value;
        applyFilters();
    });

    document.getElementById('typeFilter')?.addEventListener('change', function(e) {
        currentFilters.type = e.target.value;
        applyFilters();
    });

    document.getElementById('expiryFilter')?.addEventListener('change', function(e) {
        currentFilters.expiry = e.target.value;
        applyFilters();
    });

    // Modal close handlers
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });
}

async function loadUnits() {
    try {
        const response = await fetch('/api/frequency/units');
        const data = await response.json();

        if (data.units) {
            unitsData = data.units;
            populateUnitFilter(data.units);
            renderUnits(data.units);
            updateStats(data.units);
        } else {
            showError('Failed to load units');
        }
    } catch (error) {
        console.error('Error loading units:', error);
        showError('Error loading units: ' + error.message);
    }
}

function populateUnitFilter(units) {
    const select = document.getElementById('unitFilter');
    if (!select) return;

    // Clear existing options except "All Units"
    select.innerHTML = '<option value="">All Units</option>';

    units.forEach(unit => {
        const option = document.createElement('option');
        option.value = unit.unit.id;
        option.textContent = `${unit.unit.name} (${unit.unit.unit_code})`;
        select.appendChild(option);
    });
}

function renderUnits(units) {
    const container = document.getElementById('unitsContainer');
    if (!container) return;

    if (units.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-broadcast-tower"></i>
                <h3>No Units Assigned</h3>
                <p>You are not currently assigned to any units.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = units.map(unitData => `
        <div class="unit-card" data-unit-id="${unitData.unit.id}">
            <div class="unit-header" onclick="toggleUnit('${unitData.unit.id}')">
                <div class="unit-info">
                    <h3>${unitData.unit.name}</h3>
                    <span class="unit-code">${unitData.unit.unit_code} • ${unitData.unit.organization}</span>
                </div>
                <div class="unit-stats">
                    <div class="unit-stat">
                        <span class="unit-stat-value">${unitData.frequency_assignments?.length || 0}</span>
                        <span class="unit-stat-label">Frequencies</span>
                    </div>
                    <div class="unit-stat">
                        <span class="unit-stat-value">${unitData.pending_requests?.length || 0}</span>
                        <span class="unit-stat-label">Pending</span>
                    </div>
                    <div class="unit-stat">
                        <span class="unit-stat-value">${unitData.member_count || 0}</span>
                        <span class="unit-stat-label">Members</span>
                    </div>
                </div>
            </div>
            <div class="unit-frequencies" id="unit-freq-${unitData.unit.id}" style="display: none;">
                ${renderFrequencyTable(unitData.frequency_assignments || [])}
            </div>
        </div>
    `).join('');
}

function renderFrequencyTable(assignments) {
    if (assignments.length === 0) {
        return '<div class="empty-state"><p>No frequency assignments</p></div>';
    }

    return `
        <table class="frequency-table">
            <thead>
                <tr>
                    <th>Frequency</th>
                    <th>Type</th>
                    <th>Net Name</th>
                    <th>Callsign</th>
                    <th>Purpose</th>
                    <th>Expiration</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${assignments.map(assignment => `
                    <tr data-assignment-id="${assignment.id}">
                        <td>
                            <span class="frequency-value">${assignment.frequency || assignment.frequency_mhz + ' MHz'}</span>
                            ${assignment.is_encrypted ? '<i class="fas fa-lock encrypted-indicator" title="Encrypted"></i>' : ''}
                        </td>
                        <td><span class="frequency-badge badge-${assignment.assignment_type}">${formatAssignmentType(assignment.assignment_type)}</span></td>
                        <td>${assignment.net_name || '-'}</td>
                        <td>${assignment.callsign || '-'}</td>
                        <td>${assignment.purpose || '-'}</td>
                        <td>${formatExpirationDate(assignment.expiration_date)}</td>
                        <td>${formatClassification(assignment.classification)}</td>
                        <td>
                            <button class="btn btn-sm btn-icon" onclick="viewAssignment('${assignment.id}')" title="View Details">
                                <i class="fas fa-eye"></i>
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function toggleUnit(unitId) {
    const freqSection = document.getElementById(`unit-freq-${unitId}`);
    if (freqSection) {
        const isVisible = freqSection.style.display !== 'none';
        freqSection.style.display = isVisible ? 'none' : 'block';
    }
}

function formatAssignmentType(type) {
    const types = {
        'primary': 'Primary',
        'alternate': 'Alternate',
        'emergency': 'Emergency',
        'tactical': 'Tactical'
    };
    return types[type] || type;
}

function formatExpirationDate(dateStr) {
    if (!dateStr) return '-';

    const date = new Date(dateStr);
    const now = new Date();
    const daysUntilExpiry = Math.floor((date - now) / (1000 * 60 * 60 * 24));

    let html = date.toLocaleDateString();

    if (daysUntilExpiry < 0) {
        html += ' <span class="expired-indicator"><i class="fas fa-exclamation-circle"></i> Expired</span>';
    } else if (daysUntilExpiry <= 30) {
        html += ` <span class="expiring-indicator"><i class="fas fa-exclamation-triangle"></i> ${daysUntilExpiry}d</span>`;
    }

    return html;
}

function formatClassification(classification) {
    const classes = {
        'UNCLASS': '<span style="color: #81c784;">UNCLASS</span>',
        'FOUO': '<span style="color: #ffa726;">FOUO</span>'
    };
    return classes[classification] || classification || '-';
}

function updateStats(units) {
    let totalAssignments = 0;
    let expiringCount = 0;
    let pendingRequests = 0;

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    units.forEach(unit => {
        totalAssignments += unit.frequency_assignments?.length || 0;
        pendingRequests += unit.pending_requests?.length || 0;

        unit.frequency_assignments?.forEach(assignment => {
            if (assignment.expiration_date) {
                const expDate = new Date(assignment.expiration_date);
                if (expDate <= thirtyDaysFromNow && expDate >= now) {
                    expiringCount++;
                }
            }
        });
    });

    document.getElementById('totalUnits').textContent = units.length;
    document.getElementById('totalAssignments').textContent = totalAssignments;
    document.getElementById('expiringCount').textContent = expiringCount;
    document.getElementById('pendingRequests').textContent = pendingRequests;
}

async function viewAssignment(assignmentId) {
    // Find the assignment in our data
    let assignment = null;
    for (const unitData of unitsData) {
        assignment = unitData.frequency_assignments?.find(a => a.id === assignmentId);
        if (assignment) break;
    }

    if (!assignment) {
        showError('Assignment not found');
        return;
    }

    const modal = document.getElementById('assignmentModal');
    const detailsDiv = document.getElementById('assignmentDetails');

    detailsDiv.innerHTML = `
        <div class="review-summary">
            <div class="review-section">
                <h3><i class="fas fa-wave-square"></i> Frequency Information</h3>
                <div class="review-field">
                    <span class="review-field-label">Frequency:</span>
                    <span class="review-field-value">${assignment.frequency || assignment.frequency_mhz + ' MHz'}</span>
                </div>
                <div class="review-field">
                    <span class="review-field-label">Assignment Type:</span>
                    <span class="review-field-value">${formatAssignmentType(assignment.assignment_type)}</span>
                </div>
                <div class="review-field">
                    <span class="review-field-label">Net Name:</span>
                    <span class="review-field-value">${assignment.net_name || '-'}</span>
                </div>
                <div class="review-field">
                    <span class="review-field-label">Callsign:</span>
                    <span class="review-field-value">${assignment.callsign || '-'}</span>
                </div>
                <div class="review-field">
                    <span class="review-field-label">Purpose:</span>
                    <span class="review-field-value">${assignment.purpose || '-'}</span>
                </div>
            </div>

            <div class="review-section">
                <h3><i class="fas fa-cogs"></i> Technical Details</h3>
                <div class="review-field">
                    <span class="review-field-label">Emission Designator:</span>
                    <span class="review-field-value">${assignment.emission_designator || '-'}</span>
                </div>
                <div class="review-field">
                    <span class="review-field-label">Bandwidth:</span>
                    <span class="review-field-value">${assignment.bandwidth || '-'}</span>
                </div>
                <div class="review-field">
                    <span class="review-field-label">Power:</span>
                    <span class="review-field-value">${assignment.power_watts ? assignment.power_watts + ' W' : '-'}</span>
                </div>
                <div class="review-field">
                    <span class="review-field-label">Authorized Radius:</span>
                    <span class="review-field-value">${assignment.authorized_radius_km ? assignment.authorized_radius_km + ' km' : '-'}</span>
                </div>
            </div>

            <div class="review-section">
                <h3><i class="fas fa-calendar"></i> Assignment Dates</h3>
                <div class="review-field">
                    <span class="review-field-label">Assignment Date:</span>
                    <span class="review-field-value">${assignment.assignment_date ? new Date(assignment.assignment_date).toLocaleDateString() : '-'}</span>
                </div>
                <div class="review-field">
                    <span class="review-field-label">Expiration Date:</span>
                    <span class="review-field-value">${assignment.expiration_date ? new Date(assignment.expiration_date).toLocaleDateString() : '-'}</span>
                </div>
            </div>

            <div class="review-section">
                <h3><i class="fas fa-shield-alt"></i> Authorization & Security</h3>
                <div class="review-field">
                    <span class="review-field-label">Assignment Authority:</span>
                    <span class="review-field-value">${assignment.assignment_authority || '-'}</span>
                </div>
                <div class="review-field">
                    <span class="review-field-label">Authorization Number:</span>
                    <span class="review-field-value">${assignment.authorization_number || '-'}</span>
                </div>
                <div class="review-field">
                    <span class="review-field-label">Classification:</span>
                    <span class="review-field-value">${assignment.classification || '-'}</span>
                </div>
                <div class="review-field">
                    <span class="review-field-label">Encrypted:</span>
                    <span class="review-field-value">${assignment.is_encrypted ? 'Yes (' + (assignment.encryption_type || 'Type not specified') + ')' : 'No'}</span>
                </div>
                <div class="review-field">
                    <span class="review-field-label">Priority:</span>
                    <span class="review-field-value">${assignment.priority || '-'}</span>
                </div>
            </div>

            ${assignment.notes ? `
                <div class="review-section">
                    <h3><i class="fas fa-sticky-note"></i> Notes</h3>
                    <p>${assignment.notes}</p>
                </div>
            ` : ''}
        </div>
    `;

    modal.style.display = 'block';
}

function closeAssignmentModal() {
    document.getElementById('assignmentModal').style.display = 'none';
}

function applyFilters() {
    // This would filter the displayed units/assignments based on currentFilters
    // For now, just reload to keep it simple
    const filtered = unitsData.filter(unitData => {
        // Filter by unit
        if (currentFilters.unit && unitData.unit.id !== currentFilters.unit) {
            return false;
        }

        // Filter by search (search in unit name, code, or frequencies)
        if (currentFilters.search) {
            const searchLower = currentFilters.search;
            const unitMatch = unitData.unit.name.toLowerCase().includes(searchLower) ||
                             unitData.unit.unit_code.toLowerCase().includes(searchLower);

            const freqMatch = unitData.frequency_assignments?.some(a =>
                a.frequency?.toLowerCase().includes(searchLower) ||
                a.net_name?.toLowerCase().includes(searchLower) ||
                a.callsign?.toLowerCase().includes(searchLower)
            );

            if (!unitMatch && !freqMatch) {
                return false;
            }
        }

        return true;
    });

    renderUnits(filtered);
}

function exportFrequencies() {
    // Export all frequencies to CSV
    const csv = generateCSV();
    downloadCSV(csv, 'unit_frequencies.csv');
}

function generateCSV() {
    const headers = ['Unit', 'Unit Code', 'Frequency', 'Type', 'Net Name', 'Callsign', 'Purpose', 'Expiration', 'Classification'];
    const rows = [headers];

    unitsData.forEach(unitData => {
        unitData.frequency_assignments?.forEach(assignment => {
            rows.push([
                unitData.unit.name,
                unitData.unit.unit_code,
                assignment.frequency || assignment.frequency_mhz + ' MHz',
                formatAssignmentType(assignment.assignment_type),
                assignment.net_name || '',
                assignment.callsign || '',
                assignment.purpose || '',
                assignment.expiration_date || '',
                assignment.classification || ''
            ]);
        });
    });

    return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

function showError(message) {
    const container = document.getElementById('unitsContainer');
    if (container) {
        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-circle"></i>
                ${message}
            </div>
        `;
    }
}
