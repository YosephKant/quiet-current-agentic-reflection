import type { SelectHTMLAttributes } from "react";

export function Select({ className = "", ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={"qc-select " + className} {...rest} />;
}
