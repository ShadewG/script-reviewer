import type {
  ParsedScript,
  LegalFlag,
  PolicyFlag,
  ResearchFindings,
  CaseMetadata,
} from "../pipeline/types";
import { numberLines } from "../utils/line-numbers";

export const SYNTHESIS_SYSTEM = `You are a senior media law and content policy analyst producing the final review report for a true crime documentary script. You merge legal analysis, YouTube policy compliance, and case research into a clear, actionable verdict. Return ONLY valid JSON.`;

export function buildSynthesisPrompt(
  script: string,
  parsed: ParsedScript,
  legalFlags: LegalFlag[],
  policyFlags: PolicyFlag[],
  research: ResearchFindings | null,
  metadata: CaseMetadata
): string {
  return `Produce the final review report for this true crime documentary script.

CASE: ${metadata.state} | Status: ${metadata.caseStatus} | Minors: ${metadata.hasMinors}

LEGAL FLAGS (${legalFlags.length}):
${JSON.stringify(legalFlags, null, 2)}

YOUTUBE POLICY FLAGS (${policyFlags.length}):
${JSON.stringify(policyFlags, null, 2)}

RESEARCH FINDINGS:
${research ? JSON.stringify(research, null, 2) : "Not available"}

PARSED ENTITIES:
${JSON.stringify(parsed.entities, null, 2)}

INSTRUCTIONS:
1. Cross-reference research with legal flags:
   - If research confirms conviction → downgrade defamation risk for definitive labels
   - If only charges → upgrade risk for definitive language
   - Public figure confirmed → note actual malice standard
2. Resolve conflicts between stages
3. Produce the final structured report

Return this JSON:
{
  "verdict": "publishable|borderline|not_publishable",
  "riskScore": 0-100,
  "summary": "2-3 sentence overall assessment",
  "riskDashboard": {
    "communityGuidelines": "low|medium|high",
    "ageRestriction": "low|medium|high",
    "monetization": "full_ads|limited_ads|no_ads",
    "privacy": "low|medium|high",
    "legal": "low|medium|high"
  },
  "criticalEdits": [{
    "line": 42,
    "original": "original text",
    "suggested": "safer version",
    "reason": "why this must change"
  }],
  "recommendedEdits": [{
    "line": 42,
    "original": "original text",
    "suggested": "better version",
    "reason": "why this should change"
  }],
  "edsaChecklist": [{
    "item": "checklist item",
    "status": "present|missing|partial",
    "note": "details"
  }],
  "legalFlags": ${JSON.stringify(legalFlags)},
  "policyFlags": ${JSON.stringify(policyFlags)}
}

FULL SCRIPT (with line numbers):
${numberLines(script)}`;
}
