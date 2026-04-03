# Documentation & DevEx Improvements Plan

## Overview

This plan implements 8 documentation and developer experience improvements to make the project more approachable for new users and contributors.

---

## Phase 1: User Onboarding (Week 1)

### Improvement 1: Getting Started Tutorial

**Description:** Step-by-step "First 5 Minutes" tutorial for new users.

**New File:** `TUTORIAL.md` (in project root)

```markdown
# Quick Start Tutorial

Welcome to do-web-doc-resolver! This tutorial will get you resolving URLs and queries in under 5 minutes.

## 1. Installation (1 minute)

```bash
# Clone the repository
git clone https://github.com/d-oit/do-web-doc-resolver.git
cd do-web-doc-resolver

# Install Python dependencies
pip install -r requirements.txt
```

## 2. Your First Resolution (2 minutes)

### Resolve a URL (No API Key Required!)

```bash
python -m scripts.cli "https://docs.python.org"
```

You'll see the cascade in action:
1. Checking cache...
2. Trying llms.txt...
3. Using Jina Reader...
4. Success! ✓

### Resolve a Query (No API Key Required!)

```bash
python -m scripts.cli "Python tutorial"
```

The resolver automatically uses Exa MCP (free) first, then falls back to DuckDuckGo if needed.

## 3. Understanding the Output

```json
{
  "source": "jina",
  "url": "https://docs.python.org",
  "content": "# Python documentation...",
  "score": 0.85,
  "metrics": {
    "latency_ms": 1234,
    "providers_attempted": ["llms_txt", "jina"]
  }
}
```

**What this means:**
- `source`: Which provider succeeded
- `score`: Content quality (0.0-1.0, higher is better)
- `metrics.latency_ms`: Total resolution time
- `metrics.providers_attempted`: Cascade path taken

## 4. Adding Your First API Key (1 minute)

While the resolver works without API keys, adding them improves results:

1. Get a free API key from [Serper](https://serper.dev) (2500 free credits)
2. Set the environment variable:
   ```bash
   export SERPER_API_KEY="your-key-here"
   ```
3. Run a query:
   ```bash
   python -m scripts.cli "latest AI research"
   ```

## 5. Common First-Time Issues

### "No resolution method available"
**Cause:** All providers failed or are unavailable.
**Solution:** 
- Check your internet connection
- Try a different URL/query
- Check provider status with `--log-level DEBUG`

### Rate Limiting
**Cause:** Too many requests to a provider.
**Solution:**
- Wait 30-60 seconds
- Use `--profile free` to avoid paid providers
- The resolver automatically falls back to free alternatives

### Understanding Quality Scores
- `0.80-1.00`: Excellent content
- `0.65-0.79`: Good content
- `0.50-0.64`: Thin content (may retry with other providers)
- `< 0.50`: Poor content (rejected)

## Next Steps

- Try the **Rust CLI** for faster performance: `cd cli && cargo build --release`
- Explore the **Web UI**: `cd web && npm run dev`
- Read the [full documentation](README.md)
- Check out the [API reference](.agents/skills/do-web-doc-resolver/references/CLI.md)

## Getting Help

- [Open an issue](https://github.com/d-oit/do-web-doc-resolver/issues)
- Check the [troubleshooting guide](TROUBLESHOOTING.md)
- Read [AGENTS.md](AGENTS.md) for development setup

---

Happy resolving! 🚀
```

**Update README.md:**
Add link to tutorial:
```markdown
## Quick Start

New here? Start with our [5-minute tutorial](TUTORIAL.md) to resolve your first URL.
```

---

### Improvement 2: Comprehensive Troubleshooting Guide

**New File:** `agents-docs/TROUBLESHOOTING.md`

```markdown
# Troubleshooting Guide

## Error Message Index

| Error Message | Likely Cause | Solution |
|---------------|--------------|----------|
| "No resolution method available" | All providers failed | Check network, verify URL/query, check logs |
| "Rate limited" | Too many requests | Wait 30-60s, use `--profile free`, check provider limits |
| "Provider unavailable" | Circuit breaker tripped | Wait 5 minutes, check provider status |
| "SSRF_BLOCKED" | Invalid/unsafe URL | Use public URLs only (no localhost, private IPs) |
| "Authentication failed" | Invalid API key | Verify key, check for typos, regenerate if needed |
| "Timeout" | Slow provider/network | Use `--profile fast`, check connection, try again |
| "Empty content" | Provider returned nothing | Try different provider, check URL is valid |

## Debugging Resolution

### Enable Debug Logging

```bash
python -m scripts.cli "https://example.com" --log-level DEBUG
```

You'll see:
```
DEBUG:root:Resolving URL: https://example.com
DEBUG:root:Trying provider: llms_txt
DEBUG:root:Provider llms_txt failed: 404
DEBUG:root:Trying provider: jina
DEBUG:root:Provider jina succeeded in 1234ms
```

### Test Individual Providers

```bash
# Test specific provider
python -m scripts.cli "https://example.com" --provider jina

