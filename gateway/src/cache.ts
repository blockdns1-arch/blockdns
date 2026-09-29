import type { ResolvedView } from "./resolver";

export type CacheValue = ResolvedView & { cachedAt: number };

export interface CacheBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

class MemoryCache implements CacheBackend {
  private store = new Map<string, { expiresAt: number; value: string }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

async function loadRedis(): Promise<{ new (url: string): CacheBackend } | null> {
  try {
    const mod = await import("ioredis");
    return class RedisCache implements CacheBackend {
      private client: InstanceType<typeof mod.Redis>;
      constructor(url: string) {
        this.client = new mod.Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
        this.client.on("error", () => {
          /* fall back to nothing; get/set handle missing client */
        });
      }
      private async ready(): Promise<void> {
        if (this.client.status === "wait") await this.client.connect();
      }
      async get(key: string): Promise<string | null> {
        try {
          await this.ready();
          return await this.client.get(`bdns:${key}`);
        } catch {
          return null;
        }
      }
      async set(key: string, value: string, ttlSeconds: number): Promise<void> {
        try {
          await this.ready();
          await this.client.set(`bdns:${key}`, value, "EX", ttlSeconds);
        } catch {
          /* ignore */
        }
      }
      async del(key: string): Promise<void> {
        try {
          await this.ready();
          await this.client.del(`bdns:${key}`);
        } catch {
          /* ignore */
        }
      }
    };
  } catch {
    return null;
  }
}

let redisClass: { new (url: string): CacheBackend } | null | undefined;

export async function createCache(
  redisUrl: string | null,
  fallback: CacheBackend = new MemoryCache()
): Promise<CacheBackend> {
  if (redisUrl) {
    if (redisClass === undefined) redisClass = await loadRedis();
    if (redisClass) return new redisClass(redisUrl);
  }
  return fallback;
}

export async function cacheGet(
  backend: CacheBackend,
  key: string
): Promise<CacheValue | null> {
  const raw = await backend.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CacheValue;
  } catch {
    return null;
  }
}

export function cacheSet(
  backend: CacheBackend,
  key: string,
  value: CacheValue,
  ttlSeconds: number
): Promise<void> {
  return backend.set(key, JSON.stringify(value), ttlSeconds);
}