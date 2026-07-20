#!/usr/bin/env bash
# SubagentStop: nudge a subagent to persist memory before returning. Fail-open, loop-guarded.
INPUT=$(cat)
ACTIVE=$(printf '%s' "$INPUT" | /usr/bin/python3 -c 'import sys,json;print(json.load(sys.stdin).get("stop_hook_active",False))' 2>/dev/null || echo True)
[ "$ACTIVE" = "True" ] && exit 0
SID=$(printf '%s' "$INPUT" | /usr/bin/python3 -c 'import sys,json;print(json.load(sys.stdin).get("session_id",""))' 2>/dev/null || echo "")
[ -z "$SID" ] && SID="$RANDOM-$$"          # fail OPEN (unique), never a shared constant
MARK="/tmp/manga-subagent-mem-${SID}-$$.done"   # per-invocation, not per-session
[ -f "$MARK" ] && exit 0
touch "$MARK"
cat <<'JSON'
{"decision":"block","reason":"Before returning: per #57507 you do not auto-save memory. If anything this run was memory-worthy, Write the topic file to your .claude/agent-memory/<agent>/ folder and append a line to that folder's MEMORY.md now. If nothing passed the /learn filter, reply 'No new agent memory this run' and stop."}
JSON
exit 0
