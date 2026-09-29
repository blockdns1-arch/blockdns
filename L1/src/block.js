const { sha256d } = require("./crypto");
const { serializeTx } = require("./tx");
const { encodeBitsFromDifficulty } = require("./crypto");

function u32le(v) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(v);
  return b;
}
function i64le(v) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(v));
  return b;
}

function merkleRoot(txs) {
  if (txs.length === 0) return Buffer.alloc(32);
  let layer = txs.map((t) => sha256d(serializeTx(t)));
  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      const a = layer[i];
      const b = i + 1 < layer.length ? layer[i + 1] : a;
      next.push(sha256d(Buffer.concat([a, b])));
    }
    layer = next;
  }
  return layer[0];
}

// header: version4 | prevHash32 | merkleRoot32 | time4 | bits4 | nonce4
function serializeHeader(header) {
  return Buffer.concat([
    u32le(header.version),
    header.prevHash,
    header.merkleRoot,
    u32le(header.time),
    u32le(header.bits),
    u32le(header.nonce),
  ]);
}
function headerHash(header) {
  return sha256d(serializeHeader(header));
}
function checkProofOfWork(header, target) {
  const hash = headerHash(header);
  const value = BigInt("0x" + hash.reverse().toString("hex"));
  return value < target;
}
function solveHeader(header, target) {
  for (let nonce = 0; nonce < 0xffffffff; nonce++) {
    header.nonce = nonce;
    if (checkProofOfWork(header, target)) return header;
  }
  throw new Error("could not solve header");
}

// block serialization: header + txCount + tx bytes
function serializeBlock(block) {
  const parts = [serializeHeader(block.header)];
  parts.push(Buffer.from([block.txs.length]));
  for (const tx of block.txs) parts.push(serializeTx(tx));
  return Buffer.concat(parts);
}
function blockId(block) {
  return headerHash(block.header).toString("hex");
}

function makeHeader(prevHash, merkleRoot, bits, version = 1) {
  return {
    version,
    prevHash,
    merkleRoot,
    time: Math.floor(Date.now() / 1000),
    bits,
    nonce: 0,
  };
}

module.exports = {
  merkleRoot,
  serializeHeader,
  headerHash,
  checkProofOfWork,
  solveHeader,
  serializeBlock,
  blockId,
  makeHeader,
  u32le,
  i64le,
};