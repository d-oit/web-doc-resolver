---
name: do-wdr-issue-swarm
description: Implement GitHub issues in parallel using a swarm of specialist agents with wave-based dependency resolution. Use when the user asks to "implement all issues", "fix all GitHub issues", "swarm issues", or wants to batch-implement multiple GitHub issues. Covers dependency analysis, parallel agent launch, atomic commits, GH Actions monitoring, and issue closing.
allowed-tools: Bash(git:*), Bash(gh:*), Bash(python:*), Read, Write, Edit, Glob, Task
---

# GitHub Issue Swarm Implementation

Implement multiple GitHub issues in parallel using specialist agents with dependency-aware wave execution.

## When to use

- "Implement all issues in cli/ui/"
- "Fix all open GitHub issues"
- "Swarm the frontend issues"
- Any request to batch-implement multiple GitHub issues

## Workflow

### 1. List and analyze issues

```bash
gh issue list --state open --json number,title,body,labels
```

Parse each issue body for "Blocked by" lines to build the dependency graph.

### 2. Group into waves

Group issues by dependency depth. Issues with no blockers go in Wave 1, issues depending only on Wave 1 go in Wave 2, etc.

Example for cli/ui/ issues:

| Wave | Issues | Why |
|---|---|---|
| 0 | #75 (Tokens) | Foundation, no blockers |
| 1 | #100, #101, #105, #107 | Depend only on #75 |
| 2 | #102, #103, #104, #106, #108 | Depend on #75 + #71 |
| 3 | #77, #78, #109, #110, #111 | Depend on #75 + #71 |

### 3. Launch parallel agents per wave

For each issue in a wave, launch a specialist agent via the Task tool:

```
Task(
  description="Implement #{N} {Title}",
  prompt="You are implementing GitHub Issue #{N}... [full issue body + context]",
  subagent_type="general"
)
```

Each agent receives:
- Full issue body from `gh issue view {N} --json body`
- List of existing tokens from `tokens/design_tokens.css`
- Convention examples from 1-2 existing components
- Exact file path to create

### 4. Wait for wave completion

After all agents in a wave complete, verify outputs:

```bash
ls -la cli/ui/components/*.css  # Verify new files exist
wc -l cli/ui/components/*.css   # Verify <200 lines each
```

### 5. Atomic commits per component

One commit per component file:

```bash
git add cli/ui/components/{name}.css cli/ui/components/README.md
git commit -m "feat(ui): implement {Component} — issue #{N}"
```

### 6. Push and monitor

```bash
git push origin {branch}
gh run watch  # Monitor GitHub Actions
```

### 7. Close issues on pass

```bash
gh issue close {N} --comment "Implemented in {commit_sha}. Component: cli/ui/components/{name}.css"
```

### 8. Loop on failure

If CI fails:
1. Read the failure log: `gh run view {run_id} --log-failed`
2. Fix the issue in the component file
3. Commit fix: `git commit -am "fix(ui): {description} — #{N}"`
4. Push and re-monitor: `git push && gh run watch`
5. Close issue when CI passes

## Agent prompt template

```
You are implementing GitHub Issue #{N}: "{Title}" for the do-web-doc-resolver project.

CONTEXT: The UI layer is in `/workspaces/do-web-doc-resolver/cli/ui/`. Components are CSS-only files with BEM classes prefixed `do-wdr-`.

REQUIREMENTS from the issue:
{issue_body}

EXISTING TOKENS (from design_tokens.css):
{relevant_tokens}

EXISTING COMPONENT CONVENTIONS (from button.css, badge.css):
- Component tokens in `:root {}` block
- BEM: `.do-wdr-{component}`, `.do-wdr-{component}--variant`, `.do-wdr-{component}__element`
- Focus-visible outlines, transitions on colors, prefers-reduced-motion

TASK: Create `/workspaces/do-web-doc-resolver/cli/ui/components/{name}.css`. Max 200 lines. No comments.

Also update `components/README.md` to replace the issue link with `{name}.css`.
```

## Tips

- Read existing components before writing to match conventions exactly
- Max 4 parallel agents to avoid context window pressure
- Each wave is independent — can push after each wave
- Always verify `wc -l < 200` before committing
