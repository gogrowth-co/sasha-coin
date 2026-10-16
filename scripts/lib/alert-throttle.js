/**
 * alert-throttle.js — shared Telegram alert cooldown/dedupe for cron monitors
 *
 * Problem this fixes: position-monitor.js, lp-rebalancer.js, and
 * byreal-oor-watch.js each re-sent a full Telegram alert on EVERY cron tick
 * (every 30 min) for as long as a condition stayed unresolved — e.g. a single
 * stuck OOR + confirm-gated-KILL position generated ~2-4 messages/hour,
 * indefinitely, until someone manually resolved it. See
 * docs/decision-log.md (2026-08-19) for the audit that found this.
 *
 * Fix: track a per-condition fingerprint + last-sent time in
 * state/alert-cooldowns.json. Re-send immediately if the condition's
 * fingerprint changes (new severity tier, new reason, resolved -> re-broken)
 * — that's real news. Otherwise only re-send after `cooldownMinutes` has
 * elapsed. This does NOT hide anything: it slows down repetition of the
 * exact same unresolved fact, while any escalation still alerts instantly.
 *
 * Usage:
 *   import { shouldAlert, recordAlert, clearAlert, normalizeReason } from './lib/alert-throttle.js'
 *
 *   const key = `lp-rebalancer:kill-pending:${position.id}`
 *   const fingerprint = normalizeReason(action.reason)
 *   if (shouldAlert(WORKSPACE, key, fingerprint)) {
 *       sendTelegram(msg)
 *       recordAlert(WORKSPACE, key, fingerprint)
 *   }
 */

import fs from 'fs'
import path from 'path'

const DEFAULT_COOLDOWN_MINUTES = Number(process.env.ALERT_COOLDOWN_MINUTES || 240) // 4h

function statePath(workspace) {
    return path.join(workspace, 'state', 'alert-cooldowns.json')
}

function loadState(workspace) {
    try {
        const p = statePath(workspace)
        return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {}
    } catch {
        return {}
    }
}

function saveState(workspace, state) {
    const p = statePath(workspace)
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, JSON.stringify(state, null, 2))
}

/**
 * true if this condition should actually be sent to Telegram right now.
 * - Never seen this key before -> true (first alert is always immediate).
 * - Fingerprint differs from last send -> true (real change: don't throttle news).
 * - Same fingerprint -> true only once `cooldownMinutes` has elapsed since last send.
 */
export function shouldAlert(workspace, key, fingerprint, cooldownMinutes = DEFAULT_COOLDOWN_MINUTES) {
    const prev = loadState(workspace)[key]
    if (!prev) return true
    if (prev.fingerprint !== fingerprint) return true
    const elapsedMin = (Date.now() - new Date(prev.lastSentAt).getTime()) / 60_000
    return elapsedMin >= cooldownMinutes
}

/** Call this AFTER actually sending the Telegram message, so the cooldown clock starts from a real send. */
export function recordAlert(workspace, key, fingerprint) {
    const state = loadState(workspace)
    state[key] = { fingerprint, lastSentAt: new Date().toISOString() }
    saveState(workspace, state)
}

/** Call when a condition fully resolves (back in range, position closed) so the next occurrence starts fresh. */
export function clearAlert(workspace, key) {
    const state = loadState(workspace)
    if (state[key]) {
        delete state[key]
        saveState(workspace, state)
    }
}

/**
 * Strip volatile numbers (minute counts, percentages, prices) out of a reason
 * string so the fingerprint is stable across cycles but still changes when
 * the underlying cause actually changes (e.g. OOR-low -> OOR-high, or
 * distance-kill -> sustained-kill).
 */
export function normalizeReason(reason) {
    return String(reason || '').replace(/[\d.]+/g, '#')
}
