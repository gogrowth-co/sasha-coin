# Secret hygiene

## Current posture (verified 2026-06-03)
- `.env` and `.env.bak` are **gitignored** (`git check-ignore .env .env.bak` → both ignored).
- They were **never committed**: `git log --all --full-history -- .env .env.bak` is empty.
- Only `.env.example` is tracked, and it contains **placeholders** (`<xlayer-eoa-private-key-0x...>`, etc.), no real values.
- Live keys live in: local `.env` (dev box) and the VPS `.env` at `/docker/openclaw-h3mk/data/.openclaw/.env`.

**Conclusion: there is NO git secret exposure, so no exposure-driven key rotation is required.** (An earlier audit pass overstated this — corrected.)

## Rules
1. The registry, skills, reports, and check scripts reference env-var **names only** — never values.
2. Never `echo`/`cat`/log a private key, API token, or bot token. When a script must use a token (e.g. the audit's Buffer read), read it from `process.env` and use it; do not print it.
3. When loading `.env` to run a script, do not pipe its contents anywhere it could be captured (logs, reports, dashboards).
4. Public surfaces (dashboards on pages.dev) host static sanitized data only — never on the key-holding VPS host path.

## If a real secret is ever found in a tracked file
- Report the **file path + variable name only** (never the value).
- Recommend: rotate the key at the provider, move it to `.env`, replace the tracked value with a placeholder, and `git rm --cached` + history scrub if it was committed.
- Do not commit the fix with the value still present.

## Smoke commands never need secrets in output
All `smoke_test_command` entries in the registry are dry-run/read paths. They may read a key from env, but their stdout must not contain it.
