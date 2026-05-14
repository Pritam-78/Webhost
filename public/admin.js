/* ===== STATE ===== */
const adminState = {
  password: null,
  sites: [],
  filtered: [],
  pendingDeleteId: null,
};

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  bindGate();
  bindUI();
});

/* ===== THEME ===== */
function initTheme() {
  const saved = localStorage.getItem('ch-theme') || 'dark';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('ch-theme', theme);
  const moon = document.querySelector('.icon-moon');
  const sun = document.querySelector('.icon-sun');
  if (!moon || !sun) return;
  if (theme === 'dark') { moon.style.display = 'none'; sun.style.display = ''; }
  else { moon.style.display = ''; sun.style.display = 'none'; }
}

/* ===== GATE ===== */
function bindGate() {
  const form = document.getElementById('gateForm');
  const toggleBtn = document.getElementById('toggleGatePw');
  const pwInput = document.getElementById('gatePassword');
  const submitBtn = document.getElementById('gateSubmit');
  const errorEl = document.getElementById('gateError');

  toggleBtn.addEventListener('click', () => togglePasswordVisibility(pwInput, toggleBtn));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = pwInput.value.trim();
    if (!pw) { errorEl.textContent = 'Please enter a password.'; return; }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<div class="spinner" style="width:16px;height:16px;border-width:2px;margin:0"></div> Verifying…`;
    errorEl.textContent = '';

    try {
      const res = await fetch('/api/admin/verify', {
        headers: { 'x-admin-password': pw }
      });
      if (!res.ok) {
        errorEl.textContent = 'Incorrect password. Please try again.';
        pwInput.value = '';
        pwInput.focus();
      } else {
        adminState.password = pw;
        document.getElementById('gate').style.display = 'none';
        document.getElementById('dashboard').style.display = '';
        loadSites();
      }
    } catch {
      errorEl.textContent = 'Network error. Please try again.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Unlock Dashboard`;
    }
  });
}

/* ===== BIND UI ===== */
function bindUI() {
  document.getElementById('themeToggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    adminState.password = null;
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('gate').style.display = '';
    document.getElementById('gatePassword').value = '';
    document.getElementById('gateError').textContent = '';
  });

  document.getElementById('refreshBtn').addEventListener('click', loadSites);

  document.getElementById('searchInput').addEventListener('input', (e) => {
    filterSites(e.target.value);
  });

  // Delete modal
  document.getElementById('cancelDelete').addEventListener('click', closeDeleteModal);
  document.getElementById('deleteModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('deleteModal')) closeDeleteModal();
  });

  document.getElementById('toggleDeletePw').addEventListener('click', () => {
    const input = document.getElementById('deletePassword');
    const btn = document.getElementById('toggleDeletePw');
    togglePasswordVisibility(input, btn);
  });

  document.getElementById('confirmDelete').addEventListener('click', performDelete);

  document.getElementById('deletePassword').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performDelete();
  });
}

/* ===== LOAD SITES ===== */
async function loadSites() {
  showSection('loading');

  try {
    const res = await fetch('/api/admin/sites', {
      headers: { 'x-admin-password': adminState.password }
    });

    if (res.status === 401) {
      showToast('Session expired. Please log in again.', 'error');
      document.getElementById('logoutBtn').click();
      return;
    }

    if (!res.ok) throw new Error('Failed to load sites.');

    const data = await res.json();
    adminState.sites = data.sites || [];
    adminState.filtered = [...adminState.sites];

    updateStats(data);
    renderTable(adminState.filtered);
  } catch (err) {
    document.getElementById('errorMsg').textContent = err.message || 'Failed to load websites.';
    showSection('error');
  }
}

/* ===== STATS ===== */
function updateStats(data) {
  document.getElementById('totalCount').textContent = data.total ?? 0;

  const totalViews = (data.sites || []).reduce((sum, s) => sum + (s.views || 0), 0);
  document.getElementById('totalViews').textContent = totalViews.toLocaleString();

  if (data.sites && data.sites.length > 0) {
    const latest = data.sites[0].created_at;
    document.getElementById('latestDate').textContent = formatDate(latest, true);
  } else {
    document.getElementById('latestDate').textContent = '—';
  }
}

