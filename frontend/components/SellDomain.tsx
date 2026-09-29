"use client";

import { useState } from "react";
import { Loader2, Store, XCircle } from "lucide-react";
import { useMarketplace } from "@/hooks/useMarketplace";
import {
  formatBDNS,
  parseBDNS,
  txLink,
} from "@/lib/constants";

export default function SellDomain({
  tokenId,
  name,
  onChanged,
  initialMode = "closed",
  currentPrice = 0n,
}: {
  tokenId: bigint;
  name: string;
  onChanged: () => void;
  initialMode?: "closed" | "sell" | "manage";
  currentPrice?: bigint;
}) {
  const {
    listDomain,
    updateListing,
    delistDomain,
    marketApprovedForAll,
    txPending,
    txHash,
    txSuccess,
    txError,
    txErrorMessage,
    resetTx,
  } = useMarketplace();

  const [mode, setMode] = useState<"closed" | "sell" | "manage" | "delisted">(initialMode);
  const [raw, setRaw] = useState(initialMode === "manage" ? formatBDNS(currentPrice) : "");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    resetTx();
    try {
      await action();
      setBusy(false);
      window.setTimeout(() => onChanged(), 1200);
    } catch {
      setBusy(false);
    }
  }

  async function handleList() {
    const price = parseBDNS(raw);
    if (price === null || price <= 0n) return;
    await run(async () => {
      await listDomain(tokenId, price);
      setMode("delisted");
    });
  }

  const price = parseBDNS(raw);

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
      {mode === "closed" && (
        <button
          onClick={() => setMode("sell")}
          className="flex items-center gap-2 text-sm font-semibold text-violet-400 transition-colors hover:text-violet-300"
        >
          <Store size={15} /> Sell on market
        </button>
      )}

      {mode === "sell" && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-400">
            List <span className="text-violet-400">{name}.bdns</span> for sale.
            One step, paid in BDNS by the buyer.
          </p>
          <div className="flex items-center gap-2">
            <input
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && price !== null && price > 0n && !busy && void handleList()}
              placeholder="0"
              inputMode="decimal"
              className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200 outline-none transition-colors focus:border-violet-500/60"
            />
            <span className="shrink-0 text-xs text-zinc-500">BDNS</span>
          </div>
          {marketApprovedForAll && (
            <p className="text-xs text-emerald-400">
              Market is authorized to move your domains ✓
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleList()}
              disabled={price === null || price <= 0n || busy || txPending}
              className="flex-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy || txPending ? (
                <Loader2 size={13} className="mx-auto animate-spin" />
              ) : (
                "List for sale"
              )}
            </button>
            <button
              onClick={() => setMode("closed")}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "delisted" && (
        <p className="text-xs text-emerald-400">
          {txSuccess
            ? "Listed ✓ — the domain moved to the marketplace escrow."
            : "Listing…"}
        </p>
      )}

      {mode === "manage" && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-400">
            Your listing of <span className="text-violet-400">{name}.bdns</span>.
          </p>
          <div className="flex items-center gap-2">
            <input
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={formatBDNS(currentPrice)}
              inputMode="decimal"
              className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200 outline-none transition-colors focus:border-violet-500/60"
            />
            <button
              onClick={() =>
                price !== null &&
                price > 0n &&
                !busy &&
                void run(async () => {
                  await updateListing(tokenId, price);
                })
              }
              disabled={price === null || price <= 0n || busy || txPending}
              className="shrink-0 rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10 disabled:opacity-40"
            >
              Update
            </button>
            <button
              onClick={() =>
                !busy &&
                void run(async () => {
                  await delistDomain(tokenId);
                  setMode("closed");
                })
              }
              disabled={busy || txPending}
              className="shrink-0 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-40"
            >
              Delist
            </button>
          </div>
        </div>
      )}

      {txHash && (
        <a
          href={txLink(txHash)}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block text-right text-xs text-violet-400 hover:text-violet-300"
        >
          tx ↗
        </a>
      )}
      {txError && (
        <p className="mt-2 flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          <XCircle size={12} /> {txErrorMessage}
        </p>
      )}
    </div>
  );
}