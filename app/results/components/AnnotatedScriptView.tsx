"use client";

import { useState, useRef, useEffect } from "react";
import type { LegalFlag, PolicyFlag } from "@/lib/pipeline/types";

interface LineEditFormProps {
  lineNumber: number;
  originalText: string;
  scriptText: string;
  state: string;
  caseStatus: string;
  hasMinors: boolean;
  onClose: () => void;
}

function LineEditForm({
  lineNumber,
  originalText,
  scriptText,
  state,
  caseStatus,
  hasMinors,
  onClose,
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
        </div>
      )}
    </div>
  );
}

interface FlagDetail {
  type: "legal" | "policy";
  flag: LegalFlag | PolicyFlag;
}

interface Props {
  scriptText: string;
  legalFlags: LegalFlag[];
  policyFlags: PolicyFlag[];
  state: string;
  caseStatus: string;
  hasMinors: boolean;
}

export default function AnnotatedScriptView({
  scriptText,
  legalFlags,
  policyFlags,
  state,
  caseStatus,
  hasMinors,
}: Props) {
  const lines = scriptText.split("\n");
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [editingLine, setEditingLine] = useState<number | null>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Build line -> flags map
  const lineFlags = new Map<number, FlagDetail[]>();
  for (const flag of legalFlags) {
    if (flag.line) {
      const existing = lineFlags.get(flag.line) ?? [];
      existing.push({ type: "legal", flag });
      lineFlags.set(flag.line, existing);
    }
  }
  for (const flag of policyFlags) {
    if (flag.line) {
      const existing = lineFlags.get(flag.line) ?? [];
      existing.push({ type: "policy", flag });
      lineFlags.set(flag.line, existing);
    }
  }

  useEffect(() => {
    if (selectedLine && selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedLine]);

  return (
    <div className="flex gap-4">
      {/* Script Column */}
      <div className="flex-1 overflow-auto max-h-[700px] border border-[var(--border)] bg-[var(--bg-surface)]">
        {lines.map((line, i) => {
          const lineNum = i + 1;
          const flags = lineFlags.get(lineNum);
          const hasLegal = flags?.some((f) => f.type === "legal");
          const hasPolicy = flags?.some((f) => f.type === "policy");
          const isSelected = selectedLine === lineNum;

          let bgColor = "transparent";
          if (hasLegal && hasPolicy) bgColor = "rgba(239, 68, 68, 0.2)";
          else if (hasLegal) bgColor = "rgba(239, 68, 68, 0.12)";
          else if (hasPolicy) bgColor = "rgba(234, 179, 8, 0.12)";

          return (
            <div key={lineNum}>
              <div
                ref={isSelected ? selectedRef : undefined}
                onClick={() => flags && setSelectedLine(isSelected ? null : lineNum)}
                className={`flex text-xs leading-6 ${flags ? "cursor-pointer hover:brightness-110" : ""} ${
                  isSelected ? "ring-1 ring-[var(--text-dim)]" : ""
                }`}
                style={{ background: bgColor }}
              >
                {/* Line number gutter */}
                <div className="w-10 flex-shrink-0 text-right pr-2 text-[var(--text-dim)] select-none border-r border-[var(--border)] relative">
                  {lineNum}
                  {flags && (
                    <div className="absolute right-[-3px] top-[9px] flex flex-col gap-0.5">
                      {hasLegal && <div className="w-1.5 h-1.5 bg-[var(--red)]" />}
                      {hasPolicy && <div className="w-1.5 h-1.5 bg-[var(--yellow)]" />}
                    </div>
                  )}
                </div>
                {/* Line content */}
                <div className="pl-3 pr-2 whitespace-pre-wrap break-all flex-1">
                  {line || "\u00A0"}
                </div>
              </div>

              {/* Inline flag details */}
              {isSelected && flags && (
                <div className="border-l-2 border-[var(--text-dim)] ml-10 pl-3 py-2 bg-[var(--bg-elevated)]">
                  {flags.map((fd, fi) => {
                    const f = fd.flag;
                    if (fd.type === "legal") {
                      const lf = f as LegalFlag;
                      return (
                        <div key={fi} className="mb-2 last:mb-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-1.5 h-1.5 bg-[var(--red)]" />
                            <span className="text-[10px] uppercase text-[var(--red)]">
                              {lf.severity} — {lf.riskType.replaceAll("_", " ")}
                            </span>
                            <span className="text-[10px] text-[var(--text-dim)]">
                              — {lf.person}
                            </span>
                            {lf.counselReview && (
                              <span className="text-[10px] text-[var(--red)] border border-[var(--red)] px-1">
                                COUNSEL
                              </span>
                            )}
                            {"agreementCount" in lf && (
                              <span className="text-[10px] text-[var(--text-dim)] border border-[var(--border)] px-1">
                                {(lf as unknown as { agreementCount: number }).agreementCount}/3
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[var(--text-dim)]">{lf.reasoning}</p>
                          {lf.stateCitation && (
                            <p className="text-[10px] text-[var(--text-dim)] mt-0.5">Cite: {lf.stateCitation}</p>
                          )}
                          <p className="text-[10px] text-[var(--green)] mt-0.5">Safer: {lf.saferRewrite}</p>
                        </div>
                      );
                    } else {
                      const pf = f as PolicyFlag;
                      return (
                        <div key={fi} className="mb-2 last:mb-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-1.5 h-1.5 bg-[var(--yellow)]" />
                            <span className="text-[10px] uppercase text-[var(--yellow)]">
                              {pf.severity} — {pf.category.replaceAll("_", " ")}
                            </span>
                            <span
                              className="text-[10px] uppercase px-1 border"
                              style={{ color: pf.impact === "full_ads" ? "var(--green)" : pf.impact === "limited_ads" ? "var(--yellow)" : "var(--red)", borderColor: pf.impact === "full_ads" ? "var(--green)" : pf.impact === "limited_ads" ? "var(--yellow)" : "var(--red)" }}
                            >
                              {pf.impact.replaceAll("_", " ")}
                            </span>
                          </div>
                          <p className="text-[10px] text-[var(--text-dim)]">{pf.reasoning}</p>
                          {pf.policyQuote && (
                            <p className="text-[10px] text-[var(--text-dim)] italic mt-0.5">Policy: {pf.policyQuote}</p>
                          )}
                          {pf.saferRewrite && (
                            <p className="text-[10px] text-[var(--green)] mt-0.5">Safer: {pf.saferRewrite}</p>
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
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="w-48 flex-shrink-0">
        <div className="border border-[var(--border)] bg-[var(--bg-surface)] p-3 sticky top-4">
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
          </div>
          <div className="border-t border-[var(--border)] mt-3 pt-3 text-[10px] text-[var(--text-dim)]">
            <p className="mb-1">Click a highlighted line to see flag details.</p>
            <p>Use "Suggest Edit" to test changes against the AI.</p>
          </div>
          <div className="border-t border-[var(--border)] mt-3 pt-3">
            <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-2">Stats</div>
            <div className="text-[10px] space-y-1">
              <div className="flex justify-between">
                <span className="text-[var(--red)]">Legal flags</span>
                <span>{legalFlags.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--yellow)]">Policy flags</span>
                <span>{policyFlags.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Flagged lines</span>
                <span>{lineFlags.size}</span>
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
