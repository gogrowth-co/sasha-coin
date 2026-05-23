## `typefully_get_me`

**Retrieve the currently authenticated Typefully user associated with your API Key**

```json
{"type":"object","properties":{}}
```

## `typefully_list_social_set_analytics_posts`

**Retrieve posts with metrics for a platform in a social set between `start_date` and `end_date` (inclusive).

**Required permission:** READ access to this social set.

Notes:
- `platform` is a path parameter (for example: `x`, `linkedin`).
- This endpoint is social-set scoped and platform-scoped to support analytics expansion.
- Currently, only `x` is supported.
- Replies are excluded by default. Set `include_replies=true` to include them.
- Pagination defaults to `limit=25` with max `limit=100`.
- Date ranges larger than 366 days are rejected.**

```json
{"type":"object","properties":{"social_set_id":{"title":"Social Set Id","type":"number"},"platform":{"title":"Platform","type":"string"},"start_date":{"title":"Start Date","type":"string"},"end_date":{"title":"End Date","type":"string"},"include_replies":{"default":false,"description":"Include X replies in the results. Defaults to `false`, which returns only non-reply posts.","title":"Include Replies","type":"boolean"},"limit":{"anyOf":[{"maximum":100,"minimum":1,"type":"integer"},{"type":"null"}],"default":25,"description":"Maximum number of items to return per page","title":"Limit"},"offset":{"default":0,"description":"Number of items to skip from the beginning","minimum":0,"title":"Offset","type":"number"}},"required":["social_set_id","platform","start_date","end_date"]}
```

## `typefully_get_social_set_analytics_followers`

**Retrieve daily follower counts for a platform in a social set between `start_date` and `end_date` (inclusive).

**Required permission:** READ access to this social set.

Notes:
- `platform` is a path parameter (for example: `x`, `linkedin`).
- This endpoint is social-set scoped and platform-scoped to support analytics expansion.
- Currently, only `x` is supported.
- Returns a totals-only daily follower series with the latest in-range follower count.
- If `start_date` and `end_date` are omitted, defaults to the last 30 days.
- Date ranges larger than 366 days are rejected.**

```json
{"type":"object","properties":{"social_set_id":{"title":"Social Set Id","type":"number"},"platform":{"title":"Platform","type":"string"},"start_date":{"anyOf":[{"type":"string"},{"type":"null"}],"description":"Start date for the follower series (YYYY-MM-DD). Defaults to 29 days before `end_date`, or before today when `end_date` is omitted.","title":"Start Date"},"end_date":{"anyOf":[{"type":"string"},{"type":"null"}],"description":"End date for the follower series (YYYY-MM-DD). Defaults to today in the social set's timezone.","title":"End Date"}},"required":["social_set_id","platform"]}
```

## `typefully_list_social_sets`

**Retrieve all social sets (accounts) you can access. This includes accounts you own directly and accounts that belong to teams you are a member of.**

```json
{"type":"object","properties":{"limit":{"anyOf":[{"maximum":50,"minimum":1,"type":"integer"},{"type":"null"}],"default":10,"description":"Maximum number of items to return per page","title":"Limit"},"offset":{"default":0,"description":"Number of items to skip from the beginning","minimum":0,"title":"Offset","type":"number"}}}
```

## `typefully_get_social_set_details`

**Retrieve detailed information about a social set, including every configured social media platform (X, LinkedIn, Mastodon, Threads, Bluesky) with account details and profile information.

**Required permission:** READ access to the social set.**

```json
{"type":"object","properties":{"social_set_id":{"title":"Social Set Id","type":"number"}},"required":["social_set_id"]}
```

## `typefully_list_drafts`

**Retrieve all drafts for a specific social set with optional filtering and sorting. Drafts are ordered by last edited date (most recent first) by default.

**Required permission:** READ access to this social set.**

```json
{"type":"object","properties":{"social_set_id":{"title":"Social Set Id","type":"number"},"status":{"anyOf":[{"enum":["draft","published","scheduled","error","publishing"],"type":"string"},{"type":"null"}],"title":"Status"},"tag":{"anyOf":[{"items":{"type":"string"},"type":"array"},{"type":"null"}],"title":"Tag"},"order_by":{"allOf":[{"description":"Allowed order_by fields for draft listing - prevents SQL injection","enum":["created_at","-created_at","updated_at","-updated_at","scheduled_date","-scheduled_date","published_at","-published_at"],"title":"DraftOrderBy","type":"string"}],"default":"-updated_at"},"limit":{"anyOf":[{"maximum":50,"minimum":1,"type":"integer"},{"type":"null"}],"default":10,"description":"Maximum number of items to return per page","title":"Limit"},"offset":{"default":0,"description":"Number of items to skip from the beginning","minimum":0,"title":"Offset","type":"number"}},"required":["social_set_id"]}
```

## `typefully_create_draft`

**Create a new draft with content for one or more social media platforms. The draft can be saved as a draft, scheduled for later publishing, or published immediately.

**Account-level settings:** This endpoint automatically applies the following account-level settings if enabled: Auto-Retweet, Auto-Plug, and Natural Posting Time.

**Required permission:** WRITE access to create drafts. PUBLISH access is required to schedule or publish immediately.**

