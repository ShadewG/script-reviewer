"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { LegalFlag, PolicyFlag } from "@/lib/pipeline/types";
import { useUser } from "@/lib/user";

interface LineEdit {
  lineNumber: number;
  originalText: string;
  newText: string;
  verdict: string;
  timestamp: number;
  userId?: string;
  displayName?: string;
  avatarUrl?: string;
}

interface LineEditFormProps {
  lineNumber: number;
  originalText: string;
  scriptText: string;
  state: string;
  caseStatus: string;
  hasMinors: boolean;
  onClose: () => void;
  onAcceptEdit?: (edit: LineEdit, result: { verdict: string; legalFlags: LegalFlag[]; policyFlags: PolicyFlag[] } | null) => void;
}

function LineEditForm({
  lineNumber,
  originalText,
  scriptText,
  state,
  caseStatus,
  hasMinors,
  onClose,
  onAcceptEdit,
}: LineEditFormProps) {
  const [newText, setNewText] = useState(originalText);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<{
    verdict: string;
    summary: string;
    legalFlags: LegalFlag[];
    policyFlags: PolicyFlag[];
  } | null>(null);

  const analyze = async () => {
    setAnalyzing(true);
    setResult(null);
    try {
      const res = await fetch("/api/analyze-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptText, lineNumber, newText, state, caseStatus, hasMinors }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch {
      setResult({ verdict: "error", summary: "Analysis failed", legalFlags: [], policyFlags: [] });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="border border-[var(--border)] bg-[var(--bg)] p-3 mt-1 mb-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">
          Edit Line {lineNumber}
        </span>
        <button onClick={onClose} className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text)]">
          CLOSE
        </button>
      </div>
      <textarea
        value={newText}
        onChange={(e) => setNewText(e.target.value)}
        rows={2}
        className="w-full text-xs mb-2 resize-none"
      />
      <button
        onClick={analyze}
        disabled={analyzing || newText === originalText}
        className="text-[10px] uppercase tracking-wider px-3 py-1 border border-[var(--border)] hover:bg-[var(--bg-elevated)] disabled:opacity-30"
      >
        {analyzing ? "CHECKING..." : "CHECK THIS LINE"}
      </button>

      {result && (
        <div className="mt-2 border-t border-[var(--border)] pt-2">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2 h-2"
              style={{
                background:
                  result.verdict === "clear" ? "var(--green)" :
                  result.verdict === "caution" ? "var(--yellow)" : "var(--red)",
              }}
            />
            <span className="text-xs uppercase" style={{
              color:
                result.verdict === "clear" ? "var(--green)" :
                result.verdict === "caution" ? "var(--yellow)" : "var(--red)",
            }}>
              {result.verdict}
            </span>
          </div>
          <p className="text-[10px] text-[var(--text-dim)]">{result.summary}</p>
          {result.legalFlags.length > 0 && (
            <div className="mt-1">
              {result.legalFlags.map((f, i) => (
                <div key={i} className="text-[10px] text-[var(--red)] mt-1">
                  Legal: {f.reasoning}
                </div>
              ))}
            </div>
          )}
          {result.policyFlags.length > 0 && (
            <div className="mt-1">
              {result.policyFlags.map((f, i) => (
                <div key={i} className="text-[10px] text-[var(--yellow)] mt-1">
                  Policy: {f.reasoning}
                </div>
              ))}
            </div>
          )}
          {newText !== originalText && onAcceptEdit && (
            <button
              onClick={() => {
                onAcceptEdit({ lineNumber, originalText, newText, verdict: result.verdict, timestamp: Date.now() }, result);
                onClose();
              }}
              className="text-[10px] uppercase tracking-wider mt-2 px-3 py-1 border border-[var(--green)] text-[var(--green)] hover:bg-[var(--green)] hover:text-[var(--bg)]"
            >
              Accept Edit
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface FlagDetail {
  type: "legal" | "policy";
  flag: LegalFlag | PolicyFlag;
}

interface LineEditResult {
  lineNumber: number;
  newText: string;
  verdict: string;
  legalFlags: LegalFlag[];
  policyFlags: PolicyFlag[];
}

interface Props {
  scriptText: string;
  legalFlags: LegalFlag[];
  policyFlags: PolicyFlag[];
  state: string;
  caseStatus: string;
  hasMinors: boolean;
  flagFilter?: "all" | "legal" | "policy";
  onLineEdited?: (result: LineEditResult) => void;
  reviewId?: string;
  savedEdits?: LineEdit[];
}

/** Split text into chunks: sentence boundaries first, then word boundaries as fallback */
function splitIntoChunks(text: string, maxLen: number): string[] {
  const sentenceParts = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const part of sentenceParts) {
    if (current.length + part.length + 1 > maxLen && current.length > 0) {
      chunks.push(current);
      current = part;
    } else {
      current = current ? current + " " + part : part;
    }
  }
  if (current) chunks.push(current);

  // Further split any chunks still over maxLen by word boundary
  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= maxLen) {
      result.push(chunk);
    } else {
      const words = chunk.split(/\s+/);
      let cur = "";
      for (const word of words) {
        if (cur.length + word.length + 1 > maxLen && cur.length > 0) {
          result.push(cur);
          cur = word;
        } else {
          cur = cur ? cur + " " + word : word;
        }
      }
      if (cur) result.push(cur);
    }
  }
  return result.length > 0 ? result : [text];
}

/**
 * Normalize script for display: split long lines into readable chunks and
 * remap flag line numbers using text matching so flags land on the correct
 * display line rather than all piling onto the first chunk or pointing at blanks.
 */
function normalizeScriptView(
  rawLines: string[],
  legalFlags: LegalFlag[],
  policyFlags: PolicyFlag[],
  maxLen = 200,
): { lines: string[]; legalFlags: LegalFlag[]; policyFlags: PolicyFlag[] } {
  if (!rawLines.some((l) => l.length > maxLen)) {
    return { lines: rawLines, legalFlags, policyFlags };
  }

  // Step 1: Split long lines into display chunks
  const lines: string[] = [];
  const origToNew = new Map<number, number[]>();
  for (let i = 0; i < rawLines.length; i++) {
    const origLine = i + 1;
    const raw = rawLines[i];
    if (raw.length <= maxLen) {
      lines.push(raw);
      origToNew.set(origLine, [lines.length]);
    } else {
      const chunks = splitIntoChunks(raw, maxLen);
      const newNums: number[] = [];
      for (const chunk of chunks) {
        lines.push(chunk);
        newNums.push(lines.length);
      }
      origToNew.set(origLine, newNums);
    }
  }

  // Step 2: Lowercase index for text matching
  const lowerLines = lines.map((l) => l.toLowerCase().trim());

  // Step 3: Find best display line for a given flag text
  function findBestLine(flagText: string, origLine?: number): number | undefined {
    const lower = (flagText || "").toLowerCase().trim();

    if (lower) {
      // Exact substring: flag text found within a display line
      for (let j = 0; j < lowerLines.length; j++) {
        if (lowerLines[j] && lowerLines[j].includes(lower)) return j + 1;
      }
      // First 8 words match (handles long flag text that spans multiple lines)
      const firstWords = lower.split(/\s+/).slice(0, 8).join(" ");
      if (firstWords.length > 15) {
        for (let j = 0; j < lowerLines.length; j++) {
          if (lowerLines[j] && lowerLines[j].includes(firstWords)) return j + 1;
        }
      }
      // Last 6 words match
      const lastWords = lower.split(/\s+/).slice(-6).join(" ");
      if (lastWords.length > 15 && lastWords !== firstWords) {
        for (let j = 0; j < lowerLines.length; j++) {
          if (lowerLines[j] && lowerLines[j].includes(lastWords)) return j + 1;
        }
      }
    }

    // Fall back to line number mapping
    if (origLine) {
      const m = origToNew.get(origLine);
      return m ? m[0] : origLine;
    }
    return origLine;
  }

  return {
    lines,
    legalFlags: legalFlags.map((f) => {
      const nl = findBestLine(f.text, f.line);
      return nl !== f.line ? { ...f, line: nl } : f;
    }),
    policyFlags: policyFlags.map((f) => {
      const nl = findBestLine(f.text, f.line);
      return nl !== f.line ? { ...f, line: nl } : f;
    }),
  };
}

export default function AnnotatedScriptView({
  scriptText,
  legalFlags: rawLegalFlags,
  policyFlags: rawPolicyFlags,
  state,
  caseStatus,
  hasMinors,
  flagFilter = "all",
  onLineEdited,
  reviewId,
  savedEdits,
}: Props) {
  const user = useUser();
  const { lines, legalFlags, policyFlags } = useMemo(
    () => normalizeScriptView(scriptText.split("\n"), rawLegalFlags, rawPolicyFlags),
    [scriptText, rawLegalFlags, rawPolicyFlags],
  );
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [editingLine, setEditingLine] = useState<number | null>(null);
  const [currentFlagIndex, setCurrentFlagIndex] = useState(0);
  const [edits, setEdits] = useState<LineEdit[]>(savedEdits ?? []);
  const [showEdits, setShowEdits] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef = useRef<HTMLDivElement>(null);
  const scriptContainerRef = useRef<HTMLDivElement>(null);
  const [scrollRatio, setScrollRatio] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0.1);

  // Persist edits to server (debounced)
  const persistEdits = useCallback(
    (updated: LineEdit[]) => {
      if (!reviewId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        fetch(`/api/reviews/${reviewId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scriptEdits: updated }),
        }).catch(() => {});
      }, 500);
    },
    [reviewId],
  );

  // Build visible line -> flags map (respects flagFilter)
  const visibleLineFlags = useMemo(() => {
    const map = new Map<number, FlagDetail[]>();
    if (flagFilter !== "policy") {
      for (const flag of legalFlags) {
        if (flag.line) {
          const existing = map.get(flag.line) ?? [];
          existing.push({ type: "legal", flag });
          map.set(flag.line, existing);
        }
      }
    }
    if (flagFilter !== "legal") {
      for (const flag of policyFlags) {
        if (flag.line) {
          const existing = map.get(flag.line) ?? [];
          existing.push({ type: "policy", flag });
          map.set(flag.line, existing);
        }
      }
    }
    return map;
  }, [legalFlags, policyFlags, flagFilter]);

  // Sorted flagged line numbers for navigation
  const flaggedLineNumbers = useMemo(
    () => [...visibleLineFlags.keys()].sort((a, b) => a - b),
    [visibleLineFlags],
  );

  // Sync currentFlagIndex when clicking lines
  useEffect(() => {
    if (selectedLine !== null) {
      const idx = flaggedLineNumbers.indexOf(selectedLine);
      if (idx >= 0) setCurrentFlagIndex(idx);
    }
  }, [selectedLine, flaggedLineNumbers]);

  // Scroll to selected line
  useEffect(() => {
    if (selectedLine !== null && selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedLine]);

  // Track scroll position for minimap viewport indicator
  useEffect(() => {
    const el = scriptContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      setScrollRatio(scrollHeight > clientHeight ? scrollTop / (scrollHeight - clientHeight) : 0);
      setViewportHeight(Math.min(1, clientHeight / Math.max(1, scrollHeight)));
    };
    onScroll(); // compute initial value
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Navigation helpers
  const navigateToFlag = useCallback((index: number) => {
    if (index < 0 || index >= flaggedLineNumbers.length) return;
    setCurrentFlagIndex(index);
    setSelectedLine(flaggedLineNumbers[index]);
  }, [flaggedLineNumbers]);

  const goNext = useCallback(() => {
    navigateToFlag(Math.min(currentFlagIndex + 1, flaggedLineNumbers.length - 1));
  }, [currentFlagIndex, flaggedLineNumbers.length, navigateToFlag]);

  const goPrev = useCallback(() => {
    navigateToFlag(Math.max(currentFlagIndex - 1, 0));
  }, [currentFlagIndex, navigateToFlag]);

  // Keyboard shortcuts (script tab only)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Don't capture when typing in inputs
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        goNext();
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "e" && selectedLine !== null) {
        e.preventDefault();
        setEditingLine(selectedLine);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setEditingLine(null);
        setSelectedLine(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, selectedLine]);

  // Minimap tick color
  const tickColor = (lineNum: number) => {
    const flags = visibleLineFlags.get(lineNum);
    if (!flags) return "transparent";
    const hasLegal = flags.some((f) => f.type === "legal");
    const hasPolicy = flags.some((f) => f.type === "policy");
    if (hasLegal && hasPolicy) return "var(--red)";
    if (hasLegal) return "var(--red)";
    return "var(--yellow)";
  };

  return (
    <div className="flex gap-4">
      {/* Script Column */}
      <div className="flex-1 flex min-w-0">
        <div
          ref={scriptContainerRef}
          className="flex-1 overflow-auto max-h-[700px] border border-[var(--border)] bg-[var(--bg-surface)]"
          style={{ fontFamily: '"Courier New", Courier, monospace' }}
        >
          {lines.map((line, i) => {
            const lineNum = i + 1;
            const flags = visibleLineFlags.get(lineNum);
            const hasLegal = flags?.some((f) => f.type === "legal");
            const hasPolicy = flags?.some((f) => f.type === "policy");
            const isSelected = selectedLine === lineNum;
            const lineEdit = edits.find((e) => e.lineNumber === lineNum);

            let bgColor = "transparent";
            if (lineEdit) bgColor = "rgba(34, 197, 94, 0.12)";
            else if (hasLegal && hasPolicy) bgColor = "rgba(239, 68, 68, 0.2)";
            else if (hasLegal) bgColor = "rgba(239, 68, 68, 0.12)";
            else if (hasPolicy) bgColor = "rgba(234, 179, 8, 0.12)";

            return (
              <div key={lineNum}>
                <div
                  ref={isSelected ? selectedRef : undefined}
                  onClick={() => flags && setSelectedLine(isSelected ? null : lineNum)}
                  className={`flex text-[13px] leading-7 ${flags ? "cursor-pointer hover:brightness-110" : ""} ${
                    isSelected ? "ring-1 ring-[var(--text-dim)]" : ""
                  }`}
                  style={{ background: bgColor }}
                >
                  {/* Line number gutter */}
                  <div className="w-10 flex-shrink-0 text-right pr-2 text-[var(--text-dim)] select-none border-r border-[var(--border)] relative">
                    {lineNum}
                    {(flags || lineEdit) && (
                      <div className="absolute right-[-3px] top-[9px] flex flex-col gap-0.5">
                        {lineEdit && <div className="w-1.5 h-1.5 bg-[var(--green)]" />}
                        {hasLegal && <div className="w-1.5 h-1.5 bg-[var(--red)]" />}
                        {hasPolicy && <div className="w-1.5 h-1.5 bg-[var(--yellow)]" />}
                      </div>
                    )}
                  </div>
                  {/* Line content */}
                  <div className="pl-3 pr-2 whitespace-pre-wrap break-all flex-1">
                    {lineEdit ? (
                      <span className="flex items-start gap-1.5">
                        {lineEdit.avatarUrl && (
                          <img src={lineEdit.avatarUrl} alt="" className="w-4 h-4 rounded-full mt-1.5 flex-shrink-0" />
                        )}
                        <span>
                          <span className="line-through opacity-40">{lineEdit.originalText}</span>
                          {" "}
                          <span className="text-[var(--green)]">{lineEdit.newText}</span>
                        </span>
                      </span>
                    ) : (
                      line || "\u00A0"
                    )}
                  </div>
                </div>

                {/* Inline flag details */}
                {isSelected && flags && (
                  <div className="border-l-2 border-[var(--text-dim)] ml-10 pl-4 py-3 bg-[var(--bg-elevated)]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
                    {flags.map((fd, fi) => {
                      const f = fd.flag;
                      if (fd.type === "legal") {
                        const lf = f as LegalFlag;
                        return (
                          <div key={fi} className="mb-3 last:mb-0">
                            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                              <span className="w-1.5 h-1.5 bg-[var(--red)]" />
                              <span className="text-xs uppercase text-[var(--red)] font-medium">
                                {lf.severity} — {lf.riskType.replaceAll("_", " ")}
                              </span>
                              <span className="text-xs text-[var(--text-dim)]">
                                — {lf.person}
                              </span>
                              {lf.counselReview && (
                                <span className="text-xs text-[var(--red)] border border-[var(--red)] px-1">
                                  COUNSEL
                                </span>
                              )}
                              {"agreementCount" in lf && (
                                <span className="text-xs text-[var(--text-dim)] border border-[var(--border)] px-1">
                                  {(lf as unknown as { agreementCount: number }).agreementCount}/2
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[var(--text-dim)] leading-relaxed">{lf.reasoning}</p>
                            {lf.stateCitation && (
                              <p className="text-xs text-[var(--text-dim)] mt-1">Cite: {lf.stateCitation}</p>
                            )}
                            <p className="text-xs text-[var(--green)] mt-1">Safer: {lf.saferRewrite}</p>
                          </div>
                        );
                      } else {
                        const pf = f as PolicyFlag;
                        return (
                          <div key={fi} className="mb-3 last:mb-0">
                            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                              <span className="w-1.5 h-1.5 bg-[var(--yellow)]" />
                              <span className="text-xs uppercase text-[var(--yellow)] font-medium">
                                {pf.severity} — {pf.category.replaceAll("_", " ")}
                              </span>
                              <span
                                className="text-xs uppercase px-1 border"
                                style={{ color: pf.impact === "full_ads" ? "var(--green)" : pf.impact === "limited_ads" ? "var(--yellow)" : "var(--red)", borderColor: pf.impact === "full_ads" ? "var(--green)" : pf.impact === "limited_ads" ? "var(--yellow)" : "var(--red)" }}
                              >
                                {pf.impact.replaceAll("_", " ")}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--text-dim)] leading-relaxed">{pf.reasoning}</p>
                            {pf.policyQuote && (
                              <p className="text-xs text-[var(--text-dim)] italic mt-1">Policy: {pf.policyQuote}</p>
                            )}
                            {pf.saferRewrite && (
                              <p className="text-xs text-[var(--green)] mt-1">Safer: {pf.saferRewrite}</p>
                            )}
                          </div>
                        );
                      }
                    })}
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingLine(lineNum); }}
                      className="text-[10px] uppercase tracking-wider mt-1 px-2 py-0.5 border border-[var(--border)] hover:bg-[var(--bg-surface)] text-[var(--text-dim)]"
                    >
                      Suggest Edit
                    </button>
                  </div>
                )}

                {/* Inline edit form */}
                {editingLine === lineNum && (
                  <div className="ml-10">
                    <LineEditForm
                      lineNumber={lineNum}
                      originalText={line}
                      scriptText={scriptText}
                      state={state}
                      caseStatus={caseStatus}
                      hasMinors={hasMinors}
                      onClose={() => setEditingLine(null)}
                      onAcceptEdit={(edit, editResult) => {
                        const taggedEdit: LineEdit = {
                          ...edit,
                          userId: user?.id,
                          displayName: user?.username ?? undefined,
                          avatarUrl: user?.avatar ?? undefined,
                        };
                        setEdits((prev) => {
                          const updated = [...prev.filter((e) => e.lineNumber !== edit.lineNumber), taggedEdit];
                          persistEdits(updated);
                          return updated;
                        });
                        if (onLineEdited && editResult) {
                          onLineEdited({
                            lineNumber: edit.lineNumber,
                            newText: edit.newText,
                            verdict: editResult.verdict,
                            legalFlags: editResult.legalFlags,
                            policyFlags: editResult.policyFlags,
                          });
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Minimap */}
        <div
          className="w-3 flex-shrink-0 bg-[var(--bg-surface)] border-y border-r border-[var(--border)] relative cursor-pointer"
          style={{ height: "700px", maxHeight: "700px" }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientY - rect.top) / rect.height;
            const targetLine = Math.round(ratio * lines.length) + 1;
            // Find nearest flagged line
            let nearest = flaggedLineNumbers[0];
            let minDist = Infinity;
            for (const ln of flaggedLineNumbers) {
              const dist = Math.abs(ln - targetLine);
              if (dist < minDist) { minDist = dist; nearest = ln; }
            }
            if (nearest) {
              const idx = flaggedLineNumbers.indexOf(nearest);
              setCurrentFlagIndex(idx);
              setSelectedLine(nearest);
            }
          }}
        >
          {/* Flag ticks */}
          {flaggedLineNumbers.map((ln) => (
            <div
              key={ln}
              className="absolute left-0 w-full h-[3px]"
              style={{
                top: `${((ln - 1) / Math.max(1, lines.length - 1)) * 100}%`,
                background: tickColor(ln),
              }}
            />
          ))}
          {/* Viewport indicator */}
          <div
            className="absolute left-0 w-full border border-[var(--text-dim)] opacity-30"
            style={{
              top: `${scrollRatio * (1 - viewportHeight) * 100}%`,
              height: `${viewportHeight * 100}%`,
              background: "var(--text-dim)",
            }}
          />
        </div>
      </div>

      {/* Legend + Navigation — hidden on mobile */}
      <div className="w-48 flex-shrink-0 hidden md:block">
        <div className="border border-[var(--border)] bg-[var(--bg-surface)] p-3 sticky top-4">
          {/* Flag navigation */}
          {flaggedLineNumbers.length > 0 && (
            <div className="mb-3 pb-3 border-b border-[var(--border)]">
              <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-2">Navigate Flags</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={goPrev}
                  disabled={currentFlagIndex <= 0}
                  className="text-[10px] px-2 py-1 border border-[var(--border)] hover:bg-[var(--bg-elevated)] disabled:opacity-30"
                >
                  Prev
                </button>
                <span className="text-[10px] text-[var(--text-bright)] tabular-nums">
                  {flaggedLineNumbers.length > 0 ? currentFlagIndex + 1 : 0}/{flaggedLineNumbers.length}
                </span>
                <button
                  onClick={goNext}
                  disabled={currentFlagIndex >= flaggedLineNumbers.length - 1}
                  className="text-[10px] px-2 py-1 border border-[var(--border)] hover:bg-[var(--bg-elevated)] disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-3">Legend</div>
          <div className="space-y-2 text-[10px]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 flex-shrink-0" style={{ background: "rgba(239, 68, 68, 0.12)" }} />
              <span>Legal Flag</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 flex-shrink-0" style={{ background: "rgba(234, 179, 8, 0.12)" }} />
              <span>Policy Flag</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 flex-shrink-0" style={{ background: "rgba(239, 68, 68, 0.2)" }} />
              <span>Both</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 flex-shrink-0" style={{ background: "rgba(34, 197, 94, 0.12)" }} />
              <span>Edited</span>
            </div>
          </div>
          <div className="border-t border-[var(--border)] mt-3 pt-3 text-[10px] text-[var(--text-dim)]">
            <p className="mb-1">Click a highlighted line to see flag details.</p>
            <p>Use &quot;Suggest Edit&quot; to test changes against the AI.</p>
          </div>

          {/* Keyboard shortcuts */}
          <div className="border-t border-[var(--border)] mt-3 pt-3">
            <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-2">Shortcuts</div>
            <div className="text-[10px] text-[var(--text-dim)] space-y-1">
              <div><kbd className="px-1 border border-[var(--border)] text-[9px]">j</kbd> / <kbd className="px-1 border border-[var(--border)] text-[9px]">k</kbd> — next / prev flag</div>
              <div><kbd className="px-1 border border-[var(--border)] text-[9px]">e</kbd> — edit selected line</div>
              <div><kbd className="px-1 border border-[var(--border)] text-[9px]">Esc</kbd> — close / deselect</div>
            </div>
          </div>

          {/* Session edits */}
          {edits.length > 0 && (
            <div className="border-t border-[var(--border)] mt-3 pt-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">
                  Edits ({edits.length})
                </div>
                <button
                  onClick={() => setShowEdits(!showEdits)}
                  className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text)] uppercase"
                >
                  {showEdits ? "Hide" : "Show"}
                </button>
              </div>
              {showEdits && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {edits.map((edit) => (
                    <div key={edit.lineNumber} className="text-[10px] border border-[var(--border)] p-1.5">
                      <div className="flex items-center gap-1.5 text-[var(--text-dim)] mb-1">
                        {edit.avatarUrl ? (
                          <img src={edit.avatarUrl} alt="" className="w-3.5 h-3.5 rounded-full" />
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full bg-[var(--border)] inline-block" />
                        )}
                        <span>{edit.displayName ?? "Unknown"}</span>
                        <span className="ml-auto">L{edit.lineNumber}</span>
                      </div>
                      <div className="text-[var(--red)]">- {edit.originalText.slice(0, 60)}{edit.originalText.length > 60 ? "..." : ""}</div>
                      <div className="text-[var(--green)]">+ {edit.newText.slice(0, 60)}{edit.newText.length > 60 ? "..." : ""}</div>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => {
                  const text = edits.map((e) => `Line ${e.lineNumber}:\n- ${e.originalText}\n+ ${e.newText}`).join("\n\n");
                  navigator.clipboard.writeText(text);
                }}
                className="text-[10px] uppercase tracking-wider mt-2 px-2 py-1 border border-[var(--border)] hover:bg-[var(--bg-elevated)] text-[var(--text-dim)] w-full text-center"
              >
                Copy All Edits
              </button>
            </div>
          )}

          <div className="border-t border-[var(--border)] mt-3 pt-3">
            <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-2">Stats</div>
            <div className="text-[10px] space-y-1">
              <div className="flex justify-between">
                <span className="text-[var(--red)]">Legal flags</span>
                <span>{legalFlags.filter((f) => f.line).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--yellow)]">Policy flags</span>
                <span>{policyFlags.filter((f) => f.line).length}</span>
              </div>
              <div className="flex justify-between">
                <span>Flagged lines</span>
                <span>{visibleLineFlags.size}</span>
              </div>
              <div className="flex justify-between">
                <span>Total lines</span>
                <span>{lines.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
