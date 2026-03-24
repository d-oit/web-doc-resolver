# Rust CLI Reference

## Overview

The Rust CLI (`do-wdr`) is a compiled binary for fast, dependency-free resolution. It implements the same cascade logic as the Python resolver but with better performance and portability.

## Building

```bash
cd cli
cargo build --release

# Binary location
# Linux/macOS: cli/target/release/do-wdr
# Windows: cli/target/release/do-wdr.exe
```

### Build Requirements

- Rust 1.70+ (stable)
- `cargo` package manager

### Optional Features

```toml
# Cargo.toml features
[features]
default = ["full"]
full = ["exa", "tavily", "firecrawl", "mistral"]
minimal = []  # Only free providers
```

```bash
# Build minimal version (free providers only)
cargo build --release --no-default-features --features minimal
```

## Architecture

```
cli/
├── Cargo.toml
└── src/
    ├── main.rs           # Entry point, CLI parsing
    ├── lib.rs            # Library exports
    ├── config.rs         # Configuration loading
    ├── resolve.rs        # Main resolution logic
    ├── cascade.rs        # Provider cascade orchestration
    ├── quality.rs        # Content quality scoring
    ├── cache.rs          # Disk-based caching
    ├── circuit_breaker.rs # Circuit breaker implementation
    ├── routing.rs        # Provider selection logic
    └── providers/
        ├── mod.rs        # Provider trait and registry
        ├── exa_mcp.rs    # Exa MCP (free)
        ├── exa.rs        # Exa SDK
        ├── tavily.rs     # Tavily API
        ├── serper.rs     # Serper API
        ├── duckduckgo.rs # DuckDuckGo (free)
        ├── jina.rs       # Jina Reader (free)
        ├── firecrawl.rs  # Firecrawl API
        ├── direct.rs     # Direct fetch (free)
        ├── llms_txt.rs   # llms.txt probe (free)
        ├── mistral.rs    # Mistral browser/websearch
        ├── docling.rs    # Document processing
        └── ocr.rs        # OCR extraction
```

## Usage

### Basic Commands

```bash
# Resolve URL
do-wdr "https://docs.rs/tokio"

# Resolve query
do-wdr "Rust async runtime"

# JSON output
do-wdr "query" --json

# With options
do-wdr "query" --max-chars 5000 --profile quality
```

### CLI Options

```
USAGE:
    do-wdr [OPTIONS] <INPUT>

ARGS:
    <INPUT>    URL or search query to resolve

OPTIONS:
    -m, --max-chars <NUM>    Maximum characters in output [default: 8000]
    -j, --json               Output as JSON
    -p, --profile <PROFILE>  Execution profile [default: balanced]
                             [possible: free, fast, balanced, quality]
    -s, --skip <PROVIDER>    Skip provider (can be used multiple times)
        --provider <NAME>    Use specific provider only
    -t, --timeout <SECS>     Request timeout [default: 30]
    -v, --verbose            Verbose output
    -h, --help               Print help
    -V, --version            Print version
```

### Examples

```bash
# Fast lookup
do-wdr "React hooks tutorial" --profile fast

# Deep research
do-wdr "quantum computing algorithms" --profile quality --max-chars 10000

# Free only
do-wdr "Python async" --profile free

# Skip specific providers
do-wdr "query" --skip exa --skip tavily

# Use only DuckDuckGo
do-wdr "query" --provider duckduckgo

# Debug output
do-wdr "query" --verbose --log-level debug
```

## Configuration

### Config File Location

- Linux/macOS: `~/.config/do-wdr/config.toml`
- Windows: `%APPDATA%\do-wdr\config.toml`

### Example Configuration

```toml
[defaults]
max_chars = 8000
timeout = 30
profile = "balanced"

[cache]
enabled = true
ttl_hours = 24
path = "~/.cache/do-wdr"

[circuit_breaker]
failure_threshold = 3
cooldown_seconds = 300

[providers]
# API keys (optional - can also use env vars)
exa_api_key = "your-key"
tavily_api_key = "your-key"

[providers.exa]
num_results = 5
use_autoprompt = true

[providers.duckduckgo]
num_results = 5
```

## Performance

### Benchmarks

| Metric | Python | Rust |
|--------|--------|------|
| Startup time | ~200ms | ~5ms |
| Memory (idle) | ~50MB | ~5MB |
| Memory (peak) | ~100MB | ~20MB |
| Binary size | N/A | ~15MB |

### Optimization Tips

1. **Use release builds**: `cargo build --release`
2. **Strip binary**: `strip target/release/do-wdr`
3. **LTO**: Enable in `Cargo.toml`:
   ```toml
   [profile.release]
   lto = true
   codegen-units = 1
   ```

## Provider Implementation

### Provider Trait

```rust
pub trait Provider: Send + Sync {
    fn name(&self) -> &str;
    fn is_free(&self) -> bool;
    fn input_type(&self) -> InputType;

    async fn resolve(
        &self,
        input: &str,
        options: ResolveOptions,
    ) -> Result<Option<ResolvedResult>, ProviderError>;
}
```

### Adding a New Provider

1. Create `src/providers/new_provider.rs`
2. Implement `Provider` trait
3. Register in `src/providers/mod.rs`
4. Add to cascade in `src/cascade.rs`

### Example Provider

```rust
pub struct NewProvider {
    api_key: Option<String>,
}

impl Provider for NewProvider {
    fn name(&self) -> &str {
        "new_provider"
    }

    fn is_free(&self) -> bool {
        false
    }

    fn input_type(&self) -> InputType {
        InputType::Query
    }

    async fn resolve(
        &self,
        input: &str,
        options: ResolveOptions,
    ) -> Result<Option<ResolvedResult>, ProviderError> {
        // Implementation
        Ok(Some(ResolvedResult {
            source: self.name().to_string(),
            content: "...".to_string(),
            url: None,
            query: Some(input.to_string()),
            score: 0.8,
            ..Default::default()
        }))
    }
}
```

## Error Handling

```rust
pub enum ProviderError {
    RateLimited { retry_after: Option<u64> },
    AuthError,
    QuotaExhausted,
    NetworkError(String),
    NotFound,
    Timeout,
    InvalidResponse(String),
    Unknown(String),
}
```

## Testing

```bash
# Run all tests
cargo test

# Run specific test
cargo test test_resolve_url

# Run with output
cargo test -- --nocapture

# Run integration tests (requires API keys)
cargo test --features integration
```
