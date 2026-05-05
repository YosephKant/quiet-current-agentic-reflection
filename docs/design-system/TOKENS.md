# Design tokens — Quiet Current (`--ds-*`)

Human-readable source of truth for the design system. Runtime CSS mirrors this in `src/styles/design-tokens.css`. **Map gradually** to existing app variables (`:root` in `index.css`, `--qc-*` in `home-premium.css`); do not assume one-shot parity.

## Colors

| Token (concept) | Value |
|-----------------|-------|
| Primary | `#2F5F59` |
| Background | `#F6F8F7` |
| Surface | `#FFFFFF` |
| Border | `rgba(0,0,0,0.06)` |
| Text primary | `#142B2C` |
| Text secondary | `#6F746F` |
| Accent glow | `rgba(200,160,255,0.3)` |

## Radius

| Token | Value |
|-------|-------|
| Card | `24px` |
| Hero | `32px` |
| Buttons | `12px` |

## Spacing scale

| Token | Value (px) |
|-------|------------|
| xs | 6 |
| sm | 12 |
| md | 20 |
| lg | 32 |
| xl | 48 |

## Shadows

| Token | Value |
|-------|-------|
| Soft (resting card) | `0 10px 30px rgba(38, 47, 44, 0.06), 0 1px 2px rgba(38, 47, 44, 0.04)` |
| Hover (lifted card) | `0 18px 48px rgba(38, 47, 44, 0.08), 0 2px 6px rgba(38, 47, 44, 0.05)` |

*(Aligned with premium home card shadows in `home-premium.css` for a single shadow language over time.)*

## Typography

| Role | Stack |
|------|--------|
| Display | `Georgia`, serif (generic `serif` acceptable as fallback) |
| Body | `system-ui` (with sensible system fallbacks in CSS) |

## Notes

- Tokens are **defaults** for new work and Pass 2 refactors; legacy `--qc-hp-*` / `:root` values may differ until wired.
- **Accent glow** is for subtle focus, highlights, or atmospheric accents—not full-field backgrounds.
