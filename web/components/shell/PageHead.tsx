import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

export function PageHead({ title, crumbs, meta, actions }: {
  title: ReactNode; crumbs?: { label: string; href?: string }[]; meta?: ReactNode; actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div className="page-head__text">
        {crumbs?.length ? (
          <nav aria-label="경로" className="crumbs">
            {crumbs.map((crumb, index) => (
              <span key={index} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {index > 0 ? <Icon name="chevron" size={12} color="#a0a4ab" /> : null}
                {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span>{crumb.label}</span>}
              </span>
            ))}
          </nav>
        ) : null}
        <h1 className="t-page">{title}</h1>
        {meta ? <div className="meta-row">{meta}</div> : null}
      </div>
      {actions ? <div className="page-head__actions">{actions}</div> : null}
    </div>
  );
}
