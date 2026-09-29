import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

const RPC = "http://127.0.0.1:9545";
const ACCT0_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const ACCT1_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const ACCT2_KEY = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
const ACCT3_KEY = "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6";
const ACCT4_KEY = "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a";

const BDNS_ABI = [
  "function totalSupply() external view returns (uint256)",
  "function balanceOf(address) external view returns (uint256)",
  "function allowance(address,address) external view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transfer(address,uint256) returns (bool)",
  "function stake(uint256)",
  "function beginUnbonding(uint256)",
  "function getValidator(address) external view returns (uint256,uint256,uint256,bool)",
  "function validatorCount() external view returns (uint256)",
  "function validatorRegistry(uint256) external view returns (address)",
];
const REGISTRY_ABI = [
  "function registerDomain(string) external returns (uint256)",
  "function resolveName(string) external view returns (uint256)",
  "function ownerOf(uint256) external view returns (address)",
  "function nameOf(uint256) external view returns (string)",
  "function ipfsCIDOf(uint256) external view returns (string)",
  "function setIPFSRecord(uint256,string)",
  "function setAddressRecord(uint256,string,string)",
  "function addressRecords(uint256,string) external view returns (string)",
  "function balanceOf(address) external view returns (uint256)",
  "function setApprovalForAll(address, bool)",
  "function isApprovedForAll(address, address) external view returns (bool)",
];
const MARKET_ABI = [
  "function list(uint256,uint256)",
  "function buy(uint256)",
  "function getListing(uint256) external view returns (uint256,address,uint256,bool)",
  "function listingCount() external view returns (uint256)",
  "function feeBps() external view returns (uint16)",
  "function royaltySplitter() external view returns (address)",
];
const SPLITTER_ABI = [
  "function split() external",
  "function totalDistributed() external view returns (uint256)",
  "function treasuryBps() external view returns (uint16)",
  "function developerBps() external view returns (uint16)",
  "function liquidityBps() external view returns (uint16)",
  "function marketingBps() external view returns (uint16)",
  "function auditBps() external view returns (uint16)",
];
const PRICER_ABI = ["function priceOf(string) external view returns (uint256)"];
const BURN_ABI = [
  "function burnExplicit(uint256)",
  "function cumulativeBurned() external view returns (uint256)",
  "function HARD_CAP() external view returns (uint256)",
];

