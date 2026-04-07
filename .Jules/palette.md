## 2025-05-15 - [UX/Accessibility Improvements]
**Learning:** Avoid nesting interactive elements like `<button>` inside other `<button>` elements to prevent hydration errors and accessibility issues. Use `role='button'` and `tabIndex={0}` on a `div` for complex nested interaction patterns. Implement two-click confirmation for destructive actions to prevent accidental data loss.
**Action:** Use a `div` with `role="button"` when a container needs to be interactive but also contains other interactive elements (like links or buttons). Always provide a confirmation state for delete actions.
