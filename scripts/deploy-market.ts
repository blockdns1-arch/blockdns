import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const registry = deployment.contracts.BlockDNSRegistry;
  const bdns = deployment.contracts.BDNS;
  const treasury = deployment.treasury ?? (await ethers.getSigners())[0].address;
  const feeBps = Number(process.env.MARKET_FEE_BPS ?? "250");

  console.log(`network=${network.name} registry=${registry} bdns=${bdns} treasury=${treasury} feeBps=${feeBps}`);

  const market = await ethers.deployContract("BlockDNSMarketplace", [registry, bdns, treasury, feeBps]);
  await market.waitForDeployment();
  const marketAddress = await market.getAddress();
  console.log(`BlockDNSMarketplace deployed at ${marketAddress}`);

  deployment.contracts.BlockDNSMarketplace = marketAddress;
  deployment.timestamp = new Date().toISOString();
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2) + "\n");
  console.log(`deployment saved to ${deploymentPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});