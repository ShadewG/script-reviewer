import type { ParsedScript, ResearchFindings, CaseMetadata } from "../pipeline/types";
import type { DocumentFacts } from "../documents/types";
import { numberLines } from "../utils/line-numbers";

export const LEGAL_SYSTEM = `You are a defamation and media law risk analyst for documentary content. You analyze scripts for legal risk with precision, citing specific state law provisions. You are thorough but do not over-flag clearly protected speech. The script is provided with line numbers — you MUST include the exact line number for every flag. Return ONLY valid JSON.`;

function buildDocumentFactsSection(docs: DocumentFacts[]): string {
  if (!docs.length) return "";

  const sections = docs.map((doc) => {
    const parts = [`--- ${doc.fileName} (${doc.docType}) ---`, doc.summary];

    if (doc.people.length > 0) {
      parts.push(
        "People documented: " +
          doc.people
            .map(
              (p) =>
                `${p.name} (${p.role}): ${p.actions.join("; ")}`
            )
            .join(" | ")
      );
    }

    if (doc.verifiableFacts.length > 0) {
      parts.push(
        "Verified facts:\n" +
          doc.verifiableFacts
            .map(
              (f) =>
                `  - [${f.confidence.toUpperCase()}] ${f.claim} (source: ${f.source})`
            )
            .join("\n")
      );
    }

    if (doc.quotes.length > 0) {
      parts.push(
        "Key quotes:\n" +
          doc.quotes
            .map((q) => `  - "${q.text}" — ${q.speaker}`)
            .join("\n")
      );
    }

    if (doc.events.length > 0) {
      parts.push(
        "Documented events:\n" +
          doc.events
            .map(
              (e) =>
                `  - ${e.date ?? ""}${e.time ? " " + e.time : ""}: ${e.description}`
            )
            .join("\n")
      );
    }

    return parts.join("\n");
  });

  return `
SUPPLEMENTAL DOCUMENTATION (police reports, court filings, etc.):
The creator has provided official documents. Use these to VERIFY script claims.
If a script claim is CONFIRMED by these documents, REDUCE the severity or REMOVE the flag entirely.
If a script claim CONTRADICTS these documents, INCREASE the severity and note the discrepancy.

${sections.join("\n\n")}

IMPORTANT: Cross-reference script claims against these documented facts. A claim backed by official records is NOT defamatory — it's a truthful statement, which is a complete defense to defamation.`;
}

export function buildLegalPrompt(
  script: string,
  parsed: ParsedScript,
  metadata: CaseMetadata,
  stateLaw: Record<string, unknown>,
  research?: ResearchFindings,
  documentFacts?: DocumentFacts[]
): string {
  const docsSection = documentFacts?.length
    ? buildDocumentFactsSection(documentFacts)
    : "";

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
${docsSection}

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
