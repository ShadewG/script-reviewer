import Anthropic from "@anthropic-ai/sdk";
import type { VideoFrameRisk } from "../pipeline/types";

const ANALYSIS_RETRIES = 2;

const FRAME_SYSTEM = `You are a strict YouTube risk reviewer for true-crime content.
Analyze ONE video frame and return ONLY JSON:
{
  "risks": [
    {
      "category": "community_guidelines|age_restriction|monetization|privacy",
      "severity": "low|medium|high|severe",
      "impact": "full_ads|limited_ads|no_ads|age_restricted|removal_risk",
      "policyName": "short policy label",
      "reasoning": "why this frame is risky",
      "detectedText": "visible text if any"
    }
  ]
}
If no visible risk, return {"risks": []}.
Flag only visible issues in this frame: graphic gore/trauma, nudity, sexual content, explicit hate symbols/slurs, obvious drug use/paraphernalia, clearly readable doxxing-level PII.
Do NOT flag generic true-crime context by itself.
Do NOT flag uniforms, agency names, badges, "SHERIFF"/"POLICE" markings, or law-enforcement presence by itself.
Do NOT flag "an identifiable person is visible" unless a concrete privacy trigger is present.
Privacy risks require concrete evidence in-frame (examples: full street address with number + street name, readable phone/email, readable license plate tied to a private person, government ID/account number, clearly identifiable unblurred minor in sensitive context).`;

const ADDRESS_SUFFIX =
  "(street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd|court|ct|way|place|pl|terrace|ter|parkway|pkwy)";
const ADDRESS_REGEX = new RegExp(
  `\\b\\d{1,6}\\s+(?:[a-z0-9.'-]+\\s+){0,6}${ADDRESS_SUFFIX}\\b`,
  "i"
);
const PHONE_REGEX =
  /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b/;
const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const STRONG_PII_HINT_REGEX =
  /\b(address|license plate|plate number|phone number|email|ssn|social security|passport|driver'?s license|account number|routing number|home address)\b/i;
const MINOR_HINT_REGEX =
  /\b(minor|child|kid|toddler|juvenile|daughter|son|grandchild|school age)\b/i;
const FACE_HINT_REGEX =
  /\b(face|photo|portrait|identifiable|unblurred|clear image)\b/i;
const LAW_ENFORCEMENT_ONLY_REGEX =
  /\b(sheriff|police|department|badge|uniform|officer|deputy|bodycam|law enforcement)\b/i;
const ESCALATION_CONTENT_REGEX =
  /\b(blood|gore|graphic|dead body|corpse|weapon|gun|rifle|knife|drug|meth|cocaine|heroin|address|license plate|phone|email|ssn)\b/i;

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

function parseJsonSafe<T>(text: string): T | null {
  const cleaned = text
    .trim()
    .replace(/^```[\w]*\s*\n?/, "")
    .replace(/\n?```\s*$/, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

function hasConcretePrivacyEvidence(risk: VideoFrameRisk): boolean {
  const joined = `${risk.policyName} ${risk.reasoning} ${risk.detectedText ?? ""}`.toLowerCase();
  if (ADDRESS_REGEX.test(joined)) return true;
  if (PHONE_REGEX.test(joined)) return true;
  if (EMAIL_REGEX.test(joined)) return true;
  if (STRONG_PII_HINT_REGEX.test(joined)) return true;
  if (MINOR_HINT_REGEX.test(joined) && FACE_HINT_REGEX.test(joined)) return true;
  return false;
}

function isLikelyLawEnforcementFalsePositive(risk: VideoFrameRisk): boolean {
  const joined = `${risk.policyName} ${risk.reasoning} ${risk.detectedText ?? ""}`.toLowerCase();
  return LAW_ENFORCEMENT_ONLY_REGEX.test(joined) && !ESCALATION_CONTENT_REGEX.test(joined);
}

function normalizeAndFilterRisks(risks: VideoFrameRisk[]): VideoFrameRisk[] {
  const cleaned = risks
    .filter((r) => r && r.reasoning && r.policyName)
    .filter((r) => {
      if (isLikelyLawEnforcementFalsePositive(r)) return false;

      if (r.category === "privacy") {
        return hasConcretePrivacyEvidence(r);
      }

      // Drop vague monetization flags that only restate "sensitive true crime context".
      const joined = `${r.policyName} ${r.reasoning} ${r.detectedText ?? ""}`.toLowerCase();
      if (
        r.category === "monetization" &&
        /\b(sensitive true crime|sensitive events?|identifiable private individual|personal privacy)\b/i.test(
          joined
        ) &&
        !ESCALATION_CONTENT_REGEX.test(joined)
      ) {
        return false;
      }

      return true;
    });

  const unique = new Set<string>();
  return cleaned.filter((r) => {
    const key = `${r.category}|${r.severity}|${r.impact}|${r.policyName}|${r.reasoning}`;
    if (unique.has(key)) return false;
    unique.add(key);
    return true;
  });
}

export async function analyzeFrameBase64(base64: string): Promise<VideoFrameRisk[]> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await getAnthropic().messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        temperature: 0.1,
        system: FRAME_SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: base64,
                },
              },
              {
                type: "text",
                text: "Review this frame for policy/privacy risks.",
              },
            ],
          },
        ],
      });
      const textBlock = response.content.find((c) => c.type === "text");
      const parsed = textBlock
        ? parseJsonSafe<{ risks?: VideoFrameRisk[] }>(textBlock.text)
        : null;
      return normalizeAndFilterRisks(parsed?.risks ?? []);
    } catch (err) {
      if (attempt >= ANALYSIS_RETRIES) {
        throw err;
      }
    }
  }
}
