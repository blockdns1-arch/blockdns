"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, Moon, Sun, X } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import TokenEmblem from "@/components/TokenEmblem";
import { BLOCKDNS_CHAIN_ID } from "@/lib/chains";

const ORIGIN_3000 = "https://blockdns-home.vercel.app";
const ORIGIN_3001 = "https://blockdns-explorer.vercel.app";
const ORIGIN_3002 = "https://blockdns-founder.vercel.app";
const ORIGIN_3003 = "https://blockdns-swap.vercel.app";

const primary = [
  { href: "/", label: "Home" },
  { href: "/mint", label: "Mint" },
  { href: "/market", label: "Market" },
  { href: "/dashboard", label: "Dashboard" },
];

const sites = [
  {
    id: "domains",
    icon: "🏠",
    title: "Your domains",
    desc: "Mint, market & dashboard",
    origin: ORIGIN_3000,
    primary: "/mint",
    links: [
      { href: "/", label: "Home" },
      { href: "/mint", label: "Mint" },
      { href: "/market", label: "Market" },
      { href: "/dashboard", label: "Dashboard" },
    ],
  },
  {
    id: "explorer",
    icon: "🔍",
    title: "Layer 2 explorer",
    desc: "Blocks & transactions",
    origin: ORIGIN_3001,
    primary: "/explorer",
    links: [{ href: "/explorer", label: "Explorer" }],
  },
  {
    id: "foundation",
    icon: "🏛️",
    title: "Foundation",
    desc: "Governance, treasury & grants",
    origin: ORIGIN_3002,
    primary: "/foundation",
    links: [{ href: "/foundation", label: "Foundation" }],
  },
  {
    id: "swap",
    icon: "🔄",
    title: "Swap & bridge",
    desc: "ETH ⇄ BDNS · cross-layer BDNS",
    origin: ORIGIN_3003,
    primary: "/swap",
    links: [
      { href: "/swap", label: "Swap" },
      { href: "/bridge", label: "Bridge" },
    ],
  },
];

function detectSite(pathname: string): string {
  if (pathname.startsWith("/explorer")) return "explorer";
  if (pathname.startsWith("/foundation")) return "foundation";
  if (pathname.startsWith("/swap") || pathname.startsWith("/bridge"))
    return "swap";
  return "main";
}

export default function Navbar() {
  const pathname = usePathname();
  const site = detectSite(pathname);
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

  const homeHref = site === "main" ? "/" : ORIGIN_3000;

  const siteLinks: { href: string; label: string }[] =
    site === "swap"
      ? [
          { href: "/swap", label: "Swap" },
          { href: "/bridge", label: "Bridge" },
        ]
      : site === "explorer"
        ? [{ href: "/explorer", label: "Explorer" }]
        : site === "foundation"
          ? [{ href: "/foundation", label: "The Foundation" }]
          : primary;

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-zinc-950/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href={homeHref} className="flex items-center gap-2.5 font-semibold">
          <TokenEmblem size={36} className="shrink-0" />
          <span>
            <span className="text-lg tracking-tight">
              Block<span className="text-[#b6bdff]">DNS</span>
            </span>
            {site !== "main" && (
              <span className="ml-2 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-zinc-300">
                {site === "explorer"
                  ? "Explorer"
                  : site === "foundation"
                    ? "Foundation"
                    : "Swap & Bridge"}{" "}
                <span className="mono text-zinc-500">
                  :{site === "explorer" ? 3001 : site === "foundation" ? 3002 : 3003}
                </span>
              </span>
            )}
          </span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-zinc-400 lg:flex">
          {siteLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`relative transition-colors hover:text-white ${
                isActive(l.href) ? "font-medium text-white" : ""
              }`}
            >
              {l.label}
              {isActive(l.href) && (
                <span className="absolute -bottom-2 left-0 right-0 h-0.5 rounded-full bg-gradient-to-r from-[#5964ff] to-[#22d3ee]" />
              )}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <span className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-zinc-300 md:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
L2 · chain {BLOCKDNS_CHAIN_ID}
          </span>
          <button
            onClick={toggleTheme}
            aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-zinc-300 transition-colors hover:border-white/25 hover:text-white"
          >
            {light ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
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
                    <span className="text-sm leading-none">📦</span> Protocol sites ·
                    each on its own BlockDNS portal
                  </p>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {sites.map((s) => (
                      <SiteTile
                        key={s.id}
                        icon={s.icon}
                        title={s.title}
                        desc={s.desc}
                        origin={s.origin}
                        primary={s.primary}
                        links={s.links}
                        currentOrigin={origin}
                        pathname={pathname}
                        className={
                          s.id === "domains" && site === "main" ? "lg:hidden" : ""
                        }
                      />
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] px-3 py-3">
                    {site !== "main" && (
                      <Link
                        href={ORIGIN_3000}
                        className="text-xs text-zinc-400 transition-colors hover:text-white"
                      >
                        ← Back to BlockDNS Home
                      </Link>
                    )}
                    <p className="text-xs text-zinc-500">
                      Live on L2 · chain {BLOCKDNS_CHAIN_ID} · every contract on-chain at
                      any block, forever.
                    </p>
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
  icon,
  title,
  desc,
  origin,
  primary,
  links,
  currentOrigin,
  pathname,
  className = "",
}: {
  icon: string;
  title: string;
  desc: string;
  origin: string;
  primary: string;
  links: { href: string; label: string }[];
  currentOrigin: string;
  pathname: string;
  className?: string;
}) {
  const sameOrigin =
    currentOrigin === origin ||
    (!currentOrigin && !origin.startsWith("https://blockdns-"));
  const active = (href: string) =>
    sameOrigin && (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const href = (route: string) => `${origin}${route}`;
  const tileActive = active(primary);

  return (
    <div
      className={`eth-card eth-card-hover eth-corners flex flex-col gap-2 p-4 ${className} ${
        tileActive ? "ring-1 ring-[#5964ff]/40" : ""
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-base">
          {icon}
        </div>
        <span
          className={`mt-0 text-sm font-semibold transition-colors ${
            tileActive ? "text-white" : "text-zinc-200"
          }`}
        >
          {title}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-zinc-400">{desc}</p>
      <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
        {links.map((l) => (
          <Link
            key={l.href}
            href={href(l.href)}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
              active(l.href)
                ? "border-[#5964ff]/60 bg-[#5964ff]/10 font-medium text-white"
                : "border-white/10 bg-white/[0.04] text-zinc-300 hover:border-white/25 hover:text-white"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
