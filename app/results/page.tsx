"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { SynthesisReport, LegalFlag, PolicyFlag } from "@/lib/pipeline/types";
import AnnotatedScriptView from "./components/AnnotatedScriptView";

interface ReviewData {
  id: string;
  createdAt: string;
  scriptTitle: string | null;
  scriptText: string;
  sourceUrl: string | null;
  caseState: string;
  caseStatus: string;
  hasMinors: boolean;
  synthesis: SynthesisReport | null;
  legalFlags: LegalFlag[] | null;
  legalCrossValidation: {
    claude: LegalFlag[];
    gpt: LegalFlag[];
    perplexity: LegalFlag[];
  } | null;
  youtubeFlags: PolicyFlag[] | null;
  parsedEntities: Record<string, unknown> | null;
  researchData: Record<string, unknown> | null;
}

function verdictColor(v: string) {
  if (v === "publishable") return "var(--green)";
  if (v === "borderline") return "var(--yellow)";
  return "var(--red)";
}

function riskColor(r: string) {
  if (r === "low" || r === "full_ads") return "var(--green)";
  if (r === "medium" || r === "limited_ads") return "var(--yellow)";
  return "var(--red)";
}

function sevColor(s: string) {
  if (s === "low") return "var(--green)";
  if (s === "medium") return "var(--yellow)";
  if (s === "high") return "var(--amber)";
  return "var(--red)";
}

function formatReportText(data: ReviewData): string {
  const report = data.synthesis;
  const lines: string[] = [];
  lines.push("═══════════════════════════════════════");
  lines.push("SCRIPT SHIELD — ANALYSIS REPORT");
  lines.push("═══════════════════════════════════════");
  lines.push(`State: ${data.caseState} | Status: ${data.caseStatus.toUpperCase()}`);
  lines.push(`Date: ${new Date(data.createdAt).toLocaleString()}`);
  lines.push("");

  if (report) {
    lines.push(`VERDICT: ${report.verdict.replaceAll("_", " ").toUpperCase()}`);
    lines.push(`RISK SCORE: ${report.riskScore}/100`);
    lines.push("");
    lines.push(report.summary);
    lines.push("");

    if (report.riskDashboard) {
      lines.push("── RISK DASHBOARD ──");
      for (const [key, val] of Object.entries(report.riskDashboard)) {
        lines.push(`  ${key.replace(/([A-Z])/g, " $1").trim()}: ${val.replaceAll("_", " ").toUpperCase()}`);
      }
      lines.push("");
    }

    if (report.criticalEdits?.length > 0) {
      lines.push("── CRITICAL EDITS ──");
      for (const edit of report.criticalEdits) {
        lines.push(`  ${edit.line ? `Line ${edit.line} — ` : ""}${edit.reason}`);
        lines.push(`  ORIGINAL: ${edit.original}`);
        lines.push(`  SUGGESTED: ${edit.suggested}`);
        lines.push("");
      }
    }

    if (report.recommendedEdits?.length > 0) {
      lines.push("── RECOMMENDED EDITS ──");
      for (const edit of report.recommendedEdits) {
        lines.push(`  ${edit.line ? `Line ${edit.line} — ` : ""}${edit.reason}`);
        lines.push(`  ORIGINAL: ${edit.original}`);
        lines.push(`  SUGGESTED: ${edit.suggested}`);
        lines.push("");
      }
    }

    if (report.legalFlags?.length > 0) {
      lines.push("── LEGAL FLAGS ──");
      for (const flag of report.legalFlags) {
        lines.push(`  [${flag.severity.toUpperCase()}] ${flag.riskType.replaceAll("_", " ")} — ${flag.person}`);
        lines.push(`  "${flag.text}"`);
        lines.push(`  ${flag.reasoning}`);
        if (flag.stateCitation) lines.push(`  Citation: ${flag.stateCitation}`);
        lines.push(`  Safer: ${flag.saferRewrite}`);
        if (flag.counselReview) lines.push(`  ⚠ COUNSEL REVIEW REQUIRED`);
        lines.push("");
      }
    }

    if (report.policyFlags?.length > 0) {
      lines.push("── YOUTUBE POLICY FLAGS ──");
      for (const flag of report.policyFlags) {
        lines.push(`  [${flag.severity.toUpperCase()}] ${flag.category.replaceAll("_", " ")} — ${flag.impact.replaceAll("_", " ")}`);
        lines.push(`  "${flag.text}"`);
        lines.push(`  ${flag.reasoning}`);
        if (flag.policyQuote) lines.push(`  Policy: ${flag.policyQuote}`);
        if (flag.saferRewrite) lines.push(`  Safer: ${flag.saferRewrite}`);
        lines.push("");
      }
    }

    if (report.edsaChecklist?.length > 0) {
      lines.push("── EDSA CHECKLIST ──");
      for (const item of report.edsaChecklist) {
        const icon = item.status === "present" ? "[✓]" : item.status === "partial" ? "[~]" : "[✗]";
        lines.push(`  ${icon} ${item.item}${item.note ? ` — ${item.note}` : ""}`);
      }
    }
  }

  return lines.join("\n");
}

