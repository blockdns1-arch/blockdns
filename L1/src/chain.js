const { hash160, addrToHash160, targetForDifficulty, difficultyFromBits, verifyDigest, base58check } = require("./crypto");
const {
  merkleRoot,
  headerHash,
  checkProofOfWork,
  solveHeader,
  makeHeader,
} = require("./block");
const { txid, isCoinbase, parseScriptSig, sighash } = require("./tx");
const C = require("./constants");

let _counter = 0;

class Chain {
  constructor(genesisTimestamp) {
    this.blocks = [];
    this.utxo = new Map(); // `${txid}:${idx}` -> output
    this.utxoHeight = new Map(); // `${txid}:${idx}` -> height created
    this.names = new Map(); // name -> `${txid}:${idx}`
    this.mempool = [];
    this.height = -1;

    const header = makeHeader(Buffer.alloc(32), Buffer.alloc(32), 1, 1);
    header.time = genesisTimestamp || Math.floor(Date.now() / 1000);
    solveHeader(header, targetForDifficulty(1n));
    const genesisTx = {
      version: 1,
      vin: [{ prevTxid: Buffer.alloc(32), prevIndex: 0xffffffff, scriptSig: Buffer.from("blockdns-l1 genesis 2026"), sequence: 0xffffffff }],
      vout: [],
      locktime: 0,
    };
    const block = { header, txs: [genesisTx] };
    const root = merkleRoot(block.txs);
    if (!root.equals(block.header.merkleRoot)) throw new Error("genesis merkle");
    this.blocks.push({ ...block, id: headerHash(header).toString("hex"), height: 0 });
    this.tip = block.header;
    this.height = 0;
    this.difficulty = 1n;
  }

  subsidy(height) {
    const halvings = Math.floor(height / C.HALVING_INTERVAL);
    const s = C.INITIAL_SUBSIDY >> BigInt(halvings);
    return s < 1n ? 1n : s;
  }

  nextDifficulty() {
    const h = this.height;
    if (h < C.RETARGET_INTERVAL) return this.difficulty;
    if ((h + 1) % C.RETARGET_INTERVAL !== 0) return this.difficulty;
    const first = this.blocks[h + 1 - C.RETARGET_INTERVAL].header;
    const last = this.blocks[h].header;
    const actual = Math.max(1, last.time - first.time);
    const expected = C.RETARGET_INTERVAL * C.TARGET_BLOCK_TIME;
    let nd = (this.difficulty * BigInt(expected)) / BigInt(actual);
    const hi = this.difficulty * C.MAX_RETARGET_FACTOR;
    const lo = this.difficulty / C.MAX_RETARGET_FACTOR;
    if (nd > hi) nd = hi;
    if (nd < lo) nd = lo;
    return nd < C.MIN_DIFFICULTY ? C.MIN_DIFFICULTY : nd;
  }

  submit(tx) {
    // cheap sanity before entering mempool
    let fin = 0n, fout = 0n;
    for (const o of tx.vout) fout += o.value;
    for (const inx of tx.vin) {
      const prev = this.utxo.get(`${inx.prevTxid.toString("hex")}:${inx.prevIndex}`);
      if (!prev) throw new Error("submit: unknown input");
      fin += prev.value;
    }
    if (fin < fout) throw new Error("submit: inputs < outputs");
    this.mempool.push(tx);
  }

  mineBlock(minerWallet, txs = []) {
    const height = this.height + 1;
    const diff = this.nextDifficulty();
    const target = targetForDifficulty(diff);
    const bits = Number(diff > 0xffffffffn ? 0xffffffffn : diff);

    const selected = [];
    const used = new Set();
    let totalFees = 0n;
    for (const tx of [...txs, ...this.mempool]) {
      if (selected.length >= C.MAX_BLOCK_TX) break;
      const id = txid(tx);
      if (used.has(id)) continue;
      let fin = 0n, fout = 0n, ok = true;
      for (const o of tx.vout) fout += o.value;
      for (const inx of tx.vin) {
        if (inx.prevIndex === 0xffffffff) { ok = false; break; }
        const prev = this.utxo.get(`${inx.prevTxid.toString("hex")}:${inx.prevIndex}`);
        if (!prev) { ok = false; break; }
        fin += prev.value;
      }
      if (!ok || fin < fout) continue;
      used.add(id);
      totalFees += fin - fout;
      selected.push(tx);
    }

    const reward = this.subsidy(height) + totalFees;
    const coinbase = {
      version: 1,
      vin: [{ prevTxid: Buffer.alloc(32), prevIndex: 0xffffffff, scriptSig: Buffer.from(`bdns-l1 ${height} ${_counter++}`), sequence: 0xffffffff }],
      vout: [{ type: C.OUT_COIN, value: reward, ownerHash: hash160(minerWallet.pubkey), name: null, data: null }],
      locktime: 0,
    };

    const header = makeHeader(headerHash(this.tip), merkleRoot([coinbase, ...selected]), bits, 1);
    header.time = Math.max(header.time, this.blocks[this.height].header.time + 1);
    solveHeader(header, target);
    return this._addBlock({ header, txs: [coinbase, ...selected] });
  }

