# Integration

## Script Integration

```bash
#!/bin/bash
# Example: Resolve and process results

RESULT=$(do-wdr resolve "Rust web frameworks" --json)
echo "$RESULT" | jq '.content' > frameworks.md

# Use in pipeline
do-wdr resolve "API documentation" | grep -A5 "## Authentication"
```

## Shell Script Patterns

### Error Handling

```bash
#!/bin/bash
set -e

RESULT=$(do-wdr resolve "$QUERY" --json 2>/dev/null)
if [ $? -ne 0 ]; then
    echo "Resolution failed" >&2
    exit 1
fi
```

### Parallel Resolution

```bash
# Resolve multiple queries in parallel
do-wdr resolve "query1" --json > result1.json &
do-wdr resolve "query2" --json > result2.json &
wait
```

### Cache Management

```bash
# Skip cache for fresh results
do-wdr resolve "query" --skip-cache

# Check cache stats
do-wdr cache-stats
```

## CI/CD Integration

```yaml
# GitHub Actions example
- name: Resolve documentation
  run: |
    do-wdr resolve "https://docs.example.com" --output docs.md
    do-wdr resolve "API reference" --json --output api.json
```
