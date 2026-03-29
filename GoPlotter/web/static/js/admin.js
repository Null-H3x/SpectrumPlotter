// admin.js — User Management Admin Panel

// ─── Pay Grade & ISM Options ─────────────────────────────────────────────────

const PAY_GRADE_OPTIONS = {
    'Air Force':   ['E-1 — Airman Basic','E-2 — Airman','E-3 — Airman First Class','E-4 — Senior Airman','E-5 — Staff Sergeant','E-6 — Technical Sergeant','E-7 — Master Sergeant','E-8 — Senior Master Sergeant','E-9 — Chief Master Sergeant','O-1 — Second Lieutenant','O-2 — First Lieutenant','O-3 — Captain','O-4 — Major','O-5 — Lieutenant Colonel','O-6 — Colonel','O-7 — Brigadier General','O-8 — Major General','O-9 — Lieutenant General','O-10 — General'],
    'Space Force': ['E-1 — Specialist 1','E-2 — Specialist 2','E-3 — Specialist 3','E-4 — Specialist 4','E-5 — Sergeant','E-6 — Technical Sergeant','E-7 — Master Sergeant','E-8 — Senior Master Sergeant','E-9 — Chief Master Sergeant','O-1 — Second Lieutenant','O-2 — First Lieutenant','O-3 — Captain','O-4 — Major','O-5 — Lieutenant Colonel','O-6 — Colonel','O-7 — Brigadier General','O-8 — Major General','O-9 — Lieutenant General','O-10 — General of the Space Force'],
    'Army':        ['E-1 — Private','E-2 — Private Second Class','E-3 — Private First Class','E-4 — Specialist / Corporal','E-5 — Sergeant','E-6 — Staff Sergeant','E-7 — Sergeant First Class','E-8 — Master Sergeant / First Sergeant','E-9 — Sergeant Major','W-1 — Warrant Officer 1','W-2 — Chief Warrant Officer 2','W-3 — Chief Warrant Officer 3','W-4 — Chief Warrant Officer 4','W-5 — Chief Warrant Officer 5','O-1 — Second Lieutenant','O-2 — First Lieutenant','O-3 — Captain','O-4 — Major','O-5 — Lieutenant Colonel','O-6 — Colonel','O-7 — Brigadier General','O-8 — Major General','O-9 — Lieutenant General','O-10 — General'],
    'Navy':        ['E-1 — Seaman Recruit','E-2 — Seaman Apprentice','E-3 — Seaman','E-4 — Petty Officer Third Class','E-5 — Petty Officer Second Class','E-6 — Petty Officer First Class','E-7 — Chief Petty Officer','E-8 — Senior Chief Petty Officer','E-9 — Master Chief Petty Officer','W-1 — Warrant Officer','W-2 — Chief Warrant Officer 2','W-3 — Chief Warrant Officer 3','W-4 — Chief Warrant Officer 4','W-5 — Chief Warrant Officer 5','O-1 — Ensign','O-2 — Lieutenant Junior Grade','O-3 — Lieutenant','O-4 — Lieutenant Commander','O-5 — Commander','O-6 — Captain','O-7 — Rear Admiral (Lower Half)','O-8 — Rear Admiral (Upper Half)','O-9 — Vice Admiral','O-10 — Admiral'],
    'Marines':     ['E-1 — Private','E-2 — Private First Class','E-3 — Lance Corporal','E-4 — Corporal','E-5 — Sergeant','E-6 — Staff Sergeant','E-7 — Gunnery Sergeant','E-8 — Master Sergeant / First Sergeant','E-9 — Master Gunnery Sergeant / Sergeant Major','W-1 — Warrant Officer 1','W-2 — Chief Warrant Officer 2','W-3 — Chief Warrant Officer 3','W-4 — Chief Warrant Officer 4','W-5 — Chief Warrant Officer 5','O-1 — Second Lieutenant','O-2 — First Lieutenant','O-3 — Captain','O-4 — Major','O-5 — Lieutenant Colonel','O-6 — Colonel','O-7 — Brigadier General','O-8 — Major General','O-9 — Lieutenant General','O-10 — General'],
    'Coast Guard': ['E-1 — Seaman Recruit','E-2 — Seaman Apprentice','E-3 — Seaman','E-4 — Petty Officer Third Class','E-5 — Petty Officer Second Class','E-6 — Petty Officer First Class','E-7 — Chief Petty Officer','E-8 — Senior Chief Petty Officer','E-9 — Master Chief Petty Officer','O-1 — Ensign','O-2 — Lieutenant Junior Grade','O-3 — Lieutenant','O-4 — Lieutenant Commander','O-5 — Commander','O-6 — Captain','O-7 — Rear Admiral (Lower Half)','O-8 — Rear Admiral (Upper Half)','O-9 — Vice Admiral','O-10 — Admiral'],
    'Civilian':    ['GS-1','GS-2','GS-3','GS-4','GS-5','GS-6','GS-7','GS-8','GS-9','GS-10','GS-11','GS-12','GS-13','GS-14','GS-15','SES — Senior Executive Service'],
    'Contractor':  ['CTR — Contractor'],
};

