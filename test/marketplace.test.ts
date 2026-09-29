import { expect } from "chai";
import { ethers } from "hardhat";
import type { Contract } from "ethers";

describe("BlockDNS Marketplace Suite", function () {
  let bdns: Contract;
  let registry: Contract;
  let market: Contract;

  let deployer: string;
  let alice: any;
  let bob: any;
  let treasury: string;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    deployer = signers[0].address;
    alice = signers[1];
    bob = signers[2];
    treasury = signers[3].address;

    bdns = await ethers.deployContract("BDNS", [ethers.parseEther("1000000000"), deployer]);
    await bdns.waitForDeployment();
    await (await bdns.mint(alice, ethers.parseEther("5000"))).wait();
    await (await bdns.mint(bob, ethers.parseEther("5000"))).wait();

    registry = await ethers.deployContract("BlockDNSRegistry", [deployer, "ipfs://"]);
    await registry.waitForDeployment();

    market = await ethers.deployContract("BlockDNSMarketplace", [
      await registry.getAddress(),
      await bdns.getAddress(),
      treasury,
      250, // 2.5%
    ]);
    await market.waitForDeployment();
  });

  async function register(name: string, signer: any) {
    await (await registry.connect(signer).registerDomain(name)).wait();
    const tokenId = await registry.resolveName(name);
    return tokenId;
  }

  async function list(tokenId: bigint, sellerSigner: any, price: bigint) {
    await (await registry.connect(sellerSigner).setApprovalForAll(await market.getAddress(), true)).wait();
    await (await market.connect(sellerSigner).list(tokenId, price)).wait();
  }

  describe("listing", function () {
    it("list moves the domain into escrow and records the seller", async function () {
      const id = await register("alice", alice);
      await list(id, alice, ethers.parseEther("1000"));

      expect(await registry.ownerOf(id)).to.equal(await market.getAddress());
      const [tokenId, seller, price, active] = await market.getListing(id);
      expect(tokenId).to.equal(id);
      expect(seller).to.equal(alice);
      expect(price).to.equal(ethers.parseEther("1000"));
      expect(active).to.equal(true);
      expect(await market.listingCount()).to.equal(1n);
    });

    it("rejects non-owners and zero prices", async function () {
      const id = await register("bob", bob);
      await expect(
        market.connect(alice).list(id, ethers.parseEther("10"))
      ).to.be.revertedWithCustomError(market, "NotSeller");
      await expect(
        market.connect(bob).list(id, 0n)
      ).to.be.revertedWithCustomError(market, "ZeroPrice");
    });

    it("rejects double listing (token is already in escrow)", async function () {
      const id = await register("double", alice);
      await list(id, alice, ethers.parseEther("100"));
      await expect(
        market.connect(alice).list(id, ethers.parseEther("50"))
      ).to.be.revertedWithCustomError(market, "NotSeller");
    });

    it("updatePrice changes the listing price", async function () {
      const id = await register("price", alice);
      await list(id, alice, ethers.parseEther("100"));
      await (await market.connect(alice).updatePrice(id, ethers.parseEther("250"))).wait();
      const [, , price] = await market.getListing(id);
      expect(price).to.equal(ethers.parseEther("250"));
      await expect(
        market.connect(bob).updatePrice(id, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(market, "NotSeller");
    });

    it("delist returns the domain to the seller", async function () {
      const id = await register("delist", alice);
      await list(id, alice, ethers.parseEther("100"));
      await (await market.connect(alice).delist(id)).wait();
      expect(await registry.ownerOf(id)).to.equal(alice);
      expect(await market.listingCount()).to.equal(0n);
    });
  });

  describe("buying", function () {
    it("buys a domain with BDNS and splits fee to treasury", async function () {
      const id = await register("sale", alice);
      const price = ethers.parseEther("1000");
      await list(id, alice, price);

      const sellerBefore = await bdns.balanceOf(alice);
      const bobBefore = await bdns.balanceOf(bob);
      const treasuryBefore = await bdns.balanceOf(treasury);

      await (await bdns.connect(bob).approve(await market.getAddress(), price)).wait();
      await (await market.connect(bob).buy(id)).wait();

      expect(await registry.ownerOf(id)).to.equal(bob);
      expect(await market.listingCount()).to.equal(0n);
      // 2.5% fee on 1000 = 25; seller nets 975
      expect(await bdns.balanceOf(alice)).to.equal(sellerBefore + ethers.parseEther("975"));
      expect(await bdns.balanceOf(treasury)).to.equal(treasuryBefore + ethers.parseEther("25"));
      expect(await bdns.balanceOf(bob)).to.equal(bobBefore - price);
    });

    it("fails when the token is not listed", async function () {
      const id = await register("fnor", alice);
      await (await bdns.connect(bob).approve(await market.getAddress(), ethers.parseEther("1"))).wait();
      await expect(
        market.connect(bob).buy(id)
      ).to.be.revertedWithCustomError(market, "NotActive");
    });

    it("fails when the buyer lacks approval or balance", async function () {
      const id = await register("nofunds", alice);
      await list(id, alice, ethers.parseEther("100"));

      await expect(market.connect(bob).buy(id)).to.be.reverted;
      await (await bdns.connect(bob).approve(await market.getAddress(), ethers.parseEther("1"))).wait();
      await expect(market.connect(bob).buy(id)).to.be.reverted;
    });

    it("re-lists a purchased domain and sells again (id array preserved)", async function () {
      const id = await register("resale", alice);
      await list(id, alice, ethers.parseEther("500"));
      await (await bdns.connect(bob).approve(await market.getAddress(), ethers.parseEther("500"))).wait();
      await (await market.connect(bob).buy(id)).wait();
      expect(await market.listingCount()).to.equal(0n);

      await list(id, bob, ethers.parseEther("700"));
      await (await bdns.connect(alice).approve(await market.getAddress(), ethers.parseEther("700"))).wait();
      await (await market.connect(alice).buy(id)).wait();
      expect(await registry.ownerOf(id)).to.equal(alice);
      expect(await market.listingCount()).to.equal(0n);
    });
  });

  describe("admin", function () {
    it("only owner can change fee and treasury", async function () {
      await expect(
        market.connect(alice).setFeeBps(300)
      ).to.be.revertedWithCustomError(market, "OwnableUnauthorizedAccount");
      await expect(
        market.connect(alice).setTreasury(bob)
      ).to.be.revertedWithCustomError(market, "OwnableUnauthorizedAccount");

      await (await market.setFeeBps(500)).wait();
      expect(await market.feeBps()).to.equal(500);
      await (await market.setTreasury(deployer)).wait();
      expect(await market.treasury()).to.equal(deployer);
    });

    it("caps the fee at 5%", async function () {
      await expect(market.setFeeBps(501)).to.be.revertedWithCustomError(market, "InvalidFee");
    });
  });
});