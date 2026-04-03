# Performance Optimization Plan

## Overview

This plan implements 10 performance optimizations to achieve 30-50% latency reduction and improved throughput. Organized by effort level and impact.

---

## Phase 1: Quick Wins (Week 1)

### Optimization 1: Reuse ThreadPoolExecutor

**Problem:** New ThreadPoolExecutor created for every request (5-50ms overhead)
**Location:** `scripts/resolve.py:209, 360`

**Implementation:**

```python
# scripts/resolve.py

# Module-level executor
_executor = None

def _get_executor(max_workers: int = 10):
    """Get or create shared ThreadPoolExecutor."""
    global _executor
    if _executor is None:
        _executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=max_workers,
            thread_name_prefix="resolver"
        )
    return _executor

def resolve_url_stream(...):
    # BEFORE:
    # executor = concurrent.futures.ThreadPoolExecutor(max_workers=max(1, len(eligible)))
    
    # AFTER:
    executor = _get_executor(max_workers=max(10, len(eligible)))
    # ... rest of function
```

**Expected Impact:** 5-50ms reduction per request
**Testing:** Benchmark with `wrk` or `oha`

---

### Optimization 2: Eliminate Busy-Polling

**Problem:** 0.01s timeout creates busy-poll loop (30% CPU waste)
**Location:** `scripts/resolve.py:239, 384`

**Implementation:**

```python
# BEFORE:
done, _ = concurrent.futures.wait(
    active_futures.keys(),
    timeout=0.01,  # 10ms polling
    return_when=concurrent.futures.FIRST_COMPLETED,
)

# AFTER - Option A: Increase timeout:
done, _ = concurrent.futures.wait(
    active_futures.keys(),
    timeout=0.1,  # 100ms blocking wait
    return_when=concurrent.futures.FIRST_COMPLETED,
)

# AFTER - Option B: Use asyncio (see Phase 4):
# Migrate to asyncio for true async I/O
```

**Expected Impact:** 30% CPU reduction
**Testing:** Profile CPU usage under load

---

### Optimization 3: HTTP/2 and Keep-Alive Configuration

**Problem:** Default HTTP settings disable connection reuse
**Location:** `scripts/utils.py`, `cli/src/providers/*.rs`

**Python Implementation:**

```python
# scripts/utils.py

# BEFORE:
_session = None

def get_session():
    global _session
    if _session is None:
        _session = requests.Session()
    return _session

# AFTER:
_session = None

def get_session():
    global _session
    if _session is None:
        adapter = requests.adapters.HTTPAdapter(
            pool_connections=20,
            pool_maxsize=50,
            max_retries=3,
            pool_block=False
        )
        
        _session = requests.Session()
        _session.mount("https://", adapter)
        _session.mount("http://", adapter)
        
        # Enable keep-alive
        _session.headers["Connection"] = "keep-alive"
        _session.headers["Keep-Alive"] = "timeout=60"
        
    return _session
```

**Rust Implementation:**

```rust
// cli/src/providers/registry.rs

use reqwest::Client;
use std::time::Duration;

pub fn create_optimized_client() -> Client {
    Client::builder()
        .http2_prior_knowledge()  // Use HTTP/2 when available
        .pool_max_idle_per_host(10)
        .pool_idle_timeout(Duration::from_secs(60))
        .timeout(Duration::from_secs(30))
        .connect_timeout(Duration::from_secs(10))
        .tcp_keepalive(Duration::from_secs(60))
        .build()
        .expect("Failed to create HTTP client")
}
```

**Expected Impact:** 20-40% latency reduction for repeated domains
**Testing:** Measure connection reuse with Wireshark or logging

---

### Optimization 4: L1 In-Memory Cache

**Problem:** Disk cache adds 5-20ms per operation
**Location:** `scripts/utils.py:409`

**Implementation:**

