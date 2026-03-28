# CLI Provider Verification Results - 2026-03-28

## Environment

```bash
# From repo root
set -a && source .env && set +a
cd cli && cargo build --release
```

## Provider Test Results

### Query Providers

| Provider | Score | Content Length | Status |
|----------|-------|----------------|--------|
| exa_mcp | 0.70 | ~150 chars | ⚠️ Low |
| tavily | 0.91 | ~400 chars | ✅ Good |
| duckduckgo | 0.50 | ~50 chars | ❌ Poor |
| serper | 0.80 | ~200 chars | ✅ Good |
| mistral_websearch | 0.80 | ~1000 chars | ✅ Good |

### URL Providers

| Provider | Score | Content Length | Status |
|----------|-------|----------------|--------|
| jina | 0.90 | ~10,000 chars | ✅ Good |
| firecrawl | 0.95 | ~8,000 chars | ✅ Excellent |

### Cascade Mode

```bash
cd cli && ./target/release/do-wdr resolve "rust async programming"
```

**Result**: exa_mcp selected (first in cascade), score 0.50

## Key Findings

### Low Score Providers

1. **duckduckgo (0.50)**
   - Content: Only title extracted, no snippet
   - Issue: Jina Reader markdown parsing incomplete
   - Root cause: `parse_ddg_markdown()` stops after first line of snippet

2. **exa_mcp (0.70)**
   - Content: Highlights extracted but truncated
   - Issue: Multiple results concatenated, but each has short highlights
   - Root cause: `parse_exa_mcp_text()` limits highlight lines to 30

### High Score Providers

1. **tavily (0.91)**
   - Returns structured JSON with full snippets
   - Quality scoring rewards content length

2. **mistral_websearch (0.80)**
   - Returns formatted markdown with structure
   - AI-generated summaries are comprehensive

3. **jina/firecrawl (0.90-0.95)**
   - Full page content extracted
   - Markdown conversion preserves structure

## Scoring Analysis

The quality scoring in `cli/src/resolver.rs` uses:

| Signal | Penalty |
|--------|---------|
| Too short (< 500 chars) | -0.35 |
| Missing links | -0.15 |
| Duplicate-heavy | -0.25 |
| Noisy content | -0.20 |

**Threshold**: 0.65

### Why duckduckgo scores 0.50

- Content length: ~50 chars → **too_short penalty**
- Base score: 1.0 - 0.35 (short) - 0.15 (no links) = 0.50

### Why exa_mcp scores 0.70

- Content length: ~150 chars → **too_short penalty**
- But has highlights → partial credit
- Base score: 1.0 - 0.35 (short) + 0.05 (has highlights) = 0.70

## Optimization Recommendations

### Priority 1: DuckDuckGo (0.50 → 0.80+)

**Current issue**: Markdown parsing stops too early

**Proposed fix**:
```rust
// In parse_ddg_markdown()
// Collect more snippet lines (up to 10 instead of 1)
for next_line in lines.iter().skip(i + 1).take(10) {
    // ...
}
```

**Expected result**: Content length increases → penalty reduced → score 0.80+

### Priority 2: Exa MCP (0.70 → 0.85+)

**Current issue**: Highlights truncated, content short

**Proposed fix**:
```rust
// In parse_exa_mcp_text()
// Increase highlight limit from 30 to 100 lines
for highlight_line in lines.iter().skip(j + 1).take(100) {
    // ...
}
```

**Expected result**: More context captured → score 0.85+

### Priority 3: Quality Scoring Refinement

**Current issue**: Binary penalties too harsh

**Proposed enhancement**:
```rust
// Graduated penalties based on content length
let length_penalty = match content.len() {
    l if l < 100 => 0.35,   // Very short
    l if l < 300 => 0.20,   // Short
    l if l < 500 => 0.10,   // Acceptable
    _ => 0.0,               // Good
};
```

## Test Commands

```bash
# Test all providers
cd cli && for p in exa_mcp tavily duckduckgo serper mistral_websearch; do
  echo "=== $p ===" && ./target/release/do-wdr resolve "rust async" --provider $p --json | jq '{source, score, content_len: (.content | length)}'
done

# Test URL providers
cd cli && for p in jina firecrawl; do
  echo "=== $p ===" && ./target/release/do-wdr resolve "https://docs.rs/tokio" --provider $p --json | jq '{source, score, content_len: (.content | length)}'
done
```

## Related Files

- `cli/src/providers/duckduckgo.rs` - DuckDuckGo markdown parsing
- `cli/src/providers/exa_mcp.rs` - Exa MCP highlights extraction
- `cli/src/resolver.rs` - Quality scoring implementation
- `plans/QUALITY_SCORING_ANALYSIS.md` - Deep analysis (pending)
- `plans/DUCKDUCKGO_OPTIMIZATION.md` - DDG optimization (pending)
- `plans/EXA_MCP_OPTIMIZATION.md` - Exa optimization (pending)