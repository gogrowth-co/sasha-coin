// node --test scripts/test/*.test.mjs : the model judge of a brief's meaning (2026-10-13), on a fake transport.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { judgeBrief, judgeGate, loadRegression, judgeInput } from '../brief_judge.mjs';

const tmp = () => mkdtempSync(join(tmpdir(), 'judge-'));
const reply = (obj, cost = 0.001) => async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: typeof obj === 'string' ? obj : JSON.stringify(obj) } }], usage: { cost } }) });
const brief = { title: 'Turbina eólica residencial: critérios para escolher', angle: 'critérios gerais, sem comparar modelos', pillar: 'energia' };
const desk = { pillars: ['energia', 'agua', 'residuos'] };
const regression = { cause: 'page stopped comparing real models with maker specs', lost_queries: ['turbina eólica'] };
const opts = (d, extra = {}) => ({ apiKey: 'test', ledger: join(d, 'spend.jsonl'), warn: () => {}, ...extra });

test('a repair that avoids the named cause fails with the reason, and the call is logged', async () => {
  const d = tmp();
  const r = await judgeBrief({ brief, desk, regression, commission: 'c1' }, opts(d, { fetchImpl: reply({ pillar_fit: true, answers_cause: false, reason: 'does not restore the model comparison' }, 0.0004) }));
  assert.equal(r.pass, false);
  assert.equal(r.answers_cause, false);
  assert.match(r.reason, /model comparison/);
  assert.equal(r.usd, 0.0004);
  const row = JSON.parse(readFileSync(join(d, 'spend.jsonl'), 'utf8').trim());
  assert.equal(row.task, 'brief_judge'); assert.equal(row.commission, 'c1'); assert.equal(row.usd, 0.0004);
});

test('a brief that fits and answers passes; fenced JSON is read', async () => {
  const d = tmp();
  const r = await judgeBrief({ brief, desk, regression: null }, opts(d, { fetchImpl: reply('```json\n{"pillar_fit":true,"answers_cause":true,"reason":"ok"}\n```') }));
  assert.equal(r.pass, true);
});

test('a transport error is null, never a pass; a missing key too', async () => {
  const d = tmp();
  const r = await judgeBrief({ brief, desk, regression }, opts(d, { fetchImpl: async () => { throw new Error('ECONNRESET'); } }));
  assert.equal(r.pass, null); assert.match(r.reason, /^judge unavailable: .*ECONNRESET/);
  const http = await judgeBrief({ brief, desk, regression }, opts(d, { fetchImpl: async () => ({ ok: false, status: 502, json: async () => ({}) }) }));
  assert.equal(http.pass, null);
  const nokey = await judgeBrief({ brief, desk, regression }, opts(d, { apiKey: '', fetchImpl: reply({ pillar_fit: true, answers_cause: true, reason: 'x' }) }));
  assert.equal(nokey.pass, null);
  const junk = await judgeBrief({ brief, desk, regression }, opts(d, { fetchImpl: reply('I think it is fine') }));
  assert.equal(junk.pass, null);
});

test('a call that costs more than the cap warns', async () => {
  const d = tmp(); const seen = [];
  const r = await judgeBrief({ brief, desk, regression }, opts(d, { cap: 0.05, warn: m => seen.push(m), fetchImpl: reply({ pillar_fit: true, answers_cause: true, reason: 'ok' }, 0.07) }));
  assert.equal(r.pass, true);
  assert.ok(seen.some(m => /over the cap/.test(m)));
});

test('the request is compact, deterministic and cut to 6000 chars', async () => {
  const d = tmp(); let body;
  await judgeBrief({ brief: { ...brief, sections: ['x'.repeat(9000)], secret_note: 'not sent' }, desk: { ...desk, banned_topics: ['cripto'], extra: 1 }, regression }, opts(d, { model: 'm/x', fetchImpl: async (u, init) => { body = JSON.parse(init.body); return reply({ pillar_fit: true, answers_cause: true, reason: 'ok' })(); } }));
  assert.equal(body.model, 'm/x'); assert.equal(body.temperature, 0); assert.equal(body.max_tokens, 300);
  assert.deepEqual(body.reasoning, { effort: 'low' }); assert.deepEqual(body.usage, { include: true });
  const user = JSON.parse(body.messages[1].content);
  assert.ok(JSON.stringify(user.brief).length <= 6000); assert.equal(user.brief.secret_note, undefined);
  assert.deepEqual(user.desk, { pillars: desk.pillars, banned_topics: ['cripto'] });
  assert.equal(judgeInput({ brief, desk, regression: null }).regression, null);
});

