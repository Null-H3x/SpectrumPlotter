// db_viewer_irac.js — IRAC notes rendering, selection, compliance analysis

Object.assign(DatabaseViewer.prototype, {

    renderIRACNotesView(iracNotes) {
        if (!iracNotes || iracNotes.length === 0) {
            return '';
        }

        let html = `
            <div class="irac-notes-view">
                <h4>IRAC Notes (Military Frequency Coordination)</h4>
                <div class="irac-notes-list-view">
        `;

        iracNotes.forEach(association => {
            const note = association.irac_note || association;
            html += `
                <div class="irac-note-view-item">
                    <div class="irac-note-header-view">
                        <span class="irac-code">${note.code}</span>
                        <span class="irac-category category-${note.category}">${note.category}</span>
                    </div>
                    <div class="irac-note-content-view">
                        <p class="irac-title">${note.title}</p>
                        <p class="irac-description">${note.description}</p>
                        <div class="irac-placement">
                            Field ${association.field_number}, Occurrence ${association.occurrence_number}
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div></div>';
        return html;
    },

    renderIRACNotesForEdit(iracNotes) {
        if (!iracNotes || iracNotes.length === 0) {
            return '';
        }

        let html = `
            <div class="irac-notes-section">
                <h4>IRAC Notes (Military Frequency Coordination)</h4>
                <div class="irac-notes-list">
        `;

        iracNotes.forEach((association, index) => {
            const note = association.irac_note || association;
            html += `
                <div class="irac-note-item">
                    <div class="irac-note-header">
                        <span class="irac-code">${note.code}</span>
                        <span class="irac-category category-${note.category}">${note.category}</span>
                        <button type="button" class="remove-irac-btn" onclick="databaseViewer.removeIRACNote('${association.id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="irac-note-content">
                        <p class="irac-title">${note.title}</p>
                        <p class="irac-description">${note.description}</p>
                        <div class="irac-placement">
                            Field ${association.field_number}, Occurrence ${association.occurrence_number}
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
                <button type="button" class="btn btn-secondary" onclick="databaseViewer.addIRACNoteModal()">
                    <i class="fas fa-plus"></i> Add IRAC Note
                </button>
            </div>
        `;

        return html;
    },

    openIRACNoteViewModal(note) {
        const modal = document.getElementById('editModal');
        const modalTitle = document.getElementById('modalTitle');
        const editForm = document.getElementById('editForm');

        modalTitle.textContent = `IRAC Note: ${note.code}`;

        // Display comprehensive IRAC note information (Source: models.txt IRACNote structure)
        editForm.innerHTML = `
            <div class="irac-note-details">
                <div class="info-section">
                    <h4>Note Information</h4>
                    <div class="info-grid">
                        <div class="info-item">
                            <label>Code:</label>
                            <span class="irac-code-display">${note.code}</span>
                        </div>
                        <div class="info-item">
                            <label>Category:</label>
                            <span class="category-badge category-${note.category}">${note.category}</span>
                        </div>
                        <div class="info-item">
                            <label>Field Placement:</label>
                            <span>Field ${note.field_placement}</span>
                        </div>
                        <div class="info-item">
                            <label>Created:</label>
                            <span>${new Date(note.created_at).toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div class="info-section">
                    <h4>Title</h4>
                    <div class="irac-title-display">${note.title}</div>
                </div>

                <div class="info-section">
                    <h4>Description</h4>
                    <div class="irac-description-display">${note.description}</div>
                </div>

                ${note.agency && note.agency.length > 0 ? `
                    <div class="info-section">
                        <h4>Applicable Agencies</h4>
                        <div class="agency-list">
                            ${note.agency.map(agency => `<span class="agency-tag">${agency}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}

                ${note.technical_specs ? `
                    <div class="info-section">
                        <h4>Technical Specifications</h4>
                        <div class="technical-specs">
                            <pre>${JSON.stringify(note.technical_specs, null, 2)}</pre>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        // Change modal footer for view mode
        const modalFooter = modal.querySelector('.modal-footer');
        modalFooter.innerHTML = `
            <button type="button" class="btn btn-secondary" onclick="databaseViewer.closeModal()">Close</button>
        `;

        modal.style.display = 'block';
    },

    openIRACNoteSelectionModal(iracNotes) {
        const modal = document.getElementById('editModal');
        const modalTitle = document.getElementById('modalTitle');
        const editForm = document.getElementById('editForm');

        modalTitle.textContent = 'Add IRAC Note';

        // Group notes by category for better organization (Source: models.txt categories)
        const categorizedNotes = {};
        iracNotes.forEach(note => {
            if (!categorizedNotes[note.category]) {
                categorizedNotes[note.category] = [];
            }
            categorizedNotes[note.category].push(note);
        });

        editForm.innerHTML = `
            <form id="addIRACForm">
                <div class="form-grid">
                    <div class="form-group">
                        <label>Category:</label>
                        <select id="iracCategory" onchange="databaseViewer.filterIRACNotesByCategory()">
                            <option value="">All Categories</option>
                            ${Object.keys(categorizedNotes).map(category =>
            `<option value="${category}">${category}</option>`
        ).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>IRAC Note:</label>
                        <select id="iracNoteSelect" required>
                            <option value="">Select IRAC Note</option>
                            ${iracNotes.map(note =>
            `<option value="${note.code}" data-category="${note.category}">${note.code} - ${note.title}</option>`
        ).join('')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Field Number:</label>
                        <select name="field_number" required>
                            <option value="">Select Field</option>
                            <option value="500">Field 500</option>
                            <option value="501">Field 501</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Occurrence Number:</label>
                        <input type="number" name="occurrence_number" min="1" max="30" required>
                        <small class="field-help">Field 500: max 10, Field 501: max 30 (MC4EB Pub 7 CHG 1)</small>
                    </div>
                </div>

                <div id="selectedNotePreview" class="note-preview" style="display: none;">
                    <!-- Note preview will be populated here -->
                </div>
            </form>
        `;

        // Add event listener for note selection preview
        document.getElementById('iracNoteSelect').addEventListener('change', (e) => {
            this.showIRACNotePreview(e.target.value, iracNotes);
        });

        // Update modal footer
        const modalFooter = modal.querySelector('.modal-footer');
        modalFooter.innerHTML = `
            <button type="button" class="btn btn-secondary" onclick="databaseViewer.closeModal()">Cancel</button>
            <button type="submit" form="addIRACForm" class="btn btn-primary">Add IRAC Note</button>
        `;

        // Handle form submission
        document.getElementById('addIRACForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submitIRACNoteAssociation(new FormData(e.target));
        });

        modal.style.display = 'block';
    },

    filterIRACNotesByCategory() {
        const categorySelect = document.getElementById('iracCategory');
        const noteSelect = document.getElementById('iracNoteSelect');
        const selectedCategory = categorySelect.value;

        // Show/hide options based on category
        Array.from(noteSelect.options).forEach(option => {
            if (option.value === '') {
                option.style.display = 'block'; // Always show "Select IRAC Note"
            } else if (selectedCategory === '' || option.dataset.category === selectedCategory) {
                option.style.display = 'block';
            } else {
                option.style.display = 'none';
            }
        });

        // Reset selection
        noteSelect.value = '';
        document.getElementById('selectedNotePreview').style.display = 'none';
    },

    showIRACNotePreview(noteCode, iracNotes) {
        const previewDiv = document.getElementById('selectedNotePreview');

        if (!noteCode) {
            previewDiv.style.display = 'none';
            return;
        }

        const note = iracNotes.find(n => n.code === noteCode);
        if (note) {
            previewDiv.innerHTML = `
                <h4>Selected Note Preview</h4>
                <div class="note-preview-content">
                    <p><strong>Code:</strong> ${note.code}</p>
                    <p><strong>Title:</strong> ${note.title}</p>
                    <p><strong>Category:</strong> ${note.category}</p>
                    <p><strong>Description:</strong> ${note.description}</p>
                </div>
            `;
            previewDiv.style.display = 'block';
        }
    },

    analyzeIRACCompliance(iracNotes) {
        return {
            totalNotes: iracNotes.length,
            categoryCoverage: [...new Set(iracNotes.map(n => n.category))],
            fieldCoverage: [...new Set(iracNotes.map(n => n.field_placement))],
            agencyCoverage: [...new Set(iracNotes.flatMap(n => n.agency || []))],
            averageDescriptionLength: iracNotes.reduce((sum, note) => sum + note.description.length, 0) / Math.max(iracNotes.length, 1),
            compliance: {
                hasRequiredCategories: [...new Set(iracNotes.map(n => n.category))].length >= 5,
                hasFieldCoverage: [...new Set(iracNotes.map(n => n.field_placement))].length >= 10,
                hasAgencyDiversity: [...new Set(iracNotes.flatMap(n => n.agency || []))].length >= 3
            }
        };
    }

},

    async loadIRACNotes() {
        try {
            const response = await fetch('/api/irac-notes');
            const data = await response.json();

            if (data.success && data.notes) {
                this.renderIRACTable(data.notes);
            }
        } catch (error) {
            console.error('Failed to load IRAC notes:', error);
            this.showError('Failed to load IRAC notes');
        }
    },

    async viewIRACNote(noteCode) {
        try {
            const response = await fetch(`/api/irac-notes?search=${noteCode}`);
            const data = await response.json();

            if (data.success && data.notes.length > 0) {
                const note = data.notes.find(n => n.code === noteCode);
                if (note) {
                    this.openIRACNoteViewModal(note);
                }
            }
        } catch (error) {
            console.error('Failed to load IRAC note details:', error);
            this.showError('Failed to load IRAC note details');
        }
    },

    async removeIRACNote(associationId) {
        if (!confirm('Remove this IRAC note association?')) return;

        try {
            const response = await fetch('/api/markers/irac-notes', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    association_id: associationId
                })
            });

            if (response.ok) {
                this.showSuccess('IRAC note removed successfully');
                // Refresh the current modal if it's open
                const modal = document.getElementById('editModal');
                if (modal.style.display === 'block') {
                    // Re-load the current marker data
                    const currentMarkerId = modal.dataset.markerId;
                    if (currentMarkerId) {
                        await this.editMarker(currentMarkerId);
                    }
                }
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Failed to remove IRAC note:', error);
            this.showError('Failed to remove IRAC note');
        }
    },

    async addIRACNoteModal() {
        try {
            // Load available IRAC notes (Source: handlers.txt GetIRACNotes)
            const response = await fetch('/api/irac-notes');
            const data = await response.json();

            if (data.success) {
                this.openIRACNoteSelectionModal(data.notes);
            }
        } catch (error) {
            console.error('Failed to load IRAC notes:', error);
            this.showError('Failed to load IRAC notes');
        }
    },

    async submitIRACNoteAssociation(formData) {
        const currentMarkerId = document.getElementById('editModal').dataset.markerId;
        if (!currentMarkerId) {
            this.showError('No marker selected');
            return;
        }

        try {
            const requestData = {
                marker_id: currentMarkerId,
                note_code: document.getElementById('iracNoteSelect').value,
                field_number: parseInt(formData.get('field_number')),
                occurrence_number: parseInt(formData.get('occurrence_number'))
            };

            // Use existing IRAC note association API (Source: handlers.txt)
            const response = await fetch('/api/markers/irac-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });

            if (response.ok) {
                const result = await response.json();
                this.showSuccess('IRAC note added successfully');
                this.closeModal();

                // Refresh the current tab data to show the new association
                await this.loadData();

                // If the marker edit modal was open, re-open it to show the new association
                if (currentMarkerId) {
                    setTimeout(() => {
                        this.editMarker(currentMarkerId);
                    }, 500);
                }
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Failed to add IRAC note association:', error);
            this.showError('Failed to add IRAC note: ' + error.message);
        }
    }

});
