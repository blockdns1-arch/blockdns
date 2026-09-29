# Base Builder Grant — BlockDNS

## One-liner

**BlockDNS** is a lifetime, on-chain naming system for the Superchain: `.bdns`
domains as ERC-721 NFTs, IPFS-hosted content, multi-wallet identity (ETH/BTC/SOL)
and a self-funding token economy — deploying natively on **Base**.

## The problem

- Traditional DNS is **rent, not ownership**. Every domain expires; a missed renewal
  can hijack your brand, email and identity.
- Control is **centralized**: registries and single corporations can seize, censor or
  re-price any name at any layer.
- Identity is **fragmented**: your site, crypto addresses and social handles live in
  disconnected silos.

## The solution

A Base-native protocol that replaces DNS authority with an auditable on-chain registry:

- **Registry (ERC-721).** A `.bdns` name is minted once and held forever by one wallet.
  Names of 5+ characters mint **free**; short premium names pay a one-time dynamic price.
- **Dynamic pricing.** Premium payments route 50% to a burn engine and 50% to the protocol
  treasury — no subscriptions, no renewals, no rent.
- **IPFS resolution.** Owners attach a CID; name resolution serves content over any IPFS
  gateway — decentralized hosting, free to read.
- **Multi-wallet identity.** One domain binds ETH, BTC, SOL and any-chain records → a
  portable digital identity.
- **Liquid ownership.** A trustless marketplace (escrow) lets holders trade names; a
  swap + bridge surface makes the economy move.
- **Token economy.** `BDNS` (hard cap 1B, ERC-20) is the payment and accounting unit, with
  a community staking reward for active stakeholders.

## Why Base

Base is the "secure, trusted infrastructure for global finance" — exactly the audience
that needs credible, lasting digital identity. BlockDNS adds the **naming layer** the
Superchain is missing and demonstrates infrastructure-grade public goods on Base:

- Native deployment on Base (mainnet intent), full OP-stack alignment.
- Low-cost, fast L2 fits a one-time-payment naming model with no recurring rent.
- Open-source, fully on-chain, auditable forever.

## Current status (working today)

- **Complete contract suite** on the BlockDNS testnet architecture: Registry, Resolver,
  Pricer, Marketplace, Swap, Bridge, plus tokenomics (Airdrop, Staking, Vesting, Burn,
  Royalty Splitter) — ready to deploy to **Base Sepolia → Base mainnet**.
- **Live 4-port dashboard**: Main site, Explorer, Foundation, and Swap+Bridge (NFT
  marketplace + token swap) — running with the real deployed contracts.
- **On-chain alert pipeline**: a Telegram-verified agent relays domain registrations and
  events to a public group in real time.
- **Whitepaper + brand**: fully written, embedded in the product (grant-ready).

## What the grant funds

1. Base **mainnet** deployment of the full suite (gas) + verified contracts on Basescan.
2. Running production infrastructure (frontend + indexer) for at least 6 months.
3. Community seeding: free name claims for Base users + a small trading pool for the
   marketplace to be usable from day one.

## Roadmap

| Milestone | Deliverable |
|---|---|
| M1 — done | Full contract suite, tokenomics, dashboard, live on testnet L2 |
| M2 — in progress | Deploy + verify on **Base Sepolia**, wire frontend to Base |
| M3 — grant | **Base mainnet** launch, verified contracts, community claim campaign |
| M4 — growth | Integrations (resolver standards, wallets), marketplace liquidity, indexer |

## Links

- Deployer / project wallet: `0x953BaA88c280df9e59C149BC5aB9B9ec64E45323`
- Whitepaper: `WHITEPAPER.md` (repo root, embedded in product)
- Demo: 4-port local deployment (Main / Explorer / Foundation / Swap+Bridge)