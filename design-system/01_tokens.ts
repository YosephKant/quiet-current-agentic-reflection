/**
 * Quiet Current — canonical design tokens (TypeScript).
 * CSS should mirror these values in `src/styles/design-tokens.css` (`--ds-*`).
 * Do not invent new semantic colors in components; extend here first.
 */
export const tokens = {
  colors: {
    primary: "#2F5F59",
    /** Today / Home shell — warm ivory (Reference A/B) */
    shellCream: "#F7F7F2",
    bg: "#F6F8F7",
    surface: "#FFFFFF",
    textPrimary: "#142B2C",
    textSecondary: "#6F746F",
    border: "rgba(0,0,0,0.06)",
    glow: "rgba(200,160,255,0.3)",
  },

  radius: {
    sm: "12px",
    md: "20px",
    lg: "28px",
    xl: "32px",
  },

  spacing: {
    xs: "6px",
    sm: "12px",
    md: "20px",
    lg: "32px",
    xl: "48px",
  },

  shadow: {
    soft: "0 10px 30px rgba(0,0,0,0.05)",
    hover: "0 14px 40px rgba(0,0,0,0.08)",
  },
} as const;

export type Tokens = typeof tokens;
