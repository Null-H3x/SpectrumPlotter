// db_viewer_managers.js — ThemeManager, AccessibilityManager, PerformanceManager, initialization

class ThemeManager {
    constructor() {
        this.init();
    }

    init() {
        // Detect system theme preference
        this.detectSystemTheme();

        // Add theme toggle if desired
        this.addThemeToggle();
    }

    detectSystemTheme() {
        const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

        // Listen for theme changes
        darkModeQuery.addEventListener('change', (e) => {
            if (e.matches) {
                document.body.classList.add('dark-theme');
            } else {
                document.body.classList.remove('dark-theme');
            }
        });

        // Set initial theme
        if (darkModeQuery.matches) {
            document.body.classList.add('dark-theme');
        }
    }

    addThemeToggle() {
        const header = document.querySelector('.header-actions');
        if (header) {
            const themeToggle = document.createElement('button');
            themeToggle.className = 'btn btn-secondary';
            themeToggle.innerHTML = '<i class="fas fa-moon"></i> Theme';
            themeToggle.onclick = this.toggleTheme.bind(this);
            header.appendChild(themeToggle);
        }
    }

    toggleTheme() {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');

        // Save preference
        localStorage.setItem('preferred-theme', isDark ? 'dark' : 'light');

        // Update icon
        const icon = document.querySelector('.theme-toggle i');
        if (icon) {
            icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        }
    }
}


class AccessibilityManager {
    constructor() {
        this.init();
    }

    init() {
        this.addKeyboardNavigation();
        this.addScreenReaderSupport();
        this.addFocusManagement();
    }

    addKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+F for search
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                const searchInput = document.getElementById('markerSearch');
                if (searchInput) {
                    searchInput.focus();
                }
            }

            // Escape to close modals
            if (e.key === 'Escape') {
                window.databaseViewer?.closeModal();
            }

            // Arrow keys for table navigation
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                this.handleTableNavigation(e);
            }
        });
    }

    addScreenReaderSupport() {
        // Add ARIA labels and descriptions
        const tables = document.querySelectorAll('.data-table');
        tables.forEach(table => {
            table.setAttribute('role', 'table');
            table.setAttribute('aria-label', 'Database records table');
        });

        // Add live regions for status updates
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.className = 'sr-only';
        liveRegion.id = 'status-announcements';
        document.body.appendChild(liveRegion);
    }

    addFocusManagement() {
        // Trap focus in modals
        document.addEventListener('focusin', (e) => {
            const modal = document.querySelector('.modal[style*="block"]');
            if (modal && !modal.contains(e.target)) {
                const focusableElements = modal.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (focusableElements.length > 0) {
                    focusableElements[0].focus();
                }
            }
        });
    }

    announceStatus(message) {
        const liveRegion = document.getElementById('status-announcements');
        if (liveRegion) {
            liveRegion.textContent = message;
        }
    }

    handleTableNavigation(e) {
        const activeElement = document.activeElement;
        if (activeElement.closest('.data-table')) {
            // Implement table cell navigation logic
            e.preventDefault();
            // Add your table navigation logic here
        }
    }
}


class PerformanceManager {
    constructor() {
        this.init();
    }

    init() {
        this.addIntersectionObserver();
        this.addVirtualScrolling();
        this.optimizeAnimations();
    }

    addIntersectionObserver() {
        // Lazy load table content when it comes into view
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Load content for visible rows
                    this.loadRowContent(entry.target);
                }
            });
        }, {
            rootMargin: '50px'
        });

        // Observe table rows
        document.querySelectorAll('.table-row').forEach(row => {
            observer.observe(row);
        });
    }

    addVirtualScrolling() {
        // Implement virtual scrolling for large datasets
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer) {
            // Add virtual scrolling logic here for performance
        }
    }

    optimizeAnimations() {
        // Reduce animations based on user preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

        if (prefersReducedMotion.matches) {
            document.body.classList.add('reduced-motion');
        }
    }

    loadRowContent(row) {
        // Load any deferred content for the row
        const markerId = row.dataset.markerId;
        if (markerId && window.databaseViewer) {
            // Load additional data if needed
        }
    }
}

