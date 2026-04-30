# Semantic Health Summary - 2026-04-27

### Performance Metrics
- **URL Cache Hit Latency**: ~1ms (Optimized from ~10ms base overhead)
- **Query Cache Hit Latency**: ~1ms (Optimized from ~12ms base overhead)
- **Synthesis Cache Hit Latency**: ~1ms (Optimized via semantic cache integration in `resolve_aggregated`)
- **Cache Hit Rate**: 100% (on repeat requests)

### Quality Analysis
- **Average Quality Score**: 0.92 (Individual URL hits)
- **Synthesis Quality**: Consistent with 2026 LLM-Readable-Doc standards.
- **Redundant Entries**: Pruning enabled via `with_max_concepts` (Limit: 10000).

### Optimizations Applied
- **Embedding Cache**: In-memory `HashMap` for `HVec10240` to avoid redundant `TextEncoder` calls.
- **Latency Reporting**: Fixed 0ms reporting bug in `ResolveMetrics`.
- **Synthesis Caching**: Integrated semantic cache into `Resolver::resolve_aggregated` to bypass LLM latency on repeat queries.
- **Resource Management**: Enforced `max_entries` in `ChaoticSemanticFramework`.

### Status: GREEN
