# Quiet Current — Design Principles

**Taste is centralized. Execution is distributed.**

Agents implement what is written here and in sibling files (`01_tokens.ts`, `02_layout.md`, `03_components.md`, `04_motion.md`). They do not invent patterns, colors, or layout that are not specified.

---

## Design anchor

This app should feel like:

- **Calm × Apple Health × Notion**
- **Editorial**, not a dense dashboard
- **Soft, atmospheric, private**
- **Premium**, not flashy or “startup loud”

Every visual decision must match this anchor.

---

## Principles (ranked)

1. **Calm > dense** — Fewer elements, more air. If it feels busy, remove or demote.
2. **Editorial > dashboard** — One story per region; typography leads; grids support reading.
3. **Depth > borders** — Layer with light, shadow, and gradient; hairline borders only when necessary.
4. **One focal point per screen** — The eye should land in one obvious place first (usually hero title or primary CTA).
5. **Space is a feature** — Whitespace is not “empty”; it is intentional rest.
6. **Nothing should feel utility-first** — Avoid raw form stacks and default-system gray boxes without warmth.
7. **UI should feel like a place, not a tool** — Atmosphere, softness, and continuity matter as much as affordances.

---

## Non-goals

- Loud neon gradients or gimmicky motion
- Stock-photo hero banners as the primary story
- Dense data tables on emotional surfaces (Home, Journal intros)
- Competing multiple “primary” buttons in one viewport
- Breaking accessibility for aesthetics (contrast, focus, semantics stay non-negotiable)

---

## Hard rule for agents

If it is not in **tokens**, **layout**, or **components** docs → **it does not exist.** Propose a doc change first; do not improvise in code.
