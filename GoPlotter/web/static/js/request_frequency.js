// request_frequency.js - Frequency Request Form

let currentStep = 1;
const totalSteps = 6;
let formData = {};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadUnits();
    setupEventListeners();
    showStep(1);
});

function setupEventListeners() {
    // Encryption checkbox
    document.getElementById('isEncrypted')?.addEventListener('change', function(e) {
        document.getElementById('encryptionTypeGroup').style.display = e.target.checked ? 'block' : 'none';
    });

    // Coordination checkbox
    document.getElementById('requiresCoordination')?.addEventListener('change', function(e) {
        document.getElementById('coordinationNotesGroup').style.display = e.target.checked ? 'block' : 'none';
    });

    // Save draft button
    document.getElementById('saveDraftBtn')?.addEventListener('click', saveDraft);

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

        const select = document.getElementById('unitId');
        if (select && data.units) {
            select.innerHTML = '<option value="">Select Unit...</option>' +
                data.units.map(unit =>
                    `<option value="${unit.unit.id}">${unit.unit.name} (${unit.unit.unit_code})</option>`
                ).join('');
        }
    } catch (error) {
        console.error('Error loading units:', error);
    }
}

function showStep(step) {
    // Hide all steps
    document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));

    // Show current step
    const stepElement = document.querySelector(`.form-step[data-step="${step}"]`);
    if (stepElement) {
        stepElement.classList.add('active');
    }

    // Update progress indicator
    document.querySelectorAll('.wizard-step').forEach((s, index) => {
        s.classList.remove('active', 'completed');
        if (index + 1 < step) {
            s.classList.add('completed');
        } else if (index + 1 === step) {
            s.classList.add('active');
        }
    });

    // Update navigation buttons
    document.getElementById('prevBtn').style.display = step === 1 ? 'none' : 'inline-block';
    document.getElementById('nextBtn').style.display = step === totalSteps ? 'none' : 'inline-block';
    document.getElementById('submitBtn').style.display = step === totalSteps ? 'inline-block' : 'none';

    // If on review step, generate summary
    if (step === totalSteps) {
        generateReviewSummary();
    }

    currentStep = step;
}

function changeStep(direction) {
    const newStep = currentStep + direction;

    // Validate current step before moving forward
    if (direction > 0 && !validateStep(currentStep)) {
        return;
    }

    if (newStep >= 1 && newStep <= totalSteps) {
        // Save current step data
        saveStepData(currentStep);
        showStep(newStep);
    }
}

function validateStep(step) {
    const stepElement = document.querySelector(`.form-step[data-step="${step}"]`);
    if (!stepElement) return true;

    const requiredInputs = stepElement.querySelectorAll('[required]');
    let isValid = true;

    requiredInputs.forEach(input => {
        if (!input.value.trim()) {
            input.style.borderColor = '#ef5350';
            isValid = false;
        } else {
            input.style.borderColor = '';
        }
    });

    if (!isValid) {
        showAlert('Please fill in all required fields', 'warning');
    }

    return isValid;
}

function saveStepData(step) {
    const stepElement = document.querySelector(`.form-step[data-step="${step}"]`);
    if (!stepElement) return;

    const inputs = stepElement.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (input.type === 'checkbox') {
            formData[input.name] = input.checked;
        } else {
            formData[input.name] = input.value;
        }
    });
}

