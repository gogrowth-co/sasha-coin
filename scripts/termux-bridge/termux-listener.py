#!/data/data/com.termux/files/usr/bin/python3
"""
Sasha Phone Bridge — Termux Listener
=====================================
Runs on Android phone inside Termux.
Receives JSON commands from VPS via Telegram, executes UI/ADB actions, replies with results.

Setup (one-time):
  pkg install python adb
  pip install requests   # or use urllib (zero-dep version below)
  export TERMUX_BRIDGE_TOKEN="<bridge bot token from BotFather>"
  export COMMANDER_CHAT_ID="<gabriel telegram user id>"
  export BRIDGE_SECRET="<shared secret — must match VPS .env>"
  python3 termux-listener.py

Auto-start (optional):
  Add to ~/.bashrc:
    nohup python3 ~/termux-bridge/termux-listener.py >> ~/termux-bridge/listener.log 2>&1 &
"""

import os, sys, json, time, subprocess, base64, io
from pathlib import Path
import urllib.request, urllib.parse, urllib.error

# ── Config ─────────────────────────────────────────────────────────────────────
# Default ADB target — Termux's adb may auto-discover an "emulator-5554" alongside
# localhost:5555 (both point at the phone's wireless debugging daemon). Pinning
# ANDROID_SERIAL avoids "more than one device/emulator" errors on `adb shell`.
os.environ.setdefault("ANDROID_SERIAL", os.environ.get("ANDROID_SERIAL", "localhost:5555"))

BOT_TOKEN       = os.environ.get("TERMUX_BRIDGE_TOKEN", "")
COMMANDER_ID    = str(os.environ.get("COMMANDER_CHAT_ID", ""))
BRIDGE_SECRET   = os.environ.get("BRIDGE_SECRET", "")
STATE_FILE      = Path(os.path.expanduser("~/.sasha-bridge-state.json"))
LOG_FILE        = Path(os.path.expanduser("~/termux-bridge/listener.log"))

if not BOT_TOKEN or not COMMANDER_ID or not BRIDGE_SECRET:
    sys.exit("ERROR: Set TERMUX_BRIDGE_TOKEN, COMMANDER_CHAT_ID, BRIDGE_SECRET env vars first")

# ── Telegram helpers ───────────────────────────────────────────────────────────

def tg(method, **params):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/{method}"
    data = json.dumps(params).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=35) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        log(f"TG HTTP {e.code}: {body[:200]}")
        return {"ok": False, "error": body}

def send(text, parse_mode=""):
    params = {"chat_id": COMMANDER_ID, "text": text[:4000]}
    if parse_mode:
        params["parse_mode"] = parse_mode
    return tg("sendMessage", **params)

def send_photo(png_bytes, caption=""):
    boundary = b"----SashaBridge"
    nl = b"\r\n"
    body = (
        b"--" + boundary + nl
        + b'Content-Disposition: form-data; name="chat_id"' + nl + nl
        + COMMANDER_ID.encode() + nl
        + b"--" + boundary + nl
        + b'Content-Disposition: form-data; name="photo"; filename="screen.png"' + nl
        + b"Content-Type: image/png" + nl + nl
        + png_bytes + nl
    )
    if caption:
        body += (
            b"--" + boundary + nl
            + b'Content-Disposition: form-data; name="caption"' + nl + nl
            + caption.encode() + nl
        )
    body += b"--" + boundary + b"--" + nl

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto"
    req = urllib.request.Request(
        url, data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary.decode()}"}
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except Exception as e:
        log(f"send_photo error: {e}")
        return {"ok": False}

# ── ADB helpers ────────────────────────────────────────────────────────────────

def adb_shell(cmd_str):
    """Run adb shell <cmd_str>. Returns (stdout, stderr, returncode)."""
    result = subprocess.run(
        ["adb", "shell"] + cmd_str.split(None),
        capture_output=True, text=True, timeout=20
    )
    return result.stdout.strip(), result.stderr.strip(), result.returncode

def adb_exec_out(args_list):
    """Run adb exec-out <args> and return raw bytes."""
    result = subprocess.run(
        ["adb", "exec-out"] + args_list,
        capture_output=True, timeout=20
    )
    return result.stdout, result.returncode

def adb_pull(device_path, local_path):
    result = subprocess.run(
        ["adb", "pull", device_path, local_path],
        capture_output=True, text=True, timeout=15
    )
    return result.returncode == 0

def check_adb():
    result = subprocess.run(["adb", "devices"], capture_output=True, text=True, timeout=10)
    return "device" in result.stdout

# ── Action executor ────────────────────────────────────────────────────────────

