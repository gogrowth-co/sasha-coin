---
name: screenshot-taker
description: Capture screenshots and screen recordings of web pages. Four-tier system: (0) Dexscreener API chart render, (1) ScreenshotOne default, (1.5) Playwright interactive for pages with popups/dialogs, (2) ScrapingBee stealth for bot-protected sites. Also handles screen recordings via playwright video-start/video-stop. Default is above-the-fold via ScreenshotOne. Gives Claude visual intelligence on any page. Embeds screenshots in blog posts, articles, social graphics.
---

## PURPOSE

Two use cases:

1. **Visual intelligence** — Take a screenshot so Claude can SEE the page before designing or writing about it. Use proactively whenever a task references an external URL.
2. **Content asset** — Embed a real screenshot in a blog post hero, article above-the-fold, landing page section, or social graphic.

**Default:** Above-the-fold only (1440×900). Never full page unless explicitly asked.

---

## AUTHENTICATION

Keys are in `.env` at the project root. Always load before making any API call:

```bash
set -a && source "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/marketing/.env" && set +a
# set -a exports all variables so subshells and python3 subprocess inherit them
# Available after sourcing:
# SCREENSHOTONE_ACCESS_KEY   — primary ScreenshotOne key
# SCREENSHOTONE_ACCESS_KEY_2 — backup ScreenshotOne key (rotate on rate limit)
# SCREENSHOTONE_SECRET_KEY   — for signed URLs (optional)
# SCRAPINGBEE_API_KEY        — stealth fallback
```

Never hardcode keys. Never print them to output.

### Key Rotation (ScreenshotOne)

When a ScreenshotOne call returns a JSON error indicating a rate limit or quota issue, immediately retry the **exact same request** substituting `SCREENSHOTONE_ACCESS_KEY_2` for `SCREENSHOTONE_ACCESS_KEY`. Only fall through to Tier 2 if the backup key also fails.

**Rate limit / quota error detection:**

```bash
python3 - <<'EOF'
import json, sys
try:
    data = json.load(open('/tmp/screenshot.png'))
    code = data.get('error_code', '') or data.get('code', '')
    # ScreenshotOne rate/quota errors
    rate_limit_codes = {
        'usage_limit_exceeded', 'quota_exceeded', 'rate_limit_exceeded',
        'monthly_limit_exceeded', 'plan_limit_exceeded', 'too_many_requests'
    }
    if any(c in code.lower() for c in rate_limit_codes) or data.get('status') == 429:
        print('RATE_LIMIT')
    else:
        print('OTHER_ERROR:', code, '-', data.get('error_message', data.get('message', '')))
    sys.exit(1)
except (json.JSONDecodeError, ValueError):
    print('SUCCESS')  # not JSON = PNG = success
    sys.exit(0)
EOF
```

**Full rotation pattern (use in every Tier 1 call):**

```bash
source "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/marketing/.env"

_screenshotone_take() {
  local key="$1"
  local extra_params="$2"
  curl -s -L "https://api.screenshotone.com/take?access_key=${key}${extra_params}" \
    -o /tmp/screenshot.png
  python3 - <<'PYEOF'
import json, sys
try:
    data = json.load(open('/tmp/screenshot.png'))
    code = str(data.get('error_code', '') or data.get('code', '')).lower()
    rate_codes = {'usage_limit_exceeded','quota_exceeded','rate_limit_exceeded',
                  'monthly_limit_exceeded','plan_limit_exceeded','too_many_requests'}
    if any(c in code for c in rate_codes) or data.get('status') == 429:
        sys.exit(2)   # rate limit — rotate key
    sys.exit(1)       # other error — fall through to Tier 2
except (json.JSONDecodeError, ValueError):
    sys.exit(0)       # PNG — success
PYEOF
}

PARAMS="&url=$ENCODED_URL&viewport_width=1440&viewport_height=900&full_page=false&format=png&block_ads=true&block_cookie_banners=true&block_trackers=true&delay=1"

_screenshotone_take "$SCREENSHOTONE_ACCESS_KEY" "$PARAMS"
STATUS=$?

if [ $STATUS -eq 2 ]; then
  echo "Primary key rate-limited — trying backup key..."
  _screenshotone_take "$SCREENSHOTONE_ACCESS_KEY_2" "$PARAMS"
  STATUS=$?
fi

if [ $STATUS -eq 0 ]; then
  echo "TIER 1 SUCCESS"
elif [ $STATUS -eq 1 ]; then
  echo "TIER 1 FAILED (non-rate-limit error) — falling through to Tier 2"
  cat /tmp/screenshot.png
elif [ $STATUS -eq 2 ]; then
  echo "BOTH KEYS RATE-LIMITED — falling through to Tier 2"
fi
```

