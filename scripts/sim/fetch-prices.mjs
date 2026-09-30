#!/usr/bin/env node
/**
 * fetch-prices.mjs — pull daily OHLC candles for the sim from Binance public data.
 *
 * Daily candles carry intraday high/low, which the backtest needs to detect
 * leverage-leg liquidation wicks (a 10x short dies on a +9% intraday spike even if
 * the daily close is calm — that was the Aug-19 failure mode).
 *
 * Output: reports/sim/data/<SYM>-1d.json  = { symbol, source, fetchedAt, candles: [
 *   { t: unixMs, o, h, l, c }  ... ] }
 *
 * Usage:
 *   node scripts/sim/fetch-prices.mjs                 # ETH + SOL, ~5y
 *   node scripts/sim/fetch-prices.mjs --years 3 --symbols ETHUSDT,BTCUSDT
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(__dirname, '../../reports/sim/data')
const args = process.argv.slice(2)
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d }

const YEARS = parseFloat(val('--years', '5'))
const SYMBOLS = val('--symbols', 'ETHUSDT,SOLUSDT').split(',')
const BASE = 'https://data-api.binance.vision/api/v3/klines'

async function fetchSymbol(symbol) {
  const now = Date.now()
  const start = now - Math.round(YEARS * 365 * 864e5)
  const candles = []
  let cursor = start
  while (cursor < now) {
    const url = `${BASE}?symbol=${symbol}&interval=1d&startTime=${cursor}&limit=1000`
    const r = await fetch(url, { headers: { accept: 'application/json' } })
    if (!r.ok) throw new Error(`${symbol}: HTTP ${r.status}`)
    const rows = await r.json()
    if (!rows.length) break
    for (const k of rows) {
      candles.push({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4] })
    }
    const last = rows[rows.length - 1][0]
    if (last <= cursor) break
    cursor = last + 864e5
    await new Promise(res => setTimeout(res, 250))
  }
  // dedupe + sort
  const seen = new Set()
  const clean = candles.filter(c => (seen.has(c.t) ? false : seen.add(c.t))).sort((a, b) => a.t - b.t)
  return clean
}

fs.mkdirSync(OUT, { recursive: true })
for (const symbol of SYMBOLS) {
  process.stdout.write(`fetching ${symbol} ... `)
  const candles = await fetchSymbol(symbol)
  const sym = symbol.replace('USDT', '')
  const file = path.join(OUT, `${sym}-1d.json`)
  fs.writeFileSync(file, JSON.stringify({
    symbol: sym, source: 'binance.vision klines 1d', fetchedAt: new Date().toISOString(),
    from: new Date(candles[0].t).toISOString().slice(0, 10),
    to: new Date(candles[candles.length - 1].t).toISOString().slice(0, 10),
    count: candles.length, candles,
  }, null, 0))
  console.log(`${candles.length} days  ${new Date(candles[0].t).toISOString().slice(0, 10)} → ${new Date(candles[candles.length - 1].t).toISOString().slice(0, 10)}  →  ${path.relative(process.cwd(), file)}`)
}
