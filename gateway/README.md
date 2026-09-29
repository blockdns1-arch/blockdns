# BlockDNS Gateway - Universal DNS Resolver & IPFS Proxy

Resolves `.bdns` names (e.g. `mywebsite.bdns.link` or a local `mywebsite.bdns`) to
IPFS-hosted websites by querying `BlockDNSRegistry.sol` on the BlockDNS L2 chain.
Built with Node.js + TypeScript, Express, viem, and a 3-tier IPFS gateway fallback.

## Architecture

```
Browser ──> *.bdns.link ──> Gateway (Express, :8080)
                              │ 1. parse host → name
                              │ 2. cache lookup (Redis / in-memory, 60s)
                              │ 3. viem read on BlockDNS L2 (registry.resolveName
                              │    → tokenId → ipfsCIDOf / ownerOf)
                              │ 4. content-addressed fetch over IPFS gateways
                              │    (dEDICATED kubo node → Cloudflare → Pinata)
                              │    optional: dual-gateway byte consensus + CID verify
                              └─> stream bytes + correct MIME types back to browser
```

## Files

| File | Purpose |
| --- | --- |
| `src/index.ts` | Express app: health, JSON resolve, CCIP-Read (ERC-3668) endpoints, wildcard host handler, error pages |
| `src/resolver.ts` | viem `OnchainResolver` reading `BlockDNSRegistry.sol` (+ optional `BlockDNSResolver.sol` cross-check) |
| `src/ipfsFetcher.ts` | Multi-gateway IPFS fetch with timeout, size cap, consensus compare, strict CID verification |
| `src/cid.ts` | Cryptographic check that fetched bytes match the on-chain CID (dag-pb / raw codecs) |
| `src/cache.ts` | Redis-backed cache (falls back to in-memory Map when `REDIS_URL` is unset) |
| `src/names.ts` | Host-header parsing + `.bdns` name validation |
| `src/ccip.ts` | ERC-3668 `{ data }` responses for MetaMask / Brave |
| `src/mime.ts` | MIME type sniffing for IPFS content |
| `Dockerfile` / `docker-compose.yml` | Production deployment with Redis + local IPFS node |

## Running locally

```bash
cd gateway
cp .env.example .env          # edit REGISTRY_ADDRESS etc.
npm install                   # prefer: --registry=https://registry.npmjs.org
npm run dev                   # tsx watch :8080
```

Unit tests: `npm test` (host parsing, CID verification, cache). Typecheck: `npm run typecheck`.

Verify with curl:

```bash
curl -H "Host: mywebsite.bdns.link" http://127.0.0.1:8080/
curl http://127.0.0.1:8080/resolve/mywebsite          # JSON record
curl http://127.0.0.1:8080/ccip/mywebsite             # CCIP-Read {data}
curl http://127.0.0.1:8080/health
```

## Environment

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `8080` | Gateway HTTP port |
| `L2_RPC_URL` | `http://127.0.0.1:9545` | BlockDNS L2 RPC |
| `L2_CHAIN_ID` | `8461` | BlockDNS L2 chain id |
| `REGISTRY_ADDRESS` | required | `BlockDNSRegistry.sol` on L2 |
| `RESOLVER_ADDRESS` | — | optional `BlockDNSResolver.sol`; enables on-chain cross-check |
| `ALLOWED_HOST_SUFFIXES` | `.bdns.link,.bdns` | comma-separated wildcard suffixes |
| `CACHE_TTL_SECONDS` | `60` | domain→CID cache TTL |
| `REDIS_URL` | — | `redis://...`; unset → in-memory cache |
| `IPFS_GATEWAYS` | Cloudflare, Pinata | ordered fallback list (local kubo first in Docker) |
| `GATEWAY_CONSENSUS` | `true` | require 2 gateways to return identical bytes |
| `STRICT_CID_VERIFY` | `true` | reject content that fails on-chain CID verification |
| `MAX_CONTENT_BYTES` | `20971520` | 20 MB per response |
| `REQUEST_TIMEOUT_MS` | `8000` | per-gateway fetch timeout |
| `APEX_REDIRECT_URL` | `https://blockdns.io` | where `bdns.link` itself redirects |

## Wildcard DNS setup

BlockDNS registers real domains (`bdns.link`) and serves names as wildcard subdomains.

### A record (recommended, single IP)

```dns
*.bdns.link    A     1.2.3.4        ; point to the gateway server IP
bdns.link      A     1.2.3.4
```

### CNAME record (behind a load balancer / CDN)

```dns
*.bdns.link    CNAME  gateway.blockdns.io.
```

Cloudflare note: enable **"always use HTTPS"** and set an **origin rule** on the
gateway so `Host` isn't rewritten; the gateway keys off the `Host` header.

### Testing locally with fake `.bdns` names

No real TLD required to test:

```bash
# Windows (Elevated cmd): hostname resolution
notepad C:\Windows\System32\drivers\etc\hosts
# add:
127.0.0.1  mywebsite.bdns
```

```bash
# Linux/macOS: /etc/hosts
127.0.0.1  mywebsite.bdns
```

Then `curl -H "Host: mywebsite.bdns" http://127.0.0.1:8080/` or open `mywebsite.bdns:8080`.

## Security model (anti-hijacking)

1. **Ownership** - a name only resolves if an NFT holder owns it; `resolveName()`
   returns `0` for unregistered names. Record writes are owner-restricted in the
   Registry (protected by unit tests).
2. **Content addressing** - bytes are fetched *only* from the on-chain CID, via
   `/ipfs/<cid>` paths that gateways validate. `STRICT_CID_VERIFY` recomputes the
   dag-pb/raw hash of the returned bytes and rejects hash mismatches.
3. **Consensus** - with `GATEWAY_CONSENSUS=true`, two independent gateways must
   return byte-identical content, so a single compromised gateway cannot serve
   different bytes.
4. **Validation** - invalid hosts / nested subdomains / non-registered names get
   404/error pages; CIDs are strictly validated before any fetch (no SSRF).

## CCIP-Read (ERC-3668) for wallets

Gateway exposes `GET|POST /ccip/{name}` returning `{ data: 0x… }` ABI-encoded as
`(string ipfsCID, string eth, string btc, string sol)` - the standard payload a
contract emitting `OffchainLookup` hands to MetaMask / Brave. A companion
`BlockDNSResolver.sol` upgrade emitting `OffchainLookup` is planned for Phase 5.

## Docker deployment

```bash
cd gateway
cp .env.example .env
# set REGISTRY_ADDRESS (required), optionally L2_RPC_URL, IPFS_GATEWAYS
docker compose up -d --build
docker compose ps            # gateway + redis + ipfs
curl $(docker port blockdns-gateway 8080/tcp | sed 's/.*://' ...) # or via :80
```

- `git clone` should exclude `deployments/` (contract artifacts) from image build.
- The kubo IPFS node caches blocks locally; add your website content to it for
  fast local serving: `docker compose exec ipfs ipfs add -r ./your-site`.