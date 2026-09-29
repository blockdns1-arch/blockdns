import { expect } from "chai";
import { ethers } from "hardhat";
import type { Contract } from "ethers";

const FREE_TIER_MIN_LENGTH = 5n;

describe("BlockDNS Registry Suite", function () {
  let bdns: Contract;
  let pricer: Contract;
  let registry: Contract;
  let resolver: Contract;
  let dead: string;
  let treasury: string;

  let deployer: string;
  let alice: string;
  let bob: string;

  const tier2 = ethers.parseEther("1000");
  const tier4 = ethers.parseEther("100");

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    deployer = signers[0].address;
    alice = signers[1].address;
    bob = signers[2].address;
    treasury = signers[3].address;
    dead = "0x000000000000000000000000000000000000dEaD";

    bdns = await ethers.deployContract("BDNS", [
      ethers.parseEther("1000000000"),
      deployer,
    ]);
    await bdns.waitForDeployment();

    await (await bdns.mint(alice, ethers.parseEther("100000"))).wait();
    await (await bdns.mint(bob, ethers.parseEther("100000"))).wait();

    pricer = await ethers.deployContract("BlockDNSPricer", [
      deployer,
      await bdns.getAddress(),
      treasury,
      tier2,
      tier4,
    ]);
    await pricer.waitForDeployment();

    registry = await ethers.deployContract("BlockDNSRegistry", [
      deployer,
      "ipfs://",
    ]);
    await registry.waitForDeployment();
    await (await registry.setPricer(await pricer.getAddress())).wait();

    resolver = await ethers.deployContract("BlockDNSResolver", [
      deployer,
      await registry.getAddress(),
    ]);
    await resolver.waitForDeployment();

    await (await bdns.connect(signers[1]).approve(await pricer.getAddress(), ethers.MaxUint256)).wait();
    await (await bdns.connect(signers[2]).approve(await pricer.getAddress(), ethers.MaxUint256)).wait();
  });

  describe("free tier (>= 5 chars)", function () {
    it("mints a .bdns domain for free with zero BDNS fees", async function () {
      const [, aliceSigner] = await ethers.getSigners();
      const balanceBefore = await bdns.balanceOf(alice);
      const name = "example";

      expect(await pricer.priceOf(name)).to.equal(0);
      await (await registry.connect(aliceSigner).registerDomain(name)).wait();

      expect(await bdns.balanceOf(alice)).to.equal(balanceBefore);
    });

    it("mints the NFT to the caller and indexes the name", async function () {
      const [, aliceSigner, bobSigner] = await ethers.getSigners();
      await (await registry.connect(aliceSigner).registerDomain("hello")).wait();

      const tokenId = await registry.resolveName("hello");
      expect(tokenId).to.equal(1);
      expect(await registry.ownerOf(tokenId)).to.equal(alice);
      expect(await registry.nameOf(tokenId)).to.equal("hello");
      expect(await registry.balanceOf(alice)).to.equal(1);
      expect(await registry.balanceOf(bob)).to.equal(0);
    });

    it("treats exactly 5 characters as free", async function () {
      const name = "abcde";
      expect(name.length).to.equal(FREE_TIER_MIN_LENGTH);
      expect(await pricer.priceOf(name)).to.equal(0);
    });
  });

  describe("premium tiers (1-4 chars)", function () {
    it("charges tier-2 price for 1-2 char names and splits 50/50 burn-treasury", async function () {
      const [, aliceSigner] = await ethers.getSigners();
      const name = "ab";
      const price = tier2;
      const half = price / 2n;

      const beforeAlice = await bdns.balanceOf(alice);
      const beforeBurn = await bdns.balanceOf(dead);
      const beforeTreasury = await bdns.balanceOf(treasury);

      await (await registry.connect(aliceSigner).registerDomain(name)).wait();

      expect(await bdns.balanceOf(alice)).to.equal(beforeAlice - price);
      expect(await bdns.balanceOf(dead)).to.equal(beforeBurn + half);
      expect(await bdns.balanceOf(treasury)).to.equal(beforeTreasury + half);
      expect(await bdns.balanceOf(await pricer.getAddress())).to.equal(0);
      expect(await registry.ownerOf(1)).to.equal(alice);
    });

    it("charges tier-4 (mid) price for 3-4 char names", async function () {
      const [, aliceSigner] = await ethers.getSigners();
      const name = "abcd";
      const price = tier4;
      const half = price / 2n;

      const beforeAlice = await bdns.balanceOf(alice);
      const beforeBurn = await bdns.balanceOf(dead);

      await (await registry.connect(aliceSigner).registerDomain(name)).wait();

      expect(await bdns.balanceOf(alice)).to.equal(beforeAlice - price);
      expect(await bdns.balanceOf(dead)).to.equal(beforeBurn + half);
      expect(await pricer.priceOf("abc")).to.equal(price);
    });

    it("reverts premium registration when the payer has not approved BDNS", async function () {
      const [, aliceSigner] = await ethers.getSigners();
      await (await bdns.connect(aliceSigner).approve(await pricer.getAddress(), 0)).wait();
      await expect(registry.connect(aliceSigner).registerDomain("xy")).to.be.reverted;
    });

    it("rejects registration when the payer cannot cover the premium", async function () {
      const [, aliceSigner] = await ethers.getSigners();
      await (await bdns.connect(aliceSigner).approve(await pricer.getAddress(), tier2 / 2n)).wait();
      await expect(registry.connect(aliceSigner).registerDomain("zz")).to.be.reverted;
    });
  });

  describe("name normalization and validation", function () {
    it("lowercases mixed-case names and treats them as identical", async function () {
      const [, aliceSigner] = await ethers.getSigners();
      await (await registry.connect(aliceSigner).registerDomain("BlockDNS")).wait();
      expect(await registry.resolveName("BLOCKDNS")).to.equal(1);
      expect(await registry.nameOf(1)).to.equal("blockdns");
      await expect(registry.connect(aliceSigner).registerDomain("blockdns")).to.be.revertedWithCustomError(
        registry,
        "NameAlreadyRegistered"
      );
    });

    it("rejects malformed names", async function () {
      const [, aliceSigner] = await ethers.getSigners();
      const bad = ["", "a_b", "a..", "-ab", "ab-", "_", "😀", "a".repeat(64)];
      for (const name of bad) {
        await expect(registry.connect(aliceSigner).registerDomain(name)).to.be.reverted;
      }
    });

    it("allows digits and hyphens in the middle", async function () {
      const [, aliceSigner] = await ethers.getSigners();
      await (await registry.connect(aliceSigner).registerDomain("my-site-42")).wait();
      expect(await registry.resolveName("my-site-42")).to.equal(1);
    });
  });

  describe("record updates and access control", function () {
    it("lets the owner set the IPFS record and the resolver reads it", async function () {
      const [, aliceSigner] = await ethers.getSigners();
      await (await registry.connect(aliceSigner).registerDomain("site")).wait();
      const cid = "QmT5NvUtoM5nWFfrQdVrFtvGfKFmG7AHE8P34QapUusioX";

      await expect(registry.connect(aliceSigner).setIPFSRecord(1, cid))
        .to.emit(registry, "IPFSRecordUpdated")
        .withArgs(1, cid);

      expect(await resolver.resolveIPFS("site")).to.equal(cid);
      expect(await registry.ipfsCIDOf(1)).to.equal(cid);
    });

    it("reverts IPFS updates from non-owners", async function () {
      const [, aliceSigner, bobSigner] = await ethers.getSigners();
      await (await registry.connect(aliceSigner).registerDomain("site")).wait();
      await expect(registry.connect(bobSigner).setIPFSRecord(1, "Qm...")).to.be.revertedWithCustomError(
        registry,
        "NotDomainOwner"
      );
    });

    it("rejects an empty IPFS record", async function () {
      const [, aliceSigner] = await ethers.getSigners();
      await (await registry.connect(aliceSigner).registerDomain("site")).wait();
      await expect(registry.connect(aliceSigner).setIPFSRecord(1, "")).to.be.revertedWithCustomError(
        registry,
        "EmptyValue"
      );
    });

    it("binds multi-chain wallet addresses (ETH, BTC, SOL) and resolves them", async function () {
      const [, aliceSigner] = await ethers.getSigners();
      const eth = "0x0000000000000000000000000000000000000001";
      const btc = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";
      const sol = "7EcDhMYGmnGqtZqPAfM8tNw8bH9nY5zDf3j8vD6j9eTX";

      await (await registry.connect(aliceSigner).registerDomain("crypto")).wait();
      await (await registry.connect(aliceSigner).setAddressRecord(1, "ETH", eth)).wait();
      await (await registry.connect(aliceSigner).setAddressRecord(1, "BTC", btc)).wait();
      await (await registry.connect(aliceSigner).setAddressRecord(1, "SOL", sol)).wait();

      expect(await resolver.resolveAddress("crypto", "ETH")).to.equal(eth);
      expect(await resolver.resolveAddress("crypto", "BTC")).to.equal(btc);
      expect(await resolver.resolveAddress("crypto", "SOL")).to.equal(sol);
    });

    it("rejects address-record updates from non-owners", async function () {
      const [, aliceSigner, bobSigner] = await ethers.getSigners();
      await (await registry.connect(aliceSigner).registerDomain("crypto")).wait();
      await expect(registry.connect(bobSigner).setAddressRecord(1, "ETH", alice)).to.be.revertedWithCustomError(
        registry,
        "NotDomainOwner"
      );
    });

    it("sets, removes and resolves custom TXT records", async function () {
      const [, aliceSigner] = await ethers.getSigners();
      await (await registry.connect(aliceSigner).registerDomain("mail")).wait();
      await (await registry.connect(aliceSigner).setCustomTXT(1, "mx", "mail.example.com")).wait();
      expect(await resolver.resolveTXT("mail", "mx")).to.equal("mail.example.com");

      await (await registry.connect(aliceSigner).removeCustomTXT(1, "mx")).wait();
      expect(await resolver.resolveTXT("mail", "mx")).to.equal("");
    });

    it("transfers lifetime ownership and record control to the new owner", async function () {
      const [, aliceSigner, bobSigner] = await ethers.getSigners();
      await (await registry.connect(aliceSigner).registerDomain("site")).wait();

      await (await registry.connect(aliceSigner)["transferFrom(address,address,uint256)"](alice, bob, 1)).wait();

      expect(await registry.ownerOf(1)).to.equal(bob);
      expect(await registry.balanceOf(alice)).to.equal(0);
      expect(await registry.balanceOf(bob)).to.equal(1);

      await (await registry.connect(bobSigner).setIPFSRecord(1, "QmNewOwner")).wait();
      expect(await resolver.resolveIPFS("site")).to.equal("QmNewOwner");

      await expect(registry.connect(aliceSigner).setIPFSRecord(1, "QmOldOwner")).to.be.revertedWithCustomError(
        registry,
        "NotDomainOwner"
      );
    });
  });

  describe("resolver", function () {
    it("returns a full record via resolveAll", async function () {
      const [, aliceSigner] = await ethers.getSigners();
      await (await registry.connect(aliceSigner).registerDomain("vault")).wait();
      await (await registry.connect(aliceSigner).setIPFSRecord(1, "QmVault")).wait();

      const resolved = await resolver.resolveAll("vault");
      expect(resolved.tokenId).to.equal(1);
      expect(resolved.owner).to.equal(alice);
      expect(resolved.name).to.equal("vault");
      expect(resolved.ipfsCID).to.equal("QmVault");
    });

    it("reverts lookups for unregistered names", async function () {
      await expect(resolver.resolveIPFS("nope")).to.be.revertedWithCustomError(resolver, "NameNotFound");
      await expect(resolver.resolveTokenId("nope")).to.be.revertedWithCustomError(resolver, "NameNotFound");
      await expect(resolver.ownerOfName("nope")).to.be.revertedWithCustomError(resolver, "NameNotFound");
    });

    it("resolves ownerOfName for transferred domains", async function () {
      const [, aliceSigner, bobSigner] = await ethers.getSigners();
      await (await registry.connect(aliceSigner).registerDomain("swap")).wait();
      await (await registry.connect(aliceSigner)["transferFrom(address,address,uint256)"](alice, bob, 1)).wait();
      expect(await resolver.ownerOfName("swap")).to.equal(bob);
    });
  });

  describe("domain enumeration (dashboard index)", function () {
    it("lists owned tokens via tokenOfOwnerByIndex across transfers", async function () {
      const [, aliceSigner, bobSigner] = await ethers.getSigners();
      await (await registry.connect(aliceSigner).registerDomain("alpha")).wait();
      await (await registry.connect(aliceSigner).registerDomain("beta")).wait();
      await (await registry.connect(bobSigner).registerDomain("gamma")).wait();

      expect(await registry.balanceOf(alice)).to.equal(2);
      expect(await registry.totalSupply()).to.equal(3);
      expect(await registry.tokenOfOwnerByIndex(alice, 0)).to.equal(1);
      expect(await registry.tokenOfOwnerByIndex(alice, 1)).to.equal(2);

      await (await registry.connect(aliceSigner)["transferFrom(address,address,uint256)"](alice, bob, 1)).wait();
      expect(await registry.balanceOf(alice)).to.equal(1);
      expect(await registry.tokenOfOwnerByIndex(alice, 0)).to.equal(2);
      expect(await registry.tokenOfOwnerByIndex(bob, 1)).to.equal(1);
      expect(await registry.supportsInterface("0x780e9d63")).to.equal(true);
    });
  });

  describe("admin access control", function () {
    it("only the owner can set the pricer", async function () {
      const [, , bobSigner] = await ethers.getSigners();
      await expect(registry.connect(bobSigner).setPricer(await pricer.getAddress())).to.be.reverted;
    });

    it("only the owner can update the base URI", async function () {
      const [, aliceSigner, bobSigner] = await ethers.getSigners();
      await (await registry.connect(aliceSigner).registerDomain("uri")).wait();
      await expect(registry.connect(bobSigner).setBaseURI("https://")).to.be.reverted;
      await (await registry.setBaseURI("https://domains.example/")).wait();
      expect(await registry.tokenURI(1)).to.equal("https://domains.example/uri");
    });

    it("only the resolver owner can point it at another registry", async function () {
      const [, , bobSigner] = await ethers.getSigners();
      await expect(resolver.connect(bobSigner).setRegistry(await registry.getAddress())).to.be.reverted;
    });
  });

  describe("token URI", function () {
    it("builds a URI from base URI and normalized name", async function () {
      const [, aliceSigner] = await ethers.getSigners();
      await (await registry.connect(aliceSigner).registerDomain("URI")).wait();
      expect(await registry.tokenURI(1)).to.equal("ipfs://uri");
    });

    it("reverts for nonexistent tokens", async function () {
      await expect(registry.tokenURI(999)).to.be.revertedWithCustomError(registry, "TokenDoesNotExist");
    });
  });
});