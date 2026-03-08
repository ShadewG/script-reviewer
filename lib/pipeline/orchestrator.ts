import { callGPTMini, callGPT } from "../ai/openai";
import { callClaude } from "../ai/anthropic";
import { callSonar } from "../ai/perplexity";
import { searchDockets } from "../ai/courtlistener";
import { PARSER_SYSTEM, buildParserPrompt } from "../prompts/parser";
import { YOUTUBE_SYSTEM, buildYoutubePrompt } from "../prompts/youtube-policy";
import {
  buildCaseResearchQueries,
  RESEARCH_SYNTHESIS_SYSTEM,
  buildResearchSynthesisPrompt,
} from "../prompts/case-research";
import { SYNTHESIS_SYSTEM, buildSynthesisPrompt } from "../prompts/synthesis";
import { runMultiModelLegalReview } from "./cross-validate";
import {
  heuristicLegalFlags,
  heuristicPolicyFlags,
  videoFindingsToLegalFlags,
  videoFindingsToPolicyFlags,
} from "./heuristics";
import { prisma } from "../db";
import type {
  CaseMetadata,
  ParsedScript,
  LegalFlag,
  PolicyFlag,
  ResearchFindings,
  SynthesisReport,
  StageUpdate,
} from "./types";
import type { DocumentFacts } from "../documents/types";

const SYNTHESIS_REPAIR_SYSTEM = `You repair malformed JSON.
Return ONLY valid JSON. No markdown, no commentary.
Preserve the original meaning and keys as much as possible.
Do not invent new top-level fields.
Ensure all strings are properly quoted and escaped.`;

function deriveMonetizationFromPolicyFlags(
  policyFlags: PolicyFlag[]
): "full_ads" | "limited_ads" | "no_ads" {
  const monetizationRelevantFlags = policyFlags.filter(
    (f) =>
      f.category === "monetization" ||
      f.category === "age_restriction" ||
      f.category === "metadata"
  );
  if (monetizationRelevantFlags.length === 0) return "full_ads";
  if (
    monetizationRelevantFlags.some(
      (f) => f.impact === "no_ads" || f.impact === "removal_risk"
    )
  ) {
    return "no_ads";
  }
  if (
    monetizationRelevantFlags.some(
      (f) => f.impact === "limited_ads" || f.impact === "age_restricted"
    )
  ) {
    return "limited_ads";
  }
  return "full_ads";
}

function mergePolicyFlags(
  base: PolicyFlag[],
  heuristics: PolicyFlag[]
): PolicyFlag[] {
  const seen = new Set(
    base.map(
      (f) =>
        `${f.line ?? "na"}|${f.category}|${f.policyName.toLowerCase()}|${f.text.toLowerCase()}`
    )
  );
  const merged = [...base];
  for (const h of heuristics) {
    const key = `${h.line ?? "na"}|${h.category}|${h.policyName.toLowerCase()}|${h.text.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(h);
  }
  return merged;
}

function mergeLegalFlags(
  base: LegalFlag[],
  heuristics: LegalFlag[]
): LegalFlag[] {
  const seen = new Set(
    base.map(
      (f) =>
        `${f.line ?? "na"}|${f.riskType}|${f.text.toLowerCase()}|${f.person.toLowerCase()}`
    )
  );
  const merged = [...base];
  for (const h of heuristics) {
    const key = `${h.line ?? "na"}|${h.riskType}|${h.text.toLowerCase()}|${h.person.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(h);
  }
  return merged;
}

const SEVERITY_ORDER: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  severe: 3,
};

const VIDEO_TEXT_PREFIX = /^\[Video\s+(\d\d):(\d\d):(\d\d)\]\s*/i;