  // internal: adds a block that was already PoW-solved (mined locally)
  _addBlock(block) {
    const id = headerHash(block.header).toString("hex");
    if (!headerHash(this.blocks[this.height].header).equals(block.header.prevHash))
      throw new Error("prevHash does not match tip");
    const diff = difficultyFromBits(block.header.bits);
    if (diff !== this.nextDifficulty()) throw new Error(`difficulty mismatch ${diff} != ${this.nextDifficulty()}`);
    if (!checkProofOfWork(block.header, targetForDifficulty(diff))) throw new Error("PoW failed");
    if (block.header.time <= this.blocks[this.height].header.time) throw new Error("timestamp must increase");
    const root = merkleRoot(block.txs);
    if (!root.equals(block.header.merkleRoot)) throw new Error("merkle mismatch");

    // working copies
    const working = new Map(this.utxo);
    const wHeight = new Map(this.utxoHeight);
    const wNames = new Map(this.names);
    const newHeight = this.height + 1;

    if (block.txs.length === 0) throw new Error("empty block");
    if (!isCoinbase(block.txs[0])) throw new Error("first tx must be coinbase");
    // coinbase reward = subsidy + fees from other txs
    let totalFees = 0n;
    for (let i = 1; i < block.txs.length; i++) {
      const id2 = txid(block.txs[i]);
      if (usedIds && usedIds.has(id2)) throw new Error("dup tx in block");
      totalFees += this._applyNonCoinbase(working, wHeight, wNames, newHeight, block.txs[i]);
    }
    const reward = this.subsidy(newHeight) + totalFees;
    this._applyCoinbase(working, wHeight, reward, block.txs[0]);

    this.utxo = working;
    this.utxoHeight = wHeight;
    this.names = wNames;
    this.blocks.push({ ...block, id, height: newHeight });
    this.height = newHeight;
    this.tip = block.header;
    this.difficulty = diff;
    const used = new Set(block.txs.map((t) => txid(t)));
    this.mempool = this.mempool.filter((t) => !used.has(txid(t)));
    return { id, height: newHeight, diff, names: wNames.size };
  }

  _applyCoinbase(working, wHeight, reward, cb) {
    const sum = cb.vout.reduce((a, o) => a + o.value, 0n);
    if (sum !== reward) throw new Error(`coinbase value ${sum} != reward ${reward}`);
    const id = txid(cb);
    cb.vout.forEach((out, i) => {
      const key = `${id}:${i}`;
      working.set(key, out);
      wHeight.set(key, this.height + 1);
    });
  }

  _applyNonCoinbase(working, wHeight, wNames, newHeight, tx) {
    let fin = 0n, fout = 0n, reg = false;
    const spentNames = [];
    for (let i = 0; i < tx.vin.length; i++) {
      const inx = tx.vin[i];
      const key = `${inx.prevTxid.toString("hex")}:${inx.prevIndex}`;
      const prev = working.get(key);
      if (!prev) throw new Error(`missing input ${key}`);
      fin += prev.value;
      if (prev.type === C.OUT_NAME) spentNames.push(prev.name);
      const created = wHeight.get(key) ?? 0;
      if (created + C.COINBASE_MATURITY > newHeight && isCoinBaseAt(prev)) throw new Error("coinbase not mature");
      const { sig, pubkey } = parseScriptSig(inx.scriptSig);
      if (!hash160(pubkey).equals(prev.ownerHash)) throw new Error("bad owner on input");
      if (!verifyDigest(pubkey, sighash(tx, i), sig)) throw new Error("bad signature");
      working.delete(key);
    }

    const id = txid(tx);
    for (let i = 0; i < tx.vout.length; i++) {
      const out = tx.vout[i];
      fout += out.value;
      if (out.type === C.OUT_NAME) {
        if (!out.name || out.name.length < C.NAME_MIN_LEN || out.name.length > C.NAME_MAX_LEN)
          throw new Error("bad name length");
        const existing = wNames.get(out.name);
        if (existing && existing !== `${id}:${i}`) throw new Error(`name conflict: ${out.name}`);
        if (!spentNames.includes(out.name)) {
          // registration or re-reg within a previous block (already unique by wNames)
          if (this.names.has(out.name)) throw new Error(`name already taken: ${out.name}`);
          reg = true;
        }
        wNames.set(out.name, `${id}:${i}`);
      }
      const key = `${id}:${i}`;
      working.set(key, out);
      wHeight.set(key, newHeight);
    }

    if (fin < fout) throw new Error("inputs < outputs");
    const fee = fin - fout;
    if (reg && fee < C.REGISTER_FEE) throw new Error(`registration needs fee ${C.REGISTER_FEE}`);
    return fee;
  }

  getUtxos(ownerHash) {
    const res = [];
    for (const [key, out] of this.utxo) {
      if (out.value > 0n && out.ownerHash.equals(ownerHash)) res.push({ key, out });
    }
    return res;
  }

  balance(addr) {
    const h = addrToHash160(addr);
    let sum = 0n;
    for (const [, out] of this.utxo) {
      if (out.type === C.OUT_COIN && out.ownerHash.equals(h)) sum += out.value;
    }
    return sum;
  }

  resolve(name) {
    const key = this.names.get(name);
    if (!key) return null;
    const out = this.utxo.get(key);
    if (!out) return null;
    return {
      name,
      owner: base58check(Buffer.concat([Buffer.from([0x00]), out.ownerHash])),
      data: out.data ? out.data.toString("utf8") : null,
      value: out.value,
      outpoint: key,
      height: this.utxoHeight.get(key),
    };
  }

  allNames() {
    return Array.from(this.names.keys()).sort();
  }

  chainInfo() {
    return {
      height: this.height,
      tip: this.blocks[this.height].id.slice(0, 16) + "…",
      difficulty: this.difficulty.toString(),
      utxo: this.utxo.size,
      names: this.names.size,
      mempool: this.mempool.length,
    };
  }
}

module.exports = { Chain };