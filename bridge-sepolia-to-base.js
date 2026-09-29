const fs = require("fs");
const path = require("path");
const { ethers } = require(path.join(__dirname, "node_modules", "ethers"));

const SEP_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const BRIDGE = "0xfd0Bf71F60660E2f608ed56e1659C450eB113120";

const envRaw = fs.readFileSync(path.join(__dirname, "base-deploy.env"), "utf8");
const env = {};
for (const line of envRaw.split(/\r?\n/)) {
  const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}
const pk = env.BASE_DEPLOYER_PRIVATE_KEY;
if (!pk) throw new Error("no key");

const abis = [
  ["function depositETH(uint32,bytes)", "depositETH"],
  ["function bridgeETH(uint32,bytes)", "bridgeETH"],
  ["function depositETH(uint256,bytes)", "depositETH256"],
];

async function balance(provider, addr) {
  return Number(await provider.getBalance(addr)) / 1e18;
}

(async () => {
  const provider = new ethers.JsonRpcProvider(SEP_RPC);
  const wallet = new ethers.Wallet(pk, provider);
  const addr = wallet.address;
  const bal = await balance(provider, addr);
  console.log(`sepolia balance=${bal.toFixed(6)} ETH addr=${addr}`);
  if (bal < 0.001) throw new Error("not enough sepolia ETH yet");

  const amount = ethers.parseEther((bal - 0.0006).toFixed(6).toString());
  console.log(`bridging amount=${ethers.formatEther(amount)} ETH via ${BRIDGE}`);

  let tx = null;
  for (const [sig, label] of abis) {
    try {
      const contract = new ethers.Contract(BRIDGE, [sig], wallet);
      const est = await contract.depositETH.estimateGas(300000, "0x", { value: amount });
      console.log(`ABI "${sig}" est true (gas ${est}).`);
      tx = await contract.depositETH(300000, "0x", { value: amount });
      console.log(`SENT via depositETH(${label}) tx=${tx.hash}`);
      break;
    } catch (e) {
      console.log(`ABI "${sig}" failed: ${e.shortMessage || e.message.slice(0, 120)}`);
    }
  }
  if (!tx) throw new Error("no ABI matched");
  const rec = await tx.wait();
  console.log(`confirmed block=${rec.blockNumber}`);
})().catch((e) => { console.error("FAIL", e.message); process.exit(1); });