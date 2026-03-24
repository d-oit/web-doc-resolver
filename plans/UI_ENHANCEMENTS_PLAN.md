# Web UI Enhancements Plan

**Created**: 2026-03-24
**Last Updated**: 2026-03-24
**Status**: Planning
**Scope**: UI Provider Order, Cascade Logic, Clear Button, Vercel Persistence, History Feature

---

## Executive Summary

This plan addresses UI enhancements to ensure:
1. Provider order matches CLI cascade logic (exa_mcp → exa → tavily → serper → duckduckgo → mistral)
2. Inactive providers are excluded from resolution
3. Clear button to reset input/results
4. All settings saved to Vercel KV and restored on reload
5. History feature with load/save/delete on Vercel

---

## Current State Analysis

### UI Components (`web/app/page.tsx`)
- **PROVIDERS array** (lines 8-16): Hardcoded provider list, incorrect order
- **PROFILES array** (lines 18-23): Profile configurations with provider subsets
- **State management**: Uses localStorage + server sync via `/api/ui-state`
- **Active providers**: `activeProviders` computed from profile or manual selection

### Current Issues
1. **Wrong provider order**: UI shows `exa_mcp, jina, duckduckgo, serper, tavily, firecrawl, mistral`
2. **Missing cascade logic**: UI doesn't match CLI cascade order
3. **No clear button**: No way to clear input/results
4. **Limited persistence**: Only UI state (sidebar, advanced), not full configuration
5. **No history**: No way to save/load/delete past resolutions

---

## Phase 1: Fix Provider Order & Cascade Logic

### 1.1 Update PROVIDERS Array
**File**: `web/app/page.tsx` (lines 8-16)

**Current**:
```typescript
const PROVIDERS = [
  { id: "exa_mcp", label: "Exa MCP", free: true },
  { id: "jina", label: "Jina", free: true },
  { id: "duckduckgo", label: "DuckDuckGo", free: true },
  { id: "serper", label: "Serper", free: false },
  { id: "tavily", label: "Tavily", free: false },
  { id: "firecrawl", label: "Firecrawl", free: false },
  { id: "mistral", label: "Mistral", free: false },
];
```

**New** (matches CLI cascade order from `web/lib/routing.ts`):
```typescript
const PROVIDERS = [
  // Query providers (QUERY_CASCADE order)
  { id: "exa_mcp", label: "Exa MCP", free: true, type: "query" },
  { id: "exa", label: "Exa SDK", free: false, type: "query" },
  { id: "tavily", label: "Tavily", free: false, type: "query" },
  { id: "serper", label: "Serper", free: false, type: "query" },
  { id: "duckduckgo", label: "DuckDuckGo", free: true, type: "query" },
  { id: "mistral_websearch", label: "Mistral Search", free: false, type: "query" },
  // URL providers (URL_DEFAULT order)
  { id: "jina", label: "Jina", free: true, type: "url" },
  { id: "firecrawl", label: "Firecrawl", free: false, type: "url" },
  { id: "direct_fetch", label: "Direct Fetch", free: true, type: "url" },
  { id: "mistral_browser", label: "Mistral Browser", free: false, type: "url" },
];
```

### 1.2 Update PROFILES Array
**File**: `web/app/page.tsx` (lines 18-23)

**Current**:
```typescript
const PROFILES = [
  { id: "free", label: "Free", providers: ["exa_mcp", "jina", "duckduckgo"] },
  { id: "balanced", label: "Balanced", providers: ["exa_mcp", "serper", "jina", "duckduckgo"] },
  { id: "fast", label: "Fast", providers: ["serper", "exa_mcp"] },
  { id: "quality", label: "Quality", providers: ["tavily", "serper", "exa_mcp", "jina", "mistral"] },
];
```

