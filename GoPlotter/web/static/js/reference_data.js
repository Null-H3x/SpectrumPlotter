// reference_data.js - Reference Data Management for View Manager

const referenceData = {
    currentTab: 'views',
    units: [],
    iracNotes: [],
    systemConfig: [],

    init() {
        this.setupTabs();
        this.loadUnits();
        this.loadIRACNotes();
    },

    setupTabs() {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });
    },

    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.tab[data-tab="${tabName}"]`)?.classList.add('active');

        // Update active tab panel
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`${tabName}-tab`)?.classList.add('active');

        this.currentTab = tabName;

        // Load data for the tab
        if (tabName === 'units' && this.units.length === 0) {
            this.loadUnits();
        } else if (tabName === 'irac-notes' && this.iracNotes.length === 0) {
            this.loadIRACNotes();
        } else if (tabName === 'system-config' && this.systemConfig.length === 0) {
            this.loadSystemConfig();
        }
    },

    // ============================================
    // Units Management
    // ============================================

    async loadUnits() {
        try {
            const response = await fetch('/api/frequency/units');
            const data = await response.json();

            if (data.units) {
                // Extract just the unit objects
                this.units = data.units.map(u => u.unit);
                this.renderUnits();
            }
        } catch (error) {
            console.error('Error loading units:', error);
            this.showError('unitsTableBody', 'Failed to load units');
        }
    },

    renderUnits() {
        const tbody = document.getElementById('unitsTableBody');
        if (!tbody) return;

        if (this.units.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="5" style="text-align: center;">
                        <i class="fas fa-inbox"></i> No units found
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.units.map(unit => `
            <tr>
                <td><strong>${unit.unit_code}</strong></td>
                <td>${unit.organization || '-'}</td>
                <td>${unit.location || '-'}</td>
                <td>
                    <span class="status-badge ${unit.is_active ? 'status-active' : 'status-inactive'}">
                        ${unit.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-icon" onclick="referenceData.viewUnitFrequencies('${unit.id}')" title="View Frequencies">
                        <i class="fas fa-broadcast-tower"></i>
                    </button>
                    <button class="btn btn-sm btn-icon" onclick="referenceData.editUnit('${unit.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-icon btn-danger" onclick="referenceData.deleteUnit('${unit.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    showAddUnit() {
        document.getElementById('unitModalTitle').innerHTML = '<i class="fas fa-users"></i> Add Unit';
        document.getElementById('unitForm').reset();
        document.getElementById('unitId').value = '';
        document.getElementById('unitIsActive').checked = true;
        document.getElementById('unitModal').style.display = 'block';
    },

    editUnit(unitId) {
        const unit = this.units.find(u => u.id === unitId);
        if (!unit) return;

        document.getElementById('unitModalTitle').innerHTML = '<i class="fas fa-users"></i> Edit Unit';
        document.getElementById('unitId').value = unit.id;
        document.getElementById('unitCode').value = unit.unit_code;
        document.getElementById('unitOrganization').value = unit.organization || '';
        document.getElementById('unitLocation').value = unit.location || '';
        document.getElementById('commanderName').value = unit.commander_name || '';
        document.getElementById('commanderEmail').value = unit.commander_email || '';
        document.getElementById('commPocName').value = unit.comm_poc_name || '';
        document.getElementById('commPocEmail').value = unit.comm_poc_email || '';
        document.getElementById('commPocPhone').value = unit.comm_poc_phone || '';
        document.getElementById('unitIsActive').checked = unit.is_active;
        document.getElementById('unitModal').style.display = 'block';
    },

    async saveUnit() {
        const unitId = document.getElementById('unitId').value;
        const unitData = {
            unit_code: document.getElementById('unitCode').value,
            name: document.getElementById('unitCode').value, // Use unit_code as name for backend compatibility
            organization: document.getElementById('unitOrganization').value,
            location: document.getElementById('unitLocation').value,
            commander_name: document.getElementById('commanderName').value,
            commander_email: document.getElementById('commanderEmail').value,
            comm_poc_name: document.getElementById('commPocName').value,
            comm_poc_email: document.getElementById('commPocEmail').value,
            comm_poc_phone: document.getElementById('commPocPhone').value,
            is_active: document.getElementById('unitIsActive').checked
        };

        if (!unitData.unit_code) {
            alert('Please fill in required field: Unit Designator');
            return;
        }

        try {
            const method = unitId ? 'PUT' : 'POST';
            const url = unitId ? `/api/frequency/units/${unitId}` : '/api/frequency/units';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(unitData)
            });

            if (response.ok) {
                this.showToast('Unit saved successfully', 'success');
                this.closeUnitModal();
                this.loadUnits();
            } else {
                const error = await response.json();
                this.showToast('Error: ' + (error.error || 'Failed to save unit'), 'error');
            }
        } catch (error) {
            console.error('Error saving unit:', error);
            this.showToast('Error saving unit: ' + error.message, 'error');
        }
    },

    async deleteUnit(unitId) {
        if (!confirm('Are you sure you want to delete this unit?')) {
            return;
        }

        try {
            const response = await fetch(`/api/frequency/units/${unitId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.showToast('Unit deleted successfully', 'success');
                this.loadUnits();
            } else {
                const error = await response.json();
                this.showToast('Error: ' + (error.error || 'Failed to delete unit'), 'error');
            }
        } catch (error) {
            console.error('Error deleting unit:', error);
            this.showToast('Error deleting unit: ' + error.message, 'error');
        }
    },

    async viewUnitFrequencies(unitId) {
        try {
            // Fetch fresh unit data with assignments
            const response = await fetch(`/api/frequency/units`);
            if (!response.ok) {
                throw new Error('Failed to fetch unit data');
            }

            const data = await response.json();
            const unitWithAssignments = data.units.find(u => u.unit.id === unitId);

            if (!unitWithAssignments) {
                this.showToast('Unit not found', 'error');
                return;
            }

            // Show modal with frequencies
            this.showFrequenciesModal(unitWithAssignments.unit, unitWithAssignments.frequency_assignments || []);
        } catch (error) {
            console.error('Error loading unit frequencies:', error);
            this.showToast('Error loading frequencies: ' + error.message, 'error');
        }
    },

    showFrequenciesModal(unit, assignments) {
        const modal = document.getElementById('unitFrequenciesModal');
        if (!modal) {
            console.error('Unit frequencies modal not found');
            return;
        }

        // Store current unit data and assignments for navigation to database
        this.currentViewingUnitId = unit.id;
        this.currentViewingUnitCode = unit.unit_code;
        this.currentViewingAssignments = assignments;

        document.getElementById('unitFrequenciesTitle').innerHTML =
            `<i class="fas fa-broadcast-tower"></i> Frequencies for ${unit.unit_code}`;

        const tbody = document.getElementById('unitFrequenciesTableBody');

        if (assignments.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="7" style="text-align: center; padding: 40px;">
                        <i class="fas fa-inbox" style="font-size: 48px; color: #666; display: block; margin-bottom: 10px;"></i>
                        <p style="color: #999;">No frequency assignments found for this unit</p>
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = assignments.map((assignment, index) => {
                const startDate = new Date(assignment.assignment_date).toLocaleDateString();
                const endDate = assignment.expiration_date ? new Date(assignment.expiration_date).toLocaleDateString() : 'Indefinite';
                const daysRemaining = assignment.expiration_date ?
                    Math.ceil((new Date(assignment.expiration_date) - new Date()) / (1000 * 60 * 60 * 24)) : null;

                let statusClass = 'status-active';
                let statusText = 'Active';
                if (daysRemaining !== null) {
                    if (daysRemaining < 0) {
                        statusClass = 'status-inactive';
                        statusText = 'Expired';
                    } else if (daysRemaining <= 30) {
                        statusClass = 'status-warning';
                        statusText = `Expires in ${daysRemaining}d`;
                    }
                }

                return `
                    <tr>
                        <td><strong>${assignment.serial || '-'}</strong></td>
                        <td><strong>${assignment.frequency_mhz.toFixed(6)} MHz</strong></td>
                        <td>${assignment.emission_designator || '-'}</td>
                        <td>${assignment.power_watts ? assignment.power_watts + ' W' : '-'}</td>
                        <td>${startDate}</td>
                        <td>${endDate}</td>
                        <td>
                            <span class="status-badge ${statusClass}">
                                ${statusText}
                            </span>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        modal.style.display = 'block';
    },

    async refreshFrequenciesModal() {
        // Re-fetch the unit data to get latest frequencies
        try {
            const response = await fetch(`/api/frequency/units`);
            if (!response.ok) {
                throw new Error('Failed to refresh frequencies');
            }

            const data = await response.json();
            const unitWithAssignments = data.units.find(u => u.unit.id === this.currentViewingUnitId);

            if (!unitWithAssignments) {
                this.showToast('Unit not found', 'error');
                return;
            }

            // Update the modal with fresh data
            this.currentViewingAssignments = unitWithAssignments.frequency_assignments || [];
            this.showFrequenciesModal(unitWithAssignments.unit, unitWithAssignments.frequency_assignments || []);
            this.showToast('Frequencies refreshed', 'success');
        } catch (error) {
            console.error('Error refreshing frequencies:', error);
            this.showToast('Error refreshing frequencies: ' + error.message, 'error');
        }
    },

    viewUnitInDatabase() {
        // Extract serial numbers from assignments
        const serials = this.currentViewingAssignments.map(assignment => assignment.serial).filter(serial => serial);

        // Store in sessionStorage for db_viewer to pick up
        sessionStorage.setItem('dbFilterSerials', JSON.stringify({
            unitCode: this.currentViewingUnitCode,
            serials: serials
        }));

        // Navigate to database viewer
        window.location.href = '/database';
    },

    closeFrequenciesModal() {
        document.getElementById('unitFrequenciesModal').style.display = 'none';
    },

    closeUnitModal() {
        document.getElementById('unitModal').style.display = 'none';
    },

    async cleanupOrphanedAssignments() {
        if (!confirm('This will delete all frequency assignments that don\'t have corresponding SFAF records. Continue?')) {
            return;
        }

        try {
            const response = await fetch('/api/frequency/cleanup-orphaned', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to cleanup orphaned assignments');
            }

            const data = await response.json();
            this.showToast(`Successfully deleted ${data.deleted} orphaned frequency assignment(s)`, 'success');

            // Reload units to refresh the display
            this.loadUnits();
        } catch (error) {
            console.error('Error cleaning up orphaned assignments:', error);
            this.showToast('Error cleaning up orphaned assignments: ' + error.message, 'error');
        }
    },

    // ============================================
    // IRAC Notes Management
    // ============================================

    async loadIRACNotes() {
        try {
            const response = await fetch('/api/irac-notes');
            const data = await response.json();

            if (data.irac_notes) {
                this.iracNotes = data.irac_notes;
                this.renderIRACNotes();
            }
        } catch (error) {
            console.error('Error loading IRAC notes:', error);
            this.showError('iracNotesTableBody', 'Failed to load IRAC notes');
        }
    },

    renderIRACNotes() {
        const tbody = document.getElementById('iracNotesTableBody');
        if (!tbody) return;

        if (this.iracNotes.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="5" style="text-align: center;">
                        <i class="fas fa-inbox"></i> No IRAC notes found
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.iracNotes.map(note => `
            <tr>
                <td><strong>${note.note_number}</strong></td>
                <td>${note.category || '-'}</td>
                <td>${this.truncateText(note.note_text, 100)}</td>
                <td>
                    <span class="status-badge ${note.is_active ? 'status-active' : 'status-inactive'}">
                        ${note.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-icon" onclick="referenceData.editIRACNote('${note.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-icon btn-danger" onclick="referenceData.deleteIRACNote('${note.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    showAddIRACNote() {
        document.getElementById('iracNoteModalTitle').innerHTML = '<i class="fas fa-sticky-note"></i> Add IRAC Note';
        document.getElementById('iracNoteForm').reset();
        document.getElementById('iracNoteId').value = '';
        document.getElementById('iracNoteIsActive').checked = true;
        document.getElementById('iracNoteModal').style.display = 'block';
    },

    editIRACNote(noteId) {
        const note = this.iracNotes.find(n => n.id === noteId);
        if (!note) return;

        document.getElementById('iracNoteModalTitle').innerHTML = '<i class="fas fa-sticky-note"></i> Edit IRAC Note';
        document.getElementById('iracNoteId').value = note.id;
        document.getElementById('iracNoteNumber').value = note.note_number;
        document.getElementById('iracCategory').value = note.category || '';
        document.getElementById('iracNoteText').value = note.note_text;
        document.getElementById('iracNoteIsActive').checked = note.is_active;
        document.getElementById('iracNoteModal').style.display = 'block';
    },

    async saveIRACNote() {
        const noteId = document.getElementById('iracNoteId').value;
        const noteData = {
            note_number: document.getElementById('iracNoteNumber').value,
            category: document.getElementById('iracCategory').value,
            note_text: document.getElementById('iracNoteText').value,
            is_active: document.getElementById('iracNoteIsActive').checked
        };

        if (!noteData.note_number || !noteData.note_text) {
            alert('Please fill in required fields (Note Number and Text)');
            return;
        }

        try {
            const method = noteId ? 'PUT' : 'POST';
            const url = noteId ? `/api/irac-notes/${noteId}` : '/api/irac-notes';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(noteData)
            });

            if (response.ok) {
                this.showToast('IRAC note saved successfully', 'success');
                this.closeIRACNoteModal();
                this.loadIRACNotes();
            } else {
                const error = await response.json();
                this.showToast('Error: ' + (error.error || 'Failed to save IRAC note'), 'error');
            }
        } catch (error) {
            console.error('Error saving IRAC note:', error);
            this.showToast('Error saving IRAC note: ' + error.message, 'error');
        }
    },

    async deleteIRACNote(noteId) {
        if (!confirm('Are you sure you want to delete this IRAC note?')) {
            return;
        }

        try {
            const response = await fetch(`/api/irac-notes/${noteId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.showToast('IRAC note deleted successfully', 'success');
                this.loadIRACNotes();
            } else {
                const error = await response.json();
                this.showToast('Error: ' + (error.error || 'Failed to delete IRAC note'), 'error');
            }
        } catch (error) {
            console.error('Error deleting IRAC note:', error);
            this.showToast('Error deleting IRAC note: ' + error.message, 'error');
        }
    },

    closeIRACNoteModal() {
        document.getElementById('iracNoteModal').style.display = 'none';
    },

    // ============================================
    // System Config Management
    // ============================================

    async loadSystemConfig() {
        // Placeholder for system config loading
        const tbody = document.getElementById('systemConfigTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="4" style="text-align: center;">
                        <i class="fas fa-info-circle"></i> System configuration management coming soon
                    </td>
                </tr>
            `;
        }
    },

    showAddConfig() {
        alert('System configuration management coming soon');
    },

    // ============================================
    // Helper Functions
    // ============================================

    truncateText(text, maxLength) {
        if (!text) return '-';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    },

    showError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `
                <tr class="error-row">
                    <td colspan="10" style="text-align: center; color: #ef5350;">
                        <i class="fas fa-exclamation-circle"></i> ${message}
                    </td>
                </tr>
            `;
        }
    },

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#ef5350' : '#2196f3'};
            color: white;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'info-circle'}"></i> ${message}`;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    referenceData.init();
});
