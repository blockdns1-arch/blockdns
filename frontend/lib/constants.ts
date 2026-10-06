import { DEPLOYMENT } from "@/lib/deployment";

const ZERO = "0x0000000000000000000000000000000000000000";

function address(value: string | undefined): `0x${string}` {
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) return ZERO as `0x${string}`;
  return value as `0x${string}`;
}

export const REGISTRY_ADDRESS = address(
  process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || DEPLOYMENT.registry
);

export const PRICER_ADDRESS = address(
  process.env.NEXT_PUBLIC_PRICER_ADDRESS || DEPLOYMENT.pricer
);

export const BDNS_ADDRESS = address(
  process.env.NEXT_PUBLIC_BDNS_ADDRESS || DEPLOYMENT.bdns
);

export const MARKET_ADDRESS = address(
  process.env.NEXT_PUBLIC_MARKET_ADDRESS || DEPLOYMENT.market
);

export const BURN_ENGINE_ADDRESS = address(
  process.env.NEXT_PUBLIC_BURN_ENGINE_ADDRESS || DEPLOYMENT.burnEngine
);

export const STAKING_VAULT_ADDRESS = address(
  process.env.NEXT_PUBLIC_STAKING_VAULT_ADDRESS || DEPLOYMENT.stakingVault
);

export const SWAP_ADDRESS = address(
  process.env.NEXT_PUBLIC_SWAP_ADDRESS || DEPLOYMENT.swap
);

export const BRIDGE_ADDRESS = address(
  process.env.NEXT_PUBLIC_BRIDGE_ADDRESS || DEPLOYMENT.bridge
);

export const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL || DEPLOYMENT.explorerUrl;

export const IPFS_GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://gateway.pinata.cloud";

export const isConfigured = () =>
  REGISTRY_ADDRESS !== ZERO && PRICER_ADDRESS !== ZERO && BDNS_ADDRESS !== ZERO;

export const isMarketConfigured = () => MARKET_ADDRESS !== ZERO;

export function ipfsUrl(cid: string): string {
  if (!cid) return "";
  if (cid.startsWith("ipfs://")) return cid;
  return `${IPFS_GATEWAY}/ipfs/${cid}`;
}

export function formatBDNS(value: bigint, decimals = 4): string {
  const whole = value / 10n ** 18n;
  const fraction = value % 10n ** 18n;
  if (fraction === 0n) return whole.toString();
  const fracStr = fraction.toString().padStart(18, "0").slice(0, decimals);
  return `${whole}.${fracStr.replace(/0+$/, "") || "0"}`;
}

export function parseBDNS(input: string): bigint | null {
  const raw = input.trim();
  if (!/^\d+(\.\d{1,18})?$/.test(raw)) return null;
  const [whole, frac = ""] = raw.split(".");
  const wei = BigInt(whole || "0") * 10n ** 18n + BigInt(frac.padEnd(18, "0"));
  return wei;
}

export function txLink(hash: string): string {
  return EXPLORER_URL ? `${EXPLORER_URL}/tx/${hash}` : "";
}