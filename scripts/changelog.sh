#!/bin/bash
# Generate changelog from conventional commits
# Usage: ./scripts/changelog.sh [version] [from-tag]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

VERSION="${1:- unreleased}"
FROM_TAG="${2:-$(git describe --tags --abbrev=0 2>/dev/null || echo "")}"

echo "# Changelog"
echo ""
echo "## [$VERSION] - $(date +%Y-%m-%d)"
echo ""

if [ -n "$FROM_TAG" ]; then
    echo "### Changes since $FROM_TAG"
    echo ""
    
    # Features
    FEATURES=$(git log "$FROM_TAG"..HEAD --oneline --no-merges --grep="^feat" --format="- %s (%h)" || true)
    if [ -n "$FEATURES" ]; then
        echo "#### Features"
        echo "$FEATURES"
        echo ""
    fi
    
    # Bug Fixes
    FIXES=$(git log "$FROM_TAG"..HEAD --oneline --no-merges --grep="^fix" --format="- %s (%h)" || true)
    if [ -n "$FIXES" ]; then
        echo "#### Bug Fixes"
        echo "$FIXES"
        echo ""
    fi
    
    # Documentation
    DOCS=$(git log "$FROM_TAG"..HEAD --oneline --no-merges --grep="^docs" --format="- %s (%h)" || true)
    if [ -n "$DOCS" ]; then
        echo "#### Documentation"
        echo "$DOCS"
        echo ""
    fi
    
    # Performance
    PERF=$(git log "$FROM_TAG"..HEAD --oneline --no-merges --grep="^perf" --format="- %s (%h)" || true)
    if [ -n "$PERF" ]; then
        echo "#### Performance"
        echo "$PERF"
        echo ""
    fi
    
    # Other (non-conventional commits)
    OTHER=$(git log "$FROM_TAG"..HEAD --oneline --no-merges --format="- %s (%h)" | grep -v "^[a-f0-9]* \(feat\|fix\|docs\|perf\|refactor\|test\|build\|ci\|chore\|style\)" || true)
    if [ -n "$OTHER" ]; then
        echo "#### Other Changes"
        echo "$OTHER"
        echo ""
    fi
else
    echo "No previous tag found. Showing recent commits:"
    echo ""
    git log --oneline --no-merges --format="- %s (%h)" | head -20
    echo ""
fi

# Stats
echo "#### Stats"
echo ""
COMMITS_SINCE_TAG=$([ -n "$FROM_TAG" ] && git rev-list "$FROM_TAG"..HEAD --count || echo "N/A")
echo "- Commits: $COMMITS_SINCE_TAG"
echo "- Contributors: $(git log "$FROM_TAG"..HEAD --format='%ae' 2>/dev/null | sort -u | wc -l || echo "N/A")"
echo ""
