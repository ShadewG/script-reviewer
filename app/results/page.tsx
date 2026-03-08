"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { SynthesisReport, LegalFlag, PolicyFlag } from "@/lib/pipeline/types";
import type { DocumentFacts } from "@/lib/documents/types";
import AnnotatedScriptView from "./components/AnnotatedScriptView";
import type { VideoFrameFinding } from "@/lib/pipeline/types";
import { YT_POLICIES } from "@/lib/policies/youtube-policies";
import { useTheme } from "@/lib/theme";
import { useOnboarding, OnboardingOverlay } from "@/lib/onboarding";
import { useDismissedFlags, flagKey, DISMISS_REASONS, type DismissReason } from "@/lib/dismissed-flags";
import { useKeyboardNav, KeyboardHelpOverlay } from "@/lib/keyboard-nav";
import { generateDisclaimers } from "@/lib/disclaimer-generator";
import GlossaryTerm from "@/components/GlossaryTerm";
import { findGlossaryTerms } from "@/lib/legal-glossary";

/* ── Label formatting ── */
function formatLabel(s: string): string {
  return s
    .replace(/^(legal|policy):/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ── Smart text excerpt ── */
function smartExcerpt(text: string, maxLen: number, targetLine?: number): string {
  if (text.length <= maxLen) return text;
  if (targetLine != null) {
    const lines = text.split("\n");
    const idx = Math.max(0, targetLine - 1);
    if (idx < lines.length) {
      const targetText = lines[idx];
      const pos = text.indexOf(targetText);
      if (pos >= 0) {
        const start = Math.max(0, pos - 40);
        const end = Math.min(text.length, pos + targetText.length + 40);
        const excerpt = text.slice(start, end);
        return (start > 0 ? "..." : "") + excerpt.slice(0, maxLen - 6) + (end < text.length ? "..." : "");
      }
    }
  }
  return text.slice(0, maxLen - 1) + "\u2026";
}

function bestFlagExcerpt(flagTexts: string[], maxLen: number): string | null {
  const candidates = flagTexts
    .map((text) => text.trim())
    .filter(Boolean)
    .sort((a, b) => a.length - b.length);

  if (candidates.length === 0) return null;
  return smartExcerpt(candidates[0], maxLen);
}

/* ── Severity utilities ── */
type Severity = "low" | "medium" | "high" | "severe";
const SEV_ORDER: Record<string, number> = { low: 0, medium: 1, high: 2, severe: 3 };
function compareSeverity(a: string, b: string) {
  return (SEV_ORDER[b] ?? 0) - (SEV_ORDER[a] ?? 0);
}
function meetsMinSeverity(sev: string, min: Severity): boolean {
  return (SEV_ORDER[sev] ?? 0) >= (SEV_ORDER[min] ?? 0);
}

/* ── Loading Skeleton ── */
function LoadingSkeleton() {
  const pulse = "animate-pulse bg-[var(--bg-surface)] rounded";
  return (
    <div className="min-h-screen p-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="border-b border-[var(--border)] pb-4 mb-6 flex justify-between items-center">
        <div>
          <div className={`h-5 w-40 ${pulse} mb-2`} />
          <div className={`h-3 w-64 ${pulse}`} />
        </div>
        <div className="flex gap-2">
          <div className={`h-9 w-24 ${pulse}`} />
          <div className={`h-9 w-24 ${pulse}`} />
        </div>
      </div>
      {/* Verdict banner */}
      <div className={`h-28 w-full ${pulse} mb-6`} />
      {/* Risk dashboard */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`h-16 ${pulse}`} />
        ))}
      </div>
      {/* Tabs */}
      <div className="flex gap-4 mb-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className={`h-8 w-16 ${pulse}`} />
        ))}
      </div>
      {/* Content cards */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`h-20 w-full ${pulse}`} />
        ))}
      </div>
    </div>
  );
}

interface FactCheckFinding {
  line?: number;
  claim: string;
  verdict: "supported" | "contradicted" | "unclear" | "needs_external_verification";
  confidence: number;
  basis: "documents" | "research" | "external";
  evidence: string;
  suggestedRewrite?: string;
}

interface StageLogEntry {
  id: string;
  stage: string;
  model: string | null;
  status: string;
  durationMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheHit: boolean;
  createdAt: string;
}

interface ReviewData {
  id: string;
  createdAt: string;
  scriptTitle: string | null;
  scriptText: string;
  sourceUrl: string | null;
  caseState: string;
  caseStatus: string;
  hasMinors: boolean;
  supplementalDocs: DocumentFacts[] | null;
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
  factCheckData: { summary: string; findings: FactCheckFinding[] } | null;
  analysisWarnings: string[] | null;
  status: string;
  error: string | null;
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

function getRiskyLines(
  scriptText: string,
  legalFlags: LegalFlag[],
  policyFlags: PolicyFlag[]
): Array<{ line: number; text: string; tags: string[] }> {
  const lines = scriptText.split("\n");
  const map = new Map<number, { tags: Set<string>; flagTexts: string[] }>();

  for (const flag of legalFlags) {
    if (!flag.line) continue;
    const entry = map.get(flag.line) ?? { tags: new Set<string>(), flagTexts: [] };
    entry.tags.add(`legal:${flag.riskType}`);
    if (flag.text) entry.flagTexts.push(flag.text);
    map.set(flag.line, entry);
  }
  for (const flag of policyFlags) {
    if (!flag.line) continue;
    const entry = map.get(flag.line) ?? { tags: new Set<string>(), flagTexts: [] };
    entry.tags.add(`policy:${flag.category}`);
    if (flag.text) entry.flagTexts.push(flag.text);
    map.set(flag.line, entry);
  }

  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([line, { tags, flagTexts }]) => {
      let text = lines[line - 1] ?? "";
      // For blank lines, show first flag text instead
      if (!text.trim() && flagTexts.length > 0) {
        text = flagTexts[0];
      }
      // Prefer the actual flagged excerpt if the source line is a giant transcript block.
      if (text.length > 200 && flagTexts.length > 0) {
        text = bestFlagExcerpt(flagTexts, 200) ?? text;
      } else if (text.length > 200) {
        text = smartExcerpt(text, 200, line);
      }
      return { line, text: text || "(blank line)", tags: [...tags] };
    });
}

