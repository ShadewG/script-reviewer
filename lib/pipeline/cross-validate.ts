import { callClaude } from "../ai/anthropic";
import { callGPT } from "../ai/openai";
import { callSonarLegal } from "../ai/perplexity";
import {
  LEGAL_SYSTEM,
  buildLegalPrompt,
  buildLegalPromptForPerplexity,
} from "../prompts/legal-review";
import type {
  ParsedScript,
  CaseMetadata,
  LegalFlag,
  ResearchFindings,
} from "./types";

function safeJsonParse<T>(text: string): T {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```[\w]*\s*\n?/, "").replace(/\n?```\s*$/, "");
  if (!cleaned.startsWith("[") && !cleaned.startsWith("{")) {
    const jsonMatch = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (jsonMatch) cleaned = jsonMatch[0];
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    let fixed = cleaned.replace(/,\s*$/, "");
    const opens = (fixed.match(/\[/g) || []).length;
    const closes = (fixed.match(/\]/g) || []).length;
    const braceOpens = (fixed.match(/\{/g) || []).length;
    const braceCloses = (fixed.match(/\}/g) || []).length;
    for (let i = 0; i < braceOpens - braceCloses; i++) fixed += "}";
    for (let i = 0; i < opens - closes; i++) fixed += "]";
    try {
      return JSON.parse(fixed) as T;
    } catch {
      throw e;
    }
  }
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter(Boolean);
}

function tokenOverlap(a: string, b: string): number {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++;
  }
  return overlap / Math.min(tokensA.size, tokensB.size);
}

function flagsMatch(a: LegalFlag, b: LegalFlag): boolean {
  // Same person (case-insensitive)
  if (a.person.toLowerCase() !== b.person.toLowerCase()) return false;
  // Same or adjacent risk type
  const adjacent: Record<string, string[]> = {
    defamation: ["defamation", "false_light"],
    false_light: ["false_light", "defamation"],
    privacy: ["privacy", "appropriation"],
    appropriation: ["appropriation", "privacy"],
  };
  const riskMatch =
    a.riskType === b.riskType ||
    adjacent[a.riskType]?.includes(b.riskType);
  if (!riskMatch) return false;
  // Text overlap > 40%
  return tokenOverlap(a.text, b.text) > 0.4;
}

const SEV_ORDER = ["low", "medium", "high", "severe"] as const;
type Severity = (typeof SEV_ORDER)[number];

function sevIndex(s: string): number {
  return SEV_ORDER.indexOf(s as Severity);
}

function downgradeSeverity(s: string): Severity {
  const idx = sevIndex(s);
  return SEV_ORDER[Math.max(0, idx - 1)];
}

function medianSeverity(severities: string[]): Severity {
  const indices = severities.map(sevIndex).sort((a, b) => a - b);
  return SEV_ORDER[indices[Math.floor(indices.length / 2)]];
}

export interface CrossValidatedLegalFlag extends LegalFlag {
  agreementCount: number;
  models: string[];
  originalSeverities: Record<string, string>;
  crossValidated: true;
}

export interface CrossValidationRaw {
  claude: LegalFlag[];
  gpt: LegalFlag[];
  perplexity: LegalFlag[];
}

