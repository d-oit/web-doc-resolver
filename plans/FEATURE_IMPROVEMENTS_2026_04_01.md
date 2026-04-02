# Feature & Improvement Analysis — 2026-04-01

> Functional gaps, parity issues, and improvement opportunities across Python, Rust CLI, Web UI.
> Includes production verification plan with real tests, evals, and responsive browser testing.

## Summary

| Category | Items |
|----------|-------|
| Cross-platform parity gaps | 7 |
| Python improvements | 5 |
| Rust CLI improvements | 4 |
| Web UI improvements | 5 |
| Infrastructure / DX | 4 |
| Production verification | 5 |

---

## 1. Cross-Platform Parity Gaps

### 1.1 Serper provider — Rust + Web have it, Python doesn't
- **Rust**: `cli/src/providers/serper.rs` (288 lines, full implementation)
- **Web**: `web/lib/resolvers/query.ts` exports `searchViaSerper`
- **Python**: `scripts/models.py` has `ProviderType.SERPER` enum but `scripts/providers_impl.py` has no `resolve_with_serper()`. `scripts/routing.py` query cascade omits serper.
- **Impact**: Python users miss a provider with 2500 free credits.
- **Action**: Implement `resolve_with_serper()` in `scripts/providers_impl.py`, add to query cascade in `scripts/routing.py`.

### 1.2 `exa_mcp_mistral` combo provider — Web has it, Rust + Python don't
- **Web**: `web/lib/resolvers/query.ts` has `searchViaExaMcpWithMistral()` — feeds Exa MCP results into Mistral for synthesis. `route.ts` auto-enables it when both exa_mcp and mistral keys are present.
- **Rust/Python**: No equivalent.
- **Impact**: Best-quality free+paid hybrid missing from CLI tools.

### 1.3 Deep research (parallel providers) — Web has it, Python + Rust don't
- **Web**: `route.ts` supports `deepResearch: true` → runs all selected providers in parallel, merges results.
- **Python**: Has `synthesize_results()` and `deterministic_merge()` but no CLI flag or parallel execution mode.
- **Rust**: Has `--synthesize` flag but only for post-processing, no parallel execution.
- **Impact**: Power feature missing from CLI tools.

### 1.4 Budget profiles — Web + Python have 4, Rust CLI has flag but no enforcement
- **Web**: `lib/routing.ts` — `free`, `fast`, `balanced`, `quality` profiles with budget enforcement.
- **Python**: `scripts/routing.py` — same 4 profiles with `ResolutionBudget`.
- **Rust**: `cli/src/cli.rs` has `--profile` arg but `resolver/` doesn't map profile names to budget values. Individual `--max-provider-attempts` etc. flags exist but no named presets.
- **Impact**: Rust users must manually set 3 flags instead of `--profile balanced`.

### 1.5 Preflight routing — Python has it, Rust + Web don't
- **Python**: `scripts/routing.py` has `preflight_route()` and `detect_doc_platform()` — detects GitBook, Sphinx, MkDocs, Notion, Confluence and routes to best strategy.
- **Rust**: `routing.rs` has basic `detect_js_heavy()` (Notion/Confluence only).
- **Web**: `lib/routing.ts` has `detectJsHeavy()` (same minimal check).
- **Impact**: Python gets smarter URL routing for doc platforms.

### 1.6 Hedged requests — Python has it, Rust + Web don't
- **Python**: `resolve_url_stream()` and `resolve_query_stream()` use `concurrent.futures` with hedging — starts next provider if current exceeds p75 latency threshold from routing memory.
- **Rust**: Sequential cascade only.
- **Web**: Sequential cascade (with parallel only in deep research mode).
- **Impact**: Python has lower tail latency.

### 1.7 Routing memory persistence — Python in-memory only, Rust has file persistence
- **Python**: `scripts/routing_memory.py` — in-memory `RoutingMemory`, lost on restart.
- **Rust**: `cli/src/routing_memory.rs` — persists to file, survives restarts.
- **Web**: No routing memory (stateless serverless).
- **Impact**: Python loses learned provider rankings between runs.

---

## 2. Python Improvements

### 2.1 `scripts/resolve.py` exceeds 500-line limit (544 lines)
- Rule: "Maximum 500 lines per source file."
- **Action**: Extract `main()` CLI entrypoint (~50 lines) into `scripts/cli.py`.

### 2.2 No Serper provider implementation
- See §1.1.

### 2.3 Quality scoring doesn't use `score_result()` from utils
- `scripts/utils.py` has `score_result()` (domain-based scoring).
- `scripts/quality.py` has `score_content()` (content heuristics).
- Never combined — domain signals could improve quality scoring.

