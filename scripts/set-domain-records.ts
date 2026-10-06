import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

// Sets the records that make a .bdns name resolve to a live site.
//
//   RECORD_NAME=blockdns SITE_URL=https://blockdns-home.vercel.app \
//   npx hardhat run scripts/set-domain-records.ts --network base-sepolia
//
// Writes: eth address record + TXT records (url, site). Read the signer key from
// DEPLOYER_PRIVATE_KEY, which must own the domain token.

const abi = [
  "function resolveName(string) external view returns (uint256)",
  "function ownerOf(uint256) external view returns (address)",
  "function setAddressRecord(uint256,string,string)",
  "function setCustomTXT(uint256,string,string)",
  "function ipfsCIDOf(uint256) external view returns (string)",
];

async function main(): Promise<void> {
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const registryAddress = deployment.contracts.BlockDNSRegistry;
  if (!registryAddress) throw new Error("BlockDNSRegistry not found in deployment");

  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key) throw new Error("DEPLOYER_PRIVATE_KEY not set");

  const name = (process.env.RECORD_NAME || "blockdns").trim().toLowerCase();
  const siteUrl = process.env.SITE_URL || "https://blockdns-home.vercel.app";
  const siteKind = process.env.SITE_KIND || "home";
  const ethAddress = process.env.ETH_RECORD || process.env.TREASURY_ADDRESS || "";

  const signer = new ethers.Wallet(key, ethers.provider);
  const registry = new ethers.Contract(registryAddress, abi, signer);

  const tokenId = await registry.resolveName(name);
  if (tokenId === 0n) throw new Error(`${name} is not registered`);

  const owner = await registry.ownerOf(tokenId);
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`signer ${signer.address} is not the owner ${owner}`);
  }

  console.log(`name    : ${name}.bdns (tokenId ${tokenId})`);
  console.log(`owner   : ${owner}`);
  console.log(`site    : ${siteUrl} (${siteKind})`);

  let nonce = await signer.getNonce();

  if (ethAddress) {
    // Contract keys are free-form strings: the gateway docs use lowercase
    // (`eth`) while the dashboard reads uppercase (`ETH`). Store both.
    for (const key of ["eth", "ETH"]) {
      const tx = await registry.setAddressRecord(tokenId, key, ethAddress, { nonce: nonce++ });
      await tx.wait();
      console.log(`addr ${key.padEnd(4)}: ${ethAddress}  tx=${tx.hash}`);
    }
  }

  const txUrl = await registry.setCustomTXT(tokenId, "url", siteUrl, { nonce: nonce++ });
  await txUrl.wait();
  console.log(`txt url : ${siteUrl}  tx=${txUrl.hash}`);

  const txSite = await registry.setCustomTXT(tokenId, "site", siteKind, { nonce: nonce++ });
  await txSite.wait();
  console.log(`txt site: ${siteKind}  tx=${txSite.hash}`);

  const cid = await registry.ipfsCIDOf(tokenId);
  console.log(`ipfsCID : ${cid || "(none set)"}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
