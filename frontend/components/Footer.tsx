"use client";

import Link from "next/link";
import { Send, MessageCircle, Music2, Mail } from "lucide-react";
import SiteLink from "@/components/SiteLink";
import TokenEmblem from "@/components/TokenEmblem";
import { BLOCKDNS_CHAIN_ID } from "@/lib/chains";

const columns = [
  {
    title: "Protocol",
    links: [
      { href: "/mint", label: "Mint a domain" },
      { href: "/dashboard", label: "My domains" },
      { href: "/market", label: "Marketplace" },
      { href: "/swap", label: "Swap ETH ⇄ BDNS" },
      { href: "/bridge", label: "Bridge BDNS" },
    ],
  },
  {
    title: "Explore",
    links: [
      { href: "/explorer", label: "Block explorer" },
      { href: "/foundation", label: "Foundation" },
      { href: "/whitepaper", label: "Whitepaper" },
    ],
  },
];

const socials = [
  {
    href: "https://x.com/BlockDnsL2",
    label: "X / Twitter",
    icon: Music2,
    color: "hover:text-white",
  },
  {
    href: "https://t.me/BlockDnsL2",
    label: "Telegram",
    icon: Send,
    color: "hover:text-sky-400",
  },
  {
    href: "https://discord.com",
    label: "Discord",
    icon: MessageCircle,
    color: "hover:text-indigo-400",
  },
  {
    href: "mailto:BlockDns1@gmail.com",
    label: "Contact",
    icon: Mail,
    color: "hover:text-emerald-400",
  },
];

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-white/[0.06]">
      <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-10">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5 font-semibold">
              <TokenEmblem size={32} className="shrink-0" />
              <span className="tracking-tight">
                Block<span className="text-[#b6bdff]">DNS</span>
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-500">
              A lifetime naming layer on the BlockDNS L2 chain. Mint once, host on
              IPFS, bind every wallet you own — no renewals, no rent.
            </p>
          </div>

          {columns.map((col) => (
            <nav key={col.title} className="flex flex-col gap-2.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                {col.title}
              </p>
              {col.links.map((l) => (
                <SiteLink
                  key={l.href}
                  href={l.href}
                  className="w-fit text-sm text-zinc-400 transition-colors hover:text-white"
                >
                  {l.label}
                </SiteLink>
              ))}
            </nav>
          ))}

          <nav className="flex flex-col gap-2.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Community
            </p>
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                aria-label={s.label}
                className={`flex w-fit items-center gap-2 text-sm text-zinc-400 transition-colors ${s.color}`}
              >
                <s.icon size={15} />
                {s.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-6 text-xs text-zinc-600 sm:flex-row">
          <p>
            Demo on L2 · chain {BLOCKDNS_CHAIN_ID} · domains live on-chain forever
          </p>
          <a
            href="mailto:BlockDns1@gmail.com"
            className="eth-link text-xs text-zinc-400"
          >
            BlockDns1@gmail.com
          </a>
        </div>
      </div>
    </footer>
  );
}