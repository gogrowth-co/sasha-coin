# Sasha Ops Runbook

**Last updated:** 2026-05-27  
**Purpose:** Step-by-step recovery procedures for every known failure mode in the X reply automation pipeline. Reference this before opening any code file.

---

## Quick health check (2 minutes)

Run these three checks before diagnosing anything:

```
# 1. Were slots firing today?
grep "$(date +%Y-%m-%d)" ~/Library/Logs/sasha-replies.log | grep -E "starting run|done"

# 2. How many replies posted today?
node -e "
  const log = JSON.parse(require('fs').readFileSync('state/posted-log.json','utf8'));
  const today = new Date().toISOString().slice(0,10);
  const hits = log.filter(e => (e.posted_at||'').startsWith(today));
  console.log(today + ': ' + hits.length + '/8 replies');
  hits.forEach(h => console.log('  ' + h.target_handle + ' — ' + h.status));
"

# 3. Is the lock stale?
ls -la /tmp/sasha-reply.lockdir 2>/dev/null && echo "LOCK EXISTS" || echo "no lock"
```

---

## Configuration reference

| Item | Value |
|---|---|
| Entrypoint (launchd) | `scripts/run-sasha-replies.sh` (git-tracked; `~/bin/` is a symlink) |
| Reply pipeline | `scripts/morning-reply-run.js` |
| KOL scraper | `scripts/kol-scraper.js` |
| ADB reply poster | `scripts/adb-reply.js` |
| State: tweet dedup | `state/replied-tweets.json` |
| State: reply log | `state/posted-log.json` |
| State: daily feed | `content/kol-feed.json` |
| Daily backup | `~/.sasha-state-backup/` (replied-tweets + posted-log, 30-day rolling) |
| Telegram alerts | `TERMUX_BRIDGE_TOKEN` + `COMMANDER_CHAT_ID` in `.env` |
| Gemini model | `GEMINI_REPLY_MODEL` in `.env` (default: `gemini-2.5-flash`) |
| Phone ADB target | `SASHA_PHONE_ADB` in `.env` (default: `192.168.0.6:5555`) |
| launchd plist | `~/Library/LaunchAgents/com.mangaos.sasha-daily-replies.plist` |
| Backup plist | `~/Library/LaunchAgents/com.mangaos.sasha-state-backup.plist` |
| Schedule (BR local) | 09:00, 10:30, 12:00, 13:30, 15:00, 16:30, 18:00 |
| Daily cap | 8 replies/day |
| Kill switch | `touch ~/.sasha-pause` (remove to resume) |
| Log | `~/Library/Logs/sasha-replies.log` |
| Backup log | `~/Library/Logs/sasha-state-backup.log` |

---

## Incident playbook

### 1. Duplicate reply posted

**Symptoms:** Two `@SashaCoin95` replies visible under the same tweet on X.  
**Root cause history:** `adb-reply.js` returning `unconfirmed` + old exit 1 → `persistReply` skipped → tweet ID not deduped → next slot re-picked it.

**Steps:**
1. Delete the duplicate reply on X (tap and hold → Delete).
2. Find the duplicate entry in `state/posted-log.json`:
   ```
   node -e "
     const log = JSON.parse(require('fs').readFileSync('state/posted-log.json','utf8'));
     const dup = log.filter(e => e.in_reply_to === 'TWEET_ID_HERE');
     console.log(JSON.stringify(dup, null, 2));
   "
   ```
3. Add a manual recovery entry to document the orphaned duplicate:
   ```json
   {
     "id": "reply-TWEET_ID-dup",
     "source": "reply",
     "status": "unconfirmed-recovered",
     "target_handle": "HANDLE",
     "in_reply_to": "TWEET_ID",
     "posted_at": "APPROX_ISO_TIMESTAMP",
     "notes": "Manual recovery — duplicate deleted from X on YYYY-MM-DD"
   }
   ```
4. Verify `TWEET_ID` is in `state/replied-tweets.json`. If not, add it:
   ```
   node -e "
     const fs = require('fs');
     const p = 'state/replied-tweets.json';
     const ids = new Set(JSON.parse(fs.readFileSync(p,'utf8')));
     ids.add('TWEET_ID_HERE');
     fs.writeFileSync(p + '.tmp.' + process.pid, JSON.stringify([...ids], null, 2));
     fs.renameSync(p + '.tmp.' + process.pid, p);
     console.log('Added. Total:', ids.size);
   "
   ```
