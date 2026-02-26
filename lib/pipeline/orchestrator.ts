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

function safeJsonParse<T>(text: string): T {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```[\w]*\s*\n?/, "").replace(/\n?```\s*$/, "");
  if (!cleaned.startsWith("[") && !cleaned.startsWith("{")) {
    const jsonMatch = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (jsonMatch) cleaned = jsonMatch[0];
  }
  return JSON.parse(cleaned) as T;
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

  // --- Stages 2 + 3 in parallel (YouTube + Research) ---
  emit({ stage: 2, name: "YouTube Policy", status: "running" });
  emit({ stage: 3, name: "Case Research", status: "running" });

  const [youtubeResult, researchResult] = await Promise.allSettled([
    // Stage 2: YouTube Policy
    (async () => {
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
    })(),

    // Stage 3: Case Research
    (async () => {
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
    })(),
  ]);

  const policyFlags: PolicyFlag[] =
    youtubeResult.status === "fulfilled" ? youtubeResult.value : [];
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
  emit({ stage: 1, name: "Legal Review (3-Model)", status: "running" });
  let legalFlags: LegalFlag[] = [];
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
      research ?? undefined
    );

    legalFlags = flags;

    await prisma.review.update({
      where: { id: reviewId },
      data: {
        legalFlags: legalFlags as never[],
        legalCrossValidation: raw as never,
      },
    });
    emit({ stage: 1, name: "Legal Review (3-Model)", status: "complete", data: legalFlags });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Legal review failed";
    emit({ stage: 1, name: "Legal Review (3-Model)", status: "error", error: msg });
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

  // --- Stage 4: Synthesis ---
  emit({ stage: 4, name: "Synthesis", status: "running" });
  let report: SynthesisReport;
  try {
    const synthResult = await callClaude(
      SYNTHESIS_SYSTEM,
      buildSynthesisPrompt(script, parsed, legalFlags, policyFlags, research, metadata)
    );
    report = safeJsonParse<SynthesisReport>(synthResult);
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
