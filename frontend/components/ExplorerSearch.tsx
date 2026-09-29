"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export default function ExplorerSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");

  const go = () => {
    const q = value.trim();
    if (!q) return;
    if (/^\d+$/.test(q)) router.push(`/explorer/block/${q}`);
    else if (/^0x[0-9a-fA-F]{64}$/.test(q)) router.push(`/explorer/tx/${q}`);
    else router.push(`/explorer/tx/${q}`);
  };

  return (
    <div className="flex w-full max-w-xl items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 transition-colors focus-within:border-[#5964ff]/60">
      <Search size={17} className="shrink-0 text-zinc-500" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && go()}
        placeholder="Search by block number or tx hash…"
        aria-label="Search the chain"
        className="w-full bg-transparent text-sm text-white placeholder-zinc-500 outline-none"
      />
      <button
        onClick={go}
        className="shrink-0 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-zinc-950 transition-transform hover:scale-105 active:scale-95"
      >
        Search
      </button>
    </div>
  );
}