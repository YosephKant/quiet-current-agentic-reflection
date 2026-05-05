# Visual checklist — Quiet Current home & global UI

Use before merge. Intent: enforce **eye flow**, **whitespace**, **layering**, **borders**, and **calm vs busy** from `DESIGN_ANCHOR.md`.

## Eye flow

- [ ] One clear **entry story** at the top (hero / greeting); the eye knows where to start without scanning.
- [ ] Secondary blocks support the story; they do not **compete** at the same visual weight as the hero.
- [ ] Bottom row reads as **context**, not a second dashboard.

## Whitespace

- [ ] Vertical rhythm uses the spacing scale (`xs`–`xl`); no arbitrary “almost” gaps unless documented.
- [ ] Line length in body copy stays comfortable (~45–75 characters where possible).
- [ ] Cards breathe: padding inside surfaces matches token intent, not cramped form density.

## Layers & depth

- [ ] Shadows suggest **elevation**, not glow stickers; resting vs hover states differ subtly.
- [ ] At most one **strong** atmospheric layer per view (avoid stacked loud treatments).
- [ ] Decorative art and textures stay **behind** text; contrast holds for primary copy.

## Borders & lines

- [ ] Borders use token border color or defined `color-mix` from premium CSS—no accidental harsh `#000`.
- [ ] Dividers are rare; prefer whitespace over extra rules.

## Calm vs busy

- [ ] CTA count per viewport feels **editorial**, not a toolbar explosion.
- [ ] No gratuitous animation; any motion completes quickly and respects `prefers-reduced-motion` where applicable.
- [ ] Color is **supportive**, not decorative noise; accent glow used sparingly.

## Example critique lines (practice)

Use these as templates when reviewing PRs:

1. **Hero boxed:** “Hero reads as a framed stage set; reduce inset shadow or border so the section breathes like Apple Health, not a poster frame.”
2. **Practice flat:** “Suggested practice card sits at the same elevation as intention—lift hero/practice hierarchy or soften one surface so the grid has a clear star.”
3. **Rhythm tight:** “Eyebrow-to-title spacing matches the dense panel above; add one step of the spacing scale before the H3 so the block feels Notion-calm.”
