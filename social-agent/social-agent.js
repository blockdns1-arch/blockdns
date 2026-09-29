"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const VERSION = "0.1.0";
const ROOT_DIR = __dirname;

function readEnvFile(file) {
  try {
    const raw = fs.readFileSync(file, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key && !(key in process.env)) process.env[key] = value;
    }
  } catch (_err) {
    /* missing env file is fine */
  }
}

readEnvFile(path.join(ROOT_DIR, ".env"));
readEnvFile(path.join(process.cwd(), ".env"));

function env(name, fallback) {
  const value = process.env[name];
  return value !== undefined && value !== "" ? value : fallback;
}

const CFG = {
  treasury: env("TREASURY_ADDRESS", "0xe0Bff551891cb718E351522fb798AbF9ac71Fbfe"),
  logLevel: env("SOCIAL_LOG_LEVEL", "info"),
  dryRun: env("SOCIAL_DRY_RUN", "0") === "1",
  maxPostsPerDay: Number(env("SOCIAL_MAX_POSTS_PER_DAY", "8")),
  telegram: {
    token: env("TELEGRAM_BOT_TOKEN", ""),
    chatId: env("TELEGRAM_CHAT_ID", ""),
    threadId: env("TELEGRAM_THREAD_ID", ""),
    requiresKeyword: env("TELEGRAM_REQUIRE_KEYWORD", "0") === "1",
    enabled: function enabled() {
      return Boolean(this.token && this.chatId);
    },
  },
  twitter: {
    apiKey: env("TWITTER_API_KEY", ""),
    apiSecret: env("TWITTER_API_SECRET", ""),
    accessToken: env("TWITTER_ACCESS_TOKEN", ""),
    accessSecret: env("TWITTER_ACCESS_SECRET", ""),
    bearerToken: env("TWITTER_BEARER_TOKEN", ""),
    handle: env("TWITTER_HANDLE", ""),
    repliesPerHour: Number(env("TWITTER_REPLIES_PER_HOUR", "4")),
    dailyPostAt: env("TWITTER_DAILY_POST_UTC", "12:00"),
    keywords: env("TWITTER_KEYWORDS", "Web3 Domains,ENS alternatives,Decentralized Hosting")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    enabled: function enabled() {
      return Boolean(this.apiKey && this.apiSecret && this.accessToken && this.accessSecret);
    },
  },
  meta: {
    appId: env("META_APP_ID", ""),
    appSecret: env("META_APP_SECRET", ""),
    userToken: env("META_USER_ACCESS_TOKEN", ""),
    pageId: env("META_PAGE_ID", ""),
    igId: env("META_INSTAGRAM_BUSINESS_ID", ""),
    graphVersion: env("META_GRAPH_VERSION", "v21.0"),
    enabled: function enabled() {
      return Boolean(this.appId && this.appSecret && this.userToken);
    },
  },
  storeFile: env("SOCIAL_STORE_FILE", path.join(ROOT_DIR, "store.json")),
  eventsFile: env("SOCIAL_EVENTS_FILE", path.join(ROOT_DIR, "events.jsonl")),
  scheduleFile: env("SOCIAL_SCHEDULE_FILE", path.join(ROOT_DIR, "schedule.json")),
  pollIntervalMs: Number(env("SOCIAL_POLL_INTERVAL_MS", "60000")),
  fetchTimeoutMs: Number(env("SOCIAL_FETCH_TIMEOUT_MS", "20000")),
};

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
function log(level, message, extra) {
  if (LEVELS[level] < LEVELS[CFG.logLevel]) return;
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}`;
  if (extra !== undefined) {
    console.log(line, JSON.stringify(extra));
  } else {
    console.log(line);
  }
}

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(CFG.storeFile, "utf8"));
  } catch (_err) {
    return {};
  }
}

function writeStore(data) {
  const tmp = `${CFG.storeFile}.tmp`;
  try {
    fs.mkdirSync(path.dirname(CFG.storeFile), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, CFG.storeFile);
    try {
      fs.chmodSync(CFG.storeFile, 0o600);
    } catch (_err) {
      /* chmod not supported on win32 */
    }
  } catch (err) {
    log("error", "store write failed", { path: CFG.storeFile, error: err.message });
  }
}

class TokenVault {
  constructor() {
    this.store = readStore();
    this.persist = debouncedPersist.bind(this);
  }

  get(key) {
    if (process.env[key]) return process.env[key];
    return this.store.tokens && this.store.tokens[key];
  }

  set(key, value) {
    if (!this.store.tokens) this.store.tokens = {};
    this.store.tokens[key] = value;
    this.markDirty();
  }

  markDirty() {
    if (this._dirty) return;
    this._dirty = true;
    setImmediate(this.persist);
  }
}

function debouncedPersist() {
  if (!this._dirty) return;
  this._dirty = false;
  writeStore(this.store);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

class DailyBudget {
  constructor(vault) {
    this.vault = vault;
  }

  spend(platform, cost) {
    if (CFG.dryRun) return true;
    if (!this.vault.store.budget) this.vault.store.budget = {};
    const key = `${platform}:${todayKey()}`;
    const used = Number(this.vault.store.budget[key] || 0) + cost;
    if (used > CFG.maxPostsPerDay) return false;
    this.vault.store.budget[key] = used;
    this.vault.markDirty();
    return true;
  }
}

class RateGate {
  constructor() {
    this.buckets = new Map();
  }

  define(key, ratePerSec, capacity) {
    this.buckets.set(key, { ratePerSec, capacity, tokens: capacity, last: Date.now() });
    return this;
  }

  async acquire(key, cost = 1) {
    const bucket = this.buckets.get(key);
    if (!bucket) return;
    const now = Date.now();
    const elapsed = (now - bucket.last) / 1000;
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + elapsed * bucket.ratePerSec);
    bucket.last = now;
    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return;
    }
    const needed = cost - bucket.tokens;
    const delayMs = Math.ceil((needed / bucket.ratePerSec) * 1000);
    await sleep(delayMs + Math.floor(Math.random() * 250 + 1));
    bucket.tokens = 0;
    bucket.last = Date.now();
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, options, retries = 3) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(CFG.fetchTimeoutMs),
      });
      const contentType = res.headers.get("content-type") || "";
      let body;
      try {
        body = await res.json();
      } catch (_err) {
        body = await res.text();
      }
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after") || "5");
        log("warn", "rate limited, backing off", { url, retryAfter });
        await sleep(Math.max(retryAfter, 5) * 1000);
        continue;
      }
      if (res.status >= 500) {
        log("warn", "server error, retrying", { url, status: res.status });
        await sleep(5000 * (attempt + 1));
        continue;
      }
      if (!res.ok) {
        return { ok: false, status: res.status, body };
      }
      return { ok: true, status: res.status, body };
    } catch (err) {
      lastErr = err;
      log("warn", "fetch failed, retrying", { url, error: err.message });
      await sleep(3000 * (attempt + 1));
    }
  }
  throw lastErr || new Error(`fetch failed: ${url}`);
}

function htmlDecode(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

const FAQ = [
  {
    keys: ["what is bdns", "bdns token", "what is the token", "tokenomics", "supply"],
    answer:
      "BDNS is the BlockDNS protocol token. Total supply is capped at 1,000,000,000 BDNS: 5% founder (vested, treasury-beneficiary), 10% developer pool (vested, treasury-beneficiary), 45% locked in the staking vault and emitted to validators/stakers over a 5-year decay schedule, remainder reserved for airdrops and ecosystem operations. Revenue flows to the treasury at 0xe0Bff551891cb718E351522fb798AbF9ac71Fbfe.",
  },
  {
    keys: ["why 5 char", "minimum length", "domain characters", "free domain"],
    answer:
      "Any name of 5 or more characters can be minted as a .bdns domain for free (only the L1/L2 gas fee). Shorter premium names (1-4 characters) are priced by the pricer and split 50/50 between burn and the treasury.",
  },
  {
    keys: ["what is .bdns", "bdns domain", "web3 domain", "ens alternative", "ens"],
    answer:
      ".bdns is a fully on-chain Web3 domain namespace on the BlockDNS L2. It behaves like aENS-style alternative: you own the name as an NFT, bind wallet addresses across chains (ETH, BTC, SOL), store IPFS records, and resolve the name through the Universal DNS Resolver and the bdns.link HTTP gateway.",
  },
  {
    keys: ["how much", "price", "cost", "premium", "fee"],
    answer:
      "Names of 5+ characters are free. Premium 1-2 character names are tier-2 priced and 3-4 character names tier-4; both premium tiers burn 50% and route 50% to the treasury at 0xe0Bff551891cb718E351522fb798AbF9ac71Fbfe.",
  },
  {
    keys: ["staking", "validator", "earn", "rewards", "emission"],
    answer:
      "450,000,000 BDNS (45% of supply) is locked in the staking vault and emitted exclusively to validators/stakers over 5 years on a 25% annual decay curve. Releases are role-gated and capped by the linear emission schedule so the vault can never be mass-drained.",
  },
  {
    keys: ["airdrop", "claim", "merkle"],
    answer:
      "The airdrop releases 10% of your allocation at TGE and vests the remaining 90% linearly over 9-12 months. Claims are validated with Merkle proofs on-chain and unclaimed funds can only be withdrawn after the claim deadline.",
  },
  {
    keys: ["ipfs", "hosting", "website", "decentralized hosting", "upload"],
    answer:
      "Store an IPFS CID on your .bdns domain record and the BlockDNS gateway serves it as https://<name>.bdns.link. Content is stored on IPFS and resolved at the edge, so hosting stays decentralized and censorship-resistant.",
  },
  {
    keys: ["l2", "scaling", "gas", "transaction", "chain id"],
    answer:
      "BlockDNS runs the registry on a dedicated L2 for near-zero fees and fast finality, with an L1 messenger for settlement and security. Check the live L2 stats channel in this group for real-time numbers.",
  },
  {
    keys: ["treasury", "revenue", "who earns", "burn"],
    answer:
      "Premium registrations split 50% burn / 50% treasury. The primary treasury and owner wallet is 0xe0Bff551891cb718E351522fb798AbF9ac71Fbfe. All protocol fees settle there automatically.",
  },
  {
    keys: ["help", "how to start", "get started", "faq", "commands"],
    answer:
      "Ask me anything about BDNS! Try: 'what is a .bdns domain?', 'how does staking work?', 'how much does a domain cost?', or 'what is the airdrop?'. Use /stats for live network numbers and /treasury for the treasury address.",
  },
];

const EDU_CONTENT = [
  "What is Web3 hosting? When your site lives on IPFS behind an on-chain name record, no single server can take it down. .bdns domains store your IPFS CID on-chain and serve it at https://<name>.bdns.link #Web3Domains",
  "ENS alternatives don't have to end at wallets. The .bdns namespace is a full DNS+wallet layer: bind ETH, BTC, and SOL addresses, then resolve your name over HTTP. #DecentralizedHosting",
  "A .bdns domain minted at 5+ characters is FREE. You only pay the gas fee. Web3 identity under your control, on a purpose-built L2. #Web3Domains",
  "Premium 1-4 character .bdns names split their fee 50/50: half is burned, half flows to the protocol treasury. Deflation + treasury alignment in one mechanism.",
  "DNS records, on chain: bind multi-chain wallets, set custom TXT records, and point an IPFS gateway at your name with a single on-chain record. #DecentralizedHosting",
  "BlockDNS mints the registry on a dedicated L2 for near-zero gas, then settles via an L1 messenger. User-owned identities deserve cheap finality.",
  "How secure is that data? On-chain records are authenticated by your private key, records are immutable history, and names are NFTs you actually own. That's the .bdns promise. #Web3Domains",
  "Staking BDNS: 45% of supply is locked in a staking vault and emitted to validators/stakers over 5 years with a 25% annual decay. Rewards are time-linear, never front-loaded.",
  "One name, all your chains. Store your ETH, BTC, and SOL addresses in one .bdns record and let the resolver surface the right address for the right chain.",
  "The BlockDNS gateway resolves .bdns names over plain HTTP at bdns.link. Legacy browsers can still reach decentralized sites through a web2-friendly front door.",
];

const ANNOUNCEMENTS = [
  "Big milestone for BlockDNS: new mints rolling in on the L2 registry. Every .bdns name is an NFT you own outright.",
  "Protocol update live: treasury settlement active at {treasury}. Premium fees now split 50% burn / 50% treasury automatically.",
  "Linearity beats hype: BDNS staking emissions follow a strict 5-year schedule. No mass unlocks, no cliff dumps, verifiable on-chain.",
  "The .bdns resolver now returns full records for every registered name, including multi-chain wallet bindings and IPFS CIDs.",
];

const REPLY_TEMPLATES = [
  "Great question! {name} domains are free from 5 characters and resolve wallets + IPFS records on a dedicated L2. Check blockdns to learn more.",
  "Curious about decentralized naming? .bdns names are NFTs you own: bind ETH/BTC/SOL addresses, store IPFS CIDs, resolve over plain DNS. #Web3Domains",
  "In a world of ENS alternatives, .bdns stands out by being a real DNS+wallet layer, and premium fee revenue is split 50% to a public treasury.",
];

const MILE_TEMPLATES = {
  telegram: [
    `🆕 Domain minted: {name}.bdns (owner-purchased)`,
    `🥩 Staking milestone: {amount} BDNS emitted to the ecosystem this period`,
    `⚡ L2 stats updated: {stats}`,
    `💰 Revenue event: {amount} routed to the BlockDNS treasury {treasury}`,
  ],
  twitter: [
    `New mint: {name}.bdns just joined the registry on L2 #Web3Domains`,
    `Emission milestone: {amount} BDNS released per the 5-year staking schedule`,
    `L2 stat drop: {stats} #BlockDNS`,
    `Revenue flow: {amount} settled to the treasury {treasury}`,
  ],
};