# Skip specific providers
python -m scripts.cli "https://example.com" --skip exa_mcp --skip firecrawl
```

### Check Provider Status

```bash
# List all providers
./target/release/do-wdr providers

# Show current configuration
./target/release/do-wdr config
```

## Provider-Specific Issues

### Exa MCP
**Symptom:** "Exa MCP failed" or "Rate limit"
**Solution:**
- Wait 30 seconds (built-in cooldown)
- Try again with `--skip exa_mcp`
- Check if MCP server is available: `curl https://mcp.exa.ai/mcp`

### Jina Reader
**Symptom:** "429 Too Many Requests"
**Solution:**
- Wait 60 seconds
- Jina has a 20 RPM free tier
- Consider adding delay between requests

### Firecrawl
**Symptom:** "Authentication failed" or "No credits"
**Solution:**
- Verify `FIRECRAWL_API_KEY` is set correctly
- Check remaining credits in Firecrawl dashboard
- Consider using `--profile free` to skip paid providers

### Tavily
**Symptom:** Queries not returning results
**Solution:**
- Tavily works best for factual/research queries
- Try rephrasing as a question
- Check `TAVILY_API_KEY` is valid

## Performance Issues

### Slow Resolution (10+ seconds)

**Check cascade order:**
```bash
python -m scripts.cli "query" --log-level INFO
```

**Solutions:**
1. Use `--profile fast` for low-latency mode
2. Enable semantic cache for repeated queries
3. Check routing memory isn't outdated
4. Skip slow providers: `--skip mistral_browser`

### High Memory Usage

**Symptom:** Process using too much RAM
**Solution:**
- Reduce `WEB_RESOLVER_MAX_CHARS` (default: 8000)
- Clear cache: `rm -rf .cache/`
- Use batch processing with smaller batches

## Web UI Issues

### Build Failures

**Symptom:** `npm run build` fails
**Solutions:**
1. Ensure `postcss.config.mjs` exists
2. Clear `node_modules` and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```
3. Check Node.js version (requires 18+)

### E2E Test Failures

**Symptom:** Playwright tests fail
**Solutions:**
1. Update browsers: `npx playwright install`
2. Check dev server is running on port 3000
3. Verify backend on port 8000

## Configuration Issues

### Environment Variables Not Loading

**Check:**
```bash
echo $EXA_API_KEY  # Should show your key
```

**Solutions:**
1. Export variables in current shell (not just .bashrc)
2. Use `.env` file with python-dotenv
3. For Rust CLI, use `DO_WDR_*` prefix or config.toml

### Config File Not Found

**Rust CLI config locations:**
- `~/.config/do-wdr/config.toml`
- `./config.toml`

**Example config.toml:**
```toml
max_chars = 8000
profile = "balanced"
skip_providers = ["exa"]

[api_keys]
tavily = "your-key-here"
```

## Still Having Issues?

1. **Check the logs:** `--log-level DEBUG`
2. **Test with free providers only:** `--profile free`
3. **Verify your environment:** `./scripts/quality_gate.sh`
4. **Open an issue:** Include debug logs and error messages

## Related Resources

- [Provider Reference](.agents/skills/do-web-doc-resolver/references/PROVIDERS.md)
- [Configuration Guide](.agents/skills/do-web-doc-resolver/references/CONFIG.md)
- [GitHub Issues](https://github.com/d-oit/do-web-doc-resolver/issues)
```

---

## Phase 2: Architecture Documentation (Week 2)

### Improvement 3: Architecture Decision Records (ADRs)

**New Directory:** `agents-docs/adr/`

**New File:** `agents-docs/adr/001-provider-cascade-architecture.md`

```markdown
# ADR 001: Provider Cascade Architecture

## Status
Accepted

## Context
The resolver needs to query multiple web sources to maximize content quality and minimize cost. A single provider approach is risky (single point of failure) and expensive (always using paid APIs).

## Decision
Implement a cascade architecture with the following characteristics:

1. **Free-first ordering:** Free providers are attempted before paid ones
2. **Parallel execution:** Multiple providers can run simultaneously with hedging
3. **Quality gating:** Results below threshold trigger next provider
4. **Automatic failover:** Provider failures are handled gracefully
5. **Learned preferences:** Routing memory optimizes provider ordering

## Consequences

### Positive
- Cost efficiency: Most queries resolved by free providers
- Reliability: Multiple fallback options
- Quality: Can retry with different providers for better results
- Performance: Parallel execution reduces latency

### Negative
- Complexity: More complex than single-provider approach
- Debugging: Harder to trace which provider succeeded
- Resource usage: Parallel execution uses more memory/connections

## Alternatives Considered

### Single Provider
- **Rejected:** Too expensive, single point of failure

### Random Provider Selection
- **Rejected:** Doesn't optimize for cost or quality

### Static Provider Order
- **Rejected:** Can't adapt to changing conditions

## References
- [Cascade Reference](.agents/skills/do-web-doc-resolver/references/CASCADE.md)
```

**New File:** `agents-docs/adr/002-python-plus-rust.md`

