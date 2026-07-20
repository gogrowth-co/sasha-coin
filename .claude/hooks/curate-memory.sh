#!/usr/bin/env bash
# SessionEnd: deterministic WARM curation. No Claude call, no conversation needed.
# Also writes status: "ended" to session registry.

# Read session_id from hook input (fail-open)
_HOOK_INPUT=$(cat)
_SID=$(printf '%s' "$_HOOK_INPUT" | /usr/bin/python3 -c 'import sys,json;print(json.load(sys.stdin).get("session_id",""))' 2>/dev/null || echo "")

# Write ended status to session registry
if [ -n "$_SID" ]; then
  /usr/bin/python3 - "$_SID" "ended" <<'PY' 2>/dev/null
import sys, json, os, datetime
sid, status = sys.argv[1], sys.argv[2]
sf = os.path.expanduser("~/claude-fleet/sessions.json")
if not os.path.exists(sf): sys.exit(0)
try:
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

set -euo pipefail
MEM="/Users/gabrielmangabeira/.claude/projects/-Users-gabrielmangabeira-Documents-Gabriel-Mangabeira-sasha-coin/memory/MEMORY.md"
ARCH="$(dirname "$MEM")/MEMORY-archive.md"
LOG="/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin/_ops/learn-hook.log"
LIMIT=18432
[ -f "$MEM" ] || exit 0
BEFORE=$(wc -c < "$MEM")
if [ "$BEFORE" -le "$LIMIT" ]; then
  echo "[$(date '+%F %T')] curate: ${BEFORE}B <= ${LIMIT}B, no-op" >> "$LOG"; exit 0
fi
/usr/bin/python3 - "$MEM" "$ARCH" "$LIMIT" >> "$LOG" 2>&1 <<'PY'
import sys, datetime
mem, arch, limit = sys.argv[1], sys.argv[2], int(sys.argv[3])
lines = open(mem, encoding='utf-8').read().split('\n')
def size(ls): return len(('\n'.join(ls)).encode('utf-8'))
protected = False
demotable = []
for i, l in enumerate(lines):
    if '<!-- PROTECTED' in l: protected = True; continue
    if '<!-- END PROTECTED' in l: protected = False; continue
    if protected: continue
    if l.startswith('- ['): demotable.append(i)   # list pointers only
remove, demoted = set(), []
for i in demotable:                                 # oldest-first (top of list region)
    if size([l for j, l in enumerate(lines) if j not in remove]) <= limit: break
    remove.add(i); demoted.append(lines[i])
if demoted:
    with open(arch, 'a', encoding='utf-8') as a:
        d = datetime.date.today().isoformat()
        for l in demoted: a.write(f"- {d} archived | auto-demoted | {l.strip()}\n")
    kept = [l for j, l in enumerate(lines) if j not in remove]
    open(mem, 'w', encoding='utf-8').write('\n'.join(kept))
    print(f"curate: demoted {len(demoted)} lines, now {size(kept)}B")
else:
    print("curate: over budget but nothing demotable (check PROTECTED block size)")
PY
AFTER=$(wc -c < "$MEM")
echo "[$(date '+%F %T')] curate: ${BEFORE}B -> ${AFTER}B" >> "$LOG"
exit 0
