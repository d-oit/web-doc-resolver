---
name: anti-ai-slop
description: >
  Apply this skill whenever the user wants to audit, fix, redesign, write, or review UI, UX, copy, or text to avoid the generic "AI slop" aesthetic of 2025–2026. Triggers include: "make this feel less AI", "this looks too generic", "avoid AI clichés", "audit my copy", "anti-pattern review", "humanize this", "this feels soulless", "too corporate", "fix the UX writing", "why does this feel like ChatGPT made it", "anti-design", "brutalist", "raw", "intentional", "authentic", "distinctive", "not like every other AI app", "responsive", "mobile", "tablet", "desktop". Also trigger when producing new UI, copy, or UX flows and the user cares about quality and distinctiveness. Always verify mobile, tablet, and desktop views for proper navigation and layout. This skill is your checklist, diagnostic tool, and creative brief for everything that makes design feel human, considered, and real in 2026.
---

# Anti-AI-Slop Skill — 2026 Edition

AI tools flooded the design and copy space. The result: a recognizable monoculture. This skill is a systematic antidote. Use it to audit existing work OR to guide new creation from scratch.

---

## How to Use This Skill

1. **Audit mode** — User shares existing UI/copy/UX flow. Run through the diagnostic checklists below. Call out every pattern by name. Suggest replacements.
2. **Creation mode** — User wants new UI/copy/flow. Read the "What to do instead" sections first, then produce work that avoids all listed patterns.
3. **Spot-fix mode** — User points to one specific element. Diagnose it, explain why it's sloppy, rewrite/redesign it.

Always **name the sin** before fixing it. Specificity builds trust.

---

## Part 1 — AI-Slop UI Patterns (Visual Design)

### The Canon of Slop

These visual patterns define the 2024–2026 AI aesthetic monoculture. Flag every one you see:

| Pattern | What it looks like | Why it's slop |
|---|---|---|
| **Purple gradient hero** | `#7c3aed → #2563eb` on white bg | Default Tailwind AI app palette. Seen on 40,000+ products |
| **Glassmorphism cards** | Frosted glass, `backdrop-blur`, `bg-white/10` | Overused since iOS 15, now shorthand for "I followed a tutorial" |
| **Rounded everything** | `border-radius: 24px+` on every element | Removes personality, softens until nothing has weight |
| **Inter / DM Sans / Space Grotesk** | Default "modern" sans | These three fonts now signal "AI-generated UI" more than any other single cue |
| **Emojis as icons in headers** | ✨ Supercharge your workflow 🚀 | Startup theater. Hollow optimism. |
| **Hero headline formula** | `[Verb] your [noun] with [product]` | "Supercharge your workflow with Aria" — indistinguishable from 10,000 others |
| **Three-column feature grid** | Icon + bold label + 1 sentence | Every SaaS landing page since 2019 |
| **Testimonial carousel with headshots** | Circular avatar, name, company, 1 sentence | Invisible. Nobody reads it. |
| **CTA: "Get started for free"** | Large button, primary color | Meaningless. Says nothing specific. |
| **Empty states with illustration + button** | Lottie animation or SVG blob person | Cute once. Now patronizing. |
| **Skeleton loaders for everything** | Gray pulse bars | Often used to mask poor performance instead of fix it |
| **Dark mode = black bg + purple accent** | `#0f0f0f` + `#8b5cf6` | The "hacker aesthetic" as sold by Vercel clones |
| **Animated gradient text** | Moving rainbow or purple-blue sweep on headline text | Peak 2023 AI startup energy. Looks desperate |
| **"Powered by AI" badge** | Small badge or chip somewhere on the UI | Adds nothing. Trust signal that signals nothing |
| **Dashboard with 6+ metric cards** | Big number, small label, trend arrow | Data theater. Usually none of it is actionable |

### What to Do Instead

- **Typography first.** Choose a font combination that is specific to the context. Research type history. Use a serif with character for body, a grotesque with optical quirks for display — or invert. Never use the font "because it's clean."
- **Commit to one extreme.** Brutally minimal OR maximally dense. The middle is where slop lives.
- **Use real color theory.** Complementary pairs, analogous schemes, split-complementary. Not "purple because AI."
- **Space is a design element.** Generous negative space with one dense anchor beats uniform padding everywhere.
- **Let the content shape the layout.** Don't force content into a 3-column grid because that's the template.
- **Reference actual design movements.** Swiss grid. Bauhaus. Emigre magazine. Brutalist web. Dutch constructivism. Tschichold. Pick one and execute it with intent.

