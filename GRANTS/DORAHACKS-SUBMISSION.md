# DoraHacks submission — BLI Legal Tech Hackathon 2

Event: https://dorahacks.io/hackathon/legal-hack-2026
Submit from: https://dorahacks.io/hackathon/legal-hack-2026 → **Submit Build** (log in first)
Deadline: **2026-11-01 01:01 UTC**. Prize pool: 20,000 USD. Up to 10 bounty applications per build.
Status: the hackathon shows **no builds yet**, so this would be the first submission.

## Tracks

Published tracks (from `/tracks`):

1. Real World Assets (RWA)
2. LegalTech & RegTech — data privacy, KYC/on-chain legal docs, legal automation
3. AI x Blockchain
4. Web3 for Social Good
5. GameFi & NFT
6. Green Tech

**Apply as:** `LegalTech & RegTech` (primary) + `Web3 for Social Good` (secondary). `GameFi & NFT`
is a defensible third since the names are NFTs, but the legal framing is the stronger story.
The nav shows "Bounties 2" while `/bounties` currently reads "No Bounties", so the two bounties are
not published yet. Re-check `/bounties` before submitting and target the matching one.

---

## 1. Form fields

| Field | Value |
| --- | --- |
| Build name | `BlockDNS — own your .bdns name, on-chain title` |
| Tagline | `A blockchain naming layer where every .bdns name is a verifiable on-chain property right, bound to your wallets and backed by verified source.` |
| Primary track | LegalTech & RegTech |
| Secondary track | Web3 for Social Good |
| Tech stack | Solidity 0.8, Hardhat, Next.js 15, TypeScript, viem, wagmi, RainbowKit, Foundry-compatible tests, Sourcify + Etherscan V2 verification |
| Chain | Base Sepolia (chain id 84532), with an L2 messenger + bridge path to the BlockDNS L2 |
| Repo | https://github.com/blockdns1-arch/blockdns |
| Contracts | 15 contracts, all verified on Basescan and Sourcify |
| Team | blockdns1-arch |

### Demo links

| URL | What it shows | Status |
| --- | --- | --- |
| https://blockdns-home.vercel.app | Mint, marketplace, dashboard, whitepaper | live (stale build) |
| https://blockdns-explorer.vercel.app | Blocks, transactions, contract labels | **404 — redeploy** |
| https://blockdns-swap.vercel.app | ETH ⇄ BDNS swap and L2 bridge | **404 — redeploy** |
| https://blockdns-founder.vercel.app | Treasury, governance, grants | **404 — redeploy** |
| https://sepolia.basescan.org | Verified source for all 15 contracts | live |

Remove the three 404 rows before submitting, and remove the "stale build" note.

---

## 2. Short description

BlockDNS mints `.bdns` names as ERC-721s on Base Sepolia, so ownership of a name is an on-chain,
transferable property right rather than a revocable account. Each name resolves to a content hash
and to bound ETH/BTC/SOL wallets, which makes it a self-serve legal identity primitive: a name whose
owner, content and bindings can be proven from public chain state alone, with no registrar to ask.

## 3. Long description

```markdown
## BlockDNS — your name is a property right, not a username

BlockDNS is a blockchain naming layer. A `.bdns` name is minted as an ERC-721 on Base Sepolia, and
the token itself is the title: transfer it and the right transfers with it, with no registrar in the
middle and no account that can be suspended. Names resolve on-chain to a content hash and to bound
wallets, so a single name carries both identity and asset control.

**What is deployed and verifiable today**

- 15 Solidity contracts live on Base Sepolia (chain id 84532)
- Every contract verified on Etherscan V2 / Basescan and Sourcify — source is public and auditable
- A registered name in the registry: `demouplk`
- Public deployment manifest with all addresses: `deployments/public/base-sepolia.json`

**Why it belongs in a legal hackathon**

1. *Ownership as evidence.* The registry is the authoritative record of who owns a name. For a
   legal filing, a domain dispute, or a trademark assignment, the chain state is the record, and it
   is timestamped by the chain rather than asserted by a vendor.
2. *Identity without a registrar.* A name bound to wallets is a pseudonymous, self-asserted legal
   identity that needs no KYC upload. Nothing in the protocol knows who you are; it only knows which
   keys control what. That is the privacy-preserving side of the RegTech track.
3. *Tamper-evident records.* The content hash attached to a name is a commitment scheme. Publishing
   a document under a name and later proving that the published bytes have not changed is a
   notarisation primitive that costs one transaction.
4. *Automated attribution.* Mint-time royalties are split on-chain through a royalty splitter, so
   attribution of contributions is enforced by code instead of bookkeeping.
5. *Auditability as a right.* Verified source on a public explorer means any party can check what the
   system does without trusting the operator, which is the precondition for using it as evidence.

**The system**

- `BlockDNSRegistry` + `BlockDNSResolver` — mint names, resolve owner, content hash and bound wallets
- `BlockDNSwap` + `BdnBridge` — buy BDNS with ETH, bridge BDNS to the BlockDNS L2
- `BlockDNSMarketplace` — list and buy second-hand names
- `BDNSStakingVault` — lock BDNS for protocol revenue share
- `BDNSBurnEngine`, `BDNSRoyaltySplitter`, `BlockDNSPricer` — supply and pricing mechanics
- `L2CrossDomainMessenger` — the cross-layer message path for the L2
- Four vesting vaults (team, marketing, ecosystem, liquidity) — transparent, on-chain allocation

**What I want feedback on**

- Does a token-as-title model need a dispute-resolution layer the contract cannot provide?
- Is an on-chain content hash enough for evidentiary use, or does it need a registrar's timestamp?
- What would a regulated deployment need that this testnet deliberately leaves out?
```

