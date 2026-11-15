"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./Button";

/** Destructive confirmation: the safe choice has focus, Escape cancels. */
export function ConfirmDialog({ title, children, confirmLabel, cancelLabel = "취소", onConfirm, onCancel, busy }: {
  title: string; children: ReactNode; confirmLabel: string; cancelLabel?: string; onConfirm: () => void; onCancel: () => void; busy?: boolean;
}) {
  const safe = useRef<HTMLButtonElement>(null);
  useEffect(() => { safe.current?.focus(); }, []);
  return (
    <div className="dialog-backdrop" onKeyDown={(event) => { if (event.key === "Escape") onCancel(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="dialog">
        <h2 id="confirm-title" style={{ fontSize: 18, fontWeight: 700 }}>{title}</h2>
        <div className="muted" style={{ fontSize: 14 }}>{children}</div>
        <div className="dialog__actions">
          <Button variant="secondary" ref={safe} onClick={onCancel}>{cancelLabel}</Button>
          <Button variant="danger" onClick={onConfirm} loading={busy} loadingText="처리 중">{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
