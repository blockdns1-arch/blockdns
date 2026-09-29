import {
  BookOpen,
  Coins,
  Flame,
  Globe2,
  Handshake,
  KeyRound,
  Landmark,
  Layers,
  Map,
  Percent,
  PieChart,
  ShieldCheck,
  Sparkles,
  Store,
  Ticket,
  Waves,
} from "lucide-react";
import { Layer2FlowDiagram, NetworkMapDiagram } from "@/components/ProtocolDiagrams";
import { BLOCKDNS_CHAIN_ID } from "@/lib/chains";

const toc = [
  { id: "abstract", label: "Abstract" },
  { id: "problem", label: "The problem" },
  { id: "solution", label: "BlockDNS L2" },
  { id: "domains", label: ".bdns domains" },
  { id: "token", label: "BDNS token" },
  { id: "distribution", label: "Distribution" },
  { id: "mechanism", label: "Mechanics" },
  { id: "economy", label: "Token economy" },
  { id: "architecture", label: "Architecture" },
  { id: "staking-reward", label: "Staking reward" },
  { id: "marketplace", label: "Marketplace" },
  { id: "security", label: "Security" },
  { id: "roadmap", label: "Roadmap" },
];

export default function WhitepaperArticle() {
  return (
    <div id="whitepaper" className="scroll-mt-28">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]">
          <BookOpen size={22} className="text-[#b6bdff]" />
        </span>
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          The <span className="text-[#b6bdff]">Whitepaper</span>
        </h2>
        <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
          A lifetime, on-chain naming system. <span className="text-[#b6bdff]">.bdns</span>{" "}
          domains, IPFS hosting, multi-wallet identity and a token economy that
          funds the chain — native on the BlockDNS L2.
        </p>
      </div>

      <nav className="mb-6 flex flex-wrap items-center justify-center gap-2">
        {toc.map((t) => (
          <a
            key={t.id}
            href={`#${t.id}`}
            className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-white/25 hover:text-white"
          >
            {t.label}
          </a>
        ))}
      </nav>

      <article className="flex flex-col gap-4">
        <Section id="abstract" num={1} icon={<Waves size={16} />} title="Abstract">
          <p>
            Internet navigation today rents you a name. Renewal fees, registrars,
            censorship and opaque pricing — ownership is never real. BlockDNS
            replaces DNS with an on-chain registry: a{" "}
            <span className="font-semibold text-white">.bdns</span> domain is an
            ERC-721 NFT minted once, held forever, and resolvable to IPFS content
            plus wallet bindings for ETH, BTC and SOL.
          </p>
          <p>
            Registration is a single, on-chain action paid in BDNS — the protocol
            token. Common names (5+ characters) mint for free; short premium names
            are priced dynamically, burning 50% of the payment and routing 50% to
            the treasury. No subscriptions, no renewals, no rent.
          </p>
        </Section>

        <Section id="problem" num={2} icon={<KeyRound size={16} />} title="The problem: you don't own your name">
          <ul className="list-none space-y-2">
            <li>
              <b>Rent, not ownership.</b> Every traditional domain expires. Miss a
              renewal and your identity, email and brand can be hijacked.
            </li>
            <li>
              <b>Centralized control.</b> Registries, governments or quirks of a
              single corporation can seize or censor a name at any layer.
            </li>
            <li>
              <b>One name, many islands.</b> Your website, crypto addresses and
              social handles live in disconnected silos — proving ownership of a
              brand is manual and fragile.
            </li>
          </ul>
        </Section>

        <Section id="solution" num={3} icon={<Layers size={16} />} title="Solution: BlockDNS L2">
          <p>
            BlockDNS runs as a fast, low-cost L2 chain (chain ID{" "}
            <code>{BLOCKDNS_CHAIN_ID}</code>). Every domain, record and payment lives on-chain —
            auditable forever and owned by a single wallet.
          </p>
          <p>
            The stack keeps the familiar mental model of DNS while replacing the
            authority: a <b>registry</b> contract mints and owns domains, a{" "}
            <b>pricer</b> sets dynamic fees, the <b>BDNS</b> contract is the store
            of value, and a <b>marketplace</b> lets holders trade names in a
            trustless escrow.
          </p>
        </Section>

        <Section id="domains" num={4} icon={<Globe2 size={16} />} title="How .bdns domains work">
          <ul className="list-none space-y-2">
            <li>
              A domain is an <b>ERC-721 NFT</b>. Minting burns the chosen name into
              the registry forever — no two wallets can own the same name.
            </li>
            <li>
              The mint of a 5+ character name is <b>free</b>. Premium short names
              pay a one-time, on-chain dynamic price in BDNS.
            </li>
            <li>
              Owners attach an <b>IPFS CID</b>: keccak name resolution serves
              content over any IPFS gateway — truly decentralized hosting,
              pinning-free to read.
            </li>
            <li>
              Owners bind <b>wallet records</b> (ETH, BTC, SOL and any chain) to a
              single domain, turning it into a portable, battle-tested digital
              identity.
            </li>
            <li>
              Ownership is liquid: a domain can be <b>sold on the marketplace</b>{" "}
              or transferred through standard ERC-721 primitives.
            </li>
          </ul>
        </Section>

        <Section id="token" num={5} icon={<Coins size={16} />} title="The BDNS token">
          <ul className="list-none space-y-2">
            <li>
              <b>Supply:</b> hard cap of 1,000,000,000 (1B) <code>BDNS</code>, an
              ERC-20 on the BlockDNS L2.
            </li>
            <li>
              <b>Utility:</b> payment for premium registrations and marketplace
              purchases; the accounting unit of the whole protocol.
            </li>
            <li>
              <b>Distribution:</b> genesis issuance, protocol treasury and a
              community staking reward for the top-10 stakers — all on-chain and
              auditable from day one.
            </li>
          </ul>
        </Section>

        <Section id="distribution" num={6} icon={<PieChart size={16} />} title="Token distribution">
          <p>
            1,000,000,000 <code>BDNS</code> is the absolute maximum supply. The
            allocation below is on-chain from genesis — no hidden mints, every
            wallet divisible and verifiable at any block.
          </p>

          <div className="eth-card overflow-x-auto p-0">
            <table className="eth-table min-w-[560px]">
              <thead>
                <tr>
                  <th>Allocation</th>
                  <th>Share</th>
                  <th>BDNS (of 1B)</th>
                  <th>Unlock schedule</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                <AllocRow
                  name="Ecosystem & Treasury"
                  pct={60}
                  amount="600,000,000"
                  schedule="1% at TGE, then 99% linear over 60 months"
                  color="hsl(262 83% 66%)"
                />
                <AllocRow
                  name="Launch & Liquidity"
                  pct={15}
                  amount="150,000,000"
                  schedule="100% locked at TGE (DEX/CEX LPs)"
                  color="hsl(152 72% 46%)"
                />
                <AllocRow
                  name="Team & Advisors"
                  pct={10}
                  amount="100,000,000"
                  schedule="6-month cliff, 24-month vesting"
                  color="hsl(35 92% 56%)"
                />
                <AllocRow
                  name="Marketing & Partnerships"
                  pct={5}
                  amount="50,000,000"
                  schedule="Linear over 60 months (~833,333/month)"
                  color="hsl(0 72% 62%)"
                />
                <AllocRow
                  name="Community Staking Leaderboard"
                  pct={5}
                  amount="50,000,000"
                  schedule="Decaying release over 48 months, top 10"
                  color="hsl(187 92% 55%)"
                />
                <AllocRow
                  name="Chain Reserve"
                  pct={5}
                  amount="50,000,000"
                  schedule="Managed by Protocol Treasury"
                  color="hsl(220 80% 62%)"
                />
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Card>
              <div className="flex items-center gap-1.5 text-emerald-300">
                <Percent size={15} /> 60% ecosystem & treasury
              </div>
              <p>
                The largest share. 1% unlocked at TGE, the remaining 99% vests
                linearly over 5 years for integrations, operations and chain
                growth.
              </p>
            </Card>
            <Card>
              <div className="flex items-center gap-1.5 text-cyan-300">
                <Ticket size={15} /> 15% launch & liquidity
              </div>
              <p>
                100% locked at TGE and committed to DEX/CEX liquidity pairs — a deep
                pool for safe, slippage-free trading.
              </p>
            </Card>
            <Card>
              <div className="flex items-center gap-1.5 text-amber-300">
                <KeyRound size={15} /> 10% team
              </div>
              <p>
                A 6-month cliff plus 24 months of linear vesting keeps builders
                aligned with the protocol for years, not days.
              </p>
            </Card>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Card>
              <div className="flex items-center gap-1.5 text-violet-300">
                <Percent size={15} /> 5% community staking
              </div>
              <p>
                A decaying (halving) release over 48 months for the Top 10 stakers
                on the leaderboard.
              </p>
            </Card>
            <Card>
              <div className="flex items-center gap-1.5 text-sky-300">
                <Percent size={15} /> 5% marketing
              </div>
              <p>
                Linear monthly vesting over 5 years — ~833,333 BDNS per month to
                fuel partnerships and campaigns.
              </p>
            </Card>
            <Card>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Percent size={15} /> 5% chain reserve
              </div>
              <p>
                Managed by the protocol treasury for future network upgrades and
                validator incentives.
              </p>
            </Card>
          </div>
        </Section>

        <Section id="mechanism" num={7} icon={<Layers size={16} />} title="How the token flows — mechanics">
          <p>
            BDNS moves in full-circle, transparent loops. Every flow is a smart
            contract transfer — no off-chain ledger, no discretion.
          </p>
          <div className="space-y-3">
            <Card>
              <div className="text-emerald-300">1 · Free registration (5+ chars)</div>
              <p>
                Mint costs <b>0 BDNS</b>. Creates a namespace asset at no cost —
                the grassroots flywheel of the protocol.
              </p>
            </Card>
            <Card>
              <div className="text-amber-300">2 · Premium registration (short names)</div>
              <p>
                A one-time on-chain price paid in BDNS: <b>50% is burned</b>{" "}
                (deflation) and <b>50% flows to the treasury</b>.
              </p>
            </Card>
            <Card>
              <div className="text-violet-300">3 · Marketplace resale</div>
              <p>
                When a domain sells, the buyer pays the listed price in BDNS; a
                <b> 2.5% fee</b> is routed to the treasury and the seller receives
                the rest instantly.
              </p>
            </Card>
            <Card>
              <div className="text-cyan-300">4 · Staking top-10 reward</div>
              <p>
                The top-10 stakers share the decaying leaderboard reward;
                <b> unclaimed rewards roll back to the ecosystem treasury</b>.
              </p>
            </Card>
            <Card>
              <div className="text-zinc-300">5 · Treasury re-deployment</div>
              <p>
                Accumulated BDNS returns to the ecosystem as liquidity, grants and
                chain incentives — completing the loop.
              </p>
            </Card>
          </div>

          <div className="eth-card mono p-4 text-xs leading-relaxed text-zinc-500">
            mint(free) → supply static
            <br />
            mint(premium) → burn 50% + treasury 50%
            <br />
            sale → buyer(-100%) → seller(+net 97.5%) + treasury(+2.5%)
            <br />
            staking top-10 → reward wallet · unclaimed → ecosystem
            <br />
            <span className="text-zinc-400">
              total minted on-chain now ≈ 605,138,750 BDNS · remaining ≈
              394,861,250 BDNS
            </span>
          </div>
        </Section>

        <Section id="economy" num={8} icon={<Landmark size={16} />} title="Token economy">
          <div className="space-y-3">
            <Card>
              <div className="flex items-center gap-1.5 text-amber-300">
                <Flame size={15} /> Premium mints burn 50%
              </div>
              <p>
                A short-name payment is split: half is burned (deflationary pressure
                on BDNS), half flows to the treasury that funds liquidity and chain
                operations.
              </p>
            </Card>
            <Card>
              <div className="flex items-center gap-1.5 text-emerald-300">
                <Sparkles size={15} /> Free tier, forever
              </div>
              <p>
                5+ character domains cost nothing today and nothing tomorrow — a
                generous on-ramp that seeds the namespace with activity.
              </p>
            </Card>
            <Card>
              <div className="flex items-center gap-1.5 text-violet-300">
                <Store size={15} /> Marketplace fee
              </div>
              <p>
                Resales pay a 2.5% fee, instantly split to the treasury. Secondary
                liquidity feeds the same engine as primary issuance.
              </p>
            </Card>
          </div>
        </Section>

        <Section id="architecture" num={9} icon={<Layers size={16} />} title="Protocol architecture">
          <p>
            The protocol lives on the <b>BlockDNS L2</b>. Lookups and registrations
            resolve in the registry layer, while settlement value sunsets to a
            Layer 1 bridge — one chain-wide namespace, settled on-chain.
          </p>
          <div className="mt-3 space-y-4">
            <Layer2FlowDiagram />
            <p className="-mb-1 mt-3 text-xs uppercase tracking-wider text-cyan-500/70">
              Diagram 1 - Layer 2 Flow
            </p>
            <NetworkMapDiagram />
            <p className="-mb-1 text-xs uppercase tracking-wider text-cyan-500/70">
              Diagram 2 - Global network map
            </p>
          </div>
        </Section>

        <Section id="staking-reward" num={10} icon={<Ticket size={16} />} title="Community staking reward">
          <p>
            The community allocation (<b>5% · 50M BDNS</b>, "Community Staking
            Leaderboard") rewards the top-10 stakers on the BlockDNS L2 through a
            decaying release across 48 months. The reward model:
          </p>
          <ul className="list-none space-y-2">
            <li>
              <b>Staking-first:</b> rewards are earned by the top-10 stakers by
              weight — allocation follows participation, never a silent claim
              window.
            </li>
            <li>
              <b>Decaying schedule:</b> the leaderboard share releases on a halving
              curve over 48 months, keeping incentives aligned long-term.
            </li>
            <li>
              <b>Unclaimed rewards roll back</b> into the community staking pool —
              nothing is ever silently minted again; everything is reused on-chain.
            </li>
          </ul>
          <p className="mt-3">
            The live L2 demo ships the same leaderboard mechanism for hands-on
            testing; mainnet uses the identical contract layout.
          </p>
        </Section>

        <Section id="marketplace" num={11} icon={<Handshake size={16} />} title="The marketplace">
          <p>
            The <b>BlockDNSMarketplace</b> escrows domains on-chain: a seller lists
            a token for a price in BDNS, the NFT moves into the contract, and any
            buyer pays directly — the fee splits to the seller and the treasury, and
            the domain transfers instantly. No intermediaries, no off-chain trust,
            no settlement risk.
          </p>
          <p>
            Swap and bridge round out the economy: anyone can{" "}
            <b>swap ETH ⇄ BDNS</b> against on-chain liquidity ($0.05 flat fee to the
            treasury) or <b>bridge BDNS</b> across layers ($0.10 flat fee).
          </p>
        </Section>

        <Section id="security" num={12} icon={<ShieldCheck size={16} />} title="Security & ownership">
          <ul className="list-none space-y-2">
            <li>
              Domains are standard, battle-tested <b>ERC-721</b> tokens — owners
              keep custody in their own wallet.
            </li>
            <li>
              The marketplace, staking vaults and royalty splitter use audited
              OpenZeppelin patterns: reentrancy guards, safe transfers and
              non-custodial escrow.
            </li>
            <li>
              Everything — price, burn, treasury, sales — is public ledger data.
              Governance-free, deterministic and permissionless to verify.
            </li>
            <li>
              This live build is an <b>open protocol demo</b> on a local L2; mainnet
              parameters mirror the same design.
            </li>
          </ul>
        </Section>

        <Section id="roadmap" num={13} icon={<Map size={16} />} title="Roadmap">
          <ul className="list-none space-y-2">
            <li><b>Phase 1 — Naming core.</b> Registry + pricer + BDNS + public dashboard. <em>Live in this demo.</em></li>
            <li><b>Phase 2 — Content.</b> IPFS pinning and gateway resolution for every domain. <em>Live in this demo.</em></li>
            <li><b>Phase 3 — Liquidity.</b> On-chain marketplace for domain resales. <em>Live in this demo.</em></li>
            <li><b>Phase 4 — Identity.</b> Verified web3 handle — multi-chain records, ENS-style resolution DIDs.</li>
            <li><b>Phase 5 — Scale.</b> Mainnet deployment, bridge integration and multilingual UI.</li>
          </ul>
        </Section>

        <p className="eth-card p-5 text-center text-xs leading-relaxed text-zinc-500">
          This whitepaper describes the protocol as implemented in the running demo.
          Nothing in here is investment advice; token values accrue solely from
          protocol utility. Decentralize responsibly.
        </p>
      </article>
    </div>
  );
}

