"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";

const STORAGE_KEY = "script-shield:changelog-seen";

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  items: Array<{
    type: "feature" | "fix" | "improvement";
    text: string;
  }>;
}

/* ── Changelog data — add new entries at the TOP ── */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.4.1",
    date: "2026-03-11",
    title: "Script Edits Now Update Score",
    items: [
      { type: "fix", text: "Accepting a line edit in the Script tab now auto-dismisses old flags on that line and recalculates the risk score" },
    ],
  },
  {
    version: "1.4.0",
    date: "2026-03-11",
    title: "Dismiss Flags, Captions Input & Rename",
    items: [
      { type: "feature", text: "Dismiss individual legal/YouTube flags — risk score adjusts automatically based on severity weight" },
      { type: "feature", text: "Separate bodycam/captions input — paste subtitle files alongside the main script" },
      { type: "feature", text: "Rename reports — click the title on the results page or double-click in history" },
      { type: "feature", text: "Changelog popup — see what's new after each update" },
      { type: "improvement", text: "Dismiss/restore buttons are now visible bordered buttons instead of tiny links" },
      { type: "improvement", text: "Dismissed flags persist server-side across devices" },
    ],
  },
  {
    version: "1.3.0",
    date: "2026-03-11",
    title: "Portal Navigation & Review History",
    items: [
      { type: "feature", text: "Portal navigation button on all pages for seamless cross-app navigation" },
      { type: "feature", text: "Review history dashboard — browse, filter, and revisit past analyses" },
      { type: "feature", text: "Dark/light theme toggle" },
      { type: "feature", text: "Print-friendly view for PDF export" },
      { type: "improvement", text: "All navigation stays in the same tab" },
    ],
  },
];

export const CURRENT_VERSION = CHANGELOG[0]?.version ?? "0.0.0";

function getSeenVersion(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function markSeen(version: string) {
  try {
    localStorage.setItem(STORAGE_KEY, version);
  } catch {}
}

/* ── Hook ── */
export function useChangelog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = getSeenVersion();
    if (seen !== CURRENT_VERSION) {
      // Small delay so the page renders first
      const timer = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = useCallback(() => {
    markSeen(CURRENT_VERSION);
    setOpen(false);
  }, []);

  const reopen = useCallback(() => {
    setOpen(true);
  }, []);

  return { open, dismiss, reopen };
}

/* ── Context to expose reopen from anywhere ── */
const ChangelogContext = createContext<{ reopen: () => void }>({ reopen: () => {} });

export function useChangelogTrigger() {
  return useContext(ChangelogContext);
}

/* ── Provider + Modal ── */
export function ChangelogProvider({ children }: { children: React.ReactNode }) {
  const { open, dismiss, reopen } = useChangelog();

  return (
    <ChangelogContext.Provider value={{ reopen }}>
      {children}
      {open && <ChangelogModal onClose={dismiss} />}
    </ChangelogContext.Provider>
  );
}

const TYPE_BADGE: Record<string, { label: string; color: string }> = {
  feature: { label: "NEW", color: "var(--green)" },
  fix: { label: "FIX", color: "var(--red)" },
  improvement: { label: "IMPROVED", color: "var(--amber)" },
};

function ChangelogModal({ onClose }: { onClose: () => void }) {
  const latest = CHANGELOG[0];
  const older = CHANGELOG.slice(1);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative border border-[var(--border)] bg-[var(--bg)] w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-[var(--border)] px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-sm tracking-widest text-[var(--text-bright)] uppercase">
              What&apos;s New
            </h2>
            <p className="text-[10px] text-[var(--text-dim)] mt-0.5 tracking-wider uppercase">
              v{latest?.version} &mdash; {latest?.date}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-xs uppercase tracking-wider px-3 py-1.5 border border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-6">
          {/* Latest version */}
          {latest && (
            <div>
              <h3 className="text-xs text-[var(--text-bright)] uppercase tracking-wider mb-3">
                {latest.title}
              </h3>
              <div className="space-y-2">
                {latest.items.map((item, i) => {
                  const badge = TYPE_BADGE[item.type] ?? TYPE_BADGE.feature;
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 flex-shrink-0 mt-0.5"
                        style={{
                          color: badge.color,
                          border: `1px solid ${badge.color}`,
                        }}
                      >
                        {badge.label}
                      </span>
                      <span className="text-xs text-[var(--text)] leading-relaxed">
                        {item.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Older versions */}
          {older.length > 0 && (
            <div className="border-t border-[var(--border)] pt-4">
              <h4 className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-3">
                Previous Updates
              </h4>
              {older.map((entry) => (
                <div key={entry.version} className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">
                      v{entry.version}
                    </span>
                    <span className="text-[10px] text-[var(--text-dim)]">
                      {entry.date}
                    </span>
                    <span className="text-[10px] text-[var(--text)] ml-1">
                      {entry.title}
                    </span>
                  </div>
                  <div className="space-y-1 ml-1">
                    {entry.items.map((item, i) => {
                      const badge = TYPE_BADGE[item.type] ?? TYPE_BADGE.feature;
                      return (
                        <div key={i} className="flex items-start gap-2">
                          <span
                            className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 flex-shrink-0 mt-0.5 opacity-60"
                            style={{
                              color: badge.color,
                              border: `1px solid ${badge.color}`,
                            }}
                          >
                            {badge.label}
                          </span>
                          <span className="text-[11px] text-[var(--text-dim)] leading-relaxed">
                            {item.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
