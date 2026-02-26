import type { ParsedScript, CaseMetadata } from "../pipeline/types";

export const YOUTUBE_SYSTEM = `You are a YouTube Policy Compliance Reviewer specialized in true crime documentary content. You know all YouTube community guidelines, monetization policies, age restriction criteria, profanity rules (including July 2025 updates), and EDSA (Educational, Documentary, Scientific, Artistic) context requirements. Return ONLY valid JSON.`;

export function buildYoutubePrompt(
  script: string,
  parsed: ParsedScript,
  metadata: CaseMetadata
): string {
  return `Analyze this true crime documentary script for YouTube policy compliance.

VIDEO TITLE: ${metadata.videoTitle || "Not provided"}
THUMBNAIL DESCRIPTION: ${metadata.thumbnailDesc || "Not provided"}
FOOTAGE TYPES: ${metadata.footageTypes.join(", ") || "Not specified"}
HAS MINORS: ${metadata.hasMinors}

PARSED PROFANITY:
${JSON.stringify(parsed.profanity, null, 2)}

PARSED GRAPHIC CONTENT:
${JSON.stringify(parsed.graphicContent, null, 2)}

CHECK ALL OF THESE:

1. COMMUNITY GUIDELINES (removal/strike risk):
   - Violent or graphic content without EDSA context
   - Harmful or dangerous content
   - Hate speech
   - Harassment of real people
   - Child safety concerns
   - Suicide/self-harm content (method/location details)

2. AGE RESTRICTION RISK:
   - Graphic violence descriptions
   - Sexual content descriptions
   - Heavy/excessive profanity
   - Detailed suicide methods

3. MONETIZATION IMPACT (classify each flag):
   - Full Ads: content is fine
   - Limited Ads: some ad formats restricted
   - No Ads: demonetized
   Key rules:
   - Moment of death references → No Ads
   - Graphic body descriptions → Limited or No Ads
   - Strong profanity (fuck, shit) frequency matters — occasional OK, excessive = Limited
   - Title/thumbnail profanity → stricter rules
   - First 7 seconds profanity → now OK per July 2025 update

4. EDSA CONTEXT GAPS:
   - Where is documentary context missing from narration?
   - Where should "according to..." or source attribution be added?
   - Where should graphic content warnings be added?

5. METADATA REVIEW:
   - Shock/disgust framing in title
   - Profanity in title
   - Misleading claims
   - If issues found, provide 3 safer title alternatives

Return JSON array of flags:
[{
  "line": null,
  "text": "exact script text or metadata element",
  "category": "community_guidelines|age_restriction|monetization|edsa_context|metadata",
  "severity": "low|medium|high|severe",
  "policyName": "specific policy name",
  "policyQuote": "relevant policy text if known",
  "impact": "full_ads|limited_ads|no_ads|age_restricted|removal_risk",
  "saferRewrite": "suggested safer version",
  "reasoning": "why this is flagged"
}]

If no flags, return empty array [].

FULL SCRIPT:
${script}`;
}
