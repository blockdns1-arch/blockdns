// L1 constants (Bitcoin-like profile, names on-chain)
module.exports = {
  NETWORK: "blockdns-l1",
  COINBASE_MATURITY: 3, // blocks a coinbase must age before spending

  // consensus
  TARGET_BLOCK_TIME: 300, // seconds (Bitcoin-like)
  RETARGET_INTERVAL: 3, // blocks between difficulty retargets (demoable; Bitcoin=2016)
  MAX_TARGET: 0x0000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn,
  MIN_DIFFICULTY: 1n,
  MAX_RETARGET_FACTOR: 4n,

  // reward
  INITIAL_SUBSIDY: 50n, // BDNS-L1 per block (halves)
  HALVING_INTERVAL: 50, // blocks between halvings (demoable; Bitcoin=210000)

  // names
  NAME_MIN_LEN: 1,
  NAME_MAX_LEN: 32,
  REGISTER_FEE: 1n, // BDN units locked by a registration tx (goes to miner as fee)
  MAX_BLOCK_TX: 50000,

  // proof formats
  OUT_COIN: 0,
  OUT_NAME: 1,
  HASH_TYPE_ALL: 0x01,
};