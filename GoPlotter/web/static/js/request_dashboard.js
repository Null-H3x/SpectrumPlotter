// request_dashboard.js - Frequency Request Dashboard

let myRequests = [];
let pendingRequests = [];
let currentTab = 'my-requests';
let currentRequestId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    setupTabs();
    setupEventListeners();
    loadMyRequests();
});

function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            switchTab(tabName);
        });
    });
}

function setupEventListeners() {
    // Refresh button
    document.getElementById('refreshBtn')?.addEventListener('click', function() {
        if (currentTab === 'my-requests') loadMyRequests();
        else if (currentTab === 'unit-requests') loadUnitRequests();
        else if (currentTab === 'pending-review') loadPendingRequests();
    });

    // Search inputs
    document.getElementById('myRequestsSearch')?.addEventListener('input', function(e) {
        filterRequests('my', e.target.value);
    });

    document.getElementById('unitRequestsSearch')?.addEventListener('input', function(e) {
        filterRequests('unit', e.target.value);
    });

    document.getElementById('pendingSearch')?.addEventListener('input', function(e) {
        filterRequests('pending', e.target.value);
    });

    // Modal close handlers
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tabName}"]`)?.classList.add('active');

    // Update tab panels
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`${tabName}-tab`)?.classList.add('active');

    currentTab = tabName;

    // Load data for the tab
    if (tabName === 'my-requests') {
        loadMyRequests();
    } else if (tabName === 'unit-requests') {
        loadUnitRequests();
    } else if (tabName === 'pending-review') {
        loadPendingRequests();
    }
}

async function loadMyRequests() {
    try {
        const response = await fetch('/api/frequency/requests');
        const data = await response.json();

        if (data.requests) {
            myRequests = data.requests;
            renderRequests('myRequestsContainer', myRequests);
            document.getElementById('myRequestsCount').textContent = data.count || 0;
        }
    } catch (error) {
        console.error('Error loading my requests:', error);
        showError('myRequestsContainer', 'Error loading requests');
    }
}

async function loadUnitRequests() {
    // This would load all requests for units the user belongs to
    // For now, we'll just use the same endpoint
    await loadMyRequests();
    const container = document.getElementById('unitRequestsContainer');
    renderRequests('unitRequestsContainer', myRequests);
}

async function loadPendingRequests() {
    try {
        const response = await fetch('/api/frequency/requests/pending');
        const data = await response.json();

        if (data.requests) {
            pendingRequests = data.requests;
            renderRequests('pendingRequestsContainer', pendingRequests);
            document.getElementById('pendingCount').textContent = data.count || 0;
        }
    } catch (error) {
        console.error('Error loading pending requests:', error);
        showError('pendingRequestsContainer', 'Error loading pending requests');
    }
}