**Read:** `references/ui-alternatives.md` for specific replacements by component type.

---

## Part 2 — AI-Slop UX Patterns (Interaction & Flow)

### The Canon of Slop

| Pattern | What it looks like | Why it's slop |
|---|---|---|
| **Onboarding modal on first load** | "Welcome to [Product]! Let's get you set up 🎉" | Interrupts before the user has context. Nobody reads it. |
| **5-step onboarding wizard** | Progress bar, next/back, confetti at end | Treats users as suspects who need to be processed |
| **Tooltip tours** | Floating box pointing at UI elements in sequence | Teaches the wrong interface instead of fixing the interface |
| **"Are you sure?" confirm dialogs** | Modal for every delete action | Trust issues. Use undo instead. |
| **Generic empty states** | "No data yet! Click + to add your first item" | Zero help. Doesn't explain what the item IS or why I'd want one |
| **Toast notifications for everything** | "Saved!", "Deleted!", "Updated!" | Noise. Users learn to ignore them in 2 sessions |
| **Infinite scroll + load more button** | Both at the same time | Design indecision shipped as a feature |
| **Search that requires exact match** | Typo → no results → dead end | Punishes the user for trusting the product |
| **Form with 8+ fields to get started** | Sign up → giant form → submit → maybe enter | Commitment before value. Backwards. |
| **"Loading..." with no progress cue** | Spinner, no ETA, no context | I don't know if this is taking 1 second or 1 minute |
| **Every action requires a reload** | Click save → full page refresh → scroll lost | 2012 called |
| **Hamburger menu on desktop** | Hidden navigation because mobile-first was misread | Discovery failure. Punishes exploration. |
| **Hover states only** | Functionality only revealed on hover | Mobile users, keyboard users, discoverers all fail |

### Responsive Anti-Patterns

| Pattern | What it looks like | Why it's slop |
|---|---|---|
| **Hamburger menu on desktop** | Hidden navigation on large screens | Discovery failure. Users can't explore. |
| **Tiny touch targets on mobile** | Buttons/links < 44px | Frustrating, accessibility fail |
| **Desktop-only layout** | Fixed-width container, horizontal scroll on mobile | Unusable, forces pinch-zoom |
| **Hidden primary actions** | Important buttons only visible on hover/desktop | Mobile users can't complete tasks |
| **Intrusive popups on mobile** | Modal that covers entire screen, hard to dismiss | Blocks content, frustrating |
| **Inconsistent navigation** | Different nav structure per viewport | Users get lost when resizing |

### Responsive Best Practices

| Viewport | Navigation | Layout |
|---|---|---|
| **Mobile (< 640px)** | Bottom tab bar OR slide-out drawer | Stacked, full-width |
| **Tablet (640-1024px)** | Horizontal nav, collapsible sidebar | Hybrid, 2-column max |
| **Desktop (> 1024px)** | Persistent sidebar OR top nav | Full sidebar (280px) |

**Always verify:**

1. Touch targets ≥ 44px on mobile
2. Primary actions visible without scrolling
3. Navigation accessible at all sizes
4. Content readable without horizontal scroll

### What to Do Instead

- **Don't teach the UI — fix the UI.** If users need a tour, the interface is unclear. Redesign instead.
- **Undo over confirm.** Give users a 5–10 second undo window on destructive actions. Way less friction.
- **Empty states with one specific next action.** Tell users what they'll get, why it matters, exactly what to do.
- **Progressive disclosure.** Start with the minimum viable form. Add fields only when the user needs them.
- **Optimistic UI.** Show the outcome immediately, reconcile in the background. Feels instant.
- **Contextual notifications.** Surface feedback inline, near the action. Not a toast that floats in a corner.

**Read:** `references/ux-alternatives.md` for flow-by-flow replacements.

---

## References

| Topic | File |
|-------|------|
| Component-by-component UI replacements | `references/ui-alternatives.md` |
| Flow-by-flow UX replacements | `references/ux-alternatives.md` |
| Before/after copy rewrites | `references/copy-rewrites.md` |
| Copy sins & text patterns | `references/copy-sins.md` |
| Audit workflow & checklist | `references/audit-workflow.md` |
| Positive doctrine & principles | `references/positive-doctrine.md` |
| Design references & inspiration | `references/inspiration.md` |

Read these when you need specific replacements or need to justify a creative direction to the user.
