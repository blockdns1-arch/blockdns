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
import { config } from "@/lib/wagmi";
import { BRIDGE_ABI, BDNS_ABI } from "@/lib/abi";
import { BRIDGE_ADDRESS, BDNS_ADDRESS, isConfigured } from "@/lib/constants";
import { BLOCKDNS_CHAIN_ID } from "@/lib/chains";

function shortMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as { shortMessage?: string; message?: string; name?: string };
    return e.shortMessage ?? e.message ?? e.name ?? "Transaction failed";
  }
  return String(error);
}

export function useBridge() {
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

  const rooted = isConfigured() && BRIDGE_ADDRESS !== "0x0000000000000000000000000000000000000000";

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

  const ensureReady = useCallback(async () => {
    if (!rooted) throw new Error("Bridge contracts are not configured");
    if (!isConnected) throw new Error("Connect your wallet first");
    if (activeChainId !== BLOCKDNS_CHAIN_ID) {
      try {
        await switchChainAsync({ chainId: BLOCKDNS_CHAIN_ID });
      } catch {
        throw new Error("Switch your wallet to the BlockDNS L2 chain");
      }
    }
  }, [rooted, isConnected, activeChainId, switchChainAsync]);

  const deposit = useCallback(
    async (amount: bigint): Promise<`0x${string}`> => {
      await ensureReady();
      return withRpcNonce({
        address: BRIDGE_ADDRESS,
        abi: BRIDGE_ABI,
        functionName: "deposit",
        args: [amount],
      });
    },
    [ensureReady, withRpcNonce]
  );

  const withdraw = useCallback(
    async (amount: bigint): Promise<`0x${string}`> => {
      await ensureReady();
      return withRpcNonce({
        address: BRIDGE_ADDRESS,
        abi: BRIDGE_ABI,
        functionName: "withdraw",
        args: [amount],
      });
    },
    [ensureReady, withRpcNonce]
  );

  const approveBdnForBridge = useCallback(
    async (amount: bigint = (1n << 256n) - 1n): Promise<`0x${string}`> => {
      await ensureReady();
      return withRpcNonce({
        address: BDNS_ADDRESS,
        abi: BDNS_ABI,
        functionName: "approve",
        args: [BRIDGE_ADDRESS, amount],
      });
    },
    [ensureReady, withRpcNonce]
  );

  const bridgeFeeBdn = useReadContract({
    address: BRIDGE_ADDRESS,
    abi: BRIDGE_ABI,
    functionName: "bridgeFeeBdn",
    query: { enabled: rooted },
  });

  const bridgeFeeUsd = useReadContract({
    address: BRIDGE_ADDRESS,
    abi: BRIDGE_ABI,
    functionName: "bridgeFeeUsd",
    query: { enabled: rooted },
  });

  const ledger = useReadContract({
    address: BRIDGE_ADDRESS,
    abi: BRIDGE_ABI,
    functionName: "ledger",
    args: address ? [address] : undefined,
    query: { enabled: rooted && !!address },
  });

  const bdnAllowanceForBridge = useReadContract({
    address: BDNS_ADDRESS,
    abi: BDNS_ABI,
    functionName: "allowance",
    args: address ? ([address, BRIDGE_ADDRESS] as const) : undefined,
    query: { enabled: rooted && isConnected && !!address },
  });

  const { refetch: refetchLedger } = ledger;
  const [ledgerValue, setLedgerValue] = useState<bigint>(0n);

  useEffect(() => {
    if (ledger.data) setLedgerValue(BigInt(ledger.data as bigint));
  }, [ledger.data]);

  return {
    rooted,
    isConnected,
    address,
    bridgeFeeBdn: (bridgeFeeBdn.data as bigint) ?? 0n,
    bridgeFeeUsd: (bridgeFeeUsd.data as bigint) ?? 0n,
    ledger: ledgerValue,
    bridgeAllowance: (bdnAllowanceForBridge.data as bigint) ?? 0n,
    deposit,
    withdraw,
    approveBdnForBridge,
    refetchLedger,
    txHash,
    txPending: isPending,
    txSuccess: isSuccess,
    txError: isError,
    txErrorMessage: txError ? shortMessage(txError) : null,
    resetTx,
  };
}