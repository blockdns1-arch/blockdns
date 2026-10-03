# BlockDNS

**On-chain naming for the decentralized web.** `.bdns` domains are ERC-721 NFTs minted once and owned forever — bound to IPFS content and resolvable to wallet records for ETH, BTC and SOL. No renewals, no rent, no registrar.

BlockDNS ships as three parts that run together: an **L2 chain** (chain ID `8461`) holding the registry, a **DNS-over-RPC gateway** that resolves `.bdns` names to IPFS content over plain HTTP, and a **Next.js dApp** for registering, pricing, trading and bridging names.

---

## Architecture

```
                    ┌──────────────────────────────────────┐
   Browser ────────▶│  Frontend (Next.js 15, wagmi/viem)   │
   *.bdns.link ────▶│  register · marketplace · swap · L1↔L2│
                    └───────────────┬──────────────────────┘
                                    │ viem reads / wallet txs
                    ┌───────────────▼──────────────────────┐
                    │   BlockDNS L2 (chainId 8461)          │
                    │   BlockDNSRegistry  (ERC-721 domain) │
                    │   BDNS · Pricer · Marketplace · Swap  │
                    │   Resolver (read helper for wallets)  │
                    └───────────────┬──────────────────────┘
                                    │ resolveName() → CID
                    ┌───────────────▼──────────────────────┐
   DNS request ────▶│  Gateway (Express + viem + Redis)    │
   Host: name.bdns │  host parse → cache → on-chain read  │
                    │  → CID verify → IPFS fetch (2/3)     │
                    └───────────────┬──────────────────────┘
                                    │
                       ┌────────────▼────────────┐
                       │ IPFS (Cloudflare/Pinata/ │
                       │ local Kubo, consensus)  │
                       └─────────────────────────┘
```

Resolution path for `GET http://gateway/ Host: mysite.bdns`:

1. Parse the `Host` header, validate it against `ALLOWED_HOST_SUFFIXES` (`.bdns`, `.bdns.link`).
2. Cache lookup (Redis, or in-memory when `REDIS_URL` is empty) with `CACHE_TTL_SECONDS`.
3. On-chain read `BlockDNSRegistry.resolveName(name)` via viem → owner + CID.
4. Fetch the content from `IPFS_GATEWAYS`; validate the CID hash against the bytes returned.
5. Return the content with the sniffed MIME type (apex names redirect to `APEX_REDIRECT_URL`).

---

## Contracts

Solidity `0.8.20`, optimizer on (200 runs), `evmVersion: paris`. OpenZeppelin v5.

| Contract | Purpose |
| --- | --- |
| `BlockDNSRegistry.sol` | ERC-721 domain NFT — one mint per name, forever. Holds the IPFS CID, per-chain address records and custom TXT keys. Events: `DomainRegistered`, `IPFSRecordUpdated`, `AddressRecordUpdated`, `CustomTXTUpdated`, `CustomTXTRemoved`, `PricerUpdated`, `BaseURIUpdated`. |
| `BDNS.sol` | ERC-20 + burnable + permit + `AccessControl`. Hard `cap` (deploy default 1B), `MINTER_ROLE` / `BURNER_ROLE`, plus a validator set with staking, unbonding period and slashing. |
| `BlockDNSPricer.sol` | Length-based pricing: names of `FREE_TIER_MIN_LENGTH` (5) characters or more are free, shorter names use `priceTier2` / `priceTier4`. Events: `PricesUpdated`. |
| `BlockDNSMarketplace.sol` | On-chain resale with a configurable fee in basis points (`MAX_FEE_BPS = 500`, i.e. 5% cap) routed to a `royaltySplitter` and a treasury. Events: `FeeUpdated`, `RoyaltySplitterUpdated`. |
| `BlockDNSResolver.sol` | Read helper for wallets and clients: `resolveTokenId(name)` and `resolveIPFS(name)` resolve straight from the registry. |
| `BlockDNSwap.sol` | ETH ↔ BDNS swap with `previewEthToBdns` / `previewBdnsToEth` quoting and owner-set rates and fees. |
| `BdnBridge.sol` | BDNS bridge in both directions: `deposit()` (L1 → L2) and `withdraw()` (L2 → L1), with a configurable BDNS/USD fee and fee collector. |
| `tokenomics/BDNSVestingVault.sol` | Cliff + linear vesting for team and contributor allocations; only the beneficiary can claim. |
| `tokenomics/BDNSStakingVault.sol` | Locks a tranche schedule up front and releases emission linearly to staking rewards. |
| `tokenomics/BDNSAirdrop.sol` | Merkle airdrop with a TGE share plus linear vesting, one cumulative claim per address. |
| `tokenomics/BDNSRoyaltySplitter.sol` | Splits marketplace fees across treasury / dev / liquidity / marketing / audit (shares sum to 10000, max 50% each). |
| `tokenomics/BDNSBurnEngine.sol` | 10-year decaying auto-burn (0.5% → 0) with a 500M hard cap on destroyed supply. |
| `messaging/CrossDomainMessenger.sol` | Event-based cross-domain transport: nonce + per-message hash replay protection, `xDomainMessageSender` auth. |
| `messaging/L1CrossDomainMessenger.sol` | L1-side messenger instance (accepts native value). |
| `messaging/L2CrossDomainMessenger.sol` | L2-side messenger instance. |

