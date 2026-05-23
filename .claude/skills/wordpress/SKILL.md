---
name: wordpress
description: Connect Claude Code to a WordPress site via REST API and optional WP-CLI/MCP. Covers content CRUD, media, SEO metadata, site admin, and batch operations. Setup auto-detects capabilities (SEO plugin, page builder, WP-CLI, multisite).
trigger: "wordpress", "connect to wordpress", "update wordpress", "publish to wordpress", "wp post", "wp media", "wp seo", "wp admin", "wordpress-connect", any task referencing a WordPress site
---

# WordPress Skill
# Claude Code integration for WordPress REST API + WP-CLI + official MCP adapter

## Overview

This skill has five phases. Always run Phase 0 (connection setup) first on a new site or project. Subsequent phases use the `wordpress.config.json` written at setup.

**Integration paths (in order of preference):**
1. WordPress REST API via Application Passwords — works on every WP 5.6+ site, no plugins required
2. Official WordPress MCP Adapter (`WordPress/mcp-adapter`) — WP 6.8+, adds native MCP tool access
3. WP-CLI over SSH — self-hosted/VPS only, maximum power, optional

---

## Phase 0: Connection Setup (`wordpress-connect`)

Run this once per site. Saves capability config to `wordpress.config.json`. Never writes credentials to disk.

### Step 1: Collect credentials

Ask the user for:
- `WP_SITE_URL` — full URL including `https://` (HTTPS is required; auth will fail silently on HTTP)
- `WP_USERNAME` — the WordPress username for the API user
- `WP_APP_PASSWORD` — the Application Password

**How to generate an Application Password:**
`wp-admin → Users → Edit User → Application Passwords → Add New`
Give it a name (e.g., "Claude Code"), click Add, copy the generated password with spaces.

Store as env vars — never in any file:
```
WP_SITE_URL=https://yoursite.com
WP_USERNAME=api-user
WP_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

### Step 2: Validate connection

```bash
# Test REST API is enabled
curl -s "${WP_SITE_URL}/wp-json/" | jq '.name, .description, .url'

# Test authentication
curl -s -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  "${WP_SITE_URL}/wp-json/wp/v2/users/me" | jq '.name, .roles'
```

If either fails:
- REST API disabled: check `Settings → Permalinks` — must not be "Plain"
- Auth failed: verify HTTPS, re-check Application Password (include spaces)
- 403 on users/me: user lacks required permissions

### Step 3: Detect site capabilities

Run these probes and record results:

```bash
# WordPress version and namespace list
WP_VERSION=$(curl -s "${WP_SITE_URL}/wp-json/" | jq -r '.namespaces[]' | head -5)

# SEO plugin detection
YOAST=$(curl -s "${WP_SITE_URL}/wp-json/" | jq -r '.namespaces[]' | grep "yoast")
RANKMATH=$(curl -s "${WP_SITE_URL}/wp-json/" | jq -r '.namespaces[]' | grep "rankmath")

# ACF detection
ACF=$(curl -s "${WP_SITE_URL}/wp-json/" | jq -r '.namespaces[]' | grep "acf")

# WooCommerce detection
WC=$(curl -s "${WP_SITE_URL}/wp-json/" | jq -r '.namespaces[]' | grep "wc/v")

# Page builder detection (check for Elementor meta on a sample post)
ELEMENTOR=$(curl -s -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  "${WP_SITE_URL}/wp-json/wp/v2/posts?per_page=1&_fields=meta" | \
  jq '.[0].meta | has("_elementor_edit_mode")')

# MCP Adapter detection (WP 6.8+)
MCP_ADAPTER=$(curl -s "${WP_SITE_URL}/wp-json/" | jq -r '.namespaces[]' | grep "mcp")

