#!/bin/bash
# Quality Gate Script - Runs all checks before commit
# Usage: ./scripts/quality_gate.sh
#
# To install pre-commit hook:
#   cp scripts/pre-commit-hook.sh .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit

set -e

# Get repo root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== Quality Gate ==="

# Python checks
echo "Running Python tests (unit only)..."
cd "$REPO_ROOT"
python -m pytest --tb=short -q -m "not live"

echo "Running ruff..."
python -m ruff check .

echo "Running black..."
python -m black --check .

# Rust CLI checks
echo "Running Rust CLI tests..."
cd "$REPO_ROOT/cli"
cargo test --quiet

echo "Running cargo fmt..."
cargo fmt --check

echo "Running cargo clippy..."
cargo clippy -- -D warnings

# Web app checks
echo "Running web app lint..."
cd "$REPO_ROOT/web"
npm run lint

echo "Running web app typecheck..."
npm run typecheck

echo "=== All checks passed ==="