```markdown
# ADR 002: Dual Python and Rust Implementation

## Status
Accepted (under review for consolidation)

## Context
The project started in Python for rapid prototyping, then added Rust CLI for performance. Need to decide on long-term strategy.

## Decision
Maintain both implementations with shared core logic:

1. **Python:** Primary development, easier to iterate
2. **Rust:** High-performance CLI, type safety
3. **Shared patterns:** Keep cascade logic consistent

## Future Direction
Evaluate PyO3 bindings to unify implementations:
- Rust as core library
- Python as thin wrapper
- Single source of truth

## Consequences

### Positive
- Python: Fast iteration, rich ecosystem
- Rust: Performance, reliability, better deployment

### Negative
- Code duplication: ~500 lines of similar logic
- Maintenance burden: Changes must be made twice
- Divergence risk: Implementations may drift apart

## References
- [Rust CLI Reference](.agents/skills/do-web-doc-resolver/references/RUST_CLI.md)
```

**Additional ADRs to create:**
- `003-free-first-strategy.md`
- `004-quality-scoring-algorithm.md`
- `005-circuit-breaker-pattern.md`
- `006-semantic-cache-design.md`
- `007-routing-memory.md`

**Template:** `agents-docs/adr/template.md`

```markdown
# ADR XXX: Title

## Status
- Proposed
- Accepted
- Deprecated
- Superseded by ADR XXX

## Context
What is the issue we're seeing that is motivating this decision?

## Decision
What is the decision being made?

## Consequences
What becomes easier or more difficult to do?

## Alternatives Considered
What other options were evaluated?

## References
Links to related documents or issues.
```

---

### Improvement 4: Migration Guide

**New File:** `MIGRATING.md`

```markdown
# Migration Guide

This guide helps you upgrade between versions of do-web-doc-resolver.

## 0.2.x → 0.3.0

### Breaking Changes
- Binary renamed: `wdr` → `do-wdr`
- Environment variables: `WDR_*` → `DO_WDR_*`
- Config directory: `~/.config/wdr` → `~/.config/do-wdr`

### Migration Steps

1. **Update scripts using the binary:**
   ```bash
   # Before
   wdr resolve "query"
   
   # After
   do-wdr resolve "query"
   ```

2. **Update environment variables:**
   ```bash
   # Add to ~/.bashrc, ~/.zshrc, or ~/.profile
   export DO_WDR_API_KEY="$WDR_API_KEY"
   export DO_WDR_TAVILY_API_KEY="$WDR_TAVILY_API_KEY"
   
   # Unset old variables
   unset WDR_API_KEY
   unset WDR_TAVILY_API_KEY
   ```

3. **Migrate configuration file:**
   ```bash
   mkdir -p ~/.config/do-wdr
   
   # If you have a config file
   mv ~/.config/wdr/config.toml ~/.config/do-wdr/
   
   # Update environment variable references in config
   sed -i 's/WDR_/DO_WDR_/g' ~/.config/do-wdr/config.toml
   ```

4. **Update shell aliases:**
   ```bash
   # In ~/.bashrc or ~/.zshrc
   alias wdr='do-wdr'  # Temporary compatibility
   ```

### Deprecation Timeline
- 0.3.0: Old names work with warnings
- 0.4.0: Old names removed

## 0.3.x → 0.4.0

### Breaking Changes
- Python 3.9 support removed (minimum 3.10)
- Removed deprecated `resolve_sync()` function
- CLI flag `--output-json` renamed to `--json`

### Migration Steps

1. **Update Python version:**
   ```bash
   # Check current version
   python --version  # Must be 3.10+
   
   # Update if needed
   pyenv install 3.12
   pyenv local 3.12
   ```

2. **Update function calls:**
   ```python
   # Before
   from scripts.resolve import resolve_sync
   result = resolve_sync(url)
   
   # After
   from scripts.resolve import resolve
   result = resolve(url)  # Now async by default
   ```

3. **Update CLI scripts:**
   ```bash
   # Before
   do-wdr resolve "query" --output-json
   
   # After
   do-wdr resolve "query" --json
   ```

## General Migration Tips

### Check Your Current Version
```bash
# Python
python -c "from scripts import __version__; print(__version__)"

# Rust CLI
do-wdr --version
```

### Backup Your Configuration
Before upgrading:
```bash
cp ~/.config/do-wdr/config.toml ~/.config/do-wdr/config.toml.backup
```

### Test After Migration
```bash
# Quick functionality test
./scripts/quality_gate.sh

# Resolve a test URL
python -m scripts.cli "https://example.com"
```

## Getting Help

If you encounter issues during migration:
1. Check this guide for your specific version
2. Review the [CHANGELOG](CHANGELOG.md)
3. [Open an issue](https://github.com/d-oit/do-web-doc-resolver/issues)

## Version Compatibility Matrix

| Version | Python | Rust | Node.js | Status |
|---------|--------|------|---------|--------|
| 0.4.x | 3.10+ | 1.75+ | 20+ | Current |
| 0.3.x | 3.9+ | 1.70+ | 18+ | Supported |
| 0.2.x | 3.9+ | 1.65+ | 18+ | EOL |
```

