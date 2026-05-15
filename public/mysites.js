/* ===== MY HOSTED SITES PAGE ===== */

const state = {
  sites: [],
  deleteTargetId: null,
  deleteTargetTitle: null,
  deleting: false
};

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentUser();
  await loadMySites();
  bindDeleteModal();
});

/* ===== AUTH CHECK + USER CHIP ===== */
async function loadCurrentUser() {
  try {
    const res = await fetch('/api/me');
    if (!res.ok) {
      window.location.href = '/?redirect=/mysites';
      return;
    }
    const user = await res.json();
    const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('msUserAvatar').textContent = initials;
    document.getElementById('msUserName').textContent = user.name;
  } catch {
    window.location.href = '/?redirect=/mysites';
  }
}

/* ===== LOAD SITES ===== */
async function loadMySites() {
  showState('loading');
  try {
    const res = await fetch('/api/my-sites');
    if (res.status === 401) {
      window.location.href = '/?redirect=/mysites';
      return;
    }
    if (!res.ok) throw new Error('Failed to load sites.');
    const data = await res.json();
    state.sites = data.sites || [];

    updatePageTitle(data.total);
    updateStats(data.sites);

    if (data.total === 0) {
      showState('empty');
    } else {
      renderTable(data.sites);
      showState('table');
    }
  } catch (err) {
    document.getElementById('msSubtitle').textContent = 'Could not load your websites.';
    showState('empty');
  }
}

function updatePageTitle(total) {
  document.getElementById('msHeading').textContent =
    total === 0 ? 'My Hosted Websites' : `My Hosted Websites (${total})`;
  document.getElementById('msSubtitle').textContent =
    total === 0
      ? 'You have no published websites yet.'
      : `You have published ${total} website${total === 1 ? '' : 's'}.`;
}

function updateStats(sites) {
  if (!sites || sites.length === 0) return;

  document.getElementById('msTotalSites').textContent = sites.length;

  const totalViews = sites.reduce((sum, s) => sum + (s.views || 0), 0);
  document.getElementById('msTotalViews').textContent = totalViews.toLocaleString();

  const latest = sites[0].created_at;
  document.getElementById('msLatest').textContent = formatDate(latest, true);

  document.getElementById('msStatsRow').style.display = '';
}

function showState(state) {
  document.getElementById('msLoading').style.display = state === 'loading' ? 'flex' : 'none';
  document.getElementById('msEmpty').style.display = state === 'empty' ? 'flex' : 'none';
  document.getElementById('msSitesWrap').style.display = state === 'table' ? '' : 'none';
}

/* ===== RENDER TABLE ===== */
function renderTable(sites) {
  const tbody = document.getElementById('msSitesBody');
  tbody.innerHTML = '';

  sites.forEach(site => {
    const siteUrl = `${window.location.origin}/site/${site.id}`;
    const editUrl = `/editor/${site.id}`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="ms-site-title" title="${esc(site.title)}">${esc(site.title)}</div></td>
      <td class="ms-site-link">
        <a href="${siteUrl}" target="_blank" rel="noopener">${siteUrl}</a>
      </td>
      <td class="hide-sm">
        <span class="ms-views">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          ${(site.views || 0).toLocaleString()}
        </span>
      </td>
      <td class="hide-sm"><span class="ms-date">${formatDate(site.created_at)}</span></td>
      <td>
        <span class="ms-status-badge">
          <span class="ms-status-dot"></span>
          Active
        </span>
      </td>
      <td>
        <div class="ms-row-actions">
          <a href="${siteUrl}" target="_blank" rel="noopener" class="ms-action-btn ms-btn-open" title="View live site">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            View
          </a>
          <a href="${editUrl}" class="ms-action-btn ms-btn-edit" title="Edit in editor">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </a>
          <button class="ms-action-btn ms-btn-del" data-id="${esc(site.id)}" data-title="${esc(site.title)}" title="Delete website">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            Delete
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Bind delete buttons
  tbody.querySelectorAll('.ms-btn-del').forEach(btn => {
    btn.addEventListener('click', () => openDeleteModal(btn.dataset.id, btn.dataset.title));
  });
}

/* ===== DELETE MODAL ===== */
function bindDeleteModal() {
  document.getElementById('msModalClose').addEventListener('click', closeDeleteModal);
  document.getElementById('msCancelDelete').addEventListener('click', closeDeleteModal);
  document.getElementById('msDeleteOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeDeleteModal();
  });
  document.getElementById('msConfirmDelete').addEventListener('click', performDelete);
  document.getElementById('msDeletePassword').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performDelete();
  });

  // Eye toggle
  document.getElementById('msPasswordEye').addEventListener('click', () => {
    const inp = document.getElementById('msDeletePassword');
    const isPass = inp.type === 'password';
    inp.type = isPass ? 'text' : 'password';
    document.querySelector('.eye-show').style.display = isPass ? 'none' : '';
    document.querySelector('.eye-hide').style.display = isPass ? '' : 'none';
  });
}

