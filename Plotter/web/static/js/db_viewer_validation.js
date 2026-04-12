// db_viewer_validation.js — SFAF data processing, field validation, MCEB compliance

Object.assign(DatabaseViewer.prototype, {

    isRequiredField(fieldId) {
        const requiredFields = [
            'field005', 'field010', 'field102', 'field110',
            'field200', 'field300'
        ];
        return requiredFields.includes(fieldId);
    },

    validateFieldValue(fieldId, value) {
        if (!value || value.trim() === '') {
            return !this.isRequiredField(fieldId);
        }
        return true;
    },

    formatFieldValue(fieldId, value) {
        if (!value || value.trim() === '') {
            return '<span class="empty-value">Not Specified</span>';
        }

        // Special formatting for specific fields
        if (fieldId === 'field110') { // Frequency
            return `<span class="frequency-value">${value}</span>`;
        }
        if (fieldId === 'field303' || fieldId === 'field403') { // Coordinates
            return `<span class="coordinates-value">${value}</span>`;
        }

        // Default: escape HTML and preserve whitespace
        const escaped = value.replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/\n/g, '<br>');
        return escaped;
    },

    getFieldValueClass(fieldId) {
        const classes = [];

        if (this.isRequiredField(fieldId)) {
            classes.push('required-field');
        }

        // Add field-specific classes
        if (fieldId.startsWith('field1')) classes.push('field-technical');
        if (fieldId.startsWith('field2')) classes.push('field-administrative');
        if (fieldId.startsWith('field3')) classes.push('field-location');
        if (fieldId.startsWith('field5')) classes.push('field-reference');

        return classes.join(' ');
    },

    parseCoordinateString(coordString) {
        if (!coordString) return null;

        // Try parsing decimal format: "38.5, -77.0" or "38.5,-77.0"
        const decimalMatch = coordString.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
        if (decimalMatch) {
            return {
                lat: parseFloat(decimalMatch[1]),
                lng: parseFloat(decimalMatch[2])
            };
        }

        // Try parsing DMS format: "38.5000N 077.0000W" or "38°30'00\"N 077°00'00\"W"
        const dmsMatch = coordString.match(/(\d+\.?\d*)[°\s]*([NS])\s+(\d+\.?\d*)[°\s]*([EW])/i);
        if (dmsMatch) {
            let lat = parseFloat(dmsMatch[1]);
            let lng = parseFloat(dmsMatch[3]);

            // Convert to negative if South or West
            if (dmsMatch[2].toUpperCase() === 'S') lat = -lat;
            if (dmsMatch[4].toUpperCase() === 'W') lng = -lng;

            return { lat, lng };
        }

        // Try parsing space-separated format: "38.5 -77.0"
        const spaceMatch = coordString.match(/(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/);
        if (spaceMatch) {
            return {
                lat: parseFloat(spaceMatch[1]),
                lng: parseFloat(spaceMatch[2])
            };
        }

        return null;
    },

    calculateCompletionPercentage(sfafFields) {
        if (!sfafFields || Object.keys(sfafFields).length === 0) {
            return 0;
        }

        // Calculate based on MC4EB Publication 7, Change 1 required fields (Source: db_viewer_js.txt validation)
        const requiredFields = ['field005', 'field010', 'field102', 'field110', 'field200', 'field300'];
        const optionalImportantFields = ['field113', 'field114', 'field115', 'field301', 'field144'];

        // Count completed required fields
        const completedRequired = requiredFields.filter(field =>
            sfafFields[field] && sfafFields[field].trim() !== ''
        ).length;

        // Count completed optional important fields
        const completedOptional = optionalImportantFields.filter(field =>
            sfafFields[field] && sfafFields[field].trim() !== ''
        ).length;

        // Weight required fields more heavily (80% of score)
        const requiredScore = (completedRequired / requiredFields.length) * 80;

        // Optional fields contribute remaining 20%
        const optionalScore = (completedOptional / optionalImportantFields.length) * 20;

        return Math.round(requiredScore + optionalScore);
    },

    validateMCEBCompliance(sfafFields) {
        const issues = [];

        // Field 500 occurrence limit (Source: db_viewer_js.txt MC4EB validation)
        const field500Count = this.countFieldOccurrences(sfafFields, '500');
        if (field500Count > 10) {
            issues.push('Field 500 exceeds maximum 10 occurrences per MC4EB Publication 7, Change 1');
        }

        // Field 501 occurrence limit
        const field501Count = this.countFieldOccurrences(sfafFields, '501');
        if (field501Count > 30) {
            issues.push('Field 501 exceeds maximum 30 occurrences per MC4EB Publication 7, Change 1');
        }

        // Required field validation
        const requiredFields = ['field005', 'field010', 'field102', 'field110', 'field200'];
        const missingRequired = requiredFields.filter(field =>
            !sfafFields[field] || sfafFields[field].trim() === ''
        );

        if (missingRequired.length > 0) {
            issues.push(`Missing required fields: ${missingRequired.join(', ')}`);
        }

        // Frequency format validation (Source: db_viewer_js.txt frequency validation)
        if (sfafFields.field110) {
            if (!this.isValidFrequencyFormat(sfafFields.field110)) {
                issues.push('Field 110: Invalid frequency format');
            }
        }

        // Emission designator validation
        if (sfafFields.field114) {
            if (!this.isValidEmissionDesignator(sfafFields.field114)) {
                issues.push('Field 114: Invalid emission designator format');
            }
        }

        return {
            isCompliant: issues.length === 0,
            issues: issues,
            lastChecked: new Date().toISOString(),
            complianceScore: Math.max(0, 100 - (issues.length * 10))
        };
    },

    countFieldOccurrences(sfafFields, fieldNumber) {
        // Count occurrences of a specific field number
        return Object.keys(sfafFields).filter(key =>
            key.includes(`field${fieldNumber}`)
        ).length;
    },

    isValidFrequencyFormat(frequency) {
        // Enhanced frequency format validation for multiple standards
        const patterns = [
            /^K?\d+(\.\d+)?$/, // Basic numeric with optional K prefix
            /^[KMG]\d+(\.\d+)?$/, // Standard frequency notation
            /^\d+(\.\d+)?\s?(MHz|GHz|KHz)$/i, // Frequency with units
            /^K\d+\(\d+(\.\d+)?\)$/ // SFAF format: K4028(4026.5)
        ];

        return patterns.some(pattern => pattern.test(frequency));
    },

    isValidEmissionDesignator(emission) {
        // Basic emission designator format validation
        const emissionPattern = /^\d+[A-Z]\d+[A-Z]\d*[A-Z]?$/;
        return emissionPattern.test(emission);
    },

    processSFAFRecord(marker, sfafData, coordData) {
        const sfafFields = (sfafData && sfafData.success && sfafData.sfaf_fields) ?
            sfafData.sfaf_fields : {};
        const fieldDefs = (sfafData && sfafData.success && sfafData.field_defs) ?
            sfafData.field_defs : {};

        console.log(`📊 Processing marker ${marker.id}: SFAF fields count = ${Object.keys(sfafFields).length}`);

        // Determine completion status
        const completionStatus = this.determineSFAFCompletionStatus(sfafFields);

        // Extract key SFAF fields for default view
        const frequency = sfafFields.field110 || marker.frequency || 'Not Specified';
        const stationClass = sfafFields.field113 || 'TBD';
        const emission = sfafFields.field114 || 'TBD';
        const power = sfafFields.field115 || 'TBD';
        const agency = sfafFields.field200 || 'TBD';
        const location = this.formatLocationFromSFAF(sfafFields, marker);

        return {
            // Core identifiers
            id: marker.id,
            serial: marker.serial,
            markerType: marker.marker_type,

            // Technical parameters (Source: database_dump.txt SFAF field structure)
            frequency: frequency,
            stationClass: stationClass,
            emission: emission,
            power: power,

            // Administrative data
            agency: agency,
            agencySerial: sfafFields.field102 || 'FREQ',
            controlNumber: sfafFields.field702 || 'AFSOC 2025-',
            typeOfAction: sfafFields.field010 || 'M',

            // Location information
            location: location,
            state: sfafFields.field300 || 'TBD',
            antennaLocation: sfafFields.field301 || 'TBD',
            coordinates: coordData.success ? {
                decimal: coordData.decimal || `${marker.Latitude}, ${marker.Longitude}`,
                dms: coordData.dms || 'Loading...',
                compact: coordData.compact || 'Loading...'
            } : {
                decimal: `${marker.Latitude}, ${marker.Longitude}`,
                dms: 'Error loading',
                compact: 'Error loading'
            },

            coordinates: {
                decimal: (marker.Latitude && marker.Longitude) ?
                    `${marker.Latitude}, ${marker.Longitude}` : 'Invalid coordinates',
                dms: (coordData && coordData.success) ?
                    (coordData.dms || 'Format unavailable') : 'Conversion failed',
                compact: (coordData && coordData.success) ?
                    (coordData.compact || 'Format unavailable') : 'Conversion failed'
            },

            // Status and completion tracking
            sfafComplete: completionStatus.isComplete,
            sfafCompletionPercentage: completionStatus.completionPercentage,
            sfafFieldCount: Object.keys(sfafFields).length,
            validationStatus: this.performSFAFValidation(sfafFields, fieldDefs),

            // IRAC Notes information (Source: database_dump.txt IRAC structure)
            iracNotesCount: sfafData.success ? (sfafData.marker.irac_notes || []).length : 0,
            iracNotes: sfafData.success ? sfafData.marker.irac_notes || [] : [],

            // Regulatory compliance (Source: database_dump.txt MC4EB Publication 7, Change 1 context)
            mcebCompliant: this.checkMCEBCompliance(sfafFields, fieldDefs),
            approvalAuthority: sfafFields.field144 || 'TBD',
            coordinationRequired: this.requiresCoordination(sfafFields),

            // Temporal data
            createdAt: marker.created_at,
            updatedAt: marker.updated_at,
            reviewDate: sfafFields.field142 || null,
            revisionDate: sfafFields.field143 || null,

            // Equipment information
            equipment: this.extractEquipmentInfo(sfafFields),
            antennaInfo: this.extractAntennaInfo(sfafFields),

            // Raw data for detailed editing
            rawSFAFFields: sfafFields,
            fieldDefinitions: fieldDefs,
            markerData: marker
        };
    },

    determineSFAFCompletionStatus(sfafFields) {
        // Critical fields for basic SFAF completion (Source: database_dump.txt field structure)
        const criticalFields = [
            'field010', // Type of action
            'field110', // Frequency
            'field113', // Station class
            'field114', // Emission designator
            'field115', // Transmitter power
            'field200', // Agency
            'field300', // State/country
            'field301', // Antenna location
            'field144'  // Approval authority
        ];

        const totalCritical = criticalFields.length;
        const completedCritical = criticalFields.filter(field =>
            sfafFields[field] && sfafFields[field].trim() !== ''
        ).length;

        const completionPercentage = Math.round((completedCritical / totalCritical) * 100);

        return {
            isComplete: completedCritical === totalCritical,
            completionPercentage: completionPercentage,
            missingCriticalFields: criticalFields.filter(field =>
                !sfafFields[field] || sfafFields[field].trim() === ''
            ),
            completedFields: Object.keys(sfafFields).filter(field =>
                sfafFields[field] && sfafFields[field].trim() !== ''
            ).length,
            totalFields: Object.keys(sfafFields).length
        };
    },

    formatLocationFromSFAF(sfafFields, marker) {
        // Prioritize SFAF location data over marker coordinates
        const state = sfafFields.field300 || '';
        const location = sfafFields.field301 || '';

        if (state && location) {
            return `${location}, ${state}`;
        } else if (state) {
            return state;
        } else if (location) {
            return location;
        } else {
            // Fallback to coordinate-based location
            return `${marker.Latitude.toFixed(4)}, ${marker.Longitude.toFixed(4)}`;
        }
    },

    performSFAFValidation(sfafFields, fieldDefs) {
        const validationErrors = [];
        const validationWarnings = [];

        // Field length validation (Source: database_dump.txt field constraints)
        Object.entries(sfafFields).forEach(([fieldId, value]) => {
            const fieldDef = fieldDefs?.[fieldId];
            if (fieldDef && fieldDef.max_length && value.length > fieldDef.max_length) {
                validationErrors.push(`${fieldId}: Exceeds maximum length of ${fieldDef.max_length}`);
            }

            // Required field validation
            if (fieldDef && fieldDef.required && (!value || value.trim() === '')) {
                validationErrors.push(`${fieldId}: Required field is empty`);
            }
        });

        // Business logic validation
        if (sfafFields.field110) {
            const frequency = sfafFields.field110;
            if (!this.isValidFrequencyFormat(frequency)) {
                validationErrors.push('field110: Invalid frequency format');
            }
        }

        // Emission designator validation (Source: database_dump.txt IRAC notes technical specs)
        if (sfafFields.field114) {
            const emission = sfafFields.field114;
            if (!this.isValidEmissionDesignator(emission)) {
                validationWarnings.push('field114: Emission designator format should be verified');
            }
        }

        return {
            isValid: validationErrors.length === 0,
            hasWarnings: validationWarnings.length > 0,
            errors: validationErrors,
            warnings: validationWarnings,
            errorCount: validationErrors.length,
            warningCount: validationWarnings.length
        };
    },

    checkMCEBCompliance(sfafFields, fieldDefs) {
        // MC4EB Publication 7, Change 1 compliance checks (Source: database_dump.txt system_config)
        const complianceIssues = [];

        // Field 500/501 occurrence limits (Source: database_dump.txt system_config)
        const field500Occurrences = this.countFieldOccurrences(sfafFields, '500');
        const field501Occurrences = this.countFieldOccurrences(sfafFields, '501');

        if (field500Occurrences > 10) {
            complianceIssues.push('Field 500 exceeds maximum 10 occurrences');
        }

        if (field501Occurrences > 30) {
            complianceIssues.push('Field 501 exceeds maximum 30 occurrences');
        }

        // Field length compliance
        if (sfafFields.field500 && sfafFields.field500.length > 4) {
            complianceIssues.push('Field 500 exceeds maximum 4 characters');
        }

        if (sfafFields.field501 && sfafFields.field501.length > 35) {
            complianceIssues.push('Field 501 exceeds maximum 35 characters');
        }

        return {
            isCompliant: complianceIssues.length === 0,
            issues: complianceIssues,
            lastChecked: new Date().toISOString()
        };
    },

    requiresCoordination(sfafFields) {
        // Determine if coordination is required based on approval authority
        const approvalAuthority = sfafFields.field144;

        if (approvalAuthority === 'Y') {
            return {
                required: true,
                type: 'IRAC Processing Required',
                description: 'Assignment record must be processed through IRAC'
            };
        } else if (approvalAuthority === 'U') {
            return {
                required: false,
                type: 'US&P - No IRAC Required',
                description: 'Assignment is inside US&P and does not require IRAC processing'
            };
        } else if (approvalAuthority === 'O') {
            return {
                required: false,
                type: 'OUS&P - No IRAC Required',
                description: 'Assignment is OUS&P and does not require IRAC processing'
            };
        }

        return {
            required: null,
            type: 'To Be Determined',
            description: 'Approval authority not specified'
        };
    },

    extractEquipmentInfo(sfafFields) {
        // Extract equipment information from SFAF fields (Source: database_dump.txt SFAF structure)
        const equipment = [];

        // Transmitter equipment (field 340 series)
        if (sfafFields.field340) {
            equipment.push({
                type: 'Transmitter',
                nomenclature: sfafFields.field340,
                certificationId: sfafFields.field343 || 'Not specified',
                power: sfafFields.field315 || 'Not specified'
            });
        }

        // Receiver equipment (field 440 series)
        if (sfafFields.field440) {
            equipment.push({
                type: 'Receiver',
                nomenclature: sfafFields.field440,
                certificationId: sfafFields.field443 || 'Not specified'
            });
        }

        return equipment;
    },

    extractAntennaInfo(sfafFields) {
        // Extract antenna information from SFAF fields
        return {
            transmitter: {
                gain: sfafFields.field357 || 'Not specified',
                height: sfafFields.field316 || 'Not specified',
                orientation: sfafFields.field362 || 'Not specified',
                polarization: sfafFields.field363 || 'Not specified'
            },
            receiver: {
                gain: sfafFields.field457 || 'Not specified',
                height: sfafFields.field456 || 'Not specified',
                orientation: sfafFields.field462 || 'Not specified',
                polarization: sfafFields.field463 || 'Not specified'
            }
        };
    },

    createFallbackRecord(marker) {
        if (!marker || typeof marker !== 'object') {
            console.error('❌ Invalid marker passed to createFallbackRecord:', marker);
            return {
                id: 'error-' + Date.now(),
                serial: 'ERROR-INVALID',
                markerType: 'error',
                frequency: 'Data Error',
                stationClass: 'Data Error',
                emission: 'Data Error',
                power: 'Data Error',
                agency: 'Data Error',
                location: 'Error Loading Location',
                coordinates: { decimal: 'Error', dms: 'Error', compact: 'Error' },
                sfafComplete: false,
                sfafCompletionPercentage: 0,
                sfafFieldCount: 0,
                validationStatus: { isValid: false, errors: ['Invalid marker data'] },
                mcebCompliant: { isCompliant: false, issues: ['Data error'] },
                iracNotesCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                rawSFAFFields: {},
                fieldDefinitions: {},
                markerData: null
            };
        }

        // Create safe fallback record with all required properties
        return {
            id: marker.id || 'unknown-' + Date.now(),
            serial: marker.serial || 'UNKNOWN',
            markerType: marker.marker_type || 'unknown',
            frequency: marker.frequency || 'Not Specified',
            stationClass: 'Data Loading Error',
            emission: 'Data Loading Error',
            power: 'Data Loading Error',
            agency: 'Data Loading Error',
            agencySerial: 'Data Loading Error',
            location: marker.Latitude && marker.Longitude ?
                `${marker.Latitude.toFixed(4)}, ${marker.Longitude.toFixed(4)}` :
                'Invalid Coordinates',
            coordinates: {
                decimal: marker.Latitude && marker.Longitude ?
                    `${marker.Latitude}, ${marker.Longitude}` : 'Invalid',
                dms: 'Error loading',
                compact: 'Error loading'
            },
            // ✅ CRITICAL: Ensure all properties statistics function expects
            sfafComplete: false,
            sfafCompletionPercentage: 0,
            sfafFieldCount: 0,
            validationStatus: { isValid: false, errors: ['Failed to load SFAF data'] },
            mcebCompliant: { isCompliant: false, issues: ['Data unavailable'] },
            iracNotesCount: 0,
            createdAt: marker.created_at || new Date().toISOString(),
            updatedAt: marker.updated_at || new Date().toISOString(),
            rawSFAFFields: {},
            fieldDefinitions: {},
            markerData: marker
        };
    },

    ensureSFAFTableElements() {
        let table = document.getElementById('sfafRecordsTable');

        if (!table) {
            // Find table container in SFAF tab
            const sfafTab = document.getElementById('sfaf-tab');
            const tableContainer = sfafTab ? sfafTab.querySelector('.table-container') : null;

            if (tableContainer) {
                // Hide the empty state
                const emptyState = document.querySelector('.empty-state');
                if (emptyState) {
                    emptyState.style.display = 'none';
                }

                table = document.createElement('table');
                table.id = 'sfafRecordsTable';
                table.className = 'data-table sfaf-records-table';
                tableContainer.appendChild(table);
            }
        }

        let header = document.getElementById('sfafTableHeader'); // ✅ Correct ID
        if (!header && table) {
            header = document.createElement('thead');
            header.id = 'sfafTableHeader'; // ✅ Matches what renderEnhancedSFAFTable expects
            table.appendChild(header);
        }

        let body = document.getElementById('sfafRecordsTableBody'); // ✅ Correct ID  
        if (!body && table) {
            body = document.createElement('tbody');
            body.id = 'sfafRecordsTableBody'; // ✅ Matches what renderEnhancedSFAFTable expects
            table.appendChild(body);
        }

        return { table, header, body };
    },

    validateSFAFImport(record) {
        const validationIssues = [];

        // Field occurrence validation (Source: database_dump.txt system_config)
        if (record.occurrences['500'] > 10) {
            validationIssues.push('Field 500 exceeds maximum 10 occurrences');
        }

        if (record.occurrences['501'] > 30) {
            validationIssues.push('Field 501 exceeds maximum 30 occurrences');
        }

        // Required field validation
        const requiredFields = ['005', '010', '102', '110', '200', '300'];
        requiredFields.forEach(fieldNum => {
            if (!record.fields[`field${fieldNum}`]) {
                validationIssues.push(`Required field ${fieldNum} is missing`);
            }
        });

        // Coordinate format validation
        if (record.fields.field303) {
            const coordPattern = /^\d{6}[NS]\d{7}[EW]$/;
            if (!coordPattern.test(record.fields.field303)) {
                validationIssues.push('Field 303 coordinate format invalid');
            }
        }

        return {
            isValid: validationIssues.length === 0,
            issues: validationIssues
        };
    },

    parseSFAFText(sfafText) {
        const records = [];
        const lines = sfafText.split('\n').map(line => line.trim());

        let currentRecord = { fields: {}, occurrences: {} };
        let multiLineField = null;
        let multiLineContent = '';

        for (const line of lines) {
            // Handle record boundaries - empty lines separate records
            if (line === '' && Object.keys(currentRecord.fields).length > 0) {
                // Complete any active multi-line field
                if (multiLineField && multiLineContent) {
                    currentRecord.fields[multiLineField] = multiLineContent.trim();
                    multiLineField = null;
                    multiLineContent = '';
                }

                // Save completed record
                records.push(currentRecord);
                currentRecord = { fields: {}, occurrences: {} };
                continue;
            }

            // Skip empty lines at start or between records
            if (line === '') continue;

            // Parse field format: "110. K4028(4026.5)" or "500/02. S189"
            const fieldMatch = line.match(/^(\d{3})(?:\/(\d{2}))?\.\s*(.*)$/);

            if (fieldMatch) {
                // Complete any previous multi-line field
                if (multiLineField && multiLineContent) {
                    currentRecord.fields[multiLineField] = multiLineContent.trim();
                    multiLineContent = '';
                }

                const [, fieldNumber, occurrence, value] = fieldMatch;
                const fieldKey = occurrence ? `field${fieldNumber}_${occurrence}` : `field${fieldNumber}`;
                const occurrenceNum = occurrence ? parseInt(occurrence, 10) : 1;

                // Handle multi-line field indicators ($)
                if (value === '$') {
                    multiLineField = fieldKey;
                    multiLineContent = '';
                } else if (value.trim() === '') {
                    // Empty value, might be start of multi-line without $
                    multiLineField = fieldKey;
                    multiLineContent = '';
                } else {
                    // Single line field
                    currentRecord.fields[fieldKey] = value;
                }

                // Track occurrence numbers for validation
                currentRecord.occurrences[fieldNumber] = Math.max(
                    currentRecord.occurrences[fieldNumber] || 0,
                    occurrenceNum
                );
            } else if (multiLineField) {
                // Continuation line for multi-line field
                if (multiLineContent) {
                    multiLineContent += '\n' + line;
                } else {
                    multiLineContent = line;
                }
            }
        }

        // Handle final record and multi-line field
        if (multiLineField && multiLineContent) {
            currentRecord.fields[multiLineField] = multiLineContent.trim();
        }

        if (Object.keys(currentRecord.fields).length > 0) {
            records.push(currentRecord);
        }

        console.log(`✅ Parsed ${records.length} SFAF records from file`);
        return records;
    },

    validateSFAFFormData(sfafFields) {
        const errors = [];
        const warnings = [];

        // Required fields validation (Source: db_viewer_js.txt MC4EB compliance)
        const requiredFields = {
            'field005': 'Type of Application',
            'field010': 'Type of Action',
            'field102': 'Agency Serial Number',
            'field110': 'Frequency',
            'field200': 'Agency'
        };

        Object.entries(requiredFields).forEach(([fieldId, fieldName]) => {
            if (!sfafFields[fieldId] || sfafFields[fieldId].trim() === '') {
                errors.push(`${fieldName} (${fieldId}) is required`);
            }
        });

        // Frequency format validation
        if (sfafFields.field110) {
            if (!this.isValidFrequencyFormat(sfafFields.field110)) {
                errors.push('Frequency (field110) format is invalid. Expected: K####(####.#)');
            }
        }

        // Emission designator validation
        if (sfafFields.field114) {
            if (!this.isValidEmissionDesignator(sfafFields.field114)) {
                warnings.push('Emission designator (field114) format should be verified');
            }
        }

        // Agency serial number format validation
        if (sfafFields.field102) {
            const serialPattern = /^[A-Z]{2,3}\s+\d{6,8}$/;
            if (!serialPattern.test(sfafFields.field102)) {
                warnings.push('Agency serial number format should be: AA NNNNNN or AAA NNNNNN');
            }
        }

        // Power format validation
        if (sfafFields.field115) {
            const powerPattern = /^W\d+$/;
            if (!powerPattern.test(sfafFields.field115)) {
                warnings.push('Power format should be: W### (e.g., W500)');
            }
        }

        // MC4EB Publication 7, Change 1 field occurrence limits (Source: db_viewer_js.txt validation)
        const field500Count = this.countFieldOccurrencesInForm(sfafFields, '500');
        const field501Count = this.countFieldOccurrencesInForm(sfafFields, '501');

        if (field500Count > 10) {
            errors.push('Field 500 occurrences exceed MC4EB Publication 7, Change 1 limit (max 10)');
        }

        if (field501Count > 30) {
            errors.push('Field 501 occurrences exceed MC4EB Publication 7, Change 1 limit (max 30)');
        }

        return {
            isValid: errors.length === 0,
            hasWarnings: warnings.length > 0,
            errors: errors,
            warnings: warnings,
            errorCount: errors.length,
            warningCount: warnings.length
        };
    },

    countFieldOccurrencesInForm(sfafFields, fieldNumber) {
        return Object.keys(sfafFields).filter(key =>
            key.includes(`field${fieldNumber}`)
        ).length;
    },

    validateSFAFForm(recordId) {
        try {
            console.log(`🔍 Validating SFAF form for record: ${recordId}`);

            // Collect current form data
            const formData = new FormData(document.getElementById('editForm'));
            const sfafFields = {};

            for (const [key, value] of formData.entries()) {
                if (key.startsWith('field')) {
                    sfafFields[key] = value.trim();
                }
            }

            // Perform comprehensive validation
            const validation = this.validateSFAFFormData(sfafFields);
            const mcebCompliance = this.checkMCEBComplianceForForm(sfafFields);

            // Show validation results in alert or modal
            let message = '🔍 SFAF Validation Results:\n\n';

            if (validation.isValid) {
                message += '✅ All required fields are valid\n';
            } else {
                message += '❌ Validation Errors:\n';
                validation.errors.forEach(error => {
                    message += `  • ${error}\n`;
                });
            }

            if (validation.hasWarnings) {
                message += '\n⚠️ Validation Warnings:\n';
                validation.warnings.forEach(warning => {
                    message += `  • ${warning}\n`;
                });
            }

            if (mcebCompliance.isCompliant) {
                message += '\n✅ MC4EB Publication 7, Change 1 Compliant';
            } else {
                message += '\n⚠️ MC4EB Compliance Issues:\n';
                mcebCompliance.issues.forEach(issue => {
                    message += `  • ${issue}\n`;
                });
            }

            // Calculate completion percentage
            const completionPercentage = this.calculateFormCompletionPercentage(sfafFields);
            message += `\n📊 Form Completion: ${completionPercentage}%`;

            alert(message);

            // Highlight invalid fields in the form
            this.highlightFormValidationIssues(validation);

        } catch (error) {
            console.error('❌ Failed to validate SFAF form:', error);
            this.showError('Failed to validate SFAF form');
        }
    },

    checkMCEBComplianceForForm(sfafFields) {
        const issues = [];

        // Field occurrence limits (Source: db_viewer_js.txt MC4EB compliance)
        const field500Count = this.countFieldOccurrencesInForm(sfafFields, '500');
        const field501Count = this.countFieldOccurrencesInForm(sfafFields, '501');

        if (field500Count > 10) {
            issues.push('Field 500 exceeds maximum 10 occurrences per MC4EB Publication 7, Change 1');
        }

        if (field501Count > 30) {
            issues.push('Field 501 exceeds maximum 30 occurrences per MC4EB Publication 7, Change 1');
        }

        // Field length limits
        if (sfafFields.field500 && sfafFields.field500.length > 4) {
            issues.push('Field 500 exceeds maximum 4 characters');
        }

        if (sfafFields.field501 && sfafFields.field501.length > 35) {
            issues.push('Field 501 exceeds maximum 35 characters');
        }

        // Required field validation for MC4EB compliance
        const requiredForCompliance = ['field005', 'field010', 'field102', 'field110', 'field200', 'field300'];
        const missingRequired = requiredForCompliance.filter(field =>
            !sfafFields[field] || sfafFields[field].trim() === ''
        );

        if (missingRequired.length > 0) {
            issues.push(`Missing required fields for MC4EB compliance: ${missingRequired.join(', ')}`);
        }

        return {
            isCompliant: issues.length === 0,
            issues: issues,
            checkDate: new Date().toISOString()
        };
    },

    calculateFormCompletionPercentage(sfafFields) {
        // Critical fields for completion (Source: db_viewer_js.txt completion calculation)
        const criticalFields = [
            'field005', 'field010', 'field102', 'field110', 'field113',
            'field114', 'field115', 'field200', 'field300', 'field301'
        ];

        const completedCritical = criticalFields.filter(field =>
            sfafFields[field] && sfafFields[field].trim() !== ''
        ).length;

        return Math.round((completedCritical / criticalFields.length) * 100);
    },

    highlightFormValidationIssues(validation) {
        // Clear previous highlights
        document.querySelectorAll('.sfaf-field-input').forEach(input => {
            input.classList.remove('validation-error', 'validation-warning');
            const errorMsg = input.parentNode.querySelector('.validation-error-msg');
            if (errorMsg) errorMsg.remove();
        });

        // Add error highlights
        validation.errors.forEach(error => {
            const fieldMatch = error.match(/\(field(\d+)\)/);
            if (fieldMatch) {
                const fieldId = `field${fieldMatch[1]}`;
                const input = document.getElementById(fieldId);
                if (input) {
                    input.classList.add('validation-error');

                    // Add error message
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'validation-error-msg';
                    errorDiv.textContent = error;
                    input.parentNode.appendChild(errorDiv);
                }
            }
        });

        // Add warning highlights
        validation.warnings.forEach(warning => {
            const fieldMatch = warning.match(/\(field(\d+)\)/);
            if (fieldMatch) {
                const fieldId = `field${fieldMatch[1]}`;
                const input = document.getElementById(fieldId);
                if (input) {
                    input.classList.add('validation-warning');
                }
            }
        });
    },

    addSFAFFormValidation() {
        const form = document.getElementById('sfafFieldForm');
        if (!form) {
            console.warn('SFAF form not found for validation setup');
            return;
        }

        console.log('🔍 Setting up real-time SFAF form validation...');

        // Get all form inputs for validation monitoring (Source: db_viewer_html.txt form structure)
        const formInputs = form.querySelectorAll('input, select, textarea');

        // Add event listeners for real-time validation
        formInputs.forEach(input => {
            // Real-time validation on input changes
            input.addEventListener('input', (e) => {
                this.validateSFAFFieldRealTime(e.target);
                this.updateFormComplianceStatus();
            });

            // Validation on focus loss
            input.addEventListener('blur', (e) => {
                this.validateSFAFFieldRealTime(e.target);
                this.updateFormComplianceStatus();
            });

            // Special handling for select elements
            if (input.tagName === 'SELECT') {
                input.addEventListener('change', (e) => {
                    this.validateSFAFFieldRealTime(e.target);
                    this.updateFormComplianceStatus();
                });
            }
        });

        // Handle form submission with comprehensive validation (Source: main_go.txt SFAF routes)
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(form);
            const sfafFields = {};

            // Extract SFAF field values
            for (const [key, value] of formData.entries()) {
                if (value.trim() !== '') {
                    sfafFields[key] = value.trim();
                }
            }

            // Perform comprehensive validation before submission
            const validation = this.validateCompleteSFAFForm(sfafFields);

            if (validation.isValid) {
                await this.submitSFAFForm(sfafFields);
            } else {
                this.displayValidationErrors(validation);
            }
        });

        // Initial validation state setup
        this.updateFormComplianceStatus();

        console.log('✅ Real-time SFAF validation activated');
    },

    validateSFAFFieldRealTime(input) {
        const fieldId = input.id;
        const value = input.value.trim();
        const fieldNumber = fieldId.replace('field', '');

        // Clear previous validation states
        input.classList.remove('validation-error', 'validation-warning', 'validation-success');

        // Remove existing error messages
        const existingError = input.parentNode.querySelector('.field-validation-message');
        if (existingError) {
            existingError.remove();
        }

        // Skip validation for empty non-required fields
        if (value === '' && !input.hasAttribute('required')) {
            return { isValid: true, message: null };
        }

        let validation = { isValid: true, message: null, type: 'success' };

        // Field-specific validation based on MC4EB Publication 7, Change 1 standards (Source: db_viewer_js.txt MC4EB compliance)
        switch (fieldId) {
            case 'field005':
                validation = this.validateField005(value);
                break;
            case 'field010':
                validation = this.validateField010(value);
                break;
            case 'field102':
                validation = this.validateField102(value);
                break;
            case 'field110':
                validation = this.validateField110(value);
                break;
            case 'field113':
                validation = this.validateField113(value);
                break;
            case 'field114':
                validation = this.validateField114(value);
                break;
            case 'field115':
                validation = this.validateField115(value);
                break;
            case 'field200':
                validation = this.validateField200(value);
                break;
            case 'field300':
                validation = this.validateField300(value);
                break;
            case 'field301':
                validation = this.validateField301(value);
                break;
            default:
                // Generic validation for other fields
                validation = this.validateGenericField(fieldNumber, value);
                break;
        }

        // Apply visual feedback based on validation result
        this.applyFieldValidationFeedback(input, validation);

        return validation;
    },

    validateField005(value) {
        // Field 005 - Type of Application
        const validValues = ['UE', 'CE'];

        if (!validValues.includes(value.toUpperCase())) {
            return {
                isValid: false,
                message: 'Must be UE (Uncoordinated Equipment) or CE (Coordinated Equipment)',
                type: 'error'
            };
        }

        return { isValid: true, message: 'Valid application type', type: 'success' };
    },

    validateField010(value) {
        // Field 010 - Type of Action
        const validValues = ['N', 'M', 'D'];

        if (!validValues.includes(value.toUpperCase())) {
            return {
                isValid: false,
                message: 'Must be N (New), M (Modification), or D (Discontinue)',
                type: 'error'
            };
        }

        return { isValid: true, message: 'Valid action type', type: 'success' };
    },

    validateField102(value) {
        // Field 102 - Agency Serial Number (Source: db_viewer_js.txt validation patterns)
        const serialPattern = /^[A-Z]{2,3}\s+\d{6,8}$/;

        if (!serialPattern.test(value)) {
            return {
                isValid: false,
                message: 'Format must be: [Agency Code][Space][6-8 digits] (e.g., AF 014589)',
                type: 'error'
            };
        }

        // Validate agency code
        const agencyCode = value.split(' ')[0];
        const validAgencyCodes = ['AF', 'USA', 'USN', 'USMC', 'USCG', 'DI', 'DO', 'DS', 'FA', 'FT', 'HS', 'JC'];

        if (!validAgencyCodes.includes(agencyCode)) {
            return {
                isValid: true,
                message: `Warning: ${agencyCode} is not a standard agency code`,
                type: 'warning'
            };
        }

        return { isValid: true, message: 'Valid agency serial number', type: 'success' };
    },

    validateField110(value) {
        // Field 110 - Frequency (Source: db_viewer_js.txt frequency validation)
        const frequencyPatterns = [
            /^K\d+(\.\d+)?$/, // K-band format: K4028
            /^K\d+\(\d+(\.\d+)?\)$/, // K-band with parentheses: K4028(4026.5)
            /^\d+(\.\d+)?\s?(MHz|GHz|KHz)$/i, // Standard with units: 4026.5 MHz
            /^[A-Z]\d+(\.\d+)?$/ // Letter prefix: M4028, G2000, etc.
        ];

        const isValidFormat = frequencyPatterns.some(pattern => pattern.test(value));

        if (!isValidFormat) {
            return {
                isValid: false,
                message: 'Invalid frequency format. Use K####(####.#) or ####.# MHz',
                type: 'error'
            };
        }

        // Extract numeric frequency for range validation
        const numericFreq = parseFloat(value.replace(/[^0-9.]/g, ''));

        if (numericFreq < 0.003 || numericFreq > 300000) {
            return {
                isValid: true,
                message: 'Frequency outside normal spectrum range (3 kHz - 300 GHz)',
                type: 'warning'
            };
        }

        return { isValid: true, message: 'Valid frequency format', type: 'success' };
    },

    validateField113(value) {
        // Field 113 - Station Class
        const validClasses = ['MO', 'ML', 'FB', 'FX', 'BC', 'MS', 'AF', 'AE', 'AM'];

        if (!validClasses.includes(value.toUpperCase())) {
            return {
                isValid: true,
                message: 'Non-standard station class - verify correctness',
                type: 'warning'
            };
        }

        return { isValid: true, message: 'Valid station class', type: 'success' };
    },

    validateField114(value) {
        // Field 114 - Emission Designator
        const emissionPattern = /^\d+[KMG]?\d*[A-Z]\d*[A-Z]?$/;

        if (!emissionPattern.test(value)) {
            return {
                isValid: false,
                message: 'Invalid emission designator. Format: Bandwidth + Emission Class + Modulation (e.g., 2K70J3E)',
                type: 'error'
            };
        }

        return { isValid: true, message: 'Valid emission designator', type: 'success' };
    },

    validateField115(value) {
        // Field 115 - Transmitter Power
        const powerPattern = /^W\d+$/;

        if (!powerPattern.test(value)) {
            return {
                isValid: false,
                message: 'Power format must be W### (e.g., W500 for 500 watts)',
                type: 'error'
            };
        }

        const power = parseInt(value.substring(1));
        if (power > 1000000) {
            return {
                isValid: true,
                message: 'Very high power level - verify correctness',
                type: 'warning'
            };
        }

        return { isValid: true, message: 'Valid power specification', type: 'success' };
    },

    validateField200(value) {
        // Field 200 - Agency
        const validAgencies = ['USAF', 'USA', 'USN', 'USMC', 'USCG'];

        if (!validAgencies.includes(value)) {
            return {
                isValid: true,
                message: 'Non-standard agency designation',
                type: 'warning'
            };
        }

        return { isValid: true, message: 'Valid agency designation', type: 'success' };
    },

    validateField300(value) {
        // Field 300 - State/Country Code
        if (value.length !== 2) {
            return {
                isValid: false,
                message: 'Must be exactly 2 characters (state/country code)',
                type: 'error'
            };
        }

        if (!/^[A-Z]{2}$/.test(value.toUpperCase())) {
            return {
                isValid: false,
                message: 'Must contain only letters',
                type: 'error'
            };
        }

        return { isValid: true, message: 'Valid state/country code', type: 'success' };
    },

    validateField301(value) {
        // Field 301 - Location Description
        if (value.length > 50) {
            return {
                isValid: true,
                message: 'Location description is quite long - consider abbreviating',
                type: 'warning'
            };
        }

        if (value.length < 3) {
            return {
                isValid: false,
                message: 'Location description too short - minimum 3 characters',
                type: 'error'
            };
        }

        return { isValid: true, message: 'Valid location description', type: 'success' };
    },

    validateGenericField(fieldNumber, value) {
        // Generic validation for fields not specifically handled
        if (value.length > 255) {
            return {
                isValid: false,
                message: 'Field value exceeds maximum length (255 characters)',
                type: 'error'
            };
        }

        if (value.length > 100) {
            return {
                isValid: true,
                message: 'Long field value - verify completeness',
                type: 'warning'
            };
        }

        return { isValid: true, message: null, type: 'success' };
    },

    applyFieldValidationFeedback(input, validation) {
        // Apply CSS classes based on validation result (Source: db_viewer_css.txt styling)
        if (validation.isValid && validation.type === 'success') {
            input.classList.add('validation-success');
        } else if (validation.isValid && validation.type === 'warning') {
            input.classList.add('validation-warning');
        } else {
            input.classList.add('validation-error');
        }

        // Add validation message if provided
        if (validation.message) {
            const messageElement = document.createElement('div');
            messageElement.className = `field-validation-message validation-${validation.type}`;
            messageElement.innerHTML = `
            <i class="fas fa-${validation.type === 'error' ? 'exclamation-triangle' :
                    validation.type === 'warning' ? 'exclamation' : 'check'}"></i>
            ${validation.message}
        `;

            // Insert message after the input
            input.parentNode.appendChild(messageElement);
        }
    },

    updateFormComplianceStatus() {
        const complianceIndicator = document.getElementById('complianceIndicator');
        const requiredFieldCount = document.getElementById('requiredFieldCount');
        const optionalFieldCount = document.getElementById('optionalFieldCount');
        const form = document.getElementById('sfafFieldForm');

        if (!form || !complianceIndicator) {
            console.log('Form or compliance elements not found for status update');
            return;
        }

        console.log('🔍 Updating form compliance status...');

        // Required fields for MC4EB Publication 7, Change 1 compliance (Source: db_viewer_js.txt MC4EB compliance)
        const requiredFields = ['field005', 'field010', 'field102', 'field110', 'field200'];
        const optionalImportantFields = ['field113', 'field114', 'field115', 'field300', 'field301', 'field144'];

        let completedRequired = 0;
        let completedOptional = 0;
        let hasValidationErrors = false;
        const fieldIssues = [];

        // Check required fields completion and validation
        requiredFields.forEach(fieldId => {
            const input = document.getElementById(fieldId);
            if (input) {
                const value = input.value.trim();
                const hasValue = value !== '';
                const isValid = !input.classList.contains('validation-error');

                if (hasValue && isValid) {
                    completedRequired++;
                } else if (hasValue && !isValid) {
                    hasValidationErrors = true;
                    fieldIssues.push(`${fieldId}: validation error`);
                } else if (!hasValue) {
                    fieldIssues.push(`${fieldId}: required field empty`);
                }
            } else {
                fieldIssues.push(`${fieldId}: field not found in form`);
            }
        });

        // Check optional fields completion
        optionalImportantFields.forEach(fieldId => {
            const input = document.getElementById(fieldId);
            if (input) {
                const value = input.value.trim();
                const isValid = !input.classList.contains('validation-error');

                if (value !== '' && isValid) {
                    completedOptional++;
                } else if (value !== '' && !isValid) {
                    hasValidationErrors = true;
                    fieldIssues.push(`${fieldId}: validation error`);
                }
            }
        });

        // Calculate completion percentages
        const requiredCompletionRate = (completedRequired / requiredFields.length) * 100;
        const optionalCompletionRate = (completedOptional / optionalImportantFields.length) * 100;
        const overallCompletionRate = (requiredCompletionRate * 0.8) + (optionalCompletionRate * 0.2);

        // Update field count displays (Source: db_viewer_html.txt form structure)
        if (requiredFieldCount) {
            requiredFieldCount.textContent = `${completedRequired}/${requiredFields.length}`;
        }

        if (optionalFieldCount) {
            optionalFieldCount.textContent = `${completedOptional}/${optionalImportantFields.length}`;
        }

        // Determine overall compliance status
        let complianceStatus = 'pending';
        let complianceIcon = 'fas fa-clock';
        let complianceText = 'Validation pending...';
        let complianceClass = 'compliance-pending';

        if (hasValidationErrors) {
            complianceStatus = 'error';
            complianceIcon = 'fas fa-exclamation-triangle';
            complianceText = 'Validation errors detected';
            complianceClass = 'compliance-error';
        } else if (completedRequired === requiredFields.length) {
            if (optionalCompletionRate >= 50) {
                complianceStatus = 'compliant';
                complianceIcon = 'fas fa-check-circle';
                complianceText = 'MC4EB Publication 7, Change 1 Compliant';
                complianceClass = 'compliance-compliant';
            } else {
                complianceStatus = 'partial';
                complianceIcon = 'fas fa-check';
                complianceText = 'Basic compliance achieved';
                complianceClass = 'compliance-partial';
            }
        } else {
            complianceStatus = 'incomplete';
            complianceIcon = 'fas fa-minus-circle';
            complianceText = `${requiredFields.length - completedRequired} required fields missing`;
            complianceClass = 'compliance-incomplete';
        }

        // Update compliance indicator with visual feedback (Source: db_viewer_css.txt styling)
        complianceIndicator.className = `compliance-indicator ${complianceClass}`;
        complianceIndicator.innerHTML = `
        <i class="${complianceIcon}"></i>
        <span class="compliance-text">${complianceText}</span>
        <div class="compliance-details">
            <small>Completion: ${overallCompletionRate.toFixed(0)}% | Required: ${requiredCompletionRate.toFixed(0)}% | Optional: ${optionalCompletionRate.toFixed(0)}%</small>
        </div>
    `;

        // Update form-level validation state for submit button
        const submitButton = document.querySelector('button[type="submit"][form="sfafFieldForm"]');
        if (submitButton) {
            if (hasValidationErrors) {
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Fix Validation Errors';
                submitButton.className = 'btn btn-danger';
            } else if (completedRequired < requiredFields.length) {
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fas fa-minus-circle"></i> Complete Required Fields';
                submitButton.className = 'btn btn-secondary';
            } else {
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-save"></i> Save SFAF Fields';
                submitButton.className = 'btn btn-primary';
            }
        }

        // Update validation button text based on status
        const validateButton = document.querySelector('button[onclick*="validateSFAFFormRealTime"]');
        if (validateButton) {
            if (complianceStatus === 'compliant') {
                validateButton.innerHTML = '<i class="fas fa-check-circle"></i> Validated';
                validateButton.className = 'btn btn-success';
            } else if (complianceStatus === 'error') {
                validateButton.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Errors Found';
                validateButton.className = 'btn btn-danger';
            } else {
                validateButton.innerHTML = '<i class="fas fa-check-circle"></i> Validate';
                validateButton.className = 'btn btn-info';
            }
        }

        // Store current validation state for form submission
        form.dataset.validationState = JSON.stringify({
            complianceStatus: complianceStatus,
            completedRequired: completedRequired,
            completedOptional: completedOptional,
            hasValidationErrors: hasValidationErrors,
            fieldIssues: fieldIssues,
            overallCompletionRate: overallCompletionRate
        });

        console.log(`📊 Form compliance updated: ${complianceStatus} (${overallCompletionRate.toFixed(0)}% complete)`);
    },

    validateSFAFFormRealTime() {
        const form = document.getElementById('sfafFieldForm');
        if (!form) {
            console.error('SFAF form not found');
            return;
        }

        console.log('🔍 Performing real-time SFAF form validation...');

        // Validate all form fields
        const formInputs = form.querySelectorAll('input, select, textarea');
        let hasErrors = false;
        const validationResults = [];

        formInputs.forEach(input => {
            const result = this.validateSFAFFieldRealTime(input);
            validationResults.push(result);

            if (!result.isValid) {
                hasErrors = true;
            }
        });

        // Update compliance status after validation
        this.updateFormComplianceStatus();

        // Show validation summary
        const validationState = JSON.parse(form.dataset.validationState || '{}');

        let message = '🔍 SFAF Validation Summary:\n\n';
        message += `Overall Status: ${validationState.complianceStatus?.toUpperCase() || 'UNKNOWN'}\n`;
        message += `Completion: ${validationState.overallCompletionRate?.toFixed(0) || 0}%\n\n`;

        if (validationState.hasValidationErrors) {
            message += '❌ Validation Issues:\n';
            validationState.fieldIssues?.forEach(issue => {
                message += `  • ${issue}\n`;
            });
        } else {
            message += '✅ All field validations passed\n';
        }

        message += `\nRequired Fields: ${validationState.completedRequired || 0}/5\n`;
        message += `Optional Fields: ${validationState.completedOptional || 0}/6\n`;

        if (validationState.complianceStatus === 'compliant') {
            message += '\n🎉 Ready for MC4EB Publication 7, Change 1 compliance!';
        }

        alert(message);
    }

});
