/* ===== DEFAULTS ===== */
const DEFAULT_JS = `function greet() {
  alert('Hello from CodeHost!');
}`;

/* ===== STATE ===== */
const state = {
  siteId: null,
  editToken: null,
  activeTab: 'html',
  isDark: true,
  isVertical: false,
  previewDebounce: null,
  editors: {},
  sessionPassword: null,
};

/* ===== CURRENT USER ===== */
let currentUser = null;

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await loadCurrentUser();
  initEditors();
  initTabs();
  initDivider();
  checkUrlForSite();
  bindUI();
  showWelcomeIfNeeded();
});

/* ===== LOAD USER ===== */
async function loadCurrentUser() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      window.location.href = '/';
      return;
    }
    currentUser = await res.json();
    renderUserChip(currentUser);
  } catch {
    window.location.href = '/';
  }
}

function renderUserChip(user) {
  const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const avatarEl = document.getElementById('userAvatar');
  const nameEl = document.getElementById('userNameDisplay');
  const emailEl = document.getElementById('userEmailDisplay');
  if (avatarEl) avatarEl.textContent = initials;
  if (nameEl) nameEl.textContent = user.name.split(' ')[0];
  if (emailEl) emailEl.textContent = user.email;
}

function showWelcomeIfNeeded() {
  const raw = sessionStorage.getItem('ch-welcome');
  if (!raw) return;
  sessionStorage.removeItem('ch-welcome');
  const { name, isNew } = JSON.parse(raw);
  const toast = document.getElementById('welcomeToast');
  const msg = document.getElementById('welcomeMsg');
  if (!toast || !msg) return;
  msg.textContent = isNew ? `Welcome, ${name}! Your account is ready.` : `Welcome back, ${name}!`;
  toast.style.display = 'flex';
  const close = document.getElementById('welcomeClose');
  close.addEventListener('click', () => { toast.style.display = 'none'; });
  setTimeout(() => { toast.style.display = 'none'; }, 5000);
}

/* ===== THEME ===== */
function initTheme() {
  const saved = localStorage.getItem('ch-theme') || 'dark';
  setTheme(saved);
}

function setTheme(theme) {
  state.isDark = theme === 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('ch-theme', theme);
  const moonIcon = document.querySelector('.icon-moon');
  const sunIcon = document.querySelector('.icon-sun');
  if (state.isDark) {
    moonIcon.style.display = 'none';
    sunIcon.style.display = '';
  } else {
    moonIcon.style.display = '';
    sunIcon.style.display = 'none';
  }
  updateEditorThemes();
}

function updateEditorThemes() {
  const theme = state.isDark ? 'dracula' : 'eclipse';
  Object.values(state.editors).forEach(ed => ed.setOption('theme', theme));
}

/* ===== EDITORS ===== */
function initEditors() {
  const theme = state.isDark ? 'dracula' : 'eclipse';
  const commonOpts = {
    theme,
    lineNumbers: true,
    autoCloseTags: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    styleActiveLine: true,
    indentUnit: 2,
    tabSize: 2,
    indentWithTabs: false,
    lineWrapping: false,
    extraKeys: { 'Tab': (cm) => cm.replaceSelection('  ') },
  };

  state.editors.html = CodeMirror(document.getElementById('editor-html'), {
    ...commonOpts,
    mode: 'htmlmixed',
    value: getDefaultHTML(),
  });

  state.editors.css = CodeMirror(document.getElementById('editor-css'), {
    ...commonOpts,
    mode: 'css',
    value: getDefaultCSS(),
  });

  state.editors.js = CodeMirror(document.getElementById('editor-js'), {
    ...commonOpts,
    mode: 'javascript',
    value: DEFAULT_JS,
  });

  Object.values(state.editors).forEach(ed => {
    ed.on('change', schedulePreviewUpdate);
  });

  schedulePreviewUpdate();
}

