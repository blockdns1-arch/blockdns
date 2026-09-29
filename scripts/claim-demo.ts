import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const USER = process.env.CLAIM_ADDRESS ?? "0xe0Bff551891cb718E351522fb798AbF9ac71Fbfe";

async function main() {
  const deployment = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`), "utf8")
  );
  const airdropAddress = deployment.contracts.BDNSAirdrop;
  const bdnsAddress = deployment.contracts.BDNS;
  if (!airdropAddress) throw new Error("no BDNSAirdrop deployment");

  const merkle = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "airdrop", "merkle.json"), "utf8"));
  const entry = merkle.entries.find((e: any) => e.address.toLowerCase() === USER.toLowerCase());
  if (!entry) throw new Error(`user ${USER} not in merkle tree`);

  const airdrop = await ethers.getContractAt("BDNSAirdrop", airdropAddress);
  const bdns = await ethers.getContractAt("BDNS", bdnsAddress);

  const total = BigInt(entry.amount);
  const tge = total / 10n; // AIRDROP_TGE_BPS = 1000 => 10%

  console.log(`airdrop=${airdropAddress} user=${USER} total=${ethers.formatEther(total)} BDNS (claimable TGE ${ethers.formatEther(tge)} BDNS)`);
  console.log(` proving eligibility off-chain: ${await airdrop.isEligible(USER, total, entry.proof)}`);

  const before = await bdns.balanceOf(USER);
  console.log(`balance before claim: ${ethers.formatEther(before)} BDNS`);

  let txHash: string | undefined;
  let receipt: any;
  if ((await airdrop.claimed(USER)) > 0n) {
    console.log("already claimed (script is idempotent)");
  } else {
    // Impersonate the user's wallet on the local node (claim must be signed by the claimant).
    // The node signs for impersonated accounts: send an eth_sendTransaction from=user.
    await network.provider.request({ method: "hardhat_impersonateAccount", params: [USER] });
    await network.provider.request({
      method: "hardhat_setBalance",
      params: [USER, "0xDE0B6B3A7640000"], // 1 ETH gas
    });

    const data = airdrop.interface.encodeFunctionData("claim", [total, entry.proof]);
    // Sign via the node itself (impersonated account) using a raw JSON-RPC provider,
    // bypassing hardhat-ethers' local-accounts middleware.
    const rawRpc = new ethers.JsonRpcProvider("http://127.0.0.1:9545");
    txHash = await rawRpc.send("eth_sendTransaction", [
      { from: USER, to: airdropAddress, gas: "0x200000", data },
    ]);
    receipt = await rawRpc.getTransactionReceipt(txHash);
  }
  if (txHash) console.log(`claim tx ${txHash} (block ${receipt?.blockNumber})`);

  const after = await bdns.balanceOf(USER);
  const claimedAmt = await airdrop.claimed(USER);
  console.log(`balance after claim: ${ethers.formatEther(after)} BDNS`);
  console.log(`claimed total:       ${ethers.formatEther(claimedAmt)} BDNS`);

  const ok = claimedAmt >= tge; // at least the TGE portion received (idempotent across reruns)
  console.log(ok ? "CLAIM OK ✓ user received TGE + accrued vesting" : "CLAIM MISMATCH ✗");
  if (!ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});