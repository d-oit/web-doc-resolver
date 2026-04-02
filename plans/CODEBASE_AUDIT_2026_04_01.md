# Codebase Audit — 2026-04-01

> Full analysis of repo structure, noise, missing implementations, stale content, and improvement opportunities.

## Summary

| Category | Issues Found |
|----------|-------------|
| Noise / dead weight | 4 |
| Stale / duplicate content | 4 |
| Missing implementations | 5 |
| Config inconsistencies | 6 |
| Skill / instruction gaps | 3 |
| CI/CD issues | 3 |
| New features needing docs/parity | 6 |

---

## 1. Noise — Safe to Remove

### 1.1 `references/CASCADE.md` — stale duplicate
- **Problem**: Root-level `references/CASCADE.md` (256 lines) is an older copy of `.agents/skills/do-web-doc-resolver/references/CASCADE.md`. They diverge significantly (different titles, content depth).
- **Action**: Delete `references/` directory. The canonical copy lives in `.agents/skills/do-web-doc-resolver/references/`.
- **Risk**: None — AGENTS.md already points to the skill copy.

### 1.2 `packages/` monorepo — unused
- **Problem**: `packages/{tokens,ui,utils}` define `@do-wdr/tokens`, `@do-wdr/ui`, `@do-wdr/utils` workspace packages, but **nothing imports them**. Zero references in `web/` or anywhere else. `web/package.json` doesn't depend on them. The token system in `cli/ui/tokens/` is the actual design system.
- **Action**: Delete `packages/` directory.
- **Risk**: None — completely orphaned code.

