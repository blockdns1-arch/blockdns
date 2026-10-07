"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Lock, RefreshCw, ShieldCheck, Trophy } from "lucide-react";
import { formatBDNS, parseBDNS, txLink } from "@/lib/constants";
import { useStaking } from "@/hooks/useStaking";

export default function StakingPage() {
  const {
    rooted,
    isConnected,
    staked,
    unbonding,
    unbondingReadyAt,
    activeValidator,
    totalStaked,
    validatorCount,
    minValidatorStake,
    unbondingPeriod,
    bdnsBalance,
    vaultPending,
    stakeBdns,
    beginUnbonding,
    completeUnbonding,
    txHash,
    txPending,
    txSuccess,
    txErrorMessage,
    resetTx,
    refresh,
  } = useStaking();

  const [mode, setMode] = useState<"stake" | "unbond">("stake");
  const [amount, setAmount] = useState("");
  const [claiming, setClaiming] = useState(false);

  const parsed = useMemo(() => parseBDNS(amount) ?? 0n, [amount]);

  useEffect(() => {
    if (txSuccess) {
      const t = setTimeout(() => {
        resetTx();
        refresh();
        setAmount("");
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [txSuccess, resetTx, refresh]);

  const handleSubmit = useCallback(async () => {
    if (parsed === 0n) return;
    if (mode === "stake") {
      await stakeBdns(parsed);
    } else {
      await beginUnbonding(parsed);
    }
  }, [mode, parsed, stakeBdns, beginUnbonding]);

  const handleClaim = useCallback(async () => {
    setClaiming(true);
    await completeUnbonding();
    setClaiming(false);
  }, [completeUnbonding]);

  if (!isConnected) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 pt-20 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-3xl border border-white/10 bg-white/5">
          <Lock size={28} className="text-violet-400" />
        </div>
        <h1 className="text-3xl font-bold">Stake</h1>
        <p className="text-zinc-400">
          Stake BDNS as validator collateral and earn from the top-10 staking reward
          pool. Connect your wallet to start.
        </p>
      </div>
    );
  }

  if (!rooted) {
    return (
      <div className="mx-auto max-w-md pt-20 text-center text-amber-400">
        Staking is not configured yet.
      </div>
    );
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const claimable = unbonding > 0n && now >= unbondingReadyAt;
  const days = Number(unbondingPeriod) / 86400;
  const remaining = Number(unbondingReadyAt - now);
  const remainingLabel =
    unbonding > 0n && !claimable
      ? remaining > 86400
        ? `${Math.ceil(remaining / 86400)}d left`
        : `${Math.ceil(remaining / 3600)}h left`
      : null;

  const overBalance = mode === "stake" ? parsed > bdnsBalance : parsed > staked;
  const maxLabel = mode === "stake" ? formatBDNS(bdnsBalance) : formatBDNS(staked);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="flex items-center gap-3">
        <Lock size={24} className="text-violet-400" />
        <div>
          <h1 className="text-2xl font-bold">Stake BDNS</h1>
          <p className="text-sm text-zinc-400">
            {formatBDNS(totalStaked)} BDNS staked by {validatorCount.toString()} validator
            {validatorCount === 1n ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Your stake" value={`${formatBDNS(staked)} BDNS`} />
        <Stat
          label="Status"
          value={activeValidator ? "Active" : "Below minimum"}
          tone={activeValidator ? "good" : "warn"}
        />
        <Stat label="Unbonding" value={`${formatBDNS(unbonding)} BDNS`} />
        <Stat label="Wallet" value={`${formatBDNS(bdnsBalance)} BDNS`} />
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-zinc-950 p-1">
          {(["stake", "unbond"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                mode === m ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              {m === "stake" ? "Stake" : "Unstake"}
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
            onClick={() => setAmount(maxLabel)}
            className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300 hover:border-white/25"
          >
            MAX
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          {mode === "stake"
            ? `Balance: ${formatBDNS(bdnsBalance)} BDNS`
            : `Staked: ${formatBDNS(staked)} BDNS`}
        </p>

        {overBalance && (
          <p className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            {mode === "stake" ? "Amount exceeds your BDNS balance." : "Amount exceeds your stake."}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={parsed === 0n || overBalance || txPending}
          className="mt-5 w-full eth-btn bg-gradient-to-r from-[#5964ff] to-[#7c5cff] py-3.5 text-white hover:opacity-90 disabled:opacity-50"
        >
          {txPending
            ? "Confirming…"
            : mode === "stake"
              ? "Stake BDNS"
              : `Unstake ${amount || "BDNS"}`}
        </button>

        {txErrorMessage && (
          <p className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300">
            {txErrorMessage}
          </p>
        )}

        {txHash && (
          <p className="mt-3 break-all rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
            Staking transaction:{" "}
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

      {unbonding > 0n && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-zinc-400">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-zinc-200">
                {formatBDNS(unbonding)} BDNS unbonding
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {claimable
                  ? "Ready to claim."
                  : `Unlocks ${unbondingReadyAt > 0n ? new Date(Number(unbondingReadyAt) * 1000).toLocaleString() : "—"} (${remainingLabel ?? ""})`}
              </p>
            </div>
            <button
              onClick={handleClaim}
              disabled={!claimable || txPending || claiming}
              className="shrink-0 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition-colors hover:border-white/30 disabled:opacity-40"
            >
              {claiming || txPending ? "Claiming…" : "Claim"}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-zinc-400">
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-400" />
          <span className="font-semibold text-zinc-200">How staking works</span>
        </div>
        <p>
          Stake at least{" "}
          <span className="font-mono text-violet-300">{formatBDNS(minValidatorStake)} BDNS</span>{" "}
          to become an active validator. Unstaking queues for{" "}
          <span className="font-mono text-amber-300">{days > 0 ? `${days} days` : "7 days"}</span>{" "}
          so stake cannot be pulled out during a challenge window.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-zinc-400">
        <div className="mb-2 flex items-center gap-2">
          <Trophy size={16} className="text-amber-400" />
          <span className="font-semibold text-zinc-200">Top-10 staking rewards</span>
        </div>
        <p>
          A 50M BDNS emission rewards the top-10 stakers by stake, released strictly on
          the published tranche schedule. Pending release:{" "}
          <span className="font-mono text-violet-300">{formatBDNS(vaultPending)} BDNS</span>
          .
        </p>
      </div>

      <p className="text-center text-xs text-zinc-600">
        <RefreshCw size={12} className="mr-1 inline" />
        Position refreshes automatically after every transaction.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn";
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={`mt-1 font-mono text-sm ${
          tone === "good"
            ? "text-emerald-300"
            : tone === "warn"
              ? "text-amber-300"
              : "text-zinc-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
