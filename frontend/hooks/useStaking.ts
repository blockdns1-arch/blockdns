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
import { config } from "@/lib/wagmi";
import { BDNS_ABI, BDNS_STAKING_ABI, STAKING_VAULT_ABI } from "@/lib/abi";
import { BDNS_ADDRESS, STAKING_VAULT_ADDRESS, isConfigured } from "@/lib/constants";
import { BLOCKDNS_CHAIN_ID } from "@/lib/chains";

function shortMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as { shortMessage?: string; message?: string; name?: string };
    return e.shortMessage ?? e.message ?? e.name ?? "Transaction failed";
  }
  return String(error);
}

const ZERO = "0x0000000000000000000000000000000000000000";

// Validator staking lives on the BDNS token itself: stake() escrows BDNS in the
// contract, beginUnbonding() queues a withdrawal and completeUnbonding() releases
// it once the unbonding period has passed. No allowance is needed - stake() moves
// the caller's tokens with an internal transfer, not transferFrom.
export function useStaking() {
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

  const rooted = isConfigured() && BDNS_ADDRESS !== ZERO;

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
    if (!rooted) throw new Error("Staking is not configured yet");
    if (!isConnected) throw new Error("Connect your wallet first");
    if (activeChainId !== BLOCKDNS_CHAIN_ID) {
      try {
        await switchChainAsync({ chainId: BLOCKDNS_CHAIN_ID });
      } catch {
        throw new Error("Switch your wallet to the BlockDNS L2 chain");
      }
    }
  }, [rooted, isConnected, activeChainId, switchChainAsync]);

  const stakeBdns = useCallback(
    async (amount: bigint): Promise<`0x${string}`> => {
      await ensureReady();
      return withRpcNonce({
        address: BDNS_ADDRESS,
        abi: BDNS_STAKING_ABI,
        functionName: "stake",
        args: [amount],
      });
    },
    [ensureReady, withRpcNonce]
  );

  const beginUnbonding = useCallback(
    async (amount: bigint): Promise<`0x${string}`> => {
      await ensureReady();
      return withRpcNonce({
        address: BDNS_ADDRESS,
        abi: BDNS_STAKING_ABI,
        functionName: "beginUnbonding",
        args: [amount],
      });
    },
    [ensureReady, withRpcNonce]
  );

  const completeUnbonding = useCallback(async (): Promise<`0x${string}`> => {
    await ensureReady();
    return withRpcNonce({
      address: BDNS_ADDRESS,
      abi: BDNS_STAKING_ABI,
      functionName: "completeUnbonding",
    });
  }, [ensureReady, withRpcNonce]);

  const validator = useReadContract({
    address: BDNS_ADDRESS,
    abi: BDNS_STAKING_ABI,
    functionName: "getValidator",
    args: address ? ([address] as const) : undefined,
    query: { enabled: rooted && isConnected && !!address },
  });

  const totalStaked = useReadContract({
    address: BDNS_ADDRESS,
    abi: BDNS_STAKING_ABI,
    functionName: "totalStaked",
    query: { enabled: rooted },
  });

  const validatorCount = useReadContract({
    address: BDNS_ADDRESS,
    abi: BDNS_STAKING_ABI,
    functionName: "validatorCount",
    query: { enabled: rooted },
  });

  const minValidatorStake = useReadContract({
    address: BDNS_ADDRESS,
    abi: BDNS_STAKING_ABI,
    functionName: "minValidatorStake",
    query: { enabled: rooted },
  });

  const unbondingPeriod = useReadContract({
    address: BDNS_ADDRESS,
    abi: BDNS_STAKING_ABI,
    functionName: "unbondingPeriod",
    query: { enabled: rooted },
  });

  const bdnsBalance = useReadContract({
    address: BDNS_ADDRESS,
    abi: BDNS_ABI,
    functionName: "balanceOf",
    args: address ? ([address] as const) : undefined,
    query: { enabled: rooted && isConnected && !!address },
  });

  const vaultPending = useReadContract({
    address: STAKING_VAULT_ADDRESS,
    abi: STAKING_VAULT_ABI,
    functionName: "pendingRelease",
    query: { enabled: STAKING_VAULT_ADDRESS !== ZERO },
  });

  const tuple = validator.data as
    | readonly [bigint, bigint, bigint | number, boolean]
    | undefined;

  const refresh = useCallback(() => {
    void validator.refetch();
    void totalStaked.refetch();
    void validatorCount.refetch();
    void bdnsBalance.refetch();
  }, [validator, totalStaked, validatorCount, bdnsBalance]);

  return {
    rooted,
    isConnected,
    address,
    staked: tuple ? tuple[0] : 0n,
    unbonding: tuple ? tuple[1] : 0n,
    unbondingReadyAt: tuple ? BigInt(tuple[2]) : 0n,
    activeValidator: tuple ? tuple[3] : false,
    totalStaked: (totalStaked.data as bigint) ?? 0n,
    validatorCount: (validatorCount.data as bigint) ?? 0n,
    minValidatorStake: (minValidatorStake.data as bigint) ?? 0n,
    unbondingPeriod: (unbondingPeriod.data as bigint | number) ?? 0,
    bdnsBalance: (bdnsBalance.data as bigint) ?? 0n,
    vaultPending: (vaultPending.data as bigint) ?? 0n,
    stakeBdns,
    beginUnbonding,
    completeUnbonding,
    txHash,
    txPending: isPending,
    txSuccess: isSuccess,
    txError: isError,
    txErrorMessage: txError ? shortMessage(txError) : null,
    resetTx,
    refresh,
  };
}
