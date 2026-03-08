import type {
  ParsedScript,
  LegalFlag,
  PolicyFlag,
  ResearchFindings,
  CaseMetadata,
} from "../pipeline/types";

export const SYNTHESIS_SYSTEM = `You are the final review synthesizer for a true-crime documentary. Your job is to merge legal analysis, YouTube compliance, and case research into a practical report that reflects real-world publication risk.

Calibrate to what typically matters in practice on YouTube:
- Be lenient by default for standard true-crime narration and documentary framing.
- Blurred/pixelated/redacted visuals are normally acceptable and should not be treated as major monetization issues.
- Public-record screenshots, IP logs, timestamps, device strings, road names without a street number, and similar documentary artifacts are usually not top YouTube issues.
- Do not let low-priority privacy hygiene concerns drive the monetization verdict.
- Prioritize only issues that are materially likely to change publication outcome, demonetization outcome, or create severe legal exposure.

Return ONLY valid JSON. Keep your response concise and do not repeat the full flags verbatim.`;

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
ANALYSIS MODE: ${metadata.analysisMode ?? "full"}

LEGAL FLAGS (${legalFlags.length}):
${JSON.stringify(legalFlags, null, 2)}

YOUTUBE POLICY FLAGS (${policyFlags.length}):
${JSON.stringify(policyFlags, null, 2)}

RESEARCH FINDINGS:
${research ? JSON.stringify(research, null, 2) : "Not available"}

PARSED ENTITIES:
${JSON.stringify(parsed.entities, null, 2)}

INSTRUCTIONS:
0. Core calibration:
   - Focus on what is materially likely to cause demonetization, age restriction, removal, or severe legal exposure for a standard true-crime documentary on YouTube.
   - Standard true-crime narration should usually be treated as acceptable unless the provided flags show a concrete, serious problem.
   - Blurred/pixelated/redacted visuals should NOT be treated as a major YouTube problem by themselves.
   - Readable IP addresses, business-record metadata, timestamps, device strings, road names without a street number, and similar documentary/case-file details are not top YouTube issues. Only treat direct phone/email/full home address/government ID/account numbers or a clearly identifiable unblurred minor as serious privacy issues.
   - Do not let minor privacy/legal hygiene issues drive the monetization verdict.
1. Respect ANALYSIS MODE:
   - full: include both legal and monetization conclusions
   - legal_only: focus legal risk; keep monetization conservative based only on provided policy flags
   - monetization_only: focus YouTube/monetization; keep legal conservative based only on provided legal flags
2. Cross-reference research with legal flags:
   - If research confirms conviction → downgrade defamation risk for definitive labels
   - If only charges → upgrade risk for definitive language
   - Public figure confirmed → note actual malice standard
3. Resolve conflicts between stages:
   - If monetization flags are weak but legal/privacy flags exist, keep monetization lenient and separate those concerns.
   - Do not promote speculative or conditional concerns into critical status.
4. Produce the final structured report
5. For criticalEdits:
   - Include ONLY 0-5 truly material issues.
   - Prioritize issues likely to change publication outcome, demonetization outcome, or create severe legal exposure.
   - Do NOT include repeated adjacent video incidents, speculative "if this person was a minor" issues, or low-priority cleanup items.
6. For recommendedEdits:
   - Include ONLY 0-5 useful but non-blocking improvements.
   - Omit low-value nitpicks and repeated variants of the same issue.
7. If there is no clear evidence of likely demonetization/removal, set monetization to full_ads and use publishable or borderline only if serious legal issues remain.

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