### 2.4 `resolve_with_exa` uses deprecated API pattern
- `exa_py` client uses `r.highlight or r.text` — may be outdated.

### 2.5 `resolve_with_mistral_browser` uses beta API
- Uses `client.beta.conversations.start()` with `WebSearchTool()` — beta Mistral API.

---

## 3. Rust CLI Improvements

### 3.1 Profile presets not wired to budget
- See §1.4. `--profile` flag exists but budget enforcement uses individual flags only.

### 3.2 Docling/OCR providers — stub implementations
- Both shell out to CLI tools. Functional when tools installed, no HTTP API fallback.

### 3.3 Semantic cache — feature-gated, CI-tested, but undocumented
- `chaotic_semantic_memory` crate with Turso/libsql backend.
- CI tests pass with `--features semantic-cache`.
- Not documented in AGENTS.md or README as user-facing feature.

### 3.4 No `--deep-research` parallel mode
- See §1.3.

---

## 4. Web UI Improvements

### 4.1 Vitest unit tests not in any CI workflow
- `web/tests/` has 7 unit test files + 2 API route tests.
- Neither `ci.yml` nor `ci-ui.yml` runs `npm test` (vitest).
- **Action**: Add `npm test` step to `ci-ui.yml`.

### 4.2 Duplicate provider function maps
- `web/lib/resolvers/index.ts` defines `queryProviders` and `urlProviders` maps.
- `web/app/api/resolve/route.ts` has separate `runQueryProvider()` / `runUrlProvider()` switch statements.
- **Action**: Refactor route.ts to use shared provider maps.

### 4.3 `page.tsx` is a 649-line monolith
- All UI: state, handlers, sidebar, input, output, modal — inline.
- **Action**: Extract into `Sidebar.tsx`, `InputBar.tsx`, `OutputPane.tsx`, `ShortcutsModal.tsx`.

### 4.4 No URL validation in API route before resolve
- `web/lib/resolvers/index.ts` has `validateUrl()` with SSRF protection.
- `route.ts` doesn't call it.
- **Action**: Add `validateUrl()` check in POST handler.

### 4.5 Quality score not surfaced to user
- `route.ts` computes `scoreContent(markdown)` and returns it.
- `page.tsx` doesn't display it.
- **Action**: Show quality indicator in metadata bar.

---

## 5. Infrastructure / DX

### 5.1 Version sync mechanism — partially done
- ✅ `scripts/sync_versions.py` created and working.
- **Remaining**:
  - Add to `scripts/quality_gate.sh`
  - Add to `scripts/pre-commit-hook.sh`
  - Update `scripts/release.sh` to call `sync_versions.py --set`
  - Update AGENTS.md with docs
  - Add `tests/test_version_sync.py`

### 5.2 `ci.yml` and `ci-ui.yml` have overlapping web jobs
- `ci.yml` has `web-build` job (lint + build).
- `ci-ui.yml` has `web-lint`, `web-typecheck`, `web-build`, `web-e2e`.
- **Action**: Remove `web-build` from `ci.yml`.

### 5.3 Python 3.10 not in CI test matrix
- `pyproject.toml`: `requires-python = ">=3.10"`. CI tests 3.11/3.12/3.13 — no 3.10.

### 5.4 Skill version metadata stale
- `.agents/skills/do-web-doc-resolver/SKILL.md` has `version: "0.1.0"` in frontmatter.
- Project is at `1.1.0`. Skill version should track project version.
- **Action**: Update skill metadata version or decouple with comment.

---

## 6. Test Coverage Gaps

### What EXISTS ✅

| Layer | Tests | Lines | Coverage |
|-------|-------|-------|----------|
| Python unit | `tests/test_resolve.py` (1128), `test_routing_foundation.py` (622) | 1750 | Cascade, quality, budgets, cache, circuit breaker, negative cache, edge cases (empty, long, special chars, SSRF) |
| Python live | `tests/test_live_api_integrations.py` (145) | 145 | Exa MCP, Jina, Exa SDK, Tavily, Firecrawl, Mistral (gated by `@pytest.mark.live`) |
| Python skill tests | `.agents/skills/do-web-doc-resolver/tests/` (5 files) | 966 | Circuit breaker, providers, quality, resolve, routing |
| Rust inline | 42 test functions across 18 files | ~500 | CLI parsing, config, error classification, output, types, all 12 providers, cascade, resolver |
| Rust integration | `cli/tests/` (5 files) | 329 | Circuit breaker, negative cache, quality, routing, semantic cache |
| Web unit (vitest) | `web/tests/` (7 files + 2 API) | 859 | Cache, providers, rate-limit, records, routing, ui-state, validation, API routes |
| Web E2E (Playwright) | 3 spec files | 1222 | Page load, CSS, forms, errors, dark mode, results, security headers, nav, sidebar, API keys, profiles, help, history, provider gating |
| Web E2E projects | 4 configured | — | desktop, mobile (Pixel 7), tablet (iPad Pro 11), dark-mode |
| cli/ui E2E | `cli/ui/tests/e2e.spec.ts` | 457 | Design system component tests |
| Skill evals | 2 skills have `evals.json` | — | `do-web-doc-resolver` (5 evals), `do-github-pr-sentinel` (3+ evals) |

