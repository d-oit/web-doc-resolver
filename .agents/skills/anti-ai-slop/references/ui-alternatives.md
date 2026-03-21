# UI Alternatives — Component by Component

## Typography Alternatives

### Instead of Inter / DM Sans / Space Grotesk:

**For tech / tool products:**
- Geist (Vercel's own — still fresh as of 2026)
- Söhne or Söhne Mono (Klim Type)
- GT Alpina (variable, interesting optical range)
- Suisse Int'l (Swiss rigor without the defaults)

**For editorial / media:**
- Canela (sharp serifs, editorial weight)
- Freight Display + Freight Text (matched pair)
- Tiempos Headline + Neue Haas Grotesk
- Any newspaper typeface: Publico, Le Monde, Caponi

**For character / personality:**
- Signifier (sharp, high contrast, unusual)
- Larken (humanist, warm)
- Obviously (wide grotesque, strong personality)
- Aktiv Grotesk Extended (geometric, compressed option)

**Free alternatives with character:**
- Fraunces (Google Fonts — variable, beautiful optical sizes)
- Playfair Display (classic, editorial)
- Bricolage Grotesque (variable, wide range)
- Instrument Serif (pairs well with sans)

**Rule:** Pair something with high contrast or personality as the display face. Let the body face be quieter.

---

## Color Alternatives

### Instead of purple gradient on white:

**High contrast monochrome:**
- Black + one accent (red, electric green, safety orange)
- Off-white (#f5f0e8) + ink (#1a1208) + one warm accent
- Cream field, dark navy type, gold/amber accent

**Earthy / material:**
- Terracotta (#c4622d) + bone (#f0e6d3) + dark charcoal
- Sage green (#8faa8b) + warm gray + black
- Rust + sand + near-black

**High-saturation complements:**
- Electric blue (#0047ff) + bright yellow (#ffe600)
- Deep forest green + hot pink
- Cobalt + cadmium orange

**Avoid:** `#7c3aed`, `#8b5cf6`, `#6366f1`, `#3b82f6` as primary brand colors unless you're deliberately referencing the Tailwind era ironically.

---

## Hero Sections

### Instead of: Headline + subhead + CTA button + product screenshot

**Options:**
- **Full-bleed type.** Oversized headline, no image. Typography IS the design.
- **Split layout.** Image left, sparse copy right (or inverted).
- **Editorial.** Run an actual sentence of copy, not a headline. Treat it like a magazine spread.
- **Interactive.** Hero does something. Not just decorative — the hero IS the product, live.
- **Minimal.** Logo, one sentence, one action. Nothing else. The restraint is the statement.
- **Video/motion.** Real footage of the product or use case. Not stock.

---

## Cards

### Instead of: rounded `border-radius-xl`, shadow, white background, icon + title + text

**Options:**
- **No border, use spacing** — whitespace defines the card, not a box
- **High-contrast border** — 2px solid black, no shadow, no radius
- **Color field cards** — background color is the card, not a white box
- **Newspaper column layout** — no card chrome at all
- **Brutalist** — visible border, monospace type, no softening

---

## Navigation

### Instead of: Sticky nav, logo left, links center/right, hamburger on mobile

**Options:**
- **Sidebar nav** (persistent, vertical) for complex products
- **Bottom tab bar** (mobile-first, visible)
- **Full-screen overlay** with large typography
- **No nav** — single-page flow, no navigation needed
- **Mega-menu done right** — editorial layout, not a link dump

---

## Buttons

### Instead of: rounded-lg, primary color fill, white text, subtle shadow

**Options:**
- **Brutalist pill** — border only, no fill, bold type
- **High contrast plain** — black fill, white text, zero radius, full width
- **Inline text link** — styled as a link with strong underline, not a button
- **Inverted states** — border becomes fill on hover (strong signal)
- **Oversized utility** — if it's the primary action, make it massive

---

## Loading States

### Instead of: skeleton pulse + spinner

**Options:**
- **Optimistic UI** — show the result immediately, reconcile silently
- **Progress with context** — "Analyzing 240 rows... done in ~4s"
- **Streaming content** — render as it arrives, don't wait to show everything
- **Minimal indicator** — tiny dot or bar at the top of the viewport only
- **Acknowledge the wait** — if it's long, say so specifically and why
