const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  result: unknown;
  expiresAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  hitRate: number;
}

let store = new Map<string, CacheEntry>();
let hits = 0;
let misses = 0;

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
    if (entry.expiresAt <= now) store.delete(key);
  }
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
    misses++;
    return null;
  }
  hits++;
  return entry.result;
}

export async function set(
  input: string,
  source: string,
  result: unknown,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<void> {
  const key = await makeKey(input, source);
  store.set(key, { result, expiresAt: Date.now() + ttlMs });
}

export function clear(): void {
  store = new Map();
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
  };
}
