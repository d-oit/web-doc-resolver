export interface Record {
  id: string;
  query: string;
  url: string | null;
  content: string;
  source: string;
  score: number;
  timestamp: number;
}

const DEFAULT_MAX_ENTRIES = 500;

interface RecordsConfig {
  maxEntries: number;
}

const store = new Map<string, Record>();
const order: string[] = []; // Track insertion order for FIFO eviction
let config: RecordsConfig = {
  maxEntries: DEFAULT_MAX_ENTRIES,
};

export function configure(newConfig: Partial<RecordsConfig>): void {
  config = { ...config, ...newConfig };
}

function evictOldest(count: number): void {
  const toRemove = order.slice(0, count);
  for (const id of toRemove) {
    store.delete(id);
  }
  order.splice(0, count);
}

export function save(record: Omit<Record, "id" | "timestamp">): Record {
  // Check if we need to evict
  if (store.size >= config.maxEntries) {
    // Evict 10% of entries
    const evictCount = Math.max(1, Math.floor(config.maxEntries * 0.1));
    evictOldest(evictCount);
  }

  const id = crypto.randomUUID();
  const full: Record = { ...record, id, timestamp: Date.now() };
  store.set(id, full);
  order.push(id);
  return full;
}

export function get(id: string): Record | undefined {
  return store.get(id);
}

export function list(limit = 50): Record[] {
  return Array.from(store.values())
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

export function search(query: string, limit = 50): Record[] {
  const q = query.toLowerCase();
  return list(limit).filter(
    (r) =>
      r.query.toLowerCase().includes(q) ||
      r.content.toLowerCase().includes(q) ||
      (r.url && r.url.toLowerCase().includes(q))
  );
}

export function size(): number {
  return store.size;
}

export function maxSize(): number {
  return config.maxEntries;
}