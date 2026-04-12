// db_viewer_sfaf_records.js — SFAF record edit/view/export, form generation, modals

Object.assign(DatabaseViewer.prototype, {

    editSFAFRecord(recordId) {
        try {
            console.log(`📝 Opening SFAF editor for record: ${recordId}`);

            // Find the record in current data
            const record = this.currentSFAFData?.find(r => r.id === recordId);
            if (!record) {
                this.showError('Record not found');
                return;
            }

            // Create modal content for SFAF editing
            const modalContent = this.generateSFAFEditForm(record);
            this.showModal('Edit SFAF Record', modalContent, '');

        } catch (error) {
            console.error('Failed to open SFAF editor:', error);
            this.showError('Failed to open SFAF editor');
        }
    },

    viewSFAFRecord(recordId) {
        try {
            console.log(`👀 Viewing SFAF record: ${recordId}`);

            // Find the record in current data
            const record = this.currentSFAFData?.find(r => r.id === recordId);
            if (!record) {
                this.showError('Record not found');
                return;
            }

            // Create modal content for viewing
            const modalContent = this.generateSFAFViewContent(record);
            this.showModal('SFAF Record Details', modalContent, '');

        } catch (error) {
            console.error('Failed to view SFAF record:', error);
            this.showError('Failed to view SFAF record');
        }
    },

    exportSFAFRecord(recordId) {
        try {
            console.log(`📤 Exporting SFAF record: ${recordId}`);

            // Find the record in current data
            const record = this.currentSFAFData?.find(r => r.id === recordId);
            if (!record) {
                this.showError('Record not found');
                return;
            }

            // Generate SFAF export format
            const sfafText = this.generateSFAFExport(record);
            this.downloadFile(`SFAF_${record.serial || recordId}.txt`, sfafText);

        } catch (error) {
            console.error('Failed to export SFAF record:', error);
            this.showError('Failed to export SFAF record');
        }
    },

    generateSFAFEditForm(record) {
        return `
        <div class="sfaf-edit-form">
            <h4>SFAF Fields for ${record.serial}</h4>
            <div class="sfaf-fields-editor">
                ${Object.entries(record.rawSFAFFields || {}).map(([field, value]) => `
                    <div class="sfaf-field-row">
                        <label>${field}:</label>
                        <input type="text" name="${field}" value="${value}" class="sfaf-field-input">
                    </div>
                `).join('')}
            </div>
            <div class="form-actions">
                <button class="btn btn-primary" onclick="databaseViewer.saveSFAFChanges('${record.id}')">Save Changes</button>
                <button class="btn btn-secondary" onclick="databaseViewer.closeModal()">Cancel</button>
            </div>
        </div>
    `;
    },

    openEditModal(data, type) {
        const modal = document.getElementById('editModal');
        const modalTitle = document.getElementById('modalTitle');
        const editForm = document.getElementById('editForm');

        modalTitle.textContent = `Edit ${type === 'marker' ? 'Marker' : 'SFAF'}: ${data.marker.serial}`;

        // Create comprehensive edit form leveraging all available data (Source: models.txt)
        editForm.innerHTML = `
            <div class="form-grid">
                <div class="form-group">
                    <label>Serial Number:</label>
                    <input type="text" name="serial" value="${data.marker.serial}" readonly>
                </div>
                <div class="form-group">
                    <label>Latitude:</label>
                    <input type="number" step="any" name="lat" value="${data.marker.lat}" required>
                </div>
                <div class="form-group">
                    <label>Longitude:</label>
                    <input type="number" step="any" name="lng" value="${data.marker.lng}" required>
                </div>
                <div class="form-group">
                    <label>Frequency:</label>
                    <input type="text" name="frequency" value="${data.marker.frequency || ''}">
                </div>
                <div class="form-group">
                    <label>Type:</label>
                    <select name="type">
                        <option value="manual" ${data.marker.type === 'manual' ? 'selected' : ''}>Manual</option>
                        <option value="imported" ${data.marker.type === 'imported' ? 'selected' : ''}>Imported</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Draggable:</label>
                    <select name="is_draggable">
                        <option value="true" ${data.marker.is_draggable ? 'selected' : ''}>Yes</option>
                        <option value="false" ${!data.marker.is_draggable ? 'selected' : ''}>No</option>
                    </select>
                </div>
                <div class="form-group full-width">
                    <label>Notes:</label>
                    <textarea name="notes" rows="3">${data.marker.notes || ''}</textarea>
                </div>
            </div>
            
            <!-- SFAF Fields Section (Source: services.txt field definitions) -->
            ${type === 'marker' && data.sfaf_fields ? this.renderSFAFFieldsForEdit(data.sfaf_fields, data.field_defs) : ''}
            
            <!-- Coordinate Information Display (Source: handlers.txt coordinate formats) -->
            <div class="coordinate-info-section">
                <h4>Coordinate Formats</h4>
                <div class="coord-display">
                    <div class="coord-item">
                        <label>Decimal:</label>
                        <span class="coord-value">${data.coordinates.decimal}</span>
                    </div>
                    <div class="coord-item">
                        <label>DMS:</label>
                        <span class="coord-value">${data.coordinates.dms}</span>
                    </div>
                    <div class="coord-item">
                        <label>Compact (Military):</label>
                        <span class="coord-value">${data.coordinates.compact}</span>
                    </div>
                </div>
            </div>
            
            <!-- IRAC Notes Section (Source: handlers.txt IRAC integration) -->
            ${data.marker.irac_notes && data.marker.irac_notes.length > 0 ? this.renderIRACNotesForEdit(data.marker.irac_notes) : ''}
        `;

        // Show modal
        modal.style.display = 'block';

        // Handle form submission
        editForm.onsubmit = async (e) => {
            e.preventDefault();
            await this.saveMarkerChanges(data.marker.id, new FormData(e.target));
            this.closeModal();
        };
    },

    openViewModal(data) {
        const modal = document.getElementById('editModal');
        const modalTitle = document.getElementById('modalTitle');
        const editForm = document.getElementById('editForm');

        modalTitle.textContent = `View Marker: ${data.marker.serial}`;

        // Create read-only view with comprehensive data display
        editForm.innerHTML = `
            <div class="view-mode-content">
                <!-- Basic Marker Information -->
                <div class="info-section">
                    <h4>Marker Information</h4>
                    <div class="info-grid">
                        <div class="info-item">
                            <label>Serial Number:</label>
                            <span>${data.marker.serial}</span>
                        </div>
                        <div class="info-item">
                            <label>Type:</label>
                            <span class="status-indicator status-${data.marker.type}">${data.marker.type}</span>
                        </div>
                        <div class="info-item">
                            <label>Frequency:</label>
                            <span>${data.marker.frequency || 'Not specified'}</span>
                        </div>
                        <div class="info-item">
                            <label>Draggable:</label>
                            <span>${data.marker.is_draggable ? 'Yes' : 'No'}</span>
                        </div>
                        <div class="info-item">
                            <label>Created:</label>
                            <span>${new Date(data.marker.created_at).toLocaleString()}</span>
                        </div>
                        <div class="info-item">
                            <label>Updated:</label>
                            <span>${new Date(data.marker.updated_at).toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <!-- Coordinate Information -->
                <div class="info-section">
                    <h4>Coordinate Information</h4>
                    <div class="coordinate-formats">
                        <div class="coord-format">
                            <label>Decimal Degrees:</label>
                            <span class="coord-value">${data.coordinates.decimal}</span>
                        </div>
                        <div class="coord-format">
                            <label>DMS Format:</label>
                            <span class="coord-value">${data.coordinates.dms}</span>
                        </div>
                        <div class="coord-format">
                            <label>Military Compact:</label>
                            <span class="coord-value">${data.coordinates.compact}</span>
                        </div>
                    </div>
                </div>

                <!-- Notes Section -->
                ${data.marker.notes ? `
                    <div class="info-section">
                        <h4>Notes</h4>
                        <div class="notes-content">${data.marker.notes}</div>
                    </div>
                ` : ''}

                <!-- SFAF Fields Display -->
                ${data.sfaf_fields && Object.keys(data.sfaf_fields).length > 0 ? this.renderSFAFFieldsView(data.sfaf_fields, data.field_defs) : ''}

                <!-- IRAC Notes Display -->
                ${data.marker.irac_notes && data.marker.irac_notes.length > 0 ? this.renderIRACNotesView(data.marker.irac_notes) : ''}
            </div>
        `;

        // Change modal footer for view mode
        const modalFooter = modal.querySelector('.modal-footer');
        modalFooter.innerHTML = `
            <button type="button" class="btn btn-secondary" onclick="databaseViewer.closeModal()">Close</button>
            <button type="button" class="btn btn-primary" onclick="databaseViewer.editMarker('${data.marker.id}')">
                <i class="fas fa-edit"></i> Edit Marker
            </button>
        `;

        modal.style.display = 'block';
    },

    generateSFAFViewContent(record) {
        // Store current record ID for saving
        this.currentEditingRecordId = record.id;

        return `
        <div class="sfaf-view-content">
            <div class="record-header">
                <h4>${record.serial} - ${record.agency}</h4>
                <p>
                    <strong>Frequency:</strong> ${record.frequency} |
                    <strong>Location:</strong> ${record.location}
                </p>
                <div class="status-indicators">
                    <span class="completion-badge">Completion: ${record.completionPercentage || 0}%</span>
                    <span class="compliance-badge ${record.mcebCompliant?.isCompliant ? 'compliant' : 'non-compliant'}">
                        ${record.mcebCompliant?.isCompliant ? '✅ MC4EB Compliant' : '⚠️ Issues Found'}
                    </span>
                </div>
            </div>

            <div class="sfaf-fields-display">
                <h5>SFAF Fields <span style="font-size: 14px; color: #a78bfa; font-weight: normal;">(Click any field to edit)</span></h5>
                ${this.renderEditableSFAFFieldsView(record.rawSFAFFields || {}, record.id)}
            </div>
            
            ${record.iracNotes && record.iracNotes.length > 0 ? `
                <div class="irac-notes-section">
                    ${this.renderIRACNotesView(record.iracNotes)}
                </div>
            ` : ''}
            
            <div class="record-metadata">
                <h5>Technical Details</h5>
                <div class="metadata-grid">
                    <div class="metadata-item">
                        <label>Coordinates:</label>
                        <span>${record.coordinates?.decimal || 'Not Available'}</span>
                    </div>
                    <div class="metadata-item">
                        <label>DMS Format:</label>
                        <span>${record.coordinates?.dms || 'Not Available'}</span>
                    </div>
                    <div class="metadata-item">
                        <label>Compact Format:</label>
                        <span>${record.coordinates?.compact || 'Not Available'}</span>
                    </div>
                    <div class="metadata-item">
                        <label>Marker Type:</label>
                        <span>${record.markerType || 'Unknown'}</span>
                    </div>
                    <div class="metadata-item">
                        <label>Station Class:</label>
                        <span>${record.stationClass || 'Not Specified'}</span>
                    </div>
                    <div class="metadata-item">
                        <label>Emission:</label>
                        <span>${record.emission || 'Not Specified'}</span>
                    </div>
                    <div class="metadata-item">
                        <label>Power:</label>
                        <span>${record.power || 'Not Specified'}</span>
                    </div>
                    <div class="metadata-item">
                        <label>Created:</label>
                        <span>${record.createdAt ? new Date(record.createdAt).toLocaleString() : 'Unknown'}</span>
                    </div>
                    <div class="metadata-item">
                        <label>Last Updated:</label>
                        <span>${record.updatedAt ? new Date(record.updatedAt).toLocaleString() : 'Unknown'}</span>
                    </div>
                    <div class="metadata-item">
                        <label>SFAF Fields Count:</label>
                        <span>${record.sfafFieldCount || 0}</span>
                    </div>
                </div>
            </div>

            ${record.validationStatus && !record.validationStatus.isValid ? `
                <div class="validation-issues">
                    <h5>⚠️ Validation Issues</h5>
                    <div class="validation-errors">
                        ${record.validationStatus.errors?.map(error => `
                            <div class="validation-error">
                                <i class="fas fa-exclamation-triangle"></i>
                                ${error}
                            </div>
                        `).join('') || 'No specific errors available'}
                    </div>
                </div>
            ` : ''}

            ${record.mcebCompliant && !record.mcebCompliant.isCompliant ? `
                <div class="compliance-issues">
                    <h5>⚠️ MC4EB Compliance Issues</h5>
                    <div class="compliance-errors">
                        ${record.mcebCompliant.issues?.map(issue => `
                            <div class="compliance-error">
                                <i class="fas fa-balance-scale"></i>
                                ${issue}
                            </div>
                        `).join('') || 'Compliance issues detected but details unavailable'}
                    </div>
                    <div class="compliance-note">
                        <small>Issues must be resolved for MC4EB Publication 7, Change 1 compliance</small>
                    </div>
                </div>
            ` : ''}

            ${record.equipment && record.equipment.length > 0 ? `
                <div class="equipment-section">
                    <h5>📡 Equipment Information</h5>
                    <div class="equipment-list">
                        ${record.equipment.map(equip => `
                            <div class="equipment-item">
                                <div class="equipment-type">${equip.type}</div>
                                <div class="equipment-details">
                                    <div><strong>Nomenclature:</strong> ${equip.nomenclature}</div>
                                    <div><strong>Certification ID:</strong> ${equip.certificationId}</div>
                                    ${equip.power ? `<div><strong>Power:</strong> ${equip.power}</div>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            ${record.antennaInfo ? `
                <div class="antenna-section">
                    <h5>📶 Antenna Information</h5>
                    <div class="antenna-grid">
                        <div class="antenna-group">
                            <h6>Transmitter Antenna</h6>
                            <div class="antenna-details">
                                <div><strong>Gain:</strong> ${record.antennaInfo.transmitter?.gain || 'Not specified'}</div>
                                <div><strong>Height:</strong> ${record.antennaInfo.transmitter?.height || 'Not specified'}</div>
                                <div><strong>Orientation:</strong> ${record.antennaInfo.transmitter?.orientation || 'Not specified'}</div>
                                <div><strong>Polarization:</strong> ${record.antennaInfo.transmitter?.polarization || 'Not specified'}</div>
                            </div>
                        </div>
                        <div class="antenna-group">
                            <h6>Receiver Antenna</h6>
                            <div class="antenna-details">
                                <div><strong>Gain:</strong> ${record.antennaInfo.receiver?.gain || 'Not specified'}</div>
                                <div><strong>Height:</strong> ${record.antennaInfo.receiver?.height || 'Not specified'}</div>
                                <div><strong>Orientation:</strong> ${record.antennaInfo.receiver?.orientation || 'Not specified'}</div>
                                <div><strong>Polarization:</strong> ${record.antennaInfo.receiver?.polarization || 'Not specified'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            ` : ''}

            <div class="record-actions">
                <h5>Actions</h5>
                <div class="action-buttons">
                    <button class="btn btn-primary" onclick="databaseViewer.saveAllSFAFFieldChanges('${record.id}')">
                        <i class="fas fa-save"></i> Save All Changes
                    </button>
                    <button class="btn btn-success" onclick="databaseViewer.exportSFAFRecord('${record.id}')">
                        <i class="fas fa-download"></i> Export SFAF
                    </button>
                    <button class="btn btn-info" onclick="databaseViewer.validateSFAFRecord('${record.id}')">
                        <i class="fas fa-check-circle"></i> Validate Compliance
                    </button>
                    ${record.coordinates?.lat && record.coordinates?.lng ? `
                        <button class="btn btn-secondary" onclick="databaseViewer.viewRecordOnMap('${record.id}')">
                            <i class="fas fa-map-marker-alt"></i> View on Map
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    },

    generateSFAFExport(record) {
        const lines = [];
        const sfafFields = record.rawSFAFFields || {};

        // Sort field keys to maintain proper SFAF field order
        const sortedFieldKeys = Object.keys(sfafFields).sort((a, b) => {
            const aNum = parseInt(a.replace('field', '').split('_')[0]);
            const bNum = parseInt(b.replace('field', '').split('_')[0]);
            return aNum - bNum;
        });

        // Generate SFAF header comment
        lines.push(`=== SFAF Export for ${record.serial} ===`);
        lines.push(`Generated: ${new Date().toISOString()}`);
        lines.push(`Source: SFAF Plotter Database Viewer`);
        lines.push(`MC4EB Publication 7, Change 1 Format`);
        lines.push('');

        // Generate SFAF field lines
        sortedFieldKeys.forEach(fieldKey => {
            const value = sfafFields[fieldKey];
            if (value && value.trim() !== '') {
                // Extract field number and occurrence from key (e.g., field500_02 -> 500/02)
                const match = fieldKey.match(/field(\d+)(?:_(\d+))?/);
                if (match) {
                    const fieldNumber = match[1];
                    const occurrence = match[2];

                    if (occurrence) {
                        lines.push(`${fieldNumber}/${occurrence}. ${value}`);
                    } else {
                        lines.push(`${fieldNumber}. ${value}`);
                    }
                }
            }
        });

        lines.push(''); // Empty line to separate records
        return lines.join('\n');
    },

    saveSFAFChanges(recordId) {
        try {
            console.log(`💾 Saving SFAF changes for record: ${recordId}`);

            // Collect SFAF field values from all input fields in the modal
            const sfafFields = {};
            const modalContent = document.querySelector('.sfaf-edit-form');

            if (!modalContent) {
                throw new Error('Edit form not found in modal');
            }

            // Find all SFAF field inputs
            const fieldInputs = modalContent.querySelectorAll('input[id^="field"]');
            console.log(`📋 Found ${fieldInputs.length} field inputs`);

            fieldInputs.forEach(input => {
                const fieldId = input.id;
                const value = input.value.trim();
                if (value !== '') {
                    sfafFields[fieldId] = value;
                }
            });

            console.log(`📤 Collected ${Object.keys(sfafFields).length} non-empty fields:`, sfafFields);

            // Validate required fields before saving
            const validation = this.validateSFAFFormData(sfafFields);
            if (!validation.isValid) {
                this.showError(`Validation failed: ${validation.errors.join(', ')}`);
                return;
            }

            // Show loading state
            this.showLoading(true, 'Saving SFAF changes...');

            // Save changes via API (Source: main_go.txt SFAF routes)
            fetch(`/api/sfaf/marker/${recordId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    marker_id: recordId,
                    sfaf_fields: sfafFields,
                    updated_by: 'database_viewer',
                    update_timestamp: new Date().toISOString()
                })
            })
                .then(async response => {
                    if (!response.ok) {
                        const errorData = await response.text();
                        throw new Error(`HTTP ${response.status}: ${errorData}`);
                    }
                    return response.json();
                })
                .then(result => {
                    if (result.success) {
                        this.showSuccess('SFAF changes saved successfully');
                        this.closeModal();

                        // Refresh the SFAF records display to show updated data
                        this.loadSFAFRecords();

                        console.log('✅ SFAF changes saved successfully');
                    } else {
                        throw new Error(result.error || 'Failed to save SFAF changes');
                    }
                })
                .catch(error => {
                    console.error('❌ Failed to save SFAF changes:', error);
                    this.showError(`Failed to save changes: ${error.message}`);
                })
                .finally(() => {
                    this.showLoading(false);
                });

        } catch (error) {
            console.error('❌ Error in saveSFAFChanges:', error);
            this.showError('Failed to save SFAF changes');
            this.showLoading(false);
        }
    },

    validateSFAFRecord(recordId) {
        try {
            console.log(`🔍 Validating SFAF record: ${recordId}`);

            // Find the record in current data
            const record = this.currentSFAFData?.find(r => r.id === recordId);
            if (!record) {
                this.showError('Record not found for validation');
                return;
            }

            // Perform comprehensive validation
            const validation = this.performSFAFValidation(record.rawSFAFFields || {}, record.fieldDefinitions || {});
            const mcebCompliance = this.checkMCEBCompliance(record.rawSFAFFields || {}, record.fieldDefinitions || {});

            // Show validation results in modal
            const validationContent = `
            <div class="validation-results">
                <h4>SFAF Validation Results for ${record.serial}</h4>
                
                <div class="validation-summary">
                    <div class="validation-status ${validation.isValid ? 'valid' : 'invalid'}">
                        ${validation.isValid ? '✅ All validations passed' : '❌ Validation issues found'}
                    </div>
                    <div class="compliance-status ${mcebCompliance.isCompliant ? 'compliant' : 'non-compliant'}">
                        ${mcebCompliance.isCompliant ? '✅ MC4EB Publication 7, Change 1 Compliant' : '⚠️ MC4EB Compliance Issues'}
                    </div>
                </div>

                ${validation.errors && validation.errors.length > 0 ? `
                    <div class="validation-errors">
                        <h5>Validation Errors</h5>
                        <ul>
                            ${validation.errors.map(error => `<li>${error}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                ${validation.warnings && validation.warnings.length > 0 ? `
                    <div class="validation-warnings">
                        <h5>Validation Warnings</h5>
                        <ul>
                            ${validation.warnings.map(warning => `<li>${warning}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                ${mcebCompliance.issues && mcebCompliance.issues.length > 0 ? `
                    <div class="compliance-issues">
                        <h5>MC4EB Compliance Issues</h5>
                        <ul>
                            ${mcebCompliance.issues.map(issue => `<li>${issue}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                <div class="validation-summary-stats">
                    <div class="stat-item">
                        <label>Completion Percentage:</label>
                        <span>${record.completionPercentage || 0}%</span>
                    </div>
                    <div class="stat-item">
                        <label>Total SFAF Fields:</label>
                        <span>${record.sfafFieldCount || 0}</span>
                    </div>
                    <div class="stat-item">
                        <label>Validation Date:</label>
                        <span>${new Date().toLocaleString()}</span>
                    </div>
                </div>
            </div>
        `;

            this.showModal('SFAF Validation Results', validationContent, '');

        } catch (error) {
            console.error('Failed to validate SFAF record:', error);
            this.showError('Failed to validate SFAF record');
        }
    }

},

    async editSFAF(markerId) {
        try {
            const response = await fetch(`/api/sfaf/object-data/${markerId}`);
            const data = await response.json();

            if (data.success) {
                this.openSFAFEditModal(data);
            } else {
                throw new Error(data.error || 'Failed to load SFAF data');
            }
        } catch (error) {
            console.error('Failed to load SFAF for editing:', error);
            this.showError('Failed to load SFAF data for editing');
        }
    }

});
