"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownUp, Coins, RefreshCw, ShieldCheck } from "lucide-react";
import { formatEther, parseEther } from "viem";
import { useAccount, useBalance } from "wagmi";
import { useSwap } from "@/hooks/useSwap";
import { BDNS_ADDRESS, formatBDNS, txLink } from "@/lib/constants";

export default function SwapPage() {
  const {
    rooted,
    isConnected,
    swapFeeBdn,
    swapFeeUsd,
    txHash,
    txPending,
    txSuccess,
    txErrorMessage,
    resetTx,
    swapEthToBdns,
    swapBdnsToEth,
    ensureBdnApprovalForSwap,
    swapAllowance,
  } = useSwap();
  const { address } = useAccount();
  const { data: ethBalanceData, refetch: refetchEth } = useBalance({
    address,
  });
  const { data: bdnsBalanceData, refetch: refetchBdn } = useBalance({
    address,
    token: BDNS_ADDRESS,
  });
  const ethBalance = ethBalanceData?.value ?? 0n;
  const bdnsBalance = bdnsBalanceData?.value ?? 0n;

  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [approving, setApproving] = useState(false);

  const parsed = useMemo(() => {
    if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(amount.trim())) return 0n;
    try {
      return parseEther(amount.trim());
    } catch {
      return 0n;
    }
  }, [amount]);

  const needsApproval = direction === "sell" && swapAllowance < parsed;

  useEffect(() => {
    if (txSuccess) {
      const t = setTimeout(() => {
        resetTx();
        void refetchEth();
        void refetchBdn();
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [txSuccess, resetTx, refetchEth, refetchBdn]);

  const handleSubmit = useCallback(async () => {
    if (parsed === 0n) return;
    if (direction === "buy") {
      await swapEthToBdns(parsed);
    } else {
      if (needsApproval) {
        setApproving(true);
        await ensureBdnApprovalForSwap();
        setApproving(false);
      }
      await swapBdnsToEth(parsed);
    }
  }, [direction, parsed, swapEthToBdns, swapBdnsToEth, needsApproval, ensureBdnApprovalForSwap]);

  if (!isConnected) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 pt-20 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-3xl border border-white/10 bg-white/5">
          <Coins size={28} className="text-violet-400" />
        </div>
        <h1 className="text-3xl font-bold">Swap</h1>
        <p className="text-zinc-400">
          Swap ETH and BDNS instantly. Connect your wallet to start.
        </p>
      </div>
    );
  }

  if (!rooted) {
    return (
      <div className="mx-auto max-w-md pt-20 text-center text-amber-400">
        The swap contract is not configured yet.
      </div>
    );
  }

  const feeBdnLabel = formatBDNS(swapFeeBdn);
  const feeUsdLabel = Number(swapFeeUsd) / 1e6;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="flex items-center gap-3">
        <ArrowDownUp size={24} className="text-violet-400" />
        <div>
          <h1 className="text-2xl font-bold">Swap</h1>
          <p className="text-sm text-zinc-400">
            Fee to the treasury:{" "}
            <span className="text-violet-300">
              {feeBdnLabel} BDNS (≈ ${feeUsdLabel})
            </span>
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-zinc-950 p-1">
          {(["buy", "sell"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                direction === d
                  ? "bg-violet-600 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {d === "buy" ? "Buy BDNS" : "Sell BDNS"}
            </button>
          ))}
        </div>

        <label className="block text-xs text-zinc-500">Amount</label>
        <div className="mt-1.5 flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            inputMode="decimal"
            className="w-full bg-transparent font-mono text-xl outline-none"
          />
          <button
            onClick={() =>
              setAmount(
                direction === "buy"
                  ? formatEther(ethBalance)
                  : formatBDNS(bdnsBalance)
              )
            }
            className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300 hover:border-white/25"
          >
            MAX
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          {direction === "buy"
            ? `Balance: ${formatEther(ethBalance)} ETH`
            : `Balance: ${formatBDNS(bdnsBalance)} BDNS`}
        </p>

        {direction === "sell" && needsApproval && (
          <p className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            One-time approval needed before selling BDNS.
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={parsed === 0n || txPending || approving}
          className="mt-5 w-full eth-btn bg-gradient-to-r from-[#5964ff] to-[#7c5cff] py-3.5 text-white hover:opacity-90 disabled:opacity-50"
        >
          {approving
            ? "Approving…"
            : txPending
              ? "Confirming…"
              : needsApproval
                ? "Approve & swap"
                : direction === "buy"
                  ? "Swap ETH → BDNS"
                  : "Swap BDNS → ETH"}
        </button>

        {txErrorMessage && (
          <p className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300">
            {txErrorMessage}
          </p>
        )}

        {txHash && (
          <p className="mt-3 break-all rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
            Swap submitted:{" "}
            {txLink(txHash) ? (
              <a href={txLink(txHash)} target="_blank" rel="noreferrer" className="underline">
                {txHash}
              </a>
            ) : (
              txHash
            )}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-zinc-400">
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-400" />
          <span className="font-semibold text-zinc-200">Always a fee for the treasury</span>
        </div>
        <p>
          Every swap charges a flat fee of{" "}
          <span className="font-mono text-violet-300">{feeBdnLabel} BDNS</span> (≈ $
          {feeUsdLabel}) that goes straight to the BlockDNS treasury. Rate: 1 BDNS ≈{" "}
          <span className="font-mono text-amber-300">0.0005 ETH</span>.
        </p>
      </div>

      <p className="text-center text-xs text-zinc-600">
        <RefreshCw size={12} className="mr-1 inline" />
        Balances refresh automatically after each swap.
      </p>
    </div>
  );
}