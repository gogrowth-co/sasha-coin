const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = __dirname;
let cfg = {};
try { cfg = require(path.join(ROOT, 'mangaos.config.json')); } catch (e) {}
const PORT = Number(process.env.TASK_SERVER_PORT || process.env.PORT || cfg?.port || 3005);
const PROJECT_NAME = cfg.projectName || 'Task Board';
const TASKS_FILE = path.join(ROOT, 'social', 'tasks.json');
const CAMPAIGNS_FILE = path.join(ROOT, 'campaigns', 'campaigns.json');
const DISPATCH_QUEUE_FILE = path.join(ROOT, 'social', 'dispatch-queue.json');
const BLOG_REGISTRY_FILE = path.join(ROOT, 'seo', 'blog-registry.json');
const HTML_FILE = path.join(ROOT, 'tasks.html');
const SASHA_HTML_FILE = path.join(ROOT, 'sasha.html');
const REPLIES_HTML_FILE = path.join(ROOT, 'replies.html');
const REPLY_FEED_HTML_FILE = path.join(ROOT, 'reply-feed.html');
const KOL_TARGETS_FILE = path.join(ROOT, 'content', 'reply-targets.json');
const KOL_FEED_FILE = path.join(ROOT, 'content', 'kol-feed.json');
const REPLY_LOG_FILE = path.join(ROOT, 'state', 'posted-log.json');

