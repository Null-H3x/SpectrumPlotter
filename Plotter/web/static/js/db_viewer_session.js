// db_viewer_session.js — SessionManager: localStorage-based session/preference persistence

class SessionManager {
    constructor() {
        this.storageKeys = {
            activeTab: 'sfaf_plotter_active_tab',
            viewMode: 'sfaf_plotter_view_mode',
            lastSession: 'sfaf_plotter_last_session',
            userPreferences: 'sfaf_plotter_user_preferences',
            selectedItems: 'sfaf_plotter_selected_items'
        };
        this.defaultSettings = {
            activeTab: 'sfaf',  // ✅ SFAF Records as default
            viewMode: 'spreadsheet',  // ✅ All Fields as default view
            lastAccessed: null,
            sessionCount: 0
        };
    }

    // Get user's last session preferences
    getSessionPreferences() {
        try {
            const stored = localStorage.getItem(this.storageKeys.lastSession);
            if (stored) {
                const preferences = JSON.parse(stored);
                console.log('📂 Restored session preferences:', preferences);
                return { ...this.defaultSettings, ...preferences };
            }
        } catch (error) {
            console.warn('⚠️ Could not restore session preferences:', error);
        }

        console.log('📂 Using default session preferences');
        return { ...this.defaultSettings };
    }

    // Save current session state
    saveSessionPreferences(currentState) {
        try {
            const sessionData = {
                activeTab: currentState.activeTab || this.defaultSettings.activeTab,
                viewMode: currentState.viewMode || this.defaultSettings.viewMode,
                lastAccessed: new Date().toISOString(),
                sessionCount: (this.getSessionCount() || 0) + 1,
                userAgent: navigator.userAgent.substring(0, 50), // For debugging
                screenResolution: `${screen.width}x${screen.height}`
            };

            localStorage.setItem(this.storageKeys.lastSession, JSON.stringify(sessionData));
            console.log('💾 Session preferences saved:', sessionData);

            return true;
        } catch (error) {
            console.error('❌ Failed to save session preferences:', error);
            return false;
        }
    }

    // Get session usage count
    getSessionCount() {
        try {
            const stored = localStorage.getItem(this.storageKeys.lastSession);
            if (stored) {
                const data = JSON.parse(stored);
                return data.sessionCount || 0;
            }
        } catch (error) {
            console.warn('Could not get session count:', error);
        }
        return 0;
    }

    // Clear session data (for reset functionality)
    clearSessionData() {
        Object.values(this.storageKeys).forEach(key => {
            localStorage.removeItem(key);
        });
        console.log('🧹 Session data cleared');
    }

    // Get active tab preference
    getActiveTab() {
        const preferences = this.getSessionPreferences();
        return preferences.activeTab;
    }

    // Get view mode preference
    getViewMode() {
        const preferences = this.getSessionPreferences();
        return preferences.viewMode;
    }

    // Update specific preference
    updatePreference(key, value) {
        const current = this.getSessionPreferences();
        current[key] = value;
        this.saveSessionPreferences(current);
    }

    // Get persisted selections for current tab
    getSelectedItems(tabId) {
        try {
            const key = `${this.storageKeys.selectedItems}_${tabId}`;
            const stored = localStorage.getItem(key);
            return stored ? new Set(JSON.parse(stored)) : new Set();
        } catch (error) {
            console.warn('⚠️ Could not restore selections:', error);
            return new Set();
        }
    }

    // Save current selections
    saveSelectedItems(tabId, selectedSet) {
        try {
            const key = `${this.storageKeys.selectedItems}_${tabId}`;
            localStorage.setItem(key, JSON.stringify(Array.from(selectedSet)));
        } catch (error) {
            console.error('❌ Failed to save selections:', error);
        }
    }

    // Clear selections for a tab
    clearSelectedItems(tabId) {
        const key = `${this.storageKeys.selectedItems}_${tabId}`;
        localStorage.removeItem(key);
    }
}