Always use this rotation pattern. Never skip to Tier 2 without first trying the backup key on rate-limit errors.

---

## DECISION TREE — RUN THIS FIRST

Before making any API call, check the target domain against the blocklists:

```
Is the domain in the PROTECTED DOMAINS list below?
├── YES: Is it a Dexscreener token page (URL contains /dex/pairs/ or dexscreener.com/[chain]/[address])?
│   ├── YES → Go to TIER 0: Dexscreener Chart Render
│   └── NO  → Go to TIER 2: ScrapingBee Stealth (skip Tier 1 entirely — it will 403)
└── NO: Is the domain in the INTERACTIVE DOMAINS list below?
    ├── YES → Go to TIER 1.5: Playwright Interactive (popup must be dismissed first)
    └── NO: Go to TIER 1: ScreenshotOne (default)
            └── If response is 403 JSON → fall through to TIER 2: ScrapingBee Stealth
```

---

## INTERACTIVE DOMAINS (use Tier 1.5: Playwright — popup/dialog must be dismissed before capture)

These sites render consent dialogs or modals that `block_cookie_banners=true` does NOT suppress:

```
beehiiv.com   → Cookie Consent alertdialog — click "Reject all" button before screenshotting
```

Add domains here whenever ScreenshotOne returns a clean PNG but the popup is visible in the image.

---

## PROTECTED DOMAINS (skip Tier 1, go straight to Tier 2 or Tier 0)

These sites block ScreenshotOne's datacenter IPs:

```
dexscreener.com       → TIER 0 (token pages) or TIER 2
app.uniswap.org       → TIER 2
binance.com/en/trade  → TIER 2
pancakeswap.finance   → TIER 2
app.aave.com          → TIER 2
app.compound.finance  → TIER 2
hyperliquid.xyz       → TIER 2
vertex.trade          → TIER 2
```

**Other domains:** try Tier 1 first. If the response is a 403 JSON (see detection below), fall through to Tier 2.

Update this list whenever you discover a new domain that consistently 403s.

---

## TIER 0: Dexscreener Chart Render (no bot bypass needed)

Use when: the URL is a Dexscreener token pair page or the user asks for a token chart.

Instead of screenshotting Dexscreener's blocked frontend, fetch their public API and render a clean branded chart via ScreenshotOne's HTML parameter. No bot bypass needed — the data comes from an open API, the chart is generated locally.

### Step 1: Fetch token data from Dexscreener API

```bash
source "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/marketing/.env"

# Extract chain and pair address from the URL
# e.g. https://dexscreener.com/solana/7xKXtg2...
# CHAIN=solana, PAIR_ADDRESS=7xKXtg2...

CHAIN="solana"           # replace with actual chain
PAIR_ADDRESS="PAIR_ADDR" # replace with actual address

curl -s "https://api.dexscreener.com/latest/dex/pairs/$CHAIN/$PAIR_ADDRESS" \
  -o /tmp/dex-data.json

# Inspect what came back
cat /tmp/dex-data.json | python3 -c "
import json, sys
d = json.load(sys.stdin)
p = d.get('pair', d.get('pairs', [{}])[0])
print('Name:', p.get('baseToken', {}).get('name'))
print('Symbol:', p.get('baseToken', {}).get('symbol'))
print('Price USD:', p.get('priceUsd'))
print('Price Change 24h:', p.get('priceChange', {}).get('h24'))
print('Volume 24h:', p.get('volume', {}).get('h24'))
print('Liquidity USD:', p.get('liquidity', {}).get('usd'))
print('Market Cap:', p.get('marketCap'))
print('FDV:', p.get('fdv'))
print('Chain:', p.get('chainId'))
print('DEX:', p.get('dexId'))
"
```

### Step 2: Generate branded HTML chart

