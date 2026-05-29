# CLI Examples

## Basic Usage

```bash
# Resolve a URL
do-wdr resolve "https://docs.rs/tokio/latest/tokio/"

# Resolve a query
do-wdr resolve "Rust async runtime comparison"

# JSON output
do-wdr resolve "Python web frameworks" --json
```

## Provider Selection

```bash
# Use specific provider
do-wdr resolve "query" --provider exa_mcp

# Skip providers
do-wdr resolve "query" --skip tavily,serper

# Custom provider order
do-wdr resolve "query" --providers-order duckduckgo,exa_mcp,tavily
```

## Output Options

```bash
# Save to file
do-wdr resolve "https://example.com" --output result.md

# JSON output to file
do-wdr resolve "query" --json --output results.json

# Include metrics
do-wdr resolve "query" --json --metrics-json
```

## Performance Profiles

```bash
# Free tier only (no API keys needed)
do-wdr resolve "query" --profile free

# Balanced speed and quality
do-wdr resolve "query" --profile balanced

# Fast results
do-wdr resolve "query" --profile fast

# High quality results
do-wdr resolve "query" --profile quality
```

## Advanced Features

```bash
# Synthesize multiple results
do-wdr resolve "query" --synthesize

# Skip cache
do-wdr resolve "query" --skip-cache

# Save metrics for analysis
do-wdr resolve "query" --metrics-file metrics.json
```
