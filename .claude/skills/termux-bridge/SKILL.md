---
name: termux-bridge
description: |
  Control Gabriel's Android phone from the VPS — execute real UI actions (tap, type, scroll, screenshot)
  via Termux bridge over Telegram. Enables autonomous X engagement, TikTok/Instagram posting,
  and real-device interactions without API credits.
  Triggered by: [PHONE_ENGAGE], [PHONE_SCREENSHOT], [X_ENGAGE], [X_REPLY_PHONE]
---

# Termux Bridge Skill

## What This Does

Sasha's VPS brain sends JSON commands via Telegram to Gabriel's Android phone running Termux.
The phone executes real UI actions (no API needed, real device fingerprint).

```
OpenCLAW VPS (openclaw-h3mk)
  → Telegram API (bridge bot)
  → Android phone (Termux listener)
  → ADB shell commands
  → Real app interactions
  → Screenshot / result back via Telegram
```

## Prerequisites (one-time setup)

Before using this skill, verify these env vars are in `/data/.openclaw/.env`:

```
TERMUX_BRIDGE_TOKEN=<bridge bot token — from @BotFather>
COMMANDER_CHAT_ID=<gabriel telegram user id — from @userinfobot>
BRIDGE_SECRET=<shared secret — same value in phone .env>
```

And the phone must be:
- Running Termux with `termux-listener.py` active
- ADB wireless debugging enabled and `adb connect localhost:5555` done
- Connected to WiFi (same network or reachable)

## Basic Command Pattern

All commands go through `scripts/send_to_phone.js`:

```bash
node /data/.openclaw/workspace/scripts/termux-bridge/send_to_phone.js \
  --action <action> \
  --params '<json>' \
  --wait 15000
```

## Action Library

### Verification
```bash
# Check bridge is alive
node send_to_phone.js --action ping

# Take screenshot (sent to Telegram)
node send_to_phone.js --action screenshot
```

### App Control
```bash
# Open X
node send_to_phone.js --action launch_app --params '{"package":"com.twitter.android","wait_ms":3000}'

# Open TikTok
node send_to_phone.js --action launch_app --params '{"package":"com.zhiliaoapp.musically","wait_ms":3000}'

# Open Instagram
node send_to_phone.js --action launch_app --params '{"package":"com.instagram.android","wait_ms":3000}'

# Open URL in default browser/app
node send_to_phone.js --action open_url --params '{"url":"https://twitter.com/SomeUser"}'
```

### UI Input
```bash
# Tap at coordinates
node send_to_phone.js --action tap --params '{"x":540,"y":1200}'

# Type text (spaces become %s, special chars escaped)
node send_to_phone.js --action type_text --params '{"text":"Great analysis!"}'

# Swipe (scroll)
node send_to_phone.js --action swipe --params '{"x1":540,"y1":1400,"x2":540,"y2":700,"duration_ms":400}'

# Key events
node send_to_phone.js --action key_event --params '{"keycode":66}'   # ENTER
node send_to_phone.js --action key_event --params '{"keycode":4}'    # BACK
node send_to_phone.js --action key_event --params '{"keycode":3}'    # HOME
```

### Smart UI (finds elements by text/description)
```bash
# Tap by visible text
node send_to_phone.js --action find_and_tap --params '{"text":"Like"}'

# Tap by accessibility description
node send_to_phone.js --action find_and_tap --params '{"desc":"Reply"}'

# Wait until element appears (up to 10s)
node send_to_phone.js --action wait_for_element --params '{"text":"Tweet","timeout_s":10}'
```

## X Engagement Flows (High-Level)

Use `scripts/termux-bridge/x-engage.js` for complete orchestrated flows:

```bash
# Verify bridge
node x-engage.js --flow ping

# See current screen
node x-engage.js --flow screenshot

# Calibrate coordinates (first time)
node x-engage.js --flow calibrate

# Reply to a specific tweet
node x-engage.js --flow reply \
  --tweet-url "https://x.com/user/status/12345" \
  --text "this is exactly what we saw with Uniswap's v4 launch"

# Like a tweet
node x-engage.js --flow like_tweet --tweet-url "https://x.com/user/status/12345"

# Post a new tweet
node x-engage.js --flow post_tweet --text "thread incoming on why DeFi TVL metrics are misleading"

# Scroll home feed (3 tweets)
node x-engage.js --flow scroll_feed --count 3

# Follow a user
node x-engage.js --flow follow_user --username "defiwatcher"

# Open notifications
node x-engage.js --flow notifications
```

## Cron Integration

To add autonomous X engagement via phone, add a job to `cron/jobs.json`:

```json
{
  "id": "<uuid>",
  "name": "x-phone-engage",
  "enabled": true,
  "schedule": { "kind": "cron", "expr": "0 14 * * *", "tz": "America/Sao_Paulo" },
  "sessionTarget": "main",
  "wakeMode": "now",
  "payload": {
    "kind": "systemEvent",
    "text": "[PHONE_ENGAGE] Run the termux-bridge skill. Open X app on phone, check notifications, reply to 2-3 relevant tweets in Sasha voice about crypto. Use x-engage.js flows. Report back what was done."
  }
}
```

## X Coordinate Calibration (Run Once After Setup)

Phone screen resolutions vary. Run calibration first, then update `COORDS` in `x-engage.js`:

1. `node x-engage.js --flow calibrate` — screenshot sent to Telegram
2. Open the screenshot, measure pixel positions of:
   - Bottom nav: Home / Search / Notifications / Messages / Profile icons
   - Compose FAB (floating button, bottom right)
   - First tweet's Like / Reply / Retweet buttons
3. Update `COORDS` object in `x-engage.js` with measured values
4. Run `node x-engage.js --flow open_x` + `screenshot` to verify

## Security Rules

- `BRIDGE_SECRET` must match between VPS `.env` and phone Termux `.env`
- Phone listener ignores any sender except `COMMANDER_CHAT_ID`
- `shell` action requires `secret` field inside `params` (double-gated)
- Never log full bridge commands to skill output — they contain the secret

## Troubleshooting

**Phone not responding:**
- Check Termux is running: message `@SashaBridgeBot` directly with `{"secret":"...","action":"ping","params":{}}`
- Verify listener log: `cat ~/termux-bridge/listener.log | tail -20`

**ADB not working:**
- From Termux: `adb devices` → should show device
- If not: re-run `adb connect localhost:5555` in Termux
- If 11+: re-pair via Developer Options → Wireless Debugging → Pair device

**UI not found by text:**
- Run `screenshot` flow first to see current screen state
- Use `ui_dump` action to get raw XML and identify correct text/desc values

**Coordinates wrong:**
- Run `calibrate` flow and re-measure for your specific phone/resolution