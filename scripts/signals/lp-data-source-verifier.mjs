#!/usr/bin/env node
/**
 * lp-data-source-verifier.mjs — keep the LP data-source API reference honest
 *
 * Weekly job (launchd com.mangaos.lp-datasource-check, Mondays 09:05) that probes
 * the live endpoints of the four data sources behind the pool-scanner v2 stack:
 *   DefiLlama (yields + coins), GeckoTerminal (incl. its machine-readable swagger),
 *   DexScreener, and Revert Finance (undocumented /v1/positions).
 *
 * It builds a "signature" per source (endpoint reachability + presence of the exact
 * fields the doc promises + GeckoTerminal's OpenAPI version & path set), diffs it
 * against the stored baseline, and:
 *   - always stamps "**Last auto-verified:**" in the reference doc,
 *   - writes reports/lp-data-source-check-YYYY-MM-DD.{json,md},
 *   - on DRIFT, appends a dated entry to the doc's "## Drift log" + pings Telegram.
 *
 * It does NOT rewrite the prose — drift detection + alerting only. A human/Claude
 * session corrects the spec when an alert fires (per the no-overclaim rule).
 *
 * Usage:
 *   node scripts/signals/lp-data-source-verifier.mjs              # probe + diff + stamp + report
 *   node scripts/signals/lp-data-source-verifier.mjs --dry-run    # probe + diff, print only, no writes
 *   node scripts/signals/lp-data-source-verifier.mjs --rebaseline # accept current live state as the new baseline
 *
 * Sasha Coin — Liquidity Miner data-source integrity check
 */

import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.resolve(__dirname, '..', '..')

const args = process.argv.slice(2)
const DRY_RUN    = args.includes('--dry-run')
const REBASELINE = args.includes('--rebaseline')

const DOC_PATH      = path.join(WORKSPACE, 'docs/integrations/lp-data-sources-api-reference.md')
const BASELINE_PATH = path.join(WORKSPACE, 'state/lp-data-source-baseline.json')
const TODAY         = new Date().toISOString().slice(0, 10)
const REPORT_JSON   = path.join(WORKSPACE, `reports/lp-data-source-check-${TODAY}.json`)
const REPORT_MD     = path.join(WORKSPACE, `reports/lp-data-source-check-${TODAY}.md`)

const UA = 'sasha-lp-datasource-verifier/1.0 (+https://github.com/sasha)'

// ─── HTTP ─────────────────────────────────────────────────────────────────────

function httpGet(url, { headers = {}, timeoutMs = 12000 } = {}) {
  return new Promise(resolve => {
    const req = https.get(url, { headers: { 'User-Agent': UA, ...headers } }, res => {
      let data = ''
      res.on('data', c => (data += c))
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', e => resolve({ status: 0, body: '', error: e.message }))
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ status: 0, body: '', error: 'timeout' }) })
  })
}

async function getJson(url, opts) {
  const r = await httpGet(url, opts)
  if (r.status !== 200) return { ok: false, status: r.status, error: r.error || `HTTP ${r.status}` }
  try { return { ok: true, status: 200, json: JSON.parse(r.body) } }
  catch (e) { return { ok: false, status: 200, error: `bad JSON: ${e.message}` } }
}

// one retry on a transient failure (status 0 / 5xx) before concluding "down"
async function getJsonRetry(url, opts) {
  let r = await getJson(url, opts)
  if (!r.ok && (r.status === 0 || r.status >= 500)) {
    await new Promise(s => setTimeout(s, 1500))
    r = await getJson(url, opts)
  }
  return r
}

function httpPost(url, bodyObj, { headers = {}, timeoutMs = 20000 } = {}) {
  return new Promise(resolve => {
    const u = new URL(url)
    const payload = JSON.stringify(bodyObj)
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'User-Agent': UA, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers },
    }, res => {
      let data = ''
      res.on('data', c => (data += c))
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', e => resolve({ status: 0, body: '', error: e.message }))
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ status: 0, body: '', error: 'timeout' }) })
    req.write(payload); req.end()
  })
}

