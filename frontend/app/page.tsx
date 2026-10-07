import { ArrowRight, Compass, ExternalLink, Flame, Globe, Landmark, Repeat, ShieldCheck } from "lucide-react";
import Link from "next/link";
import DomainSearch from "@/components/DomainSearch";
import Reveal from "@/components/Reveal";
import SiteLink from "@/components/SiteLink";
import TokenEmblem from "@/components/TokenEmblem";
import MiniExplorer from "@/components/MiniExplorer";
import SiteLanding from "@/components/SiteLanding";
import WhitepaperArticle from "@/components/WhitepaperArticle";
import { allSites, getSite, type SiteConfig } from "@/lib/sites";

const FEATURE_ICONS = {
  globe: Globe,
  compass: Compass,
  repeat: Repeat,
  landmark: Landmark,
  flame: Flame,
  shield: ShieldCheck,
} as const;

const portals = (sites: SiteConfig[]) =>
  sites
    .filter((site) => site.id !== "home")
    .map((site) => ({
      title: site.badge ?? "BlockDNS",
      desc: site.tagline,
      href: `${site.domain}${site.primary}`,
      tag: site.project,
    }));

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>;
}) {
  const { name } = await searchParams;
  const site = getSite();

  if (site.id !== "home") return <SiteLanding site={site} />;

  return (
    <div className="flex flex-col items-center gap-16">
      <section className="eth-hero-bg flex w-full flex-col items-center gap-6 pt-10 text-center">
        <Reveal>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-zinc-300">
            <span className="text-base leading-none">🔗</span> Blockchain-based DNS ·
            native on the BlockDNS L2 chain
          </p>
        </Reveal>
        <Reveal delay={0.05}>
          <TokenEmblem size={104} className="drop-shadow-[0_0_28px_rgba(89,100,255,0.5)]" />
        </Reveal>
        <Reveal delay={0.1}>
          <h1 className="max-w-3xl text-balance text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Own your corner of the internet —{" "}
            <span className="bg-gradient-to-r from-[#8b92ff] via-[#5964ff] to-[#22d3ee] bg-clip-text text-transparent">
              forever
            </span>
          </h1>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="max-w-xl text-lg leading-relaxed text-zinc-400">
            Mint a <span className="font-semibold text-white">lifetime</span>{" "}
            <span className="text-[#b6bdff]">.bdns</span> domain — free for 5+
            chars, one-time BDNS for short premium names. Point it at IPFS, bind ETH / BTC /
            SOL wallets, no renewals, no rent.
          </p>
        </Reveal>
        <Reveal delay={0.3} className="mt-2 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/mint"
            className="eth-btn bg-white px-7 py-3 text-zinc-950 hover:bg-zinc-100"
          >
            Mint yours free
          </Link>
          <SiteLink
            href="/explorer"
            className="eth-btn border border-white/15 px-7 py-3 text-zinc-200 hover:border-white/35 hover:text-white"
          >
            Explore the chain <ArrowRight size={15} />
          </SiteLink>
        </Reveal>

        <Reveal delay={0.4}>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {[
              "∞ No renewals",
              "🔥 50% of premium mints burned",
              "🏆 Top-10 staking rewards",
              "🌐 IPFS hosting included",
            ].map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400"
              >
                {chip}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="w-full max-w-2xl">
        <Reveal delay={0.2}>
          <div className="eth-card p-2">
            <DomainSearch initialName={name ?? ""} />
            <p className="px-6 pb-4 pt-2 text-center text-xs text-zinc-500">
              Available? Premium? — checked live against on-chain state.
            </p>
          </div>
        </Reveal>
      </section>

      <section className="w-full max-w-4xl">
        <Reveal delay={0.25}>
          <MiniExplorer />
        </Reveal>
      </section>

      <section className="w-full max-w-4xl">
        <div className="mb-6 flex items-center justify-center gap-3">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            The protocol on <span className="text-[#b6bdff]">four sites</span>
          </h2>
        </div>
        <p className="mx-auto -mt-4 mb-6 max-w-xl text-center text-sm text-zinc-400">
          Four independent deployments built from this one verified codebase — hop between
          them like real separate products.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {portals(allSites()).map((p) => (
            <Reveal key={p.title} delay={0.1 * 0}>
              <a
                href={p.href}
                className="eth-card eth-card-hover eth-corners flex h-full flex-col gap-3 p-6"
              >
                <div className="flex items-center justify-between">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]">
                    <Compass size={20} className="text-[#b6bdff]" />
                  </div>
                  <ExternalLink size={16} className="text-zinc-500" />
                </div>
                <div>
                  <h3 className="font-semibold">{p.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">{p.desc}</p>
                </div>
                <span className="mono mt-auto inline-flex w-fit items-center rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-emerald-300">
                  ▸ {p.tag}
                </span>
              </a>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="w-full max-w-4xl">
        <div className="mb-6 flex items-center justify-center gap-3">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            What you can do with a <span className="text-[#b6bdff]">.bdns</span>
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {site.features.map((c, i) => {
            const Icon = FEATURE_ICONS[c.icon];
            return (
            <Reveal key={c.title} delay={0.1 * i}>
              <div className="eth-card eth-card-hover eth-corners h-full p-6">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]">
                  <Icon size={20} className="text-[#b6bdff]" />
                </div>
                <h3 className="mt-4 font-semibold">{c.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">{c.body}</p>
              </div>
            </Reveal>
            );
          })}
        </div>
      </section>

      <section className="eth-card flex w-full max-w-4xl flex-col items-center gap-3 bg-gradient-to-br from-[#5964ff]/[0.12] to-transparent p-8 text-center">
        <p className="flex items-center gap-2 text-sm font-medium text-zinc-200">
          <span className="text-lg leading-none">🔥</span> Premium mints burn 50% of BDNS
        </p>
        <p className="max-w-xl text-sm leading-relaxed text-zinc-400">
          Buying a short name is a one-time payment. Half is burned forever, half
          funds the treasury — a deflationary engine for the L2 chain.
        </p>
        <Link
          href="/mint"
          className="eth-link mt-2 flex items-center gap-1 text-sm font-semibold text-[#b6bdff]"
        >
          Find a premium name <ArrowRight size={14} />
        </Link>
      </section>

      <section className="w-full max-w-4xl">
        <WhitepaperArticle />
      </section>
    </div>
  );
}