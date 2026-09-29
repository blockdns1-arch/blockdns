const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const DAY = 86400;
const WEI = 10n ** 18n;

async function warp(seconds) {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
}

async function nowTs() {
  return (await ethers.provider.getBlock("latest")).timestamp;
}

// Mirrors scripts/merkleTree.ts
const { keccak256, solidityPacked, getAddress } = require("ethers");
function airdropLeaf(address, amount) {
  return keccak256(solidityPacked(["address", "uint256"], [getAddress(address), amount]));
}
function hashPair(a, b) {
  const o = a.toLowerCase() <= b.toLowerCase() ? [a, b] : [b, a];
  return keccak256(ethers.concat(o));
}
function levelsOf(leaves) {
  const levels = [leaves.slice()];
  while (levels[levels.length - 1].length > 1) {
    const layer = levels[levels.length - 1];
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = i + 1 < layer.length ? layer[i + 1] : left;
      next.push(hashPair(left, right));
    }
    levels.push(next);
  }
  return levels;
}
function buildTree(entries) {
  const leaves = entries
    .map((e) => airdropLeaf(e.address, e.amount))
    .sort((a, b) => (a.toString().toLowerCase() < b.toString().toLowerCase() ? -1 : 1));
  const levels = levelsOf(leaves);
  const root = levels[levels.length - 1][0];
  const proofs = new Map();
  for (const entry of entries) {
    const leaf = airdropLeaf(entry.address, entry.amount);
    const index = leaves.indexOf(leaf);
    let idx = index;
    const proof = [];
    for (let level = 0; level < levels.length - 1; level++) {
      const layer = levels[level];
      const sibling = idx % 2 === 0 ? idx + 1 : idx - 1;
      proof.push(sibling < layer.length ? layer[sibling] : layer[idx]);
      idx = Math.floor(idx / 2);
    }
    proofs.set(getAddress(entry.address), proof);
  }
  return { root, proofs };
}

