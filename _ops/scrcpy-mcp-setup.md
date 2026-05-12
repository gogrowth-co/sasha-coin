# scrcpy-mcp Android Setup — Phase 2B

Status: 2026-05-12 — scaffolded, awaiting host-side tools.

## What's already done (by Claude Code)

- ✅ `scrcpy-mcp` npm package installed globally at `/Users/gabrielmangabeira/.nvm/versions/node/v23.11.0/bin/scrcpy-mcp`
- ✅ `.mcp.json` created at sasha-coin/.mcp.json with `android` entry (transport: stdio)
- ✅ `.gitignore` updated to exclude `.mcp.json` (defensive — keeps any future secrets out of git)

## What you need to do (one-time, ~5 min)

### Step 1 — Fix homebrew permissions (one sudo command)

```bash
sudo chown -R gabrielmangabeira /opt/homebrew /opt/homebrew/share/aclocal /opt/homebrew/share/locale /opt/homebrew/share/man/man8 /opt/homebrew/share/zsh /opt/homebrew/share/zsh/site-functions /opt/homebrew/var/homebrew/locks
```

### Step 2 — Install adb + scrcpy

```bash
brew install android-platform-tools scrcpy
```

### Step 3 — Prep the Android phone

1. Settings → About Phone → tap Build Number 7× to enable Developer Options
2. Settings → Developer Options → enable **USB Debugging**
3. Plug phone into Mac via USB
4. On phone, accept RSA fingerprint dialog ("Always allow from this computer")

### Step 4 — Verify

```bash
adb devices
```

Should show:
```
List of devices attached
<device-id>     device
```

### Step 5 — Smoke test from VS Code

In Claude Code, opened in `sasha-coin/`:
- "Take a screenshot of my phone" → should return an image
- "Open the X app on the phone" → app opens
- "Tap the home tab" → UI responds

## Notes

- Phone stays Mac-side as a Claude-Code MCP. VPS Sasha agent does NOT directly drive the phone. Gabriel triggers high-touch X engagement manually in VS Code when needed.
- scrcpy-mcp exposes ~34 MCP tools: screenshot, tap, swipe, input_text, ui_find_element, app_start, shell_exec, file_push/pull, clipboard.
- For wireless operation later: `adb tcpip 5555` (USB), unplug, `adb connect <phone-ip>:5555` (WiFi).

## Rollback

Remove the `android` block from `.mcp.json`. Optionally `npm uninstall -g scrcpy-mcp`. No VPS-side state, fully reversible.
