// db_viewer_table.js — Table rendering, row selection, pagination, statistics

Object.assign(DatabaseViewer.prototype, {

    renderMarkersTable(markers) {
        const tbody = document.getElementById('markersTableBody');
        if (!tbody) return;

        // Apply filters
        let filteredMarkers = markers;
        if (this.currentFilter) {
            filteredMarkers = markers.filter(marker =>
                marker.serial.toLowerCase().includes(this.currentFilter.toLowerCase()) ||
                marker.frequency.toLowerCase().includes(this.currentFilter.toLowerCase()) ||
                marker.notes.toLowerCase().includes(this.currentFilter.toLowerCase())
            );
        }

        const typeFilter = document.getElementById('markerTypeFilter')?.value;
        if (typeFilter) {
            filteredMarkers = filteredMarkers.filter(marker => marker.type === typeFilter);
        }

        // Apply pagination
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageMarkers = filteredMarkers.slice(startIndex, endIndex);

        // Render table rows using comprehensive backend data (Source: handlers.txt, models.txt)
        tbody.innerHTML = pageMarkers.map(marker => `
            <tr data-marker-id="${marker.id}" class="table-row">
                <td>
                    <input type="checkbox" class="row-checkbox" value="${marker.id}" 
                           onchange="databaseViewer.toggleRowSelection('${marker.id}', this.checked)">
                </td>
                <td>
                    <span class="serial-number">${marker.serial}</span>
                </td>
                <td>
                    <div class="coordinates-cell">
                        <div class="coord-decimal">${marker.lat}, ${marker.lng}</div>
                        <div class="coord-dms" id="dms-${marker.id}">Loading DMS...</div>
                    </div>
                </td>
                <td>
                    <span class="frequency">${marker.frequency || 'N/A'}</span>
                </td>
                <td>
                    <span class="status-indicator status-${marker.type}">${marker.type}</span>
                </td>
                <td>
                    <span class="date-created">${new Date(marker.created_at).toLocaleDateString()}</span>
                </td>
                <td>
                    <span class="field-count" id="sfaf-count-${marker.id}">Loading...</span>
                </td>
                <td>
                    <span class="notes-count" id="irac-count-${marker.id}">Loading...</span>
                </td>
                <td class="actions-cell">
                    <button onclick="databaseViewer.editMarker('${marker.id}')" 
                            class="table-action-btn btn-edit" title="Edit Marker">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="databaseViewer.viewMarker('${marker.id}')" 
                            class="table-action-btn btn-view" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="databaseViewer.deleteMarker('${marker.id}')" 
                            class="table-action-btn btn-delete" title="Delete Marker">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        // Load additional data for each marker using existing backend APIs (Source: handlers.txt, main.txt)
        pageMarkers.forEach(marker => {
            this.loadMarkerDMSCoordinates(marker.id, marker.lat, marker.lng);
            this.loadMarkerSFAFCount(marker.id);
            this.loadMarkerIRACCount(marker.id);
        });

        this.updatePagination(filteredMarkers.length);
    },

    toggleRowSelection(recordId, isSelected) {
        if (isSelected) {
            // Enforce 10 record limit for map visualization
            if (this.selectedItems.size >= 10) {
                alert('Maximum 10 records can be selected for map visualization.');
                // Uncheck the checkbox
                const checkbox = document.querySelector(`.row-checkbox[value="${recordId}"]`);
                if (checkbox) checkbox.checked = false;
                return;
            }
            this.selectedItems.add(recordId);
        } else {
            this.selectedItems.delete(recordId);
        }

        // Update row visual state
        const row = document.querySelector(`tr[data-record-id="${recordId}"]`);
        if (row) {
            row.classList.toggle('row-selected', isSelected);
        }

        // Update select-all checkbox
        this.updateSelectAllCheckbox();

        // Update selection UI
        this.updateSelectionUI();

        // Persist to localStorage
        this.sessionManager.saveSelectedItems(this.currentTab, this.selectedItems);
    },

    toggleSelectAll(selectAll) {
        const checkboxes = document.querySelectorAll('.row-checkbox');

        checkboxes.forEach(checkbox => {
            if (selectAll) {
                this.selectedItems.add(checkbox.value);
                checkbox.checked = true;
                const row = checkbox.closest('tr');
                if (row) row.classList.add('row-selected');
            } else {
                this.selectedItems.delete(checkbox.value);
                checkbox.checked = false;
                const row = checkbox.closest('tr');
                if (row) row.classList.remove('row-selected');
            }
        });

        this.updateSelectionUI();
        this.sessionManager.saveSelectedItems(this.currentTab, this.selectedItems);
    },

    updateSelectionUI() {
        const selectionCount = this.selectedItems.size;

        // Update selection counter
        const counterElement = document.getElementById('selectionCounter');
        if (counterElement) {
            if (selectionCount > 0) {
                counterElement.textContent = `${selectionCount} item${selectionCount !== 1 ? 's' : ''} selected`;
                counterElement.style.display = 'inline-block';
            } else {
                counterElement.style.display = 'none';
            }
        }

        // Update bulk action buttons
        this.updateBulkActionButtons();
    },

    updateBulkActionButtons() {
        const bulkEditBtn = document.getElementById('bulkEditBtn');
        const exportSelectedBtn = document.getElementById('exportSelectedBtn');
        const exportSelectedToCSVBtn = document.getElementById('exportSelectedToCSVBtn');
        const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
        const viewOnMapBtn = document.getElementById('viewOnMapBtn');
        const hasSelection = this.selectedItems.size > 0;

        if (bulkEditBtn) {
            bulkEditBtn.disabled = !hasSelection;
            bulkEditBtn.textContent = hasSelection ?
                `Bulk Edit (${this.selectedItems.size})` : 'Bulk Edit';
        }

        if (exportSelectedBtn) {
            exportSelectedBtn.disabled = !hasSelection;
            exportSelectedBtn.textContent = hasSelection ?
                `Export (${this.selectedItems.size})` : 'Export';
        }

        // Enable/disable Export Selected to CSV button in dropdown
        if (exportSelectedToCSVBtn) {
            exportSelectedToCSVBtn.disabled = !hasSelection;
            if (hasSelection) {
                exportSelectedToCSVBtn.style.opacity = '1';
                exportSelectedToCSVBtn.style.cursor = 'pointer';
            } else {
                exportSelectedToCSVBtn.style.opacity = '0.5';
                exportSelectedToCSVBtn.style.cursor = 'not-allowed';
            }
        }

        if (deleteSelectedBtn) {
            deleteSelectedBtn.disabled = !hasSelection;
            deleteSelectedBtn.textContent = hasSelection ?
                `Delete (${this.selectedItems.size})` : 'Delete Selected';
        }

        // Show/hide "View on Map" button based on selection
        if (viewOnMapBtn) {
            if (hasSelection) {
                viewOnMapBtn.style.display = 'inline-flex';
                viewOnMapBtn.textContent = `View on Map (${this.selectedItems.size})`;
            } else {
                viewOnMapBtn.style.display = 'none';
            }
        }
    },

    renderEnhancedSFAFTable(enhancedRecords) {
        // ✅ Use the existing function to ensure table elements exist
        const { table, header, body } = this.ensureSFAFTableElements();

        // ✅ Use the returned elements instead of getElementById
        const tableHeader = header;
        const tableBody = body;

        if (!tableHeader || !tableBody) {
            console.error('❌ Could not create SFAF table elements');
            return;
        }

        // ✅ Show the table if it was hidden
        if (table) {
            table.style.display = 'table';
        }

        // Filter out undefined/null records
        let validRecords = (enhancedRecords || []).filter(record =>
            record && typeof record === 'object' && record.id
        );

        if (validRecords.length === 0) {
            // Show empty state, hide data grid
            const emptyState = document.getElementById('sfafEmptyState');
            const dataGrid = document.getElementById('sfafDataGrid');

            if (emptyState) emptyState.style.display = 'block';
            if (dataGrid) dataGrid.style.display = 'none';
            if (table) table.style.display = 'none';

            console.log('No records to display - showing empty state');
            return;
        }

        // ✅ Server-side pagination: Data is already paginated from API, no need to slice again
        // The records passed in are already the correct page from the server
        const totalRecords = validRecords.length;
        const paginatedRecords = validRecords; // Don't slice - already paginated by server

        console.log(`📊 Rendering ${paginatedRecords.length} records for page ${this.currentPage}`);

        // Hide empty state, show data grid
        const emptyState = document.getElementById('sfafEmptyState');
        const dataGrid = document.getElementById('sfafDataGrid');

        if (emptyState) emptyState.style.display = 'none';
        if (dataGrid) dataGrid.style.display = 'block';
        if (table) table.style.display = 'table';

        // Generate dynamic headers based on view mode
        const headers = this.getHeadersForView(this.currentView || 'summary');
        tableHeader.innerHTML = `
        <tr class="header-row">
            ${headers.map(header => {
                const isSortable = header.field !== 'select' && header.field !== 'actions';
                const sortableClass = isSortable ? 'sortable' : '';
                const sortableClick = isSortable ? `onclick="databaseViewer.sortByColumn('${header.field}')"` : '';
                return `<th data-field="${header.field}" class="${sortableClass} ${header.class || ''}" ${sortableClick}>
                    <div class="header-content">
                        <span class="header-label">${header.label}</span>
                        ${isSortable ? `<span class="sort-indicator ${this.currentSort.field === header.field ? (this.currentSort.order === 'asc' ? 'sort-asc' : 'sort-desc') : ''}">
                            ${this.currentSort.field === header.field ? (this.currentSort.order === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>` : ''}
                    </div>
                </th>`;
            }).join('')}
        </tr>
        <tr class="filter-row">
            ${headers.map(header =>
            `<th data-field="${header.field}" class="${header.class || ''}">
                    ${header.filterable !== false ?
                        `<input type="text"
                                class="column-filter"
                                data-field="${header.field}"
                                placeholder="Filter (press Enter)..."
                                value="${this.columnFilters[header.field] || ''}"
                                onkeydown="if(event.key === 'Enter') databaseViewer.filterColumn('${header.field}', this.value)"
                                onclick="event.stopPropagation()">`
                        : ''}
                </th>`
        ).join('')}
        </tr>
    `;

        // Generate table rows with enhanced SFAF data (only current page)
        tableBody.innerHTML = paginatedRecords.map(record => {
            const isChecked = this.selectedItems.has(record.id) ? 'checked' : '';

            // Use spreadsheet rendering if in spreadsheet view
            if (this.currentView === 'spreadsheet') {
                return this.renderSpreadsheetRow(record, headers, isChecked);
            }

            // Use generic row renderer for custom views and other views
            return this.renderGenericRow(record, headers, isChecked);
        }).join('');

        // After rendering, attach select-all handler
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => this.toggleSelectAll(e.target.checked));
            this.updateSelectAllCheckbox();
        }

        // Update selection UI
        this.updateSelectionUI();

        // Update summary statistics with total record count
        this.updateTableStatistics(totalRecords);

        // Update pagination controls
        this.updatePaginationControls(totalRecords);
    },

    renderIRACTable(notes) {
        const tbody = document.getElementById('iracTableBody');
        if (!tbody) return;

        tbody.innerHTML = notes.map(note => `
            <tr>
                <td>
                    <code class="irac-code">${note.code}</code>
                </td>
                <td>
                    <div class="irac-title">${note.title}</div>
                    <div class="irac-description">${note.description.substring(0, 100)}${note.description.length > 100 ? '...' : ''}</div>
                </td>
                <td>
                    <span class="category-badge category-${note.category}">${note.category}</span>
                </td>
                <td>
                    <span class="field-placement">Field ${note.field_placement}</span>
                </td>
                <td>
                    <div class="agency-list">
                        ${note.agency && note.agency.length > 0 ?
                note.agency.slice(0, 3).map(agency => `<span class="agency-tag">${agency}</span>`).join('') +
                (note.agency.length > 3 ? `<span class="agency-more">+${note.agency.length - 3} more</span>` : '')
                : 'N/A'
            }
                    </div>
                </td>
                <td>
                    <button onclick="databaseViewer.viewIRACNote('${note.code}')" 
                            class="table-action-btn btn-view" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    updatePagination(totalItems) {
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');

        if (pageInfo) {
            pageInfo.textContent = `Page ${this.currentPage} of ${totalPages} (${totalItems} items)`;
        }

        if (prevBtn) {
            prevBtn.disabled = this.currentPage <= 1;
        }

        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= totalPages;
        }
    },

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            // Load previous page from API
            this.loadSFAFRecords();
            // Scroll to top of table
            this.scrollToTopOfTable();
        }
    },

    nextPage() {
        const totalPages = Math.ceil(this.totalDatabaseRecords / this.itemsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            // Load next page from API
            this.loadSFAFRecords();
            // Scroll to top of table
            this.scrollToTopOfTable();
        }
    },

    getTotalItemsForCurrentTab() {
        // Return SFAF data length if available, otherwise fall back to currentData
        if (this.currentSFAFData && this.currentSFAFData.length > 0) {
            return this.currentSFAFData.length;
        }
        return this.currentData ? this.currentData.length : 0;
    },

    getHeadersForView(viewMode) {
        const headerConfigs = {
            summary: [
                { field: 'select', label: '<input type="checkbox" id="selectAllCheckbox" title="Select All">', class: 'checkbox-col sticky-col', filterable: false },
                { field: 'field102', label: '102 - Agency Serial', class: 'serial-col' },
                { field: 'record_type', label: 'Type', class: 'record-type-col' },
                { field: 'field110', label: '110 - Frequency', class: 'frequency-col' },
                { field: 'field301', label: '301 - Antenna Location', class: 'location-col' },
                { field: 'field200', label: '200 - Agency', class: 'agency-col' },
                { field: 'status', label: 'SFAF Status', class: 'status-col' },
                { field: 'actions', label: 'Actions', class: 'actions-col sticky-col', filterable: false }
            ],
            spreadsheet: this.getAllFieldsHeaders(),
            technical: [
                { field: 'select', label: '<input type="checkbox" id="selectAllCheckbox" title="Select All">', class: 'checkbox-col sticky-col', filterable: false },
                { field: 'field102', label: '102 - Agency Serial' },
                { field: 'field110', label: '110 - Frequency' },
                { field: 'field114', label: '114 - Emission Designator' },
                { field: 'field115', label: '115 - Transmitter Power' },
                { field: 'field300', label: '300 - State/Country' },
                { field: 'field301', label: '301 - Antenna Location' },
                { field: 'actions', label: 'Actions', class: 'actions-col sticky-col', filterable: false }
            ],
            administrative: [
                { field: 'select', label: '<input type="checkbox" id="selectAllCheckbox" title="Select All">', class: 'checkbox-col sticky-col', filterable: false },
                { field: 'field102', label: '102 - Agency Serial' },
                { field: 'field200', label: '200 - Agency' },
                { field: 'field140', label: '140 - Required Date' },
                { field: 'field141', label: '141 - Expiration Date' },
                { field: 'compliance', label: 'MC4EB Compliance' },
                { field: 'actions', label: 'Actions', class: 'actions-col sticky-col', filterable: false }
            ],
            compliance: [
                { field: 'select', label: '<input type="checkbox" id="selectAllCheckbox" title="Select All">', class: 'checkbox-col sticky-col', filterable: false },
                { field: 'field102', label: '102 - Agency Serial' },
                { field: 'field200', label: '200 - Agency' },
                { field: 'field005', label: '005 - Security Classification' },
                { field: 'field100', label: '100 - File Number' },
                { field: 'field110', label: '110 - Frequency(ies)' },
                { field: 'field114', label: '114 - Emission Designator' },
                { field: 'field303', label: '303 - Antenna Coordinates' },
                { field: 'field306', label: '306 - Authorized Radius' },
                { field: 'field500', label: '500 - IRAC Notes' },
                { field: 'field501', label: '501 - Notes/Comments' },
                { field: 'compliance', label: 'MC4EB Compliance Status' },
                { field: 'completionRate', label: 'Completion %' },
                { field: 'actions', label: 'Actions', class: 'actions-col sticky-col', filterable: false }
            ]
        };

        // Check if it's a custom view
        if (viewMode && viewMode.startsWith('custom_')) {
            const viewId = viewMode.replace('custom_', '');
            const customView = this.customViews.find(v => v.id === viewId);
            if (customView && customView.fields) {
                // Build headers from custom view fields
                const customHeaders = [
                    { field: 'select', label: '<input type="checkbox" id="selectAllCheckbox" title="Select All">', class: 'checkbox-col', filterable: false }
                ];

                customView.fields.forEach(fieldDef => {
                    customHeaders.push({
                        field: fieldDef.key,
                        label: fieldDef.label,
                        class: 'field-col'
                    });
                });

                customHeaders.push({ field: 'actions', label: 'Actions', class: 'actions-col', filterable: false });
                return customHeaders;
            }
        }

        return headerConfigs[viewMode] || headerConfigs.summary;
    },

    getAllFieldsHeaders() {
        // Create headers for all SFAF fields (005-999)
        const headers = [
            { field: 'select', label: '<input type="checkbox" id="selectAllCheckbox" title="Select All">', class: 'checkbox-col sticky-col', filterable: false },
            { field: 'serial', label: 'Serial (102)', class: 'serial-col sticky-col frozen-col' },
            { field: 'record_type', label: 'Type', class: 'record-type-col' }
        ];

        // MC4EB Pub 7 CHG 1 field labels - authoritative names from publication
        // Merge with user-editable field_labels.json (loaded values take precedence)
        const fieldLabels = Object.assign({
            // Administrative Data
            field005: '005 - Security Classification',
            field006: '006 - Security Classification Modification',
            field007: '007 - Missing Data Indicator',
            field010: '010 - Type of Action',
            field013: '013 - Declassification Instruction',
            field014: '014 - Derivative Classification Authority',
            field015: '015 - Unclassified Data Fields',
            field016: '016 - Extended Declassification Date',
            field017: '017 - Downgrading Instructions',
            field018: '018 - Original Classification Authority',
            field019: '019 - Reason for Classification',
            field020: '020 - Proposal References',

            // File Identification
            field102: '102 - Agency Serial Number',
            field103: '103 - IRAC Docket Number',
            field105: '105 - List Serial Number',
            field106: '106 - Serial Replaced, Delete Date',
            field107: '107 - Authorization Date',
            field108: '108 - Docket Numbers of Older Authorizations',

            // Emission Characteristics
            field110: '110 - Frequency(ies)',
            field111: '111 - Excluded Frequency Band',
            field112: '112 - Frequency Separation Criteria',
            field113: '113 - Station Class',
            field114: '114 - Emission Designator',
            field115: '115 - Transmitter Power',
            field116: '116 - Power Type',
            field117: '117 - Effective Radiated Power',
            field118: '118 - Power/ERP Augmentation',

            // Time/Date Information
            field130: '130 - Time',
            field131: '131 - Percent Time',
            field140: '140 - Required Date',
            field141: '141 - Expiration Date',
            field142: '142 - Review Date',
            field143: '143 - Revision Date',
            field144: '144 - Approval Authority Indicator',
            field145: '145 - ITU BR Registration',
            field146: '146 - DCS Trunk ID',
            field147: '147 - Joint Agencies',
            field151: '151 - Coordination Indicator',
            field152: '152 - Coordination Data',

            // Organizational Information
            field200: '200 - Agency',
            field201: '201 - Unified Command',
            field202: '202 - Unified Command Service',
            field203: '203 - Bureau',
            field204: '204 - Command',
            field205: '205 - Subcommand',
            field206: '206 - Installation Frequency Manager',
            field207: '207 - Operating Unit',
            field208: '208 - User Net/Code',
            field209: '209 - Area AFC/DoD AFC/Other Organizations',

            // Transmitter Location Data
            field300: '300 - State/Country',
            field301: '301 - Antenna Location',
            field302: '302 - Station Control',
            field303: '303 - Antenna Coordinates',
            field304: '304 - Call Sign',
            field306: '306 - Authorized Radius',

            // Space Stations (Transmitter)
            field315: '315 - Equatorial Inclination Angle',
            field316: '316 - Apogee',
            field317: '317 - Perigee',
            field318: '318 - Period of Orbit',
            field319: '319 - Number of Satellites',
            field321: '321 - Power Density',

            // Transmitter Equipment
            field340: '340 - Equipment Nomenclature',
            field341: '341 - Number of Stations, System Name',
            field342: '342 - Aircraft Nautical Mile Value',
            field343: '343 - Equipment Certification Identification Number',
            field344: '344 - Off-the-shelf Equipment',
            field345: '345 - Radar Tunability',
            field346: '346 - Pulse Duration',
            field347: '347 - Pulse Repetition Rate',
            field348: '348 - Intermediate Frequency',
            field349: '349 - Sidelobe Suppression',

            // Transmitter Antenna Data
            field354: '354 - Antenna Name',
            field355: '355 - Antenna Nomenclature',
            field356: '356 - Antenna Structure Height',
            field357: '357 - Antenna Gain',
            field358: '358 - Antenna Elevation',
            field359: '359 - Antenna Feedpoint Height',
            field360: '360 - Antenna Horizontal Beamwidth',
            field361: '361 - Antenna Vertical Beamwidth',
            field362: '362 - Antenna Orientation',
            field363: '363 - Antenna Polarization',
            field373: '373 - JSC Area Code',
            field374: '374 - ITU Region',

            // Receiver Location Data
            field400: '400 - State/Country',
            field401: '401 - Antenna Location',
            field402: '402 - Receiver Control',
            field403: '403 - Antenna Coordinates',
            field404: '404 - Call Sign',
            field406: '406 - Authorized Radius',
            field407: '407 - Path Length',
            field408: '408 - Repeater Indicator',

            // Space Stations (Receiver)
            field415: '415 - Equatorial Inclination Angle',
            field416: '416 - Apogee',
            field417: '417 - Perigee',
            field418: '418 - Period of Orbit',
            field419: '419 - Number of Satellites',

            // Receiver Equipment
            field440: '440 - Equipment Nomenclature',
            field442: '442 - Aircraft Nautical Mile Value',
            field443: '443 - Equipment Certification Identification Number',

            // Receiver Antenna Data
            field454: '454 - Antenna Name',
            field455: '455 - Antenna Nomenclature',
            field456: '456 - Antenna Structure Height',
            field457: '457 - Antenna Gain',
            field458: '458 - Antenna Elevation',
            field460: '460 - Antenna Feedpoint Height',
            field461: '461 - Antenna Horizontal Beamwidth',
            field463: '463 - Antenna Vertical Beamwidth',
            field470: '470 - Antenna Orientation',
            field471: '471 - Earth Station System Noise Temperature',
            field472: '472 - Equivalent Satellite Link Noise Temperature',

            // Supplementary Details
            field500: '500 - IRAC Notes',
            field501: '501 - Notes/Comments',
            field502: '502 - Description of Requirement',
            field503: '503 - Agency Free-text Comments',
            field504: '504 - FAS Agenda or OUS&P Comments',
            field506: '506 - Paired Frequency',
            field511: '511 - Major Function Identifier',
            field512: '512 - Intermediate Function Identifier',
            field513: '513 - Detailed Function Identifier',
            field520: '520 - Supplementary Details',
            field521: '521 - Transition and Narrow Band Planning Data',
            field530: '530 - Authorized Areas',
            field531: '531 - Authorized States',

            // Other Assignment Identifiers
            field701: '701 - Frequency Action Officer',
            field702: '702 - Control/Request Number',
            field704: '704 - Type of Service',
            field707: '707 - PACOM Complement/FMSC Function Number',
            field710: '710 - Host Country Docket Number',
            field711: '711 - Aeronautical Service Range and Height',
            field716: '716 - Usage Code',

            // Additional Information
            field801: '801 - Coordination Data/Remarks',
            field803: '803 - Requestor Data',
            field804: '804 - Tuning Range/Tuning Increments',
            field805: '805 - Date Response Required',
            field806: '806 - Indication if Host Nominations are Acceptable',
            field807: '807 - Frequencies to be Deleted',

            // Status and Administrative
            field901: '901 - Record Status',
            field903: '903 - Proposal Status',
            field904: '904 - Status Date',
            field911: '911 - Originator',
            field926: '926 - Validation Status',
            field952: '952 - Exercise Project Indicator',
            field956: '956 - Date of Last Transaction',

            // JCEOI / Net Data
            field982: '982 - JCEOI Line Number',
            field983: '983 - JCEOI Master Net List Name',
            field984: '984 - Net Frequency Range',
            field985: '985 - JRFL Protection Code',
            field986: '986 - Net Tactical Call Word',
            field987: '987 - Net Tactical Call Sign',
            field988: '988 - Net Tactical Air Designator (TAD)',
            field989: '989 - Net Color Word',
            field990: '990 - Net Color Number',
            field991: '991 - Net Restoral Priority',
            field992: '992 - Net Push Number',
            field993: '993 - Band Usage',
            field994: '994 - Check Sum',
            field995: '995 - COMSEC Keymat',
            field996: '996 - Circuit Type, Line Item, Group Category',
            field997: '997 - JCEOI Special Net Instructions',
            field998: '998 - Net Notes',
            field999: '999 - Guard Requirements'
        }, this.fieldLabels || {});

        // Add all field headers
        for (const [fieldKey, label] of Object.entries(fieldLabels)) {
            headers.push({
                field: fieldKey,
                label: label,
                class: 'field-col'
            });
        }

        headers.push({ field: 'actions', label: 'Actions', class: 'actions-col sticky-col', filterable: false });

        return headers;
    },

    renderSpreadsheetRow(record, headers, isChecked) {
        // Generate cells for each header
        const cells = headers.map(header => {
            const field = header.field;

            // Special handling for select checkbox
            if (field === 'select') {
                const escapedId = record.id.replace(/'/g, "\\'");
                return `<td class="checkbox-col sticky-col">
                    <input type="checkbox" class="row-checkbox" value="${record.id}" ${isChecked}
                           data-record-id="${record.id}"
                           onchange="databaseViewer.toggleRowSelection('${escapedId}', this.checked)">
                </td>`;
            }

            // Special handling for serial number (frozen column)
            if (field === 'serial') {
                return `<td class="serial-col sticky-col frozen-col">
                    <span class="serial-number">${record.serial || 'Unknown'}</span>
                </td>`;
            }

            // Static record type badge
            if (field === 'record_type') {
                const rt = record.sfaf_record_type || record.sfafFields?.sfaf_record_type || '';
                const labels = { A: 'Permanent Assignment', P: 'Permanent Proposal', S: 'Special Temporary', T: 'Temporary' };
                const classes = { A: 'rt-permanent', P: 'rt-proposal', S: 'rt-sta', T: 'rt-temporary' };
                return `<td class="record-type-col">
                    <span class="record-type-badge ${classes[rt] || ''}" title="${labels[rt] || 'Unknown'}">${rt || '–'}</span>
                </td>`;
            }

            // Special handling for actions
            if (field === 'actions') {
                return `<td class="actions-col sticky-col">
                    ${this.generateActionButtons(record)}
                </td>`;
            }

            // Render SFAF field value
            const fieldValue = record.sfafFields?.[field] || '';
            const displayValue = fieldValue || '-';

            return `<td class="field-col" title="${field}: ${displayValue}">
                <span class="field-value">${displayValue}</span>
            </td>`;
        }).join('');

        return `<tr data-record-id="${record.id}" class="table-row ${isChecked ? 'row-selected' : ''}">${cells}</tr>`;
    },

    renderGenericRow(record, headers, isChecked) {
        // Generic row renderer that works with any header configuration
        const cells = headers.map(header => {
            const field = header.field;

            // Special handling for select checkbox
            if (field === 'select') {
                const escapedId = record.id.replace(/'/g, "\\'");
                return `<td class="checkbox-col ${header.class || ''}">
                    <input type="checkbox" class="row-checkbox" value="${record.id}" ${isChecked}
                           data-record-id="${record.id}"
                           onchange="databaseViewer.toggleRowSelection('${escapedId}', this.checked)">
                </td>`;
            }

            // Special handling for actions
            if (field === 'actions') {
                return `<td class="actions-col ${header.class || ''}">
                    ${this.generateActionButtons(record)}
                </td>`;
            }

            // Static record type badge
            if (field === 'record_type') {
                const rt = record.sfaf_record_type || record.sfafFields?.sfaf_record_type || '';
                const labels = { A: 'Permanent Assignment', P: 'Permanent Proposal', S: 'Special Temporary', T: 'Temporary' };
                const classes = { A: 'rt-permanent', P: 'rt-proposal', S: 'rt-sta', T: 'rt-temporary' };
                return `<td class="${header.class || ''}">
                    <span class="record-type-badge ${classes[rt] || ''}" title="${labels[rt] || 'Unknown'}">${rt || '–'}</span>
                </td>`;
            }

            // Special handling for status badge
            if (field === 'status') {
                return `<td class="status-col ${header.class || ''}">
                    ${this.generateStatusBadge(record)}
                </td>`;
            }

            // Special handling for compliance badge
            if (field === 'compliance') {
                return `<td class="compliance-col ${header.class || ''}">
                    ${this.generateComplianceBadge(record.mcebCompliant)}
                </td>`;
            }

            // Special handling for completion rate
            if (field === 'completionRate') {
                const completionRate = record.completionPercentage || 0;
                const barColor = completionRate >= 80 ? '#28a745' : completionRate >= 50 ? '#ffc107' : '#dc3545';
                return `<td class="completion-col ${header.class || ''}" title="${completionRate.toFixed(0)}% Complete">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="flex: 1; background: #e9ecef; border-radius: 4px; height: 20px; overflow: hidden;">
                            <div style="width: ${completionRate}%; height: 100%; background: ${barColor}; transition: width 0.3s;"></div>
                        </div>
                        <span style="font-size: 12px; font-weight: 600; min-width: 40px;">${completionRate.toFixed(0)}%</span>
                    </div>
                </td>`;
            }

            // Handle SFAF fields (field100, field110, etc.) from sfafFields object
            let fieldValue = '';
            let displayValue = '-';

            if (field.startsWith('field')) {
                // This is an SFAF field - get from sfafFields object
                fieldValue = record.sfafFields?.[field] || record.rawSFAFFields?.[field] || '';
                displayValue = fieldValue || '-';
            } else {
                // Legacy/computed fields for backward compatibility
                displayValue = record[field] || '-';

                // Format dates if needed
                if ((field === 'created_at' || field === 'updated_at') && record[field]) {
                    const date = new Date(record[field]);
                    displayValue = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                }
            }

            return `<td class="field-col ${header.class || ''}" title="${header.label}: ${displayValue}">
                <span class="field-value">${displayValue}</span>
            </td>`;
        }).join('');

        return `<tr data-record-id="${record.id}" class="table-row ${isChecked ? 'row-selected' : ''}">${cells}</tr>`;
    },

    generateStatusBadge(record) {
        const statusConfig = {
            complete: { class: 'status-complete', icon: '✅', text: 'Complete' },
            partial: { class: 'status-partial', icon: '⚠️', text: 'Partial' },
            empty: { class: 'status-empty', icon: '📝', text: 'New Record' }
        };

        const status = record.sfafComplete ? 'complete' : 'partial';
        const config = statusConfig[status];

        const poolBadge = record.isPool
            ? `<span class="sfaf-status-badge status-pool" title="Pool Assignment — no geographic constraints (306/406/530/531 absent)">🏊 Pool</span>`
            : '';

        return `
        ${poolBadge}
        <span class="sfaf-status-badge ${config.class}" title="${config.text}">
            ${config.icon} ${config.text}
        </span>
    `;
    },

    generateComplianceBadge(mcebCompliant) {
        const isCompliant = mcebCompliant && mcebCompliant.isCompliant;

        return `
        <span class="compliance-badge ${isCompliant ? 'compliant' : 'non-compliant'}">
            ${isCompliant ? '✅ Compliant' : '⚠️ Issues'}
        </span>
    `;
    },

    detectPoolAssignment(sfafFields) {
        const f306 = (sfafFields.field306 || '').trim();
        const f406 = (sfafFields.field406 || '').trim();
        const f530 = (sfafFields.field530 || '').trim();
        const f531 = (sfafFields.field531 || '').trim();
        return !f306 && !f406 && !f530 && !f531;
    },

    generateActionButtons(record) {
        return `
        <div class="table-actions-group">
            <button class="table-action-btn btn-edit-sfaf"
                    onclick="databaseViewer.editSFAFRecord('${record.id}')"
                    title="Edit SFAF Fields">
                <i class="fas fa-edit"></i>
            </button>
            <button class="table-action-btn btn-view-on-map"
                    onclick="databaseViewer.viewRecordOnMap('${record.id}')"
                    title="View on Map">
                <i class="fas fa-map-marked-alt"></i>
            </button>
            <button class="table-action-btn btn-view-details"
                    onclick="databaseViewer.viewSFAFRecord('${record.id}')"
                    title="View Details">
                <i class="fas fa-eye"></i>
            </button>
            <button class="table-action-btn btn-export-record"
                    onclick="databaseViewer.exportSFAFRecord('${record.id}')"
                    title="Export SFAF">
                <i class="fas fa-download"></i>
            </button>
            <button class="table-action-btn btn-delete-record"
                    onclick="databaseViewer.deleteSingleRecord('${record.id}')"
                    title="Delete Record">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `;
    },

    updateSFAFSummaryStats(records) {
        console.log('📊 Updating SFAF summary stats for', records.length, 'records');

        const stats = {
            total: records.length,
            complete: 0,
            incomplete: 0,
            empty: 0,
            compliant: 0,
            pool: 0
        };

        records.forEach(record => {
            if (record.completionPercentage >= 80) {
                stats.complete++;
            } else if (record.completionPercentage > 0) {
                stats.incomplete++;
            } else {
                stats.empty++;
            }

            if (record.completionPercentage >= 90) {
                stats.compliant++;
            }

            if (record.isPool) {
                stats.pool++;
            }
        });

        // Update DOM elements safely
        this.safeUpdateElement('totalSFAFRecords', stats.total);
        this.safeUpdateElement('completeSFAFRecords', stats.complete);
        this.safeUpdateElement('incompleteSFAFRecords', stats.incomplete);
        this.safeUpdateElement('compliantRecords', stats.compliant);
        this.safeUpdateElement('poolAssignmentRecords', stats.pool);

        // Update database total count
        const dbTotal = this.totalDatabaseRecords || stats.total;
        this.safeUpdateElement('databaseTotalRecords', `of ${dbTotal} in DB`);

        console.log('📊 SFAF Summary Statistics Updated:', stats, '| DB Total:', dbTotal);
    },

    calculateSFAFStatistics(records) {
        // ✅ CRITICAL FIX: Filter out undefined/null records and add validation
        const validRecords = (records || []).filter(record =>
            record &&
            typeof record === 'object' &&
            record.id
        );

        const stats = {
            total: validRecords.length,
            complete: 0,
            incomplete: 0,
            empty: 0,
            compliant: 0,
            nonCompliant: 0,
            validationErrors: 0
        };

        // ✅ SAFE: Process only valid records
        validRecords.forEach(record => {
            try {
                // Completion status analysis with safe property access
                const sfafComplete = record.sfafComplete || false;
                const sfafFieldCount = record.sfafFieldCount || 0;

                if (sfafComplete === true) {
                    stats.complete++;
                } else if (sfafFieldCount > 0) {
                    stats.incomplete++;
                } else {
                    stats.empty++;
                }

                // MC4EB Publication 7, Change 1 compliance analysis with safe access
                const mcebCompliant = record.mcebCompliant || { isCompliant: false };
                if (mcebCompliant.isCompliant) {
                    stats.compliant++;
                } else {
                    stats.nonCompliant++;
                }

                // Validation error tracking with safe access
                const validationStatus = record.validationStatus || { isValid: true };
                if (!validationStatus.isValid) {
                    stats.validationErrors++;
                }
            } catch (error) {
                console.error(`Error processing record statistics for ${record.id}:`, error);
                stats.empty++; // Count as empty if processing fails
            }
        });

        // Calculate derived statistics
        stats.completionPercentage = stats.total > 0 ?
            Math.round((stats.complete / stats.total) * 100) : 0;
        stats.compliancePercentage = stats.total > 0 ?
            Math.round((stats.compliant / stats.total) * 100) : 0;

        return stats;
    },

    updateTableStatistics(recordCount) {
        // Update table statistics display (Source: db_viewer_html.txt pagination)
        const recordsDisplayInfo = document.getElementById('recordsDisplayInfo');
        if (recordsDisplayInfo) {
            const startIndex = ((this.currentPage || 1) - 1) * (this.itemsPerPage || 25);
            const endIndex = Math.min(startIndex + (this.itemsPerPage || 25), recordCount);
            // Use total database records instead of current page count
            const totalRecords = this.totalDatabaseRecords || recordCount;
            recordsDisplayInfo.textContent = `Showing ${startIndex + 1}-${endIndex} of ${totalRecords} records`;
        }

        // Update page info (Source: db_viewer_html.txt pagination controls)
        const pageInfo = document.getElementById('sfafPageInfo');
        if (pageInfo) {
            // Use total database records for calculating total pages
            const totalRecords = this.totalDatabaseRecords || recordCount;
            const totalPages = Math.ceil(totalRecords / (this.itemsPerPage || 25));
            pageInfo.textContent = `Page ${this.currentPage || 1} of ${totalPages || 1}`;
        }

        console.log(`📊 Table statistics updated: ${recordCount} records displayed`);
    },

    updatePaginationControls(totalRecords) {
        // Use total database records for pagination, not just current view count
        const actualTotalRecords = this.totalDatabaseRecords || totalRecords;
        const totalPages = Math.ceil(actualTotalRecords / this.itemsPerPage);

        // Update button states
        const firstPageBtn = document.getElementById('firstPageBtn');
        const prevPageBtn = document.getElementById('prevSFAFPage');
        const nextPageBtn = document.getElementById('nextSFAFPage');
        const lastPageBtn = document.getElementById('lastPageBtn');

        if (firstPageBtn) firstPageBtn.disabled = this.currentPage <= 1;
        if (prevPageBtn) prevPageBtn.disabled = this.currentPage <= 1;
        if (nextPageBtn) nextPageBtn.disabled = this.currentPage >= totalPages;
        if (lastPageBtn) lastPageBtn.disabled = this.currentPage >= totalPages;

        // Update pagination display text
        const recordsDisplayInfo = document.getElementById('recordsDisplayInfo');
        if (recordsDisplayInfo) {
            const startIndex = (this.currentPage - 1) * this.itemsPerPage;
            const endIndex = Math.min(startIndex + this.itemsPerPage, actualTotalRecords);
            recordsDisplayInfo.textContent = `Showing ${startIndex + 1}-${endIndex} of ${actualTotalRecords} records`;
        }
    },

    updateStatisticsDisplay(stats) {
        // Update main statistics display (Source: db_viewer_html.txt)
        const elements = {
            totalSFAFRecords: stats.total,
            completeSFAFRecords: stats.complete,
            incompleteSFAFRecords: stats.incomplete + stats.empty,
            compliantRecords: stats.compliant
        };

        Object.entries(elements).forEach(([elementId, value]) => {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = value;
            }
        });

        // Update additional statistics if elements exist
        this.updateExtendedStatistics(stats);
    },

    updateExtendedStatistics(stats) {
        // Update pagination info
        const recordsDisplayInfo = document.getElementById('recordsDisplayInfo');
        if (recordsDisplayInfo) {
            const startIndex = ((this.currentPage || 1) - 1) * (this.itemsPerPage || 25);
            const endIndex = Math.min(startIndex + (this.itemsPerPage || 25), stats.total);
            recordsDisplayInfo.textContent = `Showing ${startIndex + 1}-${endIndex} of ${stats.total} records`;
        }

        // Update filter results count
        const filterResultsCount = document.getElementById('filterResultsCount');
        if (filterResultsCount) {
            filterResultsCount.textContent = `${stats.total} records match current filters`;
        }

        // Update analytics if analytics tab elements exist
        this.updateAnalyticsStatistics(stats);
    },

    updateAnalyticsStatistics(stats) {
        // Update system overview statistics (Source: db_viewer_html.txt analytics section)
        const systemStats = document.getElementById('systemStats');
        if (systemStats) {
            systemStats.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Total SFAF Records</span>
                <span class="stat-value">${stats.total}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Completion Rate</span>
                <span class="stat-value">${stats.completionPercentage}%</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">MC4EB Compliance</span>
                <span class="stat-value">${stats.compliancePercentage}%</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Validation Errors</span>
                <span class="stat-value">${stats.validationErrors}</span>
            </div>
        `;
        }

        // Update compliance report
        const complianceReport = document.getElementById('complianceReport');
        if (complianceReport) {
            complianceReport.innerHTML = `
            <div class="compliance-summary">
                <h4>MC4EB Publication 7, Change 1 Compliance Status</h4>
                <div class="compliance-stats">
                    <div class="compliance-item compliant">
                        <span>Compliant Records:</span>
                        <span>${stats.compliant} (${stats.compliancePercentage}%)</span>
                    </div>
                    <div class="compliance-item non-compliant">
                        <span>Non-Compliant Records:</span>
                        <span>${stats.nonCompliant}</span>
                    </div>
                    <div class="compliance-item validation-errors">
                        <span>Validation Errors:</span>
                        <span>${stats.validationErrors}</span>
                    </div>
                </div>
            </div>
        `;
        }
    },

    updateAnalyticsElement(elementId, content) {
        try {
            const element = document.getElementById(elementId);
            if (element) {
                element.innerHTML = content;
                console.log(`✅ Updated analytics element: ${elementId}`);
            } else {
                console.warn(`⚠️ Analytics element not found: ${elementId}`);
            }
        } catch (error) {
            console.error(`❌ Failed to update analytics element ${elementId}:`, error);
        }
    },

    goToFirstPage() {
        this.currentPage = 1;
        // Load first page from API
        this.loadSFAFRecords();
        // Scroll to top of table
        this.scrollToTopOfTable();
    },

    goToLastPage() {
        // Calculate last page based on total database records
        const totalPages = Math.ceil(this.totalDatabaseRecords / this.itemsPerPage);
        this.currentPage = totalPages;
        // Load last page from API
        this.loadSFAFRecords();
        // Scroll to top of table
        this.scrollToTopOfTable();
    },

    scrollToTopOfTable() {
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer) {
            tableContainer.scrollTop = 0;
        }
    },

    sortByColumn(field) {
        // Toggle sort order if clicking the same column
        if (this.currentSort.field === field) {
            this.currentSort.order = this.currentSort.order === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSort.field = field;
            this.currentSort.order = 'asc';
        }

        console.log(`📊 Sorting by ${field} (${this.currentSort.order})`);

        // Apply sort and re-render
        this.applySortAndFilter();
    },

    applySortAndFilter() {
        let records = [...this.enhancedRecords];

        // Apply column filters
        Object.keys(this.columnFilters).forEach(field => {
            const filterValue = this.columnFilters[field].toLowerCase();
            records = records.filter(record => {
                const value = this.getRecordFieldValue(record, field);
                return value && value.toString().toLowerCase().includes(filterValue);
            });
        });

        // Apply sorting
        records.sort((a, b) => {
            const aValue = this.getRecordFieldValue(a, this.currentSort.field);
            const bValue = this.getRecordFieldValue(b, this.currentSort.field);

            // Handle null/undefined values
            if (aValue === null || aValue === undefined) return 1;
            if (bValue === null || bValue === undefined) return -1;

            // Compare values
            let comparison = 0;
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                comparison = aValue - bValue;
            } else {
                comparison = aValue.toString().localeCompare(bValue.toString(), undefined, { numeric: true });
            }

            return this.currentSort.order === 'asc' ? comparison : -comparison;
        });

        console.log(`📊 After sort/filter: ${records.length} records (from ${this.enhancedRecords.length} total)`);

        // Re-render with filtered and sorted data
        this.renderEnhancedSFAFTable(records);
    },

    async loadData() {
        try {
            this.showLoading(true);

            switch (this.currentTab) {
                case 'markers':
                    await this.loadMarkers();
                    break;
                case 'sfaf':
                    await this.loadSFAFRecords();
                    break;
                case 'irac':
                    await this.loadIRACNotes();
                    break;
                case 'analytics':
                    await this.loadAnalytics();
                    break;
            }
        } catch (error) {
            console.error('Failed to load data:', error);
            this.showError('Failed to load data. Please try again.');
        } finally {
            this.showLoading(false);
        }
    },

    async loadMarkers() {
        // Use existing SFAF Plotter API endpoint (Source: handlers.txt, main.txt)
        const response = await fetch('/api/markers');
        const data = await response.json();

        if (data.success) {
            // If no markers exist, automatically switch to SFAF tab
            if (!data.markers || data.markers.length === 0) {
                console.log('⚠️ No markers found in database, switching to SFAF tab');
                this.switchTab('sfaf');
                return;
            }
            this.renderMarkersTable(data.markers);
            this.updatePagination(data.markers.length);
        } else {
            throw new Error(data.error || 'Failed to load markers');
        }
    },

    async loadMarkerDMSCoordinates(markerId, lat, lng) {
        try {
            const response = await fetch(`/api/convert-coords?lat=${lat}&lng=${lng}`);
            const coords = await response.json();

            const dmsElement = document.getElementById(`dms-${markerId}`);
            if (dmsElement) {
                dmsElement.innerHTML = `
                    <div class="coord-dms-line">${coords.dms}</div>
                    <div class="coord-compact-line">${coords.compact}</div>
                `;
            }
        } catch (error) {
            console.error(`Failed to load DMS for marker ${markerId}:`, error);
            const dmsElement = document.getElementById(`dms-${markerId}`);
            if (dmsElement) {
                dmsElement.textContent = 'DMS conversion failed';
            }
        }
    },

    async loadMarkerSFAFCount(markerId) {
        try {
            const response = await fetch(`/api/sfaf/object-data/${markerId}`);
            const data = await response.json();

            const countElement = document.getElementById(`sfaf-count-${markerId}`);
            if (countElement && data.success) {
                const fieldCount = Object.keys(data.sfaf_fields || {}).length;
                countElement.innerHTML = `
                    <span class="field-count-number">${fieldCount}</span>
                    <span class="field-count-label">fields</span>
                `;
            }
        } catch (error) {
            console.error(`Failed to load SFAF count for marker ${markerId}:`, error);
            const countElement = document.getElementById(`sfaf-count-${markerId}`);
            if (countElement) {
                countElement.textContent = '0 fields';
            }
        }
    },

    async loadMarkerIRACCount(markerId) {
        try {
            const response = await fetch(`/api/sfaf/object-data/${markerId}`);
            const data = await response.json();

            const countElement = document.getElementById(`irac-count-${markerId}`);
            if (countElement && data.success && data.marker.irac_notes) {
                const notesCount = data.marker.irac_notes.length;
                countElement.innerHTML = `
                    <span class="notes-count-number">${notesCount}</span>
                    <span class="notes-count-label">notes</span>
                `;
            }
        } catch (error) {
            console.error(`Failed to load IRAC count for marker ${markerId}:`, error);
            const countElement = document.getElementById(`irac-count-${markerId}`);
            if (countElement) {
                countElement.textContent = '0 notes';
            }
        }
    },

    async loadSFAFRecords() {
        // Prevent duplicate simultaneous loads
        if (this._loadingSFAFRecords) {
            console.log('⚠️ Already loading SFAF records, skipping duplicate call');
            return;
        }
        this._loadingSFAFRecords = true;

        try {
            console.log('📊 Loading enhanced SFAF records with default view...');
            this.showLoading(true);

            // Use pagination parameters
            const page = this.currentPage || 1;
            const limit = this.itemsPerPage || 50;

            // Load SFAF records first (includes Pool Assignments without markers)
            const sfafResponse = await fetch(`/api/sfaf?page=${page}&limit=${limit}`);
            if (!sfafResponse.ok) {
                throw new Error(`SFAF API failed: ${sfafResponse.status} ${sfafResponse.statusText}`);
            }

            const sfafData = await sfafResponse.json();
            console.log('📊 SFAF API response:', sfafData);

            if (!sfafData.success) {
                throw new Error(sfafData.error || 'Failed to load SFAF records');
            }

            // Store total database count from pagination
            if (sfafData.pagination && sfafData.pagination.total !== undefined) {
                this.totalDatabaseRecords = sfafData.pagination.total;
                console.log(`✅ Set totalDatabaseRecords to: ${this.totalDatabaseRecords}`);
            } else {
                console.warn('⚠️ No pagination.total in API response:', sfafData.pagination);
            }

            if (!sfafData.sfafs || sfafData.sfafs.length === 0) {
                console.log('⚠️ No SFAF records found in database');
                this.renderEnhancedSFAFTable([]);
                this.updateSFAFSummaryStats([]);
                return;
            }

            console.log(`📊 Found ${sfafData.sfafs.length} SFAF records, loading markers...`);

            // Load markers (may be empty for Pool Assignments)
            let markersMap = new Map();
            try {
                const markersResponse = await fetch('/api/markers');
                if (markersResponse.ok) {
                    const markersData = await markersResponse.json();
                    if (markersData.success && markersData.markers) {
                        markersData.markers.forEach(marker => {
                            markersMap.set(marker.id, marker);
                        });
                        console.log(`📊 Loaded ${markersMap.size} markers`);
                    }
                }
            } catch (markerError) {
                console.warn('⚠️ Failed to load markers, continuing with SFAF-only records:', markerError);
            }

            // ✅ ENHANCED: Process SFAF records (with or without markers)
            const enhancedRecords = [];
            let successCount = 0;

            for (const sfaf of sfafData.sfafs) {
                try {
                    // Extract SFAF fields
                    const sfafFields = {};
                    Object.keys(sfaf).forEach(key => {
                        if (key.match(/^[Ff]ield\d+$/)) {
                            const normalizedKey = key.toLowerCase();
                            sfafFields[normalizedKey] = sfaf[key];
                        }
                    });

                    // Get marker data if available
                    const marker = sfaf.marker_id ? markersMap.get(sfaf.marker_id) : null;

                    // Create enhanced record
                    const enhancedRecord = {
                        id: sfaf.id,  // Use SFAF ID as primary ID
                        markerId: sfaf.marker_id,  // May be null for Pool Assignments
                        serial: sfafFields.field102 || (marker?.serial) || 'Unknown',
                        frequency: sfafFields.field110 || (marker?.frequency) || 'Not Specified',
                        location: 'No Coordinates',
                        agency: sfafFields.field200 || 'TBD',
                        markerType: marker ? (marker.type || marker.marker_type || 'imported') : 'pool_assignment',
                        isPool: this.detectPoolAssignment(sfafFields),
                        coordinates: {
                            lat: marker?.lat || null,
                            lng: marker?.lng || null
                        },
                        sfafFields: sfafFields,
                        rawSFAFFields: sfafFields,
                        completionPercentage: 0,
                        validationStatus: 'complete',
                        mcebCompliant: { isCompliant: false, issues: [] }
                    };

                    // Extract coordinates from marker or SFAF fields
                    if (marker && marker.lat && marker.lng) {
                        enhancedRecord.location = `${marker.lat.toFixed(4)}, ${marker.lng.toFixed(4)}`;
                    } else {
                        // Try to extract from SFAF fields
                        const coordString = sfafFields.field303 || sfafFields.field403;
                        if (coordString) {
                            const coords = this.parseCoordinateString(coordString);
                            if (coords && coords.lat && coords.lng) {
                                enhancedRecord.coordinates = {
                                    lat: coords.lat,
                                    lng: coords.lng
                                };
                                enhancedRecord.location = `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
                            }
                        }
                    }

                    enhancedRecord.completionPercentage = this.calculateCompletionPercentage(sfafFields);
                    enhancedRecord.mcebCompliant = this.validateMCEBCompliance(sfafFields);

                    enhancedRecords.push(enhancedRecord);
                    successCount++;

                } catch (recordError) {
                    console.error(`❌ Failed to process SFAF ${sfaf.id}:`, recordError);
                }
            }

            console.log(`📊 Processing complete: ${successCount} SFAF records processed`);
            console.log('📊 Enhanced records:', enhancedRecords);

            // ✅ Store all SFAF records (including Pool Assignments)
            this.currentSFAFData = enhancedRecords;
            this.enhancedRecords = enhancedRecords; // Store for sorting/filtering

            // ✅ Apply serial filter if set (from Table Manager)
            let filteredRecords = enhancedRecords;
            if (this.serialFilter && this.serialFilter.length > 0) {
                console.log('🔍 Looking for serials:', this.serialFilter);
                console.log('🔍 Sample of record serials:', enhancedRecords.slice(0, 10).map(r => r.serial));

                filteredRecords = enhancedRecords.filter(record => {
                    // Check if record serial matches any of the unit's assigned serials
                    return this.serialFilter.includes(record.serial);
                });
                console.log(`🔍 Serial filter applied: ${filteredRecords.length} of ${enhancedRecords.length} records match`);
            }

            // ✅ Apply currentFilter if set
            if (this.currentFilter && this.currentFilter.trim() !== '') {
                const filterLower = this.currentFilter.toLowerCase();
                filteredRecords = filteredRecords.filter(record => {
                    // Search across multiple fields
                    return (
                        (record.serial && record.serial.toLowerCase().includes(filterLower)) ||
                        (record.frequency && record.frequency.toString().toLowerCase().includes(filterLower)) ||
                        (record.agency && record.agency.toLowerCase().includes(filterLower)) ||
                        (record.location && record.location.toLowerCase().includes(filterLower)) ||
                        (record.sfafFields && record.sfafFields.field200 && record.sfafFields.field200.toLowerCase().includes(filterLower))
                    );
                });
            }

            // ✅ Apply pool assignment filter
            const poolFilter = this.activeFilters?.poolAssignment;
            if (poolFilter === 'pool') {
                filteredRecords = filteredRecords.filter(r => r.isPool);
            } else if (poolFilter === 'assigned') {
                filteredRecords = filteredRecords.filter(r => !r.isPool);
            }

            // ✅ Display filtered results
            this.renderEnhancedSFAFTable(filteredRecords);
            this.updateSFAFSummaryStats(filteredRecords);

            // Kick off silent background cache of all records so queries are instant
            if (this.totalDatabaseRecords > (this.itemsPerPage || 50)) {
                this._prefetchAllRecordsInBackground?.();
            }

        } catch (error) {
            console.error('❌ Failed to load SFAF records:', error);
            this.showError(`Failed to load SFAF records: ${error.message}`);

            // ✅ Show empty state on error
            this.renderEnhancedSFAFTable([]);
            this.updateSFAFSummaryStats([]);
        } finally {
            this.showLoading(false);
            this._loadingSFAFRecords = false; // Reset the loading flag
        }
    },

    async editMarker(markerId) {
        try {
            const response = await fetch(`/api/sfaf/object-data/${markerId}`);
            const data = await response.json();

            if (data.success) {
                this.openEditModal(data, 'marker');
            } else {
                throw new Error(data.error || 'Failed to load marker data');
            }
        } catch (error) {
            console.error('Failed to load marker for editing:', error);
            this.showError('Failed to load marker data for editing');
        }
    },

    async viewMarker(markerId) {
        try {
            const response = await fetch(`/api/sfaf/object-data/${markerId}`);
            const data = await response.json();

            if (data.success) {
                this.openViewModal(data);
            } else {
                throw new Error(data.error || 'Failed to load marker data');
            }
        } catch (error) {
            console.error('Failed to load marker for viewing:', error);
            this.showError('Failed to load marker data');
        }
    },

    async deleteMarker(markerId) {
        if (!confirm('Are you sure you want to delete this marker? This will also delete associated SFAF data.')) {
            return;
        }

        try {
            const response = await fetch(`/api/markers/${markerId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                console.log('✅ Marker deleted successfully');
                await this.loadData(); // Refresh current tab data
                this.showSuccess('Marker deleted successfully');
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Failed to delete marker:', error);
            this.showError('Failed to delete marker');
        }
    },

    async saveMarkerChanges(markerId, formData) {
        try {
            const updateData = {
                lat: parseFloat(formData.get('lat')),
                lng: parseFloat(formData.get('lng')),
                frequency: formData.get('frequency'),
                notes: formData.get('notes'),
                type: formData.get('type'),
                is_draggable: formData.get('is_draggable') === 'true'
            };

            // Collect SFAF field updates
            const sfafFields = {};
            for (const [key, value] of formData.entries()) {
                if (key.startsWith('sfaf_')) {
                    const fieldId = key.replace('sfaf_', '');
                    if (value.trim() !== '') {
                        sfafFields[fieldId] = value;
                    }
                }
            }

            // Update marker using existing API (Source: handlers.txt)
            const markerResponse = await fetch(`/api/markers/${markerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });

            if (!markerResponse.ok) {
                throw new Error(`HTTP ${markerResponse.status}: ${markerResponse.statusText}`);
            }

            // Update SFAF fields if any were modified (Source: handlers.txt SFAF operations)
            if (Object.keys(sfafFields).length > 0) {
                const sfafResponse = await fetch(`/api/sfaf`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        marker_id: markerId,
                        fields: sfafFields
                    })
                });

                if (!sfafResponse.ok) {
                    console.warn('SFAF update failed, but marker update succeeded');
                }
            }

            console.log('✅ Marker updated successfully');
            await this.loadData(); // Refresh current tab data
            this.showSuccess('Marker updated successfully');

        } catch (error) {
            console.error('Failed to update marker:', error);
            this.showError('Failed to update marker: ' + error.message);
        }
    },

    async openBulkEditModal() {
        if (this.selectedItems.size === 0) {
            this.showError('No markers selected');
            return;
        }

        const modal = document.getElementById('editModal');
        const modalTitle = document.getElementById('modalTitle');
        const editForm = document.getElementById('editForm');

        modalTitle.textContent = `Bulk Edit ${this.selectedItems.size} Markers`;

        // Create bulk edit form with common fields
        editForm.innerHTML = `
            <form id="bulkEditForm">
                <div class="bulk-edit-notice">
                    <p><strong>Note:</strong> Only fields with values will be updated. Leave fields empty to keep existing values.</p>
                </div>
                
                <div class="form-grid">
                    <div class="form-group">
                        <label>Frequency:</label>
                        <input type="text" name="frequency" placeholder="Leave empty to keep current values">
                    </div>
                    
                    <div class="form-group">
                        <label>Type:</label>
                        <select name="type">
                            <option value="">Keep current values</option>
                            <option value="manual">Manual</option>
                            <option value="imported">Imported</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Draggable:</label>
                        <select name="is_draggable">
                            <option value="">Keep current values</option>
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                        </select>
                    </div>
                    
                    <div class="form-group full-width">
                        <label>Notes (will append to existing notes):</label>
                        <textarea name="notes_append" rows="3" placeholder="Text to append to existing notes"></textarea>
                    </div>
                </div>
                
                <div class="selected-markers-preview">
                    <h4>Selected Markers (${this.selectedItems.size})</h4>
                    <div class="marker-list">
                        ${Array.from(this.selectedItems).map(id => {
            const marker = this.markers.find(m => m.id === id);
            return marker ? `<span class="marker-tag">${marker.serial}</span>` : '';
        }).join('')}
                    </div>
                </div>
            </form>
        `;

        // Update modal footer
        const modalFooter = modal.querySelector('.modal-footer');
        modalFooter.innerHTML = `
            <button type="button" class="btn btn-secondary" onclick="databaseViewer.closeModal()">Cancel</button>
            <button type="submit" form="bulkEditForm" class="btn btn-primary">Update ${this.selectedItems.size} Markers</button>
        `;

        // Handle form submission
        document.getElementById('bulkEditForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.processBulkEdit(new FormData(e.target));
        });

        modal.style.display = 'block';
    },

    async processBulkEdit(formData) {
        const updates = {};

        // Collect non-empty form values
        if (formData.get('frequency').trim()) {
            updates.frequency = formData.get('frequency').trim();
        }

        if (formData.get('type')) {
            updates.type = formData.get('type');
        }

        if (formData.get('is_draggable')) {
            updates.is_draggable = formData.get('is_draggable') === 'true';
        }

        const notesAppend = formData.get('notes_append').trim();

        if (Object.keys(updates).length === 0 && !notesAppend) {
            this.showError('No changes specified');
            return;
        }

        try {
            let successCount = 0;
            let errorCount = 0;
            const totalMarkers = this.selectedItems.size;

            // Show progress
            this.showLoading(true, `Processing ${totalMarkers} markers...`);

            // Process each selected marker
            for (const markerId of this.selectedItems) {
                try {
                    let markerUpdates = { ...updates };

                    // Handle notes appending by getting current notes first
                    if (notesAppend) {
                        const markerResponse = await fetch(`/api/markers/${markerId}`);
                        if (markerResponse.ok) {
                            const markerData = await markerResponse.json();
                            const currentNotes = markerData.marker.notes || '';
                            markerUpdates.notes = currentNotes ? `${currentNotes}\n${notesAppend}` : notesAppend;
                        }
                    }

                    // Update marker using existing API (Source: handlers.txt)
                    const response = await fetch(`/api/markers/${markerId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(markerUpdates)
                    });

                    if (response.ok) {
                        successCount++;
                    } else {
                        errorCount++;
                        console.error(`Failed to update marker ${markerId}:`, response.status);
                    }
                } catch (error) {
                    errorCount++;
                    console.error(`Error updating marker ${markerId}:`, error);
                }
            }

            this.showLoading(false);
            this.closeModal();

            // Show results
            if (successCount > 0) {
                this.showSuccess(`Successfully updated ${successCount} markers${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
            } else {
                this.showError(`Failed to update any markers (${errorCount} errors)`);
            }

            // Refresh data and clear selection
            await this.loadData();
            this.selectedItems.clear();
            this.updateBulkActionButtons();

        } catch (error) {
            this.showLoading(false);
            console.error('Bulk edit failed:', error);
            this.showError('Bulk edit operation failed');
        }
    },

    async deleteSelected() {
        if (this.selectedItems.size === 0) {
            this.showError('No records selected');
            return;
        }

        const recordCount = this.selectedItems.size;
        if (!confirm(`Delete ${recordCount} selected record${recordCount !== 1 ? 's' : ''} ` +
                     `and all associated data?\n\n` +
                     `This will permanently delete:\n` +
                     `- ${recordCount} SFAF record${recordCount !== 1 ? 's' : ''}\n` +
                     `- ${recordCount} marker${recordCount !== 1 ? 's' : ''}\n` +
                     `- Associated geometries and IRAC notes\n\n` +
                     `This action cannot be undone.`)) {
            return;
        }

        try {
            let successCount = 0;
            let errorCount = 0;
            const errors = [];
            const totalRecords = this.selectedItems.size;
            const selectedArray = Array.from(this.selectedItems);

            console.log(`🗑️ Starting bulk delete of ${totalRecords} records:`, selectedArray);
            this.showLoading(true, `Deleting ${totalRecords} record${totalRecords !== 1 ? 's' : ''}...`);

            // Delete with progress tracking
            for (let i = 0; i < selectedArray.length; i++) {
                const recordId = selectedArray[i];
                this.showLoading(true, `Deleting record ${i + 1} of ${totalRecords}...`);

                try {
                    console.log(`🗑️ Deleting SFAF record ${i + 1}/${totalRecords}: ${recordId}`);
                    const response = await fetch(`/api/sfaf/${recordId}`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' }
                    });

                    if (response.ok) {
                        successCount++;
                        console.log(`✅ Successfully deleted record ${recordId}`);
                    } else {
                        errorCount++;
                        const responseText = await response.text();
                        console.error(`❌ Failed to delete record ${recordId}: HTTP ${response.status} - ${responseText}`);
                        errors.push({ id: recordId, error: `HTTP ${response.status}: ${responseText}` });
                    }
                } catch (error) {
                    errorCount++;
                    console.error(`❌ Error deleting record ${recordId}:`, error);
                    errors.push({ id: recordId, error: error.message });
                }
            }

            this.showLoading(false);

            // Show results
            if (successCount > 0 && errorCount === 0) {
                this.showSuccess(`Successfully deleted all ${successCount} record${successCount !== 1 ? 's' : ''}`);
            } else if (successCount > 0 && errorCount > 0) {
                this.showWarning(`Deleted ${successCount} record${successCount !== 1 ? 's' : ''}, ` +
                               `but ${errorCount} failed. Check console for details.`);
                console.error('Delete errors:', errors);
            } else {
                this.showError(`Failed to delete any records. Check console for details.`);
                console.error('Delete errors:', errors);
            }

            // Clear selections and refresh
            this.selectedItems.clear();
            this.sessionManager.clearSelectedItems(this.currentTab);
            this.updateSelectionUI();
            await this.loadData();

        } catch (error) {
            this.showLoading(false);
            console.error('Bulk delete failed:', error);
            this.showError(`Bulk delete operation failed: ${error.message}`);
        }
    },

    async deleteAllSFAFs() {
        const totalRecords = this.totalDatabaseRecords || 0;

        if (totalRecords === 0) {
            this.showError('No records to delete');
            return;
        }

        if (!confirm(`⚠️ WARNING: Delete ALL ${totalRecords} SFAF records?\n\n` +
                     `This will permanently delete:\n` +
                     `- ALL ${totalRecords} SFAF records\n` +
                     `- ALL associated markers\n` +
                     `- ALL geometries and IRAC notes\n\n` +
                     `THIS ACTION CANNOT BE UNDONE!\n\n` +
                     `Type 'DELETE ALL' in the next prompt to confirm.`)) {
            return;
        }

        const confirmation = prompt('Type "DELETE ALL" to confirm deletion of all records:');
        if (confirmation !== 'DELETE ALL') {
            this.showError('Deletion cancelled - confirmation text did not match');
            return;
        }

        try {
            this.showLoading(true, `Deleting all ${totalRecords} records...`);

            const response = await fetch('/api/sfaf/delete-all', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`Failed to delete all records: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            this.showLoading(false);
            this.showSuccess(`Successfully deleted all ${result.deleted_count || totalRecords} SFAF records`);

            // Clear selection and reload
            this.selectedItems.clear();
            this.updateBulkActionButtons();
            this.loadSFAFRecords();
        } catch (error) {
            this.showLoading(false);
            console.error('Delete all failed:', error);
            this.showError(`Failed to delete all records: ${error.message}`);
        }
    },

    async deleteSingleRecord(recordId) {
        const record = this.currentSFAFData.find(r => r.id === recordId);
        const recordInfo = record ? `${record.serial || 'Unknown'}` : 'this record';

        if (!confirm(`Delete ${recordInfo} and all associated data?\n\n` +
                     `This will permanently delete:\n- SFAF record\n- Marker (if any)\n- Geometry (if any)\n` +
                     `- IRAC notes\n\nThis action cannot be undone.`)) {
            return;
        }

        try {
            this.showLoading(true, 'Deleting record...');

            // Delete SFAF record (which will cascade to marker if it exists)
            const response = await fetch(`/api/sfaf/${recordId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`Delete failed: ${response.status} ${response.statusText}`);
            }

            this.showLoading(false);
            this.showSuccess(`Successfully deleted ${recordInfo}`);

            // Remove from selection if selected
            this.selectedItems.delete(recordId);
            this.sessionManager.saveSelectedItems(this.currentTab, this.selectedItems);

            await this.loadData();

        } catch (error) {
            this.showLoading(false);
            console.error('Delete failed:', error);
            this.showError(`Failed to delete record: ${error.message}`);
        }
    },

    async openAddModal() {
        const modal = document.getElementById('editModal');
        const modalTitle = document.getElementById('modalTitle');
        const editForm = document.getElementById('editForm');

        modalTitle.textContent = 'Add New Marker';

        editForm.innerHTML = `
            <div class="form-grid">
                <div class="form-group">
                    <label>Latitude:</label>
                    <input type="number" step="any" name="lat" required placeholder="e.g., 30.4382">
                </div>
                <div class="form-group">
                    <label>Longitude:</label>
                    <input type="number" step="any" name="lng" required placeholder="e.g., -86.7117">
                </div>
                <div class="form-group">
                    <label>Frequency:</label>
                    <input type="text" name="frequency" placeholder="e.g., 162.550">
                </div>
                <div class="form-group">
                    <label>Type:</label>
                    <select name="type" required>
                        <option value="">Select Type</option>
                        <option value="manual">Manual</option>
                        <option value="imported">Imported</option>
                    </select>
                </div>
                <div class="form-group full-width">
                    <label>Notes:</label>
                    <textarea name="notes" rows="3" placeholder="Optional notes"></textarea>
                </div>
            </div>
        `;

        // Update modal footer for add mode
        const modalFooter = modal.querySelector('.modal-footer');
        modalFooter.innerHTML = `
            <button type="button" class="btn btn-secondary" onclick="databaseViewer.closeModal()">Cancel</button>
            <button type="submit" form="editForm" class="btn btn-primary">Create Marker</button>
        `;

        // Handle form submission for new marker
        editForm.onsubmit = async (e) => {
            e.preventDefault();
            await this.createNewMarker(new FormData(e.target));
            this.closeModal();
        };

        modal.style.display = 'block';
    },

    async createNewMarker(formData) {
        try {
            const markerData = {
                lat: parseFloat(formData.get('lat')),
                lng: parseFloat(formData.get('lng')),
                frequency: formData.get('frequency'),
                notes: formData.get('notes'),
                type: formData.get('type')
            };

            // Use existing API endpoint for marker creation (Source: handlers.txt)
            const response = await fetch('/api/markers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(markerData)
            });

            if (response.ok) {
                const result = await response.json();
                this.showSuccess('Marker created successfully');
                await this.loadData(); // Refresh current tab data

                // If we're on the markers tab, highlight the new marker
                if (this.currentTab === 'markers') {
                    setTimeout(() => {
                        const newRow = document.querySelector(`[data-marker-id="${result.marker.id}"]`);
                        if (newRow) {
                            newRow.style.backgroundColor = '#e8f5e8';
                            setTimeout(() => {
                                newRow.style.backgroundColor = '';
                            }, 2000);
                        }
                    }, 100);
                }
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Failed to create marker:', error);
            this.showError('Failed to create marker: ' + error.message);
        }
    },

    async reloadAssignmentData() {
        try {
            this.showLoading(true);

            // Load markers with comprehensive SFAF data
            const markersResponse = await fetch('/api/markers');
            const markersData = await markersResponse.json();

            if (!markersData.success) {
                throw new Error(markersData.error || 'Failed to load markers');
            }

            // Enhance each marker with complete SFAF and IRAC data
            const enhancedMarkers = await Promise.all(
                markersData.markers.map(async (marker) => {
                    try {
                        // Load SFAF object data (Source: db_viewer_js.txt API usage)
                        const sfafResponse = await fetch(`/api/sfaf/object-data/${marker.id}`);
                        const sfafData = await sfafResponse.json();

                        // Load coordinate conversions
                        const coordResponse = await fetch(`/api/convert-coords?lat=${marker.Latitude}&lng=${marker.Longitude}`);
                        const coordData = await coordResponse.json();

                        return {
                            ...marker,
                            sfaf_fields: sfafData.success ? sfafData.sfaf_fields : {},
                            field_definitions: sfafData.success ? sfafData.field_defs : {},
                            irac_notes: sfafData.success ? sfafData.marker.irac_notes : [],
                            coordinates: {
                                decimal: `${marker.Latitude}, ${marker.Longitude}`,
                                dms: coordData.dms || 'N/A',
                                compact: coordData.compact || 'N/A'
                            }
                        };
                    } catch (error) {
                        console.error(`Failed to enhance marker ${marker.id}:`, error);
                        return {
                            ...marker,
                            sfaf_fields: {},
                            field_definitions: {},
                            irac_notes: [],
                            coordinates: {
                                decimal: `${marker.Latitude}, ${marker.Longitude}`,
                                dms: 'Error',
                                compact: 'Error'
                            }
                        };
                    }
                })
            );

            // Apply filters
            const filteredData = this.applyFiltersToData(enhancedMarkers);

            this.currentData = filteredData;
            this.renderAssignmentTable(filteredData);
            this.updateFilterStats();

        } catch (error) {
            console.error('Failed to reload assignment data:', error);
            this.showError('Failed to load assignment data: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    },

    async deleteSelectedRecords() {
        await this.deleteSelected();
    }

});
