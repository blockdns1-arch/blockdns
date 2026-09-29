"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Sparkles, Wallet } from "lucide-react";
import { useBlockDNS } from "@/hooks/useBlockDNS";
import { formatBDNS } from "@/lib/constants";
import DomainCard from "@/components/DomainCard";

export default function Dashboard() {
  const {
    address,
    isConnected,
    rooted,
    domains,
    domainsLoading,
    domainsError,
    refreshDomains,
    bdnsBalance,
    txPending,
    txSuccess,
  } = useBlockDNS();

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (txSuccess) {
      const t = setTimeout(() => setRefreshKey((k) => k + 1), 1200);
      return () => clearTimeout(t);
    }
  }, [txSuccess]);

  const refresh = useCallback(() => {
    if (address) void refreshDomains(address);
  }, [address, refreshDomains]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  if (!isConnected) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 pt-20 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-3xl border border-white/10 bg-white/5">
          <Wallet size={28} className="text-violet-400" />
        </div>
        <h1 className="text-3xl font-bold">Your dashboard</h1>
        <p className="text-zinc-400">
          Connect your wallet to see the{" "}
          <span className="text-violet-400">.bdns</span> domains you own, pin IPFS
          content and manage your wallet bindings.
        </p>
        <Link
          href="/mint"
          className="eth-btn bg-white px-6 py-3 text-zinc-950 hover:bg-zinc-100"
        >
          Mint a domain
        </Link>
      </div>
    );
  }

  if (!rooted) {
    return (
      <div className="mx-auto max-w-md pt-20 text-center text-amber-400">
        Chain contracts are not configured. Set NEXT_PUBLIC_REGISTRY_ADDRESS and
        NEXT_PUBLIC_PRICER_ADDRESS to continue.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Your domains</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {domains.length} owned · lifetime
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm text-violet-300">
            <Sparkles size={15} /> {formatBDNS(bdnsBalance)} BDNS
          </span>
          <button
            onClick={refresh}
            disabled={domainsLoading}
            aria-label="Refresh"
            className="rounded-2xl border border-white/10 bg-white/5 p-2.5 text-zinc-300 transition-colors hover:border-white/25 hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={16} className={domainsLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {domainsError && (
        <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {domainsError}
        </p>
      )}

      {domainsLoading && domains.length === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }, (_, i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-3xl border border-white/10 bg-zinc-900/70"
            />
          ))}
        </div>
      )}

      {!domainsLoading && domains.length === 0 && !domainsError && (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-white/15 py-16 text-center">
          <p className="text-zinc-400">No domains yet.</p>
          <Link
            href="/mint"
            className="eth-btn bg-gradient-to-r from-[#5964ff] to-[#7c5cff] px-6 py-3 text-white hover:opacity-90"
          >
            Mint your first one — free
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {domains.map((d) => (
          <DomainCard key={d.tokenId.toString()} domain={d} />
        ))}
      </div>

      {txPending && (
        <p className="text-center text-xs text-zinc-500">Confirming transaction…</p>
      )}
    </div>
  );
}