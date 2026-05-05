# Layout system

Tokens for spacing live in `01_tokens.ts` (`spacing.xs` … `spacing.xl`). Use them for padding/gaps consistently.

## Shell

- **Home / Today** primary surface: one large rounded **canvas** (`radius.xl`) inside the main stage; generous padding (`spacing.lg`–`spacing.xl`).
- **Sidebar** stays app chrome; do not restyle it from Home passes unless explicitly scoped.

## Vertical rhythm

- **Between major sections:** `spacing.lg` minimum (hero → continue → grid → bottom).
- **Inside cards:** `spacing.md` internal padding default; tighten to `spacing.sm` only for dense lists.

## Grid — Home (Today)

| Breakpoint | Behavior |
|------------|----------|
| **Desktop** (≥1024px) | Hero: copy + art in one row where spec allows; **3 columns** for mid grid (practice \| intention \| templates). |
| **Tablet** (640–1023px) | Mid grid **2 columns**; practice often spans full width first row if spec says so. |
| **Mobile** (<640px) | **Stack**; hero title scales down (`clamp`); actions wrap; bottom row stacked cards. |

## Focal hierarchy

1. Hero **title** (display serif) — largest type on screen.
2. **Primary CTA** (one per hero: e.g. “Start a reset” or equivalent) — visually dominant among hero actions.
3. Secondary hero actions — same weight as each other, lighter than primary.

## Alignment

- Text blocks: max readable width for subtitle (~36–42rem equivalent in CSS).
- CTAs in a row: baseline-align or center-align; do not stagger without intent.

## Depth

- Prefer **layered shadow + soft border token** over heavy outlines.
- Decorative layers (`::before` / `::after`) sit **behind** interactive content (`z-index` + `pointer-events`).