describe("BlockDNS Dry-Run Launch (final allocation: 60/15/10/5/5/5)", function () {
  let bdns, registry, pricer, market;
  let splitter, burnEngine, stakingVault, teamVault, marketingVault, ecosystemVault, liquidityVault, airdrop;
  let signers, deployer, treasury, dev, lp, marketing, audit, ben;

  const tgeBps = 1000n; // 10% at TGE for airdrop/validator pool in this dry-run
  const airdropDuration = 300n * BigInt(DAY);

  let start;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    [deployer, treasury, dev, lp, marketing, audit, ben] = [
      signers[0].address, // deployer/owner/admin
      signers[1].address, // treasury wallet
      signers[2].address, // dev fund
      signers[3].address, // liquidity fund
      signers[4].address, // marketing fund
      signers[5].address, // audit & security fund
      signers[6].address, // staking rewards recipient
    ];

    // 1B BDNS, admin=deployer
    bdns = await ethers.deployContract("BDNS", [ethers.parseEther("1000000000"), deployer]);
    await bdns.waitForDeployment();

    registry = await ethers.deployContract("BlockDNSRegistry", [deployer, "ipfs://"]);
    await registry.waitForDeployment();

    pricer = await ethers.deployContract("BlockDNSPricer", [
      deployer, treasury, await bdns.getAddress(), ethers.parseEther("25"), ethers.parseEther("5"),
    ]);
    await pricer.waitForDeployment();

    market = await ethers.deployContract("BlockDNSMarketplace", [
      await registry.getAddress(), await bdns.getAddress(), treasury, 250,
    ]);
    await market.waitForDeployment();

    // 5% -> 0.9/0.55/0.45/0.35/0.25 payout splitter
    splitter = await ethers.deployContract("BDNSRoyaltySplitter", [await bdns.getAddress(), deployer]);
    await splitter.waitForDeployment();
    await (await splitter.setDestinations(treasury, dev, lp, marketing, audit)).wait();

    // burning engine
    burnEngine = await ethers.deployContract("BDNSBurnEngine", [await bdns.getAddress(), deployer]);
    await burnEngine.waitForDeployment();

    const year = 365n * BigInt(DAY);
    const approxStart = BigInt(await nowTs());
    // Community staking leaderboard: 50M decaying over 48 months
    const tranches = [20n, 15n, 10n, 5n].map((share, i) => ({
      amount: share * ethers.parseEther("1000000"),
      end: approxStart + BigInt(i + 1) * year,
    }));
    stakingVault = await ethers.deployContract("BDNSStakingVault", [
      deployer, await bdns.getAddress(), tranches,
    ]);
    await stakingVault.waitForDeployment();

    teamVault = await ethers.deployContract("BDNSVestingVault", [
      deployer, await bdns.getAddress(), treasury, 0, 180 * DAY, 720 * DAY,
    ]);
    await teamVault.waitForDeployment();

    marketingVault = await ethers.deployContract("BDNSVestingVault", [
      deployer, await bdns.getAddress(), treasury, 0, 0, 60 * 30 * DAY,
    ]);
    await marketingVault.waitForDeployment();

    ecosystemVault = await ethers.deployContract("BDNSVestingVault", [
      deployer, await bdns.getAddress(), treasury, 0, 0, 60 * 30 * DAY,
    ]);
    await ecosystemVault.waitForDeployment();

    liquidityVault = await ethers.deployContract("BDNSVestingVault", [
      deployer, await bdns.getAddress(), treasury, 0, 0, 365 * DAY,
    ]);
    await liquidityVault.waitForDeployment();

    // ---- TGE funding: 60/15/10/5/5/5 = 100% of 1B ----
    const ecosystem = ethers.parseEther("600000000");
    const launch = ethers.parseEther("150000000");
    const team = ethers.parseEther("100000000");
    const staking = ethers.parseEther("50000000");
    const marketingQty = ethers.parseEther("50000000");
    const chainReserve = ethers.parseEther("50000000");

    // Ecosystem & Treasury: 1% at TGE, 99% linear over 60 months
    const tge = (ecosystem * 1n) / 100n; // 6M
    const vest = ecosystem - tge; // 594M
    await (await bdns.mint(deployer, tge)).wait();
    await (await bdns.transfer(treasury, tge)).wait();
    await (await bdns.mint(deployer, vest)).wait();
    await (await bdns.approve(await ecosystemVault.getAddress(), vest)).wait();
    await (await ecosystemVault.fund(vest)).wait();

    // Launch & Liquidity: 100% locked at TGE
    await (await bdns.mint(deployer, launch)).wait();
    await (await bdns.approve(await liquidityVault.getAddress(), launch)).wait();
    await (await liquidityVault.fund(launch)).wait();

    // Team: 6m cliff / 24m vest
    await (await bdns.mint(deployer, team)).wait();
    await (await bdns.approve(await teamVault.getAddress(), team)).wait();
    await (await teamVault.fund(team)).wait();

    // Marketing: 60 months linear
    await (await bdns.mint(deployer, marketingQty)).wait();
    await (await bdns.approve(await marketingVault.getAddress(), marketingQty)).wait();
    await (await marketingVault.fund(marketingQty)).wait();

    // Community staking leaderboard: 5% over 48 months (decaying)
    await (await bdns.mint(await stakingVault.getAddress(), staking)).wait();
    const role = await stakingVault.RELEASER_ROLE();
    await (await stakingVault.grantRole(role, deployer)).wait();
    await (await stakingVault.setRewardsRecipient(ben)).wait();

    // Chain reserve: 5% -> treasury
    await (await bdns.mint(treasury, chainReserve)).wait();
  });

  it("sums the on-chain allocation to exactly 100% of the 1B cap", async function () {
    const teamLocked = await teamVault.totalLocked();
    const marketingLocked = await marketingVault.totalLocked();
    const ecosystemLocked = await ecosystemVault.totalLocked();
    const liquidityLocked = await liquidityVault.totalLocked();
    const stakingEmission = await stakingVault.totalEmission();

    expect(teamLocked).to.equal(ethers.parseEther("100000000"));
    expect(marketingLocked).to.equal(ethers.parseEther("50000000"));
    expect(ecosystemLocked).to.equal(ethers.parseEther("594000000"));
    expect(liquidityLocked).to.equal(ethers.parseEther("150000000"));
    expect(stakingEmission).to.equal(ethers.parseEther("50000000"));

    const allLocked = teamLocked + marketingLocked + ecosystemLocked + liquidityLocked + stakingEmission;
    // circulating = treasury direct holdings (TGE 1% + chain reserve 5% = 56M)
    const circulating = await bdns.balanceOf(treasury);
    expect(allLocked + circulating).to.equal(ethers.parseEther("1000000000"));
    expect(await bdns.totalSupply()).to.equal(ethers.parseEther("1000000000"));
  });

  it("release runs full-circle: ecosystem 1% TGE + linear 99% over 60 months", async function () {
    await warp(30 * DAY);
    const releasable = await ecosystemVault.releasableAmount();
    expect(releasable).to.be.greaterThan(0n);
    expect(releasable).to.be.lessThan(ethers.parseEther("10000000"));
  });

  it("team unlock respects the 6-month cliff", async function () {
    expect(await teamVault.releasableAmount()).to.equal(0n);
    await warp(181 * DAY);
    expect(await teamVault.releasableAmount()).to.be.greaterThan(0n);
    await warp(720 * DAY);
    expect(await teamVault.releasableAmount()).to.equal(await teamVault.totalLocked());
  });

  it("splitter distributes the 2.5% fee as 0.9/0.55/0.45/0.35/0.25", async function () {
    // cap is fully allocated, so move BDNS from the treasury instead of minting
    const treasurySigner = signers[1];
    await (await bdns.connect(treasurySigner).transfer(await splitter.getAddress(), ethers.parseEther("1000"))).wait();

    const before = {
      treasury: await bdns.balanceOf(treasury),
      dev: await bdns.balanceOf(dev),
      lp: await bdns.balanceOf(lp),
      marketing: await bdns.balanceOf(marketing),
      audit: await bdns.balanceOf(audit),
    };
    await (await splitter.split()).wait();

    // 1000 BDNS fee -> 360/220/180/140/100
    expect(await bdns.balanceOf(treasury)).to.equal(before.treasury + ethers.parseEther("360"));
    expect(await bdns.balanceOf(dev)).to.equal(before.dev + ethers.parseEther("220"));
    expect(await bdns.balanceOf(lp)).to.equal(before.lp + ethers.parseEther("180"));
    expect(await bdns.balanceOf(marketing)).to.equal(before.marketing + ethers.parseEther("140"));
    expect(await bdns.balanceOf(audit)).to.equal(before.audit + ethers.parseEther("100"));
    expect(await splitter.totalDistributed()).to.equal(ethers.parseEther("1000"));
  });

  it("burn engine auto-burns 0.5% and decays over 10 years with a 500M cap", async function () {
    const treasurySigner = signers[1];
    await (
      await bdns.connect(treasurySigner).transfer(await burnEngine.getAddress(), ethers.parseEther("100000"))
    ).wait();
    await (await burnEngine.burn()).wait();

    const burned = await burnEngine.cumulativeBurned();
    // start rate 50 bps (0.5%); minor drift as evm time advances during the run
    expect(burned).to.be.greaterThan(ethers.parseEther("450"));
    expect(burned).to.be.lessThanOrEqual(ethers.parseEther("500"));

    await warp(5 * 365 * DAY);
    const now = BigInt(await nowTs());
    const rateMid = await burnEngine.burnRateBpsAt(now);
    expect(rateMid).to.be.lessThan(50n);
    expect(rateMid).to.be.greaterThan(0n);

    await warp(6 * 365 * DAY);
    expect(await burnEngine.burnRateBps()).to.equal(0n);
    expect(await burnEngine.progressBps()).to.equal(0n); // hard cap far away
  });

  it("marketplace routes the fee to the splitter when connected", async function () {
    const seller = signers[7];
    const buyer = signers[8];

    await (await registry.connect(seller).registerDomain("cryptobob")).wait();
    const tokenId = await registry.resolveName("cryptobob");

    await (await registry.connect(seller).setApprovalForAll(await market.getAddress(), true)).wait();
    const price = ethers.parseEther("1000");
    await (await market.connect(seller).list(tokenId, price)).wait();

    // fund the buyer from the treasury
    const treasurySigner = signers[1];
    await (await bdns.connect(treasurySigner).transfer(buyer.address, price)).wait();
    await (await bdns.connect(buyer).approve(await market.getAddress(), price)).wait();

    // connect the splitter
    await (await market.setRoyaltySplitter(await splitter.getAddress())).wait();

    const treasuryBefore = await bdns.balanceOf(treasury);
    await (await market.connect(buyer).buy(tokenId)).wait();

    // the domain moved to the buyer
    expect(await registry.ownerOf(tokenId)).to.equal(buyer.address);
    // seller received net = 1000 - 25
    expect(await bdns.balanceOf(seller.address)).to.equal(ethers.parseEther("975"));
    // 2.5% fee of 1000 = 25 BDNS split instantly: treasury gets 36% = 9 BDNS
    expect(await bdns.balanceOf(treasury)).to.equal(treasuryBefore + ethers.parseEther("9"));
  });

  it("staking release feeds the top-10 rewards recipient", async function () {
    expect(await bdns.balanceOf(ben)).to.equal(0n);
    await warp(90 * DAY);
    await (await stakingVault.release()).wait();
    const after = await bdns.balanceOf(ben);
    expect(after).to.be.greaterThan(0n);
    expect(after).to.equal(await stakingVault.released());
  });
});