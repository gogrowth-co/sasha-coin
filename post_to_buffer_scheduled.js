// POC: schedule an image post to Buffer at a specific time (5 min from now).
// Not in production cron; kept as reference for future image-attached posts.
// Env: BUFFER_ACCESS_TOKEN, BUFFER_CHANNEL_ID

const { BUFFER_ACCESS_TOKEN, BUFFER_CHANNEL_ID } = process.env;
if (!BUFFER_ACCESS_TOKEN || !BUFFER_CHANNEL_ID) {
  console.error("ERROR: Missing BUFFER_ACCESS_TOKEN or BUFFER_CHANNEL_ID env var");
  process.exit(1);
}

const API_ENDPOINT = "https://api.buffer.com";
const args = process.argv.slice(2);
const textIndex = args.indexOf("--text");
const imageIndex = args.indexOf("--image");
const dueIndex = args.indexOf("--due-at");
if (textIndex === -1 || !args[textIndex + 1]) {
  console.error("ERROR: --text required");
  process.exit(1);
}
const POST_TEXT = args[textIndex + 1];
const IMAGE_URL = imageIndex !== -1 ? args[imageIndex + 1] : null;
const dueAtTime = dueIndex !== -1 ? args[dueIndex + 1] : new Date(Date.now() + 5 * 60 * 1000).toISOString();

const QUERY = `
mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    ... on PostActionSuccess {
      post {
        id
        text
        assets { id mimeType }
      }
    }
    ... on MutationError {
      message
    }
  }
}
`;

const input = {
  channelId: BUFFER_CHANNEL_ID,
  schedulingType: "automatic",
  mode: "customScheduled",
  text: POST_TEXT,
  dueAt: dueAtTime,
};
if (IMAGE_URL) {
  input.assets = { images: [{ url: IMAGE_URL }] };
}

async function postToBuffer() {
  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BUFFER_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ query: QUERY, variables: { input } }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("ERROR:", error.message);
    process.exit(1);
  }
}

postToBuffer();