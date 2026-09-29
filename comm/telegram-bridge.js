// BlockDNS Telegram bridge v2: listens on the owner's bots and logs everything
// to comm/inbox.md, answering simple commands instantly.
//
// Modes:
//   node telegram-bridge.js          -> GROUP bot (@BlockDnsL2) [broadcast + owner inbox]
//   node telegram-bridge.js dm       -> PRIVATE DM bot (@anahoabot) [owner <-> agent]
//
// Only ONE instance per bot token may poll (getUpdates -> 409 Conflict otherwise).
// Restart after reboot: powershell -ExecutionPolicy Bypass -File comm\start-bridge.ps1
// Secrets live in comm/bridge.env (gitignored), with fallback to social-agent/.env.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const COMM = __dirname;
const INBOX = path.join(COMM, "inbox.md");
const OUTBOX = path.join(COMM, "outbox.md");
const ENV = path.join(COMM, "bridge.env");
const LEGACY_ENV = path.join(ROOT, "social-agent", ".env");
const DEPLOY = path.join(ROOT, "deployments", "base-sepolia.json");

const MODE = process.argv[2] === "dm" ? "dm" : "group";

function readEnv(file, key) {
  try {
    const raw = fs.readFileSync(file, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && m[1] === key) return m[2].trim();
    }
  } catch {}
  return "";
}

let BOT_TOKEN;
let GROUP_ID = "";

if (MODE === "dm") {
  BOT_TOKEN =
    readEnv(ENV, "BRIDGE_DM_TOKEN") ||
    readEnv(ENV, "ANAHOA_BOT_TOKEN");
  GROUP_ID = "";
} else {
  BOT_TOKEN = readEnv(ENV, "BRIDGE_GROUP_TOKEN") || readEnv(LEGACY_ENV, "TELEGRAM_BOT_TOKEN");
  GROUP_ID = readEnv(ENV, "BRIDGE_GROUP_ID") || readEnv(LEGACY_ENV, "TELEGRAM_CHAT_ID") || "-1003721067719";
}

