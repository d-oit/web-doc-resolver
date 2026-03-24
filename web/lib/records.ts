export interface Record {
  id: string;
  query: string;
  url: string | null;
  content: string;
  source: string;
  score: number;
  timestamp: number;
}

const store = new Map<string, Record>();

export function save(record: Omit<Record, "id" | "timestamp">): Record {
  const id = crypto.randomUUID();
  const full: Record = { ...record, id, timestamp: Date.now() };
  store.set(id, full);
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
  return store.delete(id);
}

export function clear(): number {
  const count = store.size;
  store.clear();
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