/* ===== TABS ===== */
function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const name = tab.dataset.tab;
      switchTab(name);
    });
  });
}

function switchTab(name) {
  state.activeTab = name;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.code-editor').forEach(e => e.classList.remove('active'));
  document.getElementById(`editor-${name}`).classList.add('active');
  state.editors[name].refresh();
  state.editors[name].focus();
}

/* ===== PREVIEW ===== */
function schedulePreviewUpdate() {
  clearTimeout(state.previewDebounce);
  state.previewDebounce = setTimeout(updatePreview, 400);
}

function updatePreview() {
  const html = state.editors.html.getValue();
  const css = state.editors.css.getValue();
  const js = state.editors.js.getValue();
  const iframe = document.getElementById('preview');
  const combined = buildPreviewDoc(html, css, js);
  iframe.srcdoc = combined;
}

function buildPreviewDoc(html, css, js) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${css}</style>
</head>
<body>
${html}
<script>
try {
${js}
} catch(e) { console.error(e); }
<\/script>
</body>
</html>`;
}

/* ===== DIVIDER DRAG ===== */
function initDivider() {
  const divider = document.getElementById('divider');
  const main = document.querySelector('.main');
  let dragging = false;
  let startPos = 0;
  let startSizes = [];

  divider.addEventListener('mousedown', (e) => {
    dragging = true;
    divider.classList.add('dragging');
    startPos = state.isVertical ? e.clientY : e.clientX;
    const editor = document.getElementById('editorPanel');
    const preview = document.getElementById('previewPanel');
    if (state.isVertical) {
      startSizes = [editor.offsetHeight, preview.offsetHeight];
    } else {
      startSizes = [editor.offsetWidth, preview.offsetWidth];
    }
    document.body.style.userSelect = 'none';
    document.body.style.cursor = state.isVertical ? 'row-resize' : 'col-resize';
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const delta = state.isVertical ? (e.clientY - startPos) : (e.clientX - startPos);
    const total = startSizes[0] + startSizes[1];
    let newFirst = startSizes[0] + delta;
    newFirst = Math.max(120, Math.min(total - 120, newFirst));
    const pct = (newFirst / total) * 100;
    const editor = document.getElementById('editorPanel');
    const preview = document.getElementById('previewPanel');
    if (state.isVertical) {
      editor.style.height = pct + '%';
      editor.style.flex = 'none';
      preview.style.height = (100 - pct) + '%';
      preview.style.flex = 'none';
    } else {
      editor.style.width = pct + '%';
      editor.style.flex = 'none';
      preview.style.width = (100 - pct) + '%';
      preview.style.flex = 'none';
    }
    Object.values(state.editors).forEach(ed => ed.refresh());
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    divider.classList.remove('dragging');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  });

  // Touch support
  divider.addEventListener('touchstart', (e) => {
    dragging = true;
    const touch = e.touches[0];
    startPos = state.isVertical ? touch.clientY : touch.clientX;
    const editor = document.getElementById('editorPanel');
    const preview = document.getElementById('previewPanel');
    if (state.isVertical) {
      startSizes = [editor.offsetHeight, preview.offsetHeight];
    } else {
      startSizes = [editor.offsetWidth, preview.offsetWidth];
    }
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const touch = e.touches[0];
    const delta = state.isVertical ? (touch.clientY - startPos) : (touch.clientX - startPos);
    const total = startSizes[0] + startSizes[1];
    let newFirst = startSizes[0] + delta;
    newFirst = Math.max(80, Math.min(total - 80, newFirst));
    const pct = (newFirst / total) * 100;
    const editor = document.getElementById('editorPanel');
    const preview = document.getElementById('previewPanel');
    if (state.isVertical) {
      editor.style.height = pct + '%';
      editor.style.flex = 'none';
      preview.style.height = (100 - pct) + '%';
      preview.style.flex = 'none';
    } else {
      editor.style.width = pct + '%';
      editor.style.flex = 'none';
      preview.style.width = (100 - pct) + '%';
      preview.style.flex = 'none';
    }
    Object.values(state.editors).forEach(ed => ed.refresh());
  }, { passive: true });

  document.addEventListener('touchend', () => { dragging = false; });
}

/* ===== BIND UI ===== */
function bindUI() {
  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', () => {
    setTheme(state.isDark ? 'light' : 'dark');
  });

  // New project
  document.getElementById('newProjectBtn').addEventListener('click', () => {
    if (state.siteId && !confirm('Start a new project? Unsaved work will be cleared.')) return;
    resetProject();
  });

  // Publish — show password modal first
  document.getElementById('publishBtn').addEventListener('click', openPasswordModal);

  // Password modal
  document.getElementById('pwCancel').addEventListener('click', closePasswordModal);
  document.getElementById('pwConfirm').addEventListener('click', handlePasswordConfirm);
  document.getElementById('pwModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('pwModal')) closePasswordModal();
  });
  document.getElementById('pwInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handlePasswordConfirm();
    if (e.key === 'Escape') closePasswordModal();
  });
  document.getElementById('togglePwBtn').addEventListener('click', () => {
    const input = document.getElementById('pwInput');
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    document.querySelector('#togglePwBtn .eye-open').style.display = isHidden ? 'none' : '';
    document.querySelector('#togglePwBtn .eye-closed').style.display = isHidden ? '' : 'none';
  });

  // Copy link
  document.getElementById('copyLinkBtn').addEventListener('click', copyLink);

  // Open link
  document.getElementById('openLinkBtn').addEventListener('click', () => {
    const link = document.getElementById('publishedLink').href;
    if (link) window.open(link, '_blank');
  });

  // Close banner
  document.getElementById('closeBanner').addEventListener('click', () => {
    document.getElementById('publishBanner').style.display = 'none';
    document.querySelector('.main').classList.remove('banner-visible');
  });

  // Refresh preview
  document.getElementById('refreshPreview').addEventListener('click', updatePreview);

  // Toggle layout
  document.getElementById('toggleLayout').addEventListener('click', toggleLayout);

  // Upload file
  document.getElementById('uploadBtn').addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });

  document.getElementById('fileInput').addEventListener('change', handleFileUpload);

  // Clear current tab
  document.getElementById('clearBtn').addEventListener('click', () => {
    if (confirm(`Clear the ${state.activeTab.toUpperCase()} editor?`)) {
      state.editors[state.activeTab].setValue('');
    }
  });

  // User chip menu
  const chip = document.getElementById('userChip');
  const dropdown = document.getElementById('userDropdown');
  const menuBtn = document.getElementById('userMenuBtn');
  if (chip && dropdown && menuBtn) {
    chip.addEventListener('click', (e) => {
      const open = dropdown.style.display !== 'none';
      dropdown.style.display = open ? 'none' : 'block';
    });
    document.addEventListener('click', (e) => {
      if (!chip.contains(e.target)) dropdown.style.display = 'none';
    });
  }

  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/';
    });
  }
}

/* ===== PASSWORD MODAL ===== */
function openPasswordModal() {
  if (state.sessionPassword) {
    publishSite(state.sessionPassword);
    return;
  }
  const modal = document.getElementById('pwModal');
  const input = document.getElementById('pwInput');
  const errorEl = document.getElementById('pwError');
  input.value = '';
  errorEl.textContent = '';
  input.type = 'password';
  document.querySelector('#togglePwBtn .eye-open').style.display = '';
  document.querySelector('#togglePwBtn .eye-closed').style.display = 'none';
  modal.style.display = 'flex';
  setTimeout(() => input.focus(), 80);
}

function closePasswordModal() {
  document.getElementById('pwModal').style.display = 'none';
  document.getElementById('pwInput').value = '';
  document.getElementById('pwError').textContent = '';
}

async function handlePasswordConfirm() {
  const input = document.getElementById('pwInput');
  const errorEl = document.getElementById('pwError');
  const confirmBtn = document.getElementById('pwConfirm');
  const pw = input.value.trim();

  if (!pw) { errorEl.textContent = 'Please enter the password.'; return; }

  confirmBtn.disabled = true;
  confirmBtn.innerHTML = `<div class="publishing-spinner"></div> Verifying…`;
  errorEl.textContent = '';

  try {
    const verifyRes = await fetch('/api/admin/verify', {
      headers: { 'x-admin-password': pw }
    });

    if (verifyRes.status === 401) {
      errorEl.textContent = 'Incorrect password. Please try again.';
      input.value = '';
      input.focus();
      return;
    }

    state.sessionPassword = pw;
    closePasswordModal();
    publishSite(pw);
  } catch {
    errorEl.textContent = 'Network error. Please try again.';
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg> Publish`;
  }
}

