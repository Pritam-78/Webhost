import express from 'express';
import pkg from 'pg';
import { nanoid } from 'nanoid';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import session from 'express-session';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pkg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 5000;
const SALT_ROUNDS = 12;
const ADMIN_PASSWORD = 'pritamkp@ixA';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

// Ensure tables exist
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      last_login TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sites (
      id VARCHAR(16) PRIMARY KEY,
      title VARCHAR(255) DEFAULT 'Untitled Project',
      html_code TEXT DEFAULT '',
      css_code TEXT DEFAULT '',
      js_code TEXT DEFAULT '',
      edit_token VARCHAR(64),
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      views INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('Database ready');
}
initDB().catch(console.error);

app.use(compression());
app.use(cors({ credentials: true }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '5mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'codehost-secret-fallback',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax',
  }
}));

// Serve landing page for root
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.use(express.static(join(__dirname, 'public')));

/* ===== AUTH MIDDLEWARE ===== */
function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.redirect('/?redirect=' + encodeURIComponent(req.path));
  }
  next();
}

function checkAdminPassword(req, res) {
  const password = req.body?.password || req.headers['x-admin-password'];
  if (password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Incorrect password.' });
    return false;
  }
  return true;
}

/* ===== AUTH ROUTES ===== */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, name, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    const normalizedEmail = email.toLowerCase().trim();

    // Check if already exists
    const existing = await pool.query('SELECT id, name FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'already_registered',
        message: 'This email is already registered.',
        name: existing.rows[0].name
      });
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
      [normalizedEmail, name.trim(), hash]
    );

    const user = result.rows[0];
    req.session.userId = user.id;
    req.session.userName = user.name;
    req.session.userEmail = user.email;

    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email }, isNew: true });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const normalizedEmail = email.toLowerCase().trim();

    const result = await pool.query(
      'SELECT id, email, name, password_hash FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'No account found with this email.' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    req.session.userId = user.id;
    req.session.userName = user.name;
    req.session.userEmail = user.email;

    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email }, isNew: false });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Not logged in.' });
  }
  res.json({
    id: req.session.userId,
    name: req.session.userName,
    email: req.session.userEmail
  });
});

/* ===== ADMIN ROUTES ===== */
app.get('/api/admin/verify', (req, res) => {
  const password = req.headers['x-admin-password'];
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Incorrect password.' });
  res.json({ ok: true });
});

app.get('/api/admin/sites', async (req, res) => {
  try {
    const password = req.headers['x-admin-password'];
    if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Incorrect password.' });
    const result = await pool.query(
      `SELECT s.id, s.title, s.views, s.created_at, s.updated_at,
              u.email as user_email, u.name as user_name
       FROM sites s LEFT JOIN users u ON s.user_id = u.id
       ORDER BY s.created_at DESC`
    );
    res.json({ total: result.rows.length, sites: result.rows });
  } catch (err) {
    console.error('Admin sites error:', err);
    res.status(500).json({ error: 'Failed to load sites.' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const password = req.headers['x-admin-password'];
    if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Incorrect password.' });
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.created_at, u.last_login,
              COUNT(s.id)::int as site_count
       FROM users u LEFT JOIN sites s ON s.user_id = u.id
       GROUP BY u.id ORDER BY u.created_at DESC`
    );
    res.json({ total: result.rows.length, users: result.rows });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Failed to load users.' });
  }
});

/* ===== PUBLISH / SITE ROUTES ===== */
app.post('/api/publish', async (req, res) => {
  try {
    if (!checkAdminPassword(req, res)) return;
    const { title, html, css, js, siteId, editToken } = req.body;
    if (!html && !css && !js) {
      return res.status(400).json({ error: 'At least one code section is required.' });
    }
    if (siteId && editToken) {
      const existing = await pool.query(
        'SELECT id FROM sites WHERE id = $1 AND edit_token = $2',
        [siteId, editToken]
      );
      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE sites SET title = $1, html_code = $2, css_code = $3, js_code = $4, updated_at = NOW() WHERE id = $5`,
          [title || 'Untitled Project', html || '', css || '', js || '', siteId]
        );
        return res.json({ siteId, editToken, updated: true });
      }
    }
    const id = nanoid(10);
    const token = nanoid(32);
    const userId = req.session?.userId || null;
    await pool.query(
      `INSERT INTO sites (id, title, html_code, css_code, js_code, edit_token, user_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, title || 'Untitled Project', html || '', css || '', js || '', token, userId]
    );
    res.json({ siteId: id, editToken: token, updated: false });
  } catch (err) {
    console.error('Publish error:', err);
    res.status(500).json({ error: 'Failed to publish site.' });
  }
});

app.get('/api/site/:siteId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, html_code, css_code, js_code, created_at, updated_at FROM sites WHERE id = $1',
      [req.params.siteId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Site not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load site.' });
  }
});

app.delete('/api/site/:siteId', async (req, res) => {
  try {
    if (!checkAdminPassword(req, res)) return;
    const result = await pool.query(
      'DELETE FROM sites WHERE id = $1 RETURNING id, title',
      [req.params.siteId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Site not found.' });
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete site.' });
  }
});

app.get('/site/:siteId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT html_code, css_code, js_code, title FROM sites WHERE id = $1',
      [req.params.siteId]
    );
    if (result.rows.length === 0) {
      return res.status(404).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>404</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:#e2e8f0}.box{text-align:center}h1{font-size:4rem;margin:0;color:#6366f1}p{color:#94a3b8;margin:12px 0 24px}a{color:#6366f1;text-decoration:none;font-weight:600}</style>
</head><body><div class="box"><h1>404</h1><p>This site doesn't exist or has been removed.</p><a href="/">← Back to CodeHost</a></div></body></html>`);
    }
    await pool.query('UPDATE sites SET views = views + 1 WHERE id = $1', [req.params.siteId]);
    const { html_code, css_code, js_code, title } = result.rows[0];
    res.set('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${escapeHtml(title)}</title><style>${css_code}</style></head><body>${html_code}<script>${js_code}<\/script></body></html>`);
  } catch (err) {
    res.status(500).send('Error loading site.');
  }
});

/* ===== PAGE ROUTES ===== */
app.get('/app', requireAuth, (req, res) => {
  res.sendFile(join(__dirname, 'public', 'app.html'));
});

app.get('/editor/:siteId', requireAuth, (req, res) => {
  res.sendFile(join(__dirname, 'public', 'app.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'admin.html'));
});

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CodeHost server running on port ${PORT}`);
});
