import Anthropic from "@anthropic-ai/sdk";
import type { VideoFrameRisk } from "../pipeline/types";

const ANALYSIS_RETRIES = 2;

const FRAME_SYSTEM = `You are a practical YouTube ad-suitability reviewer for true-crime documentary content.
Analyze one or more nearby video frames from the same incident and return ONLY JSON:
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
Flag only visible issues in the provided frames that are likely to matter in practice on YouTube: explicit unblurred gore/injury, nudity, sexual content, hate symbols/slurs, hard drug use/paraphernalia, clearly readable direct doxxing-level PII, or a clearly identifiable unblurred minor in a sensitive context.
Also flag obvious third-party footage ownership risk when the frames visibly contain outside-source branding or player UI suggesting likely unlicensed clips (for example: TV network logos, news lower-thirds, social media repost UI, or entertainment watermarks).
Be conservative: prefer risks supported across multiple nearby frames when available, and do not escalate based on a single ambiguous still.
Do NOT flag generic true-crime context by itself.
Do NOT flag blurred/pixelated/redacted/obscured imagery unless the disturbing detail is still plainly visible after the blur.
Do NOT flag public-record screenshots, court exhibits, business records, IP logs, timestamps, device strings, road names without a street number, or generic maps by themselves.
Do NOT flag police bodycam, sheriff/police department footage, evidence photos from law enforcement, or agency-branded investigative material as third-party ownership risk. Those are treated as owned/cleared footage for this review context.
Do NOT flag uniforms, agency names, badges, "SHERIFF"/"POLICE" markings, or law-enforcement presence by itself.
Do NOT flag "an identifiable person is visible" unless a concrete privacy trigger is present.
Privacy risks require concrete evidence in-frame (examples: full street address with number + street name, readable phone/email, government ID/account number, or a clearly identifiable unblurred minor in sensitive context).`;

const ADDRESS_SUFFIX =
  "(street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd|court|ct|way|place|pl|terrace|ter|parkway|pkwy)";
