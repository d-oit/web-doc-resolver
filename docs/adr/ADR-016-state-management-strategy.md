# ADR-016: State Management Strategy

## Status

Accepted

## Context

Multiple modules need access to shared mutable state (circuit breakers, routing memory, thread pool executor). Previously managed via monkey-patching, now via module-level singletons in scripts/state.py.

## Decision

Continue using scripts/state.py as the single source of truth for shared mutable state. Add atexit handler for executor cleanup. Sub-modules import directly from scripts.state. The ResolverState dataclass (ADR-014) provides a formalized interface.

## Consequences

### Positive

- Centralized state management
- Clean shutdown via atexit
- Explicit import dependencies

### Negative

- All modules depending on scripts/state.py create a coupling to a single module

### Neutral

- atexit handler is registered once at import time and requires no manual cleanup calls