const server = http.createServer((req, res) => {
  // GET /api/health — lightweight liveness check
  if (req.method === 'GET' && req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'task-server', port: PORT }));
    return;
  }

  // GET /api/tasks — read tasks.json from disk
  if (req.method === 'GET' && req.url === '/api/tasks') {
    fs.readFile(TASKS_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to read tasks.json' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    });
    return;
  }

  // PUT /api/tasks — write to tasks.json on disk
  if (req.method === 'PUT' && req.url === '/api/tasks') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        JSON.parse(body); // validate it's real JSON
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }
      fs.writeFile(TASKS_FILE, body, 'utf8', err => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to write tasks.json' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    return;
  }

  // GET /api/campaigns — read campaigns.json from disk
  if (req.method === 'GET' && req.url === '/api/campaigns') {
    fs.readFile(CAMPAIGNS_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ campaigns: [] }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    });
    return;
  }

  // POST /api/campaigns — create a new campaign, scaffold folder + brief.md + assets.md
  if (req.method === 'POST' && req.url === '/api/campaigns') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let payload;
      try { payload = JSON.parse(body); } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }
      const { name, type, startDate, endDate, goal, platforms, parentCampaign } = payload;
      if (!name || !startDate) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'name and startDate are required' }));
        return;
      }
      // Generate slug from name + startDate year
      const slug = name.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        + '-' + startDate.slice(0, 4);

      // Read existing campaigns.json
      let data;
      try { data = JSON.parse(fs.readFileSync(CAMPAIGNS_FILE, 'utf8')); }
      catch (e) { data = { campaigns: [] }; }

      // Check for duplicate slug
      if (data.campaigns.find(c => c.id === slug)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Campaign with this slug already exists', slug }));
        return;
      }

      const now = new Date().toISOString();
      const newCampaign = {
        id: slug,
        slug,
        name,
        status: 'draft',
        type: type || 'content',
        startDate,
        endDate: endDate || '',
        owner: 'gabriel',
        goal: goal || '',
        platforms: platforms || [],
        parentCampaign: parentCampaign || null,
        kpis: [],
        createdAt: now
      };

      data.campaigns.push(newCampaign);
      data.lastUpdated = now;

      // Write campaigns.json
      fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(data, null, 2), 'utf8');

      // Scaffold campaign folder
      const campaignDir = path.join(ROOT, 'campaigns', slug);
      if (!fs.existsSync(campaignDir)) fs.mkdirSync(campaignDir, { recursive: true });

      // Write brief.md
      const briefContent = `# Campaign Brief: ${name}

**Campaign ID:** ${slug}
**Status:** draft
**Owner:** gabriel
**Type:** ${type || 'content'}
**Start Date:** ${startDate}
**End Date:** ${endDate || 'TBD'}
${parentCampaign ? `**Parent campaign:** ${parentCampaign}\n` : ''}
---

## Goal

${goal || 'Define the campaign goal here.'}

---

## ICP

Define the specific audience segment this campaign targets.

---

## Channels & Platforms

${(platforms || []).join(', ') || 'TBD'}

---

## UTM Convention

\`\`\`
utm_source=[platform]
utm_medium=[paid|organic|email]
utm_campaign=${slug}
utm_content=[variant]
\`\`\`

---

## Budget

| Platform | Run Dates | Daily Budget | Total |
|---|---|---|---|
| TBD | TBD | TBD | TBD |

---

## Measurement

Check in GA4 using \`utm_campaign=${slug}\` filter.

First read: TBD.
`;

      // Write assets.md
      const assetsContent = `# Assets: ${name}

**Campaign ID:** ${slug}

---

## Produced Files

| File | Type | Status | Notes |
|---|---|---|---|
| _(none yet)_ | — | — | — |

---

## Copy

_(Add final approved copy here)_

---

## Visuals

_(Add visual asset paths here)_
`;

      const briefPath = path.join(campaignDir, 'brief.md');
      const assetsPath = path.join(campaignDir, 'assets.md');
      if (!fs.existsSync(briefPath)) fs.writeFileSync(briefPath, briefContent, 'utf8');
      if (!fs.existsSync(assetsPath)) fs.writeFileSync(assetsPath, assetsContent, 'utf8');

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, slug, campaign: newCampaign }));
    });
    return;
  }

  // PUT /api/campaigns — write to campaigns.json on disk
  if (req.method === 'PUT' && req.url === '/api/campaigns') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        JSON.parse(body); // validate it's real JSON
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }
      fs.writeFile(CAMPAIGNS_FILE, body, 'utf8', err => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to write campaigns.json' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    return;
  }

  // GET / or /tasks.html — serve the dashboard
  if (req.method === 'GET' && (req.url === '/' || req.url === '/tasks.html')) {
    fs.readFile(HTML_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Failed to read tasks.html');
        return;
      }
      const html = data
        .replace('<title>MangaOS Task Board</title>', `<title>${PROJECT_NAME} Task Board</title>`)
        .replace('>MangaOS Task Board</div>', `>${PROJECT_NAME} Task Board</div>`)
        .replace('>MangaOS</span>', `>${PROJECT_NAME}</span>`);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    return;
  }

  // GET /reports — serve reports.html
  if (req.method === 'GET' && req.url === '/reports') {
    fs.readFile(path.join(__dirname, 'reports.html'), 'utf8', (err, data) => {
      if (err) { res.writeHead(500); res.end('reports.html not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // GET /api/dispatch — read dispatch queue
  if (req.method === 'GET' && req.url === '/api/dispatch') {
    fs.readFile(DISPATCH_QUEUE_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ queue: [] }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    });
    return;
  }

  // POST /api/dispatch/:id — add task to dispatch queue
  const dispatchMatch = req.method === 'POST' && req.url.match(/^\/api\/dispatch\/([^/]+)$/);
  if (dispatchMatch) {
    const taskId = dispatchMatch[1];
    fs.readFile(DISPATCH_QUEUE_FILE, 'utf8', (err, data) => {
      let q = { queue: [] };
      if (!err) { try { q = JSON.parse(data); } catch(e) {} }
      if (!q.queue.find(i => i.id === taskId)) {
        q.queue.push({ id: taskId, queuedAt: new Date().toISOString() });
      }
      fs.writeFile(DISPATCH_QUEUE_FILE, JSON.stringify(q, null, 2), 'utf8', writeErr => {
        if (writeErr) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to write queue' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, id: taskId, queue: q.queue }));
      });
    });
    return;
  }

  // POST /api/ce/queue — write a CE stage execution entry to dispatch-queue.json
  // body: { taskId, stage, agent, title?, campaign?, channels? }
  if (req.method === 'POST' && req.url === '/api/ce/queue') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let payload;
      try { payload = JSON.parse(body); } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }
      const { taskId, stage, agent, title, campaign, channels } = payload;
      if (!taskId || !stage || !agent) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'taskId, stage, and agent are required' }));
        return;
      }
      fs.readFile(DISPATCH_QUEUE_FILE, 'utf8', (err, data) => {
        let q = { queue: [] };
        if (!err) { try { q = JSON.parse(data); } catch(e) {} }
        // Remove any existing entry for this taskId+stage combo to avoid duplicates
        q.queue = q.queue.filter(i => !(i.taskId === taskId && i.stage === stage));
        q.queue.push({ taskId, stage, agent, title: title || taskId, campaign: campaign || null, channels: channels || [], queuedAt: new Date().toISOString() });
        fs.writeFile(DISPATCH_QUEUE_FILE, JSON.stringify(q, null, 2), 'utf8', writeErr => {
          if (writeErr) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to write dispatch-queue.json' }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, taskId, stage, agent, queueLength: q.queue.length }));
        });
      });
    });
    return;
  }

  // DELETE /api/ce/queue/:taskId — remove a CE entry from dispatch queue (after execution)
  const ceQueueDelMatch = req.method === 'DELETE' && req.url.match(/^\/api\/ce\/queue\/([^/]+)$/);
  if (ceQueueDelMatch) {
    const taskId = decodeURIComponent(ceQueueDelMatch[1]);
    fs.readFile(DISPATCH_QUEUE_FILE, 'utf8', (err, data) => {
      let q = { queue: [] };
      if (!err) { try { q = JSON.parse(data); } catch(e) {} }
      const before = q.queue.length;
      q.queue = q.queue.filter(i => i.taskId !== taskId);
      fs.writeFile(DISPATCH_QUEUE_FILE, JSON.stringify(q, null, 2), 'utf8', writeErr => {
        if (writeErr) { res.writeHead(500); res.end(JSON.stringify({ error: 'Write failed' })); return; }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, removed: before - q.queue.length }));
      });
    });
    return;
  }

  // GET /api/file?path=... — serve any workspace file by relative path (read-only, sandboxed to ROOT)
  if (req.method === 'GET' && req.url.startsWith('/api/file')) {
    const qs = req.url.includes('?') ? req.url.split('?').slice(1).join('?') : '';
    const params = new URLSearchParams(qs);
    const relPath = params.get('path');
    if (!relPath) { res.writeHead(400); res.end('Missing path param'); return; }
    const safePath = path.resolve(ROOT, relPath);
    if (!safePath.startsWith(ROOT + path.sep) && safePath !== ROOT) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    const ext = path.extname(relPath).toLowerCase();
    const CT = { '.md':'text/plain;charset=utf-8', '.html':'text/html;charset=utf-8',
      '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg',
      '.jpeg':'image/jpeg', '.gif':'image/gif', '.svg':'image/svg+xml',
      '.webp':'image/webp', '.pdf':'application/pdf' };
    fs.readFile(safePath, (err, data) => {
      if (err) { res.writeHead(404, {'Content-Type':'text/plain'}); res.end('Not found'); return; }
      res.writeHead(200, {
        'Content-Type': CT[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      });
      res.end(data);
    });
    return;
  }

  // GET /api/onboarding/token — configure agent prompt + return signed conversation token
  if (req.method === 'GET' && req.url === '/api/onboarding/token') {
    (async () => {
      let elevenKey = process.env.ELEVENLABS_API_KEY || '';
      const envFile = path.join(ROOT, '.env');
      if (!elevenKey && fs.existsSync(envFile)) {
        const lines = fs.readFileSync(envFile, 'utf8').split('\n');
        for (const line of lines) {
          const eqIdx = line.indexOf('=');
          if (eqIdx > 0 && line.slice(0, eqIdx).trim() === 'ELEVENLABS_API_KEY') {
            elevenKey = line.slice(eqIdx + 1).trim();
          }
        }
      }
      if (!elevenKey) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ token: null, note: 'No ELEVENLABS_API_KEY' }));
        return;
      }

      const AGENT_ID = 'agent_5001kgk3wr13f25s177xwgjzbrsc';
      const ONBOARDING_PROMPT = `You are conducting a project onboarding interview for MangaOS, a modular marketing operating system.

Your job: collect structured information about the project's marketing history, current situation, and goals. Be conversational and efficient. Ask one question at a time, briefly acknowledge each answer, then move on. No summaries mid-interview.

Cover these 10 topics in order:
1. Past successful campaigns: which worked best, on which channels, rough results
2. Current products/services: what is offered today and how each is positioned
3. Primary ICP: job title, industry, core pain points, desired outcomes
4. Main competitors: who they are and what sets this project apart
5. Current content strategy: channels, content types, approximate posting frequency
6. Biggest marketing challenge: what is not working or feels most broken right now
7. 90-day goals: top 2-3 outcomes for the next quarter
8. Budget: rough monthly or quarterly marketing budget range
9. Existing audiences: newsletter subscribers, LinkedIn followers, X/Twitter followers
10. One thing the system should understand that is not obvious from the outside

When all 10 topics are covered, say: "That is everything I need. Go ahead and click Save Interview Results to process this into your system."`;

      // Update agent prompt via API (so no client-side overrides needed)
      const patchRes = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
        method: 'PATCH',
        headers: { 'xi-api-key': elevenKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_config: {
            agent: {
              prompt: { prompt: ONBOARDING_PROMPT },
              first_message: "I am here to run a quick onboarding interview to calibrate MangaOS for this project. It should take around 10 minutes. Ready to start?"
            }
          }
        })
      });
      if (!patchRes.ok) {
        const errText = await patchRes.text();
        console.error('[onboarding] Agent PATCH failed:', errText);
        // Non-fatal — proceed to get token anyway
      } else {
        console.log('[onboarding] Agent prompt updated');
      }

      // Agent has enable_auth: false — no signed URL needed, plain agent_id WebSocket works
      console.log('[onboarding] Agent prompt updated, auth not required');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ready: true }));
    })().catch(e => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    });
    return;
  }

  // GET /onboarding — serve the onboarding interview page
  if (req.method === 'GET' && req.url === '/onboarding') {
    fs.readFile(path.join(ROOT, 'onboarding.html'), 'utf8', (err, data) => {
      if (err) { res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end('Failed to read onboarding.html'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // POST /api/onboarding/save — extract structured data from transcript and save to research/
  if (req.method === 'POST' && req.url === '/api/onboarding/save') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      let payload;
      try { payload = JSON.parse(body); } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }
      const { transcript } = payload;
      if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'transcript array required' }));
        return;
      }

      let apiKey = process.env.OPENROUTER_API_KEY || '';
      const envFile = path.join(ROOT, '.env');
      if (!apiKey && fs.existsSync(envFile)) {
        const lines = fs.readFileSync(envFile, 'utf8').split('\n');
        for (const line of lines) {
          const eqIdx = line.indexOf('=');
          if (eqIdx > 0 && line.slice(0, eqIdx).trim() === 'OPENROUTER_API_KEY') {
            apiKey = line.slice(eqIdx + 1).trim();
          }
        }
      }
      if (!apiKey) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'OPENROUTER_API_KEY not configured' }));
        return;
      }

      const transcriptText = transcript
        .map(m => `${m.role === 'agent' ? 'AGENT' : 'USER'}: ${m.text}`)
        .join('\n\n');

      const extractionPrompt = `Extract structured marketing intelligence from this onboarding interview transcript.

TRANSCRIPT:
${transcriptText}

Return a JSON object with exactly these fields (use null for anything not mentioned):
{
  "successful_campaigns": [{ "name": "string", "channels": ["string"], "what_worked": "string", "results": "string" }],
  "products_services":    [{ "name": "string", "description": "string", "positioning": "string", "price_range": "string" }],
  "icp_profiles":         [{ "title": "string", "industry": "string", "pain_points": ["string"], "goals": ["string"], "budget_range": "string" }],
  "competitors":          [{ "name": "string", "their_angle": "string", "gabriels_edge": "string" }],
  "current_strategy":     { "channels": ["string"], "content_types": ["string"], "posting_frequency": "string" },
  "biggest_challenges":   ["string"],
  "goals_90_days":        ["string"],
  "marketing_budget":     "string",
  "existing_audiences":   { "newsletter": "string", "linkedin": "string", "twitter_x": "string", "other": "string" },
  "extra_context":        "string"
}

Return only valid JSON. No markdown, no explanation.`;

      let extracted = null;
      try {
        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.PUBLIC_SITE_URL || `http://localhost:${PORT}`,
            'X-Title': 'MangaOS Onboarding'
          },
          body: JSON.stringify({
            model: 'google/gemini-2.0-flash-001',
            max_tokens: 2000,
            messages: [{ role: 'user', content: extractionPrompt }]
          })
        });
        if (orRes.ok) {
          const orData = await orRes.json();
          const raw = orData.choices[0].message.content.trim();
          const jsonStr = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
          extracted = JSON.parse(jsonStr);
        }
      } catch(e) {
        console.error('OpenRouter extraction error:', e.message);
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const researchDir = path.join(ROOT, 'research');
      if (!fs.existsSync(researchDir)) fs.mkdirSync(researchDir, { recursive: true });

      const jsonFile = path.join(researchDir, `onboarding-${dateStr}.json`);
      fs.writeFileSync(jsonFile, JSON.stringify({ date: dateStr, transcript, extracted }, null, 2), 'utf8');

      const mdFile = path.join(researchDir, `onboarding-${dateStr}.md`);
      fs.writeFileSync(mdFile, buildOnboardingMd(dateStr, transcript, extracted), 'utf8');

      const summary = buildOnboardingSummary(extracted, `research/onboarding-${dateStr}.md`);

      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: true, summary }));
    });
    return;
  }

  // GET /api/blog-registry — read blog-registry.json
  if (req.method === 'GET' && req.url === '/api/blog-registry') {
    fs.readFile(BLOG_REGISTRY_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ lastSynced: null, articles: [] }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    });
    return;
  }

  // POST /api/reports/refresh/:kind — spawn the refresh script for a snapshot kind
  const refreshMatch = req.method === 'POST' && req.url.match(/^\/api\/reports\/refresh\/([a-z-]+)$/);
  if (refreshMatch) {
    const kind = refreshMatch[1];
    const allowed = { 'seo': 'refresh-seo.mjs', 'traffic': 'refresh-traffic.mjs', 'keywords': 'refresh-keywords.mjs', 'prompts-weekly': 'refresh-prompts-weekly.mjs', 'prompts-monthly': 'refresh-prompts-monthly.mjs' };
    const script = allowed[kind];
    if (!script) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'unknown kind' })); return; }
    const child = spawn('node', [path.join(__dirname, 'reports', 'scripts', script)], { cwd: __dirname });
    let out = ''; let err = '';
    child.stdout.on('data', d => out += d);
    child.stderr.on('data', d => err += d);
    child.on('close', code => {
      res.writeHead(code === 0 ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ kind, exitCode: code, stdout: out.slice(-2000), stderr: err.slice(-2000) }));
    });
    return;
  }

  // GET /api/reports/:kind — read latest + history of versioned snapshot files
  const reportsMatch = req.method === 'GET' && req.url.match(/^\/api\/reports\/([a-z-]+)(?:\?.*)?$/);
  if (reportsMatch) {
    const kind = reportsMatch[1];
    const allowed = ['seo', 'traffic', 'keywords', 'prompts-weekly', 'prompts-monthly'];
    if (!allowed.includes(kind)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unknown kind' }));
      return;
    }
    const dir = path.join(__dirname, 'reports', 'snapshots');
    fs.readdir(dir, (err, files) => {
      if (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ latest: null, history: [] }));
        return;
      }
      const re = new RegExp(`^(\\d{4}-\\d{2}-\\d{2})-${kind}\\.json$`);
      const matched = files.map(f => ({ file: f, m: re.exec(f) })).filter(x => x.m);
      matched.sort((a, b) => a.m[1].localeCompare(b.m[1]));
      const last13 = matched.slice(-13);
      const history = [];
      for (const x of last13) {
        try {
          history.push(JSON.parse(fs.readFileSync(path.join(dir, x.file), 'utf8')));
        } catch (e) {
          console.warn(`[reports] skipping corrupt snapshot ${x.file}: ${e.message}`);
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ latest: history[history.length - 1] || null, history }));
    });
    return;
  }

  // PUT /api/blog-registry — write blog-registry.json
  if (req.method === 'PUT' && req.url === '/api/blog-registry') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { JSON.parse(body); } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }
      fs.writeFile(BLOG_REGISTRY_FILE, body, 'utf8', err => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to write blog-registry.json' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    return;
  }

  // POST /api/blog-registry/sync — fetch updated_at from Supabase and merge into registry
  if (req.method === 'POST' && req.url === '/api/blog-registry/sync') {
    let mcpUrl = process.env.CONTENT_MCP_URL || process.env.CONTENT_MCP_URL || process.env.MANGABEIRA_CONTENT_URL || '';
    let mcpSecret = process.env.CONTENT_MCP_SECRET || process.env.CONTENT_MCP_SECRET || process.env.MANGABEIRA_MCP_SECRET || '';
    const envFile = path.join(ROOT, '.env');
    if ((!mcpUrl || !mcpSecret) && fs.existsSync(envFile)) {
      const lines = fs.readFileSync(envFile, 'utf8').split('\n');
      for (const line of lines) {
        const eqIdx = line.indexOf('=');
        if (eqIdx <= 0) continue;
        const k = line.slice(0, eqIdx).trim();
        const v = line.slice(eqIdx + 1).trim();
        if (k === 'CONTENT_MCP_URL' || k === 'MANGABEIRA_CONTENT_URL') mcpUrl = v;
        if (k === 'CONTENT_MCP_SECRET' || k === 'MANGABEIRA_MCP_SECRET') mcpSecret = v;
      }
    }
    if (!mcpUrl || !mcpSecret) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'CONTENT_MCP_URL and CONTENT_MCP_SECRET not configured in .env' }));
      return;
    }

    (async () => {
      let registry = { lastSynced: null, articles: [] };
      try {
        registry = JSON.parse(fs.readFileSync(BLOG_REGISTRY_FILE, 'utf8'));
      } catch (e) {}

      const mcpRes = await fetch(mcpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-MCP-Secret': mcpSecret },
        body: JSON.stringify({ tool: 'list_pages', input: {} })
      });
      if (!mcpRes.ok) {
        const errText = await mcpRes.text();
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Supabase error: ${errText}` }));
        return;
      }
      const mcpData = await mcpRes.json();
      const pages = mcpData.pages || mcpData.result || [];

      let updated = 0;
      for (const article of registry.articles) {
        const page = pages.find(p => p.slug === article.slug || p.en_slug === article.slug);
        if (!page) continue;
        const mcpDate = (page.updated_at || page.updatedAt || '').slice(0, 10);
        if (!mcpDate) continue;
        if (article.lastUpdatedSource === 'manual') continue;
        if (mcpDate > article.lastUpdated) {
          article.lastUpdated = mcpDate;
          article.lastUpdatedSource = 'mcp';
          updated++;
        }
      }
      registry.lastSynced = new Date().toISOString();

      fs.writeFileSync(BLOG_REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, updated, lastSynced: registry.lastSynced, articles: registry.articles }));
    })().catch(e => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    });
    return;
  }

  // POST /api/ce/blog-push — push a blog CE draft to the CMS as a draft page
  if (req.method === 'POST' && req.url === '/api/ce/blog-push') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let taskId;
      try { taskId = JSON.parse(body).taskId; } catch (e) {}
      if (!taskId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'taskId required' }));
        return;
      }

      let mcpUrl = process.env.CONTENT_MCP_URL || process.env.CONTENT_MCP_URL || process.env.MANGABEIRA_CONTENT_URL || '';
      let mcpSecret = process.env.CONTENT_MCP_SECRET || process.env.CONTENT_MCP_SECRET || process.env.MANGABEIRA_MCP_SECRET || '';
      const envFile = path.join(ROOT, '.env');
      if ((!mcpUrl || !mcpSecret) && fs.existsSync(envFile)) {
        const lines = fs.readFileSync(envFile, 'utf8').split('\n');
        for (const line of lines) {
          const eqIdx = line.indexOf('=');
          if (eqIdx <= 0) continue;
          const k = line.slice(0, eqIdx).trim();
          const v = line.slice(eqIdx + 1).trim();
          if (k === 'CONTENT_MCP_URL' || k === 'MANGABEIRA_CONTENT_URL') mcpUrl = v;
          if (k === 'CONTENT_MCP_SECRET' || k === 'MANGABEIRA_MCP_SECRET') mcpSecret = v;
        }
      }
      if (!mcpUrl || !mcpSecret) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'CONTENT_MCP_URL and CONTENT_MCP_SECRET not configured in .env' }));
        return;
      }

      (async () => {
        const tasksDoc = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
        const tasks = tasksDoc.tasks || tasksDoc;
        const task = tasks.find(t => t.id === taskId);
        if (!task) throw new Error(`Task ${taskId} not found`);

        const draftPath = task.artifacts && task.artifacts.draft_blog;
        if (!draftPath) throw new Error('No draft_blog artifact on task');

        const fullPath = path.isAbsolute(draftPath) ? draftPath : path.join(ROOT, draftPath);
        const raw = fs.readFileSync(fullPath, 'utf8');

        const fm = {};
        let content = raw;
        const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        if (fmMatch) {
          for (const line of fmMatch[1].split('\n')) {
            const colonIdx = line.indexOf(':');
            if (colonIdx <= 0) continue;
            const k = line.slice(0, colonIdx).trim().toUpperCase().replace(/ /g, '_');
            const v = line.slice(colonIdx + 1).trim();
            fm[k] = v;
          }
          content = fmMatch[2].trim();
        }

        const draftExt = draftPath.match(/\.(md|html?)$/)?.[0] || '.md';
        const slug = path.basename(draftPath, draftExt);
        const title = fm['TITLE'] || task.title || slug;
        const metaDescription = fm['META_DESCRIPTION'] || '';
        const featuredImage = fm['FEATURED_IMAGE'] || '';
        const category = fm['SUBCATEGORY'] || 'blog';

        // Read OpenRouter key for HTML optimization
        let openrouterKey = process.env.OPENROUTER_API_KEY || '';
        if (!openrouterKey && fs.existsSync(envFile)) {
          const envLines = fs.readFileSync(envFile, 'utf8').split('\n');
          for (const line of envLines) {
            const eqIdx = line.indexOf('=');
            if (eqIdx <= 0) continue;
            if (line.slice(0, eqIdx).trim() === 'OPENROUTER_API_KEY') {
              openrouterKey = line.slice(eqIdx + 1).trim();
              break;
            }
          }
        }

        // HTML files are already HTML; .md files go through LLM optimization
        let html;
        if (draftPath.endsWith('.html')) {
          html = content;
        } else if (openrouterKey) {
          html = await optimizeHtmlForCms(content, openrouterKey);
        } else {
          html = markdownToHtml(content);
        }

        const mcpRes = await fetch(mcpUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-MCP-Secret': mcpSecret },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
              name: 'upsert_page',
              arguments: {
                slug,
                category,
                status: 'draft',
                author_name: process.env.CONTENT_AUTHOR_NAME || 'Author',
                ...(featuredImage ? { featured_image: featuredImage } : {}),
                // NOTE: blog-push only pushes the EN draft. Full multilingual publish
                // (BR + ES translations with localized slugs) must be done via a separate
                // upsert_page call with all 3 translations in one payload.
                // Language codes: "en", "br", "es" (NOT "pt" or "pt-BR" — CMS will reject).
                // localized_slug must be translated per language, not copied from the EN slug.
                // All translations must be sent in ONE upsert_page call — separate calls wipe previous translations.
                translations: [{
                  language: 'en',
                  title,
                  meta_description: metaDescription,
                  content: html,
                  localized_slug: slug
                }]
              }
            }
          })
        });

        if (!mcpRes.ok) {
          const errText = await mcpRes.text();
          throw new Error(`CMS error ${mcpRes.status}: ${errText}`);
        }
        await mcpRes.json();

        const draftUrl = `${(process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '')}/publications/${slug}`;
        if (!task.artifacts) task.artifacts = {};
        if (!Array.isArray(task.artifacts.published)) task.artifacts.published = [];
        if (!task.artifacts.published.includes(draftUrl)) {
          task.artifacts.published.push(draftUrl);
        }
        const saveDoc = Array.isArray(tasksDoc) ? tasks : { ...tasksDoc, tasks, lastUpdated: new Date().toISOString() };
        fs.writeFileSync(TASKS_FILE, JSON.stringify(saveDoc, null, 2), 'utf8');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, slug, url: draftUrl }));
      })().catch(e => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      });
    });
    return;
  }

  // POST /api/blog-refresh/start — create CE task + spawn detached runner
  // Body: { slug, track }  Returns: { ok, taskId }  (responds immediately, runner is async)
  if (req.method === 'POST' && req.url === '/api/blog-refresh/start') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let slug, track;
      try { ({ slug, track } = JSON.parse(body)); } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }
      if (!slug) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'slug is required' }));
        return;
      }
      track = (track || 'A').toUpperCase();

      // Load registry + tasks synchronously so we can dedup and create atomically
      let registry = { articles: [] };
      try { registry = JSON.parse(fs.readFileSync(BLOG_REGISTRY_FILE, 'utf8')); } catch {}
      const article = (registry.articles || []).find(a => a.slug === slug);
      if (!article) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Article "${slug}" not found in blog-registry.json` }));
        return;
      }

      let tasksDoc = [];
      try { tasksDoc = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8')); } catch {}
      const taskList = tasksDoc.tasks || tasksDoc;

      // Duplicate guard — one active refresh per slug
      const existing = taskList.find(t =>
        t.linkedSlug === slug && t.type === 'content-piece' &&
        !['done', 'distribution'].includes(t.pipelineStage)
      );
      if (existing) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, taskId: existing.id, status: 'already-running', message: 'A refresh task already exists for this article.' }));
        return;
      }

      // Lock file guard
      const lockFile = path.join(ROOT, 'seo', 'backups', `.refresh-lock-${slug}`);
      if (fs.existsSync(lockFile)) {
        const ageMs = Date.now() - fs.statSync(lockFile).mtimeMs;
        if (ageMs < 10 * 60 * 1000) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, status: 'locked', message: 'Runner already active for this article.' }));
          return;
        }
      }

      // Create CE task
      const today = new Date().toISOString().slice(0, 10);
      const shortId = slug.replace(/-/g, '').slice(0, 8);
      const taskId = `CE-BL-${shortId}-${Date.now().toString(36)}`;
      const trackLabel = track === 'A' ? 'Light Refresh' : 'Cornerstone Overhaul';
      const newTask = {
        id: taskId,
        contentId: taskId,
        type: 'content-piece',
        title: `Refresh (${track}): ${article.title}`,
        channel: 'blog',
        channels: ['blog'],
        pipelineStage: 'research',
        sop: `SOP-12-${track}`,
        campaign: null,
        status: 'todo',
        priority: track === 'A' ? 'medium' : 'high',
        approvalStatus: 'not-needed',
        qaStatus: 'not-run',
        created: today,
        dueDate: null,
        linkedSlug: slug,
        parentId: null,
        notes: `SOP-12 Track ${track} — ${trackLabel}. Automated runner dispatched.`,
        links: [],
        artifacts: {
          research: null, outline: null,
          canonical: `${(process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '')}/publications/${slug}`,
          draft_blog: null, draft_linkedin: null, draft_x: null,
          design: [], published: []
        }
      };

      taskList.push(newTask);
      const saveDoc = Array.isArray(tasksDoc)
        ? taskList
        : { ...tasksDoc, tasks: taskList, lastUpdated: new Date().toISOString() };
      fs.writeFileSync(TASKS_FILE, JSON.stringify(saveDoc, null, 2), 'utf8');

      // Mark article in-refresh
      article.status = 'in-refresh';
      fs.writeFileSync(BLOG_REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf8');

      // Load env vars for runner
      const envVars = { ...process.env };
      const envFile = path.join(ROOT, '.env');
      if (fs.existsSync(envFile)) {
        for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
          const eq = line.indexOf('=');
          if (eq > 0) envVars[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
        }
      }

      // Spawn runner detached — respond immediately, runner runs in background
      const runnerScript = path.join(ROOT, 'scripts', 'blog-refresh-automation.mjs');
      const child = spawn('node', [runnerScript, '--task-id', taskId, '--slug', slug, '--track', track], {
        cwd: ROOT,
        env: envVars,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Pipe runner output to a log file for debugging
      const logDir = path.join(ROOT, 'seo', 'backups');
      fs.mkdirSync(logDir, { recursive: true });
      const logStream = fs.createWriteStream(path.join(logDir, `refresh-log-${slug}-${today}.txt`), { flags: 'a' });
      child.stdout.pipe(logStream);
      child.stderr.pipe(logStream);
      child.unref();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, taskId, status: 'started', track, trackLabel }));
    });
    return;
  }

  // GET /api/blog-refresh/status/:taskId — check runner progress via artifact presence
  const refreshStatusMatch = req.method === 'GET' && req.url.match(/^\/api\/blog-refresh\/status\/([^/?]+)/);
  if (refreshStatusMatch) {
    const taskId = decodeURIComponent(refreshStatusMatch[1]);

    let tasksDoc = [];
    try { tasksDoc = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8')); } catch {}
    const taskList = tasksDoc.tasks || tasksDoc;
    const task = taskList.find(t => t.id === taskId);

    if (!task) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Task ${taskId} not found` }));
      return;
    }

    // Derive granular status from artifact presence — stateless, restart-safe
    const a = task.artifacts || {};
    const has = (rel) => rel && fs.existsSync(path.join(ROOT, rel));
    const lockFile = path.join(ROOT, 'seo', 'backups', `.refresh-lock-${task.linkedSlug}`);
    const locked = fs.existsSync(lockFile);

    let status, message;
    if (task.pipelineStage === 'editing' && task.approvalStatus === 'pending') {
      const docLink = (task.links || []).find(l => l.type === 'gdoc-refresh');
      status = 'ready-for-approval';
      message = docLink ? `Approval doc ready: ${docLink.url}` : 'Task at editing/pending — check CE tab for Doc link';
    } else if (has(a.draft_blog) && has(a.outline)) {
      status = locked ? 'running' : 'qa-complete';
      message = 'Draft written, QA run, creating Google Doc...';
    } else if (has(a.outline)) {
      status = 'running';
      message = 'Brief written, generating draft...';
    } else if (has(a.research)) {
      status = 'running';
      message = 'Research complete, generating brief...';
    } else if (locked) {
      status = 'running';
      message = 'Runner started, fetching sources...';
    } else if (task.qaStatus === 'blocked') {
      status = 'failed';
      message = task.notes || 'Automation failed — check refresh log in seo/backups/';
    } else {
      status = 'pending';
      message = 'Task created, runner not yet started';
    }

    const docLink = (task.links || []).find(l => l.type === 'gdoc-refresh');

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      taskId,
      status,
      message,
      pipelineStage: task.pipelineStage,
      approvalStatus: task.approvalStatus,
      qaStatus: task.qaStatus,
      docUrl: docLink?.url || null
    }));
    return;
  }

  // ── Sasha activity (VPS state mirror, read-only) ─────────────────────────
  // Returns: { posted: [...], errors: [...], calendar_state: {...}, last_synced: ISO }
  // GET /api/sasha-state — reads from local brain repo mirror (no SSH, always fast)
  if (req.method === 'GET' && req.url === '/api/sasha-state') {
    const safeParse = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } };
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    res.end(JSON.stringify({
      posted:      safeParse(path.join(ROOT, 'social/x/posted-log.json'), []),
      errors:      safeParse(path.join(ROOT, '_ops/cost-events', new Date().toISOString().slice(0,10) + '.jsonl'), []),
      last_synced: new Date().toISOString(),
      source:      'brain-repo-mirror',
    }));
    return;
  }

  // GET /api/mantle-state — Mantle hackathon dashboard: trade log + ERC-8004 identity
  if (req.method === 'GET' && req.url === '/api/mantle-state') {
    const safeParse = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } };
    const tradeLog      = safeParse(path.join(ROOT, 'state', 'mantle-trade-log.json'), []);
    const erc8004State  = safeParse(path.join(ROOT, 'state', 'erc8004-identity.json'), {});
    const signal        = safeParse(path.join(ROOT, 'content', 'mantle-signal.json'), null);

    // Summarise trade counts
    const executed = tradeLog.filter(t => t.status === 'executed');
    const dryRuns  = tradeLog.filter(t => t.status === 'dry-run');
    const errors   = tradeLog.filter(t => t.status === 'error');
    const lastTrade = tradeLog.length > 0 ? tradeLog[tradeLog.length - 1] : null;

    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    res.end(JSON.stringify({
      tradeLog:       tradeLog.slice(-20).reverse(), // last 20, newest first
      tradeCount:     tradeLog.length,
      executedCount:  executed.length,
      dryRunCount:    dryRuns.length,
      errorCount:     errors.length,
      lastTrade,
      erc8004: {
        agentId:      erc8004State['mantle-agentId'] || null,
        agentAddress: erc8004State['mantle-agentAddress'] || null,
        registeredAt: erc8004State['mantle-registeredAt'] || null,
        txHash:       erc8004State['mantle-txHash'] || null,
        explorerUrl:  erc8004State['mantle-explorerUrl'] || null,
        lastAttestation: erc8004State['mantle-lastAttestationTx'] || null,
      },
      signal: signal ? {
        generatedAt:  signal.generatedAt,
        action:       signal.recommendation?.action,
        rationale:    signal.recommendation?.rationale,
        riskAppetite: signal.socialBias?.riskAppetite,
        confidence:   signal.socialBias?.confidence,
        topPool:      signal.poolData?.topPool?.name,
        topPoolAPR:   signal.poolData?.topPool?.apr24h,
      } : null,
      last_synced: new Date().toISOString(),
    }));
    return;
  }

  // GET /api/sasha-reputation — ERC-8004 reputation feed (portable schema)
  //
  // This endpoint exposes Sasha's verified track record as a standardized
  // JSON schema that any protocol or agent can consume. It is the reference
  // implementation of the ERC-8004 reputation-as-product pattern.
  //
  // Other DeFi protocols can:
  //   - Extend Sasha credit based on her verified P&L history
  //   - Copy-trade her with verifiable trust (no self-reported claims)
  //   - Integrate this schema for any ERC-8004 agent
  //
  // Schema documented at: docs/erc8004-reputation-schema.md
  if (req.method === 'GET' && req.url === '/api/sasha-reputation') {
    const safeParse = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } };
    const tradeLog  = safeParse(path.join(ROOT, 'state', 'mantle-trade-log.json'), []);
    const erc8004   = safeParse(path.join(ROOT, 'state', 'erc8004-identity.json'), {});
    const contract  = safeParse(path.join(ROOT, 'state', 'contract-deployment.json'), {});

    const executed  = tradeLog.filter(t => t.status === 'executed');
    const errors    = tradeLog.filter(t => t.status === 'error');

    // Action distribution
    const actionCounts = {};
    executed.forEach(t => { actionCounts[t.action] = (actionCounts[t.action] || 0) + 1; });

    // Compute simple win-rate proxy: trades with txSignature (on-chain confirmation) vs total
    const confirmedTrades = executed.filter(t => t.txSignature);
    const winRate = executed.length > 0 ? (confirmedTrades.length / executed.length) : null;

    // Signal accuracy: how often did the social bias match the action taken
    // (bullish → BUY actions, bearish → SELL/STABLE actions)
    const signalAccuracy = executed.length > 0 ? (executed.filter(t => {
      const bias = t.socialBias;
      const action = t.action;
      if (bias === 'bullish' && (action === 'OPEN_LP_POSITION' || action === 'SWAP_TO_SOL')) return true;
      if (bias === 'bearish' && action === 'MOVE_TO_STABLE') return true;
      return false;
    }).length / executed.length) : null;

    // Most recent 5 trades for the feed
    const recentTrades = tradeLog.slice(-5).reverse().map(t => ({
      id:          t.id,
      executedAt:  t.executedAt,
      action:      t.action,
      pool:        t.poolName || t.poolAddress || null,
      txSignature: t.txSignature || null,
      solscanUrl:  t.solscanUrl || null,
      mantleTx:    t.erc8004Tx || null,
      preTweetId:  t.preTweetId || null,
      rationale:   t.rationale ? t.rationale.slice(0, 200) : null,
      status:      t.status,
    }));

    // ERC-8004 portable reputation schema
    // Any compliant consumer can read this and verify against on-chain data
    const reputation = {
      schemaVersion: '1.0.0',
      schemaSpec:    'https://github.com/sasha-coin/sasha-coin/blob/main/docs/erc8004-reputation-schema.md',
      agent: {
        name:          'Sasha',
        handle:        '@SashaCoin95',
        agentId:       erc8004['mantle-agentId'] || null,
        agentAddress:  erc8004['mantle-agentAddress'] || null,
        chain:         'Mantle',
        registeredAt:  erc8004['mantle-registeredAt'] || null,
        contractAddress: contract.contractAddress || null,
        contractExplorer: contract.explorerUrl || null,
      },
      tradeRecord: {
        totalTrades:      tradeLog.length,
        executedTrades:   executed.length,
        confirmedOnChain: confirmedTrades.length,
        errorCount:       errors.length,
        winRate:          winRate !== null ? parseFloat(winRate.toFixed(4)) : null,
        signalAccuracy:   signalAccuracy !== null ? parseFloat(signalAccuracy.toFixed(4)) : null,
        actionDistribution: actionCounts,
        firstTradeAt:     tradeLog[0]?.executedAt || null,
        lastTradeAt:      tradeLog[tradeLog.length - 1]?.executedAt || null,
      },
      recentTrades,
      attestation: {
        method:       'ERC-8004 self-transfer + SashaAgentLog event',
        chain:        'Mantle',
        verifiable:   !!contract.contractAddress,
        lastAttestation: erc8004['mantle-lastAttestationTx'] || null,
      },
      accountability: {
        preTradeDisclosure: true,
        disclosureMethod:   'X post timestamped before trade execution',
        disclosureDelay:    '60 seconds minimum between post and trade',
        disclosureHandle:   '@SashaCoin95',
      },
      generatedAt: new Date().toISOString(),
    };

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',  // public API — any protocol can read
    });
    res.end(JSON.stringify(reputation, null, 2));
    return;
  }

  // GET /api/sasha-activity — full Twitter activity feed
  if (req.method === 'GET' && req.url === '/api/sasha-activity') {
    const safeParse = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } };
    // state/posted-log.json is the canonical source written by morning-reply-run.js
    const postedLog = safeParse(path.join(ROOT, 'state/posted-log.json'), []);
    // Separate posts from replies based on 'source' field
    // original_text, topics, sasha_angle are now stored directly on each reply entry
    const posts   = postedLog.filter(e => e.source !== 'reply').sort((a, b) => new Date(b.queued_at || b.posted_at || 0) - new Date(a.queued_at || a.posted_at || 0));
    const replies = postedLog.filter(e => e.source === 'reply').sort((a, b) => new Date(b.posted_at || 0) - new Date(a.posted_at || 0));

    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    res.end(JSON.stringify({
      posts,
      replies,
      total_posts:   posts.length,
      total_replies: replies.length,
      last_synced:   new Date().toISOString(),
    }));
    return;
  }

  // ── Buffer queue mirror (Buffer Cloud API, read-only) ────────────────────
  if (req.method === 'GET' && req.url === '/api/buffer-queue') {
    const TOKEN   = process.env.BUFFER_ACCESS_TOKEN;
    const CHANNEL = process.env.BUFFER_CHANNEL_ID;
    const ORG     = process.env.BUFFER_ORGANIZATION_ID;
    if (!TOKEN || !CHANNEL || !ORG) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'BUFFER_ACCESS_TOKEN, BUFFER_CHANNEL_ID, or BUFFER_ORGANIZATION_ID not set in .env' }));
      return;
    }
    const QUERY = `query SashaPosts($input: PostsInput!) { posts(input: $input, first: 30) { edges { node { id status text dueAt sentAt createdAt isCustomScheduled schedulingType } } } }`;
    const variables = { input: { organizationId: ORG, filter: { channelIds: [CHANNEL] } } };
    fetch('https://api.buffer.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN },
      body: JSON.stringify({ query: QUERY, variables })
    })
      .then(r => r.json())
      .then(data => {
        const edges = (data?.data?.posts?.edges || []).map(e => e.node);
        edges.sort((a, b) => new Date(b.sentAt || b.dueAt || b.createdAt) - new Date(a.sentAt || a.dueAt || a.createdAt));
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
        res.end(JSON.stringify({ posts: edges, raw_errors: data?.errors || null }));
      })
      .catch(e => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Buffer API failed', detail: e.message }));
      });
    return;
  }

  // ── Sasha page ────────────────────────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/sasha') {
    fs.readFile(SASHA_HTML_FILE, 'utf8', (err, data) => {
      if (err) { res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end('sasha.html not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // ── Replies page ──────────────────────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/replies') {
    fs.readFile(REPLIES_HTML_FILE, 'utf8', (err, data) => {
      if (err) { res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end('replies.html not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // ── KOL targets API ───────────────────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/api/kol-targets') {
    fs.readFile(KOL_TARGETS_FILE, 'utf8', (err, data) => {
      if (err) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Failed to read reply-targets.json' })); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    });
    return;
  }

  if (req.method === 'PUT' && req.url === '/api/kol-targets') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { JSON.parse(body); } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invalid JSON' })); return;
      }
      fs.writeFile(KOL_TARGETS_FILE, body, 'utf8', err => {
        if (err) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Write failed' })); return; }
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true }));
      });
    });
    return;
  }

  // ── Reply log API ─────────────────────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/api/reply-log') {
    fs.readFile(REPLY_LOG_FILE, 'utf8', (err, data) => {
      if (err) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('[]'); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    });
    return;
  }

  // PATCH /api/reply-log/:id — update score or note on a reply
  if (req.method === 'PATCH' && req.url.startsWith('/api/reply-log/')) {
    const replyId = decodeURIComponent(req.url.slice('/api/reply-log/'.length));
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let patch;
      try { patch = JSON.parse(body); } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invalid JSON' })); return;
      }
      fs.readFile(REPLY_LOG_FILE, 'utf8', (err, data) => {
        let log = [];
        try { log = JSON.parse(data || '[]'); } catch {}
        const idx = log.findIndex(e => e.id === replyId || e.in_reply_to === replyId);
        if (idx === -1) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Not found' })); return; }
        log[idx] = { ...log[idx], ...patch };
        fs.writeFile(REPLY_LOG_FILE, JSON.stringify(log, null, 2), 'utf8', err => {
          if (err) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Write failed' })); return; }
          res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, updated: log[idx] }));
        });
      });
    });
    return;
  }

  // GET /reply-feed — reply feed page
  if (req.method === 'GET' && req.url === '/reply-feed') {
    fs.readFile(REPLY_FEED_HTML_FILE, 'utf8', (err, html) => {
      if (err) { res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end('reply-feed.html not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    });
    return;
  }

  // GET /api/kol-feed — serve latest kol-feed.json
  if (req.method === 'GET' && req.url === '/api/kol-feed') {
    fs.readFile(KOL_FEED_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ candidates: [], generatedAt: null, empty: true }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    });
    return;
  }

  // POST /api/scrape-now — trigger kol-scraper.js (non-blocking, returns immediately)
  if (req.method === 'POST' && req.url === '/api/scrape-now') {
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'kol-scraper.js'), '--skip-search'], {
      detached: true, stdio: 'ignore',
      env: { ...process.env }
    });
    child.unref();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, message: 'Scrape started — refresh feed in ~60s' }));
    return;
  }

  // POST /api/sync-engagement — run sync-reply-engagement.js on demand
  if (req.method === 'POST' && req.url === '/api/sync-engagement') {
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'sync-reply-engagement.js')], {
      detached: true, stdio: 'ignore', env: { ...process.env },
    });
    child.unref();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, message: 'Engagement sync started — refresh in ~30s' }));
    return;
  }

  // GET /api/typefully — Typefully drafts, queue, and cap usage for the dashboard panel.
  // Aggregates: connected social set, drafts count, scheduled count, published-this-month count,
  // free-plan budget consumed (count of distinct published drafts in current calendar month).
  if (req.method === 'GET' && req.url.startsWith('/api/typefully')) {
    (async () => {
      try {
        const ACCOUNT = 'SASHA_COIN';
        const fs = require('fs');
        const path = require('path');
        // Load .env for TYPEFULLY_API_KEY_SASHA_COIN
        const envPath = path.join(ROOT, '.env');
        if (fs.existsSync(envPath)) {
          for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
            const i = line.indexOf('=');
            if (i > 0) {
              const k = line.slice(0, i).trim();
              const v = line.slice(i + 1).trim();
              if (k && !process.env[k]) process.env[k] = v;
            }
          }
        }
        const TOKEN = process.env.TYPEFULLY_API_KEY_SASHA_COIN || process.env.TYPEFULLY_API_KEY;
        if (!TOKEN) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'TYPEFULLY_API_KEY_SASHA_COIN not set' }));
          return;
        }
        // Load registry for social_set_id + cap
        let socialSetId = null, cap = 15;
        const regPath = path.join(ROOT, '_context', 'typefully-accounts.json');
        if (fs.existsSync(regPath)) {
          const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
          const acc = reg.accounts?.[ACCOUNT];
          if (acc) {
            socialSetId = Number(acc.social_set_id);
            if (typeof acc.monthly_post_cap === 'number') cap = acc.monthly_post_cap;
          }
        }
        if (!socialSetId) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'social_set_id missing in _context/typefully-accounts.json' }));
          return;
        }

        async function call(toolName, args) {
          const url = `https://mcp.typefully.com/mcp?TYPEFULLY_API_KEY=${encodeURIComponent(TOKEN)}`;
          const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
            body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name: toolName, arguments: args } }),
          });
          const raw = await r.text();
          const dataLines = raw.split('\n').filter(l => l.startsWith('data:')).map(l => l.replace(/^data:\s*/, ''));
          if (!dataLines.length) throw new Error('no data lines from Typefully MCP');
          const last = JSON.parse(dataLines[dataLines.length - 1]);
          if (last.error) throw new Error(JSON.stringify(last.error));
          const block = last.result?.content?.[0];
          if (!block) return last.result;
          if (block.type === 'text') {
            const m = block.text.match(/^API Response \(Status: (\d+)\):\s*([\s\S]*)$/);
            if (m) {
              try { return { _status: Number(m[1]), ...JSON.parse(m[2]) }; }
              catch { return { _status: Number(m[1]), _raw: m[2] }; }
            }
          }
          return block;
        }

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

        const [drafts, scheduled, published, queueSchedule, queue] = await Promise.all([
          call('typefully_list_drafts', { social_set_id: socialSetId, status: 'draft', limit: 50 }),
          call('typefully_list_drafts', { social_set_id: socialSetId, status: 'scheduled', limit: 50 }),
          call('typefully_list_drafts', { social_set_id: socialSetId, status: 'published', limit: 50 }),
          call('typefully_get_queue_schedule', { social_set_id: socialSetId }),
          call('typefully_get_queue', { social_set_id: socialSetId, start_date: monthStart, end_date: monthEnd }).catch(() => null),
        ]);

        // Count published items in current calendar month for cap usage
        const publishedThisMonth = (published?.results || []).filter(d => {
          if (!d.published_at) return false;
          const dt = String(d.published_at).slice(0, 7);
          return dt === monthStart.slice(0, 7);
        }).length;

        const summarize = (arr) => (arr?.results || []).map(d => ({
          id: d.id,
          status: d.status,
          scheduled_date: d.scheduled_date,
          published_at: d.published_at,
          preview: (d.preview || '').slice(0, 120),
          private_url: d.private_url,
          tweet_count: d.platforms?.x?.posts?.length || null,
        }));

        const payload = {
          account: ACCOUNT,
          social_set_id: socialSetId,
          plan: { monthly_post_cap: cap, published_this_month: publishedThisMonth, remaining: Math.max(0, cap - publishedThisMonth) },
          drafts: summarize(drafts),
          scheduled: summarize(scheduled),
          published_recent: summarize(published).slice(0, 10),
          queue_schedule: queueSchedule,
          queue_slots: queue?.days || null,
          generated_at: new Date().toISOString(),
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    })();
    return;
  }

  // Everything else — 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

