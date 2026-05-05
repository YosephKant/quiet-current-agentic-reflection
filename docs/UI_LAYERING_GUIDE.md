# Quiet Current – Background & Image Layering Guide

## Assets Included
- `textures/mountain_bg_16x9.png` → Full-width background
- `textures/stone_card_4x3.png` → Feature card image

---

## 1. Background Layering (Mountain)

### Goal
Create a soft, immersive background behind UI.

### CSS Example

```css
.app-background {
  position: fixed;
  inset: 0;
  z-index: 0;
  background-image: url('/textures/mountain_bg_16x9.png');
  background-size: cover;
  background-position: center;
  filter: blur(8px) saturate(0.9);
  transform: scale(1.05); /* avoids edge blur cutoff */
}

.app-overlay {
  position: fixed;
  inset: 0;
  z-index: 1;
  background: linear-gradient(
    to bottom,
    rgba(255,255,255,0.75),
    rgba(255,255,255,0.92)
  );
  backdrop-filter: blur(20px);
}
```

---

## 2. Main UI Container

```css
.main-container {
  position: relative;
  z-index: 2;
  max-width: 1200px;
  margin: 0 auto;
}
```

---

## 3. Stone Card (Feature Image)

### Goal
Create a calm focal point card with depth.

```css
.stone-card {
  background: rgba(255,255,255,0.7);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0,0,0,0.08);
}

.stone-image {
  width: 100%;
  height: 240px;
  object-fit: cover;
  border-radius: 16px;
}
```

---

## 4. Floating Effect (Apple-style)

```css
.card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 50px rgba(0,0,0,0.12);
}
```

---

## 5. Recommended Additional Sizes

For production, generate:

### Mountain
- 1920x1080 (desktop)
- 2560x1440 (hi-res)
- 1024x768 (tablet)

### Stone
- 800x600 (default)
- 1200x900 (hi-res)
- 600x600 (square fallback)

---

## 6. Pro Tips

- Always blur background slightly → prevents distraction
- Keep stone image sharper → creates hierarchy
- Use glassmorphism for cards (blur + transparency)
- Avoid high contrast behind text

---

## Result

You now have:
- A cinematic background layer
- A grounded interaction focal point
- Apple-level depth + polish

---

## 7. Quiet Current implementation map

| Guide concept | In this repo |
|---------------|----------------|
| §1 Full-viewport mountain (optional) | Today hero uses the same asset **inside** the hero: `.qc-home-hero-bg` in `HomeHero.tsx` + `home-premium.css` (`background-size: cover`, `background-position: center right`, overlays). |
| §2 Main UI above layers | Standard `AppShell` stacking only (no separate atmosphere file). |
| §3 Stone card | `SuggestedPracticeFeature` uses `qc-practice-feature__photo-layer` / `__photo-veil` (background-image + `cover`). Styles: `src/styles/home-premium.css`. |
| Glass shell | `.qc-home-shell` / cards use translucent surfaces in `home-premium.css`. |
