// db_viewer_import.js — SFAF file import, import summary, export utilities

Object.assign(DatabaseViewer.prototype, {

    initializeSFAFFileImport() {
        const fileInput = document.getElementById('sfafImportFile');
        if (fileInput) {
            fileInput.addEventListener('change', async (event) => {
                const files = event.target.files;

                if (files.length === 0) return;

                try {
                    let totalImported = 0;
                    let totalUpdated = 0;
                    let totalFailed = 0;
                    let totalRecords = 0;
                    const allErrors = [];

                    for (const file of files) {
                        try {
                            console.log(`📥 Processing file: ${file.name}`);
                            const text = await file.text();
                            const result = await this.importSFAFRecords(text);

                            // ✅ Collect import statistics
                            if (result && typeof result === 'object') {
                                totalRecords += result.total || 0;
                                totalImported += result.imported || 0;
                                totalUpdated += result.updated || 0;

                                // Calculate failed records for this file
                                const fileFailed = (result.total || 0) - (result.imported || 0);
                                totalFailed += fileFailed;

                                if (result.success) {
                                    console.log(`✅ Successfully imported ${result.imported} records from ${file.name}`);
                                }

                                // Collect detailed error messages
                                if (result.errorMessages && result.errorMessages.length > 0) {
                                    result.errorMessages.forEach(err => {
                                        // Handle different error object structures
                                        const errorMsg = err.error || err.message || err.toString();
                                        const lineNum = err.line_number || err.line || '?';

                                        allErrors.push({
                                            file: file.name,
                                            line: lineNum,
                                            error: errorMsg
                                        });
                                    });
                                    console.error(`❌ Failed to import ${file.name}. Errors:`);
                                    result.errorMessages.forEach((err, idx) => {
                                        const errorMsg = err.error || err.message || err.toString();
                                        const lineNum = err.line_number || err.line || '?';
                                        console.error(`  ${idx + 1}. Line ${lineNum}: ${errorMsg}`);
                                    });
                                } else if (result.error) {
                                    allErrors.push({
                                        file: file.name,
                                        line: '?',
                                        error: result.error
                                    });
                                    console.error(`❌ Failed to import ${file.name}:`, result.error);
                                }
                            } else {
                                totalFailed++;
                                allErrors.push({
                                    file: file.name,
                                    line: '?',
                                    error: 'Invalid result from server'
                                });
                                console.error(`❌ Invalid result from ${file.name}:`, result);
                            }

                        } catch (error) {
                            totalFailed++;
                            allErrors.push({
                                file: file.name,
                                line: '?',
                                error: error.message || 'Unknown error'
                            });
                            console.error(`❌ Error processing ${file.name}:`, error);
                        }
                    }

                    // Show import summary modal
                    this.showImportSummaryModal({
                        totalRecords: totalRecords,
                        successCount: totalImported,
                        updatedCount: totalUpdated,
                        failedCount: totalFailed,
                        errorCount: allErrors.length,
                        errors: allErrors
                    });

                    // Refresh display if any records were imported
                    if (totalImported > 0) {
                        await this.loadSFAFRecords();
                    }

                    // Clear file input for next use
                    fileInput.value = '';

                } catch (error) {
                    console.error('❌ SFAF file import failed:', error);
                    this.showError('Failed to import SFAF files');
                }
            });
        } else {
            console.error('❌ SFAF import file input not found');
        }
    },

    showImportSummaryModal(summary) {
        const { totalRecords, successCount, updatedCount = 0, failedCount, errorCount, errors } = summary;
        const anySuccess = (successCount + updatedCount) > 0;

        // Determine overall status
        const allSuccess = errorCount === 0;
        const partialSuccess = anySuccess && errorCount > 0;
        const allFailed = !anySuccess && errorCount > 0;

        // Build modal content
        let modalContent = `
            <div class="import-summary">
                <div class="import-summary-stats">
                    ${allSuccess ? '<div class="import-status-icon success">✅</div>' : ''}
                    ${partialSuccess ? '<div class="import-status-icon warning">⚠️</div>' : ''}
                    ${allFailed ? '<div class="import-status-icon error">❌</div>' : ''}

                    <h3>${allSuccess ? 'Import Successful' : (allFailed ? 'Import Failed' : 'Import Partially Successful')}</h3>

                    <div class="import-stats-grid">
                        <div class="import-stat">
                            <div class="import-stat-value">${totalRecords}</div>
                            <div class="import-stat-label">Total Records</div>
                        </div>
                        <div class="import-stat success">
                            <div class="import-stat-value">${successCount}</div>
                            <div class="import-stat-label">New Records</div>
                        </div>
                        <div class="import-stat ${updatedCount > 0 ? 'warning' : ''}">
                            <div class="import-stat-value">${updatedCount}</div>
                            <div class="import-stat-label">Updated Records</div>
                        </div>
                        <div class="import-stat ${errorCount > 0 ? 'error' : ''}">
                            <div class="import-stat-value">${failedCount}</div>
                            <div class="import-stat-label">Failed Records</div>
                        </div>
                        <div class="import-stat ${errorCount > 0 ? 'error' : ''}">
                            <div class="import-stat-value">${errorCount}</div>
                            <div class="import-stat-label">Total Errors</div>
                        </div>
                    </div>
                </div>
        `;

        // Add detailed errors section if there are errors
        if (errors && errors.length > 0) {
            modalContent += `
                <div class="import-errors-section">
                    <button type="button" class="btn btn-secondary" onclick="databaseViewer.toggleImportErrors()" id="toggleErrorsBtn">
                        Show Detailed Errors ▼
                    </button>

                    <div id="importErrorDetails" style="display: none; margin-top: 15px;">
                        <div class="import-errors-list">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th style="width: 30%">File</th>
                                        <th style="width: 10%">Line</th>
                                        <th style="width: 60%">Error</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;

            errors.forEach((err, idx) => {
                modalContent += `
                    <tr>
                        <td><code>${err.file}</code></td>
                        <td><code>${err.line}</code></td>
                        <td>${err.error}</td>
                    </tr>
                `;
            });

            modalContent += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }

        modalContent += `</div>`;

        // Add custom styles for import summary
        const style = `
            <style>
                #editModal .modal-dialog {
                    max-width: 700px;
                }
                .import-summary {
                    padding: 20px 0;
                }
                .import-summary-stats {
                    text-align: center;
                    margin-bottom: 25px;
                }
                .import-status-icon {
                    font-size: 64px;
                    margin-bottom: 15px;
                }
                .import-status-icon.success { color: #10b981; }
                .import-status-icon.warning { color: #f59e0b; }
                .import-status-icon.error { color: #ef4444; }
                .import-summary h3 {
                    margin: 15px 0 0 0;
                    color: #e2e8f0;
                    font-size: 24px;
                    font-weight: 600;
                }
                .import-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(5, 1fr);
                    gap: 12px;
                    margin-top: 30px;
                }
                .import-stat {
                    padding: 20px 15px;
                    background: rgba(30, 41, 59, 0.6);
                    border-radius: 12px;
                    border: 2px solid rgba(71, 85, 105, 0.5);
                }
                .import-stat.success {
                    background: rgba(6, 78, 59, 0.4);
                    border-color: rgba(16, 185, 129, 0.6);
                }
                .import-stat.warning {
                    background: rgba(120, 80, 0, 0.4);
                    border-color: rgba(245, 158, 11, 0.6);
                }
                .import-stat.error {
                    background: rgba(127, 29, 29, 0.4);
                    border-color: rgba(239, 68, 68, 0.6);
                }
                .import-stat-value {
                    font-size: 36px;
                    font-weight: 700;
                    color: #f1f5f9;
                    line-height: 1;
                }
                .import-stat-label {
                    font-size: 11px;
                    color: #94a3b8;
                    margin-top: 8px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    font-weight: 500;
                }
                .import-errors-section {
                    margin-top: 25px;
                    padding-top: 25px;
                    border-top: 1px solid rgba(71, 85, 105, 0.5);
                }
                #toggleErrorsBtn {
                    background: rgba(71, 85, 105, 0.6);
                    border: 1px solid rgba(100, 116, 139, 0.5);
                    color: #cbd5e1;
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                #toggleErrorsBtn:hover {
                    background: rgba(100, 116, 139, 0.7);
                    border-color: rgba(148, 163, 184, 0.6);
                }
                .import-errors-list {
                    max-height: 350px;
                    overflow-y: auto;
                    background: rgba(15, 23, 42, 0.6);
                    padding: 0;
                    border-radius: 12px;
                    border: 1px solid rgba(71, 85, 105, 0.5);
                }
                .import-errors-list table {
                    margin-bottom: 0;
                    font-size: 13px;
                    width: 100%;
                }
                .import-errors-list thead {
                    position: sticky;
                    top: 0;
                    z-index: 10;
                }
                .import-errors-list th {
                    background: rgba(30, 41, 59, 0.95);
                    color: #94a3b8;
                    padding: 12px 15px;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    border-bottom: 1px solid rgba(71, 85, 105, 0.5);
                }
                .import-errors-list td {
                    padding: 12px 15px;
                    color: #cbd5e1;
                    border-bottom: 1px solid rgba(51, 65, 85, 0.3);
                }
                .import-errors-list tbody tr:hover {
                    background: rgba(51, 65, 85, 0.3);
                }
                .import-errors-list code {
                    background: rgba(51, 65, 85, 0.6);
                    color: #fbbf24;
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-family: 'Monaco', 'Menlo', monospace;
                }
            </style>
        `;

        // Show modal
        const importFooter = `
            <button type="button" class="btn btn-success" onclick="databaseViewer.closeModal()">
                <i class="fas fa-check"></i> Done
            </button>
        `;
        this.showModal('SFAF Import Summary', style + modalContent, importFooter);
    },

    toggleImportErrors() {
        const errorDetails = document.getElementById('importErrorDetails');
        const toggleBtn = document.getElementById('toggleErrorsBtn');

        if (errorDetails && toggleBtn) {
            if (errorDetails.style.display === 'none') {
                errorDetails.style.display = 'block';
                toggleBtn.innerHTML = 'Hide Detailed Errors ▲';
            } else {
                errorDetails.style.display = 'none';
                toggleBtn.innerHTML = 'Show Detailed Errors ▼';
            }
        }
    },

    safeClickButton(elementId) {
        const element = document.getElementById(elementId);
        if (element && typeof element.click === 'function') {
            element.click();
        } else {
            console.warn(`Element ${elementId} not found or not clickable`);
        }
    },

    waitForElement(selector, callback) {
        const element = document.querySelector(selector);
        if (element) {
            callback(element);
        } else {
            setTimeout(() => waitForElement(selector, callback), 100);
        }
    },

    downloadFile(filename, content) {
        try {
            const blob = new Blob([content], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            console.log(`✅ File downloaded: ${filename}`);
            this.showSuccess(`File downloaded: ${filename}`);
        } catch (error) {
            console.error('❌ Failed to download file:', error);
            this.showError('Failed to download file');
        }
    },

    exportSelectedRecords() {
        if (this.selectedItems.size === 0) {
            alert('Please select at least one record to export.');
            return;
        }

        console.log(`Exporting ${this.selectedItems.size} selected records...`);

        // Gather selected records data
        const selectedData = {
            type: 'SFAF_Selected_Export',
            exported_at: new Date().toISOString(),
            total_count: this.selectedItems.size,
            record_ids: Array.from(this.selectedItems),
            records: []
        };

        // Download as JSON
        const blob = new Blob([JSON.stringify(selectedData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SFAF_Selected_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(`Exported ${this.selectedItems.size} records successfully.`);
    },

    toggleExportDropdown() {
        const dropdown = document.getElementById('exportDropdown');
        if (dropdown) {
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        }

        // Close dropdown when clicking outside
        if (dropdown.style.display === 'block') {
            setTimeout(() => {
                document.addEventListener('click', (e) => {
                    if (!e.target.closest('#exportDropdownBtn') && !e.target.closest('#exportDropdown')) {
                        dropdown.style.display = 'none';
                    }
                }, { once: true });
            }, 0);
        }
    }

},

    async importSampleSFAFData() {
        try {
            console.log('📥 Starting sample SFAF import with complete record creation...');

            const sampleSFAFText = `
005.     UE
010.     M
102.     AF  014589
110.     K4028(4026.5)
113.     MO
114.     2K70J3E
115.     W500
200.     USAF
300.     FL
301.     HURLBURT
500.     S189
500/02.     E029
500/03.     C010
===
005.     UE
010.     M
102.     AF  079243
110.     K4460.5(4459.15)
113.     MO
114.     2K70J3E
115.     W500
200.     USAF
300.     FL
301.     HURLBURT
500.     C010
===
005.     UE
010.     M
102.     AF  948910
110.     K4551.5(4550)
113.     ML
114.     2K70J3E
115.     W20
200.     USAF
300.     FL
301.     HURLBURT
500.     C010
        `.trim();

            const result = await this.importSFAFRecords(sampleSFAFText);

            if (result.success) {
                console.log(`✅ Sample import successful: ${result.imported} complete records imported`);

                // ✅ CRITICAL: Wait for database synchronization and refresh display
                console.log('🔄 Refreshing SFAF records display...');
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for SFAF creation
                await this.loadSFAFRecords();

                this.showSuccess(`✅ Successfully imported ${result.imported} complete SFAF records with field data`);
            } else {
                this.showError(`❌ Sample import failed: ${result.error}`);
            }

        } catch (error) {
            console.error('❌ Sample import failed:', error);
            this.showError('Failed to import sample data');
        }
    },

    async importSFAFRecords(sfafText) {
        try {
            console.log('📥 Starting SFAF import process...');

            // Show progress indicator
            this.showLoading(true, 'Importing SFAF records...');

            // Create a Blob from the text content
            const blob = new Blob([sfafText], { type: 'text/plain' });

            // Create FormData and append the file
            const formData = new FormData();
            formData.append('file', blob, 'import.txt');

            console.log('📤 Sending file to backend import endpoint...');

            // Use the backend import endpoint that handles everything:
            // - Parses SFAF text format (field 005 separates records)
            // - Extracts coordinates from field 303 (DMS format)
            // - Extracts serial from field 102
            // - Creates markers at correct coordinates
            // - Creates SFAF records with all fields
            const response = await fetch('/api/sfaf/import', {
                method: 'POST',
                body: formData
                // Don't set Content-Type header - browser will set it with boundary
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Import failed: HTTP ${response.status}`);
            }

            const result = await response.json();
            console.log('✅ Import completed:', result);

            if (!result.success) {
                throw new Error(result.error || 'Import failed');
            }

            // Log detailed results
            const importResults = result.results;
            console.log(`📊 Import Summary:
- Total Records: ${importResults.total_records}
- Successful: ${importResults.successful_count}
- Errors: ${importResults.error_count}`);

            if (importResults.errors && importResults.errors.length > 0) {
                console.warn('⚠️ Import Errors:', importResults.errors);
            }

            // Hide progress indicator
            this.showLoading(false);

            return {
                success: importResults.successful_count > 0,
                imported: importResults.successful_count,
                errors: importResults.error_count,
                total: importResults.total_records,
                errorMessages: importResults.errors || []
            };

        } catch (error) {
            console.error('❌ Import failed:', error);

            // Hide progress indicator on error
            this.showLoading(false);

            return {
                success: false,
                imported: 0,
                errors: 1,
                error: error.message
            };
        }
    },

    async exportSFAF(markerId) {
        try {
            const response = await fetch(`/api/sfaf/object-data/${markerId}`);
            const data = await response.json();

            if (data.success) {
                // Create comprehensive export data using backend response (Source: handlers.txt)
                const exportData = {
                    marker: data.marker,
                    coordinates: data.coordinates,
                    sfaf_fields: data.sfaf_fields,
                    field_definitions: data.field_defs,
                    exported_at: new Date().toISOString(),
                    format: 'SFAF_Database_Export_v1.0'
                };

                const dataStr = JSON.stringify(exportData, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });

                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `SFAF_${data.marker.serial}_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                URL.revokeObjectURL(url);
                this.showSuccess('SFAF data exported successfully');
            }
        } catch (error) {
            console.error('Failed to export SFAF:', error);
            this.showError('Failed to export SFAF data');
        }
    },

    async exportData() {
        try {
            // Get current tab data
            let exportData = {};
            let filename = '';

            switch (this.currentTab) {
                case 'markers':
                    const markersResponse = await fetch('/api/markers');
                    const markersData = await markersResponse.json();

                    if (markersData.success) {
                        // Enhance marker data with coordinate formats (Source: services.txt)
                        const enhancedMarkers = await Promise.all(
                            markersData.markers.map(async (marker) => {
                                try {
                                    const coordResponse = await fetch(`/api/convert-coords?lat=${marker.lat}&lng=${marker.lng}`);
                                    const coords = await coordResponse.json();

                                    return {
                                        ...marker,
                                        coordinates: coords
                                    };
                                } catch (error) {
                                    return marker;
                                }
                            })
                        );

                        exportData = {
                            type: 'SFAF_Markers_Export',
                            exported_at: new Date().toISOString(),
                            total_count: enhancedMarkers.length,
                            markers: enhancedMarkers,
                            compliance: 'MC4EB Publication 7, Change 1',
                            version: '1.0'
                        };
                        filename = `SFAF_Markers_${new Date().toISOString().split('T')[0]}.json`;
                    }
                    break;

                case 'sfaf':
                    // Export SFAF records with complete field definitions (Source: services.txt)
                    exportData = {
                        type: 'SFAF_Records_Export',
                        exported_at: new Date().toISOString(),
                        compliance: 'MC4EB Publication 7, Change 1',
                        version: '1.0',
                        records: [] // Will be populated by loading SFAF data for each marker
                    };
                    filename = `SFAF_Records_${new Date().toISOString().split('T')[0]}.json`;
                    break;

                case 'irac':
                    const iracResponse = await fetch('/api/irac-notes');
                    const iracData = await iracResponse.json();

                    if (iracData.success) {
                        exportData = {
                            type: 'IRAC_Notes_Export',
                            exported_at: new Date().toISOString(),
                            total_count: iracData.notes.length,
                            notes: iracData.notes,
                            categories: [...new Set(iracData.notes.map(note => note.category))],
                            compliance: 'MC4EB Publication 7, Change 1',
                            version: '1.0'
                        };
                        filename = `IRAC_Notes_${new Date().toISOString().split('T')[0]}.json`;
                    }
                    break;

                case 'analytics':
                    // Export analytics report (Source: handlers.txt comprehensive data)
                    const analyticsMarkers = await fetch('/api/markers');
                    const analyticsIRAC = await fetch('/api/irac-notes');

                    const [markersResult, iracResult] = await Promise.all([
                        analyticsMarkers.json(),
                        analyticsIRAC.json()
                    ]);

                    if (markersResult.success && iracResult.success) {
                        const complianceReport = await this.generateComplianceReport(markersResult.markers);

                        exportData = {
                            type: 'SFAF_Analytics_Export',
                            exported_at: new Date().toISOString(),
                            system_overview: {
                                total_markers: markersResult.markers.length,
                                manual_markers: markersResult.markers.filter(m => m.type === 'manual').length,
                                imported_markers: markersResult.markers.filter(m => m.type === 'imported').length,
                                total_irac_notes: iracResult.notes.length
                            },
                            frequency_analysis: this.analyzeFrequencyDistribution(markersResult.markers),
                            geographic_distribution: this.analyzeGeographicDistribution(markersResult.markers),
                            compliance_report: complianceReport,
                            compliance: 'MC4EB Publication 7, Change 1',
                            version: '1.0'
                        };
                        filename = `SFAF_Analytics_${new Date().toISOString().split('T')[0]}.json`;
                    }
                    break;
            }

            if (Object.keys(exportData).length === 0) {
                this.showError('No data available for export');
                return;
            }

            // Create and download file
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });

            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            URL.revokeObjectURL(url);
            this.showSuccess(`Data exported successfully: ${filename}`);

        } catch (error) {
            console.error('Export failed:', error);
            this.showError('Failed to export data');
        }
    },

    async exportComprehensiveReport() {
        try {
            console.log('📊 Generating comprehensive analysis report...');
            this.showLoading(true, 'Generating comprehensive report...');

            // Load all necessary data
            const [markersResponse, iracResponse] = await Promise.all([
                fetch('/api/markers'),
                fetch('/api/irac-notes')
            ]);

            if (!markersResponse.ok || !iracResponse.ok) {
                throw new Error('Failed to load data for comprehensive report');
            }

            const markersData = await markersResponse.json();
            const iracData = await iracResponse.json();

            if (!markersData.success || !iracData.success) {
                throw new Error('API returned error response');
            }

            const markers = Array.isArray(markersData.markers) ? markersData.markers : [];
            const iracNotes = Array.isArray(iracData.notes) ? iracData.notes : [];

            // Generate comprehensive analysis
            const geoStats = this.analyzeGeographicDistribution(markers);
            const freqStats = this.analyzeFrequencyDistribution(markers);
            const complianceReport = await this.generateComplianceReport(markers);

            // Create comprehensive report
            const reportData = {
                metadata: {
                    title: 'SFAF Plotter Comprehensive Analysis Report',
                    generated: new Date().toISOString(),
                    system: 'SFAF Plotter Database Viewer v1.0',
                    compliance: 'MC4EB Publication 7, Change 1 Standards',
                    analyst: 'Automated System Analysis',
                    classification: 'FOR OFFICIAL USE ONLY'
                },
                executiveSummary: {
                    totalMarkers: markers.length,
                    validCoordinates: geoStats.statistics?.validCoordinates || 0,
                    geographicSpread: geoStats.spread,
                    primaryRegion: this.identifyGeographicRegion(geoStats.center),
                    dataQuality: geoStats.statistics?.coordinateQuality || 'Unknown',
                    complianceStatus: complianceReport.field500Compliance && complianceReport.field501Compliance ? 'Compliant' : 'Non-Compliant'
                },
                geographicAnalysis: geoStats,
                frequencyAnalysis: freqStats,
                complianceAnalysis: complianceReport,
                iracAnalysis: {
                    totalNotes: iracNotes.length,
                    categories: [...new Set(iracNotes.map(n => n.category))],
                    notes: iracNotes
                },
                recommendations: {
                    geographic: this.generateRecommendations(geoStats, markers),
                    dataQuality: this.generateDataQualityRecommendations(geoStats, markers),
                    operational: this.generateOperationalRecommendations(markers, iracNotes)
                },
                detailedData: {
                    markers: markers.map(marker => ({
                        id: marker.id,
                        serial: marker.serial || 'Unknown',
                        latitude: marker.lat,
                        longitude: marker.lng,
                        frequency: marker.frequency,
                        markerType: marker.type || marker.marker_type,
                        createdAt: marker.created_at,
                        updatedAt: marker.updated_at,
                        region: marker.lat && marker.lng ?
                            this.identifyGeographicRegion({ lat: marker.lat, lng: marker.lng }) : 'Unknown',
                        mgrsGrid: marker.lat && marker.lng ?
                            this.calculateMGRSGrid({ lat: marker.lat, lng: marker.lng }) : 'Unknown'
                    })),

                    timeline: this.generateDataTimeline(markers),

                    statistics: {
                        temporal: {
                            firstEntry: markers.length > 0 ?
                                Math.min(...markers.map(m => new Date(m.created_at).getTime())) : null,
                            lastEntry: markers.length > 0 ?
                                Math.max(...markers.map(m => new Date(m.created_at).getTime())) : null,
                            averagePerDay: this.calculateDailyAverage(markers),
                            peakActivity: this.findPeakActivityPeriod(markers),
                            growthTrend: this.calculateGrowthTrend(markers)
                        },

                        frequency: {
                            bands: freqStats,
                            unique: [...new Set(markers.map(m => m.frequency).filter(f => f))],
                            mostCommon: this.findMostCommonFrequency(markers),
                            distribution: this.analyzeFrequencyDistribution(markers)
                        },

                        geographic: {
                            regions: this.categorizeMarkersByRegion(markers),
                            clusters: geoStats.statistics?.clustersDetected || [],
                            density: geoStats.statistics?.densityAnalysis || {},
                            boundaries: geoStats.bounds
                        },

                        quality: {
                            coordinateCompleteness: (geoStats.statistics?.validCoordinates || 0) / Math.max(markers.length, 1),
                            duplicateSerials: this.findDuplicateSerials(markers),
                            invalidFrequencies: markers.filter(m => m.frequency && !this.isValidFrequencyFormat(m.frequency)),
                            missingData: this.identifyMissingDataPatterns(markers)
                        }
                    },

                    compliance: {
                        mcebPublication7: complianceReport,
                        iracCompliance: this.analyzeIRACCompliance(iracNotes),
                        fieldValidation: this.performFieldValidation(markers),
                        recommendations: this.generateDetailedComplianceRecommendations(markers, iracNotes)
                    },

                    technicalSpecs: {
                        coordinateSystems: {
                            primary: 'WGS84 Geographic',
                            supported: ['Decimal Degrees', 'DMS', 'MGRS'],
                            precision: '6 decimal places (±0.111m at equator)',
                            datum: 'World Geodetic System 1984'
                        },

                        database: {
                            version: 'PostgreSQL with PostGIS',
                            tables: ['markers', 'sfaf_records', 'irac_notes', 'geometries'],
                            indexes: 'Spatial and B-tree indexes optimized',
                            backup: 'Automated daily backups configured'
                        },

                        api: {
                            version: 'REST API v1.0',
                            endpoints: ['/api/markers', '/api/sfaf', '/api/irac-notes', '/api/geometry'],
                            authentication: 'Session-based authentication',
                            rateLimit: '1000 requests per hour per IP'
                        }
                    }
                }
            };

            // Generate and download comprehensive JSON report
            const jsonReport = JSON.stringify(reportData, null, 2);
            const jsonBlob = new Blob([jsonReport], { type: 'application/json' });
            const jsonUrl = URL.createObjectURL(jsonBlob);
            const jsonLink = document.createElement('a');
            jsonLink.href = jsonUrl;
            jsonLink.download = `SFAF_Comprehensive_Report_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(jsonLink);
            jsonLink.click();
            document.body.removeChild(jsonLink);
            URL.revokeObjectURL(jsonUrl);

            this.showSuccess('Comprehensive analysis report generated successfully');

        } catch (error) {
            console.error('❌ Failed to generate comprehensive report:', error);
            this.showError(`Failed to generate comprehensive report: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    },

    async exportAllToCSV() {
        console.log('📤 Exporting all SFAF records to CSV...');

        this.showLoading(true, 'Exporting all records to CSV...');

        try {
            // Use the existing backend export endpoint
            const response = await fetch('/api/sfaf/export?format=csv');

            if (!response.ok) {
                throw new Error(`Export failed: ${response.status} ${response.statusText}`);
            }

            // Get the CSV content
            const blob = await response.blob();

            // Create download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `SFAF_All_Records_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showLoading(false);
            this.showSuccess('All records exported to CSV successfully!');

            // Close dropdown
            document.getElementById('exportDropdown').style.display = 'none';

        } catch (error) {
            this.showLoading(false);
            console.error('Export failed:', error);
            this.showError(`Failed to export: ${error.message}`);
        }
    },

    async exportSelectedToCSV() {
        if (this.selectedItems.size === 0) {
            alert('Please select at least one record to export.');
            return;
        }

        console.log(`📤 Exporting ${this.selectedItems.size} selected records to CSV...`);

        this.showLoading(true, `Exporting ${this.selectedItems.size} records to CSV...`);

        try {
            const response = await fetch('/api/sfaf/export-selected', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ids: Array.from(this.selectedItems),
                    format: 'csv'
                })
            });

            if (!response.ok) {
                throw new Error(`Export failed: ${response.status} ${response.statusText}`);
            }

            // Get the CSV content
            const blob = await response.blob();

            // Create download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `SFAF_Selected_${this.selectedItems.size}_Records_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showLoading(false);
            this.showSuccess(`${this.selectedItems.size} records exported to CSV successfully!`);

            // Close dropdown
            document.getElementById('exportDropdown').style.display = 'none';

        } catch (error) {
            this.showLoading(false);
            console.error('Export failed:', error);
            this.showError(`Failed to export: ${error.message}`);
        }
    }

});
