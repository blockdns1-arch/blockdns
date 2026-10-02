# Talent Setup — 20 minutes, unlocks recurring ETH (Big Bang)

> **Status 2026-10-02:** profile connected for `0x953BaA88c280df9e59C149BC5aB9B9ec64E45323`
> (score **9/285**), GitHub `@blockdns1-arch` linked and verified. Base Sepolia deployment is live:
> 15/15 contracts verified on Sourcify **and** on Basescan, and `demouplk` registered on-chain.
> Re-check the score after the explorer indexes the new deployment.

> Verified from docs.talentprotocol.com (Sep 2026):
> - Scoring = **public onchain + GitHub data** — "no applications, no posting, just shipping".
> - Data points that count for Base: Contracts Deployed (MAINNET + **TESTNET**), Verified
>   Smart Contracts, Total Base Contract Fees, First Transaction, Basename, GitHub contributions,
>   outgoing txs.
> - Payouts go to: (1) primary Farcaster wallet, else (2) **first wallet connected to the Talent profile**.
> - Reward distribution is per **wallet** → we give Talent OUR deployer wallet so its Base Sepolia
>   contracts + repo activity all count under one identity.
> - Live campaigns (talent.app/~/earn): "Top Base Builders" 2-5 ETH per round.
> - Extra (cheap score): **verify contracts on Basescan** (free) and keep linking verified
>   deployments to the wallet.

## STEP A — prepare the wallet (0 money, 5 min)
1. Get the **deployer private key** for `0x953BaA88c280df9e59C149BC5aB9B9ec64E45323`
   from `base-deploy.env` (`BASE_DEPLOYER_PRIVATE_KEY`) — needed to sign in on talent.app.
   > Security note: use a browser you trust; talent.app is known-good. The wallet only holds
   > testnet funds (≈0.039 ETH Base Sepolia + a little L1). Never paste the key in chat/sites.

## STEP B — GitHub identity (5 min)
2. Ensure the GitHub account that owns/pushes `github.com/<owner>/blockdns` is logged in
   (this is the account whose "contributions" feed the score). If the repo is under a different
   owner, either (a) fork/mirror to the personal account and push (I can do the mirroring), or
   (b) add a `.github` note — simplest = mirror to the personal account today; commits already exist.

## STEP C — talent.app profile (10 min)
3. Go to `https://talent.app` → **Sign up** → **wallet sign-in** → connect with the **deployer wallet**.
4. In profile settings: **connect GitHub** (same account from Step B).
5. Optional but boosts: connect Farcaster if you own an account; add X (`@BlockDnsL2`).
6. Check your score at `https://talentprotocol.com/score` with address
   `0x953BaA88c280df9e59C149BC5aB9B9ec64E45323` — you should already see points from
   testnet deployments + repo commits (I can query this API for you once profile exists).

## What this unlocks
- Entry into **Top Base Builders** rounds (needs only the profile; contract/testnet + GitHub data
  are already live).
- Once mainnet ever exists or basename minted → score jumps (Basename ≈ +strong).
- One round = 2-5 ETH ≈ $5,000-12,000 → covers the whole **$1000 mainnet budget**.

## After signup: tell me
Reply with "talent done" and the connected address — I'll then:
- verify the score via the Talent API,
- drive weekly GitHub/onchain activity to climb the round leaderboard,
- prep the X/Farcaster posts that feed the "Talent Rewards (USD)" column.