### What's MISSING ❌

| Gap | Impact | Effort |
|-----|--------|--------|
| **No `tests/test_version_sync.py`** — `sync_versions.py` untested | Version drift undetected in CI | Low |
| **No web test for `circuit-breaker.ts`** | Circuit breaker logic untested in Web | Low |
| **No web test for `errors.ts`** | Error classification untested | Low |
| **No web test for `quality.ts`** | Quality scoring untested (only indirectly via records) | Low |
| **No web test for `keys.ts`** | Key storage/resolution untested | Low |
| **No web test for `log.ts`** | Logger untested | Minimal |
| **No benchmarks** | No perf regression detection. Only `skill-creator/scripts/aggregate_benchmark.py` exists (unrelated) | Medium |
| **Rust: 18 source files have no inline tests** | `bias_scorer.rs`, `compaction.rs`, `link_validator.rs`, `metrics.rs`, `quality.rs` (has integration test), `routing.rs` (has integration), `routing_memory.rs` (has integration), `synthesis.rs`, `docling.rs`, `ocr.rs`, `query.rs`, `url.rs` — many are tested via integration tests but no unit coverage | Medium |
| **Rust: no test for `resolver/query.rs` or `resolver/url.rs`** | Core cascade logic (480+440 lines) has no direct tests | High |
| **E2E: mobile/tablet projects not run in CI** | `ci-ui.yml` only runs `--project=desktop`. Mobile/tablet regressions undetected | Medium |
| **No agent-browser visual regression captures** | No automated responsive screenshots | Medium |
| **11 skills have no evals** | Can't verify skill correctness automatically | Medium |
| **`npm test` (vitest) not in any CI workflow** | 859 lines of web unit tests never run in CI | High |

---

## 7. Production Verification Plan

### 7.1 Python tests — unit + live

```bash
# Unit tests (no API keys)
python -m pytest tests/ -v -m "not live"

# Version sync validation
python scripts/sync_versions.py

# Lint + format
python -m ruff check .
python -m black --check .
```

**Expected**: All unit tests pass, versions in sync, lint clean.

### 7.2 Rust CLI tests — unit + clippy + fmt

```bash
cd cli
cargo test
cargo test --features semantic-cache
cargo clippy -- -D warnings
cargo fmt --check
```

**Expected**: All tests pass including semantic-cache feature gate. No clippy warnings.

### 7.3 Web unit tests (vitest)

```bash
cd web
npm test
```

**Files tested**: `cache.test.ts`, `providers.test.ts`, `rate-limit.test.ts`, `records.test.ts`, `routing.test.ts`, `ui-state.test.ts`, `validation.test.ts`, `api/route.test.ts`, `api/ui-state-route.test.ts`.

**Expected**: All 9 test files pass.

### 7.4 Web E2E tests (Playwright) — all screen sizes

Playwright config already defines 4 projects: `desktop`, `mobile`, `tablet`, `dark-mode`.

```bash
cd web

# All projects against production
BASE_URL=https://web-eight-ivory-29.vercel.app npx playwright test

# Individual projects
BASE_URL=https://web-eight-ivory-29.vercel.app npx playwright test --project=desktop
BASE_URL=https://web-eight-ivory-29.vercel.app npx playwright test --project=mobile
BASE_URL=https://web-eight-ivory-29.vercel.app npx playwright test --project=tablet
BASE_URL=https://web-eight-ivory-29.vercel.app npx playwright test --project=dark-mode
```

**Test coverage (app.spec.ts — 30+ tests)**:
- Page load & structure (3 tests)
- CSS & theme (4 tests)
- Form interaction (7 tests)
- Error handling (3 tests)
- Dark mode (2 tests)
- Result display (4 tests)
- Security headers (2 tests — production only)
- Navigation (3 tests)
- Collapsible sidebar (5 tests)
- Collapsible API keys (3 tests)
- Profile provider indicators (4 tests)
- Help page (7 tests)

