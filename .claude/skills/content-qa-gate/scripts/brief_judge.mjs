#!/usr/bin/env node
/**
 * brief_judge.mjs - a cheap open model judges a brief's MEANING (2026-10-13). brief_gate checks fields; on 2026-10-13 briefs passed
 * every field check while contradicting the measured regression cause (a "repair" of the turbina eolica page that avoided restoring
 * the model comparison the diagnosis named). Two questions only: does the brief fit a desk pillar, and does a repair restore what its
 * regression lost. Capped per call, every call logged to a spend ledger. A transport error is pass:null, never a pass.
 *
 *   node brief_judge.mjs --brief <json> --desk <json> [--regression <json>] [--out <dir>]
 *
 * Env: OPENROUTER_API_KEY (environment only), BRIEF_JUDGE_MODEL, BRIEF_JUDGE_LEDGER (default <out dir>/judge-spend.jsonl).
 * Model (2026-10-13 proof, turbina eolica repair: avoids-cause must fail, restores-comparison must pass):
 *   deepseek/deepseek-v4-flash      both right, $0.00007 + $0.00004   <- default (cheapest that got both right)
 *   deepseek/deepseek-v4-pro-0813   both right, $0.00088 + $0.00077   (BRIEF_JUDGE_MODEL fallback)
 *   deepseek/deepseek-v4-flash-0731 fail case right, pass case returned no JSON within 300 tokens: rejected
 */
