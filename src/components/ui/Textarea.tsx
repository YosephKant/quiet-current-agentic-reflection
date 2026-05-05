import type { TextareaHTMLAttributes } from "react";

export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={"qc-textarea " + className} {...rest} />;
}
