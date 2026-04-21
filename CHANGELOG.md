# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.2] - 2026-04-21

### Added

- **Security**: Comprehensive SSRF hardening across Python, Web UI, and Rust CLI with DNS-aware validation and redirect tracking.
- **Security**: DNS caching for SSRF validation with LRU cache and time-bucketing to reduce redundant lookups.
- **Performance**: Optimized `score_content` by caching lowercased text to avoid repeated string operations.
- **UX**: History panel auto-focus, clear button, and accessible contrast improvements.
- **UX**: Keyboard accessibility improvements with enhanced focus indicators across the UI.
- **Providers**: DuckDuckGo deprioritized in cascade due to reliability issues (CAPTCHA/rate limiting).
- **CLI**: Optimized Rust semantic cache with hardened SSRF protection in HTTP client.

### Changed

- **Dependencies**: Update patched Rust transitive dependencies including `rustls-webpki` and `rand`.
- **Dependencies**: Update npm dependencies in `/web` with security patches.
- **Dependencies**: Update GitHub Actions to latest versions.
- **UI**: Improve dark theme contrast and accessibility across components.
- **UI**: Sidebar improvements with "Show" text, Keys link, and profile status display.
- **CI**: Prevent grouped npm major Dependabot update regressions with isolated PR workflow.

### Fixed

- **E2E**: Fix sidebar toggle, profile status, and Keys link locators for Playwright tests.
- **CLI**: Fix semantic cache benchmark compilation with updated API signatures.
- **Providers**: Fix ruff lint errors in provider diagnostics script.
- **Semantic Cache**: Fix vec0 virtual table insert syntax to properly store and retrieve cached results.

### Known Issues

- **Semantic Cache**: Python semantic cache tests failing due to sqlite-vec compatibility issues. Temporarily disabled in release workflow. See [Issue #251](https://github.com/d-oit/do-web-doc-resolver/issues/251).
- **Semantic Cache**: Deprecated `get_sentence_embedding_dimension` API fixed. Changed to `get_embedding_dimension` for sentence-transformers 5.x compatibility.
- **Security**: The optional `semantic-cache` feature pulls an upstream-constrained `chaotic_semantic_memory -> libsql` dependency chain with open Rust security alerts. See [Issue #253](https://github.com/d-oit/do-web-doc-resolver/issues/253).
- **Security**: 5 Dependabot security vulnerabilities (1 moderate, 4 low) pending review. See [Issue #255](https://github.com/d-oit/do-web-doc-resolver/issues/255).

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
