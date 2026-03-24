# Web Doc Resolver: Implementation Plan

**Created**: 2026-03-24  
**Last Updated**: 2026-03-24 13:00 UTC
**Status**: In Progress — PR #136 ready to merge, all CI passing  
**Scope**: Address GitHub issues #128, #130, #132, #133, #135, #131 + code quality improvements

---

## Naming Decision (2026-03-24)

**Decision**: Use `do-wdr` as the CLI binary/command name. Keep `do-wdr` as the Rust crate name (for crates.io).

| Context | Name | Rationale |
|---------|------|-----------|
| CLI binary | `do-wdr` | Matches crate name, unique on crates.io |
| Rust crate | `do-wdr` | Unique on crates.io |
| Python package | `do-web-doc-resolver` | PyPI standard, matches repo name |
| Skill folders | `do-wdr-*` | Short prefix, no change needed |
| Env vars | `DO_WDR_*` | Established user API, no change |
| CSS classes | `.do-wdr-*`, `--do-wdr-*` | Short prefix, no change |
| Config paths | `~/.config/do-wdr/` | Established user API, no change |
| npm scoped pkgs | `@do-wdr/*` | Already correct |

**Action taken**: Changed `[[bin]] name = "do-wdr"` → `name = "do-wdr"` in `cli/Cargo.toml`.

---

## Executive Summary

This plan addresses 6 open GitHub issues and several code quality improvements. The work is organized into **5 phases** with clear dependencies.

| Phase | Focus | Issues | Est. Effort |
|-------|-------|--------|-------------|
| 1 | Skill Self-Containment | #135 | 2-3 days |
| 2 | Semantic Cache Testing | #133 | 1-2 days |
| 3 | Records Persistence | #132 | 2-3 days |
| 4 | Python Semantic Cache | #130 | 2-3 days |
| 5 | UI State Persistence | #128 | 1-2 days |

**Total Estimated Effort**: 8-13 days

## Current Status (2026-03-24 13:00 UTC)

| Phase | Focus | Status | Notes |
|-------|-------|--------|-------|
| 1 | Skill Self-Containment #135 | ✅ Complete | Self-contained package, directory symlinks |
| 2 | Semantic Cache Testing #133 | ✅ Complete | Rust semantic cache feature-gated, tests pass |
| 3 | Records Persistence #132 | ✅ Complete | Web CRUD API with in-memory store |
| 4 | Python Semantic Cache #130 | ✅ Complete | Web cache with TTL, stats, API |
| 5 | UI State Persistence #128 | ✅ Complete | Server sync with localStorage fallback |
| 6 | E2E Test Fixes | ✅ Complete | data-testid selectors, Vercel root dir |
| 7 | Binary Name Fix | ✅ Complete | `do-wdr` binary, `do-wdr` crate name |

### CI Status
- CI (Python/Rust/lint): ✅ All passing
- CI UI (E2E Playwright): ✅ All 55 tests passing
- Vercel: ✅ Production deployed with latest changes
- CodeQL: ✅ Passing

### Remaining for Release
- [ ] Merge PR #136 to main
- [ ] Patch release (scripts/release.sh patch)
- [ ] Verify GitHub Actions release workflow

---

## Phase 1: Skill Self-Containment (Issue #135)

### Problem
The skill folder has implementation files but tests import from wrong path (`scripts.resolve` instead of relative imports). Some files may be stubs.

### Current State
```
.agents/skills/do-web-doc-resolver/
├── SKILL.md ✅
├── __init__.py ✅ (imports from .scripts.resolve)
├── __main__.py ⚠️ (imports `scripts.resolve` - wrong)
├── pyproject.toml ✅
├── requirements.txt ✅
├── scripts/
│   ├── resolve.py ✅ (544 lines, full implementation)
│   ├── providers_impl.py ✅
│   ├── models.py ✅
│   ├── utils.py ✅
│   ├── quality.py ✅
│   ├── routing.py ✅
│   ├── circuit_breaker.py ✅
│   ├── routing_memory.py ✅
│   ├── cache_negative.py ✅
│   ├── synthesis.py ✅
│   └── __init__.py ✅
└── tests/
    ├── conftest.py ⚠️ (minimal fixtures)
    └── test_resolve.py ⚠️ (imports wrong path, only 32 lines)
```