import { readFileSync, appendFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash';
export const SYSTEM = 'Judge a content brief. Answer ONLY JSON {"pillar_fit":bool,"answers_cause":bool,"reason":"<=200 chars"}. pillar_fit: brief fits one of desk pillars. answers_cause: if regression given, brief restores what the regression cause names (lost queries, removed comparison, removed prices); else true.';
const BRIEF_FIELDS = ['title', 'angle', 'pillar', 'article_type', 'sections'];

const pick = (o, ks) => Object.fromEntries(ks.filter(k => o?.[k] != null && o[k] !== '').map(k => [k, o[k]]));
// cut the brief to 6000 chars of JSON: the judge needs the gist, and the cap keeps a call well under a cent
const cut = (o, n = 6000) => { let s = JSON.stringify(o); if (s.length <= n) return o; const t = { ...o };
  for (const k of ['sections', 'angle', 'title']) { if (t[k] == null) continue; t[k] = JSON.stringify(t[k]).slice(0, Math.max(0, n - (s.length - JSON.stringify(t[k]).length) - 40)); s = JSON.stringify(t); if (s.length <= n) break; }
  return t; };

export function judgeInput({ brief, desk, regression }) {
  const b = pick(brief, BRIEF_FIELDS); if (b.sections == null && brief?.outline != null) b.sections = brief.outline;   // outline is the repair briefs' name for sections
  return { brief: cut(b), desk: pick(desk, ['pillars', 'banned_topics']), regression: regression ? pick(regression, ['cause', 'lost_queries', 'regression_id']) : null };
}

const parse = s => { const m = String(s ?? '').match(/\{[\s\S]*\}/); if (!m) throw new Error('no JSON in the answer'); const j = JSON.parse(m[0]);
  if (typeof j.pillar_fit !== 'boolean' || typeof j.answers_cause !== 'boolean') throw new Error('answer lacks pillar_fit/answers_cause booleans'); return j; };

// Engine runs inherit no OpenRouter key (the vault hands it only to the open-model route), so the key may come from the client workspace .env (cwd), read in memory and never logged.
function workspaceKey(root = process.cwd()) { try { return (readFileSync(join(root, '.env'), 'utf8').match(/^OPENROUTER_API_KEY=(.*)$/m)?.[1] ?? '').trim().replace(/^['"]|['"]$/g, '') || undefined; } catch { return undefined; } }

export async function judgeBrief({ brief, desk, regression = null, commission = null }, { fetchImpl = fetch, model = process.env.BRIEF_JUDGE_MODEL || DEFAULT_MODEL, cap = 0.05,
  ledger = process.env.BRIEF_JUDGE_LEDGER || null, outDir = '.', workspaceRoot = process.cwd(), apiKey = process.env.OPENROUTER_API_KEY || workspaceKey(workspaceRoot), warn = m => console.warn(m) } = {}) {
  const down = e => ({ pass: null, reason: `judge unavailable: ${String(e?.message ?? e).slice(0, 160)}`, pillar_fit: null, answers_cause: null, usd: 0, model });
  if (!apiKey) return down(`OPENROUTER_API_KEY not in the environment nor in ${join(workspaceRoot, '.env')}`);
  let res, data;
  try {
    res = await fetchImpl('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', signal: AbortSignal.timeout(60000),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Title': 'content-qa-gate brief_judge' },
      body: JSON.stringify({ model, temperature: 0, max_tokens: 300, reasoning: { effort: 'low' }, usage: { include: true },
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: JSON.stringify(judgeInput({ brief, desk, regression })) }] }) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (e) { return down(e); }
  const usd = Number(data?.usage?.cost ?? 0);
  // log before parsing: a call that returned junk was still paid for
  const file = ledger || join(outDir, 'judge-spend.jsonl');
  try { mkdirSync(dirname(resolve(file)), { recursive: true }); appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), task: 'brief_judge', commission, model, usd }) + '\n'); } catch (e) { warn(`brief_judge: spend ledger unwritable (${e.message})`); }
  if (usd > cap) warn(`brief_judge: WARN call cost $${usd} is over the cap $${cap} (${model})`);
  let j; try { j = parse(data?.choices?.[0]?.message?.content); } catch (e) { return { ...down(e), usd }; }
  return { pass: j.pillar_fit && j.answers_cause, reason: String(j.reason ?? '').slice(0, 200), pillar_fit: j.pillar_fit, answers_cause: j.answers_cause, usd, model };
}

/** The regression a repair brief answers: by regression_id in the newest <project>/reports/refresh-select-*.json, else what the payload carries. */
export function loadRegression(projectRoot, payload) {
  const id = payload?.regression_id; if (!id) return null;
  const dir = join(projectRoot, 'reports'); let g = null;
  try { for (const f of readdirSync(dir).filter(f => /^refresh-select-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse()) {
    g = (JSON.parse(readFileSync(join(dir, f), 'utf8')).regressions || []).find(r => r.id === id); if (g) break; } } catch { /* no reports dir */ }
  const lost = g ? (g.lost_queries || []).map(q => q.query ?? q) : (Array.isArray(payload.restores) ? payload.restores : []);
  const measured = g ? `page ${g.url} lost ${g.impressions?.page ?? '?'}% impressions vs site ${g.impressions?.site ?? '?'}% after the ${g.refreshed} refresh` : '';
  const cause = [payload.regression_cause, g?.cause, measured].filter(Boolean).join('; ') || 'unknown';
  return { regression_id: id, cause, lost_queries: lost };
}

/** brief_gate's hook: judge, and turn the verdict into a gate failure (pass false), a WARN (unavailable) or nothing. */
export async function judgeGate({ payload, deskRules, projectRoot, outDir, commission = null }, opts = {}) {
  const judge = await judgeBrief({ brief: payload, desk: deskRules || {}, regression: loadRegression(projectRoot, payload), commission }, { outDir, workspaceRoot: projectRoot, ...opts });
  return { judge: { model: judge.model, pass: judge.pass, reason: judge.reason, usd: judge.usd },
    failure: judge.pass === false ? `judge: ${judge.reason}` : null,
    warn: judge.pass === null ? `  WARN ${judge.reason}` : null };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (f, d = null) => { const i = process.argv.indexOf(f); return i > -1 ? process.argv[i + 1] : d; };
  const load = x => x == null ? null : JSON.parse(existsSync(x) ? readFileSync(x, 'utf8') : x);   // a path or inline JSON
  if (!arg('--brief') || !arg('--desk')) { console.error('brief_judge: --brief <json> --desk <json> [--regression <json>] are required'); process.exit(2); }
  const r = await judgeBrief({ brief: load(arg('--brief')), desk: load(arg('--desk')), regression: load(arg('--regression')) }, { outDir: arg('--out', '.'), workspaceRoot: arg('--workspace', process.cwd()) });
  console.log(JSON.stringify(r));
  process.exit(r.pass === true ? 0 : r.pass === false ? 1 : 2);
}
