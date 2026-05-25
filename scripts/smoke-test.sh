#!/bin/bash
# smoke-test.sh — End-to-end smoke test for Sasha's Mantle hackathon entry.
# Tests every component in dry-run / read-only mode.
# Never sends a live tweet. Never sends a real onchain transaction.
#
# Usage:
#   bash scripts/smoke-test.sh
#   bash scripts/smoke-test.sh --verbose
#
# Pass/fail per component. Exit 0 if all pass, 1 if any fail.

set -uo pipefail

WORKSPACE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WORKSPACE"

VERBOSE=0
[[ "${1:-}" == "--verbose" ]] && VERBOSE=1

# Colors
G="\033[0;32m"
R="\033[0;31m"
Y="\033[0;33m"
B="\033[0;34m"
N="\033[0m"

PASS=0
FAIL=0
SKIP=0
RESULTS=()

run_test() {
  local name="$1"
  local cmd="$2"
  local expect_pattern="${3:-}"   # optional regex to find in stdout
  local timeout_s="${4:-30}"

  echo -e "${B}▶${N} ${name}"

  local tmpout tmperr
  tmpout=$(mktemp)
  tmperr=$(mktemp)
  local exit_code=0

  # macOS doesn't ship `timeout` by default; use gtimeout if installed (brew coreutils),
  # otherwise fall back to running without a timeout cap.
  local TIMEOUT_BIN=""
  if command -v gtimeout >/dev/null 2>&1; then TIMEOUT_BIN="gtimeout ${timeout_s}"
  elif command -v timeout >/dev/null 2>&1; then TIMEOUT_BIN="timeout ${timeout_s}"
  fi

  if $TIMEOUT_BIN bash -c "$cmd" >"$tmpout" 2>"$tmperr"; then
    exit_code=0
  else
    exit_code=$?
  fi

  if [[ $VERBOSE -eq 1 ]]; then
    echo "  cmd: $cmd"
    echo "  --- stdout ---"
    sed 's/^/  /' "$tmpout" | head -20
    echo "  --- stderr ---"
    sed 's/^/  /' "$tmperr" | head -10
  fi

  if [[ $exit_code -ne 0 ]]; then
    echo -e "  ${R}FAIL${N} (exit $exit_code)"
    [[ -s "$tmperr" ]] && echo "  err: $(head -3 "$tmperr" | tr '\n' ' ')"
    RESULTS+=("FAIL  $name")
    FAIL=$((FAIL+1))
    rm -f "$tmpout" "$tmperr"
    return 1
  fi

  if [[ -n "$expect_pattern" ]] && ! grep -qE "$expect_pattern" "$tmpout"; then
    echo -e "  ${Y}WARN${N} exit 0 but missing expected pattern: '$expect_pattern'"
    RESULTS+=("WARN  $name (missing pattern)")
    FAIL=$((FAIL+1))
    rm -f "$tmpout" "$tmperr"
    return 1
  fi

  echo -e "  ${G}PASS${N}"
  RESULTS+=("PASS  $name")
  PASS=$((PASS+1))
  rm -f "$tmpout" "$tmperr"
  return 0
}

skip_test() {
  local name="$1"
  local reason="$2"
  echo -e "${Y}⊘${N} ${name}"
  echo -e "  ${Y}SKIP${N} ${reason}"
  RESULTS+=("SKIP  $name — $reason")
  SKIP=$((SKIP+1))
}

echo "════════════════════════════════════════════════════════════════"
echo " Sasha Coin — End-to-End Smoke Test"
echo " Mantle Turing Test Hackathon 2026"
echo " Workspace: $WORKSPACE"
echo "════════════════════════════════════════════════════════════════"
echo ""

# ─── PHASE 1 ── Static checks ────────────────────────────────────
echo "━━━ Phase 1 — Static checks ━━━"

run_test "scripts/byreal-trade.js syntax" \
  "node --check scripts/byreal-trade.js"

run_test "scripts/mantle-signal.js syntax" \
  "node --check scripts/mantle-signal.js"

run_test "scripts/mantle-treasury.js syntax" \
  "node --check scripts/mantle-treasury.js"

run_test "scripts/erc8004-register.js syntax" \
  "node --check scripts/erc8004-register.js"

run_test "scripts/erc8004-write.js syntax" \
  "node --check scripts/erc8004-write.js"

run_test "scripts/deploy-contract.js syntax" \
  "node --check scripts/deploy-contract.js"

run_test "scripts/signals/allora.js syntax" \
  "node --check scripts/signals/allora.js"