if (!BOT_TOKEN) {
  console.error("No bot token configured. Exiting.");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const OFFSET = path.join(COMM, `.offset.${crypto.createHash("sha1").update(BOT_TOKEN).digest("hex").slice(0, 8)}`);

let offset = readOffset();

function readOffset() {
  try {
    const v = fs.readFileSync(OFFSET, "utf8").trim();
    return v ? Number(v) : 0;
  } catch {
    return 0;
  }
}

function saveOffset(n) {
  try {
    fs.writeFileSync(OFFSET, String(n));
  } catch (e) {
    console.error("offset save failed", e.message);
  }
}

function writeLog(kind, entry) {
  const stamp = new Date().toISOString();
  fs.appendFileSync(
    kind === "inbox" ? INBOX : OUTBOX,
    `\n## ${stamp} (${kind})\n${entry}\n`,
    "utf8"
  );
}

function loadDeploy() {
  try {
    return JSON.parse(fs.readFileSync(DEPLOY, "utf8"));
  } catch {
    return null;
  }
}

async function send(text, chatId) {
  if (!chatId) return false;
  try {
    const res = await fetch(`${API}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const j = await res.json();
    return j.ok;
  } catch (e) {
    console.error("send failed", e.message);
    return false;
  }
}

function answer(message) {
  const text = (message.text || "").trim();
  const lower = text.toLowerCase();

  if (lower.startsWith("/ping") || lower.startsWith("/living")) {
    return "⚡ BlockDNS agent kayen o khdim. Msg dyalek t-te logs f comm/inbox.md.";
  }
  if (/^(fin|wayn|ween|awin|feen|win)\b/.test(lower) && text.replace(/[^a-z0-9]/gi, "").length <= 5) {
    return "Ana f PC (blockdns). L'archive: C:\\Users\\pc\\Desktop\\blockdns\\comm\\inbox.md. L'agent kayjawb mnin t7el session terminal.";
  }
  if (lower.startsWith("/adr") || lower.startsWith("/wallet") || lower.startsWith("/address")) {
    const d = loadDeploy();
    const lines = ["Adresses Base Sepolia:"];
    if (d) {
      const c = d.contracts || {};
      for (const [name, addr] of Object.entries(c)) lines.push(`- ${name}: ${addr}`);
    }
    lines.push("Treasury: 0x953BaA88c280df9e59C149BC5aB9B9ec64E45323");
    return lines.join("\n");
  }
  if (lower.startsWith("/todos")) {
    const todofile = path.join(COMM, "todos.md");
    try {
      return "Todos:\n" + fs.readFileSync(todofile, "utf8").trim();
    } catch {
      return "Makaynch todos.md f comm/.";
    }
  }
  if (lower.startsWith("/dm") || lower.startsWith("/msg")) {
    const body = text.replace(/^\/dm\s+/i, "").replace(/^\/msg\s+/i, "").trim();
    if (body) {
      writeLog("inbox", `> (dm) ${body}`);
      return "📥 Twedda o ntketteb dima.";
    }
    return null;
  }
  if (lower.startsWith("/help") || lower.startsWith("/start") || lower.startsWith("/faq") || lower.startsWith("/md")) {
    return [
      "BlockDNS bridge. L'commandes: /ping, /adr, /todos, /dm <texte>.",
      "Kol msg tani = kayt-wtzef f comm/inbox.md o l'agent jedeha mnin nraje3.",
    ].join("\n");
  }
  return null;
}

function ackFor(text) {
  const lower = text.toLowerCase();
  if (/^(salam|slm|ahlan|marhaba|hi|hello|hey|yo|bonjour|salam)\b/.test(lower)) {
    return "Salam sahbi! 👋 dyalek wsel o tektab f archive. Ana l'agent f PC, ghadi n9ra l'inbox o njarreb 3lik. /help.";
  }
  return "📥 Msg wsel o tektab f comm/inbox.md. Ghaniyeew fih o njarreb 3lik mnin nred. /help.";
}

async function handle(message) {
  if (!message || !message.text) return;
  if (message.from && message.from.is_bot) return;
  const who = message.from
    ? `${message.from.first_name || ""}${message.from.last_name || ""}@${message.from.id}`.trim()
    : "unknown";
  const body = (message.text || "").trim();
  if (!body) return;
  writeLog("inbox", `> ${who}: ${body}`);

  // GROUP: quiet place for humans (invites). Only explicit commands get answered.
  // DM: full conversation (commands + ack on every message).
  let reply = answer(message);
  if (!reply && MODE === "dm") reply = ackFor(body);
  if (!reply) return;

  const ok = await send(reply, message.chat.id || GROUP_ID);
  if (ok) writeLog("outbox", `${who} <- ${reply}`);
}

let polling = false;

async function pollOnce() {
  if (polling) return;
  polling = true;
  try {
    const url = `${API}/getUpdates?timeout=0&offset=${offset}&allowed_updates=${encodeURIComponent(
      JSON.stringify(["message"])
    )}`;
    const res = await fetch(url);
    const j = await res.json();
    if (!j.ok) {
      console.error("getUpdates failed", j.description);
      return;
    }
    for (const u of j.result || []) {
      if (u.update_id >= offset) offset = u.update_id + 1;
      if (u.message) await handle(u.message);
    }
    saveOffset(offset);
  } catch (e) {
    console.error("poll error", e.message);
  } finally {
    polling = false;
  }
}

console.log(`BlockDNS telegram bridge running. mode=${MODE} bot=${BOT_TOKEN.slice(0, 12)}... ${MODE === "group" ? `group=${GROUP_ID}` : "dm"}`);
if (MODE === "group" && GROUP_ID) {
  send("📡 Bridge group online. /help l'liste.", GROUP_ID);
}

setInterval(pollOnce, 2500);
pollOnce();