function generateReviewSummary() {
    // Collect all form data
    for (let i = 1; i <= totalSteps; i++) {
        saveStepData(i);
    }

    const summary = document.getElementById('reviewSummary');
    if (!summary) return;

    summary.innerHTML = `
        <div class="alert alert-info">
            <i class="fas fa-info-circle"></i>
            Please review your frequency request before submitting. You can go back to make changes if needed.
        </div>

        <div class="review-section">
            <h3><i class="fas fa-clipboard-list"></i> Request Information</h3>
            <div class="review-field">
                <span class="review-field-label">Request Type:</span>
                <span class="review-field-value">${formatValue(formData.request_type)}</span>
            </div>
            <div class="review-field">
                <span class="review-field-label">Priority:</span>
                <span class="review-field-value">${formatValue(formData.priority)}</span>
            </div>
        </div>

        <div class="review-section">
            <h3><i class="fas fa-wave-square"></i> Frequency Requirements</h3>
            <div class="review-field">
                <span class="review-field-label">Requested Frequency:</span>
                <span class="review-field-value">${formData.requested_frequency || 'Range specified'}</span>
            </div>
            ${formData.frequency_range_min ? `
                <div class="review-field">
                    <span class="review-field-label">Frequency Range:</span>
                    <span class="review-field-value">${formData.frequency_range_min} - ${formData.frequency_range_max} MHz</span>
                </div>
            ` : ''}
            <div class="review-field">
                <span class="review-field-label">Assignment Type:</span>
                <span class="review-field-value">${formatValue(formData.assignment_type)}</span>
            </div>
            <div class="review-field">
                <span class="review-field-label">Purpose:</span>
                <span class="review-field-value">${formData.purpose || '-'}</span>
            </div>
            <div class="review-field">
                <span class="review-field-label">Net Name:</span>
                <span class="review-field-value">${formData.net_name || '-'}</span>
            </div>
            <div class="review-field">
                <span class="review-field-label">Callsign:</span>
                <span class="review-field-value">${formData.callsign || '-'}</span>
            </div>
        </div>

        <div class="review-section">
            <h3><i class="fas fa-cogs"></i> Technical Specifications</h3>
            <div class="review-field">
                <span class="review-field-label">Emission Designator:</span>
                <span class="review-field-value">${formData.emission_designator || '-'}</span>
            </div>
            <div class="review-field">
                <span class="review-field-label">Bandwidth:</span>
                <span class="review-field-value">${formData.bandwidth || '-'}</span>
            </div>
            <div class="review-field">
                <span class="review-field-label">Power:</span>
                <span class="review-field-value">${formData.power_watts ? formData.power_watts + ' W' : '-'}</span>
            </div>
            <div class="review-field">
                <span class="review-field-label">Coverage Area:</span>
                <span class="review-field-value">${formData.coverage_area || '-'}</span>
            </div>
            <div class="review-field">
                <span class="review-field-label">Hours of Operation:</span>
                <span class="review-field-value">${formData.hours_of_operation || '-'}</span>
            </div>
        </div>

        <div class="review-section">
            <h3><i class="fas fa-shield-alt"></i> Security & Coordination</h3>
            <div class="review-field">
                <span class="review-field-label">Classification:</span>
                <span class="review-field-value">${formData.classification || '-'}</span>
            </div>
            <div class="review-field">
                <span class="review-field-label">Encrypted:</span>
                <span class="review-field-value">${formData.is_encrypted ? 'Yes (' + (formData.encryption_type || 'Type not specified') + ')' : 'No'}</span>
            </div>
            <div class="review-field">
                <span class="review-field-label">Requires Coordination:</span>
                <span class="review-field-value">${formData.requires_coordination ? 'Yes' : 'No'}</span>
            </div>
        </div>

        <div class="review-section">
            <h3><i class="fas fa-clipboard-check"></i> Justification</h3>
            <div class="review-field">
                <span class="review-field-label">Start Date:</span>
                <span class="review-field-value">${formData.start_date || '-'}</span>
            </div>
            <div class="review-field">
                <span class="review-field-label">End Date:</span>
                <span class="review-field-value">${formData.end_date || '-'}</span>
            </div>
            <div class="review-field">
                <span class="review-field-label">Justification:</span>
                <span class="review-field-value">${formData.justification || '-'}</span>
            </div>
            ${formData.mission_impact ? `
                <div class="review-field">
                    <span class="review-field-label">Mission Impact:</span>
                    <span class="review-field-value">${formData.mission_impact}</span>
                </div>
            ` : ''}
        </div>
    `;
}