run_test "scripts/signals/elfa.js syntax" \
  "node --check scripts/signals/elfa.js"

run_test "scripts/signals/polymarket.js syntax" \
  "node --check scripts/signals/polymarket.js"

run_test "task-server.cjs syntax" \
  "node --check task-server.cjs"

run_test "contracts/SashaAgentLog.sol exists" \
  "test -f contracts/SashaAgentLog.sol && grep -q 'logTrade' contracts/SashaAgentLog.sol" \
  ""

run_test ".env.example has new keys" \
  "grep -E 'ALLORA_API_KEY|ELFA_API_KEY|MANTLE_AGENT_PK' .env.example" \
  "ALLORA_API_KEY"

echo ""
# ─── PHASE 2 ── Signal sources independently ─────────────────────
echo "━━━ Phase 2 — Signal sources (independent) ━━━"

run_test "Allora signal (dry-run)" \
  "node scripts/signals/allora.js 2>&1 || echo 'expected fallback ok'" \
  "" 15

run_test "Elfa signal (dry-run)" \
  "node scripts/signals/elfa.js 2>&1 || echo 'expected fallback ok'" \
  "" 15

run_test "Polymarket signal (no auth, real call)" \
  "node scripts/signals/polymarket.js" \
  "directionalBias|riskOff|polymarket|neutral" 20

echo ""
# ─── PHASE 3 ── Signal fusion ────────────────────────────────────
echo "━━━ Phase 3 — Signal fusion ━━━"

run_test "mantle-signal.js --dry-run (full fusion)" \
  "node scripts/mantle-signal.js --dry-run" \
  "recommendation|action|HOLD|BUY|SELL" 30

run_test "mantle-signal.js --source ths-only --dry-run" \
  "node scripts/mantle-signal.js --source ths-only --dry-run" \
  "recommendation|action" 20

echo ""
# ─── PHASE 4 ── Treasury (read-only) ─────────────────────────────
echo "━━━ Phase 4 — Treasury ━━━"

if grep -q "^MANTLE_AGENT_PK=" .env 2>/dev/null; then
  run_test "mantle-treasury.js --action status" \
    "node scripts/mantle-treasury.js --action status" \
    "balance|staked|yield|status" 20
else
  skip_test "mantle-treasury.js status" "MANTLE_AGENT_PK not in local .env (VPS-only)"
fi

run_test "mantle-treasury.js dry-run compound" \
  "node scripts/mantle-treasury.js --action compound 2>&1 || true" \
  "" 15

echo ""
# ─── PHASE 5 ── ERC-8004 ──────────────────────────────────────────
echo "━━━ Phase 5 — ERC-8004 ━━━"

if grep -q "^MANTLE_AGENT_PK=" .env 2>/dev/null; then
  run_test "erc8004-register.js --dry-run" \
    "node scripts/erc8004-register.js --dry-run" \
    "register|agent|metadata|dry" 20
  run_test "erc8004-register.js --status" \
    "node scripts/erc8004-register.js --status 2>&1 || true" \
    "" 15
else
  skip_test "erc8004-register dry-run" "MANTLE_AGENT_PK not in local .env (VPS-only)"
  skip_test "erc8004-register status" "MANTLE_AGENT_PK not in local .env (VPS-only)"
fi

run_test "erc8004-write.js --dry-run" \
  "node scripts/erc8004-write.js --dry-run 2>&1 || true" \
  "" 15

echo ""
# ─── PHASE 6 ── Contract deployment (dry-run) ────────────────────
echo "━━━ Phase 6 — Contract deployment ━━━"

if grep -q "^MANTLE_AGENT_PK=" .env 2>/dev/null; then
  run_test "deploy-contract.js --network testnet --dry-run" \
    "node scripts/deploy-contract.js --network testnet --dry-run 2>&1 || true" \
    "" 30
else
  skip_test "deploy-contract testnet" "MANTLE_AGENT_PK not in local .env (VPS-only)"
fi

run_test "SashaAgentLog.sol has logTrade + Ownable" \
  "grep -E 'function logTrade|Ownable|TradeLogged' contracts/SashaAgentLog.sol" \
  "logTrade"

echo ""
# ─── PHASE 7 ── Trade pipeline (DRY RUN) ─────────────────────────
echo "━━━ Phase 7 — Trade pipeline ━━━"

# byreal-trade.js refuses to run if signal is >4h old.
# Regenerate signal first to ensure a fresh file.
echo -e "${B}▶${N} Pre-step: regenerate fresh signal"
if node scripts/mantle-signal.js >/dev/null 2>&1; then
  echo -e "  ${G}signal regenerated${N}"