export function mergeFlags(
  claudeFlags: LegalFlag[],
  gptFlags: LegalFlag[],
  perplexityFlags: LegalFlag[]
): { merged: CrossValidatedLegalFlag[]; raw: CrossValidationRaw } {
  const raw: CrossValidationRaw = {
    claude: claudeFlags,
    gpt: gptFlags,
    perplexity: perplexityFlags,
  };

  // Normalize flags — fill defaults for missing fields
  function normalize(f: LegalFlag): LegalFlag {
    return {
      ...f,
      reasoning: f.reasoning ?? "",
      saferRewrite: f.saferRewrite ?? "",
      person: f.person ?? "Unknown",
      confidence: f.confidence ?? 0.5,
      counselReview: f.counselReview ?? false,
    };
  }

  const allFlags: Array<{ flag: LegalFlag; model: string }> = [
    ...claudeFlags.map((f) => ({ flag: normalize(f), model: "claude" })),
    ...gptFlags.map((f) => ({ flag: normalize(f), model: "gpt" })),
    ...perplexityFlags.map((f) => ({ flag: normalize(f), model: "perplexity" })),
  ];

  // Group matching flags (transitive: check against any group member)
  const used = new Set<number>();
  const groups: Array<Array<{ flag: LegalFlag; model: string }>> = [];

  for (let i = 0; i < allFlags.length; i++) {
    if (used.has(i)) continue;
    const group = [allFlags[i]];
    used.add(i);

    for (let j = i + 1; j < allFlags.length; j++) {
      if (used.has(j)) continue;
      if (group.some((g) => g.model === allFlags[j].model)) continue;
      // Transitive: match against ANY member in the group
      if (group.some((g) => flagsMatch(g.flag, allFlags[j].flag))) {
        group.push(allFlags[j]);
        used.add(j);
      }
    }
    groups.push(group);
  }

  const merged: CrossValidatedLegalFlag[] = groups.map((group) => {
    const models = group.map((g) => g.model);
    const agreementCount = models.length;
    const originalSeverities: Record<string, string> = {};
    for (const g of group) {
      originalSeverities[g.model] = g.flag.severity;
    }

    // Pick the most detailed flag as the base
    const base = group.reduce((best, g) =>
      g.flag.reasoning.length > best.flag.reasoning.length ? g : best
    ).flag;

    // Calculate severity
    let severity: Severity;
    if (agreementCount >= 2) {
      severity = medianSeverity(group.map((g) => g.flag.severity));
    } else {
      // Single model — downgrade
      severity = base.severity === "severe"
        ? "high"
        : downgradeSeverity(base.severity);
    }

    // Confidence boost from agreement
    const avgConfidence =
      group.reduce((sum, g) => sum + g.flag.confidence, 0) / group.length;
    const confidence = Math.min(
      1,
      avgConfidence * (0.7 + 0.15 * agreementCount)
    );

    // Combine reasoning
    const allReasonings = group.map(
      (g) => `[${g.model.toUpperCase()}] ${g.flag.reasoning}`
    );

    // counselReview if ANY model says so
    const counselReview = group.some((g) => g.flag.counselReview);

    // Best safer rewrite (longest)
    const saferRewrite = group.reduce((best, g) =>
      g.flag.saferRewrite.length > best.length ? g.flag.saferRewrite : best
    , base.saferRewrite);

    return {
      ...base,
      severity,
      confidence,
      counselReview,
      saferRewrite,
      reasoning: allReasonings.join("\n\n"),
      agreementCount,
      models,
      originalSeverities,
      crossValidated: true as const,
    };
  });

  // Sort by severity (severe first)
  merged.sort((a, b) => sevIndex(b.severity) - sevIndex(a.severity));

  return { merged, raw };
}

export async function runMultiModelLegalReview(
  script: string,
  parsed: ParsedScript,
  metadata: CaseMetadata,
  stateLaw: Record<string, unknown>,
  research?: ResearchFindings
): Promise<{ flags: CrossValidatedLegalFlag[]; raw: CrossValidationRaw }> {
  const legalPrompt = buildLegalPrompt(
    script,
    parsed,
    metadata,
    stateLaw,
    research
  );
  const perplexityPrompt = buildLegalPromptForPerplexity(
    script,
    parsed,
    metadata,
    stateLaw,
    research
  );

  const [claudeResult, gptResult, perplexityResult] =
    await Promise.allSettled([
      callClaude(LEGAL_SYSTEM, legalPrompt),
      callGPT(LEGAL_SYSTEM, legalPrompt),
      callSonarLegal(perplexityPrompt),
    ]);

  const claudeFlags: LegalFlag[] =
    claudeResult.status === "fulfilled"
      ? safeJsonParse<LegalFlag[]>(claudeResult.value)
      : [];
  const gptFlags: LegalFlag[] =
    gptResult.status === "fulfilled"
      ? safeJsonParse<LegalFlag[]>(gptResult.value)
      : [];
  const perplexityFlags: LegalFlag[] =
    perplexityResult.status === "fulfilled"
      ? (() => {
          try {
            return safeJsonParse<LegalFlag[]>(perplexityResult.value);
          } catch {
            return [];
          }
        })()
      : [];

  // If all three models failed, throw so orchestrator can handle it
  if (
    claudeResult.status === "rejected" &&
    gptResult.status === "rejected" &&
    perplexityResult.status === "rejected"
  ) {
    throw new Error(
      `All 3 legal models failed: Claude: ${claudeResult.reason}, GPT: ${gptResult.reason}, Perplexity: ${perplexityResult.reason}`
    );
  }

  const { merged, raw } = mergeFlags(claudeFlags, gptFlags, perplexityFlags);
  return { flags: merged, raw };
}
