#!/bin/bash
# backup-sasha-state.sh
#
# Daily backup of Sasha's reply dedup state.
# Runs at 08:55 via launchd — 5 minutes before the first reply slot.
#
# Why:
#   state/replied-tweets.json is the crown jewel of the reply system.
#   Losing it (accidental rm -rf, disk issue) causes mass duplicate replies
#   on the next run because every previously-replied tweet looks fresh.
#   Without backups, recovery means manually reconstructing from posted-log.json.
#
# What it backs up:
#   - state/replied-tweets.json  (tweet dedup set — most critical)
#   - state/posted-log.json      (full reply history — for audit/recovery)
#
# Retention: 30 days rolling. Backups older than 30 days are pruned.
# Location: ~/.sasha-state-backup/ (local only — not in the project repo)

set -euo pipefail

ROOT="/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin"
BACKUP_DIR="$HOME/.sasha-state-backup"
LOG="$HOME/Library/Logs/sasha-state-backup.log"
DATE=$(date +%Y%m%d)
RETAIN_DAYS=30

echo "" >> "$LOG"
echo "=== $(date '+%Y-%m-%d %H:%M:%S') — backup ===" >> "$LOG"

mkdir -p "$BACKUP_DIR"

backed_up=0

# Back up replied-tweets.json (dedup set)
if [ -f "$ROOT/state/replied-tweets.json" ]; then
  cp "$ROOT/state/replied-tweets.json" "$BACKUP_DIR/replied-tweets-${DATE}.json"
  echo "  ✅ replied-tweets.json → replied-tweets-${DATE}.json" >> "$LOG"
  backed_up=$((backed_up + 1))
else
  echo "  ⚠  replied-tweets.json not found — skipped" >> "$LOG"
fi

# Back up posted-log.json (full reply history)
if [ -f "$ROOT/state/posted-log.json" ]; then
  cp "$ROOT/state/posted-log.json" "$BACKUP_DIR/posted-log-${DATE}.json"
  echo "  ✅ posted-log.json     → posted-log-${DATE}.json" >> "$LOG"
  backed_up=$((backed_up + 1))
else
  echo "  ⚠  posted-log.json not found — skipped" >> "$LOG"
fi

# Prune files older than RETAIN_DAYS days
pruned=$(find "$BACKUP_DIR" -name "*.json" -mtime +${RETAIN_DAYS} -print 2>/dev/null | wc -l | tr -d ' ')
if [ "$pruned" -gt 0 ]; then
  find "$BACKUP_DIR" -name "*.json" -mtime +${RETAIN_DAYS} -delete
  echo "  🗑  Pruned ${pruned} file(s) older than ${RETAIN_DAYS} days" >> "$LOG"
fi

total=$(find "$BACKUP_DIR" -name "*.json" 2>/dev/null | wc -l | tr -d ' ')
echo "  Backed up: ${backed_up} file(s). Total in archive: ${total}" >> "$LOG"
echo "--- done ---" >> "$LOG"
