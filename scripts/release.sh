#!/bin/bash
# Release script for do-web-doc-resolver
# Usage: ./scripts/release.sh [patch|minor|major|X.Y.Z]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Current versions
WEB_VERSION=$(node -p "require('./web/package.json').version" 2>/dev/null || echo "0.1.0")
CLI_VERSION=$(grep '^version' "$ROOT_DIR/cli/Cargo.toml" | head -1 | sed 's/version = "\(.*\)"/\1/')

echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}  WDR Release Manager${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""
echo -e "Current versions:"
echo -e "  Web UI:  ${YELLOW}v$WEB_VERSION${NC}"
echo -e "  CLI:     ${YELLOW}v$CLI_VERSION${NC}"
echo ""

# Determine new version
BUMP_TYPE="${1:-patch}"

if [[ "$BUMP_TYPE" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then
    NEW_VERSION="$BUMP_TYPE"
else
    # Parse current version
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
            echo "Usage: $0 [patch|minor|major|X.Y.Z]"
            exit 1
            ;;
    esac
    
    NEW_VERSION="$MAJOR.$MINOR.$PATCH"
fi

echo -e "New version: ${GREEN}v$NEW_VERSION${NC}"
echo ""

# Confirmation
read -p "Continue with release v$NEW_VERSION? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Release cancelled.${NC}"
    exit 1
fi

# Step 1: Check working directory is clean
echo ""
echo -e "${BLUE}Step 1: Checking working directory...${NC}"
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${YELLOW}Warning: Working directory is not clean${NC}"
    git status --short
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Release cancelled.${NC}"
        exit 1
    fi
fi

# Step 2: Run quality gate
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

# Step 3: Update versions
echo ""
echo -e "${BLUE}Step 3: Updating versions to v$NEW_VERSION...${NC}"

# Update web/package.json
if [ -f "$ROOT_DIR/web/package.json" ]; then
    sed -i "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" "$ROOT_DIR/web/package.json"
    echo -e "  ✓ web/package.json"
fi

# Update cli/Cargo.toml
if [ -f "$ROOT_DIR/cli/Cargo.toml" ]; then
    sed -i "s/^version = \".*\"/version = \"$NEW_VERSION\"/" "$ROOT_DIR/cli/Cargo.toml"
    echo -e "  ✓ cli/Cargo.toml"
fi

# Update pyproject.toml or setup.py
if [ -f "$ROOT_DIR/pyproject.toml" ]; then
    sed -i "s/version = \".*\"/version = \"$NEW_VERSION\"/" "$ROOT_DIR/pyproject.toml"
    echo -e "  ✓ pyproject.toml"
fi

# Step 4: Capture screenshots
echo ""
echo -e "${BLUE}Step 4: Capturing release screenshots...${NC}"
if [ -f "$ROOT_DIR/scripts/capture/capture-release.sh" ]; then
    "$ROOT_DIR/scripts/capture/capture-release.sh" "$NEW_VERSION"
    echo -e "${GREEN}Screenshots captured${NC}"
else
    echo -e "${YELLOW}Capture script not found, skipping${NC}"
fi

# Step 5: Generate changelog
echo ""
echo -e "${BLUE}Step 5: Generating changelog...${NC}"
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -n "$LATEST_TAG" ]; then
    echo "## v$NEW_VERSION ($(date +%Y-%m-%d))" > /tmp/CHANGELOG_NEW.md
    echo "" >> /tmp/CHANGELOG_NEW.md
    git log "$LATEST_TAG"..HEAD --oneline --no-merges --format="- %s (%h)" >> /tmp/CHANGELOG_NEW.md
    echo "" >> /tmp/CHANGELOG_NEW.md
    
    if [ -f "$ROOT_DIR/CHANGELOG.md" ]; then
        cat /tmp/CHANGELOG_NEW.md "$ROOT_DIR/CHANGELOG.md" > /tmp/CHANGELOG_MERGED.md
        mv /tmp/CHANGELOG_MERGED.md "$ROOT_DIR/CHANGELOG.md"
    else
        mv /tmp/CHANGELOG_NEW.md "$ROOT_DIR/CHANGELOG.md"
    fi
    echo -e "${GREEN}Changelog generated${NC}"
else
    echo -e "${YELLOW}No previous tag found, creating initial changelog${NC}"
    echo "## v$NEW_VERSION ($(date +%Y-%m-%d))" > "$ROOT_DIR/CHANGELOG.md"
    echo "" >> "$ROOT_DIR/CHANGELOG.md"
    git log --oneline --no-merges --format="- %s (%h)" | head -20 >> "$ROOT_DIR/CHANGELOG.md"
fi

# Step 6: Commit
echo ""
echo -e "${BLUE}Step 6: Creating release commit...${NC}"
git add -A
git commit -m "chore(release): v$NEW_VERSION" || echo -e "${YELLOW}Nothing to commit${NC}"

# Step 7: Create tag
echo ""
echo -e "${BLUE}Step 7: Creating Git tag...${NC}"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"
echo -e "${GREEN}Tag v$NEW_VERSION created${NC}"

# Step 8: Push
echo ""
echo -e "${BLUE}Step 8: Pushing to remote...${NC}"
read -p "Push to remote? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push origin main
    git push origin "v$NEW_VERSION"
    echo -e "${GREEN}Pushed to remote${NC}"
else
    echo -e "${YELLOW}Skipping push${NC}"
fi

# Step 9: Create GitHub release
echo ""
echo -e "${BLUE}Step 9: Creating GitHub release...${NC}"
if command -v gh &> /dev/null; then
    read -p "Create GitHub release? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ASSETS_DIR="$ROOT_DIR/assets/screenshots/release-v$NEW_VERSION"
        ASSETS_FLAG=""
        if [ -d "$ASSETS_DIR" ]; then
            ASSETS_FLAG="--notes-file $ROOT_DIR/CHANGELOG.md"
        fi
        
        gh release create "v$NEW_VERSION" \
            --title "Release v$NEW_VERSION" \
            $ASSETS_FLAG \
            --target main
        
        echo -e "${GREEN}GitHub release created${NC}"
    else
        echo -e "${YELLOW}Skipping GitHub release${NC}"
    fi
else
    echo -e "${YELLOW}GitHub CLI not installed, skipping release creation${NC}"
    echo "Install with: brew install gh"
fi

# Summary
echo ""
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  Release v$NEW_VERSION complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo "  - Check GitHub release: https://github.com/d-oit/do-web-doc-resolver/releases/tag/v$NEW_VERSION"
echo "  - Update documentation if needed"
echo "  - Announce release"
echo ""