```json
{"type":"object","properties":{"social_set_id":{"title":"Social Set Id","type":"number"},"requestBody":{"additionalProperties":false,"description":"Request schema for creating a draft","properties":{"platforms":{"description":"Platform configurations for each social media platform","additionalProperties":false,"properties":{"x":{"anyOf":[{"additionalProperties":false,"description":"Enabled X platform with required data","properties":{"enabled":{"const":true,"enum":[true],"title":"Enabled","type":"boolean"},"posts":{"description":"List of posts for this platform","items":{"additionalProperties":false,"description":"Schema for individual X post content.","properties":{"text":{"description":"The text content of the post. For LinkedIn posts, you can tag companies with mention syntax: @[Company Name](urn:li:organization:123456).","examples":["Hello world! This is my first post.","Check out this amazing update! 🚀","Thanks @[Typefully](urn:li:organization:86779668) for the support!"],"maxLength":50000,"title":"Text","type":"string"},"media_ids":{"description":"List of media IDs to attach to the post. Obtain media IDs by uploading files via the media upload endpoint.","examples":[["550e8400-e29b-41d4-a716-446655440000"],["550e8400-e29b-41d4-a716-446655440000","6ba7b810-9dad-11d1-80b4-00c04fd430c8"]],"items":{"type":"string"},"maxItems":10,"title":"Media Ids","type":"array"},"paid_partnership":{"default":false,"description":"X-only: Whether this post should be labeled as a paid partnership.","examples":[true,false],"title":"Paid Partnership","type":"boolean"},"made_with_ai":{"default":false,"description":"X-only: Whether this post should be labeled as made with AI.","examples":[true,false],"title":"Made With Ai","type":"boolean"},"linkedin_reshare_target":{"anyOf":[{"maxLength":2048,"type":"string"},{"type":"null"}],"description":"LinkedIn-only: canonical URN or full LinkedIn post URL to reshare (repost). URLs are normalized to the canonical URN in storage and responses. Use values like urn:li:share:<id>, urn:li:ugcPost:<id>, or urn:li:groupPost:<id>.","examples":["urn:li:share:7437089188157554688","https://www.linkedin.com/posts/typefullycom_linkedin-mentions-just-got-a-lot-better-in-activity-7437089188157554688-wSxN"],"title":"Linkedin Reshare Target"},"quote_post_url":{"anyOf":[{"maxLength":2048,"type":"string"},{"type":"null"}],"description":"X-only: URL of the X post to quote in this post (equivalent to Typefully's 'convert to quote' action).","examples":["https://x.com/typefully/status/2025894220243063023"],"title":"Quote Post Url"}},"required":["text"],"title":"XPost","type":"object"},"maxItems":25,"title":"Posts","type":"array"},"settings":{"anyOf":[{"additionalProperties":false,"description":"Settings specific to X (Twitter)","properties":{"reply_to_url":{"anyOf":[{"maxLength":2048,"type":"string"},{"type":"null"}],"description":"URL of the X post to reply to. When provided, the first post in your thread will be posted as a reply.","examples":["https://x.com/therajatkapoor/status/1399394576951959554"],"title":"Reply To Url"},"community_id":{"anyOf":[{"maxLength":255,"type":"string"},{"type":"null"}],"description":"ID of the X community to post to. Find the ID in the community URL (e.g., x.com/i/communities/1493446837214187523). You must have permission to post to the community, otherwise publishing will fail.","title":"Community Id"},"share_with_followers":{"anyOf":[{"type":"boolean"},{"type":"null"}],"description":"When posting to a community, whether to also share the post to your timeline/followers. Defaults to true if not specified. Only has an effect when community_id is provided.","title":"Share With Followers"}},"title":"XSettings","type":"object"},{"type":"null"}],"description":"X-specific settings"}},"required":["enabled","posts"],"title":"EnabledXPlatform","type":"object"},{"additionalProperties":false,"description":"Shared schema for all disabled platforms","properties":{"enabled":{"const":false,"enum":[false],"title":"Enabled","type":"boolean"}},"required":["enabled"],"title":"DisabledPlatform","type":"object"},{"type":"null"}],"description":"X (Twitter) configuration","title":"X"},"linkedin":{"anyOf":[{"additionalProperties":false,"description":"Enabled LinkedIn platform with required data","properties":{"enabled":{"const":true,"enum":[true],"title":"Enabled","type":"boolean"},"posts":{"description":"List of posts for this platform","items":{"additionalProperties":false,"description":"Schema for individual post content","properties":{"text":{"description":"The text content of the post. For LinkedIn posts, you can tag companies with mention syntax: @[Company Name](urn:li:organization:123456).","examples":["Hello world! This is my first post.","Check out this amazing update! 🚀","Thanks @[Typefully](urn:li:organization:86779668) for the support!"],"maxLength":50000,"title":"Text","type":"string"},"media_ids":{"description":"List of media IDs to attach to the post. Obtain media IDs by uploading files via the media upload endpoint.","examples":[["550e8400-e29b-41d4-a716-446655440000"],["550e8400-e29b-41d4-a716-446655440000","6ba7b810-9dad-11d1-80b4-00c04fd430c8"]],"items":{"type":"string"},"maxItems":10,"title":"Media Ids","type":"array"},"paid_partnership":{"default":false,"description":"X-only: Whether this post should be labeled as a paid partnership.","examples":[true,false],"title":"Paid Partnership","type":"boolean"},"made_with_ai":{"default":false,"description":"X-only: Whether this post should be labeled as made with AI.","examples":[true,false],"title":"Made With Ai","type":"boolean"},"linkedin_reshare_target":{"anyOf":[{"maxLength":2048,"type":"string"},{"type":"null"}],"description":"LinkedIn-only: canonical URN or full LinkedIn post URL to reshare (repost). URLs are normalized to the canonical URN in storage and responses. Use values like urn:li:share:<id>, urn:li:ugcPost:<id>, or urn:li:groupPost:<id>.","examples":["urn:li:share:7437089188157554688","https://www.linkedin.com/posts/typefullycom_linkedin-mentions-just-got-a-lot-better-in-activity-7437089188157554688-wSxN"],"title":"Linkedin Reshare Target"}},"required":["text"],"title":"Post","type":"object"},"maxItems":25,"title":"Posts","type":"array"},"settings":{"anyOf":[{"additionalProperties":false,"description":"Settings specific to LinkedIn","properties":{},"title":"LinkedInSettings","type":"object"},{"type":"null"}],"description":"LinkedIn-specific settings"}},"required":["enabled","posts"],"title":"EnabledLinkedInPlatform","type":"object"},{"additionalProperties":false,"description":"Shared schema for all disabled platforms","properties":{"enabled":{"const":false,"enum":[false],"title":"Enabled","type":"boolean"}},"required":["enabled"],"title":"DisabledPlatform","type":"object"},{"type":"null"}],"description":"LinkedIn configuration","title":"Linkedin"},"mastodon":{"anyOf":[{"additionalProperties":false,"description":"Enabled Mastodon platform with required data","properties":{"enabled":{"const":true,"enum":[true],"title":"Enabled","type":"boolean"},"posts":{"description":"List of posts for this platform","items":{"additionalProperties":false,"description":"Schema for individual post content","properties":{"text":{"description":"The text content of the post. For LinkedIn posts, you can tag companies with mention syntax: @[Company Name](urn:li:organization:123456).","examples":["Hello world! This is my first post.","Check out this amazing update! 🚀","Thanks @[Typefully](urn:li:organization:86779668) for the support!"],"maxLength":50000,"title":"Text","type":"string"},"media_ids":{"description":"List of media IDs to attach to the post. Obtain media IDs by uploading files via the media upload endpoint.","examples":[["550e8400-e29b-41d4-a716-446655440000"],["550e8400-e29b-41d4-a716-446655440000","6ba7b810-9dad-11d1-80b4-00c04fd430c8"]],"items":{"type":"string"},"maxItems":10,"title":"Media Ids","type":"array"},"paid_partnership":{"default":false,"description":"X-only: Whether this post should be labeled as a paid partnership.","examples":[true,false],"title":"Paid Partnership","type":"boolean"},"made_with_ai":{"default":false,"description":"X-only: Whether this post should be labeled as made with AI.","examples":[true,false],"title":"Made With Ai","type":"boolean"},"linkedin_reshare_target":{"anyOf":[{"maxLength":2048,"type":"string"},{"type":"null"}],"description":"LinkedIn-only: canonical URN or full LinkedIn post URL to reshare (repost). URLs are normalized to the canonical URN in storage and responses. Use values like urn:li:share:<id>, urn:li:ugcPost:<id>, or urn:li:groupPost:<id>.","examples":["urn:li:share:7437089188157554688","https://www.linkedin.com/posts/typefullycom_linkedin-mentions-just-got-a-lot-better-in-activity-7437089188157554688-wSxN"],"title":"Linkedin Reshare Target"}},"required":["text"],"title":"Post","type":"object"},"maxItems":25,"title":"Posts","type":"array"},"settings":{"anyOf":[{"additionalProperties":false,"description":"Settings specific to Mastodon","properties":{},"title":"MastodonSettings","type":"object"},{"type":"null"}],"description":"Mastodon-specific settings"}},"required":["enabled","posts"],"title":"EnabledMastodonPlatform","type":"object"},{"additionalProperties":false,"description":"Shared schema for all disabled platforms","properties":{"enabled":{"const":false,"enum":[false],"title":"Enabled","type":"boolean"}},"required":["enabled"],"title":"DisabledPlatform","type":"object"},{"type":"null"}],"description":"Mastodon configuration","title":"Mastodon"},"threads":{"anyOf":[{"additionalProperties":false,"description":"Enabled Threads platform with required data","properties":{"enabled":{"const":true,"enum":[true],"title":"Enabled","type":"boolean"},"posts":{"description":"List of posts for this platform","items":{"additionalProperties":false,"description":"Schema for individual post content","properties":{"text":{"description":"The text content of the post. For LinkedIn posts, you can tag companies with mention syntax: @[Company Name](urn:li:organization:123456).","examples":["Hello world! This is my first post.","Check out this amazing update! 🚀","Thanks @[Typefully](urn:li:organization:86779668) for the support!"],"maxLength":50000,"title":"Text","type":"string"},"media_ids":{"description":"List of media IDs to attach to the post. Obtain media IDs by uploading files via the media upload endpoint.","examples":[["550e8400-e29b-41d4-a716-446655440000"],["550e8400-e29b-41d4-a716-446655440000","6ba7b810-9dad-11d1-80b4-00c04fd430c8"]],"items":{"type":"string"},"maxItems":10,"title":"Media Ids","type":"array"},"paid_partnership":{"default":false,"description":"X-only: Whether this post should be labeled as a paid partnership.","examples":[true,false],"title":"Paid Partnership","type":"boolean"},"made_with_ai":{"default":false,"description":"X-only: Whether this post should be labeled as made with AI.","examples":[true,false],"title":"Made With Ai","type":"boolean"},"linkedin_reshare_target":{"anyOf":[{"maxLength":2048,"type":"string"},{"type":"null"}],"description":"LinkedIn-only: canonical URN or full LinkedIn post URL to reshare (repost). URLs are normalized to the canonical URN in storage and responses. Use values like urn:li:share:<id>, urn:li:ugcPost:<id>, or urn:li:groupPost:<id>.","examples":["urn:li:share:7437089188157554688","https://www.linkedin.com/posts/typefullycom_linkedin-mentions-just-got-a-lot-better-in-activity-7437089188157554688-wSxN"],"title":"Linkedin Reshare Target"}},"required":["text"],"title":"Post","type":"object"},"maxItems":25,"title":"Posts","type":"array"},"settings":{"anyOf":[{"additionalProperties":false,"description":"Settings specific to Threads","properties":{},"title":"ThreadsSettings","type":"object"},{"type":"null"}],"description":"Threads-specific settings"}},"required":["enabled","posts"],"title":"EnabledThreadsPlatform","type":"object"},{"additionalProperties":false,"description":"Shared schema for all disabled platforms","properties":{"enabled":{"const":false,"enum":[false],"title":"Enabled","type":"boolean"}},"required":["enabled"],"title":"DisabledPlatform","type":"object"},{"type":"null"}],"description":"Threads configuration","title":"Threads"},"bluesky":{"anyOf":[{"additionalProperties":false,"description":"Enabled Bluesky platform with required data","properties":{"enabled":{"const":true,"enum":[true],"title":"Enabled","type":"boolean"},"posts":{"description":"List of posts for this platform","items":{"additionalProperties":false,"description":"Schema for individual post content","properties":{"text":{"description":"The text content of the post. For LinkedIn posts, you can tag companies with mention syntax: @[Company Name](urn:li:organization:123456).","examples":["Hello world! This is my first post.","Check out this amazing update! 🚀","Thanks @[Typefully](urn:li:organization:86779668) for the support!"],"maxLength":50000,"title":"Text","type":"string"},"media_ids":{"description":"List of media IDs to attach to the post. Obtain media IDs by uploading files via the media upload endpoint.","examples":[["550e8400-e29b-41d4-a716-446655440000"],["550e8400-e29b-41d4-a716-446655440000","6ba7b810-9dad-11d1-80b4-00c04fd430c8"]],"items":{"type":"string"},"maxItems":10,"title":"Media Ids","type":"array"},"paid_partnership":{"default":false,"description":"X-only: Whether this post should be labeled as a paid partnership.","examples":[true,false],"title":"Paid Partnership","type":"boolean"},"made_with_ai":{"default":false,"description":"X-only: Whether this post should be labeled as made with AI.","examples":[true,false],"title":"Made With Ai","type":"boolean"},"linkedin_reshare_target":{"anyOf":[{"maxLength":2048,"type":"string"},{"type":"null"}],"description":"LinkedIn-only: canonical URN or full LinkedIn post URL to reshare (repost). URLs are normalized to the canonical URN in storage and responses. Use values like urn:li:share:<id>, urn:li:ugcPost:<id>, or urn:li:groupPost:<id>.","examples":["urn:li:share:7437089188157554688","https://www.linkedin.com/posts/typefullycom_linkedin-mentions-just-got-a-lot-better-in-activity-7437089188157554688-wSxN"],"title":"Linkedin Reshare Target"}},"required":["text"],"title":"Post","type":"object"},"maxItems":25,"title":"Posts","type":"array"},"settings":{"anyOf":[{"additionalProperties":false,"description":"Settings specific to Bluesky","properties":{},"title":"BlueskySettings","type":"object"},{"type":"null"}],"description":"Bluesky-specific settings"}},"required":["enabled","posts"],"title":"EnabledBlueskyPlatform","type":"object"},{"additionalProperties":false,"description":"Shared schema for all disabled platforms","properties":{"enabled":{"const":false,"enum":[false],"title":"Enabled","type":"boolean"}},"required":["enabled"],"title":"DisabledPlatform","type":"object"},{"type":"null"}],"description":"Bluesky configuration","title":"Bluesky"}},"title":"Platforms","type":"object"},"draft_title":{"anyOf":[{"maxLength":512,"type":"string"},{"type":"null"}],"description":"Human-readable title for the draft. This is for internal organization only and is not posted to social media.","examples":["Weekly Newsletter","Product Launch Announcement","Monday Motivation Post"],"title":"Draft Title"},"scratchpad_text":{"anyOf":[{"type":"string"},{"type":"null"}],"description":"Plain text scratchpad notes for the draft. Formatting is stripped.","examples":["line 1\nline 2\n\nline 4"],"title":"Scratchpad Text"},"tags":{"description":"List of tag slugs (not names) associated with this draft. Use the /tags endpoint to get available tags with their slugs. Tags must already exist in the social set.","examples":[["marketing","product"],["newsletter"],[]],"items":{"type":"string"},"maxItems":10,"title":"Tags","type":"array"},"share":{"default":false,"description":"Whether to generate a public share URL for this draft. When true, anyone with the URL can view the draft content.","title":"Share","type":"boolean"},"publish_at":{"anyOf":[{"format":"date-time","type":"string"},{"enum":["now","next-free-slot"],"type":"string"},{"type":"null"}],"description":"When to publish the draft. Options: \"now\" to publish immediately, \"next-free-slot\" to schedule to your next available posting slot, or an ISO 8601 datetime string with timezone for a specific future time (e.g., '2025-01-20T14:00:00Z' for UTC or '2025-01-20T09:00:00-05:00' for EST). Timezone is required. Omit to save as a draft.","examples":["2025-12-20T09:00:00-05:00","now","next-free-slot"],"title":"Publish At"}},"required":["platforms"],"title":"DraftCreateRequest","type":"object"}},"required":["social_set_id","requestBody"]}
```