function renderRequests(containerId, requests) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (requests.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-list"></i>
                <h3>No Requests Found</h3>
                <p>There are no frequency requests to display.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = requests.map(req => `
        <div class="request-card" onclick="viewRequest('${req.request.id}')">
            <div class="request-header">
                <div class="request-title">
                    <h4>${req.unit?.name || 'Unknown Unit'} - ${formatRequestType(req.request.request_type)}</h4>
                    <div class="request-meta">
                        Submitted ${formatDate(req.request.created_at)}
                        ${req.request.reviewed_at ? ' • Reviewed ' + formatDate(req.request.reviewed_at) : ''}
                    </div>
                </div>
                <div class="request-badges">
                    <span class="frequency-badge badge-${req.request.priority}">${req.request.priority.toUpperCase()}</span>
                    <span class="frequency-badge badge-${req.request.status.replace('_', '-')}">${formatStatus(req.request.status)}</span>
                </div>
            </div>
            <div class="request-body">
                <div class="request-field">
                    <span class="request-field-label">Frequency</span>
                    <span class="request-field-value">${req.request.requested_frequency || `${req.request.frequency_range_min || '-'} - ${req.request.frequency_range_max || '-'} MHz`}</span>
                </div>
                <div class="request-field">
                    <span class="request-field-label">Purpose</span>
                    <span class="request-field-value">${req.request.purpose || '-'}</span>
                </div>
                <div class="request-field">
                    <span class="request-field-label">Assignment Type</span>
                    <span class="request-field-value">${formatValue(req.request.assignment_type)}</span>
                </div>
                <div class="request-field">
                    <span class="request-field-label">Start Date</span>
                    <span class="request-field-value">${formatDate(req.request.start_date)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

async function viewRequest(requestId) {
    currentRequestId = requestId;

    // Find the request
    let request = myRequests.find(r => r.request.id === requestId) ||
                  pendingRequests.find(r => r.request.id === requestId);

    if (!request) {
        // Try to fetch it
        try {
            const response = await fetch(`/api/frequency/requests/${requestId}`);
            if (response.ok) {
                request = await response.json();
            }
        } catch (error) {
            console.error('Error fetching request:', error);
        }
    }

    if (!request) {
        showAlert('Request not found', 'danger');
        return;
    }

    const modal = document.getElementById('requestModal');
    const detailsDiv = document.getElementById('requestDetails');
    const actionsDiv = document.getElementById('requestActions');

    detailsDiv.innerHTML = generateRequestDetailsHTML(request);
    actionsDiv.innerHTML = generateRequestActionsHTML(request);

    modal.style.display = 'block';
}

function generateRequestDetailsHTML(requestData) {
    const req = requestData.request;
    const unit = requestData.unit;

    return `
        <div class="review-summary">
            <div class="alert alert-info">
                <i class="fas fa-info-circle"></i>
                Status: ${formatStatus(req.status)} • Priority: ${req.priority.toUpperCase()}
            </div>

            <div class="review-section">
                <h3><i class="fas fa-building"></i> Unit Information</h3>
                <div class="review-field">
                    <span class="review-field-label">Unit:</span>
                    <span class="review-field-value">${unit?.name || 'Unknown'}</span>
                </div>
                <div class="review-field">
                    <span class="review-field-label">Unit Code:</span>
                    <span class="review-field-value">${unit?.unit_code || '-'}</span>
                </div>
            </div>

            <div class="review-section">
                <h3><i class="fas fa-clipboard-list"></i> Request Details</h3>
                <div class="review-field">
                    <span class="review-field-label">Request Type:</span>
                    <span class="review-field-value">${formatRequestType(req.request_type)}</span>
                </div>
                <div class="review-field">
                    <span class="review-field-label">Requested Frequency:</span>
                    <span class="review-field-value">${req.requested_frequency || `${req.frequency_range_min || '-'} - ${req.frequency_range_max || '-'} MHz`}</span>
                </div>
                <div class="review-field">
                    <span class="review-field-label">Assignment Type:</span>
                    <span class="review-field-value">${formatValue(req.assignment_type)}</span>
                </div>
                <div class="review-field">
                    <span class="review-field-label">Purpose:</span>
                    <span class="review-field-value">${req.purpose}</span>
                </div>
                <div class="review-field">
                    <span class="review-field-label">Net Name:</span>
                    <span class="review-field-value">${req.net_name || '-'}</span>
                </div>
                <div class="review-field">
                    <span class="review-field-label">Callsign:</span>
                    <span class="review-field-value">${req.callsign || '-'}</span>
                </div>
            </div>

            <div class="review-section">
                <h3><i class="fas fa-cogs"></i> Technical Specifications</h3>
                <div class="review-field">
                    <span class="review-field-label">Emission Designator:</span>
                    <span class="review-field-value">${req.emission_designator || '-'}</span>
                </div>
                <div class="review-field">
                    <span class="review-field-label">Bandwidth:</span>
                    <span class="review-field-value">${req.bandwidth || '-'}</span>
                </div>
                <div class="review-field">
                    <span class="review-field-label">Power:</span>
                    <span class="review-field-value">${req.power_watts ? req.power_watts + ' W' : '-'}</span>
                </div>
                <div class="review-field">
                    <span class="review-field-label">Coverage Area:</span>
                    <span class="review-field-value">${req.coverage_area || '-'}</span>
                </div>
            </div>

            <div class="review-section">
                <h3><i class="fas fa-shield-alt"></i> Security</h3>
                <div class="review-field">
                    <span class="review-field-label">Classification:</span>
                    <span class="review-field-value">${req.classification}</span>
                </div>
                <div class="review-field">
                    <span class="review-field-label">Encrypted:</span>
                    <span class="review-field-value">${req.is_encrypted ? 'Yes' : 'No'}</span>
                </div>
            </div>

            <div class="review-section">
                <h3><i class="fas fa-clipboard-check"></i> Justification</h3>
                <div class="review-field">
                    <span class="review-field-label">Start Date:</span>
                    <span class="review-field-value">${formatDate(req.start_date)}</span>
                </div>
                <div class="review-field">
                    <span class="review-field-label">End Date:</span>
                    <span class="review-field-value">${req.end_date ? formatDate(req.end_date) : 'Ongoing'}</span>
                </div>
                <div class="review-field">
                    <span class="review-field-label">Justification:</span>
                    <span class="review-field-value">${req.justification}</span>
                </div>
                ${req.mission_impact ? `
                    <div class="review-field">
                        <span class="review-field-label">Mission Impact:</span>
                        <span class="review-field-value">${req.mission_impact}</span>
                    </div>
                ` : ''}
            </div>

            ${req.review_notes ? `
                <div class="review-section">
                    <h3><i class="fas fa-comment"></i> Review Notes</h3>
                    <p>${req.review_notes}</p>
                </div>
            ` : ''}

            ${req.denied_reason ? `
                <div class="review-section">
                    <h3><i class="fas fa-times-circle"></i> Denial Reason</h3>
                    <p>${req.denied_reason}</p>
                </div>
            ` : ''}
        </div>
    `;
}

function generateRequestActionsHTML(requestData) {
    const req = requestData.request;
    const userRole = 'admin'; // TODO: Get from session

    let actions = '<button class="btn" onclick="closeRequestModal()">Close</button>';

    // S6/Admin can review pending requests
    if ((userRole === 's6' || userRole === 'admin') && req.status === 'pending') {
        actions += '<button class="btn btn-primary" onclick="openReviewModal()">Review</button>';
    }

    // Admin can approve requests
    if (userRole === 'admin' && req.status === 'under_review') {
        actions += '<button class="btn btn-success" onclick="openApprovalModal()">Approve</button>';
        actions += '<button class="btn btn-danger" onclick="denyRequest()">Deny</button>';
    }

    return actions;
}

function closeRequestModal() {
    document.getElementById('requestModal').style.display = 'none';
}

function openReviewModal() {
    closeRequestModal();
    document.getElementById('reviewModal').style.display = 'block';
}

function closeReviewModal() {
    document.getElementById('reviewModal').style.display = 'none';
}

async function submitReview() {
    const status = document.getElementById('reviewStatus').value;
    const notes = document.getElementById('reviewNotes').value;

    if (!status) {
        showAlert('Please select a status', 'warning');
        return;
    }

    try {
        const response = await fetch(`/api/frequency/requests/${currentRequestId}/review`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status, notes })
        });

        const data = await response.json();

        if (response.ok) {
            showAlert('Review submitted successfully', 'success');
            closeReviewModal();
            loadPendingRequests();
        } else {
            showAlert('Error: ' + (data.error || 'Failed to submit review'), 'danger');
        }
    } catch (error) {
        console.error('Error submitting review:', error);
        showAlert('Error submitting review: ' + error.message, 'danger');
    }
}

function openApprovalModal() {
    closeRequestModal();

    // Pre-fill form with request data
    const request = myRequests.find(r => r.request.id === currentRequestId) ||
                   pendingRequests.find(r => r.request.id === currentRequestId);

    if (request) {
        const req = request.request;
        document.getElementById('approvalRequestId').value = currentRequestId;
        document.getElementById('approvalFrequency').value = req.requested_frequency || '';
        document.getElementById('approvalFrequencyMhz').value = req.requested_frequency ? parseFloat(req.requested_frequency) : '';
        document.getElementById('approvalAssignmentDate').value = new Date().toISOString().split('T')[0];
    }

    document.getElementById('approvalModal').style.display = 'block';
}

function closeApprovalModal() {
    document.getElementById('approvalModal').style.display = 'none';
}

async function submitApproval() {
    const requestId = document.getElementById('approvalRequestId').value;
    const assignmentData = {
        unit_id: '', // Will be filled from the request
        frequency: document.getElementById('approvalFrequency').value,
        frequency_mhz: parseFloat(document.getElementById('approvalFrequencyMhz').value),
        assignment_type: 'primary', // TODO: Get from request
        purpose: '', // TODO: Get from request
        assignment_date: document.getElementById('approvalAssignmentDate').value,
        expiration_date: document.getElementById('approvalExpirationDate').value || null,
        assignment_authority: document.getElementById('approvalAuthority').value || null,
        authorization_number: document.getElementById('approvalAuthNumber').value || null,
        notes: document.getElementById('approvalNotes').value || null
    };

    try {
        const response = await fetch(`/api/frequency/requests/${requestId}/approve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(assignmentData)
        });

        const data = await response.json();

        if (response.ok) {
            showAlert('Request approved and assignment created!', 'success');
            closeApprovalModal();
            loadPendingRequests();
        } else {
            showAlert('Error: ' + (data.error || 'Failed to approve request'), 'danger');
        }
    } catch (error) {
        console.error('Error approving request:', error);
        showAlert('Error approving request: ' + error.message, 'danger');
    }
}

