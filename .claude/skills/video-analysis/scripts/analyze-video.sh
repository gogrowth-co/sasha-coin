#!/usr/bin/env bash
# Video analysis via Gemini on Vertex AI Express.
# Watches the actual video (frames + audio), not just the transcript.
#
# Usage:
#   bash analyze-video.sh "<youtube-url-or-local-file>" ["<custom prompt>"]
#
# Key: GOOGLE_AGENT_PLATFORM_API_KEY (Vertex AI Express). The AI Studio
# GEMINI_API_KEY is NOT used here — its prepay credits are depleted (429).
#
# Secret hygiene: the key is read into a shell variable and only ever passed
# to curl as a header. It is never echoed. Running through this script (rather
# than an inline curl in the SKILL.md) is what keeps it past the secret-guard hook.
set -euo pipefail

VIDEO="${1:?Usage: analyze-video.sh <url-or-file> [prompt]}"
CUSTOM_PROMPT="${2:-}"

# Find a .env up the tree (works from any project workspace)
find_env() {
  local d="$PWD"
  while [ "$d" != "/" ]; do
    [ -f "$d/.env" ] && { echo "$d/.env"; return 0; }
    d="$(dirname "$d")"
  done
  return 1
}
ENV_FILE="$(find_env || true)"
[ -z "${ENV_FILE:-}" ] && { echo "ERROR: no .env found from $PWD upward"; exit 1; }

APIKEY="$(grep -E '^GOOGLE_AGENT_PLATFORM_API_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r\"')"
[ -z "$APIKEY" ] && { echo "ERROR: GOOGLE_AGENT_PLATFORM_API_KEY not in $ENV_FILE"; exit 1; }

MODEL="${VIDEO_ANALYSIS_MODEL:-gemini-2.5-flash}"
ENDPOINT="https://aiplatform.googleapis.com/v1/publishers/google/models/${MODEL}:generateContent"

if [ -n "$CUSTOM_PROMPT" ]; then
  PROMPT="$CUSTOM_PROMPT"
else
  read -r -d '' PROMPT <<'EOF' || true
You are watching this video. Give me a SCENE-BY-SCENE VISUAL breakdown — describe what is actually on screen (people, setting, on-screen text, graphics, b-roll, cuts, demos), not just what is said. Provide:
1. A 2-3 sentence summary of the topic and main argument.
2. A scene-by-scene breakdown as a markdown table with columns: Timestamp | What's on screen (visual) | What's being said/happening. Cover the whole video, one row per distinct scene or visual shift.
3. Key moments — 5-10 specific timestamps worth clipping, each with why it's notable visually or verbally.
4. Overall visual style notes (production quality, format, pacing, graphics style).
EOF
fi

REQ="$(mktemp)"
trap 'rm -f "$REQ"' EXIT

is_remote=0
case "$VIDEO" in
  http://*|https://*) is_remote=1 ;;
esac

if [ "$is_remote" -eq 1 ]; then
  # YouTube and other public URLs: Vertex ingests the URL directly (no download).
  jq -n --arg p "$PROMPT" --arg u "$VIDEO" \
    '{contents:[{role:"user",parts:[{text:$p},{fileData:{mimeType:"video/*",fileUri:$u}}]}]}' > "$REQ"
else
  # Local file: Vertex (API-key/Express) cannot use the generativelanguage File
  # API, so we inline the bytes as base64. Keep clips small (~<20MB request cap).
  [ -f "$VIDEO" ] || { echo "ERROR: file not found: $VIDEO"; exit 1; }
  case "$VIDEO" in
    *.mp4)  MIME="video/mp4" ;;
    *.mov)  MIME="video/quicktime" ;;
    *.webm) MIME="video/webm" ;;
    *.avi)  MIME="video/x-msvideo" ;;
    *.mkv)  MIME="video/x-matroska" ;;
    *)      MIME="video/mp4" ;;
  esac
  B64="$(base64 < "$VIDEO" | tr -d '\n')"
  jq -n --arg p "$PROMPT" --arg m "$MIME" --arg d "$B64" \
    '{contents:[{role:"user",parts:[{text:$p},{inlineData:{mimeType:$m,data:$d}}]}]}' > "$REQ"
fi

RESP="$(curl -s -X POST "$ENDPOINT" \
  -H "x-goog-api-key: ${APIKEY}" \
  -H "Content-Type: application/json" \
  --data-binary @"$REQ")"

if echo "$RESP" | jq -e '.candidates[0].content.parts[0].text' >/dev/null 2>&1; then
  echo "$RESP" | jq -r '.candidates[0].content.parts[0].text'
  echo ""
  echo "=== USAGE (proof of video ingestion) ==="
  echo "$RESP" | jq -c '.usageMetadata.promptTokensDetails'
else
  echo "=== NO TEXT RETURNED — diagnostic ==="
  echo "$RESP" | jq '{error:.error, finishReason:.candidates[0].finishReason, safety:.candidates[0].safetyRatings}' 2>/dev/null || echo "$RESP" | head -c 2000
  exit 1
fi