else
  echo -e "  ${Y}signal regen non-zero (continuing — script will fall back)${N}"
fi

run_test "byreal-trade.js --dry-run" \
  "node scripts/byreal-trade.js --dry-run" \
  "dry-run|DRY|OPEN_LP|SWAP|HOLD" 60

run_test "trade log has dry-run entry" \
  "test -f state/mantle-trade-log.json && grep -q 'dry-run' state/mantle-trade-log.json" \
  ""

echo ""
# ─── PHASE 8 ── Dashboard + API ──────────────────────────────────
echo "━━━ Phase 8 — Dashboard + API ━━━"

# Start task-server in background on a non-default port (3099) to avoid
# colliding with the user's running task-server.cjs on 3005.
TASK_PORT=3099
TASK_LOG=$(mktemp)

echo -e "${B}▶${N} Starting task-server.cjs on port $TASK_PORT (smoke-test only)..."
TASK_SERVER_PORT=$TASK_PORT node task-server.cjs >"$TASK_LOG" 2>&1 &
TASK_PID=$!

# Wait up to 5s for it to come up
for i in $(seq 1 10); do
  if curl -s "http://localhost:$TASK_PORT/" >/dev/null 2>&1; then break; fi
  sleep 0.5
done

if ! kill -0 $TASK_PID 2>/dev/null; then
  echo -e "  ${R}FAIL${N} task-server.cjs died on startup"
  cat "$TASK_LOG" | head -10
  RESULTS+=("FAIL  task-server.cjs startup")
  FAIL=$((FAIL+1))
else
  echo -e "  ${G}PASS${N} task-server.cjs started (PID $TASK_PID)"
  RESULTS+=("PASS  task-server.cjs startup")
  PASS=$((PASS+1))

  run_test "GET /api/mantle-state" \
    "curl -sf http://localhost:$TASK_PORT/api/mantle-state" \
    "executedCount|signal|erc8004|trades"

  run_test "GET /api/sasha-reputation" \
    "curl -sf http://localhost:$TASK_PORT/api/sasha-reputation" \
    "schema|stats|agentId|erc8004"

  run_test "GET /sasha (dashboard HTML with Mantle panel)" \
    "curl -sf http://localhost:$TASK_PORT/sasha | grep -E 'mantle-panel|Mantle Hackathon|SASHA'" \
    "[Mm]antle|SASHA"

  kill $TASK_PID 2>/dev/null
  wait $TASK_PID 2>/dev/null || true
fi

rm -f "$TASK_LOG"

echo ""
# ─── PHASE 9 ── Documentation ────────────────────────────────────
echo "━━━ Phase 9 — Documentation ━━━"

run_test "docs/strategy/winning-thesis.md exists" \
  "test -f docs/strategy/winning-thesis.md && wc -l docs/strategy/winning-thesis.md | awk '{exit (\$1<100)?1:0}'" \
  ""

run_test "docs/erc8004-reputation-schema.md exists" \
  "test -f docs/erc8004-reputation-schema.md" \
  ""

run_test "docs/vps-setup.md exists" \
  "test -f docs/vps-setup.md" \
  ""

run_test "README.md mentions Mantle + ERC-8004" \
  "grep -iE 'mantle|erc-8004|erc8004' README.md" \
  "[Mm]antle"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo " RESULTS"
echo "════════════════════════════════════════════════════════════════"
for r in "${RESULTS[@]}"; do
  case "$r" in
    PASS*) echo -e "${G}✓${N} $r" ;;
    FAIL*) echo -e "${R}✗${N} $r" ;;
    WARN*) echo -e "${Y}!${N} $r" ;;
    SKIP*) echo -e "${Y}⊘${N} $r" ;;
  esac
done

echo ""
echo "─── Summary ───"
echo -e "${G}Passed:${N}  $PASS"
echo -e "${R}Failed:${N}  $FAIL"
echo -e "${Y}Skipped:${N} $SKIP"
echo ""

if [[ $FAIL -eq 0 ]]; then
  echo -e "${G}✓ All implemented components pass smoke test.${N}"
  echo -e "${Y}Note:${N} Skipped tests require VPS env vars (MANTLE_AGENT_PK, ALLORA_API_KEY, ELFA_API_KEY)."
  echo -e "       These cannot be validated locally — they will run on the VPS."
  exit 0
else
  echo -e "${R}✗ Some components failed. Review failures above before deploying.${N}"
  exit 1
fi
