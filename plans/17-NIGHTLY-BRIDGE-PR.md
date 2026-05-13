# ADR-015 + GOAP: Nightly Bridge Push → PR Workflow

> Generated 2026-05-13. Resolves nightly CI failure caused by direct push to `main`.

## ADR-015: Nightly Bridge Push → PR Workflow

### Status

PROPOSED → IMPLEMENTING

### Context

The `nightly-bridge.yml` workflow runs formatting (ruff, black, cargo fmt) and
attempts to commit + push the result directly to `main`. This violates two
GitHub repository branch protection rules:
1. **Changes must be made through a pull request** — no direct pushes to `main`
2. **4 of 4 required status checks are expected** — CI must pass before merge

This caused the 2026-05-13 nightly run to fail:
```
remote: error: GH013: Repository rule violations found for refs/heads/main.
remote: - 4 of 4 required status checks are expected.
remote: - Changes must be made through a pull request.
```

### Decision

Replace the direct `git push` to `main` with a PR-based workflow:
1. Create a feature branch with a datestamp (`chore/nightly-format-YYYYMMDD`)
2. Commit formatting changes to that branch
3. Push the branch
4. Create a PR via `gh pr create` targeting `main`
5. Do NOT auto-merge — let CI validate formatting changes

### Consequences

- **Positive**: Respects branch protection rules; CI validates formatting on the PR;
  PR audit trail for all automated changes.
- **Negative**: Creates PR noise (one per nightly if formatting drifts); requires
  manual merge or auto-merge with branch protection.
- **Mitigation**: Once the one unformatted file is fixed, most nightlies will
  have zero changes, producing zero PRs.

### Compliance

- Aligns with `AGENTS.md` policy: "Never commit to main"
- Uses existing `GITHUB_TOKEN` via `gh` CLI (already installed on GitHub runners)
- Adds `pull-requests: write` permission to the workflow

---

## GOAP Plan: Nightly Bridge PR Fix

### Goal

Nightly formatting workflow creates a PR instead of pushing directly to `main`,
eliminating the repository rule violation failure.

### Preconditions

- `gh` CLI is available on the GitHub Actions runner (default)
- `GITHUB_TOKEN` has `contents: write` + `pull-requests: write` scopes
- Repository rules remain unchanged (no direct push)

### Actions

| # | Task | File | Effort |
|---|------|------|--------|
| A1 | Create ADR-015 + GOAP plan | `plans/17-NIGHTLY-BRIDGE-PR.md` | S |
| A2 | Update plans/README.md to reference new plan | `plans/README.md` | S |
| A3 | Fix nightly-bridge.yml push → PR workflow | `.github/workflows/nightly-bridge.yml` | S |
| A4 | Fix `tests/test_routing_foundation.py` ruff format | `tests/test_routing_foundation.py` | S |

### Postconditions

1. Nightly formatting changes are committed to a branch and submitted as a PR
2. No more `GH013: Repository rule violations found` failures
3. Formatting drift is visible as open PRs instead of silent pushes
4. `tests/test_routing_foundation.py` passes `ruff format .` without changes

### Risks

| Risk | Mitigation |
|------|------------|
| PR explosion if formatting constantly drifts | Fix the root cause (one unformatted file); most nightlies will produce 0 diffs |
| `gh pr create` may fail if no changes | Step guarded by `git diff --cached --quiet` check |
| PR requires manual merge | Add `--auto` with `--squash` to auto-merge after CI passes in a future iteration |