type TabKey = "overview" | "script" | "legal" | "youtube" | "research" | "raw";

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [copied, setCopied] = useState<"report" | "link" | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/reviews/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (!id) return <div className="p-8 text-[var(--text-dim)]">No review ID</div>;
  if (loading) return <div className="p-8 text-[var(--text-dim)]">LOADING...</div>;
  if (!data) return <div className="p-8 text-[var(--red)]">Review not found</div>;

  const report = data.synthesis;
  const allLegalFlags = report?.legalFlags ?? data.legalFlags ?? [];
  const allPolicyFlags = report?.policyFlags ?? data.youtubeFlags ?? [];

  return (
    <div className="min-h-screen p-4 max-w-6xl mx-auto">
      {/* Header */}
      <header className="border-b border-[var(--border)] pb-4 mb-6 flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-[var(--green)]" />
            <h1 className="text-lg tracking-widest text-[var(--text-bright)] uppercase">
              Analysis Report
            </h1>
          </div>
          <p className="text-xs text-[var(--text-dim)] mt-1">
            {data.caseState} // {data.caseStatus.toUpperCase()} // {new Date(data.createdAt).toLocaleString()}
            {data.sourceUrl && data.sourceUrl.startsWith("https://") && (
              <span className="ml-2 text-[var(--text-dim)]">
                // <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--text)]">Google Doc</a>
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(formatReportText(data));
              setCopied("report");
              setTimeout(() => setCopied(null), 2000);
            }}
            className="text-xs uppercase tracking-wider border border-[var(--border)] px-4 py-2 hover:bg-[var(--bg-elevated)]"
          >
            {copied === "report" ? "COPIED" : "Copy Report"}
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              setCopied("link");
              setTimeout(() => setCopied(null), 2000);
            }}
            className="text-xs uppercase tracking-wider border border-[var(--border)] px-4 py-2 hover:bg-[var(--bg-elevated)]"
          >
            {copied === "link" ? "COPIED" : "Copy Link"}
          </button>
          <button
            onClick={() => router.push("/")}
            className="text-xs uppercase tracking-wider border border-[var(--border)] px-4 py-2 hover:bg-[var(--bg-elevated)]"
          >
            New Analysis
          </button>
        </div>
      </header>

      {/* Verdict Banner */}
      {report && (
        <div
          className="border p-4 mb-6"
          style={{ borderColor: verdictColor(report.verdict) }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3"
                style={{ background: verdictColor(report.verdict) }}
              />
              <span
                className="text-xl tracking-widest uppercase font-bold"
                style={{ color: verdictColor(report.verdict) }}
              >
                {report.verdict.replaceAll("_", " ")}
              </span>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-[var(--text-bright)]">
                {report.riskScore}
              </div>
              <div className="text-[10px] text-[var(--text-dim)] uppercase">Risk Score</div>
            </div>
          </div>
          <p className="text-sm mt-3 text-[var(--text)]">{report.summary}</p>
        </div>
      )}

      {/* Risk Dashboard */}
      {report?.riskDashboard && (
        <div className="grid grid-cols-5 gap-2 mb-6">
          {Object.entries(report.riskDashboard).map(([key, val]) => (
            <div key={key} className="border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-center">
              <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-2">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </div>
              <div
                className="text-sm uppercase font-bold"
                style={{ color: riskColor(val) }}
              >
                {val.replaceAll("_", " ")}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[var(--border)] mb-4">
        {(["overview", "script", "legal", "youtube", "research", "raw"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === tab
                ? "border-[var(--text-bright)] text-[var(--text-bright)]"
                : "border-transparent text-[var(--text-dim)] hover:text-[var(--text)]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === "overview" && report && (
          <div className="space-y-6">
            {report.criticalEdits?.length > 0 && (
              <section>
                <h3 className="text-xs uppercase tracking-wider text-[var(--red)] mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-[var(--red)]" /> Critical Edits Required
                </h3>
                <div className="space-y-2">
                  {report.criticalEdits.map((edit, i) => (
                    <div key={i} className="border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                      <div className="text-xs text-[var(--red)] mb-1">
                        {edit.line ? `Line ${edit.line} — ` : ""}{edit.reason}
                      </div>
                      <div className="text-xs text-[var(--text-dim)] line-through mb-1">{edit.original}</div>
                      <div className="text-xs text-[var(--green)]">{edit.suggested}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {report.recommendedEdits?.length > 0 && (
              <section>
                <h3 className="text-xs uppercase tracking-wider text-[var(--yellow)] mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-[var(--yellow)]" /> Recommended Edits
                </h3>
                <div className="space-y-2">
                  {report.recommendedEdits.map((edit, i) => (
                    <div key={i} className="border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                      <div className="text-xs text-[var(--yellow)] mb-1">
                        {edit.line ? `Line ${edit.line} — ` : ""}{edit.reason}
                      </div>
                      <div className="text-xs text-[var(--text-dim)] line-through mb-1">{edit.original}</div>
                      <div className="text-xs text-[var(--green)]">{edit.suggested}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {report.edsaChecklist?.length > 0 && (
              <section>
                <h3 className="text-xs uppercase tracking-wider text-[var(--text-dim)] mb-3">
                  EDSA Context Checklist
                </h3>
                <div className="space-y-1">
                  {report.edsaChecklist.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span
                        className="w-2 h-2 flex-shrink-0"
                        style={{
                          background:
                            item.status === "present" ? "var(--green)" :
                            item.status === "partial" ? "var(--yellow)" : "var(--red)",
                        }}
                      />
                      <span>{item.item}</span>
                      {item.note && (
                        <span className="text-[var(--text-dim)]">— {item.note}</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === "script" && data.scriptText && (
          <AnnotatedScriptView
            scriptText={data.scriptText}
            legalFlags={allLegalFlags}
            policyFlags={allPolicyFlags}
            state={data.caseState}
            caseStatus={data.caseStatus}
            hasMinors={data.hasMinors}
          />
        )}

        {activeTab === "legal" && (
          <div className="space-y-2">
            {/* Cross-validation summary */}
            {data.legalCrossValidation && (
              <div className="border border-[var(--border)] bg-[var(--bg-surface)] p-3 mb-4">
                <div className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-2">
                  Cross-Validation Summary (3-Model)
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <span className="text-[var(--text-dim)]">Claude: </span>
                    <span className="text-[var(--text-bright)]">{data.legalCrossValidation.claude.length} flags</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-dim)]">GPT: </span>
                    <span className="text-[var(--text-bright)]">{data.legalCrossValidation.gpt.length} flags</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-dim)]">Perplexity: </span>
                    <span className="text-[var(--text-bright)]">{data.legalCrossValidation.perplexity.length} flags</span>
                  </div>
                </div>
              </div>
            )}

            {allLegalFlags.length === 0 ? (
              <p className="text-xs text-[var(--text-dim)]">No legal flags identified.</p>
            ) : (
              allLegalFlags.map((flag: LegalFlag, i: number) => {
                const isCrossValidated = "agreementCount" in flag;
                const cv = isCrossValidated ? (flag as unknown as {
                  agreementCount: number;
                  models: string[];
                  originalSeverities: Record<string, string>;
                }) : null;

                return (
                  <div key={i} className="border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="w-2 h-2" style={{ background: sevColor(flag.severity) }} />
                      <span className="text-xs uppercase" style={{ color: sevColor(flag.severity) }}>
                        {flag.severity}
                      </span>
                      <span className="text-[10px] text-[var(--text-dim)] uppercase">
                        {flag.riskType.replaceAll("_", " ")}
                      </span>
                      <span className="text-[10px] text-[var(--text-dim)]">
                        — {flag.person}
                      </span>
                      {flag.line && (
                        <span className="text-[10px] text-[var(--text-dim)] border border-[var(--border)] px-1">
                          L{flag.line}
                        </span>
                      )}
                      {flag.counselReview && (
                        <span className="text-[10px] text-[var(--red)] border border-[var(--red)] px-1">
                          COUNSEL
                        </span>
                      )}
                      {cv && (
                        <span
                          className="text-[10px] border px-1"
                          style={{
                            color: cv.agreementCount >= 3 ? "var(--red)" : cv.agreementCount >= 2 ? "var(--yellow)" : "var(--text-dim)",
                            borderColor: cv.agreementCount >= 3 ? "var(--red)" : cv.agreementCount >= 2 ? "var(--yellow)" : "var(--border)",
                          }}
                        >
                          {cv.agreementCount}/3 MODELS
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text)] mb-1">&quot;{flag.text}&quot;</div>
                    <div className="text-xs text-[var(--text-dim)] mb-1 whitespace-pre-wrap">{flag.reasoning}</div>
                    {flag.stateCitation && (
                      <div className="text-[10px] text-[var(--text-dim)]">Cite: {flag.stateCitation}</div>
                    )}
                    <div className="text-xs text-[var(--green)] mt-1">Safer: {flag.saferRewrite}</div>
                    {cv && (
                      <div className="mt-2 pt-2 border-t border-[var(--border)]">
                        <div className="text-[10px] text-[var(--text-dim)] uppercase mb-1">Per-Model Severity</div>
                        <div className="flex gap-3 text-[10px]">
                          {cv.models.map((m) => (
                            <span key={m}>
                              <span className="text-[var(--text-dim)]">{m}: </span>
                              <span style={{ color: sevColor(cv.originalSeverities[m]) }}>
                                {cv.originalSeverities[m]}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "youtube" && (
          <div className="space-y-2">
            {allPolicyFlags.length === 0 ? (
              <p className="text-xs text-[var(--text-dim)]">No YouTube policy flags identified.</p>
            ) : (
              allPolicyFlags.map((flag: PolicyFlag, i: number) => (
                <div key={i} className="border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="w-2 h-2" style={{ background: sevColor(flag.severity) }} />
                    <span className="text-xs uppercase" style={{ color: sevColor(flag.severity) }}>
                      {flag.severity}
                    </span>
                    <span className="text-[10px] text-[var(--text-dim)] uppercase">
                      {flag.category.replace(/_/g, " ")}
                    </span>
                    {flag.line && (
                      <span className="text-[10px] text-[var(--text-dim)] border border-[var(--border)] px-1">
                        L{flag.line}
                      </span>
                    )}
                    <span
                      className="text-[10px] uppercase px-1 border"
                      style={{
                        color: riskColor(flag.impact),
                        borderColor: riskColor(flag.impact),
                      }}
                    >
                      {flag.impact.replaceAll("_", " ")}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text)] mb-1">&quot;{flag.text}&quot;</div>
                  <div className="text-xs text-[var(--text-dim)] mb-1">{flag.reasoning}</div>
                  {flag.policyQuote && (
                    <div className="text-[10px] text-[var(--text-dim)] italic">Policy: {flag.policyQuote}</div>
                  )}
                  {flag.saferRewrite && (
                    <div className="text-xs text-[var(--green)] mt-1">Safer: {flag.saferRewrite}</div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "research" && (
          <div className="space-y-4">
            {data.researchData ? (
              <pre className="text-xs text-[var(--text)] bg-[var(--bg-surface)] border border-[var(--border)] p-4 overflow-auto max-h-[600px] whitespace-pre-wrap">
                {JSON.stringify(data.researchData, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-[var(--text-dim)]">No research data available.</p>
            )}
          </div>
        )}

        {activeTab === "raw" && (
          <pre className="text-xs text-[var(--text)] bg-[var(--bg-surface)] border border-[var(--border)] p-4 overflow-auto max-h-[600px] whitespace-pre-wrap">
            {JSON.stringify(
              { synthesis: data.synthesis, legalFlags: data.legalFlags, legalCrossValidation: data.legalCrossValidation, youtubeFlags: data.youtubeFlags, parsedEntities: data.parsedEntities, researchData: data.researchData },
              null,
              2
            )}
          </pre>
        )}
      </div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[var(--text-dim)]">LOADING...</div>}>
      <ResultsContent />
    </Suspense>
  );
}
