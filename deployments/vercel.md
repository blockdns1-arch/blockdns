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

## Manual setup (no Vercel token)

Everything needed is committed, so the four projects can also be created from the dashboard
without any API token. The build settings are not typed in by hand:
[`frontend/vercel.json`](../frontend/vercel.json) already pins the framework, install command,
build command and output directory, so the dashboard only needs the repository and the env vars.

1. Push this repository to GitHub so Vercel can import it.
2. In Vercel: **Add New → Project → Import** `blockdns1-arch/blockdns`.
3. Project name `blockdns-home`, **Root Directory** `frontend`, framework Next.js (detected).
4. **Environment Variables**: paste the `blockdns-home` block from
   [`vercel-env.md`](vercel-env.md), then Deploy.
5. Repeat for `blockdns-swap`, `blockdns-explorer` and `blockdns-founder`, using the matching
   block each time. The only difference between the four is `NEXT_PUBLIC_SITE`.
6. Project → Settings → Deployment Protection → **Disabled**, otherwise the URLs ask for a login.

The env file is generated from the deployment manifest, so after a redeploy refresh it with:

```bash
npm run vercel:env > deployments/vercel-env.md
```

## Team accounts and keeping the sites public

The four projects usually live in a Vercel team, and a team-scoped token must send `teamId` on
every request. The script handles that for you:

```bash
npm run deploy:vercel -- --team=kinma39ol1        # team slug, as it appears in vercel.com/<slug>
# or
$env:VERCEL_TEAM_SLUG = 'kinma39ol1'
npm run deploy:vercel
```

If neither `VERCEL_TEAM_ID` nor `--team`/`VERCEL_TEAM_SLUG` is given, the script lists the teams
the token can reach and, when there is exactly one, uses it automatically. With more than one it
stops and asks which team to use, because creating the projects without the right `teamId` would
put them in the wrong account. The token itself must be created from inside the team
(`vercel.com/<team>/settings/tokens`) so it carries the team scope.

Team plans can turn on **deployment protection** — a Vercel password, Vercel Authentication or
OIDC — which would put a login prompt in front of all four URLs and hide the project from judges.
The script reads the protection settings of every project and removes them by default; pass
`--keep-protection` to leave them alone. Equivalent dashboard path:
**Project → Settings → Deployment Protection → Disabled**.

## Deploying

```bash
# 1. Create a token at https://vercel.com/account/tokens, then either
$env:VERCEL_TOKEN = 'xxx'          # PowerShell, current session
# or add VERCEL_TOKEN=xxx to the gitignored base-deploy.env at the repo root.
# For a team token, also pass --team=<slug> or set VERCEL_TEAM_SLUG=<slug>.

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
| `--team=<slug>` | Team that owns the projects, resolved to a team id |
| `--keep-protection` | Leaves password/SSO protection enabled instead of making sites public |

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