function buildOnboardingMd(dateStr, transcript, ex) {
  let md = `# Onboarding Interview\n\n**Date:** ${dateStr}\n**Exchanges:** ${transcript.length}\n\n---\n\n`;

  if (ex) {
    if (ex.products_services?.length) {
      md += `## Products & Services\n\n`;
      ex.products_services.forEach(p => {
        md += `**${p.name || 'Product'}**\n`;
        if (p.description)  md += `- ${p.description}\n`;
        if (p.positioning)  md += `- Positioning: ${p.positioning}\n`;
        if (p.price_range)  md += `- Price: ${p.price_range}\n`;
        md += '\n';
      });
    }
    if (ex.icp_profiles?.length) {
      md += `## ICP Profiles\n\n`;
      ex.icp_profiles.forEach(icp => {
        md += `**${icp.title || 'ICP'}**${icp.industry ? ` (${icp.industry})` : ''}\n`;
        if (icp.pain_points?.length) md += `- Pain points: ${icp.pain_points.join('; ')}\n`;
        if (icp.goals?.length)       md += `- Goals: ${icp.goals.join('; ')}\n`;
        if (icp.budget_range)        md += `- Budget: ${icp.budget_range}\n`;
        md += '\n';
      });
    }
    if (ex.competitors?.length) {
      md += `## Competitors\n\n`;
      ex.competitors.forEach(c => {
        md += `**${c.name}**\n`;
        if (c.their_angle)    md += `- Their angle: ${c.their_angle}\n`;
        if (c.gabriels_edge)  md += `- Gabriel's edge: ${c.gabriels_edge}\n`;
        md += '\n';
      });
    }
    if (ex.successful_campaigns?.length) {
      md += `## Past Successful Campaigns\n\n`;
      ex.successful_campaigns.forEach(c => {
        md += `**${c.name || 'Campaign'}**\n`;
        if (c.channels?.length)  md += `- Channels: ${c.channels.join(', ')}\n`;
        if (c.what_worked)       md += `- What worked: ${c.what_worked}\n`;
        if (c.results)           md += `- Results: ${c.results}\n`;
        md += '\n';
      });
    }
    if (ex.current_strategy) {
      const s = ex.current_strategy;
      md += `## Current Strategy\n\n`;
      if (s.channels?.length)      md += `- Channels: ${s.channels.join(', ')}\n`;
      if (s.content_types?.length) md += `- Content types: ${s.content_types.join(', ')}\n`;
      if (s.posting_frequency)     md += `- Frequency: ${s.posting_frequency}\n`;
      md += '\n';
    }
    if (ex.biggest_challenges?.length) {
      md += `## Biggest Challenges\n\n${ex.biggest_challenges.map(c => `- ${c}`).join('\n')}\n\n`;
    }
    if (ex.goals_90_days?.length) {
      md += `## 90-Day Goals\n\n${ex.goals_90_days.map(g => `- ${g}`).join('\n')}\n\n`;
    }
    if (ex.marketing_budget) {
      md += `## Budget\n\n${ex.marketing_budget}\n\n`;
    }
    if (ex.existing_audiences) {
      const a = ex.existing_audiences;
      md += `## Existing Audiences\n\n`;
      if (a.newsletter) md += `- Newsletter: ${a.newsletter}\n`;
      if (a.linkedin)   md += `- LinkedIn: ${a.linkedin}\n`;
      if (a.twitter_x)  md += `- X/Twitter: ${a.twitter_x}\n`;
      if (a.other)      md += `- Other: ${a.other}\n`;
      md += '\n';
    }
    if (ex.extra_context) {
      md += `## Extra Context\n\n${ex.extra_context}\n\n`;
    }
  }

  md += `---\n\n## Full Transcript\n\n`;
  transcript.forEach(m => {
    md += `**${m.role === 'agent' ? 'Agent' : 'Gabriel'}:** ${m.text}\n\n`;
  });

  return md;
}