Build a clean HTML card using the API data. Use the brand palette (Navy `#0A2540`, Aqua `#1FB6FF`, Gold `#FFB800`). This renders better in articles than a raw Dexscreener screenshot.

```bash
# After reading the token data, generate the HTML and POST it to ScreenshotOne
# Replace the TOKEN_* variables with actual values from the API response

TOKEN_NAME="Uniswap"
TOKEN_SYMBOL="UNI"
TOKEN_PRICE="7.43"
TOKEN_CHANGE="+4.2"    # include sign: "+4.2" or "-1.8"
TOKEN_VOLUME="12.4M"
TOKEN_LIQUIDITY="8.2M"
TOKEN_DEX="Uniswap v3"
TOKEN_CHAIN="Ethereum"
CHANGE_COLOR="#1FB6FF"  # Aqua for positive, use "#ef4444" for negative

HTML_CONTENT=$(cat <<HTMLEOF
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0A2540;
    font-family: 'Inter', -apple-system, sans-serif;
    width: 800px;
    padding: 32px;
  }
  .card {
    background: #0d2d4d;
    border: 1px solid rgba(31,182,255,0.15);
    border-radius: 12px;
    padding: 28px 32px;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    padding-bottom: 20px;
  }
  .token-name {
    font-size: 22px;
    font-weight: 700;
    color: #fff;
    letter-spacing: -0.3px;
  }
  .token-symbol {
    font-size: 13px;
    color: rgba(255,255,255,0.45);
    font-weight: 500;
    margin-top: 2px;
  }
  .badge {
    font-size: 11px;
    font-weight: 600;
    color: #1FB6FF;
    background: rgba(31,182,255,0.12);
    border: 1px solid rgba(31,182,255,0.2);
    padding: 4px 10px;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .price-row {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    margin-bottom: 24px;
  }
  .price {
    font-size: 38px;
    font-weight: 800;
    color: #fff;
    letter-spacing: -1px;
    line-height: 1;
  }
  .change {
    font-size: 16px;
    font-weight: 600;
    color: TOKEN_CHANGE_COLOR_PLACEHOLDER;
    margin-bottom: 4px;
  }
  .metrics {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }
  .metric {
    background: rgba(255,255,255,0.04);
    border-radius: 8px;
    padding: 14px 16px;
  }
  .metric-label {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255,255,255,0.35);
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 6px;
  }
  .metric-value {
    font-size: 18px;
    font-weight: 700;
    color: #fff;
  }
  .footer {
    margin-top: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .source {
    font-size: 11px;
    color: rgba(255,255,255,0.2);
  }
  .gold-bar {
    height: 2px;
    background: #FFB800;
    width: 40px;
    border-radius: 2px;
  }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div>
      <div class="token-name">$TOKEN_NAME</div>
      <div class="token-symbol">$TOKEN_SYMBOL · $TOKEN_DEX · $TOKEN_CHAIN</div>
    </div>
    <div class="badge">Live Data</div>
  </div>
  <div class="price-row">
    <div class="price">\$$TOKEN_PRICE</div>
    <div class="change" style="color: $CHANGE_COLOR">$TOKEN_CHANGE% (24h)</div>
  </div>
  <div class="metrics">
    <div class="metric">
      <div class="metric-label">24h Volume</div>
      <div class="metric-value">\$$TOKEN_VOLUME</div>
    </div>
    <div class="metric">
      <div class="metric-label">Liquidity</div>
      <div class="metric-value">\$$TOKEN_LIQUIDITY</div>
    </div>
    <div class="metric">
      <div class="metric-label">Source</div>
      <div class="metric-value" style="font-size:13px;color:#1FB6FF">Dexscreener</div>
    </div>
  </div>
  <div class="footer">
    <div class="source">via api.dexscreener.com · mangabeira.net</div>
    <div class="gold-bar"></div>
  </div>
</div>
</body>
</html>
HTMLEOF
)

# POST HTML to ScreenshotOne for rendering
ENCODED_HTML=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.stdin.read(), safe=''))" <<< "$HTML_CONTENT")

curl -s -L -X GET \
  "https://api.screenshotone.com/take?access_key=$SCREENSHOTONE_ACCESS_KEY&html=$(echo $ENCODED_HTML)&viewport_width=800&viewport_height=400&format=png&device_scale_factor=2" \
  -o /tmp/screenshot-dex-chart.png
```

