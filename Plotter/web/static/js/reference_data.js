// reference_data.js - Reference Data Management for View Manager

const referenceData = {
    currentTab: 'views',
    units: [],
    iracNotes: [],
    manufacturers: [],
    installations: [],
    systemConfig: [],
    sfafLookup: [],
    controlNumbers: [],
    workboxes: [],
    currentUserInstallationID: null,

    async init() {
        this.setupTabs();
        await this._loadCurrentUserInstallation();
        const savedTab = localStorage.getItem('viewManagerTab') || 'units';
        this.switchTab(savedTab);
        if (savedTab === 'units') this.loadIRACNotes(); // pre-load alongside default
    },

    async _loadCurrentUserInstallation() {
        try {
            const res = await fetch('/api/auth/session');
            const data = await res.json();
            if (data.valid && data.user?.installation_id) {
                this.currentUserInstallationID = data.user.installation_id;
                // Do not pre-set the filter — unit management shows all units by default
            }
        } catch (e) {
            // non-fatal
        }
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
        localStorage.setItem('viewManagerTab', tabName);

        // Load data for the tab
        if (tabName === 'units' && this.units.length === 0) {
            this.loadUnits();
        } else if (tabName === 'irac-notes' && this.iracNotes.length === 0) {
            this.loadIRACNotes();
        } else if (tabName === 'manufacturers' && this.manufacturers.length === 0) {
            this.loadManufacturers();
        } else if (tabName === 'installations') {
            this.loadInstallations();
        } else if (tabName === 'system-config' && this.systemConfig.length === 0) {
            this.loadSystemConfig();
        } else if (tabName === 'sfaf-codes' && this._sfafFieldDefs.length === 0) {
            this.loadSFAFRegistry();
        } else if (tabName === 'control-numbers') {
            this.loadControlNumbers();
        } else if (tabName === 'workboxes') {
            this.loadWorkboxes();
        }
    },

    // ============================================
    // Units Management
    // ============================================

    async loadUnits() {
        try {
            const [unitsRes, instRes] = await Promise.all([
                fetch('/api/frequency/units?all=true'),
                this.installations.length === 0 ? fetch('/api/installations') : Promise.resolve(null)
            ]);

            const data = await unitsRes.json();
            if (data.units) {
                this.units = data.units.map(u => u.unit);
            }

            if (instRes) {
                const instData = await instRes.json();
                this.installations = instData.installations || [];
            }

            this._populateInstallationFilterDropdown();
            this.renderUnits();
        } catch (error) {
            console.error('Error loading units:', error);
            this.showError('unitsTableBody', 'Failed to load units');
        }
    },

    _populateInstallationFilterDropdown() {
        const sel = document.getElementById('unitsInstallationFilter');
        if (!sel) return;
        const current = this._installationFilter || '';

        // Count units assigned per installation so we can show non-empty ones first
        const countByInst = {};
        this.units.forEach(u => {
            if (u.installation_id) countByInst[u.installation_id] = (countByInst[u.installation_id] || 0) + 1;
        });
        const unassigned = this.units.filter(u => !u.installation_id).length;

        const instOpts = this.installations
            .filter(i => i.is_active)
            .map(i => ({
                ...i,
                _count: countByInst[i.id] || 0,
            }))
            .sort((a, b) => b._count - a._count || a.name.localeCompare(b.name));

        sel.innerHTML =
            `<option value="">All Installations (${this.units.length})</option>` +
            (unassigned > 0 ? `<option value="__unassigned__">— Unassigned (${unassigned}) —</option>` : '') +
            instOpts.map(i =>
                `<option value="${i.id}"${i.id === current ? ' selected' : ''}>${i.name}${i._count ? ` (${i._count})` : ''}</option>`
            ).join('');
    },

    filterUnits(q) {
        this._unitFilter = q.toLowerCase();
        this.renderUnits();
    },

    filterUnitsByInstallation(installationId) {
        this._installationFilter = installationId;
        this.renderUnits();
    },

    renderUnits() {
        const tbody = document.getElementById('unitsTableBody');
        if (!tbody) return;

        const q = this._unitFilter || '';
        const instFilter = this._installationFilter || '';
        let list = this.units;
        if (instFilter === '__unassigned__') {
            list = list.filter(u => !u.installation_id);
        } else if (instFilter) {
            list = list.filter(u => u.installation_id === instFilter);
        }
        if (q) {
            list = list.filter(u =>
                (u.name || '').toLowerCase().includes(q) ||
                (u.unit_code || '').toLowerCase().includes(q) ||
                (u.organization || '').toLowerCase().includes(q) ||
                (u.location || '').toLowerCase().includes(q)
            );
        }

        if (list.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="5" style="text-align: center;">
                        <i class="fas fa-inbox"></i> ${q || instFilter ? 'No units match your filters' : 'No units found'}
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = list.map(unit => `
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

    async _populateUnitInstallationDropdown(selectedId) {
        const sel = document.getElementById('unitInstallation');
        if (!sel) return;
        if (this.installations.length === 0) {
            try {
                const res = await fetch('/api/installations');
                const data = await res.json();
                this.installations = data.installations || [];
            } catch { /* ignore */ }
        }
        sel.innerHTML = '<option value="">— Select Installation —</option>';
        this.installations.filter(i => i.is_active).forEach(inst => {
            const opt = document.createElement('option');
            opt.value = inst.id;
            opt.textContent = inst.name + (inst.code ? ' (' + inst.code + ')' : '');
            if (inst.id === selectedId) opt.selected = true;
            sel.appendChild(opt);
        });
    },

    showAddUnit() {
        document.getElementById('unitModalTitle').innerHTML = '<i class="fas fa-users"></i> Add Unit';
        document.getElementById('unitForm').reset();
        document.getElementById('unitId').value = '';
        document.getElementById('unitIsActive').checked = true;
        this._populateUnitInstallationDropdown(null);
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
        this._populateUnitInstallationDropdown(unit.installation_id || null);
        document.getElementById('unitModal').style.display = 'block';
    },

    async saveUnit() {
        const unitId = document.getElementById('unitId').value;
        const instVal = document.getElementById('unitInstallation').value;
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
            installation_id: instVal || null,
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

            if (data.notes) {
                this.iracNotes = data.notes;
                this.renderIRACNotes();
            } else {
                this.iracNotes = [];
                this.renderIRACNotes();
            }
        } catch (error) {
            console.error('Error loading IRAC notes:', error);
            this.showError('iracNotesTableBody', 'Failed to load IRAC notes');
        }
    },

    filterIRACNotes(q) {
        this._iracFilter = q.toLowerCase();
        this.renderIRACNotes();
    },

    renderIRACNotes() {
        const tbody = document.getElementById('iracNotesTableBody');
        if (!tbody) return;

        const q = this._iracFilter || '';
        const notes = q ? this.iracNotes.filter(n =>
            n.code.toLowerCase().includes(q) ||
            (n.title || '').toLowerCase().includes(q) ||
            (n.description || '').toLowerCase().includes(q)
        ) : this.iracNotes;

        if (notes.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="4" style="text-align: center;">
                        <i class="fas fa-inbox"></i> ${q ? 'No notes match your search' : 'No IRAC notes found'}
                    </td>
                </tr>
            `;
            return;
        }

        // Pub 7 category order
        const categoryOrder = ['Coordination', 'Emission', 'Limitation', 'Minute', 'Priority', 'Special'];

        // Group notes by category
        const grouped = {};
        for (const note of notes) {
            const cat = note.category || 'Other';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(note);
        }

        // Sort within each category by numeric portion of code
        const codeNum = code => parseInt(code.replace(/\D+/, ''), 10) || 0;
        for (const cat of Object.keys(grouped)) {
            grouped[cat].sort((a, b) => codeNum(a.code) - codeNum(b.code));
        }

        // Render in Pub 7 order, then any remaining categories
        const orderedCats = [...categoryOrder, ...Object.keys(grouped).filter(c => !categoryOrder.includes(c))];
        if (!this._iracCollapsed) this._iracCollapsed = new Set();

        let rows = '';
        for (const cat of orderedCats) {
            if (!grouped[cat] || grouped[cat].length === 0) continue;
            const catId = 'irac-cat-' + cat.toLowerCase();
            // Auto-expand when searching; otherwise respect manual collapse state
            const collapsed = q ? false : this._iracCollapsed.has(cat);
            rows += `
                <tr class="category-header-row" style="cursor:pointer;" onclick="referenceData.toggleIRACCategory('${cat}')">
                    <td colspan="4" style="background:#2a3a4a;color:#7eb8d4;font-weight:600;padding:6px 12px;font-size:0.8rem;letter-spacing:0.08em;text-transform:uppercase;user-select:none;">
                        <i class="fas ${collapsed ? 'fa-chevron-right' : 'fa-chevron-down'}" id="${catId}-icon" style="margin-right:6px;font-size:0.7rem;"></i>${cat} <span style="opacity:0.6;">(${grouped[cat].length})</span>
                    </td>
                </tr>`;
            for (const note of grouped[cat]) {
                rows += `
                <tr data-irac-cat="${cat}"${collapsed ? ' style="display:none;"' : ''}>
                    <td><strong>${note.code}</strong></td>
                    <td>${note.title || '-'}</td>
                    <td>${this.truncateText(note.description, 120)}</td>
                    <td>
                        <button class="btn btn-sm btn-icon" onclick="referenceData.editIRACNote('${note.code}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-icon btn-danger" onclick="referenceData.deleteIRACNote('${note.code}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>`;
            }
        }
        tbody.innerHTML = rows;
    },

    toggleIRACCategory(cat) {
        if (!this._iracCollapsed) this._iracCollapsed = new Set();
        const collapsed = this._iracCollapsed.has(cat);
        if (collapsed) {
            this._iracCollapsed.delete(cat);
        } else {
            this._iracCollapsed.add(cat);
        }
        const catId = 'irac-cat-' + cat.toLowerCase();
        const icon = document.getElementById(catId + '-icon');
        if (icon) {
            icon.classList.toggle('fa-chevron-down', collapsed);
            icon.classList.toggle('fa-chevron-right', !collapsed);
        }
        document.querySelectorAll(`tr[data-irac-cat="${cat}"]`).forEach(row => {
            row.style.display = collapsed ? '' : 'none';
        });
    },

    showAddIRACNote() {
        document.getElementById('iracNoteModalTitle').innerHTML = '<i class="fas fa-sticky-note"></i> Add IRAC Note';
        document.getElementById('iracNoteForm').reset();
        document.getElementById('iracNoteId').value = '';
        document.getElementById('iracNoteModal').style.display = 'block';
    },

    editIRACNote(noteCode) {
        const note = this.iracNotes.find(n => n.code === noteCode);
        if (!note) return;

        document.getElementById('iracNoteModalTitle').innerHTML = '<i class="fas fa-sticky-note"></i> Edit IRAC Note';
        document.getElementById('iracNoteId').value = note.code;
        document.getElementById('iracNoteNumber').value = note.code;
        document.getElementById('iracCategory').value = note.category || '';
        document.getElementById('iracNoteText').value = note.description || '';
        document.getElementById('iracNoteModal').style.display = 'block';
    },

    async saveIRACNote() {
        const noteCode = document.getElementById('iracNoteId').value;
        const noteData = {
            code: document.getElementById('iracNoteNumber').value,
            category: document.getElementById('iracCategory').value,
            description: document.getElementById('iracNoteText').value,
            title: document.getElementById('iracNoteNumber').value
        };

        if (!noteData.code || !noteData.description) {
            alert('Please fill in required fields (Code and Description)');
            return;
        }

        try {
            const method = noteCode ? 'PUT' : 'POST';
            const url = noteCode ? `/api/irac-notes/${noteCode}` : '/api/irac-notes';

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
    // Manufacturers Management
    // ============================================

    async loadManufacturers() {
        try {
            const response = await fetch('/api/manufacturers');
            const data = await response.json();

            if (data.manufacturers) {
                this.manufacturers = data.manufacturers;
                this.renderManufacturers();
            }
        } catch (error) {
            console.error('Error loading manufacturers:', error);
            this.showError('manufacturersTableBody', 'Failed to load manufacturers');
        }
    },

    filterManufacturers(q) {
        this._mfrFilter = q.toLowerCase();
        this.renderManufacturers();
    },

    renderManufacturers() {
        const tbody = document.getElementById('manufacturersTableBody');
        if (!tbody) return;

        const q = this._mfrFilter || '';
        const list = q ? this.manufacturers.filter(m =>
            m.code.toLowerCase().includes(q) ||
            m.name.toLowerCase().includes(q) ||
            (m.country || '').toLowerCase().includes(q)
        ) : this.manufacturers;

        if (list.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="5" style="text-align: center;">
                        <i class="fas fa-inbox"></i> ${q ? 'No manufacturers match your search' : 'No manufacturers found'}
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = list.map(m => `
            <tr>
                <td><strong>${m.code}</strong></td>
                <td>${m.name}</td>
                <td>${m.country || '-'}</td>
                <td>
                    <span class="status-badge ${m.is_active ? 'status-active' : 'status-inactive'}">
                        ${m.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-icon" onclick="referenceData.editManufacturer('${m.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-icon btn-danger" onclick="referenceData.deleteManufacturer('${m.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    showAddManufacturer() {
        document.getElementById('manufacturerModalTitle').innerHTML = '<i class="fas fa-industry"></i> Add Manufacturer';
        document.getElementById('manufacturerForm').reset();
        document.getElementById('manufacturerId').value = '';
        document.getElementById('manufacturerIsActive').checked = true;
        document.getElementById('manufacturerModal').style.display = 'block';
    },

    editManufacturer(id) {
        const m = this.manufacturers.find(m => m.id === id);
        if (!m) return;

        document.getElementById('manufacturerModalTitle').innerHTML = '<i class="fas fa-industry"></i> Edit Manufacturer';
        document.getElementById('manufacturerId').value = m.id;
        document.getElementById('manufacturerCode').value = m.code;
        document.getElementById('manufacturerName').value = m.name;
        document.getElementById('manufacturerCountry').value = m.country || '';
        document.getElementById('manufacturerIsActive').checked = m.is_active;
        document.getElementById('manufacturerModal').style.display = 'block';
    },

    async saveManufacturer() {
        const id = document.getElementById('manufacturerId').value;
        const data = {
            code: document.getElementById('manufacturerCode').value.toUpperCase(),
            name: document.getElementById('manufacturerName').value,
            country: document.getElementById('manufacturerCountry').value || null,
            is_active: document.getElementById('manufacturerIsActive').checked
        };

        if (!data.code || !data.name) {
            alert('Please fill in required fields: Code and Manufacturer Name');
            return;
        }

        try {
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/manufacturers/${id}` : '/api/manufacturers';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                this.showToast('Manufacturer saved successfully', 'success');
                this.closeManufacturerModal();
                this.manufacturers = [];
                this.loadManufacturers();
            } else {
                const error = await response.json();
                this.showToast('Error: ' + (error.error || 'Failed to save manufacturer'), 'error');
            }
        } catch (error) {
            console.error('Error saving manufacturer:', error);
            this.showToast('Error saving manufacturer: ' + error.message, 'error');
        }
    },

    async deleteManufacturer(id) {
        if (!confirm('Are you sure you want to delete this manufacturer?')) return;

        try {
            const response = await fetch(`/api/manufacturers/${id}`, { method: 'DELETE' });

            if (response.ok) {
                this.showToast('Manufacturer deleted successfully', 'success');
                this.manufacturers = [];
                this.loadManufacturers();
            } else {
                const error = await response.json();
                this.showToast('Error: ' + (error.error || 'Failed to delete manufacturer'), 'error');
            }
        } catch (error) {
            console.error('Error deleting manufacturer:', error);
            this.showToast('Error deleting manufacturer: ' + error.message, 'error');
        }
    },

    closeManufacturerModal() {
        document.getElementById('manufacturerModal').style.display = 'none';
    },

    // ============================================
    // Installations Management
    // ============================================

    async loadInstallations() {
        try {
            const response = await fetch('/api/installations');
            const data = await response.json();
            this.installations = data.installations || [];
            this.renderInstallations();
        } catch (error) {
            console.error('Error loading installations:', error);
            this.showError('installationsTableBody', 'Failed to load installations');
        }
    },

    filterInstallations(q) {
        this._instFilter = q.toLowerCase();
        this.renderInstallations();
    },

    renderInstallations() {
        const tbody = document.getElementById('installationsTableBody');
        if (!tbody) return;

        const q = this._instFilter || '';
        const list = q ? this.installations.filter(i =>
            i.name.toLowerCase().includes(q) ||
            (i.code || '').toLowerCase().includes(q) ||
            (i.organization || '').toLowerCase().includes(q) ||
            (i.state || '').toLowerCase().includes(q)
        ) : this.installations;

        if (list.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="7" style="text-align: center;">
                        <i class="fas fa-inbox"></i> ${q ? 'No installations match your search' : 'No installations found'}
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = list.map(inst => `
            <tr>
                <td><strong>${inst.name}</strong></td>
                <td>${inst.code || '-'}</td>
                <td>${inst.organization || '-'}</td>
                <td>${inst.state || '-'}</td>
                <td>${inst.country || 'USA'}</td>
                <td>
                    <span class="status-badge ${inst.is_active ? 'status-active' : 'status-inactive'}">
                        ${inst.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-icon" onclick="referenceData.editInstallation('${inst.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-icon btn-danger" onclick="referenceData.deleteInstallation('${inst.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    showAddInstallation() {
        document.getElementById('installationModalTitle').innerHTML = '<i class="fas fa-map-marker-alt"></i> Add Installation';
        document.getElementById('installationForm').reset();
        document.getElementById('installationId').value = '';
        document.getElementById('installationCountry').value = 'USA';
        document.getElementById('installationIsActive').checked = true;
        document.getElementById('installationModal').style.display = 'block';
    },

    editInstallation(id) {
        const inst = this.installations.find(i => i.id === id);
        if (!inst) return;

        document.getElementById('installationModalTitle').innerHTML = '<i class="fas fa-map-marker-alt"></i> Edit Installation';
        document.getElementById('installationId').value = inst.id;
        document.getElementById('installationName').value = inst.name;
        document.getElementById('installationCode').value = inst.code || '';
        document.getElementById('installationOrganization').value = inst.organization || '';
        document.getElementById('installationState').value = inst.state || '';
        document.getElementById('installationCountry').value = inst.country || 'USA';
        document.getElementById('installationIsActive').checked = inst.is_active;
        document.getElementById('installationModal').style.display = 'block';
    },

    async saveInstallation() {
        const id = document.getElementById('installationId').value;
        const name = document.getElementById('installationName').value.trim();
        if (!name) {
            alert('Installation Name is required');
            return;
        }

        const data = {
            name,
            code: document.getElementById('installationCode').value.trim() || null,
            organization: document.getElementById('installationOrganization').value || null,
            state: document.getElementById('installationState').value.trim() || null,
            country: document.getElementById('installationCountry').value.trim() || 'USA',
            is_active: document.getElementById('installationIsActive').checked
        };

        try {
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/installations/${id}` : '/api/installations';
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                this.showToast('Installation saved successfully', 'success');
                this.closeInstallationModal();
                this.installations = [];
                this.loadInstallations();
            } else {
                const error = await response.json();
                this.showToast('Error: ' + (error.error || 'Failed to save installation'), 'error');
            }
        } catch (error) {
            this.showToast('Error saving installation: ' + error.message, 'error');
        }
    },

    async deleteInstallation(id) {
        if (!confirm('Are you sure you want to delete this installation?')) return;

        try {
            const response = await fetch(`/api/installations/${id}`, { method: 'DELETE' });

            if (response.ok) {
                this.showToast('Installation deleted successfully', 'success');
                this.installations = [];
                this.loadInstallations();
            } else {
                const error = await response.json();
                this.showToast('Error: ' + (error.error || 'Failed to delete installation'), 'error');
            }
        } catch (error) {
            this.showToast('Error deleting installation: ' + error.message, 'error');
        }
    },

    closeInstallationModal() {
        document.getElementById('installationModal').style.display = 'none';
    },

    // ============================================
    // System Config Management
    // ============================================

    async loadSystemConfig() {
        try {
            const response = await fetch('/api/system-config');
            const data = await response.json();
            if (data.configs) {
                this.systemConfig = data.configs;
                this.renderSystemConfig();
            }
        } catch (error) {
            console.error('Error loading system config:', error);
            this.showError('systemConfigTableBody', 'Failed to load system configuration');
        }
    },

    filterSystemConfig(q) {
        this._configFilter = q.toLowerCase();
        this.renderSystemConfig();
    },

    renderSystemConfig() {
        const tbody = document.getElementById('systemConfigTableBody');
        if (!tbody) return;

        const q = this._configFilter || '';
        const list = q ? this.systemConfig.filter(c =>
            c.key.toLowerCase().includes(q) ||
            (c.description || '').toLowerCase().includes(q) ||
            c.value.toLowerCase().includes(q)
        ) : this.systemConfig;

        if (list.length === 0) {
            tbody.innerHTML = `<tr class="empty-row"><td colspan="4" style="text-align:center;">
                <i class="fas fa-inbox"></i> ${q ? 'No settings match your search' : 'No configuration found'}
            </td></tr>`;
            return;
        }

        // Group by category
        const grouped = {};
        for (const cfg of list) {
            const cat = cfg.category || 'General';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(cfg);
        }

        let rows = '';
        for (const cat of Object.keys(grouped).sort()) {
            rows += `<tr class="category-header-row">
                <td colspan="4" style="background:#2a3a4a;color:#7eb8d4;font-weight:600;padding:6px 12px;font-size:0.8rem;letter-spacing:0.08em;text-transform:uppercase;">
                    ${cat}
                </td>
            </tr>`;
            for (const cfg of grouped[cat]) {
                rows += `<tr>
                    <td style="font-family:monospace;font-size:0.85rem;">${cfg.key}</td>
                    <td>${this._configInputHtml(cfg)}</td>
                    <td style="color:#aaa;font-size:0.85rem;">${cfg.description || ''}</td>
                    <td>
                        ${cfg.is_readonly
                            ? '<span style="color:#555;font-size:0.8rem;">read-only</span>'
                            : `<button class="btn btn-sm btn-primary" onclick="referenceData.saveConfig('${cfg.key}')" title="Save"><i class="fas fa-check"></i></button>`
                        }
                    </td>
                </tr>`;
            }
        }
        tbody.innerHTML = rows;
    },

    _configInputHtml(cfg) {
        if (cfg.is_readonly) {
            return `<span style="font-family:monospace;">${cfg.value}</span>`;
        }
        if (cfg.type === 'boolean') {
            const checked = cfg.value === 'true' ? 'checked' : '';
            return `<input type="checkbox" id="cfg-${cfg.key}" ${checked} style="width:18px;height:18px;cursor:pointer;">`;
        }
        if (cfg.type === 'integer' || cfg.type === 'float') {
            const step = cfg.type === 'float' ? 'any' : '1';
            return `<input type="number" id="cfg-${cfg.key}" value="${cfg.value}" step="${step}"
                style="width:100%;background:rgba(255,255,255,0.07);border:1px solid rgba(100,150,255,0.25);border-radius:4px;color:#e0e0e0;padding:4px 8px;font-size:0.88rem;">`;
        }
        return `<input type="text" id="cfg-${cfg.key}" value="${cfg.value}"
            style="width:100%;background:rgba(255,255,255,0.07);border:1px solid rgba(100,150,255,0.25);border-radius:4px;color:#e0e0e0;padding:4px 8px;font-size:0.88rem;">`;
    },

    async saveConfig(key) {
        const el = document.getElementById('cfg-' + key);
        if (!el) return;
        const value = el.type === 'checkbox' ? String(el.checked) : el.value;
        try {
            const response = await fetch(`/api/system-config/${encodeURIComponent(key)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value })
            });
            if (response.ok) {
                const cfg = this.systemConfig.find(c => c.key === key);
                if (cfg) cfg.value = value;
                this.showToast('Setting saved', 'success');
            } else {
                const err = await response.json();
                this.showToast('Error: ' + (err.error || 'Failed to save'), 'error');
            }
        } catch (error) {
            this.showToast('Error saving setting: ' + error.message, 'error');
        }
    },

    // ============================================
    // SFAF Codes — Field Registry Management
    // ============================================

    _sfafCategories: [],
    _sfafFieldDefs: [],
    _sfafRequiredFields: [],
    _sfafCategoryOpenState: {},
    _sfafSelectedFieldId: null,
    _sfafFieldEditMode: false,
    _sfafFieldDefSnapshot: null,
    _currentLookupField: null,

    async loadSFAFRegistry() {
        try {
            const [catRes, fieldRes, reqRes] = await Promise.all([
                fetch('/api/sfaf-categories'),
                fetch('/api/sfaf-field-defs'),
                fetch('/api/sfaf-required'),
            ]);
            const [catData, fieldData, reqData] = await Promise.all([
                catRes.json(), fieldRes.json(), reqRes.json(),
            ]);
            this._sfafCategories = catData.categories || [];
            this._sfafFieldDefs  = fieldData.fields || [];
            this._sfafRequiredFields = reqData.required_fields || [];
            this._renderCategoryTree();
        } catch (err) {
            const tree = document.getElementById('sfafCategoryTree');
            if (tree) tree.innerHTML = `<div style="padding:16px;color:#ef5350;"><i class="fas fa-exclamation-circle"></i> Failed to load</div>`;
        }
    },

    _renderCategoryTree(filter) {
        const tree = document.getElementById('sfafCategoryTree');
        if (!tree) return;
        const q = (filter || '').toLowerCase();
        const requiredNums = new Set(this._sfafRequiredFields.filter(r => r.scope_type === 'global').map(r => r.field_number));

        let html = '';
        for (const cat of this._sfafCategories) {
            let fields = this._sfafFieldDefs.filter(f => f.category_id === cat.id);
            if (q) {
                fields = fields.filter(f =>
                    f.field_number.includes(q) ||
                    f.title.toLowerCase().includes(q));
            }
            if (q && fields.length === 0) continue;

            const isOpen = q ? true : (this._sfafCategoryOpenState[cat.id] !== false);
            html += `
            <div class="sfaf-cat-block" data-cat-id="${cat.id}">
                <div class="sfaf-cat-header ${isOpen ? 'open' : ''}" onclick="referenceData._toggleCategory('${cat.id}', event)">
                    <i class="fas fa-chevron-right sfaf-cat-chevron"></i>
                    <span class="sfaf-cat-label">${this._esc(cat.name)}</span>
                    <button class="sfaf-cat-rename-btn" onclick="referenceData.editCategory('${cat.id}', event)" title="Rename">
                        <i class="fas fa-pen"></i>
                    </button>
                </div>
                <div class="sfaf-cat-fields ${isOpen ? 'open' : ''}">
                    ${fields.length === 0
                        ? `<div style="padding:4px 28px 6px;font-size:0.72rem;color:#607d8b;font-style:italic;">No fields</div>`
                        : fields.map(f => {
                            const isReq = requiredNums.has(f.field_number);
                            const isActive = this._sfafSelectedFieldId === f.id;
                            return `<div class="sfaf-field-item ${isActive ? 'active' : ''} ${isReq ? 'required' : ''}"
                                    data-field-id="${f.id}"
                                    onclick="referenceData.selectFieldDef('${f.id}')">
                                <span class="sfaf-field-num">${this._esc(f.field_number)}</span>
                                <span class="sfaf-field-title">${this._esc(f.title)}</span>
                                <span class="sfaf-field-required-dot" title="Globally required"></span>
                            </div>`;
                        }).join('')
                    }
                </div>
            </div>`;
        }
        // Uncategorised fields
        const uncatFields = this._sfafFieldDefs.filter(f => !f.category_id);
        if (uncatFields.length > 0 && (!q || uncatFields.some(f => f.field_number.includes(q) || f.title.toLowerCase().includes(q)))) {
            const shown = q ? uncatFields.filter(f => f.field_number.includes(q) || f.title.toLowerCase().includes(q)) : uncatFields;
            if (shown.length > 0) {
                html += `<div style="padding:7px 10px 4px 12px;font-size:0.72rem;font-weight:600;color:#607d8b;text-transform:uppercase;letter-spacing:0.07em;">Uncategorised</div>`;
                html += shown.map(f => {
                    const isActive = this._sfafSelectedFieldId === f.id;
                    return `<div class="sfaf-field-item ${isActive ? 'active' : ''}" data-field-id="${f.id}" onclick="referenceData.selectFieldDef('${f.id}')">
                        <span class="sfaf-field-num">${this._esc(f.field_number)}</span>
                        <span class="sfaf-field-title">${this._esc(f.title)}</span>
                        <span class="sfaf-field-required-dot"></span>
                    </div>`;
                }).join('');
            }
        }
        tree.innerHTML = html || `<div style="padding:16px;text-align:center;color:#607d8b;"><i class="fas fa-search"></i> No fields found</div>`;
    },

    _toggleCategory(catId, e) {
        if (e && e.target.closest('.sfaf-cat-rename-btn')) return;
        this._sfafCategoryOpenState[catId] = !(this._sfafCategoryOpenState[catId] !== false);
        const block = document.querySelector(`.sfaf-cat-block[data-cat-id="${catId}"]`);
        if (!block) return;
        const hdr = block.querySelector('.sfaf-cat-header');
        const fields = block.querySelector('.sfaf-cat-fields');
        const isOpen = this._sfafCategoryOpenState[catId];
        hdr.classList.toggle('open', isOpen);
        fields.classList.toggle('open', isOpen);
    },

    filterFieldNav(q) {
        this._renderCategoryTree(q);
    },

    sfafExpandAll() {
        this._sfafCategories.forEach(c => { this._sfafCategoryOpenState[c.id] = true; });
        this._renderCategoryTree(document.getElementById('sfafNavSearch')?.value || '');
    },

    sfafCollapseAll() {
        this._sfafCategories.forEach(c => { this._sfafCategoryOpenState[c.id] = false; });
        this._renderCategoryTree(document.getElementById('sfafNavSearch')?.value || '');
    },

    selectFieldDef(fieldId) {
        if (this._sfafFieldEditMode) this.cancelFieldEdit();
        this._sfafSelectedFieldId = fieldId;
        this._renderCategoryTree(document.getElementById('sfafNavSearch')?.value || '');

        const field = this._sfafFieldDefs.find(f => f.id === fieldId);
        if (!field) return;

        // Show panel
        document.getElementById('sfafNoSelection').style.display = 'none';
        const panel = document.getElementById('sfafFieldPanel');
        panel.style.display = 'flex';

        // Panel title
        document.getElementById('sfafFieldPanelTitle').innerHTML =
            `<i class="fas fa-list-ol"></i> Field ${this._esc(field.field_number)} — ${this._esc(field.title)}`;

        // Show/hide Lookup sub-tab
        const lookupTab = document.getElementById('sfafLookupSubTab');
        if (lookupTab) lookupTab.style.display = field.has_lookup ? '' : 'none';

        // Switch to info tab
        this.switchFieldSubTab('info');
        this._populateFieldInfo(field);

        // Load required fields for this field
        this._renderRequiredToggles(field.field_number);

        // Store lookup field code
        this._currentLookupField = field.field_number;
    },

    _populateFieldInfo(field) {
        const setView = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val || '—';
        };
        document.getElementById('sfafFieldDefId').value = field.id;
        document.getElementById('sfafFieldDefNumber').value = field.field_number;
        setView('sfafDefFieldNumber', field.field_number);
        setView('sfafDefTitleView', field.title);
        setView('sfafDefCategoryView', field.category_name || '—');
        setView('sfafDefSpectrumView', field.spectrum_xxi_tags || '—');
        setView('sfafDefGmfView', field.gmf_tags || '—');
        setView('sfafDefMaxInputView', field.max_input_length || '—');
        setView('sfafDefMaxOccView', field.max_occurrences || '—');
        setView('sfafDefToIracView', field.to_irac || '—');
        setView('sfafDefMCPOView', field.max_chars_per_occurrence != null ? String(field.max_chars_per_occurrence) : '—');
        setView('sfafDefMCPLView', field.max_chars_per_line != null ? String(field.max_chars_per_line) : '—');
        setView('sfafDefNotesView', field.notes || '—');
        setView('sfafDefHasLookupView', field.has_lookup ? 'Yes' : 'No');
        setView('sfafDefIsActiveView', field.is_active ? 'Active' : 'Inactive');
    },

    switchFieldSubTab(tab) {
        document.querySelectorAll('.sfaf-sub-tab').forEach(b =>
            b.classList.toggle('active', b.dataset.subtab === tab));
        const panels = {
            info:     document.getElementById('sfafInfoSubTab'),
            lookup:   document.getElementById('sfafLookupSubTabPanel'),
            required: document.getElementById('sfafRequiredSubTabPanel'),
        };
        Object.entries(panels).forEach(([key, el]) => {
            if (!el) return;
            el.style.display = key === tab ? (key === 'info' ? 'block' : 'flex') : 'none';
        });
        if (tab === 'lookup') {
            this.sfafLookup = [];
            this.loadLookup(this._currentLookupField);
        }
    },

    toggleFieldEdit() {
        if (this._sfafFieldEditMode) { this.cancelFieldEdit(); return; }
        const field = this._sfafFieldDefs.find(f => f.id === this._sfafSelectedFieldId);
        if (!field) return;
        this._sfafFieldDefSnapshot = JSON.stringify(field);
        this._sfafFieldEditMode = true;

        // Populate category dropdown
        const catSel = document.getElementById('sfafDefCategoryEdit');
        catSel.innerHTML = `<option value="">— None —</option>` +
            this._sfafCategories.map(c => `<option value="${c.id}" ${c.id === field.category_id ? 'selected' : ''}>${this._esc(c.name)}</option>`).join('');

        // Toggle views
        const pairs = [
            ['sfafDefTitleView','sfafDefTitleEdit', field.title],
            ['sfafDefCategoryView','sfafDefCategoryEdit', null],
            ['sfafDefSpectrumView','sfafDefSpectrumEdit', field.spectrum_xxi_tags || ''],
            ['sfafDefGmfView','sfafDefGmfEdit', field.gmf_tags || ''],
            ['sfafDefMaxInputView','sfafDefMaxInputEdit', field.max_input_length || ''],
            ['sfafDefMaxOccView','sfafDefMaxOccEdit', field.max_occurrences || ''],
            ['sfafDefToIracView','sfafDefToIracEdit', field.to_irac || ''],
            ['sfafDefMCPOView','sfafDefMCPOEdit', field.max_chars_per_occurrence != null ? String(field.max_chars_per_occurrence) : ''],
            ['sfafDefMCPLView','sfafDefMCPLEdit', field.max_chars_per_line != null ? String(field.max_chars_per_line) : ''],
            ['sfafDefNotesView','sfafDefNotesEdit', field.notes || ''],
            ['sfafDefHasLookupView','sfafDefHasLookupEdit', null],
            ['sfafDefIsActiveView','sfafDefIsActiveEdit', null],
        ];
        pairs.forEach(([viewId, editId, val]) => {
            const view = document.getElementById(viewId);
            const edit = document.getElementById(editId);
            if (view) view.style.display = 'none';
            if (!edit) return;
            edit.style.display = '';
            if (val !== null && edit.type !== 'checkbox') edit.value = val;
        });
        document.getElementById('sfafDefHasLookupEdit').checked = field.has_lookup;
        document.getElementById('sfafDefIsActiveEdit').checked = field.is_active;
        document.getElementById('sfafDefTitleReq').style.display = '';

        document.getElementById('sfafFieldEditBtn').style.display = 'none';
        document.getElementById('sfafFieldSaveBtn').style.display = '';
        document.getElementById('sfafFieldCancelBtn').style.display = '';
    },

    cancelFieldEdit() {
        this._sfafFieldEditMode = false;
        const viewIds = ['sfafDefTitleView','sfafDefCategoryView','sfafDefSpectrumView','sfafDefGmfView',
            'sfafDefMaxInputView','sfafDefMaxOccView','sfafDefToIracView','sfafDefMCPOView','sfafDefMCPLView',
            'sfafDefNotesView','sfafDefHasLookupView','sfafDefIsActiveView'];
        const editIds = ['sfafDefTitleEdit','sfafDefCategoryEdit','sfafDefSpectrumEdit','sfafDefGmfEdit',
            'sfafDefMaxInputEdit','sfafDefMaxOccEdit','sfafDefToIracEdit','sfafDefMCPOEdit','sfafDefMCPLEdit',
            'sfafDefNotesEdit','sfafDefHasLookupEdit','sfafDefIsActiveEdit'];
        viewIds.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = ''; });
        editIds.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
        document.getElementById('sfafDefTitleReq').style.display = 'none';
        document.getElementById('sfafFieldEditBtn').style.display = '';
        document.getElementById('sfafFieldSaveBtn').style.display = 'none';
        document.getElementById('sfafFieldCancelBtn').style.display = 'none';
    },

    async saveFieldDef() {
        const id = document.getElementById('sfafFieldDefId').value;
        const title = document.getElementById('sfafDefTitleEdit').value.trim();
        if (!title) { this.showToast('Title is required', 'error'); return; }
        const catId = document.getElementById('sfafDefCategoryEdit').value || null;
        const raw = id => { const el = document.getElementById(id); return el ? el.value.trim() || null : null; };
        const num = id => { const v = raw(id); return v ? parseInt(v, 10) : null; };
        const field = this._sfafFieldDefs.find(f => f.id === id);
        const body = {
            title,
            category_id: catId ? catId : null,
            spectrum_xxi_tags: raw('sfafDefSpectrumEdit'),
            gmf_tags: raw('sfafDefGmfEdit'),
            max_input_length: raw('sfafDefMaxInputEdit'),
            max_occurrences: raw('sfafDefMaxOccEdit'),
            to_irac: raw('sfafDefToIracEdit'),
            max_chars_per_occurrence: num('sfafDefMCPOEdit'),
            max_chars_per_line: num('sfafDefMCPLEdit'),
            notes: raw('sfafDefNotesEdit'),
            has_lookup: document.getElementById('sfafDefHasLookupEdit').checked,
            is_active: document.getElementById('sfafDefIsActiveEdit').checked,
            sort_order: field ? field.sort_order : 0,
        };
        try {
            const res = await fetch(`/api/sfaf-field-defs/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json();
                this.showToast('Error: ' + (err.error || 'Save failed'), 'error');
                return;
            }
            const data = await res.json();
            const updated = data.field;
            // Update local cache
            const idx = this._sfafFieldDefs.findIndex(f => f.id === id);
            if (idx >= 0 && updated) this._sfafFieldDefs[idx] = updated;
            this.cancelFieldEdit();
            this._populateFieldInfo(updated || this._sfafFieldDefs.find(f => f.id === id));
            // Refresh sidebar title
            document.getElementById('sfafFieldPanelTitle').innerHTML =
                `<i class="fas fa-list-ol"></i> Field ${this._esc(updated.field_number)} — ${this._esc(updated.title)}`;
            this._renderCategoryTree(document.getElementById('sfafNavSearch')?.value || '');
            // Update Lookup sub-tab visibility
            const lookupTab = document.getElementById('sfafLookupSubTab');
            if (lookupTab) lookupTab.style.display = updated.has_lookup ? '' : 'none';
            this.showToast('Field saved', 'success');
        } catch (err) {
            this.showToast('Error: ' + err.message, 'error');
        }
    },

    // ── Category CRUD ──────────────────────────

    showAddCategory() {
        document.getElementById('sfafCategoryId').value = '';
        document.getElementById('sfafCategoryName').value = '';
        document.getElementById('sfafCategorySortOrder').value = (this._sfafCategories.length + 1) * 10;
        document.getElementById('sfafCategoryModalTitle').innerHTML = `<i class="fas fa-folder-plus"></i> Add Category`;
        document.getElementById('sfafCategoryModal').style.display = 'block';
    },

    editCategory(catId, e) {
        if (e) { e.stopPropagation(); }
        const cat = this._sfafCategories.find(c => c.id === catId);
        if (!cat) return;
        document.getElementById('sfafCategoryId').value = cat.id;
        document.getElementById('sfafCategoryName').value = cat.name;
        document.getElementById('sfafCategorySortOrder').value = cat.sort_order;
        document.getElementById('sfafCategoryModalTitle').innerHTML = `<i class="fas fa-folder"></i> Rename Category`;
        document.getElementById('sfafCategoryModal').style.display = 'block';
    },

    async saveCategory() {
        const id   = document.getElementById('sfafCategoryId').value;
        const name = document.getElementById('sfafCategoryName').value.trim();
        const sortOrder = parseInt(document.getElementById('sfafCategorySortOrder').value, 10) || 0;
        if (!name) { this.showToast('Name is required', 'error'); return; }
        try {
            const method = id ? 'PUT' : 'POST';
            const url    = id ? `/api/sfaf-categories/${id}` : '/api/sfaf-categories';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, sort_order: sortOrder }),
            });
            if (!res.ok) { const err = await res.json(); this.showToast('Error: ' + (err.error || 'Failed'), 'error'); return; }
            this.showToast(id ? 'Category renamed' : 'Category added', 'success');
            this.closeCategoryModal();
            await this.loadSFAFRegistry();
        } catch (err) {
            this.showToast('Error: ' + err.message, 'error');
        }
    },

    closeCategoryModal() {
        document.getElementById('sfafCategoryModal').style.display = 'none';
    },

    // ── Required fields ────────────────────────

    _scopeLabels: {
        global:          { label: 'Global — Required for all SFAFs', tag: 'GLOBAL',    cls: 'sfaf-req-scope-global' },
        agency:          { label: 'Agency',                            tag: 'AGENCY',    cls: 'sfaf-req-scope-agency' },
        unified_command: { label: 'Unified Command',                   tag: 'UNIF CMD',  cls: 'sfaf-req-scope-uc' },
        majcom:          { label: 'MAJCOM',                            tag: 'MAJCOM',    cls: 'sfaf-req-scope-majcom' },
    },

    _scopeOptions: {
        agency: [
            { value: 'AF',   label: 'AF — Air Force' },
            { value: 'USSF', label: 'USSF — Space Force' },
            { value: 'USA',  label: 'USA — Army' },
            { value: 'USN',  label: 'USN — Navy' },
            { value: 'USMC', label: 'USMC — Marine Corps' },
            { value: 'USCG', label: 'USCG — Coast Guard' },
            { value: 'DoD',  label: 'DoD — Department of Defense' },
        ],
        unified_command: [
            { value: 'USCENTCOM',   label: 'CENTCOM — Central Command' },
            { value: 'USCYBERCOM', label: 'CYBERCOM — Cyber Command' },
            { value: 'USEUCOM',    label: 'EUCOM — European Command' },
            { value: 'USINDOPACOM',label: 'INDOPACOM — Indo-Pacific Command' },
            { value: 'USNORTHCOM', label: 'NORTHCOM — Northern Command' },
            { value: 'USSOCOM',    label: 'SOCOM — Special Operations Command' },
            { value: 'USSOUTHCOM', label: 'SOUTHCOM — Southern Command' },
            { value: 'USSPACECOM', label: 'SPACECOM — Space Command' },
            { value: 'USSTRATCOM', label: 'STRATCOM — Strategic Command' },
            { value: 'USTRANSCOM', label: 'TRANSCOM — Transportation Command' },
        ],
    },

    _renderRequiredToggles(fieldNumber) {
        const container = document.getElementById('sfafRequiredToggles');
        if (!container) return;

        // Build MAJCOM options from cached units
        const majcomOpts = this.units
            .filter(u => u.unit_type === 'MAJCOM' && u.unit_code)
            .sort((a, b) => a.unit_code.localeCompare(b.unit_code))
            .map(u => ({ value: u.unit_code, label: `${u.unit_code} — ${u.name}` }));

        const html = Object.entries(this._scopeLabels).map(([scopeType, meta]) => {
            const scopeReqs = this._sfafRequiredFields.filter(
                r => r.field_number === fieldNumber && r.scope_type === scopeType);
            if (scopeType === 'global') {
                const isReq = scopeReqs.length > 0;
                const rowId = scopeReqs[0]?.id || '';
                return `<div class="sfaf-req-row">
                    <span class="sfaf-req-scope-tag ${meta.cls}">${meta.tag}</span>
                    <label for="sfafReq_${scopeType}">${meta.label}</label>
                    <input type="checkbox" id="sfafReq_${scopeType}" ${isReq ? 'checked' : ''}
                        data-field="${fieldNumber}" data-scope="${scopeType}" data-scope-value=""
                        data-row-id="${rowId}"
                        onchange="referenceData.toggleRequiredField(this)">
                </div>`;
            }

            // For non-global scopes: list of existing entries + filterable select to add
            const rows = scopeReqs.map(r => `
                <div style="display:flex;align-items:center;gap:8px;padding:4px 0;">
                    <span style="flex:1;font-size:0.82rem;padding:4px 8px;background:rgba(100,150,255,0.06);border-radius:4px;color:#cdd6e0;">
                        ${this._esc(r.scope_value)}
                    </span>
                    <button class="btn btn-sm btn-icon btn-danger" onclick="referenceData.removeRequiredField('${r.id}')" title="Remove">
                        <i class="fas fa-times"></i>
                    </button>
                </div>`).join('');

            const alreadyAdded = new Set(scopeReqs.map(r => r.scope_value));
            const opts = (scopeType === 'majcom' ? majcomOpts : this._scopeOptions[scopeType] || [])
                .filter(o => !alreadyAdded.has(o.value));
            const selectOpts = opts.length
                ? opts.map(o => `<option value="${this._esc(o.value)}">${this._esc(o.label)}</option>`).join('')
                : `<option value="" disabled>All options added</option>`;

            return `<div class="sfaf-req-row" style="flex-direction:column;align-items:stretch;gap:8px;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <span class="sfaf-req-scope-tag ${meta.cls}">${meta.tag}</span>
                    <span style="flex:1;font-size:0.85rem;color:#cdd6e0;">${meta.label}</span>
                </div>
                <div id="sfafReqList_${scopeType}">${rows || '<div style="color:#607d8b;font-size:0.8rem;font-style:italic;">No entries</div>'}</div>
                <div style="display:flex;gap:6px;">
                    <select id="sfafReqInput_${scopeType}" class="form-input" style="flex:1;padding:4px 8px;font-size:0.8rem;">
                        <option value="">— Select ${meta.label} —</option>
                        ${selectOpts}
                    </select>
                    <button class="btn btn-sm btn-primary" onclick="referenceData.addRequiredField('${fieldNumber}','${scopeType}')">
                        <i class="fas fa-plus"></i> Add
                    </button>
                </div>
            </div>`;
        }).join('');
        container.innerHTML = html;
    },

    async toggleRequiredField(checkbox) {
        const { field, scope, scopeValue, rowId } = checkbox.dataset;
        if (checkbox.checked) {
            try {
                const res = await fetch('/api/sfaf-required', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ field_number: field, scope_type: scope, scope_value: scopeValue || '' }),
                });
                if (!res.ok) throw new Error((await res.json()).error || 'Failed');
                const data = await res.json();
                this._sfafRequiredFields.push(data.required_field);
                checkbox.dataset.rowId = data.required_field.id;
                this._renderCategoryTree(document.getElementById('sfafNavSearch')?.value || '');
                this.showToast('Required field set', 'success');
            } catch (err) {
                checkbox.checked = false;
                this.showToast('Error: ' + err.message, 'error');
            }
        } else {
            if (!rowId) return;
            try {
                const res = await fetch(`/api/sfaf-required/${rowId}`, { method: 'DELETE' });
                if (!res.ok) throw new Error((await res.json()).error || 'Failed');
                this._sfafRequiredFields = this._sfafRequiredFields.filter(r => r.id !== rowId);
                checkbox.dataset.rowId = '';
                this._renderCategoryTree(document.getElementById('sfafNavSearch')?.value || '');
                this.showToast('Required field removed', 'success');
            } catch (err) {
                checkbox.checked = true;
                this.showToast('Error: ' + err.message, 'error');
            }
        }
    },

    async addRequiredField(fieldNumber, scopeType) {
        const input = document.getElementById(`sfafReqInput_${scopeType}`);
        const scopeValue = input ? input.value.trim() : '';
        if (!scopeValue) { this.showToast('Enter a scope value', 'error'); return; }
        try {
            const res = await fetch('/api/sfaf-required', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ field_number: fieldNumber, scope_type: scopeType, scope_value: scopeValue }),
            });
            if (!res.ok) throw new Error((await res.json()).error || 'Failed');
            const data = await res.json();
            this._sfafRequiredFields.push(data.required_field);
            if (input) input.value = '';
            this._renderRequiredToggles(fieldNumber);
            this.showToast('Added', 'success');
        } catch (err) {
            this.showToast('Error: ' + err.message, 'error');
        }
    },

    async removeRequiredField(rowId) {
        const row = this._sfafRequiredFields.find(r => r.id === rowId);
        try {
            const res = await fetch(`/api/sfaf-required/${rowId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error((await res.json()).error || 'Failed');
            this._sfafRequiredFields = this._sfafRequiredFields.filter(r => r.id !== rowId);
            if (row) this._renderRequiredToggles(row.field_number);
            this.showToast('Removed', 'success');
        } catch (err) {
            this.showToast('Error: ' + err.message, 'error');
        }
    },

    // ── Lookup Values (existing, unchanged logic) ──

    // Field numbers whose lookup values are sourced from another table
    _workboxDrivenFields: new Set(['206']),

    async loadLookup(fieldCode) {
        this._currentLookupField = fieldCode;
        try {
            if (this._workboxDrivenFields.has(String(fieldCode))) {
                // Field 206 (ISM Workbox): values come from the workboxes table
                const res = await fetch('/api/frequency/workboxes');
                const data = await res.json();
                // Normalise to the same shape renderLookup expects
                this.sfafLookup = (data.workboxes || []).map(w => ({
                    _isWorkbox: true,
                    value:      w.name,
                    label:      w.description || '',
                    is_active:  w.is_active,
                }));
            } else {
                const res = await fetch(`/api/sfaf-lookup?field=${fieldCode}`);
                const data = await res.json();
                this.sfafLookup = data.entries || [];
            }
            this.renderLookup();
        } catch (err) {
            this.showError('sfafCodesTableBody', 'Failed to load entries');
        }
    },

    filterLookup(q) {
        this._lookupFilter = q.toLowerCase();
        this.renderLookup();
    },

    renderLookup() {
        const tbody = document.getElementById('sfafCodesTableBody');
        if (!tbody) return;

        const isWorkboxField = this.sfafLookup.length > 0 && this.sfafLookup[0]?._isWorkbox;

        // Show/hide Add Entry button and managed-by notice
        const addBtn = document.getElementById('sfafLookupAddBtn');
        const managedNotice = document.getElementById('sfafLookupManagedNotice');
        if (addBtn) addBtn.style.display = isWorkboxField ? 'none' : '';
        if (managedNotice) managedNotice.style.display = isWorkboxField ? '' : 'none';

        const q = this._lookupFilter || '';
        const list = q
            ? this.sfafLookup.filter(e =>
                e.value.toLowerCase().includes(q) ||
                (e.label || '').toLowerCase().includes(q))
            : this.sfafLookup;

        if (list.length === 0) {
            tbody.innerHTML = `<tr class="empty-row"><td colspan="6" style="text-align:center;">
                <i class="fas fa-inbox"></i> ${q ? 'No entries match your search' : 'No lookup values yet'}
            </td></tr>`;
            return;
        }

        tbody.innerHTML = list.map(e => `
            <tr>
                <td><strong>${this._esc(e.value)}</strong></td>
                <td>${this._esc(e.label || '')}</td>
                <td style="text-align:center;">${e.sort_order ?? '—'}</td>
                <td style="text-align:center;">${e.char_limit != null ? e.char_limit : '—'}</td>
                <td>
                    <span class="status-badge ${e.is_active ? 'status-active' : 'status-inactive'}">
                        ${e.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    ${e._isWorkbox ? '' : `
                    <button class="btn btn-sm btn-icon" onclick="referenceData.editLookup('${e.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-icon btn-danger" onclick="referenceData.deleteLookup('${e.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>`}
                </td>
            </tr>
        `).join('');
    },

    showAddLookup() {
        const field = this._sfafFieldDefs.find(f => f.field_number === this._currentLookupField);
        const title = field ? `Field ${field.field_number} — ${field.title}` : `Field ${this._currentLookupField}`;
        document.getElementById('sfafLookupModalTitle').innerHTML = `<i class="fas fa-list-ol"></i> Add Entry — ${this._esc(title)}`;
        document.getElementById('sfafLookupForm').reset();
        document.getElementById('sfafLookupId').value = '';
        document.getElementById('sfafLookupFieldCode').value = this._currentLookupField;
        document.getElementById('sfafLookupIsActive').checked = true;
        document.getElementById('sfafLookupSortOrder').value = '0';
        document.getElementById('sfafLookupCharLimit').value = '';
        document.getElementById('sfafLookupModal').style.display = 'block';
    },

    editLookup(id) {
        const e = this.sfafLookup.find(x => x.id === id);
        if (!e) return;
        const field = this._sfafFieldDefs.find(f => f.field_number === e.field_code);
        const title = field ? `Field ${field.field_number} — ${field.title}` : `Field ${e.field_code}`;
        document.getElementById('sfafLookupModalTitle').innerHTML = `<i class="fas fa-list-ol"></i> Edit Entry — ${this._esc(title)}`;
        document.getElementById('sfafLookupId').value = e.id;
        document.getElementById('sfafLookupFieldCode').value = e.field_code;
        document.getElementById('sfafLookupValue').value = e.value;
        document.getElementById('sfafLookupLabel').value = e.label || '';
        document.getElementById('sfafLookupSortOrder').value = e.sort_order;
        document.getElementById('sfafLookupCharLimit').value = e.char_limit != null ? e.char_limit : '';
        document.getElementById('sfafLookupIsActive').checked = e.is_active;
        document.getElementById('sfafLookupModal').style.display = 'block';
    },

    async saveLookup() {
        const id = document.getElementById('sfafLookupId').value;
        const fieldCode = document.getElementById('sfafLookupFieldCode').value;
        const value = document.getElementById('sfafLookupValue').value.trim();
        const label = document.getElementById('sfafLookupLabel').value.trim() || null;
        const sortOrder = parseInt(document.getElementById('sfafLookupSortOrder').value, 10) || 0;
        const charLimitRaw = document.getElementById('sfafLookupCharLimit').value.trim();
        const charLimit = charLimitRaw !== '' ? parseInt(charLimitRaw, 10) : null;
        const isActive = document.getElementById('sfafLookupIsActive').checked;

        if (!value) { alert('Value is required'); return; }

        const body = id
            ? { value, label, sort_order: sortOrder, is_active: isActive, char_limit: charLimit }
            : { field_code: fieldCode, value, label, sort_order: sortOrder, char_limit: charLimit };

        try {
            const method = id ? 'PUT' : 'POST';
            const url    = id ? `/api/sfaf-lookup/${id}` : '/api/sfaf-lookup';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                this.showToast('Entry saved', 'success');
                this.closeLookupModal();
                this.sfafLookup = [];
                this.loadLookup(this._currentLookupField);
            } else {
                const err = await res.json();
                this.showToast('Error: ' + (err.error || 'Failed to save'), 'error');
            }
        } catch (err) {
            this.showToast('Error: ' + err.message, 'error');
        }
    },

    async deleteLookup(id) {
        if (!confirm('Delete this entry?')) return;
        try {
            const res = await fetch(`/api/sfaf-lookup/${id}`, { method: 'DELETE' });
            if (res.ok) {
                this.showToast('Entry deleted', 'success');
                this.sfafLookup = [];
                this.loadLookup(this._currentLookupField);
            } else {
                const err = await res.json();
                this.showToast('Error: ' + (err.error || 'Failed to delete'), 'error');
            }
        } catch (err) {
            this.showToast('Error: ' + err.message, 'error');
        }
    },

    closeLookupModal() {
        document.getElementById('sfafLookupModal').style.display = 'none';
    },

    _esc(s) {
        if (!s) return '';
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
    },

    // ============================================
    // Control Numbers (702) Management
    // ============================================

    async loadControlNumbers() {
        try {
            const res = await fetch('/api/frequency/control-numbers');
            const data = await res.json();
            this.controlNumbers = data.control_numbers || [];
            this.renderControlNumbers();
        } catch (e) {
            this.showError('cnTableBody', 'Failed to load control numbers');
        }
    },

    filterControlNumbers(q) {
        this._cnFilter = q.toLowerCase();
        this.renderControlNumbers();
    },

    renderControlNumbers() {
        const tbody = document.getElementById('cnTableBody');
        if (!tbody) return;
        const q = this._cnFilter || '';
        const rows = q
            ? this.controlNumbers.filter(cn =>
                cn.number.toLowerCase().includes(q) ||
                (cn.description || '').toLowerCase().includes(q))
            : this.controlNumbers;

        if (rows.length === 0) {
            tbody.innerHTML = `<tr class="empty-row"><td colspan="3" style="text-align:center;">
                <i class="fas fa-inbox"></i> ${q ? 'No entries match your search' : 'No 702 entries yet'}
            </td></tr>`;
            return;
        }
        tbody.innerHTML = rows.map(cn => `
            <tr>
                <td><strong>${cn.number}</strong></td>
                <td>${cn.description || '<span style="color:#64748b;font-style:italic;">—</span>'}</td>
                <td>
                    <button class="btn btn-sm btn-icon" onclick="referenceData.editCN('${cn.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-icon btn-danger" onclick="referenceData.deleteCN('${cn.id}', '${cn.number.replace(/'/g, "\\'")}');" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`).join('');
    },

    updateCNPreview() {
        const name = (document.getElementById('cnName').value || '').trim();
        const year = (document.getElementById('cnYear').value || '').trim();
        const seq  = (document.getElementById('cnSequence').value || '').trim();
        const prev = document.getElementById('cnPreview');
        if (!prev) return;
        if (name && year && seq) {
            prev.textContent = `${name} ${year}-${seq}`;
        } else if (name) {
            prev.textContent = name + (year ? ` ${year}` : '') + (seq ? `-${seq}` : '');
        } else {
            prev.textContent = '';
        }
    },

    updateCNRangePreview() {
        const org   = (document.getElementById('cnRangeOrg')?.value   || '').trim();
        const year  = (document.getElementById('cnRangeYear')?.value  || '').trim();
        const start = parseInt(document.getElementById('cnRangeStart')?.value || '');
        const end   = parseInt(document.getElementById('cnRangeEnd')?.value   || '');
        const prev  = document.getElementById('cnRangePreview');
        if (!prev) return;
        if (org && year && !isNaN(start) && !isNaN(end) && end >= start) {
            const count = end - start + 1;
            prev.style.display = '';
            prev.innerHTML = `<i class="fas fa-info-circle" style="margin-right:4px;"></i>`
                + `Will create <strong>${count}</strong> entr${count === 1 ? 'y' : 'ies'}: `
                + `<span style="font-family:monospace;">${org} ${year}-${start}</span>`
                + (count > 1 ? ` → <span style="font-family:monospace;">${org} ${year}-${end}</span>` : '');
        } else {
            prev.style.display = 'none';
        }
    },

    showAddControlNumber() {
        document.getElementById('cnModalTitle').innerHTML = '<i class="fas fa-hashtag"></i> Add 702 Entries';
        document.getElementById('cnId').value = '';
        document.getElementById('cnRangeOrg').value   = '';
        document.getElementById('cnRangeYear').value  = new Date().getFullYear();
        document.getElementById('cnRangeStart').value = '';
        document.getElementById('cnRangeEnd').value   = '';
        document.getElementById('cnRangeDesc').value  = '';
        document.getElementById('cnRangePreview').style.display = 'none';
        document.getElementById('cnBulkSection').style.display = '';
        document.getElementById('cnEditSection').style.display = 'none';
        document.getElementById('cnModal').style.display = 'block';
        document.getElementById('cnRangeOrg').focus();
    },

    editCN(id) {
        const cn = this.controlNumbers.find(c => c.id === id);
        if (!cn) return;
        document.getElementById('cnModalTitle').innerHTML = '<i class="fas fa-hashtag"></i> Edit 702 Entry';
        document.getElementById('cnId').value = cn.id;
        // Parse "ORG YYYY-SEQ" format; fall back to putting whole string in name field
        const m = cn.number.match(/^(\S+)\s+(\d{4})-(\d+)$/);
        if (m) {
            document.getElementById('cnName').value     = m[1];
            document.getElementById('cnYear').value     = m[2];
            document.getElementById('cnSequence').value = m[3];
        } else {
            document.getElementById('cnName').value     = cn.number;
            document.getElementById('cnYear').value     = '';
            document.getElementById('cnSequence').value = '';
        }
        document.getElementById('cnDescription').value = cn.description || '';
        this.updateCNPreview();
        document.getElementById('cnBulkSection').style.display = 'none';
        document.getElementById('cnEditSection').style.display = '';
        document.getElementById('cnModal').style.display = 'block';
    },

    closeCNModal() {
        document.getElementById('cnModal').style.display = 'none';
    },

    async saveCN() {
        const id = document.getElementById('cnId').value;

        // ── Edit mode (single entry) ──
        if (id) {
            const name   = (document.getElementById('cnName').value || '').trim();
            const year   = (document.getElementById('cnYear').value || '').trim();
            const seq    = (document.getElementById('cnSequence').value || '').trim();
            const number = (name && year && seq) ? `${name} ${year}-${seq}` : name;
            if (!number) { alert('Organization name is required.'); return; }
            const body = { number, description: document.getElementById('cnDescription').value.trim() };
            try {
                const res = await fetch(`/api/frequency/control-numbers/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (res.ok) {
                    this.showToast('702 entry updated', 'success');
                    this.closeCNModal();
                    this.loadControlNumbers();
                } else {
                    const err = await res.json();
                    this.showToast('Error: ' + (err.error || 'Save failed'), 'error');
                }
            } catch (e) {
                this.showToast('Error: ' + e.message, 'error');
            }
            return;
        }

        // ── Range add mode ──
        const org   = (document.getElementById('cnRangeOrg').value   || '').trim();
        const year  = (document.getElementById('cnRangeYear').value  || '').trim();
        const start = parseInt(document.getElementById('cnRangeStart').value || '');
        const end   = parseInt(document.getElementById('cnRangeEnd').value   || '');
        const desc  = (document.getElementById('cnRangeDesc').value  || '').trim();

        if (!org)              { alert('Organization is required.');   return; }
        if (!year)             { alert('Year is required.');           return; }
        if (isNaN(start))      { alert('Sequence start is required.'); return; }
        if (isNaN(end))        { alert('Sequence end is required.');   return; }
        if (end < start)       { alert('Sequence end must be ≥ start.'); return; }
        const count = end - start + 1;
        if (count > 500 && !confirm(`This will create ${count} entries. Continue?`)) return;

        let saved = 0, failed = 0;
        for (let seq = start; seq <= end; seq++) {
            try {
                const res = await fetch('/api/frequency/control-numbers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ number: `${org} ${year}-${seq}`, description: desc }),
                });
                if (res.ok) saved++; else failed++;
            } catch { failed++; }
        }
        this.showToast(
            `${saved} entr${saved === 1 ? 'y' : 'ies'} saved` + (failed ? `, ${failed} failed` : ''),
            failed ? 'error' : 'success'
        );
        this.closeCNModal();
        this.loadControlNumbers();
    },

    async deleteCN(id, number) {
        if (!confirm(`Delete 702 entry "${number}"?`)) return;
        try {
            const res = await fetch(`/api/frequency/control-numbers/${id}`, { method: 'DELETE' });
            if (res.ok) {
                this.showToast('702 entry deleted', 'success');
                this.loadControlNumbers();
            } else {
                const err = await res.json();
                this.showToast('Error: ' + (err.error || 'Delete failed'), 'error');
            }
        } catch (e) {
            this.showToast('Error: ' + e.message, 'error');
        }
    },

    // ── Workboxes ────────────────────────────────────────────────────────────

    _currentWBId: null,      // workbox whose members panel is open
    _wbIsmUsers: [],         // cached ISM-role users for the add-member dropdown

    async loadWorkboxes() {
        try {
            // Load workboxes and installations in parallel; ISM users loaded once for member panel
            const [wbRes, instRes, usersRes] = await Promise.all([
                fetch('/api/frequency/workboxes'),
                this.installations.length === 0 ? fetch('/api/installations') : Promise.resolve(null),
                fetch('/api/admin/users'),
            ]);

            const data = await wbRes.json();
            this.workboxes = data.workboxes || [];

            if (instRes) {
                const instData = await instRes.json();
                this.installations = instData.installations || [];
            }

            if (usersRes.ok) {
                const ud = await usersRes.json();
                // Keep only ISM-role users for the member add dropdown
                this._wbIsmUsers = (ud.users || []).filter(u => u.role === 'ism');
            }

            this._populateWBInstallationDropdown();
            this.renderWorkboxes();
        } catch (e) {
            this.showError('wbTableBody', 'Failed to load workboxes');
        }
    },

    _populateWBInstallationDropdown() {
        const sel = document.getElementById('wbInstallation');
        if (!sel) return;
        const current = sel.value;
        sel.innerHTML = '<option value="">— None / Agency-level —</option>' +
            this.installations
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(i => `<option value="${i.id}">${i.name}</option>`)
                .join('');
        if (current) sel.value = current;
    },

    filterWorkboxes(q) {
        this._wbFilter = q.toLowerCase();
        this.renderWorkboxes();
    },

    renderWorkboxes() {
        const tbody = document.getElementById('wbTableBody');
        if (!tbody) return;
        const q = this._wbFilter || '';
        const rows = q
            ? this.workboxes.filter(w =>
                w.name.toLowerCase().includes(q) ||
                (w.description || '').toLowerCase().includes(q) ||
                (w.installation_name || '').toLowerCase().includes(q))
            : this.workboxes;

        if (rows.length === 0) {
            tbody.innerHTML = `<tr class="empty-row"><td colspan="6" style="text-align:center;">
                <i class="fas fa-inbox"></i> ${q ? 'No workboxes match your search' : 'No workboxes yet'}
            </td></tr>`;
            return;
        }
        tbody.innerHTML = rows.map(w => `
            <tr class="${this._currentWBId === w.id ? 'row-selected' : ''}" style="cursor:pointer;"
                onclick="referenceData.showWBMembersPanel('${w.id}')">
                <td><strong>${w.name}</strong></td>
                <td>${w.description || '<span style="color:#64748b;font-style:italic;">—</span>'}</td>
                <td>${w.installation_name ? `<span style="font-size:0.82rem;">${w.installation_name}</span>` : '<span style="color:#64748b;font-style:italic;">—</span>'}</td>
                <td style="text-align:center;">
                    ${w.member_count > 0
                        ? `<span class="status-badge status-active" style="font-size:0.75rem;">${w.member_count}</span>`
                        : '<span style="color:#64748b;">0</span>'}
                </td>
                <td><span class="status-badge ${w.is_active ? 'status-active' : 'status-inactive'}">${w.is_active ? 'Active' : 'Inactive'}</span></td>
                <td onclick="event.stopPropagation();">
                    <button class="btn btn-sm btn-icon" onclick="referenceData.editWorkbox('${w.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-icon btn-danger" onclick="referenceData.deleteWorkbox('${w.id}', ${JSON.stringify(w.name)})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`).join('');
    },

    showAddWorkbox() {
        this._populateWBInstallationDropdown();
        document.getElementById('wbModalTitle').innerHTML = '<i class="fas fa-inbox"></i> Add Workbox';
        document.getElementById('wbId').value = '';
        document.getElementById('wbName').value = '';
        document.getElementById('wbDescription').value = '';
        document.getElementById('wbInstallation').value = '';
        document.getElementById('wbIsActive').checked = true;
        document.getElementById('wbModal').style.display = 'block';
        document.getElementById('wbName').focus();
    },

    editWorkbox(id) {
        const w = this.workboxes.find(x => x.id === id);
        if (!w) return;
        this._populateWBInstallationDropdown();
        document.getElementById('wbModalTitle').innerHTML = '<i class="fas fa-inbox"></i> Edit Workbox';
        document.getElementById('wbId').value = w.id;
        document.getElementById('wbName').value = w.name;
        document.getElementById('wbDescription').value = w.description || '';
        document.getElementById('wbInstallation').value = w.installation_id || '';
        document.getElementById('wbIsActive').checked = w.is_active;
        document.getElementById('wbModal').style.display = 'block';
    },

    closeWBModal() {
        document.getElementById('wbModal').style.display = 'none';
    },

    async saveWorkbox() {
        const id = document.getElementById('wbId').value;
        const instVal = document.getElementById('wbInstallation').value;
        const body = {
            name:            document.getElementById('wbName').value.trim(),
            description:     document.getElementById('wbDescription').value.trim(),
            installation_id: instVal || null,
            is_active:       document.getElementById('wbIsActive').checked,
        };
        if (!body.name) { alert('Workbox name is required.'); return; }
        try {
            const method = id ? 'PUT' : 'POST';
            const url    = id
                ? `/api/frequency/workboxes/${id}`
                : '/api/frequency/workboxes';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                this.showToast('Workbox saved', 'success');
                this.closeWBModal();
                this.loadWorkboxes();
            } else {
                const err = await res.json();
                this.showToast('Error: ' + (err.error || 'Save failed'), 'error');
            }
        } catch (e) {
            this.showToast('Error: ' + e.message, 'error');
        }
    },

    async deleteWorkbox(id, name) {
        if (!confirm(`Delete workbox "${name}"?\n\nUsers assigned to this workbox will have their workbox cleared.`)) return;
        try {
            const res = await fetch(`/api/frequency/workboxes/${id}`, { method: 'DELETE' });
            if (res.ok) {
                this.showToast('Workbox deleted', 'success');
                if (this._currentWBId === id) this.closeWBMembersPanel();
                this.loadWorkboxes();
            } else {
                const err = await res.json();
                this.showToast('Error: ' + (err.error || 'Delete failed'), 'error');
            }
        } catch (e) {
            this.showToast('Error: ' + e.message, 'error');
        }
    },

    // ── Workbox Members Panel ─────────────────────────────────────────────────

    async showWBMembersPanel(workboxId) {
        this._currentWBId = workboxId;
        const wb = this.workboxes.find(w => w.id === workboxId);

        const panel = document.getElementById('wbMembersPanel');
        panel.style.display = 'flex';

        const title = document.getElementById('wbMembersPanelTitle');
        title.innerHTML = `<i class="fas fa-users"></i> ${wb ? wb.name : 'Members'}`;

        // Highlight the selected row
        this.renderWorkboxes();

        // Populate the user dropdown (ISM users not already primary in this workbox)
        this._refreshWBMemberUserSelect(workboxId);

        // Load current members
        await this.loadWorkboxMembers(workboxId);
    },

    _refreshWBMemberUserSelect(workboxId) {
        const sel = document.getElementById('wbMemberUserSelect');
        if (!sel) return;
        sel.innerHTML = '<option value="">Select user…</option>' +
            this._wbIsmUsers
                .slice()
                .sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email))
                .map(u => `<option value="${u.id}">${u.full_name || u.email}</option>`)
                .join('');
    },

    async loadWorkboxMembers(workboxId) {
        const list = document.getElementById('wbMembersList');
        if (!list) return;
        list.innerHTML = '<div style="padding:20px;text-align:center;color:#607d8b;"><i class="fas fa-spinner fa-spin"></i></div>';
        try {
            const res = await fetch(`/api/frequency/workboxes/${workboxId}/members`);
            if (!res.ok) throw new Error('Failed to fetch members');
            const data = await res.json();
            const members = data.members || [];

            if (members.length === 0) {
                list.innerHTML = '<div style="padding:16px;text-align:center;color:#607d8b;font-size:0.85rem;">No members assigned</div>';
                return;
            }

            list.innerHTML = members.map(m => `
                <div class="wb-member-row" style="display:flex;align-items:center;gap:8px;padding:6px 16px;border-bottom:1px solid rgba(100,150,255,0.06);">
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:0.85rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            ${m.user_name || m.user_email}
                            ${m.is_primary ? '<span style="font-size:0.7rem;background:#1e40af;color:#93c5fd;border-radius:4px;padding:1px 5px;margin-left:4px;">primary</span>' : ''}
                        </div>
                        <div style="font-size:0.75rem;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.user_email}</div>
                    </div>
                    ${!m.is_primary ? `
                    <button class="btn btn-sm btn-icon" title="Set as primary"
                        onclick="referenceData.setWBMemberPrimary('${workboxId}', '${m.user_id}')">
                        <i class="fas fa-star"></i>
                    </button>` : ''}
                    <button class="btn btn-sm btn-icon btn-danger" title="Remove"
                        onclick="referenceData.removeWorkboxMember('${workboxId}', '${m.user_id}', ${JSON.stringify(m.user_name || m.user_email)})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>`).join('');
        } catch (e) {
            list.innerHTML = `<div style="padding:16px;text-align:center;color:#ef4444;font-size:0.85rem;">Error loading members</div>`;
        }
    },

    async addWorkboxMember() {
        const workboxId = this._currentWBId;
        if (!workboxId) return;
        const sel = document.getElementById('wbMemberUserSelect');
        const userId = sel?.value;
        if (!userId) { alert('Select a user first.'); return; }
        const isPrimary = document.getElementById('wbMemberIsPrimary')?.checked || false;

        try {
            const res = await fetch(`/api/frequency/workboxes/${workboxId}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, is_primary: isPrimary }),
            });
            if (res.ok) {
                sel.value = '';
                if (document.getElementById('wbMemberIsPrimary'))
                    document.getElementById('wbMemberIsPrimary').checked = false;
                await this.loadWorkboxMembers(workboxId);
                // Refresh list to update member counts
                const wbRes = await fetch('/api/frequency/workboxes');
                const wbData = await wbRes.json();
                this.workboxes = wbData.workboxes || [];
                this.renderWorkboxes();
                this.showToast('Member added', 'success');
            } else {
                const err = await res.json();
                this.showToast('Error: ' + (err.error || 'Add failed'), 'error');
            }
        } catch (e) {
            this.showToast('Error: ' + e.message, 'error');
        }
    },

    async setWBMemberPrimary(workboxId, userId) {
        try {
            // Re-add as primary — backend upserts with is_primary=true
            const res = await fetch(`/api/frequency/workboxes/${workboxId}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, is_primary: true }),
            });
            if (res.ok) {
                await this.loadWorkboxMembers(workboxId);
                this.showToast('Primary updated', 'success');
            } else {
                const err = await res.json();
                this.showToast('Error: ' + (err.error || 'Update failed'), 'error');
            }
        } catch (e) {
            this.showToast('Error: ' + e.message, 'error');
        }
    },

    async removeWorkboxMember(workboxId, userId, userName) {
        if (!confirm(`Remove ${userName} from this workbox?`)) return;
        try {
            const res = await fetch(`/api/frequency/workboxes/${workboxId}/members/${userId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                await this.loadWorkboxMembers(workboxId);
                // Refresh member counts
                const wbRes = await fetch('/api/frequency/workboxes');
                const wbData = await wbRes.json();
                this.workboxes = wbData.workboxes || [];
                this.renderWorkboxes();
                this.showToast('Member removed', 'success');
            } else {
                const err = await res.json();
                this.showToast('Error: ' + (err.error || 'Remove failed'), 'error');
            }
        } catch (e) {
            this.showToast('Error: ' + e.message, 'error');
        }
    },

    closeWBMembersPanel() {
        this._currentWBId = null;
        const panel = document.getElementById('wbMembersPanel');
        if (panel) panel.style.display = 'none';
        this.renderWorkboxes(); // clear row highlight
    },
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    referenceData.init();
});
