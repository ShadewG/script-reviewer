import type {
  ParsedScript,
  CaseMetadata,
  ResearchFindings,
  FactCheckFinding,
} from "../pipeline/types";
import type { DocumentFacts } from "../documents/types";

export const FACT_CHECK_SYSTEM = `You are a factual consistency checker for true-crime documentary scripts.
Your job is to compare selected script claims against uploaded source documents and case research.
Be conservative. Only mark a claim as contradicted when the provided materials clearly conflict with it.
Use the uploaded documents first. Use research second. If the provided materials are insufficient, mark the claim as needs_external_verification or unclear.
Return ONLY valid JSON.`;

function scoreClaimText(text: string): number {
  let score = 0;
  if (/\b(first-degree|second-degree|life in prison|sentenced|convicted|appeal|charges?|trial)\b/.test(text)) score += 4;
  if (/\b(serial offender|serial killer|dozens of victims|decades-long|graveyard|cover-up|motive)\b/.test(text)) score += 4;
  if (/\b(california|virginia|north carolina|county|circuit court|district court)\b/.test(text)) score += 3;
  if (/\b\d{4}\b/.test(text) || /\b\d+\b/.test(text)) score += 2;
  if (text.length > 90) score += 1;
  return score;
}

function selectClaimsFromScript(
  script: string
): Array<{ line: number; claim: string; score: number }> {
  return script
    .split("\n")
    .map((rawLine, idx) => ({
      line: idx + 1,
      claim: rawLine.trim(),
    }))
    .filter((item) => item.claim.length >= 40)
    .map((item) => ({
      ...item,
      score: scoreClaimText(item.claim.toLowerCase()),
    }))
    .filter((item) => item.score > 0);
}

function buildDocsSection(documentFacts: DocumentFacts[] | undefined): string {
  if (!documentFacts || documentFacts.length === 0) return "No uploaded source documents provided.";
  return documentFacts
    .map((doc) => {
      const facts = doc.verifiableFacts
        .slice(0, 20)
        .map((f) => `- [${f.confidence}] ${f.claim} (source: ${f.source})`)
        .join("\n");
      const events = doc.events
        .slice(0, 12)
        .map((e) => `- ${e.date ?? "unknown date"}${e.time ? ` ${e.time}` : ""}: ${e.description}`)
        .join("\n");
      return [
        `--- ${doc.fileName} (${doc.docType}) ---`,
        doc.summary,
        facts ? `Verifiable facts:\n${facts}` : "",
        events ? `Events:\n${events}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

export function selectClaimsForFactCheck(
  parsed: ParsedScript,
  script?: string
): Array<{ line: number; claim: string }> {
  const parsedClaims = Array.isArray(parsed.claims)
    ? parsed.claims
        .filter((claim) => claim.type === "fact" || claim.type === "attributed")
        .map((claim) => ({
          line: claim.line,
          claim: claim.text,
          score: scoreClaimText(claim.text.toLowerCase()),
        }))
    : [];

  const scored = (parsedClaims.length > 0
    ? parsedClaims
    : script
      ? selectClaimsFromScript(script)
      : []
  ).sort((a, b) => b.score - a.score || a.line - b.line);

  const seen = new Set<string>();
  const selected: Array<{ line: number; claim: string }> = [];
  for (const item of scored) {
    const sig = item.claim.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    if (!sig || seen.has(sig)) continue;
    seen.add(sig);
    selected.push({ line: item.line, claim: item.claim });
    if (selected.length >= 10) break;
  }
  return selected;
}

export function buildFactCheckPrompt(args: {
  script: string;
  parsed: ParsedScript;
  metadata: CaseMetadata;
  research: ResearchFindings | null;
  documentFacts?: DocumentFacts[];
  candidateClaims: Array<{ line: number; claim: string }>;
  externalChecks?: Array<{ claim: string; result: string }>;
}): string {
  const { metadata, research, documentFacts, candidateClaims, externalChecks } = args;

  return `Fact-check the selected claims from a true-crime documentary script.

STATE: ${metadata.state}
CASE STATUS: ${metadata.caseStatus}
VIDEO TITLE: ${metadata.videoTitle || "N/A"}

SELECTED CLAIMS TO CHECK:
${candidateClaims.map((c) => `- line ${c.line}: ${c.claim}`).join("\n") || "None"}

UPLOADED SOURCE DOCUMENTS:
${buildDocsSection(documentFacts)}

CASE RESEARCH:
${research ? JSON.stringify(research, null, 2) : "No research available."}

${externalChecks && externalChecks.length > 0 ? `EXTERNAL FACT CHECK RESULTS:\n${externalChecks.map((item) => `--- ${item.claim} ---\n${item.result}`).join("\n\n")}` : ""}

Return JSON in this exact shape:
{
  "summary": "1-3 sentence overall fact-check summary",
  "findings": [
    {
      "line": 42,
      "claim": "exact claim",
      "verdict": "supported|contradicted|unclear|needs_external_verification",
      "confidence": 0.0,
      "basis": "documents|research|external",
      "evidence": "short explanation referencing the provided material",
      "suggestedRewrite": "optional safer phrasing"
    }
  ]
}

Rules:
- Use documents as the highest-priority source when available.
- Use research to confirm jurisdiction, case posture, conviction status, sentencing, appeals, and public-record facts.
- Mark contradicted only when the provided material clearly conflicts with the claim.
- Mark needs_external_verification when the claim appears important but the provided materials do not resolve it.
- Keep findings concise and focused on material factual mismatches.`;
}

export function summarizeFactCheckFindings(findings: FactCheckFinding[]): string {
  if (findings.length === 0) return "No material factual inconsistencies identified.";
  const contradicted = findings.filter((f) => f.verdict === "contradicted").length;
  const unresolved = findings.filter((f) => f.verdict === "needs_external_verification").length;
  if (contradicted === 0 && unresolved === 0) {
    return "Checked key script claims against provided materials and did not find a clear factual conflict.";
  }
  return `Checked key script claims and found ${contradicted} contradicted claim${contradicted === 1 ? "" : "s"} and ${unresolved} unresolved claim${unresolved === 1 ? "" : "s"} needing external verification.`;
}
