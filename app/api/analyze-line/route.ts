import { NextRequest } from "next/server";
import { callClaude } from "@/lib/ai/anthropic";
import { callGPT } from "@/lib/ai/openai";
import { LEGAL_SYSTEM } from "@/lib/prompts/legal-review";
import { YOUTUBE_SYSTEM } from "@/lib/prompts/youtube-policy";
import { extractSurroundingContext } from "@/lib/utils/line-numbers";
import type { LegalFlag, PolicyFlag } from "@/lib/pipeline/types";

export const dynamic = "force-dynamic";

function safeJsonParse<T>(text: string): T {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```[\w]*\s*\n?/, "").replace(/\n?```\s*$/, "");
  if (!cleaned.startsWith("[") && !cleaned.startsWith("{")) {
    const jsonMatch = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (jsonMatch) cleaned = jsonMatch[0];
  }
  return JSON.parse(cleaned) as T;
}

export async function POST(req: NextRequest) {
  const { scriptText, lineNumber, newText, state, caseStatus, hasMinors } =
    await req.json();

  if (!scriptText || !lineNumber || !newText) {
    return Response.json(
      { error: "scriptText, lineNumber, and newText are required" },
      { status: 400 }
    );
  }

  const context = extractSurroundingContext(scriptText, lineNumber, 5);
  const prompt = `Analyze this SINGLE LINE CHANGE in a true crime documentary script for risks.

STATE: ${state || "Unknown"}
CASE STATUS: ${caseStatus || "Unknown"}
HAS MINORS: ${hasMinors ?? false}

THE CHANGED LINE (line ${lineNumber}):
"${newText}"

SURROUNDING CONTEXT:
${context}

Check this line for:
1. Defamation risk (per se categories, truth/falsity, privilege)
2. Privacy tort risk (private facts, false light)
3. YouTube policy compliance (community guidelines, monetization impact)

Return JSON:
{
  "legalFlags": [{ "line": ${lineNumber}, "text": "flagged text", "person": "name", "riskType": "defamation|privacy|false_light|appropriation", "severity": "low|medium|high|severe", "reasoning": "why", "saferRewrite": "safer version", "counselReview": false, "confidence": 0.8 }],
  "policyFlags": [{ "line": ${lineNumber}, "text": "flagged text", "category": "community_guidelines|age_restriction|monetization|edsa_context|metadata", "severity": "low|medium|high|severe", "policyName": "policy", "impact": "full_ads|limited_ads|no_ads|age_restricted|removal_risk", "reasoning": "why" }],
  "verdict": "clear|caution|risky",
  "summary": "one sentence assessment of this specific line"
}

If the line is fine, return empty arrays and verdict "clear".`;

  try {
    const [legalResult, policyResult] = await Promise.allSettled([
      callClaude(LEGAL_SYSTEM, prompt),
      callGPT(YOUTUBE_SYSTEM, prompt),
    ]);

    let legalFlags: LegalFlag[] = [];
    let policyFlags: PolicyFlag[] = [];
    let verdict = "clear";
    let summary = "Line appears safe.";
    let legalParsed = false;
    let policyParsed = false;

    if (legalResult.status === "fulfilled") {
      try {
        const parsed = safeJsonParse<{
          legalFlags?: LegalFlag[];
          verdict?: string;
          summary?: string;
        }>(legalResult.value);
        legalFlags = parsed.legalFlags ?? [];
        verdict = parsed.verdict ?? verdict;
        summary = parsed.summary ?? summary;
        legalParsed = true;
      } catch { /* parse failed */ }
    }

    if (policyResult.status === "fulfilled") {
      try {
        const parsed = safeJsonParse<{
          policyFlags?: PolicyFlag[];
          verdict?: string;
        }>(policyResult.value);
        policyFlags = parsed.policyFlags ?? [];
        if (parsed.verdict === "risky") verdict = "risky";
        policyParsed = true;
      } catch { /* parse failed */ }
    }

    // If both models failed, indicate the analysis was incomplete
    if (!legalParsed && !policyParsed) {
      verdict = "error";
      summary = "Both analysis models failed. Try again.";
    } else if (!legalParsed) {
      summary += " (Legal model unavailable — only policy check ran.)";
    } else if (!policyParsed) {
      summary += " (Policy model unavailable — only legal check ran.)";
    }

    return Response.json({ legalFlags, policyFlags, verdict, summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analysis failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
