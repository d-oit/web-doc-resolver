# ADR-015: Unified Cascade Architecture

## Status

Accepted

## Context

`_query_resolve.py` (255 lines) and `_url_resolve.py` (307 lines) share ~80% identical cascade logic: semantic cache check, budget setup, provider ordering, hedged concurrent probing, quality gate, circuit breaker recording, and negative cache writes.

## Decision

Extract a shared `cascade_stream()` generator into `scripts/_cascade.py` that accepts a cascade_map, target, and provider-specific config. Both `_query_resolve.py` and `_url_resolve.py` call this shared generator.

## Consequences

### Positive

- ~200 lines of duplicated code eliminated
- Single place to fix cascade bugs
- Easier to add new cascade features

### Negative

- Introduces an additional module and abstraction layer

### Neutral

- Both `_query_resolve.py` and `_url_resolve.py` remain as entry points but delegate core logic to `_cascade.py`