5. Check `~/Library/Logs/sasha-replies.log` for the slot window — look for the root cause (exit code, `unconfirmed` status, lock race).

---

### 2. Silent failure — no replies for 1+ days

**Symptoms:** No entries in `posted-log.json` for today. No Telegram alerts received.  
**Causes:** Mac sleep (caffeinate failed), ADB offline, Gemini API error, stale lock.

**Steps:**
1. Check log for errors:
   ```
   grep -A5 "starting run" ~/Library/Logs/sasha-replies.log | tail -40
   ```
2. Check for stale lock:
   ```
   ls -la /tmp/sasha-reply.lockdir
   # If it exists and the PID is dead:
   rm -rf /tmp/sasha-reply.lockdir
   echo "Lock cleared"
   ```
3. Check ADB:
   ```
   ~/bin/adb devices
   # If empty: ~/bin/adb connect 192.168.0.6:5555
   # If phone IP changed: update SASHA_PHONE_ADB in .env
   ```
4. Check Gemini API manually:
   ```
   curl -s -o /dev/null -w "%{http_code}" \
     "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent" \
     -H "x-goog-api-key: $GEMINI_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"contents":[{"parts":[{"text":"ping"}]}]}'
   # 200 = OK. 404 = model deprecated → update GEMINI_REPLY_MODEL in .env
   ```
5. Run a manual dry-run to confirm pipeline is healthy:
   ```
   cd "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin"
   node scripts/morning-reply-run.js --dry-run --skip-scrape
   ```
6. If healthy, trigger a single real slot manually:
   ```
   node scripts/morning-reply-run.js --skip-scrape
   ```

---

### 3. ADB offline / phone unreachable

**Symptoms:** Log shows `ADB reconnect failed after 3 attempts`. Telegram alert: `❌ Sasha reply — ADB offline`.

**Steps:**
1. Check phone: open Settings → Developer Options → Wireless Debugging → confirm it's ON and shows an IP.
2. Try reconnecting from terminal (running from within the project):
   ```
   ~/bin/adb connect 192.168.0.6:5555
   ~/bin/adb devices
   ```
3. If the IP changed (common after router reconnect):
   ```
   # Find new IP in phone: Settings → About Phone → Status → IP Address
   # Update .env:
   # SASHA_PHONE_ADB=NEW_IP:5555
   ```
4. If ADB auth dialog shows on phone: accept it.
5. If phone rebooted, wireless debugging auto-disables — toggle it back on.
6. Run dry-run to confirm ADB is back:
   ```
   node scripts/morning-reply-run.js --dry-run --skip-scrape
   ```

---

### 4. Gemini API error / model deprecated

**Symptoms:** Log shows `Gemini API error`. Telegram alert: `❌ Sasha reply — Gemini API error`. Reply generation skipped for all candidates.

**Steps:**
1. Identify the model in use:
   ```
   grep GEMINI_REPLY_MODEL .env
   # Default: gemini-2.5-flash
   ```
2. Test the model endpoint directly:
   ```
   curl -s "https://generativelanguage.googleapis.com/v1beta/models" \
     -H "x-goog-api-key: $(grep GEMINI_API_KEY .env | cut -d= -f2)" \
     | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); d.models.filter(m=>m.name.includes('flash')).forEach(m=>console.log(m.name))"
   ```
3. If the current model is deprecated, update `.env`:
   ```
   # Edit .env: change GEMINI_REPLY_MODEL to the new model name
   # e.g. GEMINI_REPLY_MODEL=gemini-2.5-flash-002
   ```
4. No code change or commit needed — `.env` change takes effect on the next slot.
5. Run a dry-run to confirm:
   ```
   node scripts/morning-reply-run.js --dry-run --skip-scrape
   ```

---

### 5. State files deleted / corrupted

**Symptoms:** `state/replied-tweets.json` is missing or contains invalid JSON. Next run treats all KOL handles as fresh → potential mass duplicate replies.

**Steps — STOP the pipeline first:**
```
touch ~/.sasha-pause
echo "Pipeline paused"
```

