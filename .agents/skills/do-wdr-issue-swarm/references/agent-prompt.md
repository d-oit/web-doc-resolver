# Agent Prompt Template

```text
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

## Customization

### For CSS Components

- Include token references from `tokens/design_tokens.css`
- Follow BEM naming: `.do-wdr-{component}__{element}--{variant}`
- Max 200 lines per file
- No comments in CSS

### For Python Scripts

- Include relevant imports from `scripts/`
- Follow existing code style
- Add type hints
- Include error handling

### For Rust Code

- Include relevant module imports
- Follow existing error handling patterns
- Use `thiserror` for library errors
- Use `anyhow` at binary boundary
