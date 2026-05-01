#!/bin/bash
# Deploy local Sasha workspace to VPS openclaw-h3mk runtime.
# Default: dry-run. Pass --execute to actually sync.
#
# One-writer rule: this script only runs LOCAL → VPS. The VPS never writes
# back. Anything created on the VPS (state/, memory/, sessions/, browser/)
# is excluded from the rsync delete behavior so it survives.

set -euo pipefail

VPS_HOST="root@187.77.42.134"
VPS_KEY="$HOME/.ssh/hostinger_vps"
VPS_DEST="/docker/openclaw-h3mk/data/.openclaw/workspace/"
LOCAL_SRC="$(cd "$(dirname "$0")" && pwd)/"

EXECUTE=0
if [[ "${1:-}" == "--execute" ]]; then
  EXECUTE=1
fi

if [[ ! -f "$VPS_KEY" ]]; then
  echo "ERROR: SSH key not found at $VPS_KEY"
  exit 1
fi

if [[ ! -f "$LOCAL_SRC/.deployignore" ]]; then
  echo "ERROR: .deployignore not found at $LOCAL_SRC/.deployignore"
  exit 1
fi

# Sanity: refuse to deploy from a dirty git tree
if [[ -n "$(git -C "$LOCAL_SRC" status --porcelain 2>/dev/null)" ]]; then
  echo "WARNING: working tree has uncommitted changes."
  if [[ $EXECUTE -eq 1 ]]; then
    echo "Refusing to deploy uncommitted changes. Commit or stash first."
    exit 1
  fi
fi

DRYRUN_FLAG=""
if [[ $EXECUTE -eq 0 ]]; then
  DRYRUN_FLAG="--dry-run"
  echo "=== DRY RUN — pass --execute to apply changes ==="
fi

# Files we explicitly never delete on the VPS (state, runtime artifacts created by Sasha)
PROTECTED_PATTERNS=(
  "state/***"
  "memory/***"
  "agents/***"
  "browser/***"
  "credentials/***"
  "sessions/***"
  "tmp/***"
  "Clawlett/config/***"
  "Clawlett/clawlett/scripts/config/***"
  "node_modules/***"
  "venv_buffer/***"
  ".clawhub/***"
  ".openclaw/***"
)

PROTECT_ARGS=()
for p in "${PROTECTED_PATTERNS[@]}"; do
  PROTECT_ARGS+=(--filter="protect ${p}")
done

echo "Source: $LOCAL_SRC"
echo "Dest:   $VPS_HOST:$VPS_DEST"
echo ""

rsync -av \
  $DRYRUN_FLAG \
  --delete \
  --exclude-from="$LOCAL_SRC/.deployignore" \
  "${PROTECT_ARGS[@]}" \
  -e "ssh -i $VPS_KEY -o StrictHostKeyChecking=no" \
  "$LOCAL_SRC" "$VPS_HOST:$VPS_DEST"

if [[ $EXECUTE -eq 1 ]]; then
  echo ""
  echo "=== Deploy complete ==="
  echo "Restart container if config or skills changed:"
  echo "  ssh -i $VPS_KEY $VPS_HOST 'cd /docker/openclaw-h3mk && docker-compose restart'"
else
  echo ""
  echo "=== Dry run complete. Re-run with --execute to apply. ==="
fi