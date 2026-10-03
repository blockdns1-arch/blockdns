import { defineChain } from "viem";

// Default to the chain the contracts are actually deployed on. Base Sepolia holds every
// address in deployments/public/base-sepolia.json, and all four Vercel projects override
// these values through the environment anyway.
const rpcUrl =
  process.env.NEXT_PUBLIC_L2_RPC_URL || "https://sepolia.base.org";

export const BLOCKDNS_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_L2_CHAIN_ID || 84532
);

export const blockdnsL2 = defineChain({
  id: BLOCKDNS_CHAIN_ID,
  name: process.env.NEXT_PUBLIC_L2_CHAIN_NAME || "Base Sepolia",
  nativeCurrency: {
    name: process.env.NEXT_PUBLIC_NATIVE_CURRENCY_NAME || "Ether",
    symbol: process.env.NEXT_PUBLIC_NATIVE_CURRENCY_SYMBOL || "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [rpcUrl] },
    public: { http: [rpcUrl] },
  },
  blockExplorers: {
    default: {
      name: process.env.NEXT_PUBLIC_L2_EXPLORER_NAME || "Basescan",
      url: process.env.NEXT_PUBLIC_L2_EXPLORER_URL || "https://sepolia.basescan.org",
    },
  },
});