/* ===== PUBLISH ===== */
async function publishSite(password) {
  const btn = document.getElementById('publishBtn');
  const html = state.editors.html.getValue();
  const css = state.editors.css.getValue();
  const js = state.editors.js.getValue();
  const title = document.getElementById('projectTitle').value.trim() || 'Untitled Project';

  if (!html && !css && !js) {
    showToast('Add some code before publishing.', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<div class="publishing-spinner"></div> <span>Publishing…</span>`;

  try {
    const payload = { password, title, html, css, js };
    if (state.siteId && state.editToken) {
      payload.siteId = state.siteId;
      payload.editToken = state.editToken;
    }

    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (res.status === 401) {
      state.sessionPassword = null;
      showToast('Incorrect password.', 'error');
      return;
    }

    if (!res.ok) throw new Error(data.error || 'Failed to publish.');

    state.siteId = data.siteId;
    state.editToken = data.editToken;

    saveLocalState();

    const host = window.location.origin;
    const siteUrl = `${host}/site/${data.siteId}`;
    showPublishedBanner(siteUrl);

    if (!window.location.pathname.startsWith('/editor/')) {
      window.history.replaceState({}, '', `/editor/${data.siteId}`);
    }

    showToast(data.updated ? 'Site updated successfully!' : 'Site published successfully!', 'success');
  } catch (err) {
    showToast(err.message || 'Failed to publish.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg><span id="publishLabel">${state.siteId ? 'Update' : 'Publish'}</span>`;
  }
}

function showPublishedBanner(url) {
  const banner = document.getElementById('publishBanner');
  const link = document.getElementById('publishedLink');
  link.href = url;
  link.textContent = url;
  banner.style.display = 'flex';
  document.querySelector('.main').classList.add('banner-visible');
}

/* ===== COPY LINK ===== */
async function copyLink() {
  const link = document.getElementById('publishedLink').href;
  if (!link) return;
  try {
    await navigator.clipboard.writeText(link);
    const btn = document.getElementById('copyLinkBtn');
    const copyIcon = btn.querySelector('.copy-icon');
    const checkIcon = btn.querySelector('.check-icon');
    copyIcon.style.display = 'none';
    checkIcon.style.display = '';
    showToast('Link copied!', 'success');
    setTimeout(() => {
      copyIcon.style.display = '';
      checkIcon.style.display = 'none';
    }, 2000);
  } catch {
    showToast('Could not copy. Try manually.', 'error');
  }
}

/* ===== LAYOUT TOGGLE ===== */
function toggleLayout() {
  state.isVertical = !state.isVertical;
  const main = document.querySelector('.main');
  const splitIcon = document.querySelector('.icon-split');
  const stackIcon = document.querySelector('.icon-stack');

  if (state.isVertical) {
    main.classList.add('vertical');
    splitIcon.style.display = 'none';
    stackIcon.style.display = '';
  } else {
    main.classList.remove('vertical');
    splitIcon.style.display = '';
    stackIcon.style.display = 'none';
  }

  // Reset panel sizes
  const editor = document.getElementById('editorPanel');
  const preview = document.getElementById('previewPanel');
  editor.style.width = '';
  editor.style.height = '';
  editor.style.flex = '';
  preview.style.width = '';
  preview.style.height = '';
  preview.style.flex = '';

  setTimeout(() => Object.values(state.editors).forEach(ed => ed.refresh()), 50);
}

/* ===== FILE UPLOAD ===== */
function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const content = ev.target.result;
    const ext = file.name.split('.').pop().toLowerCase();
    let tab = 'html';
    if (ext === 'css') tab = 'css';
    else if (ext === 'js') tab = 'js';
    state.editors[tab].setValue(content);
    switchTab(tab);
    showToast(`${file.name} loaded into ${tab.toUpperCase()} editor.`, 'success');
  };
  reader.readAsText(file);
  e.target.value = '';
}

