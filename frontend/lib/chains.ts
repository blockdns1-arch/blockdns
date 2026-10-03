import { defineChain } from "viem";

const rpcUrl =
  process.env.NEXT_PUBLIC_L2_RPC_URL || "http://127.0.0.1:9545";

export const BLOCKDNS_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_L2_CHAIN_ID || 8461
);

export const blockdnsL2 = defineChain({
  id: BLOCKDNS_CHAIN_ID,
  name: process.env.NEXT_PUBLIC_L2_CHAIN_NAME || "BlockDNS L2",
  nativeCurrency: {
    name: process.env.NEXT_PUBLIC_NATIVE_CURRENCY_NAME || "BlockDNS",
    symbol: process.env.NEXT_PUBLIC_NATIVE_CURRENCY_SYMBOL || "BDNS",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [rpcUrl] },
    public: { http: [rpcUrl] },
  },
  blockExplorers: {
    default: {
      name: process.env.NEXT_PUBLIC_L2_EXPLORER_NAME || "BlockDNS Explorer",
      url: process.env.NEXT_PUBLIC_L2_EXPLORER_URL || "http://127.0.0.1:4000",
    },
  },
});