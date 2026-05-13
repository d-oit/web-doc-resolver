# Testing & Quality Improvements (Condensed Status)

## Original Overview

10 testing improvements across 4 phases: provider tests, security tests,
parity tests, test infrastructure, E2E tests, documentation testing.

## Status

Partially addressed by ongoing CI improvements (ADR-013). Detailed test
coverage plans remain valid.

## What's Done

- **CI reliability**: ✅ npm `--legacy-peer-deps` fix, libsql `--test-threads=1`,
  ESLint config update (see [ADR-013](013-test-coverage-and-ci-reliability.md)).
- **Test fixtures**: `conftest.py` updated with lock-safe clearing methods
  (ADR-012 Wave 1).

## What Remains

All 10 improvements remain to be implemented:
- Serper provider tests (Phase 1)
- Security test suite (SSRF, URL validation, input sanitization)
- Python/Rust parity tests
- Performance benchmark tests
- Coverage threshold enforcement (80%)
- Web E2E with real backend
- Error condition tests (rate limit, network errors, quality thresholds)
- Documentation testing (README examples)
- Flaky test detection (reruns)

## References

- [ADR-013](013-test-coverage-and-ci-reliability.md) — CI & test coverage plan
- [AUDIT.md](AUDIT.md) — M5 (web unit tests), M6 (Rust tests), M7 (mobile CI)
- [tests/](../tests/) — Test directory
