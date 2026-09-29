import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

export const WATCH_STATE_FILE = path.resolve(
  __dirname,
  "..",
  "deployments",
  "watch-state.json"
);

export const WATCH_OUTPUT = path.resolve(
  __dirname,
  "..",
  "social-agent",
  "events.jsonl"
);

export const REGISTRY_EVENT_ABI = [
  "event DomainRegistered(address indexed owner, uint256 indexed tokenId, string name)",
];

export const PRICER_EVENT_ABI = [
  "event PremiumPaid(address indexed payer, string name, uint256 amount, uint256 burned, uint256 treasuryAmount)",
];

export const STAKING_EVENT_ABI = [
  "event EmissionReleased(address indexed to, uint256 amount, uint256 periodIndex)",
];

export const BDNS_EVENT_ABI = [
  "event ValidatorStaked(address indexed validator, uint256 amount, uint256 totalStake)",
];

export function mapRegistryLog(args: { owner: string; tokenId: bigint; name: string }): {
  type: string;
  payload: Record<string, string>;
} {
  return { type: "DOMAIN_MINT", payload: { name: args.name } };
}

export function mapPricerLog(args: {
  payer: string;
  name: string;
  amount: bigint;
  burned: bigint;
  treasuryAmount: bigint;
}): { type: string; payload: Record<string, string> } {
  return {
    type: "REVENUE",
    payload: {
      amount: `${ethers.formatEther(args.treasuryAmount)} BDNS (50% burned ${ethers.formatEther(args.burned)})`,
      name: args.name,
    },
  };
}

export function mapStakingLog(args: {
  to: string;
  amount: bigint;
  periodIndex: bigint;
}): { type: string; payload: Record<string, string> } {
  return {
    type: "STAKING_MILESTONE",
    payload: { amount: `${ethers.formatEther(args.amount)} BDNS · period ${args.periodIndex}` },
  };
}

export function mapValidatorStakedLog(args: {
  validator: string;
  amount: bigint;
  totalStake: bigint;
}): { type: string; payload: Record<string, string> } {
  return {
    type: "STAKING_MILESTONE",
    payload: { amount: `${ethers.formatEther(args.amount)} BDNS validator staked` },
  };
}

export function serializeEvent(event: { type: string; payload: Record<string, string> }): string {
  return JSON.stringify({ type: event.type, payload: event.payload });
}