let allAdminInstallations = [];

function updateAdminPayGradeDropdown(branch, savedValue) {
    const sel = document.getElementById('fieldPayGrade');
    if (!sel) return;
    const opts = PAY_GRADE_OPTIONS[branch];
    if (!opts) {
        sel.innerHTML = '<option value="">— Select Branch First —</option>';
        return;
    }
    sel.innerHTML = '<option value="">— Select Pay Grade —</option>' +
        opts.map(label => {
            const value = label.split(' — ')[0];
            return `<option value="${value}"${value === savedValue ? ' selected' : ''}>${label}</option>`;
        }).join('');
    if (savedValue) sel.value = savedValue;
}

function updateAdminISMDropdown(savedValue) {
    const sel = document.getElementById('fieldDefaultISM');
    if (!sel) return;
    sel.innerHTML = '<option value="">— None —</option>' +
        allAdminInstallations.map(i =>
            `<option value="${i.id}">${i.name}${i.code ? ' (' + i.code + ')' : ''}</option>`
        ).join('');
    if (savedValue) sel.value = savedValue;
}

function onAdminBranchChange() {
    const branch = document.getElementById('fieldServiceBranch').value;
    updateAdminPayGradeDropdown(branch, null);
}

let allUsers = [];
let allRequests = {};
let editingUserId = null;
let pendingRequestId = null;
let selectedExistingUnitId = null;
let unitReviewDebounceTimer = null;

// ─── Init ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    await requireRole(['admin']);
    loadUsers();
    loadAccountRequests();
    loadAdminInstallations();
});

async function loadAdminInstallations() {
    try {
        const res  = await fetch('/api/auth/public-installations');
        const data = await res.json();
        allAdminInstallations = data.installations || [];
    } catch (_) { /* ISM dropdown will just be empty */ }
}

// ─── API ─────────────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
    const token = localStorage.getItem('sfaf_token') || getCookie('session_token');
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = token;

    const res = await fetch(path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : '';
}

// ─── Load & Render ────────────────────────────────────────────────────────────

async function loadUsers() {
    try {
        const data = await apiFetch('/api/admin/users');
        allUsers = data.users || [];
        updateStats();
        renderTable(allUsers);
    } catch (err) {
        showToast('Failed to load users: ' + err.message, 'error');
        document.getElementById('usersTableBody').innerHTML =
            `<tr class="loading-row"><td colspan="9"><i class="fas fa-exclamation-triangle"></i> ${err.message}</td></tr>`;
    }
}

const ROLE_LEVEL = { operator: 1, ism: 2, command: 3, combatant_command: 4, agency: 5, ntia: 6, admin: 7 };

const ROLE_LABELS = {
    admin:             'Admin',
    ntia:              'NTIA',
    agency:            'Agency',
    combatant_command: 'Combatant Cmd',
    command:           'Command',
    ism:               'ISM',
    operator:          'Operator',
};

function roleLabel(role) {
    return ROLE_LABELS[role] || role;
}

