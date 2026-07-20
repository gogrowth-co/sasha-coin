---
name: project_github_readme_skill
description: github-readme skill built 2026-06-10, global install, battle-tested on sasha-x402-kit. Chrome headless visual path (no image-gen API), two parameterized HTML templates.
type: project
---

github-readme skill installed globally at `~/.claude/skills/github-readme/` on 2026-06-10.

**Why created:** Gabriel hand-builds a visual README for every hackathon repo. Battle-tested on `sasha-x402-kit` (Casper Buildathon 2026). nanobanana image-gen MCPs failed on auth during that build, so the skill's default visual path is deterministic (Chrome headless + sips) and requires no API key.

**What's in the skill:**
- `SKILL.md` — full workflow: input gathering, README section order, visual rendering recipe, ship flow, honesty rules
- `templates/hero.html` — 1280x640 hero banner, parameterized with `{{TOKEN}}` placeholders. bg `#0D0D1A`, accent `#00D4FF`, glow purple `rgba(123,47,190,.55)`.
- `templates/arch.html` — 1400x1060 architecture/loop infographic, same palette. Four-card verb loop + two-adapter architecture layout.

**Chrome headless render recipe (the core gotcha):**
- HTML image `src` paths must be ABSOLUTE (`file:///...`), not relative
- Render at `--force-device-scale-factor=2` then downscale via `sips --resampleWidth` for crisp text
- `gh` may not be on PATH in fresh shell — use absolute path (`/usr/local/bin/gh` or `/opt/homebrew/bin/gh`)
- Multi-account push: use `-c credential.helper='!/path/to/gh auth git-credential'` to bypass OS keychain cache

**Registered in:** sasha-coin `.claude/rules/skills-reference.md` and marketing `.claude/rules/skills-reference.md`.

**Reference artifacts preserved at:** `~/dev/sasha-x402-kit/assets/` (hero.png, agent-loop.png) and `~/dev/sasha-x402-kit/README.md`.