---

## Phase 3: Developer Experience (Week 3)

### Improvement 5: Dev Container / Docker Development

**New File:** `Dockerfile.dev`

```dockerfile
# Development container for do-web-doc-resolver

FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    git \
    pkg-config \
    libssl-dev \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs

# Set working directory
WORKDIR /workspace

# Install Python dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Install development tools
RUN pip install \
    black \
    ruff \
    pytest \
    pytest-asyncio \
    mypy

# Pre-install Rust dependencies for faster builds
COPY cli/Cargo.toml cli/Cargo.lock ./cli/
RUN mkdir -p cli/src && echo "fn main() {}" > cli/src/main.rs
RUN cd cli && cargo fetch

# Expose ports
EXPOSE 8000 3000

# Set environment
ENV PYTHONPATH=/workspace
ENV WEB_RESOLVER_LOG_LEVEL=DEBUG

# Default command
CMD ["bash"]
```

**New File:** `docker-compose.yml`

```yaml
version: '3.8'

services:
  resolver:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/workspace
      - cargo-cache:/root/.cargo
      - node-modules:/workspace/web/node_modules
    environment:
      - WEB_RESOLVER_LOG_LEVEL=DEBUG
      - PYTHONPATH=/workspace
      # Add your API keys here or use .env file
      - EXA_API_KEY=${EXA_API_KEY}
      - TAVILY_API_KEY=${TAVILY_API_KEY}
    ports:
      - "8000:8000"  # Python backend
      - "3000:3000"  # Next.js dev server
    command: bash
    stdin_open: true
    tty: true

volumes:
  cargo-cache:
  node-modules:
```

**New File:** `.devcontainer/devcontainer.json`

```json
{
  "name": "do-web-doc-resolver",
  "dockerComposeFile": "../docker-compose.yml",
  "service": "resolver",
  "workspaceFolder": "/workspace",
  
  "features": {
    "ghcr.io/devcontainers/features/rust:1": {
      "version": "latest",
      "profile": "default"
    },
    "ghcr.io/devcontainers/features/node:1": {
      "version": "22"
    },
    "ghcr.io/devcontainers/features/github-cli:1": {}
  },
  
  "customizations": {
    "vscode": {
      "extensions": [
        "ms-python.python",
        "ms-python.vscode-pylance",
        "rust-lang.rust-analyzer",
        "vadimcn.vscode-lldb",
        "esbenp.prettier-vscode",
        "bradlc.vscode-tailwindcss",
        "ms-playwright.playwright"
      ],
      "settings": {
        "python.defaultInterpreterPath": "/usr/local/bin/python",
        "rust-analyzer.cargo.target": "x86_64-unknown-linux-gnu",
        "editor.formatOnSave": true,
        "editor.codeActionsOnSave": {
          "source.fixAll": true
        }
      }
    }
  },
  
  "postCreateCommand": "pip install -r requirements.txt && cd cli && cargo build",
  
  "postStartCommand": "git config --global --add safe.directory /workspace",
  
  "remoteUser": "root",
  
  "forwardPorts": [8000, 3000],
  
  "portsAttributes": {
    "8000": {
      "label": "Python Backend",
      "onAutoForward": "notify"
    },
    "3000": {
      "label": "Next.js Dev Server",
      "onAutoForward": "openPreview"
    }
  }
}
```

**New File:** `.devcontainer/post-create.sh`

```bash
#!/bin/bash
set -e

echo "🚀 Setting up development environment..."

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt
pip install black ruff pytest mypy

# Install pre-commit hooks
echo "🎣 Installing pre-commit hooks..."
./scripts/setup-hooks.sh

# Build Rust CLI
echo "🦀 Building Rust CLI..."
cd cli && cargo build

# Install web dependencies
echo "🌐 Installing web dependencies..."
cd web && npm install

echo "✅ Development environment ready!"
echo ""
echo "Quick start:"
echo "  Python: python -m scripts.cli 'https://example.com'"
echo "  Rust:   cd cli && cargo run -- resolve 'https://example.com'"
echo "  Web:    cd web && npm run dev"
```

---

### Improvement 6: Enhanced Contributing Guide

**Update:** `CONTRIBUTING.md`

```markdown
# Contributing to do-web-doc-resolver

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Option 1: Local Development

```bash
# Clone the repository
git clone https://github.com/d-oit/do-web-doc-resolver.git
cd do-web-doc-resolver

# Install Python dependencies
pip install -r requirements.txt

# Build Rust CLI
cd cli && cargo build
cd ..

# Install web dependencies
cd web && npm install
cd ..

