# BlockDNS domain-verify — Chainlink CRE Workflow

Orchestrates an onchain EVM read with two external offchain data sources and
produces a combined verification record.

## What it does (every 30s)

1. **EVM read — Base Sepolia** (`BlockDNSRegistry`)
   - `tokenByIndex(0)` → proves a domain is registered (tokenId)
   - `ownerOf(1)` → onchain owner of the registered domain
2. **External API — GitHub** (`api.github.com/repos/blockdns1-arch/blockdns`)
   - repo existence proof, stars, forks
3. **External data source — DNS-over-HTTPS** (Google DNS `dns.google`)
   - TXT lookup for the domain → status `3` (NXDOMAIN) means the legacy DNS
     name is still free / not hijacked (recordFree)
4. **Result** — a JSON verification record:

```json
{
  "name": "demouplk",
  "chain": "base-sepolia",
  "tokenId": "1",
  "onchainOwner": "0x953b...",
  "ownerMatched": true,
  "external": { "gitHub": {...}, "legacyDNS": {...} },
  "verified": true
}
```

See `simulation-result.json` for the live simulated output (2026-09-29).

## Run

```bash
cd ../blockdns-cre  # project root (has project.yaml)
bun install --cwd ./domain-verify
cre workflow simulate domain-verify --target staging-settings
```

The `.env` in the project root (gitignored) holds `CRE_ETH_PRIVATE_KEY`.