**Restore from backup:**
```
# List available backups
ls -la ~/.sasha-state-backup/

# Restore most recent replied-tweets backup
LATEST=$(ls -1t ~/.sasha-state-backup/replied-tweets-*.json | head -1)
cp "$LATEST" state/replied-tweets.json
echo "Restored from: $LATEST"
node -e "console.log('IDs in restored set:', JSON.parse(require('fs').readFileSync('state/replied-tweets.json','utf8')).length)"

# Restore most recent posted-log backup
LATEST=$(ls -1t ~/.sasha-state-backup/posted-log-*.json | head -1)
cp "$LATEST" state/posted-log.json
echo "Restored from: $LATEST"
```

**If no backup is available** (backup system wasn't running yet):  
Reconstruct `replied-tweets.json` from `posted-log.json`:
```
node -e "
  const log = JSON.parse(require('fs').readFileSync('state/posted-log.json','utf8'));
  const ids = [...new Set(log.filter(e => e.in_reply_to).map(e => e.in_reply_to))];
  require('fs').writeFileSync('state/replied-tweets.json', JSON.stringify(ids, null, 2));
  console.log('Reconstructed:', ids.length, 'IDs');
"
```

**Resume:**
```
rm ~/.sasha-pause
echo "Pipeline resumed"
```

---

### 6. X app UI update breaks ADB (resource ID drift)

**Symptoms:** Every slot returns `status: unconfirmed`. Telegram alert: consecutive unconfirmed. No replies land on X even though the pipeline runs.

**Diagnostic:**
```
# Run ADB reply in debug mode against a real tweet URL
node scripts/adb-reply.js --url "https://x.com/jessepollak/status/TWEET_ID" \
  --text "test reply" --device 192.168.0.6:5555
# Check /tmp/sasha-step5-attempt*.png for screenshots
open /tmp/sasha-step5-attempt*.png
```

**Fix:**
1. Look at the screenshots — find what the reply compose field looks like now.
2. In `scripts/adb-reply.js`, search for the resource ID constants (e.g. `com.twitter.android:id/tweet_text`).
3. Update to the new resource ID. To find it:
   ```
   ~/bin/adb -s 192.168.0.6:5555 shell uiautomator dump /sdcard/ui.xml
   ~/bin/adb -s 192.168.0.6:5555 pull /sdcard/ui.xml /tmp/x-ui.xml
   grep -o 'resource-id="[^"]*tweet[^"]*"' /tmp/x-ui.xml | head -20
   ```
4. Test with `--dry-run` equivalent (add `--no-post` flag if available, or check source).
5. Commit the fix and push.

---

## Pause / resume

**Pause all slots immediately:**
```
touch ~/.sasha-pause
```

**Resume:**
```
rm ~/.sasha-pause
```

The kill switch is checked at the start of every slot before the mutex is acquired. No in-flight run is interrupted.

---

## Manual slot trigger

Run a single real slot outside the schedule:
```
cd "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin"
node scripts/morning-reply-run.js --skip-scrape
```

Run with a fresh scrape (use only if feed is stale or for a full test):
```
node scripts/morning-reply-run.js
```

Dry run (generates reply text, does NOT post):
```
node scripts/morning-reply-run.js --dry-run --skip-scrape
```

---

## Backup verification

The daily backup runs at 08:55. To verify it ran:
```
cat ~/Library/Logs/sasha-state-backup.log | tail -10
ls -la ~/.sasha-state-backup/ | head -10
```

To trigger a manual backup now:
```
bash "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/sasha-coin/scripts/backup-sasha-state.sh"
```

---

## Deployment (Mac replacement / clean setup)

If deploying to a new Mac or after a full reset:

1. Clone the repo:
   ```
   git clone https://github.com/gogrowth-co/sasha-coin.git
   cd sasha-coin
   ```
2. Copy `.env` from 1Password or old Mac.
3. Install Node via nvm, set a default version.
4. Pair ADB with the phone: enable Wireless Debugging on phone, run `~/bin/adb pair IP:PORT`.
5. Load launchd plists:
   ```
   cp scripts/run-sasha-replies.sh ~/bin/run-sasha-replies.sh   # NOT needed — the plist now points to scripts/ directly
   launchctl load ~/Library/LaunchAgents/com.mangaos.sasha-daily-replies.plist
   launchctl load ~/Library/LaunchAgents/com.mangaos.sasha-state-backup.plist
   launchctl load ~/Library/LaunchAgents/com.mangaos.sasha-adb-keepalive.plist
   ```
6. Run a dry-run to verify:
   ```
   node scripts/morning-reply-run.js --dry-run
   ```
