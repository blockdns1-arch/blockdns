const crypto = require("node:crypto");
const { MAX_TARGET } = require("./constants");

// ---------- hashing ----------
const sha256 = (b) => crypto.createHash("sha256").update(b).digest();
const sha256d = (b) => sha256(sha256(b));
const hash160 = (b) => crypto.createHash("ripemd160").update(sha256(b)).digest();
const bytes = (hex) => Buffer.from(hex, "hex");

// ---------- base58check (Bitcoin-style addresses) ----------
const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58check(payload) {
  const checksum = sha256d(payload).subarray(0, 4);
  const data = Buffer.concat([payload, checksum]);
  let n = 0n;
  for (const byte of data) n = n * 256n + BigInt(byte);
  let out = "";
  while (n > 0n) {
    out = B58_ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const byte of data) {
    if (byte !== 0) break;
    out = "1" + out;
  }
  return out;
}
function addressFromPubkey(pubkey, version = 0x00) {
  return base58check(Buffer.concat([Buffer.from([version]), hash160(pubkey)]));
}
function addrToHash160(addr) {
  // decode base58check -> [version][hash160][checksum4]
  let n = 0n;
  for (const ch of addr) n = n * 58n + BigInt(B58_ALPHABET.indexOf(ch));
  const raw = Buffer.alloc(25);
  for (let i = 24; i >= 0; i--) {
    raw[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  const checksum = sha256d(raw.subarray(0, 21)).subarray(0, 4);
  if (!checksum.equals(raw.subarray(21))) throw new Error("bad address checksum");
  return raw.subarray(1, 21);
}

// ---------- keypair (secp256k1 via node:crypto) ----------
function generateKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "secp256k1",
  });
  const jwk = publicKey.export({ format: "jwk" });
  const x = Buffer.from(jwk.x, "base64url");
  const y = Buffer.from(jwk.y, "base64url");
  const pubkey = Buffer.concat([Buffer.from([0x04]), x, y]); // uncompressed point
  return {
    privateKey,
    privateKeyObject: privateKey,
    pubkey,
    address: addressFromPubkey(pubkey),
  };
}
function pubkeyToAddress(pubkey) {
  return addressFromPubkey(pubkey);
}

// ---------- signing ----------
// signs a digest (32 bytes) like an ECDSA over secp256k1; Node re-wraps SHA256 internally
function signDigest(privateKeyObject, digest) {
  const der = crypto
    .createSign("SHA256")
    .update(digest)
    .sign(privateKeyObject);
  return Buffer.concat([der, Buffer.from([0x01])]); // append sighash type ALL
}
function verifyDigest(pubkey, digest, sigWithType) {
  const sig = sigWithType.subarray(0, sigWithType.length - 1);
  const verifier = crypto.createVerify("SHA256");
  verifier.update(digest);
  const pubObj = crypto.createPublicKey({
    key:
      "-----BEGIN PUBLIC KEY-----\n" +
      pubkey.toString("base64") +
      "\n-----END PUBLIC KEY-----",
    format: "pem",
    type: "spki",
  });
  return verifier.verify(pubObj, sig);
}

// ---------- target / difficulty ----------
function targetForDifficulty(diff) {
  return MAX_TARGET / diff;
}
function difficultyForTarget(target) {
  return MAX_TARGET / target;
}
function encodeBitsFromDifficulty(diff) {
  // store difficulty directly (uint32); avoids Bitcoin compact-bits edge cases
  return Number(diff > 0xffffffffn ? 0xffffffffn : diff);
}
function difficultyFromBits(bits) {
  return BigInt(Math.max(1, bits));
}

module.exports = {
  sha256,
  sha256d,
  hash160,
  bytes,
  base58check,
  addressFromPubkey,
  addrToHash160,
  generateKeypair,
  pubkeyToAddress,
  signDigest,
  verifyDigest,
  targetForDifficulty,
  difficultyForTarget,
  difficultyFromBits,
  encodeBitsFromDifficulty,
};