**New** (matches cascade logic):
```typescript
const PROFILES = [
  {
    id: "free",
    label: "Free",
    description: "Only free providers, good quality",
    queryProviders: ["exa_mcp", "duckduckgo"],
    urlProviders: ["jina", "direct_fetch"],
  },
  {
    id: "fast",
    label: "Fast",
    description: "Low latency, 1 paid allowed",
    queryProviders: ["exa_mcp", "serper"],
    urlProviders: ["jina"],
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Best mix of speed and quality",
    queryProviders: ["exa_mcp", "tavily", "serper", "duckduckgo"],
    urlProviders: ["jina", "firecrawl", "direct_fetch"],
  },
  {
    id: "quality",
    label: "Quality",
    description: "Maximum quality, all providers",
    queryProviders: ["exa_mcp", "exa", "tavily", "serper", "duckduckgo", "mistral_websearch"],
    urlProviders: ["jina", "firecrawl", "direct_fetch", "mistral_browser"],
  },
];
```

### 1.3 Update Active Provider Logic
**File**: `web/app/page.tsx` (lines 184-187)

**Current**:
```typescript
const profileProviders = PROFILES.find(p => p.id === profile)?.providers || [];
const activeProviders = selectedProviders.length > 0 ? selectedProviders : profileProviders;
```

**New** (separate query vs URL providers):
```typescript
const currentProfile = PROFILES.find(p => p.id === profile);
const isQuery = !query.trim().startsWith("http");
const profileProviders = isQuery
  ? currentProfile?.queryProviders || []
  : currentProfile?.urlProviders || [];
const activeProviders = selectedProviders.length > 0
  ? selectedProviders.filter(id => {
      const p = PROVIDERS.find(pr => pr.id === id);
      return p && ((isQuery && p.type === "query") || (!isQuery && p.type === "url"));
    })
  : profileProviders;
```

### 1.4 Filter Inactive Providers in Request
**File**: `web/app/page.tsx` (line 127)

**Current**:
```typescript
providers: activeProviders,
```

**New** (ensure only available providers sent):
```typescript
providers: activeProviders.filter(id => {
  const provider = PROVIDERS.find(p => p.id === id);
  if (!provider) return false;
  // Free providers always available
  if (provider.free) return true;
  // Paid providers require API key
  const key = `${provider.id}_api_key` as keyof ApiKeys;
  return apiKeys[key] || keySource[provider.id] === "server";
}),
```

---

## Phase 2: Add Clear Button

### 2.1 Add Clear Button Component
**File**: `web/app/page.tsx`

Add after the Fetch button (line 406):
```typescript
{query.trim() && (
  <div className="flex items-center gap-2">
    <button
      onClick={() => handleSubmit()}
      disabled={loading}
      className="bg-[#00ff41] text-[#0c0c0c] px-4 py-2 text-[13px] font-bold hover:bg-[#00cc33] disabled:opacity-50 min-w-[60px] min-h-[44px]"
    >
      {loading ? "..." : "Fetch"}
    </button>
    <button
      onClick={() => {
        setQuery("");
        setResult("");
        setError("");
        setProviderStatus(null);
        setResolveTime(null);
        setSourceProvider(null);
      }}
      className="bg-transparent text-[#888] px-4 py-2 text-[13px] border-2 border-[#333] hover:border-[#00ff41] hover:text-[#00ff41] min-h-[44px]"
    >
      Clear
    </button>
  </div>
)}
```

---

## Phase 3: Enhance Vercel Persistence

### 3.1 Extend UI State Interface
**File**: `web/lib/ui-state.ts`

**Current**:
```typescript
export interface UiState {
  sidebarOpen: boolean;
  apiKeysOpen: boolean;
  showAdvanced: boolean;
  profile: string;
  selectedProviders: string[];
  maxChars: number;
  skipCache: boolean;
  deepResearch: boolean;
}
```