function escapeTelegram(text) {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

function trimTo(text, max) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function pickDaily(items, seedText) {
  const digest = crypto.createHash("sha256").update(seedText).digest();
  return items[digest[0] % items.length];
}

function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findFaqAnswer(input) {
  const haystack = normalize(input);
  let best = null;
  let bestHits = 0;
  for (const entry of FAQ) {
    let hits = 0;
    for (const key of entry.keys) {
      if (haystack.includes(normalize(key))) hits++;
    }
    if (hits > bestHits) {
      bestHits = hits;
      best = entry;
    }
  }
  return best;
}

function buildTwitterAuth(method, url, params, config, tokenSecret) {
  const oauth = {
    oauth_consumer_key: config.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: config.accessToken,
    oauth_version: "1.0",
  };

  function encode(str) {
    return encodeURIComponent(str).replace(/[!'()*]/g, (ch) => {
      return `%${ch.charCodeAt(0).toString(16).toUpperCase()}`;
    });
  }

  const all = { ...oauth };
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null) all[k] = v;
  }
  const paramString = Object.keys(all)
    .sort()
    .map((k) => `${encode(k)}=${encode(String(all[k]))}`)
    .join("&");
  const base = `${method.toUpperCase()}&${encode(url)}&${encode(paramString)}`;
  const signingKey = `${encode(config.apiSecret)}&${encode(tokenSecret || "")}`;
  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(base)
    .digest("base64");

  const header =
    `OAuth oauth_consumer_key="${encode(oauth.oauth_consumer_key)}", ` +
    `oauth_nonce="${encode(oauth.oauth_nonce)}", ` +
    `oauth_signature="${encode(signature)}", ` +
    `oauth_signature_method="HMAC-SHA1", ` +
    `oauth_timestamp="${encode(oauth.oauth_timestamp)}", ` +
    `oauth_token="${encode(oauth.oauth_token)}", ` +
    `oauth_version="1.0"`;
  return { header, signature, base };
}

