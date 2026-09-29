"use client";

import { Wallet } from "lucide-react";

export default function WalletBadge({
  address,
  label,
}: {
  address?: string;
  label?: string;
}) {
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return null;

  const hue = parseInt(address.slice(-4), 16) % 360;
  const initial = address.slice(2, 4).toUpperCase();

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 pl-1.5 pr-3 py-1">
      <span
        className="grid h-7 w-7 place-items-center rounded-full font-mono text-[10px] font-bold text-black/80"
        style={{
          background: `conic-gradient(from 180deg, hsl(${hue} 85% 65%), hsl(${(hue + 90) % 360} 85% 70%), hsl(${hue} 85% 65%))`,
        }}
        title={address}
      >
        {initial}
      </span>
      <span className="flex items-center gap-1 font-mono text-xs text-zinc-400">
        <Wallet size={11} className="text-zinc-500" />
        {label ? (
          <span className="text-zinc-500">{label}</span>
        ) : null}
        {shortWallet(address)}
      </span>
    </span>
  );
}

function shortWallet(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}