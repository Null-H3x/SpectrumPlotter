// db_viewer_sfaf_fields.js — SFAF field views, custom views, inline editing

Object.assign(DatabaseViewer.prototype, {

    renderSFAFFieldsView(sfafFields, fieldDefinitions) {
        if (!sfafFields || Object.keys(sfafFields).length === 0) {
            return `
            <div class="no-sfaf-fields">
                <div class="empty-state">
                    <i class="fas fa-file-alt"></i>
                    <h5>No SFAF Fields Defined</h5>
                    <p>This marker does not have any SFAF fields defined.</p>
                    <button class="btn btn-primary btn-sm" onclick="databaseViewer.editSFAFRecord('${this.currentRecordId}')">
                        <i class="fas fa-plus"></i> Add SFAF Fields
                    </button>
                </div>
            </div>
        `;
        }

        // Get current view configuration or use default
        const currentView = this.getCurrentFieldView();
        const sortedFilteredFields = this.getSortedFilteredFields(sfafFields, fieldDefinitions, currentView);

        return `
        <div class="sfaf-fields-horizontal-view">
            <!-- View Controls -->
            <div class="field-view-controls">
                <div class="view-selector-section">
                    <label>Field View:</label>
                    <select id="fieldViewSelector" class="view-selector" onchange="databaseViewer.changeFieldView(this.value)">
                        <option value="all">All Fields</option>
                        ${this.getCustomViews().map(view =>
            `<option value="${view.id}" ${view.id === currentView.id ? 'selected' : ''}>${view.name}</option>`
        ).join('')}
                    </select>
                    <button class="btn btn-sm btn-primary" onclick="databaseViewer.createCustomView()">
                        <i class="fas fa-plus"></i> New View
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="databaseViewer.editCurrentView()">
                        <i class="fas fa-edit"></i> Edit View
                    </button>
                </div>
                
                <div class="field-controls-section">
                    <div class="field-filter">
                        <label>Filter Fields:</label>
                        <input type="text" id="fieldFilter" placeholder="Search field names..." 
                               class="field-filter-input" onkeyup="databaseViewer.filterFields(this.value)">
                    </div>
                    
                    <div class="field-sort">
                        <label>Sort By:</label>
                        <select id="fieldSort" class="field-sort-select" onchange="databaseViewer.sortFields(this.value)">
                            <option value="number">Field Number</option>
                            <option value="name">Field Name</option>
                            <option value="value">Field Value</option>
                            <option value="custom">Custom Order</option>
                        </select>
                    </div>
                    
                    <div class="view-stats">
                        <span class="field-count">${sortedFilteredFields.length} fields shown</span>
                    </div>
                </div>
            </div>

            <!-- Horizontal Scrolling Field Container -->
            <div class="fields-horizontal-container">
                <div class="fields-scroll-wrapper">
                    <div class="horizontal-fields-grid" id="horizontalFieldsGrid">
                        ${sortedFilteredFields.map((field, index) => this.renderIndividualField(field, index)).join('')}
                    </div>
                </div>
                
                <!-- Scroll Navigation -->
                <div class="scroll-navigation">
                    <button class="scroll-btn scroll-left" onclick="databaseViewer.scrollFieldsLeft()">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <div class="scroll-indicator">
                        <span id="fieldScrollPosition">1-${Math.min(5, sortedFilteredFields.length)} of ${sortedFilteredFields.length}</span>
                    </div>
                    <button class="scroll-btn scroll-right" onclick="databaseViewer.scrollFieldsRight()">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>

            <!-- Field Management Panel -->
            <div class="field-management-panel" id="fieldManagementPanel" style="display: none;">
                <h5>Customize Field View</h5>
                <div class="available-fields-list" id="availableFieldsList">
                    <!-- Populated dynamically -->
                </div>
                <div class="field-order-controls">
                    <button class="btn btn-sm btn-secondary" onclick="databaseViewer.moveFieldUp()">↑ Move Up</button>
                    <button class="btn btn-sm btn-secondary" onclick="databaseViewer.moveFieldDown()">↓ Move Down</button>
                    <button class="btn btn-sm btn-danger" onclick="databaseViewer.removeFromView()">✕ Remove</button>
                </div>
            </div>

            <!-- MC4EB Compliance Summary -->
            ${this.renderMCEBComplianceSummary(sfafFields)}
        </div>
    `;
    },

    renderIndividualField(fieldInfo, index) {
        const { fieldId, fieldNumber, value, definition, occurrence, isRequired, isValid } = fieldInfo;

        return `
        <div class="field-card ${isRequired ? 'required-field' : ''} ${isValid ? 'valid-field' : 'invalid-field'}" 
             data-field-id="${fieldId}" data-field-number="${fieldNumber}">
            <div class="field-card-header">
                <div class="field-number-badge">
                    ${fieldNumber}${occurrence ? `/${occurrence}` : ''}
                </div>
                <div class="field-actions">
                    ${isRequired ? '<i class="fas fa-asterisk required-icon" title="Required Field"></i>' : ''}
                    ${isValid ?
                '<i class="fas fa-check-circle valid-icon" title="Valid"></i>' :
                '<i class="fas fa-exclamation-triangle invalid-icon" title="Invalid"></i>'
            }
                    <button class="field-action-btn" onclick="databaseViewer.editFieldInPlace('${fieldId}')" title="Edit Field">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </div>
            
            <div class="field-card-content">
                <div class="field-name">${this.getFieldLabel(fieldId)}</div>
                <div class="field-value ${this.getFieldValueClass(fieldId)}" title="${value}">
                    ${this.formatFieldValue(fieldId, value)}
                </div>
                ${definition?.description ? `<div class="field-description">${definition.description}</div>` : ''}
            </div>
        </div>
    `;
    },

    getSortedFilteredFields(sfafFields, fieldDefinitions, currentView) {
        // Extract all fields with metadata
        let allFields = Object.entries(sfafFields).map(([fieldId, value]) => {
            const fieldNumber = fieldId.replace('field', '').split('_')[0];
            const occurrence = fieldId.includes('_') ? fieldId.split('_')[1] : null;

            return {
                fieldId,
                fieldNumber,
                value: value.trim(),
                definition: fieldDefinitions?.[fieldId],
                occurrence,
                isRequired: this.isRequiredField(fieldId),
                isValid: this.validateFieldValue(fieldId, value)
            };
        });

        console.log('🔍 Total fields before filtering:', allFields.length);
        const fieldsWithValues = allFields.filter(field => field.value !== '');
        console.log('🔍 Fields with non-empty values:', fieldsWithValues.length);

        // CHANGED: Don't filter out empty fields, show all fields
        // This allows users to see which fields are missing data
        // allFields = allFields.filter(field => field.value !== '');

        // Apply current view filter if not "all"
        if (currentView.id !== 'all' && currentView.fields) {
            allFields = allFields.filter(field =>
                currentView.fields.includes(field.fieldId)
            );
        }

        // Apply text filter if active
        const filterText = document.getElementById('fieldFilter')?.value?.toLowerCase();
        if (filterText) {
            allFields = allFields.filter(field =>
                field.fieldId.toLowerCase().includes(filterText) ||
                this.getFieldLabel(field.fieldId).toLowerCase().includes(filterText) ||
                field.value.toLowerCase().includes(filterText)
            );
        }

        // Apply sorting
        const sortMode = document.getElementById('fieldSort')?.value || 'number';
        switch (sortMode) {
            case 'number':
                allFields.sort((a, b) => parseInt(a.fieldNumber) - parseInt(b.fieldNumber));
                break;
            case 'name':
                allFields.sort((a, b) => this.getFieldLabel(a.fieldId).localeCompare(this.getFieldLabel(b.fieldId)));
                break;
            case 'value':
                allFields.sort((a, b) => a.value.localeCompare(b.value));
                break;
            case 'custom':
                if (currentView.fieldOrder) {
                    allFields.sort((a, b) => {
                        const aIndex = currentView.fieldOrder.indexOf(a.fieldId);
                        const bIndex = currentView.fieldOrder.indexOf(b.fieldId);
                        return aIndex - bIndex;
                    });
                }
                break;
        }

        return allFields;
    },

    renderMCEBComplianceSummary(sfafFields) {
        const requiredFields = ['field005', 'field010', 'field102', 'field110', 'field200', 'field300'];
        const missingRequired = requiredFields.filter(field => !sfafFields[field] || !sfafFields[field].trim());

        const isCompliant = missingRequired.length === 0;
        const completionPercent = Math.round(((requiredFields.length - missingRequired.length) / requiredFields.length) * 100);

        return `
            <div class="mceb-compliance-summary">
                <h4>MC4EB Publication 7, Change 1 Compliance</h4>
                <div class="compliance-status ${isCompliant ? 'compliant' : 'non-compliant'}">
                    ${isCompliant ?
                        '<span class="status-icon">✓</span> Compliant - All required fields present' :
                        `<span class="status-icon">⚠</span> Non-compliant - ${missingRequired.length} required field(s) missing`
                    }
                </div>
                <div class="compliance-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${completionPercent}%"></div>
                    </div>
                    <span class="progress-text">${completionPercent}% Complete</span>
                </div>
                ${missingRequired.length > 0 ? `
                    <div class="missing-fields">
                        <strong>Missing Required Fields:</strong>
                        <ul>
                            ${missingRequired.map(field => `<li>${this.getFieldLabel(field)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
    },

    getCurrentFieldView() {
        return this.currentFieldView || {
            id: 'all',
            name: 'All Fields',
            fields: null,
            fieldOrder: null
        };
    },

    getCustomViews() {
        const saved = localStorage.getItem('sfafCustomViews');
        return saved ? JSON.parse(saved) : [];
    },

    getAllAvailableSFAFFields() {
        // Get all possible SFAF field keys (field005 through field999)
        const allFieldKeys = [];

        // Generate all field keys from 005-999
        for (let i = 5; i <= 999; i++) {
            const fieldKey = `field${String(i).padStart(3, '0')}`;
            allFieldKeys.push(fieldKey);
        }

        // Also collect any fields that exist in current data (in case of custom fields)
        if (this.currentSFAFData && this.currentSFAFData.length > 0) {
            this.currentSFAFData.forEach(record => {
                if (record.rawSFAFFields) {
                    Object.keys(record.rawSFAFFields).forEach(key => {
                        if (!allFieldKeys.includes(key)) {
                            allFieldKeys.push(key);
                        }
                    });
                }
            });
        }

        return allFieldKeys.sort();
    },

    createCustomView() {
        const viewName = prompt('Enter a name for your custom view:');
        if (!viewName || viewName.trim() === '') return;

        const allFields = this.getAllAvailableSFAFFields();

        this.showFieldSelectionModal({
            mode: 'create',
            viewName: viewName.trim(),
            availableFields: allFields,
            selectedFields: [],
            fieldOrder: []
        });
    },

    editCurrentView() {
        const currentView = this.getCurrentFieldView();
        if (currentView.id === 'all') {
            alert('Cannot edit the "All Fields" view. Create a custom view instead.');
            return;
        }

        const allFields = this.getAllAvailableSFAFFields();

        this.showFieldSelectionModal({
            mode: 'edit',
            viewId: currentView.id,
            viewName: currentView.name,
            availableFields: allFields,
            selectedFields: currentView.fields || [],
            fieldOrder: currentView.fieldOrder || []
        });
    },

    changeFieldView(viewId) {
        const views = this.getCustomViews();
        const selectedView = views.find(v => v.id === viewId) || {
            id: 'all',
            name: 'All Fields',
            fields: null,
            fieldOrder: null
        };

        this.currentFieldView = selectedView;

        // Save the selected view to session preferences
        this.sessionManager.updatePreference('lastFieldView', viewId);
        console.log(`💾 Saved field view preference: ${viewId}`);

        // Refresh the field display
        this.refreshFieldDisplay();
    },

    filterFields(filterText) {
        this.refreshFieldDisplay();
    },

    sortFields(sortMode) {
        this.refreshFieldDisplay();
    },

    scrollFieldsLeft() {
        const container = document.querySelector('.fields-scroll-wrapper');
        if (container) {
            container.scrollBy({ left: -300, behavior: 'smooth' });
            this.updateScrollIndicator();
        }
    },

    scrollFieldsRight() {
        const container = document.querySelector('.fields-scroll-wrapper');
        if (container) {
            container.scrollBy({ left: 300, behavior: 'smooth' });
            this.updateScrollIndicator();
        }
    },

    updateScrollIndicator() {
        const container = document.querySelector('.fields-scroll-wrapper');
        const indicator = document.getElementById('fieldScrollPosition');

        if (container && indicator) {
            const scrollLeft = container.scrollLeft;
            const scrollWidth = container.scrollWidth;
            const clientWidth = container.clientWidth;

            const scrollPercentage = scrollLeft / (scrollWidth - clientWidth);
            const totalFields = document.querySelectorAll('.field-card').length;
            const visibleFields = Math.floor(clientWidth / 280); // Approximate field width
            const startField = Math.floor(scrollPercentage * (totalFields - visibleFields)) + 1;
            const endField = Math.min(startField + visibleFields - 1, totalFields);

            indicator.textContent = `${startField}-${endField} of ${totalFields}`;
        }
    },

    refreshFieldDisplay() {
        // Reload the current record's field view
        if (this.currentSFAFData && this.currentSFAFData.length > 0) {
            const currentRecord = this.currentSFAFData[0]; // Or get the currently displayed record
            const fieldContainer = document.querySelector('.sfaf-fields-display');
            if (fieldContainer) {
                fieldContainer.innerHTML = this.renderSFAFFieldsView(
                    currentRecord.rawSFAFFields || {},
                    currentRecord.fieldDefinitions || {}
                );
            }
        }
    },

    editFieldInPlace(fieldId) {
        const fieldCard = document.querySelector(`[data-field-id="${fieldId}"]`);
        if (!fieldCard) return;

        const fieldValueElement = fieldCard.querySelector('.field-value');
        const currentValue = fieldValueElement.textContent;

        // Create inline editor
        fieldValueElement.innerHTML = `
        <input type="text" class="inline-field-editor" value="${currentValue}" 
               onblur="databaseViewer.saveInlineEdit('${fieldId}', this.value)"
               onkeypress="if(event.key==='Enter') this.blur()">
    `;

        // Focus the input
        const input = fieldValueElement.querySelector('.inline-field-editor');
        if (input) {
            input.focus();
            input.select();
        }
    },

    saveInlineEdit(fieldId, newValue) {
        // Update the field value in current data
        if (this.currentSFAFData && this.currentSFAFData.length > 0) {
            const currentRecord = this.currentSFAFData[0];
            if (currentRecord.rawSFAFFields) {
                currentRecord.rawSFAFFields[fieldId] = newValue;
            }
        }

        // Update the display
        const fieldCard = document.querySelector(`[data-field-id="${fieldId}"]`);
        if (fieldCard) {
            const fieldValueElement = fieldCard.querySelector('.field-value');
            fieldValueElement.innerHTML = this.formatFieldValue(fieldId, newValue);
        }

        // TODO: Save to backend
        this.saveSFAFChanges(this.currentRecordId);
    },

    generateFieldInputs(sfafFields, fieldList, required = false) {
        return fieldList.map(field => {
            const value = sfafFields[field] || '';
            return this.generateFieldInput(field, value, required);
        }).join('');
    },

    generateFieldInput(fieldId, value, required = false) {
        const fieldNumber = fieldId.replace('field', '');
        const fieldLabel = this.getFieldLabel(fieldId);
        const requiredAttr = required ? 'required' : '';
        const requiredClass = required ? 'required-field' : '';

        return `
        <div class="sfaf-field-row ${requiredClass}">
            <label for="${fieldId}">
                ${fieldLabel}
                ${required ? '<span class="required-asterisk">*</span>' : ''}
            </label>
            <input 
                type="text" 
                id="${fieldId}"
                name="${fieldId}" 
                value="${value}" 
                class="sfaf-field-input"
                ${requiredAttr}
                placeholder="Field ${fieldNumber}"
            >
            <small class="field-hint">${this.getFieldHint(fieldId)}</small>
        </div>
    `;
    },

    getFieldLabel(fieldId) {
        // Check user-editable field_labels.json first
        if (this.fieldLabels && this.fieldLabels[fieldId]) {
            return this.fieldLabels[fieldId];
        }
        const labels = {
            // Core identification
            'field005': 'Security Classification (005)',
            'field007': 'Missing Data Indicator (007)',
            'field010': 'Type of Action (010)',
            'field102': 'Agency Serial Number (102)',
            'field103': 'IRAC Docket Number (103)',

            // Emission characteristics
            'field110': 'Frequency(ies) (110)',
            'field111': 'Excluded Frequency Band (111)',
            'field113': 'Station Class (113)',
            'field114': 'Emission Designator (114)',
            'field115': 'Transmitter Power (115)',

            // Organizational information
            'field200': 'Agency (200)',
            'field201': 'Unified Command (201)',
            'field202': 'Unified Command Service (202)',
            'field203': 'Bureau (203)',

            // Transmitter location
            'field300': 'State/Country (300)',
            'field301': 'Antenna Location (301)',
            'field302': 'Station Control (302)',
            'field303': 'Antenna Coordinates (303)',
            'field306': 'Authorized Radius (306)',

            // Transmitter equipment
            'field340': 'Equipment Nomenclature (340)',

            // Receiver location (400 series is receiver, not frequency!)
            'field400': 'State/Country (Receiver) (400)',
            'field401': 'Antenna Location (Receiver) (401)',
            'field403': 'Antenna Coordinates (Receiver) (403)',

            // IRAC notes
            'field500': 'IRAC Notes (500)',
            'field530': 'Authorized Areas (530)'
        };

        return labels[fieldId] || fieldId.replace('field', 'Field ');
    },

    getFieldHint(fieldId) {
        const hints = {
            'field005': 'CLA = Classification (e.g., UNCLASS, FOUO)',
            'field010': 'TYP = Type of Action',
            'field102': 'SER = Agency Serial Number (e.g., AF 014589)',
            'field103': 'AUS = IRAC Docket Number',
            'field110': 'FRQ,FRU = Frequency(ies) in MHz',
            'field113': 'STC = Station Class (e.g., MO, ML, FA)',
            'field114': 'EMS = Emission Designator (e.g., 16K0F3E)',
            'field115': 'PWR = Transmitter Power in watts',
            'field200': 'Agency designation (6 chars)',
            'field201': 'Unified Command (8 chars)',
            'field202': 'Unified Command Service (8 chars)',
            'field203': 'BUR = Bureau code (4 chars)',
            'field300': 'XSC = State/Country (transmitter)',
            'field301': 'XAL = Antenna Location (24 chars)',
            'field303': 'XLA XLG = Antenna Coordinates (Lat/Long)',
            'field306': 'XRD = Authorization Radius in km',
            'field340': 'XEQ = Equipment Nomenclature',
            'field400': 'RSC = State/Country (receiver)',
            'field401': 'RAL = Antenna Location (receiver)',
            'field403': 'RLA RLG = Antenna Coordinates (receiver)',
            'field500': 'NTS = IRAC Notes',
            'field530': 'XAR,RAR,ARB = Authorized Areas'
        };

        return hints[fieldId] || 'Enter appropriate value for this field';
    },

    renderSFAFFieldsForEdit(sfafFields, fieldDefs) {
        if (!sfafFields || Object.keys(sfafFields).length === 0) {
            return '<div class="no-sfaf-fields"><p>No SFAF fields defined for this marker.</p></div>';
        }

        const fieldGroups = {
            '100': 'Agency Information',
            '200': 'System Information',
            '300': 'Location Information',
            '400': 'Technical Parameters',
            '500': 'Equipment Information',
            '600': 'Operational Information',
            '700': 'Coordination Information',
            '800': 'Administrative Contact Information',
            '900': 'Comments and Special Requirements'
        };

        let html = '<div class="sfaf-fields-section"><h4>SFAF Fields (MC4EB Publication 7, Change 1)</h4>';

        // Group fields by series (Source: services.txt field organization)
        const groupedFields = {};
        Object.entries(sfafFields).forEach(([fieldId, value]) => {
            const series = fieldId.replace('field', '').substring(0, 1);
            if (!groupedFields[series]) {
                groupedFields[series] = [];
            }
            groupedFields[series].push({ fieldId, value, definition: fieldDefs[fieldId] });
        });

        // Render each group
        Object.entries(groupedFields).forEach(([series, fields]) => {
            const groupName = fieldGroups[series + '00'] || `${series}00 Series`;
            html += `
                <div class="sfaf-field-group">
                    <h5>${groupName}</h5>
                    <div class="sfaf-field-grid">
            `;

            fields.forEach(({ fieldId, value, definition }) => {
                const label = definition ? definition.label : fieldId;
                const help = definition ? definition.help : '';
                const required = definition ? definition.required : false;
                const fieldType = definition ? definition.field_type : 'text';

                html += `
                    <div class="sfaf-field-item">
                        <label for="${fieldId}" ${required ? 'class="required"' : ''}>
                            ${label}
                            ${required ? '*' : ''}
                        </label>
                        ${this.renderSFAFFieldInput(fieldId, value, fieldType, definition)}
                        ${help ? `<small class="field-help">${help}</small>` : ''}
                    </div>
                `;
            });

            html += '</div></div>';
        });

        html += '</div>';
        return html;
    },

    renderSFAFFieldInput(fieldId, value, fieldType, definition) {
        switch (fieldType) {
            case 'select':
                const options = definition.options || [];
                return `
                    <select name="sfaf_${fieldId}" class="sfaf-field-input">
                        <option value="">Select...</option>
                        ${options.map(option =>
                    `<option value="${option}" ${value === option ? 'selected' : ''}>${option}</option>`
                ).join('')}
                    </select>
                `;

            case 'textarea':
                return `<textarea name="sfaf_${fieldId}" class="sfaf-field-input" rows="3">${value || ''}</textarea>`;

            case 'date':
                return `<input type="date" name="sfaf_${fieldId}" class="sfaf-field-input" value="${value || ''}">`;

            case 'number':
                return `<input type="number" name="sfaf_${fieldId}" class="sfaf-field-input" value="${value || ''}">`;

            case 'email':
                return `<input type="email" name="sfaf_${fieldId}" class="sfaf-field-input" value="${value || ''}">`;

            default:
                return `<input type="text" name="sfaf_${fieldId}" class="sfaf-field-input" value="${value || ''}">`;
        }
    },

    renderEditableSFAFFieldsView(sfafFields, recordId) {
        if (!sfafFields || Object.keys(sfafFields).length === 0) {
            return `
                <div class="no-sfaf-fields">
                    <div class="empty-state">
                        <i class="fas fa-file-alt"></i>
                        <h5>No SFAF Fields Defined</h5>
                        <p>This record does not have any SFAF fields defined.</p>
                    </div>
                </div>
            `;
        }

        // Sort field keys numerically
        const sortedFieldKeys = Object.keys(sfafFields).sort((a, b) => {
            const aNum = parseInt(a.replace('field', '').split('_')[0]);
            const bNum = parseInt(b.replace('field', '').split('_')[0]);
            return aNum - bNum;
        });

        return `
            <div class="editable-sfaf-fields">
                <div class="fields-grid">
                    ${sortedFieldKeys.map(fieldKey => {
                        const fieldNumber = fieldKey.replace('field', '');
                        const value = sfafFields[fieldKey] || '';
                        const fieldLabel = this.getFieldLabelFromNumber(fieldNumber);

                        return `
                            <div class="field-row editable-field" data-field-key="${fieldKey}">
                                <div class="field-label-col">
                                    <label for="edit_${fieldKey}">
                                        <span class="field-number">Field ${fieldNumber}:</span>
                                        <span class="field-name">${fieldLabel}</span>
                                    </label>
                                </div>
                                <div class="field-value-col">
                                    <input type="text"
                                           id="edit_${fieldKey}"
                                           name="${fieldKey}"
                                           value="${this.escapeHtml(value)}"
                                           class="field-input"
                                           data-field-key="${fieldKey}"
                                           placeholder="Enter value...">
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    },

    getFieldLabelFromNumber(fieldNumber) {
        const fieldLabels = {
            '005': 'Type of Application',
            '010': 'Type of Action',
            '102': 'Agency Serial Number',
            '110': 'Frequency',
            '113': 'Station Class',
            '114': 'Emission',
            '115': 'Power',
            '200': 'Agency',
            '300': 'Location',
            '301': 'Coordinates',
            '302': 'Radius',
            '500': 'Equipment Nomenclature',
            '501': 'Equipment Certification',
            '601': 'Remarks'
        };

        // Extract base field number (e.g., "500_01" -> "500")
        const baseNumber = fieldNumber.split('_')[0];
        return fieldLabels[baseNumber] || `Field ${fieldNumber}`;
    },

    showSFAFFieldModal(markerId, fieldData = {}) {
        const modalContent = `
        <div class="sfaf-field-modal-content">
            <h4>SFAF Field Editor</h4>
            <p class="modal-description">Edit SFAF fields according to MC4EB Publication 7, Change 1 standards</p>
            
            <form id="sfafFieldForm" class="sfaf-field-form">
                <!-- Required Fields Section (Source: db_viewer_js.txt MC4EB compliance) -->
                <div class="field-section required-fields">
                    <h5>Required Fields <span class="required-indicator">*</span></h5>
                    
                    <div class="field-group">
                        <label for="field005">Field 005 - Type of Application <span class="required">*</span></label>
                        <select id="field005" name="field005" required class="sfaf-field-input">
                            <option value="">Select Type</option>
                            <option value="UE" ${fieldData.field005 === 'UE' ? 'selected' : ''}>UE - Uncoordinated Equipment</option>
                            <option value="CE" ${fieldData.field005 === 'CE' ? 'selected' : ''}>CE - Coordinated Equipment</option>
                        </select>
                        <small class="field-hint">UE = Uncoordinated Equipment, CE = Coordinated Equipment</small>
                    </div>
                    
                    <div class="field-group">
                        <label for="field010">Field 010 - Type of Action <span class="required">*</span></label>
                        <select id="field010" name="field010" required class="sfaf-field-input">
                            <option value="">Select Action</option>
                            <option value="N" ${fieldData.field010 === 'N' ? 'selected' : ''}>N - New</option>
                            <option value="M" ${fieldData.field010 === 'M' ? 'selected' : ''}>M - Modification</option>
                            <option value="D" ${fieldData.field010 === 'D' ? 'selected' : ''}>D - Discontinue</option>
                        </select>
                        <small class="field-hint">N = New, M = Modification, D = Discontinue</small>
                    </div>
                    
                    <div class="field-group">
                        <label for="field102">Field 102 - Agency Serial Number <span class="required">*</span></label>
                        <input type="text" id="field102" name="field102" required 
                               value="${fieldData.field102 || ''}" 
                               pattern="[A-Z]{2,3}\\s+\\d{6,8}"
                               class="sfaf-field-input"
                               placeholder="e.g., AF 014589">
                        <small class="field-hint">Format: [Agency Code][Space][6-8 digits]</small>
                    </div>
                    
                    <div class="field-group">
                        <label for="field110">Field 110 - Frequency <span class="required">*</span></label>
                        <input type="text" id="field110" name="field110" required 
                               value="${fieldData.field110 || ''}"
                               class="sfaf-field-input"
                               placeholder="e.g., K4028(4026.5)">
                        <small class="field-hint">Format: K####(####.#) or numeric with units</small>
                    </div>
                    
                    <div class="field-group">
                        <label for="field200">Field 200 - Agency <span class="required">*</span></label>
                        <select id="field200" name="field200" required class="sfaf-field-input">
                            <option value="">Select Agency</option>
                            <option value="USAF" ${fieldData.field200 === 'USAF' ? 'selected' : ''}>USAF - U.S. Air Force</option>
                            <option value="USA" ${fieldData.field200 === 'USA' ? 'selected' : ''}>USA - U.S. Army</option>
                            <option value="USN" ${fieldData.field200 === 'USN' ? 'selected' : ''}>USN - U.S. Navy</option>
                            <option value="USMC" ${fieldData.field200 === 'USMC' ? 'selected' : ''}>USMC - U.S. Marine Corps</option>
                            <option value="USCG" ${fieldData.field200 === 'USCG' ? 'selected' : ''}>USCG - U.S. Coast Guard</option>
                        </select>
                        <small class="field-hint">Select the responsible military service</small>
                    </div>
                </div>
                
                <!-- Technical Parameters Section (Source: db_viewer_js.txt field definitions) -->
                <div class="field-section technical-fields">
                    <h5>Technical Parameters</h5>
                    
                    <div class="field-group">
                        <label for="field113">Field 113 - Station Class</label>
                        <select id="field113" name="field113" class="sfaf-field-input">
                            <option value="">Select Class</option>
                            <option value="MO" ${fieldData.field113 === 'MO' ? 'selected' : ''}>MO - Mobile</option>
                            <option value="ML" ${fieldData.field113 === 'ML' ? 'selected' : ''}>ML - Mobile Land</option>
                            <option value="FB" ${fieldData.field113 === 'FB' ? 'selected' : ''}>FB - Fixed Base</option>
                            <option value="FX" ${fieldData.field113 === 'FX' ? 'selected' : ''}>FX - Fixed</option>
                        </select>
                        <small class="field-hint">Station operational classification</small>
                    </div>
                    
                    <div class="field-group">
                        <label for="field114">Field 114 - Emission Designator</label>
                        <input type="text" id="field114" name="field114" 
                               value="${fieldData.field114 || ''}"
                               pattern="\\d+[KMG]?\\d*[A-Z]\\d*[A-Z]?"
                               class="sfaf-field-input"
                               placeholder="e.g., 2K70J3E">
                        <small class="field-hint">Format: Bandwidth + Emission Class + Modulation</small>
                    </div>
                    
                    <div class="field-group">
                        <label for="field115">Field 115 - Transmitter Power</label>
                        <input type="text" id="field115" name="field115" 
                               value="${fieldData.field115 || ''}"
                               pattern="W\\d+"
                               class="sfaf-field-input"
                               placeholder="e.g., W500">
                        <small class="field-hint">Format: W### (watts)</small>
                    </div>
                </div>
                
                <!-- Location Information Section -->
                <div class="field-section location-fields">
                    <h5>Location Information</h5>
                    
                    <div class="field-group">
                        <label for="field300">Field 300 - State/Country</label>
                        <input type="text" id="field300" name="field300" 
                               value="${fieldData.field300 || ''}"
                               maxlength="2"
                               class="sfaf-field-input"
                               placeholder="e.g., FL">
                        <small class="field-hint">Two-letter state/country code</small>
                    </div>
                    
                    <div class="field-group">
                        <label for="field301">Field 301 - Location Description</label>
                        <input type="text" id="field301" name="field301" 
                               value="${fieldData.field301 || ''}"
                               class="sfaf-field-input"
                               placeholder="e.g., HURLBURT">
                        <small class="field-hint">Base or installation name</small>
                    </div>
                </div>
                
                <!-- Compliance Information -->
                <div class="field-section compliance-info">
                    <h5>MC4EB Publication 7, Change 1 Compliance Status</h5>
                    <div class="compliance-status-display">
                        <div class="compliance-indicator" id="complianceIndicator">
                            <i class="fas fa-clock"></i> Validation pending...
                        </div>
                        <div class="field-count-display">
                            <span>Required fields completed: <strong id="requiredFieldCount">0/5</strong></span>
                            <span>Optional fields completed: <strong id="optionalFieldCount">0/6</strong></span>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    `;

        const footerButtons = `
        <button type="button" class="btn btn-secondary" onclick="databaseViewer.closeModal()">
            <i class="fas fa-times"></i> Cancel
        </button>
        <button type="button" class="btn btn-info" onclick="databaseViewer.validateSFAFFormRealTime()">
            <i class="fas fa-check-circle"></i> Validate
        </button>
        <button type="submit" form="sfafFieldForm" class="btn btn-primary">
            <i class="fas fa-save"></i> Save SFAF Fields
        </button>
    `;

        // Show modal with SFAF-specific content
        this.showModal('SFAF Field Editor', modalContent, footerButtons);

        // Add real-time validation (Source: db_viewer_js.txt validation)
        this.addSFAFFormValidation();

        // Store marker ID for form submission (Source: main_go.txt SFAF routes)
        const modal = document.getElementById('editModal');
        if (modal) {
            modal.dataset.markerId = markerId;
        }

        // Initialize compliance status display
        this.updateFormComplianceStatus();

        console.log(`📋 SFAF Field Editor opened for marker: ${markerId}`);
    },

    addNewSFAFRecord() {
        // This would open a modal or redirect to a form for creating a new SFAF record
        console.log('Opening new SFAF record form...');

        // Show modal with empty SFAF form
        const modal = document.getElementById('editModal');
        if (modal) {
            const modalTitle = document.getElementById('modalTitle');
            if (modalTitle) {
                modalTitle.textContent = 'Add New SFAF Record';
            }

            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = `
                    <form id="newSFAFForm">
                        <p>New SFAF record form would go here.</p>
                        <p>This would include all required SFAF fields according to MC4EB Publication 7, Change 1.</p>
                    </form>
                `;
            }

            modal.style.display = 'flex';
        }
    },

    async saveAllSFAFFieldChanges(recordId) {
        try {
            console.log(`💾 Saving all SFAF field changes for record: ${recordId}`);

            // Collect all field values from inputs
            const fieldInputs = document.querySelectorAll('.field-input[data-field-key]');
            const sfafFields = {};

            fieldInputs.forEach(input => {
                const fieldKey = input.dataset.fieldKey;
                const value = input.value.trim();
                if (value !== '') {
                    sfafFields[fieldKey] = value;
                }
            });

            console.log('📤 Submitting SFAF field updates:', sfafFields);

            if (Object.keys(sfafFields).length === 0) {
                this.showWarning('No fields to save');
                return;
            }

            // Show loading state
            this.showLoading(true, 'Saving SFAF changes...');

            // Save changes via API
            const response = await fetch(`/api/sfaf/marker/${recordId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    marker_id: recordId,
                    sfaf_fields: sfafFields,
                    updated_by: 'database_viewer',
                    update_timestamp: new Date().toISOString()
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorData}`);
            }

            const result = await response.json();

            if (result.success) {
                this.showSuccess('SFAF changes saved successfully');

                // Refresh the SFAF records display to show updated data
                await this.loadSFAFRecords();

                console.log('✅ SFAF changes saved successfully');
            } else {
                throw new Error(result.error || 'Failed to save SFAF changes');
            }

        } catch (error) {
            console.error('❌ Failed to save SFAF changes:', error);
            this.showError(`Failed to save changes: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

});
