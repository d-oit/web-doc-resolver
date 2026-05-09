# Reference Documentation (`agents-docs/`)

This directory contains deep reference material and internal details for the **do-web-doc-resolver** project.

For a high-level guide on integrating the resolver as an agent skill, please refer to **[AGENTS.md](../AGENTS.md)**.

## Contents

- **[OVERVIEW.md](OVERVIEW.md)**: Technical architecture and component breakdown.
- **[CONFIG.md](CONFIG.md)**: Comprehensive reference for environment variables and configuration files.
- **[DEVELOPMENT.md](DEVELOPMENT.md)**: Local setup, quality gate instructions, and maintenance tasks.
- **[DEPLOYMENT.md](DEPLOYMENT.md)**: Deployment strategies and CI/CD pipelines.
- **[RELEASES.md](RELEASES.md)**: Versioning policy and release procedures.
- **[SEMANTIC_HEALTH.md](SEMANTIC_HEALTH.md)**: Metrics and standards for LLM-ready output quality.
- **[ASSETS.md](ASSETS.md)**: Management of screenshots and visual documentation.
- **[ISSUES.md](ISSUES.md)**: Known issues and technical debt tracking.

## Purpose

While `AGENTS.md` provides the "how-to" for agent authors, this directory provides the "why" and the technical specifications for contributors and maintainers. It covers provider routing behavior, cache semantics, output schemas, and internal orchestration logic.
