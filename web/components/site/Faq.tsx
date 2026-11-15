"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <ul className="faq">
      {items.map((item, index) => {
        const expanded = open === index;
        return (
          <li key={item.q}>
            <h3 style={{ margin: 0 }}>
              <button type="button" className="faq__q" aria-expanded={expanded} aria-controls={`faq-${index}`} onClick={() => setOpen(expanded ? null : index)}>
                <span>{item.q}</span>
                <span className="accordion__chevron"><Icon name="down" size={18} color="var(--ink-2)" /></span>
              </button>
            </h3>
            {expanded ? <p id={`faq-${index}`} className="faq__a rise">{item.a}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
