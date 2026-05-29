# Conventional Commits

All commits should follow conventional commit format:

```text
<type>(<scope>): <description>

[optional body]

[optional footer]
```

## Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(cli): add cache-stats command` |
| `fix` | Bug fix | `fix(web): resolve hydration error` |
| `docs` | Documentation | `docs: update README with examples` |
| `style` | Formatting | `style: fix indentation` |
| `refactor` | Code refactoring | `refactor(providers): simplify cascade` |
| `perf` | Performance | `perf: optimize memory allocation` |
| `test` | Tests | `test: add unit tests for resolver` |
| `build` | Build system | `build: update cargo dependencies` |
| `ci` | CI/CD | `ci: add screenshot capture step` |
| `chore` | Maintenance | `chore: update .gitignore` |

## Scopes

| Scope | Description |
|-------|-------------|
| `cli` | Rust CLI changes |
| `web` | Web UI changes |
| `python` | Python resolver changes |
| `exa_mcp` | Exa MCP provider |
| `tavily` | Tavily provider |
| `duckduckgo` | DuckDuckGo provider |
| `assets` | Visual assets |
| `release` | Release changes |

## Commit Type Mapping

| Intent | Type | Scope suggestion |
| --- | --- | --- |
| Security patch / hardening | `fix` | `security` |
| New security feature/control | `feat` | `security` |
| Security-related CI/tooling | `ci` | `security` |

**Allowed types**: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test`

## Best Practices

1. **Commit often**: Small, focused commits
2. **Use conventional commits**: Enables automatic changelog
3. **Sign commits**: `git commit -S` for security
4. **Tag releases**: Semantic versioning tags
5. **Don't rewrite public history**: Avoid force push to main
6. **Handle failures gracefully**: If any git command fails, follow the retry sequence: stash → abort rebase → abort merge → fetch main → retry. Never retry more than 3 times.