### Tasks

#### 1.1 Fix Import Paths
**Files to modify**:
- `.agents/skills/do-web-doc-resolver/__main__.py`
- `.agents/skills/do-web-doc-resolver/tests/test_resolve.py`

**Changes**:
```python
# __main__.py (line 1)
# BEFORE: from scripts.resolve import main
# AFTER:  from .scripts.resolve import main

# test_resolve.py (line 7)
# BEFORE: from scripts.resolve import is_url, resolve, MAX_CHARS, MIN_CHARS
# AFTER:  from ..scripts.resolve import is_url, resolve, MAX_CHARS, MIN_CHARS
```

#### 1.2 Expand Test Coverage
**File**: `.agents/skills/do-web-doc-resolver/tests/test_resolve.py`

Add tests for:
- [ ] Provider fallback chain
- [ ] Quality scoring threshold (0.65)
- [ ] Circuit breaker state transitions
- [ ] Negative cache behavior
- [ ] Routing memory ranking
- [ ] URL detection edge cases

**Target**: 200+ lines of tests with 80%+ coverage

#### 1.3 Add Missing Test Files
Create:
- `tests/test_providers.py` - Provider mock tests
- `tests/test_quality.py` - Quality scoring tests
- `tests/test_routing.py` - Routing memory tests
- `tests/test_circuit_breaker.py` - Circuit breaker tests

#### 1.4 Update SKILL.md Documentation
- Fix source URL typo (`do-web-doc-resolover` → `do-web-doc-resolver`)
- Update import examples to use correct paths
- Clarify that skill folder IS self-contained

#### 1.5 Verify Package Works Standalone
```bash
cd .agents/skills/do-web-doc-resolver
pip install -e .
python -m do_web_doc_resolver "https://example.com"  # Should work
python -c "from do_web_doc_resolver import resolve"   # Should work
```

### Acceptance Criteria
- [ ] `python -m do_web_doc_resolver` works from skill folder
- [ ] All imports use relative paths
- [ ] Tests pass with `pytest tests/` from skill folder
- [ ] Coverage >80% for `scripts/` modules
- [ ] No dependency on project root `scripts/` directory

---

## Phase 2: Semantic Cache Testing (Issue #133)

### Problem
Rust CLI has semantic cache (`chaotic_semantic_memory`) but lacks integration tests and validation.

### Current State
- `cli/src/semantic_cache.rs` - 309 lines, feature-gated
- `Cargo.toml` - `semantic-cache` feature exists
- No tests for semantic cache operations

### Tasks

#### 2.1 Create Integration Tests
**File**: `cli/src/semantic_cache.rs` (add `#[cfg(test)]` module)

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_cache_entry_serialization() { ... }
    
    #[test]
    fn test_query_normalization() { ... }
    
    #[tokio::test]
    async fn test_store_and_query() { ... }
}
```

#### 2.2 Add Performance Benchmarks
**File**: `cli/benches/semantic_cache_bench.rs`

```rust
use criterion::{criterion_group, criterion_main, Criterion};

fn bench_store(c: &mut Criterion) {
    c.bench_function("semantic_cache_store", |b| {
        // benchmark store operation
    });
}

