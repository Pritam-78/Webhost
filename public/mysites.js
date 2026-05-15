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
    const res = await fetch('/api/auth/me');
    if (!res.ok) return; // server-side requireAuth already handles unauth redirect
    const user = await res.json();
    if (!user || !user.name) return;
    const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('msUserAvatar').textContent = initials;
    document.getElementById('msUserName').textContent = user.name;
  } catch {
    // silently ignore — server-side auth is the real guard
  }
}

/* ===== LOAD SITES ===== */
async function loadMySites() {
  showState('loading');
  try {
    const res = await fetch('/api/my-sites');
    if (res.status === 401) {
      // Session truly expired — let server handle it on next navigation
      window.location.replace('/');
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

/* ===== RENDER CARDS ===== */
function renderTable(sites) {
  const container = document.getElementById('msSitesBody');
  container.innerHTML = '';

  sites.forEach(site => {
    const siteUrl = `${window.location.origin}/site/${site.id}`;
    const customUrl = site.custom_slug ? `${window.location.origin}/s/${site.custom_slug}` : null;
    const editUrl = `/editor/${site.id}`;

    const card = document.createElement('div');
    card.className = 'ms-card';
    card.dataset.id = site.id;
    card.innerHTML = `
      <div class="ms-card-top">
        <div class="ms-card-info">
          <div class="ms-card-title">${esc(site.title)}</div>
          <div class="ms-card-meta">
            <span class="ms-status-badge"><span class="ms-status-dot"></span>Active</span>
            <span class="ms-card-views">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              ${(site.views || 0).toLocaleString()} views
            </span>
            <span class="ms-card-date">${formatDate(site.created_at)}</span>
          </div>
        </div>
      </div>

      <div class="ms-card-links">
        <div class="ms-card-link-row">
          <span class="ms-link-label">Default URL</span>
          <a href="${siteUrl}" target="_blank" rel="noopener" class="ms-link-value">${siteUrl}</a>
        </div>
        ${customUrl ? `
        <div class="ms-card-link-row ms-custom-url-row" id="customUrlRow-${esc(site.id)}">
          <span class="ms-link-label ms-link-label-custom">Custom URL</span>
          <a href="${customUrl}" target="_blank" rel="noopener" class="ms-link-value ms-link-custom">${customUrl}</a>
        </div>` : `
        <div class="ms-card-link-row ms-custom-url-row ms-no-custom" id="customUrlRow-${esc(site.id)}">
          <span class="ms-link-label">Custom URL</span>
          <span class="ms-link-value ms-no-slug">Not set</span>
        </div>`}
      </div>

      <div class="ms-card-actions">
        <a href="${siteUrl}" target="_blank" rel="noopener" class="ms-action-btn ms-btn-open">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          View
        </a>
        <a href="${editUrl}" class="ms-action-btn ms-btn-edit">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </a>
        <button class="ms-action-btn ms-btn-url" data-id="${esc(site.id)}" data-title="${esc(site.title)}" data-slug="${esc(site.custom_slug || '')}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          Custom URL
        </button>
        <button class="ms-action-btn ms-btn-del" data-id="${esc(site.id)}" data-title="${esc(site.title)}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          Delete
        </button>
      </div>
    `;
    container.appendChild(card);
  });

  // Bind buttons
  container.querySelectorAll('.ms-btn-del').forEach(btn => {
    btn.addEventListener('click', () => openDeleteModal(btn.dataset.id, btn.dataset.title));
  });
  container.querySelectorAll('.ms-btn-url').forEach(btn => {
    btn.addEventListener('click', () => openUrlModal(btn.dataset.id, btn.dataset.title, btn.dataset.slug));
  });
}

/* ===== MODALS: BIND ===== */
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

  // Custom URL modal
  document.getElementById('msUrlClose').addEventListener('click', closeUrlModal);
  document.getElementById('msUrlCancel').addEventListener('click', closeUrlModal);
  document.getElementById('msUrlOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeUrlModal();
  });
  document.getElementById('msUrlSave').addEventListener('click', saveCustomUrl);
  document.getElementById('msUrlSlugInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveCustomUrl();
  });
  document.getElementById('msUrlSlugInput').addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    e.target.value = val;
    document.getElementById('msUrlPreviewSlug').textContent = val || 'my-site';
  });
  document.getElementById('msRemoveSlug').addEventListener('click', removeCustomUrl);
}

/* ===== CUSTOM URL MODAL ===== */
let urlTargetId = null;

