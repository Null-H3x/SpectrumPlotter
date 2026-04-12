// db_viewer_ui.js — Modal management, notifications, UI utilities

Object.assign(DatabaseViewer.prototype, {

    updateSelectAllCheckbox() {
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        const allCheckboxes = document.querySelectorAll('.row-checkbox');
        const checkedCheckboxes = document.querySelectorAll('.row-checkbox:checked');

        if (selectAllCheckbox && allCheckboxes.length > 0) {
            const allSelected = checkedCheckboxes.length === allCheckboxes.length;
            const someSelected = checkedCheckboxes.length > 0 && checkedCheckboxes.length < allCheckboxes.length;

            selectAllCheckbox.checked = allSelected;
            selectAllCheckbox.indeterminate = someSelected;
        }
    },

    showSuccess(message) {
        this.showNotification(message, 'success');
    },

    showError(message) {
        this.showNotification(message, 'error');
    },

    showWarning(message) {
        this.showNotification(message, 'warning');
    },

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : type === 'warning' ? '#f59e0b' : '#2196F3'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 400px;
            opacity: 0;
            transform: translateX(400px);
            transition: all 0.3s ease;
        `;

        // Add icon based on type
        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 18px;">${icon}</span>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 10);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 5000);

        // Add click to dismiss
        notification.addEventListener('click', () => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => notification.remove(), 300);
        });
    },

    showLoading(show, message = 'Loading...') {
        let loader = document.getElementById('globalLoader');

        if (show) {
            if (!loader) {
                loader = document.createElement('div');
                loader.id = 'globalLoader';
                loader.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 15000;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                `;

                loader.innerHTML = `
                    <div style="
                        background: white;
                        padding: 30px;
                        border-radius: 12px;
                        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                        text-align: center;
                        min-width: 200px;
                    ">
                        <div class="loading-spinner" style="
                            margin: 0 auto 20px;
                            width: 40px;
                            height: 40px;
                            border: 4px solid #f3f3f3;
                            border-top: 4px solid #3498db;
                            border-radius: 50%;
                            animation: spin 1s linear infinite;
                        "></div>
                        <div style="color: #333; font-weight: 500;">${message}</div>
                    </div>
                `;

                document.body.appendChild(loader);
            } else {
                loader.querySelector('div:last-child').textContent = message;
                loader.style.display = 'flex';
            }
        } else {
            if (loader) {
                loader.style.display = 'none';
            }
        }
    },

    closeModal() {
        const modal = document.getElementById('editModal');
        if (modal) {
            // Fade-out effect (Source: db_viewer_css.txt transitions)
            modal.style.opacity = '0';
            setTimeout(() => {
                modal.style.display = 'none';
            }, 200);

            // Reset modal content to prevent stale data (Source: db_viewer_html.txt modal structure)
            const modalTitle = document.getElementById('modalTitle');
            const modalBody = modal.querySelector('.modal-body');
            const editForm = document.getElementById('editForm');

            if (modalTitle) {
                modalTitle.textContent = 'Edit Record';
            }

            if (editForm) {
                editForm.innerHTML = '';
                editForm.onsubmit = null; // Remove event handlers
            }

            // Reset modal footer to default (Source: db_viewer_html.txt footer structure)
            const modalFooter = modal.querySelector('.modal-footer');
            if (modalFooter) {
                modalFooter.innerHTML = `
                <button type="button" class="btn btn-secondary" onclick="databaseViewer.closeModal()">Cancel</button>
                <button type="submit" form="editForm" class="btn btn-primary">Save Changes</button>
            `;
            }

            // Clear any stored data attributes
            delete modal.dataset.markerId;
            delete modal.dataset.recordId;
            delete modal.dataset.keyboardHandler;
            delete modal.dataset.clickHandler;

            // Clear validation highlights (Source: db_viewer_js.txt validation)
            document.querySelectorAll('.validation-error, .validation-warning').forEach(element => {
                element.classList.remove('validation-error', 'validation-warning');
            });

            document.querySelectorAll('.validation-error-msg').forEach(element => {
                element.remove();
            });

            // Remove event handlers
            document.removeEventListener('keydown', this.modalKeyboardHandler);
            modal.removeEventListener('click', this.modalClickHandler);

            console.log('✅ Modal closed and reset');
        }
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    safeElementClick(elementId) {
        const element = document.getElementById(elementId);
        if (!element) {
            console.error(`Element ${elementId} not found in DOM`);
            return false;
        }

        if (typeof element.click !== 'function') {
            console.error(`Element ${elementId} does not have click method`);
            return false;
        }

        element.click();
        return true;
    },

    safeUpdateElement(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        } else {
            console.warn(`Element ${elementId} not found in DOM`);
        }
    },

    showModal(title, content, footerButtons = null) {
        const modal = document.getElementById('editModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = modal.querySelector('.modal-body');

        if (!modal || !modalTitle || !modalBody) {
            console.error('❌ Modal elements not found in DOM');
            this.showError('Modal system not properly initialized');
            return;
        }

        // Set modal content (Source: db_viewer_html.txt modal structure)
        modalTitle.textContent = title;
        modalBody.innerHTML = content;

        // Set custom footer buttons if provided
        // Empty string '' clears the footer; null/undefined leaves HTML default intact
        if (footerButtons !== null && footerButtons !== undefined) {
            const modalFooter = modal.querySelector('.modal-footer');
            if (modalFooter) {
                modalFooter.innerHTML = footerButtons;
            }
        }

        // Show modal with fade-in effect (Source: db_viewer_css.txt modal styling)
        modal.style.display = 'block';
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 10);

        // Focus management for accessibility (Source: db_viewer_css.txt accessibility)
        const firstInput = modal.querySelector('input, select, textarea, button');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }

        // Add keyboard event handler for modal
        this.addModalKeyboardHandlers(modal);

        // Add click-outside-to-close functionality
        this.addModalClickOutsideHandler(modal);

        console.log(`📋 Modal opened: ${title}`);
    },

    viewOnMap(recordId) {
        try {
            console.log(`🗺️ Opening map view for record: ${recordId}`);

            // Find the record in current data
            const record = this.currentSFAFData?.find(r => r.id === recordId);
            if (!record) {
                this.showError('Record not found');
                return;
            }

            if (!record.coordinates?.lat || !record.coordinates?.lng) {
                this.showError('No valid coordinates available for this record');
                return;
            }

            // Construct URL to main map with marker focus (Source: main_go.txt route structure)
            const mapUrl = `/?focus=${record.coordinates.lat},${record.coordinates.lng}&marker=${record.id}&serial=${encodeURIComponent(record.serial)}`;

            // Open in new tab
            window.open(mapUrl, '_blank');

        } catch (error) {
            console.error('Failed to open map view:', error);
            this.showError('Failed to open map view');
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    addModalKeyboardHandlers(modal) {
        const keyboardHandler = (e) => {
            // ESC key to close modal
            if (e.key === 'Escape') {
                e.preventDefault();
                this.closeModal();
                document.removeEventListener('keydown', keyboardHandler);
            }

            // Tab key navigation within modal
            if (e.key === 'Tab') {
                const focusableElements = modal.querySelectorAll(
                    'input, select, textarea, button, [tabindex]:not([tabindex="-1"])'
                );

                if (focusableElements.length === 0) return;

                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];

                if (e.shiftKey && document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                } else if (!e.shiftKey && document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }

            // Enter key to submit form if modal contains a form
            if (e.key === 'Enter' && e.ctrlKey) {
                const submitButton = modal.querySelector('button[type="submit"], .btn-primary');
                if (submitButton) {
                    e.preventDefault();
                    submitButton.click();
                }
            }
        };

        document.addEventListener('keydown', keyboardHandler);

        // Store handler for cleanup
        modal.dataset.keyboardHandler = 'attached';
    },

    addModalClickOutsideHandler(modal) {
        const clickHandler = (e) => {
            // Check if click was on the modal backdrop (not the modal content)
            if (e.target === modal) {
                this.closeModal();
                modal.removeEventListener('click', clickHandler);
            }
        };

        modal.addEventListener('click', clickHandler);

        // Store handler for cleanup
        modal.dataset.clickHandler = 'attached';
    },

    showBulkActionsMenu() {
        if (this.selectedItems.size === 0) {
            alert('Please select at least one record to perform bulk actions.');
            return;
        }

        const actions = [
            'Export Selected',
            'Delete Selected',
            'Update Agency',
            'Update Status',
            'Generate Report'
        ];

        const action = prompt(`Selected ${this.selectedItems.size} record(s).\n\nChoose an action:\n${actions.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\nEnter number (1-${actions.length}):`);

        if (action) {
            const actionIndex = parseInt(action) - 1;
            if (actionIndex >= 0 && actionIndex < actions.length) {
                console.log(`Performing bulk action: ${actions[actionIndex]} on ${this.selectedItems.size} items`);

                switch (actionIndex) {
                    case 0:
                        this.exportSelectedRecords();
                        break;
                    case 1:
                        this.deleteSelectedRecords();
                        break;
                    default:
                        alert(`Bulk action "${actions[actionIndex]}" not yet implemented.`);
                }
            }
        }
    },

    getRecordFieldValue(record, field) {
        let value = '';

        // Check if this is an SFAF field (field100, field110, etc.)
        if (field.startsWith('field')) {
            // Access from sfafFields object
            value = record.sfafFields?.[field] || record.rawSFAFFields?.[field] || '';
        } else {
            // Handle non-SFAF fields
            switch (field) {
                case 'serial':
                    value = record.serial || record.id || '';
                    break;
                case 'frequency':
                    value = record.frequency || record.sfafFields?.field110 || '';
                    break;
                case 'emission':
                    value = record.emission || record.sfafFields?.field114 || '';
                    break;
                case 'power':
                    value = record.power || record.sfafFields?.field115 || '';
                    break;
                case 'location':
                    value = record.location || record.sfafFields?.field300 || `${record.latitude || ''},${record.longitude || ''}`;
                    break;
                case 'equipment':
                    value = record.equipment || record.sfafFields?.field340 || '';
                    break;
                case 'notes':
                    value = record.notes || '';
                    break;
                case 'marker_type':
                    value = record.marker_type || record.type || '';
                    break;
                case 'created_at':
                    value = record.created_at || record.createdAt || '';
                    break;
                default:
                    // Try direct property access as fallback
                    value = record[field] || '';
                    console.warn(`⚠️ Unknown field '${field}', attempting direct access. Value:`, value);
            }
        }

        console.log(`  getRecordFieldValue(${field}):`, value);
        return value;
    },

    viewRecordOnMap(recordId) {
        // Find the record details from enhanced records
        const record = this.enhancedRecords.find(r => r.id === recordId);

        if (!record) {
            alert('Could not find the record.');
            return;
        }

        // Check if record has coordinates
        if (!record.coordinates || !record.coordinates.lat || !record.coordinates.lng) {
            alert('This record does not have valid coordinates to display on the map.');
            return;
        }

        // Navigate to the map page with marker ID and coordinates as URL parameters
        const lat = record.coordinates.lat;
        const lng = record.coordinates.lng;
        const zoom = 13; // Close zoom level to focus on the marker

        // Redirect to map with parameters to center and highlight the marker
        window.location.href = `/?marker=${recordId}&lat=${lat}&lng=${lng}&zoom=${zoom}`;
    },

    viewSelectedOnMap() {
        if (this.selectedItems.size === 0) {
            alert('Please select at least one record to view on the map.');
            return;
        }

        console.log(`📍 Opening ${this.selectedItems.size} selected records on map...`);

        // Convert Set to Array for URL encoding
        const selectedIds = Array.from(this.selectedItems);

        // Store selected IDs in sessionStorage for map viewer to access
        sessionStorage.setItem('selectedRecordsForMap', JSON.stringify(selectedIds));

        // Navigate to map viewer
        window.location.href = '/';
    },

    toggleQueryPanel() {
        const panel = document.getElementById('advancedQueryPanel');
        if (panel) {
            if (panel.style.display === 'none' || !panel.style.display) {
                panel.style.display = 'block';
                this.updateDBQueryStats();
            } else {
                panel.style.display = 'none';
            }
        }
    }

});
