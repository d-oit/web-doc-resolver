# Rust CLI Architecture (wdr)

Architecture reference for the `wdr` Rust CLI. Related epic: #18.

## Project Structure

```
wdr/
├── Cargo.toml
├── src/
│   ├── main.rs          # Entry point, CLI parse, dispatch (<500 LOC)
│   ├── cli.rs           # Clap arg structs + subcommands (<500 LOC)
│   ├── config.rs        # Config loading (file + env + flags) (<500 LOC)
│   ├── error.rs         # Typed errors with thiserror (<500 LOC)
│   ├── resolver.rs      # Cascade orchestrator (<500 LOC)
│   ├── output.rs        # Stdout/stderr formatting (<500 LOC)
│   └── providers/
│       ├── mod.rs         # Provider trait + registry (<500 LOC)
│       ├── exa_mcp.rs     # Exa MCP provider (<500 LOC)
│       ├── llms_txt.rs    # llms.txt provider (<500 LOC)
│       ├── direct_fetch.rs # Direct HTTP provider (<500 LOC)
│       ├── jina.rs        # Jina Reader provider (<500 LOC)
│       ├── exa.rs         # Exa API provider (<500 LOC)
│       ├── tavily.rs      # Tavily API provider (<500 LOC)
│       ├── mistral.rs     # Mistral OCR provider (<500 LOC)
│       └── duckduckgo.rs  # DuckDuckGo scraper (<500 LOC)
├── tests/
│   ├── integration/     # End-to-end tests (mock server)
│   └── providers/       # Per-provider unit tests
└── .github/
    └── workflows/
        └── rust-cli.yml   # CI: build, test, clippy, release
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
#[async_trait]
pub trait Provider: Send + Sync {
    fn name(&self) -> &'static str;
    async fn resolve(&self, input: &str, cfg: &Config) -> Result<String, ProviderError>;
}
```

## Error Types

```rust
#[derive(Debug, thiserror::Error)]
pub enum ProviderError {
    #[error("rate limited (retry after {retry_after}s)")]
    RateLimit { retry_after: u64 },
    #[error("auth error: {0}")]
    Auth(String),
    #[error("content too short ({actual} < {min})")]
    TooShort { actual: usize, min: usize },
    #[error("http error {status}: {body}")]
    Http { status: u16, body: String },
    #[error("network error: {0}")]
    Network(#[from] reqwest::Error),
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

See GitHub epic [#18](../../../issues/18) for implementation sub-issues:
- #19 Scaffold + Cargo.toml
- #20 Config module
- #21 Error types
- #22 Provider trait + registry
- #23-#29 Individual providers
- #28 Resolver orchestrator
- #27 Output module
- #26 CI/CD