export function appendEvent(line: string, outFile: string = WATCH_OUTPUT): void {
  const dir = path.dirname(outFile);
  fs.mkdirSync(dir, { recursive: true });
  const MAX_BYTES = 2 * 1024 * 1024;
  if (fs.existsSync(outFile) && fs.statSync(outFile).size > MAX_BYTES) {
    try {
      fs.renameSync(outFile, `${outFile}.bak`);
    } catch {
      /* keep current file if rename fails */
    }
  }
  fs.appendFileSync(outFile, `${line}\n`);
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

type WatchKey = "registry" | "pricer" | "staking" | "bdns" | "stats";

export function loadState(): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(WATCH_STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

export function saveState(state: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(WATCH_STATE_FILE), { recursive: true });
  const tmp = `${WATCH_STATE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, WATCH_STATE_FILE);
}

export async function composeStats(
  fromHeight: number,
  toHeight: number,
  fromTime: number,
  toTime: number
): Promise<string> {
  let txs = 0;
  for (let h = fromHeight + 1; h <= toHeight; h++) {
    const block = await ethers.provider.getBlock(h);
    if (block) txs += block.transactions.length;
  }
  const spanBlocks = Math.max(1, toHeight - fromHeight);
  const spanSecs = Math.max(1, toTime - fromTime);
  const txPerBlock = txs / spanBlocks;
  const txPerSec = txs / spanSecs;
  const gas = (await ethers.provider.getFeeData()).gasPrice ?? 0n;
  return (
    `block ${toHeight} · ${txPerBlock.toFixed(2)} tx/block · ` +
    `${txPerSec.toFixed(2)} tx/s · gas ${ethers.formatUnits(gas, "gwei")} gwei`
  );
}

export async function runWatchOnce(options: {
  stateFile?: string;
  outputFile?: string;
  lookback?: number;
  statsMinBlocks?: number;
} = {}): Promise<{ events: number; statsEmitted: boolean }> {
  const stateFile = options.stateFile ?? WATCH_STATE_FILE;
  const outputFile = options.outputFile ?? WATCH_OUTPUT;
  const lookback = options.lookback ?? Number(process.env.WATCH_LOOKBACK_BLOCKS ?? "1000");
  const statsMinBlocks = options.statsMinBlocks ?? Number(process.env.WATCH_STATS_MIN_BLOCKS ?? "50");

  const deploymentFile = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`no deployment file at ${deploymentFile}`);
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const contracts = (deployment.contracts || {}) as Record<string, string>;
  const state = loadState();
  const latest = await ethers.provider.getBlockNumber();
  let events = 0;

  const watches: { key: string; address?: string; abi: string[]; filter: string; map: (a: any) => any }[] = [
    {
      key: "registry",
      address: contracts.BlockDNSRegistry,
      abi: REGISTRY_EVENT_ABI,
      filter: "DomainRegistered",
      map: mapRegistryLog,
    },
    {
      key: "pricer",
      address: contracts.BlockDNSPricer,
      abi: PRICER_EVENT_ABI,
      filter: "PremiumPaid",
      map: mapPricerLog,
    },
    {
      key: "staking",
      address: contracts.BDNSStakingVault,
      abi: STAKING_EVENT_ABI,
      filter: "EmissionReleased",
      map: mapStakingLog,
    },
    {
      key: "bdns",
      address: contracts.BDNS,
      abi: BDNS_EVENT_ABI,
      filter: "ValidatorStaked",
      map: mapValidatorStakedLog,
    },
  ];

  for (const watch of watches) {
    if (!watch.address) continue;
    const from = Number(state[watch.key] ?? Math.max(0, latest - lookback));
    if (from > latest) continue;
    const contract = await ethers.getContractAt(watch.abi, watch.address);
    const logs = await contract.queryFilter(watch.filter, from, latest);
    for (const log of logs) {
      const event = watch.map(log.args);
      const line = serializeEvent(event);
      appendEvent(line, outputFile);
      events++;
      console.log(
        `[${new Date().toISOString()}] ${watch.key}:${watch.filter} → ${line}`
      );
    }
    state[watch.key] = latest + 1;
  }

  const stats = state.stats as { height?: number; time?: number } | undefined;
  const prevHeight = Number(stats?.height ?? latest);
  const prevTime = Number(stats?.time ?? nowSeconds());
  let statsEmitted = false;
  if (latest - prevHeight >= statsMinBlocks) {
    const text = await composeStats(prevHeight, latest, prevTime, nowSeconds());
    appendEvent(serializeEvent({ type: "L2_STATS", payload: { stats: text } }), outputFile);
    console.log(`[${new Date().toISOString()}] stats: L2_STATS → ${text}`);
    events++;
    statsEmitted = true;
  }
  state.stats = { height: latest, time: nowSeconds() };

  saveState(state);
  return { events, statsEmitted };
}

export async function main(): Promise<void> {
  const once = process.env.WATCH_ONCE === "1";
  const pollMs = Number(process.env.WATCH_POLL_MS ?? "20000");
  console.log(
    `watch-events: network=${network.name} state=${WATCH_STATE_FILE} output=${WATCH_OUTPUT} once=${once}`
  );
  await runWatchOnce();
  if (once) return;
  setInterval(async () => {
    try {
      await runWatchOnce();
    } catch (err) {
      console.error(`[watch-events] poll failed: ${(err as Error).message}`);
    }
  }, pollMs);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}