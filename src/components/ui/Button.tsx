import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "icon";

export function Button({
  variant = "secondary",
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
}) {
  const v =
    variant === "primary"
      ? "qc-btn qc-btn--primary"
      : variant === "ghost"
        ? "qc-btn qc-btn--ghost"
        : variant === "icon"
          ? "qc-btn qc-btn--icon"
          : "qc-btn qc-btn--secondary";
  return (
    <button type="button" className={v + (className ? " " + className : "")} {...rest}>
      {children}
    </button>
  );
}
