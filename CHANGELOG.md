## [0.3.5] - 2026-05-18

- fix: eliminate double call to fetch_llms_txt in resolve_direct lambda (0f54c2f)
- docs: add plan 19 for CI serper integration and cleanup (dc46799)
- chore: remove .opencode/skills symlink, fix llms_txt signature (ca52f96)
- ci(integration): add serper CI job with CLI smoke test and semantic cache coverage (0614ffb)
- fix(ci): use correct Rust CLI subcommand for serper smoke test (a41f239)
- ci(integration): add serper CI job with CLI smoke test and semantic cache DB coverage (0a39c37)
- docs: compact learnings and update plans after GOAP orchestration (8a6c265)
- build(web): upgrade to TypeScript 6.0.3 and ESLint 10 (17aed55)
- perf(semantic): optimize cache pruning and documentation quality scoring (ffd11b1)
- feat(synthesis): align with 2026 LLM-readable-doc standards (b4552ad)
- fix(security): implement rate limiting for resolve endpoint (8840b91)
- build(deps): bump tokio in /cli in the cargo-deps group (dac4c03)
- chore(nightly): automated format and fixup (f9af40a)
- perf(scripts): optimize and harden HTML extraction with tests (1eba571)
- perf(scripts): optimize extract_text_from_html by lifting class and compiling regex (f32be97)
- feat(ux): enhance accessibility and address review feedback (ddce6fa)
- feat(ux): enhance accessibility and address review feedback (7ce16dd)
- feat(ux): enhance accessibility and address review feedback (84d6714)
- feat(ux): enhance search interaction focus and accessibility (76386e6)
- feat(ux): enhance search interaction focus and accessibility (7200399)

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2026-04-20

### Changed

- **Dependencies**: Prevent grouped npm major Dependabot updates for `/web` and `/packages` so incompatible toolchain jumps land in isolated PRs.
- **Dependencies**: Align Dependabot labels with the repository's actual label set to remove configuration-noise warnings.
- **Docs**: Document deterministic dependency compatibility triage in `AGENTS.md`, `agents-docs/DEVELOPMENT.md`, and the PR sentinel heuristics.

### Fixed

- **CI UI**: Close the incompatible grouped npm major update path that broke the Next.js lint stack under `eslint@10`.
- **Rust CLI**: Update patchable transitive dependencies in `cli/Cargo.lock`, including `rustls-webpki` and `rand`, without widening the direct dependency surface.
- **Release Prep**: Verify production deployment and core resolve flow on the live Vercel site across desktop, tablet, and mobile sanity checks.

### Known Issues

- The optional `semantic-cache` feature still pulls an upstream-constrained `chaotic_semantic_memory -> libsql` dependency chain that keeps several Rust security alerts open.
- Upstream tracking issue: `d-o-hub/chaotic_semantic_memory#88`.

## [0.3.0] - 2026-03-25

### Changed

- **CLI**: Rename the binary to `do-wdr` and update Clap command name
- **Config**: Move env vars to `DO_WDR_*` and config/cache paths to `do-wdr`
- **Skills**: Rename skill folders to `do-wdr-*` and update references
- **UI**: Rename CSS tokens/classes to `do-wdr-*` across the design system
- **CI/Release**: Update workflow artifacts and sample runs to `do-wdr`

### Breaking

- `wdr` command, `WDR_*` env vars, and `~/.config/wdr` paths are now `do-wdr`, `DO_WDR_*`, and `~/.config/do-wdr`

## [0.2.0] - 2026-03-22

### Added

- **Web UI**: Complete redesign with Swiss brutalist aesthetic
  - Dark mode only (#0c0c0c background)
  - Geist Mono font throughout
  - Zero border radius (technical brutalism)
  - Acid green accent (#00ff41)
- **Web UI**: CLI parity with profiles, provider selection, advanced options
  - Profile selector (Free/Balanced/Fast/Quality)
  - Provider toggles with availability status
  - Advanced options: max chars, skip cache, deep research
- **API**: `maxChars` parameter support
- **API**: Provider tracking in response
- **API**: Mistral web search and browser extraction providers
- **Skills**: Anti-AI-Slop skill for UI/UX auditing
- **Skills**: Responsive design validation (mobile/tablet/desktop)
- **Docs**: Comprehensive skill marketplace documentation

### Changed

- **Project name**: Renamed to do-web-doc-resolver
- **Web UI**: Removed emoji badges, replaced with CSS dots
- **Web UI**: Settings page with local/server key status
- **CI**: Simplified to Git-based Vercel deployment

### Fixed

- Turbo.json causing Vercel build failure (removed)
- .opencode/skills symlinks pointing to wrong location
- API route TypeScript type errors

## [0.1.1] - 2026-03-19

### Added
- GitHub Release workflow with automated PyPI publish and multi-platform binary builds
- SKILL.md version tracking for agent skill integration

### Fixed
- CI integration test invocations (use `python -m scripts.resolve` instead of `python scripts/resolve.py`)

### Changed
- Updated ADR-001 status to Implemented

## [0.1.0] - 2026-03-14

### Added
- Python library with provider cascade (llms.txt → Jina → Firecrawl → Mistral Browser → DuckDuckGo)
- Query search cascade (Exa MCP → Exa SDK → Tavily → DuckDuckGo → Mistral WebSearch)
- Rust CLI (`do-wdr`) with all providers
- Agent skill integration (SKILL.md, AGENTS.md)
- GitHub Actions CI/CD workflows
- Comprehensive test suite (93 Python tests, 35 Rust tests)
- Quality gate script and pre-commit hooks

### Fixed
- Mistral import paths updated for mistralai>=2.0.0
- CI workflow YAML indentation fixes
- Cache clearing for llms.txt tests

### Dependencies
- Updated actions/checkout from v5 to v6
- Updated actions/upload-artifact from v4 to v7
