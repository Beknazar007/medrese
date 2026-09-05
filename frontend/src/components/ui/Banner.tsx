import type { ReactNode } from "react";

export function WarningBanner({ children }: { children: ReactNode }) {
  return <div className="warning-banner">{children}</div>;
}

export function InfoBanner({ children }: { children: ReactNode }) {
  return <div className="info-banner">{children}</div>;
}
