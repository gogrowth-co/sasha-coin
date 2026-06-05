// QA fabrication-strip test — validates Sasha's pre-post self-QA over the Vertex AI Express
// endpoint (GOOGLE_AGENT_PLATFORM_API_KEY). Mirrors sashaQA() in morning-reply-run.js exactly:
// same prompt, same geminiEndpoint() selection, role:'user', x-goog-api-key header.
// Run: node scripts/qa-vertex-test.mjs   (reads the key from process.env or local/marketing .env)
import { readFileSync } from 'node:fs';

function loadKey(name) {
  if (process.env[name]) return process.env[name];
  const envs = [
    '/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin/.env',
    '/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/marketing/.env',
  ];
  for (const f of envs) {
    try {
      for (const line of readFileSync(f, 'utf8').split('\n')) {
        const i = line.indexOf('='); if (i <= 0 || line.startsWith('#')) continue;
        if (line.slice(0, i).trim() === name) return line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
      }
    } catch {}
  }
  return '';
}

const VERTEX_KEY = loadKey('GOOGLE_AGENT_PLATFORM_API_KEY');
const GEMINI_API_KEY = VERTEX_KEY || loadKey('GEMINI_API_KEY');
const MODEL = process.env.GEMINI_REPLY_MODEL || 'gemini-2.5-flash';
const geminiEndpoint = (m) => VERTEX_KEY
  ? `https://aiplatform.googleapis.com/v1/publishers/google/models/${m}:generateContent`
  : `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;
console.log(`auth: ${VERTEX_KEY ? 'VERTEX (aiplatform)' : 'generativelanguage'} | key len ${GEMINI_API_KEY.length} | model ${MODEL}`);

// EXACT QA prompt from morning-reply-run.js sashaQA()
async function sashaQA(tweet, reply) {
  const prompt = `You are Sasha Coin's editor doing a FINAL QA before this reply posts to X. Be strict.

Source tweet by @${tweet.handle}: "${tweet.text}"
Sasha's drafted reply: "${reply}"

Check, in order:
1. FABRICATION (most important): does the reply state ANY specific figure — a number, $ amount, %, APR, token balance/holding, count, or date — presented as fact? Sasha has NO verified live data in this reply, so ANY such figure is unverifiable and MUST be removed or made qualitative. "0.00", round numbers, and plausible-sounding stats ALL count as fabrication.
2. TOPIC: is the reply about the source tweet's actual specific topic (not drifted to Sasha's usual themes)?
3. VOICE: leads with substance (no "I've seen / I've been tracking / Great point" windup), 1-2 sentences, first person, no hype words (revolutionary, bullish, gm, etc.).

If all three pass, verdict "pass" and return the reply unchanged. If any fails, verdict "fix" and rewrite it to fix the issue while keeping Sasha's sharp, first-person, lived-experience voice — with NO unverifiable figures, under 240 characters, no surrounding quotes.

Return ONLY JSON: {"verdict":"pass"|"fix","fixed_reply":"<final reply text>","reason":"<one short line>"}`;
  const resp = await fetch(geminiEndpoint(MODEL), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1200, thinkingConfig: { thinkingBudget: 512 } },
    }),
  });
  const data = await resp.json();
  if (!resp.ok || data.error) return { http: resp.status, err: data.error?.message?.slice(0, 140) };
  const parts = data.candidates?.[0]?.content?.parts || [];
  const raw = parts.filter(p => !p.thought).map(p => p.text).join('').trim();
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return { http: resp.status, err: 'noparse', raw: raw.slice(0, 120) };
  const j = JSON.parse(m[0]);
  return { http: resp.status, verdict: j.verdict, fixed_reply: (j.fixed_reply || '').trim(), reason: j.reason };
}

const hasNum = s => /\d/.test(s || '');

const cases = [
  {
    name: 'FABRICATION (must strip)',
    tweet: { handle: 'defi_dad', text: "What's actually earning yield on Base for stables right now?" },
    reply: "I'm pulling 42% APR on my USDC/cbBTC LP and I'm up $1,240 this month across 3 positions.",
    expect: 'fix', mustHaveNoDigits: true,
  },
  {
    name: 'CLEAN (no fabrication slips through)',
    tweet: { handle: 'defi_dad', text: "What's actually earning yield on Base for stables right now?" },
    reply: "Bluechip LP fees only pay you while the range holds. The moment price leaves your band you stop earning and start holding the loser, hedge or not.",
    expect: 'any', mustHaveNoDigits: true,
  },
];

let allPass = true;
for (const c of cases) {
  const r = await sashaQA(c.tweet, c.reply);
  if (r.err) { console.log(`\n[${c.name}] ❌ HTTP ${r.http} err: ${r.err}`); allPass = false; continue; }
  const verdictOk = c.expect === 'any' ? (r.verdict === 'pass' || r.verdict === 'fix') : r.verdict === c.expect;
  const numOk = !c.mustHaveNoDigits || !hasNum(r.fixed_reply);
  const pass = verdictOk && numOk;
  allPass = allPass && pass;
  console.log(`\n[${c.name}] ${pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  verdict: ${r.verdict} (expected ${c.expect})${verdictOk ? '' : ' ✗'}`);
  console.log(`  fixed_reply: "${r.fixed_reply}"`);
  if (c.mustHaveNoDigits) console.log(`  contains a digit? ${hasNum(r.fixed_reply)} ${numOk ? '(good — stripped)' : '✗ STILL HAS A NUMBER'}`);
  if (r.reason) console.log(`  reason: ${r.reason}`);
}
console.log(`\n=== ${allPass ? '✅ QA VALIDATED on Vertex endpoint' : '❌ QA TEST FAILED'} ===`);
process.exit(allPass ? 0 : 1);
