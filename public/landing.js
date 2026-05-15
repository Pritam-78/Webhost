/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initTabs();
  initForms();
  checkAlreadyLoggedIn();
});

/* ===== THEME ===== */
function initTheme() {
  const saved = localStorage.getItem('ch-theme') || 'dark';
  applyTheme(saved);
  document.getElementById('themeToggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('ch-theme', theme);
  const moon = document.querySelector('.icon-moon');
  const sun = document.querySelector('.icon-sun');
  if (theme === 'dark') { moon.style.display = 'none'; sun.style.display = ''; }
  else { moon.style.display = ''; sun.style.display = 'none'; }
}

/* ===== CHECK ALREADY LOGGED IN ===== */
async function checkAlreadyLoggedIn() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const user = await res.json();
      // Already logged in - redirect to app
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect') || '/app';
      window.location.href = redirect;
    }
  } catch {
    // Not logged in, show the form
  }
}

/* ===== TABS ===== */
let activeTab = 'login';

function initTabs() {
  const indicator = document.getElementById('tabIndicator');

  document.querySelectorAll('.l-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  document.querySelectorAll('[data-switch]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.switch));
  });

  positionIndicator(indicator, 'login');
}

function switchTab(tab) {
  activeTab = tab;
  const indicator = document.getElementById('tabIndicator');

  document.querySelectorAll('.l-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const successState = document.getElementById('successState');

  successState.style.display = 'none';

  if (tab === 'login') {
    loginForm.style.display = 'flex';
    registerForm.style.display = 'none';
    indicator.classList.remove('right');
    clearErrors();
  } else {
    loginForm.style.display = 'none';
    registerForm.style.display = 'flex';
    indicator.classList.add('right');
    clearErrors();
  }
}

function positionIndicator(indicator, tab) {
  if (tab === 'register') indicator.classList.add('right');
  else indicator.classList.remove('right');
}

function clearErrors() {
  document.getElementById('loginError').textContent = '';
  document.getElementById('registerError').textContent = '';
  document.querySelectorAll('.l-field input').forEach(i => i.classList.remove('error'));
}

/* ===== FORMS ===== */
function initForms() {
  // Password toggles
  document.querySelectorAll('.l-eye-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.querySelector('.eye-open').style.display = isHidden ? 'none' : '';
      btn.querySelector('.eye-closed').style.display = isHidden ? '' : 'none';
    });
  });

  // Login
  document.getElementById('loginForm').addEventListener('submit', handleLogin);

  // Register
  document.getElementById('registerForm').addEventListener('submit', handleRegister);

  // Already modal buttons
  document.getElementById('alreadySignIn').addEventListener('click', () => {
    document.getElementById('alreadyModal').style.display = 'none';
    switchTab('login');
    const email = document.getElementById('regEmail').value;
    if (email) document.getElementById('loginEmail').value = email;
    document.getElementById('loginPassword').focus();
  });

  document.getElementById('alreadyDismiss').addEventListener('click', () => {
    document.getElementById('alreadyModal').style.display = 'none';
  });

  // Close already modal on backdrop click
  document.getElementById('alreadyModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('alreadyModal')) {
      document.getElementById('alreadyModal').style.display = 'none';
    }
  });
}

/* ===== LOGIN ===== */
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  clearErrors();

  if (!email) { showFieldError('loginEmail', errorEl, 'Please enter your email.'); return; }
  if (!password) { showFieldError('loginPassword', errorEl, 'Please enter your password.'); return; }

  setLoading(btn, true, 'Signing in…');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || 'Login failed.';
      setLoading(btn, false, 'Sign In');
      return;
    }

    showSuccess(data.user.name, false);
  } catch {
    errorEl.textContent = 'Network error. Please try again.';
    setLoading(btn, false, 'Sign In');
  }
}

/* ===== REGISTER ===== */
async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const errorEl = document.getElementById('registerError');
  const btn = document.getElementById('registerBtn');

  clearErrors();

  if (!name) { showFieldError('regName', errorEl, 'Please enter your name.'); return; }
  if (!email) { showFieldError('regEmail', errorEl, 'Please enter your email.'); return; }
  if (!password) { showFieldError('regPassword', errorEl, 'Please choose a password.'); return; }
  if (password.length < 6) { showFieldError('regPassword', errorEl, 'Password must be at least 6 characters.'); return; }

  setLoading(btn, true, 'Creating account…');

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();

    if (res.status === 409) {
      // Already registered
      setLoading(btn, false, 'Create Account');
      document.getElementById('alreadyMsg').textContent =
        `You are already registered with this email${data.name ? ' as ' + data.name : ''}. Please sign in instead.`;
      document.getElementById('alreadyModal').style.display = 'flex';
      return;
    }

    if (!res.ok) {
      errorEl.textContent = data.error || 'Registration failed.';
      setLoading(btn, false, 'Create Account');
      return;
    }

    showSuccess(data.user.name, true);
  } catch {
    errorEl.textContent = 'Network error. Please try again.';
    setLoading(btn, false, 'Create Account');
  }
}

/* ===== SUCCESS REDIRECT ===== */
function showSuccess(name, isNew) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const successState = document.getElementById('successState');

  loginForm.style.display = 'none';
  registerForm.style.display = 'none';
  successState.style.display = 'block';

  const title = isNew ? `Welcome, ${name}!` : `Welcome back, ${name}!`;
  const msg = isNew
    ? 'Your account is ready. Taking you to the editor…'
    : 'You are already registered with this account. Taking you to the editor…';

  document.getElementById('successTitle').textContent = title;
  document.getElementById('successMsg').textContent = msg;

  // Store welcome message for editor
  sessionStorage.setItem('ch-welcome', JSON.stringify({ name, isNew }));

  // Progress bar animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById('progressFill').style.width = '100%';
    });
  });

  // Redirect after 2.2s
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect') || '/app';
  setTimeout(() => { window.location.href = redirect; }, 2200);
}

/* ===== HELPERS ===== */
function showFieldError(inputId, errorEl, msg) {
  const input = document.getElementById(inputId);
  if (input) input.classList.add('error');
  errorEl.textContent = msg;
}

function setLoading(btn, loading, label) {
  btn.disabled = loading;
  if (loading) {
    btn.innerHTML = `<div class="l-btn-spinner"></div> ${label}`;
  } else {
    btn.innerHTML = `<span class="l-btn-text">${label}</span>
      <svg class="l-btn-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
  }
}
