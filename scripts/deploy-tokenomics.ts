import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { resolveOwner } from "./treasury";

const WEI = 10n ** 18n;
const DAY = 24n * 3600n;
const YEAR = 365n * DAY;
const MONTH = 30n * DAY;

const SUPPLY = 1_000_000_000n; // 1B BDNS

const TREASURY_WALLET = "0xe0Bff551891cb718E351522fb798AbF9ac71Fbfe";

type Deployment = {
  network: string;
  chainId: number;
  contracts: Record<string, string>;
  timestamp?: string;
};

function loadDeployment(name: string): Deployment {
  const file = path.join(__dirname, "..", "deployments", `${name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`missing deployment file: ${file}; run scripts/deploy.ts first`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function nowSeconds(): bigint {
  return BigInt(Math.floor(Date.now() / 1000));
}

function annualDecaySchedule(emissionTs: bigint, totalScalar: bigint, years: number): { amount: bigint; end: bigint }[] {
  const y = BigInt(years);
  const pow4 = (n: bigint): bigint => 4n ** n;
  const pow3 = (n: bigint): bigint => 3n ** n;

  const base = (totalScalar * pow4(y - 1n)) / (pow4(y) - pow3(y));

  const amounts: bigint[] = [];
  let sum = 0n;
  for (let i = 0; i < years; i++) {
    if (i === years - 1) {
      amounts.push(totalScalar - sum);
      sum = totalScalar;
    } else {
      const a = (base * pow3(BigInt(i))) / pow4(BigInt(i));
      amounts.push(a);
      sum += a;
    }
  }

  return amounts.map((amount, i) => ({
    amount: amount * WEI,
    end: emissionTs + BigInt(i + 1) * YEAR,
  }));
}

function canSignAsTreasury(deployerAddress: string): boolean {
  const owner = resolveOwner(network.name, deployerAddress);
  if (owner === deployerAddress) return true;
  return Boolean(process.env.TREASURY_PRIVATE_KEY);
}

async function asTreasury(contract: any): Promise<any> {
  const [deployer] = await ethers.getSigners();
  const owner = resolveOwner(network.name, deployer.address);
  if (owner === deployer.address) return contract;
  const pk = process.env.TREASURY_PRIVATE_KEY;
  if (!pk) throw new Error("TREASURY_PRIVATE_KEY required to act as treasury");
  return contract.connect(new ethers.Wallet(pk, ethers.provider));
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployment = loadDeployment(network.name);
  const bdnsAddress = deployment.contracts.BDNS;
  if (!bdnsAddress) throw new Error(`no BDNS contract recorded for network "${network.name}"`);

  const owner = resolveOwner(network.name, deployer.address);
  const treasury = owner;
  const bdns = await ethers.getContractAt("BDNS", bdnsAddress);
  const funded = canSignAsTreasury(deployer.address);

  // ---- Final 2026 allocation (1B BDNS, must sum to 100%) ----
  const ecosystemAllocation = ethers.parseEther(process.env.ECOSYSTEM_ALLOCATION_BDNS ?? "600000000");
  const launchLiquidityAllocation = ethers.parseEther(process.env.LAUNCH_LIQUIDITY_ALLOCATION_BDNS ?? "150000000");
  const teamAllocation = ethers.parseEther(process.env.TEAM_ALLOCATION_BDNS ?? "100000000");
  const marketingAllocation = ethers.parseEther(process.env.MARKETING_ALLOCATION_BDNS ?? "50000000");
  const stakingAllocation = ethers.parseEther(process.env.STAKING_ALLOCATION_BDNS ?? "50000000");
  const chainReserveAllocation = ethers.parseEther(process.env.CHAIN_RESERVE_ALLOCATION_BDNS ?? "50000000");

  const checkSum =
    ecosystemAllocation +
    launchLiquidityAllocation +
    teamAllocation +
    marketingAllocation +
    stakingAllocation +
    chainReserveAllocation;
  if (checkSum !== SUPPLY * WEI) {
    throw new Error(`allocation sum ${ethers.formatEther(checkSum)} BDNS does not equal 1B`);
  }

  // Ecosystem & Treasury: 1% at TGE, 99% linear over 60 months
  const ecosystemTge = (ecosystemAllocation * 1n) / 100n;
  const ecosystemVest = ecosystemAllocation - ecosystemTge;
  const ecosystemVestMonths = 60n;

  // Launch & Liquidity: 100% locked at TGE (DEX/CEX LPs)
  // Team & Advisors: 6-month cliff, 24-month vesting
  const teamCliff = BigInt(process.env.TEAM_CLIFF_DAYS ?? "180") * DAY;
  const teamDuration = BigInt(process.env.TEAM_VEST_DAYS ?? "720") * DAY;

  // Marketing & Partnerships: linear over 60 months (~833,333 BDNS / month)
  const marketingDuration = 60n * MONTH;

  // Community Staking Leaderboard: decaying release over 48 months (4 years)
  const stakingYears = 4;

  // Chain Reserve: managed by protocol treasury wallet
  const chainReserveRecipient = process.env.CHAIN_RESERVE_WALLET ?? TREASURY_WALLET;

  console.log(`network=${network.name} treasury=${treasury} bdns=${bdnsAddress}`);
  console.log(
    `allocation: ecosystem=${ethers.formatEther(ecosystemAllocation)} launch=${ethers.formatEther(
      launchLiquidityAllocation
    )} team=${ethers.formatEther(teamAllocation)} marketing=${ethers.formatEther(
      marketingAllocation
    )} staking=${ethers.formatEther(stakingAllocation)} chain=${ethers.formatEther(chainReserveAllocation)} BDNS`
  );
  console.log(`sum check: ${ethers.formatEther(checkSum)} BDNS == 1B OK`);

  let ecosystemVaultAddress = "";
  let liquidityVaultAddress = "";

  // ---- BDNSRoyaltySplitter: 2.5% fee -> 1.0/0.55/0.45/0.35/0.25 ----
  const royaltySplitter = await ethers.deployContract("BDNSRoyaltySplitter", [bdnsAddress, owner]);
  await royaltySplitter.waitForDeployment();
  const royaltySplitterAddress = await royaltySplitter.getAddress();
  console.log(`BDNSRoyaltySplitter deployed at ${royaltySplitterAddress}`);

  const royaltyTreasury = process.env.ROYALTY_TREASURY_WALLET ?? TREASURY_WALLET;
  const royaltyDev = process.env.ROYALTY_DEV_WALLET ?? TREASURY_WALLET;
  const royaltyLp = process.env.ROYALTY_LP_WALLET ?? TREASURY_WALLET;
  const royaltyMarketing = process.env.ROYALTY_MARKETING_WALLET ?? TREASURY_WALLET;
  const royaltyAudit = process.env.ROYALTY_AUDIT_WALLET ?? TREASURY_WALLET;

  await (await royaltySplitter.setDestinations(royaltyTreasury, royaltyDev, royaltyLp, royaltyMarketing, royaltyAudit)).wait();
  console.log("royalty splitter destinations set (2.5% -> 0.9/0.55/0.45/0.35/0.25 of sale)");

  // ---- BDNSBurnEngine: 10-year decaying auto-burn, 500M hard cap ----
  const burnEngine = await ethers.deployContract("BDNSBurnEngine", [bdnsAddress, owner]);
  await burnEngine.waitForDeployment();
  const burnEngineAddress = await burnEngine.getAddress();
  console.log(`BDNSBurnEngine deployed at ${burnEngineAddress}`);

  // ---- BDNSStakingVault (community leaderboard, decaying 48 months) ----
  const schedule = annualDecaySchedule(nowSeconds(), stakingAllocation / WEI, stakingYears);
  const stakingVault = await ethers.deployContract("BDNSStakingVault", [
    owner,
    bdnsAddress,
    schedule.map((t) => ({ amount: t.amount, end: t.end })),
  ]);
  await stakingVault.waitForDeployment();
  const stakingVaultAddress = await stakingVault.getAddress();
  console.log(
    `BDNSStakingVault deployed at ${stakingVaultAddress} emission=${ethers.formatEther(stakingAllocation)} BDNS / ${stakingYears} years (48 months decaying)`
  );

  // ---- BDNSVestingVault: Team (6m cliff / 24m vest) ----
  const teamVault = await ethers.deployContract("BDNSVestingVault", [
    owner,
    bdnsAddress,
    treasury,
    0n,
    teamCliff,
    teamDuration,
  ]);
  await teamVault.waitForDeployment();
  const teamVaultAddress = await teamVault.getAddress();
  console.log(`Team BDNSVestingVault deployed at ${teamVaultAddress} (cliff 6m, vest 24m)`);

  // ---- BDNSVestingVault: Marketing (60 months linear) ----
  const marketingVault = await ethers.deployContract("BDNSVestingVault", [
    owner,
    bdnsAddress,
    treasury,
    0n,
    0n,
    marketingDuration,
  ]);
  await marketingVault.waitForDeployment();
  const marketingVaultAddress = await marketingVault.getAddress();
  console.log(`Marketing BDNSVestingVault deployed at ${marketingVaultAddress} (60 months linear)`);

  if (funded) {
    const admin = await asTreasury(bdns);

    // Ecosystem & Treasury: 1% TGE direct + 99% into the linear vault
    await (await admin.mint(treasury, ecosystemTge)).wait();
    console.log(`ecosystem TGE (1%) minted ${ethers.formatEther(ecosystemTge)} BDNS -> treasury`);

    const ecosystemVault = await ethers.deployContract("BDNSVestingVault", [
      owner,
      bdnsAddress,
      treasury,
      0n,
      0n,
      ecosystemVestMonths * MONTH,
    ]);
    await ecosystemVault.waitForDeployment();
    ecosystemVaultAddress = await ecosystemVault.getAddress();

    await (await admin.mint(treasury, ecosystemVest)).wait();
    await (await admin.approve(ecosystemVaultAddress, ecosystemVest)).wait();
    await (await ecosystemVault.fund(ecosystemVest)).wait();
    console.log(`ecosystem 99% vault funded ${ethers.formatEther(ecosystemVest)} BDNS (60 months linear)`);

    // Launch & Liquidity: 100% locked at TGE -> liquidity escrow (treasury-owned vault, released with LPs)
    const liquidityVault = await ethers.deployContract("BDNSVestingVault", [
      owner,
      bdnsAddress,
      treasury,
      0n,
      0n,
      BigInt(process.env.LIQUIDITY_LOCK_DAYS ?? "365") * DAY,
    ]);
    await liquidityVault.waitForDeployment();
    liquidityVaultAddress = await liquidityVault.getAddress();

    await (await admin.mint(treasury, launchLiquidityAllocation)).wait();
    await (await admin.approve(liquidityVaultAddress, launchLiquidityAllocation)).wait();
    await (await liquidityVault.fund(launchLiquidityAllocation)).wait();
    console.log(`launch & liquidity 150M locked at TGE -> ${liquidityVaultAddress}`);

    // Team vault funded
    await (await admin.mint(treasury, teamAllocation)).wait();
    await (await admin.approve(teamVaultAddress, teamAllocation)).wait();
    await (await teamVault.fund(teamAllocation)).wait();
    console.log(`team vault funded ${ethers.formatEther(teamAllocation)} BDNS`);

    // Marketing vault funded
    await (await admin.mint(treasury, marketingAllocation)).wait();
    await (await admin.approve(marketingVaultAddress, marketingAllocation)).wait();
    await (await marketingVault.fund(marketingAllocation)).wait();
    console.log(`marketing vault funded ${ethers.formatEther(marketingAllocation)} BDNS (60 months)`);

    // Staking vault funded
    await (await admin.mint(stakingVaultAddress, stakingAllocation)).wait();
    console.log(`staking vault locked ${ethers.formatEther(stakingAllocation)} BDNS -> ${stakingVaultAddress}`);

    // Chain reserve -> protocol treasury
    await (await admin.mint(chainReserveRecipient, chainReserveAllocation)).wait();
    console.log(`chain reserve minted ${ethers.formatEther(chainReserveAllocation)} BDNS -> ${chainReserveRecipient}`);
  } else {
    console.warn(
      `treasury=${treasury} not locally controlled; funding skipped. Run this script with TREASURY_PRIVATE_KEY to auto-mint.`
    );
  }

  const releaser = process.env.EMISSION_RELEASER ?? treasury;
  const role = await stakingVault.RELEASER_ROLE();
  if (funded) {
    const admin = await asTreasury(stakingVault);
    if (!(await stakingVault.hasRole(role, releaser))) {
      await (await admin.grantRole(role, releaser)).wait();
      console.log(`RELEASER_ROLE granted to ${releaser}`);
    }
    if ((await stakingVault.rewardsRecipient()) !== releaser) {
      await (await admin.setRewardsRecipient(releaser)).wait();
      console.log(`rewardsRecipient set to ${releaser}`);
    }
  } else {
    console.warn(`emission wiring (RELEASER_ROLE + rewardsRecipient=${releaser}): run with TREASURY_PRIVATE_KEY to finalize`);
  }

  deployment.contracts.BDNSRoyaltySplitter = royaltySplitterAddress;
  deployment.contracts.BDNSBurnEngine = burnEngineAddress;
  deployment.contracts.BDNSStakingVault = stakingVaultAddress;
  deployment.contracts.TeamVestingVault = teamVaultAddress;
  deployment.contracts.MarketingVestingVault = marketingVaultAddress;
  if (ecosystemVaultAddress) deployment.contracts.EcosystemVestingVault = ecosystemVaultAddress;
  if (liquidityVaultAddress) deployment.contracts.LiquidityVestingVault = liquidityVaultAddress;
  deployment.timestamp = new Date().toISOString();

  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  fs.writeFileSync(file, JSON.stringify(deployment, null, 2));
  console.log(`deployment saved to ${file}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});