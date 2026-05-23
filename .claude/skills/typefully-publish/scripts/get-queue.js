#!/usr/bin/env node
// Show the auto-schedule queue and upcoming scheduled posts.
// Usage: node get-queue.js --account SASHA_COIN

const { parseArgs, resolveAccount, callTool } = require("./lib/resolve");

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { account, token, socialSetId } = resolveAccount(args);
  if (!socialSetId) throw new Error("Missing social_set_id");

  const schedule = await callTool(token, "typefully_get_queue_schedule", { social_set_id: socialSetId });

  // typefully_get_queue requires a date range. Default: today → +30d
  const now = new Date();
  const end = new Date(now.getTime() + 30 * 86400 * 1000);
  const startDate = args["start-date"] || now.toISOString().slice(0, 10);
  const endDate = args["end-date"] || end.toISOString().slice(0, 10);

  const queue = await callTool(token, "typefully_get_queue", {
    social_set_id: socialSetId,
    start_date: startDate,
    end_date: endDate,
  });

  console.log(JSON.stringify({ account, start_date: startDate, end_date: endDate, schedule, queue }, null, 2));
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