// Resolve THE_GRAPH_API_KEY from env or .env; gateway keys are 32 hex — trim a junk-suffixed value.
function readGraphKey() {
  let k = process.env.THE_GRAPH_API_KEY || ''
  if (!k) {
    try {
      const m = fs.readFileSync(path.join(WORKSPACE, '.env'), 'utf8').match(/^THE_GRAPH_API_KEY=(.*)$/m)
      if (m) k = m[1]
    } catch {}
  }
  k = (k || '').trim()
  if (k.length > 32 && /^[0-9a-fA-F]{32}/.test(k)) k = k.slice(0, 32)
  return k
}

// keys missing from a REQUIRED set, given an object (or union of objects)
const missing = (required, present) => required.filter(k => !present.has(k))
const keysOf  = obj => (obj && typeof obj === 'object' ? Object.keys(obj) : [])

// ─── Source probes ─────────────────────────────────────────────────────────────
// Each returns: { signature: {...}, status: 'live'|'drift'|'down', missingFields: [], notes: [] }
// `signature` is what gets diffed against baseline. `status` is this run's verdict
// vs the doc's documented shape (independent of baseline).

const REQUIRED = {
  defillama_pool: ['pool','project','chain','symbol','tvlUsd','apy','apyBase','apyReward','poolMeta','volumeUsd1d','volumeUsd7d','apyBase7d','underlyingTokens','il7d'],
  defillama_price: ['price','confidence','decimals','symbol','timestamp'],
  gecko_pool: ['name','address','reserve_in_usd','volume_usd','pool_created_at','base_token_price_usd'],
  dexscreener_pair: ['chainId','dexId','pairAddress','baseToken','quoteToken','priceUsd','volume','liquidity','txns'],
  revert_position: ['pool','in_range','fee_tier','network','exchange','performance'],
  revert_perf_hodl: ['fee_apr','apr','pnl','roi','il'],
  thegraph_pool: ['id','feeTier','feesUSD','volumeUSD','totalValueLockedUSD'],
}

// The Graph subgraphs the verifier asserts against (verified live 2026-06-04). Add IDs here as we wire more.
const GRAPH_SUBGRAPHS = [
  { label: 'uniV3Mainnet',  id: '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV' },
  { label: 'aerodromeBase', id: 'GENunSHWLBXm59mBSgPzQ8metBEp9YDfdqwFr91Av1UM' },
]
const GRAPH_QUERY = '{ _meta { block { number timestamp } hasIndexingErrors } pools(first:1, orderBy: volumeUSD, orderDirection: desc){ id feeTier feesUSD volumeUSD totalValueLockedUSD } }'

async function probeDefiLlama() {
  const notes = []
  // yields /pools — union keys across a sample so optional-but-documented fields count as present
  const pools = await getJsonRetry('https://yields.llama.fi/pools')
  let poolMissing = ['<unreachable>'], poolCount = 0
  if (pools.ok && Array.isArray(pools.json?.data)) {
    poolCount = pools.json.data.length
    const union = new Set()
    pools.json.data.slice(0, 200).forEach(p => keysOf(p).forEach(k => union.add(k)))
    poolMissing = missing(REQUIRED.defillama_pool, union)
    notes.push(`yields/pools: ${poolCount} pools, ${union.size} distinct fields`)
  } else {
    notes.push(`yields/pools DOWN: ${pools.error || pools.status}`)
  }
  // coins current price — probe an on-chain token (carries `decimals`; coingecko-id coins do not)
  const price = await getJsonRetry('https://coins.llama.fi/prices/current/base:0x4200000000000000000000000000000000000006')
  let priceMissing = ['<unreachable>']
  if (price.ok && price.json?.coins) {
    const first = Object.values(price.json.coins)[0]
    priceMissing = missing(REQUIRED.defillama_price, new Set(keysOf(first)))
    notes.push(`coins/current: ok (WETH $${first?.price ?? '?'}, conf ${first?.confidence ?? '?'})`)
  } else {
    notes.push(`coins/current DOWN: ${price.error || price.status}`)
  }
  const down = !pools.ok || !price.ok
  const missingFields = [...poolMissing, ...priceMissing].filter(k => k !== '<unreachable>')
  return {
    signature: { poolFieldsPresent: !poolMissing.includes('<unreachable>') ? REQUIRED.defillama_pool.filter(k=>!poolMissing.includes(k)).sort() : null,
                 priceFieldsPresent: !priceMissing.includes('<unreachable>') ? REQUIRED.defillama_price.filter(k=>!priceMissing.includes(k)).sort() : null },
    status: down ? 'down' : (missingFields.length ? 'drift' : 'live'),
    missingFields, notes,
  }
}

