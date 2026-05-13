# ADR-013: Test Coverage & CI Reliability — Misleading Tests, CI Fixes

## Status

Wave 1b COMPLETED. Waves 2 and 5 PENDING.

## Context

The test suite has misleading structure: some tests pass without actually
testing the code path they claim to cover (e.g., tests that skip without
asserting when API keys are missing). CI has configuration gaps (coverage
uploads, npm peer deps, gitleaks triggers) and flakiness (libsql `Once`
poisoning, npm peer dep conflicts).

## Wave 1b — CI Reliability (COMPLETED)

| ID | Task | Status |
|----|------|--------|
| I6 | Fix package.json version specifiers | ✅ |
| I7 | Update version in package-lock.json | ✅ |
| I8 | Regenerate lockfile after version fixes | ✅ |
| — | npm `--legacy-peer-deps` for ESLint 10 compat | ✅ |
| — | libsql `--test-threads=1` for semantic cache tests | ✅ |
| — | ESLint config update (playwright globals, build exclusions) | ✅ |

## Wave 2 — CI Config Fixes (PENDING)

| ID | Task | File | Effort |
|----|------|------|--------|
| I1 | Fix coverage upload condition | `.github/workflows/ci.yml:106` | S |
| I2 | Fix gitleaks branch triggers | `.github/workflows/gitleaks.yml:5-6` | S |
| I3 | Update actions/checkout in gitleaks | `.github/workflows/gitleaks.yml:21` | S |
| I4 | Install lint deps from requirements.txt | `.github/workflows/ci.yml:69` | S |
| I5 | Shellcheck severity → error | `.pre-commit-config.yaml:34` | S |
| K1-K3 | Consolidate pre-commit hooks | `scripts/setup-hooks.sh`, `.githooks/` | M |
| K4 | Fix requirements.txt package names | `requirements.txt` | S |
| K5 | Add Python 3.13 classifier | `pyproject.toml:16-18` | S |
| K7 | Fix close-resolved-issues.yml trigger | `.github/workflows/close-resolved-issues.yml:4` | S |

## Wave 5 — New Test Files (PENDING)

| ID | Task | Effort |
|----|------|--------|
| C1-C2 | Stream resolution tests | L |
| C3 | Provider unit tests | L |
| C4 | Synthesis tests | M |
| C5-C7 | Utils, models, CLI tests | M |

## Open Test Infrastructure Gaps

| Gap | Detail |
|-----|--------|
| Mobile/tablet Playwright | CI runs `--project=desktop` only; mobile regressions undetected |
| Code coverage | No `--cov-fail-under` threshold enforced |
| Python 3.10 in CI | `requires-python = ">=3.10"` but CI matrix is 3.11/3.12/3.13 |
| Web unit tests | `web/lib/circuit-breaker.ts`, `errors.ts`, `quality.ts`, `keys.ts` untested |
| Rust unit tests | `query.rs` (527 lines) and `url.rs` (496 lines) lack direct unit tests |

## References

- [CI_FIX.md](CI_FIX.md) — Detailed CI fix notes (npm, libsql)
- [ESLINT_CONFIG_UPDATE.md](ESLINT_CONFIG_UPDATE.md) — ESLint fix notes
- [GOAP_FOLLOWUP.md](GOAP_FOLLOWUP.md) — Wave execution tracking
