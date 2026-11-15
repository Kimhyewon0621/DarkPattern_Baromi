"use client";

import { useEffect } from "react";

export type VariantType = "dark" | "brutal" | "swiss";

interface Props {
  current: VariantType;
  onChange: (v: VariantType) => void;
}

export default function VariantSwitcher({ current, onChange }: Props) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === "1") onChange("dark");
      if (e.key === "2") onChange("brutal");
      if (e.key === "3") onChange("swiss");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onChange]);

  return (
    <aside className="variant-switcher-bar" aria-label="디자인 버전 비교 스위처">
      <div className="variant-switcher-label">
        <span /> 2026 DESIGN LAB
      </div>

      <button
        type="button"
        className={`variant-btn ${current === "dark" ? "active" : ""}`}
        onClick={() => onChange("dark")}
      >
        <kbd>1</kbd> Ver 1. Dark Inspector
      </button>

      <button
        type="button"
        className={`variant-btn ${current === "brutal" ? "active" : ""}`}
        onClick={() => onChange("brutal")}
      >
        <kbd>2</kbd> Ver 2. Neo-Brutalist
      </button>

      <button
        type="button"
        className={`variant-btn ${current === "swiss" ? "active" : ""}`}
        onClick={() => onChange("swiss")}
      >
        <kbd>3</kbd> Ver 3. Swiss Enterprise
      </button>
    </aside>
  );
}
