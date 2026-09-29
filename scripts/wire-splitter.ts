import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const marketAddress = deployment.contracts.BlockDNSMarketplace;
  const splitterAddress = deployment.contracts.BDNSRoyaltySplitter;
  if (!marketAddress || !splitterAddress) {
    throw new Error(`marketplace or splitter missing for network "${network.name}"`);
  }
  const market = await ethers.getContractAt("BlockDNSMarketplace", marketAddress);
  await (await market.setRoyaltySplitter(splitterAddress)).wait();
  console.log(`marketplace ${marketAddress} -> splitter ${splitterAddress} wired`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});