async function denyRequest() {
    const reason = prompt('Please provide a reason for denial:');
    if (!reason) return;

    try {
        const response = await fetch(`/api/frequency/requests/${currentRequestId}/review`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'denied',
                notes: reason
            })
        });

        if (response.ok) {
            showAlert('Request denied', 'success');
            closeRequestModal();
            loadPendingRequests();
        } else {
            const data = await response.json();
            showAlert('Error: ' + (data.error || 'Failed to deny request'), 'danger');
        }
    } catch (error) {
        console.error('Error denying request:', error);
        showAlert('Error denying request: ' + error.message, 'danger');
    }
}

function filterRequests(type, searchTerm) {
    // Simple client-side filtering
    // In production, this should be server-side
    console.log('Filtering', type, 'requests with:', searchTerm);
}

function formatRequestType(type) {
    const types = {
        'new_assignment': 'New Assignment',
        'modification': 'Modification',
        'renewal': 'Renewal',
        'cancellation': 'Cancellation'
    };
    return types[type] || type;
}

function formatStatus(status) {
    const statuses = {
        'pending': 'Pending',
        'under_review': 'Under Review',
        'approved': 'Approved',
        'denied': 'Denied'
    };
    return statuses[status] || status;
}

function formatValue(value) {
    if (!value) return '-';
    return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString();
}

function showError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-circle"></i>
                ${message}
            </div>
        `;
    }
}

function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '10000';
    alertDiv.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;

    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}
