import Link from "next/link";
import { ArrowRight, Compass, Flame, Globe, Landmark, Repeat, ShieldCheck } from "lucide-react";
import Reveal from "@/components/Reveal";
import TokenEmblem from "@/components/TokenEmblem";
import { allSites, type SiteConfig } from "@/lib/sites";

const FEATURE_ICONS = {
  globe: Globe,
  compass: Compass,
  repeat: Repeat,
  landmark: Landmark,
  flame: Flame,
  shield: ShieldCheck,
} as const;

// Landing page for the three sub-sites (swap, explorer, founder). Each Vercel project
// sets its own NEXT_PUBLIC_SITE, so this renders different copy, navigation targets,
// features and sibling links on every deployment instead of four identical pages.
export default function SiteLanding({ site }: { site: SiteConfig }) {
  const siblings = allSites().filter((entry) => entry.id !== site.id);

  return (
    <div className="flex flex-col items-center gap-16">
      <section className="eth-hero-bg flex w-full flex-col items-center gap-6 pt-10 text-center">
        <Reveal>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-zinc-300">
            {site.hero.eyebrow}
          </p>
        </Reveal>
        <Reveal delay={0.05}>
          <TokenEmblem size={104} className="drop-shadow-[0_0_28px_rgba(89,100,255,0.5)]" />
        </Reveal>
        <Reveal delay={0.1}>
          <h1 className="max-w-3xl text-balance text-4xl font-bold leading-[1.08] tracking-tight md:text-5xl">
            {site.hero.title}{" "}
            <span className="bg-gradient-to-r from-[#8b92ff] via-[#5964ff] to-[#22d3ee] bg-clip-text text-transparent">
              {site.hero.highlight}
            </span>
          </h1>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="max-w-2xl text-lg leading-relaxed text-zinc-400">{site.hero.body}</p>
        </Reveal>
        <Reveal delay={0.3} className="flex flex-wrap items-center justify-center gap-4">
          <Link href={site.hero.cta.href} className="eth-btn bg-white px-7 py-3 text-zinc-950 hover:bg-zinc-100">
            {site.hero.cta.label} <ArrowRight size={15} />
          </Link>
          <Link
            href={site.nav.find((link) => link.href !== site.hero.cta.href)?.href ?? site.primary}
            className="eth-btn border border-white/15 px-7 py-3 text-zinc-200 hover:border-white/35 hover:text-white"
          >
            {site.nav.length > 1 ? site.nav.find((link) => link.href !== site.hero.cta.href)?.label : "Back to home"}
          </Link>
        </Reveal>

        <Reveal delay={0.4}>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {site.chips.map((chip) => (
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

      <section className="grid w-full max-w-3xl gap-4 sm:grid-cols-3">
        {site.stats.map((stat, index) => (
          <Reveal key={stat.label} delay={0.1 * index}>
            <div className="eth-card h-full p-5 text-center">
              <p className="mono text-xs uppercase tracking-widest text-zinc-500">{stat.label}</p>
              <p className="mt-2 text-lg font-semibold text-white">{stat.value}</p>
            </div>
          </Reveal>
        ))}
      </section>

      <section className="w-full max-w-4xl">
        <div className="mb-6 flex items-center justify-center gap-3">
          <h2 className="text-center text-2xl font-bold tracking-tight">What this site does</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {site.features.map((feature, index) => {
            const Icon = FEATURE_ICONS[feature.icon];
            return (
              <Reveal key={feature.title} delay={0.1 * index}>
                <div className="eth-card eth-card-hover eth-corners h-full p-6">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]">
                    <Icon size={20} className="text-[#b6bdff]" />
                  </div>
                  <h3 className="mt-4 font-semibold">{feature.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">{feature.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="w-full max-w-4xl">
        <div className="mb-6 flex items-center justify-center gap-3">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            The rest of the <span className="text-[#b6bdff]">protocol</span>
          </h2>
        </div>
        <p className="mx-auto -mt-4 mb-6 max-w-xl text-center text-sm text-zinc-400">
          Four independent deployments from one verified codebase — every contract verified
          on Basescan and Sourcify.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {siblings.map((sibling, index) => (
            <Reveal key={sibling.id} delay={0.1 * index}>
              <a
                href={`${sibling.domain}${sibling.primary}`}
                className="eth-card eth-card-hover eth-corners flex h-full flex-col gap-3 p-6"
              >
                <div className="flex items-center justify-between">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]">
                    <Globe size={20} className="text-[#b6bdff]" />
                  </div>
                  <ArrowRight size={16} className="text-zinc-500" />
                </div>
                <div>
                  <h3 className="font-semibold">{sibling.badge ?? "BlockDNS"}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">{sibling.tagline}</p>
                </div>
                <span className="mono mt-auto inline-flex w-fit items-center rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-emerald-300">
                  {sibling.project}
                </span>
              </a>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
