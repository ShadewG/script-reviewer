import {
  callGPTMiniDetailed,
  callGPTDetailed,
} from "../ai/openai";
import { callClaudeDetailed } from "../ai/anthropic";
import { callSonarDetailed } from "../ai/perplexity";
import { hashPrompt } from "../ai/shared";
import { searchDockets } from "../ai/courtlistener";
import { PARSER_SYSTEM, buildParserPrompt } from "../prompts/parser";
import { LEGAL_SYSTEM, buildLegalPrompt } from "../prompts/legal-review";
import { YOUTUBE_SYSTEM, buildYoutubePrompt } from "../prompts/youtube-policy";
import {
  buildCaseResearchQueries,
  RESEARCH_SYNTHESIS_SYSTEM,
  buildResearchSynthesisPrompt,
} from "../prompts/case-research";
import {
  FACT_CHECK_SYSTEM,
  buildFactCheckPrompt,
  selectClaimsForFactCheck,
} from "../prompts/fact-check";
import { SYNTHESIS_SYSTEM, buildSynthesisPrompt } from "../prompts/synthesis";
import { clusterVideoFindings } from "../video/cluster";
import { collapseVideoRisks } from "../video/risk-family";
import { runMultiModelLegalReview } from "./cross-validate";
import {
  heuristicLegalFlags,
  heuristicPolicyFlags,
  videoFindingsToLegalFlags,
  videoFindingsToPolicyFlags,
} from "./heuristics";
import { prisma } from "../db";
import {
  buildResearchCacheKey,
  getCachedResearch,
  getResearchIdentity,
  recordFailedAnalysis,
  recordStageLog,
  saveResearchCache,
} from "./runtime";
import type {
  CaseMetadata,
  ParsedScript,
  LegalFlag,
  PolicyFlag,
  ResearchFindings,
  FactCheckReport,
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

async function parseJsonWithRepair<T>(text: string): Promise<T> {
  try {
    return safeJsonParse<T>(text);
  } catch (parseErr) {
    const repaired = await callGPTDetailed(
      SYNTHESIS_REPAIR_SYSTEM,
      `Repair this malformed JSON so it parses strictly:\n\n${text}`
    );
    try {
      return safeJsonParse<T>(repaired.text);
    } catch {
      throw parseErr;
    }
  }
}

async function parseSynthesisResponse(text: string): Promise<SynthesisReport> {
  return parseJsonWithRepair<SynthesisReport>(text);
}

function isParsedScript(value: unknown): value is ParsedScript {
  return !!value && typeof value === "object" && Array.isArray((value as ParsedScript).entities);
}

function isResearchFindings(value: unknown): value is ResearchFindings {
  return (
    !!value &&
    typeof value === "object" &&
    Array.isArray((value as ResearchFindings).personProfiles) &&
    Array.isArray((value as ResearchFindings).courtRecords)
  );
}

function isFactCheckReport(value: unknown): value is FactCheckReport {
  return (
    !!value &&
    typeof value === "object" &&
    Array.isArray((value as FactCheckReport).findings)
  );
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeParsedScript(value: ParsedScript): ParsedScript {
  return {
    entities: Array.isArray(value.entities) ? value.entities : [],
    profanity: Array.isArray(value.profanity) ? value.profanity : [],
    graphicContent: Array.isArray(value.graphicContent) ? value.graphicContent : [],
    claims: Array.isArray(value.claims) ? value.claims : [],
    locations: asStringArray(value.locations),
    dates: asStringArray(value.dates),
    timeline: asStringArray(value.timeline),
  };
}

function normalizeResearchFindings(value: ResearchFindings): ResearchFindings {
  return {
    caseStatus: typeof value.caseStatus === "string" ? value.caseStatus : "",
    caseJurisdiction:
      typeof value.caseJurisdiction === "string" ? value.caseJurisdiction : undefined,
    caseNumbers: asStringArray(value.caseNumbers),
    personProfiles: Array.isArray(value.personProfiles) ? value.personProfiles : [],
    courtRecords: asStringArray(value.courtRecords),
    keyCitations: asStringArray(value.keyCitations),
  };
}

function normalizeFactCheckReport(value: FactCheckReport): FactCheckReport {
  return {
    summary: typeof value.summary === "string" ? value.summary : "",
    findings: Array.isArray(value.findings) ? value.findings : [],
  };
}

function normalizePolicyFlagArray(value: unknown): PolicyFlag[] {
  if (Array.isArray(value)) {
    return value as PolicyFlag[];
  }
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { flags?: unknown[] }).flags)
  ) {
    return (value as { flags: PolicyFlag[] }).flags;
  }
  return [];
}

