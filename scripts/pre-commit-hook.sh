#!/bin/bash
# Git pre-commit hook for quality gate
# Install: cp .git/hooks/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

echo "Running quality gate..."

# Get the repo root (parent of .git)
REPO_ROOT="$(git rev-parse --show-toplevel)"

# Run quality gate script
"$REPO_ROOT/scripts/quality_gate.sh"

echo "Quality gate passed!"
