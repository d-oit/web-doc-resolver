# AI Agent Instructions Best Practices Analysis - 2026-03-28

## Executive Summary

This document analyzes best practices for AI agent instructions (skills, AGENTS.md, prompts) based on the project's existing skills and industry patterns.

## Current Implementation Review

### Skill Structure Analysis

| Skill | Lines | Trigger Description | Structure |
|-------|-------|--------------------|-----------|
| do-github-pr-sentinel | 220 | Detailed triggers + context | Script + references |
| do-wdr-issue-swarm | 128 | Clear workflow triggers | Agent template |
| skill-creator | 152 | Creation + eval triggers | Scripts + agents |
| do-web-doc-resolver | 180 | Resolver triggers | Scripts + references |
| anti-ai-slop | 85 | Design audit triggers | Reference patterns |

### AGENTS.md Analysis

**Current structure (~272 lines, needs reduction)**:
- Setup commands
- Run tests
- Disk space
- Code style (Python, Rust, Web)
- Commits format
- Repository structure
- Cascade overview
- Environment variables
- Security
- Skill symlink validation
- More detail links
- Skills table
- Assets
- Releases
- Deployment

## Best Practices Research

### 1. Skill Frontmatter Patterns

**Best practice structure**:
```yaml
---
name: skill-name
description: Pushy description with specific triggers AND what the skill does.
  Use when "phrase1", "phrase2", or context X.
allowed-tools: Bash(git:*), Bash(gh:*), Read, Write, Edit
compatibility: Any CLI agent (Claude, Codex, Cursor, etc.)
metadata:
  source: https://github.com/example/skill
  version: "1.0.0"
---
```

**Key principles**:
- Description must be "pushy" to avoid undertriggering
- Include 3-5 specific trigger phrases
- Declare allowed tools for safety
- Version metadata for tracking

### 2. Progressive Disclosure Pattern

```
Layer 1: Metadata (frontmatter)     ~100 words  - Always in context
Layer 2: SKILL.md body              <250 lines  - When skill triggers
Layer 3: references/*.md            As needed   - Deep dive docs
Layer 4: scripts/*                  Execute     - Deterministic tasks
```

**Rationale**: Context window pressure. Load what's needed, defer what's not.

### 3. Workflow vs Reference Separation

**Workflow section**: Imperative, numbered steps
```
## Core Workflow

1. When asked to "monitor" a PR, start with `--watch`
2. Run the watcher script
3. Inspect `actions` list
4. If `diagnose_ci_failure` present, inspect logs
...
```

**Reference section**: Declarative, lookup tables
```
## CI Failure Classification

| Type | Detection | Action |
|------|-----------|--------|
| Branch-related | Changed code in logs | Patch + push |
| Flaky | Timeout, runner failure | Rerun |
```

### 4. Agent Prompt Template Pattern

**Best practice template**:
```
You are implementing {task}: "{Title}" for {project}.

CONTEXT: {directory structure + conventions}

REQUIREMENTS from {source}:
{full requirements}

EXISTING CONVENTIONS (from {examples}):
- Pattern 1
- Pattern 2

TASK: Create {file_path}. Constraints: {max_lines}, {style_rules}

VERIFICATION: {how to verify success}
```

**Key elements**:
- Clear role definition
- Project context
- Full requirements copy (no synthesis)
- Existing patterns/conventions
- Exact task + constraints
- Verification method

### 5. Stop Conditions Pattern

**Explicit terminal states**:
```markdown
## Stop Conditions (Strict)

Stop **only** when:

| Condition | Action |
|-----------|--------|
| PR merged/closed | Stop immediately |
| CI green + review-clean | Report success, stop |
| User intervention required | Report blocker, stop |

**Keep polling** when:
- Checks still pending
- Review state quiet but CI not terminal
```

**Rationale**: Agents loop without clear stop signals. Make termination explicit.

### 6. Tool Restriction Pattern

**Declarative tool limits**:
```yaml
allowed-tools: Bash(git:*), Bash(gh:*), Read, Write
```

**Rationale**:
- Safety boundary
- Clear capability scope
- Prevents accidental destructive operations

### 7. Commit Message Pattern

**Conventional format with context**:
```
feat(ui): implement Badge component — issue #75
fix(cli): address PR review feedback (#155)
docs(skills): add AI agent instructions analysis
```

**Key elements**:
- Type prefix (feat/fix/docs/refactor)
- Scope in parens
- Brief description
- Issue/PR reference

### 8. Skill Size Limits

| Component | Max Size | Reason |
|-----------|----------|--------|
| SKILL.md | 250 lines | Context window pressure |
| AGENTS.md | 150 lines | Always-loaded overhead |
| Reference docs | Unlimited | Loaded only when needed |
| Agent prompts | 500 words | Token budget |

