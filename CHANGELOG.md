# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
