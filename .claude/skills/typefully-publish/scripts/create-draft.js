#!/usr/bin/env node
// Create a Typefully draft (single tweet or full thread).
// The draft is saved as a draft by default. Pass --schedule "next-free-slot"
// or --schedule "2026-05-20T14:00:00Z" to schedule. Pass --publish to post now.
//
// Usage:
//   node create-draft.js --account SASHA_COIN --thread "tweet 1" --thread "tweet 2"
//   node create-draft.js --account SASHA_COIN --file path/to/thread.md
//   node create-draft.js --account SASHA_COIN --file thread.md --schedule "next-free-slot"
//   node create-draft.js --account SASHA_COIN --file thread.md --publish
//
// File format: separate tweets with 4 consecutive newlines (Typefully convention).
//
// Channels: defaults to X. Pass --channels x,linkedin to multi-publish.

const fs = require("fs");
const path = require("path");
const { parseArgs, getRepeated, resolveAccount, callTool } = require("./lib/resolve");

function parseThreadFile(filePath) {
  const txt = fs.readFileSync(filePath, "utf8");
  return txt
    .split(/\n{4,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildPlatformPosts(tweets) {
  return tweets.map((text) => ({ text }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { account, token, socialSetId } = resolveAccount(args);

  if (!socialSetId) {
    throw new Error(
      "Missing social_set_id. Set it in _context/typefully-accounts.json " +
        "(accounts.<ACCOUNT>.social_set_id) or pass --social-set-id <id>."
    );
  }

  // Collect tweets — either repeated --thread "text" args or one --file path
  let tweets = getRepeated(args, "thread").map(String).filter(Boolean);
  if (!tweets.length && args.file) {
    tweets = parseThreadFile(path.resolve(args.file));
  }
  if (!tweets.length && args.text) {
    tweets = [String(args.text)];
  }
  if (!tweets.length) {
    throw new Error("No tweet text supplied. Use --thread \"...\" (repeatable), --text \"...\", or --file path.");
  }

  // Channels — default to X
  const channels = String(args.channels || "x")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const platforms = {};
  for (const ch of channels) {
    platforms[ch] = { enabled: true, posts: buildPlatformPosts(tweets) };
  }

  // Build request body. publish_at is a TOP-LEVEL field on requestBody
  // (not nested under `schedule`). Accepts "now", "next-free-slot", or
  // an ISO 8601 datetime with timezone. Omit entirely to save as draft.
  const requestBody = { platforms };

  if (args.schedule) {
    requestBody.publish_at = String(args.schedule);
  } else if (args.publish) {
    requestBody.publish_at = "now";
  }

  // Note: Typefully's create_draft schema does NOT accept a top-level `title`
  // field at requestBody root. Use --draft-title to set the internal draft
  // title (which Typefully calls draft_title, not title).
  if (args["draft-title"]) requestBody.draft_title = String(args["draft-title"]);
  if (args.tags) {
    requestBody.tag_ids = String(args.tags)
      .split(",")
      .map((s) => Number(s.trim()))
      .filter(Boolean);
  }

  let result = await callTool(token, "typefully_create_draft", {
    social_set_id: socialSetId,
    requestBody,
  });

  // Publish is async — the create call returns status: "draft" before the
  // publish task completes (~10s). Poll for up to 30s when --publish is set
  // so the response surfaces x_published_url.
  if (args.publish && result?.id) {
    const draftId = result.id;
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const refresh = await callTool(token, "typefully_get_draft", {
          social_set_id: socialSetId,
          draft_id: draftId,
        });
        if (refresh?.status === "published" || refresh?.x_published_url) {
          result = refresh;
          break;
        }
      } catch (e) {
        // 4xx on edit/get during transition is normal — keep polling
      }
    }
  }

  const summary = {
    account,
    social_set_id: socialSetId,
    draft_id: result?.id || result?.draft_id || null,
    status: result?.status || null,
    scheduled_date: result?.scheduled_date || null,
    published_at: result?.published_at || null,
    x_published_url: result?.x_published_url || null,
    private_url: result?.private_url || null,
    share_url: result?.share_url || null,
    tweet_count: tweets.length,
    channels,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (process.env.TYPEFULLY_DEBUG) {
    console.error(JSON.stringify(result, null, 2));
  }
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