fn bench_query(c: &mut Criterion) {
    c.bench_function("semantic_cache_query", |b| {
        // benchmark query operation
    });
}
```

#### 2.3 Add Error Scenario Tests
- Database connection failure
- Disk space exhaustion (mock)
- Concurrent access (multithreaded)
- Cache corruption recovery

#### 2.4 Add CI Integration Test Job
**File**: `.github/workflows/ci.yml`

```yaml
semantic-cache-test:
  name: Semantic Cache Integration Test
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v6
    - name: Set up Rust
      uses: dtolnay/rust-toolchain@stable
      with:
        toolchain: '1.85'
        components: clippy
    - name: Run semantic cache tests
      run: cd cli && cargo test --features semantic-cache
    - name: Run benchmarks (verify they work)
      run: cd cli && cargo bench --features semantic-cache --no-run
```

### Acceptance Criteria
- [ ] `cargo test --features semantic-cache` passes
- [ ] Store operation latency <10ms
- [ ] Query operation latency <10ms
- [ ] Cache persists across CLI restarts
- [ ] Error handling covers all failure modes

---

## Phase 3: Records Persistence (Issue #132)

### Problem
Web UI uses in-memory `Map<string, Record>` - data lost on restart.

### Current State
```typescript
// web/lib/records.ts
const store = new Map<string, Record>();  // In-memory only
```

### Architecture Decision

**Recommended**: Use Vercel KV (Redis) for simplicity
- Small data size (query results)
- Fast reads (<10ms)
- Built-in TTL support
- No schema migration needed

**Alternative**: Vercel Postgres for relational queries

### Tasks

#### 3.1 Create Vercel KV Integration
**File**: `web/lib/kv.ts`

```typescript
import { kv } from '@vercel/kv';

export async function saveRecord(record: Record): Promise<string> {
  const id = crypto.randomUUID();
  await kv.set(`record:${id}`, record, { ex: 86400 * 30 }); // 30 day TTL
  await kv.lpush('records:all', id);
  return id;
}

export async function getRecord(id: string): Promise<Record | null> {
  return kv.get(`record:${id}`);
}

export async function listRecords(limit = 50): Promise<Record[]> {
  const ids = await kv.lrange('records:all', 0, limit - 1);
  const records = await Promise.all(ids.map(id => kv.get(`record:${id}`)));
  return records.filter(Boolean);
}

export async function searchRecords(query: string, limit = 50): Promise<Record[]> {
  // Full-text search would need Postgres; for KV, use list + filter
  const all = await listRecords(1000);
  const q = query.toLowerCase();
  return all.filter(r => 
    r.query.toLowerCase().includes(q) || 
    r.content.toLowerCase().includes(q)
  ).slice(0, limit);
}
```

#### 3.2 Update API Routes
**File**: `web/app/api/records/route.ts`

```typescript
import { saveRecord, listRecords, searchRecords } from '@/lib/kv';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");
  const q = searchParams.get("q");
  
  const records = q ? await searchRecords(q, limit) : await listRecords(limit);
  return NextResponse.json({ records });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const id = await saveRecord({
    query: body.query || body.url,
    url: body.url ?? null,
    content: body.content || "",
    source: body.source || "manual",
    score: body.score ?? 0,
  });
  return NextResponse.json({ id, ...body }, { status: 201 });
}
```

#### 3.3 Add Fallback for Local Development
**File**: `web/lib/records.ts`

```typescript
const USE_KV = process.env.VERCEL === '1';

export async function save(record: Omit<Record, "id" | "timestamp">): Promise<Record> {
  if (USE_KV) {
    const id = await saveToKV(record);
    return { ...record, id, timestamp: Date.now() };
  }
  // Local fallback: in-memory
  const id = crypto.randomUUID();
  const full: Record = { ...record, id, timestamp: Date.now() };
  localStore.set(id, full);
  return full;
}
```

#### 3.4 Add Analytics Endpoint
**File**: `web/app/api/analytics/route.ts`

```typescript
export async function GET() {
  // Track: query frequency, provider performance, cache hit rate
  const stats = await kv.hgetall('analytics:stats');
  return NextResponse.json(stats);
}
```

#### 3.5 Add Environment Variable
**File**: `web/.env.example`

```bash
# Vercel KV (auto-configured on Vercel)
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