const ADDRESS_REGEX = new RegExp(
  `\\b\\d{1,6}\\s+(?:[a-z0-9.'-]+\\s+){0,6}${ADDRESS_SUFFIX}\\b`,
  "i"
);
const ADDRESS_FALSE_POSITIVE_REGEX = /\b\d{1,4}\s+(?:am|pm|o'?clock)\b/i;
const PHONE_REGEX =
  /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b/;
const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const DIRECT_ID_REGEX =
  /\b(ssn|social security|passport|driver'?s license|account number|routing number|bank account|credit card|debit card)\b/i;
const MINOR_HINT_REGEX =
  /\b(minor|child|kid|toddler|juvenile|daughter|son|grandchild|school age)\b/i;
const FACE_HINT_REGEX =
  /\b(face|photo|portrait|identifiable|unblurred|clear image)\b/i;
const BLURRED_VISUAL_REGEX =
  /\b(blurred|pixelated|redacted|obscured|censored)\b/i;
const LAW_ENFORCEMENT_ONLY_REGEX =
  /\b(sheriff|police|department|badge|uniform|officer|deputy|bodycam|law enforcement)\b/i;
const ESCALATION_CONTENT_REGEX =
  /\b(blood|gore|graphic|dead body|corpse|weapon|gun|rifle|knife|drug|meth|cocaine|heroin|address|license plate|phone|email|ssn)\b/i;
const PUBLIC_RECORD_TECHNICAL_REGEX =
  /\b(ip address|ipv4|ipv6|meta platforms business record|business record|device fingerprint|agent string|user agent|login|photo uploaded|timestamp|geolocation)\b/i;
const THIRD_PARTY_OWNERSHIP_REGEX =
  /\b(third party|copyright|licensed footage|broadcast logo|news lower third|network watermark|social media repost|player ui|tiktok|instagram|youtube player|tv clip|movie clip)\b/i;
const OWNED_FOOTAGE_EXEMPT_REGEX =
  /\b(bodycam|body cam|police|sheriff|deputy|officer|department|law enforcement|evidence photo|agency footage)\b/i;
const GRAPHIC_POLICY_REGEX =
  /\b(graphic|gore|violence|disturbing imagery|trauma|injury)\b/i;
const GRAPHIC_HARD_EVIDENCE_REGEX =
  /\b(heavy bleeding|pool of blood|blood pool|open wound|gash|laceration|exposed bone|dismember|decapitat|corpse|dead body|autopsy|severed|stab wound|gunshot wound)\b/i;
const DIRTY_NOT_INJURY_REGEX =
  /\b(dirt|mud|dust|grime|dirty|shirtless|sweat|stain|stained)\b/i;
const UNCERTAIN_INJURY_REGEX =
  /\b(blood\/wounds|blood or wounds|appears to be blood|may be blood|possibly blood)\b/i;

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
  if (PUBLIC_RECORD_TECHNICAL_REGEX.test(joined)) return false;
  if (ADDRESS_FALSE_POSITIVE_REGEX.test(joined)) return false;
  if (ADDRESS_REGEX.test(joined)) return true;
  if (PHONE_REGEX.test(joined)) return true;
  if (EMAIL_REGEX.test(joined)) return true;
  if (DIRECT_ID_REGEX.test(joined)) return true;
  if (
    MINOR_HINT_REGEX.test(joined) &&
    FACE_HINT_REGEX.test(joined) &&
    !BLURRED_VISUAL_REGEX.test(joined)
  ) {
    return true;
  }
  return false;
}

function isLikelyLawEnforcementFalsePositive(risk: VideoFrameRisk): boolean {
  const joined = `${risk.policyName} ${risk.reasoning} ${risk.detectedText ?? ""}`.toLowerCase();
  return LAW_ENFORCEMENT_ONLY_REGEX.test(joined) && !ESCALATION_CONTENT_REGEX.test(joined);
}

function isLikelyGraphicFalsePositive(risk: VideoFrameRisk): boolean {
  const joined = `${risk.policyName} ${risk.reasoning} ${risk.detectedText ?? ""}`.toLowerCase();
  const isGraphicClass =
    (risk.category === "community_guidelines" || risk.category === "age_restriction") &&
    GRAPHIC_POLICY_REGEX.test(joined);
  if (!isGraphicClass) return false;

  if (BLURRED_VISUAL_REGEX.test(joined)) return true;

  // Keep graphic flags only when we have strong explicit injury evidence.
  if (GRAPHIC_HARD_EVIDENCE_REGEX.test(joined)) return false;

  // Drop common dirty/muddy-shirtless misreads with uncertain blood language.
  if (DIRTY_NOT_INJURY_REGEX.test(joined)) return true;
  if (UNCERTAIN_INJURY_REGEX.test(joined)) return true;

  return false;
}

function normalizeAndFilterRisks(risks: VideoFrameRisk[]): VideoFrameRisk[] {
  const cleaned = risks
    .filter((r) => r && r.reasoning && r.policyName)
    .filter((r) => {
      const joined = `${r.policyName} ${r.reasoning} ${r.detectedText ?? ""}`.toLowerCase();

      if (isLikelyLawEnforcementFalsePositive(r)) return false;
      if (isLikelyGraphicFalsePositive(r)) return false;

      if (r.category === "privacy") {
        return hasConcretePrivacyEvidence(r);
      }

      if (THIRD_PARTY_OWNERSHIP_REGEX.test(joined) && OWNED_FOOTAGE_EXEMPT_REGEX.test(joined)) {
        return false;
      }

      // Drop vague monetization flags that only restate "sensitive true crime context".
      if (PUBLIC_RECORD_TECHNICAL_REGEX.test(joined) && !hasConcretePrivacyEvidence(r)) {
        return false;
      }
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

async function analyzeFramesBase64(
  frames: Array<{ label: string; base64: string }>
): Promise<VideoFrameRisk[]> {
  for (let attempt = 1; ; attempt++) {
    try {
      const content: Anthropic.Messages.MessageParam["content"] = [];
      for (const frame of frames) {
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: frame.base64,
          },
        });
        content.push({
          type: "text",
          text: frame.label,
        });
      }
      content.push({
        type: "text",
        text: `Review this ${frames.length > 1 ? "sequence of nearby frames" : "frame"} for policy/privacy risks.`,
      });

      const response = await getAnthropic().messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        temperature: 0.1,
        system: FRAME_SYSTEM,
        messages: [
          {
            role: "user",
            content,
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

export async function analyzeFrameBase64(base64: string): Promise<VideoFrameRisk[]> {
  return analyzeFramesBase64([{ label: "Frame 1", base64 }]);
}

export async function analyzeFrameWindowBase64(
  frames: Array<{ label: string; base64: string }>
): Promise<VideoFrameRisk[]> {
  if (frames.length === 0) return [];
  return analyzeFramesBase64(frames);
}