## 4. Demo script for judges (5 minutes)

Base Sepolia needs test ETH. Say so on camera, and have the funded wallet ready.

1. **Home** (https://blockdns-home.vercel.app) — connect wallet, show the network badge says Base
   Sepolia. Mint `demouplk.bdns`. Open Basescan on the same token to prove source verification.
2. **Explorer** (https://blockdns-explorer.vercel.app) — search a transaction hash, show it decoded
   against the verified ABI, and show a name resolving to owner + content hash + bound wallets.
3. **Swap** (https://blockdns-swap.vercel.app) — swap ETH for BDNS, then start a bridge to the L2.
4. **Marketplace and staking** — list a name, buy it, and stake BDNS in the vault.
5. **Founder** (https://blockdns-founder.vercel.app) — treasury, governance, grants, and the vesting
   schedule.

Keep every claim on-screen: no slide says "verified" unless Basescan is open next to it.

## 5. Video

3 minutes, screen recording, no music bed over the narration.

| Time | Content |
| --- | --- |
| 0:00-0:20 | Problem: a name you do not own is a promise someone else can break |
| 0:20-1:10 | Mint `demouplk.bdns`, open Basescan, show verified source |
| 1:10-1:50 | Explorer: resolve the name, read owner, content hash, bound wallets |
| 1:50-2:30 | Swap ETH for BDNS, list on the marketplace, stake |
| 2:30-3:00 | Why the legal framing matters, and what feedback would help |

Re-record after the three redeploys land. Host on YouTube unlisted or Loom, paste the link.

## 6. Cover image

1920x1080, `.bdns` wordmark on a dark background with the contract count "15 contracts, verified".
No fake screenshots: use a capture of the live explorer with a real block number.

## 7. Likely judge questions

- **How is this different from ENS?** Token-as-title with on-chain content-hash and cross-chain
  wallet binding, plus a marketplace and revenue-sharing staking loop in the same contract set.
- **Is it legal to treat a token as a name?** That is a jurisdiction question, not a protocol
  question, and it is exactly what I want feedback on.
- **What happens to a name if you disappear?** It never expires and cannot be revoked by an operator,
  but there is no dispute process yet — a known gap.
- **Is it audited?** No external audit. Mitigation: 68 passing tests, full public source, verified
  contracts, vesting enforced on-chain.
- **Mainnet?** Not yet. This is a testnet deployment with a published manifest.

## 8. Before you submit

- [ ] Push the merged main branch. Local is 8 commits ahead of `origin/main` and the push failed on
      missing credentials; run `gh auth login` in your own terminal.
- [ ] Redeploy all four Vercel projects from the merged main. `swap`, `explorer` and `finder` return
      404 today.
- [ ] Confirm all four sites load without a login. The team password gate was removed from
      `frontend/middleware.ts`, so only Vercel deployment protection can hide them.
- [ ] Confirm Vercel deployment protection is off, or the links 401.
- [ ] Rotate the Etherscan API key that was pasted in plaintext. Re-verify if the old one is revoked.
- [ ] Record the video after the redeploys, then fill in the demo links table with the four live URLs.
- [ ] Re-check `/bounties` and `/detail` for judging criteria and any new bounty.
- [ ] Screenshot the Talent Protocol score once it re-indexes: https://talentprotocol.com/score/0x953BaA88c280df9e59C149BC5aB9B9ec64E45323?github=blockdns1-arch