Alternatively, save the HTML to a temp file and use ScreenshotOne's `html` parameter via POST:

```bash
# Save HTML to temp file, POST as JSON
python3 - <<'PYEOF'
import json, urllib.request, os

html_content = open('/tmp/dex-chart.html').read()
access_key = os.environ['SCREENSHOTONE_ACCESS_KEY']

payload = json.dumps({
    "access_key": access_key,
    "html": html_content,
    "viewport_width": 800,
    "viewport_height": 420,
    "format": "png",
    "device_scale_factor": 2
}).encode()

req = urllib.request.Request(
    "https://api.screenshotone.com/take",
    data=payload,
    headers={"Content-Type": "application/json"}
)
with urllib.request.urlopen(req) as resp:
    with open('/tmp/screenshot-dex-chart.png', 'wb') as f:
        f.write(resp.read())
print("Saved to /tmp/screenshot-dex-chart.png")
PYEOF
```

Then read the result to verify it looks correct before embedding.

---

## TIER 1: ScreenshotOne (Default)

Use for all domains NOT in the protected list.

**Always use the key rotation pattern from AUTHENTICATION above.** Never call Tier 1 with a bare `access_key` without the rotation logic — the backup key must be tried automatically on any rate-limit error.

### Above-the-Fold (default mode)

```bash
source "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/marketing/.env"

TARGET_URL="https://example.com"
ENCODED_URL=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$TARGET_URL', safe=''))")

# Use the _screenshotone_take rotation function defined in AUTHENTICATION
# PARAMS covers viewport, format, filters, delay
PARAMS="&url=$ENCODED_URL&viewport_width=1440&viewport_height=900&full_page=false&format=png&block_ads=true&block_cookie_banners=true&block_trackers=true&delay=1"

_screenshotone_take "$SCREENSHOTONE_ACCESS_KEY" "$PARAMS"
STATUS=$?
if [ $STATUS -eq 2 ]; then
  echo "Primary key rate-limited — trying backup..."
  _screenshotone_take "$SCREENSHOTONE_ACCESS_KEY_2" "$PARAMS"
  STATUS=$?
fi

[ $STATUS -eq 0 ] && echo "TIER 1 SUCCESS" || echo "TIER 1 FAILED — falling through to Tier 2"
```

### Full Page (explicit request only)

Use only when user says "full screenshot", "full page screenshot", "capture the whole page":

```bash
PARAMS="&url=$ENCODED_URL&viewport_width=1440&full_page=true&format=png&block_ads=true&block_cookie_banners=true&block_trackers=true&delay=2"
_screenshotone_take "$SCREENSHOTONE_ACCESS_KEY" "$PARAMS" && \
  mv /tmp/screenshot.png /tmp/screenshot-full.png || \
  { _screenshotone_take "$SCREENSHOTONE_ACCESS_KEY_2" "$PARAMS" && mv /tmp/screenshot.png /tmp/screenshot-full.png; }
```

### Scroll Video (explicit request only)

Use when user says "record the page", "show it scrolling", "animated":

```bash
# GIF format — apply same rotation pattern
for KEY in "$SCREENSHOTONE_ACCESS_KEY" "$SCREENSHOTONE_ACCESS_KEY_2"; do
  curl -s -L "https://api.screenshotone.com/take?\
access_key=${KEY}&url=$ENCODED_URL&viewport_width=1440&viewport_height=900\
&format=gif&block_ads=true&block_cookie_banners=true&delay=2" \
    -o /tmp/screenshot-scroll.gif
  python3 -c "import json,sys; json.load(open('/tmp/screenshot-scroll.gif')); sys.exit(1)" 2>/dev/null \
    && break  # not JSON = GIF = success, stop
  echo "Key $KEY rate-limited or errored, trying next..."
done

# MP4 format (better quality): change format=gif to format=mp4
```

---

## TIER 1.5: Playwright Interactive (pages with popups/dialogs)

Use when: the domain is in the INTERACTIVE DOMAINS list, or ScreenshotOne returned a clean PNG but the popup is clearly visible in the image.

Playwright opens a real browser you can interact with before capturing — so you can dismiss any dialog first.

### Standard flow