test('the regression record is read by id from the newest refresh selection under <project>/reports', () => {
  const d = tmp(); mkdirSync(join(d, 'reports'));
  writeFileSync(join(d, 'reports', 'refresh-select-2026-10-13.json'), JSON.stringify({ regressions: [{ id: 'g1abc', url: 'https://x/turbina', refreshed: '2026-09-01', impressions: { page: -60, site: 5 }, lost_queries: [{ query: 'turbina eólica' }, { query: 'turbina eólica residencial' }] }] }));
  const g = loadRegression(d, { regression_id: 'g1abc', regression_cause: 'page stopped comparing real models' });
  assert.equal(g.regression_id, 'g1abc'); assert.deepEqual(g.lost_queries, ['turbina eólica', 'turbina eólica residencial']);
  assert.match(g.cause, /comparing real models/);
  assert.equal(loadRegression(d, {}), null);
  assert.deepEqual(loadRegression(d, { regression_id: 'gzzz', restores: ['a'] }).lost_queries, ['a']);   // unknown id: only what the payload carries
});

test('gate integration: a judge fail is a gate failure; unavailable warns and changes nothing', async () => {
  const d = tmp();
  const fail = await judgeGate({ payload: brief, deskRules: desk, projectRoot: d, outDir: d }, opts(d, { fetchImpl: reply({ pillar_fit: true, answers_cause: false, reason: 'avoids the comparison' }) }));
  assert.equal(fail.failure, 'judge: avoids the comparison'); assert.equal(fail.judge.pass, false);
  const ok = await judgeGate({ payload: brief, deskRules: desk, projectRoot: d, outDir: d }, opts(d, { fetchImpl: reply({ pillar_fit: true, answers_cause: true, reason: 'ok' }) }));
  assert.equal(ok.failure, null); assert.equal(ok.warn, null);
  const down = await judgeGate({ payload: brief, deskRules: desk, projectRoot: d, outDir: d }, opts(d, { fetchImpl: async () => { throw new Error('timeout'); } }));
  assert.equal(down.failure, null); assert.match(down.warn, /WARN judge unavailable/); assert.equal(down.judge.pass, null);
});

test('the key comes from the workspace root .env, not the caller cwd (pre-push P1, 2026-10-14)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'judge-ws-'));
  writeFileSync(join(root, '.env'), 'OPENROUTER_API_KEY="sk-test-from-workspace"\n');
  const prev = process.env.OPENROUTER_API_KEY; delete process.env.OPENROUTER_API_KEY;
  let seen = null;
  const fetchImpl = async (_url, init) => { seen = init.headers.Authorization; return { ok: true, json: async () => ({ choices: [{ message: { content: '{"pillar_fit":true,"answers_cause":true,"reason":"ok"}' } }], usage: { cost: 0.0001 } }) }; };
  try {
    const r = await judgeBrief({ brief: { title: 'x' }, desk: {} }, { fetchImpl, workspaceRoot: root, outDir: root });
    assert.equal(seen, 'Bearer sk-test-from-workspace');
    assert.notEqual(r.pass, null);
    const miss = await judgeBrief({ brief: { title: 'x' }, desk: {} }, { fetchImpl, workspaceRoot: mkdtempSync(join(tmpdir(), 'judge-empty-')), outDir: root });
    assert.equal(miss.pass, null); assert.match(miss.reason, /OPENROUTER_API_KEY not in the environment nor in/);
  } finally { if (prev !== undefined) process.env.OPENROUTER_API_KEY = prev; }
});
