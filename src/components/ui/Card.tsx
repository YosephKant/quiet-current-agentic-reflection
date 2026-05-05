import type { HTMLAttributes, ReactNode } from "react";

type Variant = "default" | "muted" | "highlighted";

const variantClass: Record<Variant, string> = {
  default: "",
  muted: " qc-card--muted",
  highlighted: " qc-card--highlighted",
};

export function Card({
  variant = "default",
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <section className={"qc-card" + variantClass[variant] + (className ? " " + className : "")} {...props}>
      {children}
    </section>
  );
}