### 1.3 `pnpm-workspace.yaml` — references non-existent paths
- **Problem**: References `packages/*` (unused, see above) and `apps/*` (directory doesn't exist).
- **Action**: Delete `pnpm-workspace.yaml` if `packages/` is removed. If kept, remove `apps/*` entry.
- **Risk**: None.

### 1.4 `plans/` — 21 stale analysis files
- **Problem**: 21 plan/analysis files from past sessions. Most are outdated (March 2026 analyses, completed plans, old verification results).
- **Action**: Archive or delete completed/superseded plans. Keep only active plans.
- **Candidates for deletion**:
  - `CLI_TEST_RESULTS_2026_03_27.md` — old test results
  - `CLI_VERIFICATION_2026_03_28.md`, `CLI_VERIFICATION.md` — old verifications
  - `CODEBASE_ANALYSIS_2026_03_27.md`, `CODEBASE_ANALYSIS_2026_03_29.md` — superseded by this audit
  - `ANALYSIS_RESULTS.md`, `ANALYSIS_SUMMARY.md` — superseded
  - `COMPREHENSIVE_VALIDATION_PROGRESS.md` — completed
  - `PROGRESS_UPDATE.md` — completed
  - `PROVIDER_TEST_RESULTS_2026_03_28.md` — old results
  - `PROVIDER_SCORE_OPTIMIZATION_RESULTS.md` — completed
  - `EXA_MCP_ANALYSIS.md` — completed investigation
  - `ISSUE_141_EXECUTION_PLAN.md` — specific issue, likely done

---

## 2. Stale / Duplicate Content

### 2.1 `references/CASCADE.md` vs `.agents/skills/.../CASCADE.md`
- See §1.1 above. The root copy is outdated (mentions Serper in AGENTS.md cascade table but root CASCADE.md doesn't include Serper in diagram, while the skill copy does).

### 2.2 AGENTS.md cascade table vs actual Python implementation
- **Problem**: AGENTS.md shows Serper in the query cascade, but `scripts/resolve.py` and `scripts/providers_impl.py` don't implement Serper for Python. Serper is only in `scripts/models.py` as a model enum and in `cli/src/providers/serper.rs` for Rust.
- **Action**: Either implement Serper in Python or remove from AGENTS.md Python cascade description. The Rust CLI does have Serper.

### 2.3 AGENTS.md repo structure — missing `cli/ui/`
- **Problem**: AGENTS.md repository structure section doesn't mention `cli/ui/` — a substantial design system directory with its own `AGENTS.md`, components, tokens, storybook config, etc.
- **Action**: Add `cli/ui/` to the repo structure in AGENTS.md.

### 2.4 Version drift
- **Problem**: Multiple version numbers across the project:
  - `pyproject.toml`: `1.1.0`
  - `cli/Cargo.toml`: `0.3.0`
  - `web/package.json`: `0.3.0`
- **Assessment**: This may be intentional (independent versioning per component). Document the versioning strategy if so.

---

## 3. Missing Implementations

### 3.1 Python Serper provider — referenced but not implemented
- **Problem**: AGENTS.md cascade table lists Serper for queries. `scripts/models.py` defines the Serper enum. But `scripts/providers_impl.py` has no Serper implementation. Rust CLI has full Serper in `cli/src/providers/serper.rs` (288 lines).
- **Action**: Implement Serper provider in Python or remove from Python cascade docs.

### 3.2 Jina provider — in URL cascade but Python implementation unclear
- **Problem**: AGENTS.md cascade table shows Jina in URL resolution. `scripts/providers_impl.py` and `scripts/resolve.py` reference Jina. Rust CLI has `cli/src/providers/jina.rs`. Python side needs verification of completeness.
- **Action**: Verify Python Jina implementation is complete and matches the Rust version.

### 3.3 `cli/ui/` — many components pending (per AGENTS.md in cli/ui/)
- **Problem**: Per `cli/ui/AGENTS.md`, the following GitHub issues are **pending**:
  - ~30 issues across infrastructure, app shell, workspace, security, history
  - Components: Panel (#102), Modal (#103), CodeBlock (#104), StreamIndicator (#106), Resizable (#108), Bottom Nav (#110), Icon Rail (#111)
  - Major features: Wasm build (#95), Edge API (#96), Storybook setup (#98), E2E tests (#99)
- **Action**: These are tracked via GitHub issues. No immediate action needed unless prioritizing.

### 3.4 Web UI — no vitest unit tests run in CI
- **Problem**: `web/package.json` has vitest configured. `web/tests/` has unit tests (cache, providers, rate-limit, routing, records, ui-state, validation, API routes). But `ci.yml` only runs `npm run lint` and `npm run build` — no `npm test`. `ci-ui.yml` runs web lint/typecheck/build/e2e but no vitest unit tests either.
- **Action**: Add `npm test` step to CI for web unit tests.

### 3.5 `cli/ui/` CI references missing `pnpm install` workspace
- **Problem**: `ci-ui.yml` runs `pnpm install --ignore-workspace` in `cli/ui/`. This directory has a `package.json` but no lock file checked in. CI may fail or produce inconsistent installs.
- **Action**: Verify `cli/ui/` CI job works. Consider adding lock file or using npm like the `web/` CI.

---

## 4. Config Inconsistencies

### 4.1 `scripts/resolve.py` exceeds 500-line limit
- **Problem**: 544 lines. AGENTS.md rule: "Maximum 500 lines per source file."
- **Action**: Extract ~50 lines (likely the `main()` CLI entrypoint or a helper section) into a separate module.

### 4.2 `cli/Cargo.toml` edition = "2024"
- **Problem**: Rust edition is set to `2024` but `rust-version = "1.85"`. Edition 2024 is valid for Rust 1.85+, but AGENTS.md says "Rust stable, edition 2021".
- **Action**: Update AGENTS.md to reflect actual edition 2024, or revert to 2021 if intentional.

### 4.3 Python test matrix doesn't include 3.10
- **Problem**: `pyproject.toml` says `requires-python = ">=3.10"` and lists classifier for 3.10. But CI test matrix is `['3.11', '3.12', '3.13']` — missing 3.10.
- **Action**: Either add 3.10 to CI matrix or update `requires-python` to `>=3.11`.

### 4.4 `pnpm-workspace.yaml` vs npm in web/
- **Problem**: Root has `pnpm-workspace.yaml` but `web/` uses npm (`package-lock.json`, CI uses `npm ci`). Mixed package managers.
- **Action**: If `packages/` is removed and pnpm workspace is deleted, this resolves itself. Otherwise, standardize.

### 4.5 `web/package.json` lists Next.js 16
- **Problem**: `"next": "^16.2.1"` — Next.js 16 with React 19. Ensure this is intentional and compatible.
- **Assessment**: Likely correct for 2026. No action needed.

### 4.6 `.do_wdr_state.toml` tracked inconsistency
- **Problem**: File exists locally and is gitignored. Contains runtime state (`serper_credits_used = 1`). Correctly handled — just noting.
- **Action**: None needed.

---

## 5. Skills & Instructions

### 5.1 AGENTS.md missing `cli/ui/` in repo structure
- **Problem**: The `cli/ui/` directory is a major component (design system, 12 subdirectories, own AGENTS.md) but isn't mentioned in root AGENTS.md's repository structure section.
- **Action**: Add entry to AGENTS.md:
  ```
  ├── cli/                   # Rust CLI (do-wdr binary)
  │   ├── Cargo.toml
  │   ├── src/
  │   └── ui/                # Design system (tokens, components, Storybook)
  ```

### 5.2 Skill: `do-wdr-ui-component` references `cli/ui/` patterns
- **Problem**: The skill references `cli/ui/components/` for CSS-only components, which is correct. But AGENTS.md doesn't document this parallel to the `web/` Next.js app.
- **Action**: Clarify in AGENTS.md that `cli/ui/` = design system tokens/specs, `web/` = deployed Next.js app.

### 5.3 AGENTS.md setup commands incomplete
- **Problem**: Setup section doesn't mention `cli/ui/` setup:
  ```bash
  cd cli/ui && pnpm install
  ```
- **Action**: Add to setup commands section.

---

## 6. CI/CD Issues

### 6.1 Web vitest not in CI
- See §3.4. `npm test` (vitest) is never run in any CI workflow.
- **Action**: Add to `ci-ui.yml` or `ci.yml`.

### 6.2 Duplicate web build/lint in CI
- **Problem**: `ci.yml` has `web-build` job (lint + build). `ci-ui.yml` has separate `web-lint`, `web-typecheck`, `web-build`, `web-e2e` jobs. Both trigger on push/PR to main.
- **Action**: Remove `web-build` from `ci.yml` since `ci-ui.yml` handles it more comprehensively (includes typecheck and e2e).

### 6.3 `ci-ui.yml` references `cli/ui/` with pnpm but no lock file
- See §3.5.

---

## 7. Recommended Actions (Priority Order)

### High Priority (noise reduction)
1. ❌ Delete `references/` — stale duplicate
2. ❌ Delete `packages/` — unused monorepo packages
3. ❌ Delete `pnpm-workspace.yaml` — orphaned config
4. ❌ Delete `CLAUDE.md` — redundant redirect
5. 🧹 Clean `plans/` — remove ~13 superseded files (keep active plans)

### Medium Priority (correctness)
6. 📝 Update AGENTS.md repo structure — add `cli/ui/`
7. 📝 Update AGENTS.md Rust edition — `2021` → `2024`
8. 📝 Update AGENTS.md setup commands — add `cli/ui/` setup
9. 🔧 Split `scripts/resolve.py` — extract ~50 lines to stay under 500
10. 🔧 Add `npm test` to `ci-ui.yml` — web unit tests not running
11. 🔧 Remove `web-build` job from `ci.yml` — duplicate of `ci-ui.yml`

### Low Priority (improvements)
12. 📝 Document versioning strategy (Python 1.1.0, Rust 0.3.0, Web 0.3.0)
13. 📝 Clarify `cli/ui/` vs `web/` relationship in AGENTS.md
14. 🔧 Align Python CI matrix with `requires-python` (add 3.10 or bump to >=3.11)
15. 🔧 Implement Python Serper provider or remove from cascade docs
16. 📝 Add `cli/ui/` lock file for reproducible CI builds

---

## 8. What to Keep (confirmed good)

| Item | Status |
|------|--------|
| `.agents/skills/` (13 skills) | ✅ Keep — canonical skill source |
| `.blackbox/skills/` symlink | ✅ Keep — valid symlink to `.agents/skills` |
| `.claude/skills/` symlink | ✅ Keep — valid symlink to `.agents/skills` |
| `.opencode/skills/` symlink | ✅ Keep — valid symlink to `.agents/skills` |
| `skills-lock.json` | ✅ Keep — tracks external skill hashes |
| `agents-docs/` (3 files) | ✅ Keep — project documentation |
| `samples/` (2 samples + README) | ✅ Keep — user-facing examples |
| `scripts/` (Python resolver) | ✅ Keep — core implementation |
| `cli/` (Rust CLI) | ✅ Keep — core implementation |
| `cli/ui/` (design system) | ✅ Keep — active development per GitHub issues |
| `web/` (Next.js app) | ✅ Keep — deployed production app |
| `tests/` (Python tests) | ✅ Keep — test suite |
| `assets/` (logos, screenshots) | ✅ Keep — visual assets |
| `.github/workflows/` (5 workflows) | ✅ Keep — CI/CD (with fixes noted above) |
| `.github/ISSUE_TEMPLATE/` | ✅ Keep — issue templates |
| `AGENTS.md` | ✅ Keep — primary agent instructions (with updates noted) |
