# Design system — execution hub

**Canonical product specs live in this folder** (`/design-system/`).  
Long-form narrative and migration notes may also live in `docs/design-system/` — if both exist, **`design-system/` here wins** for tokens and component rules unless README there defers.

## Files

| File | Purpose |
|------|---------|
| [PROMPT_HOME_REFERENCE_B_MATCH.md](./PROMPT_HOME_REFERENCE_B_MATCH.md) | **Copy-paste Cursor session prompt** to drive Home/Today UI to ≥90% vs Reference B |
| `00_principles.md` | Anchor + principles + non-goals |
| `01_tokens.ts` | Typed token object (source for TS consumers) |
| `02_layout.md` | Breakpoints, grid, rhythm, focal rules |
| `03_components.md` | Component specs (what may exist) |
| `04_motion.md` | Durations, easing, reduced motion |
| `05_review_checklist.md` | QA pass before merge |

**CSS mirror:** `src/styles/design-tokens.css` (`--ds-*`) — keep values aligned with `01_tokens.ts` when tokens change.

## Execution loop (distributed agents)

1. **Lock spec (human)** — What ships this cycle is listed in `03_components.md` (or a PR comment pointing to it).
2. **Pass 1 — Structure** — Layout only; spacing rough; **no** final gradients/typography polish.
3. **Pass 2 — Styling** — Apply tokens + `02_layout.md` + typography; **do not change DOM structure**.
4. **Pass 3 — Polish** — Depth, rhythm, border softening, hover; **do not change logic**.
5. **Pass 4 — Design QA** — `05_review_checklist.md` only; visual fixes, **no** feature changes.

**Hard rules:** One structure agent + one styling agent + one polish agent (+ optional QA). **Not** six parallel designers on the same file set. **Spec → approve → then build.**

## Prompt templates (copy)

### Master (constraints)

```text
You are implementing UI using a strict design system.

Follow these rules:
- Do not invent UI patterns
- Use tokens exactly (see design-system/01_tokens.ts and src/styles/design-tokens.css)
- Match design-system/03_components.md and 02_layout.md
- Do not change functionality

Task:
Build the Home page using:
- HomeHero
- ContinueCard
- PracticeFeatureCard
- IntentionCard
- ContextCards

Pass 1:
Return layout only.

Wait for next instruction before styling.
```

### Styling

```text
Apply styling using design tokens.

- gradients for depth
- serif typography for headings
- soft shadows
- large spacing

Do not modify layout structure.
```

### Polish

```text
Polish to premium level:

- reduce visual noise
- improve spacing rhythm
- enhance depth subtly
- ensure calm aesthetic

Do not change logic or layout.
```

### QA

```text
Evaluate UI quality:

- Is there a clear focal point?
- Does spacing feel intentional?
- Do cards feel layered or flat?
- Is typography strong enough?

Fix only visual issues.
```

## Next level (optional roadmap)

- Reusable component library mapped 1:1 to `03_components.md`
- Tailwind (or Uno) theme extension generated from `01_tokens.ts`
- Motion presets from `04_motion.md` as CSS classes or Framer-style variants
- CI step: prompt or script that fails PR if checklist sections are unchecked for `ui` label
