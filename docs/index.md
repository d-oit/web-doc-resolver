# Documentation Overview

Welcome to the **do-web-doc-resolver** documentation. This project provides a powerful, cost-efficient cascade resolver for turning queries and URLs into LLM-ready Markdown.

## 🚀 Getting Started

If you are new to the project, start with the **[README.md](../README.md)** for a quick overview, installation instructions, and basic usage examples.

## 🧠 Architecture & Internals

For a deeper dive into how the resolver works under the hood:

- **[Project Overview](../agents-docs/OVERVIEW.md)**: High-level architectural overview and component breakdown.
- **[Cascade Decision Trees](../.agents/skills/do-web-doc-resolver/references/CASCADE.md)**: Detailed logic for query and URL resolution.
- **[Provider Details](../.agents/skills/do-web-doc-resolver/references/PROVIDERS.md)**: Information about the various search and extraction providers.
- **[Semantic Health](../agents-docs/SEMANTIC_HEALTH.md)**: Monitoring and maintaining the quality of semantic outputs.

## 🤖 Agent Integration

The resolver is designed to be used as a skill by AI agents.

- **[AGENTS.md](../AGENTS.md)**: **Primary Guide** for integrating the resolver as an agent skill, including named constants and PR instructions.
- **[Skill Definitions](../.agents/skills/)**: Canonical skill definitions for various agent platforms.
- **[Deep Reference (agents-docs/)](../agents-docs/README.md)**: Detailed reference material for provider routing, cache semantics, and output schemas.

## 💻 CLI Usage

The project includes a robust Rust-based CLI.

- **[CLI Reference](../.agents/skills/do-web-doc-resolver/references/CLI.md)**: General CLI usage patterns.
- **[Rust CLI Architecture](../.agents/skills/do-web-doc-resolver/references/RUST_CLI.md)**: Internal design of the `do-wdr` binary.

## 🌐 Web UI & Deployment

- **[Web UI Details](../agents-docs/OVERVIEW.md#3-web-ui-web)**: Overview of the Next.js web interface.
- **[Deployment Guide](../agents-docs/DEPLOYMENT.md)**: Instructions for deploying the resolver and its web UI.
- **[Configuration](../agents-docs/CONFIG.md)**: Full reference for environment variables and configuration files.

## 🛠 Development & Contributing

- **[Development Guide](../agents-docs/DEVELOPMENT.md)**: Setup for local development and quality gate processes.
- **[Testing Documentation](../.agents/skills/do-web-doc-resolver/references/TESTING.md)**: Overview of the test suite (Python, Rust, and E2E).
- **[Standards](standards.md)**: 2026 LLM-readable documentation standards.
- **[Releases](../agents-docs/RELEASES.md)**: Versioning and release process.
