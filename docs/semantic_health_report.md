# Semantic Health Report - May 2026

## Executive Summary
The semantic cache for `do-wdr` is performing with sub-millisecond internal lookup latency for exact matches. Recent optimizations have improved URL-based cache hits by normalizing targets (stripping fragments and trailing slashes).

## Benchmark Results (5 Standard URLs)

| URL | Priming Quality | Hit Latency (Metric) | Hit Latency (Total) | Cache Hit | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [Python docs](https://docs.python.org/3/library/os.html) | 0.75 | 0ms | ~11ms | ✅ True | ⚠️ Quality |
| [Rust Book](https://doc.rust-lang.org/book/) | 1.00 | 0ms | ~12ms | ✅ True | ✅ Pass |
| [MDN JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript) | 0.80 | 0ms | ~13ms | ✅ True | ⚠️ Quality |
| [Pytest docs](https://docs.pytest.org/en/stable/) | 1.00 | 0ms | ~11ms | ✅ True | ✅ Pass |
| [Tokio docs](https://docs.rs/tokio/latest/tokio/) | 1.00 | 0ms | ~12ms | ✅ True | ✅ Pass |

## Semantic Health Analysis

### 1. Latency (Target: < 200ms)
- **Status**: ✅ **Excellent**
- **Findings**: Exact cache hits are handled by the Rust CLI in approximately 10-15ms total wall-clock time. The internal semantic framework reports 0ms for these lookups.

### 2. Quality Synthesis (Target: > 0.85)
- **Status**: ⚠️ **Warning**
- **Findings**: Quality scores for large, navigation-heavy documentation sites (Python, MDN) are falling slightly below the 0.85 target.
- **Root Cause**: Heuristics are penalizing "noisy" content like sidebars and navigation links that are often included in Jina/Firecrawl outputs.

### 3. Cache Effectiveness
- **Status**: ✅ **Improved**
- **Optimizations**:
    - Implemented fragment and trailing-slash stripping in `cli/src/semantic_cache.rs` to ensure `URL#section` hits the same cache entry as `URL`.
    - Implemented real-time cache statistics reporting in `do-wdr cache-stats`.

## Recommendations
- **Adjust Quality Thresholds**: Consider lowering the default quality threshold for verified documentation domains to 0.70 to avoid unnecessary re-resolving of high-quality but "noisy" technical docs.
- **Improved Compaction**: Enhance `cli/src/compaction.rs` to more aggressively strip known documentation sidebar patterns.