function formatValue(value) {
    if (!value) return '-';
    return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

async function submitRequest() {
    // Final validation
    if (!validateAllSteps()) {
        showAlert('Please complete all required fields', 'danger');
        return;
    }

    // Check for conflicts if frequency specified
    if (formData.requested_frequency || formData.frequency_range_min) {
        const conflicts = await checkConflicts();
        if (conflicts && conflicts.length > 0) {
            showConflictWarning(conflicts);
            return;
        }
    }

    await doSubmit();
}

function validateAllSteps() {
    for (let i = 1; i < totalSteps; i++) {
        if (!validateStep(i)) {
            showStep(i);
            return false;
        }
    }
    return true;
}

async function checkConflicts() {
    if (!formData.requested_frequency && !formData.frequency_range_min) {
        return [];
    }

    const frequency = formData.requested_frequency ?
        parseFloat(formData.requested_frequency) :
        parseFloat(formData.frequency_range_min);

    try {
        const response = await fetch(`/api/frequency/assignments/conflicts?frequency=${frequency}&unit_id=${formData.unit_id}&radius=${formData.authorized_radius_km || 50}`);
        const data = await response.json();
        return data.conflicts || [];
    } catch (error) {
        console.error('Error checking conflicts:', error);
        return [];
    }
}

function showConflictWarning(conflicts) {
    const modal = document.getElementById('conflictModal');
    const detailsDiv = document.getElementById('conflictDetails');

    detailsDiv.innerHTML = `
        <div class="alert alert-warning">
            <i class="fas fa-exclamation-triangle"></i>
            ${conflicts.length} potential conflict(s) detected with your requested frequency.
        </div>
        <p>The following existing assignments may conflict:</p>
        <ul>
            ${conflicts.map(c => `
                <li>${c.frequency} MHz - ${c.unit_name || 'Unknown Unit'} - ${c.net_name || 'Unnamed'}</li>
            `).join('')}
        </ul>
        <p>You can review and modify your request, or submit anyway with a note about coordination.</p>
    `;

    modal.style.display = 'block';
}

function closeConflictModal() {
    document.getElementById('conflictModal').style.display = 'none';
}

async function submitAnyway() {
    closeConflictModal();
    await doSubmit();
}

async function doSubmit() {
    try {
        // Prepare request data
        const requestData = {
            unit_id: formData.unit_id,
            request_type: formData.request_type,
            priority: formData.priority,
            requested_frequency: formData.requested_frequency || null,
            frequency_range_min: formData.frequency_range_min ? parseFloat(formData.frequency_range_min) : null,
            frequency_range_max: formData.frequency_range_max ? parseFloat(formData.frequency_range_max) : null,
            purpose: formData.purpose,
            net_name: formData.net_name || null,
            callsign: formData.callsign || null,
            assignment_type: formData.assignment_type,
            emission_designator: formData.emission_designator || null,
            bandwidth: formData.bandwidth || null,
            power_watts: formData.power_watts ? parseInt(formData.power_watts) : null,
            coverage_area: formData.coverage_area || null,
            authorized_radius_km: formData.authorized_radius_km ? parseFloat(formData.authorized_radius_km) : null,
            start_date: formData.start_date,
            end_date: formData.end_date || null,
            hours_of_operation: formData.hours_of_operation || null,
            num_transmitters: formData.num_transmitters ? parseInt(formData.num_transmitters) : 1,
            num_receivers: formData.num_receivers ? parseInt(formData.num_receivers) : 1,
            is_encrypted: formData.is_encrypted || false,
            encryption_type: formData.encryption_type || null,
            classification: formData.classification,
            requires_coordination: formData.requires_coordination || false,
            coordination_notes: formData.coordination_notes || null,
            justification: formData.justification,
            mission_impact: formData.mission_impact || null
        };

        const response = await fetch('/api/frequency/requests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        const data = await response.json();

        if (response.ok) {
            showAlert('Frequency request submitted successfully!', 'success');
            setTimeout(() => {
                window.location.href = '/frequency/requests';
            }, 2000);
        } else {
            showAlert('Error: ' + (data.error || 'Failed to submit request'), 'danger');
        }
    } catch (error) {
        console.error('Error submitting request:', error);
        showAlert('Error submitting request: ' + error.message, 'danger');
    }
}

function saveDraft() {
    // Save form data to localStorage
    for (let i = 1; i <= totalSteps; i++) {
        saveStepData(i);
    }

    localStorage.setItem('frequencyRequestDraft', JSON.stringify(formData));
    showAlert('Draft saved successfully', 'success');
}

function loadDraft() {
    const draft = localStorage.getItem('frequencyRequestDraft');
    if (draft) {
        formData = JSON.parse(draft);

        // Populate form fields
        Object.keys(formData).forEach(key => {
            const input = document.querySelector(`[name="${key}"]`);
            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = formData[key];
                } else {
                    input.value = formData[key];
                }
            }
        });

        showAlert('Draft loaded', 'info');
    }
}

function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;

    const container = document.querySelector('.form-container');
    if (container) {
        container.insertBefore(alertDiv, container.firstChild);

        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
    }
}
