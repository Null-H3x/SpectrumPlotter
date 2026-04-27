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
                            <option value="equals">= (Begins With)</option>
                            <option value="exact_equals">== (Exactly Equals)</option>
                            <option value="not_equals">&lt;&gt; (Not Equal / Does Not Begin With)</option>
                            <option value="less_than">&lt; (Less Than)</option>
                            <option value="greater_than">&gt; (Greater Than)</option>
                            <option value="less_than_eq">&lt;= (Less Than or Equals)</option>
                            <option value="greater_than_eq">&gt;= (Greater Than or Equals)</option>
                            <option value="in">In (In Set — comma-separated begins-with)</option>
                            <option value="between">.. (Between — use value1..value2)</option>
                            <option value="contained_in">$ (Contained In — field within expr)</option>
                            <option value="contains">$$ (Contains — field contains expr)</option>
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

    async applyDBFilters() {
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

        // Fetch all records if we only have the current page loaded
        const total = this.totalDatabaseRecords || 0;
        if ((this.currentSFAFData || []).length < total) {
            this.showLoading(true);
            try {
                this.currentSFAFData = await this._fetchAllSFAFRecords();
            } catch (e) {
                console.error('Failed to fetch all records:', e);
                this.showLoading(false);
                return;
            }
            this.showLoading(false);
        }

        const filteredData = this.filterRecordsByQueries(this.currentSFAFData || []);

        this.currentData = filteredData;
        this.currentPage = 1;
        // Store filtered results so pagination stays within them (not server-side)
        this._activeQueryResults = filteredData;
        this._queryActive = true;
        this._queryFilteredTotal = filteredData.length;
        const pageSlice = filteredData.slice(0, this.itemsPerPage);
        this.renderEnhancedSFAFTable(pageSlice);
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

        // Split conditions into AND groups separated by OR connectors
        const buildGroups = (queries) => {
            const groups = [];
            let current = [];
            queries.forEach((q, idx) => {
                if (idx > 0 && q.connector === 'or') {
                    groups.push(current);
                    current = [];
                }
                current.push(q);
            });
            if (current.length > 0) groups.push(current);
            return groups;
        };

        const groups = buildGroups(filterQueries);

        const testCondition = (record, query) => {
                if (!query.field || (query.operator !== 'exact_equals' && !query.value)) {
                    return true; // Skip empty queries
                }

                const fieldValue = this.getRecordFieldValue(record, query.field);
                const queryValue = (query.value || '').toLowerCase();
                const recordValue = String(fieldValue || '').toLowerCase();

                console.log(`  Checking record ${record.id || record.serial}:`, {
                    field: query.field,
                    operator: query.operator,
                    recordValue: recordValue,
                    queryValue: queryValue
                });

                let result = false;
                switch (query.operator) {
                    case 'equals':
                        // = : field begins with the expression (SXXI default)
                        result = recordValue.startsWith(queryValue);
                        break;
                    case 'exact_equals':
                        // == : exact match; empty expression matches blank fields
                        result = queryValue === '' ? recordValue === '' : recordValue === queryValue;
                        break;
                    case 'not_equals':
                        // <> : field does NOT begin with the expression
                        result = !recordValue.startsWith(queryValue);
                        break;
                    case 'less_than': {
                        // < : alphabetically/numerically less than
                        const aLT = parseFloat(recordValue);
                        const bLT = parseFloat(queryValue);
                        result = isNaN(aLT) || isNaN(bLT) ? recordValue < queryValue : aLT < bLT;
                        break;
                    }
                    case 'greater_than': {
                        // > : alphabetically/numerically greater than
                        const aGT = parseFloat(recordValue);
                        const bGT = parseFloat(queryValue);
                        result = isNaN(aGT) || isNaN(bGT) ? recordValue > queryValue : aGT > bGT;
                        break;
                    }
                    case 'less_than_eq': {
                        // <= : less than or equal
                        const aLTE = parseFloat(recordValue);
                        const bLTE = parseFloat(queryValue);
                        result = isNaN(aLTE) || isNaN(bLTE) ? recordValue <= queryValue : aLTE <= bLTE;
                        break;
                    }
                    case 'greater_than_eq': {
                        // >= : greater than or equal
                        const aGTE = parseFloat(recordValue);
                        const bGTE = parseFloat(queryValue);
                        result = isNaN(aGTE) || isNaN(bGTE) ? recordValue >= queryValue : aGTE >= bGTE;
                        break;
                    }
                    case 'in': {
                        // In : comma-separated list; record begins with any entry
                        const setValues = queryValue.split(',').map(v => v.trim());
                        result = setValues.some(v => recordValue.startsWith(v));
                        break;
                    }
                    case 'between': {
                        // .. : expression is "low..high"; record must be >= low and <= high
                        const parts = queryValue.split('..');
                        if (parts.length === 2) {
                            const low = parts[0].trim();
                            const high = parts[1].trim();
                            const loNum = parseFloat(low);
                            const hiNum = parseFloat(high);
                            const recNum = parseFloat(recordValue);
                            if (!isNaN(loNum) && !isNaN(hiNum) && !isNaN(recNum)) {
                                result = recNum >= loNum && recNum <= hiNum;
                            } else {
                                result = recordValue >= low && recordValue <= high;
                            }
                        } else {
                            result = false;
                        }
                        break;
                    }
                    case 'contained_in': {
                        // $ : comma-separated expressions; match if ANY entry contains the field value
                        const ciEntries = queryValue.split(',').map(v => v.trim());
                        result = ciEntries.some(entry => entry.includes(recordValue));
                        break;
                    }
                    case 'contains': {
                        // $$ : field contains any of the comma-separated expressions
                        const cExprs = queryValue.split(',').map(v => v.trim());
                        result = cExprs.some(expr => recordValue.includes(expr));
                        break;
                    }
                    default:
                        result = true;
                }

                if (query.negate) result = !result;
                return result;
        };

        const filtered = records.filter(record => {
            // Record passes if ANY OR-group passes (group = all its AND conditions must pass)
            return groups.some(group => group.every(query => testCondition(record, query)));
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

        // Clear query state and go back to server-side pagination
        this._queryActive = false;
        this._activeQueryResults = null;
        this._queryFilteredTotal = null;
        this.currentPage = 1;
        this.loadSFAFRecords();
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
                    if (operatorSelect) operatorSelect.value = 'equals';  // begins with
                    if (valueInput) valueInput.value = 'K';
                    break;
                case 'vhf':
                    if (fieldSelect) fieldSelect.value = 'frequency';
                    if (operatorSelect) operatorSelect.value = 'equals';  // begins with
                    if (valueInput) valueInput.value = 'M';
                    break;
                case 'uhf':
                    if (fieldSelect) fieldSelect.value = 'frequency';
                    if (operatorSelect) operatorSelect.value = 'contains';  // $ contains
                    if (valueInput) valueInput.value = 'M';
                    break;
                case 'imported':
                    if (fieldSelect) fieldSelect.value = 'marker_type';
                    if (operatorSelect) operatorSelect.value = 'exact_equals';
                    if (valueInput) valueInput.value = 'imported';
                    break;
                case 'manual':
                    if (fieldSelect) fieldSelect.value = 'marker_type';
                    if (operatorSelect) operatorSelect.value = 'exact_equals';
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
            '<option value="sfaf_record_type">Record Type (A/P/S/T)</option>',
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

        const isFirst = this.queryConditions.length === 0;
        const conditionHTML = `
            <div class="condition-item" data-condition-id="${conditionId}">
                <select class="condition-connector" data-condition-id="${conditionId}" style="${isFirst ? 'visibility:hidden' : ''}">
                    <option value="and">AND</option>
                    <option value="or">OR</option>
                </select>
                <input type="checkbox" class="condition-checkbox" checked data-condition-id="${conditionId}">
                <select class="condition-field" data-condition-id="${conditionId}">
                    ${fieldOptions}
                </select>
                <select class="condition-operator" data-condition-id="${conditionId}">
                    <option value="equals">= (Begins With)</option>
                    <option value="exact_equals">== (Exactly Equals)</option>
                    <option value="not_equals">&lt;&gt; (Not Equal / Does Not Begin With)</option>
                    <option value="less_than">&lt; (Less Than)</option>
                    <option value="greater_than">&gt; (Greater Than)</option>
                    <option value="less_than_eq">&lt;= (Less Than or Equals)</option>
                    <option value="greater_than_eq">&gt;= (Greater Than or Equals)</option>
                    <option value="in">In (In Set — comma-separated begins-with)</option>
                    <option value="between">.. (Between — use value1..value2)</option>
                    <option value="contained_in">$ (Contained In — field within expr)</option>
                    <option value="contains">$$ (Contains — field contains expr)</option>
                </select>
                <label class="condition-not-label" title="Negate this condition">
                    <input type="checkbox" class="condition-negate" data-condition-id="${conditionId}">
                    <span>Not</span>
                </label>
                <input type="text" class="condition-value" placeholder="Expression" data-condition-id="${conditionId}">
                <button class="btn-remove-condition" onclick="databaseViewer.removeCondition('${conditionId}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', conditionHTML);

        this.queryConditions.push({
            id: conditionId,
            connector: 'and',
            enabled: true,
            negate: false,
            field: 'field110',
            operator: 'equals',
            value: ''
        });

        this._isAddingCondition = false;
    },

    removeCondition(conditionId) {
        const conditionElement = document.querySelector(`[data-condition-id="${conditionId}"].condition-item`);
        if (conditionElement) {
            conditionElement.remove();
        }

        this.queryConditions = this.queryConditions.filter(c => c.id !== conditionId);

        // Always keep at least one condition row
        if (this.queryConditions.length === 0) {
            this.addQueryCondition();
        } else {
            // Ensure the first row's connector is hidden
            const firstId = this.queryConditions[0].id;
            const firstConnector = document.querySelector(`.condition-connector[data-condition-id="${firstId}"]`);
            if (firstConnector) firstConnector.style.visibility = 'hidden';
        }
    },

    restoreQueryState() {
        // No-op stub — query builder state is not persisted across sessions.
        // This method must exist so init() does not crash before addQueryCondition() runs.
    },

    // ── Query History ────────────────────────────────────────────────────────

    _queryHistoryKey: 'sfaf_plotter_query_history',
    _queryHistoryMax: 25,

    _getQueryHistory() {
        try { return JSON.parse(localStorage.getItem(this._queryHistoryKey) || '[]'); }
        catch (_) { return []; }
    },

    _saveToQueryHistory(queries, matchCount) {
        if (!queries || queries.length === 0) return;
        const entry = {
            id: `qh_${Date.now()}`,
            timestamp: new Date().toISOString(),
            matchCount,
            conditions: queries.map(q => ({ field: q.field, operator: q.operator, value: q.value, connector: q.connector || 'and', negate: q.negate || false })),
        };
        const history = this._getQueryHistory();
        const last = history[0];
        if (last && JSON.stringify(last.conditions) === JSON.stringify(entry.conditions)) return;
        history.unshift(entry);
        if (history.length > this._queryHistoryMax) history.length = this._queryHistoryMax;
        try { localStorage.setItem(this._queryHistoryKey, JSON.stringify(history)); } catch (_) {}
        this.renderQueryHistory();
    },

    renderQueryHistory() {
        const list = document.getElementById('queryHistoryList');
        if (!list) return;
        const history = this._getQueryHistory();
        if (history.length === 0) {
            list.innerHTML = '<div style="padding:16px;text-align:center;color:#607d8b;font-size:0.8rem;font-style:italic;">No history yet</div>';
            return;
        }
        list.innerHTML = history.map(entry => {
            const date = new Date(entry.timestamp);
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
            const summary = entry.conditions.map(c =>
                `<span style="font-size:0.72rem;color:#94a3b8;">${c.field} <em>${(c.operator||'').replace('_',' ')}</em> <strong style="color:#c4b5fd;">${c.value}</strong></span>`
            ).join('<br>');
            return `
                <div class="query-history-entry" onclick="databaseViewer.loadQueryFromHistory('${entry.id}')"
                     style="padding:8px 12px;border-bottom:1px solid rgba(102,126,234,0.08);cursor:pointer;transition:background 0.15s;position:relative;"
                     onmouseover="this.style.background='rgba(102,126,234,0.1)'" onmouseout="this.style.background=''">
                    <button onclick="event.stopPropagation();databaseViewer.removeQueryFromHistory('${entry.id}')"
                            title="Remove from history"
                            style="position:absolute;top:6px;right:6px;background:none;border:none;cursor:pointer;color:#ef4444;font-size:0.7rem;line-height:1;padding:2px 4px;border-radius:3px;opacity:0.6;transition:opacity 0.15s;"
                            onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">✕</button>
                    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;padding-right:18px;">
                        <span style="font-size:0.72rem;color:#64748b;">${dateStr} ${timeStr}</span>
                        <span style="font-size:0.72rem;background:rgba(167,139,250,0.15);color:#a78bfa;border-radius:10px;padding:1px 7px;">${entry.matchCount} results</span>
                    </div>
                    ${summary}
                </div>`;
        }).join('');
    },

    loadQueryFromHistory(entryId) {
        const history = this._getQueryHistory();
        const entry = history.find(h => h.id === entryId);
        if (!entry) return;
        const container = document.getElementById('queryConditionsList');
        if (!container) return;
        container.innerHTML = '';
        this.queryConditions = [];
        entry.conditions.forEach(c => {
            this.addQueryCondition();
            const last = this.queryConditions[this.queryConditions.length - 1];
            if (!last) return;
            const allFields     = container.querySelectorAll('.condition-field');
            const allOps        = container.querySelectorAll('.condition-operator');
            const allVals       = container.querySelectorAll('.condition-value');
            const allNegates    = container.querySelectorAll('.condition-negate');
            const allConnectors = container.querySelectorAll('.condition-connector');
            const idx = allFields.length - 1;
            if (allFields[idx])     allFields[idx].value      = c.field    || '';
            if (allOps[idx])        allOps[idx].value         = c.operator || 'equals';
            if (allVals[idx])       allVals[idx].value        = c.value    || '';
            if (allNegates[idx])    allNegates[idx].checked   = c.negate   || false;
            if (allConnectors[idx]) allConnectors[idx].value  = c.connector || 'and';
            last.field     = c.field;
            last.operator  = c.operator;
            last.value     = c.value;
            last.negate    = c.negate    || false;
            last.connector = c.connector || 'and';
        });
    },

    clearQueryHistory() {
        if (!confirm('Clear all query history?')) return;
        localStorage.removeItem(this._queryHistoryKey);
        this.renderQueryHistory();
    },

    removeQueryFromHistory(entryId) {
        const history = this._getQueryHistory().filter(h => h.id !== entryId);
        try { localStorage.setItem(this._queryHistoryKey, JSON.stringify(history)); } catch (_) {}
        this.renderQueryHistory();
    },

    // ── Saved Query Library ──────────────────────────────────────────────────

    _savedQueriesKey: 'sfaf_plotter_saved_queries',

    _getSavedQueries() {
        try { return JSON.parse(localStorage.getItem(this._savedQueriesKey) || '[]'); }
        catch (_) { return []; }
    },

    saveQueryToLibrary() {
        const conditions = (this.queryConditions || []).map(c => {
            const fieldSel     = document.querySelector(`.condition-field[data-condition-id="${c.id}"]`);
            const opSel        = document.querySelector(`.condition-operator[data-condition-id="${c.id}"]`);
            const valInp       = document.querySelector(`.condition-value[data-condition-id="${c.id}"]`);
            const negateBox    = document.querySelector(`.condition-negate[data-condition-id="${c.id}"]`);
            const connectorSel = document.querySelector(`.condition-connector[data-condition-id="${c.id}"]`);
            return {
                field:     fieldSel     ? fieldSel.value        : c.field,
                operator:  opSel        ? opSel.value           : c.operator,
                value:     valInp       ? valInp.value          : c.value,
                enabled:   c.enabled    !== false,
                negate:    negateBox    ? negateBox.checked     : (c.negate || false),
                connector: connectorSel ? connectorSel.value    : (c.connector || 'and'),
            };
        }).filter(c => c.field && c.value);

        if (conditions.length === 0) {
            alert('Add at least one condition with a field and value before saving.');
            return;
        }
        const name = prompt('Name this query:');
        if (!name || !name.trim()) return;
        const sortField = document.getElementById('querySortField')?.value || 'created_at';
        const entry = {
            id: `sq_${Date.now()}`,
            name: name.trim(),
            savedAt: new Date().toISOString(),
            conditions,
            sortField,
            sortOrder: this.querySortOrder || 'asc',
        };
        const saved = this._getSavedQueries();
        saved.unshift(entry);
        try { localStorage.setItem(this._savedQueriesKey, JSON.stringify(saved)); } catch (_) {}
        this.renderSavedQueries();
        this._flashBtn('saveQueryBtn', 'Saved!');
    },

    renderSavedQueries() {
        const list = document.getElementById('savedQueriesList');
        if (!list) return;
        const saved = this._getSavedQueries();
        if (saved.length === 0) {
            list.innerHTML = '<div style="padding:16px;text-align:center;color:#607d8b;font-size:0.8rem;font-style:italic;">No saved queries</div>';
            return;
        }
        list.innerHTML = saved.map(entry => `
                <div style="padding:6px 12px;border-bottom:1px solid rgba(96,165,250,0.08);display:flex;align-items:center;gap:6px;">
                    <span style="flex:1;font-size:0.8rem;font-weight:600;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                          title="${this.escapeHtml(entry.name)}">${this.escapeHtml(entry.name)}</span>
                    <button title="Load query"
                            onclick="databaseViewer.loadSavedQuery('${entry.id}')"
                            style="background:rgba(96,165,250,0.15);border:none;color:#60a5fa;cursor:pointer;border-radius:4px;padding:2px 7px;font-size:0.72rem;">
                        Load
                    </button>
                    <button title="Delete saved query"
                            onclick="databaseViewer.deleteSavedQuery('${entry.id}')"
                            style="background:rgba(248,113,113,0.1);border:none;color:#f87171;cursor:pointer;border-radius:4px;padding:2px 6px;font-size:0.72rem;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>`
        ).join('');
    },

    loadSavedQuery(id) {
        const entry = this._getSavedQueries().find(q => q.id === id);
        if (!entry) return;
        const container = document.getElementById('queryConditionsList');
        if (!container) return;
        container.innerHTML = '';
        this.queryConditions = [];
        entry.conditions.forEach(c => {
            this.addQueryCondition();
            const last = this.queryConditions[this.queryConditions.length - 1];
            if (!last) return;
            const allFields     = container.querySelectorAll('.condition-field');
            const allOps        = container.querySelectorAll('.condition-operator');
            const allVals       = container.querySelectorAll('.condition-value');
            const allNegates    = container.querySelectorAll('.condition-negate');
            const allConnectors = container.querySelectorAll('.condition-connector');
            const idx = allFields.length - 1;
            if (allFields[idx])     { allFields[idx].value     = c.field    || ''; allFields[idx].dataset.conditionId     = last.id; }
            if (allOps[idx])        { allOps[idx].value        = c.operator || 'equals'; allOps[idx].dataset.conditionId  = last.id; }
            if (allVals[idx])       { allVals[idx].value       = c.value    || ''; allVals[idx].dataset.conditionId       = last.id; }
            if (allNegates[idx])    { allNegates[idx].checked  = c.negate   || false; allNegates[idx].dataset.conditionId = last.id; }
            if (allConnectors[idx]) { allConnectors[idx].value = c.connector || 'and'; }
            last.field     = c.field;
            last.operator  = c.operator;
            last.value     = c.value;
            last.enabled   = c.enabled !== false;
            last.negate    = c.negate    || false;
            last.connector = c.connector || 'and';
        });
        const sortFieldEl = document.getElementById('querySortField');
        if (sortFieldEl && entry.sortField) sortFieldEl.value = entry.sortField;
        if (entry.sortOrder === 'desc') {
            document.getElementById('sortDescBtn')?.classList.add('active');
            document.getElementById('sortAscBtn')?.classList.remove('active');
            this.querySortOrder = 'desc';
        } else {
            document.getElementById('sortAscBtn')?.classList.add('active');
            document.getElementById('sortDescBtn')?.classList.remove('active');
            this.querySortOrder = 'asc';
        }
    },

    deleteSavedQuery(id) {
        const saved = this._getSavedQueries().filter(q => q.id !== id);
        try { localStorage.setItem(this._savedQueriesKey, JSON.stringify(saved)); } catch (_) {}
        this.renderSavedQueries();
    },

    _flashBtn(btnId, text) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        const original = btn.innerHTML;
        btn.innerHTML = `<i class="fas fa-check"></i> ${text}`;
        btn.disabled = true;
        setTimeout(() => { btn.innerHTML = original; btn.disabled = false; }, 1500);
    },

    async runQuery() {
        // Collect condition values from UI
        this.queryConditions.forEach(condition => {
            const connectorSelect = document.querySelector(`.condition-connector[data-condition-id="${condition.id}"]`);
            const checkbox        = document.querySelector(`.condition-checkbox[data-condition-id="${condition.id}"]`);
            const fieldSelect     = document.querySelector(`.condition-field[data-condition-id="${condition.id}"]`);
            const operatorSelect  = document.querySelector(`.condition-operator[data-condition-id="${condition.id}"]`);
            const valueInput      = document.querySelector(`.condition-value[data-condition-id="${condition.id}"]`);
            const negateBox       = document.querySelector(`.condition-negate[data-condition-id="${condition.id}"]`);

            if (connectorSelect) condition.connector = connectorSelect.value;
            if (checkbox)        condition.enabled   = checkbox.checked;
            if (fieldSelect)     condition.field     = fieldSelect.value;
            if (operatorSelect)  condition.operator  = operatorSelect.value;
            if (valueInput)      condition.value     = valueInput.value;
            if (negateBox)       condition.negate    = negateBox.checked;
        });

        const enabledConditions = this.queryConditions.filter(c => {
            if (!c.enabled) return false;
            if (c.operator === 'exact_equals') return true;
            return c.value && c.value.trim().length > 0;
        });

        if (enabledConditions.length === 0) {
            alert('Please add at least one enabled condition with a value');
            return;
        }

        const sortField = document.getElementById('querySortField')?.value || 'created_at';

        // ── Try server-side query first ───────────────────────────────────────
        // The "contained_in" ($) operator has no SQL equivalent; fall back to
        // client-side for any query that uses it.
        const needsClientSide = enabledConditions.some(c => c.operator === 'contained_in');

        if (!needsClientSide) {
            this.showLoading(true);
            try {
                const res = await fetch('/api/sfaf/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        conditions:  enabledConditions,
                        sort_field:  sortField,
                        sort_order:  this.querySortOrder || 'asc',
                        max_results: 5000,
                    }),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        // Enhance raw SFAF records into the same format as _fetchAllSFAFRecords
                        const enhanced = (data.sfafs || []).map(sfaf => {
                            const sfafFields = {};
                            Object.keys(sfaf).forEach(key => {
                                if (/^[Ff]ield\d+$/.test(key)) sfafFields[key.toLowerCase()] = sfaf[key];
                            });
                            return {
                                id: sfaf.id,
                                serial: sfafFields.field102 || sfaf.id,
                                sfafFields,
                                rawSFAFFields: sfafFields,
                                frequency: sfafFields.field110 || '',
                                emission:  sfafFields.field114 || '',
                                power:     sfafFields.field115 || '',
                                completionPercentage: this.calculateCompletionPercentage?.(sfafFields) ?? 0,
                                mcebCompliant:        this.validateMCEBCompliance?.(sfafFields)        ?? false,
                                marker: sfaf.marker || null,
                            };
                        });

                        this.queryResults = enhanced;
                        this._queryHasRun = true;
                        this.renderQueryResults();
                        this.updateQueryStats();
                        this._saveToQueryHistory(enabledConditions, enhanced.length);
                        this.showLoading(false);
                        console.log(`✅ Server-side query: ${enabledConditions.length} conditions → ${enhanced.length} of ${data.total} results`);
                        return;
                    }
                }
            } catch (e) {
                console.warn('Server-side query failed, falling back to client-side:', e);
            }
            this.showLoading(false);
        }

        // ── Client-side fallback ──────────────────────────────────────────────
        // Used for "contained_in" operator or if the API call failed.
        // Refused for large datasets to avoid loading the browser with hundreds of MB.
        const total = this.totalDatabaseRecords || 0;
        if (total > 10000 && (this.currentSFAFData || []).length < total) {
            alert(`Client-side filtering is unavailable for ${total.toLocaleString()} records.\n\nThe "contained_in" ($) operator is not supported at this scale. Use "contains" ($$) instead, which runs server-side.`);
            return;
        }
        if ((this.currentSFAFData || []).length < total) {
            this.showLoading(true);
            try {
                this.currentSFAFData = await this._fetchAllSFAFRecords();
            } catch (e) {
                console.error('Failed to fetch all records for client-side query:', e);
                this.showLoading(false);
                return;
            }
            this.showLoading(false);
        }

        const filteredData = this.filterRecordsByQueries(this.currentSFAFData || [], enabledConditions);
        const sortedData   = this.sortQueryResults(filteredData, sortField, this.querySortOrder);

        this.queryResults  = sortedData;
        this._queryHasRun  = true;
        this.renderQueryResults();
        this.updateQueryStats();
        this._saveToQueryHistory(enabledConditions, sortedData.length);
        console.log(`✅ Client-side query: ${enabledConditions.length} conditions → ${sortedData.length} results`);
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

    clearQueryResults() {
        this._queryHasRun = false;
        this.queryResults = null;
        const sfafGrid  = document.getElementById('sfafDataGrid');
        const sfafPagination = document.getElementById('sfafMainPagination');
        const resultsSection = document.getElementById('queryResultsSection');
        const historyPanel = document.getElementById('queryHistoryPanel');
        if (sfafGrid) sfafGrid.style.display = '';
        if (sfafPagination) sfafPagination.style.display = '';
        if (resultsSection) resultsSection.style.display = 'none';
        if (historyPanel) historyPanel.style.display = 'none';
        this.loadSFAFRecords?.();
    },

    toggleQueryHistory() {
        const panel = document.getElementById('queryHistoryPanel');
        if (!panel) return;
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    },

    renderQueryResults() {
        const resultsSection = document.getElementById('queryResultsSection');
        const resultsGrid = document.getElementById('queryResultsGrid');
        const emptyState = document.getElementById('queryEmptyState');
        const sfafGrid = document.getElementById('sfafDataGrid');
        const sfafPagination = document.getElementById('sfafMainPagination');

        // Show condition summary so the user can verify what was filtered
        const summaryEl = document.getElementById('queryConditionsSummary');
        if (summaryEl && this.queryConditions && this.queryConditions.length > 0) {
            const parts = this.queryConditions
                .filter(c => c.enabled && c.value)
                .map((c, i) => {
                    const connector = i > 0 ? `<strong style="color:#f59e0b">${(c.connector || 'and').toUpperCase()}</strong> ` : '';
                    const neg = c.negate ? 'NOT ' : '';
                    return `${connector}${neg}${c.field} ${c.operator} "${c.value}"`;
                });
            summaryEl.innerHTML = parts.length ? `<i class="fas fa-filter"></i> ${parts.join(' ')}` : '';
        }

        if (!this.queryResults || this.queryResults.length === 0) {
            if (resultsSection) resultsSection.style.display = 'block';
            if (resultsGrid) resultsGrid.style.display = 'none';
            if (emptyState) emptyState.style.display = 'flex';
            if (sfafGrid) sfafGrid.style.display = 'none';
            if (sfafPagination) sfafPagination.style.display = 'none';
            return;
        }

        if (resultsSection) resultsSection.style.display = 'block';
        if (resultsGrid) resultsGrid.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';
        if (sfafGrid) sfafGrid.style.display = 'none';
        if (sfafPagination) sfafPagination.style.display = 'none';

        const tableContainer = resultsGrid.querySelector('.table-container');
        if (tableContainer) {
            const tableHTML = this.generateQueryResultsTable(this.queryResults);
            tableContainer.innerHTML = tableHTML;

            // Re-attach select-all listener after innerHTML rebuild
            const selectAll = tableContainer.querySelector('#selectAllCheckbox');
            if (selectAll) {
                selectAll.addEventListener('change', () => {
                    const checked = selectAll.checked;
                    tableContainer.querySelectorAll('.row-checkbox').forEach(cb => {
                        cb.checked = checked;
                        const recordId = cb.value;
                        if (checked) {
                            this.selectedItems.add(recordId);
                        } else {
                            this.selectedItems.delete(recordId);
                        }
                    });
                    this.updateSelectionUI();
                });
            }
        }
    },

    generateQueryResultsTable(records) {
        if (!records || records.length === 0) return '';

        // Use the same view/headers as the main SFAF table so the user sees
        // the same columns (Summary, Technical, All Fields, custom views, etc.)
        const headers = this.getHeadersForView(this.currentView || 'summary');

        const headerHTML = `
            <tr class="header-row">
                ${headers.map(h => `<th data-field="${h.field}" class="${h.class || ''}">
                    <div class="header-content"><span class="header-label">${h.label}</span></div>
                </th>`).join('')}
            </tr>`;

        const rowsHTML = records.map(record => {
            const isChecked = this.selectedItems.has(record.id) ? 'checked' : '';
            if (this.currentView === 'spreadsheet') {
                return this.renderSpreadsheetRow(record, headers, isChecked);
            }
            return this.renderGenericRow(record, headers, isChecked);
        }).join('');

        return `<table class="data-table sfaf-records-table">
            <thead>${headerHTML}</thead>
            <tbody>${rowsHTML}</tbody>
        </table>`;
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

    // Silently prefetch all records in the background so the client-side fallback is instant.
    // Only runs for small datasets (≤10K records) — large datasets rely on server-side queries.
    _prefetchAllRecordsInBackground() {
        const total = this.totalDatabaseRecords || 0;
        if (this._prefetchInProgress) return;
        if ((this.currentSFAFData || []).length >= total) return;
        if (total > 10000) {
            console.log(`ℹ️ ${total} records — skipping background prefetch, server-side queries only`);
            return;
        }
        this._prefetchInProgress = true;
        this._fetchAllSFAFRecords()
            .then(records => {
                this.currentSFAFData = records;
                console.log(`✅ Background prefetch complete: ${records.length} records cached`);
            })
            .catch(e => console.warn('Background prefetch failed (non-critical):', e))
            .finally(() => { this._prefetchInProgress = false; });
    },

    async _fetchAllSFAFRecords() {
        const pageSize = 1000;
        let page = 1;
        let allSFAFs = [];
        let total = null;

        do {
            const res = await fetch(`/api/sfaf?page=${page}&limit=${pageSize}`);
            if (!res.ok) throw new Error(`SFAF API failed: ${res.status}`);
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Failed to load records');

            allSFAFs = allSFAFs.concat(data.sfafs || []);
            if (total === null) {
                total = data.pagination?.total || data.sfafs?.length || 0;
                this.totalDatabaseRecords = total;
            }
            page++;
        } while (allSFAFs.length < total);

        const enhanced = [];
        for (const sfaf of allSFAFs) {
            try {
                // Extract sfafFields the same way loadSFAFRecords does —
                // fields live as flat keys on the sfaf object (field005, field110…)
                const sfafFields = {};
                Object.keys(sfaf).forEach(key => {
                    if (key.match(/^[Ff]ield\d+$/)) {
                        sfafFields[key.toLowerCase()] = sfaf[key];
                    }
                });
                enhanced.push({
                    id: sfaf.id,
                    serial: sfafFields.field102 || sfaf.serial_number || sfaf.id,
                    sfafFields,
                    rawSFAFFields: sfafFields,
                    frequency: sfafFields.field110 || '',
                    emission: sfafFields.field114 || '',
                    power: sfafFields.field115 || '',
                    completionPercentage: this.calculateCompletionPercentage?.(sfafFields) ?? 0,
                    mcebCompliant: this.validateMCEBCompliance?.(sfafFields) ?? false,
                    marker: sfaf.marker || null,
                });
            } catch (_) { /* skip bad records */ }
        }
        return enhanced;
    },

    updateQueryStats() {
        const matchingCount = document.getElementById('queryMatchingCount');
        const totalCount = document.getElementById('queryTotalCount');

        // Only show stats after a query has been run
        if (!this._queryHasRun) return;

        if (matchingCount) {
            matchingCount.textContent = this.queryResults ? this.queryResults.length : 0;
        }

        if (totalCount) {
            totalCount.textContent = this.totalDatabaseRecords || (this.currentSFAFData ? this.currentSFAFData.length : 0);
        }
    },

    async loadFieldLabels() {
        try {
            const response = await fetch('/js/field_labels.json');
            if (response.ok) {
                this.fieldLabels = await response.json();
            }
        } catch (e) {
            console.warn('field_labels.json not found, using built-in defaults');
        }
        if (!this.fieldLabels) this.fieldLabels = {};
    }

});