# Setup git hooks
./scripts/setup-hooks.sh
```

### Option 2: Dev Container (Recommended)

Using VS Code with Dev Containers:
1. Open project in VS Code
2. Run "Dev Containers: Reopen in Container"
3. Wait for setup to complete

Or with Docker:
```bash
docker-compose up -d
docker-compose exec resolver bash
```

## How to Contribute

### Reporting Bugs

1. Check if the issue already exists
2. Create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Python version, etc.)
   - Debug logs (use `--log-level DEBUG`)

### Suggesting Features

1. Open a feature request issue
2. Describe the use case
3. Explain why existing solutions don't work
4. Propose an implementation approach

### Adding New Providers

See [Adding Providers Guide](agents-docs/ADDING_PROVIDERS.md) for detailed instructions.

Quick checklist:
- [ ] Provider implementation in `scripts/providers_impl.py`
- [ ] ProviderType enum value
- [ ] Cascade integration
- [ ] Unit tests with mocked responses
- [ ] Live integration tests (if you have API key)
- [ ] Documentation updates
- [ ] Rate limit handling
- [ ] Error classification

### Code Style

#### Python
- Use `black` for formatting: `black scripts/ tests/`
- Use `ruff` for linting: `ruff check scripts/ tests/`
- Type hints required for public functions
- Docstrings for all public functions and classes
- Maximum 500 lines per file

#### Rust
- Use `cargo fmt` for formatting
- Use `cargo clippy` for linting: `cargo clippy -- -D warnings`
- Maximum 500 lines per file
- Errors via `thiserror`, propagation via `anyhow`

#### Commits
- Use [Conventional Commits](https://www.conventionalcommits.org/)
- Format: `type(scope): description`
- Types: `feat`, `fix`, `docs`, `ci`, `test`, `refactor`
- Examples:
  - `feat(providers): add ScrapingAnt integration`
  - `fix(resolve): handle timeout in cascade`
  - `docs(readme): update installation instructions`

### Testing

```bash
# Run all tests
./scripts/quality_gate.sh

# Python unit tests
python -m pytest tests/ -v -m "not live"

# Python live tests (requires API keys)
python -m pytest tests/ -v -m live

# Rust tests
cd cli && cargo test

# Web tests
cd web && npx playwright test
```

### Pull Request Process

1. **Fork and branch:**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes:**
   - Write code
   - Add tests
   - Update documentation

3. **Run quality gate:**
   ```bash
   ./scripts/quality_gate.sh
   ```

4. **Commit:**
   ```bash
   git add .
   git commit -m "feat(scope): description"
   ```

5. **Push and create PR:**
   ```bash
   git push origin feature/my-feature
   ```

6. **PR requirements:**
   - Clear description of changes
   - Link to related issues
   - Tests passing
   - Documentation updated
   - Code review approval

### Development Workflow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Issue     │ -> │   Branch    │ -> │    PR       │
│   Created   │    │   Created   │    │   Review    │
└─────────────┘    └─────────────┘    └─────────────┘
                                            │
                                            v
                                   ┌─────────────┐
                                   │   Merge     │
                                   │   to main   │
                                   └─────────────┘
```

### Getting Help

