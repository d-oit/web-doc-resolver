# Architecture Improvements Plan

## Overview

This plan addresses code consolidation between Python and Rust implementations, async/await optimizations, and architectural abstractions to reduce maintenance burden and improve performance.

---

## Phase 1: Async Mutex Migration (Week 1)

### Task 1.1: Replace std::sync::Mutex with tokio::sync::RwLock

**Files:**
- `cli/src/resolver/url.rs` (lines 206, 237, 317, 321)
- `cli/src/resolver/query.rs` (similar patterns)
- `cli/src/resolver/mod.rs` (registry definitions)

**Changes:**
```rust
// BEFORE:
use std::sync::{Arc, Mutex};
pub struct Resolver {
    negative_cache: Arc<Mutex<NegativeCache>>,
    circuit_breakers: Arc<Mutex<CircuitBreakerRegistry>>,
    routing_memory: Arc<Mutex<RoutingMemory>>,
}

// AFTER:
use tokio::sync::RwLock;
use std::sync::Arc;
pub struct Resolver {
    negative_cache: Arc<RwLock<NegativeCache>>,
    circuit_breakers: Arc<RwLock<CircuitBreakerRegistry>>,
    routing_memory: Arc<RwLock<RoutingMemory>>,
}
```

**Rationale:** 
- `std::sync::Mutex` blocks the async executor thread
- `tokio::sync::RwLock` yields control instead of blocking
- Allows concurrent reads on circuit breaker checks

**Testing:**
- Run Rust tests: `cd cli && cargo test`
- Verify no deadlocks under concurrent load
- Check latency distribution with `wrk` or `oha`

---

## Phase 2: DashMap Integration (Week 1-2)

### Task 2.1: Implement Concurrent Hash Maps

**Files:**
- `cli/src/resolver/mod.rs`
- New: `cli/src/concurrent_state.rs`

**Implementation:**
```rust
// cli/src/concurrent_state.rs
use dashmap::DashMap;
use std::sync::Arc;

pub struct ConcurrentState {
    // Sharded by domain for concurrent access
    negative_cache: DashMap<String, NegativeCacheEntry>,
    circuit_breakers: DashMap<String, CircuitBreakerState>,
    routing_memory: DashMap<String, DomainStats>,
}

impl ConcurrentState {
    pub fn new() -> Self {
        Self {
            negative_cache: DashMap::new(),
            circuit_breakers: DashMap::new(),
            routing_memory: DashMap::new(),
        }
    }
    
    // Read operations don't block other reads
    pub fn get_circuit_breaker(&self, provider: &str) -> Option<CircuitBreakerState> {
        self.circuit_breakers.get(provider).map(|e| e.clone())
    }
}
```

**Dependencies:**
Add to `cli/Cargo.toml`:
```toml
[dependencies]
dashmap = "5.5"
```

**Testing:**
- Benchmark concurrent access patterns
- Verify 10-30% throughput improvement

---

## Phase 3: Unified Provider Trait (Week 2-3)

### Task 3.1: Create Provider Trait Definition

**New File:** `cli/src/providers/trait.rs`

```rust
//! Unified Provider Trait

use async_trait::async_trait;
use crate::error::ResolverError;
use crate::types::ResolvedResult;

#[async_trait]
pub trait Provider: Send + Sync {
    /// Provider name for logging and metrics
    fn name(&self) -> &str;
    
    /// Check if provider is available (has API key, not rate limited)
    fn is_available(&self) -> bool;
    
    /// Check if this is a paid provider
    fn is_paid(&self) -> bool;
    
    /// Execute the provider
    async fn execute(&self, input: &str) -> Result<ResolvedResult, ResolverError>;
    
    /// Classify provider-specific errors
    fn classify_error(&self, err: reqwest::Error) -> ResolverError {
        if err.is_timeout() {
            ResolverError::Network("timeout".to_string())
        } else if err.status() == Some(reqwest::StatusCode::TOO_MANY_REQUESTS) {
            ResolverError::RateLimit("429".to_string())
        } else {
            ResolverError::Network(err.to_string())
        }
    }
}
```

