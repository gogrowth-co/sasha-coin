#!/usr/bin/env python3
"""PreToolUse(Bash) guard: deny commands that would print a secret value to stdout.

Hard security checkpoint. Catches the common exfiltration patterns:
  1. Whole-file dump of a real .env (cat/head/tail/less/more), excluding .env.example/.sample/.template/.dist
  2. Reading values OUT of .env (grep/rg on .env piped to cut/awk/sed)
  3. echo/printf expanding a secret-named variable ($X_API_KEY, $X_TOKEN, $X_SECRET, etc.)

It deliberately ALLOWS the safe idioms: presence/length checks like `[ -n "$VAR" ]`,
`echo "len ${#VAR}"` (the ${#...} length form), and name-only listing
(`grep -oE '^[A-Z_]+=' .env`). Conservative: prefers a false block over a leak.

Added 2026-06-03 after an OPENAI_API_KEY was printed to a transcript by a sloppy shell expression.
"""
import json, sys, re

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

cmd = ((data.get("tool_input") or {}).get("command") or "")
if not cmd:
    sys.exit(0)


def deny(reason):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


# 1. whole-file dump of a real .env (not .env.example/.sample/.template/.dist)
if re.search(r'\b(cat|bat|head|tail|less|more)\b[^|;&]*?\.env\b(?!\.(?:example|sample|template|dist))', cmd, re.I):
    deny("Blocked by secret-guard: dumping a .env prints secrets. Output only NAMES or presence/length "
         "(e.g. `grep -oE '^[A-Z_]+=' .env`, or `[ -n \"$VAR\" ]`). Never print a secret value.")

# 2. extracting values OUT of .env (grep/rg on .env piped into cut/awk/sed)
if re.search(r'\b(grep|egrep|fgrep|rg)\b[^|]*\.env\b', cmd, re.I) and re.search(r'\b(cut\s+-d|awk\s+-F|sed)\b', cmd):
    deny("Blocked by secret-guard: this extracts values from .env. Print only var NAMES "
         "(`grep -oE '^[A-Z_]+=' .env`) or presence/length, never the value.")

# 3. echo/printf expanding a secret-named variable (allows the ${#VAR} length form)
if re.search(r'\b(echo|printf)\b[^|;&]*\$\{?[A-Za-z0-9_]*(API_KEY|TOKEN|SECRET|REFRESH_TOKEN|ACCESS_KEY|CLIENT_SECRET|PASSWORD|PASSWD|PRIVATE_KEY)[A-Za-z0-9_]*\}?', cmd, re.I):
    deny("Blocked by secret-guard: echoing a secret-named variable prints the secret. "
         "Use the length form only: `echo \"len ${#VAR}\"` — never `$VAR` or `${VAR}`.")

sys.exit(0)