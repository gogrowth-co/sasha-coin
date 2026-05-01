/**
 * MangaOS Project Onboarding Server
 *
 * Standalone server for the voice onboarding interview.
 * Run BEFORE the full task-server.js is set up.
 *
 * Usage:
 *   npm run onboarding
 *   Then open http://localhost:3000/onboarding
 *
 * Flow:
 *   1. Voice interview (~5 min, 6 topics)
 *   2. OpenRouter extracts structured data from transcript
 *   3. Writes answers into onboarding.md (sections it can answer)
 *   4. Prompts you to complete Visual Identity + Technical Setup manually
 *   5. You run /init-project to generate all _context/ files
 */

const http   = require('http');
const fs     = require('fs');
const path   = require('path');

const ROOT       = __dirname;
const HTML_FILE  = path.join(ROOT, 'onboarding.html');
const OB_FILE    = path.join(ROOT, 'onboarding.md');
const RESEARCH   = path.join(ROOT, 'research');

// ── Helpers ────────────────────────────────────────────────────────────────

function loadEnv() {
  const envFile = path.join(ROOT, '.env');
  const env = { ...process.env };
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
      const idx = line.indexOf('=');
      if (idx > 0) {
        const k = line.slice(0, idx).trim();
        const v = line.slice(idx + 1).trim();
        if (k) env[k] = v;
      }
    }
  }
  return env;
}

const BOOT_ENV = loadEnv();
const PORT = Number(BOOT_ENV.PORT || BOOT_ENV.ONBOARDING_PORT || BOOT_ENV.TASK_SERVER_PORT || 3000);

/**
 * Read a field from onboarding.md if it's already been partially filled.
 * Returns the value after "- Field label: " or empty string.
 */