function openDeleteModal(siteId, siteTitle) {
  state.deleteTargetId = siteId;
  state.deleteTargetTitle = siteTitle;
  document.getElementById('msModalSiteName').textContent = siteTitle;
  document.getElementById('msDeletePassword').value = '';
  document.getElementById('msDeletePassword').classList.remove('input-error');
  document.getElementById('msDeleteError').style.display = 'none';
  document.getElementById('msDeleteBtnLabel').textContent = 'Delete Website';
  document.getElementById('msConfirmDelete').disabled = false;
  document.getElementById('msDeleteOverlay').style.display = 'flex';
  setTimeout(() => document.getElementById('msDeletePassword').focus(), 100);
}

function closeDeleteModal() {
  if (state.deleting) return;
  document.getElementById('msDeleteOverlay').style.display = 'none';
  state.deleteTargetId = null;
  state.deleteTargetTitle = null;
}

async function performDelete() {
  if (state.deleting || !state.deleteTargetId) return;
  const password = document.getElementById('msDeletePassword').value.trim();
  const errorEl = document.getElementById('msDeleteError');
  const inp = document.getElementById('msDeletePassword');

  if (!password) {
    inp.classList.add('input-error');
    errorEl.textContent = 'Please enter your account password.';
    errorEl.style.display = '';
    inp.focus();
    return;
  }

  state.deleting = true;
  document.getElementById('msDeleteBtnLabel').textContent = 'Deleting…';
  document.getElementById('msConfirmDelete').disabled = true;
  errorEl.style.display = 'none';
  inp.classList.remove('input-error');

  try {
    const res = await fetch(`/api/my-sites/${state.deleteTargetId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();

    if (!res.ok) {
      inp.classList.add('input-error');
      errorEl.textContent = data.error || 'Failed to delete. Please try again.';
      errorEl.style.display = '';
      document.getElementById('msDeleteBtnLabel').textContent = 'Delete Website';
      document.getElementById('msConfirmDelete').disabled = false;
      state.deleting = false;
      inp.focus();
      return;
    }

    // Remove from local state and re-render
    state.sites = state.sites.filter(s => String(s.id) !== String(state.deleteTargetId));
    updatePageTitle(state.sites.length);
    updateStats(state.sites);

    if (state.sites.length === 0) {
      document.getElementById('msStatsRow').style.display = 'none';
      showState('empty');
    } else {
      renderTable(state.sites);
    }

    closeDeleteModal();
  } catch {
    errorEl.textContent = 'Network error. Please try again.';
    errorEl.style.display = '';
    document.getElementById('msDeleteBtnLabel').textContent = 'Delete Website';
    document.getElementById('msConfirmDelete').disabled = false;
  } finally {
    state.deleting = false;
  }
}

/* ===== HELPERS ===== */
function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(dateStr, short = false) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return '—';
  if (short) {
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
  }
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