function openUrlModal(siteId, siteTitle, currentSlug) {
  urlTargetId = siteId;
  document.getElementById('msUrlSiteName').textContent = siteTitle;
  document.getElementById('msUrlSlugInput').value = currentSlug || '';
  document.getElementById('msUrlPreviewSlug').textContent = currentSlug || 'my-site';
  document.getElementById('msUrlError').style.display = 'none';
  document.getElementById('msUrlSuccess').style.display = 'none';
  document.getElementById('msUrlSaveLabel').textContent = 'Save Custom URL';
  document.getElementById('msUrlSave').disabled = false;

  const currentSlugRow = document.getElementById('msCurrentSlugRow');
  if (currentSlug) {
    currentSlugRow.style.display = 'flex';
    const link = document.getElementById('msCurrentSlugLink');
    const url = `${window.location.origin}/s/${currentSlug}`;
    link.textContent = url;
    link.href = url;
  } else {
    currentSlugRow.style.display = 'none';
  }

  document.getElementById('msUrlOverlay').style.display = 'flex';
  setTimeout(() => document.getElementById('msUrlSlugInput').focus(), 100);
}

function closeUrlModal() {
  document.getElementById('msUrlOverlay').style.display = 'none';
  urlTargetId = null;
}

async function saveCustomUrl() {
  if (!urlTargetId) return;
  const slug = document.getElementById('msUrlSlugInput').value.trim();
  const errEl = document.getElementById('msUrlError');
  const sucEl = document.getElementById('msUrlSuccess');
  const saveBtn = document.getElementById('msUrlSave');

  errEl.style.display = 'none';
  sucEl.style.display = 'none';

  if (slug && slug.length < 3) {
    errEl.textContent = 'Slug must be at least 3 characters.';
    errEl.style.display = '';
    return;
  }

  saveBtn.disabled = true;
  document.getElementById('msUrlSaveLabel').textContent = 'Saving…';

  try {
    const res = await fetch(`/api/my-sites/${urlTargetId}/custom-url`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug })
    });
    const data = await res.json();

    if (!res.ok) {
      errEl.textContent = data.error || 'Failed to save custom URL.';
      errEl.style.display = '';
      saveBtn.disabled = false;
      document.getElementById('msUrlSaveLabel').textContent = 'Save Custom URL';
      return;
    }

    // Update local state
    const site = state.sites.find(s => String(s.id) === String(urlTargetId));
    if (site) site.custom_slug = data.custom_slug;

    // Update the Custom URL btn data-slug
    const urlBtn = document.querySelector(`.ms-btn-url[data-id="${urlTargetId}"]`);
    if (urlBtn) urlBtn.dataset.slug = data.custom_slug || '';

    // Update the card's custom URL row
    const row = document.getElementById(`customUrlRow-${urlTargetId}`);
    if (row) {
      if (data.custom_slug) {
        const customUrl = `${window.location.origin}/s/${data.custom_slug}`;
        row.className = 'ms-card-link-row ms-custom-url-row';
        row.innerHTML = `
          <span class="ms-link-label ms-link-label-custom">Custom URL</span>
          <a href="${customUrl}" target="_blank" rel="noopener" class="ms-link-value ms-link-custom">${customUrl}</a>
        `;
      } else {
        row.className = 'ms-card-link-row ms-custom-url-row ms-no-custom';
        row.innerHTML = `
          <span class="ms-link-label">Custom URL</span>
          <span class="ms-link-value ms-no-slug">Not set</span>
        `;
      }
    }

    sucEl.textContent = data.custom_slug
      ? `Custom URL set: /s/${data.custom_slug}`
      : 'Custom URL removed.';
    sucEl.style.display = '';
    saveBtn.disabled = false;
    document.getElementById('msUrlSaveLabel').textContent = 'Save Custom URL';

    // Update the current slug row in modal
    const currentSlugRow = document.getElementById('msCurrentSlugRow');
    if (data.custom_slug) {
      currentSlugRow.style.display = 'flex';
      const link = document.getElementById('msCurrentSlugLink');
      const url = `${window.location.origin}/s/${data.custom_slug}`;
      link.textContent = url;
      link.href = url;
    } else {
      currentSlugRow.style.display = 'none';
    }

    setTimeout(closeUrlModal, 1800);
  } catch {
    errEl.textContent = 'Network error. Please try again.';
    errEl.style.display = '';
    saveBtn.disabled = false;
    document.getElementById('msUrlSaveLabel').textContent = 'Save Custom URL';
  }
}

async function removeCustomUrl() {
  document.getElementById('msUrlSlugInput').value = '';
  document.getElementById('msUrlPreviewSlug').textContent = 'my-site';
  await saveCustomUrl();
}

/* ===== DELETE MODAL ===== */
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