# WP-CLI (only if user confirmed SSH is available)
# wp --ssh=user@host~/path --version
```

### Step 4: Write `wordpress.config.json`

Write to project root. No credentials here — only capabilities:

```json
{
  "site_url": "https://yoursite.com",
  "rest_base": "https://yoursite.com/wp-json/wp/v2",
  "wp_version_detected": "6.x",
  "capabilities": {
    "seo_plugin": "rankmath",
    "seo_write": true,
    "acf_active": false,
    "woocommerce": false,
    "page_builder": null,
    "gutenberg": true,
    "mcp_adapter": false,
    "wp_cli_ssh": null,
    "multisite": false
  },
  "role_detected": "editor",
  "setup_date": "YYYY-MM-DD"
}
```

**`seo_plugin` values:** `"yoast"`, `"rankmath"`, `"none"`
**`seo_write`:** `true` only if Rank Math is active (native REST write) or Yoast meta fields are registered
**`page_builder` values:** `"elementor"`, `"divi"`, `"beaver"`, `null`
**`wp_cli_ssh`:** SSH connection string e.g. `"deploy@yourserver.com~/public_html"` or `null`

### Step 5: Optional — Configure MCP Adapter (WP 6.8+ only)

If `mcp_adapter: true` is detected, offer to add the official MCP server to `.mcp.json`:

```json
{
  "mcpServers": {
    "wordpress": {
      "command": "npx",
      "args": ["-y", "@automattic/mcp-wordpress-remote@latest"],
      "env": {
        "WP_API_URL": "${WP_SITE_URL}/wp-json/mcp/mcp-adapter-default-server",
        "WP_API_USERNAME": "${WP_USERNAME}",
        "WP_API_PASSWORD": "${WP_APP_PASSWORD}"
      }
    }
  }
}
```

This gives Claude native MCP tool access to WordPress in addition to the REST API path.

---

## Phase 1: Content Operations (`wordpress-post`)

Read `wordpress.config.json` before every operation to confirm `rest_base` and `page_builder`.

**WARNING — Page Builder sites:** If `page_builder` is `"elementor"` or `"divi"`, never write directly to `post_content`. Doing so will corrupt the page builder's layout data. Only update title, excerpt, status, categories, tags, and meta fields on page-builder sites.

### Create post (draft)

```bash
curl -s -X POST \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  "${REST_BASE}/posts" \
  -d '{
    "title": "Post Title Here",
    "content": "Full post content in HTML",
    "excerpt": "Short excerpt",
    "slug": "post-slug",
    "status": "draft",
    "categories": [1],
    "tags": [5, 12],
    "featured_media": 0
  }'
```

### Read post

```bash
# By ID
curl -s -u "${WP_USERNAME}:${WP_APP_PASSWORD}" "${REST_BASE}/posts/123"

# By slug
curl -s "${REST_BASE}/posts?slug=my-post-slug"
```

### Update post

```bash
curl -s -X POST \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  "${REST_BASE}/posts/123" \
  -d '{"title": "Updated Title", "status": "publish"}'
```

### Publish post

```bash
curl -s -X POST \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  "${REST_BASE}/posts/123" \
  -d '{"status": "publish"}'
```

### List posts with filters

```bash
# Draft posts
curl -s -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  "${REST_BASE}/posts?status=draft&per_page=20&_fields=id,title,slug,status,date"

# Published, by category
curl -s "${REST_BASE}/posts?status=publish&categories=5&per_page=50&page=1"

# Full-text search
curl -s "${REST_BASE}/posts?search=keyword&_fields=id,title,slug"
```

Pagination: use `X-WP-Total` and `X-WP-TotalPages` response headers. Loop with `&page=N` until exhausted.

### Delete post (trash)

```bash
curl -s -X DELETE \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  "${REST_BASE}/posts/123"
```

Hard delete: add `?force=true` to the URL.

### Batch operations (up to 25 requests)

```bash
curl -s -X POST \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  "${WP_SITE_URL}/wp-json/batch/v1" \
  -d '{
    "requests": [
      {"method": "POST", "path": "/wp/v2/posts/100", "body": {"status": "publish"}},
      {"method": "POST", "path": "/wp/v2/posts/101", "body": {"status": "publish"}},
      {"method": "POST", "path": "/wp/v2/posts/102", "body": {"status": "publish"}}
    ]
  }'
```

Note: Only routes with `allow_batch: true` support this. Core routes (`/wp/v2/posts`, `/wp/v2/pages`) support batch as of WP 5.6. Plugin routes may not — test before bulk use.

---

## Phase 2: Media Operations (`wordpress-media`)

### Upload image from local file

```bash
curl -s -X POST \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Disposition: attachment; filename=\"image.jpg\"" \
  -H "Content-Type: image/jpeg" \
  --data-binary @/path/to/image.jpg \
  "${REST_BASE}/media"
```

Returns JSON with `id` (use as `featured_media` on post) and `source_url`.

### Assign featured image to post

```bash
curl -s -X POST \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  "${REST_BASE}/posts/123" \
  -d '{"featured_media": 456}'
```

### Update alt text, title, caption

```bash
curl -s -X POST \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  "${REST_BASE}/media/456" \
  -d '{
    "alt_text": "Descriptive alt text for SEO",
    "title": {"rendered": "Image Title"},
    "caption": {"rendered": "Optional caption"}
  }'
```

### List media library

```bash
# All images
curl -s -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  "${REST_BASE}/media?media_type=image&per_page=50&_fields=id,title,source_url,alt_text"

# Find by filename pattern
curl -s -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  "${REST_BASE}/media?search=hero-image&media_type=image"
```

### Import image from URL (WP-CLI path — if `wp_cli_ssh` is set)

```bash
wp --ssh="${WP_CLI_SSH}" media import "https://example.com/image.jpg" \
  --post_id=123 --featured_image --title="Image Title" --alt="Alt text"