class TelegramBot {
  constructor(vault, gate, budget) {
    this.vault = vault;
    this.gate = gate;
    this.budget = budget;
    this.offset = Number(vault.store.telegramOffset || 0);
    this.api = () => `https://api.telegram.org/bot${CFG.telegram.token}`;
  }

  enabled() {
    return CFG.telegram.enabled();
  }

  async call(method, payload, multipart = false) {
    if (!this.enabled()) {
      log("info", "telegram not configured, skipping", { method });
      return null;
    }
    await this.gate.acquire("telegram");
    if (!this.budget.spend("telegram", 1)) {
      log("warn", "telegram daily budget exhausted", { method });
      return null;
    }
    const url = `${this.api()}/${method}`;
    let res;
    if (multipart) {
      res = await fetchJson(url, { method: "POST", body: payload });
    } else {
      res = await fetchJson(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    if (!res || !res.ok) {
      log("warn", "telegram api error", { method, status: res && res.status, body: res && res.body });
    }
    return res;
  }

  async sendMessage(chatId, text, extra = {}) {
    return this.call("sendMessage", {
      chat_id: chatId || CFG.telegram.chatId,
      text,
      parse_mode: "MarkdownV2",
      ...extra,
    });
  }

  async sendAlert(text) {
    return this.sendMessage(CFG.telegram.chatId, escapeTelegram(text));
  }

  async broadcastEvent(type, payload) {
    const lines = MILE_TEMPLATES.telegram;
    const template = lines[type === "DOMAIN_MINT" ? 0 : type === "STAKING_MILESTONE" ? 1 : type === "L2_STATS" ? 2 : 3];
    if (!template) return;
    const message = renderMilestone(template, payload);
    const replyMarkup = { inline_keyboard: [[{ text: "FAQ", callback_data: "faq" }]] };
    return this.call("sendMessage", {
      chat_id: CFG.telegram.chatId,
      text: escapeTelegram(message),
      parse_mode: "MarkdownV2",
      reply_markup: replyMarkup,
    });
  }

  async me() {
    if (!this.enabled()) return null;
    const res = await fetchJson(`${this.api()}/getMe`);
    return res.ok ? res.body.result : null;
  }

  async pollOnce() {
    const params = new URLSearchParams({
      timeout: "25",
      offset: String(this.offset),
      allowed_updates: JSON.stringify(["message", "callback_query", "my_chat_member", "channel_post"]),
    });
    const res = await fetchJson(`${this.api()}/getUpdates?${params.toString()}`);
    if (!res.ok) {
      log("warn", "getUpdates failed", { status: res.status, body: res.body });
      return [];
    }
    const updates = res.body.result || [];
    for (const update of updates) {
      this.offset = Math.max(this.offset, update.update_id + 1);
      if (update.update_id + 1 > Number(this.vault.store.telegramOffset || 0)) {
        this.vault.store.telegramOffset = this.offset;
        this.vault.markDirty();
      }
      await this.handleUpdate(update);
    }
    return updates;
  }

  async handleUpdate(update) {
    if (update.callback_query) {
      const q = update.callback_query;
      if (q.data === "faq") {
        const faq = findFaqAnswer("faq");
        await this.call("answerCallbackQuery", {
          callback_query_id: q.id,
          text: (faq && faq.answer) || "Ask about BDNS staking, airdrops, pricing or domains!",
          show_alert: false,
        });
        if (q.message) {
          await this.sendMessage(q.message.chat.id, escapeTelegram(faq.answer));
        }
      }
      return;
    }
    if (!update.message || !update.message.text) return;
    const chatId = update.message.chat.id;
    const text = update.message.text.trim();
    if (CFG.telegram.requiresKeyword) {
      const hasKeyword = /\.bdns|blockdns|bdns|web3/i.test(text) || /^\/\w+/.test(text);
      if (!hasKeyword) return;
    }
    await this.handleCommand(chatId, text);
  }

  async handleCommand(chatId, text) {
    const lower = text.toLowerCase();
    if (lower.startsWith("/start") || lower.startsWith("/help") || lower.startsWith("/faq")) {
      const faq = findFaqAnswer("faq");
      await this.sendMessage(chatId, escapeTelegram(faq.answer));
      return;
    }
    if (lower.startsWith("/treasury")) {
      await this.sendMessage(chatId, escapeTelegram(`The BlockDNS treasury and owner wallet: ${CFG.treasury}`));
      return;
    }
    if (lower.startsWith("/stats")) {
      await this.sendMessage(
        chatId,
        escapeTelegram("Live stats are streamed here as events. Daily L2 stats and staking milestones are posted automatically.")
      );
      return;
    }
    const answer = findFaqAnswer(text);
    if (answer) {
      await this.sendMessage(chatId, escapeTelegram(answer.answer));
      return;
    }
    const fallback = findFaqAnswer("help");
    await this.sendMessage(chatId, escapeTelegram((fallback && fallback.answer) || "Try /faq for common questions about BDNS."));
  }
}

function renderMilestone(template, payload) {
  return template
    .replace("{name}", String(payload.name || payload.domain || "name"))
    .replace("{amount}", String(payload.amount || "0"))
    .replace("{stats}", String(payload.stats || "v1 live"))
    .replace("{treasury}", CFG.treasury);
}

class TwitterAgent {
  constructor(vault, gate, budget) {
    this.vault = vault;
    this.gate = gate;
    this.budget = budget;
  }

  enabled() {
    return CFG.twitter.enabled();
  }

  hasBearer() {
    return Boolean(CFG.twitter.bearerToken);
  }

  api(route) {
    return `https://api.twitter.com/2${route}`;
  }

  async request(method, route, { params, body, userContext = true } = {}) {
    const url = this.api(route);
    const headers = { "user-agent": `blockdns-social-agent/${VERSION}` };
    if (userContext) {
      const auth = buildTwitterAuth(method, url, method === "GET" ? params : {}, CFG.twitter, CFG.twitter.accessSecret);
      headers.authorization = auth.header;
      log("info", "oauth1 signing ok", { base: auth.base, signature: auth.signature });
    } else if (this.hasBearer()) {
      headers.authorization = `Bearer ${CFG.twitter.bearerToken}`;
    } else {
      return { ok: false, status: 401, body: { reason: "no oauth context available" } };
    }
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    const target = params ? `${url}?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined)).toString()}` : url;
    await this.gate.acquire(method === "GET" ? "twitter-get" : "twitter-post");
    return fetchJson(target, options);
  }

  resolveBaseUrl() {
    return "";
  }

  async meId() {
    const res = await this.request("GET", `/users/by/username/${CFG.twitter.handle}`, { params: {}, userContext: false });
    if (!res.ok || !res.body.data) {
      log("warn", "twitter user resolve failed", { status: res.status, body: res.body });
      return null;
    }
    return res.body.data.id;
  }

  async postTweet(text, replyTo) {
    if (!this.enabled()) {
      log("info", "twitter not configured, skipping", { text });
      return null;
    }
    if (!this.budget.spend("twitter", 1)) {
      log("warn", "twitter daily budget exhausted");
      return null;
    }
    const payload = { text: trimTo(text, 280) };
    if (replyTo) payload.reply = { in_reply_to_tweet_id: String(replyTo) };
    const res = await this.request("POST", "/tweets", { body: payload });
    log(res.ok ? "info" : "warn", "twitter post result", { status: res.status, body: res.body });
    return res.ok ? res.body.data : null;
  }

  async searchRecent(query, sinceId) {
    const params = {
      query,
      "tweet.fields": "author_id,created_at",
      "max_results": "10",
      ...(sinceId ? { since_id: sinceId } : {}),
    };
    const res = await this.request("GET", "/tweets/search/recent", { params, userContext: false });
    return res.ok ? res.body.data || [] : [];
  }

  async mentionsFor(userId, sinceId) {
    const params = {
      "tweet.fields": "author_id,created_at",
      "max_results": "10",
      ...(sinceId ? { since_id: sinceId } : {}),
    };
    const res = await this.request("GET", `/users/${userId}/mentions`, { params });
    return res.ok ? res.body.data || [] : [];
  }

  pickReply() {
    return REPLY_TEMPLATES[Math.floor(Math.random() * REPLY_TEMPLATES.length)].replace("{name}", ".bdns");
  }

  async autoReplyOnce() {
    if (!this.enabled() || !CFG.twitter.handle) return null;
    const meId = await this.meId();
    if (!meId) return null;

    const seen = this.vault.store.twitterSeen || (this.vault.store.twitterSeen = {});
    const mentions = await this.mentionsFor(meId, this.vault.store.twitterMentionsSince || undefined);
    let replied = 0;
    let latest = this.vault.store.twitterMentionsSince || undefined;
    const hourKey = `${todayKey()}-${Math.floor(Date.now() / 3600000)}`;
    const hourly = this.vault.store.twitterHourlyReplies || (this.vault.store.twitterHourlyReplies = {});
    const used = Number(hourly[hourKey] || 0);

    const targets = [];
    for (const tweet of mentions) {
      const id = String(tweet.id);
      if (seen[id]) continue;
      seen[id] = true;
      if (!latest || tweet.created_at >= latest) latest = tweet.created_at;
      targets.push(tweet);
    }
    this.vault.store.twitterMentionsSince = latest || undefined;

    for (const tweet of targets) {
      if (used + replied >= CFG.twitter.repliesPerHour) break;
      const posted = await this.postTweet(this.pickReply(), tweet.id);
      if (posted) replied++;
      log("info", "twitter auto-reply sent", { tweet: tweet.id });
    }
    hourly[hourKey] = used + replied;
    this.vault.store.twitterHourlyReplies = hourly;
    this.vault.markDirty();
    return replied;
  }

  async keywordReplyOnce() {
    if (!this.hasBearer() || !CFG.twitter.keywords.length) return 0;
    const seen = this.vault.store.twitterKeywordSeen || (this.vault.store.twitterKeywordSeen = {});
    const query = `(${CFG.twitter.keywords.map((k) => `"${k}"`).join(" OR ")}) -is:retweet lang:en -is:reply -from:${CFG.twitter.handle}`;
    const params = {
      query,
      "tweet.fields": "author_id,created_at",
      "user.fields": "username",
      "expansions": "author_id",
      "max_results": "10",
    };
    const res = await this.request("GET", "/tweets/search/recent", { params, userContext: false });
    if (!res.ok || !res.body.data) {
      log("warn", "twitter keyword search failed", { status: res.status, body: res.body });
      return 0;
    }
    const users = new Map();
    for (const user of res.body.includes && res.body.includes.users || []) {
      users.set(String(user.id), user.username);
    }
    let latest = this.vault.store.twitterKeywordSince || undefined;
    const targets = [];
    for (const tweet of res.body.data) {
      const id = String(tweet.id);
      if (seen[id]) continue;
      seen[id] = true;
      if (!latest || tweet.created_at >= latest) latest = tweet.created_at;
      targets.push(tweet);
    }
    this.vault.store.twitterKeywordSince = latest || undefined;

    const hourKey = `${todayKey()}-${Math.floor(Date.now() / 3600000)}`;
    const hourly = this.vault.store.twitterHourlyReplies || (this.vault.store.twitterHourlyReplies = {});
    const used = Number(hourly[hourKey] || 0);
    let replied = 0;
    for (const tweet of targets) {
      if (used + replied >= CFG.twitter.repliesPerHour - 2) break;
      const username = users.get(String(tweet.author_id));
      if (!username) continue;
      const posted = await this.postTweet(`@${username} ${this.pickReply()}`, tweet.id);
      if (posted) replied++;
      log("info", "twitter keyword reply sent", { tweet: tweet.id, username });
    }
    hourly[hourKey] = used + replied;
    this.vault.store.twitterHourlyReplies = hourly;
    this.vault.markDirty();
    return replied;
  }

  dailyTweet() {
    const seed = pickDaily(EDU_CONTENT, `${todayKey()}::edu`);
    if (this.vault.store.twitterDailyPost === todayKey() || !this.budget.spend("twitter", 1)) {
      return Promise.resolve(null);
    }
    return this.postTweet(seed).then((result) => {
      if (result) {
        this.vault.store.twitterDailyPost = todayKey();
        this.vault.markDirty();
      }
      return result;
    });
  }
}

class MetaPublisher {
  constructor(vault, gate, budget) {
    this.vault = vault;
    this.gate = gate;
    this.budget = budget;
    this.graph = `https://graph.facebook.com/${CFG.meta.graphVersion}`;
  }

  enabled() {
    return CFG.meta.enabled();
  }

  userToken() {
    return this.vault.get("META_USER_ACCESS_TOKEN") || CFG.meta.userToken;
  }

  async getPageToken() {
    const cached = this.vault.store.metaPageToken;
    if (cached) return cached;
    if (!CFG.meta.pageId) return null;
    const params = new URLSearchParams({ fields: "access_token", access_token: this.userToken() });
    const res = await fetchJson(`${this.graph}/${CFG.meta.pageId}?${params.toString()}`, {
      method: "GET",
      headers: { "user-agent": `blockdns-social-agent/${VERSION}` },
    });
    if (res.ok && res.body.access_token) {
      this.vault.store.metaPageToken = res.body.access_token;
      this.vault.markDirty();
      return res.body.access_token;
    }
    log("warn", "meta page token fetch failed", { status: res.status, body: res.body });
    return null;
  }

  async refreshTokens() {
    if (!this.enabled()) {
      log("info", "meta not configured, skipping token refresh");
      return null;
    }
    const token = await this.userToken();
    const params = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: CFG.meta.appId,
      client_secret: CFG.meta.appSecret,
      fb_exchange_token: token,
    });
    const res = await fetchJson(`${this.graph}/oauth/access_token?${params.toString()}`, {
      method: "GET",
      headers: { "user-agent": `blockdns-social-agent/${VERSION}` },
    });
    if (res.ok && res.body.access_token) {
      this.vault.set("META_USER_ACCESS_TOKEN", res.body.access_token);
      const expires = res.body.expires_in ? new Date(Date.now() + res.body.expires_in * 1000).toISOString() : "unknown";
      log("info", "meta long-lived token refreshed", { expires });
      if (CFG.meta.pageId) {
        await this.getPageToken();
      }
      return res.body.access_token;
    }
    log("warn", "meta token refresh failed", { status: res.status, body: res.body });
    return null;
  }

