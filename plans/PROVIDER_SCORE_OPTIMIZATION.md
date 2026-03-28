# Provider Score Optimization Plan - 2026-03-28

## Executive Summary

This document outlines a comprehensive plan to optimize low-scoring providers (duckduckgo: 0.50, exa_mcp: 0.70) and improve overall system quality.

## Current State Analysis

### Provider Scores

| Provider | Score | Content Length | Status |
|----------|-------|----------------|--------|
| duckduckgo | 0.50 | ~50 chars | ❌ Poor |
| exa_mcp | 0.70 | ~150 chars | ⚠️ Low |
| serper | 0.80 | ~200 chars | ✅ Good |
| mistral_websearch | 0.80 | ~1000 chars | ✅ Good |
| tavily | 0.91 | ~400 chars | ✅ Good |
| jina | 0.90 | ~10,000 chars | ✅ Good |
| firecrawl | 0.95 | ~8,000 chars | ✅ Excellent |

### Quality Scoring Algorithm

From `cli/src/quality.rs`:

```rust
let too_short = len < 500;           // -0.35 penalty
let missing_links = links.is_empty(); // -0.15 penalty
let duplicate_heavy = ...;            // -0.25 penalty
let noisy = ...;                      // -0.20 penalty

let acceptable = score >= threshold && !too_short;
```

**Critical insight**: The `too_short` check (`len < 500`) is a **hard rejection** even if score >= threshold.

## Root Cause Analysis

### DuckDuckGo (0.50)

**Location**: `cli/src/providers/duckduckgo.rs:129-145`

**Problem**: Markdown parsing stops after extracting only the first line of snippet.

```rust
// Current code - only takes first snippet line
for next_line in lines.iter().skip(i + 1).take(5) {
    // ...
    break;  // STOPS HERE after first content line
}
```

**Result**: Content ~50 chars → `too_short` penalty → score 0.50

### Exa MCP (0.70)

**Location**: `cli/src/providers/exa_mcp.rs:156-169`

**Problem**: Highlights limited to 30 lines, but most results have <5 highlight lines.

```rust
// Current code
for highlight_line in lines.iter().skip(j + 1).take(30) {
    // Limited highlights extraction
}
```

**Result**: Content ~150 chars → `too_short` penalty → score 0.70

## Optimization Strategy

### Phase 1: DuckDuckGo Fix (Priority: HIGH)

**Goal**: Increase content length from 50 to 500+ chars → Score 0.85+

**Changes**:

1. **Collect multiple snippet lines**:
```rust
// In parse_ddg_markdown(), replace break with collection
let mut snippet_lines = Vec::new();
for next_line in lines.iter().skip(i + 1).take(10) {
    let next_line = next_line.trim();
    if next_line.is_empty() || next_line.starts_with('[') {
        continue;
    }
    if next_line.starts_with('#') || next_line.contains("Feedback") {
        break;
    }
    snippet_lines.push(next_line.to_string());
}
let snippet = snippet_lines.join(" ");
```

2. **Collect multiple results**:
```rust
// Combine snippets from multiple results if single result is short
if results.len() == 1 && results[0].content.as_ref().map_or(0, |c| c.len()) < 500 {
    // Fetch more results and combine
}
```

**Expected outcome**: Content 500+ chars → No `too_short` penalty → Score 0.85+

### Phase 2: Exa MCP Fix (Priority: HIGH)

**Goal**: Increase content length from 150 to 500+ chars → Score 0.85+

**Changes**:

1. **Increase highlight collection**:
```rust
// In parse_exa_mcp_text(), increase limit
for highlight_line in lines.iter().skip(j + 1).take(100) {  // Was 30
    // ...
}
```

2. **Add fallback content extraction**:
```rust
// If highlights are short, extract more from description/body fields
if highlights.len() < 200 {
    // Look for Description: or Body: fields
    for j in (i + 1)..std::cmp::min(i + 20, lines.len()) {
        if let Some(desc) = lines[j].strip_prefix("Description: ") {
            highlights.push_str(desc);
        }
    }
}
```

**Expected outcome**: Content 500+ chars → No `too_short` penalty → Score 0.85+

### Phase 3: Quality Scoring Enhancement (Priority: MEDIUM)

**Goal**: More nuanced scoring for content length

**Changes to `cli/src/quality.rs`**:

```rust
// Replace binary too_short with graduated penalty
let length_score = match len {
    l if l < 100 => 0.35,   // Severe penalty
    l if l < 300 => 0.20,   // Moderate penalty
    l if l < 500 => 0.10,   // Light penalty
    _ => 0.0,               // No penalty
};

let mut score = 1.0_f32 - length_score;
```

**Additional improvements**:

```rust
// Reward structured content
let has_headings = trimmed.contains("# ");
let has_code_blocks = trimmed.contains("```");
let has_lists = trimmed.lines().any(|l| l.starts_with("- "));

if has_headings { score += 0.05; }
if has_code_blocks { score += 0.05; }
if has_lists { score += 0.03; }

// Cap at 1.0
let score = score.min(1.0);
```

### Phase 4: Provider Output Enhancement (Priority: LOW)

**Goal**: Improve content structure for all providers

**Changes**:

1. **Add content formatting metadata**:
```rust
pub struct ResolvedResult {
    pub url: String,
    pub content: Option<String>,
    pub source: String,
    pub score: f32,
    // New fields
    pub word_count: Option<usize>,
    pub has_code: Option<bool>,
    pub has_headings: Option<bool>,
}
```

2. **Content quality metadata**:
```rust
// Track what makes content valuable
struct ContentMetadata {
    links_count: usize,
    code_blocks_count: usize,
    heading_count: usize,
    list_items_count: usize,
}
```

## Implementation Plan

### Week 1: Critical Fixes

| Day | Task | Files | Expected Score Improvement |
|-----|------|-------|---------------------------|
| 1 | DuckDuckGo snippet collection | `cli/src/providers/duckduckgo.rs` | 0.50 → 0.75 |
| 2 | DuckDuckGo multi-result combine | `cli/src/providers/duckduckgo.rs` | 0.75 → 0.85 |
| 3 | Exa MCP highlight extraction | `cli/src/providers/exa_mcp.rs` | 0.70 → 0.80 |
| 4 | Exa MCP fallback content | `cli/src/providers/exa_mcp.rs` | 0.80 → 0.85 |
| 5 | Test and verify | All providers | Confirm scores |

### Week 2: Quality Enhancement

| Day | Task | Files | Impact |
|-----|------|-------|--------|
| 1 | Graduated length penalties | `cli/src/quality.rs` | Fairer scoring |
| 2 | Structure bonuses | `cli/src/quality.rs` | Reward quality |
| 3 | Add content metadata | `cli/src/types.rs` | Better insights |
| 4 | Update tests | `cli/src/quality.rs` | Coverage |
| 5 | Documentation update | `plans/` | Record changes |

## Verification Commands

```bash
# Build and test
cd cli && cargo build --release

# Test all query providers
for p in exa_mcp tavily duckduckgo serper mistral_websearch; do
  echo "=== $p ==="
  ./target/release/do-wdr resolve "rust async programming" --provider $p --json | \
    jq '{source, score, content_len: (.content | length)}'
done

# Test cascade
./target/release/do-wdr resolve "rust async programming" --json | \
  jq '{source, score, content_len: (.content | length)}'

# Debug mode
RUST_LOG=do_wdr_lib=debug ./target/release/do-wdr resolve "rust async programming"
```

## Success Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| DuckDuckGo score | 0.50 | ? | 0.85+ |
| Exa MCP score | 0.70 | ? | 0.85+ |
| Content length (DDG) | 50 chars | ? | 500+ chars |
| Content length (Exa) | 150 chars | ? | 500+ chars |
| Acceptable rate | 60% | ? | 90%+ |

## Related Files

- `cli/src/quality.rs` - Quality scoring implementation
- `cli/src/providers/duckduckgo.rs` - DuckDuckGo provider
- `cli/src/providers/exa_mcp.rs` - Exa MCP provider
- `cli/src/resolver.rs` - Cascade orchestration
- `plans/CLI_VERIFICATION_2026_03_28.md` - Current state verification

## Next Steps

1. ✅ Create this optimization plan
2. ⏳ Implement DuckDuckGo fix
3. ⏳ Implement Exa MCP fix
4. ⏳ Implement quality scoring enhancement
5. ⏳ Verify with CLI tests
6. ⏳ Create PR and merge

## Changelog

- 2026-03-28: Initial plan created based on CLI verification results