def execute(action, params):
    p = params or {}

    # ── Input actions ──────────────────────────────────────────────────────────

    if action == "tap":
        _, err, rc = adb_shell(f"input tap {p['x']} {p['y']}")
        time.sleep(p.get("wait_ms", 300) / 1000)
        return {"status": "ok" if rc == 0 else "error", "err": err}

    if action == "long_press":
        duration = p.get("duration_ms", 800)
        _, err, rc = adb_shell(f"input swipe {p['x']} {p['y']} {p['x']} {p['y']} {duration}")
        return {"status": "ok" if rc == 0 else "error"}

    if action == "type_text":
        # Escape special chars for adb input text
        text = p["text"]
        text = text.replace("\\", "\\\\").replace('"', '\\"').replace("'", "'\\''")
        text = text.replace(" ", "%s").replace("&", "\\&")
        _, err, rc = adb_shell(f"input text '{text}'")
        return {"status": "ok" if rc == 0 else "error", "err": err}

    if action == "key_event":
        # Common: BACK=4, HOME=3, ENTER=66, DELETE=67, SCROLL_DOWN=93
        _, err, rc = adb_shell(f"input keyevent {p['keycode']}")
        return {"status": "ok" if rc == 0 else "error"}

    if action == "swipe":
        dur = p.get("duration_ms", 300)
        _, err, rc = adb_shell(f"input swipe {p['x1']} {p['y1']} {p['x2']} {p['y2']} {dur}")
        return {"status": "ok" if rc == 0 else "error"}

    if action == "scroll_down":
        x = p.get("x", 540)
        y = p.get("start_y", 1200)
        distance = p.get("distance", 600)
        _, err, rc = adb_shell(f"input swipe {x} {y} {x} {y - distance} 400")
        return {"status": "ok" if rc == 0 else "error"}

    if action == "scroll_up":
        x = p.get("x", 540)
        y = p.get("start_y", 800)
        distance = p.get("distance", 600)
        _, err, rc = adb_shell(f"input swipe {x} {y} {x} {y + distance} 400")
        return {"status": "ok" if rc == 0 else "error"}

    # ── App control ────────────────────────────────────────────────────────────

    if action == "launch_app":
        pkg = p["package"]
        _, err, rc = adb_shell(f"monkey -p {pkg} -c android.intent.category.LAUNCHER 1")
        time.sleep(p.get("wait_ms", 2000) / 1000)
        return {"status": "ok" if rc == 0 else "error", "err": err}

    if action == "force_stop":
        pkg = p["package"]
        _, err, rc = adb_shell(f"am force-stop {pkg}")
        return {"status": "ok" if rc == 0 else "error"}

    if action == "open_url":
        url = p["url"]
        _, err, rc = adb_shell(f'am start -a android.intent.action.VIEW -d "{url}"')
        time.sleep(2)
        return {"status": "ok" if rc == 0 else "error"}

    # ── Screen capture ─────────────────────────────────────────────────────────

    if action == "screenshot":
        png_bytes, rc = adb_exec_out(["screencap", "-p"])
        if rc != 0 or not png_bytes:
            return {"status": "error", "err": "screencap failed"}
        result = send_photo(png_bytes, caption=p.get("caption", "📸 Screen"))
        return {"status": "ok" if result.get("ok") else "error"}

    # ── UI Automator dump (find elements by text) ──────────────────────────────

    if action == "ui_dump":
        adb_shell("uiautomator dump /sdcard/ui_dump.xml")
        import tempfile
        local_path = tempfile.mktemp(suffix=".xml")
        ok = adb_pull("/sdcard/ui_dump.xml", local_path)
        if not ok:
            return {"status": "error", "err": "pull failed"}
        xml_content = Path(local_path).read_text(errors="replace")
        # Return first 3000 chars (Telegram limit handled by send)
        return {"status": "ok", "xml_preview": xml_content[:2000]}

    if action == "find_and_tap":
        # Dump UI, find by text/desc, tap center
        adb_shell("uiautomator dump /sdcard/ui_dump.xml")
        import tempfile, xml.etree.ElementTree as ET
        local_path = tempfile.mktemp(suffix=".xml")
        if not adb_pull("/sdcard/ui_dump.xml", local_path):
            return {"status": "error", "err": "dump failed"}
        tree = ET.parse(local_path)
        target = p.get("text", "").lower()
        target_desc = p.get("desc", "").lower()
        for node in tree.iter():
            node_text = (node.get("text", "") or "").lower()
            node_desc = (node.get("content-desc", "") or "").lower()
            match = (target and target in node_text) or (target_desc and target_desc in node_desc)
            if match:
                bounds = node.get("bounds", "")
                # Parse [left,top][right,bottom]
                import re
                nums = re.findall(r"\d+", bounds)
                if len(nums) == 4:
                    cx = (int(nums[0]) + int(nums[2])) // 2
                    cy = (int(nums[1]) + int(nums[3])) // 2
                    adb_shell(f"input tap {cx} {cy}")
                    return {"status": "ok", "tapped": f"{cx},{cy}", "matched_text": node_text}
        return {"status": "not_found", "target": target or target_desc}

    if action == "wait_for_element":
        target = p.get("text", "")
        timeout_s = p.get("timeout_s", 10)
        interval = 0.5
        elapsed = 0
        import tempfile, xml.etree.ElementTree as ET, re
        while elapsed < timeout_s:
            adb_shell("uiautomator dump /sdcard/ui_dump.xml")
            local_path = tempfile.mktemp(suffix=".xml")
            if adb_pull("/sdcard/ui_dump.xml", local_path):
                tree = ET.parse(local_path)
                for node in tree.iter():
                    if target.lower() in (node.get("text", "") or "").lower():
                        return {"status": "ok", "found": True, "elapsed_s": elapsed}
            time.sleep(interval)
            elapsed += interval
        return {"status": "timeout", "found": False}

    if action == "clear_text":
        # Select all + delete
        adb_shell("input keyevent 123")   # KEYCODE_MOVE_END
        adb_shell("input keyevent --longpress 67")  # long KEYCODE_DEL
        # Alternative: CTRL+A then DEL
        adb_shell("input keycomb 29 113")  # won't work on all devices
        return {"status": "ok"}

    # ── Status ─────────────────────────────────────────────────────────────────

    if action == "ping":
        return {"status": "ok", "message": "pong", "adb": check_adb()}

    if action == "adb_check":
        devices, _, _ = adb_shell("")
        return {"status": "ok", "devices": devices}

    if action == "current_app":
        out, _, _ = adb_shell("dumpsys window | grep mCurrentFocus")
        return {"status": "ok", "focus": out}

    # ── Clipboard ─────────────────────────────────────────────────────────────

    if action == "set_clipboard":
        # Requires Termux:API
        result = subprocess.run(
            ["termux-clipboard-set"],
            input=p.get("text", "").encode(), capture_output=True, timeout=5
        )
        return {"status": "ok" if result.returncode == 0 else "error"}

    # ── Raw shell (auth-gated) ─────────────────────────────────────────────────

    if action == "shell":
        if p.get("secret") != BRIDGE_SECRET:
            return {"status": "auth_error", "msg": "shell requires secret in params"}
        result = subprocess.run(
            p["cmd"], shell=True, capture_output=True, text=True, timeout=30
        )
        return {"status": "ok", "stdout": result.stdout[:1500], "stderr": result.stderr[:500]}

    return {"status": "unknown_action", "action": action}