function updateStats() {
    const active = allUsers.filter(u => u.is_active);
    document.getElementById('statTotal').textContent = allUsers.length;
    document.getElementById('statActive').textContent = active.length;
    document.getElementById('statAdmins').textContent = allUsers.filter(u => u.role === 'admin').length;
    // "ISM+" = ISM level and above, excluding admin
    document.getElementById('statOperators').textContent =
        allUsers.filter(u => (ROLE_LEVEL[u.role] || 0) >= ROLE_LEVEL.ism && u.role !== 'admin').length;
}

function renderTable(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!users.length) {
        tbody.innerHTML = `<tr class="loading-row"><td colspan="9"><i class="fas fa-users-slash"></i> No users found</td></tr>`;
        return;
    }

    tbody.innerHTML = users.map(u => `
        <tr class="${u.is_active ? '' : 'row-inactive'}">
            <td>
                <div class="user-cell">
                    <div class="user-avatar"><i class="fas fa-user"></i></div>
                    <div>
                        <strong>${escHtml(u.username)}</strong>
                        <small>${escHtml(u.full_name)}</small>
                    </div>
                </div>
            </td>
            <td>${escHtml(u.email)}</td>
            <td>${escHtml(u.organization || '—')}</td>
            <td>${u.installation_name ? `<span title="${escHtml(u.installation_name)}"><i class="fas fa-map-marker-alt" style="color:#60a5fa;margin-right:4px"></i>${escHtml(u.installation_name)}</span>` : '<span class="muted">—</span>'}</td>
            <td>${u.primary_unit_name ? `<span title="${escHtml(u.primary_unit_code || '')}"><i class="fas fa-flag" style="color:#34d399;margin-right:4px"></i>${escHtml(u.primary_unit_name)}</span>` : '<span class="muted">—</span>'}</td>
            <td><span class="role-badge role-${u.role}">${roleLabel(u.role)}</span></td>
            <td><span class="status-badge ${u.is_active ? 'status-active' : 'status-inactive'}">
                ${u.is_active ? 'Active' : 'Inactive'}
            </span></td>
            <td>${u.last_login ? formatDate(u.last_login) : '<span class="muted">Never</span>'}</td>
            <td class="actions-cell">
                <button class="btn-icon btn-edit" title="Edit" onclick="openEditModal(${JSON.stringify(u).replace(/"/g, '&quot;')})">
                    <i class="fas fa-pen"></i>
                </button>
                ${u.is_active
                    ? `<button class="btn-icon btn-deactivate" title="Deactivate" onclick="deactivateUser('${u.id}', '${escHtml(u.username)}')">
                            <i class="fas fa-user-slash"></i>
                       </button>`
                    : `<button class="btn-icon btn-activate" title="Reactivate" onclick="reactivateUser('${u.id}', '${escHtml(u.username)}')">
                            <i class="fas fa-user-check"></i>
                       </button>`
                }
            </td>
        </tr>
    `).join('');
}

// ─── Filters ─────────────────────────────────────────────────────────────────

function filterUsers() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const role = document.getElementById('roleFilter').value;
    const status = document.getElementById('statusFilter').value;

    const filtered = allUsers.filter(u => {
        const matchSearch = !search ||
            u.username.toLowerCase().includes(search) ||
            u.full_name.toLowerCase().includes(search) ||
            u.email.toLowerCase().includes(search);
        const matchRole = !role || u.role === role;
        const matchStatus = !status ||
            (status === 'active' && u.is_active) ||
            (status === 'inactive' && !u.is_active);
        return matchSearch && matchRole && matchStatus;
    });

    renderTable(filtered);
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function openCreateModal() {
    editingUserId = null;
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-user-plus"></i> New User';
    document.getElementById('userForm').reset();
    document.getElementById('fieldUsername').disabled = false;
    document.getElementById('passwordGroup').style.display = '';
    document.getElementById('fieldPassword').required = true;
    document.getElementById('submitBtn').innerHTML = '<i class="fas fa-save"></i> Create User';
    updateAdminPayGradeDropdown('', null);
    updateAdminISMDropdown(null);
    document.getElementById('userModal').style.display = 'flex';
}

