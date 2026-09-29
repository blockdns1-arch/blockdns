import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
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
};

export default config;
