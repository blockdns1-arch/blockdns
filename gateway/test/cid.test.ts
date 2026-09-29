import test from "node:test";
import assert from "node:assert/strict";
import { isCidLike, checkCidBytes, buildCid } from "../src/cid";

const DAG_PB = 0x70;

function dagPbLeaf(data: Uint8Array): Uint8Array {
  const out: number[] = [0x0a];
  let n = data.length;
  const len: number[] = [];
  while (n > 127) {
    len.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  len.push(n);
  return Uint8Array.from([...out, ...len, ...data]);
}

test("isCidLike accepts CIDv0/v1 and rejects garbage", () => {
  assert.equal(isCidLike("QmPChd2hVbrJ6bfo3WBcTW4iLZxs1HhVR2qF6t1Q9hZmLZ"), true);
  assert.equal(isCidLike("bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"), true);
  assert.equal(isCidLike("https://evil.com/path"), false);
  assert.equal(isCidLike("../../etc/passwd"), false);
  assert.equal(isCidLike(""), false);
});

test("checkCidBytes returns match for a real dag-pb leaf CID", async () => {
  const html = new TextEncoder().encode("<h1>hello blockdns</h1>");
  const payload = dagPbLeaf(html);
  const cid = buildCid(0, DAG_PB, payload);
  assert.equal(isCidLike(cid), true);
  const check = await checkCidBytes(cid, payload);
  assert.equal(check.status, "match");
});

test("checkCidBytes returns mismatch for tampered bytes", async () => {
  const payload = dagPbLeaf(new TextEncoder().encode("original content"));
  const cid = buildCid(0, DAG_PB, payload);

  const tampered = new Uint8Array(payload);
  tampered[tampered.length - 1] ^= 0xff;
  const check = await checkCidBytes(cid, tampered);
  assert.equal(check.status, "mismatch");
});

test("checkCidBytes returns not-a-leaf for a directory node (has links)", async () => {
  const linkBytes = new Uint8Array([0x12, 0x03, 0x01, 0x02, 0x03]);
  const cid = buildCid(0, DAG_PB, linkBytes);
  const check = await checkCidBytes(cid, linkBytes);
  assert.equal(check.status, "not-a-leaf");
});

test("checkCidBytes rejects malformed input", async () => {
  const check = await checkCidBytes("not-a-cid", new Uint8Array([1, 2, 3]));
  assert.equal(check.status, "invalid-cid");
});

test("checkCidBytes handles CIDv1 raw codec", async () => {
  const payload = new TextEncoder().encode("raw bytes for raw codec");
  const cid = buildCid(1, 0x55, payload);
  const check = await checkCidBytes(cid, payload);
  assert.equal(check.status, "match");
});