  async publishFacebook(message, link, imageUrl) {
    if (!CFG.meta.pageId) return null;
    const pageToken = await this.getPageToken();
    if (!pageToken) return null;
    await this.gate.acquire("meta");
    if (!this.budget.spend("facebook", 1)) {
      log("warn", "facebook daily budget exhausted");
      return null;
    }
    const body = new URLSearchParams({ message });
    if (link) body.set("link", link);
    if (imageUrl) body.set("url", imageUrl);
    const res = await fetchJson(`${this.graph}/${CFG.meta.pageId}/feed`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": `blockdns-social-agent/${VERSION}`,
      },
      body: `${body.toString()}&access_token=${encodeURIComponent(pageToken)}`,
    });
    log(res.ok ? "info" : "warn", "facebook post result", { status: res.status, body: res.body });
    return res.ok ? res.body : null;
  }

  async publishInstagram(caption, imageUrl) {
    if (!CFG.meta.igId) return null;
    await this.gate.acquire("meta");
    if (!this.budget.spend("instagram", 1)) {
      log("warn", "instagram daily budget exhausted");
      return null;
    }
    const token = await this.userToken();
    const create = new URLSearchParams({ image_url: imageUrl, caption });
    const createRes = await fetchJson(`${this.graph}/${CFG.meta.igId}/media`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": `blockdns-social-agent/${VERSION}` },
      body: `${create.toString()}&access_token=${encodeURIComponent(token)}`,
    });
    if (!createRes.ok) {
      log("warn", "instagram media create failed", { status: createRes.status, body: createRes.body });
      return null;
    }
    const container = createRes.body.id;
    const maxWait = 8;
    for (let i = 0; i < maxWait; i++) {
      const statusRes = await fetchJson(`${this.graph}/${container}?fields=status_code`, {
        method: "GET",
        headers: { "user-agent": `blockdns-social-agent/${VERSION}` },
      });
      if (statusRes.ok && statusRes.body.status_code === "FINISHED") break;
      await sleep(5000);
    }
    const publish = new URLSearchParams({ creation_id: container });
    const pubRes = await fetchJson(`${this.graph}/${CFG.meta.igId}/media_publish`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": `blockdns-social-agent/${VERSION}` },
      body: `${publish.toString()}&access_token=${encodeURIComponent(token)}`,
    });
    log(pubRes.ok ? "info" : "warn", "instagram publish result", { status: pubRes.status, body: pubRes.body });
    return pubRes.ok ? pubRes.body : null;
  }

  async schedule(today) {
    let entries;
    try {
      entries = JSON.parse(fs.readFileSync(CFG.scheduleFile, "utf8"));
    } catch (_err) {
      return 0;
    }
    if (!Array.isArray(entries)) return 0;
    const posted = this.vault.store.schedulePosted || (this.vault.store.schedulePosted = {});
    let published = 0;
    for (const entry of entries) {
      if (!entry.at || !entry.message) continue;
      const due = new Date(entry.at).getTime();
      if (Number.isNaN(due) || due > Date.now()) continue;
      const key = entry.label ? `${entry.label}::${entry.at}` : entry.at;
      if (posted[key]) continue;
      const platforms = entry.platforms || ["facebook", "instagram"];
      for (const platform of platforms) {
        if (platform === "facebook") {
          const ok = await this.publishFacebook(entry.message, entry.link, entry.imageUrl);
          if (ok) published++;
        }
        if (platform === "instagram") {
          const ok = await this.publishInstagram(entry.caption || entry.message, entry.imageUrl);
          if (ok) published++;
        }
      }
      posted[key] = new Date().toISOString();
      this.vault.markDirty();
    }
    return published;
  }
}