**Additional E2E**:
- `history.spec.ts` — history feature
- `provider-gating.spec.ts` — provider key gating

### 7.5 Visual responsive testing — agent-browser (4 viewports)

Use the `agent-browser` skill to capture and verify production layout at all breakpoints:

| Viewport | Device | Width × Height | Checks |
|----------|--------|---------------|--------|
| Mobile | Pixel 7 | 412 × 915 | Sidebar hidden, hamburger menu visible, input fills width, touch targets ≥44px |
| Tablet | iPad Pro 11 | 834 × 1194 | Sidebar may collapse, layout adapts, readable text |
| Desktop | Chrome | 1280 × 720 | Sidebar visible, full layout, provider buttons inline |
| Large | Chrome | 1920 × 1080 | No content stretching, proportional layout |

**agent-browser commands** (run against production URL):

```bash
# Mobile
agent-browser screenshot https://web-eight-ivory-29.vercel.app --viewport 412x915 --save assets/screenshots/responsive-mobile.png

# Tablet
agent-browser screenshot https://web-eight-ivory-29.vercel.app --viewport 834x1194 --save assets/screenshots/responsive-tablet.png

# Desktop
agent-browser screenshot https://web-eight-ivory-29.vercel.app --viewport 1280x720 --save assets/screenshots/responsive-desktop.png

# Large
agent-browser screenshot https://web-eight-ivory-29.vercel.app --viewport 1920x1080 --save assets/screenshots/responsive-large.png
```

**Visual checks per viewport**:
- [ ] App loads without JS errors
- [ ] Input field visible and functional
- [ ] Sidebar behavior correct per breakpoint
- [ ] Provider buttons render correctly
- [ ] Help link accessible
- [ ] No horizontal scroll
- [ ] Text readable (no truncation/overlap)
- [ ] Touch targets ≥44px on mobile/tablet
- [ ] Dark background (#0c0c0c) renders
- [ ] Acid green (#00ff41) accent visible

### 7.6 Skill evals

Each skill with `evals/evals.json` should pass its eval suite:

```bash
# Check which skills have evals
find .agents/skills -name "evals.json" -exec echo {} \;

# Run evals for skills that have them
# (evals are JSON-defined test cases, run via skill-creator)
```

**Skills with evals**:
- `do-github-pr-sentinel` — has `evals/evals.json`

**Skills without evals (gap)**:
- `do-web-doc-resolver` — has tests in `.agents/skills/do-web-doc-resolver/tests/` (5 Python test files)
- `do-wdr-cli` — tested via `cargo test`
- All other skills — no formal evals

---

## 8. Priority Matrix

### High Impact, Low Effort
1. 🔧 Add `npm test` to CI (§4.1) — 2 lines in ci-ui.yml
2. 🔧 Add version sync to quality gate (§5.1) — 1 line
3. 🔧 Remove duplicate web-build from ci.yml (§5.2) — delete job
4. 📝 Show quality score in Web UI (§4.5) — ~5 lines in page.tsx
5. 🔧 Add URL validation in route.ts (§4.4) — ~5 lines
6. 📝 Update skill version metadata (§5.4) — 1 line

### High Impact, Medium Effort
7. 🔧 Implement Python Serper provider (§1.1) — ~40 lines
8. 🔧 Wire Rust --profile to budget presets (§1.4) — ~30 lines
9. 🔧 Port preflight routing to Rust + Web (§1.5) — ~60 lines each
10. 🔧 Refactor route.ts to use shared provider maps (§4.2) — ~30 lines
11. 🔧 Extract page.tsx into components (§4.3) — refactor
12. 🔧 Complete version sync integration (§5.1) — release.sh, hooks, tests

### High Impact, High Effort
13. 🔧 Add hedged requests to Rust (§1.6) — tokio::select! pattern
14. 🔧 Add exa_mcp_mistral combo to Rust + Python (§1.2) — new provider
15. 🔧 Add --deep-research parallel mode to CLIs (§1.3) — architecture change

### Verification (run after any changes)
16. ✅ Python unit tests + lint
17. ✅ Rust tests + clippy + fmt
18. ✅ Web vitest unit tests
19. ✅ Playwright E2E all 4 projects (desktop/mobile/tablet/dark-mode)
20. ✅ agent-browser responsive screenshots (4 viewports)
21. ✅ Skill evals + skill tests
22. ✅ Version sync check