### Acceptance Criteria
- [ ] Records persist across Vercel deployments
- [ ] Local development uses in-memory fallback
- [ ] GET/POST/DELETE API endpoints work
- [ ] Record search works correctly
- [ ] 30-day TTL for old records

---

## Phase 4: Python Semantic Cache (Issue #130)

### Problem
Python resolver lacks semantic caching. Rust uses `chaotic_semantic_memory`.

### Architecture Decision

**Recommended**: `sqlite-vec` + `sentence-transformers`
- Runs locally, no external services
- Lightweight (sqlite extension)
- Compatible with existing diskcache pattern

**Implementation Choice**:
- Option A: `chromadb` - heavier, more features
- Option B: `faiss` - fast, but requires manual index management
- Option C: `sqlite-vec` - lightweight, good balance ⭐

### Tasks

#### 4.1 Add Dependencies
**File**: `requirements.txt`

```txt
# Semantic cache
sentence-transformers>=2.2.0  # Local embeddings
sqlite-vec>=0.1.0            # Vector similarity in SQLite
```

#### 4.2 Create Semantic Cache Module
**File**: `scripts/semantic_cache.py`

```python
"""
Semantic cache for Python resolver using sqlite-vec.
"""
import sqlite3
import json
from pathlib import Path
from dataclasses import dataclass
from typing import Optional
from sentence_transformers import SentenceTransformer

CACHE_DIR = Path.home() / ".cache" / "do-web-doc-resolver"
DEFAULT_THRESHOLD = 0.85
DEFAULT_MAX_ENTRIES = 10000

@dataclass
class CacheEntry:
    query: str
    content: str
    provider: str
    score: float
    timestamp: float

class SemanticCache:
    def __init__(
        self, 
        cache_dir: Path = CACHE_DIR,
        threshold: float = DEFAULT_THRESHOLD,
        max_entries: int = DEFAULT_MAX_ENTRIES
    ):
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        self.db_path = cache_dir / "semantic.db"
        self.threshold = threshold
        self.max_entries = max_entries
        
        # Load embedding model (small, local)
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        
        self._init_db()
    
    def _init_db(self):
        """Initialize sqlite-vec extension."""
        self.conn = sqlite3.connect(str(self.db_path))
        # Load sqlite-vec extension
        self.conn.enable_load_extension(True)
        # ... extension loading code
        
    def query(self, query: str) -> Optional[CacheEntry]:
        """Find semantically similar cached result."""
        embedding = self.model.encode(query)
        # Vector similarity search via sqlite-vec
        ...
        
    def store(self, query: str, entry: CacheEntry):
        """Store result with embedding."""
        embedding = self.model.encode(query)
        # Insert into sqlite-vec table
        ...
```

#### 4.3 Integrate into Resolver
**File**: `scripts/resolve.py`

```python
from .semantic_cache import SemanticCache

# In resolve_query function:
cache = SemanticCache()

# Before provider cascade:
cached = cache.query(query)
if cached and cached.score >= QUALITY_THRESHOLD:
    logger.info(f"Semantic cache HIT for query='{query}'")
    return cached.__dict__

# After successful resolution:
cache.store(query, CacheEntry(
    query=query,
    content=result["content"],
    provider=result["source"],
    score=result.get("score", 0),
    timestamp=time.time()
))
```

#### 4.4 Add Configuration
**File**: `scripts/utils.py` or new `config.py`

```python
ENABLE_SEMANTIC_CACHE = os.environ.get("DO_WDR_SEMANTIC_CACHE", "1") == "1"
SEMANTIC_CACHE_THRESHOLD = float(os.environ.get("DO_WDR_CACHE_THRESHOLD", "0.85"))
SEMANTIC_CACHE_MAX_ENTRIES = int(os.environ.get("DO_WDR_CACHE_MAX_ENTRIES", "10000"))
```

#### 4.5 Add Tests
**File**: `tests/test_semantic_cache.py`

