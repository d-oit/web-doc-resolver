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

# Version sync check
echo "Checking version sync..."
cd "$REPO_ROOT"
python scripts/sync_versions.py

# Skill symlink validation
echo "Validating skill symlinks..."
cd "$REPO_ROOT"
python scripts/validate_skill_symlink.py

# Documentation consistency check
echo "Validating documentation..."
cd "$REPO_ROOT"
python scripts/validate_docs.py

# Privacy check - no emails in codebase
echo "Checking for email addresses..."
EMAIL_PATTERN='[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
EXCLUDE_PATTERN='example\.com|example\.org|example\.net|test\.com|localhost|\.git/|node_modules/|target/|\.claude/|\.opencode/|\.blackbox/|\.agents/skills/'
if grep -rE "$EMAIL_PATTERN" --include="*.py" --include="*.toml" --include="*.yaml" --include="*.json" --include="*.md" . 2>/dev/null | grep -vE "$EXCLUDE_PATTERN"; then
    echo "ERROR: Email address detected in codebase"
    exit 1
fi

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