```bash
# 1. Open a named session on the target page
npx playwright-cli -s=pw open "https://example.com" &
sleep 4

# 2. Snapshot to find the popup element
npx playwright-cli -s=pw snapshot 2>/dev/null | grep -i "dialog\|modal\|cookie\|consent\|close\|reject\|accept" | head -20

# 3. Click the dismiss button (use the ref from snapshot output, e.g. e497)
npx playwright-cli -s=pw click <REF> 2>/dev/null
sleep 1

# 4. Take full-page screenshot
npx playwright-cli -s=pw screenshot --full-page --filename /tmp/screenshot-[slug].png 2>/dev/null

# 5. Clean up session
npx playwright-cli -s=pw close 2>/dev/null
```

### beehiiv.com (confirmed working)

beehiiv renders a Cookie Consent `alertdialog` that `block_cookie_banners=true` does not suppress.

```bash
npx playwright-cli -s=beehiiv open "https://www.beehiiv.com/..." &
sleep 4
# Dismiss cookie consent — "Reject all" button is always inside the alertdialog
npx playwright-cli -s=beehiiv snapshot 2>/dev/null | grep -A5 "Cookie Consent"
npx playwright-cli -s=beehiiv click e497 2>/dev/null   # "Reject all" ref (verify if it changes)
sleep 1
npx playwright-cli -s=beehiiv screenshot --full-page --filename /tmp/screenshot-beehiiv-[slug].png 2>/dev/null
npx playwright-cli -s=beehiiv close 2>/dev/null
```

### Notes

