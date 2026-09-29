const { sha256d } = require("./crypto");
const { OUT_COIN, OUT_NAME } = require("./constants");

// ---------- varint ----------
function encodeVarint(n) {
  if (n < 0xfd) return Buffer.from([n]);
  if (n <= 0xffff) {
    const b = Buffer.alloc(3);
    b[0] = 0xfd;
    b.writeUInt16LE(n, 1);
    return b;
  }
  if (n <= 0xffffffff) {
    const b = Buffer.alloc(5);
    b[0] = 0xfe;
    b.writeUInt32LE(n, 1);
    return b;
  }
  const b = Buffer.alloc(9);
  b[0] = 0xff;
  b.writeBigUInt64LE(BigInt(n), 1);
  return b;
}
function readVarint(buf, offset) {
  const tag = buf[offset];
  if (tag < 0xfd) return { value: tag, size: 1 };
  if (tag === 0xfd) return { value: buf.readUInt16LE(offset + 1), size: 3 };
  if (tag === 0xfe) return { value: buf.readUInt32LE(offset + 1), size: 5 };
  return { value: Number(buf.readBigUInt64LE(offset + 1)), size: 9 };
}

function i64le(v) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(v));
  return b;
}
function u32le(v) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(v);
  return b;
}

const ZERO32 = Buffer.alloc(32);
const COINBASE_IN = { prevTxid: ZERO32, prevIndex: 0xffffffff, scriptSig: Buffer.alloc(0), sequence: 0xffffffff };

// ---------- outputs ----------
function coinOut(value, ownerHash) {
  return { type: OUT_COIN, value: BigInt(value), ownerHash, name: null, data: null };
}
function nameOut(value, name, ownerHash, data = null) {
  return {
    type: OUT_NAME,
    value: BigInt(value),
    ownerHash,
    name,
    data: data ? Buffer.from(data) : null,
  };
}
function serializeOut(out) {
  const parts = [i64le(out.value), Buffer.from([out.type])];
  if (out.type === OUT_COIN) {
    parts.push(out.ownerHash);
  } else {
    parts.push(encodeVarint(out.name.length));
    parts.push(Buffer.from(out.name, "utf8"));
    parts.push(out.ownerHash);
    const data = out.data || Buffer.alloc(0);
    parts.push(encodeVarint(data.length));
    parts.push(data);
  }
  return Buffer.concat(parts);
}
function parseOut(buf, offset) {
  const value = buf.readBigUInt64LE(offset);
  offset += 8;
  const type = buf[offset++];
  if (type === OUT_COIN) {
    const ownerHash = Buffer.from(buf.subarray(offset, offset + 20));
    offset += 20;
    return { out: coinOut(value, ownerHash), next: offset };
  }
  const n1 = readVarint(buf, offset);
  offset += n1.size;
  const name = buf.subarray(offset, offset + n1.value).toString("utf8");
  offset += n1.value;
  const ownerHash = Buffer.from(buf.subarray(offset, offset + 20));
  offset += 20;
  const n2 = readVarint(buf, offset);
  offset += n2.size;
  const data = Buffer.from(buf.subarray(offset, offset + n2.value));
  offset += n2.value;
  return { out: nameOut(value, name, ownerHash, data), next: offset };
}

// ---------- inputs ----------
function sigScript(sig, pubkey) {
  return Buffer.concat([
    encodeVarint(sig.length),
    sig,
    encodeVarint(pubkey.length),
    pubkey,
  ]);
}
function parseScriptSig(buf) {
  let offset = 0;
  const n1 = readVarint(buf, offset);
  offset += n1.size;
  const sig = Buffer.from(buf.subarray(offset, offset + n1.value));
  offset += n1.value;
  const n2 = readVarint(buf, offset);
  offset += n2.size;
  const pubkey = Buffer.from(buf.subarray(offset, offset + n2.value));
  return { sig, pubkey };
}

// ---------- tx ----------
function txid(tx) {
  return sha256d(serializeTx(tx)).toString("hex");
}
function serializeTx(tx, forSig = false) {
  const parts = [u32le(tx.version || 1)];
  parts.push(encodeVarint(tx.vin.length));
  for (const inx of tx.vin) {
    parts.push(inx.prevTxid);
    parts.push(u32le(inx.prevIndex));
    const ss = forSig ? Buffer.alloc(0) : inx.scriptSig;
    parts.push(encodeVarint(ss.length));
    parts.push(ss);
    parts.push(u32le(inx.sequence || 0xffffffff));
  }
  parts.push(encodeVarint(tx.vout.length));
  for (const out of tx.vout) parts.push(serializeOut(out));
  parts.push(u32le(tx.locktime || 0));
  return Buffer.concat(parts);
}
function parseTx(buf) {
  let offset = 0;
  const version = buf.readUInt32LE(offset);
  offset += 4;
  const nv = readVarint(buf, offset);
  offset += nv.size;
  const vin = [];
  for (let i = 0; i < nv.value; i++) {
    const prevTxid = Buffer.from(buf.subarray(offset, offset + 32));
    offset += 32;
    const prevIndex = buf.readUInt32LE(offset);
    offset += 4;
    const ns = readVarint(buf, offset);
    offset += ns.size;
    const scriptSig = Buffer.from(buf.subarray(offset, offset + ns.value));
    offset += ns.value;
    const sequence = buf.readUInt32LE(offset);
    offset += 4;
    vin.push({ prevTxid, prevIndex, scriptSig, sequence });
  }
  const no = readVarint(buf, offset);
  offset += no.size;
  const vout = [];
  for (let i = 0; i < no.value; i++) {
    const r = parseOut(buf, offset);
    offset = r.next;
    vout.push(r.out);
  }
  const locktime = buf.readUInt32LE(offset);
  const tx = { version, vin, vout, locktime };
  return { tx, next: offset + 4 };
}
function isCoinbase(tx) {
  return (
    tx.vin.length === 1 &&
    tx.vin[0].prevTxid.every((b) => b === 0) &&
    tx.vin[0].prevIndex === 0xffffffff
  );
}
function sighash(tx, index) {
  // simplified Bitcoin SIGHASH_ALL: serialize with all scriptSigs empty, hash once
  const ser = serializeTx(tx, true);
  const d = Buffer.alloc(4);
  d.writeUInt32LE(index);
  return sha256d(Buffer.concat([ser, d]));
}

module.exports = {
  encodeVarint,
  readVarint,
  coinOut,
  nameOut,
  serializeOut,
  parseOut,
  sigScript,
  parseScriptSig,
  serializeTx,
  parseTx,
  txid,
  isCoinbase,
  sighash,
  COINBASE_IN,
  ZERO32,
};