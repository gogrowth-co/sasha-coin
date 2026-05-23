// MangaOS Project Dashboard Server — v1.0
// Standard single-project dashboard. Config lives in dashboard.config.json.
// Run: node dashboard/server.js
// Or:  PORT=3005 node dashboard/server.js

const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT      = __dirname;
const WORKSPACE = path.resolve(ROOT, '..');
const HTML_FILE = path.join(ROOT, 'index.html');

// ── Config ────────────────────────────────────────────────────────────────────
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'dashboard.config.json'), 'utf8')); }
catch { /* use defaults */ }

const PROJECT_NAME  = cfg.projectName  || 'Project Dashboard';
const PROJECT_SLUG  = cfg.projectSlug  || 'project';
const PRIMARY_COLOR = cfg.primaryColor || '#1FB6FF';
const PORT = Number(process.env.PORT || cfg.port || 3004);

// ── Standard MangaOS paths ────────────────────────────────────────────────────
const TASKS_FILE     = path.join(WORKSPACE, 'social', 'tasks.json');
const CAMPAIGNS_FILE = path.join(WORKSPACE, 'campaigns', 'campaigns.json');

// ── Helpers ───────────────────────────────────────────────────────────────────
function readJSON(fp) {
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
  catch { return null; }
}

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJSON(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ── Server ────────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  setCORS(res);

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = (req.url || '/').split('?')[0];

  // GET / — serve dashboard HTML
  if (req.method === 'GET' && url === '/') {
    try {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(HTML_FILE, 'utf8'));
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Dashboard HTML not found.');
    }
    return;
  }

  // GET /api/config — project identity (loaded by index.html on boot)
  if (req.method === 'GET' && url === '/api/config') {
    sendJSON(res, {
      projectName:  PROJECT_NAME,
      projectSlug:  PROJECT_SLUG,
      primaryColor: PRIMARY_COLOR,
      logoEmoji:    cfg.logoEmoji    || '🔵',
      description:  cfg.description  || 'Marketing Ops Dashboard',
    });
    return;
  }

  // GET /api/tasks — full tasks.json
  if (req.method === 'GET' && url === '/api/tasks') {
    const data = readJSON(TASKS_FILE);
    if (!data) { sendJSON(res, { error: 'tasks.json not found' }, 500); return; }
    sendJSON(res, data);
    return;
  }

  // GET /api/campaigns — full campaigns.json
  if (req.method === 'GET' && url === '/api/campaigns') {
    const data = readJSON(CAMPAIGNS_FILE);
    if (!data) { sendJSON(res, { error: 'campaigns.json not found' }, 500); return; }
    sendJSON(res, data);
    return;
  }

  // GET /api/health — computed task + campaign stats
  if (req.method === 'GET' && url === '/api/health') {
    const tasks     = readJSON(TASKS_FILE)?.tasks     || [];
    const campaigns = readJSON(CAMPAIGNS_FILE)?.campaigns || [];
    sendJSON(res, {
      tasks: {
        total:           tasks.length,
        done:            tasks.filter(t => t.status === 'done').length,
        inProgress:      tasks.filter(t => t.status === 'in-progress' || t.status === 'inprogress').length,
        blocked:         tasks.filter(t => t.status === 'blocked').length,
        pendingApproval: tasks.filter(t => t.approvalStatus === 'pending').length,
        qaHold:          tasks.filter(t => t.qaStatus === 'hold').length,
      },
      campaigns: {
        total:        campaigns.length,
        active:       campaigns.filter(c => c.status === 'active').length,
        pendingGates: campaigns.reduce((n, c) =>
          n + (c.approvalGates || []).filter(g => g.status === 'pending').length, 0),
      },
    });
    return;
  }

  // GET /api/approval-queue — pending approval tasks, oldest first
  if (req.method === 'GET' && url === '/api/approval-queue') {
    const tasks = readJSON(TASKS_FILE)?.tasks || [];
    const queue = tasks
      .filter(t => t.approvalStatus === 'pending' || t.qaStatus === 'hold')
      .sort((a, b) => new Date(a.statusChangedDate || 0) - new Date(b.statusChangedDate || 0));
    sendJSON(res, { tasks: queue });
    return;
  }

  // GET /api/upcoming — tasks with dueDate in next 14 days (not done)
  if (req.method === 'GET' && url === '/api/upcoming') {
    const tasks = readJSON(TASKS_FILE)?.tasks || [];
    const now    = new Date();
    const cutoff = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const upcoming = tasks
      .filter(t => {
        if (!t.dueDate || t.status === 'done') return false;
        const d = new Date(t.dueDate);
        return d <= cutoff; // include overdue items too
      })
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    sendJSON(res, { tasks: upcoming });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`${PROJECT_NAME} dashboard → http://localhost:${PORT}`);
});
