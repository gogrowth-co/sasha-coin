#!/usr/bin/env node
// List drafts/scheduled/published posts for an account.
// Usage:
//   node list-drafts.js --account SASHA_COIN
//   node list-drafts.js --account SASHA_COIN --status scheduled
//   node list-drafts.js --account SASHA_COIN --status published --limit 25
//
// Statuses: draft (default) | scheduled | published

const { parseArgs, resolveAccount, callTool } = require("./lib/resolve");

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { account, token, socialSetId } = resolveAccount(args);
  if (!socialSetId) throw new Error("Missing social_set_id (see typefully-accounts.json)");

  const status = String(args.status || "draft").toLowerCase();
  const limit = Number(args.limit || 25);
  const offset = Number(args.offset || 0);

  const result = await callTool(token, "typefully_list_drafts", {
    social_set_id: socialSetId,
    status,
    limit,
    offset,
  });

  const rows = (result?.results || []).map((d) => ({
    id: d.id,
    status: d.status,
    scheduled_date: d.scheduled_date,
    published_at: d.published_at,
    preview: (d.preview || "").slice(0, 80),
    private_url: d.private_url,
  }));

  console.log(JSON.stringify({ account, status, count: result?.count ?? rows.length, results: rows }, null, 2));
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
