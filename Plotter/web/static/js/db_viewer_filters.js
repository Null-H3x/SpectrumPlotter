// db_viewer_filters.js — Filtering, querying, sorting, saved views

Object.assign(DatabaseViewer.prototype, {

    saveFilterView() {
        const viewName = prompt('Enter a name for this filter view:');
        if (viewName && viewName.trim() !== '') {
            this.savedViews[viewName] = {
                filters: { ...this.activeFilters },
                viewMode: this.currentView,
                searchTerm: document.getElementById('assignmentSearch')?.value || '',
                savedAt: new Date().toISOString(),
                description: this.generateViewDescription()
            };

            this.saveSavedViews();
            this.updateSavedViewsDropdown();
            this.showSuccess(`Filter view "${viewName}" saved successfully`);
        }
    },

    generateViewDescription() {
        const filters = [];
        if (this.activeFilters.frequency) filters.push(`Frequency: ${this.activeFilters.frequency}`);
        if (this.activeFilters.location) filters.push(`Location: ${this.activeFilters.location}`);
        if (this.activeFilters.agency) filters.push(`Agency: ${this.activeFilters.agency}`);
        if (this.activeFilters.stationClass) filters.push(`Station Class: ${this.activeFilters.stationClass}`);

        return filters.length > 0 ? filters.join(', ') : 'No active filters';
    },

    loadSavedViews() {
        try {
            return JSON.parse(localStorage.getItem('sfafSavedViews')) || {};
        } catch (e) {
            console.warn('Could not load saved views:', e);
            return {};
        }
    },

    saveSavedViews() {
        localStorage.setItem('sfafSavedViews', JSON.stringify(this.savedViews));
    },

    updateSavedViewsDropdown() {
        const dropdown = document.getElementById('savedViewsDropdown');
        if (!dropdown) return;

        dropdown.innerHTML = '<option value="">Select saved view...</option>';

        Object.entries(this.savedViews).forEach(([name, view]) => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = `${name} (${view.viewMode})`;
            option.title = view.description;
            dropdown.appendChild(option);
        });
    },

    applySavedView(viewName) {
        const view = this.savedViews[viewName];
        if (!view) return;

        // Apply filters
        this.activeFilters = { ...view.filters };
        this.currentView = view.viewMode;

        // Update UI controls
        this.updateFilterControls();
        this.updateViewModeSelector();

        // Reload data with filters
        this.reloadAssignmentData();

        this.showSuccess(`Applied saved view: ${viewName}`);
    },

    updateFilterControls() {
        // Update filter input fields based on activeFilters
        Object.entries(this.activeFilters).forEach(([key, value]) => {
            const input = document.getElementById(`filter${key.charAt(0).toUpperCase() + key.slice(1)}`);
            if (input) {
                input.value = value;
            }
        });
    },

    updateViewModeSelector() {
        const selector = document.getElementById('viewModeSelector');
        if (selector) {
            selector.value = this.currentView;
        }
    },

    applyAdvancedFilters() {
        const filters = {
            frequency: this.parseFrequencyFilter(document.getElementById('freqFrom')?.value, document.getElementById('freqTo')?.value),
            location: document.getElementById('filterLocation')?.value,
            agency: document.getElementById('filterAgency')?.value,
            stationClass: document.getElementById('filterStationClass')?.value,
            approvalStatus: document.getElementById('filterApprovalStatus')?.value
        };

        // Remove empty filters
        this.activeFilters = Object.fromEntries(
            Object.entries(filters).filter(([_, value]) => value && value.trim() !== '')
        );

        this.currentPage = 1;
        this.reloadAssignmentData();
        this.updateFilterStats();
    },

    parseFrequencyFilter(fromValue, toValue) {
        if (!fromValue && !toValue) return null;

        const from = fromValue ? parseFloat(fromValue) : null;
        const to = toValue ? parseFloat(toValue) : null;

        return { from, to };
    },

    clearAllFilters() {
        this.columnFilters = {};
        this.currentPage = 1;

        // Clear filter inputs
        document.querySelectorAll('.column-filter').forEach(input => {
            input.value = '';
        });

        this.applySortAndFilter();
    },

    applyFiltersToData(data) {
        return data.filter(assignment => {
            // Frequency filter
            if (this.activeFilters.frequency) {
                const freq = parseFloat(assignment.sfaf_fields.field110 || assignment.frequency || '0');
                const { from, to } = this.activeFilters.frequency;
                if (from && freq < from) return false;
                if (to && freq > to) return false;
            }

            // Location filter
            if (this.activeFilters.location) {
                const location = `${assignment.sfaf_fields.field300 || ''} ${assignment.sfaf_fields.field301 || ''}`.toLowerCase();
                if (!location.includes(this.activeFilters.location.toLowerCase())) return false;
            }

            // Agency filter
            if (this.activeFilters.agency) {
                const agency = assignment.sfaf_fields.field200 || '';
                if (!agency.startsWith(this.activeFilters.agency)) return false;
            }

            // Station class filter
            if (this.activeFilters.stationClass) {
                const stationClass = assignment.sfaf_fields.field113 || '';
                if (!stationClass.includes(this.activeFilters.stationClass)) return false;
            }

            // Approval status filter
            if (this.activeFilters.approvalStatus) {
                const approvalStatus = assignment.sfaf_fields.field144 || '';
                if (approvalStatus !== this.activeFilters.approvalStatus) return false;
            }

            return true;
        });
    },

    updateFilterStats() {
        const totalCount = this.currentData?.length || 0;
        const visibleCount = Math.min(totalCount, this.itemsPerPage);

        const filterResultsElement = document.getElementById('filterResultsCount');
        if (filterResultsElement) {
            filterResultsElement.textContent = `Showing ${visibleCount} of ${totalCount} assignments`;
        }

        const totalElement = document.getElementById('totalAssignments');
        if (totalElement) {
            totalElement.textContent = totalCount;
        }
    },

    filterColumn(field, value) {
        // Update filter value
        if (value && value.trim()) {
            this.columnFilters[field] = value.trim();
        } else {
            delete this.columnFilters[field];
        }

        console.log(`🔍 Filtering ${field}:`, value);

        // Reset to first page when filtering
        this.currentPage = 1;

        // Apply filter and re-render
        this.applySortAndFilter();
    },

    addDBFilterQuery() {
        const queryId = `db_query_${Date.now()}`;
        const container = document.getElementById('dbFilterQueriesContainer');

        if (!this.dbFilterQueries) {
            this.dbFilterQueries = [];
        }

        const queryHTML = `
            <div class="filter-query" data-query-id="${queryId}">
                <div class="query-header">
                    <span class="query-label">Filter ${this.dbFilterQueries.length + 1}</span>
                    <button class="query-remove-btn" onclick="databaseViewer.removeDBQuery('${queryId}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="query-body">
                    <div class="query-row">
                        <label>Field:</label>
                        <select class="query-field" data-query-id="${queryId}">
                            <option value="">Select field...</option>
                            <option value="serial">Serial Number (100)</option>
                            <option value="frequency">Frequency (110)</option>
                            <option value="emission">Emission (114)</option>
                            <option value="power">Power (115)</option>
                            <option value="location">Location (300)</option>
                            <option value="equipment">Equipment (340)</option>
                            <option value="notes">Notes</option>
                            <option value="marker_type">Type</option>
                        </select>
                    </div>
                    <div class="query-row">
                        <label>Operator:</label>
                        <select class="query-operator" data-query-id="${queryId}">
                            <option value="contains">Contains</option>
                            <option value="equals">Equals</option>
                            <option value="not_equals">Not Equals</option>
                            <option value="starts_with">Starts With</option>
                            <option value="ends_with">Ends With</option>
                            <option value="greater_than">Greater Than</option>
                            <option value="less_than">Less Than</option>
                        </select>
                    </div>
                    <div class="query-row">
                        <label>Value:</label>
                        <input type="text" class="query-value" placeholder="Enter value"
                               data-query-id="${queryId}">
                        <small class="query-hint">Case-insensitive search</small>
                    </div>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', queryHTML);

        this.dbFilterQueries.push({
            id: queryId,
            field: '',
            operator: 'contains',
            value: ''
        });

        console.log(`✅ Added DB filter query: ${queryId}`);
    },

    removeDBQuery(queryId) {
        const queryElement = document.querySelector(`[data-query-id="${queryId}"]`);
        if (queryElement) {
            queryElement.remove();
        }

        if (this.dbFilterQueries) {
            this.dbFilterQueries = this.dbFilterQueries.filter(q => q.id !== queryId);
        }

        console.log(`🗑️ Removed DB filter query: ${queryId}`);
    },

    applyDBFilters() {
        if (!this.dbFilterQueries || this.dbFilterQueries.length === 0) {
            alert('Please add at least one filter query');
            return;
        }

        // Collect filter values from UI
        this.dbFilterQueries.forEach(query => {
            const fieldSelect = document.querySelector(`.query-field[data-query-id="${query.id}"]`);
            const operatorSelect = document.querySelector(`.query-operator[data-query-id="${query.id}"]`);
            const valueInput = document.querySelector(`.query-value[data-query-id="${query.id}"]`);

            if (fieldSelect) query.field = fieldSelect.value;
            if (operatorSelect) query.operator = operatorSelect.value;
            if (valueInput) query.value = valueInput.value;
        });

        // Filter the current data
        const filteredData = this.filterRecordsByQueries(this.currentSFAFData || []);

        // Update the display
        this.currentData = filteredData;
        this.currentPage = 1;
        this.renderEnhancedSFAFTable(filteredData);
        this.updatePagination();
        this.updateDBQueryStats();

        console.log(`✅ Applied ${this.dbFilterQueries.length} filters, found ${filteredData.length} matching records`);
    },

    filterRecordsByQueries(records, queries = null) {
        // Use provided queries or fall back to dbFilterQueries
        const filterQueries = queries || this.dbFilterQueries;

        console.log('🔍 Filtering records:', {
            totalRecords: records.length,
            queries: filterQueries.map(q => ({
                field: q.field,
                operator: q.operator,
                value: q.value
            }))
        });

        const filtered = records.filter(record => {
            // All queries must pass (AND logic)
            const matches = filterQueries.every(query => {
                if (!query.field || !query.value) {
                    console.log('⚠️ Skipping empty query:', query);
                    return true; // Skip empty queries
                }

                const fieldValue = this.getRecordFieldValue(record, query.field);
                const queryValue = query.value.toLowerCase();
                const recordValue = String(fieldValue || '').toLowerCase();

                console.log(`  Checking record ${record.id || record.serial}:`, {
                    field: query.field,
                    operator: query.operator,
                    recordValue: recordValue,
                    queryValue: queryValue
                });

                let result = false;
                switch (query.operator) {
                    case 'in':
                        // "In (In Set)" - split by comma and check if value is in the set
                        const setValues = queryValue.split(',').map(v => v.trim().toLowerCase());
                        result = setValues.some(v => recordValue.includes(v));
                        break;
                    case 'contains':
                        result = recordValue.includes(queryValue);
                        break;
                    case 'equals':
                        result = recordValue === queryValue;
                        break;
                    case 'not_equals':
                        result = recordValue !== queryValue;
                        break;
                    case 'starts_with':
                        result = recordValue.startsWith(queryValue);
                        break;
                    case 'ends_with':
                        result = recordValue.endsWith(queryValue);
                        break;
                    case 'greater_than':
                        result = parseFloat(recordValue) > parseFloat(queryValue);
                        break;
                    case 'less_than':
                        result = parseFloat(recordValue) < parseFloat(queryValue);
                        break;
                    default:
                        result = true;
                }

                console.log(`    Result: ${result}`);
                return result;
            });

            return matches;
        });

        console.log(`✅ Filtering complete: ${filtered.length} records matched`);
        return filtered;
    },

    clearDBFilters() {
        // Remove all query elements
        const container = document.getElementById('dbFilterQueriesContainer');
        if (container) {
            container.innerHTML = '';
        }

        // Clear queries array
        this.dbFilterQueries = [];

        // Reload original data
        this.currentData = this.currentSFAFData || [];
        this.currentPage = 1;
        this.renderEnhancedSFAFTable(this.currentSFAFData || []);
        this.updatePagination();
        this.updateDBQueryStats();

        console.log('✅ Cleared all DB filters');
    },

    applyQuickFilter(filterType) {
        // Clear existing queries
        this.clearDBFilters();

        // Add a query based on filter type
        this.addDBFilterQuery();

        // Set query values based on filter type
        const queries = this.dbFilterQueries;
        if (queries && queries.length > 0) {
            const query = queries[queries.length - 1];
            const fieldSelect = document.querySelector(`.query-field[data-query-id="${query.id}"]`);
            const operatorSelect = document.querySelector(`.query-operator[data-query-id="${query.id}"]`);
            const valueInput = document.querySelector(`.query-value[data-query-id="${query.id}"]`);

            switch (filterType) {
                case 'hf':
                    if (fieldSelect) fieldSelect.value = 'frequency';
                    if (operatorSelect) operatorSelect.value = 'starts_with';
                    if (valueInput) valueInput.value = 'K';
                    break;
                case 'vhf':
                    if (fieldSelect) fieldSelect.value = 'frequency';
                    if (operatorSelect) operatorSelect.value = 'starts_with';
                    if (valueInput) valueInput.value = 'M';
                    break;
                case 'uhf':
                    if (fieldSelect) fieldSelect.value = 'frequency';
                    if (operatorSelect) operatorSelect.value = 'contains';
                    if (valueInput) valueInput.value = 'M';
                    break;
                case 'imported':
                    if (fieldSelect) fieldSelect.value = 'marker_type';
                    if (operatorSelect) operatorSelect.value = 'equals';
                    if (valueInput) valueInput.value = 'imported';
                    break;
                case 'manual':
                    if (fieldSelect) fieldSelect.value = 'marker_type';
                    if (operatorSelect) operatorSelect.value = 'equals';
                    if (valueInput) valueInput.value = 'manual';
                    break;
            }

            // Auto-apply the filter
            this.applyDBFilters();
        }
    },

    updateDBQueryStats() {
        const matchingCount = document.getElementById('dbMatchingCount');
        const totalCount = document.getElementById('dbTotalCount');

        if (matchingCount) {
            matchingCount.textContent = this.currentData ? this.currentData.length : 0;
        }

        if (totalCount) {
            totalCount.textContent = this.currentSFAFData ? this.currentSFAFData.length : 0;
        }
    },

    addQueryCondition() {
        // SYNCHRONOUS lock - check and set atomically at the very start
        if (this._isAddingCondition) {
            console.warn('⚠️ Already adding a condition, skipping duplicate call');
            return;
        }
        this._isAddingCondition = true; // Set immediately, synchronously

        // Generate a unique ID with timestamp + random component to prevent collisions
        const conditionId = `condition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const container = document.getElementById('queryConditionsList');

        if (!container) {
            console.error('❌ Query conditions list container not found');
            this._isAddingCondition = false;
            return;
        }

        // Check if this ID already exists (prevent duplicates)
        if (document.querySelector(`[data-condition-id="${conditionId}"]`)) {
            console.warn('⚠️ Duplicate condition ID detected, skipping');
            this._isAddingCondition = false;
            return;
        }

        // Generate field options from MC4EB Pub 7 CHG 1 fields
        const fieldOptions = [
            '<option value="field005">005 - Security Classification</option>',
            '<option value="field006">006 - Security Classification Modification</option>',
            '<option value="field007">007 - Missing Data Indicator</option>',
            '<option value="field010">010 - Type of Action</option>',
            '<option value="field013">013 - Declassification Instruction Comment</option>',
            '<option value="field014">014 - Derivative Classification Authority</option>',
            '<option value="field015">015 - Unclassified Data Fields</option>',
            '<option value="field016">016 - Extended Declassification Date</option>',
            '<option value="field017">017 - Date of Origin</option>',
            '<option value="field018">018 - Assignment Concurrence Indicator</option>',
            '<option value="field019">019 - ITU Notification</option>',
            '<option value="field020">020 - File Number Extension</option>',
            '<option value="field102">102 - Agency Serial Number</option>',
            '<option value="field103">103 - Frequency/Frequency Alternative</option>',
            '<option value="field105">105 - Equipment Configuration/Emission Designator</option>',
            '<option value="field106">106 - Tuning Range/System/Subsystem/Equipment Indicator</option>',
            '<option value="field107">107 - Tuning Increment/Net Identifier</option>',
            '<option value="field108">108 - Equipment Function Code</option>',
            '<option value="field110">110 - Frequency(ies)</option>',
            '<option value="field111">111 - Excluded Frequency Band</option>',
            '<option value="field112">112 - Frequency Separation Criteria</option>',
            '<option value="field113">113 - Station Class</option>',
            '<option value="field114">114 - Emission Designator</option>',
            '<option value="field115">115 - Transmitter Power</option>',
            '<option value="field116">116 - Power Type</option>',
            '<option value="field117">117 - Effective Radiated Power</option>',
            '<option value="field118">118 - Power/ERP Augmentation</option>',
            '<option value="field130">130 - Time</option>',
            '<option value="field131">131 - Percent Time</option>',
            '<option value="field140">140 - Required Date</option>',
            '<option value="field141">141 - Expiration Date</option>',
            '<option value="field142">142 - Review Date</option>',
            '<option value="field143">143 - Revision Date</option>',
            '<option value="field144">144 - Approval Authority Indicator</option>',
            '<option value="field145">145 - ITU BR Registration</option>',
            '<option value="field146">146 - DCS Trunk ID</option>',
            '<option value="field147">147 - Joint Agencies</option>',
            '<option value="field151">151 - Coordination Indicator</option>',
            '<option value="field152">152 - Coordination Data</option>',
            '<option value="field200">200 - Agency</option>',
            '<option value="field201">201 - Unified Command</option>',
            '<option value="field202">202 - Unified Command Service</option>',
            '<option value="field203">203 - Bureau</option>',
            '<option value="field204">204 - Command</option>',
            '<option value="field205">205 - Subcommand</option>',
            '<option value="field206">206 - Installation Frequency Manager</option>',
            '<option value="field207">207 - Operating Unit</option>',
            '<option value="field208">208 - User Net/Code</option>',
            '<option value="field209">209 - Area AFC/DoD AFC/Other Organizations</option>',
            '<option value="field300">300 - State/Country</option>',
            '<option value="field301">301 - Antenna Location</option>',
            '<option value="field302">302 - Station Control</option>',
            '<option value="field303">303 - Antenna Coordinates</option>',
            '<option value="field304">304 - Call Sign</option>',
            '<option value="field306">306 - Authorized Radius</option>',
            '<option value="field315">315 - Equatorial Inclination Angle</option>',
            '<option value="field316">316 - Apogee</option>',
            '<option value="field317">317 - Perigee</option>',
            '<option value="field318">318 - Period of Orbit</option>',
            '<option value="field319">319 - Number of Satellites</option>',
            '<option value="field321">321 - Power Density</option>',
            '<option value="field340">340 - Equipment Nomenclature</option>',
            '<option value="field341">341 - Number of Stations, System Name</option>',
            '<option value="field342">342 - Aircraft Nautical Mile Value</option>',
            '<option value="field343">343 - Equipment Certification Identification Number</option>',
            '<option value="field344">344 - Off-the-shelf Equipment</option>',
            '<option value="field345">345 - Radar Tunability</option>',
            '<option value="field346">346 - Pulse Duration</option>',
            '<option value="field347">347 - Pulse Repetition Rate</option>',
            '<option value="field348">348 - Intermediate Frequency</option>',
            '<option value="field349">349 - Sidelobe Suppression</option>',
            '<option value="field354">354 - Antenna Name</option>',
            '<option value="field355">355 - Antenna Nomenclature</option>',
            '<option value="field356">356 - Antenna Structure Height</option>',
            '<option value="field357">357 - Antenna Gain</option>',
            '<option value="field358">358 - Antenna Elevation</option>',
            '<option value="field359">359 - Antenna Feedpoint Height</option>',
            '<option value="field360">360 - Antenna Horizontal Beamwidth</option>',
            '<option value="field361">361 - Antenna Vertical Beamwidth</option>',
            '<option value="field362">362 - Antenna Orientation</option>',
            '<option value="field363">363 - Antenna Polarization</option>',
            '<option value="field373">373 - JSC Area Code</option>',
            '<option value="field374">374 - ITU Region</option>',
            '<option value="field400">400 - State/Country</option>',
            '<option value="field401">401 - Antenna Location</option>',
            '<option value="field402">402 - Receiver Control</option>',
            '<option value="field403">403 - Antenna Coordinates</option>',
            '<option value="field404">404 - Call Sign</option>',
            '<option value="field406">406 - Authorized Radius</option>',
            '<option value="field407">407 - Path Length</option>',
            '<option value="field408">408 - Repeater Indicator</option>',
            '<option value="field415">415 - Equatorial Inclination Angle</option>',
            '<option value="field416">416 - Apogee</option>',
            '<option value="field417">417 - Perigee</option>',
            '<option value="field418">418 - Period of Orbit</option>',
            '<option value="field419">419 - Number of Satellites</option>',
            '<option value="field440">440 - Equipment Nomenclature</option>',
            '<option value="field442">442 - Aircraft Nautical Mile Value</option>',
            '<option value="field443">443 - Equipment Certification Identification Number</option>',
            '<option value="field454">454 - Antenna Name</option>',
            '<option value="field455">455 - Antenna Nomenclature</option>',
            '<option value="field456">456 - Antenna Structure Height</option>',
            '<option value="field457">457 - Antenna Gain</option>',
            '<option value="field458">458 - Antenna Elevation</option>',
            '<option value="field460">460 - Antenna Feedpoint Height</option>',
            '<option value="field461">461 - Antenna Horizontal Beamwidth</option>',
            '<option value="field463">463 - Antenna Vertical Beamwidth</option>',
            '<option value="field470">470 - Antenna Orientation</option>',
            '<option value="field471">471 - Earth Station System Noise Temperature</option>',
            '<option value="field472">472 - Equivalent Satellite Link Noise Temperature</option>',
            '<option value="field500">500 - IRAC Notes</option>',
            '<option value="field501">501 - Notes/Comments</option>',
            '<option value="field502">502 - Description of Requirement</option>',
            '<option value="field503">503 - Agency Free-text Comments</option>',
            '<option value="field504">504 - FAS Agenda or OUS&P Comments</option>',
            '<option value="field506">506 - Paired Frequency</option>',
            '<option value="field511">511 - Major Function Identifier</option>',
            '<option value="field512">512 - Intermediate Function Identifier</option>',
            '<option value="field513">513 - Detailed Function Identifier</option>',
            '<option value="field520">520 - Supplementary Details</option>',
            '<option value="field521">521 - Transition and Narrow Band Planning Data</option>',
            '<option value="field530">530 - Authorized Areas</option>',
            '<option value="field531">531 - Authorized States</option>',
            '<option value="marker_type">Marker Type</option>',
            '<option value="created_at">Date Created</option>'
        ].join('');

        const conditionHTML = `
            <div class="condition-item" data-condition-id="${conditionId}">
                <input type="checkbox" class="condition-checkbox" checked data-condition-id="${conditionId}">
                <select class="condition-field" data-condition-id="${conditionId}">
                    ${fieldOptions}
                </select>
                <select class="condition-operator" data-condition-id="${conditionId}">
                    <option value="in">In (In Set)</option>
                    <option value="contains">Contains</option>
                    <option value="equals">Equals</option>
                    <option value="not_equals">Not Equals</option>
                    <option value="starts_with">Starts With</option>
                    <option value="ends_with">Ends With</option>
                    <option value="greater_than">Greater Than</option>
                    <option value="less_than">Less Than</option>
                </select>
                <input type="text" class="condition-value" placeholder="Expression" data-condition-id="${conditionId}">
                <button class="btn-remove-condition" onclick="databaseViewer.removeCondition('${conditionId}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', conditionHTML);

        this.queryConditions.push({
            id: conditionId,
            enabled: true,
            field: 'serial',
            operator: 'in',
            value: ''
        });

        const currentTotal = this.queryConditions.length;
        console.log(`✅ Added query condition: ${conditionId}`);
        console.log(`   Total conditions now: ${currentTotal}`);
        console.log(`   All condition IDs:`, this.queryConditions.map(c => c.id));

        // Reset the flag after a short delay
        setTimeout(() => {
            this._isAddingCondition = false;
        }, 100);
    },

    removeCondition(conditionId) {
        const conditionElement = document.querySelector(`[data-condition-id="${conditionId}"].condition-item`);
        if (conditionElement) {
            conditionElement.remove();
        }

        this.queryConditions = this.queryConditions.filter(c => c.id !== conditionId);
        console.log(`🗑️ Removed condition: ${conditionId}`);
    },

    runQuery() {
        console.log('🔍 Running query...', 'Total conditions:', this.queryConditions.length);
        console.log('📊 Current SFAF Data count:', this.currentSFAFData?.length || 0);

        // Collect condition values from UI
        this.queryConditions.forEach(condition => {
            const checkbox = document.querySelector(`.condition-checkbox[data-condition-id="${condition.id}"]`);
            const fieldSelect = document.querySelector(`.condition-field[data-condition-id="${condition.id}"]`);
            const operatorSelect = document.querySelector(`.condition-operator[data-condition-id="${condition.id}"]`);
            const valueInput = document.querySelector(`.condition-value[data-condition-id="${condition.id}"]`);

            if (checkbox) condition.enabled = checkbox.checked;
            if (fieldSelect) condition.field = fieldSelect.value;
            if (operatorSelect) condition.operator = operatorSelect.value;
            if (valueInput) condition.value = valueInput.value;

            console.log(`  Condition ${condition.id}:`, {
                enabled: condition.enabled,
                field: condition.field,
                operator: condition.operator,
                value: condition.value,
                valueLength: condition.value?.length
            });
        });

        // Filter only enabled conditions with non-empty values
        const enabledConditions = this.queryConditions.filter(c => {
            const hasValue = c.value && c.value.trim().length > 0;
            return c.enabled && hasValue;
        });

        console.log('📊 Enabled conditions with values:', enabledConditions.length);

        if (enabledConditions.length === 0) {
            alert('Please add at least one enabled condition with a value');
            return;
        }

        // Filter data
        console.log('🔍 Filtering records with', enabledConditions.length, 'conditions...');
        const filteredData = this.filterRecordsByQueries(this.currentSFAFData || [], enabledConditions);
        console.log('📊 Filtered results:', filteredData.length, 'records');

        // Sort data
        const sortField = document.getElementById('querySortField')?.value || 'created_at';
        const sortedData = this.sortQueryResults(filteredData, sortField, this.querySortOrder);

        // Store results
        this.queryResults = sortedData;

        // Render results
        console.log('🎨 Rendering query results...');
        this.renderQueryResults();
        this.updateQueryStats();

        console.log(`✅ Query executed: ${enabledConditions.length} conditions, ${sortedData.length} results`);
    },

    sortQueryResults(data, field, order) {
        return [...data].sort((a, b) => {
            const aVal = a[field] || '';
            const bVal = b[field] || '';

            if (order === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });
    },

    renderQueryResults() {
        const resultsGrid = document.getElementById('queryResultsGrid');
        const emptyState = document.getElementById('queryEmptyState');

        if (!this.queryResults || this.queryResults.length === 0) {
            if (resultsGrid) resultsGrid.style.display = 'none';
            if (emptyState) emptyState.style.display = 'flex';
            return;
        }

        if (resultsGrid) resultsGrid.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';

        const tableContainer = resultsGrid.querySelector('.table-container');
        if (tableContainer) {
            const tableHTML = this.generateQueryResultsTable(this.queryResults);
            tableContainer.innerHTML = tableHTML;
        }
    },

    generateQueryResultsTable(records) {
        if (!records || records.length === 0) return '';

        let html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th class="checkbox-col"><input type="checkbox" id="selectAllQueryCheckbox" title="Select All"></th>
                        <th>102 - Agency Serial</th>
                        <th>110 - Frequency</th>
                        <th>200 - Agency</th>
                        <th>300 - State/Country</th>
                        <th>301 - City/Location</th>
                        <th>115 - Power</th>
                        <th>Type</th>
                        <th>ID</th>
                    </tr>
                </thead>
                <tbody>
        `;

        records.forEach(record => {
            const recordId = record.marker_id || record.id;
            const isChecked = this.selectedItems.has(recordId) ? 'checked' : '';
            const escapedId = recordId.replace(/'/g, "\\'");
            const agencySerial = record.sfafFields?.field102 || record.serial || 'N/A';
            const frequency = record.sfafFields?.field110 || record.frequency || 'N/A';
            const agency = record.sfafFields?.field200 || record.agency || 'N/A';
            const stateCountry = record.sfafFields?.field300 || 'N/A';
            const cityLocation = record.sfafFields?.field301 || record.location || 'N/A';
            const power = record.sfafFields?.field115 || 'N/A';

            html += `
                <tr data-record-id="${recordId}">
                    <td class="checkbox-col">
                        <input type="checkbox" class="row-checkbox" value="${recordId}" ${isChecked}
                               data-record-id="${recordId}"
                               onchange="databaseViewer.toggleRowSelection('${escapedId}', this.checked)">
                    </td>
                    <td>${agencySerial}</td>
                    <td>${frequency}</td>
                    <td>${agency}</td>
                    <td>${stateCountry}</td>
                    <td>${cityLocation}</td>
                    <td>${power}</td>
                    <td><span class="badge badge-${record.marker_type || 'imported'}">${record.marker_type || 'imported'}</span></td>
                    <td>
                        <span class="text-muted" style="font-size: 11px;">${recordId || ''}</span>
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        return html;
    },

    clearQuery() {
        // Clear all conditions
        const container = document.getElementById('queryConditionsList');
        if (container) {
            container.innerHTML = '';
        }

        this.queryConditions = [];
        this.queryResults = [];

        // Reset sort order
        this.querySortOrder = 'asc';
        document.getElementById('sortAscBtn')?.classList.add('active');
        document.getElementById('sortDescBtn')?.classList.remove('active');

        // Clear results
        this.renderQueryResults();
        this.updateQueryStats();

        console.log('✅ Query cleared');
    },

    updateQueryStats() {
        const matchingCount = document.getElementById('queryMatchingCount');
        const totalCount = document.getElementById('queryTotalCount');

        if (matchingCount) {
            matchingCount.textContent = this.queryResults ? this.queryResults.length : 0;
        }

        if (totalCount) {
            totalCount.textContent = this.currentSFAFData ? this.currentSFAFData.length : 0;
        }
    }

});
