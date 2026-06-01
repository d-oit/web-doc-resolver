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

# Setup tool cache
LINT_CACHE_DIR="$REPO_ROOT/.cache/lint-tools"
mkdir -p "$LINT_CACHE_DIR"
export PATH="$LINT_CACHE_DIR/node_modules/.bin:$PATH"

# Install/check shellcheck
if ! command -v shellcheck &> /dev/null; then
    echo "Installing shellcheck to cache..."
    cd "$REPO_ROOT"
    npm install --prefix "$LINT_CACHE_DIR" shellcheck > /dev/null 2>&1 || echo "Warning: Failed to install shellcheck via npm"
fi

# Install/check markdownlint
if ! command -v markdownlint &> /dev/null; then
    echo "Installing markdownlint-cli to cache..."
    cd "$REPO_ROOT"
    npm install --prefix "$LINT_CACHE_DIR" markdownlint-cli > /dev/null 2>&1 || echo "Warning: Failed to install markdownlint via npm"
fi

echo "=== Quality Gate ==="

# Version sync check
echo "Checking version sync..."
cd "$REPO_ROOT"
python scripts/sync_versions.py

# Version regression check (warn only — pre-commit may be on a branch behind tags)
echo "Checking version vs git tags..."
cd "$REPO_ROOT"
LATEST_TAG=$(git tag -l "v*.*.*" --sort=-version:refname | head -1)
if [ -n "$LATEST_TAG" ]; then
    MANIFEST_VERSION=$(grep '^version' pyproject.toml | head -1 | sed 's/version = "\(.*\)"/\1/')
    TAG_VERSION="${LATEST_TAG#v}"
    HIGHER=$(printf '%s\n%s\n' "$TAG_VERSION" "$MANIFEST_VERSION" | sort -V | tail -1)
    if [ "$HIGHER" != "$MANIFEST_VERSION" ]; then
        echo "⚠️  Version regression: manifest $MANIFEST_VERSION < latest tag $LATEST_TAG"
        echo "   Run: python scripts/sync_versions.py --set ${TAG_VERSION}"
    else
        echo "✅ Manifest version ($MANIFEST_VERSION) >= latest tag ($LATEST_TAG)"
    fi
else
    echo "   No tags found — skipping"
fi

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
EXCLUDE_PATTERN='example\.com|example\.org|example\.net|test\.com|localhost|\.git/|node_modules/|target/|\.claude/|\.blackbox/|\.agents/skills/'
if grep -rE "$EMAIL_PATTERN" --include="*.py" --include="*.toml" --include="*.yaml" --include="*.json" --include="*.md" . 2>/dev/null | grep -vE "$EXCLUDE_PATTERN"; then
    echo "ERROR: Email address detected in codebase"
    exit 1
fi

# Shell script checks
echo "Running shellcheck..."
if command -v shellcheck &> /dev/null; then
    find "$REPO_ROOT" -name "*.sh" -not -path "*/node_modules/*" -not -path "*/target/*" -not -path "*/.cache/*" -print0 | xargs -0 -r shellcheck --severity=error
else
    echo "Skipping shellcheck (not installed)"
fi

# Markdown checks
echo "Running markdownlint..."
if command -v markdownlint &> /dev/null; then
    # Prefer markdownlint.json if it exists, otherwise fallback to markdownlint.toml
    if [ -f "$REPO_ROOT/.markdownlint.json" ]; then
        MD_CONFIG_FILE="$REPO_ROOT/.markdownlint.json"
    elif [ -f "$REPO_ROOT/markdownlint.json" ]; then
        MD_CONFIG_FILE="$REPO_ROOT/markdownlint.json"
    else
        MD_CONFIG_FILE="$REPO_ROOT/markdownlint.toml"
    fi
    find "$REPO_ROOT" -name "*.md" \
        -not -path "*/node_modules/*" \
        -not -path "*/target/*" \
        -not -path "*/.cache/*" \
        -not -path "*/.claude/*" \
        -not -path "*/.blackbox/*" \
        -not -path "*/references/*" \
        -print0 | xargs -0 -r markdownlint --config "$MD_CONFIG_FILE" || true
else
    echo "Skipping markdownlint (not installed)"
fi

# Python checks
echo "Running Python tests (unit only)..."
cd "$REPO_ROOT"
python -m pytest --tb=short -q -m "not live and not benchmark"

echo "Running ruff..."
python -m ruff check .

echo "Running black..."
python -m black --check .

echo "Running mypy..."
python -m mypy scripts/ --ignore-missing-imports

echo "Checking Python file sizes (max 500 lines)..."
MAX_LINES=500
OVER_LIMIT=0
for f in scripts/*.py; do
    lines=$(wc -l < "$f")
    if [ "$lines" -gt "$MAX_LINES" ]; then
        echo "ERROR: $f has $lines lines (max $MAX_LINES)"
        OVER_LIMIT=1
    fi
done
if [ "$OVER_LIMIT" -eq 1 ]; then
    exit 1
fi

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
