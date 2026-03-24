# GitHub Best Practices

## Releases

### Creating Releases

```bash
# Simple release
gh release create v1.0.0 --title "v1.0.0" --notes "Initial release"

# With auto-generated notes
gh release create v1.0.0 --generate-notes

# With assets
gh release create v1.0.0 \
  --title "v1.0.0" \
  --notes-file CHANGELOG.md \
  --assets "dist/*.zip"

# Pre-release
gh release create v1.0.0-beta.1 --prerelease --generate-notes

# Draft release
gh release create v1.0.0 --draft --generate-notes
```

### Release Assets

```bash
# Upload assets to existing release
gh release upload v1.0.0 file1.zip file2.tar.gz

# Upload with pattern
gh release upload v1.0.0 ./dist/*

# Delete asset
gh release delete-asset v1.0.0 file1.zip
```

### Managing Releases

```bash
# List releases
gh release list

# View release
gh release view v1.0.0

# View release in browser
gh release view v1.0.0 --web

# Edit release
gh release edit v1.0.0 --notes "Updated notes"

# Delete release
gh release delete v1.0.0
```

## Pull Requests

### Creating PRs

```bash
# Create PR
gh pr create --title "Add dark mode" --body "Implements #123"

# Create draft PR
gh pr create --draft --title "WIP: New feature"

# Create PR with reviewers
gh pr create --title "Fix bug" --reviewer @user1,@user2

# Create PR with labels
gh pr create --title "Enhancement" --label "enhancement"

# Create PR from current branch
gh pr create --fill
```

### Reviewing PRs

```bash
# List PRs
gh pr list

# View PR
gh pr view 123

# Checkout PR
gh pr checkout 123

# Diff PR
gh pr diff 123

# Review PR
gh pr review 123 --approve
gh pr review 123 --request-changes --body "Please fix..."
```

### PR Checks

```bash
# List checks
gh pr checks 123

# Watch checks
gh pr checks 123 --watch

# Rerun checks
gh pr checks 123 --rerun
```

## Issues

### Creating Issues

```bash
# Create issue
gh issue create --title "Bug report" --body "Description"

# Create with labels
gh issue create --title "Feature request" --label "enhancement"

# Create with assignee
gh issue create --title "Task" --assignee @user

# Create from template
gh issue create --template bug_report.md
```

### Managing Issues

```bash
# List issues
gh issue list

# View issue
gh issue view 123

# Close issue
gh issue close 123

# Reopen issue
gh issue reopen 123

# Add comment
gh issue comment 123 --body "Fixed in #456"
```

## Actions

### Workflow Files

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Run tests
        run: ./scripts/quality_gate.sh
      
      - name: Build
        run: |
          cd web && npm run build
          cd ../cli && cargo build --release
      
      - name: Create Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
          files: |
            cli/target/release/do-wdr
            assets/screenshots/release-*/\*.png
```

### CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          cd web && npm install
          cd ../cli && cargo build
      
      - name: Run tests
        run: ./scripts/quality_gate.sh
```

## Secrets

### Managing Secrets

```bash
# List secrets
gh secret list

# Set secret
gh secret set MY_SECRET --body "secret_value"

# Set from file
gh secret set MY_SECRET < .env

# Delete secret
gh secret delete MY_SECRET
```

### Using Secrets in Workflows

```yaml
steps:
  - name: Use secret
    env:
      API_KEY: ${{ secrets.API_KEY }}
    run: echo "Using API key"
```

## Environments

### Create Environment

```bash
# Create environment
gh api repos/:owner/:repo/environments/production \
  --method PUT \
  --field protection_rules='[{"type":"required_reviewers"}]'
```

### Environment Secrets

```bash
# Set environment secret
gh secret set API_KEY --env production --body "prod_key"
```

## Branch Protection

### Configure via CLI

```bash
# Protect main branch
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["ci"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1}'
```

## Labels

### Managing Labels

```bash
# List labels
gh label list

# Create label
gh label create "bug" --color D73A4A --description "Something isn't working"

# Update label
gh label edit "bug" --color FF0000

# Delete label
gh label delete "bug"
```

### Standard Labels

| Label | Color | Description |
|-------|-------|-------------|
| `bug` | D73A4A | Something isn't working |
| `enhancement` | A2EEEF | New feature or request |
| `documentation` | 0075CA | Improvements or additions to documentation |
| `good first issue` | 7057FF | Good for newcomers |
| `help wanted` | 008672 | Extra attention is needed |
| `priority: critical` | B60205 | High priority |
| `priority: high` | D93F0B | Medium-high priority |
| `priority: low` | 0E8A16 | Low priority |

## Projects

### Project Management

```bash
# List projects
gh project list

# Create project
gh project create --title "v1.0 Release"

# Add item to project
gh project item-add 1 --content-id <issue-or-pr-id>
```

## Wiki

### Local Wiki

```bash
# Clone wiki
git clone https://github.com/user/repo.wiki.git

# Make changes and push
cd repo.wiki
git add .
git commit -m "Update docs"
git push
```

## API

### Using gh api

```bash
# GET request
gh api repos/:owner/:repo

# POST request
gh api repos/:owner/:repo/issues \
  --field title="New issue" \
  --field body="Description"

# With pagination
gh api repos/:owner/:repo/issues --paginate
```

## Templates

### Issue Templates

Create `.github/ISSUE_TEMPLATE/bug_report.md`:

```markdown
---
name: Bug report
about: Create a report to help us improve
title: ''
labels: bug
assignees: ''
---

**Describe the bug**
A clear and concise description.

**To Reproduce**
Steps to reproduce the behavior.

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment**
- OS: [e.g. Ubuntu 22.04]
- Version: [e.g. 1.0.0]
```

### PR Templates

Create `.github/pull_request_template.md`:

```markdown
## Description
Brief description of changes.

## Related Issues
Fixes #(issue number)

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Changelog updated
```
