import type { Metadata } from "next";
import { ArrowRight, Globe2, Handshake, Landmark, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import TokenEmblem from "@/components/TokenEmblem";
import { BLOCKDNS_CHAIN_ID } from "@/lib/chains";

export const metadata: Metadata = {
  title: "Foundation — BlockDNS",
  description:
    "The BlockDNS Foundation: mission, governance, treasury and grants behind the lifetime naming layer on the BlockDNS L2.",
};

const pillars = [
  {
    emoji: "🌊",
    title: "The namespace",
    body: "Keep .bdns free and censorship-resistant — registrations, IPFS resolution and multi-chain bindings that never expire.",
  },
  {
    emoji: "⚙️",
    title: "Open infrastructure",
    body: "Fund R&D, validators and public goods that keep the BlockDNS L2 fast, cheap and permissionless for everyone.",
  },
  {
    emoji: "🌍",
    title: "Ecosystem growth",
    body: "Partner with wallets, gateways and apps so every internet user can resolve and own a .bdns identity.",
  },
  {
    emoji: "🎯",
    title: "Grants program",
    body: "Direct grants to builders shipping on top of the registry — paid from the ecosystem treasury, all on-chain.",
  },
];

const split = [
  { label: "Protocol treasury", pct: 36, color: "hsl(262 83% 66%)" },
  { label: "Builders & grants", pct: 22, color: "hsl(187 92% 55%)" },
  { label: "Liquidity", pct: 18, color: "hsl(152 72% 46%)" },
  { label: "Marketing", pct: 14, color: "hsl(35 92% 56%)" },
  { label: "Audits & security", pct: 10, color: "hsl(0 72% 62%)" },
];

export default function FoundationPage() {
  return (
    <div className="flex flex-col gap-16">
      <section className="eth-hero-bg flex flex-col items-center gap-6 pt-10 text-center">
        <TokenEmblem size={92} className="drop-shadow-[0_0_28px_rgba(89,100,255,0.45)]" />
        <h1 className="font-serif text-5xl font-semibold tracking-tight md:text-6xl">
          The BlockDNS{" "}
          <span className="bg-gradient-to-r from-[#f5c76b] to-[#5964ff] bg-clip-text text-transparent">
            Foundation
          </span>
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-zinc-300">
          The Foundation stewards the protocol behind the lifetime naming layer:
          it funds builders, protects the free namespace and returns every fee to
          the ecosystem — in the open, on-chain, forever.
        </p>
      </section>

      <section className="grid w-full max-w-4xl grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { k: "Chain ID", v: String(BLOCKDNS_CHAIN_ID) },
          { k: "BDNS hard cap", v: "1B" },
          { k: "Staking reward pool", v: "50M" },
          { k: "Fee → treasury", v: "100%" },
        ].map((s) => (
          <div key={s.k} className="eth-card flex flex-col items-center gap-1 p-5 text-center">
            <span className="mono text-2xl font-bold text-white">{s.v}</span>
            <span className="text-xs uppercase tracking-widest text-zinc-500">{s.k}</span>
          </div>
        ))}
      </section>

      <section className="w-full max-w-4xl">
        <h2 className="mb-6 text-center font-serif text-3xl font-semibold tracking-tight">
          What the Foundation funds
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {pillars.map((p, i) => (
            <div key={p.title} className="eth-card eth-card-hover p-6">
              <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-xl">
                {p.emoji}
              </div>
              <h3 className="mt-4 flex items-center gap-2 font-semibold">
                {p.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="w-full max-w-4xl">
        <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
          <div>
            <h2 className="mb-4 font-serif text-3xl font-semibold tracking-tight">
              Governance & treasury
            </h2>
            <p className="text-sm leading-relaxed text-zinc-400">
              Every marketplace sale, swap and bridge fee flows through the{" "}
              <span className="mono text-xs text-zinc-300">BlockDNSSplitter</span>{" "}
              and lands on-chain — deterministic percentages re-deployed into the
              ecosystem. Nothing is held by humans; everything is verifiable at any
              block.
            </p>
            <div className="eth-card mono mt-5 space-y-2 p-5 text-xs text-zinc-500">
              <div className="flex items-center gap-2 text-zinc-300">
                <Landmark size={14} className="text-[#b6bdff]" /> Treasury
              </div>
              <p className="break-all">
                0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
              </p>
              <div className="mt-3 flex items-center gap-2 text-zinc-300">
                <ShieldCheck size={14} className="text-[#b6bdff]" /> Royalty splitter
              </div>
              <p className="break-all">
                0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
              </p>
            </div>
          </div>

          <div className="eth-card p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Where fee revenue goes
            </p>
            <div className="space-y-4">
              {split.map((r) => (
                <div key={r.label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-zinc-300">{r.label}</span>
                    <span className="mono text-white">{r.pct}%</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${r.pct}%`,
                        background: `linear-gradient(90deg, ${r.color}, ${r.color}55)`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="w-full max-w-4xl">
        <h2 className="mb-6 text-center font-serif text-3xl font-semibold tracking-tight">
          Get involved
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="eth-card eth-card-hover flex flex-col p-6">
            <Globe2 size={20} className="text-violet-300" />
            <h3 className="mt-3 font-semibold">Mint your name</h3>
            <p className="mt-1 flex-1 text-sm text-zinc-400">
              Claim a free lifetime .bdns and start building your identity on-chain.
            </p>
            <Link href="/mint" className="eth-link mt-4 flex items-center gap-1 text-sm font-semibold">
              Start here <ArrowRight size={13} />
            </Link>
          </div>
          <div className="eth-card eth-card-hover flex flex-col p-6">
            <Sparkles size={20} className="text-amber-300" />
            <h3 className="mt-3 font-semibold">Earn staking rewards</h3>
            <p className="mt-1 flex-1 text-sm text-zinc-400">
              Join the top-10 validator leaderboard and share the decaying reward pool.
            </p>
            <Link href="/dashboard" className="eth-link mt-4 flex items-center gap-1 text-sm font-semibold">
              Open dashboard <ArrowRight size={13} />
            </Link>
          </div>
          <div className="eth-card eth-card-hover flex flex-col p-6">
            <Handshake size={20} className="text-emerald-300" />
            <h3 className="mt-3 font-semibold">Apply for a grant</h3>
            <p className="mt-1 flex-1 text-sm text-zinc-400">
              Building on .bdns? Pitch the Foundation and get funded from the treasury.
            </p>
            <a href="mailto:BlockDns1@gmail.com" className="eth-link mt-4 flex items-center gap-1 text-sm font-semibold">
              BlockDns1@gmail.com <ArrowRight size={13} />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}