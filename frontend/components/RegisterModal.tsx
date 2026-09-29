"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Sparkles, Wallet, X } from "lucide-react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useBlockDNS, type PriceQuote } from "@/hooks/useBlockDNS";
import { formatBDNS, txLink } from "@/lib/constants";

type Props = {
  name: string;
  quote: PriceQuote;
  onClose: () => void;
  onSuccess: () => void;
};

export default function RegisterModal({ name, quote, onClose, onSuccess }: Props) {
  const {
    isConnected,
    approveBDNS,
    registerDomain,
    txHash,
    txPending,
    txSuccess,
    txError,
    txErrorMessage,
    resetTx,
  } = useBlockDNS();

  const [approved, setApproved] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (txSuccess) {
      const t = setTimeout(onSuccess, 1600);
      return () => clearTimeout(t);
    }
  }, [txSuccess, onSuccess]);

  async function handleApprove() {
    if (!quote.price) return;
    setApproving(true);
    try {
      await approveBDNS(quote.price);
      setApproved(true);
    } catch {
      /* the shared tx error state surfaces the failure */
    } finally {
      setApproving(false);
    }
  }

  async function handleRegister() {
    await registerDomain(name);
  }

  function handleClose() {
    resetTx();
    onClose();
  }

  const premium = quote.isPremium;
  const price = quote.price ?? 0n;

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={handleClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900 p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-500">Register</p>
            <h2 className="mt-1 text-2xl font-bold">
              {name}
              <span className="text-violet-400">.bdns</span>
            </h2>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-zinc-950/60 p-4 text-sm">
          <Row label="Availability" value={quote.available ? "Available" : "Taken"} good={!!quote.available} />
          <Row
            label="Price"
            value={premium ? `${formatBDNS(price)} BDNS · one-time` : "Free · lifetime"}
            good={!premium}
          />
          {premium && <Row label="Split" value="50% burned · 50% treasury" />}
        </div>

        {!isConnected && (
          <div className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="flex items-center gap-2 text-sm text-zinc-400">
              <Wallet size={16} /> Connect your wallet to continue
            </p>
            <ConnectButton />
          </div>
        )}

        {isConnected && (
          <div className="mt-5 space-y-3">
            {premium && !approved && !approving && (
              <button
                onClick={() => void handleApprove()}
                disabled={txPending}
                className="w-full eth-btn bg-white px-5 py-3 text-sm text-zinc-950 hover:bg-zinc-100 disabled:opacity-60"
              >
                Approve {formatBDNS(price)} BDNS
              </button>
            )}
            {premium && approving && (
              <DisabledRow>Waiting for approval…</DisabledRow>
            )}
            {premium && approved && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                <CheckCircle2 size={16} /> BDNS approved
              </div>
            )}
            {(approved || !premium) && (
              <button
                onClick={() => void handleRegister()}
                disabled={txPending}
                className={`flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60 ${
                  premium
                    ? "bg-gradient-to-r from-violet-600 to-cyan-500 text-white"
                    : "bg-emerald-500 text-zinc-950"
                }`}
              >
                {txPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Confirming on L2…
                  </>
                ) : premium ? (
                  <>
                    <Sparkles size={16} /> Mint {name}.bdns
                  </>
                ) : (
                  <>Mint {name}.bdns free</>
                )}
              </button>
            )}
          </div>
        )}

        {txHash && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 text-center text-xs"
          >
            {txLink(txHash) ? (
              <a
                href={txLink(txHash)}
                target="_blank"
                rel="noreferrer"
                className="text-violet-400 hover:text-violet-300"
              >
                View transaction ↗
              </a>
            ) : (
              <span className="font-mono text-zinc-500">{txHash.slice(0, 18)}…</span>
            )}
          </motion.p>
        )}

        {txError && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300"
          >
            {txErrorMessage}
          </motion.p>
        )}

        {txSuccess && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-emerald-400"
          >
            <CheckCircle2 size={16} /> {name}.bdns is yours — lifetime · free forever
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}

function Row({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className={good === undefined ? "text-zinc-300" : good ? "text-emerald-400" : "text-amber-400"}>
        {value}
      </span>
    </div>
  );
}

function DisabledRow({ children }: { children: React.ReactNode }) {
  return (
    <p className="w-full rounded-xl bg-white/5 px-4 py-3 text-center text-sm text-zinc-400">
      {children}
    </p>
  );
}