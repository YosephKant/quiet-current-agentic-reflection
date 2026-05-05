# Design QA — Visual review checklist

Use after **Pass 3 (Polish)** or on every PR that touches UI. **Fix only visual issues** — no behavior or data changes unless a bug blocks review.

## Focal point

- [ ] Does my eye know **where to look first** within 2 seconds?
- [ ] Is there **exactly one** dominant headline or primary CTA in the hero?

## Space

- [ ] Is there **enough whitespace** between sections (not just inside cards)?
- [ ] Does vertical rhythm feel **consistent** (multiples of the spacing scale)?

## Depth

- [ ] Do cards feel **layered** (soft shadow + subtle border) rather than flat pasteboard?
- [ ] Are borders **hairline / low contrast** unless signaling selection?

## Typography

- [ ] Is the **main heading** clearly more dominant than section titles?
- [ ] Is body copy **readable** (line length, line-height, secondary color for de-emphasis)?

## Calm

- [ ] Does the screen feel **calm** or **busy**? If busy, what single element would you remove or demote?
- [ ] Any **competing** saturated accents in one viewport?

## Alignment

- [ ] Grid edges and baselines **line up** where they should (no 1–3px “almost” alignment).
- [ ] Mobile: tap targets **≥ 44px** where platform expects it.

## Motion

- [ ] Hover/focus motion respects **`prefers-reduced-motion`**?

## Example critique lines (for feedback)

- “The hero still feels **boxed** — reduce border visibility and read as **canvas**.”
- “The practice card feels **flat** — add **layered gradient** or inset highlight, not a new border.”
- “**Vertical rhythm** between sections feels tight — bump section gaps one step on the spacing scale.”
- “**Typography hierarchy** — pull display size up 5% or tighten subcopy width so the title owns the line.”