function readObField(label) {
  if (!fs.existsSync(OB_FILE)) return '';
  const content = fs.readFileSync(OB_FILE, 'utf8');
  const regex = new RegExp(`^- ${label}:\\s*(.+)$`, 'mi');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * Write extracted interview data back into onboarding.md.
 * Fills Project Identity, Brand Voice, Audience ICPs, Product/Content Details, First Campaign.
 * Leaves Visual Identity and Technical Setup blank (too technical for voice).
 */
function fillOnboardingMd(extracted) {
  if (!fs.existsSync(OB_FILE)) {
    console.error('[onboarding] onboarding.md not found — cannot fill');
    return { filled: 0, skipped: ['onboarding.md not found'] };
  }

  let content = fs.readFileSync(OB_FILE, 'utf8');
  const filled = [];
  const skipped = [];

  function setField(label, value) {
    if (!value) { skipped.push(label); return; }
    // Match "- Label: " lines (with optional trailing placeholder text in parens)
    const regex = new RegExp(`(^- ${escapeRegex(label)}:)[^\\n]*$`, 'mi');
    if (regex.test(content)) {
      content = content.replace(regex, `$1 ${value}`);
      filled.push(label);
    } else {
      skipped.push(label + ' (field not found)');
    }
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  const e = extracted;

  // Project Identity
  if (e.project_name)    setField('Project name', e.project_name);
  if (e.project_slug)    setField('Project slug', e.project_slug);
  if (e.project_type)    setField('Type', e.project_type);
  if (e.primary_language) setField('Primary language', e.primary_language);
  if (e.primary_url)     setField('Primary URL', e.primary_url);
  if (e.stack_platform)  setField('Stack/platform', e.stack_platform);
  if (e.short_description) setField('Short description', e.short_description);

  // Brand Voice
  if (e.one_line_positioning) setField('One-line positioning', e.one_line_positioning);
  if (e.tone_adjectives)      setField('Tone (3 adjectives)', e.tone_adjectives);
  if (e.vocabulary_use)       setField('Vocabulary to always use', e.vocabulary_use);
  if (e.vocabulary_avoid)     setField('Vocabulary to NEVER use', e.vocabulary_avoid);
  if (e.writing_rules)        setField('Writing rules', e.writing_rules);
  if (e.sentence_length)      setField('Sentence length target', e.sentence_length);

  // ICP 1
  if (e.icp1_name)      setField('Name', e.icp1_name);
  if (e.icp1_role)      setField('Role/persona', e.icp1_role);
  if (e.icp1_industry)  setField('Industry', e.icp1_industry);
  if (e.icp1_pain)      setField('Primary pain', e.icp1_pain);
  if (e.icp1_trigger)   setField('Buying trigger', e.icp1_trigger);
  if (e.icp1_platforms) setField('Platforms they use', e.icp1_platforms);

  // Product/Content Details — saas-app / personal-brand fields
  if (e.core_offering)      setField('Core offering', e.core_offering);
  if (e.primary_cta)        setField('Primary CTA', e.primary_cta);
  if (e.lead_magnet)        setField('Lead magnet / Hook', e.lead_magnet);
  if (e.differentiators)    setField('Key differentiators', e.differentiators);
  // publisher / media-brand fields
  if (e.content_categories)    setField('Content categories', e.content_categories);
  if (e.publishing_frequency)  setField('Publishing frequency target', e.publishing_frequency);
  if (e.monetization_model)    setField('Monetization model', e.monetization_model);
  if (e.traffic_source)        setField('Primary traffic source target', e.traffic_source);
  // ai-agent-persona fields
  if (e.agent_backstory)  setField('Agent backstory / personality', e.agent_backstory);
  if (e.agent_platforms)  setField('Platforms the agent is active on', e.agent_platforms);
  if (e.agent_voice)      setField('How the agent "talks"', e.agent_voice);

  // First Campaign
  if (e.campaign_name)     setField('Campaign name', e.campaign_name);
  if (e.campaign_goal)     setField('Campaign goal', e.campaign_goal);
  if (e.campaign_kpi)      setField('Primary KPI', e.campaign_kpi);
  if (e.campaign_timeline) setField('Timeline', e.campaign_timeline);
  if (e.campaign_channels) setField('Channels', e.campaign_channels);
  if (e.campaign_cta)      setField('CTA for this campaign', e.campaign_cta);
  if (e.campaign_hook)     setField('Lead magnet or hook', e.campaign_hook);

  fs.writeFileSync(OB_FILE, content, 'utf8');
  return { filled, skipped };
}

// ── Build extraction prompt ────────────────────────────────────────────────

function buildExtractionPrompt(transcriptText, projectType) {
  return `Extract structured project onboarding data from this interview transcript.
Project type hint: ${projectType || 'unknown'}

TRANSCRIPT:
${transcriptText}

Return a JSON object with these fields (use null for anything not mentioned):
{
  "project_name": "string",
  "project_slug": "string (lowercase-hyphenated URL-friendly version of name)",
  "project_type": "personal-brand | saas-app | publisher | ai-agent-persona | media-brand",
  "primary_language": "EN | PT | ES",
  "primary_url": "string or null",
  "stack_platform": "string or null",
  "short_description": "string (one sentence: what it is, for whom)",

  "one_line_positioning": "string",
  "tone_adjectives": "string (3 adjectives comma-separated)",
  "vocabulary_use": "string (comma-separated words/phrases to always use)",
  "vocabulary_avoid": "string (comma-separated words/phrases to never use)",
  "writing_rules": "string",
  "sentence_length": "string or null",

  "icp1_name": "string (short label)",
  "icp1_role": "string",
  "icp1_industry": "string or null",
  "icp1_pain": "string",
  "icp1_trigger": "string",
  "icp1_platforms": "string or null",

  "core_offering": "string or null",
  "primary_cta": "string or null",
  "lead_magnet": "string or null",
  "differentiators": "string or null",
  "content_categories": "string or null",
  "publishing_frequency": "string or null",
  "monetization_model": "string or null",
  "traffic_source": "string or null",
  "agent_backstory": "string or null",
  "agent_platforms": "string or null",
  "agent_voice": "string or null",

  "campaign_name": "string or null",
  "campaign_goal": "string or null",
  "campaign_kpi": "string or null",
  "campaign_timeline": "string or null",
  "campaign_channels": "string or null",
  "campaign_cta": "string or null",
  "campaign_hook": "string or null"
}

Return only valid JSON. No markdown, no explanation.`;
}

// ── ElevenLabs agent prompt ────────────────────────────────────────────────

const AGENT_ID = 'agent_5001kgk3wr13f25s177xwgjzbrsc';

function buildInterviewPrompt(projectName, projectType) {
  const typeHints = {
    'saas-app':         'a SaaS web application',
    'publisher':        'a content publisher (blog/media)',
    'ai-agent-persona': 'an AI agent persona with its own identity',
    'media-brand':      'a media brand (podcast, newsletter, or show)',
    'personal-brand':   'a personal brand',
  };
  const typeLabel = typeHints[projectType] || 'a new project';
  const nameLabel = projectName || 'this project';

  return `You are conducting a project onboarding interview for MangaOS — a modular AI marketing OS.

You are helping Gabriel configure a new marketing workspace for "${nameLabel}", ${typeLabel}.

Your job: collect structured information about this project across 6 topics. Ask one question at a time. Be conversational, direct, and efficient. Acknowledge each answer briefly then move to the next topic. No summaries mid-interview.

Cover these 6 topics in order:

1. Project overview — What exactly is ${nameLabel}? Who is it for? What specific problem does it solve or value does it deliver? What's the primary URL or platform if known?

2. Brand voice — How should this project sound? Give me 3 adjectives that describe its tone. What words or phrases should always appear in its content? What should never appear?

3. Target audience — Who is the primary person this project serves? Describe their role, their biggest pain point, and what triggers them to seek this out.

4. Content strategy — What content categories does this project cover? How often should it publish? If it's a tool, what does the blog or content engine focus on? What's the primary traffic or distribution channel?

5. Core offering — What does this project actually give people: a tool, content, a service, or a persona? What's the primary call to action? Is there a lead magnet or hook to build an audience?

6. First campaign — What's the first 30-day goal for this project? Name one primary KPI. What channels will it use? What's the CTA for this campaign?

When all 6 topics are covered, say: "That covers everything I need. Go ahead and click Save to update your onboarding file."`;
}

// ── HTTP server ─────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');

  // GET / or /onboarding — serve the HTML
  if (req.method === 'GET' && (req.url === '/' || req.url === '/onboarding')) {
    fs.readFile(HTML_FILE, 'utf8', (err, data) => {
      if (err) { res.writeHead(404); res.end('onboarding.html not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // GET /api/onboarding/token — patch ElevenLabs agent, return agent ID
  if (req.method === 'GET' && req.url === '/api/onboarding/token') {
    (async () => {
      const env = loadEnv();
      const elevenKey = env.ELEVENLABS_API_KEY || '';

      if (!elevenKey) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ token: null, note: 'No ELEVENLABS_API_KEY in .env' }));
        return;
      }

      const projectName = readObField('Project name') || '';
      const projectType = readObField('Type').split('|')[0].trim() || '';
      const prompt = buildInterviewPrompt(projectName, projectType);

      // Patch agent prompt
      try {
        const patchRes = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
          method: 'PATCH',
          headers: { 'xi-api-key': elevenKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_config: {
              agent: {
                prompt: { prompt },
                first_message: `Hey! I'm here to run a quick onboarding interview for your new MangaOS workspace${projectName ? ` — ${projectName}` : ''}. Six questions, about 5 minutes. Ready when you are.`
              }
            }
          })
        });
        if (!patchRes.ok) console.warn('[onboarding] Agent PATCH failed:', await patchRes.text());
        else console.log('[onboarding] Agent prompt updated for:', projectName || '(unnamed project)');
      } catch(e) {
        console.warn('[onboarding] Agent PATCH error:', e.message);
      }

      // Get signed token (or return public agent ID if auth not enabled)
      try {
        const tokenRes = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${AGENT_ID}`,
          { headers: { 'xi-api-key': elevenKey } }
        );
        if (!tokenRes.ok) {
          // Public agent — no token needed, return agent ID directly
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ agentId: AGENT_ID }));
          return;
        }
        const data = await tokenRes.json();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ token: data.token, agentId: AGENT_ID }));
      } catch(e) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ agentId: AGENT_ID }));
      }
    })().catch(e => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    });
    return;
  }

  // POST /api/onboarding/save — extract from transcript, fill onboarding.md
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

      const env = loadEnv();
      const apiKey = env.OPENROUTER_API_KEY || '';
      if (!apiKey) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'OPENROUTER_API_KEY not configured in .env' }));
        return;
      }

      // Save raw transcript to research/
      const dateStr = new Date().toISOString().slice(0, 10);
      if (!fs.existsSync(RESEARCH)) fs.mkdirSync(RESEARCH, { recursive: true });
      const rawFile = path.join(RESEARCH, `onboarding-interview-${dateStr}.json`);
      fs.writeFileSync(rawFile, JSON.stringify({ date: dateStr, transcript }, null, 2), 'utf8');

      // Extract structured data via OpenRouter
      const transcriptText = transcript
        .map(m => `${m.role === 'agent' ? 'AGENT' : 'YOU'}: ${m.text}`)
        .join('\n\n');

      const projectType = readObField('Type').split('|')[0].trim() || '';
      const extractionPrompt = buildExtractionPrompt(transcriptText, projectType);

      let extracted = null;
      try {
        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://mangabeira.net',
            'X-Title': 'MangaOS Project Onboarding'
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
          fs.writeFileSync(
            path.join(RESEARCH, `onboarding-extracted-${dateStr}.json`),
            JSON.stringify(extracted, null, 2), 'utf8'
          );
        }
      } catch(e) {
        console.error('[onboarding] Extraction error:', e.message);
      }

      // Fill onboarding.md
      let fillResult = { filled: [], skipped: ['Extraction failed — fill manually'] };
      if (extracted) {
        fillResult = fillOnboardingMd(extracted);
      }

      const filledCount = fillResult.filled.length;
      const remaining = [
        'Visual Identity (Primary color, fonts, visual style)',
        'Technical Setup (GA4 property ID, task server port)',
        'Review and adjust any auto-filled fields'
      ];

      const summary = [
        `Auto-filled ${filledCount} fields in onboarding.md.`,
        '',
        'Still needs manual completion:',
        ...remaining.map(r => `  • ${r}`),
        '',
        'When complete, run /init-project in Claude Code to generate all _context/ files.',
        '',
        `Raw transcript saved to: ${path.relative(ROOT, rawFile)}`
      ].join('\n');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, summary, filledCount, filled: fillResult.filled }));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  const name = readObField('Project name') || '(not yet filled)';
  console.log(`\nMangaOS Onboarding Server running at http://localhost:${PORT}`);
  console.log(`Project: ${name}`);
  console.log(`\nOpen http://localhost:${PORT}/onboarding to start the voice interview.\n`);
  if (!fs.existsSync(path.join(ROOT, '.env'))) {
    console.warn('Warning: .env not found. Copy .env.example to .env and add your API keys.\n');
  }
  if (!loadEnv().ELEVENLABS_API_KEY) {
    console.warn('Warning: ELEVENLABS_API_KEY not set. Add it to .env to enable voice interview.\n');
  }
});