async function probeGeckoTerminal() {
  const notes = []
  const V = { Accept: 'application/json;version=20230302' }
  // OpenAPI spec — the real machine-readable changelog
  const spec = await getJsonRetry('https://api.geckoterminal.com/docs/v2/swagger.json')
  let specVersion = null, paths = null
  if (spec.ok && spec.json?.paths) {
    specVersion = spec.json.info?.version || null
    paths = Object.keys(spec.json.paths).sort()
    notes.push(`swagger: v${specVersion}, ${paths.length} paths`)
  } else {
    notes.push(`swagger DOWN: ${spec.error || spec.status}`)
  }
  // live pool shape on Base
  const pools = await getJsonRetry('https://api.geckoterminal.com/api/v2/networks/base/pools?page=1', { headers: V })
  let poolMissing = ['<unreachable>']
  if (pools.ok && Array.isArray(pools.json?.data) && pools.json.data[0]) {
    poolMissing = missing(REQUIRED.gecko_pool, new Set(keysOf(pools.json.data[0].attributes)))
    notes.push(`base/pools: ok (${pools.json.data.length} on page 1)`)
  } else if (pools.status === 429) {
    notes.push('base/pools: 429 rate-limited (skipped field check this run)')
    poolMissing = [] // don't false-flag drift on a rate-limit
  } else {
    notes.push(`base/pools DOWN: ${pools.error || pools.status}`)
  }
  const down = !spec.ok
  const missingFields = poolMissing.filter(k => k !== '<unreachable>')
  return {
    signature: { specVersion, pathCount: paths?.length ?? null, paths },
    status: down ? 'down' : (missingFields.length ? 'drift' : 'live'),
    missingFields, notes,
  }
}

async function probeDexScreener() {
  const notes = []
  // WETH on Base — token-pairs returns a bare array of every pool the token trades in
  const WETH_BASE = '0x4200000000000000000000000000000000000006'
  const r = await getJsonRetry(`https://api.dexscreener.com/token-pairs/v1/base/${WETH_BASE}`)
  let pairMissing = ['<unreachable>'], n = 0
  if (r.ok && Array.isArray(r.json) && r.json[0]) {
    n = r.json.length
    pairMissing = missing(REQUIRED.dexscreener_pair, new Set(keysOf(r.json[0])))
    notes.push(`token-pairs/v1/base/WETH: ${n} pairs`)
  } else {
    notes.push(`token-pairs DOWN: ${r.error || r.status}`)
  }
  const down = !r.ok
  const missingFields = pairMissing.filter(k => k !== '<unreachable>')
  return {
    signature: { pairFieldsPresent: !pairMissing.includes('<unreachable>') ? REQUIRED.dexscreener_pair.filter(k=>!pairMissing.includes(k)).sort() : null },
    status: down ? 'down' : (missingFields.length ? 'drift' : 'live'),
    missingFields, notes,
  }
}

async function probeRevert() {
  const notes = []
  // undocumented but load-bearing — the source most likely to change silently
  const r = await getJsonRetry('https://api.revert.finance/v1/positions?network=base&exchange=aerodrome&limit=1')
  let posMissing = ['<unreachable>'], perfMissing = ['<unreachable>'], total = null
  if (r.ok && Array.isArray(r.json?.data) && r.json.data[0]) {
    total = r.json.total_count ?? null
    const p = r.json.data[0]
    posMissing  = missing(REQUIRED.revert_position, new Set(keysOf(p)))
    perfMissing = missing(REQUIRED.revert_perf_hodl, new Set(keysOf(p?.performance?.hodl)))
    notes.push(`/v1/positions: ok (total_count ${total})`)
  } else {
    notes.push(`/v1/positions DOWN: ${r.error || r.status}`)
  }
  const down = !r.ok
  const missingFields = [...posMissing, ...perfMissing].filter(k => k !== '<unreachable>')
  return {
    signature: { hasSuccess: r.ok ? true : null,
                 positionFieldsPresent: !posMissing.includes('<unreachable>') ? REQUIRED.revert_position.filter(k=>!posMissing.includes(k)).sort() : null,
                 perfHodlFieldsPresent: !perfMissing.includes('<unreachable>') ? REQUIRED.revert_perf_hodl.filter(k=>!perfMissing.includes(k)).sort() : null },
    status: down ? 'down' : (missingFields.length ? 'drift' : 'live'),
    missingFields, notes,
  }
}