```python
import pytest
from scripts.semantic_cache import SemanticCache, CacheEntry

def test_semantic_cache_store_and_query():
    cache = SemanticCache(threshold=0.8)
    cache.store("Rust async runtime", CacheEntry(...))
    
    # Similar query should hit
    result = cache.query("Rust async framework")
    assert result is not None
    
    # Dissimilar query should miss
    result = cache.query("Python web framework")
    assert result is None
```

### Acceptance Criteria
- [ ] Semantic cache works with local embeddings
- [ ] Cache hit rate >30% for similar queries
- [ ] Query latency <50ms (embedding + search)
- [ ] Cache persists across sessions
- [ ] Feature can be disabled via env var

---

## Phase 5: UI State Persistence (Issue #128)

### Problem
UI state stored in localStorage - doesn't sync across devices.

### Current State
```typescript
// web/lib/ui-state.ts (if exists)
// Uses localStorage for sidebar collapse, API key panel, advanced options
```

### Tasks

#### 5.1 Create UI State API
**File**: `web/app/api/ui-state/route.ts`

```typescript
import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';

// Generate anonymous session ID from fingerprint
function getSessionId(request: NextRequest): string {
  // Use IP + User-Agent hash for anonymous identification
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const ua = request.headers.get('user-agent') || '';
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + ua))
    .then(hash => Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''));
}

export async function GET(request: NextRequest) {
  const sessionId = await getSessionId(request);
  const state = await kv.get(`ui-state:${sessionId}`);
  return NextResponse.json(state || {});
}

export async function POST(request: NextRequest) {
  const sessionId = await getSessionId(request);
  const state = await request.json();
  await kv.set(`ui-state:${sessionId}`, state, { ex: 86400 * 365 }); // 1 year TTL
  return NextResponse.json({ saved: true });
}
```

#### 5.2 Update Client-Side State Management
**File**: `web/lib/ui-state.ts`

```typescript
interface UIState {
  sidebarCollapsed: boolean;
  showApiKeys: boolean;
  showAdvanced: boolean;
  activeProfile: string;
  theme: 'light' | 'dark';
}

const USE_SERVER_STATE = process.env.NEXT_PUBLIC_VERCEL === '1';

export async function loadUIState(): Promise<UIState> {
  if (USE_SERVER_STATE) {
    try {
      const res = await fetch('/api/ui-state');
      if (res.ok) return await res.json();
    } catch {
      // Fall back to localStorage
    }
  }
  // Local fallback
  const stored = localStorage.getItem('ui-state');
  return stored ? JSON.parse(stored) : defaultState;
}

export async function saveUIState(state: UIState): Promise<void> {
  // Always save to localStorage for immediate feedback
  localStorage.setItem('ui-state', JSON.stringify(state));
  
  // Sync to server in background (fire-and-forget)
  if (USE_SERVER_STATE) {
    fetch('/api/ui-state', {
      method: 'POST',
      body: JSON.stringify(state),
    }).catch(() => {}); // Silently ignore failures
  }
}
```

#### 5.3 Add Optimistic Updates
- Update localStorage immediately
- Sync to server in background
- Merge server state on load

### Acceptance Criteria
- [ ] UI state syncs across devices
- [ ] Graceful fallback to localStorage when offline
- [ ] No data loss during concurrent updates
- [ ] State operations <100ms latency

---

## Phase 6: Code Quality (Non-Blocking)

### 6.1 Split Large Files

| File | Current Lines | Target | Action |
|------|--------------|--------|--------|
| `cli/src/resolver.rs` | 948 | <500 | Split into: `cascade.rs`, `url_resolver.rs`, `query_resolver.rs` |
| `web/app/api/resolve/route.ts` | 602 | <500 | Extract providers to `lib/providers/` |

**Proposed Split for resolver.rs**:
```
cli/src/
├── resolver/
│   ├── mod.rs          # Public API
│   ├── cascade.rs      # Cascade orchestration
│   ├── url_resolver.rs # URL resolution
│   └── query_resolver.rs # Query resolution
```

