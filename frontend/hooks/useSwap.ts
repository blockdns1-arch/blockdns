"use client";

import { useCallback } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { readContract } from "@wagmi/core";
import { config } from "@/lib/wagmi";
import { SWAP_ABI, BDNS_ABI } from "@/lib/abi";
import { SWAP_ADDRESS, BDNS_ADDRESS, isConfigured } from "@/lib/constants";
import { BLOCKDNS_CHAIN_ID } from "@/lib/chains";

function shortMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as { shortMessage?: string; message?: string; name?: string };
    return e.shortMessage ?? e.message ?? e.name ?? "Transaction failed";
  }
  return String(error);
}

export function useSwap() {
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

  const rooted = isConfigured() && SWAP_ADDRESS !== "0x0000000000000000000000000000000000000000";

  type WriteArgs = Parameters<typeof writeContractAsync>[0];

  const withRpcNonce = useCallback(
    async (args: Omit<WriteArgs, "value"> & { value?: bigint }) => {
      if (publicClient && address) {
        const nonce = await publicClient.getTransactionCount({
          address,
          blockTag: "pending",
        });
        return writeContractAsync({ ...args, nonce } as WriteArgs);
      }
      return writeContractAsync(args as WriteArgs);
    },
    [publicClient, address, writeContractAsync]
  );

  const ensureReady = useCallback(async () => {
    if (!rooted) throw new Error("Swap contracts are not configured");
    if (!isConnected) throw new Error("Connect your wallet first");
    if (activeChainId !== BLOCKDNS_CHAIN_ID) {
      try {
        await switchChainAsync({ chainId: BLOCKDNS_CHAIN_ID });
      } catch {
        throw new Error("Switch your wallet to the BlockDNS L2 chain");
      }
    }
  }, [rooted, isConnected, activeChainId, switchChainAsync]);

  const swapEthToBdns = useCallback(
    async (value: bigint): Promise<`0x${string}`> => {
      await ensureReady();
      return withRpcNonce({
        address: SWAP_ADDRESS,
        abi: SWAP_ABI,
        functionName: "swapEthToBdns",
        value,
      });
    },
    [ensureReady, withRpcNonce]
  );

  const swapBdnsToEth = useCallback(
    async (amount: bigint): Promise<`0x${string}`> => {
      await ensureReady();
      return withRpcNonce({
        address: SWAP_ADDRESS,
        abi: SWAP_ABI,
        functionName: "swapBdnsToEth",
        args: [amount],
      });
    },
    [ensureReady, withRpcNonce]
  );

  const approveBdnForSwap = useCallback(
    async (amount: bigint = (1n << 256n) - 1n): Promise<`0x${string}`> => {
      await ensureReady();
      return withRpcNonce({
        address: BDNS_ADDRESS,
        abi: BDNS_ABI,
        functionName: "approve",
        args: [SWAP_ADDRESS, amount],
      });
    },
    [ensureReady, withRpcNonce]
  );

  const ensureBdnApprovalForSwap = useCallback(async (): Promise<void> => {
    await ensureReady();
    const allowance = (await readContract(config, {
      address: BDNS_ADDRESS,
      abi: BDNS_ABI,
      functionName: "allowance",
      args: [address!, SWAP_ADDRESS],
    })) as bigint;
    if (allowance === 0n) {
      await approveBdnForSwap();
    }
  }, [ensureReady, address, approveBdnForSwap]);

  const swapFeeBdn = useReadContract({
    address: SWAP_ADDRESS,
    abi: SWAP_ABI,
    functionName: "swapFeeBdn",
    query: { enabled: rooted },
  });

  const swapFeeUsd = useReadContract({
    address: SWAP_ADDRESS,
    abi: SWAP_ABI,
    functionName: "swapFeeUsd",
    query: { enabled: rooted },
  });

  const bdnsUsdPrice = useReadContract({
    address: SWAP_ADDRESS,
    abi: SWAP_ABI,
    functionName: "bdnsUsdPrice",
    query: { enabled: rooted },
  });

  const bdnAllowanceForSwap = useReadContract({
    address: BDNS_ADDRESS,
    abi: BDNS_ABI,
    functionName: "allowance",
    args: address ? ([address, SWAP_ADDRESS] as const) : undefined,
    query: { enabled: rooted && isConnected && !!address },
  });

  return {
    rooted,
    isConnected,
    address,
    swapFeeBdn: (swapFeeBdn.data as bigint) ?? 0n,
    swapFeeUsd: (swapFeeUsd.data as bigint) ?? 0n,
    bdnsUsdPrice: (bdnsUsdPrice.data as bigint) ?? 0n,
    swapAllowance: (bdnAllowanceForSwap.data as bigint) ?? 0n,
    swapEthToBdns,
    swapBdnsToEth,
    approveBdnForSwap,
    ensureBdnApprovalForSwap,
    txHash,
    txPending: isPending,
    txSuccess: isSuccess,
    txError: isError,
    txErrorMessage: txError ? shortMessage(txError) : null,
    resetTx,
  };
}