// ── Initialization ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    try {
        // Initialize session manager first
        const sessionManager = new SessionManager();

        // Get saved preferences
        const savedPrefs = sessionManager.getSessionPreferences();
        console.log('🔄 Loading session preferences:', savedPrefs);

        // Initialize core database viewer with session preferences
        window.databaseViewer = new DatabaseViewer();

        // Show session restoration notification
        if (savedPrefs.sessionCount > 0) {
            showSessionNotification(`Session restored: ${savedPrefs.activeTab} tab, ${savedPrefs.viewMode} view`, 'info');

            // Highlight restored tab briefly
            setTimeout(() => {
                const restoredTab = document.querySelector(`[data-tab="${savedPrefs.activeTab}"]`);
                if (restoredTab) {
                    restoredTab.classList.add('session-restored');
                    setTimeout(() => {
                        restoredTab.classList.remove('session-restored');
                    }, 1500);
                }
            }, 500);
        }

        // Initialize other components
        if (typeof ThemeManager !== 'undefined') {
            window.themeManager = new ThemeManager();
            console.log('🎨 Theme management enabled');
        }

        if (typeof AccessibilityManager !== 'undefined') {
            window.accessibilityManager = new AccessibilityManager();
            console.log('♿ Accessibility features active');
        }

        if (typeof PerformanceManager !== 'undefined') {
            window.performanceManager = new PerformanceManager();
            console.log('⚡ Performance optimizations applied');
        }

        // Update session indicator
        updateSessionIndicator(savedPrefs);

        // Mark SFAF tab as default
        const sfafTab = document.querySelector('[data-tab="sfaf"]');
        if (sfafTab) {
            sfafTab.classList.add('default-tab');
        }

        // Mark view mode selector if session is active
        const viewSelector = document.getElementById('sfafViewMode');
        if (viewSelector && savedPrefs.sessionCount > 0) {
            viewSelector.classList.add('session-active');
        }

        // Sync top scrollbar with table container
        const topScroll = document.getElementById('tableScrollTop');
        const topScrollInner = document.getElementById('tableScrollTopInner');
        const tableContainer = document.getElementById('tableContainer');

        if (topScroll && tableContainer) {
            const syncScrollWidth = () => {
                topScrollInner.style.width = tableContainer.scrollWidth + 'px';
            };
            syncScrollWidth();

            const resizeObserver = new ResizeObserver(syncScrollWidth);
            resizeObserver.observe(tableContainer);

            let syncing = false;
            topScroll.addEventListener('scroll', () => {
                if (syncing) return;
                syncing = true;
                tableContainer.scrollLeft = topScroll.scrollLeft;
                syncing = false;
            });
            tableContainer.addEventListener('scroll', () => {
                if (syncing) return;
                syncing = true;
                topScroll.scrollLeft = tableContainer.scrollLeft;
                syncing = false;
            });
        }

        console.log('✅ SFAF Plotter Database Viewer fully initialized');
        console.log('🏠 Default tab: SFAF Records');
        console.log('💾 Session management: Active');
        console.log('📱 Responsive design active for all screen sizes');

    } catch (error) {
        console.error('❌ Failed to initialize Database Viewer:', error);
        showErrorNotification('Database Viewer initialization failed. Please refresh the page.');
    }
});

// ── Session notification helpers ──────────────────────────────────────────────

function showSessionNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'session-notification';

    const iconMap = { info: '💾', success: '✅', error: '❌' };

    notification.innerHTML = `
        <span>${iconMap[type]} ${message}</span>
        <button class="close-btn" onclick="this.parentElement.remove()">&times;</button>
    `;

    document.body.appendChild(notification);

    setTimeout(() => { notification.classList.add('show'); }, 100);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentElement) notification.remove();
        }, 300);
    }, 4000);
}

function showErrorNotification(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed; top: 20px; right: 20px;
        background: linear-gradient(135deg, #e74c3c, #c0392b);
        color: white; padding: 15px 20px; border-radius: 8px; z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3); max-width: 400px;
    `;
    errorDiv.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:18px;">❌</span>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(errorDiv);
    setTimeout(() => { errorDiv.remove(); }, 6000);
}

function updateSessionIndicator(preferences) {
    const sessionInfo = document.getElementById('sessionInfo');
    if (sessionInfo) {
        sessionInfo.innerHTML = `
            <span class="session-info">
                <i class="fas fa-save"></i>
                Session: ${preferences.sessionCount}
                <span class="session-count">${preferences.sessionCount}</span>
            </span>
        `;
        sessionInfo.title = `Session ${preferences.sessionCount} - Last: ${preferences.lastAccessed ?
            new Date(preferences.lastAccessed).toLocaleString() : 'New session'}`;
    }
}

// ── Global onclick wrappers (backward compatibility) ──────────────────────────

function closeModal() {
    window.databaseViewer?.closeModal();
}

function editSFAFRecord(recordId) {
    window.databaseViewer?.editSFAFRecord(recordId);
}

function viewSFAFRecord(recordId) {
    window.databaseViewer?.viewSFAFRecord(recordId);
}

function exportSFAFRecord(recordId) {
    window.databaseViewer?.exportSFAFRecord(recordId);
}

function importSampleSFAFData() {
    window.databaseViewer?.importSampleSFAFData();
}

// ── Additional keyboard shortcuts ─────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+R to reset session
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        if (window.databaseViewer?.sessionManager) {
            if (confirm('Reset all session preferences to defaults?')) {
                window.databaseViewer.sessionManager.clearSessionData();
                showSessionNotification('Session preferences reset to defaults', 'success');
                setTimeout(() => location.reload(), 1000);
            }
        }
    }

    // Ctrl+Tab to cycle through tabs
    if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        const tabs = ['sfaf', 'irac', 'analytics'];
        const currentIndex = tabs.indexOf(window.databaseViewer?.currentTab);
        const nextIndex = (currentIndex + 1) % tabs.length;
        window.databaseViewer?.switchTab(tabs[nextIndex]);
    }
});

console.log('✅ SFAF Plotter Database Viewer session management loaded');
console.log('💾 Session persistence: Enabled');
console.log('⌨️ Keyboard shortcuts: Ctrl+Shift+R (reset), Ctrl+Tab (cycle tabs)');
