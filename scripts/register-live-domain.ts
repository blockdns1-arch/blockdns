import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

const DEPLOYER =
  process.env.DEPLOYER_PRIVATE_KEY ||
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const abi = [
  "function registerDomain(string) external returns (uint256)",
  "function nameOf(uint256) external view returns (string)",
];

const chars = "abcdefghijklmnopqrstuvwxyz";
function randomName(): string {
  let s = "demo";
  while (s.length < 8) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function main(): Promise<void> {
  const deployment = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`), "utf8")
  );
  const address = (deployment.contracts || {}).BlockDNSRegistry;
  if (!address) throw new Error("BlockDNSRegistry not found in deployment");

  const signer = new ethers.Wallet(DEPLOYER, ethers.provider);
  const nextNonce = await signer.getNonce();
  const registry = new ethers.Contract(address, abi, signer);

  const name = randomName();
  const tx = await registry.registerDomain(name, { nonce: nextNonce });
  const receipt = await tx.wait();

  console.log(`REGISTERED name=${name} tx=${tx.hash} block=${receipt.blockNumber}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});