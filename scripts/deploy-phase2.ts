import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { resolveOwner, resolveTreasury } from "./treasury";

type Deployment = {
  network: string;
  chainId: number;
  contracts: Record<string, string>;
  timestamp?: string;
  owner?: string;
  treasury?: string;
};

function loadDeployment(name: string): Deployment {
  const file = path.join(__dirname, "..", "deployments", `${name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`missing deployment file: ${file}; run scripts/deploy.ts first`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployment = loadDeployment(network.name);
  const bdnsAddress = deployment.contracts.BDNS;
  if (!bdnsAddress) {
    throw new Error(`no BDNS contract recorded for network "${network.name}"`);
  }

  const owner = resolveOwner(network.name, deployer.address);
  const treasury = resolveTreasury(network.name, deployer.address);
  const priceTier2 = ethers.parseEther(process.env.PREMIUM_TIER_2 ?? "1000");
  const priceTier4 = ethers.parseEther(process.env.PREMIUM_TIER_4 ?? "100");
  const baseURI = process.env.DOMAIN_BASE_URI ?? "ipfs://";

  console.log(
    `network=${network.name} deployer=${deployer.address} bdns=${bdnsAddress} owner=${owner} treasury=${treasury}`
  );

  const pricer = await ethers.deployContract("BlockDNSPricer", [
    owner,
    bdnsAddress,
    treasury,
    priceTier2,
    priceTier4,
  ]);
  await pricer.waitForDeployment();
  const pricerAddress = await pricer.getAddress();
  console.log(`BlockDNSPricer deployed at ${pricerAddress} (owner=${owner}, treasury=${treasury})`);

  const registry = await ethers.deployContract("BlockDNSRegistry", [
    owner,
    baseURI,
  ]);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`BlockDNSRegistry deployed at ${registryAddress} (admin=${owner})`);

  const linkTx = await registry.setPricer(pricerAddress);
  await linkTx.wait();
  console.log(`registry.pricer set to ${pricerAddress}`);

  const resolver = await ethers.deployContract("BlockDNSResolver", [
    owner,
    registryAddress,
  ]);
  await resolver.waitForDeployment();
  const resolverAddress = await resolver.getAddress();
  console.log(`BlockDNSResolver deployed at ${resolverAddress}`);

  deployment.contracts.BlockDNSPricer = pricerAddress;
  deployment.contracts.BlockDNSRegistry = registryAddress;
  deployment.contracts.BlockDNSResolver = resolverAddress;
  deployment.timestamp = new Date().toISOString();
  deployment.owner = owner;
  deployment.treasury = treasury;

  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  fs.writeFileSync(file, JSON.stringify(deployment, null, 2));
  console.log(`deployment saved to ${file}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});