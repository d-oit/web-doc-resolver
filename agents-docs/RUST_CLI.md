# Rust CLI Architecture (wdr)

Architecture reference for the `wdr` Rust CLI. Related epic: #18.

## Project Structure

```
cli/
├── Cargo.toml
├── src/
│   ├── main.rs               # Entry point, CLI parse, dispatch
│   ├── lib.rs                # Library root, module declarations
│   ├── cli.rs                # Clap arg structs + subcommands
│   ├── config.rs             # Config loading (TOML + env + flags)
│   ├── resolver.rs           # Cascade orchestrator
│   ├── routing.rs            # ResolutionBudget, provider ordering
│   ├── routing_memory.rs     # Per-domain provider learning
│   ├── types.rs              # ResolvedResult, Profile, ProviderType enums
│   ├── output.rs             # Stdout/stderr formatting
│   ├── metrics.rs            # Per-provider telemetry
│   ├── quality.rs            # Content quality scoring
│   ├── bias_scorer.rs        # Domain trust scoring
│   ├── compaction.rs         # Boilerplate removal
│   ├── link_validator.rs     # Async HTTP HEAD validation
│   ├── circuit_breaker.rs    # Per-provider failure tracking
│   ├── negative_cache.rs     # TTL-based failed pair cache
│   ├── semantic_cache.rs     # Semantic similarity cache (feature-gated)
│   ├── synthesis.rs          # AI synthesis via Mistral
│   ├── error.rs              # Typed errors with thiserror
│   └── providers/
│       ├── mod.rs              # QueryProvider + UrlProvider traits
│       ├── exa_mcp.rs         # Exa MCP (free)
│       ├── exa_sdk.rs         # Exa SDK (paid)
│       ├── tavily.rs          # Tavily (paid)
│       ├── serper.rs          # Serper Google Search (paid)
│       ├── duckduckgo.rs      # DuckDuckGo (free)
│       ├── mistral_websearch.rs # Mistral web search (paid)
│       ├── llms_txt.rs        # llms.txt (free)
│       ├── jina.rs            # Jina Reader (free)
│       ├── firecrawl.rs       # Firecrawl (paid)
│       ├── direct_fetch.rs    # Direct HTTP (free)
│       ├── mistral_browser.rs # Mistral browser (paid)
│       ├── docling.rs         # Document parser (PDF/DOCX)
│       └── ocr.rs             # Image OCR (PNG/JPG)
```

## Key Dependencies

| Crate | Purpose |
|-------|---------|
| `clap` (derive) | CLI argument parsing |
| `tokio` | Async runtime |
| `reqwest` | HTTP client |
| `serde` / `serde_json` | JSON serialization |
| `thiserror` | Typed error definitions |
| `tracing` | Structured logging |
| `tracing-subscriber` | Log output (stderr, JSON) |
| `config` | Layered config (TOML + env) |
| `anyhow` | Error context in main |

## Provider Trait

```rust
// Two separate traits for query and URL providers:

#[async_trait]
pub trait QueryProvider: Send + Sync {
    fn name(&self) -> &'static str;
    fn is_available(&self) -> bool;
    async fn search(&self, query: &str, limit: usize) -> Result<Vec<ResolvedResult>, ProviderError>;
}

#[async_trait]
pub trait UrlProvider: Send + Sync {
    fn name(&self) -> &'static str;
    fn is_available(&self) -> bool;
    async fn extract(&self, url: &str) -> Result<ResolvedResult, ProviderError>;
}
```

## Error Types

```rust
#[derive(Debug, thiserror::Error)]
pub enum ResolverError {
    #[error("network error: {0}")]
    Network(String),
    #[error("rate limited (retry after {retry_after}s)")]
    RateLimit { retry_after: u64 },
    #[error("auth error: {0}")]
    Auth(String),
    #[error("quota exceeded")]
    Quota,
    #[error("content not found")]
    NotFound,
    #[error("parse error: {0}")]
    Parse(String),
    #[error("config error: {0}")]
    Config(String),
    #[error("cache error: {0}")]
    Cache(String),
    #[error("provider error: {0}")]
    Provider(String),
    #[error("unknown error: {0}")]
    Unknown(String),
}
```

## Config Layers (priority: high to low)

1. CLI flags (`--skip`, `--provider`, `--providers-order`, `--min-chars`)
2. Environment variables (`WDR_SKIP`, `WDR_PROVIDERS_ORDER`, etc.)
3. `config.toml` in current dir or `~/.config/wdr/config.toml`
4. Built-in defaults

## Cascade Algorithm

```
for provider in effective_order:
    if provider in skip_list: continue
    if provider requires key and key missing: continue
    result = provider.resolve(input)
    match result:
        Ok(content) if content.len() >= min_chars: return Ok(content)
        Err(RateLimit) -> log warn + continue
        Err(Auth) -> log error + continue
        Err(TooShort) -> continue
        Err(_) -> log warn + continue
return Err(AllProvidersFailed)
```

## Logging

- All logs go to **stderr** via `tracing`
- Default format: human-readable with timestamps
- `--log-json`: switches to JSON structured logs (for agent parsing)
- Log levels: error, warn, info (default), debug, trace

## LOC Constraint

All source files must remain under **500 lines**. Split modules if needed.
Use `tokei` or `wc -l` to verify before committing.

## Quality Gate

Run before every commit:

```bash
# Full quality gate
./scripts/quality_gate.sh

# Or use the git hook
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

Checks: cargo test, cargo fmt, cargo clippy, Python tests, ruff, black

## Sub-issues

See GitHub epic for implementation sub-issues covering:
- Scaffold + Cargo.toml
- Config module
- Error types
- Provider trait + registry
- Individual provider implementations
- Resolver orchestrator
- Output module
- CI/CD
