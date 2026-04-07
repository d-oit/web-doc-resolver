# Sentinel Journal 🛡️

## 2025-05-15 - SSRF Protection Gap & Validation Inconsistency
**Vulnerability:** The Web UI's SSRF protection was missing the `169.254.0.0/16` range, which is used for Cloud Metadata Services (IMDS). This could allow an attacker to exfiltrate cloud credentials or metadata by submitting a specially crafted URL. Additionally, the `POST /api/resolve` endpoint was manually parsing inputs instead of using the available Zod schema, leading to inconsistent validation and potential bypasses.

**Learning:** Security logic (like SSRF protection) was duplicated across the Python backend and the TypeScript frontend, but the TypeScript version was less robust. Duplication of critical security logic often leads to one version becoming stale or incomplete.

**Prevention:** Centralize security validation logic. In this case, `validateUrl` and `validateResolveRequest` were consolidated into `web/lib/validation.ts` and enforced at the API entry point. Always ensure cloud-specific private ranges (like 169.254.x.x) are included in SSRF blocklists.