class SocialAgent {
  constructor() {
    this.vault = new TokenVault();
    this.budget = new DailyBudget(this.vault);
    this.gate = new RateGate()
      .define("telegram", 1 / 1.2, 5)
      .define("twitter-post", 1 / 60, 5)
      .define("twitter-get", 1 / 2, 30)
      .define("meta", 1 / 30, 5);
    this.telegram = new TelegramBot(this.vault, this.gate, this.budget);
    this.twitter = new TwitterAgent(this.vault, this.gate, this.budget);
    this.meta = new MetaPublisher(this.vault, this.gate, this.budget);
    this.busy = false;
  }

  drainEvents() {
    let lines;
    try {
      const raw = fs.readFileSync(CFG.eventsFile, "utf8");
      lines = raw.split(/\r?\n/).filter(Boolean);
    } catch (_err) {
      return 0;
    }
    if (!lines.length) return 0;
    const seen = this.vault.store.seenEvents || (this.vault.store.seenEvents = {});
    let count = 0;
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        const digest = crypto.createHash("sha256").update(line).digest("hex");
        if (seen[digest]) continue;
        if (this.telegram.enabled()) this.telegram.broadcastEvent(event.type, event.payload);
        seen[digest] = new Date().toISOString();
        this.vault.markDirty();
        count++;
      } catch (_err) {
        log("warn", "unparseable event line skipped", { line });
      }
    }
    try {
      fs.truncateSync(CFG.eventsFile, 0);
    } catch (_err) {
      /* event file may not exist yet */
    }
    return count;
  }

  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      const drained = this.drainEvents();
      if (drained) log("info", "broadcasted network events", { drained });

      if (this.telegram.enabled()) {
        await this.telegram.pollOnce();
      }

      if (this.twitter.enabled()) {
        await this.twitter.autoReplyOnce();
        await this.keywordScan();
        if (this.vault.store.twitterDailyPost !== todayKey()) {
          await this.twitter.dailyTweet();
        }
      }

      if (this.meta.enabled()) {
        await this.meta.refreshTokens();
        const published = await this.meta.schedule(new Date());
        if (published) log("info", "metadata scheduled posts published", { published });
      }
    } catch (err) {
      log("error", "tick failed", { error: err.message });
    } finally {
      this.busy = false;
    }
  }

  async keywordScan() {
    const count = await this.twitter.keywordReplyOnce();
    if (count) log("info", "twitter keyword scan", { matches: count });
  }

  async runOnce() {
    await this.tick();
  }

  async start() {
    log("info", "social agent starting", { version: VERSION, dryRun: CFG.dryRun });
    if (this.telegram.enabled()) {
      const me = await this.telegram.me();
      log("info", "telegram bot verified", { username: me ? me.username : null });
    }
    await this.tick();
    const timer = setInterval(() => {
      this.tick().catch((err) => log("error", "tick error", { error: err.message }));
    }, CFG.pollIntervalMs);
    this._timer = timer;
  }

  async stop() {
    if (this._timer) clearInterval(this._timer);
    await sleep(250);
    log("info", "social agent stopped");
  }
}