**New** (add history and full config):
```typescript
export interface UiState {
  // UI layout
  sidebarOpen: boolean;
  apiKeysOpen: boolean;
  showAdvanced: boolean;

  // Provider configuration
  profile: string;
  selectedProviders: string[];
  maxChars: number;
  skipCache: boolean;
  deepResearch: boolean;

  // Last query (optional, for convenience)
  lastQuery?: string;

  // History IDs (reference to Vercel KV)
  historyIds?: string[];
}

export interface HistoryEntry {
  id: string;
  query: string;
  url?: string | null;
  result: string;
  provider: string;
  timestamp: number;
  charCount: number;
  resolveTime: number;
}
```

### 3.2 Update UI State API for Vercel KV
**File**: `web/app/api/ui-state/route.ts`

Replace in-memory store with Vercel KV:
```typescript
import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';

const USE_KV = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

// Fallback in-memory store for local development
const memoryStore = new Map<string, Record<string, unknown>>();

function getSessionId(request: NextRequest): string {
  const existing = request.cookies.get('ui-session')?.value;
  if (existing) return existing;
  return crypto.randomUUID();
}

export async function GET(request: NextRequest) {
  const sessionId = getSessionId(request);

  if (USE_KV) {
    const state = await kv.get(`ui-state:${sessionId}`);
    const response = NextResponse.json(state || {});
    if (!request.cookies.get('ui-session')?.value) {
      response.cookies.set('ui-session', sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
      });
    }
    return response;
  }

  // Fallback: in-memory
  const state = memoryStore.get(sessionId) || {};
  const response = NextResponse.json(state);
  if (!request.cookies.get('ui-session')?.value) {
    response.cookies.set('ui-session', sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  }
  return response;
}

export async function POST(request: NextRequest) {
  const sessionId = getSessionId(request);
  try {
    const body = await request.json();

    if (USE_KV) {
      await kv.set(`ui-state:${sessionId}`, body, { ex: 60 * 60 * 24 * 365 });
    } else {
      memoryStore.set(sessionId, body);
    }

    const response = NextResponse.json({ ok: true });
    if (!request.cookies.get('ui-session')?.value) {
      response.cookies.set('ui-session', sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
      });
    }
    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}
```

---

## Phase 4: History Feature with Vercel KV

### 4.1 Create History API
**File**: `web/app/api/history/route.ts` (new)

```typescript
import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';

const USE_KV = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

// Fallback in-memory store
const memoryHistory = new Map<string, any[]>();

function getSessionId(request: NextRequest): string {
  return request.cookies.get('ui-session')?.value || 'default';
}

// GET /api/history - List history entries
export async function GET(request: NextRequest) {
  const sessionId = getSessionId(request);
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const query = searchParams.get('q');

  let entries: any[];

  if (USE_KV) {
    // Get history IDs for session
    const ids = await kv.lrange(`history:${sessionId}:ids`, 0, limit - 1);
    entries = await Promise.all(
      ids.map(async (id) => {
        const entry = await kv.get(`history:${sessionId}:${id}`);
        return entry;
      })
    );
    entries = entries.filter(Boolean);
  } else {
    entries = (memoryHistory.get(sessionId) || []).slice(0, limit);
  }

  // Optional search filter
  if (query) {
    const q = query.toLowerCase();
    entries = entries.filter(
      (e) =>
        e.query.toLowerCase().includes(q) ||
        (e.result && e.result.toLowerCase().includes(q))
    );
  }

  return NextResponse.json({ entries });
}

// POST /api/history - Save new history entry
export async function POST(request: NextRequest) {
  const sessionId = getSessionId(request);
  try {
    const body = await request.json();
    const id = crypto.randomUUID();
    const entry = {
      id,
      query: body.query || '',
      url: body.url || null,
      result: body.result || '',
      provider: body.provider || 'unknown',
      timestamp: Date.now(),
      charCount: body.charCount || 0,
      resolveTime: body.resolveTime || 0,
    };

    if (USE_KV) {
      // Store entry with 90-day TTL
      await kv.set(`history:${sessionId}:${id}`, entry, { ex: 60 * 60 * 24 * 90 });
      // Add to list (keep last 100)
      await kv.lpush(`history:${sessionId}:ids`, id);
      await kv.ltrim(`history:${sessionId}:ids`, 0, 99);
    } else {
      const list = memoryHistory.get(sessionId) || [];
      list.unshift(entry);
      memoryHistory.set(sessionId, list.slice(0, 100));
    }

    return NextResponse.json({ ok: true, id });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}

// DELETE /api/history?id=xxx - Delete specific entry
export async function DELETE(request: NextRequest) {
  const sessionId = getSessionId(request);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  if (USE_KV) {
    await kv.del(`history:${sessionId}:${id}`);
    await kv.lrem(`history:${sessionId}:ids`, 0, id);
  } else {
    const list = memoryHistory.get(sessionId) || [];
    memoryHistory.set(
      sessionId,
      list.filter((e) => e.id !== id)
    );
  }

  return NextResponse.json({ ok: true });
}
```

