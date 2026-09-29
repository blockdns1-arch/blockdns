import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const SAMPLE_CID = "QmYwAPJzv5CZsnAzt8auVZRn9uVjbN9kZdqnFpqX2XqVpZ";

async function main() {
  const [owner] = await ethers.getSigners();
  const alice = owner;

  const deployment = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`), "utf8")
  );
  const { BDNS, BlockDNSRegistry, BlockDNSPricer } = deployment.contracts;

  const bdns = await ethers.getContractAt("BDNS", BDNS);
  const registry = await ethers.getContractAt("BlockDNSRegistry", BlockDNSRegistry);
  const pricer = await ethers.getContractAt("BlockDNSPricer", BlockDNSPricer);

  console.log(`network=${network.name} owner=${owner.address}`);

  // free domain + records
  let aliceId = await registry.resolveName("alice");
  if (aliceId === 0n) {
    const freeTx = await registry.connect(alice).registerDomain("alice");
    await freeTx.wait();
    aliceId = await registry.resolveName("alice");
    await (await registry.connect(alice).setIPFSRecord(aliceId, SAMPLE_CID)).wait();
    await (await registry.connect(alice).setAddressRecord(aliceId, "ETH", alice.address)).wait();
    await (await registry.connect(alice).setAddressRecord(aliceId, "BTC", "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh")).wait();
    await (await registry.connect(alice).setAddressRecord(aliceId, "SOL", "5xfrL7yPBh3gUK2FvZb2bL9QmXtvQ8yr2VK6NL3i7qgV")).wait();
    console.log(`alice.bdns minted tokenId=${aliceId} (free) + records bound (IPFS/ETH/BTC/SOL)`);
  } else {
    console.log(`alice.bdns exists tokenId=${aliceId}`);
  }

  // premium domain (2 chars => tier 2)
  let abId = await registry.resolveName("ab");
  if (abId === 0n) {
    const premiumPrice = await pricer.priceOf("ab");
    await (await bdns.connect(alice).approve(await pricer.getAddress(), ethers.MaxUint256)).wait();
    const premTx = await registry.connect(alice).registerDomain("ab");
    await premTx.wait();
    abId = await registry.resolveName("ab");
    console.log(`ab.bdns minted tokenId=${abId} premium=${ethers.formatEther(premiumPrice)} BDNS`);
  } else {
    console.log(`ab.bdns exists tokenId=${abId}`);
  }

  // second free domain for dashboard variety
  const bobId = await registry.resolveName("bob");
  if (bobId === 0n) {
    await (await registry.connect(alice).registerDomain("bob")).wait();
    console.log("bob.bdns minted (free)");
  } else {
    console.log(`bob.bdns exists tokenId=${bobId}`);
  }

  // staking event -> STAKING_MILESTONE for the watcher
  const validator = await bdns.getValidator(alice.address);
  if (validator.staked === 0n) {
    await (await bdns.connect(alice).approve(await bdns.getAddress(), ethers.MaxUint256)).wait();
    await (await bdns.connect(alice).stake(ethers.parseEther("2500"))).wait();
    console.log("validator stake 2500 BDNS");
  } else {
    console.log(`validator stake already ${ethers.formatEther(validator.staked)} BDNS`);
  }

  // overflow BDNS so the dashboard shows a nice balance
  const balance = await bdns.balanceOf(alice.address);
  if (balance < ethers.parseEther("400000")) {
    await (await bdns.mint(alice.address, ethers.parseEther("500000"))).wait();
    console.log("500000 BDNS minted to owner for demo balance");
  } else {
    console.log(`balance already ${ethers.formatEther(balance)} BDNS`);
  }

  const summary = {
    network: network.name,
    owner: owner.address,
    domains: {
      alice: { tokenId: aliceId.toString(), cid: SAMPLE_CID },
      ab: { tokenId: abId.toString() },
      bob: { tokenId: (await registry.resolveName("bob")).toString() },
    },
  };
  console.log("seed done ✓", JSON.stringify(summary));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});