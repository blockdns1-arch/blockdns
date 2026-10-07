// One frontend, four independent Vercel projects. Every project builds the same
// Next.js app from `frontend/` with the same settings, but a different
// NEXT_PUBLIC_SITE value, so each URL has its own branding, navigation and landing
// copy instead of four identical pages.
export type SiteId = "home" | "swap" | "explorer" | "founder";

export interface SiteNavLink {
  href: string;
  label: string;
}

export interface SiteFeature {
  icon: "repeat" | "compass" | "landmark" | "globe" | "flame" | "shield";
  title: string;
  body: string;
}

export interface SiteConfig {
  id: SiteId;
  project: string;
  domain: string;
  badge: string | null;
  tagline: string;
  description: string;
  primary: string;
  nav: SiteNavLink[];
  hero: {
    eyebrow: string;
    title: string;
    highlight: string;
    body: string;
    cta: SiteNavLink;
  };
  chips: string[];
  features: SiteFeature[];
  stats: { label: string; value: string }[];
}

const DEFAULT_DOMAINS: Record<SiteId, string> = {
  home: "https://blockdns-home.vercel.app",
  swap: "https://blockdns-swap.vercel.app",
  explorer: "https://blockdns-explorer.vercel.app",
  founder: "https://blockdns-founder.vercel.app",
};

const SITE_ENV: Record<SiteId, string> = {
  home: "NEXT_PUBLIC_SITE_HOME_URL",
  swap: "NEXT_PUBLIC_SITE_SWAP_URL",
  explorer: "NEXT_PUBLIC_SITE_EXPLORER_URL",
  founder: "NEXT_PUBLIC_SITE_FOUNDER_URL",
};

