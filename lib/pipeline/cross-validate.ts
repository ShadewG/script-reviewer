import { callClaudeDetailed } from "../ai/anthropic";
import { callGPTDetailed } from "../ai/openai";
import {
  LEGAL_SYSTEM,
  buildLegalPrompt,
} from "../prompts/legal-review";
import type {
  ParsedScript,
  CaseMetadata,
  LegalFlag,
  ResearchFindings,
  FactCheckReport,
} from "./types";
import type { DocumentFacts } from "../documents/types";

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

function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const m = trimmed.match(/(.+?[.!?])(?:\s|$)/);
  return (m?.[1] ?? trimmed).trim();
}

function normalizeReason(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function buildConsensusReasoning(
  group: Array<{ flag: LegalFlag; model: string }>,
  baseReasoning: string,
  originalSeverities: Record<string, string>,
  finalSeverity: Severity
): string {
  const modelNames = group.map((g) => g.model.toUpperCase()).join(" + ");
  const baseFirst = firstSentence(baseReasoning);
  const uniqExtras: string[] = [];

  const seen = new Set<string>([normalizeReason(baseFirst)]);
  for (const g of group) {
    const s = firstSentence(g.flag.reasoning);
    const key = normalizeReason(s);
    if (!s || seen.has(key)) continue;
    seen.add(key);
    uniqExtras.push(s);
  }

  const sevPairs = Object.entries(originalSeverities)
    .map(([m, s]) => `${m.toUpperCase()}: ${s}`)
    .join(", ");
  const sevValues = new Set(Object.values(originalSeverities));
  const sevNote =
    sevValues.size > 1
      ? ` Model severity differed (${sevPairs}); resolved to ${finalSeverity}.`
      : "";

  const extras = uniqExtras.slice(0, 2).join(" ");
  return `Cross-model consensus (${modelNames}): ${baseFirst}${extras ? ` ${extras}` : ""}${sevNote}`;
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

export interface CrossValidationAudit {
  model: string;
  status: "complete" | "error";
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
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

    // Build one readable consensus summary instead of raw model blocks.
    const reasoning = buildConsensusReasoning(
      group,
      base.reasoning,
      originalSeverities,
      severity
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
      reasoning,
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
  research?: ResearchFindings,
  documentFacts?: DocumentFacts[],
  factCheck?: FactCheckReport | null
): Promise<{
  flags: CrossValidatedLegalFlag[];
  raw: CrossValidationRaw;
  warnings: string[];
  audits: CrossValidationAudit[];
}> {
  const legalPrompt = buildLegalPrompt(
    script,
    parsed,
    metadata,
    stateLaw,
    research,
    documentFacts,
    factCheck
  );

  const [claudeResult, gptResult] = await Promise.allSettled([
    callClaudeDetailed(LEGAL_SYSTEM, legalPrompt),
    callGPTDetailed(LEGAL_SYSTEM, legalPrompt),
  ]);

  const warnings: string[] = [];
  let claudeFlags: LegalFlag[] = [];
  let gptFlags: LegalFlag[] = [];
  let claudeParseError: string | undefined;
  let gptParseError: string | undefined;

  if (claudeResult.status === "fulfilled") {
    try {
      claudeFlags = safeJsonParse<LegalFlag[]>(claudeResult.value.text);
    } catch (err) {
      claudeParseError = err instanceof Error ? err.message : String(err);
      warnings.push(
        `Legal review fallback: Claude returned malformed JSON and was ignored. ${claudeParseError}`
      );
    }
  }
  if (gptResult.status === "fulfilled") {
    try {
      gptFlags = safeJsonParse<LegalFlag[]>(gptResult.value.text);
    } catch (err) {
      gptParseError = err instanceof Error ? err.message : String(err);
      warnings.push(
        `Legal review fallback: GPT returned malformed JSON and was ignored. ${gptParseError}`
      );
    }
  }

  const claudeUnavailable =
    claudeResult.status === "rejected" || !!claudeParseError;
  const gptUnavailable = gptResult.status === "rejected" || !!gptParseError;

  if (claudeUnavailable && gptUnavailable) {
    throw new Error(
      `Both legal models failed: Claude: ${claudeResult.status === "rejected" ? claudeResult.reason : claudeParseError}, GPT: ${gptResult.status === "rejected" ? gptResult.reason : gptParseError}`
    );
  }

  if (claudeResult.status === "rejected") {
    warnings.push(
      `Legal review fallback: Claude failed and GPT-only consensus was used. ${String(claudeResult.reason)}`
    );
  }
  if (gptResult.status === "rejected") {
    warnings.push(
      `Legal review fallback: GPT failed and Claude-only consensus was used. ${String(gptResult.reason)}`
    );
  }

  const audits: CrossValidationAudit[] = [
    claudeResult.status === "fulfilled"
      && !claudeParseError
      ? {
          model: claudeResult.value.model,
          status: "complete",
          inputTokens: claudeResult.value.usage?.inputTokens,
          outputTokens: claudeResult.value.usage?.outputTokens,
        }
      : {
          model: "claude-opus-4-6",
          status: "error",
          error:
            claudeResult.status === "rejected"
              ? String(claudeResult.reason)
              : claudeParseError,
        },
    gptResult.status === "fulfilled"
      && !gptParseError
      ? {
          model: gptResult.value.model,
          status: "complete",
          inputTokens: gptResult.value.usage?.inputTokens,
          outputTokens: gptResult.value.usage?.outputTokens,
        }
      : {
          model: "gpt-5.4",
          status: "error",
          error:
            gptResult.status === "rejected"
              ? String(gptResult.reason)
              : gptParseError,
        },
  ];

  const { merged, raw } = mergeFlags(claudeFlags, gptFlags, []);
  return { flags: merged, raw, warnings, audits };
}