## `typefully_get_draft`

**Retrieve a specific draft by ID, including its content for all configured platforms, status, and scheduling information.

If the draft has any comment threads, the response's `posts[*].text` includes inline `<typ:comment-thread id="UUID">…</typ:comment-thread>` markers around the anchored spans (and self-closing markers at paragraph start for paragraph-level threads). The markers exist so a `GET → modify → PATCH` round-trip preserves comment anchors. To render plain text without markers (read-only / display use cases), pass `?exclude_comment_markers=true`. **Text returned with that flag set cannot be PATCHed back without losing comment anchors.**

**Required permission:** READ access to this social set.**

```json
{"type":"object","properties":{"social_set_id":{"title":"Social Set Id","type":"number"},"draft_id":{"title":"Draft Id","type":"number"},"exclude_comment_markers":{"default":false,"description":"When true, render `posts[*].text` as plain user-visible text without `<typ:comment-thread>` markers. Use only for read-only flows (LLM context windows, exports). The default (false) emits markers so a round-trip back to PATCH preserves comment anchors.","title":"Exclude Comment Markers","type":"boolean"}},"required":["social_set_id","draft_id"]}
```

## `typefully_delete_draft`

**Delete a draft. Requires WRITE access. You can delete your own drafts in any status (DRAFT, ERROR, SCHEDULED, PUBLISHED, PUBLISHING) with WRITE access. Drafts created by other users also require WRITE access to delete.