async function probeTheGraph() {
  // Authed (Bearer) — the only source needing a key, so cloud routine can't check it; local-only.
  const notes = []
  const key = readGraphKey()
  if (!key) {
    notes.push('THE_GRAPH_API_KEY absent — skipped (not drift)')
    return { signature: { keyPresent: false }, status: 'down', missingFields: [], notes }
  }
  if (key.length !== 32) notes.push(`warning: resolved key length ${key.length} (expected 32 hex)`)
  const nowSec = Math.floor(Date.now() / 1000)
  const sigSubgraphs = {}
  const missingFields = []
  let anyDown = false
  for (const sg of GRAPH_SUBGRAPHS) {
    const url = `https://gateway.thegraph.com/api/subgraphs/id/${sg.id}` // key goes in the Bearer header, never the URL
    let r = await httpPost(url, { query: GRAPH_QUERY }, { headers: { Authorization: `Bearer ${key}` } })
    if (r.status === 0 || r.status >= 500) { await new Promise(s => setTimeout(s, 1500)); r = await httpPost(url, { query: GRAPH_QUERY }, { headers: { Authorization: `Bearer ${key}` } }) }
    let json = null; try { json = JSON.parse(r.body) } catch {}
    if (r.status !== 200 || !json || json.errors || !json.data) {
      anyDown = true
      sigSubgraphs[sg.label] = { poolFieldsPresent: null }
      notes.push(`${sg.label} DOWN: ${r.status}${json?.errors ? ' ' + JSON.stringify(json.errors).slice(0, 80) : (r.error ? ' ' + r.error : '')}`)
      continue
    }
    const meta = json.data._meta, pool = json.data.pools?.[0]
    const poolMissing = missing(REQUIRED.thegraph_pool, new Set(keysOf(pool)))
    sigSubgraphs[sg.label] = { poolFieldsPresent: REQUIRED.thegraph_pool.filter(k => !poolMissing.includes(k)).sort() }
    poolMissing.forEach(f => missingFields.push(`${sg.label}:${f}`))
    if (meta?.hasIndexingErrors) { anyDown = true; notes.push(`${sg.label}: hasIndexingErrors=true (stale data)`) }
    else if (meta?.block?.timestamp && (nowSec - Number(meta.block.timestamp)) > 1800) { anyDown = true; notes.push(`${sg.label}: stale block (~${Math.round((nowSec - Number(meta.block.timestamp)) / 60)}m old)`) }
    else notes.push(`${sg.label}: ok (block ${meta?.block?.number})`)
  }
  return {
    signature: { gatewayHost: 'gateway.thegraph.com', auth: 'bearer', subgraphs: sigSubgraphs },
    status: missingFields.length ? 'drift' : (anyDown ? 'down' : 'live'),
    missingFields, notes,
  }
}

// ─── Diff signatures against baseline ───────────────────────────────────────────

function diffSig(name, base, cur) {
  // returns array of human-readable change strings
  const changes = []
  if (!base) return changes // first time we see this source
  const walk = (b, c, prefix) => {
    const keys = new Set([...keysOf(b), ...keysOf(c)])
    for (const k of keys) {
      const bv = b?.[k], cv = c?.[k]
      const at = prefix ? `${prefix}.${k}` : k
      if (Array.isArray(bv) || Array.isArray(cv)) {
        const bs = new Set(bv || []), cs = new Set(cv || [])
        const added   = [...cs].filter(x => !bs.has(x))
        const removed = [...bs].filter(x => !cs.has(x))
        if (added.length)   changes.push(`${at}: +[${added.join(', ')}]`)
        if (removed.length) changes.push(`${at}: -[${removed.join(', ')}]`)
      } else if (bv && cv && typeof bv === 'object' && typeof cv === 'object') {
        walk(bv, cv, at)
      } else if (JSON.stringify(bv) !== JSON.stringify(cv)) {
        changes.push(`${at}: ${JSON.stringify(bv)} -> ${JSON.stringify(cv)}`)
      }
    }
  }
  walk(base, cur, '')
  return changes
}

