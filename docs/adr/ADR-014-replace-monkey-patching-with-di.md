# ADR-014: Replace Monkey-Patching with Dependency Injection

## Status

Accepted

## Context

The codebase previously used monkey-patching to share state between resolve.py and sub-modules (_query_resolve.py, _url_resolve.py). This was replaced with shared singletons in scripts/state.py, but a formalized ResolverState dataclass provides better dependency injection.

## Decision

Introduce a ResolverState dataclass in scripts/state.py that encapsulates circuit_breakers, routing_memory, semantic_cache, and executor. The main resolve.py owns the state instance and sub-modules receive it via module-level references.

## Consequences

### Positive

- Better testability
- Explicit state ownership
- Easier to mock in tests

### Negative

- Requires refactoring existing module imports to use the dataclass interface

### Neutral

- Module-level singletons in scripts/state.py remain as the underlying storage mechanism
