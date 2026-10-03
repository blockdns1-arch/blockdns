import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  coinbaseWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { blockdnsL2 } from "./chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [injectedWallet, coinbaseWallet],
    },
  ],
  {
    appName: "BlockDNS",
    projectId,
  }
);

export const config = createConfig({
  connectors,
  chains: [blockdnsL2],
  transports: {
    [blockdnsL2.id]: http(
      process.env.NEXT_PUBLIC_L2_RPC_URL || "http://127.0.0.1:9545"
    ),
  },
  ssr: true,
});