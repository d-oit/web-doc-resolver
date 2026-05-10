# ADR-009: GitHub Actions 2026 Optimization

## Status

Accepted

## Context

The repository has Python, Rust, Next.js, Playwright, release, live integration,
secret scanning, and issue automation workflows. Existing workflows were mostly
current, but not consistently aligned with the repository policy to pin actions
by SHA, use least-privilege permissions, avoid mutable runner aliases, and avoid
automated repository mutation from scheduled workflows.

Current 2026 guidance used for this pass:

- GitHub workflow syntax supports workflow-level `permissions` and `concurrency`
  to reduce token scope and cancel stale runs.
- GitHub security hardening recommends least-privilege `GITHUB_TOKEN` access and
  pinning third-party actions to immutable SHAs.
- GitHub-hosted runners expose explicit labels such as `ubuntu-24.04`,
  `windows-2025`, and `macos-15`; `*-latest` is mutable.
- Current official Node 24-based actions include `actions/checkout@v6`,
  `actions/setup-python@v6`, `actions/setup-node@v6`, `actions/cache@v5`,
  `actions/upload-artifact@v7`, and `actions/download-artifact@v8`.
- The UI workflow should run on the current active Node LTS line and pnpm major
  used by 2026-era frontend tooling.
- New provenance workflows should use `actions/attest@v4` instead of the legacy
  `actions/attest-build-provenance` wrapper.

## GOAP

### Goal

Optimize all GitHub workflows for 2026 usage while preserving the repository's
current CI, integration, release, secret scanning, and automation behavior.

### Objectives

- Use immutable action references with readable version comments.
- Prefer explicit hosted runner images over mutable `*-latest` labels.
- Keep default token permissions read-only unless a job needs write access.
- Prevent stale CI runs from wasting minutes.
- Keep secret-backed integration jobs away from normal pull request execution.
- Stop scheduled workflows from committing broad formatting changes.
- Keep release provenance attestations on the current recommended action.

### Actions

1. Pin all `uses:` references to current tag SHAs with `# vX` comments.
2. Replace Linux runner aliases with `ubuntu-24.04`.
3. Replace release platform runner aliases with `macos-15` and `windows-2025`.
4. Add missing workflow-level `concurrency` blocks.
5. Keep read-only checkout credentials disabled for jobs that do not push.
6. Restrict secret-backed live integration jobs to `push` and
   `workflow_dispatch`.
7. Replace nightly format-and-push steps with format checks.
8. Use `actions/attest@v4` and add `artifact-metadata: write`.
9. Move the UI workflow runtime to Node 24 and pnpm 10.

### Plan Verification

- Parse workflows as YAML.
- Grep for unpinned `uses:` references and mutable runner labels.
- Run the repository quality gate if dependencies are available.

## Decision

Adopt pinned action SHAs with version comments rather than floating version tags.
Pin hosted runner labels for deterministic CI behavior. Keep write permissions
only for release publishing, provenance attestations, issue closure, and security
event upload. Remove nightly automated commits because formatting drift should
fail visibly and be fixed through reviewed changes.

## Consequences

- Dependabot can still identify GitHub Actions comments, but SHA-pinned action
  maintenance may need extra review when tag SHAs move.
- CI behavior becomes more deterministic across GitHub runner image migrations.
- Nightly runs no longer mutate the repository, reducing surprise commits and
  avoiding bot identity configuration in workflow code.
- Secret-backed live provider tests no longer run on pull request events.
