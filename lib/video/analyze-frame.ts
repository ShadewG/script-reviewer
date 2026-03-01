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
Flag only visible issues in this frame: graphic gore/trauma, nudity, sexual content, visible addresses/license plates/PII, explicit hate symbols/slurs, obvious drug use/paraphernalia.`;

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
      return (parsed?.risks ?? []).filter((r) => r && r.reasoning && r.policyName);
    } catch (err) {
      if (attempt >= ANALYSIS_RETRIES) {
        throw err;
      }
    }
  }
}
