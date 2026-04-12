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

});
