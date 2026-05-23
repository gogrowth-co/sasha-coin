#!/usr/bin/env node
// Verify auth for a Typefully account.
// Usage: node whoami.js --account SASHA_COIN

const { parseArgs, resolveAccount, callTool } = require("./lib/resolve");

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { account, token } = resolveAccount(args);
  const me = await callTool(token, "typefully_get_me", {});
  console.log(JSON.stringify({ account, ...me }, null, 2));
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