const BASE: Record<SiteId, Omit<SiteConfig, "domain">> = {
  home: {
    id: "home",
    project: "blockdns-home",
    badge: null,
    tagline: "Own your .bdns domain forever",
    description:
      "Lifetime .bdns domains on Base Sepolia. Mint free, host on IPFS, bind ETH / BTC / SOL wallets, list on the marketplace.",
    primary: "/mint",
    nav: [
      { href: "/", label: "Home" },
      { href: "/mint", label: "Mint" },
      { href: "/market", label: "Market" },
      { href: "/dashboard", label: "Dashboard" },
    ],
    hero: {
      eyebrow: "Blockchain-based DNS on Base Sepolia",
      title: "Own your corner of the internet",
      highlight: "forever",
      body: "Mint a lifetime .bdns domain free for 5+ characters, one-time BDNS for short premium names. No renewals, no rent.",
      cta: { href: "/mint", label: "Mint yours free" },
    },
    chips: ["No renewals", "50% of premium mints burned", "Top-10 staking rewards", "IPFS hosting included"],
    features: [
      {
        icon: "globe",
        title: "IPFS hosting",
        body: "Pin a file or a site and your .bdns resolves to it over any IPFS gateway, free forever.",
      },
      {
        icon: "shield",
        title: "Multi-wallet binding",
        body: "Store your ETH, BTC and SOL addresses on-chain under a single domain you own.",
      },
      {
        icon: "flame",
        title: "Lifetime ownership",
        body: "A single mint. No annual fees, no renewals, no rent. Your corner of the internet, forever.",
      },
    ],
    stats: [
      { label: "Supply", value: "1B BDNS" },
      { label: "Network", value: "Base Sepolia" },
      { label: "Owners", value: "Lifetime" },
    ],
  },
  swap: {
    id: "swap",
    project: "blockdns-swap",
    badge: "Swap & Bridge",
    tagline: "Swap ETH to BDNS, bridge BDNS across layers",
    description:
      "Swap ETH for BDNS against live on-chain liquidity, or bridge BDNS from Base Sepolia to the BlockDNS L2. Fees and rates are read from the contracts.",
    primary: "/swap",
    nav: [
      { href: "/swap", label: "Swap" },
      { href: "/bridge", label: "Bridge" },
      { href: "/staking", label: "Stake" },
    ],
    hero: {
      eyebrow: "On-chain DEX on Base Sepolia",
      title: "Swap ETH for BDNS",
      highlight: "at the on-chain rate",
      body: "Prices, fees and reserves all come from BlockDNSwap itself. Buy BDNS, then bridge it to the L2 to pay for premium names.",
      cta: { href: "/swap", label: "Open the swap" },
    },
    chips: ["0.05 USD swap fee", "Live reserves on-chain", "Bridge to BlockDNS L2", "No account needed"],
    features: [
      {
        icon: "repeat",
        title: "Fixed-rate swap",
        body: "ethPerBdn is stored on-chain and can be updated by the owner, so the quote always matches contract state.",
      },
      {
        icon: "shield",
        title: "Fees in BDNS",
        body: "Every trade charges a small BDNS fee that routes to the protocol treasury instead of an off-chain operator.",
      },
      {
        icon: "flame",
        title: "Deep test liquidity",
        body: "The swap pool is funded and a live buy, sell and bridge round trip has already been executed on testnet.",
      },
    ],
    stats: [
      { label: "Fee", value: "5 BDNS" },
      { label: "Fee collector", value: "Treasury" },
      { label: "Settlement", value: "On-chain" },
    ],
  },
  explorer: {
    id: "explorer",
    project: "blockdns-explorer",
    badge: "Explorer",
    tagline: "Blocks, transactions and registered .bdns names",
    description:
      "Browse Base Sepolia blocks, look up any transaction, and resolve a .bdns name to its owner, content hash and bound wallets straight from contract state.",
    primary: "/explorer",
    nav: [{ href: "/explorer", label: "Explorer" }],
    hero: {
      eyebrow: "Block explorer for the .bdns namespace",
      title: "Every name and transfer,",
      highlight: "verified on-chain",
      body: "Search the registry, inspect a transaction receipt, and confirm ownership without trusting any off-chain index.",
      cta: { href: "/explorer", label: "Open the explorer" },
    },
    chips: ["Live chain data", "Registry lookups", "Transaction receipts", "15 verified contracts"],
    features: [
      {
        icon: "compass",
        title: "Block and tx browsing",
        body: "Paginate recent blocks and open any transaction to see the decoded events the contracts emitted.",
      },
      {
        icon: "globe",
        title: "Name resolution",
        body: "Resolve a .bdns name to owner, IPFS record and every bound multi-chain wallet address.",
      },
      {
        icon: "shield",
        title: "Verified source",
        body: "All 15 contracts are verified on Basescan and Sourcify, so every byte you inspect matches the published source.",
      },
    ],
    stats: [
      { label: "Contracts", value: "15 verified" },
      { label: "Explorer", value: "Basescan" },
      { label: "Data", value: "On demand" },
    ],
  },
  founder: {
    id: "founder",
    project: "blockdns-founder",
    badge: "Foundation",
    tagline: "Tokenomics, treasury and grants",
    description:
      "How BlockDNS distributes its 1B supply, where every fee goes, how staking rewards the top providers, and what the foundation funds next.",
    primary: "/foundation",
    nav: [
      { href: "/foundation", label: "Foundation" },
      { href: "/whitepaper", label: "Whitepaper" },
    ],
    hero: {
      eyebrow: "Foundation & tokenomics",
      title: "A fixed 1B supply with",
      highlight: "on-chain vesting",
      body: "Team, marketing, staking and ecosystem allocations live in vesting vaults the protocol cannot quietly move, and 50% of every premium mint is burned.",
      cta: { href: "/foundation", label: "Read the foundation" },
    },
    chips: ["1B hard cap", "50% premium burn", "Vesting vaults", "Public treasury"],
    features: [
      {
        icon: "landmark",
        title: "Public allocation",
        body: "Ecosystem, launch liquidity, team, marketing and staking allocations are enforced by vesting contracts on-chain.",
      },
      {
        icon: "flame",
        title: "Deflation by default",
        body: "Half of every premium name payment is burned and the burn engine decays over ten years, capped at 500M BDNS.",
      },
      {
        icon: "shield",
        title: "Staking rewards",
        body: "A 50M BDNS emission rewards the top providers by score, released strictly on the published tranche schedule.",
      },
    ],
    stats: [
      { label: "Cap", value: "1B BDNS" },
      { label: "Burned", value: "50% of premium" },
      { label: "Staking", value: "50M BDNS" },
    ],
  },
};

export const SITE_IDS: SiteId[] = ["home", "swap", "explorer", "founder"];

export function siteUrl(id: SiteId): string {
  const raw = process.env[SITE_ENV[id]] || DEFAULT_DOMAINS[id];
  return raw.replace(/\/$/, "");
}

export function allSites(): SiteConfig[] {
  return SITE_IDS.map((id) => ({ ...BASE[id], domain: siteUrl(id) }));
}

export function getSite(): SiteConfig {
  const raw = (process.env.NEXT_PUBLIC_SITE || "home").toLowerCase();
  const id = (SITE_IDS as string[]).includes(raw) ? (raw as SiteId) : "home";
  return { ...BASE[id], domain: siteUrl(id) };
}
