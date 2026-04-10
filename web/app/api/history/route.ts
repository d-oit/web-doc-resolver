import { NextRequest, NextResponse } from "next/server";

// In-memory store for local development (will be replaced with Vercel KV in production)
const memoryHistory = new Map<string, HistoryEntry[]>();

interface HistoryEntry {
  id: string;
  query: string;
  url: string | null;
  result: string;
  provider: string;
  timestamp: number;
  charCount: number;
  resolveTime: number;
  profile?: string;
  flags?: {
    skipCache?: boolean;
    deepResearch?: boolean;
  };
  providers?: string[];
  normalizedUrlHashes?: string[];
}

const MAX_HISTORY = 100;
const TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

function getSessionId(request: NextRequest): string {
  const existing = request.cookies.get("ui-session")?.value;
  if (existing) return existing;
  return crypto.randomUUID();
}

// GET /api/history - List history entries
export async function GET(request: NextRequest) {
  const sessionId = getSessionId(request);
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");
  const query = searchParams.get("q");

  let entries = memoryHistory.get(sessionId) || [];

  // Filter out expired entries
  const now = Date.now();
  entries = entries.filter((e) => now - e.timestamp < TTL_MS);

  // Optional search filter
  if (query) {
    const q = query.toLowerCase();
    entries = entries.filter(
      (e) =>
        e.query.toLowerCase().includes(q) ||
        (e.result && e.result.toLowerCase().includes(q))
    );
  }

  const response = NextResponse.json({
    entries: entries.slice(0, limit),
  });

  // Set cookie if not already set
  if (!request.cookies.get("ui-session")?.value) {
    response.cookies.set("ui-session", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }

  return response;
}

function normalizeHashes(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const values = input
    .filter((value) => typeof value === "string")
    .map((value: string) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(values));
}

function hasOverlap(a: string[] = [], b: string[] = []): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const set = new Set(a);
  return b.some((hash) => set.has(hash));
}

// POST /api/history - Save new history entry
export async function POST(request: NextRequest) {
  const sessionId = getSessionId(request);

  try {
    const body = await request.json();
    const id = crypto.randomUUID();
    const normalizedUrlHashes = normalizeHashes(body.normalizedUrlHashes);
    const entry: HistoryEntry = {
      id,
      query: body.query || "",
      url: body.url || null,
      result: body.result || "",
      provider: body.provider || "unknown",
      timestamp: Date.now(),
      charCount: body.charCount || 0,
      resolveTime: body.resolveTime || 0,
      profile: body.profile || undefined,
      flags: body.flags || undefined,
      providers: Array.isArray(body.providers) ? body.providers : undefined,
      normalizedUrlHashes,
    };

    // Get or create history list
    let entries = memoryHistory.get(sessionId) || [];

    // Remove duplicates that target the same set of URLs
    if (normalizedUrlHashes.length > 0) {
      entries = entries.filter((existing) => !hasOverlap(existing.normalizedUrlHashes, normalizedUrlHashes));
    }

    // Add to front
    entries.unshift(entry);

    // Limit to MAX_HISTORY
    if (entries.length > MAX_HISTORY) {
      entries = entries.slice(0, MAX_HISTORY);
    }

    memoryHistory.set(sessionId, entries);

    const response = NextResponse.json({ ok: true, id });

    // Set cookie if not already set
    if (!request.cookies.get("ui-session")?.value) {
      response.cookies.set("ui-session", sessionId, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      });
    }

    return response;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}

// DELETE /api/history?id=xxx - Delete specific entry
export async function DELETE(request: NextRequest) {
  const sessionId = getSessionId(request);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const entries = memoryHistory.get(sessionId) || [];
  const filtered = entries.filter((e) => e.id !== id);
  memoryHistory.set(sessionId, filtered);

  return NextResponse.json({ ok: true });
}