```python
# scripts/utils.py

from cachetools import TTLCache
import hashlib

# L1 in-memory cache (5 min TTL, max 1000 entries)
_l1_cache: TTLCache = TTLCache(maxsize=1000, ttl=300)

def _cache_key_l1(key: str) -> str:
    """Fast hash for L1 cache keys."""
    return hashlib.md5(key.encode()).hexdigest()[:16]

def get_from_cache(key: str, prefix: str = "") -> dict | None:
    """Two-tier cache: L1 (memory) -> L2 (disk)."""
    cache_key = f"{prefix}:{key}"
    l1_key = _cache_key_l1(cache_key)
    
    # Check L1 first
    if l1_key in _l1_cache:
        return _l1_cache[l1_key]
    
    # Check L2 (disk)
    disk_result = _get_from_cache_disk(key, prefix)
    if disk_result:
        # Promote to L1
        _l1_cache[l1_key] = disk_result
        return disk_result
    
    return None

def save_to_cache(key: str, prefix: str, data: dict) -> None:
    """Save to both L1 and L2 cache."""
    cache_key = f"{prefix}:{key}"
    l1_key = _cache_key_l1(cache_key)
    
    # Save to L1
    _l1_cache[l1_key] = data
    
    # Save to L2
    _save_to_cache_disk(key, prefix, data)
```

**Dependencies:**
```
cachetools>=5.3.0
```

**Expected Impact:** 10-20ms for cache hits, 5x throughput improvement
**Testing:** Benchmark cache hit/miss scenarios

---

### Optimization 5: Content Compaction Optimization

**Problem:** Multiple intermediate allocations during compaction
**Location:** `scripts/utils.py:200-212`, `cli/src/compaction.rs`

**Implementation:**

```python
# scripts/utils.py

def compact_content(content: str, max_chars: int) -> str:
    """Optimized content compaction with fewer allocations."""
    # Early exit if content is already small enough
    if len(content) <= max_chars * 0.5:
        return content
    
    # Pre-allocate result buffer
    result = []
    result_size = 0
    
    for line in content.split('\n'):
        stripped = line.strip()
        
        # Skip empty lines and common noise
        if not stripped or stripped in {'```', '---', '<!-- -->'}:
            continue
        
        line_size = len(stripped)
        if result_size + line_size > max_chars:
            break
        
        result.append(stripped)
        result_size += line_size + 1  # +1 for newline
    
    return '\n'.join(result)
```

**Rust Implementation:**

```rust
// cli/src/compaction.rs

pub fn compact_content(content: &str, max_chars: usize) -> String {
    // Early exit for small content
    if content.len() <= max_chars / 2 {
        return content.to_string();
    }
    
    // Pre-allocate with capacity
    let mut result = String::with_capacity(max_chars);
    let mut count = 0;
    
    for line in content.lines() {
        let stripped = line.trim();
        
        if stripped.is_empty() || is_noise_line(stripped) {
            continue;
        }
        
        let line_len = stripped.len();
        if count + line_len > max_chars {
            break;
        }
        
        if !result.is_empty() {
            result.push('\n');
            count += 1;
        }
        result.push_str(stripped);
        count += line_len;
    }
    
    result
}
```

**Expected Impact:** 5-10ms faster processing for large documents
**Testing:** Benchmark with 100KB+ documents

---

### Optimization 6: Early Quality Exit

**Problem:** Full quality scoring on results that will be rejected
**Location:** `scripts/quality.py:18-65`

**Implementation:**

```python
# scripts/quality.py

class ContentScore:
    """Optimized quality scoring with early exits."""
    
    @staticmethod
    def score_content(content: str) -> "ContentScore":
        # Early exit: too short
        if len(content) < MIN_CHARS:
            return ContentScore(
                score=0.0,
                acceptable=False,
                reason="too_short"
            )
        
        # Early exit: empty after stripping
        stripped = content.strip()
        if not stripped:
            return ContentScore(
                score=0.0,
                acceptable=False,
                reason="empty"
            )
        
        # Calculate score
        score = 1.0
        
        # Check for links (fast check)
        has_links = "http" in content
        if not has_links:
            score -= 0.15
        
        # Duplicate detection (skip for small content)
        lines = content.split('\n')
        if len(lines) > 10:
            unique_lines = set(lines)
            if len(unique_lines) < len(lines) * 0.5:
                score -= 0.25
        
        return ContentScore(
            score=max(0.0, score),
            acceptable=score >= 0.65,
            reason=None
        )
