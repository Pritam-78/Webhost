import express from 'express';
import pkg from 'pg';
import { nanoid } from 'nanoid';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pkg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 5000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

app.use(compression());
app.use(cors());
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.static(join(__dirname, 'public')));

function generateId() {
  return nanoid(10);
}

function generateEditToken() {
  return nanoid(32);
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/publish', async (req, res) => {
  try {
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

    const id = generateId();
    const token = generateEditToken();
    await pool.query(
      `INSERT INTO sites (id, title, html_code, css_code, js_code, edit_token) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, title || 'Untitled Project', html || '', css || '', js || '', token]
    );

    res.json({ siteId: id, editToken: token, updated: false });
  } catch (err) {
    console.error('Publish error:', err);
    res.status(500).json({ error: 'Failed to publish site.' });
  }
});

app.get('/api/site/:siteId', async (req, res) => {
  try {
    const { siteId } = req.params;
    const result = await pool.query(
      'SELECT id, title, html_code, css_code, js_code, created_at, updated_at FROM sites WHERE id = $1',
      [siteId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Site not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get site error:', err);
    res.status(500).json({ error: 'Failed to load site.' });
  }
});

app.get('/site/:siteId', async (req, res) => {
  try {
    const { siteId } = req.params;
    const result = await pool.query(
      'SELECT html_code, css_code, js_code, title FROM sites WHERE id = $1',
      [siteId]
    );
    if (result.rows.length === 0) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><title>404 - Site Not Found</title>
        <style>
          body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #e2e8f0; }
          .box { text-align: center; }
          h1 { font-size: 4rem; margin: 0; color: #6366f1; }
          p { color: #94a3b8; }
          a { color: #6366f1; text-decoration: none; font-weight: 600; }
          a:hover { text-decoration: underline; }
        </style>
        </head>
        <body><div class="box"><h1>404</h1><p>This site doesn't exist or has been removed.</p><a href="/">← Back to CodeHost</a></div></body>
        </html>
      `);
    }

    await pool.query('UPDATE sites SET views = views + 1 WHERE id = $1', [siteId]);

    const { html_code, css_code, js_code, title } = result.rows[0];
    const combined = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
${css_code}
</style>
</head>
<body>
${html_code}
<script>
${js_code}
</script>
</body>
</html>`;
    res.set('Content-Type', 'text/html');
    res.send(combined);
  } catch (err) {
    console.error('Serve site error:', err);
    res.status(500).send('Error loading site.');
  }
});

app.get('/editor/:siteId', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CodeHost server running on port ${PORT}`);
});
