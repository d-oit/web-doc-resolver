export interface StoredRecord {
  id: string;
  query: string;
  url: string | null;
  content: string;
  source: string;
  score: number;
  timestamp: number;
}

// Re-export as Record for backward compatibility
export type Record = StoredRecord;

// Environment-based configuration with defaults
const DEFAULT_MAX_ENTRIES = parseInt(process.env.RECORDS_MAX_SIZE || "100", 10);
const DEFAULT_TTL_DAYS = parseInt(process.env.RECORDS_TTL_DAYS || "30", 10);
const DEFAULT_TTL_MS = DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000;

interface RecordsConfig {
  maxEntries: number;
  ttlMs: number;
}

const store = new Map<string, StoredRecord>();
const order: string[] = []; // Track insertion order for FIFO eviction
let config: RecordsConfig = {
  maxEntries: DEFAULT_MAX_ENTRIES,
  ttlMs: DEFAULT_TTL_MS,
};

export function configure(newConfig: Partial<RecordsConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Check if a record has expired based on TTL
 */
function isExpired(record: StoredRecord): boolean {
  const age = Date.now() - record.timestamp;
  return age > config.ttlMs;
}

/**
 * Clean up expired records from the store
 */
function cleanupExpired(): void {
  const now = Date.now();
  const expiredIds: string[] = [];

  for (const [id, record] of store.entries()) {
    if (now - record.timestamp > config.ttlMs) {
      expiredIds.push(id);
    }
  }

  for (const id of expiredIds) {
    store.delete(id);
    const idx = order.indexOf(id);
    if (idx > -1) order.splice(idx, 1);
  }
}

function evictOldest(count: number): void {
  const toRemove = order.slice(0, count);
  for (const id of toRemove) {
    store.delete(id);
  }
  order.splice(0, count);
}

export function save(record: Omit<StoredRecord, "id" | "timestamp">): StoredRecord {
  // Clean up expired records periodically
  cleanupExpired();

  // Check if we need to evict
  if (store.size >= config.maxEntries) {
    // Evict 10% of entries
    const evictCount = Math.max(1, Math.floor(config.maxEntries * 0.1));
    evictOldest(evictCount);
  }

  const id = crypto.randomUUID();
  const full: StoredRecord = { ...record, id, timestamp: Date.now() };
  store.set(id, full);
  order.push(id);
  return full;
}

export function get(id: string): StoredRecord | undefined {
  const record = store.get(id);
  if (record && isExpired(record)) {
    // Remove expired record on access
    store.delete(id);
    const idx = order.indexOf(id);
    if (idx > -1) order.splice(idx, 1);
    return undefined;
  }
  return record;
}

export function list(limit = 50): StoredRecord[] {
  cleanupExpired();
  return Array.from(store.values())
    .filter((r) => !isExpired(r))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

export function remove(id: string): boolean {
  const existed = store.delete(id);
  if (existed) {
    const idx = order.indexOf(id);
    if (idx > -1) order.splice(idx, 1);
  }
  return existed;
}

export function clear(): number {
  const count = store.size;
  store.clear();
  order.length = 0;
  return count;
}

export function search(query: string, limit = 50): StoredRecord[] {
  const q = query.toLowerCase();
  cleanupExpired();
  return list(limit).filter(
    (r) =>
      r.query.toLowerCase().includes(q) ||
      r.content.toLowerCase().includes(q) ||
      (r.url && r.url.toLowerCase().includes(q))
  );
}

export function size(): number {
  cleanupExpired();
  return store.size;
}

export function maxSize(): number {
  return config.maxEntries;
}

/**
 * Get analytics statistics about the records store
 */
export function getAnalytics(): {
  totalRecords: number;
  maxRecords: number;
  providerUsage: { [key: string]: number };
  averageScore: number;
  oldestRecord: number | null;
  newestRecord: number | null;
  ttlDays: number;
} {
  cleanupExpired();
  const records = Array.from(store.values());
  
  // Provider usage stats
  const providerUsage: { [key: string]: number } = {};
  records.forEach((r) => {
    providerUsage[r.source] = (providerUsage[r.source] || 0) + 1;
  });

  // Average score
  const avgScore = records.length > 0
    ? records.reduce((sum, r) => sum + r.score, 0) / records.length
    : 0;

  // Oldest and newest timestamps
  const timestamps = records.map((r) => r.timestamp);
  const oldestRecord = timestamps.length > 0 ? Math.min(...timestamps) : null;
  const newestRecord = timestamps.length > 0 ? Math.max(...timestamps) : null;

  return {
    totalRecords: records.length,
    maxRecords: config.maxEntries,
    providerUsage,
    averageScore: Math.round(avgScore * 100) / 100,
    oldestRecord,
    newestRecord,
    ttlDays: config.ttlMs / (24 * 60 * 60 * 1000),
  };
}