```

**Expected Impact:** 5-15ms per rejected result
**Testing:** Profile quality scoring with edge cases

---

## Phase 2: Medium Effort Optimizations (Week 2-3)

### Optimization 7: Shared reqwest Client (Rust)

**Problem:** Each provider creates its own HTTP client
**Location:** `cli/src/providers/*.rs`

**Implementation:**

```rust
// cli/src/providers/mod.rs

use std::sync::Arc;
use reqwest::Client;

pub struct ProviderContext {
    pub client: Arc<Client>,
}

impl ProviderContext {
    pub fn new() -> Self {
        let client = Client::builder()
            .pool_max_idle_per_host(10)
            .pool_idle_timeout(Duration::from_secs(60))
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap();
        
        Self {
            client: Arc::new(client),
        }
    }
}

// Update all providers to use shared client
pub struct JinaProvider {
    client: Arc<Client>,
}

impl JinaProvider {
    pub fn new(ctx: &ProviderContext) -> Self {
        Self {
            client: ctx.client.clone(),
        }
    }
}
```

**Expected Impact:** 50-150ms for subsequent requests to same hosts
**Testing:** Measure connection establishment overhead

---

### Optimization 8: Async-Aware Locks (Rust)

**Problem:** `std::sync::Mutex` blocks async executor threads
**Location:** `cli/src/resolver/url.rs`, `query.rs`

**Implementation:**

See `01-architecture-improvements.md` for detailed implementation.

**Expected Impact:** 10-20% throughput increase
**Testing:** Concurrent load testing

---

## Phase 3: High Effort Optimizations (Week 3-4)

### Optimization 9: True Parallel Provider Launch

**Problem:** Sequential provider launches with threshold delays
**Location:** `scripts/resolve.py:186-314`

**Implementation:**

```python
# NEW: scripts/resolve_parallel.py

import asyncio
import aiohttp
from typing import List, Optional

async def resolve_url_parallel(
    url: str,
    max_chars: int,
    providers: List[str],
    quality_threshold: float = 0.65
) -> dict:
    """Launch top-N providers simultaneously."""
    
    async with aiohttp.ClientSession() as session:
        # Create tasks for first 3 providers
        tasks = []
        for p_name in providers[:3]:
            task = asyncio.create_task(
                run_provider_async(p_name, url, session),
                name=p_name
            )
            tasks.append(task)
        
        # Wait for first acceptable result
        pending = set(tasks)
        while pending:
            # Wait for any task to complete
            done, pending = await asyncio.wait(
                pending,
                return_when=asyncio.FIRST_COMPLETED
            )
            
            for task in done:
                result = task.result()
                if result and result.get("score", 0) >= quality_threshold:
                    # Cancel remaining tasks
                    for p in pending:
                        p.cancel()
                    return result
        
        # If no acceptable result, try remaining providers
        # ...

async def run_provider_async(
    provider_name: str,
    url: str,
    session: aiohttp.ClientSession
) -> Optional[dict]:
    """Async provider execution."""
    # Provider-specific async implementation
    pass
```

**Expected Impact:** 40-60% p95 latency reduction
**Testing:** Measure tail latency under load

---

### Optimization 10: Request Coalescing / Deduplication

**Problem:** Identical concurrent requests run in parallel
**Implementation:**

```rust
// cli/src/dedup.rs

use std::collections::HashMap;
use std::future::Shared;
use std::pin::Pin;
use std::task::{Context, Poll, Waker};
use dashmap::DashMap;

pub struct RequestDedup {
    in_flight: DashMap<String, Shared<Pin<Box<dyn Future<Output = ResolvedResult>>>>>,
}

impl RequestDedup {
    pub async fn resolve_or_spawn<F, Fut>(
        &self,
        key: String,
        factory: F
    ) -> ResolvedResult
    where
        F: FnOnce() -> Fut,
        Fut: Future<Output = ResolvedResult>,
    {
        // Check if request already in flight
        if let Some(future) = self.in_flight.get(&key) {
            return future.clone().await;
        }
        
        // Create new request
        let future = Box::pin(factory());
        let shared = Shared::new(future);
        
        self.in_flight.insert(key.clone(), shared.clone());
        
        let result = shared.await;
        
        // Clean up
        self.in_flight.remove(&key);
        
        result
    }
}
```

**Expected Impact:** 50-80% resource reduction for duplicate requests
**Testing:** Simulate burst traffic with identical queries

---

## Dependencies

### Python
```
cachetools>=5.3.0
aiohttp>=3.9.0
aiodns>=3.1.0
pytest-asyncio>=0.21.0
```

### Rust
```toml
[dependencies]
dashmap = "5.5"
tokio = { version = "1.35", features = ["full"] }
reqwest = { version = "0.12", features = ["http2", "rustls-tls"] }
```

---

## Testing & Benchmarking

### Benchmark Scripts

```python
# scripts/benchmark.py

import time
import statistics
from scripts.resolve import resolve

def benchmark_resolution(urls: List[str], iterations: int = 10):
    """Benchmark resolution latency."""
    results = []
    
    for url in urls:
        times = []
        for _ in range(iterations):
            start = time.perf_counter()
            resolve(url)
            elapsed = time.perf_counter() - start
            times.append(elapsed * 1000)  # Convert to ms
        
        results.append({
            "url": url,
            "mean": statistics.mean(times),
            "median": statistics.median(times),
            "p95": sorted(times)[int(len(times) * 0.95)],
            "p99": sorted(times)[int(len(times) * 0.99)],
        })
    
    return results

if __name__ == "__main__":
    urls = [
        "https://example.com",
        "https://docs.python.org",
        "https://docs.rs/tokio",
    ]
    
    results = benchmark_resolution(urls)
    for r in results:
        print(f"{r['url']}: mean={r['mean']:.1f}ms, p95={r['p95']:.1f}ms")
```

### Load Testing

```bash
# Install oha (Rust-based load tester)
cargo install oha

# Test resolver web API
oha -z 30s -c 10 \
  --method POST \
  --json-path '{"input": "https://example.com"}' \
  http://localhost:8000/api/resolve
```

---

## Success Metrics

| Optimization | Target Improvement | Measurement |
|--------------|---------------------|-------------|
| ThreadPool reuse | 5-50ms/request | Mean latency |
| Eliminate polling | 30% CPU | CPU usage |
| HTTP/2 + Keep-Alive | 20-40% latency | Repeated requests |
| L1 cache | 10-20ms hits | Cache hit rate |
| Compaction | 5-10ms large docs | Processing time |
| Quality exit | 5-15ms/rejected | Rejection path |
| Shared client | 50-150ms | Connection reuse |
| Async locks | 10-20% throughput | Concurrent reqs |
| Parallel launch | 40-60% p95 | Tail latency |
| Coalescing | 50-80% bursts | Duplicate requests |

---

## Timeline

| Week | Optimizations | Expected Impact |
|------|---------------|-----------------|
| 1 | 1-6 (Quick wins) | 30% latency reduction |
| 2-3 | 7-8 (Medium effort) | 20% additional improvement |
| 3-4 | 9-10 (High effort) | 40-60% tail latency |

---

## Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| Async migration bugs | Extensive test coverage, feature flags |
| Cache coherency issues | TTL validation, cache invalidation tests |
| HTTP/2 compatibility | Fallback to HTTP/1.1, A/B testing |
| Memory pressure from L1 cache | Bounded size, LRU eviction |