function parseVideoSecondFromText(text: string): number | null {
  const m = text.match(VIDEO_TEXT_PREFIX);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

function normalizeForSimilarity(input: string): string {
  return input
    .toLowerCase()
    .replace(VIDEO_TEXT_PREFIX, "")
    .replace(/\b\d{2}:\d{2}:\d{2}\b/g, " ")
    .replace(/\b\d{1,4}[-/:]\d{1,4}[-/:]?\d{0,4}\b/g, " ")
    .replace(/\b[0-9a-f]{2,}\b/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(input: string): Set<string> {
  return new Set(
    normalizeForSimilarity(input)
      .split(" ")
      .filter((t) => t.length >= 4)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union <= 0 ? 0 : inter / union;
}

function isHigherSeverity(a: string, b: string): boolean {
  return (SEVERITY_ORDER[a] ?? 0) > (SEVERITY_ORDER[b] ?? 0);
}

function dedupePolicyFlags(flags: PolicyFlag[]): PolicyFlag[] {
  const deduped: PolicyFlag[] = [];
  const WINDOW_SECONDS = 90;

  for (const flag of flags) {
    const sec = parseVideoSecondFromText(flag.text);
    const tokens = tokenSet(`${flag.text} ${flag.reasoning} ${flag.policyName}`);
    const idx = deduped.findIndex((existing) => {
      if (existing.category !== flag.category) return false;
      const existingSec = parseVideoSecondFromText(existing.text);
      if (sec != null && existingSec != null && Math.abs(sec - existingSec) > WINDOW_SECONDS) {
        return false;
      }
      const existingTokens = tokenSet(
        `${existing.text} ${existing.reasoning} ${existing.policyName}`
      );
      return jaccard(tokens, existingTokens) >= 0.62;
    });

    if (idx === -1) {
      deduped.push(flag);
      continue;
    }
    if (isHigherSeverity(flag.severity, deduped[idx].severity)) {
      deduped[idx] = flag;
    }
  }

  return deduped;
}

function dedupeLegalFlags(flags: LegalFlag[]): LegalFlag[] {
  const deduped: LegalFlag[] = [];
  const WINDOW_SECONDS = 90;

  for (const flag of flags) {
    const sec = parseVideoSecondFromText(flag.text);
    const tokens = tokenSet(`${flag.text} ${flag.reasoning} ${flag.person}`);
    const idx = deduped.findIndex((existing) => {
      if (existing.riskType !== flag.riskType) return false;
      if (existing.person.toLowerCase() !== flag.person.toLowerCase()) return false;

      const existingSec = parseVideoSecondFromText(existing.text);
      if (sec != null && existingSec != null && Math.abs(sec - existingSec) > WINDOW_SECONDS) {
        return false;
      }
      const existingTokens = tokenSet(
        `${existing.text} ${existing.reasoning} ${existing.person}`
      );
      return jaccard(tokens, existingTokens) >= 0.62;
    });

    if (idx === -1) {
      deduped.push(flag);
      continue;
    }
    if (isHigherSeverity(flag.severity, deduped[idx].severity)) {
      deduped[idx] = flag;
    }
  }

  return deduped;
}

type ReportEdit = SynthesisReport["criticalEdits"][number];

function normalizeEditSignature(edit: ReportEdit): string {
  return `${edit.original} ${edit.reason}`
    .toLowerCase()
    .replace(VIDEO_TEXT_PREFIX, "")
    .replace(/\b\d{2}:\d{2}:\d{2}\b/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function editPriority(edit: ReportEdit): number {
  const joined = `${edit.original} ${edit.reason}`.toLowerCase();
  let score = 0;

  if (
    /\b(removal risk|community guidelines|no-ads|no ads|age-restriction|age restriction|limited-ads|limited ads|monetization)\b/.test(
      joined
    )
  ) {
    score += 40;
  }
  if (
    /\b(high defamation risk|defamation|false light|publication-blocking|severe legal)\b/.test(
      joined
    )
  ) {
    score += 30;
  }
  if (
    /\b(phone number|email|full address|home address|social security|ssn|passport|driver's license|account number|unblurred minor|child safety)\b/.test(
      joined
    )
  ) {
    score += 25;
  }
  if (
    /\b(ip address|device fingerprint|meta platforms|business record|geolocation|timestamp|license plate|aerial map|road\b|privacy complaint)\b/.test(
      joined
    )
  ) {
    score -= 35;
  }
  if (
    /\bblurred|pixelated|redacted|obscured|censored\b/.test(joined) &&
    !/\bunblurred\b/.test(joined)
  ) {
    score -= 40;
  }
  if (
    /\bif this person was a minor|confirm age|verify consent|minor risk|easy fix|optional\b/.test(
      joined
    )
  ) {
    score -= 25;
  }

  return score;
}

function normalizeReportEdits(
  edits: ReportEdit[],
  { maxItems, dropLowPriority }: { maxItems: number; dropLowPriority: boolean }
): ReportEdit[] {
  const ranked = edits
    .map((edit) => ({ edit, score: editPriority(edit) }))
    .sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const normalized: ReportEdit[] = [];

  for (const { edit, score } of ranked) {
    if (dropLowPriority && score < 0) continue;
    const signature = normalizeEditSignature(edit);
    if (!signature || seen.has(signature)) continue;
    seen.add(signature);
    normalized.push(edit);
    if (normalized.length >= maxItems) break;
  }

  return normalized;
}

function safeJsonParse<T>(text: string): T {
  let cleaned = text.trim();
  // Strip markdown code fences
  cleaned = cleaned.replace(/^```[\w]*\s*\n?/, "").replace(/\n?```\s*$/, "");
  // Find JSON in text if not already starting with [ or {
  if (!cleaned.startsWith("[") && !cleaned.startsWith("{")) {
    const jsonMatch = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (jsonMatch) cleaned = jsonMatch[0];
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    // Try to fix truncated JSON by closing open brackets/braces
    let fixed = cleaned;
    const opens = (fixed.match(/\[/g) || []).length;
    const closes = (fixed.match(/\]/g) || []).length;
    const braceOpens = (fixed.match(/\{/g) || []).length;
    const braceCloses = (fixed.match(/\}/g) || []).length;
    // Remove trailing comma before closing
    fixed = fixed.replace(/,\s*$/, "");
    for (let i = 0; i < braceOpens - braceCloses; i++) fixed += "}";
    for (let i = 0; i < opens - closes; i++) fixed += "]";
    try {
      return JSON.parse(fixed) as T;
    } catch {
      throw e; // throw original error if fix didn't work
    }
  }
}

export type OnProgress = (update: StageUpdate) => void;

export async function runPipeline(
  reviewId: string,
  script: string,
  metadata: CaseMetadata,
  onProgress?: OnProgress
): Promise<SynthesisReport> {
  const emit = (update: StageUpdate) => {
    onProgress?.(update);
  };
  const analysisMode = metadata.analysisMode ?? "full";
  const runYouTube = analysisMode !== "legal_only";
  const runResearch = analysisMode !== "monetization_only";
  const runLegal = analysisMode !== "monetization_only";

  // --- Stage 0: Parse ---
  emit({ stage: 0, name: "Script Parser", status: "running" });
  let parsed: ParsedScript;
  try {
    const parseResult = await callGPTMini(PARSER_SYSTEM, buildParserPrompt(script));
    parsed = safeJsonParse<ParsedScript>(parseResult);
    await prisma.review.update({
      where: { id: reviewId },
      data: { parsedEntities: parsed as never },
    });
    emit({ stage: 0, name: "Script Parser", status: "complete", data: parsed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Parse failed";
    emit({ stage: 0, name: "Script Parser", status: "error", error: msg });
    throw new Error(`Stage 0 failed: ${msg}`);
  }

  // --- Stages 2 + 3 in parallel (YouTube + Research), with mode-based skips ---
  const youtubeTask = async (): Promise<PolicyFlag[]> => {
    emit({ stage: 2, name: "YouTube Policy", status: "running" });
    const ytResult = await callGPT(
      YOUTUBE_SYSTEM,
      buildYoutubePrompt(script, parsed, metadata)
    );
    const flags = safeJsonParse<PolicyFlag[]>(ytResult);
    await prisma.review.update({
      where: { id: reviewId },
      data: { youtubeFlags: flags as never[] },
    });
    emit({ stage: 2, name: "YouTube Policy", status: "complete", data: flags });
    return flags;
  };

  const researchTask = async (): Promise<ResearchFindings | null> => {
    emit({ stage: 3, name: "Case Research", status: "running" });
    const queries = buildCaseResearchQueries(parsed, metadata);
    const results: string[] = [];

    const sonarResults = await Promise.allSettled(
      queries.map((q) => callSonar(q))
    );
    for (const r of sonarResults) {
      if (r.status === "fulfilled") results.push(r.value);
    }

    const suspects = parsed.entities.filter((e) => e.role === "suspect");
    if (suspects.length > 0) {
      try {
        const dockets = await searchDockets(
          `${suspects[0].name} ${metadata.state}`
        );
        if (dockets?.results?.length > 0) {
          results.push(
            `Court records: ${JSON.stringify(dockets.results.slice(0, 3))}`
          );
        }
      } catch {
        // CourtListener is optional
      }
    }

    if (results.length === 0) {
      emit({ stage: 3, name: "Case Research", status: "complete", data: null });
      return null;
    }

    const synthResult = await callGPT(
      RESEARCH_SYNTHESIS_SYSTEM,
      buildResearchSynthesisPrompt(results, metadata)
    );
    const findings = safeJsonParse<ResearchFindings>(synthResult);
    await prisma.review.update({
      where: { id: reviewId },
      data: { researchData: findings as never },
    });
    emit({ stage: 3, name: "Case Research", status: "complete", data: findings });
    return findings;
  };

  const youtubePromise = runYouTube ? youtubeTask() : Promise.resolve<PolicyFlag[]>([]);
  const researchPromise = runResearch ? researchTask() : Promise.resolve<ResearchFindings | null>(null);

  if (!runYouTube) {
    emit({
      stage: 2,
      name: "YouTube Policy (Skipped)",
      status: "complete",
      data: null,
    });
  }
  if (!runResearch) {
    emit({
      stage: 3,
      name: "Case Research (Skipped)",
      status: "complete",
      data: null,
    });
  }

  const [youtubeResult, researchResult] = await Promise.allSettled([
    youtubePromise,
    researchPromise,
  ]);

  let policyFlags: PolicyFlag[] =
    youtubeResult.status === "fulfilled" ? youtubeResult.value : [];
  if (runYouTube) {
    policyFlags = mergePolicyFlags(policyFlags, heuristicPolicyFlags(script));
    policyFlags = mergePolicyFlags(
      policyFlags,
      videoFindingsToPolicyFlags(metadata.videoFindings ?? [])
    );
    policyFlags = dedupePolicyFlags(policyFlags);
    await prisma.review.update({
      where: { id: reviewId },
      data: { youtubeFlags: policyFlags as never[] },
    });
  }
  if (youtubeResult.status === "rejected") {
    emit({
      stage: 2,
      name: "YouTube Policy",
      status: "error",
      error: String(youtubeResult.reason),
    });
  }

  const research: ResearchFindings | null =
    researchResult.status === "fulfilled" ? researchResult.value : null;
  if (researchResult.status === "rejected") {
    emit({
      stage: 3,
      name: "Case Research",
      status: "error",
      error: String(researchResult.reason),
    });
  }

  // --- Stage 1: Legal Review — Multi-Model Cross-Validation ---
  let legalFlags: LegalFlag[] = [];
  if (runLegal) {
    emit({ stage: 1, name: "Legal Review (Cross-Check)", status: "running" });
    try {
      const stateLaw = await prisma.stateDefamationLaw.findFirst({
        where: {
          OR: [
            { state: { equals: metadata.state, mode: "insensitive" } },
            { abbrev: { equals: metadata.state, mode: "insensitive" } },
          ],
        },
      });

      const { flags, raw } = await runMultiModelLegalReview(
        script,
        parsed,
        metadata,
        (stateLaw as never) ?? { note: "State law not in database, use general US defamation principles" },
        research ?? undefined,
        metadata.documentFacts
      );

      legalFlags = flags;

      await prisma.review.update({
        where: { id: reviewId },
        data: {
          legalFlags: legalFlags as never[],
          legalCrossValidation: raw as never,
        },
      });
      emit({ stage: 1, name: "Legal Review (Cross-Check)", status: "complete", data: legalFlags });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Legal review failed";
      emit({ stage: 1, name: "Legal Review (Cross-Check)", status: "error", error: msg });
      legalFlags = [{
        text: "LEGAL REVIEW STAGE FAILED",
        person: "N/A",
        riskType: "defamation",
        severity: "severe",
        reasoning: `Legal analysis could not be completed: ${msg}. Manual legal review required.`,
        saferRewrite: "N/A",
        counselReview: true,
        confidence: 0,
      }];
    }
    legalFlags = mergeLegalFlags(legalFlags, heuristicLegalFlags(script));
    legalFlags = mergeLegalFlags(
      legalFlags,
      videoFindingsToLegalFlags(metadata.videoFindings ?? [])
    );
    legalFlags = dedupeLegalFlags(legalFlags);
    await prisma.review.update({
      where: { id: reviewId },
      data: {
        legalFlags: legalFlags as never[],
      },
    });
  } else {
    emit({
      stage: 1,
      name: "Legal Review (Skipped)",
      status: "complete",
      data: null,
    });
  }

  // --- Stage 4: Synthesis ---
  emit({ stage: 4, name: "Synthesis", status: "running" });
  let report: SynthesisReport;
  try {
    const synthResult = await callClaude(
      SYNTHESIS_SYSTEM,
      buildSynthesisPrompt(script, parsed, legalFlags, policyFlags, research, metadata)
    );
    try {
      report = safeJsonParse<SynthesisReport>(synthResult);
    } catch (parseErr) {
      // Second chance: repair malformed JSON via lightweight model before failing stage.
      const repaired = await callGPTMini(
        SYNTHESIS_REPAIR_SYSTEM,
        `Repair this malformed JSON so it parses strictly:\n\n${synthResult}`
      );
      try {
        report = safeJsonParse<SynthesisReport>(repaired);
      } catch {
        throw parseErr;
      }
    }
    // Inject the actual flags (prompt told Claude to return empty arrays to save tokens)
    report.legalFlags = legalFlags;
    report.policyFlags = policyFlags;
    report.criticalEdits = normalizeReportEdits(report.criticalEdits ?? [], {
      maxItems: 5,
      dropLowPriority: true,
    });
    report.recommendedEdits = normalizeReportEdits(report.recommendedEdits ?? [], {
      maxItems: 5,
      dropLowPriority: false,
    });
    report.videoTimeline = (metadata.videoFindings ?? []).filter(
      (f) => Array.isArray(f.risks) && f.risks.length > 0
    );
    // Keep monetization dashboard consistent with actual policy flags shown in UI.
    report.riskDashboard.monetization =
      deriveMonetizationFromPolicyFlags(policyFlags);
    await prisma.review.update({
      where: { id: reviewId },
      data: {
        synthesis: report as never,
        status: "completed",
        verdict: report.verdict,
        riskScore: report.riskScore,
      },
    });
    emit({ stage: 4, name: "Synthesis", status: "complete", data: report });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Synthesis failed";
    emit({ stage: 4, name: "Synthesis", status: "error", error: msg });
    report = {
      verdict: "borderline",
      riskScore: 50,
      summary: `Synthesis stage error: ${msg}. Review individual stage results below.`,
      riskDashboard: {
        communityGuidelines: legalFlags.length > 0 ? "medium" : "low",
        ageRestriction: "medium",
        monetization: policyFlags.length > 0 ? "limited_ads" : "full_ads",
        privacy: "medium",
        legal: legalFlags.some((f) => f.severity === "severe") ? "high" : "medium",
      },
      criticalEdits: [],
      recommendedEdits: [],
      edsaChecklist: [],
      videoTimeline: (metadata.videoFindings ?? []).filter(
        (f) => Array.isArray(f.risks) && f.risks.length > 0
      ),
      legalFlags,
      policyFlags,
    };
    await prisma.review.update({
      where: { id: reviewId },
      data: {
        synthesis: report as never,
        status: "completed",
        verdict: "borderline",
        riskScore: 50,
      },
    });
  }

  return report;
}
