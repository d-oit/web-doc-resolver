# Contributing to web-doc-resolver

Thank you for your interest in contributing! This document outlines the process for contributing to this project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/web-doc-resolver.git`
3. Install dependencies: `pip install -r requirements.txt`

## Development Setup

### Python
```bash
# Install dev dependencies
pip install -r requirements.txt

# Run tests
python -m pytest tests/ -v -m "not live"

# Run linting
black --check scripts/ tests/
flake8 scripts/ tests/
mypy scripts/
```

### Rust CLI
```bash
cd cli
cargo build --release
cargo test
cargo clippy -- -D warnings
cargo fmt --check
```

## Making Changes

1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Make your changes and add tests
3. Ensure all tests pass
4. Commit your changes: `git commit -m "feat: add your feature"`
5. Push to your fork: `git push origin feature/your-feature-name`
6. Open a Pull Request

## Coding Standards

- Python: Follow [Black](https://black.readthedocs.io/) formatting
- Rust: Follow standard Rust idioms, run `cargo fmt` and `cargo clippy`
- Add type hints to Python functions
- Include docstrings for public APIs

## Testing

- Run unit tests: `python -m pytest tests/test_resolve.py -v -m "not live"`
- Run live API tests (requires API keys): `python -m pytest tests/test_live_api_integrations.py -v`
- Test coverage target: 90%+

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation changes
- `chore:` maintenance tasks
- `refactor:` code refactoring
- `test:` adding or updating tests

## Pull Request Process

1. Update documentation if needed
2. Add tests for new features
3. Ensure CI passes
4. Update CHANGELOG.md with your changes
5. Request review from maintainers

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
