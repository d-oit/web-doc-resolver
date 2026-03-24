# Git Best Practices

## Commit Messages

### Conventional Commits

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Examples

```bash
# Feature
git commit -m "feat(web): add dark mode toggle"

# Bug fix
git commit -m "fix(cli): resolve rate limit handling"

# Documentation
git commit -m "docs: update README with examples"

# Breaking change
git commit -m "feat(api)!: change response format

BREAKING CHANGE: Response now uses camelCase instead of snake_case"

# Multiple footers
git commit -m "fix(providers): handle timeout gracefully

Closes #123
Co-authored-by: Jane <jane@example.com>"
```

## Branching Strategy

### Main Branches

- `main` - Production-ready code
- `develop` - Integration branch (optional)

### Feature Branches

```bash
# Create feature branch
git checkout -b feat/add-dark-mode

# Create bugfix branch
git checkout -b fix/rate-limit-issue

# Create release branch
git checkout -b release/v1.0.0
```

### Branch Naming

```
feat/feature-name
fix/bug-description
docs/documentation-update
refactor/component-name
test/test-description
chore/maintenance-task
release/vX.Y.Z
hotfix/critical-fix
```

## Stashing

```bash
# Save current changes
git stash

# Save with message
git stash push -m "work in progress: auth flow"

# List stashes
git stash list

# Restore latest stash
git stash pop

# Restore specific stash
git stash apply stash@{2}

# Drop stash
git stash drop stash@{0}
```

## Rebasing

```bash
# Interactive rebase (last 5 commits)
git rebase -i HEAD~5

# Rebase onto main
git fetch origin
git rebase origin/main

# Continue after conflicts
git add .
git rebase --continue

# Abort rebase
git rebase --abort
```

### Rebase Commands (interactive)

```
pick   - Use commit as is
reword - Use commit, but edit message
edit   - Use commit, but stop for amending
squash - Combine with previous commit
fixup  - Like squash, but discard message
drop   - Remove commit
```

## Cherry-picking

```bash
# Cherry-pick a commit
git cherry-pick <commit-hash>

# Cherry-pick without committing
git cherry-pick --no-commit <commit-hash>

# Cherry-pick a range
git cherry-pick <start>..<end>
```

## Tagging

### Annotated Tags (Recommended)

```bash
# Create annotated tag
git tag -a v1.0.0 -m "Release v1.0.0"

# List tags
git tag -l "v*"

# Show tag details
git show v1.0.0

# Push tags
git push origin --tags

# Delete tag
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0
```

### Lightweight Tags

```bash
# Create lightweight tag
git tag v1.0.0
```

## Undoing Changes

### Unstage Files

```bash
# Unstage single file
git restore --staged file.txt

# Unstage all files
git restore --staged .
```

### Amend Last Commit

```bash
# Change commit message
git commit --amend -m "New message"

# Add forgotten files
git add forgotten.txt
git commit --amend --no-edit
```

### Revert Commit

```bash
# Create revert commit
git revert <commit-hash>

# Revert without creating commit
git revert --no-commit <commit-hash>
```

### Reset (Dangerous)

```bash
# Soft: keep changes staged
git reset --soft HEAD~1

# Mixed: keep changes unstaged (default)
git reset HEAD~1

# Hard: discard changes (DANGER)
git reset --hard HEAD~1
```

## Bisect (Find Bug)

```bash
# Start bisect
git bisect start

# Mark current as bad
git bisect bad

# Mark known good commit
git bisect good <commit-hash>

# Git will binary search - test each and mark
git bisect good  # or git bisect bad

# When done
git bisect reset
```

## Submodules

```bash
# Add submodule
git submodule add <url> <path>

# Clone with submodules
git clone --recurse-submodules <url>

# Update submodules
git submodule update --remote

# Initialize submodules after clone
git submodule init
git submodule update
```

## Worktrees (Multiple Working Directories)

```bash
# Create worktree
git worktree add ../hotfix hotfix-branch

# List worktrees
git worktree list

# Remove worktree
git worktree remove ../hotfix
```

## Hooks

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Run linter
npm run lint

# Run tests
npm test

# Check for console.log
if git diff --cached --name-only | xargs grep -l "console.log" 2>/dev/null; then
    echo "Error: console.log found in staged files"
    exit 1
fi
```

### Commit-msg Hook

```bash
#!/bin/bash
# .git/hooks/commit-msg

# Check conventional commit format
if ! grep -qE "^(feat|fix|docs|style|refactor|perf|test|build|ci|chore)(\(.+\))?!?: .+" "$1"; then
    echo "Error: Commit message must follow conventional commits format"
    exit 1
fi
```

## Aliases

Add to `~/.gitconfig`:

```ini
[alias]
    st = status
    co = checkout
    br = branch
    ci = commit
    lg = log --oneline --graph --decorate
    last = log -1 HEAD
    unstage = restore --staged
    undo = reset HEAD~1 --mixed
    amend = commit --amend --no-edit
    visual = !gitk
```

## Diff Tools

```bash
# View staged changes
git diff --staged

# View specific file changes
git diff HEAD -- path/to/file

# Compare branches
git diff main..feature-branch

# Word diff
git diff --word-diff

# Statistical diff
git diff --stat
```

## Log Formats

```bash
# Oneline
git log --oneline

# Graph
git log --oneline --graph --all

# With author
git log --format="%h %an %s"

# Last week
git log --since="1 week ago"

# By file
git log -- path/to/file

# Search commits
git log --grep="fix"
```

## Stashing Advanced

```bash
# Stash with index
git stash push --include-index

# Stash specific files
git stash push -- file1.txt file2.txt

# Create branch from stash
git stash branch new-branch stash@{0}

# Show stash diff
git stash show -p stash@{0}
```
