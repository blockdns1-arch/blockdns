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
import { REGISTRY_ABI, PRICER_ABI, BDNS_ABI } from "@/lib/abi";
import {
  REGISTRY_ADDRESS,
  PRICER_ADDRESS,
  BDNS_ADDRESS,
  isConfigured,
} from "@/lib/constants";
import { BLOCKDNS_CHAIN_ID } from "@/lib/chains";

export type DomainInfo = {
  tokenId: bigint;
  name: string;
  ipfsCID: string;
  owner: string;
};

export type DomainRecord = {
  cid: string;
  ETH: string;
  BTC: string;
  SOL: string;
};

export type PriceQuote = {
  name: string;
  price: bigint | null;
  isPremium: boolean;
  available: boolean;
  error: "invalid" | "unconfigured" | "rpc" | null;
};

export const NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeName(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidName(name: string): boolean {
  return NAME_PATTERN.test(name);
}

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

export function useBlockDNS() {
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

  const rooted = isConfigured();

  const ensureReady = useCallback(async () => {
    if (!rooted) throw new Error("BlockDNS contracts are not configured");
    if (!isConnected) throw new Error("Connect your wallet first");
    if (activeChainId !== BLOCKDNS_CHAIN_ID) {
      try {
        await switchChainAsync({ chainId: BLOCKDNS_CHAIN_ID });
      } catch {
        throw new Error("Switch your wallet to the BlockDNS L2 chain");
      }
    }
  }, [rooted, isConnected, activeChainId, switchChainAsync]);

  const getQuote = useCallback(
    async (raw: string): Promise<PriceQuote> => {
      const name = normalizeName(raw);
      if (!isValidName(name)) {
        return {
          name,
          price: null,
          isPremium: false,
          available: false,
          error: "invalid",
        };
      }
      if (!rooted) {
        return {
          name,
          price: null,
          isPremium: false,
          available: false,
          error: "unconfigured",
        };
      }
      try {
        const tokenId = await readContract(config, {
          address: REGISTRY_ADDRESS,
          abi: REGISTRY_ABI,
          functionName: "resolveName",
          args: [name],
        });
        const price = await readContract(config, {
          address: PRICER_ADDRESS,
          abi: PRICER_ABI,
          functionName: "priceOf",
          args: [name],
        });
        return {
          name,
          price,
          isPremium: price > 0n,
          available: tokenId === 0n,
          error: null,
        };
      } catch {
        return {
          name,
          price: null,
          isPremium: false,
          available: false,
          error: "rpc",
        };
      }
    },
    [rooted]
  );

  const registerDomain = useCallback(
    async (raw: string): Promise<`0x${string}`> => {
      await ensureReady();
      return withRpcNonce({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "registerDomain",
        args: [normalizeName(raw)],
      });
    },
    [ensureReady, withRpcNonce]
  );

  const approveBDNS = useCallback(
    async (amount: bigint): Promise<`0x${string}`> => {
      await ensureReady();
      return withRpcNonce({
        address: BDNS_ADDRESS,
        abi: BDNS_ABI,
        functionName: "approve",
        args: [PRICER_ADDRESS, amount],
      });
    },
    [ensureReady, withRpcNonce]
  );

  const setIPFSRecord = useCallback(
    async (tokenId: bigint, cid: string): Promise<`0x${string}`> => {
      await ensureReady();
      return withRpcNonce({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "setIPFSRecord",
        args: [tokenId, cid],
      });
    },
    [ensureReady, withRpcNonce]
  );

  const setAddressRecord = useCallback(
    async (
      tokenId: bigint,
      chain: string,
      addr: string
    ): Promise<`0x${string}`> => {
      await ensureReady();
      return withRpcNonce({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "setAddressRecord",
        args: [tokenId, chain, addr],
      });
    },
    [ensureReady, withRpcNonce]
  );

  const readRecord = useCallback(
    async (tokenId: bigint): Promise<DomainRecord> => {
      const empty: DomainRecord = { cid: "", ETH: "", BTC: "", SOL: "" };
      if (!rooted) return empty;
      const contracts = [
        {
          address: REGISTRY_ADDRESS,
          abi: REGISTRY_ABI,
          functionName: "ipfsCIDOf" as const,
          args: [tokenId] as const,
        },
        {
          address: REGISTRY_ADDRESS,
          abi: REGISTRY_ABI,
          functionName: "addressRecords" as const,
          args: [tokenId, "ETH"] as const,
        },
        {
          address: REGISTRY_ADDRESS,
          abi: REGISTRY_ABI,
          functionName: "addressRecords" as const,
          args: [tokenId, "BTC"] as const,
        },
        {
          address: REGISTRY_ADDRESS,
          abi: REGISTRY_ABI,
          functionName: "addressRecords" as const,
          args: [tokenId, "SOL"] as const,
        },
      ];
      const results = await readContracts(config, { contracts });
      const [cid, eth, btc, sol] = results.map((r) => {
        const v = unwrapResult(r);
        return typeof v === "string" ? v : "";
      });
      return { cid, ETH: eth, BTC: btc, SOL: sol };
    },
    [rooted]
  );

  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(false);
  const [domainsError, setDomainsError] = useState<string | null>(null);

  const refreshDomains = useCallback(
    async (owner: `0x${string}`) => {
      if (!rooted) return;
      setDomainsLoading(true);
      setDomainsError(null);
      try {
        const balance = await readContract(config, {
          address: REGISTRY_ADDRESS,
          abi: REGISTRY_ABI,
          functionName: "balanceOf",
          args: [owner],
        });
        const count = Number(balance);
        if (count === 0) {
          setDomains([]);
          return;
        }
        const idsRaw = await readContracts(config, {
          contracts: Array.from({ length: count }, (_, i) => ({
            address: REGISTRY_ADDRESS,
            abi: REGISTRY_ABI,
            functionName: "tokenOfOwnerByIndex" as const,
            args: [owner, BigInt(i)] as const,
          })),
        });
        const ids = idsRaw
          .map((r) => unwrapResult(r))
          .filter((v): v is bigint => typeof v === "bigint");

        const metaRaw = await readContracts(config, {
          contracts: ids.flatMap((id) => [
            {
              address: REGISTRY_ADDRESS,
              abi: REGISTRY_ABI,
              functionName: "nameOf" as const,
              args: [id] as const,
            },
            {
              address: REGISTRY_ADDRESS,
              abi: REGISTRY_ABI,
              functionName: "ipfsCIDOf" as const,
              args: [id] as const,
            },
            {
              address: REGISTRY_ADDRESS,
              abi: REGISTRY_ABI,
              functionName: "ownerOf" as const,
              args: [id] as const,
            },
          ]),
        });

        const items: DomainInfo[] = ids.map((id, i) => {
          const nameVal = unwrapResult(metaRaw[i * 3]);
          const cidVal = unwrapResult(metaRaw[i * 3 + 1]);
          const ownerVal = unwrapResult(metaRaw[i * 3 + 2]);
          return {
            tokenId: id,
            name:
              typeof nameVal === "string" && nameVal.length > 0
                ? nameVal
                : `#${id}`,
            ipfsCID: typeof cidVal === "string" ? cidVal : "",
            owner:
              typeof ownerVal === "string" ? ownerVal : (owner as string) ?? "",
          };
        });
        setDomains(items);
      } catch (error) {
        setDomainsError(shortMessage(error));
      } finally {
        setDomainsLoading(false);
      }
    },
    [rooted]
  );

  useEffect(() => {
    if (rooted && isConnected && address) {
      void refreshDomains(address);
    }
  }, [rooted, isConnected, address, refreshDomains]);

  const bdnsBalance = useReadContract({
    address: BDNS_ADDRESS,
    abi: BDNS_ABI,
    functionName: "balanceOf",
    args: address ? ([address] as const) : undefined,
    query: { enabled: rooted && isConnected && !!address },
  });

  const bdnsAllowance = useReadContract({
    address: BDNS_ADDRESS,
    abi: BDNS_ABI,
    functionName: "allowance",
    args: address ? ([address, PRICER_ADDRESS] as const) : undefined,
    query: { enabled: rooted && isConnected && !!address },
  });

  return {
    address,
    isConnected,
    activeChainId,
    rooted,
    getQuote,
    registerDomain,
    approveBDNS,
    setIPFSRecord,
    setAddressRecord,
    readRecord,
    refreshDomains,
    domains,
    domainsLoading,
    domainsError,
    bdnsBalance: bdnsBalance.data ?? 0n,
    bdnsAllowance: bdnsAllowance.data ?? 0n,
    txHash,
    txPending: isPending,
    txSuccess: isSuccess,
    txError: isError,
    txErrorMessage: txError ? shortMessage(txError) : null,
    resetTx,
  };
}