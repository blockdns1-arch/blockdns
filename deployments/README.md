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
cp .env.example .env      # RPC endpoints, caps, treasury, tokenomics allocation knobs
npm run deploy            # BDNS + L2CrossDomainMessenger
npm run deploy:phase2     # pricer, registry, resolver
npm run deploy:market     # marketplace
npm run deploy:tokenomics # royalty splitter, burn engine, staking vault, vesting vaults
npm run fund:swap-bridge  # swap + bridge (see note below)
npm run register:domain   # REGISTER_NAME=demo… registers a name on the registry
```

`deploy-swap-bridge.ts` deploys the swap and bridge in one step and then funds them. When it runs
before the tokenomics deployment it has no BDNS to send and reverts after the contracts are already
deployed. In that case export `SWAP_ADDRESS` / `BRIDGE_ADDRESS` and run `npm run fund:swap-bridge`
instead — it only transfers the missing liquidity and records the addresses in the local manifest:

```bash
SWAP_ADDRESS=0x… BRIDGE_ADDRESS=0x… npx hardhat run scripts/fund-swap-bridge.ts --network base-sepolia
```

Each script writes `deployments/<network>.json` with the resulting addresses. `npm run manifest:export`
regenerates the committed public manifest from that file, adding explorer and Sourcify links plus the
verification match status, so the public record can never drift from the deployment.

## Verification

All 15 Base Sepolia contracts are verified on Sourcify. No API key is required:

```bash
npm run verify:sourcify -- --network base-sepolia   # add --only <ContractKey> for one contract
```

The script picks the build-info whose source matches the working tree and whose compiled bytecode
length matches the deployed code, then submits the standard-JSON input to the Sourcify v2 API.

The same 15 contracts are also verified on Basescan through Etherscan V2, which needs a free
`ETHERSCAN_API_KEY` in `base-deploy.env`:

```bash
npm run verify:etherscan                              # add VERIFY_ONLY=BlockDNSwap for a subset
```

`scripts/verify-etherscan.ts` rebuilds every constructor argument from chain state and from the
deployment defaults, then submits all 15 contracts. Post-deployment setter changes — the swap rate,
for example — are pinned to the value the contract was constructed with, because the explorer matches
creation bytecode and not current storage.

`base-deploy.env` holds the deployer key and is gitignored.