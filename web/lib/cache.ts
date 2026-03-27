const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_MAX_SIZE = 1000;

interface CacheEntry {
  result: unknown;
  expiresAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  hitRate: number;
  maxSize: number;
}

interface CacheConfig {
  maxSize: number;
  defaultTtlMs: number;
}

let store = new Map<string, CacheEntry>();
let accessOrder: string[] = []; // Track access order for LRU eviction
let hits = 0;
let misses = 0;
let config: CacheConfig = {
  maxSize: DEFAULT_MAX_SIZE,
  defaultTtlMs: DEFAULT_TTL_MS,
};

async function makeKey(input: string, source: string): Promise<string> {
  const data = new TextEncoder().encode(`${input}::${source}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) {
      store.delete(key);
      accessOrder = accessOrder.filter((k) => k !== key);
    }
  }
}

function evictLRU(count: number): void {
  // Remove oldest entries (front of accessOrder)
  const toRemove = accessOrder.slice(0, count);
  for (const key of toRemove) {
    store.delete(key);
  }
  accessOrder = accessOrder.slice(count);
}

function touchKey(key: string): void {
  // Move key to end (most recently used)
  accessOrder = accessOrder.filter((k) => k !== key);
  accessOrder.push(key);
}

export function configure(newConfig: Partial<CacheConfig>): void {
  config = { ...config, ...newConfig };
}

export async function get(input: string, source: string): Promise<unknown | null> {
  const key = await makeKey(input, source);
  const entry = store.get(key);
  if (!entry) {
    misses++;
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    accessOrder = accessOrder.filter((k) => k !== key);
    misses++;
    return null;
  }
  hits++;
  touchKey(key);
  return entry.result;
}

export async function set(
  input: string,
  source: string,
  result: unknown,
  ttlMs: number = config.defaultTtlMs
): Promise<void> {
  const key = await makeKey(input, source);

  // Check if we need to evict
  if (store.size >= config.maxSize && !store.has(key)) {
    // Evict 10% of entries
    const evictCount = Math.max(1, Math.floor(config.maxSize * 0.1));
    evictLRU(evictCount);
  }

  store.set(key, { result, expiresAt: Date.now() + ttlMs });
  touchKey(key);
}

export function clear(): void {
  store = new Map();
  accessOrder = [];
  hits = 0;
  misses = 0;
}

export function stats(): CacheStats {
  evictExpired();
  const total = hits + misses;
  return {
    hits,
    misses,
    entries: store.size,
    hitRate: total > 0 ? hits / total : 0,
    maxSize: config.maxSize,
  };
}

export function size(): number {
  return store.size;
}