**Required permission:** WRITE access to this social set.**

```json
{"type":"object","properties":{"social_set_id":{"title":"Social Set Id","type":"number"},"draft_id":{"title":"Draft Id","type":"number"}},"required":["social_set_id","draft_id"]}
```

## `typefully_edit_draft`

**Update an existing draft with partial update semantics. Only provided fields are updated; omitted fields remain unchanged. Scheduled drafts require publish access to edit.

## Note about Comment-thread markers

If the draft has comment threads, every submitted `posts[*].text` must include the inline `<typ:comment-thread id="UUID">…</typ:comment-thread>` markers it received from the GET response. Validation is at the platform-level: every comment thread anchored on a platform must appear somewhere in that platform's submitted text.- `409 COMMENTS_MARKER_MISMATCH` will be thrown if an expected comment thread marker is missing unless `"force_overwrite_comments": true` is set, in which case the affected threads are resolved server-side.
- `400 COMMENTS_MARKER_UNKNOWN_ID` will be thrown if you submit an id that doesn't exist on this draft. - `400 COMMENTS_MARKER_MALFORMED` will be thrown if the marker tag is malformed (bad UUID, unbalanced, attribute violations, etc.).

Pass `?exclude_comment_markers=true` to render the response's `posts[*].text` as plain text without markers (read-only / display rendering — does NOT skip server-side marker validation on the request body).

**Required permission:** WRITE access to edit drafts. PUBLISH access is required to edit scheduled drafts, schedule, or publish.**