### 4.2 Create History UI Component
**File**: `web/app/components/History.tsx` (new)

```typescript
'use client';

import { useState, useEffect } from 'react';
import type { HistoryEntry } from '@/lib/ui-state';

interface HistoryProps {
  onLoad: (entry: HistoryEntry) => void;
}

export default function History({ onLoad }: HistoryProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = search ? `?q=${encodeURIComponent(search)}` : '';
      const res = await fetch(`/api/history${params}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchHistory();
  }, [isOpen, search]);

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/history?id=${id}`, { method: 'DELETE' });
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch {
      // Silent fail
    }
  };

  return (
    <div className="border-t-2 border-[#333]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between hover:bg-[#141414] transition-colors text-[11px] text-[#666]"
      >
        <span className="uppercase tracking-[0.1em]">
          History ({entries.length})
        </span>
        <span>{isOpen ? '▼' : '▶'}</span>
      </button>

      {isOpen && (
        <div className="px-4 pb-4">
          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search history..."
            className="w-full bg-[#141414] border-2 border-[#333] px-2 py-2 text-[11px] text-[#e8e6e3] placeholder:text-[#444] focus:border-[#00ff41] focus:outline-none mb-2"
          />

          {/* List */}
          <div className="max-h-[300px] overflow-y-auto">
            {loading ? (
              <div className="text-[10px] text-[#555] py-2">Loading...</div>
            ) : entries.length === 0 ? (
              <div className="text-[10px] text-[#555] py-2">No history yet</div>
            ) : (
              entries.map((entry) => (
                <div
                  key={entry.id}
                  className="border-b border-[#222] py-2 flex items-start gap-2 group"
                >
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => onLoad(entry)}
                      className="text-left text-[11px] text-[#e8e6e3] hover:text-[#00ff41] truncate block w-full"
                    >
                      {entry.query}
                    </button>
                    <div className="text-[9px] text-[#555] mt-1">
                      {entry.provider} · {entry.charCount.toLocaleString()} chars ·{' '}
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="text-[10px] text-[#444] hover:text-[#ff4444] opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

### 4.3 Integrate History into Main Page
**File**: `web/app/page.tsx`

1. Import History component:
```typescript
import History from '@/app/components/History';
```

2. Add history save function:
```typescript
const saveToHistory = async (data: {
  query: string;
  result: string;
  provider: string;
  charCount: number;
  resolveTime: number;
}) => {
  try {
    await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch {
    // Silent fail
  }
};
```

3. Call after successful resolution (line 144):
```typescript
// After setResult(...)
saveToHistory({
  query: query.trim(),
  result: data.markdown || data.result || '',
  provider: data.provider || activeProviders.join(', '),
  charCount: (data.markdown || data.result || '').length,
  resolveTime: Date.now() - startTime,
});
```

4. Add load handler:
```typescript
const handleHistoryLoad = (entry: HistoryEntry) => {
  setQuery(entry.query);
  setResult(entry.result);
  setSourceProvider(entry.provider);
  setResolveTime(entry.resolveTime);
  setCharCount(entry.charCount);
};
```

5. Add History component to sidebar (after API Keys section):
```typescript
<History onLoad={handleHistoryLoad} />
```

---

## Phase 5: Update UI State Persistence

### 5.1 Update UI State Save/Load
**File**: `web/app/page.tsx`

Add `lastQuery` to state save (line 81-101):
```typescript
const state = {
  sidebarOpen,
  apiKeysOpen,
  showAdvanced,
  profile,
  selectedProviders,
  maxChars,
  skipCache,
  deepResearch,
  lastQuery: query, // Save last query
};
```

Add restore on load (line 60-73):
```typescript
loadStateFromServer().then((serverState) => {
  const ui = serverState || loadUiState();
  setSidebarOpen(ui.sidebarOpen);
  setApiKeysOpen(ui.apiKeysOpen);
  setShowAdvanced(ui.showAdvanced);
  setProfile(ui.profile);
  setSelectedProviders(ui.selectedProviders);
  setMaxChars(ui.maxChars);
  setSkipCache(ui.skipCache);
  setDeepResearch(ui.deepResearch);
  if (ui.lastQuery) setQuery(ui.lastQuery); // Restore last query
  setLoaded(true);
  inputRef.current?.focus();
});
```

---

## Phase 6: Add Environment Variables

### 6.1 Update .env.example
**File**: `web/.env.example`

Add:
```bash
# Vercel KV (for history and settings persistence)
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

---

## Implementation Order

### Step 1: Provider Order & Cascade Logic
1. Update PROVIDERS array with correct order and type field
2. Update PROFILES array with separate query/url providers
3. Update active provider logic to filter by input type
4. Filter inactive providers in request body

### Step 2: Clear Button
1. Add Clear button next to Fetch button
2. Reset all relevant state on clear

### Step 3: Enhanced UI State Persistence
1. Extend UiState interface
2. Update ui-state API to use Vercel KV
3. Add lastQuery persistence

### Step 4: History Feature
1. Create history API route (GET, POST, DELETE)
2. Create History component
3. Integrate into sidebar
4. Save after each resolution
5. Add load/delete functionality

### Step 5: Testing
1. Test provider order matches CLI
2. Test inactive providers excluded
3. Test clear button functionality
4. Test settings persist across reload
5. Test history save/load/delete

---

## Acceptance Criteria

- [ ] Provider order in UI matches CLI cascade order
- [ ] Inactive providers (no API key for paid) are disabled/excluded
- [ ] Clear button resets input and results
- [ ] All settings (profile, providers, options) persist to Vercel
- [ ] Settings restore on page reload
- [ ] History saves each resolution automatically
- [ ] History entries can be loaded (restore query + result)
- [ ] History entries can be deleted
- [ ] History search works
- [ ] Works with Vercel KV (production) and in-memory fallback (local)

---

## File Changes Summary

### New Files
- `web/app/api/history/route.ts` - History CRUD API
- `web/app/components/History.tsx` - History UI component

### Modified Files
- `web/app/page.tsx` - Provider order, clear button, history integration
- `web/lib/ui-state.ts` - Extended interface with history support
- `web/app/api/ui-state/route.ts` - Vercel KV integration
- `web/.env.example` - Add KV env vars

---

## Notes

- Cascade order sourced from `web/lib/routing.ts` (QUERY_CASCADE, URL_DEFAULT)
- Free providers: exa_mcp, duckduckgo, jina, direct_fetch
- Paid providers: exa, tavily, serper, mistral_websearch, firecrawl, mistral_browser
- History TTL: 90 days
- UI state TTL: 1 year
- In-memory fallback ensures local dev works without Vercel KV