# ── Logging ────────────────────────────────────────────────────────────────────

def log(msg):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")

# ── Main loop ──────────────────────────────────────────────────────────────────

def main():
    log("Sasha Phone Bridge starting")
    if not check_adb():
        log("WARNING: ADB device not connected — run 'adb connect localhost:5555'")
    else:
        log("ADB OK")

    state = {}
    if STATE_FILE.exists():
        try:
            state = json.loads(STATE_FILE.read_text())
        except Exception:
            pass
    offset = state.get("offset", 0)

    send("🟢 *Sasha Phone Bridge online*\nListening for commands.", parse_mode="Markdown")

    consecutive_errors = 0
    while True:
        try:
            resp = tg("getUpdates", offset=offset, timeout=30, allowed_updates=["message"])
            if not resp.get("ok"):
                log(f"getUpdates error: {resp}")
                time.sleep(5)
                continue

            updates = resp.get("result", [])
            for update in updates:
                offset = update["update_id"] + 1
                msg = update.get("message", {})

                # Security: only process messages from the commander
                sender_id = str(msg.get("chat", {}).get("id", ""))
                if sender_id != COMMANDER_ID:
                    log(f"Ignored message from unknown sender: {sender_id}")
                    continue

                text = msg.get("text", "").strip()
                if not text:
                    continue

                log(f"CMD: {text[:120]}")

                # Parse command JSON
                try:
                    cmd = json.loads(text)
                except json.JSONDecodeError:
                    send(f"❌ Invalid JSON: {text[:100]}")
                    continue

                # Auth check (top-level secret)
                if cmd.get("secret") != BRIDGE_SECRET:
                    send("❌ Auth failed")
                    log("Auth failed")
                    continue

                action = cmd.get("action", "")
                params = cmd.get("params", {})
                cmd_id = cmd.get("cmd_id", "")

                log(f"→ action={action} params={json.dumps(params)[:80]}")

                try:
                    result = execute(action, params)
                except Exception as ex:
                    result = {"status": "exception", "error": str(ex)}
                    log(f"execute exception: {ex}")

                reply = {"cmd_id": cmd_id, **result}
                log(f"← {json.dumps(reply)[:120]}")

                # Screenshots are sent inline (send_photo handles it); others send JSON
                if action != "screenshot":
                    send(f"`{json.dumps(reply, ensure_ascii=False)}`", parse_mode="Markdown")

            # Persist offset
            state["offset"] = offset
            STATE_FILE.write_text(json.dumps(state))

            consecutive_errors = 0

        except KeyboardInterrupt:
            log("Stopped by user")
            send("🔴 Phone Bridge stopped")
            break
        except Exception as e:
            consecutive_errors += 1
            log(f"Main loop error ({consecutive_errors}): {e}")
            backoff = min(30, 5 * consecutive_errors)
            time.sleep(backoff)

if __name__ == "__main__":
    main()