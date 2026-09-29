"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { AnimatePresence } from "framer-motion";
import DomainSearch from "@/components/DomainSearch";
import RegisterModal from "@/components/RegisterModal";
import { useBlockDNS, type PriceQuote } from "@/hooks/useBlockDNS";

export default function MintClient({ initialName = "" }) {
  const router = useRouter();
  const { getQuote } = useBlockDNS();

  const [selected, setSelected] = useState<string | null>(null);
  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [loading, setLoading] = useState(false);

  const openFor = useCallback(
    async (name: string) => {
      setLoading(true);
      try {
        const q = await getQuote(name);
        if (!q.available || q.error) {
          router.push(`/?name=${encodeURIComponent(name)}`);
          return;
        }
        setQuote(q);
        setSelected(name);
      } finally {
        setLoading(false);
      }
    },
    [getQuote, router]
  );

  function onDone() {
    setSelected(null);
    setQuote(null);
    router.push("/dashboard");
  }

  return (
    <div className="w-full">
      <DomainSearch initialName={initialName} onSelect={(name) => void openFor(name)} autoFocus />

      {loading && (
        <p className="mt-3 text-center text-xs text-zinc-500">Fetching on-chain quote…</p>
      )}

      <AnimatePresence>
        {selected && quote && (
          <RegisterModal
            key={selected}
            name={selected}
            quote={quote}
            onClose={() => {
              setSelected(null);
              setQuote(null);
            }}
            onSuccess={onDone}
          />
        )}
      </AnimatePresence>
    </div>
  );
}