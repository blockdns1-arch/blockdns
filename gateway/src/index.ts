import express, { type NextFunction, type Request, type Response } from "express";
import type { GatewayConfig } from "./config";
import { OnchainResolver, toView, type ResolvedView } from "./resolver";
import { IpfsFetcher } from "./ipfsFetcher";
import type { CacheBackend } from "./cache";
import { cacheGet, cacheSet } from "./cache";
import { parseHost, isValidName, normalizeName } from "./names";
import { buildCcipResponse, buildCcipLookupNotFound } from "./ccip";
import { charsetFor } from "./mime";

export type AppDeps = {
  resolver: OnchainResolver;
  fetcher: IpfsFetcher;
  cache: CacheBackend;
};

function errorPage(status: number, title: string, detail: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${status} - ${title}</title><style>body{font-family:system-ui,sans-serif;background:#0b0f19;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}main{text-align:center;max-width:560px;padding:2rem}h1{font-size:3rem;margin:0;color:#38bdf8}p{color:#94a3b8}a{color:#38bdf8;text-decoration:none}</style></head><body><main><h1>${status}</h1><h2>${title}</h2><p>${detail}</p><p><a href="https://blockdns.io">BlockDNS Gateway</a></p></main></body></html>`;
}

function apexPage(cfg: GatewayConfig): string {
  const redirect = cfg.apexRedirectUrl
    ? `<meta http-equiv="refresh" content="0;url=${cfg.apexRedirectUrl}">`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">${redirect}
  <title>BlockDNS - Decentralized Websites</title><style>
  body{font-family:system-ui,sans-serif;background:#0b0f19;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
  main{text-align:center;max-width:560px;padding:2rem}h1{font-size:2.4rem;margin:0;color:#38bdf8}p{color:#94a3b8}
  code{background:#1e293b;padding:.15rem .45rem;border-radius:6px;color:#7dd3fc}
  </style></head><body><main>
  <h1>BlockDNS</h1>
  <p>A decentralized naming system. This gateway resolves <code>.bdns</code> names to IPFS websites.</p>
  ${
    redirect
      ? ""
      : `<p>Visit a name like <code><a href="//example.bdns.link">example.bdns.link</a></code>.</p>`
  }
  </main></body></html>`;
}

function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.set({
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "X-BlockDNS-Gateway": "1",
  });
  next();
}

async function resolveWithCache(
  deps: AppDeps,
  cfg: GatewayConfig,
  name: string
): Promise<ResolvedView | null> {
  const key = `resolve:${name}`;
  const cached = await cacheGet(deps.cache, key);
  if (cached) return cached;

  const resolved = await deps.resolver.resolve(name);
  if (!resolved) return null;

  const view = toView(resolved);
  await cacheSet(deps.cache, key, { ...view, cachedAt: Date.now() }, cfg.cacheTtlSeconds);
  return view;
}

async function serveDomain(
  req: Request,
  res: Response,
  cfg: GatewayConfig,
  deps: AppDeps,
  name: string
): Promise<void> {
  const resolved = await resolveWithCache(deps, cfg, name);

  if (!resolved || !resolved.cid) {
    res
      .status(404)
      .send(errorPage(404, "Domain not registered", `${name}.bdns has no content record.`));
    return;
  }

  const etag = `"${resolved.cid}"`;
  if (req.headers["if-none-match"] === etag) {
    res.status(304).end();
    return;
  }

  const content = await deps.fetcher.fetch(resolved.cid);

  res.set({
    ETag: etag,
    "Cache-Control": `public, max-age=${cfg.cacheTtlSeconds}`,
    "X-BlockDNS-CID": resolved.cid,
    "X-BlockDNS-TokenId": resolved.tokenId,
    "X-BlockDNS-Owner": resolved.owner,
    "X-BlockDNS-Domain": `${name}.bdns`,
    "Content-Type": content.contentType + charsetFor(content.contentType),
  });
  res.send(content.bytes);
}

export function createApp(cfg: GatewayConfig, deps: AppDeps): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(securityHeaders);

  app.get("/health", (_req, res) => {
    res.json({ ok: true, chainId: cfg.chainId, gateway: "blockdns" });
  });

  app.get("/resolve/:name", async (req, res, next) => {
    try {
      const name = normalizeName(req.params.name);
      if (!isValidName(name)) {
        res.status(400).json({ error: "invalid domain name", name: req.params.name });
        return;
      }
      const resolved = await resolveWithCache(deps, cfg, name);
      if (!resolved) {
        res.status(404).json({ error: "domain not registered", name });
        return;
      }
      res.json({
        name: resolved.name,
        tokenId: resolved.tokenId,
        owner: resolved.owner,
        cid: resolved.cid,
        addresses: resolved.addresses,
      });
    } catch (err) {
      next(err);
    }
  });

  const ccipHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const name = normalizeName(req.params.name);
      if (!isValidName(name)) {
        res.status(400).json(buildCcipLookupNotFound(req.params.name));
        return;
      }
      const resolved = await resolveWithCache(deps, cfg, name);
      if (!resolved) {
        res.status(404).json(buildCcipLookupNotFound(name));
        return;
      }
      res.set({ "Access-Control-Allow-Origin": "*" });
      res.json(buildCcipResponse(resolved));
    } catch (err) {
      next(err);
    }
  };

  app.get("/ccip/:name", ccipHandler);
  app.post("/ccip/:name", ccipHandler);

  app.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = parseHost(req.headers.host || "", cfg.allowedSuffixes);

      if (parsed.kind !== "domain") {
        if (parsed.kind === "apex" || !req.headers.host) {
          res.send(apexPage(cfg));
          return;
        }
        res.status(404).send(errorPage(404, "Unsupported host", `This gateway only serves ${cfg.allowedSuffixes.join(", ")} subdomains.`));
        return;
      }

      await serveDomain(req, res, cfg, deps, parsed.name);
    } catch (err) {
      next(err);
    }
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    res.status(502).send(errorPage(502, "Gateway error", String(err instanceof Error ? err.message : err)));
  });

  return app;
}

async function main(): Promise<void> {
  const { loadConfig } = await import("./config");
  const { createCache } = await import("./cache");

  const cfg = loadConfig();
  const cache = await createCache(cfg.redisUrl);
  const resolver = new OnchainResolver(cfg);
  const fetcher = new IpfsFetcher({
    gateways: cfg.ipfsGateways,
    timeoutMs: cfg.requestTimeoutMs,
    maxBytes: cfg.maxContentBytes,
    gatewayConsensus: cfg.gatewayConsensus,
    strictCidVerify: cfg.strictCidVerify,
  });

  const app = createApp(cfg, { resolver, fetcher, cache });
  app.listen(cfg.port, () => {
    console.log(`[blockdns-gateway] listening on :${cfg.port} (chain ${cfg.chainId})`);
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[blockdns-gateway] fatal:", err);
    process.exit(1);
  });
}