function Section({
  id,
  num,
  icon,
  title,
  children,
}: {
  id: string;
  num: number;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 border-b border-white/[0.06] pb-8">
      <h2 className="mb-4 flex items-baseline gap-2.5">
        <span className="mono text-base font-semibold text-[#b6bdff]">{num}</span>
        <span className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          {icon} <span className="text-[#b6bdff]">{title}</span>
        </span>
      </h2>
      <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-zinc-400">
        {children}
      </div>
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="eth-card p-4 text-sm text-zinc-400">{children}</div>;
}

function AllocRow({
  name,
  pct,
  amount,
  schedule,
  color,
}: {
  name: string;
  pct: number;
  amount: string;
  schedule: string;
  color: string;
}) {
  return (
    <tr>
      <td>
        <div className="flex items-center gap-3">
          <div className="h-3 w-px rounded" style={{ background: color }} />
          <span className="font-medium text-zinc-200">{name}</span>
        </div>
        <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${color}, ${color}66)`,
            }}
          />
        </div>
      </td>
      <td className="mono whitespace-nowrap text-zinc-100">{pct}%</td>
      <td className="mono whitespace-nowrap text-zinc-400">{amount}</td>
      <td className="text-xs text-zinc-500">{schedule}</td>
    </tr>
  );
}