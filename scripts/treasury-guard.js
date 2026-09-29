#!/usr/bin/env node
/**
 * Treasury Guard — real-time monitor for the BlockDNS protocol treasury.
 *
 * Watches outgoing transfers of BDNS (and native gas) from the treasury
 * wallet, enforces allow-lists, and pushes alerts to a Telegram chat.
 *
 * Requirements
 *   node -e "..."                        # no build step
 *   npm i ethers                          # peer dep
 *
 * Usage
 *   TREASURY_WALLET=0x... \
 *   RPC_URL=https://rpc...               \
 *   BDNS_ADDRESS=0x...                   \
 *   TELEGRAM_BOT_TOKEN=... \             # optional
 *   TELEGRAM_CHAT_ID=... \               # optional
 *   node scripts/treasury-guard.js
 *
 * Allow-listing: a file "deployments/guard-allowlist.json" may list
 * { address, reason } entries for addresses we permit to receive treasury
 * funds (contracts like vaults, vesting, splitter, DEX LP pairs).
 */

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const WALLET = (process.env.TREASURY_WALLET || "").toLowerCase();
const RPC = process.env.RPC_URL || "http://127.0.0.1:8545";
const BDNS_ADDRESS = (process.env.BDNS_ADDRESS || "").toLowerCase();
const CHECK_INTERVAL_MS = Number(process.env.TREASURY_GUARD_INTERVAL_MS || 30_000);
const MIN_OUT = ethers.parseEther(process.env.TREASURY_GUARD_MIN_OUT || "1");
const MAX_HISTORY = 1000;
const MAX_GAS_SPIKE = ethers.parseEther(process.env.TREASURY_GUARD_MAX_GAS || "0.001");

const ALLOWLIST_FILE = path.resolve(__dirname, "..", "deployments", "guard-allowlist.json");
const LOG_FILE = path.resolve(__dirname, "..", "deployments", "treasury-guard.log.jsonl");
const LAST_BLOCK_FILE = path.resolve(__dirname, "..", "deployments", "treasury-guard.last");

let provider;
let lastBlock = 0;
let paused = false;

if (!ethers.isAddress(WALLET)) {
  console.error("TREASURY_WALLET must be a valid address (or empty to derive from deployment note).");
  process.exit(1);
}

function loadAllowlist() {
  if (!fs.existsSync(ALLOWLIST_FILE)) return new Set();
  try {
    const raw = JSON.parse(fs.readFileSync(ALLOWLIST_FILE, "utf8"));
    const list = Array.isArray(raw) ? raw : raw.allow || [];
    return new Set(list.map((e) => (typeof e === "string" ? e.toLowerCase() : (e.address || "").toLowerCase())));
  } catch (err) {
    console.error(`guard: cannot parse allowlist ${ALLOWLIST_FILE}:`, err.message);
    return new Set();
  }
}

function logEvent(entry) {
  const line = `${new Date().toISOString()}\t${JSON.stringify(entry)}\n`;
  fs.appendFileSync(LOG_FILE, line);
  console[entry.severity === "alert" ? "error" : "log"](`[guard] ${entry.type} ${entry.summary}`);
}

function persistLastBlock(block) {
  try {
    fs.writeFileSync(LAST_BLOCK_FILE, String(block));
  } catch {}
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch (err) {
    console.error(`guard: telegram failed: ${err.message}`);
  }
}

async function alert(severity, message, meta = {}) {
  const entry = { ts: new Date().toISOString(), severity, message, ...meta };
  logEvent(entry);
  if (severity === "alert") await sendTelegram(`<b>TREASURY GUARD</b>\n${message}`);
}

function erc20Abi() {
  return ["event Transfer(address indexed from, address indexed to, uint256 value)"];
}

