const fs = require("fs");
const path = require("path");
const { ethers } = require(path.join(__dirname, "node_modules", "ethers"));

const SEP_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const envRaw = fs.readFileSync(path.join(__dirname, "base-deploy.env"), "utf8");
const env = {};
for (const line of envRaw.split(/\r?\n/)) {
  const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}
const DEPLOYER = env.BASE_DEPLOYER_PRIVATE_KEY;
if (!DEPLOYER) throw new Error("no deployer key");

const WALLET_LOG = path.join(__dirname, "tmp-farm-wallets.json");

async function getBalance(p, a) { return Number(await p.getBalance(a)) / 1e18; }

(async () => {
  const provider = new ethers.JsonRpcProvider(SEP_RPC);

  let farmed = [];
  if (fs.existsSync(WALLET_LOG)) farmed = JSON.parse(fs.readFileSync(WALLET_LOG, "utf8"));
  else fs.writeFileSync(WALLET_LOG, JSON.stringify([]));

  // 1) claim new wallets (keys stay on disk in tmp file, NOT printed)
  const TARGET = 7;
  for (let i = farmed.length; i < TARGET; i++) {
    const w = ethers.Wallet.createRandom();
    farmed.push({ addr: w.address, key: w.privateKey });
    fs.writeFileSync(WALLET_LOG, JSON.stringify(farmed, null, 2));
    try {
      const r = await fetch("https://sepolia-faucet-service.vercel.app/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: w.address, network: "sepolia" }),
      }).then((x) => x.json());
      console.log(`claim #${i + 1} ${w.address.slice(0, 10)}... -> ${r.success ? "OK " + (r.amount || "") : "FAIL " + (r.error || r.message || "")}`);
    } catch (e) {
      console.log(`claim #${i + 1} ${w.address.slice(0, 10)}... -> NETFAIL`);
    }
    await new Promise((r) => setTimeout(r, 9000));
  }

  // 2) sweep every farmed wallet to deployer
  const deployer = new ethers.Wallet(DEPLOYER, provider);
  for (const f of farmed) {
    const w = new ethers.Wallet(f.key, provider);
    const bal = await getBalance(provider, w.address);
    if (bal < 0.0002) { console.log(`sweep ${w.address.slice(0, 10)}... 0 (skip)`); continue; }
    const gas = 21000n;
    const price = await provider.getFeeData();
    const cost = gas * (price.gasPrice || price.maxFeePerGas || 0n);
    const send = (await provider.getBalance(w.address)) - cost;
    const tx = await w.sendTransaction({ to: deployer.address, value: send, gasLimit: gas });
    await tx.wait();
    console.log(`sweep ${w.address.slice(0, 10)}... -> ${(Number(send) / 1e18).toFixed(5)} ETH tx=${tx.hash.slice(0, 14)}`);
    await new Promise((r) => setTimeout(r, 4000));
  }

  console.log(`DEPLOYER BALANCE NOW = ${(await getBalance(provider, deployer.address)).toFixed(6)} ETH`);
})().catch((e) => { console.error("FAIL", e.message); process.exit(1); });