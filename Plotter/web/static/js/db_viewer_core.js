// db_viewer_core.js — DatabaseViewer: class definition, constructor, initialization, tab management

class DatabaseViewer {
    constructor() {
        // ✅ Initialize session manager first
        this.sessionManager = new SessionManager();

        // ✅ Load user preferences from previous session
        const sessionPrefs = this.sessionManager.getSessionPreferences();

        // ✅ Set initial state from session or defaults
        this.currentTab = sessionPrefs.activeTab; // Will be 'sfaf' by default
        this.currentView = sessionPrefs.viewMode; // Will be 'summary' by default

        // Existing properties
        this.activeFilters = {};
        this.savedViews = this.loadSavedViews();
        this.customViews = this.loadCustomViews(); // Load custom user-defined views
        this.defaultView = this.loadDefaultView(); // Load user's default view preference
        this.editingViewId = null; // Track which view is being edited
        this.currentData = [];
        this.currentSFAFData = []; // ✅ Add SFAF-specific data array
        this.sfafFieldDefinitions = null;
        this.currentPage = 1;
        this.itemsPerPage = 50;
        this.currentSort = { field: 'serial', order: 'asc' };
        this.currentFilter = '';
        this.columnFilters = {}; // Stores filter values for each column
        this.enhancedRecords = []; // Store processed records for filtering/sorting
        // ✅ Load persisted selections instead of empty Set
        this.selectedItems = this.sessionManager.getSelectedItems(this.currentTab);

        // Query Builder state
        this.queryConditions = [];
        this.querySortOrder = 'asc';
        this.queryResults = [];

        // Initialize components
        this.initializeSFAFFileImport();
        this.init();

        console.log(`✅ DatabaseViewer initialized with session preferences:`, sessionPrefs);
    }

    canDelete() {
        const deletableRoles = ['ntia', 'admin'];
        return deletableRoles.includes(this.currentUserRole);
    }

