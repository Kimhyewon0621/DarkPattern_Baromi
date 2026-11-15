import type { ReactNode } from "react";
import { Icon } from "./Icon";

type Kind = "info" | "warn" | "error" | "ok" | "brand";
const look: Record<Kind, { icon: "info" | "alert" | "check"; color: string }> = {
  info: { icon: "info", color: "var(--ink-2)" },
  warn: { icon: "alert", color: "var(--review-ink)" },
  error: { icon: "alert", color: "var(--risk-ink)" },
  ok: { icon: "check", color: "var(--clear-ink)" },
  brand: { icon: "info", color: "var(--link)" },
};

export function Alert({ kind = "info", title, children, actions }: { kind?: Kind; title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`alert alert--${kind}`}>
      <Icon name={look[kind].icon} color={look[kind].color} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span className="alert__title">{title}</span>
        {children ? <span className="alert__body">{children}</span> : null}
        {actions ? <div className="alert__actions">{actions}</div> : null}
      </div>
    </div>
  );
}
