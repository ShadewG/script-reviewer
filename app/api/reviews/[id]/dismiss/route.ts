import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import type { LegalFlag, PolicyFlag } from "@/lib/pipeline/types";

export const dynamic = "force-dynamic";

interface DismissedEntry {
  key: string;
  reason: string;
  at: number;
}

/* Severity weights for score adjustment */
const SEVERITY_WEIGHT: Record<string, number> = {
  severe: 12,
  high: 8,
  medium: 4,
  low: 2,
};

/* Impact multiplier for policy flags */
const IMPACT_MULTIPLIER: Record<string, number> = {
  removal_risk: 1.5,
  age_restricted: 1.3,
  no_ads: 1.2,
  limited_ads: 1.0,
  full_ads: 0.5,
};

function computeAdjustedScore(
  originalScore: number,
  legalFlags: LegalFlag[],
  policyFlags: PolicyFlag[],
  dismissedKeys: Set<string>,
  flagKeyFn: (type: string, line: number | undefined | null, text: string) => string,
): { riskScore: number; verdict: string } {
  /* Calculate total weight of ALL flags */
  let totalWeight = 0;
  let dismissedWeight = 0;

  for (const f of legalFlags) {
    const w = SEVERITY_WEIGHT[f.severity] ?? 4;
    const counselBonus = f.counselReview ? 4 : 0;
    const flagW = w + counselBonus;
    totalWeight += flagW;
    if (dismissedKeys.has(flagKeyFn("legal", f.line, f.text))) {
      dismissedWeight += flagW;
    }
  }

  for (const f of policyFlags) {
    const w = SEVERITY_WEIGHT[f.severity] ?? 4;
    const mult = IMPACT_MULTIPLIER[f.impact] ?? 1;
    const flagW = w * mult;
    totalWeight += flagW;
    if (dismissedKeys.has(flagKeyFn("policy", f.line, f.text))) {
      dismissedWeight += flagW;
    }
  }

  if (totalWeight === 0 || dismissedWeight === 0) {
    return { riskScore: originalScore, verdict: deriveVerdict(originalScore) };
  }

  /* Reduce score proportionally to dismissed weight */
  const reductionRatio = dismissedWeight / totalWeight;
  const adjusted = Math.round(originalScore * (1 - reductionRatio));
  const clamped = Math.max(0, Math.min(100, adjusted));

  return { riskScore: clamped, verdict: deriveVerdict(clamped) };
}

function deriveVerdict(score: number): string {
  if (score <= 30) return "publishable";
  if (score <= 60) return "borderline";
  return "not_publishable";
}

function simpleHash(text: string): string {
  let hash = 0;
  const str = text.slice(0, 120);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}

function flagKeyFn(type: string, line: number | undefined | null, text: string): string {
  return `${type}:${line ?? "na"}:${simpleHash(text)}`;
}

/**
 * POST /api/reviews/[id]/dismiss
 * Body: { dismissed: DismissedEntry[] }
 * Returns: { riskScore, verdict, originalRiskScore, originalVerdict, dismissedFlags }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const dismissed: DismissedEntry[] = body.dismissed;

  if (!Array.isArray(dismissed)) {
    return Response.json({ error: "dismissed must be an array" }, { status: 400 });
  }

  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  /* Preserve original score on first dismissal */
  const originalRiskScore = review.originalRiskScore ?? review.riskScore ?? 0;
  const originalVerdict = review.originalVerdict ?? review.verdict ?? "borderline";

  /* Get flags from the review data */
  const synthesis = review.synthesis as Record<string, unknown> | null;
  const legalFlags = ((synthesis?.legalFlags ?? review.legalFlags) as LegalFlag[]) || [];
  const policyFlags = ((synthesis?.policyFlags ?? review.youtubeFlags) as PolicyFlag[]) || [];

  /* Build dismissed key set */
  const dismissedKeys = new Set(dismissed.map((d) => d.key));

  /* Compute adjusted score */
  const { riskScore, verdict } = dismissed.length > 0
    ? computeAdjustedScore(originalRiskScore, legalFlags, policyFlags, dismissedKeys, flagKeyFn)
    : { riskScore: originalRiskScore, verdict: originalVerdict };

  /* Persist */
  const updated = await prisma.review.update({
    where: { id },
    data: {
      dismissedFlags: dismissed as never,
      originalRiskScore,
      originalVerdict,
      riskScore,
      verdict,
    },
    select: {
      id: true,
      riskScore: true,
      verdict: true,
      originalRiskScore: true,
      originalVerdict: true,
      dismissedFlags: true,
    },
  });

  return Response.json(updated);
}
