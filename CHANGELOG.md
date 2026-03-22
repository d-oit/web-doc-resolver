# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

- **Project name**: Fixed typo (do-web-doc-resolver → do-web-doc-resolver)
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
- Rust CLI (`wdr`) with all providers
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
