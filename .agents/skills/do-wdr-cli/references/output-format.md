# Output Format

## Text Output (default)

Returns markdown content directly:

```markdown
# Documentation Title

Content extracted from the URL...
```

## JSON Output

```json
{
  "url": "https://example.com/docs",
  "content": "# Documentation\n\n...",
  "source": "exa_mcp",
  "score": 0.87,
  "metrics": {
    "latency_ms": 1234,
    "providers_attempted": ["exa_mcp"],
    "cache_hit": false
  }
}
```

## Metrics Output

```bash
# Output metrics as JSON
do-wdr resolve "query" --metrics-json

# Save metrics to file
do-wdr resolve "query" --metrics-file metrics.json
```

Metrics include:
- `latency_ms`: Total resolution time
- `providers_attempted`: List of providers tried
- `cache_hit`: Whether semantic cache was used
- `provider_metrics`: Per-provider latency and success status
