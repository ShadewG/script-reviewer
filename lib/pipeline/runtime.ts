import { prisma } from "../db";
import type { ParsedScript, ResearchFindings } from "./types";

export interface StageLogInput {
  reviewId: string;
  stage: string;
  status: string;
  model?: string;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  promptHash?: string;
  cacheHit?: boolean;
  metadata?: Record<string, unknown>;
}

export async function recordStageLog(input: StageLogInput): Promise<void> {
  await prisma.stageLog.create({
    data: {
      reviewId: input.reviewId,
      stage: input.stage,
      status: input.status,
      model: input.model,
      durationMs: input.durationMs,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      promptHash: input.promptHash,
      cacheHit: input.cacheHit ?? false,
      metadata: input.metadata as never,
    },
  });
}

export async function recordFailedAnalysis(input: {
  reviewId?: string;
  stage?: string;
  error: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await prisma.failedAnalysis.create({
    data: {
      reviewId: input.reviewId,
      stage: input.stage,
      error: input.error,
      details: input.details as never,
    },
  });
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getResearchIdentity(parsed: ParsedScript): string[] {
  const names = parsed.entities
    .filter((entity) => entity.role === "suspect" || entity.role === "victim")
    .map((entity) => normalizeName(entity.name))
    .filter(Boolean);
  return [...new Set(names)].sort();
}

export function buildResearchCacheKey(input: {
  parsed: ParsedScript;
  state: string;
  caseStatus: string;
}): string {
  return [input.state.toLowerCase(), input.caseStatus.toLowerCase(), ...getResearchIdentity(input.parsed)].join("|");
}

export async function getCachedResearch(cacheKey: string): Promise<ResearchFindings | null> {
  const cached = await prisma.researchCache.findUnique({ where: { cacheKey } });
  if (!cached) return null;
  if (cached.expiresAt.getTime() <= Date.now()) return null;
  return (cached.synthesized as unknown as ResearchFindings) ?? null;
}

export async function saveResearchCache(input: {
  cacheKey: string;
  caseState: string;
  caseStatus: string;
  normalizedPeople: string[];
  queryCount: number;
  queries: string[];
  rawResults: string[];
  synthesized: ResearchFindings;
  ttlDays?: number;
}): Promise<void> {
  const ttlDays = input.ttlDays ?? 7;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  await prisma.researchCache.upsert({
    where: { cacheKey: input.cacheKey },
    update: {
      caseState: input.caseState,
      caseStatus: input.caseStatus,
      normalizedPeople: input.normalizedPeople as never,
      queryCount: input.queryCount,
      queries: input.queries as never,
      rawResults: input.rawResults as never,
      synthesized: input.synthesized as never,
      expiresAt,
    },
    create: {
      cacheKey: input.cacheKey,
      caseState: input.caseState,
      caseStatus: input.caseStatus,
      normalizedPeople: input.normalizedPeople as never,
      queryCount: input.queryCount,
      queries: input.queries as never,
      rawResults: input.rawResults as never,
      synthesized: input.synthesized as never,
      expiresAt,
    },
  });
}
