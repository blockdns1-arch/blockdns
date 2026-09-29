"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { readContract, readContracts } from "@wagmi/core";
import { config } from "@/lib/wagmi";
import { REGISTRY_ABI, MARKET_ABI, BDNS_ABI } from "@/lib/abi";
import {
  REGISTRY_ADDRESS,
  MARKET_ADDRESS,
  BDNS_ADDRESS,
  isConfigured,
  isMarketConfigured,
} from "@/lib/constants";
import { BLOCKDNS_CHAIN_ID } from "@/lib/chains";

export type ListingInfo = {
  tokenId: bigint;
  name: string;
  seller: `0x${string}`;
  price: bigint;
  active: boolean;
};

export const MAX_BDNS = (1n << 256n) - 1n;

function shortMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as {
      shortMessage?: string;
      message?: string;
      name?: string;
    };
    return e.shortMessage ?? e.message ?? e.name ?? "Transaction failed";
  }
  return String(error);
}

function unwrapResult(value: unknown): unknown {
  if (value && typeof value === "object" && "result" in value) {
    return (value as { result: unknown }).result;
  }
  return value;
}

export function useMarketplace() {
  const { address, isConnected } = useAccount();
  const activeChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const {
    writeContractAsync,
    data: txHash,
    isPending,
    isSuccess,
    isError,
    error: txError,
    reset: resetTx,
  } = useWriteContract();

  const withRpcNonce = useCallback(
    async (args: Parameters<typeof writeContractAsync>[0]) => {
      if (publicClient && address) {
        const nonce = await publicClient.getTransactionCount({
          address,
          blockTag: "pending",
        });
        return writeContractAsync({ ...args, nonce });
      }
      return writeContractAsync(args);
    },
    [publicClient, address, writeContractAsync]
  );

  const rooted = isConfigured() && isMarketConfigured();

  const ensureReady = useCallback(async () => {
    if (!rooted) throw new Error("Marketplace contracts are not configured");
    if (!isConnected) throw new Error("Connect your wallet first");
    if (activeChainId !== BLOCKDNS_CHAIN_ID) {
      try {
        await switchChainAsync({ chainId: BLOCKDNS_CHAIN_ID });
      } catch {
        throw new Error("Switch your wallet to the BlockDNS L2 chain");
      }
    }
  }, [rooted, isConnected, activeChainId, switchChainAsync]);

  const approveRegistryForMarket = useCallback(async (): Promise<void> => {
    await ensureReady();
    const approved = (await readContract(config, {
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: "isApprovedForAll",
      args: [address!, MARKET_ADDRESS],
    })) as boolean;
    if (!approved) {
      await withRpcNonce({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "setApprovalForAll",
        args: [MARKET_ADDRESS, true],
      });
    }
  }, [rooted, address, ensureReady, withRpcNonce]);

  const listDomain = useCallback(
    async (tokenId: bigint, price: bigint): Promise<`0x${string}`> => {
      await approveRegistryForMarket();
      return withRpcNonce({
        address: MARKET_ADDRESS,
        abi: MARKET_ABI,
        functionName: "list",
        args: [tokenId, price],
      });
    },
    [approveRegistryForMarket, withRpcNonce]
  );

  const updateListing = useCallback(
    async (tokenId: bigint, price: bigint): Promise<`0x${string}`> => {
      await ensureReady();
      return withRpcNonce({
        address: MARKET_ADDRESS,
        abi: MARKET_ABI,
        functionName: "updatePrice",
        args: [tokenId, price],
      });
    },
    [ensureReady, withRpcNonce]
  );

  const delistDomain = useCallback(
    async (tokenId: bigint): Promise<`0x${string}`> => {
      await ensureReady();
      return withRpcNonce({
        address: MARKET_ADDRESS,
        abi: MARKET_ABI,
        functionName: "delist",
        args: [tokenId],
      });
    },
    [ensureReady, withRpcNonce]
  );

  const approveBdnForMarket = useCallback(
    async (amount: bigint = MAX_BDNS): Promise<`0x${string}`> => {
      await ensureReady();
      return withRpcNonce({
        address: BDNS_ADDRESS,
        abi: BDNS_ABI,
        functionName: "approve",
        args: [MARKET_ADDRESS, amount],
      });
    },
    [ensureReady, withRpcNonce]
  );

  const buyDomain = useCallback(
    async (tokenId: bigint, price: bigint): Promise<`0x${string}`> => {
      await ensureReady();
      const allowance = (await readContract(config, {
        address: BDNS_ADDRESS,
        abi: BDNS_ABI,
        functionName: "allowance",
        args: [address!, MARKET_ADDRESS],
      })) as bigint;
      if (allowance < price) {
        await withRpcNonce({
          address: BDNS_ADDRESS,
          abi: BDNS_ABI,
          functionName: "approve",
          args: [MARKET_ADDRESS, price],
        });
      }
      return withRpcNonce({
        address: MARKET_ADDRESS,
        abi: MARKET_ABI,
        functionName: "buy",
        args: [tokenId],
      });
    },
    [ensureReady, address, withRpcNonce]
  );

  const [listings, setListings] = useState<ListingInfo[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsError, setListingsError] = useState<string | null>(null);

  const fetchListings = useCallback(async (): Promise<ListingInfo[]> => {
    if (!rooted) return [];
    const countRaw = await readContract(config, {
      address: MARKET_ADDRESS,
      abi: MARKET_ABI,
      functionName: "listingCount",
    });
    const count = Number(countRaw ?? 0n);
    if (count === 0) return [];

    const idsRaw = await readContracts(config, {
      contracts: Array.from({ length: count }, (_, i) => ({
        address: MARKET_ADDRESS,
        abi: MARKET_ABI,
        functionName: "listingIds" as const,
        args: [BigInt(i)] as const,
      })),
    });
    const ids = idsRaw
      .map((r) => unwrapResult(r))
      .filter((v): v is bigint => typeof v === "bigint");

    const listingsRaw = await readContracts(config, {
      contracts: ids.map((id) => ({
        address: MARKET_ADDRESS,
        abi: MARKET_ABI,
        functionName: "getListing" as const,
        args: [id] as const,
      })),
    });
    const namesRaw = await readContracts(config, {
      contracts: ids.map((id) => ({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "nameOf" as const,
        args: [id] as const,
      })),
    });

    return ids.map((id, i) => {
      const tuple = unwrapResult(listingsRaw[i]);
      const arr = Array.isArray(tuple) ? tuple : [];
      const nameVal = unwrapResult(namesRaw[i]);
      return {
        tokenId: id,
        name: typeof nameVal === "string" && nameVal.length > 0 ? nameVal : `#${id}`,
        seller: (arr[1] as `0x${string}`) ?? "0x",
        price: (arr[2] as bigint) ?? 0n,
        active: (arr[3] as boolean) ?? false,
      };
    });
  }, [rooted]);

  const refreshListings = useCallback(async () => {
    if (!rooted) return;
    setListingsLoading(true);
    setListingsError(null);
    try {
      setListings(await fetchListings());
    } catch (error) {
      setListingsError(shortMessage(error));
    } finally {
      setListingsLoading(false);
    }
  }, [rooted, fetchListings]);

  useEffect(() => {
    if (rooted) void refreshListings();
  }, [rooted, refreshListings]);

  const bdnAllowanceForMarket = useReadContract({
    address: BDNS_ADDRESS,
    abi: BDNS_ABI,
    functionName: "allowance",
    args: address ? ([address, MARKET_ADDRESS] as const) : undefined,
    query: { enabled: rooted && isConnected && !!address },
  });

  const marketApprovedForAll = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "isApprovedForAll",
    args: address ? ([address, MARKET_ADDRESS] as const) : undefined,
    query: { enabled: rooted && isConnected && !!address },
  });

  return {
    rooted,
    address,
    isConnected,
    listings,
    listingsLoading,
    listingsError,
    refreshListings,
    fetchListings,
    listDomain,
    updateListing,
    delistDomain,
    approveBdnForMarket,
    buyDomain,
    approveRegistryForMarket,
    bdnAllowanceForMarket: bdnAllowanceForMarket.data ?? 0n,
    marketApprovedForAll: marketApprovedForAll.data ?? false,
    txHash,
    txPending: isPending,
    txSuccess: isSuccess,
    txError: isError,
    txErrorMessage: txError ? shortMessage(txError) : null,
    resetTx,
  };
}