// ─── Doc + report writers ───────────────────────────────────────────────────────

function stampDoc(summaryLine, driftEntries) {
  if (!fs.existsSync(DOC_PATH)) return
  let doc = fs.readFileSync(DOC_PATH, 'utf8')
  const stamp = `**Last auto-verified:** ${TODAY} — ${summaryLine} Checked weekly by \`scripts/signals/lp-data-source-verifier.mjs\` (launchd \`com.mangaos.lp-datasource-check\`, Mondays 09:05).`
  doc = doc.replace(/^\*\*Last auto-verified:\*\*.*$/m, stamp)

  if (driftEntries.length) {
    const block = driftEntries.map(e =>
      `- **${TODAY} — ${e.source}:** ${e.changes.join('; ')}${e.note ? ` _(${e.note})_` : ''}`
    ).join('\n')
    if (doc.includes('- (no drift detected yet)')) {
      doc = doc.replace('- (no drift detected yet)', block)
    } else {
      // insert right after the Drift log intro italic line
      doc = doc.replace(/(## Drift log\n\n_[^\n]*_\n)/, `$1\n${block}\n`)
    }
  }
  fs.writeFileSync(DOC_PATH, doc)
}

function writeReports(report) {
  fs.mkdirSync(path.dirname(REPORT_JSON), { recursive: true })
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2))
  const rows = Object.entries(report.sources).map(([k, v]) =>
    `| ${k} | ${v.status.toUpperCase()} | ${v.missingFields.length ? v.missingFields.join(', ') : '—'} | ${v.driftFromBaseline.length ? v.driftFromBaseline.join('; ') : '—'} |`
  ).join('\n')
  const md = `# LP Data-Source Verification — ${TODAY}

**Verdict:** ${report.verdict}
**Sources checked:** DefiLlama, GeckoTerminal, DexScreener, Revert, The Graph
**Doc:** \`docs/integrations/lp-data-sources-api-reference.md\`

| Source | Status | Missing documented fields | Drift vs baseline |
|---|---|---|---|
${rows}

## Notes
${Object.entries(report.sources).map(([k, v]) => `- **${k}:** ${v.notes.join(' · ')}`).join('\n')}

_Status legend: LIVE = matches the doc; DRIFT = 200 but documented field/shape changed (doc needs a prose fix); DOWN = unreachable/transient (no doc change implied)._
`
  fs.writeFileSync(REPORT_MD, md)
}

