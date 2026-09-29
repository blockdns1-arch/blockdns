import { expect } from "chai";
import { ethers, network } from "hardhat";
import type { Contract } from "ethers";
import { buildAirdropTree, airdropLeaf } from "../scripts/merkleTree";

const DAY = 86400;
const WEI = 10n ** 18n;

async function warp(seconds: number): Promise<void> {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
}

async function nowTs(): Promise<bigint> {
  const block = await ethers.provider.getBlock("latest");
  return BigInt(block!.timestamp);
}

type Tranche = { amount: bigint; end: bigint };

function expectedAccrued(now: bigint, start: bigint, tranches: Tranche[]): bigint {
  if (tranches.length === 0 || now <= start) return 0n;
  let cumulative = 0n;
  for (let i = 0; i < tranches.length; i++) {
    const t = tranches[i];
    if (t.end <= now) {
      cumulative += t.amount;
      continue;
    }
    if (i === 0) {
      return (t.amount * (now - start)) / (t.end - start);
    }
    const prev = tranches[i - 1];
    const span = t.end - prev.end;
    const into = now - prev.end;
    return cumulative + (t.amount * into) / span;
  }
  return cumulative;
}

function claimableAt(
  total: bigint,
  tgeBps: bigint,
  start: bigint,
  duration: bigint,
  now: bigint
): bigint {
  const tge = (total * tgeBps) / 10_000n;
  if (now <= start) return tge;
  const elapsed = now - start;
  if (elapsed >= duration) return total;
  return tge + ((total - tge) * elapsed) / duration;
}

