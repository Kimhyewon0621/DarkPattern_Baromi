import type { ReactNode } from "react";

export function Section({ title, count, description, badge, actions, children, id }: {
  title: string; count?: number | string; description?: string; badge?: ReactNode; actions?: ReactNode; children: ReactNode; id?: string;
}) {
  return (
    <section className="section" aria-labelledby={id}>
      <div className="section__head">
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div className="section__title">
            {badge}
            <h2 id={id} className="t-title">{title}{count !== undefined ? <span className="tnum faint"> {count}</span> : null}</h2>
          </div>
          {description ? <span style={{ fontSize: 14, color: "var(--ink-2)" }}>{description}</span> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
