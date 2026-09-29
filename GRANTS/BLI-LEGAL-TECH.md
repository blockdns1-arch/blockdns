# BLI Legal Tech Hackathon 2 — BlockDNS Submission

> **Host**: Blockchain Legal Institute (BLI) / Maryland Blockchain Association
> **Format**: Online · **Window**: May 15 – Nov 1 2026 · **Prize pool**: $50K
> Rust: recompose BEFORE submitting on the organizer page (dorahacks.io or
> mdblockchainweek.com) — track names vary ("BLI Legal Tech Hackathon 2",
> "Blockchain Legal Institute").

## One-liner

**BlockDNS** is a blockchain registry that turns a name into proof of ownership,
proof of publication and a settlement trail — no courts needed for domain-level
identity disputes.

## Why this is legal tech

Traditional DNS pushes legal problems into the courts:

1. **No ownership proof** — a domain holder can't prove *when* they took a name
   or *what they published under it* without screenshots and luck.
2. **Expiry = theft surface** — missed renewal lets anyone grab a brand name;
   recovery fights go to UDRP/courts.
3. **Content attribution is weak** — publishers lack tamper-evident "first
   publication" records; IP/rightholders struggle to prove provenance.

BlockDNS answers each with an immutable, clause-grade record:

| Legal problem | BlockDNS answer |
|---|---|
| Prove name ownership | ERC-721 mint record: who, when, at which block (Base Sepolia live: `demouplk`) |
| Brand/trademark evidence | Registration is auditable on-chain forever; no renewal, no seizure window |
| Proof of publication | Owner-attached IPFS CID = tamper-evident first-publication timestamp (Merkle/IPFS + L2 finality) |
| Dispute settlement trail | Marketplace escrow + royalty splitter = transparent, code-enforced settlement splits on-chain |
| Identity friction | One domain binds ETH/BTC/SOL records — reusable KYC-adjacent identity anchor |

## Core mechanics (technical)

- **Registry (ERC-721).** Name normalized + hashed, minted once, held forever.
  Free for 5+ chars; short premium names pay dynamic price → 50% burn, 50% treasury.
- **Pricer.** Support-price curve for premium names (auditable, deterministic).
- **Resolver.** Owner-signed records → IPFS CID + multi-chain addresses.
- **Marketplace.** Escrowed sales of names (buyer funds held, settled on sell).
- **Swap + Bridge.** Liquid `BDNS` economy around the registry.
- **Royalty Splitter + Vesting.** Automatic revenue routing to creators/treasury.

## Legal & regulatory posture

- Token `BDNS` (hard cap 1B) is a **record-keeping/payment utility**, not an
  investment contract: no profit-pooling promises, no secondary yield. Built for
  usage cost, disclosed as utility-only.
- On-chain audit trail = **evidence-grade** (hash-bound to L2 finality).
- Open source (transparency), no custody of user assets (self-custody wallets).

## Demo (live, copy-paste ready)

- 4-port dashboard: Main · Explorer · Foundation · Swap+Bridge
- Live Base Sepolia registration: **`demouplk`** — tx
  `0xd62c005528b5308db3177c575e2e73de06d89304eaac3ba229ac316cc4cd5857` (block 47,424,582)
- Registry `0xBF04C0f9da8FAfcD570fd3D1a3Fa2E64154F5bb1` · BDNS `0x43fc4eAB8971B95fa1AD45818DEDb1F49e71B746`
- Explorer decodes contract calls (shows `registerDomain` → Success)
- Roadmap: resolver standards (ENS-style), cross-chain identity, dispute module

## Submission checklist (when you fill the form)

- [ ] Title: `BlockDNS — rent-free, evidence-grade on-chain naming`
- [ ] Category: BLOCKCHAIN / LEGAL TECH / IDENTITY (tick all offered)
- [ ] Tags: #DNS #identity #proof-of-ownership #legaltech #base
- [ ] Video: 2-min demo (VISIBILITY-KIT §7 script)
- [x] Repo: `github.com/blockdns1-arch/blockdns` LIVE (150 files) — topics 12 incl. `legaltech,identity,web3`
- [ ] Links section: past SIGN TX, repo, deployer wallet `0x953B...E45323`
- [ ] Questions: mention admissibility/evidence framing + IPFS provenance
- [ ] Submit BEFORE **Nov 1 2026** (local organizer deadline)