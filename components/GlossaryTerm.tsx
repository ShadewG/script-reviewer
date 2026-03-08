"use client";

import { useState, useRef, useEffect } from "react";
import { getDefinition } from "@/lib/legal-glossary";

interface GlossaryTermProps {
  term: string;
  children: React.ReactNode;
}

export default function GlossaryTerm({ term, children }: GlossaryTermProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const definition = getDefinition(term);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e instanceof MouseEvent && ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", handler);
    };
  }, [open]);

  if (!definition) return <>{children}</>;

  return (
    <span ref={ref} className="relative inline">
      <button
        onClick={() => setOpen(!open)}
        className="border-b border-dotted border-[var(--text-dim)] hover:border-[var(--text)] cursor-help focus:outline-none focus:ring-1 focus:ring-[var(--text-dim)]"
        aria-expanded={open}
        aria-label={`Definition of ${term}`}
      >
        {children}
      </button>
      {open && (
        <span className="absolute z-40 left-0 top-full mt-1 w-72 border border-[var(--border)] bg-[var(--bg-elevated)] p-3 text-xs leading-relaxed text-[var(--text)] shadow-lg">
          <span className="block text-[10px] uppercase tracking-wider text-[var(--text-bright)] mb-1">
            {term}
          </span>
          {definition}
        </span>
      )}
    </span>
  );
}
