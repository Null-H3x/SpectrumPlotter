/**
 * Landing Page JavaScript
 * Handles login modal and module navigation
 */

(function() {
    'use strict';

    // Check if user is already logged in
    let isLoggedIn = false;

    /**
     * Initialize landing page
     */
    function init() {
        checkLoginStatus();
        setupEventListeners();
        console.log('🚀 Landing page initialized');
    }

    /**
     * Check if user is logged in
     */
    function checkLoginStatus() {
        const loggedIn = localStorage.getItem('sfaf_logged_in');
        const username = localStorage.getItem('sfaf_username');

        if (loggedIn === 'true' && username) {
            isLoggedIn = true;
            updateUIForLoggedInUser(username);
        }
    }

    /**
     * Update UI for logged in user
     */
    function updateUIForLoggedInUser(username) {
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.innerHTML = `<i class="fas fa-user"></i> ${username}`;
            loginBtn.onclick = logout;
        }

        // Show modules section
        const modulesSection = document.getElementById('modulesSection');
        if (modulesSection) {
            modulesSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn && !isLoggedIn) {
            loginBtn.addEventListener('click', openLoginModal);
        }

        // Close modal on background click
        const modal = document.getElementById('loginModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeLoginModal();
                }
            });
        }

        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeLoginModal();
            }
        });
    }

    /**
     * Open login modal
     */
    window.openLoginModal = function() {
        const modal = document.getElementById('loginModal');
        if (modal) {
            modal.classList.add('active');
            // Focus on username input
            setTimeout(() => {
                const usernameInput = document.getElementById('username');
                if (usernameInput) {
                    usernameInput.focus();
                }
            }, 100);
        }
    };

    /**
     * Close login modal
     */
    window.closeLoginModal = function() {
        const modal = document.getElementById('loginModal');
        if (modal) {
            modal.classList.remove('active');
        }
    };

    /**
     * Handle login form submission
     */
    window.handleLogin = function(event) {
        event.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('rememberMe').checked;

        if (!username || !password) {
            showNotification('Please enter both username and password', 'error');
            return;
        }

        // Demo login - in production, this would be an API call
        performLogin(username, rememberMe);
    };

    /**
     * Perform login
     */
    function performLogin(username, rememberMe) {
        // Simulate API call delay
        const submitBtn = document.querySelector('.btn-primary');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
        submitBtn.disabled = true;

        setTimeout(() => {
            // Save login state
            localStorage.setItem('sfaf_logged_in', 'true');
            localStorage.setItem('sfaf_username', username);

            if (rememberMe) {
                localStorage.setItem('sfaf_remember_me', 'true');
            }

            isLoggedIn = true;

            // Show success notification
            showNotification(`Welcome, ${username}!`, 'success');

            // Update UI
            updateUIForLoggedInUser(username);

            // Close modal
            closeLoginModal();

            // Reset form
            document.getElementById('loginForm').reset();
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;

            // Scroll to modules
            setTimeout(() => {
                const modulesSection = document.getElementById('modulesSection');
                if (modulesSection) {
                    modulesSection.scrollIntoView({ behavior: 'smooth' });
                }
            }, 500);
        }, 1000);
    }

    /**
     * Logout user
     */
    function logout() {
        if (confirm('Are you sure you want to logout?')) {
            const rememberMe = localStorage.getItem('sfaf_remember_me');

            if (rememberMe !== 'true') {
                localStorage.removeItem('sfaf_logged_in');
                localStorage.removeItem('sfaf_username');
            }

            isLoggedIn = false;

            // Update UI
            const loginBtn = document.getElementById('loginBtn');
            if (loginBtn) {
                loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
                loginBtn.onclick = openLoginModal;
            }

            showNotification('Logged out successfully', 'success');
        }
    }

    /**
     * Navigate to module
     */
    window.navigateToModule = function(path) {
        if (!isLoggedIn) {
            showNotification('Please login to access modules', 'error');
            openLoginModal();
            return;
        }

        // Navigate to module
        window.location.href = path;
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

    /**
     * Switch between login tabs
     */
    window.switchLoginTab = function(tab) {
        // Update tab buttons
        document.querySelectorAll('.login-tab').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.login-tab[data-tab="${tab}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.login-tab-content').forEach(content => {
            content.classList.remove('active');
        });

        if (tab === 'pki') {
            document.getElementById('pkiLoginTab').classList.add('active');
        } else {
            document.getElementById('passwordLoginTab').classList.add('active');
        }
    };

    /**
     * Handle certificate file upload
     */
    window.handleCertificateUpload = function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const certPEM = e.target.result;
            parseCertificate(certPEM);
        };
        reader.readAsText(file);
    };

    /**
     * Parse certificate and extract information
     */
    function parseCertificate(certPEM) {
        try {
            // Basic PEM validation
            if (!certPEM.includes('BEGIN CERTIFICATE')) {
                showNotification('Invalid certificate format', 'error');
                return;
            }

            // Extract certificate information (simplified for demo)
            const certInfo = extractCertInfo(certPEM);

            // Display certificate information
            document.getElementById('certCN').textContent = certInfo.commonName;
            document.getElementById('certOrg').textContent = certInfo.organization;
            document.getElementById('certEmail').textContent = certInfo.email;
            document.getElementById('certExpiry').textContent = certInfo.validUntil;

            document.getElementById('certInfo').style.display = 'block';
            document.getElementById('pkiLoginBtn').disabled = false;

            // Store certificate PEM for login
            window._certificatePEM = certPEM;

            showNotification('Certificate loaded successfully', 'success');
        } catch (error) {
            showNotification('Failed to parse certificate: ' + error.message, 'error');
        }
    }

    /**
     * Extract certificate information (simplified demo version)
     */
    function extractCertInfo(certPEM) {
        // This is a simplified extraction for demo purposes
        // In production, use proper X.509 parsing library or backend API
        return {
            commonName: 'DOE.JOHN.1234567890',
            organization: 'U.S. Department of Defense',
            email: 'john.doe@mail.mil',
            validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString()
        };
    }

    /**
     * Handle PKI login
     */
    window.handlePKILogin = async function(event) {
        event.preventDefault();

        if (!window._certificatePEM) {
            showNotification('Please upload a certificate first', 'error');
            return;
        }

        const submitBtn = document.getElementById('pkiLoginBtn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
        submitBtn.disabled = true;

        try {
            // In production, send certificate to backend for validation
            // const response = await fetch('/api/auth/pki-login', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ certificate_pem: window._certificatePEM })
            // });

            // Demo: Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Extract username from certificate CN
            const username = document.getElementById('certCN').textContent;

            // Save login state
            localStorage.setItem('sfaf_logged_in', 'true');
            localStorage.setItem('sfaf_username', username);
            localStorage.setItem('sfaf_auth_method', 'pki');

            isLoggedIn = true;

            // Show success notification
            showNotification(`PKI Authentication successful! Welcome, ${username}`, 'success');

            // Update UI
            updateUIForLoggedInUser(username);

            // Close modal
            closeLoginModal();

            // Reset form
            document.getElementById('pkiLoginForm').reset();
            document.getElementById('certInfo').style.display = 'none';
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = true;
            window._certificatePEM = null;

            // Scroll to modules
            setTimeout(() => {
                const modulesSection = document.getElementById('modulesSection');
                if (modulesSection) {
                    modulesSection.scrollIntoView({ behavior: 'smooth' });
                }
            }, 500);
        } catch (error) {
            showNotification('PKI authentication failed: ' + error.message, 'error');
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    };

    /**
     * Handle password login form submission
     */
    window.handlePasswordLogin = function(event) {
        event.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('rememberMe').checked;

        if (!username || !password) {
            showNotification('Please enter both username and password', 'error');
            return;
        }

        // Demo login - in production, this would be an API call
        performLogin(username, rememberMe);
    };

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
