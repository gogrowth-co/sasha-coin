#!/bin/bash
set -euo pipefail

ROOT="/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin"
LOG="$HOME/Library/Logs/sasha-replies.log"
LOCKDIR="/tmp/sasha-reply.lockdir"

# ── Resolve Node.js dynamically ───────────────────────────────────────────────
# Old pattern: NODE="/…/.nvm/versions/node/v23.11.0/bin/node"
# That breaks silently the moment nvm upgrades the default version.
# New pattern: walk nvm alias chain → newest installed → PATH fallback.
# Using a function avoids set -e misfires on intermediate commands.
resolve_node() {
  local nvm_dir="${NVM_DIR:-$HOME/.nvm}"

  # 1. Follow nvm 'default' alias (handles full versions, major shorthands, lts/* chains)
  if [ -s "$nvm_dir/alias/default" ]; then
    local ver
    ver=$(cat "$nvm_dir/alias/default" | tr -d '[:space:]')

    # Walk one level of alias indirection (e.g. 'lts/iron' → reads alias/lts/iron)
    if [ -s "$nvm_dir/alias/$ver" ]; then
      ver=$(cat "$nvm_dir/alias/$ver" | tr -d '[:space:]')
    fi

    # Exact directory match (e.g. "v23.11.0")
    if [ -f "$nvm_dir/versions/node/$ver/bin/node" ]; then
      echo "$nvm_dir/versions/node/$ver/bin/node"; return 0
    fi
    # 'v' prefix (e.g. "23.11.0" without leading v)
    if [ -f "$nvm_dir/versions/node/v$ver/bin/node" ]; then
      echo "$nvm_dir/versions/node/v$ver/bin/node"; return 0
    fi
    # Major-version shorthand (e.g. "23" → find highest v23.x.x installed)
    local matched
    matched=$(ls -1 "$nvm_dir/versions/node" 2>/dev/null \
      | grep -E "^v?${ver}\." | sort -rV | head -1)
    if [ -n "$matched" ] && [ -f "$nvm_dir/versions/node/$matched/bin/node" ]; then
      echo "$nvm_dir/versions/node/$matched/bin/node"; return 0
    fi
  fi

  # 2. Pick the newest installed Node version (sort -V = version-aware sort)
  if [ -d "$nvm_dir/versions/node" ]; then
    local newest
    newest=$(ls -1 "$nvm_dir/versions/node" 2>/dev/null | sort -rV | head -1)
    if [ -n "$newest" ] && [ -f "$nvm_dir/versions/node/$newest/bin/node" ]; then
      echo "$nvm_dir/versions/node/$newest/bin/node"; return 0
    fi
  fi

  # 3. Last resort: anything on PATH
  command -v node 2>/dev/null && return 0

  return 1
}

NODE=$(resolve_node || true)
if [ -z "$NODE" ] || [ ! -x "$NODE" ]; then
  echo "ERROR: Node.js not found (checked nvm alias/default, nvm versions, PATH)" >> "$LOG"
  exit 1
fi
echo "Node: $NODE ($("$NODE" --version 2>&1))" >> "$LOG"

echo "" >> "$LOG"
echo "=== $(date '+%Y-%m-%d %H:%M:%S') — slot fired ===" >> "$LOG"

# Kill switch — touch ~/.sasha-pause to stop all runs without terminal access
if [ -f "$HOME/.sasha-pause" ]; then
  echo "PAUSED (remove ~/.sasha-pause to resume)" >> "$LOG"
  exit 0
fi

# ── Atomic mutex via mkdir ────────────────────────────────────────────────────
# REPLACED: old check-then-write pattern (if [ -f $LOCK ] / echo $$ > $LOCK)
# was a TOCTOU race. After a Mac reboot, launchd fires multiple catch-up slots
# near-simultaneously. Both passed the file-existence check before either wrote
# the PID → both ran → both picked the same tweet → duplicate reply.
#
# mkdir(2) is atomic on macOS (POSIX guarantee). The directory either gets
# created or fails — no window where two processes both succeed.
# flock is Linux-only and not available on macOS. mkdir is the portable fix.
acquire_lock() {
  if mkdir "$LOCKDIR" 2>/dev/null; then
    echo $$ > "$LOCKDIR/pid"
    return 0
  fi
  # Lock dir exists — check if the holder process is still alive
  local held_pid
  held_pid=$(cat "$LOCKDIR/pid" 2>/dev/null || echo "")
  if [ -n "$held_pid" ] && kill -0 "$held_pid" 2>/dev/null; then
    echo "Already running (PID $held_pid) — skipping this slot" >> "$LOG"
    return 1
  fi
  # Stale lock (holder died without cleanup) — remove and re-acquire.
  # The final mkdir is still atomic, so if two processes race on a stale lock,
  # only one wins.
  rm -rf "$LOCKDIR"
  if mkdir "$LOCKDIR" 2>/dev/null; then
    echo $$ > "$LOCKDIR/pid"
    return 0
  fi
  # Another process won the stale-lock race — give up
  echo "Lock race lost — skipping this slot" >> "$LOG"
  return 1
}

if ! acquire_lock; then
  exit 0
fi
trap 'rm -rf "$LOCKDIR"' EXIT

# Human-like random delay: 0-20 minutes before posting
DELAY=$(( RANDOM % 1200 ))
echo "Waiting ${DELAY}s before run..." >> "$LOG"
sleep "$DELAY"

echo "=== $(date '+%Y-%m-%d %H:%M:%S') — starting run ===" >> "$LOG"

# Prevent Mac sleep mid-run (max 2h — longer than any realistic run)
# -i: prevent idle sleep explicitly (safer across macOS versions than bare caffeinate)
caffeinate -i -t 7200 &
CAFFEINATE_PID=$!
trap 'kill $CAFFEINATE_PID 2>/dev/null; rm -rf "$LOCKDIR"' EXIT

# Clean up debug screenshots from previous run
rm -f /tmp/sasha-step5-attempt*.png /tmp/sasha-pre-post.png

cd "$ROOT"

# ── Scrape-once-per-day check ─────────────────────────────────────────────────
# Use Node (same runtime as the pipeline) to parse the feed date.
# DO NOT use jq or python3: both fail silently under launchd's stripped env
# (jq returns empty string when PATH doesn't include Homebrew; python3 hits
# macOS TCC PermissionError on sys.path scan under ~/Documents). The result was
# FEED_DATE always empty → 7 full Apify scrapes/day instead of 1.
FEED="$ROOT/content/kol-feed.json"
TODAY_UTC=$(date -u +%Y-%m-%d)

SKIP_FLAG=""
if "$NODE" --input-type=module -e "
  import { readFileSync, existsSync } from 'node:fs';
  const feed = '$FEED';
  if (!existsSync(feed)) process.exit(1);
  try {
    const d = JSON.parse(readFileSync(feed, 'utf8')).generatedAt || '';
    process.exit(d.startsWith('$TODAY_UTC') ? 0 : 1);
  } catch { process.exit(1); }
" 2>/dev/null; then
  SKIP_FLAG="--skip-scrape"
  echo "Feed already scraped today ($TODAY_UTC UTC) — using --skip-scrape" >> "$LOG"
else
  echo "Feed not from today — scraping fresh" >> "$LOG"
fi

"$NODE" scripts/morning-reply-run.js $SKIP_FLAG >> "$LOG" 2>&1

echo "--- done $(date '+%H:%M:%S') ---" >> "$LOG"
