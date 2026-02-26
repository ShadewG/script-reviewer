import type { ParsedScript, ResearchFindings, CaseMetadata } from "../pipeline/types";
import { numberLines } from "../utils/line-numbers";

export const LEGAL_SYSTEM = `You are a defamation and media law risk analyst for documentary content. You analyze scripts for legal risk with precision, citing specific state law provisions. You are thorough but do not over-flag clearly protected speech. The script is provided with line numbers — you MUST include the exact line number for every flag. Return ONLY valid JSON.`;

export function buildLegalPrompt(
  script: string,
  parsed: ParsedScript,
  metadata: CaseMetadata,
  stateLaw: Record<string, unknown>,
  research?: ResearchFindings
): string {
  return `Analyze this crime documentary script for defamation and privacy tort risk.

STATE JURISDICTION: ${metadata.state}
CASE STATUS: ${metadata.caseStatus}
HAS MINORS: ${metadata.hasMinors}

STATE DEFAMATION LAW PROFILE:
${JSON.stringify(stateLaw, null, 2)}

PARSED ENTITIES:
${JSON.stringify(parsed.entities, null, 2)}

PARSED CLAIMS:
${JSON.stringify(parsed.claims, null, 2)}

${research ? `CASE RESEARCH FINDINGS:\n${JSON.stringify(research, null, 2)}` : "NO CASE RESEARCH AVAILABLE"}

For EACH named individual, evaluate:

A. DEFAMATION RISK:
1. Statement Classification — fact vs opinion? Would reasonable viewer understand as fact?
2. Truth/Falsity — evidence basis? Case status implications:
   - Convicted: can use definitive language ("the killer", "murdered")
   - Charged/On trial: MUST use attribution ("charged with", "accused of")
   - Suspect/POI: careful language only ("person of interest")
   - Acquitted/Exonerated: calling them guilty = EXTREME risk
   - Unsolved: speculation about named individuals = HIGH risk
3. Public vs Private Figure — standard of fault differs
4. Per Se Categories — accusing of crime, sexual misconduct, professional incompetence
5. Privilege Analysis — fair report, neutral reportage, opinion
6. Anti-SLAPP protection applicability

B. PRIVACY TORT RISK:
- Intrusion, public disclosure of private facts, false light, appropriation
- Flag: addresses, phone numbers, medical details, sexual assault details beyond public record, minor identities

Return JSON array of flags. IMPORTANT: "line" MUST be the exact line number from the script — NEVER null:
[{
  "line": 42,
  "text": "exact script text",
  "person": "name",
  "riskType": "defamation|privacy|false_light|appropriation",
  "severity": "low|medium|high|severe",
  "reasoning": "concise legal reasoning",
  "stateCitation": "statute or case citation",
  "saferRewrite": "suggested safer version",
  "counselReview": true/false,
  "confidence": 0.0-1.0
}]

If no flags, return empty array [].

IMPORTANT: Be precise, not repetitive. If the same type of issue appears on multiple lines (e.g. the same person is called "killer" on 10 different lines), flag the FIRST instance and note "similar language appears on lines X, Y, Z" in the reasoning — do NOT create a separate flag for each repetition. Every flag should represent a DISTINCT legal issue.

FULL SCRIPT (with line numbers):
${numberLines(script)}`;
}