```

---

## Phase 3: SEO Operations (`wordpress-seo`)

Read `capabilities.seo_plugin` from `wordpress.config.json` before any SEO operation. Route accordingly.

### Rank Math (recommended — native REST write)

```bash
# Read Rank Math meta
curl -s -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  "${REST_BASE}/posts/123?_fields=id,title,rank_math_title,rank_math_description,rank_math_focus_keyword"

# Write SEO title + description
curl -s -X POST \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  "${REST_BASE}/posts/123" \
  -d '{
    "rank_math_title": "SEO Title Here | Site Name",
    "rank_math_description": "Meta description under 160 chars.",
    "rank_math_focus_keyword": "primary keyword"
  }'
```

### Yoast SEO (read-native, write via post meta)

```bash
# Read Yoast meta (native — always available when Yoast is active)
curl -s "${REST_BASE}/posts/123?_fields=yoast_head_json" | \
  jq '.yoast_head_json | {title, description, robots}'

# Write Yoast SEO title + description via post meta
# Requires: register_meta for _yoast_wpseo_title and _yoast_wpseo_metadesc with show_in_rest: true
# Add to theme functions.php or a plugin:
# register_post_meta('post', '_yoast_wpseo_title', ['show_in_rest' => true, 'single' => true, 'type' => 'string', 'auth_callback' => function() { return current_user_can('edit_posts'); }]);
# register_post_meta('post', '_yoast_wpseo_metadesc', ['show_in_rest' => true, 'single' => true, 'type' => 'string', 'auth_callback' => function() { return current_user_can('edit_posts'); }]);

curl -s -X POST \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  "${REST_BASE}/posts/123" \
  -d '{
    "meta": {
      "_yoast_wpseo_title": "SEO Title Here",
      "_yoast_wpseo_metadesc": "Meta description under 160 chars."
    }
  }'
```

If `seo_write: false` in config, flag to user: "Yoast write requires adding `register_post_meta` to functions.php. See skill docs. Alternatively, switch to Rank Math for native write support."

### Bulk SEO audit (posts missing meta)

```bash
# Get all published posts + their SEO data
curl -s -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  "${REST_BASE}/posts?status=publish&per_page=100&_fields=id,slug,title,yoast_head_json" | \
  jq '[.[] | select(.yoast_head_json.description == null or .yoast_head_json.description == "") | {id, slug, title: .title.rendered}]'
```

---

## Phase 4: Site Administration (`wordpress-admin`)

Note: Plugin/theme activate/deactivate requires `administrator` role. Check `role_detected` in config — fail with a clear message if insufficient.

### List all plugins

```bash
curl -s -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  "${REST_BASE}/plugins?per_page=100&_fields=plugin,name,status,version" | \
  jq '[.[] | {name, status, version}]'
```

### Activate / deactivate plugin

```bash
# Activate
curl -s -X POST \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  "${REST_BASE}/plugins/akismet%2Fakismet" \
  -d '{"status": "active"}'

# Deactivate
curl -s -X POST \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  "${REST_BASE}/plugins/akismet%2Fakismet" \
  -d '{"status": "inactive"}'
```

Plugin slug format: `folder%2Fmain-file` (URL-encoded). E.g., `akismet/akismet.php` → `akismet%2Fakismet`.

### Read and update site settings

```bash
# Read
curl -s -u "${WP_USERNAME}:${WP_APP_PASSWORD}" "${REST_BASE}/settings" | \
  jq '{title, description, timezone_string, date_format, posts_per_page}'

# Update
curl -s -X POST \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  "${REST_BASE}/settings" \
  -d '{"description": "Updated tagline here"}'
```

### List users

```bash
curl -s -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  "${REST_BASE}/users?per_page=50&_fields=id,name,email,roles,registered_date"
```

### Site health diagnostics

```bash
curl -s -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  "${WP_SITE_URL}/wp-json/wp-site-health/v1/tests" | jq '.'
```

### Cross-content search

```bash
curl -s "${REST_BASE}/search?search=keyword&per_page=20&type=post&subtype=any" | \
  jq '[.[] | {id, title, url, type, subtype}]'
```

---

## Phase 5: WP-CLI Extended Operations (`wordpress-cli`)

Only available when `wp_cli_ssh` is set in `wordpress.config.json`. Always fall back to REST API equivalent when SSH is unavailable.

```bash
WP_CLI="wp --ssh=${WP_CLI_SSH}"

# Cache flush (always do after bulk content updates)
${WP_CLI} cache flush && ${WP_CLI} transient delete --all

# Database backup
${WP_CLI} db export ~/backup-$(date +%Y%m%d).sql

# Dry-run search-replace (safe first pass)
${WP_CLI} search-replace 'old-domain.com' 'new-domain.com' --dry-run

