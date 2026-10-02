import {
  createPublicClient,
  http,
  decodeFunctionData,
  type Block,
  type Transaction,
} from "viem";
import { blockdnsL2 } from "@/lib/chains";
import {
  REGISTRY_ADDRESS,
  PRICER_ADDRESS,
  BDNS_ADDRESS,
  MARKET_ADDRESS,
  BURN_ENGINE_ADDRESS,
  STAKING_VAULT_ADDRESS,
  SWAP_ADDRESS,
  BRIDGE_ADDRESS,
} from "@/lib/constants";
import {
  REGISTRY_ABI,
  PRICER_ABI,
  BDNS_ABI,
  MARKET_ABI,
  BURN_ENGINE_ABI,
  STAKING_VAULT_ABI,
  BDNS_STAKING_ABI,
  SWAP_ABI,
  BRIDGE_ABI,
} from "@/lib/abi";

const SPLITTER_ADDRESS = (
  process.env.NEXT_PUBLIC_SPLITTER_ADDRESS ||
  "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
) as string;
const RESOLVER_ADDRESS = (
  process.env.NEXT_PUBLIC_RESOLVER_ADDRESS ||
  "0xc3e53F4d16Ae77Db1c982e75a937B9f60FE63690"
) as string;

const SPLITTER_ABI = [
  {
    type: "function",
    name: "split",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "distribute",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "totalDistributed",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const BURN_EXTRA_ABI = [
  {
    type: "function",
    name: "burnExplicit",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

const ERC721_EXTRA_ABI = [
  {
    type: "function",
    name: "transferFrom",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

/* eslint-disable @typescript-eslint/no-explicit-any */
export const EXPLORER_ABI: any[] = [
  ...REGISTRY_ABI,
  ...PRICER_ABI,
  ...BDNS_ABI,
  ...MARKET_ABI,
  ...BURN_ENGINE_ABI,
  ...BURN_EXTRA_ABI,
  ...STAKING_VAULT_ABI,
  ...BDNS_STAKING_ABI,
  ...SPLITTER_ABI,
  ...ERC721_EXTRA_ABI,
  ...SWAP_ABI,
  ...BRIDGE_ABI,
];

export interface ContractLabel {
  name: string;
  address?: `0x${string}`;
}

const MESSENGER_LINE_RAW =
  process.env.NEXT_PUBLIC_MESSENGER_ADDRESS ||
  "0xd04b98f48e80f7c7f2824f8efdd6e1d8b1c0e7f2";

export const KNOWN_CONTRACTS: Record<string, string> = {
  [BDNS_ADDRESS.toLowerCase()]: "BDNS Token (ERC20)",
  [REGISTRY_ADDRESS.toLowerCase()]: "BlockDNSRegistry",
  [PRICER_ADDRESS.toLowerCase()]: "BlockDNSPricer",
  [MARKET_ADDRESS.toLowerCase()]: "BlockDNSMarketplace",
  [BURN_ENGINE_ADDRESS.toLowerCase()]: "BDNSBurnEngine",
  [STAKING_VAULT_ADDRESS.toLowerCase()]: "BDNSStakingVault",
  [SPLITTER_ADDRESS.toLowerCase()]: "BDNSRoyaltySplitter",
  [RESOLVER_ADDRESS.toLowerCase()]: "BlockDNSResolver",
  [SWAP_ADDRESS.toLowerCase()]: "BlockDNSwap",
  [BRIDGE_ADDRESS.toLowerCase()]: "BdnBridge",
  [MESSENGER_LINE_RAW.toLowerCase()]: "L2CrossDomainMessenger",
};

export const client = createPublicClient({
  chain: blockdnsL2,
  transport: http(
    process.env.NEXT_PUBLIC_L2_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
  ),
});

export function short(hash: string, head = 10, tail = 8): string {
  if (!hash) return "-";
  if (hash.length <= head + tail + 3) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

export function labelFor(address: string): string {
  if (!address) return "—";
  return KNOWN_CONTRACTS[address.toLowerCase()] || short(address);
}

export function formatEtherNative(value: bigint): string {
  return (Number(value) / 1e18).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

export interface DecodedCall {
  functionName: string;
  args: unknown[];
  raw: string;
}

export function decodeCall(input: string): DecodedCall {
  const raw = input || "";
  if (!raw || raw === "0x") return { functionName: "", args: [], raw };
  try {
    const d = decodeFunctionData({ abi: EXPLORER_ABI, data: raw as `0x${string}` });
    return { functionName: d.functionName, args: (d.args as unknown[]) || [], raw };
  } catch {
    return { functionName: "", args: [], raw };
  }
}

export function formatArg(arg: unknown): string {
  if (typeof arg === "bigint") {
    if (arg > 10n ** 15n) return `${formatEtherNative(arg)} BDNS-equiv`;
    return arg.toString();
  }
  if (typeof arg === "string") {
    if (arg.startsWith("0x") && arg.length === 40) return labelFor(arg);
    if (arg.startsWith("0x") && arg.length === 66) return short(arg);
    if (arg.length > 64) return `${arg.slice(0, 64)}…`;
    return arg;
  }
  if (typeof arg === "boolean") return arg ? "true" : "false";
  if (Array.isArray(arg)) return `[${arg.map(formatArg).join(", ")}]`;
  if (arg && typeof arg === "object") {
    const o = arg as Record<string, unknown>;
    return `{ ${Object.entries(o)
      .map(([k, v]) => `${k}: ${formatArg(v)}`)
      .join(", ")} }`;
  }
  return String(arg);
}

export interface ExplorerBlock {
  number: bigint;
  timestamp: bigint;
  transactions: (Transaction | `0x${string}`)[];
  gasUsed: bigint;
  gasLimit: bigint;
  miner: `0x${string}`;
}

export interface ExplorerTx {
  hash: `0x${string}`;
  blockNumber: bigint | null;
  from: `0x${string}`;
  to: `0x${string}` | null;
  value: bigint;
  gas: bigint;
  gasPrice: bigint;
  decoded: DecodedCall;
  status: string;
}

export async function fetchLatestBlocks(count = 12): Promise<ExplorerBlock[]> {
  const latest = await client.getBlockNumber();
  const blocks: ExplorerBlock[] = [];
  const start = latest > BigInt(count) ? latest - BigInt(count) + 1n : 1n;
  for (let n = start; n <= latest; n++) {
    const b = (await client.getBlock({
      blockNumber: n,
      includeTransactions: true,
    })) as Block & { transactions: Transaction[] };
    blocks.push({
      number: b.number!,
      timestamp: b.timestamp,
      transactions: b.transactions,
      gasUsed: b.gasUsed,
      gasLimit: b.gasLimit,
      miner: b.miner || (b.transactions[0]?.from as `0x${string}`) || ("0x0" as `0x${string}`),
    });
  }
  return blocks.reverse();
}

export async function fetchRecentTxs(latest: bigint, txCount = 12): Promise<ExplorerTx[]> {
  const txs: ExplorerTx[] = [];
  const step = latest > BigInt(200) ? 200n : latest;
  outer: for (let n = latest; n > 0n; n--) {
    if (txs.length >= txCount) break;
    const block = (await client.getBlock({
      blockNumber: n,
      includeTransactions: true,
    })) as unknown as Block & { transactions: Transaction[] };
    const txList = block.transactions;
    for (const tx of txList) {
      if (txs.length >= txCount) break outer;
      let status = "";
      const r = await client.getTransactionReceipt({ hash: tx.hash });
      status = r.status === "success" ? "Success" : "Reverted";
      txs.push({
        hash: tx.hash,
        blockNumber: tx.blockNumber,
        from: tx.from,
        to: tx.to,
        value: tx.value ?? 0n,
        gas: tx.gas ?? 0n,
        gasPrice: tx.gasPrice ?? 0n,
        decoded: decodeCall(tx.input || "0x"),
        status,
      });
    }
    if (latest - n > step) break;
  }
  return txs;
}

export async function fetchTx(hash: string): Promise<ExplorerTx | null> {
  try {
    const tx = (await client.getTransaction({
      hash: hash as `0x${string}`,
    })) as unknown as Transaction;
    if (!tx) return null;
    const r = await client.getTransactionReceipt({
      hash: hash as `0x${string}`,
    });
    const decoded = decodeCall(tx.input || "0x");
    return {
      hash: tx.hash,
      blockNumber: tx.blockNumber,
      from: tx.from as `0x${string}`,
      to: tx.to as `0x${string}` | null,
      value: tx.value ?? 0n,
      gas: tx.gas ?? 0n,
      gasPrice: tx.gasPrice ?? 0n,
      decoded,
      status: r.status === "success" ? "Success" : "Reverted",
    };
  } catch {
    return null;
  }
}

export function age(ts: bigint | undefined): string {
  if (!ts) return "—";
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - Number(ts));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
