import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

// Read-only status check for a .bdns name. Never sends a transaction.
//
//   CHECK_NAME=blockdns npx hardhat run scripts/check-domain.ts --network base-sepolia
//
// Prints registration state, price, owner, IPFS record and the bound ETH/BTC/SOL wallets.

const REGISTRY_ABI = [
  "function resolveName(string) external view returns (uint256)",
  "function nameOf(uint256) external view returns (string)",
  "function ownerOf(uint256) external view returns (address)",
];

const PRICER_ABI = ["function priceOf(string) external view returns (uint256)"];

const RESOLVER_ABI = [
  "function resolveAll(string) external view returns ((address owner, uint256 tokenId, string name, string ipfsCID))",
  "function resolveAddress(string,string) external view returns (string)",
  "function resolveTXT(string,string) external view returns (string)",
];

async function main(): Promise<void> {
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const contracts = deployment.contracts || {};
  const name = (process.env.CHECK_NAME || "blockdns").trim().toLowerCase();

  if (!/^[a-z0-9-]{1,63}$/.test(name)) {
    throw new Error(`invalid CHECK_NAME "${name}": expected a-z, 0-9, dashes, 1-63 chars`);
  }

  console.log(`network : ${network.name}`);
  console.log(`name    : ${name}.bdns`);

  const registry = new ethers.Contract(contracts.BlockDNSRegistry, REGISTRY_ABI, ethers.provider);
  const pricer = new ethers.Contract(contracts.BlockDNSPricer, PRICER_ABI, ethers.provider);
  const resolver = new ethers.Contract(contracts.BlockDNSResolver, RESOLVER_ABI, ethers.provider);

  const price = await pricer.priceOf(name);
  console.log(`price   : ${ethers.formatEther(price)} BDNS${price === 0n ? " (free tier)" : ""}`);

  let registered = false;
  let tokenId = 0n;
  try {
    tokenId = await registry.resolveName(name);
    registered = tokenId !== 0n; // resolveName returns 0 for unknown names
  } catch {
    registered = false;
  }

  if (!registered) {
    console.log(`status  : NOT registered -> available to claim`);
    return;
  }

  console.log(`status  : REGISTERED (tokenId ${tokenId})`);

  let owner = "";
  try {
    owner = await registry.ownerOf(tokenId);
  } catch {
    owner = "(ownerOf reverted)";
  }
  console.log(`owner   : ${owner}`);

  let cid = "";
  try {
    const resolved = await resolver.resolveAll(name);
    cid = resolved.ipfsCID || "";
    console.log(`tokenId : ${resolved.tokenId}`);
    console.log(`resolved: ${resolved.name} (owner ${resolved.owner})`);
  } catch (e) {
    console.log(`resolve : reverted (${(e as Error).message.slice(0, 80)})`);
  }
  console.log(`ipfsCID : ${cid || "(empty)"}`);

  for (const chain of ["eth", "btc", "sol"]) {
    try {
      const addr = await resolver.resolveAddress(name, chain);
      console.log(`${chain.padEnd(6)} : ${addr || "(empty)"}`);
    } catch {
      console.log(`${chain.padEnd(6)} : (revert)`);
    }
  }

  for (const key of ["url", "site"]) {
    try {
      const value = await resolver.resolveTXT(name, key);
      console.log(`txt ${key.padEnd(4)}: ${value || "(empty)"}`);
    } catch {
      console.log(`txt ${key.padEnd(4)}: (revert)`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
