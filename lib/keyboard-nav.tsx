"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseKeyboardNavOptions {
  itemCount: number;
  enabled?: boolean;
  onExpand?: (index: number) => void;
  onDismiss?: (index: number) => void;
}

export function useKeyboardNav({
  itemCount,
  enabled = true,
  onExpand,
  onDismiss,
}: UseKeyboardNavOptions) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showHelp, setShowHelp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToItem = useCallback((index: number) => {
    if (!containerRef.current) return;
    const items = containerRef.current.querySelectorAll("[data-nav-item]");
    if (items[index]) {
      items[index].scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
      if (target.isContentEditable) return;

      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) => {
            const next = Math.min(prev + 1, itemCount - 1);
            scrollToItem(next);
            return next;
          });
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) => {
            const next = Math.max(prev - 1, 0);
            scrollToItem(next);
            return next;
          });
          break;
        case "Enter":
          if (activeIndex >= 0 && onExpand) {
            e.preventDefault();
            onExpand(activeIndex);
          }
          break;
        case "Escape":
          e.preventDefault();
          setActiveIndex(-1);
          setShowHelp(false);
          break;
        case "d":
          if (activeIndex >= 0 && onDismiss) {
            e.preventDefault();
            onDismiss(activeIndex);
          }
          break;
        case "?":
          e.preventDefault();
          setShowHelp((prev) => !prev);
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, itemCount, activeIndex, onExpand, onDismiss, scrollToItem]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [itemCount]);

  return { activeIndex, setActiveIndex, showHelp, setShowHelp, containerRef };
}

export function KeyboardHelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="border border-[var(--border)] bg-[var(--bg-elevated)] p-6 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs uppercase tracking-wider text-[var(--text-bright)] mb-4">
          Keyboard Shortcuts
        </div>
        <div className="space-y-2 text-sm">
          {[
            ["j / Down", "Next item"],
            ["k / Up", "Previous item"],
            ["Enter", "Expand / collapse"],
            ["d", "Dismiss flag"],
            ["Esc", "Deselect / close"],
            ["?", "Toggle this help"],
          ].map(([key, desc]) => (
            <div key={key} className="flex items-center gap-3">
              <kbd className="text-[10px] px-1.5 py-0.5 border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-bright)] min-w-[60px] text-center">
                {key}
              </kbd>
              <span className="text-[var(--text-dim)]">{desc}</span>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 text-xs uppercase tracking-wider border border-[var(--border)] hover:bg-[var(--bg-surface)]"
        >
          Close
        </button>
      </div>
    </div>
  );
}
