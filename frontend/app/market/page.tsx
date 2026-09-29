"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Store, Wallet } from "lucide-react";
import { useMarketplace } from "@/hooks/useMarketplace";
import MarketListingCard from "@/components/MarketListingCard";
import SellDomain from "@/components/SellDomain";

export default function MarketPage() {
  const {
    address,
    isConnected,
    rooted,
    listings,
    listingsLoading,
    listingsError,
    refreshListings,
    txSuccess,
  } = useMarketplace();

  const [refreshKey, setRefreshKey] = useState(0);
  const [mine, setMine] = useState(false);

  useEffect(() => {
    if (txSuccess) {
      const t = setTimeout(() => setRefreshKey((k) => k + 1), 1200);
      return () => clearTimeout(t);
    }
  }, [txSuccess]);

  const refresh = useCallback(() => {
    void refreshListings();
  }, [refreshListings]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  const myListings = address
    ? listings.filter((l) => l.seller.toLowerCase() === address.toLowerCase())
    : [];

  if (!isConnected) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 pt-20 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-3xl border border-white/10 bg-white/5">
          <Store size={28} className="text-violet-400" />
        </div>
        <h1 className="text-3xl font-bold">Domain market</h1>
        <p className="text-zinc-400">
          Buy and sell <span className="text-violet-400">.bdns</span> domains with
          BDNS. Connect your wallet to browse listings.
        </p>
      </div>
    );
  }

  if (!rooted) {
    return (
      <div className="mx-auto max-w-md pt-20 text-center text-amber-400">
        The marketplace contract is not configured yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Domain market</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {listings.length} live listings · paid in BDNS · 2.5% fee
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={listingsLoading}
          aria-label="Refresh"
          className="rounded-2xl border border-white/10 bg-white/5 p-2.5 text-zinc-300 transition-colors hover:border-white/25 hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={16} className={listingsLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {listingsError && (
        <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {listingsError}
        </p>
      )}

      {listingsLoading && listings.length === 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-3xl border border-white/10 bg-zinc-900/70"
            />
          ))}
        </div>
      )}

      {!listingsLoading && listings.length === 0 && !listingsError && (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-white/15 py-16 text-center">
          <Store size={28} className="text-zinc-600" />
          <p className="text-zinc-400">No domains on sale yet.</p>
          <Link
            href="/dashboard"
            className="eth-btn bg-gradient-to-r from-[#5964ff] to-[#7c5cff] px-6 py-3 text-white hover:opacity-90"
          >
            List one from your dashboard
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {listings
          .filter((l) => l.seller.toLowerCase() !== address?.toLowerCase())
          .map((l) => (
            <MarketListingCard key={l.tokenId.toString()} listing={l} onChanged={refresh} />
          ))}
      </div>

      {myListings.length > 0 && (
        <>
          <div className="mt-6 flex items-center gap-3">
            <h2 className="text-xl font-bold">Your listings</h2>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
              {myListings.length}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myListings.map((l) => (
              <div
                key={l.tokenId.toString()}
                className="rounded-3xl border border-white/10 bg-zinc-900/80 p-5"
              >
                <p className="text-lg font-bold">
                  {l.name}
                  <span className="text-violet-400">.bdns</span>
                </p>
                <p className="font-mono text-xs text-zinc-500">#{l.tokenId.toString()}</p>
                <SellDomain
                  tokenId={l.tokenId}
                  name={l.name}
                  onChanged={refresh}
                  initialMode="manage"
                  currentPrice={l.price}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}