### 9. Trigger Phrase Patterns

**Good triggers (specific, contextual)**:
```markdown
Use when:
- "Implement all issues in cli/ui/"
- "Fix all open GitHub issues"
- "Swarm the frontend issues"
- Any request to batch-implement multiple GitHub issues
```

**Bad triggers (too generic)**:
```markdown
Use when:
- Working with GitHub
- Need to fix issues
- Implementing features
```

### 10. Dependency Handling

**Wave-based execution**:
```markdown
| Wave | Issues | Why |
|------|---------|------|
| 0 | #75 | Foundation, no blockers |
| 1 | #100, #101 | Depend only on #75 |
| 2 | #102, #103 | Depend on #75 + #71 |
```

**Max parallelism**: 4 agents to avoid context pressure

## Improvement Recommendations

### Priority 1: Skill Description Enhancement

**Problem**: Some skills undertrigger due to vague descriptions

**Solution**: Add pushy descriptions with specific phrases

```yaml
# Before
description: Create components for the design system.

# After
description: Implement CSS-only UI components for the design system. Use when
  creating new components, fixing component styles, or implementing GitHub
  issues tagged design-system/frontend. Triggers: "create component",
  "implement badge/tooltip/modal", "add CSS for", "design system component".
```

### Priority 2: AGENTS.md Conciseness

**Current**: ~272 lines (needs reduction to target)

**Recommendation**: Keep under 150 lines, move detailed docs to agents-docs/

### Priority 3: Reference Documentation

**Add to skill-creator**:
- `references/prompt-templates.md` - Agent prompt patterns
- `references/eval-patterns.md` - Evaluation methodology

### Priority 4: Skill Cross-References

**Pattern**: Add "Related Skills" section to each skill

```markdown
## Related Skills

- `do-wdr-issue-swarm`: Parallel GitHub issue implementation
- `do-wdr-release`: Release management and versioning
- `skill-creator`: Skill creation and optimization
```

### Priority 5: Error Handling Patterns

**Add explicit error handling**:
```markdown
## Error Handling

| Error | Action |
|-------|--------|
| git push rejected | Create PR instead |
| CI timeout | Rerun with retry limit |
| Permission denied | Ask user for intervention |
```

### Priority 6: Verification Commands

**Add verification section**:
```markdown
## Verification

Before committing:
```bash
wc -l <file>  # Check line limit
cargo fmt --check  # Rust formatting
ruff check .  # Python lint
```

## Skill Quality Metrics

| Metric | Target | Current |
|--------|--------|---------|
| SKILL.md size | <250 lines | ✅ All skills pass |
| Trigger specificity | 3+ phrases | ⚠️ Some skills vague |
| Stop conditions | Explicit | ✅ PR sentinel has |
| Tool restrictions | Declared | ⚠️ Only issue-swarm |
| Reference docs | Available | ✅ Most skills have |

## Implementation Checklist

### For each skill:

1. ✅ Verify SKILL.md <250 lines
2. ⏳ Add 3+ specific trigger phrases to description
3. ⏳ Add allowed-tools declaration
4. ✅ Add Related Skills section
5. ⏳ Add Error Handling table (if applicable)
6. ✅ Add Verification commands (if applicable)

### For AGENTS.md:

1. ⚠️ Reduce from ~272 lines to <150
2. ✅ Link to detailed docs in agents-docs/
3. ✅ Include skills table
4. ✅ Include code style section

## Reference Patterns

### Skill Template

```yaml
---
name: skill-name
description: Clear description + 3-5 trigger phrases.
allowed-tools: List of allowed tools
---

# Skill Name

Brief intro paragraph.

## When to use

- Trigger phrase 1
- Trigger phrase 2
- Trigger phrase 3

## Core Workflow

1. Step 1
2. Step 2
...

## Commands

```bash
command examples
```

## Error Handling

| Error | Action |
|-------|--------|

## Verification

Checks to run before completion.

## Related Skills

- skill-a
- skill-b
```

## Related Files

- `.agents/skills/*/SKILL.md` - All skill definitions
- `AGENTS.md` - Main agent instructions
- `agents-docs/` - Detailed project documentation
- `plans/UI_UX_BEST_PRACTICES.md` - UI/UX analysis

## References

- [agents.md spec](https://agents.md) - AGENTS.md format
- [skill-creator skill](.agents/skills/skill-creator/SKILL.md) - Skill patterns
- [Claude Code skills](https://docs.anthropic.com/claude-code/skills) - Skills documentation

## Changelog

- 2026-03-28: Initial analysis created based on existing skills review