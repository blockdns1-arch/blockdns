// Base Sepolia deployment addresses — mirror of deployments/public/base-sepolia.json
// (15/15 verified). NEXT_PUBLIC_* env vars override each value, so a deployment can
// repoint without a code edit, while a build with no env still lands on the
// verified contracts instead of an empty "contracts not configured" state.
export const DEPLOYMENT = {
  chainId: 84532,
  rpcUrl: "https://sepolia.base.org",
  explorerUrl: "https://sepolia.basescan.org",
  registry: "0x47BC8BcC51234c056D2A95c3E3a2747D851605C7",
  pricer: "0xDc0C8a3BCBa905E67f7a5551301462b4E57e4101",
  bdns: "0x15797f41C030d07Fd6924Ab0F93cEC1Bf62a7961",
  resolver: "0x81447f17daa279B9a3cB1AB7Ea60355Cde8deD7A",
  market: "0x4cA0a781cc784759d9792Cd0EC502E59C93c970e",
  splitter: "0x0e60701120b5E93895C92cD19d5aF4Fe4013246E",
  burnEngine: "0xBd541B8DaaB7B6a0c3a6b32ab11DA0682541FbE1",
  stakingVault: "0x45b22E0f69c12fb0922173A7D3B80a9c9b59d4B1",
  swap: "0xF1410546e20b06E0EE24A816E42d58FD6A64A715",
  bridge: "0x5e660A3a6685197375357676c37B7B780De4d306",
  messenger: "0x0a65A92C70456443394CAB879D99562259250C97",
} as const;
