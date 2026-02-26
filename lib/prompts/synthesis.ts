import type {
  ParsedScript,
  LegalFlag,
  PolicyFlag,
  ResearchFindings,
  CaseMetadata,
} from "../pipeline/types";

export const SYNTHESIS_SYSTEM = `You are a senior media law and content policy analyst producing the final review report for a true crime documentary script. You merge legal analysis, YouTube policy compliance, and case research into a clear, actionable verdict. Return ONLY valid JSON. Keep your response concise — do not repeat the full flags, just reference them.`;

export function buildSynthesisPrompt(
  script: string,
  parsed: ParsedScript,
  legalFlags: LegalFlag[],
  policyFlags: PolicyFlag[],
  research: ResearchFindings | null,
  metadata: CaseMetadata
): string {
  // Truncate script to first 200 lines for context (flags already have the specific text)
  const scriptLines = script.split("\n");
  const truncatedScript = scriptLines.length > 200
    ? scriptLines.slice(0, 200).join("\n") + `\n... [${scriptLines.length - 200} more lines]`
    : script;

  return `Produce the final review report for this true crime documentary script.

CASE: ${metadata.state} | Status: ${metadata.caseStatus} | Minors: ${metadata.hasMinors}
VIDEO TITLE: ${metadata.videoTitle || "N/A"}
SCRIPT LENGTH: ${scriptLines.length} lines

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
4. For criticalEdits and recommendedEdits, only include the TOP 10 most important — do not list every flag

Return this EXACT JSON structure:
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
  "criticalEdits": [{"line": 42, "original": "text", "suggested": "safer", "reason": "why"}],
  "recommendedEdits": [{"line": 42, "original": "text", "suggested": "better", "reason": "why"}],
  "edsaChecklist": [{"item": "item", "status": "present|missing|partial", "note": "details"}],
  "legalFlags": [],
  "policyFlags": []
}

IMPORTANT: For legalFlags and policyFlags in your output, return empty arrays []. The system will inject the actual flags automatically. Do NOT copy the flags into your response — this saves tokens and prevents truncation.

SCRIPT EXCERPT (first 200 lines for context):
${truncatedScript}`;
}
