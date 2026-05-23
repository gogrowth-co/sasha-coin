#!/bin/bash
# run-sasha-replies.sh — wrapper for the reply pipeline
#
# Called by launchd at 6 approximate slots across the day.
# Each run: fresh Apify scrape + Sasha picks tweet + reply via ADB.
# Random delay (0-20 min) added so timing is never identical day to day.
#
# Logs to: /tmp/sasha-replies.log

set -euo pipefail

ROOT="/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin"
LOG="/tmp/sasha-replies.log"
NODE="/Users/gabrielmangabeira/.nvm/versions/node/v23.11.0/bin/node"

echo "" >> "$LOG"
echo "=== $(date '+%Y-%m-%d %H:%M:%S') — slot fired ===" >> "$LOG"

# Human-like random delay: 0-20 minutes before posting
DELAY=$(( RANDOM % 1200 ))
echo "Waiting ${DELAY}s before run..." >> "$LOG"
sleep "$DELAY"

echo "=== $(date '+%Y-%m-%d %H:%M:%S') — starting run ===" >> "$LOG"

cd "$ROOT"
"$NODE" scripts/morning-reply-run.js >> "$LOG" 2>&1

echo "--- done $(date '+%H:%M:%S') ---" >> "$LOG"