### Task 3.2: Create Provider Registry

**New File:** `cli/src/providers/registry.rs`

```rust
//! Provider Registry with shared HTTP client

use std::sync::Arc;
use reqwest::Client;

pub struct ProviderRegistry {
    shared_client: Arc<Client>,
    providers: Vec<Box<dyn Provider>>,
}

impl ProviderRegistry {
    pub fn new() -> Self {
        let client = Client::builder()
            .pool_max_idle_per_host(10)
            .pool_idle_timeout(Duration::from_secs(60))
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");
            
        Self {
            shared_client: Arc::new(client),
            providers: Vec::new(),
        }
    }
    
    pub fn register<P: Provider + 'static>(&mut self, provider: P) {
        self.providers.push(Box::new(provider));
    }
}
```

### Task 3.3: Migrate Existing Providers

**Files to Update:**
- `cli/src/providers/jina.rs`
- `cli/src/providers/exa_mcp.rs`
- `cli/src/providers/firecrawl.rs`
- `cli/src/providers/tavily.rs`
- `cli/src/providers/serper.rs`
- `cli/src/providers/duckduckgo.rs`
- `cli/src/providers/mistral_browser.rs`
- `cli/src/providers/mistral_websearch.rs`

**Migration Pattern:**
```rust
// BEFORE:
pub struct JinaProvider {
    client: reqwest::Client,
}

// AFTER:
pub struct JinaProvider {
    client: Arc<reqwest::Client>,
}

#[async_trait]
impl Provider for JinaProvider {
    fn name(&self) -> &str { "jina" }
    fn is_available(&self) -> bool { true }
    fn is_paid(&self) -> bool { false }
    
    async fn execute(&self, url: &str) -> Result<ResolvedResult, ResolverError> {
        // Implementation
    }
}
```

---

## Phase 4: Python Async Migration (Week 3-4)

### Task 4.1: Convert to asyncio

**File:** `scripts/resolve.py`

**Changes:**
```python
# BEFORE:
import concurrent.futures

def resolve_url_stream(...):
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=max(1, len(eligible)))
    # ... blocking waits

# AFTER:
import asyncio

async def resolve_url_stream(...):
    tasks = []
    for p_name in eligible:
        task = asyncio.create_task(run_provider(p_name))
        tasks.append(task)
        
        # Hedging: wait for threshold or first completion
        done, pending = await asyncio.wait(
            tasks, 
            timeout=threshold,
            return_when=asyncio.FIRST_COMPLETED
        )
```

### Task 4.2: Create Async Provider Implementations

**New File:** `scripts/providers_async.py`

```python
"""Async provider implementations using aiohttp."""

import aiohttp
import asyncio
from typing import Optional

async def resolve_with_jina_async(
    url: str, 
    max_chars: int,
    session: aiohttp.ClientSession
) -> Optional[ResolvedResult]:
    """Async Jina Reader resolution."""
    try:
        async with session.get(f"https://r.jina.ai/{url}") as resp:
            if resp.status == 200:
                content = await resp.text()
                return ResolvedResult(
                    source="jina",
                    content=content[:max_chars],
                    url=url
                )
    except asyncio.TimeoutError:
        return None
    return None
```

**Dependencies:**
Add to `requirements.txt`:
```
aiohttp>=3.9.0
aiodns>=3.1.0
```

---

## Phase 5: PyO3 Python Bindings (Week 4-6)

### Task 5.1: Create Python Module

**New File:** `cli/src/python.rs`

```rust
//! PyO3 Python bindings for Rust resolver

use pyo3::prelude::*;
use pyo3::types::PyDict;

#[pyfunction]
fn resolve_url_py(url: String, max_chars: usize) -> PyResult<Py<PyDict>> {
    let rt = tokio::runtime::Runtime::new()?;
    
    let result = rt.block_on(async {
        let resolver = Resolver::new().await;
        resolver.resolve_url(&url).await
    });
    
    Python::with_gil(|py| {
        let dict = PyDict::new(py);
        match result {
            Ok(res) => {
                dict.set_item("source", res.source)?;
                dict.set_item("content", res.content)?;
                dict.set_item("url", res.url)?;
                dict.set_item("score", res.score)?;
            }
            Err(e) => {
                dict.set_item("error", e.to_string())?;
            }
        }
        Ok(dict.into())
    })
}

#[pymodule]
fn do_wdr(_py: Python, m: &PyModule) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(resolve_url_py, m)?)?;
    Ok(())
}
```

