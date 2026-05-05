# Quiet Current — design system workflow

**Canonical execution specs** (principles, TS tokens, layout, components, motion, QA checklist, prompt templates) live in the repo root **`/design-system/`** — start there for agent constraints.

This `docs/design-system/` folder keeps narrative and migration notes. If anything conflicts, **`/design-system/README.md`** wins unless it explicitly defers here.

Formal artifacts for **Vision → Tokens → Component spec → 3-pass build → checklist**. Existing UI (including `HomePanel` + `src/styles/home-premium.css`) stays in place; evolve by **mapping `--ds-*` into `--qc-*` / premium rules over time** (Pass 2), not by deleting parallel work.

## Index

| Doc | Role |
|-----|------|
| [DESIGN_ANCHOR.md](./DESIGN_ANCHOR.md) | Vision, tone, non-goals |
| [TOKENS.md](./TOKENS.md) | Human-readable token table |
| [COMPONENT_SPEC_HOME.md](./COMPONENT_SPEC_HOME.md) | Home components — purpose, layout, props, a11y |
| [CURSOR_THREE_PASS.md](./CURSOR_THREE_PASS.md) | Pass 1 / 2 / 3 workflow + warnings |
| [VISUAL_CHECKLIST.md](./VISUAL_CHECKLIST.md) | Pre-merge visual & calm audit |

## Code

| File | Role |
|------|------|
| `src/styles/design-tokens.css` | `:root` **`--ds-*`** custom properties mirroring `TOKENS.md` |

## Recommended CSS import order

1. **`design-tokens.css`** first (defines `--ds-*` for the cascade).
2. **`index.css`** (global app variables, resets, utilities).
3. Feature / panel styles imported by components (e.g. **`home-premium.css`** from `HomePanel.tsx`).

**`main.tsx`:** keep a single side-effect import of `./index.css`; avoid importing `design-tokens.css` separately unless you split bundles intentionally.

## Premium home note

`home-premium.css` is the **styling companion** to `HomePanel`’s `qc-home-premium` subtree. Pass 2 should progressively wire **`var(--ds-color-*)`**, **`var(--ds-radius-*)`**, **`var(--ds-shadow-*)`**, and spacing into those rules **without removing** the premium layer—treat `--qc-hp-*` as implementation detail that can delegate to `--ds-*` as mappings land.

## Checklist gate

Before merging UI: `VISUAL_CHECKLIST.md` + confirm changes still match `DESIGN_ANCHOR.md`.
