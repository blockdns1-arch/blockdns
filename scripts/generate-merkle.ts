import { ethers } from "hardhat";
import { getAddress } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { buildAirdropTree, type AirdropEntry } from "./merkleTree";

type InputEntry = { address: string; amount: string };

function scaleAmount(amount: string): bigint {
  return ethers.parseEther(amount);
}

async function loadEntries(): Promise<AirdropEntry[]> {
  const customPath = process.env.AIRDROP_JSON;
  if (customPath && fs.existsSync(customPath)) {
    const raw = JSON.parse(fs.readFileSync(customPath, "utf8")) as { entries: InputEntry[] };
    return raw.entries.map((e) => ({ address: e.address, amount: scaleAmount(e.amount) }));
  }

  const defaultPath = path.join(__dirname, "..", "airdrop", "airdrop.json");
  if (fs.existsSync(defaultPath)) {
    const raw = JSON.parse(fs.readFileSync(defaultPath, "utf8")) as { entries: InputEntry[] };
    return raw.entries.map((e) => ({ address: e.address, amount: scaleAmount(e.amount) }));
  }

  const signers = await ethers.getSigners();
  const sample = ["10000", "5000", "2500", "1250", "625"];
  return sample.map((amount, i) => ({
    address: signers[i].address,
    amount: scaleAmount(amount),
  }));
}

async function main() {
  const entries = await loadEntries();
  const tree = buildAirdropTree(entries);

  const outDir = path.join(__dirname, "..", "airdrop");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "merkle.json");
  const payload = {
    generatedAt: new Date().toISOString(),
    entryCount: entries.length,
    root: tree.root,
    total: entries.reduce((sum, e) => sum + e.amount, 0n).toString(),
    entries: entries.map((e) => ({
      address: e.address,
      amount: e.amount.toString(),
      proof: tree.proofs.get(getAddress(e.address)) ?? [],
    })),
  };
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));

  console.log(`merkle root: ${tree.root}`);
  console.log(`entries: ${entries.length}`);
  console.log(`total airdrop: ${ethers.formatEther(payload.total)} BDNS`);
  console.log(`saved to ${outFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});