import type { ReactNode } from "react";
import { Mark, type ResultKind } from "./Status";

export function Stat({ label, value, sub, kind, dim }: { label: string; value: ReactNode; sub?: string; kind?: ResultKind; dim?: boolean }) {
  return (
    <div className="stat">
      <span className="stat__label">{kind ? <Mark kind={kind} /> : null}{label}</span>
      <span className={dim ? "stat__value stat__value--dim" : "stat__value"}>{value}</span>
      {sub ? <span className="stat__sub">{sub}</span> : null}
    </div>
  );
}
