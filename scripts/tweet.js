#!/usr/bin/env node
// Post a tweet via Buffer API (immediate scheduling).
// Usage: node scripts/tweet.js --text "tweet text" [--reply-to <tweet_id>] [--dry-run]
// Env: BUFFER_ACCESS_TOKEN_SASHA_COIN (or BUFFER_ACCESS_TOKEN), BUFFER_CHANNEL_ID_SASHA_COIN_X (or BUFFER_CHANNEL_ID)
//
// Output on success: "SUCCESS\n<json with tweet_id and text>"
// tweet_id format: "buffer:<postId>" — Buffer queues the post for immediate (~60s) publishing

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const textIndex = args.indexOf('--text')
const replyIndex = args.indexOf('--reply-to')

if (textIndex === -1 || !args[textIndex + 1]) {
    console.error('ERROR: --text required')
    process.exit(1)
}

const tweetText = args[textIndex + 1]
// Note: Buffer does not support reply threading natively — reply-to is stored in log only
const replyToId = replyIndex !== -1 ? args[replyIndex + 1] : null

const BUFFER_TOKEN    = process.env.BUFFER_ACCESS_TOKEN_SASHA_COIN || process.env.BUFFER_ACCESS_TOKEN
const BUFFER_CHANNEL  = process.env.BUFFER_CHANNEL_ID_SASHA_COIN_X || process.env.BUFFER_CHANNEL_ID

if (!BUFFER_TOKEN || !BUFFER_CHANNEL) {
    console.error('ERROR: Missing Buffer credentials (BUFFER_ACCESS_TOKEN_SASHA_COIN, BUFFER_CHANNEL_ID_SASHA_COIN_X)')
    process.exit(1)
}

const API_ENDPOINT = 'https://api.buffer.com'

// Schedule for "now" — Buffer treats current/past timestamps as post-immediately
const scheduledAt = new Date(Date.now() + 30_000).toISOString()

const QUERY = `
mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    ... on PostActionSuccess {
      post { id text }
    }
    ... on MutationError {
      message
    }
  }
}
`

const variables = {
    input: {
        channelId: BUFFER_CHANNEL,
        schedulingType: 'automatic',
        mode: 'customScheduled',
        dueAt: scheduledAt,
        text: tweetText,
    }
}

if (DRY_RUN) {
    console.log('DRY_RUN:', JSON.stringify({ query: QUERY.trim(), variables }, null, 2))
    process.exit(0)
}

try {
    const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${BUFFER_TOKEN}`,
        },
        body: JSON.stringify({ query: QUERY, variables }),
    })

    if (!response.ok) {
        const errText = await response.text()
        console.error(`ERROR: HTTP ${response.status}: ${errText}`)
        process.exit(1)
    }

    const data = await response.json()
    const post = data?.data?.createPost?.post
    const mutationError = data?.data?.createPost?.message

    if (mutationError) {
        console.error(`ERROR: Buffer mutation error: ${mutationError}`)
        process.exit(1)
    }

    if (!post?.id) {
        console.error('ERROR: No post ID in response:', JSON.stringify(data))
        process.exit(1)
    }

    console.log('SUCCESS')
    console.log(JSON.stringify({
        tweet_id: `buffer:${post.id}`,
        text: post.text || tweetText,
        buffer_post_id: post.id,
        scheduled_at: scheduledAt,
        reply_to: replyToId || null,
    }))
    process.exit(0)
} catch (err) {
    console.error('ERROR:', err.message)
    process.exit(1)
}
