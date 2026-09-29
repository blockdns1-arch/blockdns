import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const DAY = BigInt(24 * 60 * 60);

async function main() {
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const bdnsAddress = deployment.contracts.BDNS;

  const merkle = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "airdrop", "merkle.json"), "utf8"));
  const merkleRoot = merkle.root;
  const airdropTotal = BigInt(merkle.total);

  const { treasury } = deployment;
  const deployer = (await ethers.getSigners())[0];
  const owner = treasury && treasury.toLowerCase() === deployer.address.toLowerCase() ? treasury : deployer.address;

  const airdropTgeBps = Number(process.env.AIRDROP_TGE_BPS ?? "1000");
  const vestingMonths = Number(process.env.AIRDROP_VESTING_MONTHS ?? "10");
  const airdropDuration = BigInt(vestingMonths) * 30n * DAY;
  const claimDeadline = BigInt(process.env.AIRDROP_CLAIM_DEADLINE ?? "0");

  console.log(`network=${network.name} owner=${owner} bdns=${bdnsAddress}`);
  console.log(`airdrop merkle root=${merkleRoot} total=${ethers.formatEther(airdropTotal)} BDNS (${merkle.entryCount} entries)`);

  const airdrop = await ethers.deployContract("BDNSAirdrop", [
    bdnsAddress,
    owner,
    merkleRoot,
    airdropTgeBps,
    airdropDuration,
    0n,
    claimDeadline,
  ]);
  await airdrop.waitForDeployment();
  const airdropAddress = await airdrop.getAddress();
  console.log(`BDNSAirdrop deployed at ${airdropAddress}`);

  const bdns = await ethers.getContractAt("BDNS", bdnsAddress);
  if (await bdns.hasRole(await bdns.MINTER_ROLE(), deployer.address)) {
    await (await bdns.connect(deployer).mint(airdropAddress, airdropTotal)).wait();
    console.log(`airdrop funded ${ethers.formatEther(airdropTotal)} BDNS -> ${airdropAddress}`);
  } else {
    console.warn(`funding skipped: deployer lacks MINTER_ROLE (run with the treasury/admin key)`);
  }

  deployment.contracts.BDNSAirdrop = airdropAddress;
  deployment.timestamp = new Date().toISOString();
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2) + "\n");
  console.log(`deployment saved to ${deploymentPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});