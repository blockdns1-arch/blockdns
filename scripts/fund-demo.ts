import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const BRAVE = "0xB58ecB7173c38e9eA0F28B9C56BdFB7eE260a924";
const GAS_ETH = "1.5"; // wei budget on the local node
const BDNS_GRANT = "100000"; // BDNS transferred from the deployer to the Brave wallet

async function main() {
  const deployment = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`), "utf8")
  );
  const bdns = await ethers.getContractAt("BDNS", deployment.contracts.BDNS);
  const cap = await bdns.cap();
  const totalMinted = await bdns.totalSupply();
  console.log(`cap=${ethers.formatEther(cap)} BDNS totalMinted=${ethers.formatEther(totalMinted)} BDNS remaining=${ethers.formatEther(cap - totalMinted)} BDNS`);

  const rawRpc = new ethers.JsonRpcProvider("http://127.0.0.1:9545");
  for (const addr of [BRAVE]) {
    await network.provider.request({ method: "hardhat_impersonateAccount", params: [addr] });
    await network.provider.request({
      method: "hardhat_setBalance",
      params: [addr, "0x" + ethers.parseEther(GAS_ETH).toString(16)],
    });
  }
  const eth = await rawRpc.getBalance(BRAVE);
  console.log(`${BRAVE} ETH balance: ${ethers.formatEther(eth)}`);

  const before = await bdns.balanceOf(BRAVE);
  if (before < ethers.parseEther(BDNS_GRANT)) {
    const [deployer] = await ethers.getSigners();
    const tx = await bdns.connect(deployer).transfer(BRAVE, ethers.parseEther(BDNS_GRANT));
    await tx.wait();
    console.log(`transferred ${BDNS_GRANT} BDNS -> ${BRAVE} (tx ${tx.hash})`);
  } else {
    console.log(`Brave wallet already has ${ethers.formatEther(before)} BDNS, skipping transfer`);
  }

  const after = await bdns.balanceOf(BRAVE);
  console.log(`${BRAVE} BDNS balance: ${ethers.formatEther(after)}`);

  const held = Number(after);
  console.log(held >= Number(BDNS_GRANT) ? "FUNDING OK ✓" : "FUNDING MISMATCH ✗");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});