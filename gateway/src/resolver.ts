import { createPublicClient, http, defineChain, type Hex } from "viem";
import type { GatewayConfig } from "./config";
import { REGISTRY_ABI, RESOLVER_ABI } from "./abis";

export type ResolvedDomain = {
  name: string;
  tokenId: bigint;
  owner: Hex;
  cid: string;
  addresses: Record<string, string>;
};

export type ResolvedView = {
  name: string;
  tokenId: string;
  owner: string;
  cid: string;
  addresses: Record<string, string>;
};

export function toView(resolved: ResolvedDomain): ResolvedView {
  return {
    name: resolved.name,
    tokenId: resolved.tokenId.toString(),
    owner: resolved.owner,
    cid: resolved.cid,
    addresses: resolved.addresses,
  };
}

const ADDRESS_KEYS = ["ETH", "BTC", "SOL"] as const;

export class ResolverError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
  }
}

export class OnchainResolver {
  private client: ReturnType<typeof createPublicClient>;
  private readonly registry: Hex;
  private readonly resolverContract: Hex | null;

  constructor(cfg: GatewayConfig) {
    const chain = defineChain({
      id: cfg.chainId,
      name: "BlockDNS L2",
      nativeCurrency: {
        name: "BlockDNS",
        symbol: "BDNS",
        decimals: 18,
      },
      rpcUrls: {
        default: { http: [cfg.rpcUrl] },
        public: { http: [cfg.rpcUrl] },
      },
    });
    this.client = createPublicClient({ chain, transport: http(cfg.rpcUrl) });
    this.registry = cfg.registryAddress;
    this.resolverContract = cfg.resolverAddress || null;
  }

  async resolve(name: string): Promise<ResolvedDomain | null> {
    if (!name) return null;

    let tokenId: bigint;
    try {
      tokenId = (await this.client.readContract({
        address: this.registry,
        abi: REGISTRY_ABI,
        functionName: "resolveName",
        args: [name],
      })) as bigint;
    } catch (err) {
      throw new ResolverError(`failed to query registry for "${name}"`, err);
    }

    if (!tokenId) return null;

    const [owner, cid] = await Promise.all([
      this.client.readContract({
        address: this.registry,
        abi: REGISTRY_ABI,
        functionName: "ownerOf",
        args: [tokenId],
      }) as Promise<Hex>,
      this.client.readContract({
        address: this.registry,
        abi: REGISTRY_ABI,
        functionName: "ipfsCIDOf",
        args: [tokenId],
      }) as Promise<string>,
    ]);

    const addressEntries = await Promise.all(
      ADDRESS_KEYS.map(async (key) => {
        const value = (await this.client.readContract({
          address: this.registry,
          abi: REGISTRY_ABI,
          functionName: "addressRecords",
          args: [tokenId, key],
        })) as string;
        return [key, value] as const;
      })
    );

    const resolved: ResolvedDomain = {
      name,
      tokenId,
      owner,
      cid,
      addresses: Object.fromEntries(addressEntries),
    };

    if (this.resolverContract) {
      await this.crossCheck(resolved);
    }

    return resolved;
  }

  private async crossCheck(resolved: ResolvedDomain): Promise<void> {
    try {
      const [allOwner, , , allCid] = (await this.client.readContract({
        address: this.resolverContract!,
        abi: RESOLVER_ABI,
        functionName: "resolveAll",
        args: [resolved.name],
      })) as [Hex, bigint, string, string];

      const owner = allOwner.toLowerCase();
      if (owner !== resolved.owner.toLowerCase()) {
        throw new ResolverError(
          `resolver cross-check mismatch on owner for "${resolved.name}"`
        );
      }
      if (allCid !== resolved.cid) {
        throw new ResolverError(
          `resolver cross-check mismatch on CID for "${resolved.name}"`
        );
      }
    } catch (err) {
      if (err instanceof ResolverError) throw err;
      throw new ResolverError(
        `resolver contract unavailable for "${resolved.name}"`,
        err
      );
    }
  }
}