async function runFactCheckStage(args: {
  reviewId: string;
  script: string;
  parsed: ParsedScript;
  metadata: CaseMetadata;
  research: ResearchFindings | null;
  existing: FactCheckReport | null;
  emit: (update: StageUpdate) => void;
}): Promise<FactCheckReport | null> {
  const { reviewId, script, parsed, metadata, research, existing, emit } = args;

  if (existing && existing.findings.length > 0) {
    emit({
      stage: 3,
      name: "Case Research + Fact Check",
      status: "complete",
      data: existing,
    });
    return existing;
  }

  const candidateClaims = selectClaimsForFactCheck(parsed, script);
  if (candidateClaims.length === 0) {
    return null;
  }

  emit({ stage: 3, name: "Case Research + Fact Check", status: "running" });

  const initialPrompt = buildFactCheckPrompt({
    script,
    parsed,
    metadata,
    research,
    documentFacts: metadata.documentFacts,
    candidateClaims,
  });
  const initialPromptHash = hashPrompt(FACT_CHECK_SYSTEM, initialPrompt);
  const factCheckStart = Date.now();
  const initial = await callGPTMiniDetailed(FACT_CHECK_SYSTEM, initialPrompt);
  let report = normalizeFactCheckReport(
    await parseJsonWithRepair<FactCheckReport>(initial.text)
  );
  await recordStageLog({
    reviewId,
    stage: "fact_check",
    model: initial.model,
    status: "complete",
    durationMs: Date.now() - factCheckStart,
    inputTokens: initial.usage?.inputTokens,
    outputTokens: initial.usage?.outputTokens,
    promptHash: initialPromptHash,
    metadata: { candidateCount: candidateClaims.length },
  });

  const unresolved = report.findings
    .filter((finding) => finding.verdict === "needs_external_verification")
    .slice(0, 4);

  if (unresolved.length > 0) {
    const externalChecks: Array<{ claim: string; result: string }> = [];
    for (const finding of unresolved) {
      const externalPrompt = `Fact-check this claim for a ${metadata.state} criminal case and focus on public-record verifiable facts such as jurisdiction, conviction status, sentencing, appeals, and named-party involvement:\n\n${finding.claim}`;
      const promptHash = hashPrompt("external_fact_check", externalPrompt);
      const startedAt = Date.now();
      const result = await callSonarDetailed(externalPrompt);
      externalChecks.push({ claim: finding.claim, result: result.text });
      await recordStageLog({
        reviewId,
        stage: "fact_check_external",
        model: result.model,
        status: "complete",
        durationMs: Date.now() - startedAt,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
        promptHash,
      });
    }

    const finalPrompt = buildFactCheckPrompt({
      script,
      parsed,
      metadata,
      research,
      documentFacts: metadata.documentFacts,
      candidateClaims,
      externalChecks,
    });
    const finalPromptHash = hashPrompt(FACT_CHECK_SYSTEM, finalPrompt);
    const finalStart = Date.now();
    const finalResult = await callGPTMiniDetailed(FACT_CHECK_SYSTEM, finalPrompt);
    report = normalizeFactCheckReport(
      await parseJsonWithRepair<FactCheckReport>(finalResult.text)
    );
    await recordStageLog({
      reviewId,
      stage: "fact_check_finalize",
      model: finalResult.model,
      status: "complete",
      durationMs: Date.now() - finalStart,
      inputTokens: finalResult.usage?.inputTokens,
      outputTokens: finalResult.usage?.outputTokens,
      promptHash: finalPromptHash,
      metadata: { externalChecks: unresolved.length },
    });
  }

  await prisma.review.update({
    where: { id: reviewId },
    data: { factCheckData: report as never },
  });
  emit({
    stage: 3,
    name: "Case Research + Fact Check",
    status: "complete",
    data: report,
  });
  return report;
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
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) {
    throw new Error(`Review not found: ${reviewId}`);
  }

  const documentFacts = metadata.documentFacts ??
    (Array.isArray(review.supplementalDocs) ? (review.supplementalDocs as unknown as DocumentFacts[]) : undefined);
  const videoFindings = metadata.videoFindings ??
    (Array.isArray(review.videoFindings) ? (review.videoFindings as unknown as CaseMetadata["videoFindings"]) : undefined);
  const enrichedMetadata: CaseMetadata = {
    ...metadata,
    documentFacts,
    videoFindings,
    videoTranscript: metadata.videoTranscript ?? review.videoTranscript ?? undefined,
  };
  const clusteredVideoFindings = clusterVideoFindings(enrichedMetadata.videoFindings ?? []);
  const normalizedVideoTimeline = clusteredVideoFindings
    .filter((f) => Array.isArray(f.risks) && f.risks.length > 0)
    .map((finding) => ({
      ...finding,
      risks: collapseVideoRisks(finding.risks ?? []),
    }));

  const warnings = asStringArray(review.analysisWarnings);
  const addWarning = (warning: string) => {
    if (!warnings.includes(warning)) {
      warnings.push(warning);
    }
  };

  if (review.status === "completed" && review.synthesis) {
    return review.synthesis as unknown as SynthesisReport;
  }

  // --- Stage 0: Parse ---
  let parsed: ParsedScript;
  if (isParsedScript(review.parsedEntities)) {
    parsed = normalizeParsedScript(review.parsedEntities);
    emit({ stage: 0, name: "Script Parser", status: "complete", data: parsed });
  } else {
    emit({ stage: 0, name: "Script Parser", status: "running" });
    try {
      const parserPrompt = buildParserPrompt(script);
      const promptHash = hashPrompt(PARSER_SYSTEM, parserPrompt);
      const startedAt = Date.now();
      const parseResult = await callGPTMiniDetailed(PARSER_SYSTEM, parserPrompt);
      parsed = normalizeParsedScript(
        await parseJsonWithRepair<ParsedScript>(parseResult.text)
      );
      await prisma.review.update({
        where: { id: reviewId },
        data: { parsedEntities: parsed as never },
      });
      await recordStageLog({
        reviewId,
        stage: "parser",
        model: parseResult.model,
        status: "complete",
        durationMs: Date.now() - startedAt,
        inputTokens: parseResult.usage?.inputTokens,
        outputTokens: parseResult.usage?.outputTokens,
        promptHash,
      });
      emit({ stage: 0, name: "Script Parser", status: "complete", data: parsed });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Parse failed";
      await recordFailedAnalysis({
        reviewId,
        stage: "parser",
        error: msg,
      });
      emit({ stage: 0, name: "Script Parser", status: "error", error: msg });
      throw new Error(`Stage 0 failed: ${msg}`);
    }
  }

  const persistedPolicyFlags = Array.isArray(review.youtubeFlags)
    ? normalizePolicyFlagArray(review.youtubeFlags)
    : null;
  const persistedResearch = isResearchFindings(review.researchData)
    ? normalizeResearchFindings(review.researchData as unknown as ResearchFindings)
    : null;
  const persistedFactCheck = isFactCheckReport(review.factCheckData)
    ? normalizeFactCheckReport(review.factCheckData as unknown as FactCheckReport)
    : null;
  const persistedLegalFlags = Array.isArray(review.legalFlags)
    ? (review.legalFlags as unknown as LegalFlag[])
    : null;

  // --- Stages 2 + 3 in parallel (YouTube + Research), with mode-based skips ---
  const youtubeTask = async (): Promise<PolicyFlag[]> => {
    if (persistedPolicyFlags) {
      emit({ stage: 2, name: "YouTube Policy", status: "complete", data: persistedPolicyFlags });
      return persistedPolicyFlags;
    }

    emit({ stage: 2, name: "YouTube Policy", status: "running" });
    const prompt = buildYoutubePrompt(script, parsed, enrichedMetadata);
    const promptHash = hashPrompt(YOUTUBE_SYSTEM, prompt);
    const startedAt = Date.now();
    const ytResult = await callGPTDetailed(YOUTUBE_SYSTEM, prompt);
    const rawFlags = normalizePolicyFlagArray(
      await parseJsonWithRepair<unknown>(ytResult.text)
    );
      const finalFlags = dedupePolicyFlags(
        mergePolicyFlags(
          mergePolicyFlags(rawFlags, heuristicPolicyFlags(script)),
          videoFindingsToPolicyFlags(clusteredVideoFindings)
        )
      );
    await prisma.review.update({
      where: { id: reviewId },
      data: { youtubeFlags: finalFlags as never[] },
    });
    await recordStageLog({
      reviewId,
      stage: "youtube_policy",
      model: ytResult.model,
      status: "complete",
      durationMs: Date.now() - startedAt,
      inputTokens: ytResult.usage?.inputTokens,
      outputTokens: ytResult.usage?.outputTokens,
      promptHash,
    });
    emit({ stage: 2, name: "YouTube Policy", status: "complete", data: finalFlags });
    return finalFlags;
  };

  const researchTask = async (): Promise<ResearchFindings | null> => {
    if (persistedResearch) {
      emit({ stage: 3, name: "Case Research", status: "complete", data: persistedResearch });
      return persistedResearch;
    }

    emit({ stage: 3, name: "Case Research", status: "running" });
    const queries = buildCaseResearchQueries(parsed, enrichedMetadata);
    const cacheKey = buildResearchCacheKey({
      parsed,
      state: enrichedMetadata.state,
      caseStatus: enrichedMetadata.caseStatus,
    });
    const cached = await getCachedResearch(cacheKey);
    if (cached) {
      await prisma.review.update({
        where: { id: reviewId },
        data: { researchData: cached as never },
      });
      await recordStageLog({
        reviewId,
        stage: "research",
        model: "cache",
        status: "complete",
        cacheHit: true,
        metadata: { queryCount: queries.length },
      });
      emit({ stage: 3, name: "Case Research", status: "complete", data: cached });
      return cached;
    }

    const results: string[] = [];
    for (const query of queries) {
      try {
        const startedAt = Date.now();
        const promptHash = hashPrompt("research_query", query);
        const result = await callSonarDetailed(query);
        results.push(result.text);
        await recordStageLog({
          reviewId,
          stage: "research_query",
          model: result.model,
          status: "complete",
          durationMs: Date.now() - startedAt,
          inputTokens: result.usage?.inputTokens,
          outputTokens: result.usage?.outputTokens,
          promptHash,
        });
      } catch (err) {
        await recordStageLog({
          reviewId,
          stage: "research_query",
          model: "sonar-pro",
          status: "error",
          promptHash: hashPrompt("research_query", query),
          metadata: { error: String(err) },
        });
      }
    }

    const suspects = parsed.entities.filter((e) => e.role === "suspect").slice(0, 2);
    for (const suspect of suspects) {
      try {
        const dockets = await searchDockets(`${suspect.name} ${enrichedMetadata.state}`);
        if (dockets?.results?.length > 0) {
          const links = dockets.results.slice(0, 5).map((item: Record<string, unknown>) => {
            const title = typeof item.caseName === "string" ? item.caseName : "Court docket";
            const url = typeof item.absolute_url === "string" ? item.absolute_url : "";
            return `${title}${url ? ` — ${url}` : ""}`;
          });
          results.push(`Court records for ${suspect.name}: ${links.join(" | ")}`);
        }
      } catch {
        // CourtListener remains best-effort.
      }
    }

    if (results.length === 0) {
      emit({ stage: 3, name: "Case Research", status: "complete", data: null });
      return null;
    }

    const synthPrompt = buildResearchSynthesisPrompt(results, enrichedMetadata);
    const promptHash = hashPrompt(RESEARCH_SYNTHESIS_SYSTEM, synthPrompt);
    const startedAt = Date.now();
    const synthResult = await callGPTDetailed(RESEARCH_SYNTHESIS_SYSTEM, synthPrompt);
    const findings = normalizeResearchFindings(
      await parseJsonWithRepair<ResearchFindings>(synthResult.text)
    );
    await prisma.review.update({
      where: { id: reviewId },
      data: { researchData: findings as never },
    });
    await saveResearchCache({
      cacheKey,
      caseState: enrichedMetadata.state,
      caseStatus: enrichedMetadata.caseStatus,
      normalizedPeople: getResearchIdentity(parsed),
      queryCount: queries.length,
      queries,
      rawResults: results,
      synthesized: findings,
    });
    await recordStageLog({
      reviewId,
      stage: "research_synthesis",
      model: synthResult.model,
      status: "complete",
      durationMs: Date.now() - startedAt,
      inputTokens: synthResult.usage?.inputTokens,
      outputTokens: synthResult.usage?.outputTokens,
      promptHash,
      metadata: { queryCount: queries.length },
    });
    emit({ stage: 3, name: "Case Research", status: "complete", data: findings });
    return findings;
  };

  const youtubePromise = runYouTube
    ? youtubeTask()
    : Promise.resolve<PolicyFlag[]>([]);
  const researchPromise = runResearch
    ? researchTask()
    : Promise.resolve<ResearchFindings | null>(null);

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
  if (youtubeResult.status === "rejected") {
    const error = String(youtubeResult.reason);
    addWarning(`YouTube policy stage degraded: ${error}`);
    await recordFailedAnalysis({
      reviewId,
      stage: "youtube_policy",
      error,
    });
    emit({
      stage: 2,
      name: "YouTube Policy",
      status: "error",
      error,
    });
    policyFlags = dedupePolicyFlags(
      mergePolicyFlags(
        heuristicPolicyFlags(script),
        videoFindingsToPolicyFlags(clusteredVideoFindings)
      )
    );
    await prisma.review.update({
      where: { id: reviewId },
      data: { youtubeFlags: policyFlags as never[] },
    });
  }

  const research: ResearchFindings | null =
    researchResult.status === "fulfilled" ? researchResult.value : null;
  if (researchResult.status === "rejected") {
    const error = String(researchResult.reason);
    addWarning(`Case research stage degraded: ${error}`);
    await recordFailedAnalysis({
      reviewId,
      stage: "research",
      error,
    });
    emit({
      stage: 3,
      name: "Case Research",
      status: "error",
      error,
    });
  }

  let factCheck: FactCheckReport | null = null;
  if (runResearch) {
    try {
      factCheck = await runFactCheckStage({
        reviewId,
        script,
        parsed,
        metadata: enrichedMetadata,
        research,
        existing: persistedFactCheck,
        emit,
      });
    } catch (err) {
      const error = String(err);
      addWarning(`Fact-check stage degraded: ${error}`);
      await recordFailedAnalysis({
        reviewId,
        stage: "fact_check",
        error,
      });
    }
  }

  // --- Stage 1: Legal Review — Multi-Model Cross-Validation ---
  let legalFlags: LegalFlag[] = [];
  if (runLegal) {
    if (persistedLegalFlags) {
      legalFlags = persistedLegalFlags;
      emit({ stage: 1, name: "Legal Review (Cross-Check)", status: "complete", data: legalFlags });
    } else {
      emit({ stage: 1, name: "Legal Review (Cross-Check)", status: "running" });
      try {
        const stateLaw = await prisma.stateDefamationLaw.findFirst({
          where: {
            OR: [
              { state: { equals: enrichedMetadata.state, mode: "insensitive" } },
              { abbrev: { equals: enrichedMetadata.state, mode: "insensitive" } },
            ],
          },
        });
        const legalPrompt = buildLegalPrompt(
          script,
          parsed,
          enrichedMetadata,
          (stateLaw as never) ?? { note: "State law not in database, use general US defamation principles" },
          research ?? undefined,
          enrichedMetadata.documentFacts,
          factCheck
        );
        const promptHash = hashPrompt(LEGAL_SYSTEM, legalPrompt);
        const startedAt = Date.now();
        const { flags, raw, warnings: legalWarnings, audits } =
          await runMultiModelLegalReview(
            script,
            parsed,
            enrichedMetadata,
            (stateLaw as never) ?? {
              note: "State law not in database, use general US defamation principles",
            },
            research ?? undefined,
            enrichedMetadata.documentFacts,
            factCheck
          );
        legalFlags = flags;
        for (const warning of legalWarnings) {
          addWarning(warning);
        }
        for (const audit of audits) {
          await recordStageLog({
            reviewId,
            stage: "legal_review_model",
            model: audit.model,
            status: audit.status,
            inputTokens: audit.inputTokens,
            outputTokens: audit.outputTokens,
            promptHash,
            metadata: audit.error ? { error: audit.error } : undefined,
          });
        }
        await recordStageLog({
          reviewId,
          stage: "legal_review",
          status: "complete",
          durationMs: Date.now() - startedAt,
          promptHash,
          metadata: { flags: legalFlags.length },
        });
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
        addWarning(`Legal review stage degraded: ${msg}`);
        await recordStageLog({
          reviewId,
          stage: "legal_review",
          status: "error",
          metadata: { error: msg },
        });
        await recordFailedAnalysis({
          reviewId,
          stage: "legal_review",
          error: msg,
        });
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
        videoFindingsToLegalFlags(clusteredVideoFindings)
      );
      legalFlags = dedupeLegalFlags(legalFlags);
      await prisma.review.update({
        where: { id: reviewId },
        data: {
          legalFlags: legalFlags as never[],
        },
      });
    }
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
    const synthesisPrompt = buildSynthesisPrompt(
      script,
      parsed,
      legalFlags,
      policyFlags,
      research,
      enrichedMetadata,
      factCheck
    );
    const promptHash = hashPrompt(SYNTHESIS_SYSTEM, synthesisPrompt);
    try {
      const startedAt = Date.now();
      const synthResult = await callClaudeDetailed(SYNTHESIS_SYSTEM, synthesisPrompt);
      report = await parseSynthesisResponse(synthResult.text);
      await recordStageLog({
        reviewId,
        stage: "synthesis",
        model: synthResult.model,
        status: "complete",
        durationMs: Date.now() - startedAt,
        inputTokens: synthResult.usage?.inputTokens,
        outputTokens: synthResult.usage?.outputTokens,
        promptHash,
      });
    } catch (claudeErr) {
      const warning = `Synthesis fallback: Claude failed and GPT was used instead. ${String(claudeErr)}`;
      addWarning(warning);
      const startedAt = Date.now();
      const fallbackResult = await callGPTDetailed(SYNTHESIS_SYSTEM, synthesisPrompt);
      report = await parseSynthesisResponse(fallbackResult.text);
      await recordStageLog({
        reviewId,
        stage: "synthesis",
        model: fallbackResult.model,
        status: "complete",
        durationMs: Date.now() - startedAt,
        inputTokens: fallbackResult.usage?.inputTokens,
        outputTokens: fallbackResult.usage?.outputTokens,
        promptHash,
        metadata: { fallbackFrom: "claude-opus-4-6" },
      });
      emit({
        stage: 4,
        name: "Synthesis",
        status: "running",
        data: {
          fallbackModel: "gpt",
          reason:
            claudeErr instanceof Error ? claudeErr.message : String(claudeErr),
        },
      });
    }
    report.legalFlags = legalFlags;
    report.policyFlags = policyFlags;
    report.analysisWarnings = warnings;
    report.criticalEdits = normalizeReportEdits(report.criticalEdits ?? [], {
      maxItems: 5,
      dropLowPriority: true,
    });
    report.recommendedEdits = normalizeReportEdits(report.recommendedEdits ?? [], {
      maxItems: 5,
      dropLowPriority: false,
    });
    report.videoTimeline = normalizedVideoTimeline;
    report.riskDashboard.monetization =
      deriveMonetizationFromPolicyFlags(policyFlags);
    await prisma.review.update({
      where: { id: reviewId },
      data: {
        synthesis: report as never,
        status: "completed",
        verdict: report.verdict,
        riskScore: report.riskScore,
        analysisWarnings: warnings as never,
      },
    });
    emit({ stage: 4, name: "Synthesis", status: "complete", data: report });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Synthesis failed";
    await recordFailedAnalysis({
      reviewId,
      stage: "synthesis",
      error: msg,
    });
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
      analysisWarnings: warnings,
      videoTimeline: normalizedVideoTimeline,
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
        analysisWarnings: warnings as never,
      },
    });
  }

  return report;
}
