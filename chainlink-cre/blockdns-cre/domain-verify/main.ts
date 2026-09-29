import {
  bytesToHex,
  ConsensusAggregationByFields,
  CronCapability,
  encodeCallMsg,
  EVMClient,
  getNetwork,
  handler,
  HTTPClient,
  json,
  median,
  ok,
  Runner,
  type Runtime,
} from "@chainlink/cre-sdk";

export type Config = {
  schedule: string;
  name: string;
  registry: `0x${string}`;
  expectedOwner: string;
  githubRepo: string;
  githubUrl: string;
  dohUrl: string;
  dnsTarget: string;
};

type ExternalStats = {
  gitHubExists: number;
  gitHubStars: number;
  gitHubForks: number;
  dnsRecordFree: number;
  dnsStatus: number;
};

type VerificationRecord = {
  protocol: string;
  version: string;
  name: string;
  chain: string;
  registry: string;
  tokenId: string;
  onchainOwner: string;
  ownerMatched: boolean;
  external: {
    gitHub: {
      exists: boolean;
      stars: number;
      forks: number;
    };
    legacyDNS: {
      target: string;
      status: string;
      recordFree: boolean;
    };
  };
  verified: boolean;
  timestamp: string;
};

const BASE_NETWORK = getNetwork({
  chainFamily: "evm",
  chainSelectorName: "ethereum-testnet-sepolia-base-1",
});
const BASE_SELECTOR = BASE_NETWORK?.chainSelector.selector ?? 10344971235874465080n;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const TOKEN_BY_INDEX_0_CALL = "0x4f6ccce70000000000000000000000000000000000000000000000000000000000000000";
const OWNER_OF_1_CALL = "0x6352211e0000000000000000000000000000000000000000000000000000000000000001";

const decodeUint256 = (hex: string): string => {
  return BigInt("0x" + hex.slice(hex.length - 64)).toString();
};

const decodeAddress = (hex: string): string => {
  return "0x" + hex.slice(hex.length - 40);
};

export const onCronTrigger = (runtime: Runtime<Config>): VerificationRecord => {
  const config = runtime.config;
  const evm = new EVMClient(BASE_SELECTOR);
  const http = new HTTPClient();

  runtime.log(`BlockDNS domain-verify run for "${config.name}"`);

  const tokenIdCall = evm.callContract(runtime, {
    call: encodeCallMsg({
      from: ZERO_ADDRESS,
      to: config.registry,
      data: TOKEN_BY_INDEX_0_CALL,
    }),
  }).result();
  const tokenId = decodeUint256(bytesToHex(tokenIdCall.data));

  const ownerCall = evm.callContract(runtime, {
    call: encodeCallMsg({
      from: ZERO_ADDRESS,
      to: config.registry,
      data: OWNER_OF_1_CALL,
    }),
  }).result();
  const onchainOwner = decodeAddress(bytesToHex(ownerCall.data));

  const external = runtime.runInNodeMode(
    (nodeRuntime): ExternalStats => {
      const githubResponse = http.sendRequest(nodeRuntime, {
        url: config.githubUrl,
        method: "GET",
        headers: { accept: "application/json" },
      }).result();
      const githubData = json(githubResponse) as {
        stargazers_count?: number;
        forks_count?: number;
      };

      const dnsResponse = http.sendRequest(nodeRuntime, {
        url: config.dohUrl,
        method: "GET",
        headers: { accept: "application/dns-json" },
      }).result();
      const dnsData = json(dnsResponse) as { Status?: number };

      const dnsStatus = dnsData.Status !== undefined ? dnsData.Status : -1;

      return {
        gitHubExists: ok(githubResponse) && githubData.stargazers_count !== undefined ? 1 : 0,
        gitHubStars: githubData.stargazers_count ?? 0,
        gitHubForks: githubData.forks_count ?? 0,
        dnsRecordFree: dnsStatus === 3 || dnsStatus === 0 ? 1 : 0,
        dnsStatus,
      };
    },
    ConsensusAggregationByFields<ExternalStats>({
      gitHubExists: () => median<number>(),
      gitHubStars: () => median<number>(),
      gitHubForks: () => median<number>(),
      dnsRecordFree: () => median<number>(),
      dnsStatus: () => median<number>(),
    })
  );

  const stats = external().result();
  const ownerMatched = onchainOwner.toLowerCase() === config.expectedOwner.toLowerCase();

  return {
    protocol: "BlockDNS",
    version: "1.0.0",
    name: config.name,
    chain: "base-sepolia",
    registry: config.registry,
    tokenId,
    onchainOwner,
    ownerMatched,
    external: {
      gitHub: {
        exists: stats.gitHubExists === 1,
        stars: stats.gitHubStars,
        forks: stats.gitHubForks,
      },
      legacyDNS: {
        target: config.dnsTarget,
        status: stats.dnsStatus < 0 ? "unknown" : String(stats.dnsStatus),
        recordFree: stats.dnsRecordFree === 1,
      },
    },
    verified: ownerMatched && stats.gitHubExists === 1,
    timestamp: new Date().toISOString(),
  };
};

export const initWorkflow = (config: Config) => {
  const cron = new CronCapability();

  return [
    handler(
      cron.trigger({ schedule: config.schedule }),
      onCronTrigger
    ),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}