"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Loader2,
  Search,
  Sparkles,
  XCircle,
} from "lucide-react";
import {
  useBlockDNS,
  normalizeName,
  isValidName,
  type PriceQuote,
} from "@/hooks/useBlockDNS";
import { formatBDNS } from "@/lib/constants";

export default function DomainSearch({
  initialName = "",
  onSelect,
  autoFocus = false,
}: {
  initialName?: string;
  onSelect?: (name: string) => void;
  autoFocus?: boolean;
}) {
  const { getQuote, rooted } = useBlockDNS();
  const router = useRouter();
  const [raw, setRaw] = useState(initialName);
  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [checking, setChecking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(
    async (value: string) => {
      const name = normalizeName(value);
      if (!name) {
        setQuote(null);
        return;
      }
      if (!isValidName(name)) {
        setQuote({
          name,
          price: null,
          isPremium: false,
          available: false,
          error: "invalid",
        });
        return;
      }
      setChecking(true);
      try {
        setQuote(await getQuote(name));
      } finally {
        setChecking(false);
      }
    },
    [getQuote]
  );

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const value = raw.trim();
    if (!value) {
      setQuote(null);
      return;
    }
    timer.current = setTimeout(() => void run(value), 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [raw, run]);

  const name = quote?.name ?? "";
  const free = !!quote && quote.available && !quote.isPremium;
  const premium = !!quote && quote.available && quote.isPremium;

  const goMint = () => {
    if (!name || !quote?.available) return;
    if (onSelect) onSelect(name);
    else router.push(`/mint?name=${encodeURIComponent(name)}`);
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/70 px-5 py-4 shadow-2xl shadow-violet-500/10 transition-colors focus-within:border-violet-500/60">
        <Search size={20} className="shrink-0 text-zinc-500" />
        <input
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && goMint()}
          placeholder="yourname"
          autoFocus={autoFocus}
          className="w-full bg-transparent text-lg text-white placeholder-zinc-500 outline-none"
          aria-label="Domain name"
        />
        <span className="shrink-0 rounded-lg bg-white/5 px-2 py-1 text-sm font-medium text-zinc-400">
          .bdns
        </span>
      </div>

      <AnimatePresence mode="wait">
        {checking && (
          <motion.div
            key="checking"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 flex items-center gap-2 text-sm text-zinc-400"
          >
            <Loader2 size={16} className="animate-spin" /> Checking availability…
          </motion.div>
        )}

        {!checking && quote?.error === "rpc" && (
          <EmptyState>
            Could not reach the BlockDNS L2 chain. Check network.
          </EmptyState>
        )}

        {quote?.error === "unconfigured" && (
          <EmptyState>Chain contracts not configured yet.</EmptyState>
        )}

        {quote?.error === "invalid" && (
          <EmptyState danger>
            3–63 characters: lowercase letters, digits and hyphens (not at the
            edges).
          </EmptyState>
        )}

        {!checking &&
          quote &&
          quote.error === null &&
          quote.available &&
          !quote.isPremium && (
            <motion.div
              key="free"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="text-emerald-400" size={22} />
                <div>
                  <p className="font-semibold">
                    {name}.bdns is available
                  </p>
                  <p className="flex items-center gap-1 text-emerald-400">
                    <Sparkles size={14} /> 100% FREE for lifetime · only L2 gas
                  </p>
                </div>
              </div>
              <GoButton onClick={goMint} label={`Mint ${name}.bdns`} />
            </motion.div>
          )}

        {!checking &&
          quote &&
          quote.error === null &&
          quote.available &&
          quote.isPremium && (
            <motion.div
              key="premium"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-violet-500/40 bg-violet-500/10 px-5 py-4"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="text-violet-400" size={22} />
                <div>
                  <p className="font-semibold">
                    {name}.bdns — premium 1–2/3–4 char short name
                  </p>
                  <p className="text-violet-300">
                    {formatBDNS(quote.price ?? 0n)} BDNS one-time · 50% burned ·
                    lifetime ownership
                  </p>
                </div>
              </div>
              <GoButton onClick={goMint} label="Claim it now" />
            </motion.div>
          )}

        {!checking && quote && quote.error === null && !quote.available && (
          <motion.div
            key="taken"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-rose-300"
          >
            <XCircle size={22} />
            <p>
              <span className="font-semibold">{name}.bdns</span> is already
              registered. Try another name.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {!rooted && (
        <p className="mt-3 text-xs text-amber-400/80">
          Set NEXT_PUBLIC_REGISTRY_ADDRESS / NEXT_PUBLIC_PRICER_ADDRESS to enable
          on-chain checks.
        </p>
      )}
    </div>
  );
}

function EmptyState({
  children,
  danger = false,
}: {
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`mt-4 rounded-2xl border px-5 py-4 text-sm ${
        danger
          ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
          : "border-white/10 bg-zinc-900/70 text-zinc-400"
      }`}
    >
      {children}
    </div>
  );
}

function GoButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="eth-btn bg-white px-5 py-2.5 text-sm text-zinc-950 hover:bg-zinc-100"
    >
      {label}
    </button>
  );
}