/* ===== LOAD FROM URL ===== */
async function checkUrlForSite() {
  const match = window.location.pathname.match(/^\/editor\/([a-zA-Z0-9_-]+)$/);
  if (!match) {
    loadLocalState();
    return;
  }

  const siteId = match[1];
  const savedToken = localStorage.getItem(`ch-token-${siteId}`);

  try {
    const res = await fetch(`/api/site/${siteId}`);
    if (!res.ok) throw new Error('Not found');
    const data = await res.json();
    state.editors.html.setValue(data.html_code || '');
    state.editors.css.setValue(data.css_code || '');
    state.editors.js.setValue(data.js_code || '');
    document.getElementById('projectTitle').value = data.title || '';
    state.siteId = siteId;
    state.editToken = savedToken || null;

    if (savedToken) {
      document.getElementById('publishLabel').textContent = 'Update';
      const host = window.location.origin;
      showPublishedBanner(`${host}/site/${siteId}`);
    }
    updatePreview();
  } catch {
    showToast('Site not found. Starting fresh.', 'error');
    resetProject();
  }
}

/* ===== LOCAL STATE ===== */
function saveLocalState() {
  if (state.siteId && state.editToken) {
    localStorage.setItem(`ch-token-${state.siteId}`, state.editToken);
    localStorage.setItem('ch-last-site', state.siteId);
  }
}

