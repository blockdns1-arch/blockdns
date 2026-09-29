import { isCidLike, checkCidBytes, type CidCheck } from "./cid";
import { sniffMime } from "./mime";

export type FetchedContent = {
  bytes: Buffer;
  contentType: string;
  source: string;
  cidCheck: CidCheck;
};

export type IpfsFetcherOptions = {
  gateways: string[];
  timeoutMs: number;
  maxBytes: number;
  gatewayConsensus: boolean;
  strictCidVerify: boolean;
};

export class AllGatewaysFailed extends Error {
  constructor() {
    super("all IPFS gateways failed");
  }
}

export class ContentTooLarge extends Error {
  constructor(size: number, max: number) {
    super(`content ${size} bytes exceeds limit ${max}`);
  }
}

export class CidMismatch extends Error {
  constructor(cid: string) {
    super(`content does not match on-chain CID ${cid}`);
  }
}

export class ConsensusMismatch extends Error {
  constructor(cid: string) {
    super(`gateways disagree on content for ${cid}`);
  }
}

export class IpfsFetcher {
  constructor(private readonly opts: IpfsFetcherOptions) {}

  private async fetchOnce(gateway: string, cid: string): Promise<{ bytes: Buffer; contentType: string }> {
    const url = `${gateway}/ipfs/${cid}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: controller.signal,
        headers: { Accept: "*/*" },
      });
      if (!res.ok) {
        throw new Error(`gateway ${gateway} returned ${res.status}`);
      }
      const contentType = res.headers.get("content-type") || "";
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length > this.opts.maxBytes) {
        throw new ContentTooLarge(bytes.length, this.opts.maxBytes);
      }
      return { bytes, contentType };
    } finally {
      clearTimeout(timer);
    }
  }

  async fetch(cid: string): Promise<FetchedContent> {
    if (!isCidLike(cid)) {
      throw new Error(`refusing to fetch invalid CID "${cid}"`);
    }

    let first: { bytes: Buffer; contentType: string; source: string } | null = null;
    const results: Array<{ bytes: Buffer; contentType: string; source: string }> = [];

    for (const gateway of this.opts.gateways) {
      try {
        const res = await this.fetchOnce(gateway, cid);
        const item = { ...res, source: gateway };
        results.push(item);
        if (!first) first = item;
        if (this.opts.gatewayConsensus && first && results.length >= 2) break;
      } catch {
        continue;
      }
    }

    if (!first) throw new AllGatewaysFailed();

    if (this.opts.gatewayConsensus) {
      const reference = first.bytes.toString("base64");
      for (const other of results) {
        if (other.bytes.toString("base64") !== reference) {
          throw new ConsensusMismatch(cid);
        }
      }
    }

    let cidCheck: CidCheck = { status: "not-a-leaf" };
    if (this.opts.strictCidVerify) {
      cidCheck = await checkCidBytes(cid, first.bytes);
      if (cidCheck.status === "mismatch" || cidCheck.status === "invalid-cid") {
        throw new CidMismatch(cid);
      }
    }

    const contentType = sniffMime(first.bytes, first.contentType);
    return { bytes: first.bytes, contentType, source: first.source, cidCheck };
  }
}