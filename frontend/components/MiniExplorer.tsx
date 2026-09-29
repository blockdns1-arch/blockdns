"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Clock,
  Flame,
  Loader2,
  Medal,
  Shield,
  Trophy,
} from "lucide-react";
import { readContract } from "@wagmi/core";
import { config } from "@/lib/wagmi";
import {
  BURN_ENGINE_ABI,
  STAKING_VAULT_ABI,
  BDNS_STAKING_ABI,
} from "@/lib/abi";
import {
  BDNS_ADDRESS,
  BURN_ENGINE_ADDRESS,
  STAKING_VAULT_ADDRESS,
  formatBDNS,
} from "@/lib/constants";
import { shortAddress } from "@/lib/format";

type TopStaker = {
  addr: string;
  staked: bigint;
  active: boolean;
};

type Stats = {
  burnState: "idle" | "loading" | "error";
  burned: bigint | null;
  hardCap: bigint | null;
  rateBps: bigint | null;
  burnStopped: boolean | null;
  stakers: TopStaker[];
  stakersError: string | null;
  vaultPending: bigint | null;
  pendingError: string | null;
};

const TOP_N = 10;

export default function MiniExplorer() {
  const [stats, setStats] = useState<Stats>({
    burnState: "idle",
    burned: null,
    hardCap: null,
    rateBps: null,
    burnStopped: null,
    stakers: [],
    stakersError: null,
    vaultPending: null,
    pendingError: null,
  });

  const loadStakers = useCallback(async () => {
    if (!BDNS_ADDRESS) {
      setStats((s) => ({ ...s, stakersError: "BDNS not configured" }));
      return;
    }
    try {
      const count = await readContract(config, {
        address: BDNS_ADDRESS,
        abi: BDNS_STAKING_ABI,
        functionName: "validatorCount",
        args: [],
      });

      const top: TopStaker[] = [];
      const batch = count < TOP_N ? Number(count) : TOP_N;
      for (let i = 0; i < batch; i++) {
        const addr = (await readContract(config, {
          address: BDNS_ADDRESS,
          abi: BDNS_STAKING_ABI,
          functionName: "validatorRegistry",
          args: [BigInt(i)],
        })) as `0x${string}`;
        const [staked, , , active] = await readContract(config, {
          address: BDNS_ADDRESS,
          abi: BDNS_STAKING_ABI,
          functionName: "getValidator",
          args: [addr],
        });
        top.push({ addr, staked, active });
      }
      top.sort((a, b) => (b.staked > a.staked ? 1 : b.staked < a.staked ? -1 : 0));
      const trimmed = top.slice(0, TOP_N);

      const burned = await readContract(config, {
        address: BURN_ENGINE_ADDRESS,
        abi: BURN_ENGINE_ABI,
        functionName: "cumulativeBurned",
        args: [],
      });
      const hardCap = await readContract(config, {
        address: BURN_ENGINE_ADDRESS,
        abi: BURN_ENGINE_ABI,
        functionName: "HARD_CAP",
        args: [],
      });
      const rateBps = await readContract(config, {
        address: BURN_ENGINE_ADDRESS,
        abi: BURN_ENGINE_ABI,
        functionName: "burnRateBps",
        args: [],
      });
      const stopped = await readContract(config, {
        address: BURN_ENGINE_ADDRESS,
        abi: BURN_ENGINE_ABI,
        functionName: "stopped",
        args: [],
      });

      let vaultPending: bigint | null = null;
      try {
        vaultPending = await readContract(config, {
          address: STAKING_VAULT_ADDRESS,
          abi: STAKING_VAULT_ABI,
          functionName: "pendingRelease",
          args: [],
        });
      } catch {}

      setStats({
        burnState: "idle",
        burned: burned as bigint,
        hardCap: hardCap as bigint,
        rateBps: rateBps as bigint,
        burnStopped: stopped as boolean,
        stakers: trimmed,
        stakersError: null,
        vaultPending,
        pendingError: null,
      });
    } catch {
      setStats((s) => ({
        ...s,
        burnState: "error",
        stakersError: "RPC unavailable — connect or switch network",
      }));
    }
  }, []);

  useEffect(() => {
    void loadStakers();
    const id = setInterval(() => void loadStakers(), 45_000);
    return () => clearInterval(id);
  }, [loadStakers]);

  const burnPct =
    stats.burned != null && stats.hardCap != null && stats.hardCap > 0n
      ? Number((stats.burned * 10000n) / stats.hardCap) / 100
      : 0;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 shadow-lg shadow-black/30 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Activity size={16} className="text-emerald-400" />
          Network pulse — live contract state
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {stats.burnState === "loading" ? "Syncing" : "Live"}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-orange-300">
            <Flame size={15} /> Decaying burn engine
          </div>
          {stats.burned != null && stats.hardCap != null ? (
            <>
              <div className="mb-1.5 flex items-end justify-between">
                <span className="text-2xl font-bold text-zinc-100">
                  {formatBDNS(stats.burned)}
                  <span className="ml-1 text-sm font-normal text-zinc-500">BDNS burned</span>
                </span>
                <span className="text-xs text-zinc-500">/ {formatBDNS(stats.hardCap)} cap</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500 transition-all"
                  style={{ width: `${Math.min(100, Number(burnPct.toFixed(2)))}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                <span>
                  Current rate:{" "}
                  <span className="font-medium text-orange-300">
                    {stats.rateBps != null ? Number(stats.rateBps) / 100 : "—"}%
                  </span>
                </span>
                <span className="inline-flex items-center gap-1">
                  {stats.burnStopped ? (
                    <>
                      <Shield size={12} /> Stopped at cap
                    </>
                  ) : (
                    <>
                      <Clock size={12} /> 10-year decay
                    </>
                  )}
                </span>
              </div>
            </>
          ) : (
            <p className="text-xs text-zinc-500">
              {stats.burnState === "error" ? "Burn engine unreachable." : "Loading burn metrics…"}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-300">
            <Trophy size={15} /> Top {Math.min(TOP_N, stats.stakers.length || TOP_N)} stakers
          </div>
          {stats.stakersError ? (
            <p className="text-xs text-zinc-500">{stats.stakersError}</p>
          ) : stats.stakers.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 size={13} className="animate-spin" /> Waiting for validator data…
            </div>
          ) : (
            <ol className="space-y-1.5">
              {stats.stakers.map((s, i) => (
                <li key={s.addr} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        i === 0
                          ? "bg-amber-400/20 text-amber-300"
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      #{i + 1}
                    </span>
                    <span className="truncate text-zinc-300">{shortAddress(s.addr)}</span>
                    {s.active && (
                      <Medal size={12} className="shrink-0 text-emerald-400" aria-label="active validator" />
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-zinc-400">
                    {formatBDNS(s.staked)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {stats.vaultPending != null && (
        <p className="mt-3 text-xs text-zinc-500">
          Staking vault pending release:{" "}
          <span className="font-mono text-zinc-300">{formatBDNS(stats.vaultPending)} BDNS</span>
        </p>
      )}
    </div>
  );
}