// Post a tweet to Buffer's queue (autoschedule). Used by twitter-scheduled-post skill.
// Usage: node post_to_buffer.js --text "tweet text" [--dry-run]
// Env: BUFFER_ACCESS_TOKEN, BUFFER_CHANNEL_ID

const { BUFFER_ACCESS_TOKEN, BUFFER_CHANNEL_ID } = process.env;

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

if (!BUFFER_ACCESS_TOKEN || !BUFFER_CHANNEL_ID) {
  console.error("ERROR: Missing BUFFER_ACCESS_TOKEN or BUFFER_CHANNEL_ID env var");
  process.exit(1);
}

const API_ENDPOINT = "https://api.buffer.com";
const textIndex = args.indexOf("--text");
if (textIndex === -1 || !args[textIndex + 1]) {
  console.error("ERROR: --text required");
  process.exit(1);
}
const POST_TEXT = args[textIndex + 1];

const QUERY = "mutation CreatePost($input: CreatePostInput!) { createPost(input: $input) { ... on PostActionSuccess { post { id text } } ... on MutationError { message } } }";
const VARIABLES = { input: { channelId: BUFFER_CHANNEL_ID, schedulingType: "automatic", mode: "addToQueue", text: POST_TEXT } };

if (DRY_RUN) {
  console.log("DRY_RUN:", JSON.stringify({ query: QUERY, variables: VARIABLES }, null, 2));
  process.exit(0);
}

async function postToBuffer() {
  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + BUFFER_ACCESS_TOKEN },
      body: JSON.stringify({ query: QUERY, variables: VARIABLES })
    });
    if (!response.ok) {
      const e = await response.text();
      throw new Error("HTTP " + response.status + ": " + e);
    }
    const data = await response.json();
    if (data.data && data.data.createPost && data.data.createPost.post && data.data.createPost.post.id) {
      console.log("SUCCESS");
      console.log(JSON.stringify(data.data.createPost.post));
    } else {
      console.error("ERROR:", JSON.stringify(data));
      process.exit(1);
    }
  } catch (e) {
    console.error("ERROR:", e.message);
    process.exit(1);
  }
}

postToBuffer();
