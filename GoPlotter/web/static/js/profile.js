/**
 * User Profile Page JavaScript
 * Handles section switching, form submissions, and API interactions
 */

(function() {
    'use strict';

    // Profile data cache
    let profileData = null;

    /**
     * Initialize profile page
     */
    function init() {
        console.log('🚀 Profile page initialized');
        loadProfileData();
        setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Section navigation
        document.querySelectorAll('.profile-nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const section = btn.getAttribute('data-section');
                switchSection(section);
            });
        });

        // Form submissions
        const accountForm = document.querySelector('#account-section .profile-form');
        if (accountForm) {
            accountForm.addEventListener('submit', (e) => {
                e.preventDefault();
                saveAccountInfo();
            });
        }
    }

    /**
     * Switch between profile sections
     */
    window.switchSection = function(sectionName) {
        // Update navigation
        document.querySelectorAll('.profile-nav-item').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-section') === sectionName) {
                btn.classList.add('active');
            }
        });

        // Update content sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });

        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
        }
    };

    /**
     * Load profile data from server
     */
    async function loadProfileData() {
        try {
            // Demo mode: Use localStorage data
            const username = localStorage.getItem('sfaf_username') || 'admin';
            const authMethod = localStorage.getItem('sfaf_auth_method') || 'password';

            // In production, fetch from API:
            // const response = await fetch('/api/user/profile', {
            //     headers: {
            //         'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            //     }
            // });
            // profileData = await response.json();

            // Demo data
            profileData = {
                username: username,
                email: `${username}@mail.mil`,
                fullName: username.replace('.', ' ').toUpperCase(),
                organization: 'U.S. Department of Defense',
                role: 'operator',
                authMethod: authMethod,
                createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() // 90 days ago
            };

            updateProfileUI(profileData);
        } catch (error) {
            console.error('Failed to load profile data:', error);
            showNotification('Failed to load profile data', 'error');
        }
    }

    /**
     * Update UI with profile data
     */
    function updateProfileUI(data) {
        // Sidebar
        const profileUsername = document.getElementById('profileUsername');
        const profileRole = document.getElementById('profileRole');
        const authMethod = document.getElementById('authMethod');

        if (profileUsername) {
            profileUsername.textContent = data.username;
        }

        if (profileRole) {
            profileRole.textContent = data.role.charAt(0).toUpperCase() + data.role.slice(1);
        }

        if (authMethod) {
            if (data.authMethod === 'pki') {
                authMethod.innerHTML = '<i class="fas fa-certificate"></i> PKI Certificate';
                authMethod.style.background = 'rgba(16, 185, 129, 0.1)';
                authMethod.style.color = '#10b981';
                authMethod.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            } else {
                authMethod.innerHTML = '<i class="fas fa-key"></i> Password Auth';
            }
        }

        // Account section
        document.getElementById('accountUsername').value = data.username;
        document.getElementById('accountEmail').value = data.email;
        document.getElementById('accountFullName').value = data.fullName;
        document.getElementById('accountOrganization').value = data.organization;
        document.getElementById('accountRole').value = data.role;

        // Format created date
        const createdDate = new Date(data.createdAt);
        document.getElementById('accountCreatedAt').value = createdDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    /**
     * Save account information
     */
    window.saveAccountInfo = async function() {
        const email = document.getElementById('accountEmail').value.trim();
        const fullName = document.getElementById('accountFullName').value.trim();
        const organization = document.getElementById('accountOrganization').value.trim();

        if (!email || !fullName) {
            showNotification('Email and full name are required', 'error');
            return;
        }

        try {
            // In production, send to API:
            // const response = await fetch('/api/user/profile', {
            //     method: 'PUT',
            //     headers: {
            //         'Content-Type': 'application/json',
            //         'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            //     },
            //     body: JSON.stringify({ email, fullName, organization })
            // });

            // Demo: Simulate API call
            await new Promise(resolve => setTimeout(resolve, 500));

            // Update local data
            profileData.email = email;
            profileData.fullName = fullName;
            profileData.organization = organization;

            showNotification('Account information updated successfully', 'success');
        } catch (error) {
            console.error('Failed to save account info:', error);
            showNotification('Failed to save account information', 'error');
        }
    };

    /**
     * Change password
     */
    window.changePassword = async function(event) {
        event.preventDefault();

        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            showNotification('All password fields are required', 'error');
            return;
        }

        if (newPassword.length < 8) {
            showNotification('New password must be at least 8 characters', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showNotification('New passwords do not match', 'error');
            return;
        }

        try {
            // In production, send to API:
            // const response = await fetch('/api/user/change-password', {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //         'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            //     },
            //     body: JSON.stringify({ currentPassword, newPassword })
            // });

            // Demo: Simulate API call
            await new Promise(resolve => setTimeout(resolve, 800));

            // Clear form
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';

            showNotification('Password changed successfully', 'success');
        } catch (error) {
            console.error('Failed to change password:', error);
            showNotification('Failed to change password', 'error');
        }
    };

    /**
     * Revoke all other sessions
     */
    window.revokeAllSessions = async function() {
        if (!confirm('Are you sure you want to revoke all other sessions? This will log you out from all other devices.')) {
            return;
        }

        try {
            // In production, send to API:
            // const response = await fetch('/api/user/revoke-sessions', {
            //     method: 'POST',
            //     headers: {
            //         'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            //     }
            // });

            // Demo: Simulate API call
            await new Promise(resolve => setTimeout(resolve, 500));

            showNotification('All other sessions have been revoked', 'success');
        } catch (error) {
            console.error('Failed to revoke sessions:', error);
            showNotification('Failed to revoke sessions', 'error');
        }
    };

    /**
     * Enable two-factor authentication
     */
    window.enableTwoFactor = async function() {
        // In production, this would open a modal with QR code and setup instructions
        showNotification('Two-factor authentication setup (demo mode)', 'info');

        // Demo: Show what would happen
        alert('In production, this would:\n\n1. Generate a QR code for authenticator app\n2. Ask you to scan and verify\n3. Provide backup codes\n4. Enable 2FA on your account');
    };

    /**
     * Save user preferences
     */
    window.savePreferences = async function() {
        const preferences = {
            darkMode: document.getElementById('prefDarkMode').checked,
            compactView: document.getElementById('prefCompactView').checked,
            emailNotif: document.getElementById('prefEmailNotif').checked,
            soundNotif: document.getElementById('prefSoundNotif').checked,
            defaultRegion: document.getElementById('prefDefaultRegion').value,
            markerClustering: document.getElementById('prefMarkerClustering').checked
        };

        try {
            // In production, send to API:
            // const response = await fetch('/api/user/preferences', {
            //     method: 'PUT',
            //     headers: {
            //         'Content-Type': 'application/json',
            //         'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            //     },
            //     body: JSON.stringify(preferences)
            // });

            // Demo: Save to localStorage
            localStorage.setItem('user_preferences', JSON.stringify(preferences));
            await new Promise(resolve => setTimeout(resolve, 400));

            showNotification('Preferences saved successfully', 'success');
        } catch (error) {
            console.error('Failed to save preferences:', error);
            showNotification('Failed to save preferences', 'error');
        }
    };

    /**
     * Upload certificate
     */
    window.uploadCertificate = function() {
        // In production, this would open a file picker and upload to API
        showNotification('Certificate upload (demo mode)', 'info');

        // Demo: Show what would happen
        alert('In production, this would:\n\n1. Open file picker for .pem/.crt file\n2. Parse certificate information\n3. Upload to server\n4. Validate and register certificate\n5. Enable PKI authentication');
    };

    /**
     * Handle logout
     */
    window.handleLogout = function() {
        if (confirm('Are you sure you want to logout?')) {
            // Clear local storage
            localStorage.removeItem('sfaf_logged_in');
            localStorage.removeItem('sfaf_username');
            localStorage.removeItem('sfaf_auth_method');
            localStorage.removeItem('auth_token');

            // In production, call logout API:
            // fetch('/api/auth/logout', {
            //     method: 'POST',
            //     headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
            // });

            // Redirect to landing page
            window.location.href = '/';
        }
    };

    /**
     * Show notification
     */
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 10001;
            padding: 16px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
            animation: slideInRight 0.3s ease-out;
            max-width: 400px;
        `;

        if (type === 'success') {
            notification.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            notification.style.color = 'white';
            notification.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
        } else if (type === 'error') {
            notification.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
            notification.style.color = 'white';
            notification.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        } else {
            notification.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
            notification.style.color = 'white';
            notification.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;
        }

        document.body.appendChild(notification);

        // Remove after 4 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
