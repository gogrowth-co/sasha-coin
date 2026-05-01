const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = __dirname;
const TASKS_FILE          = path.join(ROOT, 'social', 'tasks.json');
const CAMPAIGNS_FILE      = path.join(ROOT, 'campaigns', 'campaigns.json');
const DISPATCH_QUEUE_FILE = path.join(ROOT, 'social', 'dispatch-queue.json');
const BLOG_REGISTRY_FILE  = path.join(ROOT, 'seo', 'blog-registry.json');
const HTML_FILE           = path.join(ROOT, 'tasks.html');
const REPORTS_HTML_FILE   = path.join(ROOT, 'reports.html');
const ONBOARDING_HTML_FILE = path.join(ROOT, 'onboarding.html');
const SASHA_HTML_FILE      = path.join(ROOT, 'sasha.html');

function loadEnv() {
  const envFile = path.join(ROOT, '.env');
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const idx = line.indexOf('=');
    if (idx > 0) {
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      if (k && !process.env[k]) process.env[k] = v;
    }
  }
}
loadEnv();

const PORT = Number(process.env.PORT || process.env.TASK_SERVER_PORT || 3001);

const server = http.createServer((req, res) => {

  // ── tasks ──────────────────────────────────────────────────────────────────

  if (req.method === 'GET' && req.url === '/api/tasks') {
    fs.readFile(TASKS_FILE, 'utf8', (err, data) => {
      if (err) { res.writeHead(500, {'Content-Type':'application/json'}); res.end(JSON.stringify({ error: 'Failed to read tasks.json' })); return; }
      res.writeHead(200, {'Content-Type':'application/json'}); res.end(data);
    });
    return;
  }

  if (req.method === 'PUT' && req.url === '/api/tasks') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { JSON.parse(body); } catch (e) { res.writeHead(400, {'Content-Type':'application/json'}); res.end(JSON.stringify({ error: 'Invalid JSON' })); return; }
      fs.writeFile(TASKS_FILE, body, 'utf8', err => {
        if (err) { res.writeHead(500, {'Content-Type':'application/json'}); res.end(JSON.stringify({ error: 'Failed to write tasks.json' })); return; }
        res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({ ok: true }));
      });
    });
    return;
  }

  // ── campaigns ──────────────────────────────────────────────────────────────

  if (req.method === 'GET' && req.url === '/api/campaigns') {
    fs.readFile(CAMPAIGNS_FILE, 'utf8', (err, data) => {
      if (err) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({ campaigns: [] })); return; }
      res.writeHead(200, {'Content-Type':'application/json'}); res.end(data);
    });
    return;
  }

  if (req.method === 'PUT' && req.url === '/api/campaigns') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { JSON.parse(body); } catch (e) { res.writeHead(400, {'Content-Type':'application/json'}); res.end(JSON.stringify({ error: 'Invalid JSON' })); return; }
      fs.writeFile(CAMPAIGNS_FILE, body, 'utf8', err => {
        if (err) { res.writeHead(500, {'Content-Type':'application/json'}); res.end(JSON.stringify({ error: 'Failed to write campaigns.json' })); return; }
        res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({ ok: true }));
      });
    });
    return;
  }

  // ── dispatch queue ─────────────────────────────────────────────────────────

  if (req.method === 'GET' && req.url === '/api/dispatch') {
    fs.readFile(DISPATCH_QUEUE_FILE, 'utf8', (err, data) => {
      if (err) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({ queue: [] })); return; }
      res.writeHead(200, {'Content-Type':'application/json'}); res.end(data);
    });
    return;
  }

  const dispatchMatch = req.method === 'POST' && req.url.match(/^\/api\/dispatch\/([^/]+)$/);
  if (dispatchMatch) {
    const taskId = dispatchMatch[1];
    fs.readFile(DISPATCH_QUEUE_FILE, 'utf8', (err, data) => {
      let q = { queue: [] };
      if (!err) { try { q = JSON.parse(data); } catch(e) {} }
      if (!q.queue.find(i => i.id === taskId)) q.queue.push({ id: taskId, queuedAt: new Date().toISOString() });
      fs.writeFile(DISPATCH_QUEUE_FILE, JSON.stringify(q, null, 2), 'utf8', writeErr => {
        if (writeErr) { res.writeHead(500, {'Content-Type':'application/json'}); res.end(JSON.stringify({ error: 'Failed to write queue' })); return; }
        res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({ ok: true, id: taskId, queue: q.queue }));
      });
    });
    return;
  }

  // ── CE queue (Content Engine stage dispatch) ───────────────────────────────

  if (req.method === 'POST' && req.url === '/api/ce/queue') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let payload;
      try { payload = JSON.parse(body); } catch { res.writeHead(400, {'Content-Type':'application/json'}); res.end(JSON.stringify({ error: 'Invalid JSON' })); return; }
      const { taskId, stage, agent, title, campaign, channels } = payload;
      if (!taskId || !stage || !agent) { res.writeHead(400, {'Content-Type':'application/json'}); res.end(JSON.stringify({ error: 'taskId, stage, and agent are required' })); return; }
      fs.readFile(DISPATCH_QUEUE_FILE, 'utf8', (err, data) => {
        let q = { queue: [] };
        if (!err) { try { q = JSON.parse(data); } catch(e) {} }
        q.queue = q.queue.filter(i => !(i.taskId === taskId && i.stage === stage));
        q.queue.push({ taskId, stage, agent, title: title || taskId, campaign: campaign || null, channels: channels || [], queuedAt: new Date().toISOString() });
        fs.writeFile(DISPATCH_QUEUE_FILE, JSON.stringify(q, null, 2), 'utf8', writeErr => {
          if (writeErr) { res.writeHead(500, {'Content-Type':'application/json'}); res.end(JSON.stringify({ error: 'Failed to write dispatch-queue.json' })); return; }
          res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({ ok: true, taskId, stage, agent, queueLength: q.queue.length }));
        });
      });
    });
    return;
  }

  const ceQueueDelMatch = req.method === 'DELETE' && req.url.match(/^\/api\/ce\/queue\/([^/]+)$/);
  if (ceQueueDelMatch) {
    const taskId = decodeURIComponent(ceQueueDelMatch[1]);
    fs.readFile(DISPATCH_QUEUE_FILE, 'utf8', (err, data) => {
      let q = { queue: [] };
      if (!err) { try { q = JSON.parse(data); } catch(e) {} }
      const before = q.queue.length;
      q.queue = q.queue.filter(i => i.taskId !== taskId);
      fs.writeFile(DISPATCH_QUEUE_FILE, JSON.stringify(q, null, 2), 'utf8', writeErr => {
        if (writeErr) { res.writeHead(500, {'Content-Type':'application/json'}); res.end(JSON.stringify({ error: 'Write failed' })); return; }
        res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({ ok: true, removed: before - q.queue.length }));
      });
    });
    return;
  }

  // ── blog registry ──────────────────────────────────────────────────────────

  // ── reports ────────────────────────────────────────────────────────────────

  const refreshMatch = req.method === 'POST' && req.url.match(/^\/api\/reports\/refresh\/([a-z-]+)$/);
  if (refreshMatch) {
    const kind = refreshMatch[1];
    const allowed = {
      'seo': 'refresh-seo.mjs',
      'traffic': 'refresh-traffic.mjs',
      'keywords': 'refresh-keywords.mjs',
      'prompts-weekly': 'refresh-prompts-weekly.mjs',
      'prompts-monthly': 'refresh-prompts-monthly.mjs',
    };
    const script = allowed[kind];
    if (!script) { res.writeHead(404, {'Content-Type':'application/json'}); res.end(JSON.stringify({ error: 'unknown kind' })); return; }
    const child = spawn('node', [path.join(ROOT, 'reports', 'scripts', script)], { cwd: ROOT });
    let out = '';
    let err = '';
    child.stdout.on('data', d => out += d);
    child.stderr.on('data', d => err += d);
    child.on('close', code => {
      res.writeHead(code === 0 ? 200 : 500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ kind, exitCode: code, stdout: out.slice(-2000), stderr: err.slice(-2000) }));
    });
    return;
  }

  const reportsMatch = req.method === 'GET' && req.url.match(/^\/api\/reports\/([a-z-]+)(?:\?.*)?$/);
  if (reportsMatch) {
    const kind = reportsMatch[1];
    const allowed = ['seo', 'traffic', 'keywords', 'prompts-weekly', 'prompts-monthly'];
    if (!allowed.includes(kind)) { res.writeHead(404, {'Content-Type':'application/json'}); res.end(JSON.stringify({ error: 'unknown kind' })); return; }
    const dir = path.join(ROOT, 'reports', 'snapshots');
    fs.readdir(dir, (err, files) => {
      if (err) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({ latest: null, history: [] })); return; }
      const re = new RegExp(`^(\\d{4}-\\d{2}-\\d{2})-${kind}\\.json$`);
      const matched = files.map(f => ({ file: f, m: re.exec(f) })).filter(x => x.m);
      matched.sort((a, b) => a.m[1].localeCompare(b.m[1]));
      const history = [];
      for (const x of matched.slice(-13)) {
        try { history.push(JSON.parse(fs.readFileSync(path.join(dir, x.file), 'utf8'))); }
        catch (e) { console.warn(`[reports] skipping corrupt snapshot ${x.file}: ${e.message}`); }
      }
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ latest: history[history.length - 1] || null, history }));
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/api/blog-registry') {
    fs.readFile(BLOG_REGISTRY_FILE, 'utf8', (err, data) => {
      if (err) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({ lastSynced: null, articles: [] })); return; }
      res.writeHead(200, {'Content-Type':'application/json'}); res.end(data);
    });
    return;
  }

  if (req.method === 'PUT' && req.url === '/api/blog-registry') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { JSON.parse(body); } catch (e) { res.writeHead(400, {'Content-Type':'application/json'}); res.end(JSON.stringify({ error: 'Invalid JSON' })); return; }
      fs.writeFile(BLOG_REGISTRY_FILE, body, 'utf8', err => {
        if (err) { res.writeHead(500, {'Content-Type':'application/json'}); res.end(JSON.stringify({ error: 'Failed to write blog-registry.json' })); return; }
        res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({ ok: true }));
      });
    });
    return;
  }

  // POST /api/blog-registry/sync — pull updated_at from CMS and merge into registry
  // Requires env vars: CONTENT_CMS_URL and CONTENT_MCP_SECRET
  if (req.method === 'POST' && req.url === '/api/blog-registry/sync') {
    const mcpUrl    = process.env.CONTENT_CMS_URL    || '';
    const mcpSecret = process.env.CONTENT_MCP_SECRET || '';
    if (!mcpUrl || !mcpSecret) {
      res.writeHead(503, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: 'CONTENT_CMS_URL and CONTENT_MCP_SECRET not configured in .env' }));
      return;
    }
    (async () => {
      let registry = { lastSynced: null, articles: [] };
      try { registry = JSON.parse(fs.readFileSync(BLOG_REGISTRY_FILE, 'utf8')); } catch (e) {}

      const mcpRes = await fetch(mcpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-MCP-Secret': mcpSecret },
        body: JSON.stringify({ tool: 'list_pages', input: {} })
      });
      if (!mcpRes.ok) { const t = await mcpRes.text(); res.writeHead(502, {'Content-Type':'application/json'}); res.end(JSON.stringify({ error: `CMS error: ${t}` })); return; }
      const mcpData = await mcpRes.json();
      const pages = mcpData.pages || mcpData.result || [];

      let updated = 0;
      for (const article of registry.articles) {
        const page = pages.find(p => p.slug === article.slug || p.en_slug === article.slug);
        if (!page) continue;
        const mcpDate = (page.updated_at || page.updatedAt || '').slice(0, 10);
        if (!mcpDate || article.lastUpdatedSource === 'manual') continue;
        if (mcpDate > article.lastUpdated) { article.lastUpdated = mcpDate; article.lastUpdatedSource = 'mcp'; updated++; }
      }
      registry.lastSynced = new Date().toISOString();
      fs.writeFileSync(BLOG_REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf8');
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true, updated, lastSynced: registry.lastSynced, articles: registry.articles }));
    })().catch(e => { res.writeHead(500, {'Content-Type':'application/json'}); res.end(JSON.stringify({ error: e.message })); });
    return;
  }

  // ── file API (read-only, sandboxed to project root) ────────────────────────

  // ── Sasha activity (VPS state mirror, read-only) ─────────────────────────
  // Returns: { posted: [...], errors: [...], calendar_state: {...}, last_synced: ISO }
  // Reads /docker/openclaw-h3mk/data/.openclaw/state/*.json over SSH.
  if (req.method === 'GET' && req.url === '/api/sasha-state') {
    const VPS_HOST = process.env.SASHA_VPS_HOST || 'root@187.77.42.134';
    const VPS_KEY  = process.env.SASHA_VPS_KEY  || (process.env.HOME + '/.ssh/hostinger_vps');
    const STATE_DIR = '/docker/openclaw-h3mk/data/.openclaw/state';
    // Concatenate three files into one stdout payload with separators
    const cmd = `cat ${STATE_DIR}/posted-log.json 2>/dev/null || echo '[]'; echo '###SEP###'; cat ${STATE_DIR}/post-errors.json 2>/dev/null || echo '[]'; echo '###SEP###'; cat ${STATE_DIR}/calendar-state.json 2>/dev/null || echo '{}'`;
    const ssh = spawn('ssh', ['-i', VPS_KEY, '-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=5', VPS_HOST, cmd]);
    let out = '', err = '';
    ssh.stdout.on('data', d => { out += d; });
    ssh.stderr.on('data', d => { err += d; });
    ssh.on('close', code => {
      if (code !== 0) {
        res.writeHead(502, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ error: 'SSH failed', stderr: err.slice(0, 500), code }));
        return;
      }
      const parts = out.split('###SEP###');
      const safeParse = (s, fallback) => { try { return JSON.parse(s.trim() || (Array.isArray(fallback) ? '[]' : '{}')); } catch (e) { return fallback; } };
      const payload = {
        posted:         safeParse(parts[0] || '', []),
        errors:         safeParse(parts[1] || '', []),
        calendar_state: safeParse(parts[2] || '', {}),
        last_synced:    new Date().toISOString(),
      };
      res.writeHead(200, {'Content-Type':'application/json', 'Cache-Control':'no-cache'});
      res.end(JSON.stringify(payload));
    });
    return;
  }

  // ── Buffer queue mirror (Buffer Cloud API, read-only) ────────────────────
  // Returns Buffer's pending + recently-sent posts for Sasha's channel.
  if (req.method === 'GET' && req.url === '/api/buffer-queue') {
    const TOKEN = process.env.BUFFER_ACCESS_TOKEN;
    const CHANNEL = process.env.BUFFER_CHANNEL_ID;
    if (!TOKEN || !CHANNEL) {
      res.writeHead(503, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ error: 'BUFFER_ACCESS_TOKEN or BUFFER_CHANNEL_ID not set in .env' }));
      return;
    }
    const QUERY = `query Channel($id: ChannelId!) {
      channel(id: $id) {
        id name
        posts(first: 30, status: ALL) {
          edges { node { id status text scheduledAt sentAt createdAt } }
        }
      }
    }`;
    const body = JSON.stringify({ query: QUERY, variables: { id: CHANNEL } });
    const reqOpts = {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + TOKEN }
    };
    fetch('https://api.buffer.com', { ...reqOpts, body })
      .then(r => r.json())
      .then(data => {
        const edges = (data?.data?.channel?.posts?.edges || []).map(e => e.node);
        res.writeHead(200, {'Content-Type':'application/json', 'Cache-Control':'no-cache'});
        res.end(JSON.stringify({ channel: data?.data?.channel?.name || null, posts: edges, raw_errors: data?.errors || null }));
      })
      .catch(e => {
        res.writeHead(502, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ error: 'Buffer API failed', detail: e.message }));
      });
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/api/file')) {
    const qs = req.url.includes('?') ? req.url.split('?').slice(1).join('?') : '';
    const relPath = new URLSearchParams(qs).get('path');
    if (!relPath) { res.writeHead(400); res.end('Missing path param'); return; }
    const safePath = path.resolve(ROOT, relPath);
    if (!safePath.startsWith(ROOT + path.sep) && safePath !== ROOT) { res.writeHead(403); res.end('Forbidden'); return; }
    const CT = { '.md':'text/plain;charset=utf-8', '.html':'text/html;charset=utf-8', '.json':'application/json',
      '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif',
      '.svg':'image/svg+xml', '.webp':'image/webp', '.pdf':'application/pdf' };
    fs.readFile(safePath, (err, data) => {
      if (err) { res.writeHead(404, {'Content-Type':'text/plain'}); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': CT[path.extname(relPath).toLowerCase()] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
    return;
  }

  // ── HTML pages ─────────────────────────────────────────────────────────────

  if (req.method === 'GET' && (req.url === '/' || req.url === '/tasks.html')) {
    fs.readFile(HTML_FILE, 'utf8', (err, data) => {
      if (err) { res.writeHead(500, {'Content-Type':'text/plain'}); res.end('Failed to read tasks.html'); return; }
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); res.end(data);
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/reports') {
    fs.readFile(REPORTS_HTML_FILE, 'utf8', (err, data) => {
      if (err) { res.writeHead(500, {'Content-Type':'text/plain'}); res.end('reports.html not found'); return; }
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); res.end(data);
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/sasha') {
    fs.readFile(SASHA_HTML_FILE, 'utf8', (err, data) => {
      if (err) { res.writeHead(500, {'Content-Type':'text/plain'}); res.end('sasha.html not found'); return; }
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); res.end(data);
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/onboarding') {
    fs.readFile(ONBOARDING_HTML_FILE, 'utf8', (err, data) => {
      if (err) { res.writeHead(500, {'Content-Type':'text/plain'}); res.end('onboarding.html not found'); return; }
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); res.end(data);
    });
    return;
  }

  res.writeHead(404, {'Content-Type':'text/plain'}); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Task server running → http://localhost:${PORT}`);
  console.log(`  Tasks:    http://localhost:${PORT}/`);
  console.log(`  Reports:  http://localhost:${PORT}/reports`);
  console.log(`  Sasha:    http://localhost:${PORT}/sasha`);
  console.log(`  Setup:    http://localhost:${PORT}/onboarding`);
  console.log(`  Blog CMS: http://localhost:${PORT}/ → Blog CMS tab`);
});
