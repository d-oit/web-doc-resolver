# Documentation & DevEx Improvements (Condensed Status)

## Original Overview

8 improvements across 4 phases: onboarding tutorial, troubleshooting guide,
architecture ADRs, migration guide, dev container, contributing guide, OpenAPI
spec, performance guide.

## Status

Partially addressed. Key documentation infrastructure exists. ADR directory
structure proposed but not created.

## What's Done

- **README overhaul**: ✅ PR #336 merged — improved onboarding for Python, CLI,
  and web personas.
- **AGENTS.md alignment**: ✅ PR #320 merged — aligned with upstream standard.
- **Central index**: ✅ PR #327 merged — clarified AGENTS vs agents-docs roles.
- **ADR documentation**: This `plans/` update creates the missing ADR files
  (009, 012, 013, 014).

## What Remains

All 8 improvements remain candidates:
- Getting Started Tutorial (`TUTORIAL.md`)
- Comprehensive Troubleshooting Guide (`agents-docs/TROUBLESHOOTING.md`)
- Migration Guide (`MIGRATING.md`)
- Dev Container / Docker development
- Enhanced Contributing Guide (`CONTRIBUTING.md`)
- OpenAPI Specification (`web/openapi.yaml`)
- Performance Tuning Guide (`agents-docs/PERFORMANCE.md`)
- Provider development tutorial (`agents-docs/ADDING_PROVIDERS.md`)

## References

- [AGENTS.md](../AGENTS.md) — Project conventions
- [README.md](../README.md) — Main documentation
- [agents-docs/](../agents-docs/) — Technical reference
