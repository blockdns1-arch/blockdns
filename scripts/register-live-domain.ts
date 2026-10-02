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

function resolveName(): string {
  const requested = process.env.REGISTER_NAME?.trim().toLowerCase();
  if (!requested) return randomName();
  if (!/^[a-z0-9]{3,12}$/.test(requested)) {
    throw new Error(`invalid REGISTER_NAME "${requested}": expected 3-12 lowercase alphanumeric characters`);
  }
  return requested;
}

async function main(): Promise<void> {
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const address = (deployment.contracts || {}).BlockDNSRegistry;
  if (!address) throw new Error("BlockDNSRegistry not found in deployment");

  const signer = new ethers.Wallet(DEPLOYER, ethers.provider);
  const nextNonce = await signer.getNonce();
  const registry = new ethers.Contract(address, abi, signer);

  const name = resolveName();
  const tx = await registry.registerDomain(name, { nonce: nextNonce });
  const receipt = await tx.wait();

  console.log(`REGISTERED name=${name} tx=${tx.hash} block=${receipt.blockNumber}`);

  deployment.demoDomain = { name, tx: tx.hash, block: receipt.blockNumber };
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log(`deployment saved to ${deploymentPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});