function computeDetails(tx) {
  const out = {
    hash: tx.hash,
    from: tx.from,
    to: tx.to || "contract-creation",
    value: tx.value ? ethers.formatEther(tx.value) : "0",
  };

  if (tx.data && tx.data !== "0x") {
    let decoded = null;
    try {
      const iface = new ethers.Interface([
        "function transfer(address to, uint256 amount) returns (bool)",
        "function transferFrom(address from, address to, uint256 amount) returns (bool)",
        "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)",
      ]);
      const frag = iface.parseTransaction({ data: tx.data });
      if (frag) decoded = Object.fromEntries(frag.args.map((_, i) => [frag.fragment.inputs[i].name, frag.args[i]]));
    } catch {}
    out.decoded = decoded;
  }
  return out;
}

async function checkErc20Transfers(blockNumber, allowlist) {
  if (!BDNS_ADDRESS) return;
  const bdns = new ethers.Contract(BDNS_ADDRESS, erc20Abi(), provider);
  const fromFilter = bdns.filters.Transfer(WALLET);
  const events = await bdns.queryFilter(fromFilter, lastBlock + 1, blockNumber);
  for (const ev of events) {
    const to = ev.args.to.toLowerCase();
    const value = ev.args.value;
    const ok = allowlist.has(to) || value < MIN_OUT;
    const entry = {
      type: "ERC20_OUT",
      severity: ok ? "info" : "alert",
      token: "BDNS",
      to,
      value: ethers.formatEther(value),
      tx: ev.transactionHash,
      block: ev.blockNumber,
    };
    logEvent(entry);
    if (!ok) {
      await alert("alert", `⚠️ Unapproved BDNS outbound: <b>${ethers.formatEther(value)} BDNS</b> → ${to}`);
    }
  }
}

async function checkNativeOut(blockNumber, allowlist) {
  const from = await provider.getBlock(blockNumber);
  for (let i = from.transactions.length - 1; i >= 0; i--) {
    const tx = await provider.getTransaction(from.transactions[i]);
    if (!tx || (tx.from || "").toLowerCase() !== WALLET) continue;

    const to = (tx.to || "").toLowerCase();
    const value = tx.value;
    const gasSpike = value > MAX_GAS_SPIKE;
    const notAllowed = to && !allowlist.has(to) && value > MIN_OUT;

    if (gasSpike || notAllowed) {
      const details = computeDetails(tx);
      await alert(
        notAllowed ? "alert" : "info",
        `Native out ${ethers.formatEther(value)} ETH → ${to || "create"} (${tx.hash})`
          + (details.decoded ? `\nDecoded: ${JSON.stringify(details.decoded)}` : ""),
        details
      );
    } else {
      logEvent({ type: "NATIVE_OUT", severity: "info", to, value: ethers.formatEther(value), tx: tx.hash });
    }
  }
}

async function tick(allowlist) {
  try {
    if (paused) return;
    const block = await provider.getBlockNumber();
    if (block <= lastBlock) return;

    await checkNativeOut(block, allowlist);
    await checkErc20Transfers(block, allowlist);

    lastBlock = block;
    persistLastBlock(block);
  } catch (err) {
    if (String(err.message).includes("etimedout") || String(err.message).includes("ECONNREFUSED")) {
      console.error(`[guard] provider unreachable, backing off: ${err.message}`);
      paused = true;
      setTimeout(() => {
        paused = false;
        lastBlock = 0;
      }, 60_000);
    } else {
      await alert("error", `Guard loop error: ${err.message}`);
    }
  }
}

async function main() {
  if (!/^(https?:|wss?:|http:\/\/127\.0\.0\.1)/.test(RPC)) {
    console.error(`RPC_URL invalid: ${RPC}`);
    process.exit(1);
  }
  provider = new ethers.JsonRpcProvider(RPC);
  const block = await provider.getBlockNumber();
  lastBlock = Number((await fs.existsSync(LAST_BLOCK_FILE) ? fs.readFileSync(LAST_BLOCK_FILE, "utf8") : "0") || block);
  if (!lastBlock) lastBlock = block - 1;

  const allowlist = loadAllowlist();
  console.log(`[guard] watching ${WALLET} on ${RPC} from block ${lastBlock} (allowlist ${allowlist.size})`);
  await sendTelegram(`🛡️ Treasury guard started. Watching <code>${WALLET}</code>`);
  await tick(allowlist);
  setInterval(() => tick(allowlist), CHECK_INTERVAL_MS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});