function runSelfTest() {
  const results = [];
  function check(name, condition, detail) {
    results.push({ name, ok: Boolean(condition), detail });
  }

  check("treasury default", CFG.treasury === "0xe0Bff551891cb718E351522fb798AbF9ac71Fbfe", CFG.treasury);

  const gate = new RateGate().define("shot", 10, 2);
  const start = Date.now();
  gate
    .acquire("shot", 3)
    .then(() => gate.acquire("shot", 1))
    .then(() => {
      const elapsed = Date.now() - start;
      check("rate gate rate limits", elapsed >= 90, `${elapsed}ms`);

      const answer = findFaqAnswer("how much does a .bdns domain cost and how does staking work");
      check("faq intent matches pricing", Boolean(answer) && answer.keys.includes("price"), answer && answer.keys[0]);

      const daily1 = pickDaily(EDU_CONTENT, "2026-09-22::edu");
      check("daily content deterministic", daily1 === pickDaily(EDU_CONTENT, "2026-09-22::edu"), daily1);

      const auth = buildTwitterAuth(
        "POST",
        "https://api.twitter.com/2/tweets",
        { text: "hello" },
        {
          apiKey: "ck",
          apiSecret: "cs",
          accessToken: "at",
          accessSecret: "as",
        }
      );
      check("oauth1 header present", auth.header.startsWith("OAuth "), auth.header.slice(0, 24));
      check("oauth1 signature is base64", /^[A-Za-z0-9+/=]{28,44}$/.test(auth.signature), auth.signature.length);
      const auth2 = buildTwitterAuth(
        "POST",
        "https://api.twitter.com/2/tweets",
        { text: "world" },
        {
          apiKey: "ck",
          apiSecret: "cs",
          accessToken: "at",
          accessSecret: "as",
        }
      );
      check("oauth1 signature changes with input", auth.signature !== auth2.signature, "");

      const tmpStore = path.join(os.tmpdir(), `blockdns-social-test-${process.pid}.json`);
      fs.writeFileSync(tmpStore, JSON.stringify({ hello: 1 }), { mode: 0o600 });
      const reloadedTmp = JSON.parse(fs.readFileSync(tmpStore, "utf8"));
      check("store roundtrip", reloadedTmp.hello === 1, JSON.stringify(reloadedTmp));
      try {
        fs.unlinkSync(tmpStore);
      } catch (_err) {
        /* noop */
      }

      const telegram = escapeTelegram("_test_ [x] (y) *z* . ok .bdns");
      check("telegram escaping", telegram.includes("\\[x\\]") && telegram.includes("\\*z\\*") && telegram.includes("\\_test\\_"), telegram);

      const milestone = renderMilestone(MILE_TEMPLATES.telegram[0], { name: "alice" });
      check("milestone rendering", milestone.includes("alice.bdns"), milestone);

      const passed = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok);
      console.log(`\nSELF-TEST ${passed}/${results.length} passed`);
      for (const r of results) {
        console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` (${r.detail})` : ""}`);
      }
      console.log(`\nConfig loaded from ${ROOT_DIR}`);
      console.log(`treasury=${CFG.treasury}`);
      console.log(`telegram=${CFG.telegram.enabled() ? "configured" : "OFF"}`);
      console.log(`twitter=${CFG.twitter.enabled() ? "configured" : "OFF"}`);
      console.log(`meta=${CFG.meta.enabled() ? "configured" : "OFF"}`);
      if (failed.length) process.exitCode = 1;
    });
}

async function pingPlatform(platform) {
  if (platform === "telegram") {
    if (!CFG.telegram.enabled()) {
      console.log("Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.");
      return;
    }
    const agent = new SocialAgent();
    await agent.telegram.me();
    console.log(`Telegram connection OK. Sending ping to ${CFG.telegram.chatId}...`);
    const res = await agent.telegram.sendMessage(CFG.telegram.chatId, "✅ BlockDNS social agent online (ping from --ping telegram)");
    console.log(res && res.ok ? "Telegram ping sent." : (res && res.body ? `Telegram error: ${JSON.stringify(res.body)}` : "Telegram unreachable."));
    return;
  }
  if (platform === "twitter") {
    if (!CFG.twitter.enabled()) {
      console.log("Twitter not configured. Set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET.");
      return;
    }
    const agent = new SocialAgent();
    const meId = await agent.twitter.meId();
    console.log(meId ? `Twitter user context OK (id=${meId}). Not posting to avoid spamming your timeline.` : "Twitter user resolve failed. Check handle and credentials.");
    return;
  }
  if (platform === "meta") {
    if (!CFG.meta.enabled()) {
      console.log("Meta not configured. Set META_APP_ID, META_APP_SECRET, META_USER_ACCESS_TOKEN.");
      return;
    }
    const agent = new SocialAgent();
    const longLived = await agent.meta.refreshTokens();
    console.log(longLived ? "Meta token refresh OK (long-lived token stored)." : "Meta token refresh failed.");
    return;
  }
  console.log('Unknown platform. Use "--ping telegram", "--ping twitter" or "--ping meta".');
}

function showHelp() {
  console.log(`BlockDNS Social Agent v${VERSION}
Zero-dependency autonomous social media manager.

Usage:
  node social-agent.js --help             Show this help
  node social-agent.js --self-test        Run offline checks (no network)
  node social-agent.js --once             Run a single tick (events, replies, schedule)
  node social-agent.js --daemon           Run continuously
  node social-agent.js --ping <platform>  Verify connection (telegram|twitter|meta)

Events feed:
  Append JSONL lines to ${CFG.eventsFile} and the agent will broadcast them:
    {"type":"DOMAIN_MINT","payload":{"name":"alice"}}
    {"type":"STAKING_MILESTONE","payload":{"amount":"12000 BDNS"}}
    {"type":"L2_STATS","payload":{"stats":"120 tx/s, 0.0001 gas"}}
    {"type":"REVENUE","payload":{"amount":"500 USDC"}}

Scheduling:
  Add items to schedule.json (or ${CFG.scheduleFile}) for Meta auto-publish.

Security:
  Secrets load from social-agent/.env or repo .env. Refreshed Meta tokens are
  persisted to ${CFG.storeFile} with 0600 perms (both gitignored).
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }
  if (args.includes("--self-test")) {
    runSelfTest();
    return;
  }
  const pingIndex = args.indexOf("--ping");
  if (pingIndex !== -1) {
    await pingPlatform(args[pingIndex + 1]);
    return;
  }
  const agent = new SocialAgent();
  const shutdown = () => {
    agent
      .stop()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  if (args.includes("--daemon")) {
    await agent.start();
    log("info", "daemon running; press Ctrl+C to stop");
    return;
  }
  await agent.runOnce();
  log("info", "once run complete");
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  CFG,
  FAQ,
  EDU_CONTENT,
  findFaqAnswer,
  buildTwitterAuth,
  TelegramBot,
  TwitterAgent,
  MetaPublisher,
  SocialAgent,
  RateGate,
  TokenVault,
  escapeTelegram,
  renderMilestone,
  pickDaily,
};