function sendTelegram(msg) {
  // No-ops locally (TELEGRAM_* live on the VPS .env, not the local box) — harmless.
  const token = process.env.TELEGRAM_BOT_TOKEN, chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return
  const body = JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' })
  const req = https.request({
    hostname: 'api.telegram.org', path: `/bot${token}/sendMessage`, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, () => {})
  req.on('error', () => {})
  req.write(body); req.end()
}

// Local alert surface — the fleet dashboard log (works without secrets, unlike Telegram).
function notifyDashboard(emoji, status, desc) {
  try {
    const log = path.join(process.env.HOME || '', 'claude-fleet/dashboard.log')
    const hhmm = new Date().toTimeString().slice(0, 5)
    fs.appendFileSync(log, `[${hhmm}] lp-datasource ${emoji} ${status} - ${desc}\n`)
  } catch {}
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`LP data-source verifier — ${TODAY}${DRY_RUN ? ' (dry-run)' : ''}${REBASELINE ? ' (rebaseline)' : ''}`)

  const probes = {
    defillama:     await probeDefiLlama(),
    geckoterminal: await probeGeckoTerminal(),
    dexscreener:   await probeDexScreener(),
    revert:        await probeRevert(),
    thegraph:      await probeTheGraph(),
  }

  let baseline = null
  if (fs.existsSync(BASELINE_PATH)) {
    try { baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) } catch {}
  }
  const firstRun = !baseline

  const sources = {}, driftEntries = []
  for (const [name, p] of Object.entries(probes)) {
    // Skip baseline-diff when a source is purely DOWN (transient): its signature holds nulls that would
    // false-flag drift. Real schema drift still surfaces via status==='drift' + missingFields below.
    const driftFromBaseline = (firstRun || p.status === 'down') ? [] : diffSig(name, baseline.sources?.[name]?.signature, p.signature)
    sources[name] = { ...p, driftFromBaseline }
    // A doc-worthy alert = documented field missing (status drift) OR baseline signature changed.
    const changes = []
    if (p.missingFields.length) changes.push(`missing documented field(s): ${p.missingFields.join(', ')}`)
    if (driftFromBaseline.length) changes.push(...driftFromBaseline)
    if (changes.length) driftEntries.push({ source: name, changes, note: p.status === 'down' ? 'source also returned errors' : '' })
    console.log(`  ${name}: ${p.status.toUpperCase()}${changes.length ? ` — ${changes.length} change(s)` : ''}`)
    p.notes.forEach(n => console.log(`      ${n}`))
  }

  const downNames  = Object.entries(sources).filter(([,s]) => s.status === 'down').map(([k]) => k)
  const driftNames = Object.entries(sources).filter(([,s]) => s.driftFromBaseline.length || s.missingFields.length).map(([k]) => k)
  const verdict = firstRun ? 'BASELINE CREATED'
                : driftNames.length ? `DRIFT (${driftNames.join(', ')})`
                : downNames.length ? `OK with warnings (down: ${downNames.join(', ')})`
                : 'OK — all sources match the doc'

  const report = { generatedAt: new Date().toISOString(), date: TODAY, firstRun, verdict, sources }

  const summaryLine = firstRun ? 'baseline created, all sources probed.'
    : driftNames.length ? `⚠ DRIFT in ${driftNames.join(', ')} — see Drift log + report.`
    : downNames.length ? `all documented shapes OK (transient down: ${downNames.join(', ')}).`
    : 'all sources match this doc.'

  if (DRY_RUN) {
    console.log(`\nVERDICT: ${verdict}`)
    console.log(`(dry-run — no doc stamp, no report, no baseline write)`)
    return
  }

  writeReports(report)
  stampDoc(summaryLine, driftEntries)

  if (firstRun || REBASELINE) {
    fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true })
    const baseSig = { createdAt: new Date().toISOString(), date: TODAY, sources: {} }
    for (const [name, p] of Object.entries(probes)) baseSig.sources[name] = { signature: p.signature }
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseSig, null, 2))
    console.log(`\nBaseline ${firstRun ? 'created' : 'rebaselined'} -> ${path.relative(WORKSPACE, BASELINE_PATH)}`)
  }

  if (driftEntries.length) {
    sendTelegram(
      `🔧 <b>LP data-source DRIFT</b> (${TODAY})\n` +
      driftEntries.map(e => `• <b>${e.source}</b>: ${e.changes.join('; ')}`).join('\n') +
      `\n\nDoc + Drift log updated. Fix the spec in docs/integrations/lp-data-sources-api-reference.md.`
    )
    notifyDashboard('🔧', 'DRIFT', `${driftNames.join(',')} changed — see Drift log + report ${TODAY}`)
  } else if (downNames.length) {
    notifyDashboard('⏳', 'WAITING', `sources OK; transient down: ${downNames.join(',')}`)
  } else {
    const n = Object.keys(sources).length
    notifyDashboard('✅', 'DONE', firstRun ? `baseline created, ${n} sources live` : `all ${n} sources match the doc`)
  }

  console.log(`\nVERDICT: ${verdict}`)
  console.log(`Report: ${path.relative(WORKSPACE, REPORT_MD)}`)
}

main().catch(e => { console.error('FATAL:', e.message); sendTelegram(`💥 [LP-DATASOURCE-CHECK] Fatal: ${e.message}`); process.exit(1) })