# Bulk plugin update
${WP_CLI} plugin update --all

# Run scheduled cron events
${WP_CLI} cron event run --due-now

# List posts with custom format
${WP_CLI} post list --post_type=post --post_status=draft --format=json | jq '.'

# Import media from URL
${WP_CLI} media import "https://example.com/image.jpg" --post_id=123 --featured_image

# Read a config value
${WP_CLI} config get siteurl

# Create user
${WP_CLI} user create apiuser api@example.com --role=editor --send-email

# Raw SQL (use carefully)
${WP_CLI} db query "SELECT ID, post_title, post_status FROM wp_posts WHERE post_type='post' LIMIT 10"
```

---

## Taxonomy Operations

### List all categories

```bash
curl -s "${REST_BASE}/categories?per_page=100&_fields=id,name,slug,count" | jq '.'
```

### Create category

```bash
curl -s -X POST \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  "${REST_BASE}/categories" \
  -d '{"name": "New Category", "slug": "new-category", "description": "Optional desc"}'
```

### Create tag and assign to post

```bash
# Create tag
TAG_ID=$(curl -s -X POST \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  "${REST_BASE}/tags" \
  -d '{"name": "New Tag"}' | jq -r '.id')

# Assign to post (append to existing tags)
curl -s -X POST \
  -u "${WP_USERNAME}:${WP_APP_PASSWORD}" \
  -H "Content-Type: application/json" \
  "${REST_BASE}/posts/123" \
  -d "{\"tags\": [${TAG_ID}]}"
```

---

## Known Limitations and Risks

| Risk | Impact | Mitigation |
|---|---|---|
| HTTP sites will fail auth | Silent failure | Validate `https://` at setup |
| Elementor/Divi sites: direct `post_content` writes corrupt layout | Data loss | Detect `page_builder` at setup, warn before writes |
| Yoast REST is read-only by default | Can't write SEO meta | Use Rank Math OR add `register_post_meta` to functions.php |
| Plugin management requires admin role | Permission error | Check `role_detected`, fail with clear role message |
| Batch endpoint not supported on all routes | Silent skip | Test each route with `?_method=OPTIONS` before bulk use |
| Managed hosts may block WP-CLI | SSH timeout | Always fall back to REST API path |
| WordPress Multisite: different REST base per sub-site | Wrong site targeted | Detect multisite at setup, ask which sub-site |
| Application Passwords bypass 2FA | Security risk if leaked | Dedicated API user with minimum necessary role |
| Rate limits on shared hosting | Throttling/429 errors | Default self-limit: 10 write operations/second |
| No native rate limiting in WP core | Over-aggressive calls can trigger host firewall | Always add `sleep 0.1` between sequential writes |

---

## Environment Variables

```
WP_SITE_URL=https://yoursite.com
WP_USERNAME=api-user
WP_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx

# Optional: WP-CLI SSH
WP_CLI_SSH=deploy@yourserver.com~/public_html
```

Add to project `.env`. Never commit to version control. The `.env.example` should list all keys without values.

---

## Config File: `wordpress.config.json`

Written once by `wordpress-connect`. Read by all subsequent operations.

```json
{
  "site_url": "https://yoursite.com",
  "rest_base": "https://yoursite.com/wp-json/wp/v2",
  "wp_version_detected": "6.x",
  "capabilities": {
    "seo_plugin": "rankmath",
    "seo_write": true,
    "acf_active": false,
    "woocommerce": false,
    "page_builder": null,
    "gutenberg": true,
    "mcp_adapter": false,
    "wp_cli_ssh": null,
    "multisite": false
  },
  "role_detected": "editor",
  "setup_date": "YYYY-MM-DD"
}
```

---

## Quick Reference

| Operation | Command / Route |
|---|---|
| Test connection | `GET /wp-json/` |
| Test auth | `GET /wp/v2/users/me` |
| List posts | `GET /wp/v2/posts?status=draft&per_page=20` |
| Create post | `POST /wp/v2/posts` |
| Publish post | `POST /wp/v2/posts/{id}` with `{"status":"publish"}` |
| Upload media | `POST /wp/v2/media` (binary body) |
| Set featured image | `POST /wp/v2/posts/{id}` with `{"featured_media":456}` |
| List categories | `GET /wp/v2/categories` |
| List plugins | `GET /wp/v2/plugins` |
| Site settings | `GET /wp/v2/settings` |
| Site health | `GET /wp-site-health/v1/tests` |
| Batch | `POST /batch/v1` |
| Search | `GET /wp/v2/search?search=keyword` |
| Rank Math write | `POST /wp/v2/posts/{id}` with `{"rank_math_title":"..."}` |
| WP-CLI cache flush | `wp cache flush && wp transient delete --all` |