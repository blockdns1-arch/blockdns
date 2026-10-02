import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import type { BaseContract, Signer } from "ethers";

// Funds already-deployed BlockDNSwap / BdnBridge contracts and records them in the
// deployment manifest. Safe to re-run: only the missing liquidity is transferred.
//
// Addresses come from the manifest when present, otherwise from SWAP_ADDRESS /
// BRIDGE_ADDRESS (needed after a partial deploy where the funding step reverted).
async function main() {
  const [deployer] = await ethers.getSigners();
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

  const bdns = deployment.contracts.BDNS;
  if (!bdns) throw new Error(`missing BDNS for network "${network.name}"`);

  const swapAddress = deployment.contracts.BlockDNSwap ?? process.env.SWAP_ADDRESS;
  const bridgeAddress = deployment.contracts.BdnBridge ?? process.env.BRIDGE_ADDRESS;
  if (!swapAddress) throw new Error("missing swap address: set SWAP_ADDRESS or deploy BlockDNSwap first");
  if (!bridgeAddress) throw new Error("missing bridge address: set BRIDGE_ADDRESS or deploy BdnBridge first");

  const targetSwapBdns = ethers.parseEther(process.env.SWAP_BDNS_LIQUIDITY ?? "500000");
  const targetBridgeBdns = ethers.parseEther(process.env.BRIDGE_BDNS_LIQUIDITY ?? "200000");
  const targetSwapEth = ethers.parseEther(process.env.SWAP_ETH_LIQUIDITY ?? "0.005");

  const bdnsContract = await ethers.getContractAt("BDNS", bdns);

  console.log(`network=${network.name} deployer=${deployer.address} bdns=${bdns}`);
  console.log(`swap=${swapAddress} bridge=${bridgeAddress}`);

  await fundBdns(deployer, bdnsContract, swapAddress, targetSwapBdns);
  await fundBdns(deployer, bdnsContract, bridgeAddress, targetBridgeBdns);
  await fundEth(deployer, swapAddress, targetSwapEth);

  const [swapBdns, bridgeBdns] = await Promise.all([
    bdnsContract.balanceOf(swapAddress),
    bdnsContract.balanceOf(bridgeAddress),
  ]);
  const swapEth = await ethers.provider.getBalance(swapAddress);
  console.log(
    `swap balance=${ethers.formatEther(swapBdns)} BDNS / ${ethers.formatEther(swapEth)} ETH, ` +
      `bridge balance=${ethers.formatEther(bridgeBdns)} BDNS`
  );

  deployment.contracts.BlockDNSwap = swapAddress;
  deployment.contracts.BdnBridge = bridgeAddress;
  deployment.timestamp = new Date().toISOString();
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log(`deployment saved to ${deploymentPath}`);
}

async function fundBdns(deployer: Signer, bdnsContract: BaseContract, target: string, targetAmount: bigint) {
  const current: bigint = await bdnsContract.balanceOf(target);
  if (current >= targetAmount) {
    console.log(`BDNS liquidity already funded at ${target} (${ethers.formatEther(current)} BDNS)`);
    return;
  }
  const missing = targetAmount - current;
  console.log(`funding ${target} with ${ethers.formatEther(missing)} BDNS`);
  const tx = await bdnsContract.connect(deployer).transfer(target, missing);
  await tx.wait();
}

async function fundEth(deployer: Signer, target: string, targetAmount: bigint) {
  const current: bigint = await ethers.provider.getBalance(target);
  if (current >= targetAmount) {
    console.log(`ETH liquidity already funded at ${target} (${ethers.formatEther(current)} ETH)`);
    return;
  }
  const missing = targetAmount - current;
  console.log(`funding ${target} with ${ethers.formatEther(missing)} ETH`);
  const tx = await deployer.sendTransaction({ to: target, value: missing });
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});