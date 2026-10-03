# Four sites, one repository

BlockDNS ships as four independent Vercel projects built from the single `frontend/` app in
[`blockdns1-arch/blockdns`](https://github.com/blockdns1-arch/blockdns). No duplicated folders, no
`frontend/frontend`, no `--prefix`.

| Vercel project | URL | `NEXT_PUBLIC_SITE` | Root page |
| --- | --- | --- | --- |
| `blockdns-home` | https://blockdns-home.vercel.app | `home` | Domains: mint, market, dashboard, IPFS hosting |
| `blockdns-swap` | https://blockdns-swap.vercel.app | `swap` | Swap ETH ⇄ BDNS and the L2 bridge |
| `blockdns-explorer` | https://blockdns-explorer.vercel.app | `explorer` | Blocks, transactions and `.bdns` name lookups |
| `blockdns-founder` | https://blockdns-founder.vercel.app | `founder` | Tokenomics, treasury, vesting and the whitepaper |

## Shared settings

Every project uses the identical build configuration:

| Setting | Value |
| --- | --- |
| Git repository | `blockdns1-arch/blockdns` |
| Production branch | `main` |
| Root Directory | `frontend` |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output Directory | `.next` |
| Framework preset | Next.js |

## Why the four URLs are not identical

`NEXT_PUBLIC_SITE` is the only per-project difference. [`frontend/lib/sites.ts`](../../frontend/lib/sites.ts)
holds the site registry: branding, page title and description, navigation entries, hero copy, feature
cards and stats. [`frontend/components/Navbar.tsx`](../../frontend/components/Navbar.tsx) and
[`frontend/components/SiteLanding.tsx`](../../frontend/components/SiteLanding.tsx) render from it, and
each site links to its siblings with absolute URLs so the navbar works the same on all four domains.

## Deploying

```bash
# 1. Create a token at https://vercel.com/account/tokens, then either
$env:VERCEL_TOKEN = 'xxx'          # PowerShell, current session
# or add VERCEL_TOKEN=xxx to the gitignored base-deploy.env at the repo root.
# If the token is scoped to a team, also set VERCEL_TEAM_ID.

# 2. Preview the plan without touching Vercel
npm run deploy:vercel -- --dry-run

# 3. Create or update the four projects, sync env vars and deploy
npm run deploy:vercel
```

Useful flags:

| Flag | Effect |
| --- | --- |
| `--dry-run` | Prints the plan, never writes to Vercel |
| `--skip-deploy` | Creates and configures the projects without building them |
| `--only=blockdns-swap` | Limits the run to one project |

The script is idempotent: existing projects are patched to the settings above, environment
variables are only rewritten when the value actually changed, and a production deploy is triggered
from `main`. After the first run every project also redeploys automatically on each push to `main`.

## Environment variables

The script copies chain settings and all contract addresses straight from
`deployments/base-sepolia.json`, so the four sites can never drift from the deployment:

- chain: `NEXT_PUBLIC_L2_CHAIN_ID=84532`, `NEXT_PUBLIC_L2_CHAIN_NAME=Base Sepolia`,
  `NEXT_PUBLIC_L2_RPC_URL=https://sepolia.base.org`
- explorer: `NEXT_PUBLIC_L2_EXPLORER_URL=https://sepolia.basescan.org`
- addresses: registry, pricer, token, resolver, marketplace, swap, bridge, burn engine, staking
  vault, royalty splitter and messenger
- site URLs: `NEXT_PUBLIC_SITE_HOME_URL`, `NEXT_PUBLIC_SITE_SWAP_URL`,
  `NEXT_PUBLIC_SITE_EXPLORER_URL`, `NEXT_PUBLIC_SITE_FOUNDER_URL`

`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` and `NEXT_PUBLIC_PINATA_JWT` are passed through only if they
already exist in the local environment; they are never invented. Template:
[`frontend/.env.example`](../../frontend/.env.example).
