import { useEffect, type ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  variant?: "sheet" | "dialog";
}

export default function Overlay({ open, onClose, children, variant = "dialog" }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={`scrim${variant === "sheet" ? " sheet-scrim" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={variant === "sheet" ? "sheet" : "dialog"} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}
