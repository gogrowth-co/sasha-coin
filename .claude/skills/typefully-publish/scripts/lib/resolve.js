// Shared helpers for Typefully scripts.
// Resolves --account into env var + social_set_id from per-project
// _context/typefully-accounts.json registry (or directly from env).
//
// Multi-account convention:
//   TYPEFULLY_API_KEY_<ACCOUNT>           — API key per account (Typefully social set)
//   _context/typefully-accounts.json      — logical-name → social_set_id map per project
//
// Transport: Streamable HTTP JSON-RPC against https://mcp.typefully.com/mcp.
// The API key is passed as a query string param (?TYPEFULLY_API_KEY=...).

const fs = require("fs");
const path = require("path");

const MCP_BASE = "https://mcp.typefully.com/mcp";

function parseArgs(argv) {
  const args = { _repeated: {} };
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    if (key in args) {
      args._repeated[key] = args._repeated[key] || [args[key]];
      args._repeated[key].push(val);
    }
    args[key] = val;
  }
  return args;
}

function getRepeated(args, key) {
  if (args._repeated[key]) return args._repeated[key];
  if (args[key] === undefined || args[key] === true) return [];
  return [args[key]];
}

function loadEnvFile() {
  const candidates = [
    path.join(process.cwd(), ".env"),
    path.join(__dirname, "../../../../../.env"),
  ];
  for (const f of candidates) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, "utf8").split("\n")) {
      const idx = line.indexOf("=");
      if (idx <= 0) continue;
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      if (k && !process.env[k]) process.env[k] = v;
    }
    return f;
  }
  return null;
}

function loadRegistry() {
  const candidates = [
    path.join(process.cwd(), "_context/typefully-accounts.json"),
    path.join(process.cwd(), "typefully-accounts.json"),
  ];
  for (const f of candidates) {
    if (fs.existsSync(f)) {
      return { path: f, data: JSON.parse(fs.readFileSync(f, "utf8")) };
    }
  }
  return null;
}

function resolveAccount(args) {
  loadEnvFile();
  const registry = loadRegistry();

  let account = args.account;
  if (!account && registry?.data?.default_account) account = registry.data.default_account;
  if (!account) {
    throw new Error("Missing --account flag (and no default_account in typefully-accounts.json)");
  }
  account = String(account).toUpperCase().replace(/-/g, "_");

  const tokenKey = `TYPEFULLY_API_KEY_${account}`;
  const token = process.env[tokenKey] || process.env.TYPEFULLY_API_KEY;
  if (!token) {
    throw new Error(`Missing env var ${tokenKey} (and no fallback TYPEFULLY_API_KEY)`);
  }

  // Optional: social_set_id resolution (only required for ops scoped to one social set)
  let socialSetId = args["social-set-id"] ? Number(args["social-set-id"]) : null;
  if (!socialSetId && registry?.data?.accounts?.[account]?.social_set_id) {
    socialSetId = Number(registry.data.accounts[account].social_set_id);
  }

  return { account, token, socialSetId, registry: registry?.data };
}

async function typefullyMCP(token, method, params = {}) {
  const url = `${MCP_BASE}?TYPEFULLY_API_KEY=${encodeURIComponent(token)}`;
  const body = { jsonrpc: "2.0", id: Date.now(), method, params };
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Typefully HTTP ${r.status}: ${txt}`);
  }
  // Server returns SSE-style `event: message\ndata: {...}` even for one-shot replies.
  const raw = await r.text();
  const dataLines = raw
    .split("\n")
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.replace(/^data:\s*/, ""));
  if (!dataLines.length) {
    throw new Error("Typefully MCP returned no data lines: " + raw.slice(0, 500));
  }
  const last = JSON.parse(dataLines[dataLines.length - 1]);
  if (last.error) {
    throw new Error("Typefully MCP error: " + JSON.stringify(last.error));
  }
  return last.result;
}

async function callTool(token, name, args = {}) {
  const result = await typefullyMCP(token, "tools/call", { name, arguments: args });
  const block = result?.content?.[0];
  if (!block) return result;
  if (block.type === "text") {
    // Typefully tools wrap REST responses as text. Two prefixes:
    //   "API Response (Status: 2xx):\n<JSON>"   — success
    //   "API Error: Status NNN (...). Response: <JSON>" — error
    const okMatch = block.text.match(/^API Response \(Status: (\d+)\):\s*([\s\S]*)$/);
    if (okMatch) {
      const [, status, payload] = okMatch;
      try {
        return { _status: Number(status), ...JSON.parse(payload) };
      } catch {
        return { _status: Number(status), _raw: payload };
      }
    }
    const errMatch = block.text.match(/^API Error:\s*Status\s*(\d+)[\s\S]*?Response:\s*([\s\S]*)$/);
    if (errMatch) {
      const [, status, payload] = errMatch;
      let body;
      try {
        body = JSON.parse(payload);
      } catch {
        body = { raw: payload };
      }
      const summary = body?.error?.message || body?.error?.code || `Status ${status}`;
      const err = new Error(`Typefully API ${status}: ${summary}`);
      err.status = Number(status);
      err.body = body;
      throw err;
    }
    try {
      return JSON.parse(block.text);
    } catch {
      return block.text;
    }
  }
  return block;
}

module.exports = { parseArgs, getRepeated, resolveAccount, typefullyMCP, callTool, MCP_BASE };
