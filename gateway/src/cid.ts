import { createHash } from "node:crypto";

export type CidCheck =
  | { status: "match" }
  | { status: "mismatch" }
  | { status: "not-a-leaf" }
  | { status: "invalid-cid" };

const V0_RE = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
const V1_RE = /^b[a-z2-7]{58}$/;

const DAG_PB = 0x70;
const RAW = 0x55;
const SHA256 = 0x12;
const SHA256_LEN = 0x20;

const BTC_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const B32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function varintEncode(n: number): Uint8Array {
  const out: number[] = [];
  while (n > 127) {
    out.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  out.push(n);
  return Uint8Array.from(out);
}

function varintDecode(input: Uint8Array, offset: number): { value: number; offset: number } {
  let value = 0;
  let shift = 0;
  for (let i = offset; i < input.length; i++) {
    const byte = input[i];
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { value, offset: i + 1 };
    shift += 7;
    if (shift > 35) throw new Error("varint too long");
  }
  throw new Error("truncated varint");
}

function base58Encode(input: Uint8Array): string {
  let zeros = 0;
  while (zeros < input.length && input[zeros] === 0) zeros++;
  const digits: number[] = [0];
  for (const byte of input) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i--) out += BTC_ALPHABET[digits[i]];
  return out;
}

function base58Decode(s: string): Uint8Array {
  let zeros = 0;
  while (zeros < s.length && s[zeros] === "1") zeros++;
  const bytes: number[] = [0];
  for (const ch of s) {
    let carry = BTC_ALPHABET.indexOf(ch);
    if (carry === -1) throw new Error("bad base58 character");
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let k = 0; k < zeros; k++) bytes.push(0);
  return Uint8Array.from(bytes.reverse());
}

function base32Encode(input: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(s: string): Uint8Array {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of s) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("bad base32 character");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

export function isCidLike(value: string): boolean {
  if (!value) return false;
  if (V0_RE.test(value)) return true;
  if (V1_RE.test(value)) return true;
  return false;
}

export function buildCid(version: 0 | 1, codec: number, payload: Uint8Array): string {
  const digest = createHash("sha256").update(payload).digest();
  if (version === 0) {
    return base58Encode(concat([Uint8Array.from([SHA256, SHA256_LEN]), digest]));
  }
  const body = concat([
    varintEncode(1),
    varintEncode(codec),
    Uint8Array.from([SHA256, SHA256_LEN]),
    digest,
  ]);
  return "b" + base32Encode(body);
}

type ParsedCid = { version: 0 | 1; codec: number; digest: Uint8Array };

function parseCid(s: string): ParsedCid | null {
  if (V0_RE.test(s)) {
    const decoded = base58Decode(s);
    if (decoded.length !== 34 || decoded[0] !== SHA256 || decoded[1] !== SHA256_LEN) {
      return null;
    }
    return { version: 0, codec: DAG_PB, digest: decoded.subarray(2) };
  }
  if (V1_RE.test(s)) {
    const decoded = base32Decode(s.slice(1));
    const version = varintDecode(decoded, 0);
    if (version.value !== 1) return null;
    const codec = varintDecode(decoded, version.offset);
    const mhCode = varintDecode(decoded, codec.offset);
    const mhLen = varintDecode(decoded, mhCode.offset);
    if (mhCode.value !== SHA256 || mhLen.value !== SHA256_LEN) return null;
    if (mhLen.offset + 32 > decoded.length) return null;
    return { version: 1, codec: codec.value, digest: decoded.subarray(mhLen.offset, mhLen.offset + 32) };
  }
  return null;
}

export async function checkCidBytes(cidStr: string, bytes: Uint8Array): Promise<CidCheck> {
  const cid = parseCid(cidStr);
  if (!cid) return { status: "invalid-cid" };

  let block: Uint8Array;
  if (cid.codec === DAG_PB) {
    if (bytes.length === 0) return { status: "mismatch" };
    if (bytes[0] === 0x12) return { status: "not-a-leaf" };
    if (bytes[0] !== 0x0a) return { status: "mismatch" };
    block = bytes;
  } else if (cid.codec === RAW) {
    block = bytes;
  } else {
    return { status: "not-a-leaf" };
  }

  const digest = createHash("sha256").update(block).digest();
  const got = new Uint8Array(digest);
  return digestEquals(got, cid.digest) ? { status: "match" } : { status: "mismatch" };
}

function digestEquals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}