# 3rd-Web-Hack Submission — BlockDNS

> Theme: "Hack the Web — solve real blockchain problems."
> Prepared Sep 2026. Verify live details at devpost (3rd-Web-Hack) before submitting.

## Project name
**BlockDNS** — a lifetime, on-chain naming system for the web.

## Tagline
Rent-free domains: `.bdns` names minted once as NFTs, resolvable to IPFS content
and multi-wallet identity — native on Base.

## What it does
BlockDNS replaces DNS rent with a one-time, on-chain registry:

- **Ownership is forever.** A `.bdns` domain is an ERC-721 minted once — no renewal
  fees, no expiry, no registrar to seize it back.
- **Free by default.** Names of 5+ characters mint for free. Short premium names pay a
  dynamic price that is split 50/50 into a burn engine and the protocol treasury.
- **Real content resolution.** Owners attach an IPFS CID, so a name serves content over
  any IPFS gateway.
- **One identity, every wallet.** A single domain binds ETH, BTC, SOL and any-chain
  records — a portable, verifiable digital identity.
- **Liquid.** A trustless marketplace lets holders trade names; a swap + bridge surface
  makes the `BDNS` economy move.

## How we built it
Full EVM stack, whitelist-style security, open source:

- **Solidity contracts** (hardhat + ethers v6): `BlockDNSRegistry` (ERC-721, name
  normalization + hash), `BlockDNSResolver`, `BlockDNSPricer` (dynamic pricing),
  `BlockDNSMarketplace` (escrow, fee split), `BlockDNSwap`, `BdnBridge`.
- **Tokenomics**: `BDNS` ERC-20 (hard cap 1B) with Airdrop (merkle), Staking,
  Vesting, Burn engine, Royalty Splitter.
- **Frontend**: Next.js, 4 live ports — Main site, Explorer, Foundation, Swap+Bridge —
  wired to the real contracts.
- **Dev tooling**: registry-to-indexer watcher + Telegram-verified alert pipeline that
  relays on-chain registrations to a live group in real time.
- **Multi-chain now**: hardhat configured for **Base / Base Sepolia**; full deploy suite
  targetting Base as the L2.

## Built with
Solidity 0.8, Hardhat, ethers v6, TypeScript, Next.js (App Router), Wagmi/Viem,
Merkle trees, IPFS, Base (OP Stack).

## Demo & links
- Live 4-port dashboard (Main / Explorer / Foundation / Swap+Bridge) — local demo with
  real deployed contracts.
- Whitepaper: `WHITEPAPER.md` (embedded in product).
- Grant dossier: `GRANTS/base-builder-grant.md`.

## Roadmap (post-hack)
1. Base Sepolia deployment + verified contracts on Basescan.
2. Base mainnet launch + community name-claim campaign.
3. Wallets/resolver integrations; marketplace liquidity; indexer.

## What we'd do with more time
- Resolver standards integration (ENS-style forward/reverse records).
- Aggregated IPFS gateway + subname support.
- Cross-chain registry mirror for wider adoption.