#!/usr/bin/env bash
# Stop hook: once per session, nudge the LIVE agent to run /learn (it has the
# conversation; a headless /learn does not). Fail-open, loop-guarded.
INPUT=$(cat)
ACTIVE=$(printf '%s' "$INPUT" | /usr/bin/python3 -c 'import sys,json;print(json.load(sys.stdin).get("stop_hook_active",False))' 2>/dev/null || echo True)
[ "$ACTIVE" = "True" ] && exit 0
SID=$(printf '%s' "$INPUT" | /usr/bin/python3 -c 'import sys,json;print(json.load(sys.stdin).get("session_id",""))' 2>/dev/null || echo "")
[ -z "$SID" ] && SID="$RANDOM-$$"
MARK="/tmp/manga-learn-nudge-${SID}.done"
[ -f "$MARK" ] && exit 0
touch "$MARK"

# Write idle status to session registry (session is pausing/stopping)
if [ -n "$SID" ]; then
  /usr/bin/python3 - "$SID" "idle" <<'PY' 2>/dev/null
import sys, json, os
sid, status = sys.argv[1], sys.argv[2]
sf = os.path.expanduser("~/claude-fleet/sessions.json")
if not os.path.exists(sf): sys.exit(0)
try:
    import datetime
    d = json.load(open(sf, encoding="utf-8"))
    if sid in d.get("sessions", {}):
        d["sessions"][sid]["status"] = status
        d["sessions"][sid]["updated_at"] = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        tmp = sf + ".tmp." + str(os.getpid())
        with open(tmp, "w", encoding="utf-8") as f: json.dump(d, f, indent=2)
        os.rename(tmp, sf)
except Exception: pass
PY
fi

# 2026-07-05 (Gabriel): /learn is on-demand only — no automatic end-of-session nudge.
# Registry status write above is kept; the blocking nudge below is disabled.
exit 0
