# Plan: Phone-Only Sasha Reply Pipeline

**Created:** 2026-05-20 17:35 BR
**Target session:** Tonight after 18:00 BR (fresh Claude Code session)
**Estimated duration:** 45–60 minutes focused, with a 90-min hard ceiling
**Owner:** Gabriel + Claude Code (autonomous via ADB)

## Goal

At a scheduled time, the **phone alone** runs the full Sasha reply pipeline (scrape → Gemini → ADB post). Mac is closed or asleep, VPS is not involved. Sasha posts a reply autonomously.

This is the strongest possible proof of phone autonomy and is the foundation for the future VPS+phone production migration.

## State at start of next session

These are confirmed working from 2026-05-20:

- ✅ Mac launchd reply pipeline (7 slots/day, Apify rotation, `maxItems` fix, ~$0.05/run)
- ✅ Telegram bot `@SashaBridgeBot` live (token in `sasha-coin/.env`, chat_id 1925630627)
- ✅ Termux 1022 + Termux:API installed on phone
- ✅ Listener (`~/termux-bridge/termux-listener.py`) — patched with `ANDROID_SERIAL=localhost:5555`
- ✅ Mac's `~/.android/adbkey` + `.pub` copied into Termux `~/.android/` — Termux's adb pre-authorized
- ✅ Round-trip via Telegram proven (paste JSON → listener executes → response back)
- ✅ Sasha at 5/6 (likely 6/6 by 18:00) replies today via Mac path

## Why today's attempt failed (lessons baked into the plan)

1. **Termux pkg manager was uninitialized.** First-launch users must run `termux-change-repo` to pick a mirror, otherwise `apt update` errors with "No mirror or mirror group selected". My writing `sources.list` directly DID work as a workaround, but the subsequent `pkg upgrade` had a libcurl/libngtcp2 ABI skew (the standalone `curl` binary failed with `SSL_set_quic_tls_transport_params` symbol error) which blocked further package installs.
2. **`adb shell input text` events got absorbed silently.** Termux foreground confirmed, screen never advanced in 4 consecutive attempts. Root cause unclear but suspect (a) the bash session was hung in a previous half-finished pipe, OR (b) the on-screen keyboard intercepted events. **Fix for next session: reboot the phone first to clear any stuck session, and verify each `input text` with a screencap diff.**
3. **Linux arm64 Node binary won't run in Termux** (bionic vs glibc). Must use Termux's `nodejs` package or build from source. **Decision: use `pkg install nodejs` via fixed mirror.**
4. **No fallback path for Node.** Today I had no Plan B when `pkg` failed. **Fix for next session: pre-stage `proot-distro` as Plan C (full Ubuntu sandbox inside Termux).**

## Pre-flight checklist (5 min)

Run before phase 1:

