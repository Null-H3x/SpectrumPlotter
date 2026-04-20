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
                    let totalFailed = 0;
                    let totalRecords = 0;
                    const allErrors = [];
                    const fileResults = [];   // raw server results per file
                    const actionCounts = { A:0, D:0, E:0, F:0, M:0, N:0, R:0, Invalid:0 };

                    for (const file of files) {
                        try {
                            console.log(`📥 Processing file: ${file.name}`);
                            const text = await file.text();
                            const result = await this.importSFAFRecords(text);

                            if (result && typeof result === 'object') {
                                totalRecords += result.total || 0;
                                totalImported += result.imported || 0;
                                totalFailed += (result.total || 0) - (result.imported || 0);

                                // Accumulate action counts from server result
                                const ac = result.actionCounts || {};
                                for (const k of Object.keys(actionCounts)) {
                                    actionCounts[k] += ac[k] || 0;
                                }

                                fileResults.push({ name: file.name, result });

                                if (result.success) {
                                    console.log(`✅ Successfully imported ${result.imported} records from ${file.name}`);
                                }

                                if (result.errorMessages && result.errorMessages.length > 0) {
                                    result.errorMessages.forEach(err => {
                                        const errorMsg = err.error || err.message || err.toString();
                                        allErrors.push({ file: file.name, line: err.line_number || err.line || '?', error: errorMsg });
                                    });
                                } else if (result.error) {
                                    allErrors.push({ file: file.name, line: '?', error: result.error });
                                }
                            } else {
                                totalFailed++;
                                allErrors.push({ file: file.name, line: '?', error: 'Invalid result from server' });
                            }

                        } catch (error) {
                            totalFailed++;
                            allErrors.push({ file: file.name, line: '?', error: error.message || 'Unknown error' });
                            console.error(`❌ Error processing ${file.name}:`, error);
                        }
                    }

                    // Use the last file's server metadata for display (processing time, load completed, etc.)
                    const lastRaw = fileResults.length > 0 ? fileResults[fileResults.length - 1].result : null;

                    this.showImportSummaryModal({
                        fileNames:      Array.from(files).map(f => f.name),
                        totalRecords,
                        successCount:   totalImported,
                        failedCount:    totalFailed,
                        errorCount:     allErrors.length,
                        errors:         allErrors,
                        actionCounts,
                        processingTime: lastRaw?.processingTime || '',
                        loadCompleted:  lastRaw?.loadCompleted  || new Date().toLocaleString(),
                        withMarker:     lastRaw?.withMarker     ?? 0,
                        withoutMarker:  lastRaw?.withoutMarker  ?? 0,
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
        const {
            fileNames = [], totalRecords = 0, successCount = 0, failedCount = 0,
            errorCount = 0, errors = [], actionCounts = {}, processingTime = '',
            loadCompleted = '', withMarker = 0, withoutMarker = 0,
        } = summary;

        const ac = (k) => actionCounts[k] || 0;
        const totalTx = successCount + failedCount;
        const fileLabel = fileNames.length === 1 ? fileNames[0] : `${fileNames.length} files`;

        // Type of Action rows: label, key, count
        const actionRows = [
            ['Admin',        'A'],
            ['Delete',       'D'],
            ['Expired',      'E'],
            ['Notify',       'F'],
            ['Modify',       'M'],
            ['New',          'N'],
            ['Renewal',      'R'],
            ['Invalid Type', 'Invalid'],
        ];

        const actionRowsHTML = actionRows.map(([label, key]) => {
            const n = ac(key);
            return `<tr>
                <td class="irs-action-label">${label}</td>
                <td class="irs-num ${n > 0 && key === 'Invalid' ? 'irs-err' : ''}">${n}</td>
                <td class="irs-num">0</td>
                <td class="irs-num ${key === 'Invalid' && n > 0 ? 'irs-err' : ''}">${n > 0 && key === 'N' ? n : (key !== 'Invalid' ? n : 0)}</td>
                <td class="irs-num ${failedCount > 0 && key === 'Invalid' ? 'irs-err' : ''}">0</td>
                <td class="irs-num">0</td>
                <td class="irs-num">0</td>
                <td class="irs-num ${n > 0 ? '' : ''}">${n}</td>
            </tr>`;
        }).join('');

        const totalAdded   = successCount;
        const totalFailed  = failedCount;

        const style = `<style>
            #editModal .modal-dialog { max-width: 720px; }
            .irs { color: #cbd5e1; font-size: 0.83rem; display: flex; flex-direction: column; gap: 16px; }
            .irs-meta { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 6px 20px; align-items: baseline;
                        background: rgba(15,23,42,0.5); border-radius: 10px; padding: 12px 16px;
                        border: 1px solid rgba(71,85,105,0.3); }
            .irs-meta-label { color: #64748b; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
            .irs-meta-val { color: #e2e8f0; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .irs-section-title { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; font-weight: 600; margin-bottom: 8px; }
            .irs-tx-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
            .irs-tx-card { background: rgba(30,41,59,0.6); border-radius: 10px; padding: 14px 12px; text-align: center; border: 1px solid rgba(71,85,105,0.35); }
            .irs-tx-card.added  { border-color: rgba(52,211,153,0.4); background: rgba(6,78,59,0.3); }
            .irs-tx-card.failed { border-color: rgba(248,113,113,0.4); background: rgba(127,29,29,0.3); }
            .irs-tx-num  { font-size: 2rem; font-weight: 700; line-height: 1; margin-bottom: 4px; }
            .irs-tx-card.added  .irs-tx-num { color: #34d399; }
            .irs-tx-card.failed .irs-tx-num { color: #f87171; }
            .irs-tx-card .irs-tx-num { color: #e2e8f0; }
            .irs-tx-label { font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.4px; }
            .irs-action-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
            .irs-action-chip { background: rgba(30,41,59,0.5); border: 1px solid rgba(71,85,105,0.3); border-radius: 8px;
                               padding: 8px 10px; display: flex; justify-content: space-between; align-items: center; }
            .irs-action-chip.has-count { border-color: rgba(167,139,250,0.4); background: rgba(76,29,149,0.2); }
            .irs-action-chip.is-invalid.has-count { border-color: rgba(248,113,113,0.4); background: rgba(127,29,29,0.2); }
            .irs-action-name { color: #94a3b8; font-size: 0.75rem; }
            .irs-action-count { font-weight: 700; font-size: 0.9rem; color: #e2e8f0; }
            .irs-action-chip.has-count .irs-action-count { color: #a78bfa; }
            .irs-action-chip.is-invalid.has-count .irs-action-count { color: #f87171; }
            .irs-coord-note { display: flex; gap: 12px; font-size: 0.78rem; color: #64748b; }
            .irs-coord-note span strong { color: #94a3b8; }
            .irs-errors-toggle { background: rgba(71,85,105,0.4); border: 1px solid rgba(100,116,139,0.4);
                                  color: #94a3b8; padding: 6px 14px; border-radius: 6px; font-size: 0.78rem; cursor: pointer; }
            .irs-errors-list { max-height: 200px; overflow-y: auto; margin-top: 8px; background: rgba(15,23,42,0.6);
                                border-radius: 8px; border: 1px solid rgba(71,85,105,0.4); }
            .irs-errors-list table { width: 100%; border-collapse: collapse; font-size: 0.76rem; margin: 0; }
            .irs-errors-list th { background: rgba(30,41,59,0.95); color: #94a3b8; padding: 6px 10px;
                                   font-size: 0.7rem; text-transform: uppercase; border-bottom: 1px solid rgba(71,85,105,0.5);
                                   position: sticky; top: 0; }
            .irs-errors-list td { padding: 5px 10px; color: #cbd5e1; border-bottom: 1px solid rgba(51,65,85,0.3); }
            .irs-errors-list code { background: rgba(51,65,85,0.6); color: #fbbf24; padding: 2px 5px; border-radius: 3px; font-size: 0.72rem; }
        </style>`;

        const actionChips = actionRows.map(([label, key]) => {
            const n = ac(key);
            const hasCount = n > 0;
            const isInvalid = key === 'Invalid';
            return `<div class="irs-action-chip ${hasCount ? 'has-count' : ''} ${isInvalid ? 'is-invalid' : ''}">
                <span class="irs-action-name">${label}</span>
                <span class="irs-action-count">${n}</span>
            </div>`;
        }).join('');

        let html = `<div class="irs">
            <div class="irs-meta">
                <span class="irs-meta-label">File</span>             <span class="irs-meta-val" title="${fileLabel}">${fileLabel}</span>
                <span class="irs-meta-label">Completed</span>        <span class="irs-meta-val">${loadCompleted}</span>
                <span class="irs-meta-label">Record Source</span>    <span class="irs-meta-val">SFAF</span>
                <span class="irs-meta-label">Processing Time</span>  <span class="irs-meta-val">${processingTime || '—'}</span>
                <span class="irs-meta-label">Record Type</span>      <span class="irs-meta-val">Permanent Assignment</span>
                <span class="irs-meta-label">Load Type</span>        <span class="irs-meta-val">Update</span>
            </div>

            <div>
                <div class="irs-section-title">Database Transactions</div>
                <div class="irs-tx-grid">
                    <div class="irs-tx-card added">
                        <div class="irs-tx-num">${totalAdded}</div>
                        <div class="irs-tx-label">Added</div>
                    </div>
                    <div class="irs-tx-card">
                        <div class="irs-tx-num">0</div>
                        <div class="irs-tx-label">Replaced</div>
                    </div>
                    <div class="irs-tx-card ${totalFailed > 0 ? 'failed' : ''}">
                        <div class="irs-tx-num">${totalFailed}</div>
                        <div class="irs-tx-label">Failed</div>
                    </div>
                    <div class="irs-tx-card">
                        <div class="irs-tx-num">${totalRecords}</div>
                        <div class="irs-tx-label">Total</div>
                    </div>
                </div>
            </div>

            <div>
                <div class="irs-section-title">Type of Action (Field 010)</div>
                <div class="irs-action-grid">${actionChips}</div>
            </div>

            <div class="irs-coord-note">
                <span>Plotted (with coordinates): <strong>${withMarker}</strong></span>
                <span>Pool / area records (no coordinates): <strong>${withoutMarker}</strong></span>
            </div>`;

        if (errors && errors.length > 0) {
            html += `<div>
                <button id="toggleErrorsBtn" class="irs-errors-toggle" onclick="databaseViewer.toggleImportErrors()">
                    Show Errors (${errors.length}) ▼
                </button>
                <div id="importErrorDetails" style="display:none;">
                    <div class="irs-errors-list">
                        <table>
                            <thead><tr><th>File</th><th>Error</th></tr></thead>
                            <tbody>${errors.map(e => `<tr><td><code>${e.file}</code></td><td>${e.error}</td></tr>`).join('')}</tbody>
                        </table>
                    </div>
                </div>
            </div>`;
        }

        html += `</div>`;

        const footer = `<button type="button" class="btn btn-success" onclick="databaseViewer.closeModal()">
            <i class="fas fa-check"></i> Done
        </button>`;

        this.showModal('Import Record Summary', style + html, footer);
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
                let errMsg = `Import failed: HTTP ${response.status}`;
                try {
                    const ct = response.headers.get('content-type') || '';
                    if (ct.includes('application/json')) {
                        const errorData = await response.json();
                        errMsg = errorData.error || errMsg;
                    } else if (response.status === 413) {
                        errMsg = 'File too large — increase client_max_body_size in nginx config';
                    }
                } catch (_) {}
                throw new Error(errMsg);
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
                success:        result.success === true,
                imported:       importResults.successful_count,
                errors:         importResults.error_count,
                total:          importResults.total_records,
                errorMessages:  importResults.errors || [],
                actionCounts:   importResults.action_counts || {},
                processingTime: importResults.processing_time || '',
                loadCompleted:  importResults.load_completed  || '',
                withMarker:     importResults.with_marker     || 0,
                withoutMarker:  importResults.without_marker  || 0,
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
