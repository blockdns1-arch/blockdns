# BlockDNS Todos (comm/todos.md — read by /todos in Telegram)
0. GHDA (TOMORROW): resume Talent push —
   a. DONE ✅ score checked 2026-09-29: 7/285 (new model, browser-computed). Plan: Speed Run +12, Verified Onchain Builder via Chainlink call +20, forks 3->9 +3, followers 3->9 +1, repos 2->5 +1 -> ~43
   b. Speed Run Ethereum startup: Connect MetaMask (0x953B) + register on speedrunethereum.com, begin Challenge #00
   c. Book the Chainlink Labs call (calendar.app.google/mEgQcahffXL1BD4v5), accept MNDA review — Noel Wilamowski, Growth Management
   d. CRE API key still NOT created (button was broken); Data Streams creds saved in .env (gitignored). Create CRE Client ID once deploy access is granted
   e. ALCHEMY (in progress): key alch_SRgnKQqvHD0wOwsipNrPI VALIDATED (403 was origin allowlist, not key!). User saved "Allow all domains" on BlockDnsL2 app -> RETEST after propagation. Then build alchemy-nft-demo (dotenv + demo-script.js: getNFTsForOwner 0x953B + getNFTMetadata BAYC). Note: npx @alchemy/cli hung once; retry with npm i -g @alchemy/cli.
   f. Talent "0/285 partial" on 2026-09-30 = transient GitHub API 401 in browser; real = 7/285; ignore, re-check later.
1. Talent score UP: LAST 7/285 (old model). New model = browser-computed on talentprotocol.com/score (GitHub + 4 chains + SpeedRunEthereum + EAS). Targets: followers->9 +1, forks->5 +1, repos->4 +1, then Speed Run challenges (+1pt each, cap 12)
2. BLI Legal Tech hackathon: SUBMITTED 2026-09-29 ✅ under review + Chainlink CRE bounty APPLIED (2x$1k).
   - CRE workflow DONE ✅: domain-verify simulated with live data (tokenId=1, owner matched, GitHub exists, DNS NXDOMAIN, verified=true) → result in chainlink-cre/blockdns-cre/domain-verify/simulation-result.json, pushed to repo
   - Demo video DONE ✅ (1.5min, unlisted): https://youtu.be/v9GkrC4hxd4 — added to Manage Submission 2026-09-29
   - Deploy access REQUESTED 2026-09-29 ✅ (mail confirmed, ticket NNV99D-0NNXN) — awaiting Chainlink review email
   - Remaining: nothing for BLI now (all complete). Speed Run = next big win
3. Base Builder Grants: post X thread + Farcaster cast + nominate on Base Discord (VISIBILITY-KIT §5)
4. L1 from scratch: fix chain.js (usedIds, isCoinBaseAt), then wallet.js, CLI, demo, SPEC.md (backburner)
5. Optional: repoint social-agent watcher to Base Sepolia; give Telegram group a public username