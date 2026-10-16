#!/usr/bin/env node
/**
 * slot_plan.mjs - how many pieces each desk still owes this week, computed, never judged (2026-10-08).
 * Root cause it removes: the Thursday briefing decided "no evergreen slot" while the approved desk target was 3 a week.
 *
 *   node slot_plan.mjs --context <project>/_context --week-start <YYYY-MM-DD> [--client <slug>] [--json]
 *   --client (or V4Q_CLIENT) is appended to every v4q call: v4q has no default client.
 *
 * Targets: <ctx>/desk-quotas.json (exported from V4 project_desks, the strategy-approved weekly targets; refreshed by
 * desk_quotas_export.sh). Counts: every Commission in the V4 store whose Target Date falls in the 7-day week starting --week-start
 * (Tuesday: the Monday session plans Tue-Thu, the Thursday session Fri-Mon), excluding Rejected/Archived and gap placeholders,
 * and new site pages already live before the week (they count in the week they went live; refreshes always count).
 * Also reports channel rules that need a quota of their own (Pinterest seasonal lead) from <ctx>/desk-rules.json.
 * Output: one line per desk "desk: target T, counted C, OPEN N" plus the counted ids. Exit 0.
 * Site adapter (2026-10-14): the "live before the week" date comes from WordPress REST by default (EkkoGreen). A static-git site
 * (mangabeira.net) reads content/pages.json created_at of the page the card's URL maps to (EN, BR or ES path), chosen by
 * `--cms static-git [--site-dir <checkout>]` or "cms": "static-git" in <ctx>/refresh-rules.json (checkout default <ctx>/../site).
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { loadCheckout, pageOf, resolveSite } from './site_static_git.mjs';

const arg = (f, d = null) => { const i = process.argv.indexOf(f); return i > -1 ? process.argv[i + 1] : d; };
const ctx = arg('--context'); const start = arg('--week-start');
if (!ctx || !start) { console.error('slot_plan: --context and --week-start are required'); process.exit(2); }
const quotas = JSON.parse(readFileSync(join(ctx, 'desk-quotas.json'), 'utf8'));
const rules = existsSync(join(ctx, 'desk-rules.json')) ? JSON.parse(readFileSync(join(ctx, 'desk-rules.json'), 'utf8')) : {};
const end = new Date(Date.parse(start + 'T12:00:00Z') + 6 * 864e5).toISOString().slice(0, 10);
const v4q = process.env.V4Q_BIN || (existsSync(join(homedir(), '.local/bin/v4q')) ? join(homedir(), '.local/bin/v4q') : 'v4q');
const client = arg('--client') || process.env.V4Q_CLIENT || null;
const CLIENT_ARGS = client ? ['--client', client] : [];

const recs = [];
for (let offset = 0; ; ) {
  const out = JSON.parse(execFileSync(v4q, ['list', 'commissions', '--limit', '200', '--offset', String(offset), ...CLIENT_ARGS], { encoding: 'utf8', maxBuffer: 64 << 20 }));
  recs.push(...out.records);
  if (!out.has_more) break; offset = out.next_offset;
}
const inWeek = recs.map(r => ({ id: r.id, p: r.props })).filter(({ p }) => {
  const d = p['date:Target Date:start'] || '';
  const t = String(p.Commission || '');
  // "(E2E)" in a title is NOT a test marker: the 2026-10-08 engine test produced real published pages that the Monday
  // briefing of 2026-10-12 then could not count (every desk showed 0). Test commissions are Shadow Mode or "DRY-" names.
  return d >= start && d <= end && !['Rejected', 'Archived'].includes(p.Status) && !p['Shadow Mode'] && !/^DRY-/.test(t)
    && !/\bgap\b|gap\/hold|briefing editorial|REGRESSION_READ|leitura de regress/i.test(t);
});
// A piece counts in the week it goes LIVE, not by its Target Date (2026-10-13): two engine-test pages targeted 13/14 Oct went
// live on 8 Oct and filled this week's evergreen quota, so the Thursday session would have pitched nothing. A new site page or
// news whose card is already published, with a WordPress post date before the week, counts for that earlier week.
// Refreshes are exempt: their post date is the ORIGINAL publication, and the refresh itself is the week's work.
const liveBefore = await (async () => {
  const pageIds = new Set(inWeek.filter(r => /website/i.test(String(r.p['Primary Channel'] || '')) && !/refresh|reparo|regress/i.test(`${r.p['Content Type'] || ''} ${r.p.Commission || ''}`)).map(r => r.id.replace(/-/g, '')));
  if (!pageIds.size) return new Set();
  const cards = []; for (let off = 0; ;) { const o = JSON.parse(execFileSync(v4q, ['list', 'ce_content', '--limit', '200', '--offset', String(off), ...CLIENT_ARGS], { encoding: 'utf8', maxBuffer: 64 << 20 })); cards.push(...o.records); if (!o.has_more) break; off = o.next_offset; }
  const early = new Set();
  const siteAdapter = resolveSite(process.argv, ctx);
  const checkout = siteAdapter.cms === 'static-git' ? loadCheckout(siteAdapter.siteDir) : null;
  for (const c of cards) {
    const cp = c.props; if (cp.Status !== 'Published' || !cp['Primary CMS URL']) continue;
    const ids = (String(cp['Commission Relation'] || '').match(/[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/gi) || []).map(x => x.replace(/-/g, ''));
    const mine = ids.filter(i => pageIds.has(i)); if (!mine.length) continue;
    if (checkout) {   // static-git: the page's created_at in the checkout; a URL the checkout does not know counts by Target Date
      const date = pageOf(checkout, cp['Primary CMS URL'])?.page.created || '';
      if (date && date < start) mine.forEach(i => early.add(i));
      continue;
    }
    try {
      const u = new URL(cp['Primary CMS URL']); const slug = u.pathname.split('/').filter(Boolean).pop();
      let date = '';
      for (const type of ['posts', 'pages']) {   // some site pieces are WordPress pages (same fallback as the publisher's preflight)
        const r = await fetch(`${u.origin}/wp-json/wp/v2/${type}?slug=${encodeURIComponent(slug)}&_fields=date`, { signal: AbortSignal.timeout(20_000) });
        date = r.ok ? ((await r.json())[0]?.date || '').slice(0, 10) : '';
        if (date) break;
      }
      if (date && date < start) mine.forEach(i => early.add(i));
    } catch { /* unreachable site: count it by Target Date, as before */ }
  }
  return early;
})();
const live = inWeek.filter(r => !liveBefore.has(r.id.replace(/-/g, '')));
// which desk a commission counts for (channel + type), the same words the briefings write
const deskOf = ({ p }) => {
  const ch = String(p['Primary Channel'] || ''), ty = String(p['Content Type'] || ''), t = String(p.Commission || '');
  if (/instagram/i.test(ch)) return 'instagram';
  if (/pinterest/i.test(ch)) return 'pinterest';
  if (/linkedin/i.test(ch)) return 'linkedin';
  if (/substack|newsletter/i.test(ch)) return 'newsletter';
  if (/website/i.test(ch)) { if (/news/i.test(ty) || /\| News \|/.test(t)) return 'news'; if (/\| (Refresh|Reparo)/i.test(t) || /refresh/i.test(ty)) return 'site-seo:refreshes'; return 'site-seo:evergreen_pages'; }
  return 'other';
};
const UNIT = { instagram: 'carousels', pinterest: 'pin_groups', linkedin: 'posts', newsletter: 'substack_editions', news: 'articles' };
const lines = [], plan = {};
for (const q of quotas.desks) {
  const targets = q.desk === 'site-seo' ? Object.entries(q.weekly_target).map(([k, v]) => [`site-seo:${k}`, v]) : [[q.desk, q.weekly_target[UNIT[q.desk]] ?? Object.values(q.weekly_target)[0]]];
  for (const [key, target] of targets) {
    const counted = live.filter(r => deskOf(r) === key && !/Reparo/i.test(String(r.p.Commission || '')));
    const open = Math.max(0, target - counted.length);
    plan[key] = { target, counted: counted.length, open, ids: counted.map(r => r.id.slice(0, 8)) };
    lines.push(`${key}: target ${target}, counted ${counted.length}, OPEN ${open}${counted.length ? '  (' + counted.map(r => r.id.slice(0, 8)).join(' ') + ')' : ''}`);
  }
}
// seasonal lead (Pinterest): during an active push, the open groups go to it first
const today = new Date().toISOString().slice(0, 10);
for (const [desk, r] of Object.entries(rules)) for (const s of r.seasonal ?? []) {
  if (today >= s.from && today <= s.until) {
    // groups of this push already in the week count toward its minimum (2026-10-13: two approved Eco Halloween groups were
    // ignored and the session was told to add two more)
    const word = String(s.name).replace(/^eco\s+/i, '').toLowerCase();
    const have = live.filter(r => deskOf(r) === desk && String(r.p.Commission || '').toLowerCase().includes(word)).length;
    const still = Math.max(0, s.min_per_week - have);
    plan[desk + ':seasonal'] = { push: s.name, min_groups_per_week: s.min_per_week, already_in_week: have, still_owed: still, destination: s.destination ?? null };
    lines.push(`${desk}: seasonal push "${s.name}" active until ${s.until}: ${have} of the weekly minimum ${s.min_per_week} already in the week${still ? `, ${still} of the open slots go to it` : ', minimum met'}${s.destination ? '' : ' (needs its destination page first: open the Website commission)'}`); }
}
if (process.argv.includes('--json')) console.log(JSON.stringify({ week: [start, end], plan }, null, 2));
else { console.log(`slot plan ${start}..${end} (targets: desk-quotas.json, strategy ${quotas.strategy_version ?? ''})`); lines.forEach(l => console.log('  ' + l)); }
