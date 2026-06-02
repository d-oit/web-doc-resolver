#!/bin/bash
# Release script for do-web-doc-resolver
# Usage: ./scripts/release.sh [patch|minor|major|X.Y.Z] [--yes]
#
# --yes  Skip all interactive prompts (for AI agents / automation)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

AUTO_YES=false
POSITIONAL=()

for arg in "$@"; do
    case "$arg" in
        --yes|-y) AUTO_YES=true ;;
        *) POSITIONAL+=("$arg") ;;
    esac
done

confirm() {
    local prompt="$1"
    if $AUTO_YES; then
        REPLY="y"
        return 0
    fi
    read -p "$prompt (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Cancelled.${NC}"
        exit 1
    fi
}

confirm_skip() {
    local prompt="$1"
    if $AUTO_YES; then
        REPLY="y"
        return 0
    fi
    read -p "$prompt (y/N) " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

WEB_VERSION=$(node -p "require('./web/package.json').version" 2>/dev/null || echo "0.1.0")
CLI_VERSION=$(grep '^version' "$ROOT_DIR/cli/Cargo.toml" | head -1 | sed 's/version = "\(.*\)"/\1/')

echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}  DO-WDR Release Manager${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""
echo -e "Current versions:"
echo -e "  Web UI:  ${YELLOW}v$WEB_VERSION${NC}"
echo -e "  CLI:     ${YELLOW}v$CLI_VERSION${NC}"
echo ""

BUMP_TYPE="${POSITIONAL[0]:-patch}"

if [[ "$BUMP_TYPE" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then
    NEW_VERSION="$BUMP_TYPE"
else
    IFS='.' read -ra PARTS <<< "$CLI_VERSION"
    MAJOR="${PARTS[0]}"
    MINOR="${PARTS[1]}"
    PATCH="${PARTS[2]}"

    case "$BUMP_TYPE" in
        major)
            MAJOR=$((MAJOR + 1))
            MINOR=0
            PATCH=0
            ;;
        minor)
            MINOR=$((MINOR + 1))
            PATCH=0
            ;;
        patch)
            PATCH=$((PATCH + 1))
            ;;
        *)
            echo -e "${RED}Error: Invalid bump type: $BUMP_TYPE${NC}"
            echo "Usage: $0 [patch|minor|major|X.Y.Z] [--yes]"
            exit 1
            ;;
    esac

    NEW_VERSION="$MAJOR.$MINOR.$PATCH"
fi

echo -e "New version: ${GREEN}v$NEW_VERSION${NC}"
echo ""
confirm "Continue with release v$NEW_VERSION?"

echo ""
echo -e "${BLUE}Step 1: Checking working directory...${NC}"
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${YELLOW}Warning: Working directory is not clean${NC}"
    git status --short
    if ! confirm_skip "Continue anyway?"; then
        echo -e "${RED}Release cancelled.${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${BLUE}Step 2: Running quality gate...${NC}"
if [ -f "$ROOT_DIR/scripts/quality_gate.sh" ]; then
    if ! "$ROOT_DIR/scripts/quality_gate.sh"; then
        echo -e "${RED}Quality gate failed!${NC}"
        exit 1
    fi
    echo -e "${GREEN}Quality gate passed${NC}"
else
    echo -e "${YELLOW}Quality gate script not found, skipping${NC}"
fi

echo ""
echo -e "${BLUE}Step 3: Updating versions to v$NEW_VERSION...${NC}"
python "$ROOT_DIR/scripts/sync_versions.py" --set "$NEW_VERSION"

echo ""
echo -e "${BLUE}Step 4: Capturing release screenshots...${NC}"
if [ -f "$ROOT_DIR/scripts/capture/capture-release.sh" ]; then
    "$ROOT_DIR/scripts/capture/capture-release.sh" "$NEW_VERSION"
    echo -e "${GREEN}Screenshots captured${NC}"
else
    echo -e "${YELLOW}Capture script not found, skipping${NC}"
fi

echo ""
echo -e "${BLUE}Step 5: Generating changelog...${NC}"
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

python "$ROOT_DIR/scripts/generate_changelog.py" \
    --version "$NEW_VERSION" \
    ${LATEST_TAG:+--from-tag "$LATEST_TAG"} \
    > /tmp/CHANGELOG_NEW.md

if [ -s /tmp/CHANGELOG_NEW.md ]; then
    if [ -f "$ROOT_DIR/CHANGELOG.md" ]; then
        cat /tmp/CHANGELOG_NEW.md "$ROOT_DIR/CHANGELOG.md" > /tmp/CHANGELOG_MERGED.md
        mv /tmp/CHANGELOG_MERGED.md "$ROOT_DIR/CHANGELOG.md"
    else
        cp /tmp/CHANGELOG_NEW.md "$ROOT_DIR/CHANGELOG.md"
    fi
    echo -e "${GREEN}Changelog generated${NC}"
else
    echo -e "${YELLOW}No new commits to record in changelog${NC}"
fi

echo ""
echo -e "${BLUE}Step 6: Creating release commit...${NC}"
git add -A
git commit -m "chore(release): v$NEW_VERSION" || echo -e "${YELLOW}Nothing to commit${NC}"

echo ""
echo -e "${BLUE}Step 7: Creating Git tag...${NC}"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"
echo -e "${GREEN}Tag v$NEW_VERSION created${NC}"

echo ""
echo -e "${BLUE}Step 8: Pushing to remote...${NC}"
if confirm_skip "Push to remote?"; then
    git push origin main
    git push origin "v$NEW_VERSION"
    echo -e "${GREEN}Pushed to remote${NC}"
else
    echo -e "${YELLOW}Skipping push${NC}"
fi

echo ""
echo -e "${BLUE}Step 9: GitHub release (CI/CD)...${NC}"
echo -e "${YELLOW}The tag push triggers .github/workflows/release.yml${NC}"
echo -e "${YELLOW}CI/CD will build binaries and create the GitHub release automatically.${NC}"
echo ""
echo -e "${BLUE}Monitor progress:${NC}"
echo "  gh run list --workflow=release.yml"
echo "  gh run watch <run-id>"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  Release v$NEW_VERSION complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo "  - Check GitHub release: https://github.com/d-oit/do-web-doc-resolver/releases/tag/v$NEW_VERSION"
echo "  - Update documentation if needed"
echo "  - Announce release"
