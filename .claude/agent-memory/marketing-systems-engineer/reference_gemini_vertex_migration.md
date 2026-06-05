---
name: gemini-vertex-migration
description: Gemini API standardized on Vertex AI Express (GOOGLE_AGENT_PLATFORM_API_KEY) across all workspaces as of 2026-06-04
metadata:
  type: reference
---

## Vertex AI Express — Standard Gemini path (2026-06-04)

**Why:** GEMINI_API_KEY (generativelanguage.googleapis.com) prepay credits exhausted. Returns 429.

**Endpoint:** `https://aiplatform.googleapis.com/v1/publishers/google/models/{MODEL}:generateContent`

**Auth:** Header `x-goog-api-key: <KEY>`. Query-param `?key=` also works on Vertex.

**Key resolution (all scripts):**
- JS: `process.env.GOOGLE_AGENT_PLATFORM_API_KEY || process.env.GEMINI_API_KEY`
- Python: `os.environ.get('GOOGLE_AGENT_PLATFORM_API_KEY') or os.environ.get('GEMINI_API_KEY')`

**Critical:** `contents` entries MUST include `role: 'user'`. Omitting it returns HTTP 400 "Please use a valid role". generativelanguage did not require the role field.

**Confirmed models on Vertex Express:**
- Text: `gemini-2.5-flash`
- Image: `gemini-3.1-flash-image-preview`, `gemini-2.5-flash-image`

**Files migrated (2026-06-04):**
1. `sasha-coin/scripts/generate-image.js`
2. `sasha-coin/skills/gemini-image-simple/scripts/generate.py` (model also updated: gemini-3-pro-image-preview -> gemini-3.1-flash-image-preview)
3. `sasha-coin/reports/scripts/lib/engines.mjs`
4. `marketing/reports/scripts/lib/engines.mjs`
5. `portal-ekkogreen/reports/scripts/lib/engines.mjs`
6. `marketing/_templates/project-template/reports/scripts/lib/engines.mjs`
7. `marketing/.claude/skills/keyword-calendar/scripts/aeo-sov-monthly.py`
8. `marketing/task-server.js` (3 health-check blocks only; OpenRouter calls at ~737/1578 untouched)

**Docs updated:**
- `marketing/.claude/skills/gemini-api/SKILL.md`
- `marketing/.claude/skills/gemini-api/references/endpoints.md`
- `marketing/_context/api-key-registry.md`
- `shared/decisions.md`

**Key is pre-wired in all 4 workspace .env files.** No .env propagation needed.
