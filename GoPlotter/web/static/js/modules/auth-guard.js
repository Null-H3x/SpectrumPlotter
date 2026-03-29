// auth-guard.js — Role-based page access control
// Usage: requireRole(['admin']) or requireRole(['admin', 'operator'])

// Roles that can see the ISM Workbox nav link
const _ISM_NAV_ROLES = ['ism', 'command', 'combatant_command', 'agency', 'ntia', 'admin'];

// Auto-run: show .ism-nav-link elements for qualifying roles
document.addEventListener('DOMContentLoaded', async function () {
    try {
        const token = localStorage.getItem('sfaf_token') || getCookieValue('session_token');
        const headers = token ? { 'Authorization': token } : {};
        const res = await fetch('/api/auth/session', { headers });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.valid || !data.user) return;
        const role = data.user.role || 'operator';
        if (_ISM_NAV_ROLES.includes(role)) {
            document.querySelectorAll('.ism-nav-link').forEach(el => {
                el.style.display = '';
            });
        }
    } catch { /* non-critical — nav link stays hidden */ }
});

async function requireRole(allowedRoles) {
    try {
        const token = localStorage.getItem('sfaf_token') || getCookieValue('session_token');
        const headers = token ? { 'Authorization': token } : {};

        const res = await fetch('/api/auth/session', { headers });
        if (!res.ok) {
            window.location.href = '/';
            return;
        }

        const data = await res.json();
        if (!data.valid || !allowedRoles.includes(data.user?.role)) {
            window.location.href = '/?access=denied';
        }
    } catch {
        window.location.href = '/';
    }
}

function getCookieValue(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : '';
}
