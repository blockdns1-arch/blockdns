import * as dotenv from "dotenv";

dotenv.config();

export type GatewayConfig = {
  port: number;
  chainId: number;
  rpcUrl: string;
  registryAddress: `0x${string}`;
  resolverAddress: `0x${string}` | null;
  allowedSuffixes: string[];
  cacheTtlSeconds: number;
  redisUrl: string | null;
  ipfsGateways: string[];
  gatewayConsensus: boolean;
  strictCidVerify: boolean;
  maxContentBytes: number;
  requestTimeoutMs: number;
  apexRedirectUrl: string;
};

function parseHex(value: string | undefined, label: string): `0x${string}` {
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${label} is missing or invalid`);
  }
  return value as `0x${string}`;
}

export function loadConfig(): GatewayConfig {
  const redisUrl = process.env.REDIS_URL?.trim() || null;

  return {
    port: Number(process.env.PORT || 8080),
    chainId: Number(process.env.L2_CHAIN_ID || 8461),
    rpcUrl: process.env.L2_RPC_URL || "http://127.0.0.1:9545",
    registryAddress: parseHex(process.env.REGISTRY_ADDRESS, "REGISTRY_ADDRESS"),
    resolverAddress: process.env.RESOLVER_ADDRESS
      ? parseHex(process.env.RESOLVER_ADDRESS, "RESOLVER_ADDRESS")
      : null,
    allowedSuffixes: (process.env.ALLOWED_HOST_SUFFIXES || ".bdns.link,.bdns")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS || 60),
    redisUrl,
    ipfsGateways: (process.env.IPFS_GATEWAYS ||
      "https://cloudflare-ipfs.com,https://gateway.pinata.cloud")
      .split(",")
      .map((g) => g.trim().replace(/\/+$/, ""))
      .filter(Boolean),
    gatewayConsensus: (process.env.GATEWAY_CONSENSUS || "true").toLowerCase() === "true",
    strictCidVerify: (process.env.STRICT_CID_VERIFY || "true").toLowerCase() === "true",
    maxContentBytes: Number(process.env.MAX_CONTENT_BYTES || 20 * 1024 * 1024),
    requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 8000),
    apexRedirectUrl: (process.env.APEX_REDIRECT_URL || "").trim(),
  };
}