All 15 contracts are fully NatSpec-documented (purpose, invariants, `@param` / `@return` on every public and external function), which makes the ABI self-describing for integrators.

---

## Live deployment

BlockDNS is deployed on **Base Sepolia** (chain ID `84532`) — registry, resolver, pricer, token,
marketplace, swap, bridge, tokenomics vaults and the L2 cross-domain messenger.

The full address manifest is committed at [`deployments/public/base-sepolia.json`](deployments/public/base-sepolia.json)
(public addresses only, no secrets). Highlights:

| Contract | Address | Sourcify | Basescan |
| --- | --- | --- | --- |
| `BDNS` | `0x15797f41C030d07Fd6924Ab0F93cEC1Bf62a7961` | [verified](https://sourcify.dev/contract/84532/0x15797f41C030d07Fd6924Ab0F93cEC1Bf62a7961) | [verified](https://sepolia.basescan.org/address/0x15797f41C030d07Fd6924Ab0F93cEC1Bf62a7961#code) |
| `BlockDNSRegistry` | `0x47BC8BcC51234c056D2A95c3E3a2747D851605C7` | [verified](https://sourcify.dev/contract/84532/0x47BC8BcC51234c056D2A95c3E3a2747D851605C7) | [verified](https://sepolia.basescan.org/address/0x47BC8BcC51234c056D2A95c3E3a2747D851605C7#code) |
| `BlockDNSResolver` | `0x81447f17daa279B9a3cB1AB7Ea60355Cde8deD7A` | [verified](https://sourcify.dev/contract/84532/0x81447f17daa279B9a3cB1AB7Ea60355Cde8deD7A) | [verified](https://sepolia.basescan.org/address/0x81447f17daa279B9a3cB1AB7Ea60355Cde8deD7A#code) |
| `BlockDNSPricer` | `0xDc0C8a3BCBa905E67f7a5551301462b4E57e4101` | [verified](https://sourcify.dev/contract/84532/0xDc0C8a3BCBa905E67f7a5551301462b4E57e4101) | [verified](https://sepolia.basescan.org/address/0xDc0C8a3BCBa905E67f7a5551301462b4E57e4101#code) |
| `BlockDNSMarketplace` | `0x4cA0a781cc784759d9792Cd0EC502E59C93c970e` | [verified](https://sourcify.dev/contract/84532/0x4cA0a781cc784759d9792Cd0EC502E59C93c970e) | [verified](https://sepolia.basescan.org/address/0x4cA0a781cc784759d9792Cd0EC502E59C93c970e#code) |
| `BlockDNSwap` | `0xF1410546e20b06E0EE24A816E42d58FD6A64A715` | [verified](https://sourcify.dev/contract/84532/0xF1410546e20b06E0EE24A816E42d58FD6A64A715) | [verified](https://sepolia.basescan.org/address/0xF1410546e20b06E0EE24A816E42d58FD6A64A715#code) |
| `BdnBridge` | `0x5e660A3a6685197375357676c37B7B780De4d306` | [verified](https://sourcify.dev/contract/84532/0x5e660A3a6685197375357676c37B7B780De4d306) | [verified](https://sepolia.basescan.org/address/0x5e660A3a6685197375357676c37B7B780De4d306#code) |
| `L2CrossDomainMessenger` | `0x0a65A92C70456443394CAB879D99562259250C97` | [verified](https://sourcify.dev/contract/84532/0x0a65A92C70456443394CAB879D99562259250C97) | [verified](https://sepolia.basescan.org/address/0x0a65A92C70456443394CAB879D99562259250C97#code) |

All 15 deployed contracts are verified on both Sourcify and Basescan, and the name `demouplk` is
registered on-chain
([registration transaction](https://sepolia.basescan.org/tx/0xe005bde59af906ee8dffc2c3e8a72cdb005d8acef85659a51ec84941fc2024f9)).

---

## Quickstart

### 1. Install

```bash
git clone https://github.com/blockdns1-arch/blockdns.git
cd blockdns
npm install

cp .env.example .env
cp gateway/.env.example gateway/.env
cp frontend/.env.example frontend/.env
```

### 2. Chain + contracts

```bash
npm run build                       # hardhat compile
npx hardhat node                    # local L2 on http://127.0.0.1:9545, chainId 8461
npm run deploy                      # deploys registry, token, pricer (+ phase 2 / tokenomics scripts)
npm run test                        # 68 contract tests
```

The local node listens on port **9545** (set in `hardhat.config.ts`) so it matches the `l2` network and the gateway docker-compose defaults with no extra configuration.

Copy the printed addresses into `gateway/.env` and `frontend/.env`:

```bash
REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_REGISTRY_ADDRESS=0x...
```

### 3. Gateway

```bash
cd gateway
npm install
npm run dev                         # tsx watch, http://localhost:8080
npm test                            # unit tests: host parsing, CID, cache
```

```bash
curl http://localhost:8080/health
curl http://localhost:8080/resolve/mywebsite
curl http://localhost:8080/ccip/mywebsite        # CCIP-Read style JSON response
curl -H "Host: mywebsite.bdns" http://localhost:8080/
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev                         # http://localhost:3000
npm run typecheck
```

Connect a wallet, register a name, set its IPFS CID, then resolve it through the gateway.

### 5. Docker (gateway + Redis + IPFS)

```bash
cd gateway
cp .env.example .env               # REGISTRY_ADDRESS is required
docker compose up -d --build
curl $(docker port blockdns-gateway 8080/tcp)/health
```

Compose brings up the gateway, a Redis cache and a local Kubo IPFS node. It reads the same
`gateway/.env` variables, so the container picks up your deployed registry address automatically.

---

## Networks

| Network | Chain ID | Default RPC |
| --- | --- | --- |
| `hardhat` | `8461` | in-process (local L2, port `9545`) |
| `l1` | `11155111` (Sepolia) | `http://127.0.0.1:8545` |
| `l2` | `8461` (BlockDNS) | `http://127.0.0.1:9545` |
| `base` | `8453` | `https://mainnet.base.org` |
| `base-sepolia` | `84532` | `https://sepolia.base.org` |

All of them are overridable through `.env` (`L1_RPC_URL`, `L2_RPC_URL`, `BASE_RPC_URL`, `*_CHAIN_ID`).

---

## Environment variables

| File | Key variables |
| --- | --- |
| `.env` | `DEPLOYER_PRIVATE_KEY`, `L1_RPC_URL`, `L2_RPC_URL`, `BASE_RPC_URL`, `*_CHAIN_ID` |
| `gateway/.env` | `PORT`, `L2_RPC_URL`, `L2_CHAIN_ID`, `REGISTRY_ADDRESS`, `RESOLVER_ADDRESS`, `ALLOWED_HOST_SUFFIXES`, `CACHE_TTL_SECONDS`, `REDIS_URL`, `IPFS_GATEWAYS`, `GATEWAY_CONSENSUS`, `STRICT_CID_VERIFY`, `MAX_CONTENT_BYTES`, `REQUEST_TIMEOUT_MS`, `APEX_REDIRECT_URL` |
| `frontend/.env` | `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `NEXT_PUBLIC_L2_CHAIN_ID`, `NEXT_PUBLIC_L2_RPC_URL`, `NEXT_PUBLIC_{REGISTRY,PRICER,BDNS,SWAP,BRIDGE}_ADDRESS`, `NEXT_PUBLIC_EXPLORER_URL`, `NEXT_PUBLIC_IPFS_GATEWAY` |

Secrets are never committed: `.env`, `base-deploy.env`, `social-agent/.env` are gitignored, and only `.env.example` files are tracked.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run build` / `clean` | compile / wipe Hardhat artifacts |
| `npm run test` | contract test suite |
| `npm run deploy` | deploy registry + token + pricer on the active network |
| `npm run deploy:l1` / `deploy:l2` | deploy to a specific network |
| `npm run deploy:phase2` | marketplace + swap + bridge |
| `npm run deploy:tokenomics` | vesting + staking |
| `npm run merkle:generate` | build the airdrop Merkle root |
| `npm run deploy:vercel` | create/update the four Vercel projects and deploy (`--dry-run`, `--skip-deploy`, `--only=<project>`) |
| `npm run manifest:export` | regenerate `deployments/public/<network>.json` |
| `npm run verify:sourcify` / `verify:etherscan` | verify the deployed contracts |
| `npm run watch:events` | stream registry events (use `:local` for the hardhat chain) |
| `npm run pdf:whitepaper` | render `WHITEPAPER.md` to `Whitepaper.pdf` |
| `npm run social:*` | social agent (Telegram / X / Farcaster) helpers |

---

## Chainlink CRE workflow

`chainlink-cre/blockdns-cre/domain-verify/` runs a Chainlink CRE job that cross-checks a `.bdns` name against three independent sources on a 30-second cadence:

- **EVM read** — the name's `tokenId` and current owner from the registry on Base Sepolia
- **GitHub API** — whether the repo backing the name exists
- **DNS-over-HTTPS** — whether a legacy DNS `TXT` record still claims the name

Output is a single verification record (`onchainOwner`, `externalData`, `verified`). Simulation results live in `chainlink-cre/blockdns-cre/domain-verify/simulation-result.json`.

---

## Contract verification

All 15 deployed contracts are verified on both Sourcify and Basescan.

Sourcify needs no API key:

```bash
npm run verify:sourcify -- --network base-sepolia
```

That script submits the exact standard-JSON input Hardhat produced (selected by matching the source on
disk and the deployed bytecode length) to the Sourcify v2 API, then polls each job. `npm run manifest:export`
refreshes the committed public manifest with the resulting verification links.

Basescan runs through the Etherscan V2 API, which needs a free `ETHERSCAN_API_KEY`:

```bash
npm run verify:etherscan
```

`scripts/verify-etherscan.ts` rebuilds every constructor argument from chain state and from the
deployment defaults, then submits all 15 contracts to Etherscan V2. Values that an owner setter
changed after deployment — the swap rate, for example — are pinned to the value the contract was
constructed with, because the explorer matches creation bytecode rather than current storage. Set
`VERIFY_ONLY=BlockDNSwap,BlockDNSPricer` to retry a subset.

Constructor arguments for the live Base Sepolia deployment are recorded next to the addresses in
[`deployments/README.md`](deployments/README.md).

---

## Tests

| Suite | Command | Covers |
| --- | --- | --- |
| Contracts | `npm run test` | registry, marketplace, tokenomics, event watcher |
| Gateway | `cd gateway && npm test` | host parsing, CID validation, cache |
| Frontend | `cd frontend && npm run typecheck` | types |

---

## Frontend pages

`/mint` (register a name) · `/market` (marketplace) · `/swap` (token swap) · `/bridge` (L1 ↔ L2) · `/explorer` + `/explorer/tx/[hash]` + `/explorer/block/[number]` · `/dashboard` · `/foundation` · `/whitepaper`

## Live sites

One frontend, four Vercel projects built from `frontend/` with the same settings — only
`NEXT_PUBLIC_SITE` differs, so each domain has its own branding, navigation and landing copy.

| Project | URL | Site |
| --- | --- | --- |
| `blockdns-home` | https://blockdns-home.vercel.app | Domains, mint, market, dashboard |
| `blockdns-swap` | https://blockdns-swap.vercel.app | Swap and bridge |
| `blockdns-explorer` | https://blockdns-explorer.vercel.app | Blocks, transactions, name lookups |
| `blockdns-founder` | https://blockdns-founder.vercel.app | Foundation, tokenomics, whitepaper |

```bash
npm run deploy:vercel -- --dry-run   # preview the plan
npm run deploy:vercel               # create/update the four projects and deploy
npm run deploy:vercel -- --team=<slug>   # for a team-scoped Vercel token
```

The projects live in the Vercel team, and the script resolves the team from its slug. It also
clears Vercel deployment protection (password / Vercel Authentication) so all four URLs stay
publicly reachable — pass `--keep-protection` to skip that.

Details: [`deployments/vercel.md`](deployments/vercel.md).

---

## Documentation

- [`WHITEPAPER.md`](WHITEPAPER.md) — protocol spec, tokenomics, roadmap
- [`Whitepaper.pdf`](Whitepaper.pdf) — rendered version
- [`gateway/README.md`](gateway/README.md) — gateway architecture and security model
- [`deployments/README.md`](deployments/README.md) — public deployment manifests and verification
- [`deployments/vercel.md`](deployments/vercel.md) — the four Vercel projects and how they are deployed
- [`GRANTS/`](GRANTS) — hackathon and grant submissions

## License

[MIT](LICENSE) — matches the `SPDX-License-Identifier: MIT` headers already present in every source file.
