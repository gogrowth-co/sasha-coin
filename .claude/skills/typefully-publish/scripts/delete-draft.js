#!/usr/bin/env node
// Delete a Typefully draft.
// Usage: node delete-draft.js --account SASHA_COIN --draft-id 9156633

const { parseArgs, resolveAccount, callTool } = require("./lib/resolve");

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { account, token, socialSetId } = resolveAccount(args);
  if (!socialSetId) throw new Error("Missing social_set_id (see typefully-accounts.json)");
  const draftId = Number(args["draft-id"]);
  if (!draftId) throw new Error("Missing --draft-id");

  const result = await callTool(token, "typefully_delete_draft", {
    social_set_id: socialSetId,
    draft_id: draftId,
  });
  console.log(JSON.stringify({ account, draft_id: draftId, deleted: true, result }, null, 2));
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