describe("BlockDNS Tokenomics Suite", function () {
  let bdns: Contract;
  let deployer: string;
  let alice: string;
  let bob: string;
  let carol: string;
  let beneficiary: string;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    deployer = signers[0].address;
    alice = signers[1].address;
    bob = signers[2].address;
    carol = signers[3].address;
    beneficiary = signers[5].address;

    bdns = await ethers.deployContract("BDNS", [
      ethers.parseEther("1000000000"),
      deployer,
    ]);
    await bdns.waitForDeployment();
  });

  describe("BDNSAirdrop", function () {
    let airdrop: Contract;
    let proofFor: Map<string, string[]>;
    let start: bigint;
    const tgeBps = 1000n;
    const duration = 300n * BigInt(DAY);

    beforeEach(async function () {
      const entries = [
        { address: alice, amount: 10_000n * WEI },
        { address: bob, amount: 5_000n * WEI },
        { address: carol, amount: 2_500n * WEI },
      ];
      const tree = buildAirdropTree(entries);
      proofFor = tree.proofs;

      airdrop = await ethers.deployContract("BDNSAirdrop", [
        await bdns.getAddress(),
        deployer,
        tree.root,
        tgeBps,
        duration,
        0,
        0,
      ]);
      await airdrop.waitForDeployment();
      start = await airdrop.startTime();

      const total = entries.reduce((s, e) => s + e.amount, 0n);
      await (await bdns.mint(await airdrop.getAddress(), total)).wait();
    });

    it("releases the TGE portion immediately", async function () {
      const signers = await ethers.getSigners();
      await (await airdrop.connect(signers[1]).claim(10_000n * WEI, proofFor.get(alice))).wait();
      const expected = claimableAt(10_000n * WEI, tgeBps, start, duration, await nowTs());
      expect(await bdns.balanceOf(alice)).to.equal(expected);
      expect(await airdrop.claimed(alice)).to.equal(expected);
    });

    it("vests linearly after the TGE portion", async function () {
      const signers = await ethers.getSigners();
      await (await airdrop.connect(signers[1]).claim(10_000n * WEI, proofFor.get(alice))).wait();
      const claimed1 = await airdrop.claimed(alice);

      await warp(150 * DAY);
      const pending = await airdrop.pendingClaim(alice, 10_000n * WEI, proofFor.get(alice));
      expect(pending).to.equal(
        claimableAt(10_000n * WEI, tgeBps, start, duration, await nowTs()) - claimed1
      );

      await (await airdrop.connect(signers[1]).claim(10_000n * WEI, proofFor.get(alice))).wait();
      expect(await bdns.balanceOf(alice)).to.equal(
        claimableAt(10_000n * WEI, tgeBps, start, duration, await nowTs())
      );

      await warp(160 * DAY);
      await (await airdrop.connect(signers[1]).claim(10_000n * WEI, proofFor.get(alice))).wait();
      expect(await bdns.balanceOf(alice)).to.equal(10_000n * WEI);
      expect(await airdrop.claimed(alice)).to.equal(10_000n * WEI);

      await expect(
        airdrop.connect(signers[1]).claim(10_000n * WEI, proofFor.get(alice))
      ).to.be.revertedWithCustomError(airdrop, "NothingToClaim");
    });

    it("rejects invalid merkle proofs", async function () {
      const signers = await ethers.getSigners();
      await expect(
        airdrop.connect(signers[1]).claim(5_000n * WEI, proofFor.get(bob))
      ).to.be.revertedWithCustomError(airdrop, "InvalidProof");

      await expect(
        airdrop.connect(signers[2]).claim(10_000n * WEI, proofFor.get(carol))
      ).to.be.revertedWithCustomError(airdrop, "InvalidProof");
    });

    it("allows a full claim for another user after vesting ends", async function () {
      await warp(301 * DAY);
      const signers = await ethers.getSigners();
      await (await airdrop.connect(signers[2]).claim(5_000n * WEI, proofFor.get(bob))).wait();
      expect(await bdns.balanceOf(bob)).to.equal(5_000n * WEI);
    });

    it("locks remaining funds until the claim deadline", async function () {
      await expect(
        airdrop.withdrawUnclaimed(deployer)
      ).to.be.revertedWithCustomError(airdrop, "DeadlineNotReached");
    });
  });

  describe("BDNSVestingVault", function () {
    let vault: Contract;
    let start: bigint;
    const cliff = 30n * BigInt(DAY);
    const duration = 180n * BigInt(DAY);
    const total = 90n * WEI;

    beforeEach(async function () {
      vault = await ethers.deployContract("BDNSVestingVault", [
        deployer,
        await bdns.getAddress(),
        beneficiary,
        0,
        cliff,
        duration,
      ]);
      await vault.waitForDeployment();
      start = await vault.start();
      await (await bdns.mint(deployer, total)).wait();
      await (await bdns.approve(await vault.getAddress(), total)).wait();
      await (await vault.fund(total)).wait();
    });

    it("locks funds during the cliff", async function () {
      expect(await vault.totalLocked()).to.equal(total);
      expect(await vault.releasableAmount()).to.equal(0n);
      await warp(Number(cliff) - 3600);
      expect(await vault.releasableAmount()).to.equal(0n);
    });

    it("vests linearly after the cliff", async function () {
      await warp(Number(cliff + 90n * BigInt(DAY)));
      const now = await nowTs();
      const elapsed = now - start - cliff;
      const expected = (total * elapsed) / duration;
      expect(await vault.releasableAmount()).to.equal(expected);
      expect(expected).to.be.greaterThan(0n);
    });

    it("only the beneficiary releases", async function () {
      const signers = await ethers.getSigners();
      await expect(
        vault.connect(signers[0]).release()
      ).to.be.revertedWithCustomError(vault, "NotBeneficiary");
      await warp(Number(cliff + duration));
      await (await vault.connect(signers[5]).release()).wait();
      expect(await bdns.balanceOf(beneficiary)).to.equal(total);
      expect(await vault.released()).to.equal(total);
      await expect(
        vault.connect(signers[5]).release()
      ).to.be.revertedWithCustomError(vault, "NothingToRelease");
    });

    it("only the owner can fund", async function () {
      const signers = await ethers.getSigners();
      await expect(
        vault.connect(signers[1]).fund(1n * WEI)
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });
  });

  describe("BDNSStakingVault", function () {
    let vault: Contract;
    let emissionStart: bigint;
    let tranches: Tranche[];
    const year = 365n * BigInt(DAY);

    beforeEach(async function () {
      const approxStart = await nowTs();
      const specs = [
        { amount: 40n * WEI, offset: 1n },
        { amount: 30n * WEI, offset: 2n },
        { amount: 20n * WEI, offset: 3n },
        { amount: 10n * WEI, offset: 4n },
      ];
      vault = await ethers.deployContract("BDNSStakingVault", [
        deployer,
        await bdns.getAddress(),
        specs.map((s) => ({ amount: s.amount, end: approxStart + s.offset * year })),
      ]);
      await vault.waitForDeployment();

      emissionStart = BigInt(await vault.emissionStart());
      tranches = [];
      const count = Number(await vault.trancheCount());
      for (let i = 0; i < count; i++) {
        const t = await vault.trancheAt(i);
        tranches.push({ amount: t.amount, end: t.end });
      }

      const expected = 100n * WEI;
      expect(await vault.totalEmission()).to.equal(expected);
      expect(count).to.equal(4);

      await (await bdns.mint(await vault.getAddress(), expected)).wait();
      const role = await vault.RELEASER_ROLE();
      await (await vault.grantRole(role, deployer)).wait();
      await (await vault.setRewardsRecipient(beneficiary)).wait();
    });

    it("starts with negligible accrued emission", async function () {
      const accrued = await vault.accruedEmission();
      expect(accrued).to.be.lessThan(WEI / 10_000n);
      expect(await vault.pendingRelease()).to.equal(accrued);
      expect(await bdns.balanceOf(beneficiary)).to.equal(0n);
    });

    it("accrues linearly inside the first tranche", async function () {
      await warp(100 * DAY);
      const accrued = await vault.accruedEmission();
      expect(accrued).to.equal(expectedAccrued(await nowTs(), emissionStart, tranches));
      expect(accrued).to.be.lessThan(40n * WEI);
    });

    it("releases only accrued emission and enforces the schedule", async function () {
      const signers = await ethers.getSigners();
      await warp(100 * DAY);
      await (await vault.release()).wait();
      const released1 = await vault.released();
      expect(released1).to.equal(expectedAccrued(await nowTs(), emissionStart, tranches));
      expect(await bdns.balanceOf(beneficiary)).to.equal(released1);

      const balanceBefore = await bdns.balanceOf(beneficiary);
      await (await vault.release()).wait();
      const balanceAfter = await bdns.balanceOf(beneficiary);
      expect(balanceAfter - balanceBefore).to.be.lessThan(WEI / 10_000n);

      await warp(630 * DAY);
      await (await vault.release()).wait();
      const releasedFinal = await vault.released();
      expect(releasedFinal).to.equal(expectedAccrued(await nowTs(), emissionStart, tranches));
      expect(releasedFinal).to.be.greaterThan(70n * WEI);
      expect(releasedFinal).to.be.lessThan(71n * WEI);
      expect(await bdns.balanceOf(beneficiary)).to.equal(releasedFinal);
    });

    it("never releases more than the total emission", async function () {
      await warp(10 * 365 * DAY);
      await (await vault.release()).wait();
      expect(await vault.released()).to.equal(100n * WEI);
      await expect(vault.release()).to.be.revertedWithCustomError(vault, "NothingAccrued");
    });

    it("requires the RELEASER_ROLE", async function () {
      const signers = await ethers.getSigners();
      await expect(
        vault.connect(signers[1]).release()
      ).to.be.revertedWithCustomError(vault, "Unauthorized");
    });

    it("cannot release when the lock is not satisfied", async function () {
      const start = await nowTs();
      const partial = await ethers.deployContract("BDNSStakingVault", [
        deployer,
        await bdns.getAddress(),
        [
          { amount: 40n * WEI, end: start + 1n * year },
          { amount: 30n * WEI, end: start + 2n * year },
          { amount: 20n * WEI, end: start + 3n * year },
          { amount: 10n * WEI, end: start + 4n * year },
        ],
      ]);
      await partial.waitForDeployment();
      await (await bdns.mint(await partial.getAddress(), 90n * WEI)).wait();
      const role = await partial.RELEASER_ROLE();
      await (await partial.grantRole(role, deployer)).wait();
      await (await partial.setRewardsRecipient(beneficiary)).wait();

      expect(await partial.isLocked()).to.equal(false);
      await expect(partial.release()).to.be.revertedWithCustomError(partial, "LockNotSatisfied");
    });

    it("recovers only excess tokens above the emission lock", async function () {
      await (await bdns.mint(await vault.getAddress(), 50n * WEI)).wait();
      const before = await bdns.balanceOf(deployer);
      await (await vault.recoverExcess()).wait();
      expect(await bdns.balanceOf(deployer)).to.equal(before + 50n * WEI);
      await expect(vault.recoverExcess()).to.be.revertedWithCustomError(vault, "LockNotSatisfied");
    });

    it("rejects an invalid schedule", async function () {
      const start = await nowTs();
      await expect(
        ethers.deployContract("BDNSStakingVault", [
          deployer,
          await bdns.getAddress(),
          [
            { amount: 40n * WEI, end: start + 100n },
            { amount: 30n * WEI, end: start + 100n },
          ],
        ])
      ).to.be.revertedWithCustomError(vault, "InvalidSchedule");
    });

    it("computes claimable leaves deterministically", async function () {
      const signers = await ethers.getSigners();
      const leaf = airdropLeaf(signers[1].address, 10_000n * WEI);
      expect(leaf).to.match(/^0x[0-9a-f]{64}$/);
    });
  });
});