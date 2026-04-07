## 2025-05-15 - [SSRF Protection Gap in llms.txt Fetching]
**Vulnerability:** The `fetch_llms_txt` function in the Python core was missing SSRF protections, allowing outbound requests to localhost and private network ranges.
**Learning:** Security controls like SSRF protection must be applied consistently across all entry points that perform outbound HTTP requests, including secondary paths like probing for `llms.txt`.
**Prevention:** Centralize URL validation in a shared utility and enforce its use in all network-bound providers.

## 2025-05-15 - [Unbounded API Input Length]
**Vulnerability:** The web API's `/api/resolve` endpoint accepted arbitrarily long strings as input, creating a potential Denial of Service (DoS) vector and risk of memory exhaustion.
**Learning:** Even if internal logic has caps, the initial request handler should enforce strict limits on raw input before processing.
**Prevention:** Implement reasonable length limits (e.g., 2048 chars) on all user-controlled inputs at the entry point.

## 2025-05-15 - [Mypy & Type Safety Debt]
**Vulnerability:** Inconsistent type annotations and legacy SDK usage caused frequent CI failures and obscured runtime logic, leading to fragile code that could hide security bugs.
**Learning:** Strict type checking is a security control. Silent Mypy errors or over-reliance on `Any` can mask vulnerabilities in data handling or API integration.
**Prevention:** Enforce strict type checking in CI and resolve all Mypy errors using proper type definitions instead of suppression. Ensure external SDKs are used with correct version-specific types.