- [ ] Phone unlocked, on home WiFi (192.168.0.x)
- [ ] Laptop awake, ADB connectivity confirmed: `/tmp/platform-tools/adb -s 192.168.0.6:5555 shell echo alive`
- [ ] Mac's `~/.sasha-pause` touched so launchd slots don't compete during testing
- [ ] **Reboot the phone** (clears Termux's stuck bash session from today). Reconnect ADB after reboot.
- [ ] Re-run the listener (it'll be gone after reboot): `adb push ~/termux-bridge/termux-listener.py` flow

## Phase 1 — Termux clean rebuild (10 min)

**Goal:** Working `pkg install` with a known-good mirror and resolved libcurl skew.

### Step 1.1 — Open Termux on phone

```bash
adb -s 192.168.0.6:5555 shell "am start -n com.termux/com.termux.app.TermuxActivity"
sleep 3
adb -s 192.168.0.6:5555 exec-out screencap -p > /tmp/termux-state-0.png
# Verify a clean $ prompt — if anything weird, force-stop com.termux and re-open
```

### Step 1.2 — Fix mirror + libcurl in one shot

Push a setup script that does everything non-interactively, then trigger it.

```bash
cat > /tmp/phone-fix.sh <<'EOF'
#!/data/data/com.termux/files/usr/bin/bash
exec > /data/local/tmp/setup.log 2>&1
set -ex
export DEBIAN_FRONTEND=noninteractive

# 1. Mirror
echo 'deb https://packages.termux.dev/apt/termux-main stable main' > $PREFIX/etc/apt/sources.list

# 2. Refresh package index using libapt's libcurl (NOT the broken standalone curl)
apt update -y

# 3. Force upgrade with confnew/confdef to resolve libcurl/libngtcp2 ABI skew
apt full-upgrade -y -o Dpkg::Options::='--force-confnew' -o Dpkg::Options::='--force-confdef'

# 4. Verify curl works now
which curl && curl --version | head -1

# 5. Install runtime
apt install -y nodejs at termux-api

# 6. Verify
node -v
which at

# 7. Add Termux:Boot stub for persistence (only matters if Termux:Boot APK is installed)
mkdir -p $HOME/.termux/boot

echo "=== SETUP COMPLETE ==="
EOF

adb push /tmp/phone-fix.sh /data/local/tmp/
adb shell "input text 'bash%s/data/local/tmp/phone-fix.sh'"
sleep 1
adb shell "input keyevent 66"
```

### Step 1.3 — Wait for completion

Poll `/data/local/tmp/setup.log` for `SETUP COMPLETE` marker (use Monitor with until loop).

Expected time: 5–8 minutes (apt full-upgrade is the slow step).

### Step 1.4 — Verify

```bash
adb shell "/data/data/com.termux/files/usr/bin/node -v && /data/data/com.termux/files/usr/bin/which at"
```

Should print `v20.x.x` or similar and `/data/data/com.termux/files/usr/bin/at`.

**If Step 1 fails:** fall back to **Plan C — proot-distro** (run Ubuntu inside Termux):
```bash
pkg install proot-distro -y
proot-distro install ubuntu
proot-distro login ubuntu -- bash -c "apt update && apt install -y nodejs npm"
```

This is heavier (~200 MB) but bypasses Termux's package state entirely.

## Phase 2 — Push the pipeline (5 min)

Bundle pre-staged at `/tmp/sasha-phone-bundle/` (already built today):

```
/tmp/sasha-phone-bundle/
├── .env                          # APIFY_KEYS_FILE, GEMINI_API_KEY, SASHA_PHONE_ADB, ANDROID_SERIAL, ADB_PATH
├── run-pipeline.sh               # phone-side entry point
├── scripts/
│   ├── morning-reply-run.js
│   ├── kol-scraper.js
│   ├── adb-reply.js
│   └── lib/apify-rotate.js
├── content/
│   ├── reply-targets.json
│   └── kol-feed.json
├── state/
│   ├── posted-log.json
│   └── replied-tweets.json
└── config/
    └── apify-keys                # mode 0600
```

Push via adb to `/data/local/tmp/sasha-bundle/`, then in Termux copy to `~/sasha-coin/`.

```bash
# Mac side
adb push /tmp/sasha-phone-bundle /data/local/tmp/sasha-bundle

# Termux side (via input.text from Mac)
cp -r /data/local/tmp/sasha-bundle ~/sasha-coin
chmod 600 ~/sasha-coin/config/apify-keys
ls -la ~/sasha-coin/scripts/
```

## Phase 3 — Validate pipeline loads (5 min)

```bash
# In Termux
cd ~/sasha-coin
set -a; source .env; set +a
node scripts/morning-reply-run.js --skip-scrape --dry-run
```

**Pass criteria:**
- Script imports without errors
- Loads cached `kol-feed.json` (or fails gracefully if stale)
- Picks a candidate from filtered list (excluding already-replied handles)
- Generates a reply via Gemini (real API call) → returns reply text
- **Does NOT** attempt to post (because `--dry-run`)

If Apify rotation needs to be tested: drop the `--skip-scrape` flag and verify a fresh scrape works using the rotated `~/sasha-coin/config/apify-keys` file.

## Phase 4 — Schedule the live run (5 min)

Two scheduling options:

### Option A: `at` command (simplest, one-shot)

```bash
# In Termux, schedule for 20:00 BR
echo "bash $HOME/sasha-coin/run-pipeline.sh" | at 20:00
atq  # verify queued
```

`atd` must be running. Start with `sv-enable atd` if Termux uses runit, or `nohup atd >/dev/null 2>&1 &`.

### Option B: nohup + sleep (no daemon needed)

```bash
DELAY=$(( $(date -d "20:00" +%s) - $(date +%s) ))
nohup bash -c "sleep $DELAY && bash $HOME/sasha-coin/run-pipeline.sh" >/dev/null 2>&1 &
echo $! > $HOME/sasha-coin/scheduled.pid
```

Pid persisted so we can `kill` if needed.

### Option C: Termux:Boot (production-grade, survives reboot)

Requires installing the Termux:Boot APK from F-Droid (separate APK, ~3 MB).

```bash
# After Termux:Boot is installed
mkdir -p ~/.termux/boot
cat > ~/.termux/boot/start-sasha <<EOF
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock
bash $HOME/sasha-coin/start-scheduler.sh
EOF
chmod +x ~/.termux/boot/start-sasha
```

Where `start-scheduler.sh` is a Python loop that waits for next slot times and triggers `run-pipeline.sh`. Effectively a phone-side cron.

**For tomorrow night's test:** use Option B (nohup+sleep). Option C is for the persistent production setup once we're confident.

## Phase 5 — Live test (10 min)

1. Note the scheduled time (e.g., 20:00 BR)
2. Confirm Mac's `~/.sasha-pause` is set so Mac doesn't compete
3. **Close laptop lid at 19:55 BR** — this is the proof point
4. At 20:00 BR, phone should:
   - Wake the scheduled bash process
   - Run `morning-reply-run.js` with full Apify scrape + Gemini reply gen + ADB post
   - Reply appears on X under @SashaCoin95
5. **Reopen laptop after 20:05 BR** and verify:
   - Reply visible at https://x.com/SashaCoin95
   - `~/sasha-coin/run.log` has fresh `--- done HH:MM:SS ---` entry
   - `state/posted-log.json` has new entry with `method: "adb"` (NOT `method: "bridge"`)
   - Apify usage spent < $0.10

## Phase 6 — Cleanup / next steps (5 min)

After successful live test:

1. Remove Mac's `~/.sasha-pause`
2. Decide cadence: phone owns all 7 slots from now? Or phone is failover only?
3. Update [shared/decisions.md](../../../shared/decisions.md) with "Sasha replies now phone-autonomous"
4. Update [shared/skills-log.md](../../../shared/skills-log.md) with the bridge + phone-only architecture
5. Update SOP-17 (sasha-coin/_sop/sop-17-agent-persona.md) to document the phone-only path
6. Plan the VPS migration next (VPS schedules → Telegram bridge → phone executes)

## Persistence requirements

For the phone-only setup to survive **forever** without Mac involvement:

| Failure mode | Mitigation |
|---|---|
| Phone reboot | Termux:Boot (Phase 4 Option C) + termux-wake-lock |
| Termux app killed by Android | Termux foreground notification + battery optimization disabled for Termux |
| Listener crashes | `start-scheduler.sh` watchdog that restarts listener if PID dies |
| ADB local socket drops | `adb connect localhost:5555` in every `run-pipeline.sh` invocation |
| Apify key exhausts | Already handled — `apify-rotate.js` walks keys, falls forward |
| Gemini key exhausts | (not handled today — single key in env) — TODO: rotation |
| Phone screen off when slot fires | `termux-wake-lock` keeps CPU awake during pipeline |

## Time-boxing

Hard ceiling: 90 minutes. If not posting an autonomous reply by then:

1. Save progress logs
2. Note specific failure point
3. Resume Mac path full-time
4. Continue in next session

## Pre-built artifacts already on disk (don't re-create)

- `/tmp/sasha-phone-bundle/` — the full bundle
- `/tmp/phone-fix.sh` — the setup script (push to `/data/local/tmp/`)
- `~/.android/adbkey` + `adbkey.pub` — Mac's adb identity (already copied to Termux's `~/.android/`)
- `sasha-coin/scripts/termux-bridge/termux-listener.py` — patched listener (ANDROID_SERIAL pin)
- `sasha-coin/.env` — has TERMUX_BRIDGE_TOKEN, COMMANDER_CHAT_ID, BRIDGE_SECRET

## Success metric

A single tweet posted to X under @SashaCoin95 at the scheduled time, while the laptop lid was closed for at least 5 minutes leading up to and during the post.
