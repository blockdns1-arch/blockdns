import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-verify";
import * as dotenv from "dotenv";

dotenv.config();

const accounts = process.env.DEPLOYER_PRIVATE_KEY
  ? [process.env.DEPLOYER_PRIVATE_KEY]
  : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
    },
  },
  networks: {
    hardhat: {
      chainId: 8461,
      // Port 9545 so a local `npx hardhat node` is reachable through the `l2` network below
      // (and through the gateway docker-compose defaults) without any extra env overrides.
      port: 9545,
    },
    l1: {
      url: process.env.L1_RPC_URL ?? "http://127.0.0.1:8545",
      chainId: Number(process.env.L1_CHAIN_ID ?? 11155111),
      accounts,
    },
    l2: {
      url: process.env.L2_RPC_URL ?? "http://127.0.0.1:9545",
      chainId: Number(process.env.L2_CHAIN_ID ?? 8461),
      accounts,
    },
    base: {
      url: process.env.BASE_RPC_URL ?? "https://mainnet.base.org",
      chainId: Number(process.env.BASE_CHAIN_ID ?? 8453),
      accounts,
    },
    "base-sepolia": {
      url: process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
      chainId: Number(process.env.BASE_SEPOLIA_CHAIN_ID ?? 84532),
      accounts,
    },
  },
  // Sourcify needs no API key, so verification can run straight from a plain clone.
  sourcify: {
    enabled: true,
  },
  etherscan: {
    // Etherscan V2 serves every EVM chain from one API key; Basescan is reached through it.
    apiKey: process.env.ETHERSCAN_API_KEY ?? "",
    customChains: [
      {
        network: "base-sepolia",
        chainId: 84532,
        url: "https://api-sepolia.basescan.org/api",
        publicExplorer: "https://sepolia.basescan.org",
      },
    ],
  },
};

export default config;