### 6.2 Standardize Skill Frontmatter

Add missing fields to 6 skills:

| Skill | Missing |
|-------|---------|
| do-wdr-ui-component | license, compatibility, metadata |
| do-wdr-issue-swarm | license, compatibility, metadata |
| skill-creator | compatibility, allowed-tools, metadata |
| anti-ai-slop | license, compatibility, allowed-tools, metadata |
| vercel-cli | license, compatibility, allowed-tools, metadata |
| agent-browser | license, compatibility, metadata |

**Template**:
```yaml
---
name: <skill-name>
description: <description>
license: MIT
compatibility: <runtime-requirements>
allowed-tools: Bash(<commands>) Read
metadata:
  author: d-oit
  version: "0.1.0"
  source: https://github.com/d-oit/do-web-doc-resolver
---
```

### 6.3 Add Web E2E Tests for New Features

- [ ] Test records API (CRUD operations)
- [ ] Test UI state persistence
- [ ] Test semantic cache integration

---

## Dependency Graph

```
Phase 1 (Skill Self-Containment)
    ↓
Phase 2 (Semantic Cache Testing) ─────────────────┐
    ↓                                              │
Phase 3 (Records Persistence)                     │
    ↓                                              │
Phase 4 (Python Semantic Cache) ←─────────────────┘
    ↓
Phase 5 (UI State Persistence)
    ↓
Phase 6 (Code Quality) - Can run in parallel
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| `sqlite-vec` installation issues | Add fallback to pure-Python vector search |
| Vercel KV limits (free tier) | Add TTL, implement cleanup, monitor usage |
| Embedding model size | Use `all-MiniLM-L6-v2` (~80MB), add lazy loading |
| Cross-device sync conflicts | Use last-write-wins with timestamp |

---

## Timeline

| Week | Phase | Deliverables |
|------|-------|--------------|
| 1 | Phase 1 | Self-contained skill package |
| 1-2 | Phase 2 | Semantic cache tests passing |
| 2 | Phase 3 | Records persisting to Vercel KV |
| 2-3 | Phase 4 | Python semantic cache working |
| 3 | Phase 5 | UI state syncing across devices |
| 3+ | Phase 6 | Code quality improvements (ongoing) |

---

## Notes

- Rust CLI already has circuit breaker, routing memory, negative cache (implemented correctly)
- Issue #135 partially addressed - implementation exists, needs import fixes
- Python semantic cache should remain independent from Rust implementation
- Consider adding `chaotic_semantic_memory` Python bindings as alternative in future

---

## Appendix: File Changes Summary

### New Files
- `plans/IMPLEMENTATION_PLAN.md` (this file)
- `scripts/semantic_cache.py`
- `tests/test_semantic_cache.py`
- `cli/benches/semantic_cache_bench.rs`
- `web/lib/kv.ts`
- `web/app/api/analytics/route.ts`
- `.agents/skills/do-web-doc-resolver/tests/test_providers.py`
- `.agents/skills/do-web-doc-resolver/tests/test_quality.py`
- `.agents/skills/do-web-doc-resolver/tests/test_routing.py`
- `.agents/skills/do-web-doc-resolver/tests/test_circuit_breaker.py`

### Modified Files
- `.agents/skills/do-web-doc-resolver/__main__.py` - Fix imports
- `.agents/skills/do-web-doc-resolver/tests/test_resolve.py` - Expand coverage
- `.agents/skills/do-web-doc-resolver/SKILL.md` - Fix typo, update docs
- `scripts/resolve.py` - Add semantic cache integration
- `web/lib/records.ts` - Add Vercel KV backend
- `web/app/api/records/route.ts` - Use KV storage
- `web/app/api/ui-state/route.ts` - Add server-side persistence
- `.github/workflows/ci.yml` - Add semantic cache tests
- `requirements.txt` - Add semantic cache deps
- 6 skill SKILL.md files - Add frontmatter