- Playwright captures at **1280px CSS width** (vs ScreenshotOne's 1440px) — factor this in for design reference use
- If the ref changes between page loads, re-run `snapshot | grep -i "reject\|accept\|close"` to find the current one
- Session names are arbitrary — use the domain slug for clarity (e.g., `-s=beehiiv`)
- Always close the session after capturing to free resources

---

## SCREEN RECORDING: Playwright Video

Use when: user asks for "screen recording", "record the page", "video of the page", or wants to show a flow/interaction.

playwright-cli has `video-start` and `video-stop` commands. Output is `.webm` format.

### Basic page recording

```bash
SESSION="rec"
OUTPUT="/tmp/recording-[slug].webm"

# Open session
npx playwright-cli -s=$SESSION open "https://example.com" &
sleep 3

# Start recording
npx playwright-cli -s=$SESSION video-start $OUTPUT 2>/dev/null

# Interact with the page (scroll, click, navigate)
npx playwright-cli -s=$SESSION scroll 0 3000 2>/dev/null    # scroll down 3000px
sleep 2
npx playwright-cli -s=$SESSION scroll 0 6000 2>/dev/null
sleep 2

# Stop recording — saves the .webm file
npx playwright-cli -s=$SESSION video-stop 2>/dev/null

# Close session
npx playwright-cli -s=$SESSION close 2>/dev/null

ls -lh $OUTPUT
```

### Recording with chapter markers

```bash
npx playwright-cli -s=$SESSION video-start $OUTPUT 2>/dev/null
npx playwright-cli -s=$SESSION video-chapter "Hero section" 2>/dev/null
# ... interact ...
npx playwright-cli -s=$SESSION video-chapter "Pricing section" 2>/dev/null
# ... scroll to pricing ...
npx playwright-cli -s=$SESSION video-stop 2>/dev/null
```

### Convert .webm to MP4 (if needed)

```bash
# Requires ffmpeg (brew install ffmpeg)
ffmpeg -i /tmp/recording-[slug].webm -c:v libx264 -preset fast /tmp/recording-[slug].mp4
```

### Notes

- `.webm` plays in Chrome/Firefox natively; convert to MP4 for broader compatibility or social upload
- Use `resize` command before recording to set viewport: `npx playwright-cli -s=$SESSION resize 1440 900`
- Dismiss popups (see Tier 1.5) before starting `video-start` if the page has dialogs
- For social clips: keep recordings under 60s; trim with ffmpeg if needed

---

## TIER 2: ScrapingBee Stealth Fallback

Use when:
- Domain is in the protected list (skip Tier 1 entirely)
- Tier 1 returned a 403 JSON response

**Free trial: 1000 credits total. Stealth screenshots cost 75 credits each (~13 stealth shots max on the free trial). Standard (non-stealth) requests cost 1 credit.**

**MANDATORY: Run the credit check before every Tier 2 call.**

### Step 0: Credit Check (run before every Tier 2 call)

```bash
set -a && source "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/marketing/.env" && set +a

python3 - <<'EOF'
import json, urllib.request, os, sys

key = os.environ.get('SCRAPINGBEE_API_KEY', '')
with urllib.request.urlopen(f"https://app.scrapingbee.com/api/v1/usage?api_key={key}") as r:
    data = json.load(r)

used  = data['used_api_credit']
total = data['max_api_credit']
pct   = (used / total) * 100
remaining_stealth = (total - used) // 75

print(f"ScrapingBee credits: {used}/{total} used ({pct:.0f}%)")
print(f"Remaining stealth screenshots: ~{remaining_stealth}")

if pct >= 90:
    import subprocess
    subprocess.run([
        "bash", "-c",
        f'echo "[$(date \'+%H:%M\')] screenshot-taker ⚠️  ALERT - ScrapingBee at {pct:.0f}% ({used}/{total} credits used)" >> ~/claude-fleet/dashboard.log'
    ])
    print("⚠️  WARNING: 90% credit threshold reached. Flag to user before proceeding.")
    sys.exit(2)  # non-zero so caller knows to warn

if used >= total:
    print("❌ NO CREDITS REMAINING. Cannot use Tier 2. Use fallback URL strategy instead.")
    sys.exit(1)
EOF

CREDIT_STATUS=$?
if [ $CREDIT_STATUS -eq 1 ]; then
  echo "ABORT TIER 2 — no credits. Use fallback URL table."
  exit 1
elif [ $CREDIT_STATUS -eq 2 ]; then
  echo "WARN USER before proceeding."
fi
```

### Step 1: Take Stealth Screenshot

**Option A — CLI with `--escalate-proxy` (recommended):**

`--escalate-proxy` automatically tries standard → premium (10 credits) → stealth (75 credits) on 403. Only burns stealth credits when the site actually requires it. Better than always using stealth.

```bash
# CLI is installed via: uv tool install scrapingbee-cli
# Already authenticated in ~/.config/scrapingbee-cli/.env

TARGET_URL="https://app.uniswap.org"

scrapingbee scrape "$TARGET_URL" \
  --screenshot true \
  --render-js true \
  --window-width 1440 \
  --window-height 900 \
  --escalate-proxy \
  --output-file /tmp/screenshot-stealth.png \
  --overwrite
```

**Option A2 — CLI with explicit stealth (when you know the site needs it):**

```bash
scrapingbee scrape "$TARGET_URL" \
  --screenshot true \
  --render-js true \
  --window-width 1440 \
  --window-height 900 \
  --stealth-proxy true \
  --output-file /tmp/screenshot-stealth.png \
  --overwrite
```

**Option B — curl (fallback if CLI unavailable):**

```bash
set -a && source "/Users/gabrielmangabeira/Documents/Gabriel Mangabeira/marketing/.env" && set +a

TARGET_URL="https://app.uniswap.org"
ENCODED_URL=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$TARGET_URL', safe=''))")

# stealth_proxy=true: residential IPs, 75 credits per call
curl -s -L "https://app.scrapingbee.com/api/v1/screenshot?\
api_key=$SCRAPINGBEE_API_KEY\
&url=$ENCODED_URL\
&stealth_proxy=true\
&render_js=true\
&window_width=1440\
&window_height=900" \
-o /tmp/screenshot-stealth.png
```

### Step 2: Verify result

```bash
if file /tmp/screenshot-stealth.png | grep -q "PNG"; then
  echo "TIER 2 SUCCESS"
  cp /tmp/screenshot-stealth.png /tmp/screenshot.png
else
  echo "TIER 2 FAILED"
  cat /tmp/screenshot-stealth.png   # show error body
fi
```

### 403 Detection (Tier 1 → Tier 2 trigger)

ScreenshotOne returns PNG on success, JSON on failure. Detect after every Tier 1 call:

```bash
if python3 -c "
import json, sys
try:
    data = json.load(open('/tmp/screenshot.png'))
    print('ERROR:', data.get('error_code'), '-', data.get('error_message'))
    sys.exit(1)
except:
    sys.exit(0)  # not JSON = PNG = success
"; then
  echo "TIER 1 SUCCESS"
else
  echo "TIER 1 FAILED — falling through to Tier 2"
fi
```

---

## FALLBACK WHEN ALL TIERS FAIL

If both Tier 1 and Tier 2 fail (or `SCRAPINGBEE_API_KEY` is not set), use these alternative URL strategies for common DeFi sites:

| Original URL | Alternative that usually works |
|---|---|
| `dexscreener.com/[chain]/[addr]` | Use Tier 0 (API chart render) — always works |
| `app.uniswap.org` | `coingecko.com/en/coins/uniswap` |
| `binance.com/en/trade/[pair]` | `coingecko.com/en/exchanges/binance` or homepage |
| `pancakeswap.finance` | `coingecko.com/en/dex/bsc/pancakeswap-v2` |
| `app.aave.com` | `aave.com` (marketing site, not the app) |
| Any token on a blocked DEX | `geckoterminal.com/[chain]/pools/[addr]` — often accessible |
| Any Cloudflare-blocked site | Try `web.archive.org/web/*/[url]` for a recent cached version |

---

## WHEN TO USE EACH MODE

| Trigger | Action |
|---|---|
| Blog post / article referencing a protocol or tool | Above-fold screenshot, auto-fallback tier |
| Social graphic showing a product UI | Above-fold, use as reference layer in nanobanana prompt |
| Need to understand what a page looks like | Above-fold, visual intelligence only (not embedded) |
| Landing page section showing a tool interface | Above-fold at 1440×900 |
| Token pair / DEX page (Dexscreener, GeckoTerminal) | Tier 0: chart render from API |
| "Full screenshot" / "capture the whole page" | Tier 1 (or 1.5 for interactive domains), `full_page=true` |
| Domain in INTERACTIVE DOMAINS list (e.g. beehiiv.com) | Tier 1.5: Playwright — dismiss popup first, then screenshot |
| "Show it scrolling" / "record the page" / "screen recording" / "video of this page" | Playwright screen recording (`video-start` / `video-stop`) |
| "Scroll GIF" / "animated scroll" | Tier 1 scroll video (GIF/MP4 via ScreenshotOne) |
| Unknown page, first time | Try Tier 1, detect 403 / visible popup, fall through |

**When in doubt: above-fold. Never full page by default.**

---

## SAVING SCREENSHOTS FOR CONTENT USE

When embedding in a content piece (not just visual intelligence):

1. Take screenshot → `/tmp/screenshot-[slug].png`
2. Read the file to verify it looks correct (Claude sees it visually)
3. Upload to Cloudinary or Supabase Storage for a persistent URL
4. Embed in HTML: `<img src="[url]" alt="[descriptive alt text]" />`
5. For blog posts: screenshot goes immediately after the intro, before the first H2
6. For social graphics: pass the image URL into the nanobanana prompt as a reference

---

## VISUAL INTELLIGENCE WORKFLOW

```
1. Run decision tree → pick Tier 0 / 1 / 2
2. Take screenshot → /tmp/screenshot-[slug].png
3. Read /tmp/screenshot-[slug].png  ← Claude sees the page visually
4. Note: layout, UI patterns, color system, key elements, what the page communicates
5. Use that context for design, copy, or analysis
```

Use this proactively. If a task references an external URL, take the screenshot before starting work.

---

## TIPS

- **JS-heavy DeFi apps:** use `delay=2` or `delay=3` — apps like Aave need time to render wallet states
- **Login walls:** screenshot will show the auth screen — flag it, ask user for a public-facing alternative URL
- **Dark mode native pages:** add `&dark_mode=true` (Tier 1) — some DeFi dashboards look wrong without it
- **High-DPI output for presentations:** add `&device_scale_factor=2` for sharper images
- **GeckoTerminal:** usually accessible without bot bypass — good alternative to Dexscreener for pool/pair pages
- **ScrapingBee credits:** stealth screenshots cost 75 credits each. Reserve for actual content embeds, not every visual intelligence check. For visual intelligence, try Tier 1 first even on borderline domains.
- **Failure detection never to skip:** always check the file type after every download. A passing curl exit code does not mean you got a real screenshot — you may have downloaded a JSON error or an "Access Denied" HTML page.
