import { ethers } from "ethers";

const RPC = "http://127.0.0.1:9545";
const MARKET = "0x8f86403A4DE0BB5791fa46B8e795C547942fE4Cf";
const REGISTRY = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
const BDNS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const SELLER = "0xB58ecB7173c38e9eA0F28B9C56BdFB7eE260a924"; // Brave wallet
const BUYER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // hardhat account #1
const OWNER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // account #0 / treasury

const ETHER_ABI = [
  "function ownerOf(uint256) view returns (address)",
  "function balanceOf(address) view returns (uint256)",
  "function setApprovalForAll(address,bool)",
  "function isApprovedForAll(address,address) view returns (bool)",
];
const MARKET_ABI = [
  "function listingCount() view returns (uint256)",
  "function getListing(uint256) view returns (uint256,address,uint256,bool)",
  "function list(uint256,uint256)",
  "function buy(uint256)",
  "function feeBps() view returns (uint16)",
];
const BDNS_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transfer(address,uint256) returns (bool)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const registry = new ethers.Contract(REGISTRY, ETHER_ABI, provider);
  const bdns = new ethers.Contract(BDNS, BDNS_ABI, provider);
  const market = new ethers.Contract(MARKET, MARKET_ABI, provider);

  const tokenId = 4n; // marjane.bdns
  const price = 500n * 10n ** 18n;

  const rawSend = async (from: string, to: string, data: string, value = "0x0") => {
    const hash = (await provider.send("eth_sendTransaction", [{ from, to, data, value }])) as string;
    const receipt = await provider.waitForTransaction(hash);
    if (receipt.status !== 1) throw new Error(`tx ${hash} reverted`);
    return hash;
  };

  async function impersonate(addr: string) {
    await provider.send("hardhat_impersonateAccount", [addr]);
  }

  const ownerOf = await registry.ownerOf(tokenId);
  console.log(`token #${tokenId} owner =`, ownerOf);

  const [, , , alreadyActive] = await market.getListing(tokenId);

  if (ownerOf.toLowerCase() === SELLER.toLowerCase() && !alreadyActive) {
    await impersonate(SELLER);
    const approved = await registry.isApprovedForAll(SELLER, MARKET);
    if (!approved) {
      const data = registry.interface.encodeFunctionData("setApprovalForAll", [MARKET, true]);
      await rawSend(SELLER, REGISTRY, data);
      console.log("approved market as operator for seller ✓");
    } else {
      console.log("market already approved as operator ✓");
    }

    const data = market.interface.encodeFunctionData("list", [tokenId, price]);
    const h = await rawSend(SELLER, MARKET, data);
    console.log(`listed marjane.bdns @ 500 BDNS (tx ${h.slice(0, 10)}…) ✓`);
  } else {
    console.log("listing already live (or domain sold) — skipping list");
  }

  const [listedId, seller, currentPrice, active] = await market.getListing(tokenId);
  console.log(`listing active=${active} price=${ethers.formatEther(currentPrice)} BDNS seller=${seller}`);
  if (!active) throw new Error("no live listing to buy");

  const buyerBal = await bdns.balanceOf(BUYER);
  if (buyerBal < price) {
    const fund = price * 2n;
    const transferData = bdns.interface.encodeFunctionData("transfer", [BUYER, fund]);
    await rawSend(OWNER, BDNS, transferData);
    console.log(`funded buyer with ${ethers.formatEther(fund)} BDNS ✓`);
  }

  const allowance = await bdns.allowance(BUYER, MARKET);
  if (allowance < price) {
    const data = bdns.interface.encodeFunctionData("approve", [MARKET, price]);
    await rawSend(BUYER, BDNS, data);
    console.log("buyer approved BDNS to market ✓");
  }

  const sellerBefore = await bdns.balanceOf(SELLER);
  const treasuryBefore = await bdns.balanceOf(OWNER);
  const buyerBefore = await bdns.balanceOf(BUYER);

  const buyData = market.interface.encodeFunctionData("buy", [tokenId]);
  const bh = await rawSend(BUYER, MARKET, buyData);
  console.log(`buy tx ${bh.slice(0, 10)}… ✓`);

  const newOwner = await registry.ownerOf(tokenId);
  const fee = (price * 250n) / 10000n;
  const net = price - fee;

  const sellerAfter = await bdns.balanceOf(SELLER);
  const treasuryAfter = await bdns.balanceOf(OWNER);
  const buyerAfter = await bdns.balanceOf(BUYER);

  console.log("\n=== RESULTS ===");
  console.log("ownerOf(marjane)      =", newOwner);
  console.log("seller(0xB58e)  +net  =", ethers.formatEther(sellerAfter - sellerBefore), "BDNS (expected", ethers.formatEther(net) + ")");
  console.log("treasury(0xf39F) +fee  =", ethers.formatEther(treasuryAfter - treasuryBefore), "BDNS (expected", ethers.formatEther(fee) + ")");
  console.log("buyer(0x7099)   -paid =", ethers.formatEther(buyerBefore - buyerAfter), "BDNS (expected", ethers.formatEther(price) + ")");
  console.log("listingCount now       =", await market.listingCount());

  if (newOwner.toLowerCase() !== BUYER.toLowerCase())
    throw new Error("ownership transfer failed");
  if (sellerAfter - sellerBefore !== net) throw new Error("seller payout wrong");
  if (treasuryAfter - treasuryBefore !== fee) throw new Error("fee wrong");
  console.log("\nMARKET DEMO OK ✓");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});