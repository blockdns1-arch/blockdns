import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const deployment = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployments", "l2.json"), "utf8")
  );
  const c = deployment.contracts;
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:9545");
  const w0 = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
  const w1 = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", provider);

  const bn = (v: bigint) => ethers.formatEther(v);
  let failed = 0;
  const ok = (label: string, actual: bigint, expected: bigint) => {
    const pass = actual === expected;
    console.log(`${pass ? "PASS" : "FAIL"}  ${label} — actual=${bn(actual)} exp=${bn(expected)}`);
    if (!pass) failed++;
  };
  const okGt = (label: string, actual: bigint, min: bigint) => {
    const pass = actual >= min;
    console.log(`${pass ? "PASS" : "FAIL"}  ${label} — actual=${bn(actual)} min=${bn(min)}`);
    if (!pass) failed++;
  };

  const bdns = new ethers.Contract(c.BDNS, ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"], provider);
  const swap = new ethers.Contract(c.BlockDNSwap, ["function swapEthToBdns() payable", "function swapBdnsToEth(uint256)", "function swapFeeBdn() view returns (uint256)", "function ethPerBdn() view returns (uint256)"], provider);
  const bridge = new ethers.Contract(c.BdnBridge, ["function deposit(uint256)", "function withdraw(uint256)", "function bridgeFeeBdn() view returns (uint256)", "function ledger(address) view returns (uint256)"], provider);

  const bdnsW1 = bdns.connect(w1);
  const swapW1 = swap.connect(w1);
  const swapW0 = swap.connect(w0);
  const bridgeW1 = bridge.connect(w1);
  const bridgeW0 = bridge.connect(w0);

  console.log(`chainId=${(await provider.getNetwork()).chainId} block=${await provider.getBlockNumber()}`);
  console.log(`swap=${c.BlockDNSwap} bridge=${c.BdnBridge}`);

  const feeSwap = await swapW0.swapFeeBdn();
  const feeBridge = await bridgeW0.bridgeFeeBdn();
  console.log(`swapFee=${bn(feeSwap)} BDNS bridgeFee=${bn(feeBridge)} BDNS (0.05$ / 0.10$ @0.01$/BDNS)`);

  const nonce = await provider.getTransactionCount(w1.address, "pending");
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const send = async (fn: () => Promise<ethers.ContractTransaction>, n: number): Promise<boolean> => {
    const tx = await fn();
    const receipt = await tx.wait();
    await sleep(600);
    return receipt?.status === 1;
  };

  // --- 1. ETH -> BDNS
  const backW1 = await bdns.balanceOf(w1.address);
  const backSwapBal = await bdns.balanceOf(c.BlockDNSwap);
  const backT = await bdns.balanceOf(w0.address);
  const r1 = await send(() => swapW1.swapEthToBdns({ value: ethers.parseEther("1"), nonce }), nonce);
  const afterW1 = await bdns.balanceOf(w1.address);
  const afterSwapBal = await bdns.balanceOf(c.BlockDNSwap);
  const afterT = await bdns.balanceOf(w0.address);
  console.log(`tx1(swapEthToBdns) status=${r1 ? "success" : "REVERTED"}`);
  ok("ETH->BDNS: w1 received", afterW1 - backW1, 2000n * 10n ** 18n - feeSwap);
  ok("ETH->BDNS: swap liquidity delta", afterSwapBal - backSwapBal, -(2000n * 10n ** 18n));
  ok("ETH->BDNS: fee -> treasury", afterT - backT, feeSwap);
  if (!r1) failed++;

  // --- 2. BDNS -> ETH
  await send(() => bdnsW1.approve(c.BlockDNSwap, ethers.MaxUint256, { nonce: nonce + 1 }), nonce + 1);
  const w1BdnsBefore2 = await bdns.balanceOf(w1.address);
  const ethBefore = await provider.getBalance(w1.address);
  const r2 = await send(() => swapW1.swapBdnsToEth(ethers.parseEther("1000"), { nonce: nonce + 2 }), nonce + 2);
  const ethAfter = await provider.getBalance(w1.address);
  const w1BdnsAfter2 = await bdns.balanceOf(w1.address);
  console.log(`tx2(swapBdnsToEth) status=${r2 ? "success" : "REVERTED"}`);
  ok("BDNS->ETH: w1 BDNS delta", w1BdnsBefore2 - w1BdnsAfter2, ethers.parseEther("1000"));
  okGt("BDNS->ETH: w1 ETH delta", ethAfter - ethBefore, ethers.parseEther("0.4"));

  // --- 3. Bridge deposit (needs its own approve)
  await send(() => bdnsW1.approve(c.BdnBridge, ethers.MaxUint256, { nonce: nonce + 3 }), nonce + 3);
  const backLedger = await bridgeW0.ledger(w1.address);
  const backBridgeBal = await bdns.balanceOf(c.BdnBridge);
  const r3 = await send(() => bridgeW1.deposit(ethers.parseEther("200"), { nonce: nonce + 4 }), nonce + 4);
  const afterLedger = await bridgeW0.ledger(w1.address);
  const afterBridgeBal = await bdns.balanceOf(c.BdnBridge);
  console.log(`tx3(bridge.deposit) status=${r3 ? "success" : "REVERTED"}`);
  ok("bridge deposit: ledger + net", afterLedger - backLedger, ethers.parseEther("190"));
  ok("bridge deposit: bridge holds net", afterBridgeBal - backBridgeBal, ethers.parseEther("190"));

  // --- 4. Bridge withdraw
  const r4 = await send(() => bridgeW1.withdraw(ethers.parseEther("40"), { nonce: nonce + 5 }), nonce + 5);
  console.log(`tx4(bridge.withdraw) status=${r4 ? "success" : "REVERTED"}`);
  ok("bridge withdraw: ledger -40", afterLedger - (await bridgeW0.ledger(w1.address)), ethers.parseEther("40"));

  if (failed === 0) console.log("SWAP + BRIDGE FLOW OK ✓");
  else {
    console.log(`${failed} check(s) FAILED ✗`);
    process.exitCode = 1;
  }
  console.log(`w1 bdns end=${bn(await bdns.balanceOf(w1.address))} eth end=${bn(await provider.getBalance(w1.address))}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});