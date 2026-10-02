import { ethers, network, run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Submits Etherscan V2 (Basescan) verification for every deployed contract.
// Constructor arguments are read back from chain state where the contract exposes
// them, and fall back to the deployment defaults for values that were later changed
// by an owner setter (the swap rate, for example), because Etherscan matches the
// creation code, not the current storage.
//
// Usage: npx hardhat run scripts/verify-etherscan.ts --network base-sepolia
const SWAP_CONSTRUCTOR = {
  ethPerBdn: ethers.parseEther("0.0005"),
  bdnsUsdPrice: ethers.parseUnits("0.01", 6),
  swapFeeUsd: ethers.parseUnits("0.05", 6),
};
const BRIDGE_CONSTRUCTOR = {
  bdnsUsdPrice: ethers.parseUnits("0.01", 6),
  bridgeFeeUsd: ethers.parseUnits("0.10", 6),
};

async function main() {
  const deployment = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`), "utf8")
  );
  const c = deployment.contracts as Record<string, string>;
  const admin = (deployment.deployer ?? deployment.owner) as string;
  if (!admin) throw new Error("deployment manifest has no deployer/owner address");
  const missing = ["BDNS", "BlockDNSRegistry", "BlockDNSwap", "BdnBridge"].filter((name) => !c[name]);
  if (missing.length > 0) throw new Error(`deployment manifest is missing: ${missing.join(", ")}`);
  const bdns = c.BDNS;

  const pricer = await ethers.getContractAt(
    ["function owner() view returns (address)", "function treasury() view returns (address)", "function priceTier2() view returns (uint256)", "function priceTier4() view returns (uint256)"],
    c.BlockDNSPricer
  );
  const registry = await ethers.getContractAt(["function owner() view returns (address)", "function baseURI() view returns (string)"], c.BlockDNSRegistry);
  const resolver = await ethers.getContractAt(["function owner() view returns (address)", "function registry() view returns (address)"], c.BlockDNSResolver);
  const marketplace = await ethers.getContractAt(
    ["function owner() view returns (address)", "function treasury() view returns (address)", "function feeBps() view returns (uint16)"],
    c.BlockDNSMarketplace
  );
  const swap = await ethers.getContractAt(["function feeCollector() view returns (address)"], c.BlockDNSwap);
  const bridge = await ethers.getContractAt(["function feeCollector() view returns (address)"], c.BdnBridge);
  const splitter = await ethers.getContractAt(["function owner() view returns (address)"], c.BDNSRoyaltySplitter);
  const burn = await ethers.getContractAt(["function owner() view returns (address)"], c.BDNSBurnEngine);

  const staking = await ethers.getContractAt(
    [
      "function owner() view returns (address)",
      "function trancheCount() view returns (uint256)",
      "function trancheAt(uint256) view returns (tuple(uint256 amount,uint256 end))",
    ],
    c.BDNSStakingVault
  );
  const trancheCount = Number(await staking.trancheCount());
  const schedule = [];
  for (let index = 0; index < trancheCount; index++) {
    const tranche = await staking.trancheAt(index);
    schedule.push({ amount: tranche.amount.toString(), end: tranche.end.toString() });
  }

  const vestingAbi = [
    "function owner() view returns (address)",
    "function beneficiary() view returns (address)",
    "function start() view returns (uint256)",
    "function cliff() view returns (uint256)",
    "function duration() view returns (uint256)",
  ];
  const vestingKeys = ["TeamVestingVault", "MarketingVestingVault", "EcosystemVestingVault", "LiquidityVestingVault"];

  const targets: { name: string; address: string; args: unknown[] }[] = [
    { name: "BDNS", address: bdns, args: [ethers.parseUnits("1000000000", 18).toString(), admin] },
    { name: "L2CrossDomainMessenger", address: c.L2CrossDomainMessenger, args: [] },
    {
      name: "BlockDNSPricer",
      address: c.BlockDNSPricer,
      args: [
        await pricer.owner(),
        bdns,
        await pricer.treasury(),
        (await pricer.priceTier2()).toString(),
        (await pricer.priceTier4()).toString(),
      ],
    },
    { name: "BlockDNSRegistry", address: c.BlockDNSRegistry, args: [await registry.owner(), await registry.baseURI()] },
    { name: "BlockDNSResolver", address: c.BlockDNSResolver, args: [await resolver.owner(), await resolver.registry()] },
    {
      name: "BlockDNSMarketplace",
      address: c.BlockDNSMarketplace,
      args: [c.BlockDNSRegistry, bdns, await marketplace.treasury(), await marketplace.feeBps()],
    },
    {
      name: "BlockDNSwap",
      address: c.BlockDNSwap,
      args: [
        bdns,
        await swap.feeCollector(),
        SWAP_CONSTRUCTOR.ethPerBdn.toString(),
        SWAP_CONSTRUCTOR.bdnsUsdPrice.toString(),
        SWAP_CONSTRUCTOR.swapFeeUsd.toString(),
      ],
    },
    {
      name: "BdnBridge",
      address: c.BdnBridge,
      args: [
        bdns,
        await bridge.feeCollector(),
        BRIDGE_CONSTRUCTOR.bdnsUsdPrice.toString(),
        BRIDGE_CONSTRUCTOR.bridgeFeeUsd.toString(),
      ],
    },
    { name: "BDNSRoyaltySplitter", address: c.BDNSRoyaltySplitter, args: [bdns, await splitter.owner()] },
    { name: "BDNSBurnEngine", address: c.BDNSBurnEngine, args: [bdns, await burn.owner()] },
    {
      name: "BDNSStakingVault",
      address: c.BDNSStakingVault,
      args: [await staking.owner(), bdns, schedule],
    },
  ];

  for (const key of vestingKeys) {
    const vault = await ethers.getContractAt(vestingAbi, c[key]);
    targets.push({
      name: key,
      address: c[key],
      args: [
        await vault.owner(),
        bdns,
        await vault.beneficiary(),
        (await vault.start()).toString(),
        (await vault.cliff()).toString(),
        (await vault.duration()).toString(),
      ],
    });
  }

  console.log(`network=${network.name} admin=${admin} targets=${targets.length}`);
  const only = process.env.VERIFY_ONLY?.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  const selected = only && only.length > 0 ? targets.filter((target) => only.includes(target.name.toLowerCase())) : targets;
  if (only && only.length > 0 && selected.length === 0) throw new Error(`VERIFY_ONLY matched no contract: ${only.join(",")}`);
  const results: { name: string; address: string; ok: boolean; message: string }[] = [];

  for (const target of selected) {
    try {
      await run("verify:verify", { address: target.address, constructorArguments: target.args });
      console.log(`OK    ${target.name} ${target.address}`);
      results.push({ name: target.name, address: target.address, ok: true, message: "verified" });
    } catch (error) {
      const message = ((error as Error).message ?? String(error)).split("\n")[0];
      // A contract that is already verified is a success, not a failure.
      if (/already been verified|already verified/i.test(message)) {
        console.log(`OK    ${target.name} ${target.address} (already verified)`);
        results.push({ name: target.name, address: target.address, ok: true, message: "already verified" });
        continue;
      }
      console.log(`FAIL  ${target.name} ${target.address} ${message}`);
      results.push({ name: target.name, address: target.address, ok: false, message });
    }
  }

  const ok = results.filter((result) => result.ok).length;
  console.log(`\nsubmitted=${ok}/${results.length}`);
  for (const result of results.filter((item) => !item.ok)) {
    console.log(`  ${result.name}: ${result.message}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});