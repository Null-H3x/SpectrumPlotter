// db_viewer_views.js — Custom view management, field selector, view CRUD

Object.assign(DatabaseViewer.prototype, {

    saveCustomViews() {
        this.updateViewDropdown();
    },

    loadCustomViews() {
        return [];
    },

    async fetchCustomViewsFromServer() {
        try {
            const res = await fetch('/api/custom-views');
            const data = await res.json();
            if (!data.success) return;

            if (data.views.length === 0) {
                const legacy = localStorage.getItem('sfaf_custom_views');
                if (legacy) {
                    try {
                        const legacyViews = JSON.parse(legacy);
                        if (legacyViews.length > 0) {
                            await this._migrateLegacyViews(legacyViews);
                            localStorage.removeItem('sfaf_custom_views');
                            return;
                        }
                    } catch (_) {}
                }
            }

            this.customViews = data.views;
            this.updateViewDropdown();
        } catch (err) {
            console.warn('Could not load custom views from server:', err);
        }
    },

    async _migrateLegacyViews(legacyViews) {
        for (const view of legacyViews) {
            try {
                const res = await fetch('/api/custom-views', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: view.name,
                        description: view.description || '',
                        fields: view.fields || []
                    })
                });
                const data = await res.json();
                if (data.success) this.customViews.push(data.view);
            } catch (_) {}
        }
        this.updateViewDropdown();
    },

    loadDefaultView() {
        return localStorage.getItem('sfaf_default_view') || 'summary';
    },

    saveDefaultView(viewName) {
        localStorage.setItem('sfaf_default_view', viewName);
    },

    openViewManagementModal() {
        const modal = document.getElementById('viewManagementModal');
        if (modal) {
            modal.style.display = 'flex';
            this.loadViewManagementUI();
        }
    },

    closeViewManagementModal() {
        const modal = document.getElementById('viewManagementModal');
        if (modal) {
            modal.style.display = 'none';
        }
        // Hide create form if open
        const createForm = document.getElementById('createCustomViewForm');
        if (createForm) {
            createForm.style.display = 'none';
        }
    },

    loadViewManagementUI() {
        // Load default view selector
        const defaultViewSelect = document.getElementById('defaultViewSelect');
        if (defaultViewSelect) {
            // Remove any previously added custom options to avoid duplicates
            const existingCustomOptions = defaultViewSelect.querySelectorAll('option[value^="custom_"]');
            existingCustomOptions.forEach(opt => opt.remove());

            // Add custom views to the dropdown
            const customOptions = this.customViews.map(view =>
                `<option value="custom_${view.id}">${view.name} (Custom)</option>`
            ).join('');

            if (customOptions) {
                // Insert custom options after the last built-in option
                const builtInOptions = defaultViewSelect.querySelectorAll('option:not([value^="custom_"])');
                const lastBuiltIn = builtInOptions[builtInOptions.length - 1];
                if (lastBuiltIn) {
                    lastBuiltIn.insertAdjacentHTML('afterend', customOptions);
                }
            }

            // Set the current default view (do this AFTER adding options)
            defaultViewSelect.value = this.defaultView;
        }

        // Render custom views list
        this.renderCustomViewsList();
    },

    renderCustomViewsList() {
        const container = document.getElementById('customViewsList');
        if (!container) return;

        if (this.customViews.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-layer-group"></i>
                    <p>No custom views yet. Create one to get started!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.customViews.map(view => `
            <div class="custom-view-item" data-view-id="${view.id}">
                <div class="view-info">
                    <strong><i class="fas fa-table"></i> ${view.name}</strong>
                    <span class="view-field-count">${view.fields.length} fields</span>
                </div>
                <div class="view-actions">
                    <button class="btn btn-sm" onclick="databaseViewer.applyCustomView('${view.id}')" title="Apply View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm" onclick="databaseViewer.editCustomView('${view.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="databaseViewer.deleteCustomView('${view.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    },

    showCreateCustomView() {
        const createForm = document.getElementById('createCustomViewForm');
        if (createForm) {
            createForm.style.display = 'block';
            this.renderFieldSelector();
        }
    },

    cancelCreateCustomView() {
        const createForm = document.getElementById('createCustomViewForm');
        if (createForm) {
            createForm.style.display = 'none';
        }
        // Clear form
        const nameInput = document.getElementById('customViewName');
        if (nameInput) nameInput.value = '';

        // Clear all field checkboxes
        const checkboxes = document.querySelectorAll('#fieldSelectorGrid input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);

        // Reset editing state
        this.editingViewId = null;

        // Reset button text back to "Save View"
        const saveBtn = document.querySelector('#createCustomViewForm button[onclick*="saveCustomView"]');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save View';
        }
    },

    renderFieldSelector() {
        const container = document.getElementById('fieldSelectorGrid');
        if (!container) return;

        // Get organized field groups
        const fieldGroups = this.getOrganizedFieldGroups();

        container.innerHTML = fieldGroups.map((group, idx) => `
            <div class="field-group">
                <div class="field-group-header">
                    <h6><i class="${group.icon}"></i> ${group.title}</h6>
                    <div class="field-group-actions">
                        <button type="button" class="btn-group-select" onclick="databaseViewer.selectAllInGroup(${idx})">Select All</button>
                        <button type="button" class="btn-group-clear" onclick="databaseViewer.clearAllInGroup(${idx})">Clear</button>
                        <span class="field-count">${group.fields.length} fields</span>
                    </div>
                </div>
                <div class="field-group-items" data-group-idx="${idx}">
                    ${group.fields.map(field => `
                        <label class="field-checkbox">
                            <input type="checkbox" value="${field.key}" data-label="${field.label}">
                            <span>${field.label}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `).join('');
    },

    selectAllInGroup(groupIdx) {
        const group = document.querySelector(`.field-group-items[data-group-idx="${groupIdx}"]`);
        if (!group) return;
        group.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    },

    clearAllInGroup(groupIdx) {
        const group = document.querySelector(`.field-group-items[data-group-idx="${groupIdx}"]`);
        if (!group) return;
        group.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    },

    getOrganizedFieldGroups() {
        return [
            {
                title: 'Administrative Data',
                icon: 'fas fa-file-alt',
                fields: [
                    { key: 'field005', label: '005 - Security Classification' },
                    { key: 'field006', label: '006 - Security Classification Modification' },
                    { key: 'field007', label: '007 - Missing Data Indicator' },
                    { key: 'field010', label: '010 - Type of Action' },
                    { key: 'field013', label: '013 - Declassification Instruction Comment' },
                    { key: 'field014', label: '014 - Derivative Classification Authority' },
                    { key: 'field015', label: '015 - Unclassified Data Fields' },
                    { key: 'field016', label: '016 - Extended Declassification Date' },
                    { key: 'field017', label: '017 - Downgrading Instructions' },
                    { key: 'field018', label: '018 - Original Classification Authority' },
                    { key: 'field019', label: '019 - Reason for Classification' },
                    { key: 'field020', label: '020 - Proposal References' },
                    { key: 'field102', label: '102 - Agency Serial Number' },
                    { key: 'field103', label: '103 - IRAC Docket Number' },
                    { key: 'field105', label: '105 - List Serial Number' },
                    { key: 'field106', label: '106 - Serial Replaced, Delete Date' },
                    { key: 'field107', label: '107 - Authorization Date' },
                    { key: 'field108', label: '108 - Docket Numbers of Older Authorizations' },
                    { key: 'field151', label: '151 - Coordination Indicator' },
                    { key: 'field152', label: '152 - Coordination Data' }
                ]
            },
            {
                title: 'Emission Characteristics',
                icon: 'fas fa-broadcast-tower',
                fields: [
                    { key: 'field110', label: '110 - Frequency(ies)' },
                    { key: 'field111', label: '111 - Excluded Frequency Band' },
                    { key: 'field112', label: '112 - Frequency Separation Criteria' },
                    { key: 'field113', label: '113 - Station Class' },
                    { key: 'field114', label: '114 - Emission Designator' },
                    { key: 'field115', label: '115 - Transmitter Power' },
                    { key: 'field116', label: '116 - Power Type' },
                    { key: 'field117', label: '117 - Effective Radiated Power' },
                    { key: 'field118', label: '118 - Power/ERP Augmentation' }
                ]
            },
            {
                title: 'Time/Date Information',
                icon: 'fas fa-calendar',
                fields: [
                    { key: 'field130', label: '130 - Time' },
                    { key: 'field131', label: '131 - Percent Time' },
                    { key: 'field140', label: '140 - Required Date' },
                    { key: 'field141', label: '141 - Expiration Date' },
                    { key: 'field142', label: '142 - Review Date' },
                    { key: 'field143', label: '143 - Revision Date' },
                    { key: 'field144', label: '144 - Approval Authority Indicator' },
                    { key: 'field145', label: '145 - ITU BR Registration' },
                    { key: 'field146', label: '146 - DCS Trunk ID' },
                    { key: 'field147', label: '147 - Joint Agencies' }
                ]
            },
            {
                title: 'Organizational Information',
                icon: 'fas fa-building',
                fields: [
                    { key: 'field200', label: '200 - Agency' },
                    { key: 'field201', label: '201 - Unified Command' },
                    { key: 'field202', label: '202 - Unified Command Service' },
                    { key: 'field203', label: '203 - Bureau' },
                    { key: 'field204', label: '204 - Command' },
                    { key: 'field205', label: '205 - Subcommand' },
                    { key: 'field206', label: '206 - Installation Frequency Manager' },
                    { key: 'field207', label: '207 - Operating Unit' },
                    { key: 'field208', label: '208 - User Net/Code' },
                    { key: 'field209', label: '209 - Area AFC/DoD AFC/Other Organizations' }
                ]
            },
            {
                title: 'Transmitter Location Data',
                icon: 'fas fa-map-marker-alt',
                fields: [
                    { key: 'field300', label: '300 - State/Country' },
                    { key: 'field301', label: '301 - Antenna Location' },
                    { key: 'field302', label: '302 - Station Control' },
                    { key: 'field303', label: '303 - Antenna Coordinates' },
                    { key: 'field304', label: '304 - Call Sign' },
                    { key: 'field306', label: '306 - Authorized Radius' }
                ]
            },
            {
                title: 'Space Stations',
                icon: 'fas fa-satellite',
                fields: [
                    { key: 'field315', label: '315 - Equatorial Inclination Angle' },
                    { key: 'field316', label: '316 - Apogee' },
                    { key: 'field317', label: '317 - Perigee' },
                    { key: 'field318', label: '318 - Period of Orbit' },
                    { key: 'field319', label: '319 - Number of Satellites' },
                    { key: 'field321', label: '321 - Power Density' }
                ]
            },
            {
                title: 'Transmitter Equipment',
                icon: 'fas fa-server',
                fields: [
                    { key: 'field340', label: '340 - Equipment Nomenclature' },
                    { key: 'field341', label: '341 - Number of Stations, System Name' },
                    { key: 'field342', label: '342 - Aircraft Nautical Mile Value' },
                    { key: 'field343', label: '343 - Equipment Certification Identification Number' },
                    { key: 'field344', label: '344 - Off-the-shelf Equipment' },
                    { key: 'field345', label: '345 - Radar Tunability' },
                    { key: 'field346', label: '346 - Pulse Duration' },
                    { key: 'field347', label: '347 - Pulse Repetition Rate' },
                    { key: 'field348', label: '348 - Intermediate Frequency' },
                    { key: 'field349', label: '349 - Sidelobe Suppression' }
                ]
            },
            {
                title: 'Transmitter Antenna Data',
                icon: 'fas fa-tower-broadcast',
                fields: [
                    { key: 'field354', label: '354 - Antenna Name' },
                    { key: 'field355', label: '355 - Antenna Nomenclature' },
                    { key: 'field356', label: '356 - Antenna Structure Height' },
                    { key: 'field357', label: '357 - Antenna Gain' },
                    { key: 'field358', label: '358 - Antenna Elevation' },
                    { key: 'field359', label: '359 - Antenna Feedpoint Height' },
                    { key: 'field360', label: '360 - Antenna Horizontal Beamwidth' },
                    { key: 'field361', label: '361 - Antenna Vertical Beamwidth' },
                    { key: 'field362', label: '362 - Antenna Orientation' },
                    { key: 'field363', label: '363 - Antenna Polarization' },
                    { key: 'field373', label: '373 - JSC Area Code' },
                    { key: 'field374', label: '374 - ITU Region' }
                ]
            },
            {
                title: 'Receiver Location Data',
                icon: 'fas fa-satellite-dish',
                fields: [
                    { key: 'field400', label: '400 - State/Country' },
                    { key: 'field401', label: '401 - Antenna Location' },
                    { key: 'field402', label: '402 - Receiver Control' },
                    { key: 'field403', label: '403 - Antenna Coordinates' },
                    { key: 'field404', label: '404 - Call Sign' },
                    { key: 'field406', label: '406 - Authorized Radius' },
                    { key: 'field407', label: '407 - Path Length' },
                    { key: 'field408', label: '408 - Repeater Indicator' }
                ]
            },
            {
                title: 'Receiver Space Stations',
                icon: 'fas fa-satellite',
                fields: [
                    { key: 'field415', label: '415 - Equatorial Inclination Angle' },
                    { key: 'field416', label: '416 - Apogee' },
                    { key: 'field417', label: '417 - Perigee' },
                    { key: 'field418', label: '418 - Period of Orbit' },
                    { key: 'field419', label: '419 - Number of Satellites' }
                ]
            },
            {
                title: 'Receiver Equipment',
                icon: 'fas fa-server',
                fields: [
                    { key: 'field440', label: '440 - Equipment Nomenclature' },
                    { key: 'field442', label: '442 - Aircraft Nautical Mile Value' },
                    { key: 'field443', label: '443 - Equipment Certification Identification Number' }
                ]
            },
            {
                title: 'Receiver Antenna Data',
                icon: 'fas fa-tower-broadcast',
                fields: [
                    { key: 'field454', label: '454 - Antenna Name' },
                    { key: 'field455', label: '455 - Antenna Nomenclature' },
                    { key: 'field456', label: '456 - Antenna Structure Height' },
                    { key: 'field457', label: '457 - Antenna Gain' },
                    { key: 'field458', label: '458 - Antenna Elevation' },
                    { key: 'field460', label: '460 - Antenna Feedpoint Height' },
                    { key: 'field461', label: '461 - Antenna Horizontal Beamwidth' },
                    { key: 'field463', label: '463 - Antenna Vertical Beamwidth' },
                    { key: 'field470', label: '470 - Antenna Orientation' },
                    { key: 'field471', label: '471 - Earth Station System Noise Temperature' },
                    { key: 'field472', label: '472 - Equivalent Satellite Link Noise Temperature' }
                ]
            },
            {
                title: 'Supplementary Details',
                icon: 'fas fa-comment',
                fields: [
                    { key: 'field500', label: '500 - IRAC Notes' },
                    { key: 'field501', label: '501 - Notes/Comments' },
                    { key: 'field502', label: '502 - Description of Requirement' },
                    { key: 'field503', label: '503 - Agency Free-text Comments' },
                    { key: 'field504', label: '504 - FAS Agenda or OUS&P Comments' },
                    { key: 'field506', label: '506 - Paired Frequency' },
                    { key: 'field511', label: '511 - Major Function Identifier' },
                    { key: 'field512', label: '512 - Intermediate Function Identifier' },
                    { key: 'field513', label: '513 - Detailed Function Identifier' },
                    { key: 'field520', label: '520 - Supplementary Details' },
                    { key: 'field521', label: '521 - Transition and Narrow Band Planning Data' },
                    { key: 'field530', label: '530 - Authorized Areas' },
                    { key: 'field531', label: '531 - Authorized States' }
                ]
            },
            {
                title: 'Other Assignment Identifiers',
                icon: 'fas fa-user-tie',
                fields: [
                    { key: 'field701', label: '701 - Frequency Action Officer' },
                    { key: 'field702', label: '702 - Control/Request Number' },
                    { key: 'field704', label: '704 - Type of Service' },
                    { key: 'field707', label: '707 - PACOM Complement/FMSC Function Number' },
                    { key: 'field710', label: '710 - Host Country Docket Number' },
                    { key: 'field711', label: '711 - Aeronautical Service Range and Height' },
                    { key: 'field716', label: '716 - Usage Code' }
                ]
            },
            {
                title: 'Additional Information',
                icon: 'fas fa-info-circle',
                fields: [
                    { key: 'field801', label: '801 - Coordination Data/Remarks' },
                    { key: 'field803', label: '803 - Requestor Data' },
                    { key: 'field804', label: '804 - Tuning Range/Tuning Increments' },
                    { key: 'field805', label: '805 - Date Response Required' },
                    { key: 'field806', label: '806 - Indication if Host Nominations are Acceptable' },
                    { key: 'field807', label: '807 - Frequencies to be Deleted' }
                ]
            },
            {
                title: 'Status and Administrative (900 Series)',
                icon: 'fas fa-th-large',
                fields: [
                    { key: 'field901', label: '901 - Record Status' },
                    { key: 'field903', label: '903 - Proposal Status' },
                    { key: 'field904', label: '904 - Status Date' },
                    { key: 'field905', label: '905 - Proposal Date Time Group' },
                    { key: 'field906', label: '906 - Originator' },
                    { key: 'field907', label: '907 - Validation Status' },
                    { key: 'field910', label: '910 - Exercise Project' },
                    { key: 'field911', label: '911 - Date of Last Transaction' },
                    { key: 'field924', label: '924 - Data Source Indicator' },
                    { key: 'field926', label: '926 - Semi-Bandwidth' },
                    { key: 'field927', label: '927 - Date of Entry' },
                    { key: 'field928', label: '928 - Date of Receipt' },
                    { key: 'field952', label: '952 - IRAC Security Classification' },
                    { key: 'field953', label: '953 - IRAC Declassification Date' },
                    { key: 'field956', label: '956 - Agency Action Number' },
                    { key: 'field957', label: '957 - Review Year' },
                    { key: 'field958', label: '958 - Routine Agenda Item' },
                    { key: 'field959', label: '959 - Circuit Remarks' },
                    { key: 'field963', label: '963 - FCC File Number' },
                    { key: 'field964', label: '964 - Tx Aircraft Altitude' },
                    { key: 'field965', label: '965 - Rx Aircraft Altitude' },
                    { key: 'field982', label: '982 - JCEOI Line Number' },
                    { key: 'field983', label: '983 - JCEOI Master Net List Name' },
                    { key: 'field984', label: '984 - Net Frequency Range' },
                    { key: 'field985', label: '985 - Joint Restricted Frequency List (JRFL) Protection Code' },
                    { key: 'field986', label: '986 - Net Tactical Call Word' },
                    { key: 'field987', label: '987 - Net Tactical Call Sign' },
                    { key: 'field988', label: '988 - Net Tactical Air Designator (TAD)' },
                    { key: 'field989', label: '989 - Net Color Word' },
                    { key: 'field990', label: '990 - Net Color Number' },
                    { key: 'field991', label: '991 - Net Restoral Priority' },
                    { key: 'field992', label: '992 - Net Push Number' },
                    { key: 'field993', label: '993 - Band Usage' },
                    { key: 'field994', label: '994 - Check Sum' },
                    { key: 'field995', label: '995 - COMSEC Keymat' },
                    { key: 'field996', label: '996 - Circuit Type, Line Item, Group Category' },
                    { key: 'field997', label: '997 - JCEOI Special Net Instructions' },
                    { key: 'field998', label: '998 - Net Notes' },
                    { key: 'field999', label: '999 - Guard Requirements' }
                ]
            },
            {
                title: 'Computed Fields',
                icon: 'fas fa-calculator',
                fields: [
                    { key: 'serial', label: 'Serial Number (Field 102)' },
                    { key: 'frequency', label: 'Frequency (Field 110)' },
                    { key: 'location', label: 'Location (Field 301)' },
                    { key: 'agency', label: 'Agency (Field 200)' },
                    { key: 'status', label: 'SFAF Completion Status' },
                    { key: 'created_at', label: 'Record Created Date' },
                    { key: 'updated_at', label: 'Record Updated Date' }
                ]
            }
        ];
    },

    getAllAvailableFields() {
        // Return all SFAF fields that can be added to a custom view
        return [
            { key: 'serial', label: 'Serial Number (102)' },
            { key: 'field005', label: '005 - Security Classification' },
            { key: 'field006', label: '006 - Security Classification Modification' },
            { key: 'field007', label: '007 - Missing Data Indicator' },
            { key: 'field010', label: '010 - Type of Action' },
            { key: 'field013', label: '013 - Declassification Instruction' },
            { key: 'field014', label: '014 - Derivative Classification Authority' },
            { key: 'field015', label: '015 - Unclassified Data Fields' },
            { key: 'field016', label: '016 - Extended Declassification Date' },
            { key: 'field017', label: '017 - Downgrading Instructions' },
            { key: 'field018', label: '018 - Original Classification Authority' },
            { key: 'field019', label: '019 - Reason for Classification' },
            { key: 'field020', label: '020 - Proposal References' },
            { key: 'field103', label: '103 - IRAC Docket Number' },
            { key: 'field105', label: '105 - List Serial Number' },
            { key: 'field106', label: '106 - Serial Replaced, Delete Date' },
            { key: 'field107', label: '107 - Authorization Date' },
            { key: 'field108', label: '108 - Docket Numbers of Older Authorizations' },
            { key: 'field110', label: '110 - Frequency(ies)' },
            { key: 'field111', label: '111 - Excluded Frequency Band' },
            { key: 'field112', label: '112 - Frequency Separation Criteria' },
            { key: 'field113', label: '113 - Station Class' },
            { key: 'field114', label: '114 - Emission Designator' },
            { key: 'field115', label: '115 - Transmitter Power' },
            { key: 'field116', label: '116 - Power Type' },
            { key: 'field117', label: '117 - Effective Radiated Power' },
            { key: 'field118', label: '118 - Power/ERP Augmentation' },
            { key: 'field130', label: '130 - Time' },
            { key: 'field131', label: '131 - Percent Time' },
            { key: 'field140', label: '140 - Required Date' },
            { key: 'field141', label: '141 - Expiration Date' },
            { key: 'field142', label: '142 - Review Date' },
            { key: 'field143', label: '143 - Revision Date' },
            { key: 'field144', label: '144 - Approval Authority Indicator' },
            { key: 'field145', label: '145 - ITU BR Registration' },
            { key: 'field146', label: '146 - DCS Trunk ID' },
            { key: 'field147', label: '147 - Joint Agencies' },
            { key: 'field151', label: '151 - Coordination Indicator' },
            { key: 'field152', label: '152 - Coordination Data' },
            { key: 'field200', label: '200 - Agency' },
            { key: 'field201', label: '201 - Unified Command' },
            { key: 'field202', label: '202 - Unified Command Service' },
            { key: 'field203', label: '203 - Bureau' },
            { key: 'field204', label: '204 - Command' },
            { key: 'field205', label: '205 - Subcommand' },
            { key: 'field206', label: '206 - Installation Frequency Manager' },
            { key: 'field207', label: '207 - Operating Unit' },
            { key: 'field208', label: '208 - User Net/Code' },
            { key: 'field209', label: '209 - Area AFC/DoD AFC/Other Organizations' },
            { key: 'field300', label: '300 - State/Country' },
            { key: 'field301', label: '301 - Antenna Location' },
            { key: 'field302', label: '302 - Station Control' },
            { key: 'field303', label: '303 - Antenna Coordinates' },
            { key: 'field304', label: '304 - Call Sign' },
            { key: 'field306', label: '306 - Authorized Radius' },
            { key: 'frequency', label: 'Frequency (computed)' },
            { key: 'location', label: 'Location (computed)' },
            { key: 'agency', label: 'Agency (computed)' },
            { key: 'status', label: 'SFAF Status' },
            { key: 'created_at', label: 'Created Date' },
            { key: 'updated_at', label: 'Updated Date' }
        ];
    },

    selectAllFields() {
        const checkboxes = document.querySelectorAll('#fieldSelectorGrid input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = true);
    },

    clearAllFields() {
        const checkboxes = document.querySelectorAll('#fieldSelectorGrid input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
    },

    async saveCustomView() {
        const nameInput = document.getElementById('customViewName');
        const name = nameInput?.value?.trim();

        if (!name) {
            alert('Please enter a view name');
            return;
        }

        const checkboxes = document.querySelectorAll('#fieldSelectorGrid input[type="checkbox"]:checked');
        const fields = Array.from(checkboxes).map(cb => ({
            key: cb.value,
            label: cb.dataset.label
        }));

        if (fields.length === 0) {
            alert('Please select at least one field');
            return;
        }

        try {
            if (this.editingViewId) {
                const res = await fetch(`/api/custom-views/${this.editingViewId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, description: '', fields })
                });
                const data = await res.json();
                if (!data.success) { alert('Failed to update view'); return; }
                const idx = this.customViews.findIndex(v => v.id === this.editingViewId);
                if (idx !== -1) this.customViews[idx] = data.view;
                alert(`Custom view "${name}" updated successfully!`);
                this.editingViewId = null;
            } else {
                const res = await fetch('/api/custom-views', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, description: '', fields })
                });
                const data = await res.json();
                if (!data.success) { alert('Failed to create view'); return; }
                this.customViews.push(data.view);
                alert(`Custom view "${name}" created successfully!`);
            }
        } catch (err) {
            alert('Error saving view: ' + err.message);
            return;
        }

        this.updateViewDropdown();
        this.cancelCreateCustomView();
        this.renderCustomViewsList();
    },

    editCustomView(viewId) {
        const view = this.customViews.find(v => v.id === viewId);
        if (!view) {
            alert('View not found');
            return;
        }

        // Show the create form in edit mode
        const createForm = document.getElementById('createCustomViewForm');
        if (createForm) {
            createForm.style.display = 'block';
        }

        // Populate the name field
        const nameInput = document.getElementById('customViewName');
        if (nameInput) {
            nameInput.value = view.name;
        }

        // Render field selector
        this.renderFieldSelector();

        // Check the fields that are in this view
        setTimeout(() => {
            const checkboxes = document.querySelectorAll('#fieldSelectorGrid input[type="checkbox"]');
            checkboxes.forEach(cb => {
                const isSelected = view.fields.some(f => f.key === cb.value);
                cb.checked = isSelected;
            });
        }, 100);

        // Store the view ID being edited
        this.editingViewId = viewId;

        // Update the save button to show "Update"
        const saveBtn = document.querySelector('#createCustomViewForm button[onclick*="saveCustomView"]');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Update View';
        }
    },

    async deleteCustomView(viewId) {
        if (!confirm('Are you sure you want to delete this custom view?')) {
            return;
        }

        try {
            const res = await fetch(`/api/custom-views/${viewId}`, { method: 'DELETE' });
            const data = await res.json();
            if (!data.success) { alert('Failed to delete view'); return; }
        } catch (err) {
            alert('Error deleting view: ' + err.message);
            return;
        }

        this.customViews = this.customViews.filter(v => v.id !== viewId);
        this.updateViewDropdown();
        this.renderCustomViewsList();
    },

    applyCustomView(viewId) {
        const view = this.customViews.find(v => v.id === viewId);
        if (!view) return;

        this.currentView = `custom_${viewId}`;
        this.currentCustomView = view;
        this.renderEnhancedSFAFTable(this.currentSFAFData);
        this.closeViewManagementModal();
    },

    setDefaultView() {
        const select = document.getElementById('defaultViewSelect');
        if (!select) {
            console.error('defaultViewSelect element not found');
            return;
        }

        const selectedView = select.value;
        console.log('Setting default view:', {
            selectedValue: selectedView,
            selectedIndex: select.selectedIndex,
            selectedText: select.options[select.selectedIndex].text,
            currentDefault: this.defaultView
        });

        this.defaultView = selectedView;
        this.saveDefaultView(selectedView);

        alert(`Default view set to: ${select.options[select.selectedIndex].text}`);
    },

    updateViewDropdown() {
        const viewModeSelect = document.getElementById('sfafViewMode');
        if (!viewModeSelect) return;

        // Remove existing custom view options
        const existingCustomOptions = viewModeSelect.querySelectorAll('option[data-custom="true"]');
        existingCustomOptions.forEach(opt => opt.remove());

        // Add custom views
        this.customViews.forEach(view => {
            const option = document.createElement('option');
            option.value = `custom_${view.id}`;
            option.textContent = `${view.name} (Custom)`;
            option.dataset.custom = 'true';
            viewModeSelect.appendChild(option);
        });
    },

    applyDefaultView() {
        // Apply the user's default view preference
        if (this.defaultView && this.defaultView !== 'summary') {
            const viewModeSelect = document.getElementById('sfafViewMode');
            if (viewModeSelect) {
                viewModeSelect.value = this.defaultView;
                this.currentView = this.defaultView;

                // If it's a custom view, load the custom view data
                if (this.defaultView.startsWith('custom_')) {
                    const viewId = this.defaultView.replace('custom_', '');
                    const view = this.customViews.find(v => v.id === viewId);
                    if (view) {
                        this.currentCustomView = view;
                    }
                }
            }
        }

        // Restore the last used field view
        const preferences = this.sessionManager.getSessionPreferences();
        if (preferences.lastFieldView) {
            const views = this.getCustomViews();
            const savedView = views.find(v => v.id === preferences.lastFieldView);
            if (savedView) {
                this.currentFieldView = savedView;
                console.log(`✅ Restored field view: ${preferences.lastFieldView}`);
            } else if (preferences.lastFieldView === 'all') {
                this.currentFieldView = {
                    id: 'all',
                    name: 'All Fields',
                    fields: null,
                    fieldOrder: null
                };
                console.log(`✅ Restored field view: all`);
            }
        }
    }

});