function buildOnboardingSummary(ex, mdPath) {
  if (!ex) return `Transcript saved. Extraction failed — review raw JSON.\nFile: ${mdPath}`;
  const parts = [];
  if (ex.products_services?.length)  parts.push(`${ex.products_services.length} product/service`);
  if (ex.icp_profiles?.length)       parts.push(`${ex.icp_profiles.length} ICP profile`);
  if (ex.competitors?.length)        parts.push(`${ex.competitors.length} competitor`);
  if (ex.goals_90_days?.length)      parts.push(`${ex.goals_90_days.length} 90-day goal`);
  if (ex.biggest_challenges?.length) parts.push(`${ex.biggest_challenges.length} challenge`);
  return `Extracted: ${parts.join(', ')}\n\nSaved to: ${mdPath}\n\nReview the file and merge insights into _context/product-info.md and _context/audience.md when ready.`;
}

async function optimizeHtmlForCms(rawContent, openrouterKey) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${openrouterKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-4.5',
      max_tokens: 16000,
      messages: [{
        role: 'user',
        content: `Convert this markdown/HTML hybrid document to clean, semantic HTML for a CMS blog post. Return ONLY the HTML — no explanation, no code fences, no boilerplate (<html>/<body>/<head>).

Rules:
- Convert ## headings → <h2>, ### → <h3>, etc.
- Convert **bold** → <strong>, *italic* → <em>, [text](url) → <a href="url">text</a>
- Every prose paragraph and every block that starts with an inline HTML tag (<a>, <strong>, <span>) must be wrapped in <p>...</p>
- FAQ items use <details>/<summary> — wrap the question text inside <summary> in an <h3> tag: <summary><h3>Question text</h3></summary>
- Preserve ALL existing block-level HTML exactly as written: <div>, <table>, <figure>, <blockquote>, <details>, <img> and all their children, src/alt/class attributes, and Tailwind classes — do not alter them in any way
- Convert standalone --- lines to <hr>
- Ensure every opened tag is properly closed
- Do NOT strip or modify any <img> tags — preserve src, alt, class exactly

Document:
${rawContent}`
      }]
    })
  });
  if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  let html = data.choices[0].message.content.trim();
  return html.replace(/^```html?\n?/i, '').replace(/\n?```\s*$/i, '');
}

