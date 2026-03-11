# Security Policy

## Supported Versions

Only the latest release on the `main` branch receives security updates.

| Version | Supported |
| ------- | --------- |
| latest (`main`) | :white_check_mark: |
| older releases  | :x: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Use [GitHub Private Security Advisories](https://github.com/d-oit/web-doc-resolver/security/advisories/new) to report a vulnerability confidentially.

This keeps the report private until a fix is ready and lets us coordinate a disclosure date with you.

### What to include

- A clear description of the vulnerability
- Steps to reproduce (proof-of-concept or exploit code if possible)
- The potential impact and affected versions
- Any suggested mitigations

### What to expect

- **Acknowledgement** within 7 days of submission
- **Status update** within 14 days (accepted or declined)
- **Credit** in the advisory if you wish, once the fix is published
- Coordinated public disclosure after a patch is released

## Security Considerations

This tool makes outbound HTTP requests to third-party APIs (Exa, Tavily, Firecrawl, Mistral, Jina Reader) and fetches arbitrary URLs. Key security controls already in place:

- **SSRF protection** — private IP ranges and localhost are blocked
- **Content size limits** — responses are capped to prevent memory exhaustion
- **URL scheme filtering** — `file://`, `javascript:`, and `data:` URIs are rejected
- **No credential storage** — API keys are read from environment variables only, never written to disk

If you discover a bypass for any of these controls, please report it via the advisory link above.