- [Discord/Slack community link]
- [GitHub Discussions](https://github.com/d-oit/do-web-doc-resolver/discussions)
- [Open an issue](https://github.com/d-oit/do-web-doc-resolver/issues)

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help newcomers learn and grow
- Respect different viewpoints and experiences

Thank you for contributing! 🎉
```

**New File:** `agents-docs/ADDING_PROVIDERS.md`

```markdown
# Adding a New Provider

This guide walks you through adding a new provider to the resolver.

## Overview

Providers implement the provider interface/protocol and are registered in the cascade. The resolver supports two types:

- **URL Providers:** Extract content from URLs (Jina, Firecrawl, etc.)
- **Query Providers:** Search for information (Exa, Tavily, etc.)

## Quick Start

1. Choose provider type (URL or Query)
2. Implement provider function/module
3. Add ProviderType enum value
4. Register in cascade
5. Add tests
6. Update documentation

## Step-by-Step Guide

### Step 1: Choose Provider Type

**URL Provider Example:** Jina Reader
- Input: URL string
- Output: Extracted content
- Use for: Converting web pages to markdown

**Query Provider Example:** Tavily
- Input: Query string
- Output: Search results
- Use for: Finding information across the web

### Step 2: Implement Provider (Python)

**New Provider Template:**

```python
# scripts/providers_impl.py

def resolve_with_newprovider(
    input_str: str, 
    max_chars: int = MAX_CHARS
) -> ResolvedResult | None:
    """
    Resolve using NewProvider API.
    
    Args:
        input_str: URL or query string
        max_chars: Maximum characters to return
        
    Returns:
        ResolvedResult on success, None on failure
    """
    # Get API key from environment
    api_key = os.getenv("NEWPROVIDER_API_KEY")
    if not api_key:
        return None
    
    # Check rate limiting
    if _is_rate_limited("newprovider"):
        return None
    
    try:
        # API call
        response = requests.get(
            "https://api.newprovider.com/extract",
            headers={"Authorization": f"Bearer {api_key}"},
            params={"url": input_str},
            timeout=30
        )
        
        # Handle rate limits
        if response.status_code == 429:
            _set_rate_limit("newprovider", 60)
            return None
        
        response.raise_for_status()
        data = response.json()
        
        # Extract content
        content = data.get("content", "")
        
        if len(content) < MIN_CHARS:
            return None
        
        return ResolvedResult(
            source="newprovider",
            content=compact_content(content, max_chars),
            url=input_str if is_url(input_str) else None,
            query=input_str if not is_url(input_str) else None,
            metadata={
                "title": data.get("title"),
                "credits_used": data.get("credits")
            }
        )
        
    except requests.Timeout:
        logger.warning(f"NewProvider timeout for {input_str}")
        return None
    except Exception as e:
        logger.error(f"NewProvider error: {e}")
        return None
```

### Step 3: Add ProviderType

```python
# scripts/models.py

class ProviderType(Enum):
    # ... existing providers
    NEWPROVIDER = "newprovider"
    
    def is_paid(self) -> bool:
        """Return True if provider is paid."""
        return self in {
            # ... existing paid providers
            ProviderType.NEWPROVIDER,
        }
```

### Step 4: Register in Cascade

```python
# scripts/resolve.py

# For URL providers (in resolve_url_stream):
cascade_map = {
    # ... existing providers
    "newprovider": (
        ProviderType.NEWPROVIDER,
        lambda: resolve_with_newprovider(url, max_chars)
    ),
}

# For query providers (in resolve_query_stream):
cascade_map = {
    # ... existing providers
    "newprovider": (
        ProviderType.NEWPROVIDER,
        lambda: resolve_with_newprovider(query, max_chars)
    ),
}
```

### Step 5: Add Tests

```python
# tests/test_providers.py

class TestNewProvider:
    """Test NewProvider integration."""
    
    def test_newprovider_available_with_key(self, monkeypatch):
        """Test provider available when API key set."""
        monkeypatch.setenv("NEWPROVIDER_API_KEY", "test-key")
        # Test implementation
    
    def test_newprovider_unavailable_without_key(self, monkeypatch):
        """Test provider unavailable without API key."""
        monkeypatch.delenv("NEWPROVIDER_API_KEY", raising=False)
        # Test implementation
    
    @pytest.mark.live
    @pytest.mark.skipif(
        not os.getenv("NEWPROVIDER_API_KEY"),
        reason="No API key"
    )
    def test_live_newprovider(self):
        """Test with real API."""
        result = resolve_with_newprovider("test input", max_chars=1000)
        assert result is not None
        assert result.source == "newprovider"
```

### Step 6: Update Documentation

1. **PROVIDERS.md:** Add provider details
2. **CASCADE.md:** Update cascade diagram
3. **README.md:** Add to provider list
4. **CONFIG.md:** Add environment variable

## Provider Checklist

Before submitting PR:

- [ ] Provider implementation
- [ ] ProviderType enum
- [ ] Cascade registration
- [ ] Rate limit handling
- [ ] Error handling
- [ ] Unit tests
- [ ] Integration tests
- [ ] Documentation updates
- [ ] CHANGELOG.md entry

## Provider Pattern Reference

### URL Provider Pattern

```
1. Check API key
2. Check rate limit
3. Make HTTP request
4. Handle errors (429, timeout, etc.)
5. Parse response
6. Validate content length
7. Return ResolvedResult
```

### Query Provider Pattern

```
1. Check API key
2. Check rate limit
3. Make search request
4. Handle errors
5. Parse results
6. Format as markdown
7. Return ResolvedResult
```

## Common Issues

### Rate Limiting
Always handle 429 status:
```python
if response.status_code == 429:
    _set_rate_limit("provider_name", 60)  # 60 second cooldown
    return None
```

### Timeouts
Set appropriate timeouts:
```python
response = requests.get(url, timeout=30)
```

### Error Classification
Log errors appropriately:
```python
except requests.Timeout:
    logger.warning(f"Provider timeout for {input_str}")
    return None
except Exception as e:
    logger.error(f"Provider error: {e}")
    return None
```

## Getting Help

- Check existing providers for examples
- Open a draft PR for early feedback
- Ask questions in discussions

## Examples

See these providers for reference implementations:
- **URL:** `scripts/providers_impl.py::resolve_with_jina`
- **Query:** `scripts/providers_impl.py::resolve_with_tavily`

For Rust implementations:
- **URL:** `cli/src/providers/jina.rs`
- **Query:** `cli/src/providers/tavily.rs`
```

---

## Phase 4: API Documentation (Week 4)

### Improvement 7: OpenAPI Specification

**New File:** `web/openapi.yaml`

```yaml
openapi: 3.0.3
info:
  title: do-web-doc-resolver API
  description: |
    Resolve URLs and queries into compact, LLM-ready markdown.
    
    ## Authentication
    No authentication required for basic usage. Set API keys via environment variables for paid providers.
    
    ## Rate Limiting
    Free tier has generous limits. Paid providers have their own rate limits.
  version: 1.0.0
  contact:
    name: GitHub Issues
    url: https://github.com/d-oit/do-web-doc-resolver/issues

servers:
  - url: http://localhost:8000
    description: Local development
  - url: https://api.do-wdr.dev
    description: Production

paths:
  /api/resolve:
    post:
      summary: Resolve URL or query
      description: |
        Resolve a URL or query into markdown content.
        
        The resolver automatically detects URL vs query and runs the appropriate cascade.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ResolveRequest'
      responses:
        '200':
          description: Successful resolution
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ResolveResponse'
        '400':
          description: Invalid request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '429':
          description: Rate limited
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
  
  /api/resolve/batch:
    post:
      summary: Batch resolution
      description: Resolve multiple URLs or queries in parallel.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BatchRequest'
      responses:
        '200':
          description: Batch results
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BatchResponse'
  
  /api/health:
    get:
      summary: Health check
      responses:
        '200':
          description: Service is healthy
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: "ok"

components:
  schemas:
    ResolveRequest:
      type: object
      required:
        - input
      properties:
        input:
          type: string
          description: URL or query string
          example: "https://example.com"
        max_chars:
          type: integer
          description: Maximum characters to return
          default: 8000
          example: 5000
        profile:
          type: string
          enum: [free, fast, balanced, quality]
          default: balanced
          description: Execution profile
        format:
          type: string
          enum: [markdown, json, plain, html]
          default: markdown
          description: Output format
    
    ResolveResponse:
      type: object
      properties:
        source:
          type: string
          description: Provider that succeeded
          example: "jina"
        content:
          type: string
          description: Resolved content
        url:
          type: string
          description: Resolved URL (if input was URL)
        query:
          type: string
          description: Query string (if input was query)
        score:
          type: number
          description: Content quality score (0.0-1.0)
          example: 0.85
        metrics:
          type: object
          properties:
            latency_ms:
              type: integer
              example: 1234
            providers_attempted:
              type: array
              items:
                type: string
              example: ["llms_txt", "jina"]
            cache_hit:
              type: boolean
    
    BatchRequest:
      type: object
      properties:
        requests:
          type: array
          items:
            type: object
            properties:
              id:
                type: string
              input:
                type: string
              max_chars:
                type: integer
          maxItems: 20
    
    BatchResponse:
      type: object
      properties:
        results:
          type: array
          items:
            $ref: '#/components/schemas/ResolveResponse'
    
    Error:
      type: object
      properties:
        error:
          type: string
        code:
          type: string
        details:
          type: object
```

---

### Improvement 8: Performance Tuning Guide

**New File:** `agents-docs/PERFORMANCE.md`

```markdown
# Performance Tuning Guide

This guide helps you optimize do-web-doc-resolver for your use case.

## Understanding Metrics

When you run resolution with `--metrics-json`:

```json
{
  "latency_ms": 1234,
  "providers_attempted": ["llms_txt", "jina"],
  "cache_hit": false,
  "paid_usage": false
}
```

### Key Metrics

| Metric | Good | Bad | Action |
|--------|------|-----|--------|
| `latency_ms` | < 3000 | > 10000 | Use `--profile fast` |
| `providers_attempted` | 1-2 | 5+ | Check routing memory |
| `cache_hit` | true | false | Enable semantic cache |
| `paid_usage` | false (if cost-sensitive) | true unexpectedly | Use `--profile free` |

## Profile Selection

### When to Use Each Profile

| Profile | Use Case | Latency | Cost |
|---------|----------|---------|------|
| `free` | CI/CD, cost-sensitive | Variable | $0 |
| `fast` | Interactive, low latency | < 4s | Low |
| `balanced` | General use | 5-12s | Medium |
| `quality` | Deep research | 10-20s | High |

### Profile Examples

```bash
# CI/CD pipeline - never use paid providers
python -m scripts.cli "https://example.com" --profile free

# Interactive use - quick results
python -m scripts.cli "query" --profile fast

# Research - best results regardless of cost
python -m scripts.cli "complex research topic" --profile quality
```

## Optimization Strategies

### 1. Enable Semantic Cache

```python
# Automatic with default settings
result = resolve("https://example.com")

# Second call uses cache
result = resolve("https://example.com")  # Instant!
```

Benefits:
- 10-100x faster for repeated queries
- Reduces API costs
- Works across sessions

### 2. Use Routing Memory

The resolver learns which providers work best for each domain:

```bash
# First call - explores providers
python -m scripts.cli "https://docs.python.org"

# Subsequent calls - uses fastest provider
python -m scripts.cli "https://docs.python.org"  # Faster!
```

To reset:
```bash
rm -rf .cache/routing_memory.json
```

### 3. Connection Pooling

For high-throughput scenarios:

```python
import requests
from scripts.resolve import resolve

# Create session with pooling
session = requests.Session()
adapter = requests.adapters.HTTPAdapter(
    pool_connections=20,
    pool_maxsize=50
)
session.mount("https://", adapter)

# Reuse session for multiple requests
```

### 4. Batch Processing

Process multiple URLs efficiently:

```python
from scripts.batch_resolve import resolve_batch

urls = [
    "https://example.com/1",
    "https://example.com/2",
    "https://example.com/3",
]

results = resolve_batch(urls, max_concurrent=5)
```

### 5. Skip Slow Providers

If you know certain providers are slow:

```bash
# Skip Mistral browser (slow but thorough)
python -m scripts.cli "https://example.com" --skip mistral_browser

# Skip multiple providers
python -m scripts.cli "query" --skip exa_mcp --skip tavily
```

## Benchmarking Your Setup

### Simple Benchmark

```bash
# Time a single resolution
time python -m scripts.cli "https://example.com"

# Or with hyperfine (recommended)
hyperfine --warmup 3 'python -m scripts.cli "https://example.com"'
```

### Load Testing

```bash
# Install oha (Rust-based load tester)
cargo install oha

# Test concurrent requests
oha -z 30s -c 10 \
  --method POST \
  -d '{"input": "https://example.com"}' \
  http://localhost:8000/api/resolve
```

### Profiling

```python
# Python profiling
import cProfile
import pstats

profiler = cProfile.Profile()
profiler.enable()

resolve("https://example.com")

profiler.disable()
stats = pstats.Stats(profiler)
stats.sort_stats('cumulative')
stats.print_stats(20)
```

## Common Bottlenecks

### 1. Network Latency

**Symptom:** High latency for first request to new domain
**Solution:** 
- Pre-warm DNS cache
- Use keep-alive connections
- Enable HTTP/2

### 2. Provider Throttling

**Symptom:** Frequent rate limits
**Solution:**
- Use `--profile free` for testing
- Add delays between requests
- Spread load across multiple providers

### 3. Content Processing

**Symptom:** High CPU usage during compaction
**Solution:**
- Reduce `WEB_RESOLVER_MAX_CHARS`
- Skip compaction for small content
- Use streaming for large documents

### 4. Cache Misses

**Symptom:** Repeated identical queries are slow
**Solution:**
- Enable semantic cache
- Check cache TTL settings
- Verify cache directory permissions

## Environment Tuning

### Environment Variables

```bash
# Reduce max content size for faster processing
export WEB_RESOLVER_MAX_CHARS=4000

# Increase for better results
export WEB_RESOLVER_MAX_CHARS=16000

# Adjust timeout for slow networks
export WEB_RESOLVER_TIMEOUT=60

# Enable debug logging for troubleshooting
export WEB_RESOLVER_LOG_LEVEL=DEBUG
```

### Rust CLI Config

```toml
# config.toml
max_chars = 8000
profile = "fast"
quality_threshold = 0.60  # Lower = faster but may retry more
```

## Scaling Considerations

### Single Instance

Good for:
- Personal use
- Small teams
- < 1000 requests/day

### Horizontal Scaling

For high throughput:

1. **Load balancer** in front of multiple instances
2. **Shared cache** (Redis/Turso)
3. **Rate limiting** per provider across instances

Example with Docker Compose:

```yaml
version: '3.8'

services:
  resolver-1:
    build: .
    environment:
      - REDIS_URL=redis://cache:6379
  
  resolver-2:
    build: .
    environment:
      - REDIS_URL=redis://cache:6379
  
  cache:
    image: redis:alpine
```

## Troubleshooting Performance

### High Latency (> 10s)

1. Check provider cascade:
   ```bash
   python -m scripts.cli "https://example.com" --log-level DEBUG
   ```

2. Identify slow provider

3. Skip or replace:
   ```bash
   python -m scripts.cli "https://example.com" --skip slow_provider
   ```

### Memory Issues

1. Reduce max chars:
   ```bash
   export WEB_RESOLVER_MAX_CHARS=4000
   ```

2. Clear cache:
   ```bash
   rm -rf .cache/
   ```

3. Use streaming for large documents

## References

- [Architecture Overview](adr/001-provider-cascade-architecture.md)
- [Provider Reference](references/PROVIDERS.md)
- [Configuration Guide](references/CONFIG.md)
```

---

## Summary of New Files

| File | Purpose |
|------|---------|
| `TUTORIAL.md` | 5-minute getting started guide |
| `agents-docs/TROUBLESHOOTING.md` | Comprehensive error guide |
| `agents-docs/adr/` | Architecture decision records |
| `MIGRATING.md` | Version migration guide |
| `Dockerfile.dev` | Development container |
| `docker-compose.yml` | Multi-service dev setup |
| `.devcontainer/` | VS Code dev container config |
| `CONTRIBUTING.md` | Enhanced contribution guide |
| `agents-docs/ADDING_PROVIDERS.md` | Provider development tutorial |
| `web/openapi.yaml` | API specification |
| `agents-docs/PERFORMANCE.md` | Performance tuning guide |

---

## Timeline

| Week | Focus | Deliverables |
|------|-------|--------------|
| 1 | User Onboarding | Tutorial, troubleshooting guide |
| 2 | Architecture | ADRs, migration guide |
| 3 | Developer Experience | Dev container, contributing guide, provider tutorial |
| 4 | API & Performance | OpenAPI spec, performance guide |
