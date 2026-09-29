# BlockDNS Whitepaper

> A lifetime, on-chain naming system. **.bdns** domains, IPFS hosting,
> multi-wallet identity and a token economy that funds the chain — native on the
> BlockDNS L2.
>
> Protocol demo running live on the local BlockDNS L2 (chain `8461`).

## Table of contents

1. [Abstract](#abstract)
2. [The problem](#the-problem-you-dont-own-your-name)
3. [Solution: BlockDNS L2](#solution-blockdns-l2)
4. [How .bdns domains work](#how-bdns-domains-work)
5. [The BDNS token](#the-bdns-token)
6. [Token distribution](#token-distribution)
7. [How the token flows — mechanics](#how-the-token-flows--mechanics)
8. [Token economy](#token-economy)
9. [Community staking reward](#community-staking-reward)
10. [The marketplace](#the-marketplace)
11. [Security & ownership](#security--ownership)
12. [Roadmap](#roadmap)

---

## Abstract

Internet navigation today rents you a name. Renewal fees, registrars,
censorship and opaque pricing — ownership is never real. BlockDNS replaces DNS
with an on-chain registry: a **.bdns** domain is an ERC-721 NFT minted once,
held forever, and resolvable to IPFS content plus wallet bindings for ETH, BTC
and SOL.

Registration is a single, on-chain action paid in BDNS — the protocol token.
Common names (5+ characters) mint for free; short premium names are priced
dynamically, burning 50% of the payment and routing 50% to the treasury. No
subscriptions, no renewals, no rent.

## The problem: you don't own your name

- **Rent, not ownership.** Every traditional domain expires. Miss a renewal and
  your identity, email and brand can be hijacked.
- **Centralized control.** Registries, governments or quirks of a single
  corporation can seize or censor a name at any layer.
- **One name, many islands.** Your website, crypto addresses and social handles
  live in disconnected silos — proving ownership of a brand is manual and
  fragile.

## Solution: BlockDNS L2

BlockDNS runs as a fast, low-cost L2 chain (chain ID `8461`). Every domain,
record and payment lives on-chain — auditable forever and owned by a single
wallet.

The stack keeps the familiar mental model of DNS while replacing the authority:
a **registry** contract mints and owns domains, a **pricer** sets dynamic fees,
the **BDNS** contract is the store of value, and a **marketplace** lets holders
trade names in a trustless escrow.

## How .bdns domains work

- A domain is an **ERC-721 NFT**. Minting burns the chosen name into the
  registry forever — no two wallets can own the same name.
- The mint of a 5+ character name is **free**. Premium short names pay a
  one-time, on-chain dynamic price in BDNS.
- Owners attach an **IPFS CID**: name resolution serves content over any IPFS
  gateway — truly decentralized hosting, free to read.
- Owners bind **wallet records** (ETH, BTC, SOL and any chain) to a single
  domain, turning it into a portable, battle-tested digital identity.
- Ownership is liquid: a domain can be **sold on the marketplace** or
  transferred through standard ERC-721 primitives.

## The BDNS token

- **Supply:** hard cap of 1,000,000,000 (1B) `BDNS`, an ERC-20 on the BlockDNS
  L2.
- **Utility:** payment for premium registrations and marketplace purchases; the
  accounting unit of the whole protocol.
- **Distribution:** genesis issuance, protocol treasury and a community
  staking reward for the top-10 stakers — all on-chain and auditable from day
  one.

## Token distribution

1,000,000,000 `BDNS` is the absolute maximum supply. The allocation below is
on-chain from genesis — no hidden mints, every wallet divisible and verifiable
at any block.

| Allocation | Share | BDNS (of 1B) | Unlock schedule |
| --- | ---: | ---: | --- |
| Ecosystem & Treasury | 60% | 600,000,000 | 1% at TGE, then 99% linear over 60 months |
| Launch & Liquidity | 15% | 150,000,000 | 100% locked at TGE (DEX/CEX LPs) |
| Marketing & Partnerships | 5% | 50,000,000 | Linear over 60 months (~833,333/month) |
| Team & Advisors | 10% | 100,000,000 | 6-month cliff, 24-month linear vesting |
| Community Staking Leaderboard | 5% | 50,000,000 | Decaying release, 48 months, top 10 |
| Chain Reserve | 5% | 50,000,000 | Managed by Protocol Treasury |
| **Total** | **100%** | **1,000,000,000** | — |

- **60% ecosystem & treasury —** the largest share: funds liquidity,
  integrations and chain operations for the long term.
- **15% launch & liquidity —** 100% locked at TGE — the depth for a stable
  DEX/CEX pair from the first block.
- **10% team & advisors —** a cliff-plus-vesting schedule keeps builders
  aligned with the protocol for years, not days.
- **5% community staking leaderboard —** a decaying release across 48 months
  so the widest possible fair-launch distribution reaches the active stakers.
- **5% marketing & partnerships —** long-term growth fuel, vesting linearly
  over 60 months at ~833,333 BDNS per month.
- **5% chain reserve —** protocol operations, managed by the treasury wallet.

## How the token flows — mechanics

1. **Free registration (5+ chars).** Mint costs **0 BDNS**. Creates a namespace
   asset at no cost — the grassroots flywheel of the protocol.
2. **Premium registration (short names).** A one-time on-chain price paid in
   BDNS: **50% is burned** (deflation) and **50% flows to the treasury**.
3. **Marketplace resale.** When a domain sells, the buyer pays the listed price
   in BDNS; a **2.5% fee** is routed to the treasury and the seller receives
   the rest instantly.
4. **Staking leaderboard.** Top-10 stakers on the BDNS protocol share the
   decaying stacking reward each cycle; unclaimed rewards roll back to the
   ecosystem treasury.
5. **Treasury re-deployment.** Accumulated BDNS returns to the ecosystem as
   liquidity, grants and chain incentives — completing the loop.

```
mint(free)       → supply static
mint(premium)    → burn 50% + treasury 50%
sale             → buyer(-100%) → seller(+net 97.5%) + treasury(+2.5%)
staking top-10   → reward wallet · unclaimed → ecosystem

total minted on-chain now ≈ 605,138,750 BDNS · remaining ≈ 394,861,250 BDNS
```

## Token economy

### Premium mints burn 50%

A short-name payment is split: half is burned (deflationary pressure on BDNS),
half flows to the treasury that funds liquidity and chain operations.

### Free tier, forever

5+ character domains cost nothing today and nothing tomorrow — a generous
on-ramp that seeds the namespace with activity.

### Marketplace fee

Resales pay a 2.5% fee, instantly split to the treasury. Secondary liquidity
feeds the same engine as primary issuance.

## Community staking reward

The top-10 stakers on the BlockDNS L2 share a 50M ruler community reward
released on a decaying schedule across 48 months. No gas-heavy bookkeeping and
no centralized sweeps — rewards stream straight from the staking vault to the
qualified leaderboard wallets, so the widest possible fair-launch distribution
reaches the active stakers.

## The marketplace

The **BlockDNSMarketplace** escrows domains on-chain: a seller lists a token
for a price in BDNS, the NFT moves into the contract, and any buyer pays
directly — the fee splits to the seller and the treasury, and the domain
transfers instantly. No intermediaries, no off-chain trust, no settlement risk.

Every `.bdns` domain natively carries a **2.5% EIP-2981 royalty** on secondary
sales, paid in BDNS and routed on-chain to the treasury wallet
`0xe0Bff551891cb718E351522fb798AbF9ac71Fbfe` — enforced by the registry itself
(`_setDefaultRoyalty`, override `supportsInterface`), so external NFT
marketplaces read it automatically with no configuration.

## Security & ownership

- Domains are standard, battle-tested **ERC-721** tokens — owners keep custody
  in their own wallet.
- The marketplace, staking vaults and royalty splitter use audited
  OpenZeppelin patterns: reentrancy guards, safe transfers and non-custodial
  escrow.
- Everything — price, burn, treasury, sales — is public ledger data.
  Governance-free, deterministic and permissionless to verify.
- This live build is an **open protocol demo** on a local L2; mainnet
  parameters mirror the same design.

## Roadmap

- **Phase 1 — Naming core.** Registry + pricer + BDNS + public dashboard.
  *Live in this demo.*
- **Phase 2 — Content.** IPFS pinning and gateway resolution for every domain.
  *Live in this demo.*
- **Phase 3 — Liquidity.** On-chain marketplace for domain resales.
  *Live in this demo.*
- **Phase 4 — Identity.** Verified web3 handle — multi-chain records, ENS-style
  resolution DIDs.
- **Phase 5 — Scale.** Mainnet deployment, bridge integration and multilingual
  UI.

---

> This whitepaper describes the protocol as implemented in the running demo.
> Nothing in here is investment advice; token values accrue solely from
> protocol utility. Decentralize responsibly.