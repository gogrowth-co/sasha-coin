#!/usr/bin/env node
// List Typefully social sets (= connected accounts).
// Usage: node list-social-sets.js --account SASHA_COIN

const { parseArgs, resolveAccount, callTool } = require("./lib/resolve");

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { account, token } = resolveAccount(args);
  const result = await callTool(token, "typefully_list_social_sets", {});
  console.log(JSON.stringify({ account, ...result }, null, 2));
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
