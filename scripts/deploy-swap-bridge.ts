import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { resolveTreasury } from "./treasury";

async function main() {
  const [deployer] = await ethers.getSigners();
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const bdns = deployment.contracts.BDNS;
  if (!bdns) throw new Error(`missing BDNS for network "${network.name}"`);
  const treasury = resolveTreasury(network.name, deployer.address);

  const bdnsContract = await ethers.getContractAt("BDNS", bdns);
  const bdnsDecimals = 18;

  const ethPerBdnWei = ethers.parseEther(process.env.SWAP_ETH_PER_BDN ?? "0.0005");
  const bdnsUsdPrice = ethers.parseUnits(process.env.SWAP_BDNS_USD_PRICE ?? "0.01", 6);
  const swapFeeUsd = ethers.parseUnits(process.env.SWAP_FEE_USD ?? "0.05", 6);
  const bridgeFeeUsd = ethers.parseUnits(process.env.BRIDGE_FEE_USD ?? "0.10", 6);
  const swapBdnsLiquidity = ethers.parseEther(process.env.SWAP_BDNS_LIQUIDITY ?? "500000");
  const bridgeBdnsLiquidity = ethers.parseEther(process.env.BRIDGE_BDNS_LIQUIDITY ?? "200000");
  const swapEthLiquidity = ethers.parseEther(process.env.SWAP_ETH_LIQUIDITY ?? "0.005");

  console.log(`network=${network.name} bdns=${bdns} treasury=${treasury}`);
  console.log(
    `rates: ethPerBdn=${ethers.formatEther(ethPerBdnWei)} ETH` +
      ` bdnsUsd=${Number(bdnsUsdPrice) / 1e6}$` +
      ` swapFee=${Number(swapFeeUsd) / 1e6}$` +
      ` bridgeFee=${Number(bridgeFeeUsd) / 1e6}$`
  );

  const swap = await ethers.deployContract("BlockDNSwap", [
    bdns,
    treasury,
    ethPerBdnWei,
    bdnsUsdPrice,
    swapFeeUsd,
  ]);
  await swap.waitForDeployment();
  const swapAddress = await swap.getAddress();
  console.log(`BlockDNSwap deployed at ${swapAddress}`);

  const bridge = await ethers.deployContract("BdnBridge", [
    bdns,
    treasury,
    bdnsUsdPrice,
    bridgeFeeUsd,
  ]);
  await bridge.waitForDeployment();
  const bridgeAddress = await bridge.getAddress();
  console.log(`BdnBridge deployed at ${bridgeAddress}`);

  console.log(`funding swap with ${ethers.formatEther(swapBdnsLiquidity)} BDNS + ${ethers.formatEther(swapEthLiquidity)} ETH`);
  let tx = await bdnsContract.transfer(swapAddress, swapBdnsLiquidity);
  await tx.wait();
  tx = await deployer.sendTransaction({ to: swapAddress, value: swapEthLiquidity });
  await tx.wait();

  console.log(`funding bridge with ${ethers.formatEther(bridgeBdnsLiquidity)} BDNS`);
  tx = await bdnsContract.transfer(bridgeAddress, bridgeBdnsLiquidity);
  await tx.wait();

  const [swapBal, bridgeBal] = await Promise.all([
    bdnsContract.balanceOf(swapAddress),
    bdnsContract.balanceOf(bridgeAddress),
  ]);
  const swapEth = await ethers.provider.getBalance(swapAddress);
  console.log(
    `swap balance=${ethers.formatEther(swapBal)} BDNS / ${ethers.formatEther(swapEth)} ETH, ` +
      `bridge balance=${ethers.formatEther(bridgeBal)} BDNS`
  );

  deployment.contracts.BlockDNSwap = swapAddress;
  deployment.contracts.BdnBridge = bridgeAddress;
  deployment.timestamp = new Date().toISOString();
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  fs.writeFileSync(file, JSON.stringify(deployment, null, 2));
  console.log(`deployment saved to ${file}`);
  console.log(`bdns decimals=${bdnsDecimals}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});