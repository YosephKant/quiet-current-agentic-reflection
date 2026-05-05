# Component specifications — Home (Today)

**Names in code may differ slightly** (`ContinueThreadCard`, `SuggestedPracticeFeature`, etc.) — behavior and hierarchy must match this document.

---

## HomeHero

- **Feel:** Full-width inside the shell; **no heavy borders** on the hero region.
- **Surface:** Gradient + glow (CSS); optional global noise at very low opacity per tokens/CSS.
- **Typography:** Large **serif** display heading; system sans for body and UI.
- **Actions:** **Three actions max** in the primary hero row (e.g. Log note, Guided chat, Weekly review) plus **one** reset-style CTA if spec separates it top-right — do not exceed **one dominant primary** in the hero.
- **Art:** CSS-only atmospheric layers (sun, mist, mountains, lake); no stock hero photo as the main story.

---

## ContinueCard (Continue thread)

- **Layout:** Horizontal on desktop; stacks on narrow screens.
- **Copy:** Minimal — headline + one supporting line + CTA.
- **CTA:** Strong — single primary button (Resume / Open guide).
- **Decor:** Optional journey line / curve — low contrast, does not compete with CTA.

---

## PracticeFeatureCard

- **Surface:** “Stone / water / ripple” feel via **gradients and pseudo-elements** (and optional subtle asset overlay per CSS spec), not a flat white box.
- **Content:** Title + short excerpt; **duration chip** (e.g. 2–10 min).
- **Action:** **One** primary action (Start / Start practice).
- **Hierarchy:** Kicker small; title prominent; body subdued.

---

## IntentionCard

- **Controls:** `textarea` (full width within card), **checkbox** (soft visit / stats opt-in copy per product), **full-width primary CTA** (Save intention).
- **Spacing:** Comfortable vertical rhythm between field, checkbox, button.

---

## QuickTemplatesCard

- **Rows:** Gratitude, Reflection, Intention, Idea — each is an obvious tap target.
- **Weight:** Secondary to practice + intention; scannable list, not competing with hero.

---

## ContextCards (bottom row)

- **Recent note:** Low visual weight; quote or placeholder; link/open affordance.
- **Streak:** Compact; optional illustrative week bars — **must not imply false visit history** (decorative copy if ambiguous).
- **Gratitude / metrics:** If shown, stay compact — do not shout over insights.
- **Go deeper (Insights):** Lavender / glow accent allowed; still one clear CTA.

---

## Chat reflection (full-width below bottom row if present)

- Preserve **functionality**: generate, loading, meta line, `<pre>` or styled output.
- **Visual weight:** Below the “dashboard” row; calm card, not a second hero.

---

## Hard rule

If a new control or layout is not listed here → **update this file first**, then implement.
