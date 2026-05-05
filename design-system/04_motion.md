# Motion system

Principle: **Motion explains hierarchy; it never steals attention from copy.**

## Defaults

| Use | Duration | Easing |
|-----|----------|--------|
| Hover lift (cards) | 180–220ms | `ease` or `cubic-bezier(0.22, 1, 0.36, 1)` |
| Button hover (bg/shadow) | 150–200ms | `ease` |
| Hero / decorative drift | Optional, very slow (8–20s loops) | linear or gentle ease |

## Card hover

- `translateY(-2px)` max
- Shadow: token **hover** shadow (see `01_tokens.ts` / `--ds-shadow-hover`)
- **No** aggressive scale on editorial surfaces

## Focus

- **`:focus-visible`** only — clear ring using primary teal at readable contrast.
- Ring offset 2px where possible.

## Reduced motion

- **`prefers-reduced-motion: reduce`:** disable decorative loops, parallax, and hover **translate**; keep opacity/color transitions subtle or off.

## Forbidden

- Bouncy spring on every chip
- Autoplay motion that cannot be paused
- Layout shift on hover (changing height/width of cards)