### Task 5.2: Configure Cargo for Python Extension

**Update:** `cli/Cargo.toml`

```toml
[package]
name = "do-wdr"
version = "0.4.0"
edition = "2024"

[lib]
name = "do_wdr"
crate-type = ["cdylib", "rlib"]

[dependencies]
pyo3 = { version = "0.22", features = ["extension-module"], optional = true }
tokio = { version = "1.35", features = ["full"] }

[features]
default = ["python"]
python = ["dep:pyo3"]
```

### Task 5.3: Python Package Structure

**New File:** `python/do_wdr/__init__.py`

```python
"""Python bindings for do-web-doc-resolver."""

try:
    from .do_wdr import resolve_url_py as _resolve_url
    RUST_AVAILABLE = True
except ImportError:
    RUST_AVAILABLE = False
    from scripts.resolve import resolve_url as _resolve_url_py

async def resolve_url(url: str, max_chars: int = 8000) -> dict:
    """Resolve a URL using the Rust implementation if available."""
    if RUST_AVAILABLE:
        return _resolve_url(url, max_chars)
    else:
        return await _resolve_url_py(url, max_chars)

__all__ = ["resolve_url", "RUST_AVAILABLE"]
```

---

## Phase 6: Configuration Consolidation (Week 5-6)

### Task 6.1: Use config Crate

**File:** `cli/src/config.rs`

**Changes:**
```rust
// BEFORE: Manual field-by-field merging

// AFTER: Using config crate
use config::{Config, ConfigError, Environment, File};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct AppConfig {
    #[serde(default = "default_max_chars")]
    pub max_chars: usize,
    #[serde(default)]
    pub profile: Profile,
    #[serde(default)]
    pub skip_providers: Vec<String>,
}

impl AppConfig {
    pub fn load() -> Result<Self, ConfigError> {
        let s = Config::builder()
            .add_source(File::with_name("config").required(false))
            .add_source(File::with_name("config.toml").required(false))
            .add_source(Environment::with_prefix("DO_WDR"))
            .build()?;
            
        s.try_deserialize()
    }
}
```

---

## Dependencies

### New Rust Dependencies
```toml
dashmap = "5.5"
pyo3 = { version = "0.22", optional = true }
config = "0.14"
```

### New Python Dependencies
```
aiohttp>=3.9.0
aiodns>=3.1.0
pytest-asyncio>=0.21.0
```

---

## Testing Plan

1. **Unit Tests**: Each trait implementation
2. **Integration Tests**: Full cascade with mocked providers
3. **Performance Tests**: Latency comparison before/after
4. **Python/Rust Parity**: Same inputs produce same outputs

---

## Success Metrics

- [ ] 10-30% throughput improvement (DashMap)
- [ ] No blocking operations in async context
- [ ] Unified provider trait reduces code by ~200 lines
- [ ] Python bindings functional with feature parity
- [ ] All existing tests pass

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| 1: Async Mutex | Week 1 | Non-blocking resolver |
| 2: DashMap | Week 1-2 | Concurrent state |
| 3: Provider Trait | Week 2-3 | Unified provider interface |
| 4: Python Async | Week 3-4 | Async Python resolver |
| 5: PyO3 Bindings | Week 4-6 | Rust library with Python bindings |
| 6: Config Consolidation | Week 5-6 | Simplified configuration |

---

## Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| PyO3 complexity | Start with simple bindings, expand incrementally |
| Async migration bugs | Extensive test coverage, gradual rollout |
| Performance regression | Benchmark before/after each phase |
| Breaking changes | Maintain Python API compatibility layer |
