"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Compass, Globe, Landmark, Menu, Moon, Repeat, Sun, X } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import TokenEmblem from "@/components/TokenEmblem";
import { BLOCKDNS_CHAIN_ID } from "@/lib/chains";
import { allSites, getSite, type SiteId } from "@/lib/sites";

function SiteGlyph({ site, className = "" }: { site: SiteId; className?: string }) {
  const Icon =
    site === "home" ? Globe : site === "explorer" ? Compass : site === "swap" ? Repeat : Landmark;
  return <Icon size={16} className={className} />;
}

// One Next.js app, four Vercel projects. The current project is the only one whose
// links stay relative; every other site is an absolute link to its own deployment,
// so the navbar works the same locally and in production.
function useSites() {
  const current = getSite();
  const all = allSites();
  return { current, all };
}

export default function Navbar() {
  const pathname = usePathname();
  const { current, all } = useSites();
  const [origin, setOrigin] = useState("");
  const [light, setLight] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleTheme = () => {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    try {
      window.localStorage.setItem("bdns-theme", next ? "light" : "dark");
    } catch {}
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const hrefFor = (siteId: SiteId, href: string) =>
    siteId === current.id ? href : `${all.find((site) => site.id === siteId)?.domain ?? ""}${href}`;

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-zinc-950/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5 font-semibold">
          <TokenEmblem size={36} className="shrink-0" />
          <span>
            <span className="text-lg tracking-tight">
              Block<span className="text-[#b6bdff]">DNS</span>
            </span>
            {current.badge && (
              <span className="ml-2 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-zinc-300">
                {current.badge}{" "}
                <span className="mono text-zinc-500">:{current.id}</span>
              </span>
            )}
          </span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-zinc-400 lg:flex">
          {current.nav.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative transition-colors hover:text-white ${
                isActive(link.href) ? "font-medium text-white" : ""
              }`}
            >
              {link.label}
              {isActive(link.href) && (
                <span className="absolute -bottom-2 left-0 right-0 h-0.5 rounded-full bg-gradient-to-r from-[#5964ff] to-[#22d3ee]" />
              )}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <span className="mono hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-zinc-300 md:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            chain {BLOCKDNS_CHAIN_ID}
          </span>
          <button
            onClick={toggleTheme}
            aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-zinc-300 transition-colors hover:border-white/25 hover:text-white"
          >
            {light ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button
            onClick={() => setOpen((value) => !value)}
            aria-label="Toggle navigation menu"
            aria-expanded={open}
            className={`grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-zinc-300 transition-colors hover:border-white/25 hover:text-white ${
              open ? "border-white/25 text-white" : ""
            }`}
          >
            {open ? <X size={17} /> : <Menu size={17} />}
          </button>
          <ConnectButton showBalance={false} chainStatus="icon" />
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className="absolute inset-x-0 top-full z-50 mx-auto w-full max-w-6xl px-4"
            >
              <div className="eth-card overflow-hidden">
                <div className="w-full max-w-3xl rounded-2xl p-3">
                  <p className="flex items-center gap-2 px-2 py-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                    <SiteGlyph site={current.id} /> Protocol sites — four deployments, one
                    codebase
                  </p>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {all.map((site) => (
                      <SiteTile
                        key={site.id}
                        siteId={site.id}
                        title={site.badge ?? "BlockDNS"}
                        desc={site.tagline}
                        href={hrefFor(site.id, site.primary)}
                        external={site.id !== current.id}
                        active={site.id === current.id && isActive(site.primary)}
                        links={site.nav}
                        linkPrefix={site.id === current.id ? "" : site.domain}
                      />
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] px-3 py-3">
                    <p className="text-xs text-zinc-500">
                      Live on chain {BLOCKDNS_CHAIN_ID} — every contract verified on Basescan
                      and Sourcify.
                    </p>
                    <span className="mono text-[11px] text-zinc-600">{origin}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}

function SiteTile({
  siteId,
  title,
  desc,
  href,
  external,
  active,
  links,
  linkPrefix,
}: {
  siteId: SiteId;
  title: string;
  desc: string;
  href: string;
  external: boolean;
  active: boolean;
  links: { href: string; label: string }[];
  linkPrefix: string;
}) {
  return (
    <div className={`eth-card eth-card-hover eth-corners flex flex-col gap-2 p-4 ${active ? "ring-1 ring-[#5964ff]/40" : ""}`}>
      <div className="flex items-center gap-2.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04]">
          <SiteGlyph site={siteId} />
        </div>
        <span className={`text-sm font-semibold ${active ? "text-white" : "text-zinc-200"}`}>
          {title}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-zinc-400">{desc}</p>
      <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={`${linkPrefix}${link.href}`}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
              active && link.href === href
                ? "border-[#5964ff]/60 bg-[#5964ff]/10 font-medium text-white"
                : "border-white/10 bg-white/[0.04] text-zinc-300 hover:border-white/25 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        ))}
        {external && (
          <span className="mono rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-zinc-500">
            live
          </span>
        )}
      </div>
    </div>
  );
}
