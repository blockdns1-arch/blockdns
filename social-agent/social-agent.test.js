"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");

process.env.SOCIAL_STORE_FILE = path.join(os.tmpdir(), `bdns-store-test-${process.pid}.json`);
process.env.SOCIAL_DRY_RUN = "1";

const {
  CFG,
  FAQ,
  EDU_CONTENT,
  findFaqAnswer,
  buildTwitterAuth,
  RateGate,
  TokenVault,
  TelegramBot,
  TwitterAgent,
  MetaPublisher,
  escapeTelegram,
  renderMilestone,
  pickDaily,
} = require("./social-agent");

test("config carries treasury binding", () => {
  assert.equal(CFG.treasury, "0xe0Bff551891cb718E351522fb798AbF9ac71Fbfe");
});

test("faq answers common intents", () => {
  const cases = [
    ["what is the bdns token supply", "supply"],
    ["how do I claim my airdrop", "airdrop"],
    ["how much does a 3 character domain cost", "price"],
    ["get started", "help"],
    ["what is the treasury address", "treasury"],
  ];
  for (const [q, key] of cases) {
    const hit = findFaqAnswer(q);
    assert.ok(hit, `no faq match for: ${q}`);
    assert.ok(hit.keys.includes(key), `wrong faq for: ${q}`);
  }
});

test("faq returns null for unrecognized input", () => {
  const hit = findFaqAnswer("今天天气怎么样");
  assert.equal(hit, null);
});

test("daily content is deterministic per seed", () => {
  const a = pickDaily(EDU_CONTENT, "2026-09-22::edu");
  const b = pickDaily(EDU_CONTENT, "2026-09-22::edu");
  assert.equal(a, b);
});

test("oauth1 signature is deterministic per nonce-scaled input", () => {
  const config = { apiKey: "ck", apiSecret: "cs", accessToken: "at", accessSecret: "as" };
  const one = buildTwitterAuth("POST", "https://api.twitter.com/2/tweets", { text: "alpha" }, config);
  const two = buildTwitterAuth("POST", "https://api.twitter.com/2/tweets", { text: "beta" }, config);
  assert.match(one.signature, /^[A-Za-z0-9+/=]{28,44}$/);
  assert.notEqual(one.signature, two.signature);
  assert.ok(one.header.startsWith("OAuth "));
  assert.ok(one.base.includes("oauth_consumer_key%3Dck"), "base uses RFC3986 percent-encoding");
  assert.ok(one.base.includes("text%3Dalpha"));
});

test("rate gate delays over-capacity bursts", async () => {
  const gate = new RateGate().define("g", 100, 2);
  const started = Date.now();
  await gate.acquire("g", 3);
  await gate.acquire("g", 1);
  const elapsed = Date.now() - started;
  assert.ok(elapsed >= 8, `expected delay, got ${elapsed}ms`);
});

test("token vault roundtrips on the configured store", async () => {
  const vault = new TokenVault();
  vault.set("META_USER_ACCESS_TOKEN", "abc123");
  await new Promise((resolve) => setImmediate(resolve));
  const again = new TokenVault();
  assert.equal(again.get("META_USER_ACCESS_TOKEN"), "abc123");
  fs.rmSync(CFG.storeFile, { force: true });
});

test("telegram escaping covers markdown specials", () => {
  const out = escapeTelegram("_a_ *b* [c] (d) #e +f -g =h |i {j} .k !l >m <n`");
  for (const special of "_.*[]()#+-=|{}.!>`") {
    assert.ok(out.includes(`\\${special}`) || special === "<", `missing escape for ${special}`);
  }
});

test("milestone templates render with treasury defaults", () => {
  const out = renderMilestone("💰 Revenue event: {amount} routed to {treasury}", { amount: "500 USDC" });
  assert.ok(out.includes("500 USDC"));
  assert.ok(out.includes(CFG.treasury));
});

test("no secrets are hard-coded in the source", () => {
  const source = fs.readFileSync(path.join(__dirname, "social-agent.js"), "utf8");
  assert.ok(source.includes("env("), "tokens must come from environment");
  assert.ok(!/bot[0-9]{8,}/i.test(source), "no bot token literal");
});

test("exports the four core surfaces", () => {
  assert.equal(typeof TelegramBot, "function");
  assert.equal(typeof TwitterAgent, "function");
  assert.equal(typeof MetaPublisher, "function");
  assert.ok(FAQ.length > 5);
});