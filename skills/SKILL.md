---
name: private-page-publisher
description: Create and publish private HTML pages with Cloudflare Pages authentication. Generates unique unguessable URLs protected by Cloudflare Access (One-time PIN).
triggers:
  - "create a private page"
  - "private page"
  - "publish private"
  - "cloudflare pages"
---

# Private Page Publisher

This skill allows Maestro to generate and publish private HTML pages that are only accessible via authenticated links.

## Usage

Ask Maestro to create a private page:

```
"Create a private GTM analysis page for our new product"
"Generate a competitor research report and make it privately shareable"
"Build a customer persona page and give me the private link"
```

## How it works

1. **Generation**: Maestro creates the HTML page in the workspace
2. **Publishing**: Script copies page to `pages/` with unique unguessable filename
3. **Deployment**: GitHub Actions deploys to Cloudflare Pages
4. **Access**: Returns private URL requiring authentication

## Technical Details

- **Privacy**: URLs are unguessable (UUID-based)
- **Access Control**: Cloudflare Access requires @yourdomain.com email
- **Hosting**: Cloudflare Pages with global CDN
- **Deployment**: Selective - only published pages go live

## Configuration Required

Before using this skill:

1. ✅ Set up Cloudflare Pages project connected to `pages` branch
2. ✅ Configure Cloudflare Access with **One-time PIN (OTP)** authentication
3. ✅ Set up GitHub Actions workflow with API tokens
4. ✅ Script uses correct path-based URL format: `https://maestro-openclaw.pages.dev/[uuid]-[page-name].html`

**Cloudflare Access Setup (OTP):**
- Go to https://one.dash.cloudflare.com → Access → Authentication
- Enable **One-time PIN**
- Create Application for `maestro-openclaw.pages.dev`
- Add policy with allowed emails + require One-time PIN
- Enable Access in Pages Settings → Authentication

## Example Output

```
I've created your GTM analysis page and published it privately.

Private Link: https://maestro-openclaw.pages.dev/a7b3c9e2-gtm-analysis.html

The page includes:
- Executive summary
- Market analysis
- Competitive landscape
- Go-to-market strategy

Recipients can access it by authenticating with their company email.
```
