# Sentinel Journal

## Security Patterns

### SSRF Protection
- **Expansion of Blocked Ranges:** Blocklists now include CGNAT (100.64.0.0/10), documentation ranges (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24), and IPv6 documentation (2001:db8::/32).
- **DNS Rebinding Defense:** Rust implementation utilizes `is_safe_url_async` which performs DNS resolution via `tokio::net::lookup_host` and validates the resulting IP addresses.
- **Manual Redirect Handling:** Rust providers (`DirectFetch`, `Jina`, `LlmsTxt`) use a `safe_request` utility that manually handles redirects and validates each hop against the async SSRF check.

### Consistency
- Security guards are synchronized across Python (`scripts/utils.py`), Web (`web/lib/validation.ts`), and Rust (`cli/src/resolver/cascade.rs`).

## Constraints
- **PR Hygiene:** Avoid including large generated files like `pnpm-lock.yaml` or system files in security patches.
- **Async Validation:** Rust link validation and provider extraction MUST use async SSRF checks with DNS resolution.

## Side Effects
- **Manual Redirects:** Disabling automatic redirects in the HTTP client requires manual `Location` header parsing and `max_redirects` enforcement.
