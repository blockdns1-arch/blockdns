import test from "node:test";
import assert from "node:assert/strict";
import { MemoryCache } from "./helpers";
import { cacheGet, cacheSet, createCache } from "../src/cache";

test("cache stores and returns JSON values", async () => {
  const backend = new MemoryCache();
  const value = {
    name: "blockdns",
    tokenId: "1",
    owner: "0x0000000000000000000000000000000000000001",
    cid: "QmPChd2hVbrJ6bfo3WBcTW4iLZxs1HhVR2qF6t1Q9hZmLZ",
    addresses: { ETH: "", BTC: "", SOL: "" },
    cachedAt: Date.now(),
  };
  await cacheSet(backend, "resolve:blockdns", value, 60);
  const got = await cacheGet(backend, "resolve:blockdns");
  assert.deepEqual(got, value);
});

test("cache get returns null for unknown key", async () => {
  const backend = new MemoryCache();
  assert.equal(await cacheGet(backend, "resolve:missing"), null);
});

test("cache createCache falls back to per-call memory cache", async () => {
  const backend = await createCache(null);
  await backend.set("k", "v", 60);
  assert.equal(await backend.get("k"), "v");
});