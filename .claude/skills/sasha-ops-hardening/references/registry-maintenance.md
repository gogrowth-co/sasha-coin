# Registry maintenance — docs/integrations/registry.json

The registry is the machine-readable source of truth for every external integration. The two check scripts read it; the six skills map to it via `owner_skill`.

## Entry schema
```jsonc
{
  "name", "category",          // category ∈ enums.category
  "purpose",                   // one line
  "docs_url", "llms_url",      // llms_url null unless the vendor ships /llms.txt
  "env_vars": [],              // NAMES ONLY — never values
  "files": [],                 // scripts/skills that use it
  "endpoint",                  // base URL or null
  "live_action_risk",          // none|read|write|sign|post|trade
  "fallback_behavior",         // what happens on failure
  "smoke_test_command",        // a safe, read-only/dry command or null
  "last_checked",              // YYYY-MM-DD
  "owner_skill",               // one of the six sasha-* skills
  "notes"/"workspace"          // optional
}
```

## When to edit
- **Add** an integration when a new API/key/script appears. Pick the owner_skill; set a safe smoke_test_command.
- **Update** `last_checked` whenever you verify an entry; update `docs_url` when the docs check flags it dead; update `env_vars` when keys change (names only).
- **Remove/flag** integrations that are unused (e.g. HasData, YepAPI are research-utility and not referenced by runtime scripts — confirm before deleting).

## Validation after editing
```
node -e "JSON.parse(require('fs').readFileSync('docs/integrations/registry.json','utf8'))"   # parses
node scripts/check-integration-docs.mjs --json                                              # URLs live
```

## Risk discipline
`live_action_risk` drives the safety gates in `sasha-defi-execution`. Anything `sign`/`trade`/`post` is a confirmation-gated action — never let an entry understate its risk.