function openEditModal(user) {
    editingUserId = user.id;
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-user-edit"></i> Edit User';
    document.getElementById('fieldUsername').value = user.username;
    document.getElementById('fieldUsername').disabled = true;
    document.getElementById('fieldFullName').value = user.full_name;
    document.getElementById('fieldEmail').value = user.email;
    document.getElementById('fieldPhone').value = user.phone || '';
    document.getElementById('fieldPhoneDSN').value = user.phone_dsn || '';
    document.getElementById('fieldOrganization').value = user.organization || '';
    document.getElementById('fieldRole').value = user.role;
    document.getElementById('fieldServiceBranch').value = user.service_branch || '';
    updateAdminPayGradeDropdown(user.service_branch || '', user.pay_grade || '');
    updateAdminISMDropdown(user.default_ism_office || '');
    document.getElementById('passwordGroup').style.display = '';
    document.getElementById('fieldPassword').required = false;
    document.getElementById('fieldPassword').placeholder = 'Leave blank to keep current password';
    document.getElementById('submitBtn').innerHTML = '<i class="fas fa-save"></i> Save Changes';
    document.getElementById('userModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('userModal').style.display = 'none';
    editingUserId = null;
}

async function submitUserForm(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;

    try {
        if (editingUserId) {
            const pw = document.getElementById('fieldPassword').value;
            const payload = {
                email: document.getElementById('fieldEmail').value,
                full_name: document.getElementById('fieldFullName').value,
                phone: document.getElementById('fieldPhone').value || null,
                phone_dsn: document.getElementById('fieldPhoneDSN').value || null,
                organization: document.getElementById('fieldOrganization').value,
                role: document.getElementById('fieldRole').value,
                service_branch: document.getElementById('fieldServiceBranch').value || null,
                pay_grade: document.getElementById('fieldPayGrade').value || null,
                default_ism_office: document.getElementById('fieldDefaultISM').value || null,
            };
            if (pw) payload.password = pw;
            await apiFetch(`/api/admin/users/${editingUserId}`, {
                method: 'PUT',
                body: JSON.stringify(payload),
            });
            showToast('User updated successfully', 'success');
        } else {
            await apiFetch('/api/admin/users', {
                method: 'POST',
                body: JSON.stringify({
                    username: document.getElementById('fieldUsername').value,
                    password: document.getElementById('fieldPassword').value,
                    email: document.getElementById('fieldEmail').value,
                    full_name: document.getElementById('fieldFullName').value,
                    phone: document.getElementById('fieldPhone').value || null,
                    phone_dsn: document.getElementById('fieldPhoneDSN').value || null,
                    organization: document.getElementById('fieldOrganization').value,
                    role: document.getElementById('fieldRole').value,
                    service_branch: document.getElementById('fieldServiceBranch').value || null,
                    pay_grade: document.getElementById('fieldPayGrade').value || null,
                    default_ism_office: document.getElementById('fieldDefaultISM').value || null,
                }),
            });
            showToast('User created successfully', 'success');
        }
        closeModal();
        loadUsers();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

// ─── Actions ─────────────────────────────────────────────────────────────────

async function deactivateUser(id, username) {
    if (!confirm(`Deactivate user "${username}"? They will no longer be able to log in.`)) return;
    try {
        await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
        showToast(`${username} deactivated`, 'success');
        loadUsers();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function reactivateUser(id, username) {
    try {
        await apiFetch(`/api/admin/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ is_active: true }),
        });
        showToast(`${username} reactivated`, 'success');
        loadUsers();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleLogout() {
    try {
        await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
        localStorage.clear();
        window.location.href = '/';
    }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function escHtml(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
}

function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast toast-${type}`;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3500);
}

// Close modal on overlay click
document.getElementById('userModal').addEventListener('click', e => {
    if (e.target === document.getElementById('userModal')) closeModal();
});

// ─── Tab Switching ────────────────────────────────────────────────────────────

function switchTab(name) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
}

// ─── Account Requests ─────────────────────────────────────────────────────────

async function loadAccountRequests() {
    const status = document.getElementById('reqStatusFilter')?.value ?? 'pending';
    const tbody = document.getElementById('requestsTableBody');
    tbody.innerHTML = `<tr class="loading-row"><td colspan="7"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>`;
    try {
        const data = await apiFetch(`/api/admin/account-requests?status=${status}`);
        const reqs = data.requests || [];

        // Update pending badge
        const pending = status === '' ? reqs.filter(r => r.status === 'pending').length : (status === 'pending' ? reqs.length : null);
        const badge = document.getElementById('pendingBadge');
        if (pending !== null && pending > 0) {
            badge.textContent = pending;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }

        if (!reqs.length) {
            tbody.innerHTML = `<tr class="loading-row"><td colspan="7"><i class="fas fa-inbox"></i> No requests found</td></tr>`;
            return;
        }

        allRequests = {};
        tbody.innerHTML = reqs.map(r => {
            allRequests[r.id] = r;
            const approveBtn = r.requested_unit_name
                ? `<button class="btn-icon btn-review" title="Review Unit & Approve" onclick="openUnitReviewModal('${r.id}')">
                       <i class="fas fa-search-plus"></i>
                   </button>`
                : `<button class="btn-icon btn-activate" title="Approve" onclick="openApproveModal('${r.id}', '${escHtml(r.username)}', '${escHtml(r.full_name)}')">
                       <i class="fas fa-check"></i>
                   </button>`;
            return `
            <tr>
                <td>
                    <div class="user-cell">
                        <div class="user-avatar"><i class="fas fa-user-clock"></i></div>
                        <div>
                            <strong>${escHtml(r.username)}</strong>
                            <small>${escHtml(r.full_name)}</small>
                            <small style="color:var(--text-muted)">${escHtml(r.email)}${r.phone ? ' · ' + escHtml(r.phone) : ''}</small>
                        </div>
                    </div>
                </td>
                <td>
                    ${escHtml(r.organization || '—')}
                    ${r.unified_command ? `<br><small style="color:var(--text-muted)"><i class="fas fa-globe"></i> ${escHtml(r.unified_command)}</small>` : ''}
                    ${r.unit_id ? `<br><small style="color:var(--accent)"><i class="fas fa-flag"></i> ${escHtml(r.unit || 'Unit selected')}</small>` : ''}
                    ${r.requested_unit_name ? `<br><small style="color:#ffa726"><i class="fas fa-plus-circle"></i> New: ${escHtml(r.requested_unit_name)}</small>` : ''}
                    ${r.installation_id ? `<br><small style="color:#80cbc4"><i class="fas fa-map-marker-alt"></i> Installation assigned</small>` : ''}
                </td>
                <td><span class="role-badge role-${r.requested_role}">${roleLabel(r.requested_role)}</span></td>
                <td class="justification-cell">${escHtml(r.justification || '—')}</td>
                <td>${formatDate(r.created_at)}</td>
                <td><span class="status-badge status-req-${r.status}">${r.status}</span></td>
                <td class="actions-cell">
                    ${r.status === 'pending' ? `
                        ${approveBtn}
                        <button class="btn-icon btn-deactivate" title="Deny" onclick="openDenyModal('${r.id}', '${escHtml(r.username)}')">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : `<span style="color:var(--text-muted);font-size:0.8rem">${r.status}</span>`}
                </td>
            </tr>`;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr class="loading-row"><td colspan="7"><i class="fas fa-exclamation-triangle"></i> ${escHtml(err.message)}</td></tr>`;
    }
}

// ─── Approve Modal ────────────────────────────────────────────────────────────

function openApproveModal(id, username, fullName) {
    pendingRequestId = id;
    document.getElementById('approveInfo').textContent = `Approving request for ${fullName} (${username}). This will create their account immediately.`;
    document.getElementById('approveTempPassword').value = '';
    document.getElementById('approveNotes').value = '';
    document.getElementById('approveResult').style.display = 'none';
    document.getElementById('approveSubmitBtn').disabled = false;
    document.getElementById('approveModal').style.display = 'flex';
}

function closeApproveModal() {
    document.getElementById('approveModal').style.display = 'none';
    pendingRequestId = null;
}

async function submitApproval() {
    const btn = document.getElementById('approveSubmitBtn');
    const result = document.getElementById('approveResult');
    btn.disabled = true;
    try {
        const data = await apiFetch(`/api/admin/account-requests/${pendingRequestId}/approve`, {
            method: 'POST',
            body: JSON.stringify({
                temp_password: document.getElementById('approveTempPassword').value,
                notes: document.getElementById('approveNotes').value,
            }),
        });
        result.className = 'approve-result approve-success';
        result.innerHTML = `<i class="fas fa-check-circle"></i> Account created for <strong>${escHtml(data.user?.username)}</strong>.
            Temporary password: <code style="background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:4px">${escHtml(data.temp_password)}</code>
            ${data.unit_note ? `<br><br><i class="fas fa-exclamation-triangle" style="color:#ffa726"></i> <strong style="color:#ffa726">Unit action required:</strong> ${escHtml(data.unit_note)}` : ''}`;
        result.style.display = 'block';
        btn.innerHTML = '<i class="fas fa-check"></i> Done';
        loadAccountRequests();
        loadUsers();
    } catch (err) {
        result.className = 'approve-result approve-error';
        result.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + escHtml(err.message);
        result.style.display = 'block';
        btn.disabled = false;
    }
}

// ─── Deny Modal ───────────────────────────────────────────────────────────────

function openDenyModal(id, username) {
    pendingRequestId = id;
    document.getElementById('denyInfo').textContent = `Deny the account request from "${username}"?`;
    document.getElementById('denyNotes').value = '';
    document.getElementById('denySubmitBtn').disabled = false;
    document.getElementById('denyModal').style.display = 'flex';
}

function closeDenyModal() {
    document.getElementById('denyModal').style.display = 'none';
    pendingRequestId = null;
}

async function submitDenial() {
    const btn = document.getElementById('denySubmitBtn');
    btn.disabled = true;
    try {
        await apiFetch(`/api/admin/account-requests/${pendingRequestId}/deny`, {
            method: 'POST',
            body: JSON.stringify({ notes: document.getElementById('denyNotes').value }),
        });
        showToast('Request denied', 'success');
        closeDenyModal();
        loadAccountRequests();
    } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
    }
}

// ─── Unit Review Modal ────────────────────────────────────────────────────────

function openUnitReviewModal(requestId) {
    const req = allRequests[requestId];
    if (!req) return;
    pendingRequestId = requestId;
    selectedExistingUnitId = null;

    document.getElementById('unitReviewApplicantInfo').innerHTML = `
        <strong>${escHtml(req.full_name)}</strong> (${escHtml(req.username)})
        &nbsp;·&nbsp; ${escHtml(req.email)}
        ${req.organization ? `&nbsp;·&nbsp; <strong>${escHtml(req.organization)}</strong>` : ''}
        ${req.unified_command ? `&nbsp;·&nbsp; ${escHtml(req.unified_command)}` : ''}
        <br><small style="color:#ffa726"><i class="fas fa-plus-circle"></i> Requesting new unit: <strong>${escHtml(req.requested_unit_name)}</strong></small>
        ${req.justification ? `<br><small style="color:var(--text-muted)"><i class="fas fa-comment-alt"></i> ${escHtml(req.justification)}</small>` : ''}
    `;

    document.getElementById('reviewUnitName').value = req.requested_unit_name || '';
    document.getElementById('reviewUnitCode').value = req.unit || '';
    document.getElementById('reviewTempPassword').value = '';
    document.getElementById('reviewNotes').value = '';
    document.getElementById('unitReviewResult').style.display = 'none';
    document.getElementById('unitReviewSubmitBtn').disabled = false;
    document.getElementById('unitReviewSubmitBtn').innerHTML = '<i class="fas fa-check"></i> <span id="unitReviewSubmitLabel">Create Unit &amp; Approve</span>';
    document.getElementById('selectedExistingUnitRow').style.display = 'none';

    document.getElementById('unitReviewModal').style.display = 'flex';
    searchSimilarUnits(req.requested_unit_name);
}

function closeUnitReviewModal() {
    document.getElementById('unitReviewModal').style.display = 'none';
    pendingRequestId = null;
    selectedExistingUnitId = null;
}

async function searchSimilarUnits(query) {
    const list = document.getElementById('similarUnitsList');
    if (!query || query.trim().length < 2) {
        list.innerHTML = '<div class="similar-units-empty">Enter at least 2 characters to search</div>';
        return;
    }
    list.innerHTML = '<div class="similar-units-empty"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
    try {
        const data = await apiFetch(`/api/admin/units/search?q=${encodeURIComponent(query.trim())}`);
        const units = data.units || [];
        if (!units.length) {
            list.innerHTML = '<div class="similar-units-empty"><i class="fas fa-check-circle" style="color:#4ade80"></i> No similar units found — safe to create</div>';
            return;
        }
        list.innerHTML = units.map(u => `
            <div class="similar-unit-row">
                <div>
                    <strong>${escHtml(u.name)}</strong>
                    ${u.unit_code ? `<span class="muted"> · ${escHtml(u.unit_code)}</span>` : ''}
                    ${u.organization ? `<br><small class="muted">${escHtml(u.organization)}</small>` : ''}
                </div>
                <button class="btn-icon btn-activate" title="Assign user to this unit instead" onclick="selectExistingUnit('${u.id}', '${escHtml(u.name)}')">
                    <i class="fas fa-link"></i>
                </button>
            </div>
        `).join('');
    } catch (err) {
        list.innerHTML = `<div class="similar-units-empty">Search failed: ${escHtml(err.message)}</div>`;
    }
}

function debouncedSearchSimilar() {
    clearTimeout(unitReviewDebounceTimer);
    unitReviewDebounceTimer = setTimeout(() => {
        searchSimilarUnits(document.getElementById('reviewUnitName').value);
    }, 400);
}

function selectExistingUnit(unitId, unitName) {
    selectedExistingUnitId = unitId;
    document.getElementById('selectedExistingUnitName').textContent = unitName;
    document.getElementById('selectedExistingUnitRow').style.display = 'block';
    document.getElementById('unitReviewSubmitBtn').innerHTML = '<i class="fas fa-link"></i> <span>Assign to Existing Unit &amp; Approve</span>';
}

function clearExistingUnitSelection() {
    selectedExistingUnitId = null;
    document.getElementById('selectedExistingUnitRow').style.display = 'none';
    document.getElementById('unitReviewSubmitBtn').innerHTML = '<i class="fas fa-check"></i> <span>Create Unit &amp; Approve</span>';
}

function openDenyFromReview() {
    const id = pendingRequestId;
    const req = allRequests[id] || {};
    closeUnitReviewModal();
    openDenyModal(id, req.username || '');
}

async function submitUnitReview() {
    const btn = document.getElementById('unitReviewSubmitBtn');
    const result = document.getElementById('unitReviewResult');
    btn.disabled = true;

    const payload = {
        temp_password: document.getElementById('reviewTempPassword').value,
        notes: document.getElementById('reviewNotes').value,
    };

    if (selectedExistingUnitId) {
        payload.override_unit_id = selectedExistingUnitId;
    } else {
        const unitName = document.getElementById('reviewUnitName').value.trim();
        if (!unitName) {
            result.className = 'approve-result approve-error';
            result.innerHTML = '<i class="fas fa-exclamation-circle"></i> Please enter a unit name.';
            result.style.display = 'block';
            btn.disabled = false;
            return;
        }
        payload.create_new_unit = true;
        payload.new_unit_name = unitName;
        payload.new_unit_code = document.getElementById('reviewUnitCode').value.trim();
    }

    try {
        const data = await apiFetch(`/api/admin/account-requests/${pendingRequestId}/approve`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        result.className = 'approve-result approve-success';
        result.innerHTML = `<i class="fas fa-check-circle"></i> Account created for <strong>${escHtml(data.user?.username)}</strong>.
            Temporary password: <code style="background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:4px">${escHtml(data.temp_password)}</code>`;
        result.style.display = 'block';
        btn.innerHTML = '<i class="fas fa-check"></i> Done';
        loadAccountRequests();
        loadUsers();
    } catch (err) {
        result.className = 'approve-result approve-error';
        result.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + escHtml(err.message);
        result.style.display = 'block';
        btn.disabled = false;
    }
}
