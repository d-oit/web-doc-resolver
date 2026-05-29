# Accessibility Requirements

Every component MUST have:

## 1. Focus Visible Outline

```css
.do-wdr-{component}:focus-visible {
  outline: 2px solid var(--do-wdr-border-focus);
  outline-offset: 2px;
}
```

## 2. Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  .do-wdr-{component} {
    transition: none;
    animation: none;
  }
}
```

## 3. Semantic HTML

Use semantic HTML where applicable:

- `dl/dt/dd` for key-value pairs
- `role=progressbar` for progress indicators
- `aria-describedby` for related content

## 4. Color Independence

No content conveyed by color alone. Use icons, text, or patterns in addition to color.

## 5. Touch Targets

Minimum 44px for interactive elements on mobile.

## 6. Screen Reader Support

- Use `aria-label` for icon-only buttons
- Use `aria-hidden="true"` for decorative elements
- Use `aria-expanded` for collapsible sections

## Testing Checklist

- [ ] Keyboard navigation works
- [ ] Focus visible on all interactive elements
- [ ] Reduced motion preference respected
- [ ] Screen reader announces all content
- [ ] Touch targets ≥ 44px on mobile
- [ ] Color contrast meets WCAG AA