function loadLocalState() {
  const lastSite = localStorage.getItem('ch-last-site');
  if (lastSite) {
    const token = localStorage.getItem(`ch-token-${lastSite}`);
    if (token) {
      state.siteId = lastSite;
      state.editToken = token;
    }
  }
}

/* ===== RESET ===== */
function resetProject() {
  state.siteId = null;
  state.editToken = null;
  localStorage.removeItem('ch-last-site');
  state.editors.html.setValue(getDefaultHTML());
  state.editors.css.setValue(getDefaultCSS());
  state.editors.js.setValue('');
  document.getElementById('projectTitle').value = '';
  document.getElementById('publishBanner').style.display = 'none';
  document.querySelector('.main').classList.remove('banner-visible');
  const label = document.getElementById('publishLabel');
  if (label) label.textContent = 'Publish';
  window.history.replaceState({}, '', '/app');
  updatePreview();
}

/* ===== TOAST ===== */
let toastTimer = null;
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}

/* ===== DEFAULTS ===== */
function getDefaultHTML() {
  return `<div class="container">
  <h1>Hello, World!</h1>
  <p>Start editing to see your changes live.</p>
  <button onclick="greet()">Click me</button>
</div>`;
}



function getDefaultCSS() {
  return `body {
  font-family: system-ui, sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  margin: 0;
  background: #f0f4ff;
}

.container {
  text-align: center;
  padding: 40px;
}

h1 {
  color: #6366f1;
  font-size: 2.5rem;
  margin-bottom: 12px;
}

p {
  color: #555;
  margin-bottom: 24px;
}

button {
  background: #6366f1;
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

button:hover {
  background: #4f52d4;
}`;
}