function parseVideoSecond(tc: string): number {
  const m = tc.match(/^(\d\d):(\d\d):(\d\d)$/);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

const RISK_STOPWORDS = new Set([
  "the","a","an","and","or","to","of","in","on","for","with","from","by",
  "this","that","is","are","was","were","be","it","as","at","under",
  "content","video","frame","imagery","image","scene","policy","guidelines",
  "graphic","violence","disturbing","advertiser","friendly","true","crime",
  "exposure","personal","information","risk",
]);

function riskTokens(input: string): Set<string> {
  const out = new Set<string>();
  for (const raw of normalizeText(input).split(" ")) {
    const t = raw.trim();
    if (!t || t.length < 3 || RISK_STOPWORDS.has(t)) continue;
    out.add(t);
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union <= 0 ? 0 : inter / union;
}

function dedupeVideoTimeline(entries: VideoFrameFinding[]): VideoFrameFinding[] {
  const WINDOW_SECONDS = 30;
  const recentByCategory = new Map<
    string,
    Array<{ second: number; tokens: Set<string>; detected: string }>
  >();

  const sorted = [...entries].sort((a, b) => a.second - b.second);
  const deduped: VideoFrameFinding[] = [];

  for (const entry of sorted) {
    const keptRisks = (entry.risks ?? []).filter((risk) => {
      const category = risk.category;
      const detected = normalizeText(risk.detectedText ?? "");
      const tokens = riskTokens(
        `${risk.policyName} ${risk.reasoning} ${risk.detectedText ?? ""}`
      );
      const recent = recentByCategory.get(category) ?? [];

      for (const prev of recent) {
        if (Math.abs(entry.second - prev.second) > WINDOW_SECONDS) continue;
        const sameDetected =
          detected.length > 0 &&
          prev.detected.length > 0 &&
          (detected.includes(prev.detected) || prev.detected.includes(detected));
        const sim = jaccard(tokens, prev.tokens);
        if (sameDetected || sim >= 0.52) {
          return false;
        }
      }

      recent.push({ second: entry.second, tokens, detected });
      recentByCategory.set(
        category,
        recent.filter((r) => Math.abs(entry.second - r.second) <= WINDOW_SECONDS)
      );
      return true;
    });

    if (keptRisks.length === 0) continue;
    deduped.push({
      ...entry,
      risks: keptRisks,
    });
  }

  return deduped;
}

type VideoTimelineGroup = {
  item: VideoFrameFinding;
  signature: string;
  startSecond: number;
  endSecond: number;
  startTimecode: string;
  endTimecode: string;
  count: number;
};

function normalizeRiskText(input: string): string {
  return input
    .toLowerCase()
    .replace(/\b\d{2}:\d{2}:\d{2}\b/g, " ")
    .replace(/\b\d{1,4}[-/:]\d{1,4}[-/:]?\d{0,4}\b/g, " ")
    .replace(/\b[0-9a-f]{2,}\b/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toOverviewSignature(item: VideoFrameFinding): string {
  const risks = item.risks ?? [];
  const hasPrivacy = risks.some((r) => r.category === "privacy");
  const joined = normalizeRiskText(
    risks
      .map((r) => `${r.policyName} ${r.reasoning} ${r.detectedText ?? ""}`)
      .join(" ")
  );

  if (
    hasPrivacy &&
    /\b(ip address|meta platforms|device|fingerprint|agent string|login|account)\b/.test(joined)
  ) {
    return "privacy:ip_record_exposure";
  }
  if (hasPrivacy && /\b(phone|email|address|license plate|contact)\b/.test(joined)) {
    return "privacy:contact_or_address";
  }
  if (hasPrivacy && /\b(minor|child|daughter|son|grandchild|unblurred)\b/.test(joined)) {
    return "privacy:minor_identity";
  }

  const dominant = [...risks].sort((a, b) => (SEV_ORDER[b.severity] ?? 0) - (SEV_ORDER[a.severity] ?? 0))[0];
  if (!dominant) return "other:unknown";
  return `${dominant.category}:${normalizeRiskText(dominant.policyName).slice(0, 40)}`;
}

function groupOverviewVideoTimeline(entries: VideoFrameFinding[]): VideoTimelineGroup[] {
  const sorted = [...entries].sort((a, b) => a.second - b.second);
  const groups: VideoTimelineGroup[] = [];
  const WINDOW = 180;

  for (const item of sorted) {
    const signature = toOverviewSignature(item);
    const maxSev = item.risks.reduce(
      (worst, r) => ((SEV_ORDER[r.severity] ?? 0) > (SEV_ORDER[worst] ?? 0) ? r.severity : worst),
      "low"
    );
    const found = groups.find(
      (g) => g.signature === signature && item.second - g.endSecond <= WINDOW
    );

    if (!found) {
      groups.push({
        item,
        signature,
        startSecond: item.second,
        endSecond: item.second,
        startTimecode: item.timecode,
        endTimecode: item.timecode,
        count: 1,
      });
      continue;
    }

    found.endSecond = item.second;
    found.endTimecode = item.timecode;
    found.count += 1;

    const foundMax = found.item.risks.reduce(
      (worst, r) => ((SEV_ORDER[r.severity] ?? 0) > (SEV_ORDER[worst] ?? 0) ? r.severity : worst),
      "low"
    );
    if ((SEV_ORDER[maxSev] ?? 0) > (SEV_ORDER[foundMax] ?? 0)) {
      found.item = item;
    }
  }

  return groups.sort((a, b) => {
    const sevA = a.item.risks.reduce(
      (worst, r) => ((SEV_ORDER[r.severity] ?? 0) > (SEV_ORDER[worst] ?? 0) ? r.severity : worst),
      "low"
    );
    const sevB = b.item.risks.reduce(
      (worst, r) => ((SEV_ORDER[r.severity] ?? 0) > (SEV_ORDER[worst] ?? 0) ? r.severity : worst),
      "low"
    );
    const sevCmp = compareSeverity(sevA, sevB);
    if (sevCmp !== 0) return sevCmp;
    return a.startSecond - b.startSecond;
  });
}

function buildVideoTimeline(
  report: SynthesisReport | null,
  policyFlags: PolicyFlag[]
): VideoFrameFinding[] {
  const fromReport = report?.videoTimeline?.filter((v) => v.risks?.length > 0) ?? [];
  if (fromReport.length > 0) {
    return dedupeVideoTimeline(fromReport);
  }

  // Fallback for older reports: derive timeline events from policy flags containing [Video HH:MM:SS]
  const map = new Map<string, VideoFrameFinding>();
  for (const flag of policyFlags) {
    const text = String(flag.text ?? "");
    const m = text.match(/\[Video\s+(\d\d:\d\d:\d\d)\]/);
    if (!m) continue;
    const timecode = m[1];
    const second = parseVideoSecond(timecode);
    const existing = map.get(timecode) ?? {
      second,
      timecode,
      risks: [],
    };
    existing.risks.push({
      category:
        flag.category === "community_guidelines"
          ? "community_guidelines"
          : flag.category === "age_restriction"
          ? "age_restriction"
          : flag.category === "monetization"
          ? "monetization"
          : "privacy",
      severity: flag.severity,
      impact: flag.impact,
      policyName: flag.policyName,
      reasoning: flag.reasoning,
      detectedText: text,
    });
    map.set(timecode, existing);
  }

  return dedupeVideoTimeline([...map.values()]);
}

function normalizeLoose(input: string): string {
  return input
    .toLowerCase()
    .replace(/\[video\s+\d\d:\d\d:\d\d\]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeLegalFlagsForDisplay(flags: LegalFlag[]): LegalFlag[] {
  const out: LegalFlag[] = [];
  const seen = new Set<string>();
  for (const f of flags) {
    const key = `${f.line ?? "na"}|${f.riskType}|${f.person.toLowerCase()}|${normalizeLoose(f.text).slice(0, 120)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

function dedupePolicyFlagsForDisplay(flags: PolicyFlag[]): PolicyFlag[] {
  const out: PolicyFlag[] = [];
  const seen = new Set<string>();
  for (const f of flags) {
    const key = `${f.line ?? "na"}|${f.category}|${f.impact}|${normalizeLoose(f.text).slice(0, 120)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

type EditItem = { line?: number; original: string; suggested: string; reason: string };

function dedupeEditsForDisplay(edits: EditItem[]): EditItem[] {
  const out: EditItem[] = [];
  const seen = new Set<string>();
  for (const e of edits) {
    const key = `${e.line ?? "na"}|${normalizeLoose(e.original).slice(0, 80)}|${normalizeLoose(e.reason).slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

function extractVideoTimecode(text: string): string | null {
  const m = text.match(/\[Video\s+(\d\d:\d\d:\d\d)\]/i);
  return m ? m[1] : null;
}

function renderWithGlossary(text: string): React.ReactNode {
  const matches = findGlossaryTerms(text);
  if (matches.length === 0) return text;
  const seen = new Set<string>();
  const uniqueMatches = matches.filter((m) => {
    const key = m.term.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  for (const match of uniqueMatches) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <GlossaryTerm key={match.index} term={match.term}>
        {text.slice(match.index, match.index + match.length)}
      </GlossaryTerm>
    );
    lastIndex = match.index + match.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

type TabKey = "overview" | "video" | "script" | "legal" | "youtube" | "research" | "diagnostics" | "raw";

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [copied, setCopied] = useState<"report" | "link" | "disclaimer" | null>(null);
  const [expandedDocs, setExpandedDocs] = useState<Set<number>>(new Set());
  const [expandedVideoSet, setExpandedVideoSet] = useState<Set<number>>(new Set());
  const [minSeverity, setMinSeverity] = useState<Severity>("low");
  const [flagFilter, setFlagFilter] = useState<"all" | "legal" | "policy">("all");
  const [expandedYtFlags, setExpandedYtFlags] = useState<Set<string>>(new Set());
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const [dismissingKey, setDismissingKey] = useState<string | null>(null);
  const [showDisclaimers, setShowDisclaimers] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [resumeStages, setResumeStages] = useState<Array<{ stage: number; name: string; status: string; error?: string }>>([]);
  const [stageLogs, setStageLogs] = useState<StageLogEntry[]>([]);;
  const { theme, toggle: toggleTheme } = useTheme();
  const onboarding = useOnboarding("results");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/reviews/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
    fetch(`/api/reviews/${id}/logs`)
      .then((r) => r.ok ? r.json() : [])
      .then((logs) => setStageLogs(logs))
      .catch(() => {});
  }, [id]);

  const handleResume = useCallback(async () => {
    if (!id || resuming) return;
    setResuming(true);
    setResumeStages([
      { stage: 0, name: "SCRIPT PARSER", status: "pending" },
      { stage: 1, name: "LEGAL REVIEW", status: "pending" },
      { stage: 2, name: "YOUTUBE POLICY", status: "pending" },
      { stage: 3, name: "CASE RESEARCH", status: "pending" },
      { stage: 4, name: "SYNTHESIS", status: "pending" },
    ]);
    try {
      const res = await fetch(`/api/reviews/${id}/resume`, { method: "POST" });
      if (!res.ok) throw new Error("Resume failed");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "stage") {
              setResumeStages((prev) =>
                prev.map((s) =>
                  s.stage === evt.stage ? { ...s, status: evt.status, name: evt.name || s.name, error: evt.error } : s
                )
              );
            } else if (evt.type === "complete") {
              // Reload the review data
              const fresh = await fetch(`/api/reviews/${id}`);
              if (fresh.ok) setData(await fresh.json());
              setResumeStages([]);
              break;
            } else if (evt.type === "error") {
              setResumeStages((prev) => [...prev.slice(0, -1), { ...prev[prev.length - 1], status: "error", error: evt.error }]);
            }
          } catch {}
        }
      }
    } catch (err) {
      setResumeStages((prev) => [...prev.slice(0, -1), { ...prev[prev.length - 1], status: "error", error: err instanceof Error ? err.message : "Failed" }]);
    } finally {
      setResuming(false);
    }
  }, [id, resuming]);

  /* ── Dismissed flags ── */
  const { isDismissed, getDismissal, dismiss, restore, dismissedCount } = useDismissedFlags(id ?? "");

  /* ── Derived data (stable references via useMemo) ── */
  const report = data?.synthesis ?? null;
  const rawLegalFlags = useMemo(
    () => report?.legalFlags ?? data?.legalFlags ?? [],
    [report?.legalFlags, data?.legalFlags],
  );
  const rawPolicyFlags = useMemo(
    () => report?.policyFlags ?? data?.youtubeFlags ?? [],
    [report?.policyFlags, data?.youtubeFlags],
  );
  const allLegalFlags = useMemo(
    () => dedupeLegalFlagsForDisplay(rawLegalFlags),
    [rawLegalFlags],
  );
  const allPolicyFlags = useMemo(
    () => dedupePolicyFlagsForDisplay(rawPolicyFlags),
    [rawPolicyFlags],
  );
  const videoTimeline = useMemo(
    () => buildVideoTimeline(report, allPolicyFlags),
    [report, allPolicyFlags],
  );
  const riskyLines = useMemo(
    () => data ? getRiskyLines(data.scriptText, allLegalFlags, allPolicyFlags) : [],
    [data, allLegalFlags, allPolicyFlags],
  );

  /* ── Filtered + sorted (severe-first) data for tabs ── */
  const filteredLegalFlags = useMemo(
    () => allLegalFlags
      .filter((f) => meetsMinSeverity(f.severity, minSeverity))
      .sort((a, b) => compareSeverity(a.severity, b.severity)),
    [allLegalFlags, minSeverity],
  );
  const filteredPolicyFlags = useMemo(
    () => allPolicyFlags
      .filter((f) => meetsMinSeverity(f.severity, minSeverity))
      .sort((a, b) => compareSeverity(a.severity, b.severity)),
    [allPolicyFlags, minSeverity],
  );
  const filteredVideoTimeline = useMemo(
    () => videoTimeline.filter((v) => {
      const maxSev = v.risks.reduce((worst, r) =>
        (SEV_ORDER[r.severity] ?? 0) > (SEV_ORDER[worst] ?? 0) ? r.severity : worst, "low");
      return meetsMinSeverity(maxSev, minSeverity);
    }),
    [videoTimeline, minSeverity],
  );
  const groupedVideoTimeline = useMemo(
    () => groupOverviewVideoTimeline(filteredVideoTimeline),
    [filteredVideoTimeline]
  );
  const overviewVideoTimeline = useMemo(
    () => groupedVideoTimeline.slice(0, 12),
    [groupedVideoTimeline]
  );
  const overviewCriticalEdits = useMemo(
    () => dedupeEditsForDisplay(report?.criticalEdits ?? []),
    [report?.criticalEdits]
  );
  const overviewRecommendedEdits = useMemo(
    () => dedupeEditsForDisplay(report?.recommendedEdits ?? []),
    [report?.recommendedEdits]
  );
  const criticalEditsWithMoments = useMemo(
    () =>
      overviewCriticalEdits.map((edit) => {
        const tc =
          extractVideoTimecode(edit.original) ??
          extractVideoTimecode(edit.reason) ??
          extractVideoTimecode(edit.suggested);
        const moment = tc ? videoTimeline.find((v) => v.timecode === tc) : undefined;
        return { edit, moment };
      }),
    [overviewCriticalEdits, videoTimeline]
  );
  const recommendedEditsWithMoments = useMemo(
    () =>
      overviewRecommendedEdits.map((edit) => {
        const tc =
          extractVideoTimecode(edit.original) ??
          extractVideoTimecode(edit.reason) ??
          extractVideoTimecode(edit.suggested);
        const moment = tc ? videoTimeline.find((v) => v.timecode === tc) : undefined;
        return { edit, moment };
      }),
    [overviewRecommendedEdits, videoTimeline]
  );

  /* Tab badge counts */
  const tabCounts: Partial<Record<TabKey, number>> = useMemo(() => ({
    video: groupedVideoTimeline.length,
    legal: filteredLegalFlags.length,
    youtube: filteredPolicyFlags.length,
    script: allLegalFlags.length + allPolicyFlags.length,
  }), [groupedVideoTimeline.length, filteredLegalFlags.length, filteredPolicyFlags.length, allLegalFlags.length, allPolicyFlags.length]);

  /* Disclaimers */
  const disclaimers = useMemo(
    () => data ? generateDisclaimers(report, allLegalFlags, allPolicyFlags, data.hasMinors) : [],
    [data, report, allLegalFlags, allPolicyFlags]
  );

  /* Keyboard nav — item count depends on active tab */
  const navItemCount = useMemo(() => {
    if (activeTab === "legal") return filteredLegalFlags.length;
    if (activeTab === "youtube") return filteredPolicyFlags.length;
    if (activeTab === "video") return groupedVideoTimeline.length;
    return 0;
  }, [activeTab, filteredLegalFlags.length, filteredPolicyFlags.length, groupedVideoTimeline.length]);

  const {
    activeIndex: navActiveIndex,
    showHelp: navShowHelp,
    setShowHelp: setNavShowHelp,
    containerRef: navContainerRef,
  } = useKeyboardNav({
    itemCount: navItemCount,
    enabled: activeTab === "legal" || activeTab === "youtube" || activeTab === "video",
    onExpand: (idx) => {
      if (activeTab === "video") toggleVideoExpand(idx);
    },
    onDismiss: (idx) => {
      if (activeTab === "legal" && filteredLegalFlags[idx]) {
        const f = filteredLegalFlags[idx];
        const key = flagKey("legal", f.line, f.text);
        if (!isDismissed(key)) setDismissingKey(key);
      }
      if (activeTab === "youtube" && filteredPolicyFlags[idx]) {
        const f = filteredPolicyFlags[idx];
        const key = flagKey("policy", f.line, f.text);
        if (!isDismissed(key)) setDismissingKey(key);
      }
    },
  });

  /* Severity filter helpers */
  const hiddenCount =
    activeTab === "legal" ? allLegalFlags.length - filteredLegalFlags.length :
    activeTab === "youtube" ? allPolicyFlags.length - filteredPolicyFlags.length :
    activeTab === "video" ? videoTimeline.length - filteredVideoTimeline.length : 0;
  const showSeverityFilter = activeTab === "legal" || activeTab === "youtube" || activeTab === "video";

  /* Video expand/collapse helpers — clear when filter changes */
  useEffect(() => {
    setExpandedVideoSet(new Set());
  }, [minSeverity, groupedVideoTimeline.length]);

  const toggleVideoExpand = useCallback((idx: number) => {
    setExpandedVideoSet((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }, []);
  const expandAllVideo = useCallback(() => {
    setExpandedVideoSet(new Set(groupedVideoTimeline.map((_, i) => i)));
  }, [groupedVideoTimeline]);
  const collapseAllVideo = useCallback(() => {
    setExpandedVideoSet(new Set());
  }, []);

  /* YouTube policy reference */
  const triggeredPolicyNames = useMemo(() => {
    const names = new Set<string>();
    for (const f of allPolicyFlags) if (f.policyName) names.add(f.policyName);
    return names;
  }, [allPolicyFlags]);

  /* Risk score bar color */
  const riskBarColor = (score: number) => {
    if (score <= 30) return "var(--green)";
    if (score <= 60) return "var(--yellow)";
    if (score <= 80) return "var(--amber)";
    return "var(--red)";
  };

  if (!id) return <div className="p-8 text-[var(--text-dim)]">No review ID</div>;
  if (loading) return <LoadingSkeleton />;
  if (!data) return <div className="p-8 text-[var(--red)]">Review not found</div>;

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
        <div className="flex gap-2 flex-wrap justify-end" data-no-print>
          <button
            onClick={() => window.print()}
            className="text-xs uppercase tracking-wider border border-[var(--border)] px-3 py-2 hover:bg-[var(--bg-elevated)]"
          >
            Print / PDF
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(formatReportText(data));
              setCopied("report");
              setTimeout(() => setCopied(null), 2000);
            }}
            className="text-xs uppercase tracking-wider border border-[var(--border)] px-3 py-2 hover:bg-[var(--bg-elevated)]"
          >
            {copied === "report" ? "COPIED" : "Copy Report"}
          </button>
          <button
            onClick={() => router.push("/reviews")}
            className="text-xs uppercase tracking-wider border border-[var(--border)] px-3 py-2 hover:bg-[var(--bg-elevated)]"
          >
            History
          </button>
          <button
            onClick={toggleTheme}
            className="text-xs uppercase tracking-wider border border-[var(--border)] px-3 py-2 hover:bg-[var(--bg-elevated)]"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "SUN" : "MOON"}
          </button>
          {data.status === "failed" && (
            <button
              onClick={handleResume}
              disabled={resuming}
              className="text-xs uppercase tracking-wider border border-[var(--accent)] text-[var(--accent)] px-3 py-2 hover:bg-[var(--accent)] hover:text-[var(--bg)] disabled:opacity-50"
            >
              {resuming ? "RESUMING..." : "RE-ANALYZE"}
            </button>
          )}
          <button
            onClick={() => router.push("/")}
            className="text-xs uppercase tracking-wider border border-[var(--border)] px-3 py-2 hover:bg-[var(--bg-elevated)]"
          >
            New Analysis
          </button>
        </div>
      </header>

      {/* Resume Progress */}
      {resumeStages.length > 0 && (
        <div className="border border-[var(--border)] p-4 mb-6 space-y-2" data-no-print>
          <p className="text-xs uppercase tracking-wider text-[var(--text-dim)] mb-3">Re-analyzing...</p>
          {resumeStages.map((s) => (
            <div key={s.stage} className="flex items-center gap-3">
              <span className="text-xs w-32 uppercase tracking-wider text-[var(--text-dim)]">{s.name}</span>
              <div className="flex-1 h-2 bg-[var(--bg-elevated)] overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    s.status === "complete" ? "w-full bg-[var(--green)]" :
                    s.status === "running" ? "w-2/3 bg-[var(--yellow)] animate-[progress-pulse_1.5s_ease-in-out_infinite]" :
                    s.status === "error" ? "w-full bg-[var(--red)]" :
                    "w-0"
                  }`}
                />
              </div>
              <span className="text-xs w-16 text-right uppercase" style={{
                color: s.status === "complete" ? "var(--green)" :
                       s.status === "running" ? "var(--yellow)" :
                       s.status === "error" ? "var(--red)" :
                       "var(--text-dim)"
              }}>
                {s.status === "complete" ? "DONE" : s.status === "running" ? "ACTIVE" : s.status === "error" ? "FAIL" : "WAIT"}
              </span>
            </div>
          ))}
          {resumeStages.some((s) => s.error) && (
            <p className="text-xs text-[var(--red)] mt-2">
              {resumeStages.find((s) => s.error)?.error}
            </p>
          )}
        </div>
      )}

      {/* Error Banner */}
      {data.status === "failed" && data.error && !resuming && (
        <div className="border border-[var(--red)] p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-[var(--red)]" />
            <span className="text-sm uppercase tracking-wider text-[var(--red)]">Analysis Failed</span>
          </div>
          <p className="text-xs text-[var(--text-dim)] mt-2 font-mono">{data.error}</p>
          <p className="text-xs text-[var(--text-dim)] mt-1">Click RE-ANALYZE above to retry.</p>
        </div>
      )}

      {/* Warnings Banner */}
      {data.analysisWarnings && data.analysisWarnings.length > 0 && (
        <div className="border border-[var(--yellow)] p-3 mb-4 flex items-start gap-3 cursor-pointer hover:bg-[var(--bg-surface)]" onClick={() => setActiveTab("diagnostics")} data-no-print>
          <div className="w-2 h-2 bg-[var(--yellow)] mt-1 flex-shrink-0" />
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[var(--yellow)]">
              {data.analysisWarnings.length} pipeline warning{data.analysisWarnings.length > 1 ? "s" : ""}
            </span>
            <p className="text-[10px] text-[var(--text-dim)] mt-0.5">{data.analysisWarnings[0]}</p>
          </div>
        </div>
      )}

      {/* Verdict Banner */}
      {report && (
        <div
          data-tour="verdict-banner"
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
            <div className="flex items-center gap-3">
              <div className="text-3xl font-bold text-[var(--text-bright)]">
                {report.riskScore}
              </div>
              <div className="text-[10px] text-[var(--text-dim)] uppercase">/ 100</div>
            </div>
          </div>
          <div className="mt-3">
            <p className={`text-sm text-[var(--text)] leading-relaxed ${!summaryExpanded ? "line-clamp-3" : ""}`}>
              {report.summary}
            </p>
            {report.summary.length > 200 && (
              <button
                onClick={() => setSummaryExpanded(!summaryExpanded)}
                className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text)] underline mt-1"
              >
                {summaryExpanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
          {/* Full-width risk score bar with threshold markers */}
          <div className="relative w-full h-2 bg-[var(--bg-surface)] mt-3">
            <div
              className="h-full transition-all"
              style={{
                width: `${Math.min(100, Math.max(0, report.riskScore))}%`,
                background: riskBarColor(report.riskScore),
              }}
            />
            {[30, 60, 80].map((t) => (
              <div
                key={t}
                className="absolute top-0 h-full w-px bg-[var(--text-dim)] opacity-30"
                style={{ left: `${t}%` }}
              />
            ))}
          </div>
          <div className="relative w-full text-[8px] text-[var(--text-dim)] mt-0.5 h-3">
            <span className="absolute left-0">0</span>
            <span className="absolute" style={{ left: "30%", transform: "translateX(-50%)" }}>30</span>
            <span className="absolute" style={{ left: "60%", transform: "translateX(-50%)" }}>60</span>
            <span className="absolute" style={{ left: "80%", transform: "translateX(-50%)" }}>80</span>
            <span className="absolute right-0">100</span>
          </div>
        </div>
      )}

      {/* Risk Dashboard */}
      {report?.riskDashboard && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mb-6">
          {Object.entries(report.riskDashboard).map(([key, val]) => (
            <div key={key} className="border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-center">
              <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-2">
                {formatLabel(key.replace(/([A-Z])/g, "_$1"))}
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

      {/* Tabs + Severity Filter — sticky container */}
      <div className="sticky top-0 z-20 bg-[var(--bg)]" data-no-print>
      <div data-tour="tabs" className="flex gap-0 border-b border-[var(--border)] mb-0 overflow-x-auto">
        {(["overview", "video", "script", "legal", "youtube", "research", "diagnostics", "raw"] as const).map((tab) => {
          const count = tabCounts[tab];
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === tab
                  ? "border-[var(--text-bright)] text-[var(--text-bright)]"
                  : "border-transparent text-[var(--text-dim)] hover:text-[var(--text)]"
              }`}
            >
              {tab}
              {count != null && count > 0 && (
                <span className="text-[9px] min-w-[16px] text-center px-1 py-0.5 leading-none bg-[var(--bg-surface)] border border-[var(--border)] rounded-sm">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Severity filter bar */}
      {showSeverityFilter && (
        <div className="flex items-center gap-2 py-2 px-1 border-b border-[var(--border)] mb-4">
          <span className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mr-1">Min severity:</span>
          {(["low", "medium", "high", "severe"] as Severity[]).map((sev) => (
            <button
              key={sev}
              onClick={() => setMinSeverity(sev)}
              className={`text-[10px] uppercase tracking-wider px-2 py-1 border transition-colors ${
                minSeverity === sev
                  ? "border-[var(--text-bright)] text-[var(--text-bright)] bg-[var(--bg-elevated)]"
                  : "border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]"
              }`}
            >
              {sev}
            </button>
          ))}
          {hiddenCount > 0 && (
            <span className="text-[10px] text-[var(--text-dim)] ml-2">
              ({hiddenCount} hidden)
            </span>
          )}
        </div>
      )}
      {!showSeverityFilter && <div className="mb-4" />}
      </div>{/* end sticky container */}

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === "overview" && report && (
          <div className="space-y-6">
            {criticalEditsWithMoments.length > 0 && (
              <section>
                <h3 className="text-sm uppercase tracking-wider text-[var(--red)] mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-[var(--red)]" /> Critical Edits Required
                </h3>
                <div className="space-y-2">
                  {criticalEditsWithMoments.map(({ edit, moment }, i) => (
                    <div key={i} className="border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                      <div className="text-sm text-[var(--red)] mb-2 font-medium">
                        {edit.line ? `Line ${edit.line} — ` : ""}{edit.reason}
                      </div>
                      {moment?.thumbnailDataUrl && (
                        <div className="mb-2">
                          <img
                            src={moment.thumbnailDataUrl}
                            alt={`Related frame at ${moment.timecode}`}
                            className="max-w-[420px] w-full border border-[var(--border)]"
                          />
                          <div className="text-[10px] text-[var(--text-dim)] mt-1">Related video frame: {moment.timecode}</div>
                        </div>
                      )}
                      <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">Original</div>
                      <div className="text-sm text-[var(--text)] mb-2 leading-relaxed border border-[var(--border)] bg-[var(--bg)] p-2">
                        {smartExcerpt(edit.original, 260, edit.line)}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">Suggested</div>
                      <div className="text-sm text-[var(--green)] leading-relaxed border border-[var(--border)] bg-[var(--bg)] p-2">
                        {smartExcerpt(edit.suggested, 260, edit.line)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {recommendedEditsWithMoments.length > 0 && (
              <section>
                <h3 className="text-sm uppercase tracking-wider text-[var(--yellow)] mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-[var(--yellow)]" /> Recommended Edits
                </h3>
                <div className="space-y-2">
                  {recommendedEditsWithMoments.map(({ edit, moment }, i) => (
                    <div key={i} className="border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                      <div className="text-sm text-[var(--yellow)] mb-2 font-medium">
                        {edit.line ? `Line ${edit.line} — ` : ""}{edit.reason}
                      </div>
                      {moment?.thumbnailDataUrl && (
                        <div className="mb-2">
                          <img
                            src={moment.thumbnailDataUrl}
                            alt={`Related frame at ${moment.timecode}`}
                            className="max-w-[420px] w-full border border-[var(--border)]"
                          />
                          <div className="text-[10px] text-[var(--text-dim)] mt-1">Related video frame: {moment.timecode}</div>
                        </div>
                      )}
                      <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">Original</div>
                      <div className="text-sm text-[var(--text)] mb-2 leading-relaxed border border-[var(--border)] bg-[var(--bg)] p-2">
                        {smartExcerpt(edit.original, 260, edit.line)}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">Suggested</div>
                      <div className="text-sm text-[var(--green)] leading-relaxed border border-[var(--border)] bg-[var(--bg)] p-2">
                        {smartExcerpt(edit.suggested, 260, edit.line)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {riskyLines.length > 0 && (
              <section>
                <h3 className="text-xs uppercase tracking-wider text-[var(--amber)] mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-[var(--amber)]" /> Risky Lines
                  {riskyLines.length > 30 && (
                    <span className="text-[10px] text-[var(--text-dim)] font-normal normal-case tracking-normal ml-2">
                      Showing 30 of {riskyLines.length} —{" "}
                      <button onClick={() => setActiveTab("script")} className="underline hover:text-[var(--text)]">
                        view all in Script tab
                      </button>
                    </span>
                  )}
                </h3>
                <div className="space-y-2">
                  {riskyLines.slice(0, 30).map((item) => (
                    <div key={item.line} className="border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-[var(--text-dim)] border border-[var(--border)] px-1">
                          L{item.line}
                        </span>
                        {item.tags.map((tag) => (
                          <span key={tag} className="text-[10px] text-[var(--text-dim)] uppercase border border-[var(--border)] px-1">
                            {formatLabel(tag)}
                          </span>
                        ))}
                      </div>
                      <div className="text-xs text-[var(--text)]">{item.text || "(blank line)"}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {overviewVideoTimeline.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs uppercase tracking-wider text-[var(--amber)] flex items-center gap-2">
                    <span className="w-2 h-2 bg-[var(--amber)]" /> Video Timeline
                  </h3>
                  <button
                    onClick={() => setActiveTab("video")}
                    className="text-[10px] uppercase tracking-wider px-2 py-1 border border-[var(--border)] hover:bg-[var(--bg-elevated)] text-[var(--text-dim)]"
                  >
                    Open Full Video Tab
                  </button>
                </div>
                <div className="space-y-2">
                  {overviewVideoTimeline.map((group, i) => {
                    const item = group.item;
                    const maxSev = item.risks.reduce((worst, r) =>
                      (SEV_ORDER[r.severity] ?? 0) > (SEV_ORDER[worst] ?? 0) ? r.severity : worst,
                    "low");
                    const categories = [...new Set(item.risks.map(r => r.category.replaceAll("_", " ")))];
                    return (
                      <details
                        key={`${item.timecode}-${i}`}
                        className="border border-[var(--border)] bg-[var(--bg-surface)]"
                      >
                        <summary className="list-none cursor-pointer px-3 py-2 flex items-center gap-3 hover:bg-[var(--bg-elevated)]">
                          <span className="text-sm font-mono text-[var(--amber)]">
                            {group.startTimecode === group.endTimecode
                              ? group.startTimecode
                              : `${group.startTimecode}–${group.endTimecode}`}
                          </span>
                          <span className="text-[10px] uppercase" style={{ color: sevColor(maxSev) }}>{maxSev}</span>
                          <span className="text-xs text-[var(--text)] truncate">{categories.join(", ")}</span>
                          <span className="ml-auto text-[10px] text-[var(--text-dim)]">
                            {group.count} moment{group.count === 1 ? "" : "s"} · {item.risks.length} risk{item.risks.length === 1 ? "" : "s"}
                          </span>
                        </summary>
                        <div className="px-3 pb-3 pt-2 border-t border-[var(--border)] bg-[var(--bg-elevated)]">
                          {item.thumbnailDataUrl && (
                            <img
                              src={item.thumbnailDataUrl}
                              alt={`Frame at ${item.timecode}`}
                              className="max-w-[420px] w-full border border-[var(--border)] mb-2"
                            />
                          )}
                          <div className="space-y-2">
                            {item.risks.map((risk, j) => (
                              <div key={j} className="border border-[var(--border)] bg-[var(--bg)] p-2">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="text-[10px] uppercase font-semibold" style={{ color: sevColor(risk.severity) }}>
                                    {risk.severity}
                                  </span>
                                  <span className="text-[10px] text-[var(--text-dim)] uppercase border border-[var(--border)] px-1.5 py-0.5">
                                    {risk.category.replaceAll("_", " ")}
                                  </span>
                                  {risk.policyName && (
                                    <span className="text-[10px] text-[var(--text-dim)]">{risk.policyName}</span>
                                  )}
                                </div>
                                <p className="text-xs text-[var(--text)] leading-relaxed">{risk.reasoning}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </details>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Disclaimer Generator */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs uppercase tracking-wider text-[var(--text-dim)] flex items-center gap-2">
                  <span className="w-2 h-2 bg-[var(--text-dim)]" /> Suggested Disclaimers
                </h3>
                <button
                  onClick={() => setShowDisclaimers(!showDisclaimers)}
                  className="text-[10px] uppercase tracking-wider px-2 py-1 border border-[var(--border)] hover:bg-[var(--bg-elevated)] text-[var(--text-dim)]"
                  data-no-print
                >
                  {showDisclaimers ? "Hide" : "Generate"}
                </button>
              </div>
              {showDisclaimers && (
                <div className="border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-3">
                  {disclaimers.map((d, i) => (
                    <p key={i} className="text-sm text-[var(--text)] leading-relaxed">
                      {d}
                    </p>
                  ))}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(disclaimers.join("\n\n"));
                      setCopied("disclaimer");
                      setTimeout(() => setCopied(null), 2000);
                    }}
                    className="text-[10px] uppercase tracking-wider px-3 py-1 border border-[var(--border)] hover:bg-[var(--bg-elevated)] text-[var(--text-dim)]"
                    data-no-print
                  >
                    {copied === "disclaimer" ? "COPIED" : "COPY ALL"}
                  </button>
                </div>
              )}
            </section>

            {/* Fact-Check Summary */}
            {data.factCheckData && Array.isArray(data.factCheckData.findings) && data.factCheckData.findings.length > 0 && (() => {
              const findings = data.factCheckData!.findings as FactCheckFinding[];
              const supported = findings.filter(f => f.verdict === "supported");
              const contradicted = findings.filter(f => f.verdict === "contradicted");
              const unclear = findings.filter(f => f.verdict === "unclear" || f.verdict === "needs_external_verification");
              return (
                <section>
                  <h3 className="text-xs uppercase tracking-wider text-[var(--text-dim)] mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-[var(--text-dim)]" /> Fact-Check Results
                    <span className="text-[10px] font-normal normal-case tracking-normal text-[var(--text-dim)]">
                      {findings.length} claims verified
                    </span>
                  </h3>

                  {/* Summary bar */}
                  <div className="flex h-2 mb-4 overflow-hidden border border-[var(--border)]">
                    {supported.length > 0 && (
                      <div className="bg-[var(--green)]" style={{ width: `${(supported.length / findings.length) * 100}%` }} />
                    )}
                    {unclear.length > 0 && (
                      <div className="bg-[var(--yellow)]" style={{ width: `${(unclear.length / findings.length) * 100}%` }} />
                    )}
                    {contradicted.length > 0 && (
                      <div className="bg-[var(--red)]" style={{ width: `${(contradicted.length / findings.length) * 100}%` }} />
                    )}
                  </div>

                  {/* Summary counts */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-center">
                      <div className="text-lg text-[var(--green)] tabular-nums">{supported.length}</div>
                      <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Supported</div>
                    </div>
                    <div className="border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-center">
                      <div className="text-lg text-[var(--yellow)] tabular-nums">{unclear.length}</div>
                      <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Unclear</div>
                    </div>
                    <div className="border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-center">
                      <div className="text-lg text-[var(--red)] tabular-nums">{contradicted.length}</div>
                      <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Contradicted</div>
                    </div>
                  </div>

                  {/* Contradicted claims — show first, these need attention */}
                  {contradicted.length > 0 && (
                    <div className="mb-3">
                      <div className="text-[10px] uppercase tracking-wider text-[var(--red)] mb-2">Needs Correction</div>
                      <div className="space-y-2">
                        {contradicted.map((f, i) => (
                          <div key={i} className="border border-[var(--red)] bg-[var(--bg-surface)] p-3">
                            <div className="flex items-start gap-2">
                              <span className="w-2 h-2 bg-[var(--red)] mt-1 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-sm text-[var(--text)]">{f.claim}</p>
                                <p className="text-[10px] text-[var(--text-dim)] mt-1">{f.evidence}</p>
                                {f.line && <span className="text-[10px] text-[var(--text-dim)]">Line {f.line}</span>}
                                {f.suggestedRewrite && (
                                  <div className="mt-2 border-t border-[var(--border)] pt-2">
                                    <span className="text-[10px] uppercase tracking-wider text-[var(--green)]">Suggested fix: </span>
                                    <span className="text-xs text-[var(--green)]">{f.suggestedRewrite}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Unclear claims */}
                  {unclear.length > 0 && (
                    <div className="mb-3">
                      <div className="text-[10px] uppercase tracking-wider text-[var(--yellow)] mb-2">Unverified</div>
                      <div className="space-y-1">
                        {unclear.map((f, i) => (
                          <div key={i} className="border border-[var(--border)] bg-[var(--bg-surface)] p-2 flex items-start gap-2">
                            <span className="w-1.5 h-1.5 bg-[var(--yellow)] mt-1.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-[var(--text)]">{f.claim}</p>
                              <p className="text-[10px] text-[var(--text-dim)]">{f.evidence}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Supported — collapsed by default */}
                  {supported.length > 0 && (
                    <details className="border border-[var(--border)] bg-[var(--bg-surface)]">
                      <summary className="px-3 py-2 cursor-pointer text-[10px] uppercase tracking-wider text-[var(--green)] hover:bg-[var(--bg-elevated)]">
                        {supported.length} Supported Claims
                      </summary>
                      <div className="px-3 pb-3 space-y-1">
                        {supported.map((f, i) => (
                          <div key={i} className="flex items-start gap-2 py-1">
                            <span className="w-1.5 h-1.5 bg-[var(--green)] mt-1.5 flex-shrink-0" />
                            <p className="text-xs text-[var(--text-dim)]">{f.claim}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </section>
              );
            })()}

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

            {data.supplementalDocs && data.supplementalDocs.length > 0 && (
              <section>
                <h3 className="text-xs uppercase tracking-wider text-[var(--text-dim)] mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-[var(--text-dim)]" /> Supplemental Documentation
                </h3>
                <div className="space-y-2">
                  {data.supplementalDocs.map((doc, i) => (
                    <div key={i} className="border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-[var(--text-bright)]">{doc.fileName}</span>
                        <span className="text-[10px] text-[var(--text-dim)] uppercase border border-[var(--border)] px-1">
                          {doc.docType.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--text-dim)] mb-2">{doc.summary}</div>
                      {doc.verifiableFacts?.length > 0 && (
                        <div className="text-[10px] space-y-1">
                          {(expandedDocs.has(i) ? doc.verifiableFacts : doc.verifiableFacts.slice(0, 5)).map((f, j) => (
                            <div key={j} className="flex items-start gap-1">
                              <span
                                className="flex-shrink-0 mt-0.5"
                                style={{
                                  color: f.confidence === "confirmed" ? "var(--green)" :
                                    f.confidence === "likely" ? "var(--yellow)" : "var(--text-dim)",
                                }}
                              >
                                [{f.confidence.toUpperCase()}]
                              </span>
                              <span className="text-[var(--text)]">{f.claim}</span>
                            </div>
                          ))}
                          {doc.verifiableFacts.length > 5 && (
                            <button
                              onClick={() => {
                                setExpandedDocs(prev => {
                                  const next = new Set(prev);
                                  if (next.has(i)) next.delete(i);
                                  else next.add(i);
                                  return next;
                                });
                              }}
                              className="text-[var(--text-dim)] hover:text-[var(--text)] underline cursor-pointer"
                            >
                              {expandedDocs.has(i)
                                ? "Show less"
                                : `+ ${doc.verifiableFacts.length - 5} more facts`}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === "script" && data.scriptText && (
          <div>
            {/* Flag type filter */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mr-1">Show:</span>
              {(["all", "legal", "policy"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFlagFilter(f)}
                  className={`text-[10px] uppercase tracking-wider px-2 py-1 border transition-colors ${
                    flagFilter === f
                      ? "border-[var(--text-bright)] text-[var(--text-bright)] bg-[var(--bg-elevated)]"
                      : "border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]"
                  }`}
                >
                  {f === "all" ? "All Flags" : f === "legal" ? "Legal Only" : "Policy Only"}
                </button>
              ))}
            </div>
            <AnnotatedScriptView
              scriptText={data.scriptText}
              legalFlags={allLegalFlags}
              policyFlags={allPolicyFlags}
              state={data.caseState}
              caseStatus={data.caseStatus}
              hasMinors={data.hasMinors}
              flagFilter={flagFilter}
            />
          </div>
        )}

        {activeTab === "video" && (
          <div>
            {groupedVideoTimeline.length === 0 ? (
              <div className="border border-[var(--border)] bg-[var(--bg-surface)] p-8 text-center">
                <p className="text-sm text-[var(--text-dim)]">
                  {videoTimeline.length === 0
                    ? "No video timeline findings for this report."
                    : "All video findings hidden by severity filter."}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-sm text-[var(--text-bright)]">
                    {groupedVideoTimeline.length} grouped incident{groupedVideoTimeline.length === 1 ? "" : "s"}
                  </span>
                  <span className="text-xs text-[var(--text-dim)]">
                    {filteredVideoTimeline.length} raw moment{filteredVideoTimeline.length === 1 ? "" : "s"} collapsed
                  </span>
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={expandAllVideo}
                      className="text-[10px] uppercase tracking-wider px-2 py-1 border border-[var(--border)] hover:bg-[var(--bg-elevated)] text-[var(--text-dim)]"
                    >
                      Expand All
                    </button>
                    <button
                      onClick={collapseAllVideo}
                      className="text-[10px] uppercase tracking-wider px-2 py-1 border border-[var(--border)] hover:bg-[var(--bg-elevated)] text-[var(--text-dim)]"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>

                <div className="border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-[140px_80px_1fr_60px_72px] gap-3 px-4 py-2.5 border-b border-[var(--border)] text-xs text-[var(--text-dim)] uppercase tracking-wider bg-[var(--bg)]">
                    <span>Range</span>
                    <span>Severity</span>
                    <span>Categories</span>
                    <span className="text-right">Risks</span>
                    <span className="text-right">Moments</span>
                  </div>

                  {/* Table rows */}
                  {groupedVideoTimeline.map((group, i) => {
                    const item = group.item;
                    const maxSev = item.risks.reduce((worst, r) =>
                      (SEV_ORDER[r.severity] ?? 0) > (SEV_ORDER[worst] ?? 0) ? r.severity : worst,
                    "low");
                    const isExpanded = expandedVideoSet.has(i);
                    const categories = [...new Set(item.risks.map(r => r.category.replaceAll("_", " ")))];
                    const rangeLabel =
                      group.count > 1 ? `${group.startTimecode}-${group.endTimecode}` : item.timecode;

                    return (
                      <div key={`${group.signature}-${group.startTimecode}-${group.endTimecode}-${i}`}>
                        <div
                          onClick={() => toggleVideoExpand(i)}
                          className={`grid grid-cols-[140px_80px_1fr_60px_72px] gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors ${
                            isExpanded ? "bg-[var(--bg-elevated)]" : ""
                          } ${i > 0 ? "border-t border-[var(--border)]" : ""}`}
                        >
                          <span className="text-sm font-mono text-[var(--amber)]">{rangeLabel}</span>
                          <span className="text-xs uppercase self-center" style={{ color: sevColor(maxSev) }}>
                            {maxSev}
                          </span>
                          <span className="text-sm text-[var(--text)] truncate self-center">
                            {categories.join(", ")}
                          </span>
                          <span className="text-sm text-[var(--text-dim)] text-right self-center">
                            {item.risks.length}
                          </span>
                          <span className="text-sm text-[var(--text-dim)] text-right self-center">
                            {group.count}
                          </span>
                        </div>

                        {isExpanded && (
                          <div className="px-4 pb-4 pt-3 border-t border-[var(--border)] bg-[var(--bg-elevated)]">
                            <div className="text-xs text-[var(--text-dim)] mb-3">
                              {group.count > 1
                                ? `${group.count} nearby flagged moments collapsed into one incident from ${group.startTimecode} to ${group.endTimecode}.`
                                : `Single flagged moment at ${item.timecode}.`}
                            </div>
                            {item.thumbnailDataUrl && (
                              <img
                                src={item.thumbnailDataUrl}
                                alt={`Frame at ${item.timecode}`}
                                className="max-w-[480px] w-full border border-[var(--border)] mb-3"
                              />
                            )}
                            <div className="space-y-2">
                              {item.risks.map((risk, j) => (
                                <div key={j} className="border border-[var(--border)] bg-[var(--bg)] p-3">
                                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                    <span
                                      className="text-xs uppercase font-semibold"
                                      style={{ color: sevColor(risk.severity) }}
                                    >
                                      {risk.severity}
                                    </span>
                                    <span className="text-xs text-[var(--text-dim)] uppercase border border-[var(--border)] px-1.5 py-0.5">
                                      {risk.category.replaceAll("_", " ")}
                                    </span>
                                    {risk.policyName && (
                                      <span className="text-xs text-[var(--text-dim)]">{risk.policyName}</span>
                                    )}
                                  </div>
                                  <p className="text-sm text-[var(--text)] leading-relaxed">{risk.reasoning}</p>
                                  {risk.detectedText && (
                                    <p className="text-xs text-[var(--text-dim)] mt-2 pt-2 border-t border-[var(--border)]">
                                      Ref: {risk.detectedText.slice(0, 200)}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "legal" && (
          <div className="space-y-2" ref={navContainerRef} data-tour="dismiss-flags">
            {/* Cross-validation summary */}
            {data.legalCrossValidation && (
              <div className="border border-[var(--border)] bg-[var(--bg-surface)] p-3 mb-4">
                <div className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-2">
                  Cross-Validation Summary (Claude + GPT)
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-[var(--text-dim)]">Claude Opus: </span>
                    <span className="text-[var(--text-bright)]">{data.legalCrossValidation.claude.length} flags</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-dim)]">GPT-5.4: </span>
                    <span className="text-[var(--text-bright)]">{data.legalCrossValidation.gpt.length} flags</span>
                  </div>
                </div>
              </div>
            )}

            {/* Dismissed toggle */}
            {dismissedCount > 0 && (
              <div className="flex items-center gap-2 mb-2" data-no-print>
                <button
                  onClick={() => setShowDismissed(!showDismissed)}
                  className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text)] underline"
                >
                  {showDismissed ? "Hide" : "Show"} {dismissedCount} dismissed
                </button>
              </div>
            )}

            {filteredLegalFlags.length === 0 ? (
              <div className="border border-[var(--border)] bg-[var(--bg-surface)] p-8 text-center">
                <p className="text-xs text-[var(--text-dim)]">
                  {allLegalFlags.length === 0 ? "No legal flags identified." : "All legal flags hidden by severity filter."}
                </p>
              </div>
            ) : (
              filteredLegalFlags.map((flag: LegalFlag, i: number) => {
                const isCrossValidated = "agreementCount" in flag;
                const cv = isCrossValidated ? (flag as unknown as {
                  agreementCount: number;
                  models: string[];
                  originalSeverities: Record<string, string>;
                }) : null;
                const fKey = flagKey("legal", flag.line, flag.text);
                const dismissed = isDismissed(fKey);
                const dismissal = getDismissal(fKey);

                if (dismissed && !showDismissed) return null;

                return (
                  <div
                    key={i}
                    data-nav-item
                    className={`border bg-[var(--bg-surface)] p-3 transition-colors ${
                      dismissed ? "opacity-50" : ""
                    } ${
                      navActiveIndex === i ? "border-[var(--text-bright)] ring-1 ring-[var(--text-bright)]" : "border-[var(--border)]"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="w-2 h-2" style={{ background: sevColor(flag.severity) }} />
                      <span className="text-xs uppercase" style={{ color: sevColor(flag.severity) }}>
                        {flag.severity}
                      </span>
                      <span className="text-[10px] text-[var(--text-dim)] uppercase">
                        <GlossaryTerm term={flag.riskType.replace(/_/g, " ")}>{formatLabel(flag.riskType)}</GlossaryTerm>
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
                            color: cv.agreementCount >= 2 ? "var(--red)" : "var(--text-dim)",
                            borderColor: cv.agreementCount >= 2 ? "var(--red)" : "var(--border)",
                          }}
                        >
                          {cv.agreementCount}/2 MODELS
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-[var(--text)] mb-1.5 leading-relaxed no-underline" style={{ textDecoration: "none" }}>&quot;{flag.text}&quot;</div>
                    <div className="text-sm text-[var(--text-dim)] mb-1.5 whitespace-pre-wrap leading-relaxed no-underline" style={{ textDecoration: "none" }}>{renderWithGlossary(flag.reasoning)}</div>
                    {flag.stateCitation && (
                      <div className="text-xs text-[var(--text-dim)]">Cite: {flag.stateCitation}</div>
                    )}
                    <div className="text-sm text-[var(--green)] mt-2 border border-[var(--border)] bg-[var(--bg)] p-2 no-underline" style={{ textDecoration: "none" }}>Safer: {flag.saferRewrite}</div>
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
                    {/* Dismiss / Restore controls */}
                    <div className="mt-2 pt-2 border-t border-[var(--border)] flex items-center gap-2" data-no-print>
                      {dismissed ? (
                        <>
                          <span className="text-[10px] text-[var(--text-dim)]">
                            Dismissed: {dismissal?.reason}
                          </span>
                          <button
                            onClick={() => restore(fKey)}
                            className="text-[10px] text-[var(--amber)] hover:text-[var(--yellow)] underline ml-auto"
                          >
                            Restore
                          </button>
                        </>
                      ) : dismissingKey === fKey ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          {DISMISS_REASONS.map((reason) => (
                            <button
                              key={reason}
                              onClick={() => { dismiss(fKey, reason); setDismissingKey(null); }}
                              className="text-[10px] px-2 py-1 border border-[var(--border)] hover:bg-[var(--bg-elevated)] text-[var(--text-dim)]"
                            >
                              {reason}
                            </button>
                          ))}
                          <button
                            onClick={() => setDismissingKey(null)}
                            className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text)] ml-1"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDismissingKey(fKey)}
                          className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text)] underline"
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "youtube" && (
          <div className="space-y-2" ref={activeTab === "youtube" ? navContainerRef : undefined}>
            {/* Policies Triggered strip */}
            <div className="border border-[var(--border)] bg-[var(--bg-surface)] p-3 mb-3">
              <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-2">
                Policies Triggered ({triggeredPolicyNames.size}/{YT_POLICIES.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {YT_POLICIES.map((p) => {
                  const triggered = triggeredPolicyNames.has(p.name);
                  return (
                    <span
                      key={p.id}
                      className={`text-[9px] px-1.5 py-0.5 border ${
                        triggered
                          ? "border-[var(--red)] text-[var(--red)] bg-[rgba(239,68,68,0.1)]"
                          : "border-[var(--border)] text-[var(--text-dim)] opacity-40"
                      }`}
                      title={p.name}
                    >
                      {p.name}
                    </span>
                  );
                })}
              </div>
            </div>

            {filteredPolicyFlags.length === 0 ? (
              <div className="border border-[var(--border)] bg-[var(--bg-surface)] p-8 text-center space-y-2">
                <p className="text-xs text-[var(--text-dim)]">
                  {allPolicyFlags.length === 0 ? "No YouTube policy flags identified." : "All policy flags hidden by severity filter."}
                </p>
                {allPolicyFlags.length === 0 && report?.riskDashboard?.monetization !== "full_ads" && (
                  <p className="text-xs text-[var(--yellow)]">
                    Monetization was marked {report?.riskDashboard?.monetization.replaceAll("_", " ")} in synthesis,
                    but no specific policy flags were returned for this review.
                  </p>
                )}
              </div>
            ) : (
              filteredPolicyFlags.map((flag: PolicyFlag, i: number) => {
                const contentKey = `${flag.line ?? "na"}-${flag.category}-${i}`;
                const isLong = flag.text.length > 300;
                const isExpanded = expandedYtFlags.has(contentKey);
                const displayText = isLong && !isExpanded
                  ? smartExcerpt(flag.text, 300, flag.line)
                  : flag.text;
                const fKey = flagKey("policy", flag.line, flag.text);
                const dismissed = isDismissed(fKey);
                const dismissal = getDismissal(fKey);

                if (dismissed && !showDismissed) return null;

                return (
                  <div
                    key={i}
                    data-nav-item
                    className={`border bg-[var(--bg-surface)] p-3 transition-colors ${
                      dismissed ? "opacity-50" : ""
                    } ${
                      navActiveIndex === i ? "border-[var(--text-bright)] ring-1 ring-[var(--text-bright)]" : "border-[var(--border)]"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="w-2 h-2" style={{ background: sevColor(flag.severity) }} />
                      <span className="text-xs uppercase" style={{ color: sevColor(flag.severity) }}>
                        {flag.severity}
                      </span>
                      <span className="text-[10px] text-[var(--text-dim)] uppercase">
                        {formatLabel(flag.category)}
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
                    <div className="text-sm text-[var(--text)] mb-1.5 leading-relaxed" style={{ textDecoration: "none" }}>
                      &quot;{displayText}&quot;
                      {isLong && (
                        <button
                          onClick={() => setExpandedYtFlags(prev => {
                            const next = new Set(prev);
                            if (next.has(contentKey)) next.delete(contentKey); else next.add(contentKey);
                            return next;
                          })}
                          className="ml-2 text-[10px] text-[var(--text-dim)] hover:text-[var(--text)] underline"
                        >
                          {isExpanded ? "Show less" : "Show more"}
                        </button>
                      )}
                    </div>
                    <div className="text-sm text-[var(--text-dim)] mb-1.5 whitespace-pre-wrap leading-relaxed" style={{ textDecoration: "none" }}>{flag.reasoning}</div>
                    {flag.policyQuote && (
                      <div className="text-xs text-[var(--text-dim)] italic" style={{ textDecoration: "none" }}>Policy: {flag.policyQuote}</div>
                    )}
                    {flag.saferRewrite && (
                      <div className="text-sm text-[var(--green)] mt-2 border border-[var(--border)] bg-[var(--bg)] p-2" style={{ textDecoration: "none" }}>Safer: {flag.saferRewrite}</div>
                    )}
                    {/* Dismiss / Restore controls */}
                    <div className="mt-2 pt-2 border-t border-[var(--border)] flex items-center gap-2" data-no-print>
                      {dismissed ? (
                        <>
                          <span className="text-[10px] text-[var(--text-dim)]" style={{ textDecoration: "none" }}>
                            Dismissed: {dismissal?.reason}
                          </span>
                          <button
                            onClick={() => restore(fKey)}
                            className="text-[10px] text-[var(--amber)] hover:text-[var(--yellow)] underline ml-auto"
                            style={{ textDecoration: "underline" }}
                          >
                            Restore
                          </button>
                        </>
                      ) : dismissingKey === fKey ? (
                        <div className="flex items-center gap-2 flex-wrap" style={{ textDecoration: "none" }}>
                          {DISMISS_REASONS.map((reason) => (
                            <button
                              key={reason}
                              onClick={() => { dismiss(fKey, reason); setDismissingKey(null); }}
                              className="text-[10px] px-2 py-1 border border-[var(--border)] hover:bg-[var(--bg-elevated)] text-[var(--text-dim)]"
                            >
                              {reason}
                            </button>
                          ))}
                          <button
                            onClick={() => setDismissingKey(null)}
                            className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text)] ml-1"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDismissingKey(fKey)}
                          className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text)] underline"
                          style={{ textDecoration: "underline" }}
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "research" && (
          <div className="space-y-4">
            {data.researchData ? (
              <div className="space-y-4">
                {/* Person Profiles */}
                {Array.isArray((data.researchData as Record<string, unknown>).personProfiles) && (
                  <section>
                    <h3 className="text-xs uppercase tracking-wider text-[var(--text-dim)] mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-[var(--text-dim)]" /> Person Profiles
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {((data.researchData as Record<string, unknown>).personProfiles as Array<Record<string, string | boolean | null>>).map((person, i) => (
                        <div key={i} className="border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-sm text-[var(--text-bright)] font-medium">
                              {String(person.name ?? "Unknown")}
                            </span>
                            {Boolean(person.isPublicFigure) && (
                              <span className="text-[10px] text-[var(--amber)] border border-[var(--amber)] px-1.5 py-0.5">
                                PUBLIC FIGURE
                              </span>
                            )}
                            {Boolean(person.isDeceased) && (
                              <span className="text-[10px] text-[var(--text-dim)] border border-[var(--border)] px-1.5 py-0.5">
                                DECEASED
                              </span>
                            )}
                          </div>
                          {person.publicFigureReason && (
                            <p className="text-xs text-[var(--text-dim)] mb-1">{String(person.publicFigureReason)}</p>
                          )}
                          {person.caseStatus && (
                            <p className="text-xs text-[var(--text)]">Status: {String(person.caseStatus)}</p>
                          )}
                          {person.newsCoverage && (
                            <p className="text-xs text-[var(--text-dim)] mt-1">Coverage: {String(person.newsCoverage)}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Key Citations */}
                {Array.isArray((data.researchData as Record<string, unknown>).keyCitations) && (
                  <section>
                    <h3 className="text-xs uppercase tracking-wider text-[var(--text-dim)] mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-[var(--text-dim)]" /> Key Citations
                    </h3>
                    <div className="space-y-2">
                      {((data.researchData as Record<string, unknown>).keyCitations as Array<Record<string, string | null>>).map((citation, i) => {
                        const urlStr = String(citation.url ?? citation.source ?? "");
                        const isUrl = urlStr.startsWith("http://") || urlStr.startsWith("https://");
                        return (
                          <div key={i} className="border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                            <div className="text-sm text-[var(--text)]">
                              {String(citation.title ?? citation.description ?? citation.text ?? JSON.stringify(citation))}
                            </div>
                            {isUrl && (
                              <a
                                href={urlStr}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] underline break-all mt-1 block"
                              >
                                {urlStr}
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Court Records */}
                {Array.isArray((data.researchData as Record<string, unknown>).courtRecords) && (
                  <section>
                    <h3 className="text-xs uppercase tracking-wider text-[var(--text-dim)] mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-[var(--text-dim)]" /> Court Records
                    </h3>
                    <div className="space-y-2">
                      {((data.researchData as Record<string, unknown>).courtRecords as Array<Record<string, string | null>>).map((record, i) => (
                        <details key={i} className="border border-[var(--border)] bg-[var(--bg-surface)]">
                          <summary className="list-none cursor-pointer px-3 py-2 flex items-center gap-3 hover:bg-[var(--bg-elevated)] text-sm text-[var(--text)]">
                            {String(record.caseName ?? record.title ?? record.caseNumber ?? `Record ${i + 1}`)}
                          </summary>
                          <pre className="text-xs text-[var(--text-dim)] px-3 pb-3 whitespace-pre-wrap overflow-auto max-h-[300px]">
                            {JSON.stringify(record, null, 2)}
                          </pre>
                        </details>
                      ))}
                    </div>
                  </section>
                )}

                {/* Fallback: render remaining keys as before */}
                {Object.entries(data.researchData)
                  .filter(([key]) => !["personProfiles", "keyCitations", "courtRecords"].includes(key))
                  .map(([key, val]) => (
                    <div key={key} className="border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                      <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-2">
                        {formatLabel(key)}
                      </div>
                      {typeof val === "string" ? (
                        <p className="text-sm text-[var(--text)] whitespace-pre-wrap leading-relaxed">{val}</p>
                      ) : (
                        <pre className="text-xs text-[var(--text)] overflow-auto max-h-[400px] whitespace-pre-wrap">
                          {JSON.stringify(val, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <div className="border border-[var(--border)] bg-[var(--bg-surface)] p-8 text-center">
                <p className="text-xs text-[var(--text-dim)]">No research data available.</p>
              </div>
            )}

            {/* Fact-Check Findings */}
            {data.factCheckData && Array.isArray(data.factCheckData.findings) && data.factCheckData.findings.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xs uppercase tracking-wider text-[var(--text-dim)] mb-3 border-b border-[var(--border)] pb-2">
                  Fact-Check ({data.factCheckData.findings.length} claims)
                </h3>
                {data.factCheckData.summary && (
                  <p className="text-xs text-[var(--text-dim)] mb-3 italic">{data.factCheckData.summary}</p>
                )}
                <div className="space-y-2">
                  {data.factCheckData.findings.map((f: FactCheckFinding, i: number) => {
                    const verdictColors: Record<string, string> = {
                      supported: "var(--green)",
                      contradicted: "var(--red)",
                      unclear: "var(--yellow)",
                      needs_external_verification: "var(--text-dim)",
                    };
                    const color = verdictColors[f.verdict] ?? "var(--text-dim)";
                    return (
                      <div key={i} className="border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="w-2 h-2" style={{ background: color }} />
                          <span className="text-[10px] uppercase tracking-wider" style={{ color }}>
                            {f.verdict.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] text-[var(--text-dim)]">
                            confidence: {Math.round(f.confidence * 100)}%
                          </span>
                          <span className="text-[10px] text-[var(--text-dim)] border border-[var(--border)] px-1">
                            {f.basis}
                          </span>
                          {f.line && (
                            <span className="text-[10px] text-[var(--text-dim)]">line {f.line}</span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text)]">{f.claim}</p>
                        <p className="text-[10px] text-[var(--text-dim)] mt-1">{f.evidence}</p>
                        {f.suggestedRewrite && (
                          <p className="text-[10px] text-[var(--green)] mt-1">Rewrite: {f.suggestedRewrite}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Diagnostics Tab */}
        {activeTab === "diagnostics" && (
          <div className="space-y-4">
            {/* Analysis Warnings */}
            {data.analysisWarnings && data.analysisWarnings.length > 0 && (
              <div className="border border-[var(--yellow)] bg-[var(--bg-surface)] p-3">
                <div className="text-[10px] uppercase tracking-wider text-[var(--yellow)] mb-2">
                  Pipeline Warnings ({data.analysisWarnings.length})
                </div>
                <div className="space-y-1">
                  {data.analysisWarnings.map((w: string, i: number) => (
                    <p key={i} className="text-xs text-[var(--text-dim)]">{w}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Stage Performance */}
            {stageLogs.length > 0 ? (
              <div>
                <h3 className="text-xs uppercase tracking-wider text-[var(--text-dim)] mb-3 border-b border-[var(--border)] pb-2">
                  Stage Performance
                </h3>
                <div className="space-y-2">
                  {stageLogs.map((log) => {
                    const totalTokens = (log.inputTokens ?? 0) + (log.outputTokens ?? 0);
                    return (
                      <div key={log.id} className="border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2" style={{
                              background: log.status === "complete" ? "var(--green)" :
                                         log.status === "error" ? "var(--red)" : "var(--yellow)"
                            }} />
                            <span className="text-xs uppercase tracking-wider text-[var(--text-bright)]">
                              {log.stage}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-[var(--text-dim)]">
                            {log.model && <span>{log.model}</span>}
                            {log.cacheHit && (
                              <span className="text-[var(--green)] border border-[var(--green)] px-1">CACHED</span>
                            )}
                            <span className="uppercase" style={{
                              color: log.status === "complete" ? "var(--green)" :
                                     log.status === "error" ? "var(--red)" : "var(--yellow)"
                            }}>{log.status}</span>
                          </div>
                        </div>
                        <div className="flex gap-4 text-[10px] text-[var(--text-dim)] mt-1">
                          {log.durationMs != null && (
                            <span>{(log.durationMs / 1000).toFixed(1)}s</span>
                          )}
                          {totalTokens > 0 && (
                            <span>{totalTokens.toLocaleString()} tokens ({(log.inputTokens ?? 0).toLocaleString()} in / {(log.outputTokens ?? 0).toLocaleString()} out)</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Totals */}
                <div className="border-t border-[var(--border)] mt-4 pt-3">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg text-[var(--text-bright)] tabular-nums">
                        {(stageLogs.reduce((sum, l) => sum + (l.durationMs ?? 0), 0) / 1000).toFixed(1)}s
                      </div>
                      <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">Total Time</div>
                    </div>
                    <div>
                      <div className="text-lg text-[var(--text-bright)] tabular-nums">
                        {stageLogs.reduce((sum, l) => sum + (l.inputTokens ?? 0) + (l.outputTokens ?? 0), 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">Total Tokens</div>
                    </div>
                    <div>
                      <div className="text-lg text-[var(--text-bright)] tabular-nums">
                        {stageLogs.filter((l) => l.cacheHit).length}/{stageLogs.length}
                      </div>
                      <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">Cache Hits</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border border-[var(--border)] bg-[var(--bg-surface)] p-8 text-center">
                <p className="text-xs text-[var(--text-dim)]">No stage logs available.</p>
              </div>
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

      {/* Keyboard shortcuts overlay */}
      {navShowHelp && <KeyboardHelpOverlay onClose={() => setNavShowHelp(false)} />}

      <OnboardingOverlay
        active={onboarding.active}
        currentStep={onboarding.currentStep}
        step={onboarding.step}
        total={onboarding.steps.length}
        onNext={onboarding.next}
        onSkip={onboarding.skip}
      />
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ResultsContent />
    </Suspense>
  );
}
