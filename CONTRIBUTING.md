# Contributing to do-web-doc-resolver

## Development Workflow

### Python
```bash
# Run tests
python -m pytest tests/ -v -m "not live"

# Linting and formatting
python -m ruff check .
python -m black .
```

### Rust CLI
```bash
cd cli
cargo test
cargo clippy -- -D warnings
cargo fmt
```

### Web UI
```bash
cd web
npm run lint
npm run typecheck
npx playwright test --project=desktop
```

### Quality Gate
Run the full suite before submitting:
```bash
./scripts/quality_gate.sh
```

## Standards

- **Python**: Follow Black formatting and Ruff rules. Use type hints for all public functions.
- **Rust**: Use standard idioms. Ensure `cargo clippy` and `cargo fmt` pass.
- **Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat:` new feature
  - `fix:` bug fix
  - `docs:` documentation
  - `chore:` maintenance
  - `refactor:` code restructuring
  - `test:` test updates
- **Branching**: Use `feat/`, `fix/`, `chore/`, or `docs/` prefixes.
- **File Size**: Source files must not exceed 500 lines. Split into sub-modules if they grow larger.

## Pull Request Process

1. Update documentation for user-facing changes.
2. Add tests for new features or bug fixes.
3. Ensure the quality gate passes: `./scripts/quality_gate.sh`.
4. Update `AGENTS.md` if the repository structure or skills change.

## License

By contributing, you agree that your work will be licensed under the MIT License.
