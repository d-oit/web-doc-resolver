# Supported Codacy Tools

Codacy supports many tools, but local CLI support is limited.

## Local Analysis CLI Support

| Tool | Language | Status |
|------|----------|--------|
| ESLint | JavaScript/TypeScript | ✅ Supported |
| Stylelint | CSS/SCSS | ✅ Supported |
| ShellCheck | Shell | ✅ Supported |
| markdownlint | Markdown | ✅ Supported |
| Ruff | Python | ❌ Fails (local venv) |
| Bandit | Python | ❌ Fails (local venv) |

## Cloud Analysis

The Codacy Cloud (Remote) analysis runs all enabled tools (including Ruff, Bandit, Clippy, etc.) regardless of local runtime availability. Always use `codacy pull-request` to see the authoritative list of issues.