function inlineHtml(text) {
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  text = text.replace(/`(.+?)`/g, '<code>$1</code>');
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return text;
}

function markdownToHtml(md) {
  return md.split(/\n{2,}/).map(block => {
    block = block.trim();
    if (!block) return '';
    if (/^---+$/.test(block)) return '<hr>';
    if (block.startsWith('<')) return block;
    const h6 = block.match(/^######\s+([\s\S]+)/); if (h6) return `<h6>${inlineHtml(h6[1])}</h6>`;
    const h5 = block.match(/^#####\s+([\s\S]+)/);  if (h5) return `<h5>${inlineHtml(h5[1])}</h5>`;
    const h4 = block.match(/^####\s+([\s\S]+)/);   if (h4) return `<h4>${inlineHtml(h4[1])}</h4>`;
    const h3 = block.match(/^###\s+([\s\S]+)/);    if (h3) return `<h3>${inlineHtml(h3[1])}</h3>`;
    const h2 = block.match(/^##\s+([\s\S]+)/);     if (h2) return `<h2>${inlineHtml(h2[1])}</h2>`;
    const h1 = block.match(/^#\s+([\s\S]+)/);      if (h1) return `<h1>${inlineHtml(h1[1])}</h1>`;
    return `<p>${inlineHtml(block.replace(/\n/g, ' '))}</p>`;
  }).filter(Boolean).join('\n');
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`MangaOS Task Board running at http://localhost:${PORT}`);
  console.log(`  Sasha:    http://localhost:${PORT}/sasha`);
});
