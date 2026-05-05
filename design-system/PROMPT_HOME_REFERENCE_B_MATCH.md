# Cursor session prompt — Today / Home vs Reference B (≥90% fidelity)

Copy everything below the line into a **new Agent-mode Cursor chat** with this repo open.

---

**Goal:** Implement the **Today / Home** screen so it visually matches the approved reference mocks (hero, continue row, 3-column mid row, 3-column bottom row, typography, radii, colors, shadows). Target **≥90% fidelity to Reference B** (three-column middle + bottom, dark green primary, hero landscape + sun, suggested card with stone/water/leaf visual, sidebar with profile + settings, **Start a reset + theme toggle** in hero top-right). Use **Reference A** only for secondary checks (cream background `#F7F7F2`-ish, spacing rhythm).

**Project root:** `C:\Users\josep\Downloads\quiet-current-polished-ui-final` (or your actual clone).

### Non-negotiables

- **Do not break behavior:** `/api/home`, visit POST, preferences save, chat resume, practice navigation, notes, insights, reflection generate, streak/gratitude data — all existing handlers and state must keep working.
- **Follow the design system first:** read `/design-system/00_principles.md`, `01_tokens.ts`, `02_layout.md`, `03_components.md`, `04_motion.md`, `05_review_checklist.md` and `src/styles/design-tokens.css` (`--ds-*`). Prefer **token-backed** CSS; extend tokens in `design-system/01_tokens.ts` + mirror in `design-tokens.css` if you need new semantics.
- **Single source of truth for layout:** **Reference B** grid (hero → continue → 3 cards → 3 cards → optional reflection). If Reference A conflicts, **choose B**.

### Implementation scope (files you will likely touch)

- `src/components/HomePanel.tsx` — composition only; keep logic.
- `src/components/home/*.tsx` — `HomeHero`, `ContinueThreadCard`, `SuggestedPracticeFeature`, `IntentionCard`, `QuickTemplatesCard`, `RecentNoteCard`, `StreakMiniCard`, `GoDeeperCard` — adjust markup/classes/props as needed.
- `src/styles/home-premium.css` — primary visual work; scope under **`.qc-home-premium`** to beat legacy rules in `src/index.css`.
- `src/index.css` — **only** if you must resolve specificity/mobile conflicts; keep diffs minimal.
- **Assets:** `public/gradients/practice.png`, `public/textures/noise.png`, `public/decorative/blob.png` already exist — use them **intentionally** (opacity, blend modes) where the mock uses photography/soft blobs. If you need an additional **non-stock** asset, add under `public/` and document in a one-line comment in CSS.

### Visual targets (checklist)

1. **Shell:** Large rounded **ivory/cream** canvas; **very soft** border + **layered** shadow; generous padding (`--ds-space-*`).
2. **Hero:** Full-area **CSS landscape** (sun, mountains, lake/mist) **behind** copy; **left scrim** for readable type; **top-right:** **Start a reset** + **theme toggle** (wire to existing app theme control if one exists in `AppShell` / header — if none, add a minimal toggle that reuses existing theme mechanism or document TODO with no-op only if impossible).
3. **Typography:** **Serif display** for greeting + section titles; **system sans** for UI/body; greeting size in **~clamp(2.25rem, 5vw, 4.5rem)** range; strong hierarchy vs subtitles.
4. **Hero actions:** Exactly **three** pills: **Log note** (filled primary), **Guided chat** + **Weekly review** (quiet/outline). **Do not** put “Start a reset” in that row.
5. **Continue card:** 3-column desktop: **title stack** | **journey line + glow** | **hint + Resume**; subtle **peach/teal orb** behind CTA column (CSS), not loud.
6. **Suggested card:** Recreate the **stone / ripple / leaf** feel: combine **CSS gradients** + **`/gradients/practice.png`** overlay (opacity capped ~0.45–0.55), optional leaf shape via SVG/CSS mask — **no random stock URL**; local files only.
7. **Intention + templates:** Match card padding, input radius, checkbox row, **Save intention** primary; templates rows with **color swatch + chevron** like mock.
8. **Bottom row:** Three equal cards at desktop; **Recent note** with meta + **bookmark** affordance; **Streak** large number + **7-day** bars with **today** emphasized; **Go deeper** lavender panel + **Explore insights** CTA + subtle blob (`/decorative/blob.png`).
9. **Responsive:** Per `02_layout.md` — **3 → 2 → stack**; hero art **must remain visible on mobile** (do not hide `.qc-hero-art` globally).
10. **Motion:** Hover lifts, focus-visible rings; respect `prefers-reduced-motion`.

### Process you must follow

1. **Read current implementation** (`HomePanel.tsx`, `home-premium.css`, relevant `index.css` blocks).
2. **Pass 1 — structure:** DOM/order/grid only until the layout matches the mock.
3. **Pass 2 — styling:** tokens, gradients, radii, shadows, type scale — **no logic changes**.
4. **Pass 3 — polish:** micro-spacing, border softness, depth, hover — **no logic changes**.
5. **Verify in browser:** run `npm run dev` (or project’s documented `concurrently` command), open **`/?tab=home`**, take **full-page screenshot**; iterate until you’d call it **~90%** vs Reference B.
6. **Run:** `npm run build` and `npm run test:unit`; fix failures you introduce. If Playwright exists, run **`e2e/smoke.spec.ts`** and adjust selectors **minimally** only if required.

### Output expected from you (the agent)

- Short **summary of edits** (files + why).
- **Before/after** note: what still misses the mock if &lt;90% (be honest).
- Confirm **build + unit tests** green.

**Start by:** opening Reference B side-by-side with the running app and fixing the **largest delta first** (Suggested visual + hero top-right chrome + typography scale).
