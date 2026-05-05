import type { ReactNode } from "react";
import { Button } from "../ui/Button";

export function MobileDrawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="qc-drawer-root">
      <button type="button" className="qc-drawer-backdrop" aria-label="Close menu" onClick={onClose} />
      <div className="qc-drawer-panel" role="dialog" aria-modal aria-labelledby="qc-drawer-title">
        <div className="qc-drawer-head">
          <h2 id="qc-drawer-title" className="qc-drawer-title">
            {title}
          </h2>
          <Button variant="icon" className="qc-drawer-close" onClick={onClose} aria-label="Close menu">
            ×
          </Button>
        </div>
        <div className="qc-drawer-body">{children}</div>
      </div>
    </div>
  );
}