/* ===== RENDER TABLE ===== */
function renderTable(sites) {
  const tbody = document.getElementById('sitesBody');
  tbody.innerHTML = '';

  if (sites.length === 0) {
    const search = document.getElementById('searchInput').value;
    if (search) {
      showSection('noResults');
    } else {
      showSection('empty');
    }
    return;
  }

  showSection('table');

  sites.forEach(site => {
    const tr = document.createElement('tr');
    const siteUrl = `${window.location.origin}/site/${site.id}`;
    const editUrl = `${window.location.origin}/editor/${site.id}`;

    tr.innerHTML = `
      <td>
        <div class="site-title" title="${escapeHtml(site.title)}">${escapeHtml(site.title)}</div>
      </td>
      <td>
        <span class="site-id">${escapeHtml(site.id)}</span>
      </td>
      <td class="hide-sm">
        <span class="views-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          ${(site.views || 0).toLocaleString()}
        </span>
      </td>
      <td class="hide-sm"><span class="date-text">${formatDate(site.created_at)}</span></td>
      <td class="hide-sm"><span class="date-text">${formatDate(site.updated_at)}</span></td>
      <td>
        <div class="row-actions">
          <a href="${siteUrl}" target="_blank" rel="noopener" class="btn btn-open" title="Open site" style="padding:6px 10px;font-size:0.78rem">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            View
          </a>
          <a href="${editUrl}" class="btn btn-edit" title="Edit in editor" style="padding:6px 10px;font-size:0.78rem">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </a>
          <button class="btn btn-del" style="padding:6px 10px;font-size:0.78rem" data-id="${escapeHtml(site.id)}" data-title="${escapeHtml(site.title)}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            Delete
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Bind delete buttons
  document.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', () => {
      openDeleteModal(btn.dataset.id, btn.dataset.title);
    });
  });
}

/* ===== FILTER ===== */
function filterSites(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    adminState.filtered = [...adminState.sites];
  } else {
    adminState.filtered = adminState.sites.filter(s =>
      s.title.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    );
  }
  renderTable(adminState.filtered);
}

/* ===== DELETE MODAL ===== */
function openDeleteModal(siteId, title) {
  adminState.pendingDeleteId = siteId;
  document.getElementById('deleteModalMsg').textContent =
    `Are you sure you want to delete "${title}"? This cannot be undone.`;
  document.getElementById('deletePassword').value = '';
  document.getElementById('deleteError').textContent = '';
  document.getElementById('deleteModal').style.display = 'flex';
  setTimeout(() => document.getElementById('deletePassword').focus(), 100);
}

function closeDeleteModal() {
  document.getElementById('deleteModal').style.display = 'none';
  adminState.pendingDeleteId = null;
}

async function performDelete() {
  const siteId = adminState.pendingDeleteId;
  if (!siteId) return;

  const pw = document.getElementById('deletePassword').value.trim();
  const errorEl = document.getElementById('deleteError');
  const btn = document.getElementById('confirmDelete');

  if (!pw) { errorEl.textContent = 'Please enter the password.'; return; }

  btn.disabled = true;
  btn.innerHTML = `<div class="spinner" style="width:14px;height:14px;border-width:2px;margin:0"></div> Deleting…`;
  errorEl.textContent = '';

  try {
    const res = await fetch(`/api/site/${siteId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });

    const data = await res.json();

    if (res.status === 401) {
      errorEl.textContent = 'Incorrect password.';
      document.getElementById('deletePassword').value = '';
      document.getElementById('deletePassword').focus();
      return;
    }

    if (!res.ok) throw new Error(data.error || 'Failed to delete.');

    closeDeleteModal();
    showToast('Website deleted successfully.', 'success');
    adminState.sites = adminState.sites.filter(s => s.id !== siteId);
    adminState.filtered = adminState.filtered.filter(s => s.id !== siteId);

    document.getElementById('totalCount').textContent = adminState.sites.length;
    const totalViews = adminState.sites.reduce((sum, s) => sum + (s.views || 0), 0);
    document.getElementById('totalViews').textContent = totalViews.toLocaleString();

    renderTable(adminState.filtered);
  } catch (err) {
    errorEl.textContent = err.message || 'Failed to delete.';
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg> Delete`;
  }
}

/* ===== HELPERS ===== */
function showSection(name) {
  ['loading', 'error', 'empty', 'table', 'noResults'].forEach(s => {
    const el = document.getElementById(s === 'table' ? 'tableWrap' : s === 'noResults' ? 'noResults' : s === 'loading' ? 'loading' : s === 'error' ? 'errorState' : 'emptyState');
    if (el) el.style.display = 'none';
  });

  const map = {
    loading: 'loading',
    error: 'errorState',
    empty: 'emptyState',
    table: 'tableWrap',
    noResults: 'noResults',
  };

  const target = document.getElementById(map[name]);
  if (target) target.style.display = name === 'table' ? '' : 'flex';
}

function formatDate(dateStr, short = false) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (short) {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function togglePasswordVisibility(input, btn) {
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.querySelector('.eye-open').style.display = isHidden ? 'none' : '';
  btn.querySelector('.eye-closed').style.display = isHidden ? '' : 'none';
}

let toastTimer = null;
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}
