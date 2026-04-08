# Bolt's Journal - Performance Optimizations

## 2025-05-15 - [Parallel Link Validation & Import Hoisting]
**Learning:** Sequential HTTP HEAD requests for link validation was a major I/O bottleneck. Parallelizing them using `ThreadPoolExecutor` significantly improved performance (validated ~2x faster in benchmarks). Also, moving local imports in frequently called functions like `normalize_url` to the module level reduces overhead.
**Action:** Always look for sequential I/O operations that can be parallelized. Use top-level imports for utility functions that are in the critical path. Ensure thread safety by avoiding global state modifications (like `socket.setdefaulttimeout`) in functions used in parallel contexts.