    applyRolePermissions() {
        if (!this.canDelete()) {
            // Hide delete buttons from the toolbar
            ['deleteSelectedBtn', 'deleteAllBtn'].forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.style.display = 'none';
            });
        }
    }

    setupTableScrollIndicators() {
        const tableContainers = document.querySelectorAll('.table-container');

        tableContainers.forEach(container => {
            const checkScroll = () => {
                const hasHorizontalScroll = container.scrollWidth > container.clientWidth;

                if (hasHorizontalScroll) {
                    container.classList.add('has-scroll');
                } else {
                    container.classList.remove('has-scroll');
                }
            };

            // Check on load and resize
            checkScroll();
            window.addEventListener('resize', checkScroll);

            // Also check when content changes
            const observer = new MutationObserver(checkScroll);
            observer.observe(container, { childList: true, subtree: true });
        });
    }

    applySessionPreferences() {
        console.log(`🔄 Applying session preferences: tab=${this.currentTab}, view=${this.currentView}`);

        // Set active tab without triggering events
        this.setActiveTabUI(this.currentTab);

        // Set active view mode without triggering events
        this.setActiveViewMode(this.currentView);

        // Update tab content visibility
        this.updateTabContentVisibility();
    }

    setActiveTabUI(tabId) {
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabId) {
                btn.classList.add('active');
            }
        });

        // Store current tab
        this.currentTab = tabId;
    }

    setActiveViewMode(viewMode) {
        const viewSelector = document.getElementById('sfafViewMode');
        if (viewSelector && viewMode) {
            viewSelector.value = viewMode;
            this.currentView = viewMode;
        }
    }

    updateTabContentVisibility() {
        // Hide all tab content
        document.querySelectorAll('.tab-panel').forEach(content => {
            content.classList.remove('active');
        });

        // Show active tab content
        const activeContent = document.getElementById(`${this.currentTab}-tab`);
        if (activeContent) {
            activeContent.classList.add('active');
        }
    }

    saveCurrentState() {
        const currentState = {
            activeTab: this.currentTab,
            viewMode: this.currentView,
            currentPage: this.currentPage,
            itemsPerPage: this.itemsPerPage,
            activeFilters: { ...this.activeFilters },
            currentFilter: this.currentFilter
        };

        this.sessionManager.saveSessionPreferences(currentState);
    }

    setupEventListeners() {
        // Existing event listeners...

        // ✅ NEW: View mode change handler with session persistence
        const viewModeSelector = document.getElementById('sfafViewMode');
        if (viewModeSelector) {
            viewModeSelector.addEventListener('change', (e) => {
                const newViewMode = e.target.value;
                console.log(`🔄 View mode changed to: ${newViewMode}`);

                this.currentView = newViewMode;

                // ✅ If it's a custom view, load the custom view data
                if (newViewMode && newViewMode.startsWith('custom_')) {
                    const viewId = newViewMode.replace('custom_', '');
                    const view = this.customViews.find(v => v.id === viewId);
                    if (view) {
                        this.currentCustomView = view;
                        console.log(`✅ Loaded custom view: ${view.name}`);
                    } else {
                        console.warn(`⚠️ Custom view not found: ${viewId}`);
                    }
                } else {
                    // Clear custom view when switching to built-in view
                    this.currentCustomView = null;
                }

                // ✅ Save view mode preference to session
                this.sessionManager.updatePreference('viewMode', newViewMode);

                // Reload data with new view mode
                if (this.currentTab === 'sfaf') {
                    this.loadSFAFRecords();
                }

                console.log(`✅ View mode set to: ${newViewMode} (saved to session)`);
            });
        }

        // ✅ NEW: Session reset functionality (optional)
        const resetSessionBtn = document.getElementById('resetSessionBtn');
        if (resetSessionBtn) {
            resetSessionBtn.addEventListener('click', () => {
                if (confirm('Reset all session preferences to defaults?')) {
                    this.sessionManager.clearSessionData();
                    location.reload();
                }
            });
        }

        // Header refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadData();
            });
        }

        // Header export button
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportData();
            });
        }

        // Add SFAF record button
        const addSFAFRecordBtn = document.getElementById('addSFAFRecordBtn');
        if (addSFAFRecordBtn) {
            addSFAFRecordBtn.addEventListener('click', () => {
                this.addNewSFAFRecord();
            });
        }

        // Manage Views button
        const manageViewsBtn = document.getElementById('manageViewsBtn');
        if (manageViewsBtn) {
            manageViewsBtn.addEventListener('click', () => {
                this.openViewManagementModal();
            });
        }

        // Bulk actions button
        const bulkActionsBtn = document.getElementById('bulkActionsBtn');
        if (bulkActionsBtn) {
            bulkActionsBtn.addEventListener('click', () => {
                this.showBulkActionsMenu();
            });
        }

        // Import SFAF button
        const importSFAFBtn = document.getElementById('importSFAFBtn');
        if (importSFAFBtn) {
            importSFAFBtn.addEventListener('click', () => {
                document.getElementById('sfafImportFile').click();
            });
        }

        // Export selected button
        const exportSelectedBtn = document.getElementById('exportSelectedBtn');
        if (exportSelectedBtn) {
            exportSelectedBtn.addEventListener('click', () => {
                this.exportSelectedRecords();
            });
        }

        // Delete selected button
        const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
        if (deleteSelectedBtn) {
            deleteSelectedBtn.addEventListener('click', () => {
                this.deleteSelected();
            });
        }

        // Delete all button
        const deleteAllBtn = document.getElementById('deleteAllBtn');
        if (deleteAllBtn) {
            deleteAllBtn.addEventListener('click', () => {
                this.deleteAllSFAFs();
            });
        }

        // View on Map button
        const viewOnMapBtn = document.getElementById('viewOnMapBtn');
        if (viewOnMapBtn) {
            viewOnMapBtn.addEventListener('click', () => {
                this.viewSelectedOnMap();
            });
        }

        // Event delegation for row checkboxes (more reliable than inline handlers)
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('row-checkbox')) {
                // Get record ID from value attribute (most reliable)
                const recordId = e.target.value;
                if (recordId) {
                    this.toggleRowSelection(recordId, e.target.checked);
                }
            }
        });

        // Refresh SFAF button
        const refreshSFAFBtn = document.getElementById('refreshSFAFBtn');
        if (refreshSFAFBtn) {
            refreshSFAFBtn.addEventListener('click', () => {
                this.loadSFAFRecords();
            });
        }

        // Pagination buttons
        const firstPageBtn = document.getElementById('firstPageBtn');
        if (firstPageBtn) {
            firstPageBtn.addEventListener('click', () => {
                this.goToFirstPage();
            });
        }

        const prevSFAFPage = document.getElementById('prevSFAFPage');
        if (prevSFAFPage) {
            prevSFAFPage.addEventListener('click', () => {
                this.previousPage();
            });
        }

        const nextSFAFPage = document.getElementById('nextSFAFPage');
        if (nextSFAFPage) {
            nextSFAFPage.addEventListener('click', () => {
                this.nextPage();
            });
        }

        const lastPageBtn = document.getElementById('lastPageBtn');
        if (lastPageBtn) {
            lastPageBtn.addEventListener('click', () => {
                this.goToLastPage();
            });
        }

        // Records per page selector
        const recordsPerPage = document.getElementById('recordsPerPage');
        if (recordsPerPage) {
            recordsPerPage.addEventListener('change', (e) => {
                this.itemsPerPage = parseInt(e.target.value);
                this.currentPage = 1;
                this.loadData();
            });
        }

        // Search input
        const sfafRecordsSearch = document.getElementById('sfafRecordsSearch');
        if (sfafRecordsSearch) {
            sfafRecordsSearch.addEventListener('input', (e) => {
                this.currentFilter = e.target.value;
                this.currentPage = 1;
                this.loadData();
            });
        }

        // Filter selects
        const completionStatusFilter = document.getElementById('completionStatusFilter');
        if (completionStatusFilter) {
            completionStatusFilter.addEventListener('change', (e) => {
                this.activeFilters.completionStatus = e.target.value;
                this.currentPage = 1;
                this.loadData();
            });
        }

        const agencyFilter = document.getElementById('agencyFilter');
        if (agencyFilter) {
            agencyFilter.addEventListener('change', (e) => {
                this.activeFilters.agency = e.target.value;
                this.currentPage = 1;
                this.loadData();
            });
        }

        const frequencyBandFilter = document.getElementById('frequencyBandFilter');
        if (frequencyBandFilter) {
            frequencyBandFilter.addEventListener('change', (e) => {
                this.activeFilters.frequencyBand = e.target.value;
                this.currentPage = 1;
                this.loadData();
            });
        }

        const poolAssignmentFilter = document.getElementById('poolAssignmentFilter');
        if (poolAssignmentFilter) {
            poolAssignmentFilter.addEventListener('change', (e) => {
                this.activeFilters.poolAssignment = e.target.value;
                this.currentPage = 1;
                this.loadData();
            });
        }

        // Clear Filters button
        const clearFiltersBtn = document.getElementById('clearFiltersBtn');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                this.clearAllFilters();
            });
        }

        // Modal close button
        const modalCloseBtn = document.querySelector('.modal-close');
        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', () => {
                this.closeModal();
            });
        }

        // Close modal when clicking outside
        const modal = document.getElementById('editModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        }

        // Query Builder Event Listeners
        const advancedQueryBtn = document.getElementById('advancedQueryBtn');
        if (advancedQueryBtn) {
            advancedQueryBtn.addEventListener('click', () => {
                this.toggleQueryPanel();
            });
        }

        const addDBQueryBtn = document.getElementById('addDBQueryBtn');
        if (addDBQueryBtn) {
            addDBQueryBtn.addEventListener('click', () => {
                this.addDBFilterQuery();
            });
        }

        const applyDBFiltersBtn = document.getElementById('applyDBFiltersBtn');
        if (applyDBFiltersBtn) {
            applyDBFiltersBtn.addEventListener('click', () => {
                this.applyDBFilters();
            });
        }

        const clearDBFiltersBtn = document.getElementById('clearDBFiltersBtn');
        if (clearDBFiltersBtn) {
            clearDBFiltersBtn.addEventListener('click', () => {
                this.clearDBFilters();
            });
        }

        // Quick filter buttons in query panel
        document.querySelectorAll('#advancedQueryPanel .quick-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filterType = e.target.dataset.filter;
                this.applyQuickFilter(filterType);
            });
        });

        // Query Tab Event Listeners - Unified Interface
        const addConditionBtn = document.getElementById('addConditionBtn');
        if (addConditionBtn) {
            addConditionBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Add a small delay to prevent double-click issues
                if (this._addingCondition) {
                    console.log('⚠️ Already adding a condition, skipping duplicate');
                    return;
                }
                this._addingCondition = true;
                this.addQueryCondition();
                setTimeout(() => {
                    this._addingCondition = false;
                }, 300);
            });
        }

        const runQueryBtn = document.getElementById('runQueryBtn');
        if (runQueryBtn) {
            runQueryBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.runQuery();
            });
        }

        const clearQueryBtn = document.getElementById('clearQueryBtn');
        if (clearQueryBtn) {
            clearQueryBtn.addEventListener('click', () => {
                this.clearQuery();
            });
        }

        const saveQueryBtn = document.getElementById('saveQueryBtn');
        if (saveQueryBtn) {
            saveQueryBtn.addEventListener('click', () => {
                this.saveQueryToLibrary();
            });
        }

        // Sort order toggle
        const sortAscBtn = document.getElementById('sortAscBtn');
        const sortDescBtn = document.getElementById('sortDescBtn');
        if (sortAscBtn && sortDescBtn) {
            sortAscBtn.addEventListener('click', () => {
                sortAscBtn.classList.add('active');
                sortDescBtn.classList.remove('active');
                this.querySortOrder = 'asc';
            });
            sortDescBtn.addEventListener('click', () => {
                sortDescBtn.classList.add('active');
                sortAscBtn.classList.remove('active');
                this.querySortOrder = 'desc';
            });
        }

        // Existing event listeners continue...
    }

    setupTabNavigation() {
        document.querySelectorAll('.tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                this.switchTab(tabId);
            });
        });
    }

    switchTab(tabId) {
        console.log(`🔄 Switching to tab: ${tabId}`);

        // ✅ SAVE current tab's selections before switching
        this.sessionManager.saveSelectedItems(this.currentTab, this.selectedItems);

        // Update tab buttons
        document.querySelectorAll('.tab').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-panel').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabId}-tab`)?.classList.add('active');

        // Update internal state
        this.currentTab = tabId;
        this.currentPage = 1;

        // ✅ RESTORE new tab's selections
        this.selectedItems = this.sessionManager.getSelectedItems(tabId);

        // ✅ Save tab preference to session
        this.sessionManager.updatePreference('activeTab', tabId);

        // Load data for new tab
        this.loadData();

        console.log(`✅ Tab switched to: ${tabId}, restored ${this.selectedItems.size} selections (saved to session)`);
    }

    async init() {
        // Fetch current user role for permission-gated UI elements
        try {
            const sessionRes = await fetch('/api/auth/session');
            const sessionData = await sessionRes.json();
            this.currentUserRole = sessionData.user?.role || 'operator';
        } catch (_) {
            this.currentUserRole = 'operator';
        }

        await this.loadFieldLabels();
        this.setupEventListeners();
        this.setupTabNavigation();
        this.setupTableScrollIndicators();

        // Check for serial filter from Table Manager
        const filterData = sessionStorage.getItem('dbFilterSerials');
        if (filterData) {
            try {
                const { unitCode, serials } = JSON.parse(filterData);
                this.serialFilter = serials;
                console.log(`🔍 Applying serial filter for ${unitCode}:`, serials);
                sessionStorage.removeItem('dbFilterSerials');
            } catch (error) {
                console.error('Error parsing serial filter:', error);
            }
        }

        // ✅ Apply role-gated UI visibility
        this.applyRolePermissions();

        // ✅ Apply session preferences before loading data
        this.applySessionPreferences();

        // Override tab if specified in URL params (e.g. ?tab=analytics)
        const urlTab = new URLSearchParams(window.location.search).get('tab');
        if (urlTab) this.currentTab = urlTab;

        // ✅ Restore last query builder state
        this.restoreQueryState();

        // ✅ Populate query history sidebar
        this.renderQueryHistory();
        this.renderSavedQueries();

        // ✅ Ensure at least one condition row is present in Query Builder
        if (this.queryConditions.length === 0) {
            this.addQueryCondition();
        }

        // Initialize custom views and apply default view
        this.updateViewDropdown();
        this.applyDefaultView();

        await this.loadData();

        // ✅ Save initial session state
        this.saveCurrentState();
    }
}
