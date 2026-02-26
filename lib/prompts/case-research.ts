import type { ParsedScript, CaseMetadata } from "../pipeline/types";

export function buildCaseResearchQueries(
  parsed: ParsedScript,
  metadata: CaseMetadata
): string[] {
  const queries: string[] = [];
  const state = metadata.state;

  // Main case query
  const suspects = parsed.entities.filter((e) => e.role === "suspect");
  const victims = parsed.entities.filter((e) => e.role === "victim");

  if (suspects.length > 0 && victims.length > 0) {
    queries.push(
      `What is the current legal status and case outcome for ${suspects[0].name} in the ${victims[0].name} case in ${state}? Include: charges filed, trial status, conviction status, sentencing, any appeals. Provide court case numbers if available.`
    );
  }

  // Individual queries for key persons
  for (const entity of parsed.entities) {
    if (entity.role === "suspect" || entity.role === "victim") {
      queries.push(
        `${entity.name} ${state} criminal case: current status, conviction, public figure status, media coverage volume, any existing defamation lawsuits. Is this person deceased?`
      );
    }
  }

  // Limit to 5 queries max
  return queries.slice(0, 5);
}

export const RESEARCH_SYNTHESIS_SYSTEM = `You are a legal research synthesizer. Combine multiple research results into a structured findings report. Return ONLY valid JSON.`;

export function buildResearchSynthesisPrompt(
  researchResults: string[],
  metadata: CaseMetadata
): string {
  return `Synthesize these research results about a criminal case in ${metadata.state}.

RESEARCH RESULTS:
${researchResults.map((r, i) => `--- Result ${i + 1} ---\n${r}`).join("\n\n")}

Return this JSON structure:
{
  "caseStatus": "current status of the criminal case",
  "caseJurisdiction": "court/jurisdiction",
  "caseNumbers": ["case numbers found"],
  "personProfiles": [{
    "name": "full name",
    "caseStatus": "their status in the case",
    "isPublicFigure": true/false,
    "publicFigureReason": "why they are/aren't public figure",
    "isDeceased": true/false,
    "criminalRecord": "record details",
    "newsCoverage": "level of media coverage"
  }],
  "courtRecords": ["relevant court records found"],
  "keyCitations": ["key legal citations"]
}`;
}
