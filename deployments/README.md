# Deployments

## Public manifests

`public/` holds **public, secret-free** deployment records that are committed to the repo, so
anyone (judges, integrators, block explorers) can confirm that the protocol really is deployed and
running on a public network.

| File | Network | Chain ID |
| --- | --- | --- |
| [`public/base-sepolia.json`](public/base-sepolia.json) | Base Sepolia | `84532` |

Local deployment records written by the deploy scripts (`base-sepolia.json`, `l2.json`,
`hardhat.json`, `watch-state.json`) are **gitignored** — they are machine-local state, not part of
the public record.

## Reproducing a deployment

```bash
cp .env.example .env      # DEPLOYER_PRIVATE_KEY, BDNS_CAP, TREASURY_ADDRESS, ...
npm run deploy            # registry, token, pricer
npm run deploy:phase2     # marketplace, swap, bridge
npm run deploy:tokenomics # vesting vaults, staking vault, burn engine, splitter
```

Each script writes `deployments/<network>.json` with the resulting addresses. To publish a manifest,
copy the file into `public/` after removing anything sensitive (only addresses, chain id, owner and
timestamp are needed).

## Verification

Contracts deployed on Base Sepolia can be verified on Basescan:

```bash
npx hardhat verify --network base-sepolia <address> <constructor args...>
```

`base-deploy.env` holds the deployer key used for verification and is gitignored.