## 2026-04-06 - [Interactive Component Nesting & Confirmation UX]
**Learning:** Nested `<button>` elements (e.g., a "Close" button inside a larger "Toggle" button) cause hydration errors and break accessibility/keyboard navigation. Additionally, buttons inside interactive list items must use `e.stopPropagation()` to avoid triggering parent click events.
**Action:** Use `div` with `role="button"` and `tabIndex={0}` for nested interactive containers. Always implement `e.stopPropagation()` on secondary actions in lists and use two-click confirmation for destructive actions.
