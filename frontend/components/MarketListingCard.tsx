"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, ShieldCheck, Tag } from "lucide-react";
import { useMarketplace, type ListingInfo } from "@/hooks/useMarketplace";
import { formatBDNS, txLink } from "@/lib/constants";
import WalletBadge from "@/components/WalletBadge";

export default function MarketListingCard({
  listing,
  onChanged,
}: {
  listing: ListingInfo;
  onChanged: () => void;
}) {
  const {
    address,
    isConnected,
    rooted,
    buyDomain,
    approveBdnForMarket,
    bdnAllowanceForMarket,
    txPending,
    txHash,
    txError,
    txErrorMessage,
    resetTx,
  } = useMarketplace();

  const [busy, setBusy] = useState<"approve" | "buy" | null>(null);

  const isMine = address?.toLowerCase() === listing.seller.toLowerCase();
  const needApproval = bdnAllowanceForMarket < listing.price;

  async function handleApprove() {
    setBusy("approve");
    resetTx();
    try {
      await approveBdnForMarket();
      onChanged();
    } catch {
      /* error surfaced below */
    } finally {
      setBusy(null);
    }
  }

  async function handleBuy() {
    setBusy("buy");
    resetTx();
    try {
      await buyDomain(listing.tokenId, listing.price);
      onChanged();
    } catch {
      /* error surfaced below */
    } finally {
      setBusy(null);
    }
  }

  const canAct = isConnected && rooted;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col rounded-3xl border border-white/10 bg-zinc-900/80 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold">
            {listing.name}
            <span className="text-violet-400">.bdns</span>
          </p>
          <p className="font-mono text-xs text-zinc-500">
            #{listing.tokenId.toString()}
          </p>
        </div>
        <span className="flex items-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-mono text-sm font-semibold text-emerald-400">
          <Tag size={13} /> {formatBDNS(listing.price)} <span className="text-xs font-normal text-emerald-500/70">BDNS</span>
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <WalletBadge address={listing.seller} label="Seller" />
      </div>

      {isMine ? (
        <p className="mt-4 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-300">
          This is your listing.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          <button
            onClick={() => void handleBuy()}
            disabled={!canAct || busy !== null || txPending}
            className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy === "buy" || txPending ? (
              <Loader2 size={14} className="mx-auto animate-spin" />
            ) : (
              "Buy now"
            )}
          </button>
          {needApproval && canAct && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={13} /> Allow the market to spend your BDNS
              </span>
              <button
                onClick={() => void handleApprove()}
                disabled={busy !== null || txPending}
                className="rounded-lg bg-amber-500/20 px-2.5 py-1 font-semibold text-amber-200 transition-colors hover:bg-amber-500/30 disabled:opacity-40"
              >
                {busy === "approve" ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  "Approve"
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {txHash && (
        <a
          href={txLink(txHash)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 text-right text-xs text-violet-400 hover:text-violet-300"
        >
          tx ↗
        </a>
      )}
      {txError && (
        <p className="mt-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {txErrorMessage}
        </p>
      )}
    </motion.div>
  );
}