```json
{"type":"object","properties":{"social_set_id":{"title":"Social Set Id","type":"number"},"draft_id":{"title":"Draft Id","type":"number"},"exclude_comment_markers":{"default":false,"description":"Render the response's `posts[*].text` as plain text without `<typ:comment-thread>` markers. Render-only — does not affect request-body validation.","title":"Exclude Comment Markers","type":"boolean"},"requestBody":{"additionalProperties":false,"description":"Request schema for updating a draft (partial updates supported)","properties":{"platforms":{"anyOf":[{"additionalProperties":false,"description":"Schema for all platform configurations","properties":{"x":{"anyOf":[{"additionalProperties":false,"description":"Enabled X platform with required data","properties":{"enabled":{"const":true,"enum":[true],"title":"Enabled","type":"boolean"},"posts":{"description":"List of posts for this platform","items":{"additionalProperties":false,"description":"Schema for individual X post content.","properties":{"text":{"description":"The text content of the post. For LinkedIn posts, you can tag companies with mention syntax: @[Company Name](urn:li:organization:123456).","examples":["Hello world! This is my first post.","Check out this amazing update! 🚀","Thanks @[Typefully](urn:li:organization:86779668) for the support!"],"maxLength":50000,"title":"Text","type":"string"},"media_ids":{"description":"List of media IDs to attach to the post. Obtain media IDs by uploading files via the media upload endpoint.","examples":[["550e8400-e29b-41d4-a716-446655440000"],["550e8400-e29b-41d4-a716-446655440000","6ba7b810-9dad-11d1-80b4-00c04fd430c8"]],"items":{"type":"string"},"maxItems":10,"title":"Media Ids","type":"array"},"paid_partnership":{"default":false,"description":"X-only: Whether this post should be labeled as a paid partnership.","examples":[true,false],"title":"Paid Partnership","type":"boolean"},"made_with_ai":{"default":false,"description":"X-only: Whether this post should be labeled as made with AI.","examples":[true,false],"title":"Made With Ai","type":"boolean"},"linkedin_reshare_target":{"anyOf":[{"maxLength":2048,"type":"string"},{"type":"null"}],"description":"LinkedIn-only: canonical URN or full LinkedIn post URL to reshare (repost). URLs are normalized to the canonical URN in storage and responses. Use values like urn:li:share:<id>, urn:li:ugcPost:<id>, or urn:li:groupPost:<id>.","examples":["urn:li:share:7437089188157554688","https://www.linkedin.com/posts/typefullycom_linkedin-mentions-just-got-a-lot-better-in-activity-7437089188157554688-wSxN"],"title":"Linkedin Reshare Target"},"quote_post_url":{"anyOf":[{"maxLength":2048,"type":"string"},{"type":"null"}],"description":"X-only: URL of the X post to quote in this post (equivalent to Typefully's 'convert to quote' action).","examples":["https://x.com/typefully/status/2025894220243063023"],"title":"Quote Post Url"}},"required":["text"],"title":"XPost","type":"object"},"maxItems":25,"title":"Posts","type":"array"},"settings":{"anyOf":[{"additionalProperties":false,"description":"Settings specific to X (Twitter)","properties":{"reply_to_url":{"anyOf":[{"maxLength":2048,"type":"string"},{"type":"null"}],"description":"URL of the X post to reply to. When provided, the first post in your thread will be posted as a reply.","examples":["https://x.com/therajatkapoor/status/1399394576951959554"],"title":"Reply To Url"},"community_id":{"anyOf":[{"maxLength":255,"type":"string"},{"type":"null"}],"description":"ID of the X community to post to. Find the ID in the community URL (e.g., x.com/i/communities/1493446837214187523). You must have permission to post to the community, otherwise publishing will fail.","title":"Community Id"},"share_with_followers":{"anyOf":[{"type":"boolean"},{"type":"null"}],"description":"When posting to a community, whether to also share the post to your timeline/followers. Defaults to true if not specified. Only has an effect when community_id is provided.","title":"Share With Followers"}},"title":"XSettings","type":"object"},{"type":"null"}],"description":"X-specific settings"}},"required":["enabled","posts"],"title":"EnabledXPlatform","type":"object"},{"additionalProperties":false,"description":"Shared schema for all disabled platforms","properties":{"enabled":{"const":false,"enum":[false],"title":"Enabled","type":"boolean"}},"required":["enabled"],"title":"DisabledPlatform","type":"object"},{"type":"null"}],"description":"X (Twitter) configuration","title":"X"},"linkedin":{"anyOf":[{"additionalProperties":false,"description":"Enabled LinkedIn platform with required data","properties":{"enabled":{"const":true,"enum":[true],"title":"Enabled","type":"boolean"},"posts":{"description":"List of posts for this platform","items":{"additionalProperties":false,"description":"Schema for individual post content","properties":{"text":{"description":"The text content of the post. For LinkedIn posts, you can tag companies with mention syntax: @[Company Name](urn:li:organization:123456).","examples":["Hello world! This is my first post.","Check out this amazing update! 🚀","Thanks @[Typefully](urn:li:organization:86779668) for the support!"],"maxLength":50000,"title":"Text","type":"string"},"media_ids":{"description":"List of media IDs to attach to the post. Obtain media IDs by uploading files via the media upload endpoint.","examples":[["550e8400-e29b-41d4-a716-446655440000"],["550e8400-e29b-41d4-a716-446655440000","6ba7b810-9dad-11d1-80b4-00c04fd430c8"]],"items":{"type":"string"},"maxItems":10,"title":"Media Ids","type":"array"},"paid_partnership":{"default":false,"description":"X-only: Whether this post should be labeled as a paid partnership.","examples":[true,false],"title":"Paid Partnership","type":"boolean"},"made_with_ai":{"default":false,"description":"X-only: Whether this post should be labeled as made with AI.","examples":[true,false],"title":"Made With Ai","type":"boolean"},"linkedin_reshare_target":{"anyOf":[{"maxLength":2048,"type":"string"},{"type":"null"}],"description":"LinkedIn-only: canonical URN or full LinkedIn post URL to reshare (repost). URLs are normalized to the canonical URN in storage and responses. Use values like urn:li:share:<id>, urn:li:ugcPost:<id>, or urn:li:groupPost:<id>.","examples":["urn:li:share:7437089188157554688","https://www.linkedin.com/posts/typefullycom_linkedin-mentions-just-got-a-lot-better-in-activity-7437089188157554688-wSxN"],"title":"Linkedin Reshare Target"}},"required":["text"],"title":"Post","type":"object"},"maxItems":25,"title":"Posts","type":"array"},"settings":{"anyOf":[{"additionalProperties":false,"description":"Settings specific to LinkedIn","properties":{},"title":"LinkedInSettings","type":"object"},{"type":"null"}],"description":"LinkedIn-specific settings"}},"required":["enabled","posts"],"title":"EnabledLinkedInPlatform","type":"object"},{"additionalProperties":false,"description":"Shared schema for all disabled platforms","properties":{"enabled":{"const":false,"enum":[false],"title":"Enabled","type":"boolean"}},"required":["enabled"],"title":"DisabledPlatform","type":"object"},{"type":"null"}],"description":"LinkedIn configuration","title":"Linkedin"},"mastodon":{"anyOf":[{"additionalProperties":false,"description":"Enabled Mastodon platform with required data","properties":{"enabled":{"const":true,"enum":[true],"title":"Enabled","type":"boolean"},"posts":{"description":"List of posts for this platform","items":{"additionalProperties":false,"description":"Schema for individual post content","properties":{"text":{"description":"The text content of the post. For LinkedIn posts, you can tag companies with mention syntax: @[Company Name](urn:li:organization:123456).","examples":["Hello world! This is my first post.","Check out this amazing update! 🚀","Thanks @[Typefully](urn:li:organization:86779668) for the support!"],"maxLength":50000,"title":"Text","type":"string"},"media_ids":{"description":"List of media IDs to attach to the post. Obtain media IDs by uploading files via the media upload endpoint.","examples":[["550e8400-e29b-41d4-a716-446655440000"],["550e8400-e29b-41d4-a716-446655440000","6ba7b810-9dad-11d1-80b4-00c04fd430c8"]],"items":{"type":"string"},"maxItems":10,"title":"Media Ids","type":"array"},"paid_partnership":{"default":false,"description":"X-only: Whether this post should be labeled as a paid partnership.","examples":[true,false],"title":"Paid Partnership","type":"boolean"},"made_with_ai":{"default":false,"description":"X-only: Whether this post should be labeled as made with AI.","examples":[true,false],"title":"Made With Ai","type":"boolean"},"linkedin_reshare_target":{"anyOf":[{"maxLength":2048,"type":"string"},{"type":"null"}],"description":"LinkedIn-only: canonical URN or full LinkedIn post URL to reshare (repost). URLs are normalized to the canonical URN in storage and responses. Use values like urn:li:share:<id>, urn:li:ugcPost:<id>, or urn:li:groupPost:<id>.","examples":["urn:li:share:7437089188157554688","https://www.linkedin.com/posts/typefullycom_linkedin-mentions-just-got-a-lot-better-in-activity-7437089188157554688-wSxN"],"title":"Linkedin Reshare Target"}},"required":["text"],"title":"Post","type":"object"},"maxItems":25,"title":"Posts","type":"array"},"settings":{"anyOf":[{"additionalProperties":false,"description":"Settings specific to Mastodon","properties":{},"title":"MastodonSettings","type":"object"},{"type":"null"}],"description":"Mastodon-specific settings"}},"required":["enabled","posts"],"title":"EnabledMastodonPlatform","type":"object"},{"additionalProperties":false,"description":"Shared schema for all disabled platforms","properties":{"enabled":{"const":false,"enum":[false],"title":"Enabled","type":"boolean"}},"required":["enabled"],"title":"DisabledPlatform","type":"object"},{"type":"null"}],"description":"Mastodon configuration","title":"Mastodon"},"threads":{"anyOf":[{"additionalProperties":false,"description":"Enabled Threads platform with required data","properties":{"enabled":{"const":true,"enum":[true],"title":"Enabled","type":"boolean"},"posts":{"description":"List of posts for this platform","items":{"additionalProperties":false,"description":"Schema for individual post content","properties":{"text":{"description":"The text content of the post. For LinkedIn posts, you can tag companies with mention syntax: @[Company Name](urn:li:organization:123456).","examples":["Hello world! This is my first post.","Check out this amazing update! 🚀","Thanks @[Typefully](urn:li:organization:86779668) for the support!"],"maxLength":50000,"title":"Text","type":"string"},"media_ids":{"description":"List of media IDs to attach to the post. Obtain media IDs by uploading files via the media upload endpoint.","examples":[["550e8400-e29b-41d4-a716-446655440000"],["550e8400-e29b-41d4-a716-446655440000","6ba7b810-9dad-11d1-80b4-00c04fd430c8"]],"items":{"type":"string"},"maxItems":10,"title":"Media Ids","type":"array"},"paid_partnership":{"default":false,"description":"X-only: Whether this post should be labeled as a paid partnership.","examples":[true,false],"title":"Paid Partnership","type":"boolean"},"made_with_ai":{"default":false,"description":"X-only: Whether this post should be labeled as made with AI.","examples":[true,false],"title":"Made With Ai","type":"boolean"},"linkedin_reshare_target":{"anyOf":[{"maxLength":2048,"type":"string"},{"type":"null"}],"description":"LinkedIn-only: canonical URN or full LinkedIn post URL to reshare (repost). URLs are normalized to the canonical URN in storage and responses. Use values like urn:li:share:<id>, urn:li:ugcPost:<id>, or urn:li:groupPost:<id>.","examples":["urn:li:share:7437089188157554688","https://www.linkedin.com/posts/typefullycom_linkedin-mentions-just-got-a-lot-better-in-activity-7437089188157554688-wSxN"],"title":"Linkedin Reshare Target"}},"required":["text"],"title":"Post","type":"object"},"maxItems":25,"title":"Posts","type":"array"},"settings":{"anyOf":[{"additionalProperties":false,"description":"Settings specific to Threads","properties":{},"title":"ThreadsSettings","type":"object"},{"type":"null"}],"description":"Threads-specific settings"}},"required":["enabled","posts"],"title":"EnabledThreadsPlatform","type":"object"},{"additionalProperties":false,"description":"Shared schema for all disabled platforms","properties":{"enabled":{"const":false,"enum":[false],"title":"Enabled","type":"boolean"}},"required":["enabled"],"title":"DisabledPlatform","type":"object"},{"type":"null"}],"description":"Threads configuration","title":"Threads"},"bluesky":{"anyOf":[{"additionalProperties":false,"description":"Enabled Bluesky platform with required data","properties":{"enabled":{"const":true,"enum":[true],"title":"Enabled","type":"boolean"},"posts":{"description":"List of posts for this platform","items":{"additionalProperties":false,"description":"Schema for individual post content","properties":{"text":{"description":"The text content of the post. For LinkedIn posts, you can tag companies with mention syntax: @[Company Name](urn:li:organization:123456).","examples":["Hello world! This is my first post.","Check out this amazing update! 🚀","Thanks @[Typefully](urn:li:organization:86779668) for the support!"],"maxLength":50000,"title":"Text","type":"string"},"media_ids":{"description":"List of media IDs to attach to the post. Obtain media IDs by uploading files via the media upload endpoint.","examples":[["550e8400-e29b-41d4-a716-446655440000"],["550e8400-e29b-41d4-a716-446655440000","6ba7b810-9dad-11d1-80b4-00c04fd430c8"]],"items":{"type":"string"},"maxItems":10,"title":"Media Ids","type":"array"},"paid_partnership":{"default":false,"description":"X-only: Whether this post should be labeled as a paid partnership.","examples":[true,false],"title":"Paid Partnership","type":"boolean"},"made_with_ai":{"default":false,"description":"X-only: Whether this post should be labeled as made with AI.","examples":[true,false],"title":"Made With Ai","type":"boolean"},"linkedin_reshare_target":{"anyOf":[{"maxLength":2048,"type":"string"},{"type":"null"}],"description":"LinkedIn-only: canonical URN or full LinkedIn post URL to reshare (repost). URLs are normalized to the canonical URN in storage and responses. Use values like urn:li:share:<id>, urn:li:ugcPost:<id>, or urn:li:groupPost:<id>.","examples":["urn:li:share:7437089188157554688","https://www.linkedin.com/posts/typefullycom_linkedin-mentions-just-got-a-lot-better-in-activity-7437089188157554688-wSxN"],"title":"Linkedin Reshare Target"}},"required":["text"],"title":"Post","type":"object"},"maxItems":25,"title":"Posts","type":"array"},"settings":{"anyOf":[{"additionalProperties":false,"description":"Settings specific to Bluesky","properties":{},"title":"BlueskySettings","type":"object"},{"type":"null"}],"description":"Bluesky-specific settings"}},"required":["enabled","posts"],"title":"EnabledBlueskyPlatform","type":"object"},{"additionalProperties":false,"description":"Shared schema for all disabled platforms","properties":{"enabled":{"const":false,"enum":[false],"title":"Enabled","type":"boolean"}},"required":["enabled"],"title":"DisabledPlatform","type":"object"},{"type":"null"}],"description":"Bluesky configuration","title":"Bluesky"}},"title":"Platforms","type":"object"},{"type":"null"}],"description":"Platform configurations. Only provided platforms will be updated; omitted platforms remain unchanged."},"draft_title":{"anyOf":[{"maxLength":512,"type":"string"},{"type":"null"}],"description":"Human-readable title for the draft. This is for internal organization only and is not posted to social media. Omit to keep unchanged.","examples":["Weekly Newsletter","Product Launch Announcement"],"title":"Draft Title"},"scratchpad_text":{"anyOf":[{"type":"string"},{"type":"null"}],"description":"Plain text scratchpad notes for the draft. Formatting is stripped. Omit to keep unchanged.","examples":["line 1\nline 2\n\nline 4"],"title":"Scratchpad Text"},"tags":{"anyOf":[{"items":{"type":"string"},"maxItems":10,"type":"array"},{"type":"null"}],"description":"List of tag slugs (not names) associated with this draft. Use the /tags endpoint to get available tags with their slugs. Tags must already exist in the social set. Omit to keep unchanged.","examples":[["marketing","product"],["newsletter"],[]],"title":"Tags"},"share":{"anyOf":[{"type":"boolean"},{"type":"null"}],"description":"Whether to generate a public share URL. Omit to keep unchanged.","title":"Share"},"publish_at":{"anyOf":[{"format":"date-time","type":"string"},{"enum":["now","next-free-slot"],"type":"string"},{"type":"null"}],"description":"When to publish the draft. Options: \"now\" to publish immediately, \"next-free-slot\" to schedule to your next available posting slot, or an ISO 8601 datetime string with timezone for a specific future time (e.g., '2025-01-20T14:00:00Z' for UTC or '2025-01-20T09:00:00-05:00' for EST). Timezone is required. Omit to keep unchanged.","examples":["2025-12-20T09:00:00-05:00","now","next-free-slot"],"title":"Publish At"},"force_overwrite_comments":{"default":false,"description":"Comment-thread anchor preservation toggle. When false (the default), submitting `posts[*].text` whose `<typ:comment-thread>` markers don't match the draft's stored comment threads is rejected with `409 COMMENTS_MARKER_MISMATCH`. Recover by re-including the missing markers and retrying. When true, missing markers are accepted: the affected comment threads are resolved server-side and their anchors are stripped from the draft. Markers that ARE submitted continue to be validated and re-anchored normally. StrictBool: only the JSON literals `true`/`false` are accepted (not `\"true\"` strings).","title":"Force Overwrite Comments","type":"boolean"}},"title":"DraftUpdateRequest","type":"object"}},"required":["social_set_id","draft_id","requestBody"]}
```

## `typefully_create_media_upload`

**Generate a presigned S3 upload URL for images, videos, GIFs, or PDFs. After you receive the URL, upload the file contents with a PUT request and then reference the returned media_id when creating drafts.

**Uploading:** Send a plain PUT with only raw file bytes as the body — no extra headers (`Content-Type`, `Authorization`, etc.). The presigned URL signature was calculated without them, so adding headers causes a `403 SignatureDoesNotMatch`. Use `curl -T <file>` (not `--data-binary`), `requests.put(url, data=file_bytes)` in Python, or `fetch(url, {method:'PUT', body:buffer})` in JS. A successful upload returns `200` or `204`.

**Required permission:** WRITE access to the social set.**

```json
{"type":"object","properties":{"social_set_id":{"title":"Social Set Id","type":"number"},"requestBody":{"description":"Schema for media upload request","properties":{"file_name":{"description":"Original filename with extension (e.g., 'image.jpg', 'video.mp4'). Used for MIME type detection and display. Allowed characters: letters, numbers, hyphens, underscores, periods, parentheses. Allowed extensions: .jpg, .jpeg, .png, .webp, .gif, .mp4, .mov, .pdf","examples":["profile-photo.jpg","demo-video.mp4","screenshot.png"],"maxLength":255,"pattern":"(?i)^[a-zA-Z0-9_.()\\-]+\\.(jpg|jpeg|png|webp|gif|mp4|mov|pdf)$","title":"File Name","type":"string"}},"required":["file_name"],"title":"MediaUploadRequest","type":"object"}},"required":["social_set_id","requestBody"]}
```

## `typefully_get_media_status`

**Retrieves the processing status of an uploaded media file. Poll this endpoint after uploading to check when the file is ready to use in drafts.

**Required permission:** READ access to the social set.**

```json
{"type":"object","properties":{"social_set_id":{"title":"Social Set Id","type":"number"},"media_id":{"format":"uuid","title":"Media Id","type":"string"}},"required":["social_set_id","media_id"]}
```

## `typefully_list_tags`

**Retrieve all tags for a social set, ordered by their slugs.

**Required permission:** READ access to the social set.**

```json
{"type":"object","properties":{"social_set_id":{"title":"Social Set Id","type":"number"},"limit":{"anyOf":[{"maximum":50,"minimum":1,"type":"integer"},{"type":"null"}],"default":10,"description":"Maximum number of items to return per page","title":"Limit"},"offset":{"default":0,"description":"Number of items to skip from the beginning","minimum":0,"title":"Offset","type":"number"}},"required":["social_set_id"]}
```

## `typefully_create_tag`

**Create a new tag for a social set. The slug is automatically generated from the tag name, which must be unique per social set.

**Required permission:** WRITE access to the social set.**

```json
{"type":"object","properties":{"social_set_id":{"title":"Social Set Id","type":"number"},"requestBody":{"additionalProperties":false,"description":"Request schema for creating a tag","examples":[{"name":"Marketing"},{"name":"Product Launch"},{"name":"Weekly Newsletter"}],"properties":{"name":{"description":"Display name for the tag. The slug will be auto-generated from this name.","examples":["Marketing","Product Launch","Weekly Updates"],"maxLength":32,"minLength":1,"title":"Name","type":"string"}},"required":["name"],"title":"TagCreateRequest","type":"object"}},"required":["social_set_id","requestBody"]}
```

## `typefully_get_queue_schedule`

**Retrieve the queue schedule rules for a social set.

**Required permission:** READ access to this social set.

Behavior:
- If the schedule row does not exist yet, it is created with defaults.**

```json
{"type":"object","properties":{"social_set_id":{"title":"Social Set Id","type":"number"}},"required":["social_set_id"]}
```

## `typefully_queue_put_queue_schedule`

**Replace the queue schedule rules for a social set.

**Required permission:** ADMIN access to this social set.
Semantics: full replacement (atomic).

Rule validation:
- `h` in `0..23`, `m` in `0..59`
- `days` values are one of: `mon,tue,wed,thu,fri,sat,sun`
- Duplicate day+time combinations are rejected

Note: `rules=[]` is allowed and represents an empty schedule.**

```json
{"type":"object","properties":{"social_set_id":{"title":"Social Set Id","type":"number"},"requestBody":{"additionalProperties":false,"description":"Request schema for fully replacing queue schedule rules.","properties":{"rules":{"description":"New schedule rules (full replacement).","items":{"additionalProperties":false,"description":"Single schedule rule (local time + days of week).","properties":{"h":{"description":"Hour in 24h clock (0-23)","maximum":23,"minimum":0,"title":"H","type":"number"},"m":{"description":"Minute (0-59)","maximum":59,"minimum":0,"title":"M","type":"number"},"days":{"description":"Days of week this rule applies to","examples":[["mon","tue","wed","thu","fri"]],"items":{"enum":["mon","tue","wed","thu","fri","sat","sun"],"type":"string"},"minItems":1,"title":"Days","type":"array"}},"required":["h","m","days"],"title":"QueueScheduleRuleSchema","type":"object"},"title":"Rules","type":"array"}},"required":["rules"],"title":"QueueScheduleUpdateRequest","type":"object"}},"required":["social_set_id","requestBody"]}
```

## `typefully_get_queue`

**Retrieve queue slots and scheduled drafts between `start_date` and `end_date` (inclusive).

**Required permission:** READ access to this social set.

Notes:
- `start_date` and `end_date` are interpreted in the social set timezone.
- Ranges larger than 62 days are rejected.**

```json
{"type":"object","properties":{"social_set_id":{"title":"Social Set Id","type":"number"},"start_date":{"title":"Start Date","type":"string"},"end_date":{"title":"End Date","type":"string"}},"required":["social_set_id","start_date","end_date"]}
```

## `typefully_linkedin_resolve_linkedin_organization_from_url`

**Resolve a LinkedIn company/school URL into organization metadata that can be used to build LinkedIn mention syntax in post text.

This endpoint is resolver-only and is not a general organization search endpoint.

Mention format: `@[Company Name](urn:li:organization:123456)`

**Required permission:** READ access to the social set.**

```json
{"type":"object","properties":{"social_set_id":{"title":"Social Set Id","type":"number"},"organization_url":{"description":"Public LinkedIn organization URL (company or school profile).","examples":["https://www.linkedin.com/company/typefullycom","https://www.linkedin.com/school/harvard-university/"],"title":"Organization Url","type":"string"}},"required":["social_set_id","organization_url"]}
```

## `typefully_list_comments`

**Retrieve comment threads attached to a draft, ordered by creation time. Each thread includes the original `selected_text` snapshot and the full ordered list of comments.

**Required permission:** READ access to this social set.**

```json
{"type":"object","properties":{"social_set_id":{"title":"Social Set Id","type":"number"},"draft_id":{"title":"Draft Id","type":"number"},"platform":{"anyOf":[{"enum":["x","linkedin","mastodon","threads","bluesky"],"type":"string"},{"type":"null"}],"title":"Platform"},"status":{"default":"unresolved","enum":["unresolved","resolved","all"],"title":"Status","type":"string"},"limit":{"default":10,"maximum":50,"minimum":1,"title":"Limit","type":"number"},"offset":{"default":0,"minimum":0,"title":"Offset","type":"number"}},"required":["social_set_id","draft_id"]}
```

## `typefully_create_comment`

**Create a new comment thread on a draft. The thread is anchored to a substring of a post (`selected_text`); use `occurrence` to disambiguate when the same substring appears more than once in the post. Omit `occurrence` to anchor on the first match.

LinkedIn mentions appear in `posts[*].text` as `@[Name](urn:li:organization:ID)` or `@[Name](urn:li:person:ID)`. A mention is indivisible — `selected_text` must either contain the entire mention substring or stay outside it.

**Required permission:** WRITE access to this social set.**

```json
{"type":"object","properties":{"social_set_id":{"title":"Social Set Id","type":"number"},"draft_id":{"title":"Draft Id","type":"number"},"requestBody":{"additionalProperties":false,"description":"Create a new comment thread anchored on a span of a draft post.","properties":{"post_index":{"description":"Zero-based index of the target post within the platform's posts array.","minimum":0,"title":"Post Index","type":"number"},"platform":{"anyOf":[{"enum":["x","linkedin","mastodon","threads","bluesky"],"type":"string"},{"type":"null"}],"description":"Required when the draft has multiple commentable platforms; otherwise resolves to the source platform.","title":"Platform"},"selected_text":{"description":"Exact substring (codepoint-equal) of the post's flat text the comment thread is anchored to. Copy verbatim from the GET response.\n\nLinkedIn mentions appear inside `posts[*].text` as `@[Name](urn:li:organization:ID)` or `@[Name](urn:li:person:ID)`. Mentions are indivisible — `selected_text` may either include the entire mention substring or stay outside it. A selection that starts or ends in the middle of a mention is rejected with `400 VALIDATION_ERROR`.","maxLength":50000,"minLength":1,"title":"Selected Text","type":"string"},"occurrence":{"default":0,"description":"Zero-based occurrence of `selected_text` within the post when the same substring appears multiple times.","maximum":10000,"minimum":0,"title":"Occurrence","type":"number"},"text":{"description":"Plain-text comment body. The server derives the stored rich_text from this.","maxLength":10000,"minLength":1,"title":"Text","type":"string"}},"required":["post_index","selected_text","text"],"title":"CommentThreadCreateRequest","type":"object"}},"required":["social_set_id","draft_id","requestBody"]}
```

## `typefully_comments_add_comment_to_thread`

**Append a comment to an existing comment thread. Returns the full updated thread.

**Required permission:** WRITE access to this social set.**

```json
{"type":"object","properties":{"social_set_id":{"title":"Social Set Id","type":"number"},"draft_id":{"title":"Draft Id","type":"number"},"comment_thread_id":{"format":"uuid","title":"Comment Thread Id","type":"string"},"requestBody":{"additionalProperties":false,"description":"Add a comment to an existing comment thread.","properties":{"text":{"description":"Plain-text comment body. The server derives the stored rich_text from this.","maxLength":10000,"minLength":1,"title":"Text","type":"string"}},"required":["text"],"title":"CommentCreateRequest","type":"object"}},"required":["social_set_id","draft_id","comment_thread_id","requestBody"]}
```

## `typefully_comments_resolve_thread`

**Resolves the comment thread and removes the corresponding comment markers from the text.

**Required permission:** Either authorship of the comment thread or WRITE access on the social set.**

```json
{"type":"object","properties":{"social_set_id":{"title":"Social Set Id","type":"number"},"draft_id":{"title":"Draft Id","type":"number"},"comment_thread_id":{"format":"uuid","title":"Comment Thread Id","type":"string"}},"required":["social_set_id","draft_id","comment_thread_id"]}
```

## `typefully_delete_comment`

**Deletes a comment from a comment thread. If `comment_id` identifies the *root* (oldest) comment, the entire thread is deleted and the corresponding comment markers are removed from the text.

**Required permission:** Authorship of the comment or WRITE access on the social set.**

```json
{"type":"object","properties":{"social_set_id":{"title":"Social Set Id","type":"number"},"draft_id":{"title":"Draft Id","type":"number"},"comment_thread_id":{"format":"uuid","title":"Comment Thread Id","type":"string"},"comment_id":{"format":"uuid","title":"Comment Id","type":"string"}},"required":["social_set_id","draft_id","comment_thread_id","comment_id"]}
```

## `typefully_update_comment`

**Update the plain-text body of a single comment. Returns the full updated thread.

**Required permission:** Authorship of the comment.**

```json
{"type":"object","properties":{"social_set_id":{"title":"Social Set Id","type":"number"},"draft_id":{"title":"Draft Id","type":"number"},"comment_thread_id":{"format":"uuid","title":"Comment Thread Id","type":"string"},"comment_id":{"format":"uuid","title":"Comment Id","type":"string"},"requestBody":{"additionalProperties":false,"description":"Update the text body of a single comment within a comment thread.","properties":{"text":{"description":"Plain-text comment body. The server derives the stored rich_text from this.","maxLength":10000,"minLength":1,"title":"Text","type":"string"}},"required":["text"],"title":"CommentUpdateRequest","type":"object"}},"required":["social_set_id","draft_id","comment_thread_id","comment_id","requestBody"]}
```

## `typefully_delete_thread`

**Deletes the comment thread along with all its comments and removes the corresponding comment markers from the text.

**Required permission:** Authorship of the comment thread or WRITE access on the social set.**

```json
{"type":"object","properties":{"social_set_id":{"title":"Social Set Id","type":"number"},"draft_id":{"title":"Draft Id","type":"number"},"comment_thread_id":{"format":"uuid","title":"Comment Thread Id","type":"string"}},"required":["social_set_id","draft_id","comment_thread_id"]}
```

