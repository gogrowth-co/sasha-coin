#!/bin/bash
# Event-driven dashboard refresh — call at the END of any capital-moving script (LP open/close,
# swap, hedge open/close, kill/re-entry) so a STRUCTURAL change reflects on pages.dev immediately,
# instead of waiting for the next 15-min sasha-dashboard cron tick.
#
# Pipeline mirrors the sasha-dashboard cron's LP-relevant steps:
#   build-dashboard-data.js  (public-safe ALLOWLIST export)
#   lp-reconcile.js          (live Base + HL marked-to-market)
#   /root/deploy-dashboards.sh  (wrangler pages deploy — host-only, scoped Pages token)
#
# Host-aware: if /root/deploy-dashboards.sh is absent (e.g. a local run), it builds+reconciles
# but skips the deploy. Every step is non-fatal — a refresh failure must NEVER fail the capital
# move that already succeeded.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 0
ts() { date -u +%H:%M:%S; }
echo "[refresh-dashboard] $(ts) build-dashboard-data..."
node scripts/build-dashboard-data.js || echo "[refresh-dashboard] build-data failed (non-fatal)"
echo "[refresh-dashboard] $(ts) lp-reconcile..."
node scripts/lp-reconcile.js || echo "[refresh-dashboard] lp-reconcile failed (non-fatal)"
if [ -f /root/deploy-dashboards.sh ]; then
  echo "[refresh-dashboard] $(ts) deploy to Cloudflare Pages..."
  bash /root/deploy-dashboards.sh || echo "[refresh-dashboard] deploy failed (non-fatal)"
else
  echo "[refresh-dashboard] /root/deploy-dashboards.sh not found (local run?) — skipped deploy"
fi
echo "[refresh-dashboard] $(ts) done."
exit 0