async function main() {
  const deploymentPath = path.join(__dirname, "..", "deployments", "l2.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const c = deployment.contracts;
  for (const k of ["BDNS", "BlockDNSRegistry", "BlockDNSMarketplace", "BDNSRoyaltySplitter", "BlockDNSPricer"]) {
    if (!c[k]) throw new Error(`missing ${k} in deployments/l2.json`);
  }

  const provider = new ethers.JsonRpcProvider(RPC);
  const w0 = new ethers.Wallet(ACCT0_KEY, provider);
  const w1 = new ethers.Wallet(ACCT1_KEY, provider);

  const nonce0 = { v: await provider.getTransactionCount(w0.address, "latest") };
  const nonce1 = { v: await provider.getTransactionCount(w1.address, "latest") };

  type Overrides = { nonce?: number };
  const send = async (
    counter: { v: number },
    method: (overrides?: Overrides) => Promise<ethers.ContractTransactionResponse>
  ) => {
    const resp = await method({ nonce: counter.v++ });
    return resp.wait();
  };

  const bdns = new ethers.Contract(c.BDNS, BDNS_ABI, w0);
  const registry = new ethers.Contract(c.BlockDNSRegistry, REGISTRY_ABI, w0);
  const market = new ethers.Contract(c.BlockDNSMarketplace, MARKET_ABI, w0);
  const splitter = new ethers.Contract(c.BDNSRoyaltySplitter, SPLITTER_ABI, w0);
  const pricer = new ethers.Contract(c.BlockDNSPricer, PRICER_ABI, w0);
  const burnEngine = new ethers.Contract(c.BDNSBurnEngine, BURN_ABI, w0);

  const fmt = (n: bigint) => ethers.formatEther(n);
  const pass = (label: string, ok: boolean, extra = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  — " + extra : ""}`);
    if (!ok) throw new Error(`verification failed: ${label}`);
  };

  console.log(`provider ok, chainId=${(await provider.getNetwork()).chainId.toString()}, block=${await provider.getBlockNumber()}`);
  console.log(`w0=${w0.address} w1=${w1.address}`);
  console.log(`bdns=${c.BDNS} registry=${c.BlockDNSRegistry} market=${c.BlockDNSMarketplace}`);
  console.log(`splitter=${c.BDNSRoyaltySplitter} pricer=${c.BlockDNSPricer}`);
  console.log(`supply=${fmt(await bdns.totalSupply())} BDNS`);

  // ----- 1. MINT fresh free domain (>=5 chars -> free, ensure available) -----
  let name = "";
  let price = 0n;
  for (let i = 0; i < 10; i++) {
    const candidate = `verify${Date.now() - i}${Math.floor(Math.random() * 900 + 100)}`;
    const tokenId0 = await registry.resolveName(candidate);
    const p = await pricer.priceOf(candidate);
    if (tokenId0 === 0n && p === 0n) {
      name = candidate;
      price = p;
      break;
    }
  }
  if (!name) throw new Error("could not find an available free name");
  pass(`priceOf("${name}") free`, price === 0n, `price=${fmt(price)}`);
  const supply0 = await bdns.totalSupply();
  const nft0 = await registry.balanceOf(w0.address);
  await send(nonce0, (o) => registry.registerDomain(name, o));
  const tokenId = await registry.resolveName(name);
  pass("minted, tokenId>0", tokenId > 0n, `tokenId=${tokenId}`);
  const owner = await registry.ownerOf(tokenId);
  pass("owner is w0", owner.toLowerCase() === w0.address.toLowerCase(), `owner=${owner}`);
  pass("supply unchanged (free name)", (await bdns.totalSupply()) === supply0);
  pass("nft balance +1", (await registry.balanceOf(w0.address)) === nft0 + 1n);

  // ----- 2. records -----
  await send(nonce0, (o) => registry.setIPFSRecord(tokenId, "ipfs://bafybeigqDEMO", o));
  pass("ipfs record set", (await registry.ipfsCIDOf(tokenId)) === "ipfs://bafybeigqDEMO");
  const ethAddr = "0x1111111111111111111111111111111111111111";
  await send(nonce0, (o) => registry.setAddressRecord(tokenId, "ETH", ethAddr, o));
  pass("eth record set", (await registry.addressRecords(tokenId, "ETH")) === ethAddr);

  // ----- 3. LIST -----
  const feeBps = await market.feeBps();
  const splitterAddr = await market.royaltySplitter();
  const priceBN = ethers.parseEther("1000");
  await send(nonce0, (o) => registry.setApprovalForAll(c.BlockDNSMarketplace, true, o));
  await send(nonce0, (o) => market.list(tokenId, priceBN, o));
  const [, , , active] = await market.getListing(tokenId);
  pass("listed @1000 BDNS", active, `feeBps=${feeBps} splitter=${splitterAddr}`);
  pass("market->splitter wired", splitterAddr.toLowerCase() === c.BDNSRoyaltySplitter.toLowerCase());

  // ----- 4. fund + approve buyer -----
  const need = ethers.parseEther("2000");
  if ((await bdns.balanceOf(w1.address)) < need) {
    await send(nonce0, (o) => bdns.connect(w0).transfer(w1.address, need, o));
  }
  pass("buyer funded >=2000", (await bdns.balanceOf(w1.address)) >= need, `bal=${fmt(await bdns.balanceOf(w1.address))}`);
  await send(nonce1, (o) => bdns.connect(w1).approve(c.BlockDNSMarketplace, ethers.MaxUint256, o));
  pass("buyer approved market", (await bdns.allowance(w1.address, c.BlockDNSMarketplace)) >= need);

  // ----- 5. BUY -----
  const s0b = await bdns.balanceOf(w0.address);
  const s1b = await bdns.balanceOf(w1.address);
  const spb = await bdns.balanceOf(splitterAddr);
  const spa = await bdns.balanceOf(splitterAddr);
  const distBefore = await splitter.totalDistributed();
  await send(nonce1, (o) => market.connect(w1).buy(tokenId, o));
  const newOwner = await registry.ownerOf(tokenId);
  pass("domain -> buyer", newOwner.toLowerCase() === w1.address.toLowerCase(), `owner=${newOwner}`);
  const fee = (priceBN * BigInt(feeBps)) / 10000n;
  const net = priceBN - fee;
  const s0a = await bdns.balanceOf(w0.address);
  const s1a = await bdns.balanceOf(w1.address);
  pass("seller net", s0a - s0b === net, `+${fmt(s0a - s0b)} exp ${fmt(net)}`);
  pass("buyer paid price", s1b - s1a === priceBN, `-${fmt(s1b - s1a)} exp ${fmt(priceBN)}`);
  const spa2 = await bdns.balanceOf(splitterAddr);
  const distAfter = await splitter.totalDistributed();
  pass("fee auto-split on buy", distAfter - distBefore === fee, `dist ${fmt(distAfter - distBefore)} exp ${fmt(fee)}`);
  pass("splitter drained after buy", spa2 === spa, `splitter bal ${fmt(spa2)}`);
  console.log(
    `split shares: treasury=${await splitter.treasuryBps()} dev=${await splitter.developerBps()} liq=${await splitter.liquidityBps()} mkt=${await splitter.marketingBps()} audit=${await splitter.auditBps()}`
  );
  pass("listing closed", !(await market.getListing(tokenId))[3], `listingCount=${await market.listingCount()}`);

  // ----- 6. SELL (relist by buyer) + buy back -----
  const price2 = ethers.parseEther("1500");
  await send(nonce1, (o) => registry.connect(w1).setApprovalForAll(c.BlockDNSMarketplace, true, o));
  await send(nonce1, (o) => market.connect(w1).list(tokenId, price2, o));
  pass("relisted @1500", (await market.getListing(tokenId))[3], `listingCount=${await market.listingCount()}`);
  await send(nonce0, (o) => bdns.connect(w0).approve(c.BlockDNSMarketplace, ethers.MaxUint256, o));
  const fee2 = (price2 * BigInt(feeBps)) / 10000n;
  const net2 = price2 - fee2;
  const x0b = await bdns.balanceOf(w0.address);
  const x1b = await bdns.balanceOf(w1.address);
  await send(nonce0, (o) => market.buy(tokenId, o));
  pass("bought back by w0", (await registry.ownerOf(tokenId)).toLowerCase() === w0.address.toLowerCase());
  const x0a = await bdns.balanceOf(w0.address);
  const x1a = await bdns.balanceOf(w1.address);
  pass("seller2 net", x1a - x1b === net2, `+${fmt(x1a - x1b)} exp ${fmt(net2)}`);
  pass("buyer2 paid", x0b - x0a === price2, `-${fmt(x0b - x0a)} exp ${fmt(price2)}`);

  // ----- 7. leave one live listing for the UI -----
  await send(nonce0, (o) => market.list(tokenId, ethers.parseEther("777"), o));
  pass("final listing @777 live", (await market.getListing(tokenId))[3], `listingCount=${await market.listingCount()}`);

  // ----- 8. seed validators + burn so the mini-explorer has live data -----
  const stakeCaps = [
    ethers.parseEther("150000"),
    ethers.parseEther("40000"),
    ethers.parseEther("40000"),
    ethers.parseEther("40000"),
    ethers.parseEther("40000"),
  ];
  const burnExplicit = ethers.parseEther("25000");
  const extraKeys = [ACCT1_KEY, ACCT2_KEY, ACCT3_KEY, ACCT4_KEY];
  const stakeAmounts: bigint[] = [];
  stakeAmounts.push(
    (await bdns.balanceOf(w0.address)) > stakeCaps[0] ? stakeCaps[0] : (await bdns.balanceOf(w0.address)) / 2n
  );
  for (let i = 1; i < stakeCaps.length; i++) {
    const w = new ethers.Wallet(extraKeys[i - 1], provider);
    stakeAmounts.push(
      (await bdns.balanceOf(w.address)) > stakeCaps[i] ? stakeCaps[i] : (await bdns.balanceOf(w.address)) / 2n
    );
  }
  for (let i = 1; i < stakeCaps.length; i++) {
    const w = new ethers.Wallet(extraKeys[i - 1], provider);
    const bal = await bdns.balanceOf(w.address);
    if (bal < stakeCaps[i] && (await bdns.balanceOf(w0.address)) > stakeCaps[i] * 2n) {
      const amt = stakeCaps[i] * 2n;
      stakeAmounts[i] = stakeCaps[i];
      await send(nonce0, (o) => bdns.connect(w0).transfer(w.address, amt, o));
    }
  }
  await send(nonce0, (o) => bdns.connect(w0).stake(stakeAmounts[0], o));
  pass(`validator #1 staked @${fmt(stakeAmounts[0])}`, (await bdns.getValidator(w0.address))[0] === stakeAmounts[0]);
  for (let i = 1; i < stakeAmounts.length; i++) {
    const w = new ethers.Wallet(extraKeys[i - 1], provider);
    const n = { v: await provider.getTransactionCount(w.address, "latest") };
    const s = stakeAmounts[i] > 0n ? stakeAmounts[i] : ethers.parseEther("1");
    await send(n, (o) => bdns.connect(w).stake(s, o));
    const [staked] = await bdns.getValidator(w.address);
    pass(`validator #${i + 1} staked @${fmt(staked)}`, staked === s, `addr=${w.address}`);
  }
  console.log(`validatorCount=${await bdns.validatorCount()} (note: may include pre-seeded validators)`);

  const burnedBefore = await burnEngine.cumulativeBurned();
  await send(nonce0, (o) => bdns.connect(w0).approve(c.BDNSBurnEngine, burnExplicit, o));
  await send(nonce0, (o) => burnEngine.burnExplicit(burnExplicit, o));
  const burnedAfter = await burnEngine.cumulativeBurned();
  pass("explicit burn recorded", burnedAfter - burnedBefore === burnExplicit, `+${fmt(burnedAfter - burnedBefore)}`);
  console.log(`burn engine: burned=${fmt(burnedAfter)} hardCap=${fmt(await burnEngine.HARD_CAP())}`);

  console.log(`\nDEMO FLOW OK ✓  domain="${name}" tokenId=${tokenId} owner=${await registry.ownerOf(tokenId)} block=${await provider.getBlockNumber()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});