import type { LegalFlag, PolicyFlag, VideoFrameFinding } from "./types";

const ADDRESS_SUFFIX =
  "(street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd|court|ct|way|place|pl|terrace|ter|parkway|pkwy)";

const ADDRESS_REGEXES = [
  new RegExp(
    `\\b\\d{1,6}\\s+(?:[a-z0-9.'-]+\\s+){0,5}${ADDRESS_SUFFIX}\\b`,
    "i"
  ),
  new RegExp(`\\b${ADDRESS_SUFFIX}\\s+\\d{1,6}\\b`, "i"),
];

const PROFANITY_REGEXES: Array<{ word: string; regex: RegExp }> = [
  { word: "fuck", regex: /\b(?:fuck(?:ing|ed|er|ers)?|f\*{2,}k)\b/i },
  { word: "shit", regex: /\b(?:shit(?:ty|ting)?|sh\*{2,}t)\b/i },
  { word: "bitch", regex: /\b(?:bitch(?:es|y)?|b\*{3,}h)\b/i },
  { word: "asshole", regex: /\b(?:asshole|a\*{2,}hole)\b/i },
  { word: "motherfucker", regex: /\bmotherfuck(?:er|ers|ing)?\b/i },
  { word: "cunt", regex: /\bcunt(?:s)?\b/i },
  { word: "damn", regex: /\bdamn(?:ed|ing)?\b/i },
  { word: "bastard", regex: /\bbastard(?:s)?\b/i },
  { word: "dick", regex: /\bdick(?:head|heads|s)?\b/i },
];

const STRONG_PRIVACY_EVIDENCE_REGEX =
  /\b(\d{1,6}\s+[a-z0-9.'-]+(?:\s+[a-z0-9.'-]+){0,6}\s+(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd|court|ct|way|place|pl|terrace|ter|parkway|pkwy)|\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|ip address|license plate|social security|ssn|driver'?s license|passport|account number)\b/i;
const MINOR_VISUAL_REGEX =
  /\b(minor|child|kid|juvenile|daughter|son|grandchild)\b/i;
const FACE_VISUAL_REGEX = /\b(face|photo|portrait|identifiable|unblurred)\b/i;
const VIDEO_PREFIX_REGEX = /^\[Video\s+(\d\d):(\d\d):(\d\d)\]\s*/i;
const VIDEO_DEDUPE_WINDOW_SECONDS = 75;

function parseVideoSecond(text: string): number | null {
  const m = text.match(VIDEO_PREFIX_REGEX);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

function normalizeForDedupe(input: string): string {
  return input
    .toLowerCase()
    .replace(VIDEO_PREFIX_REGEX, "")
    .replace(/\b\d{1,4}[-/:]\d{1,4}[-/:]?\d{0,4}\b/g, " ")
    .replace(/\b\d{2}:\d{2}:\d{2}\b/g, " ")
    .replace(/\b[0-9a-f]{2,}\b/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(input: string): Set<string> {
  const tokens = normalizeForDedupe(input).split(" ").filter(Boolean);
  return new Set(tokens.filter((t) => t.length >= 4));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union <= 0 ? 0 : inter / union;
}

function hasStrongPrivacyEvidenceFromVideoRisk(risk: VideoFrameFinding["risks"][number]): boolean {
  const joined = `${risk.policyName} ${risk.reasoning} ${risk.detectedText ?? ""}`;
  if (STRONG_PRIVACY_EVIDENCE_REGEX.test(joined)) return true;
  if (MINOR_VISUAL_REGEX.test(joined) && FACE_VISUAL_REGEX.test(joined)) return true;
  return false;
}

const TRAUMA_PATTERNS: Array<{
  regex: RegExp;
  severity: "medium" | "high" | "severe";
  impact: "limited_ads" | "no_ads";
  policyName: string;
  reason: string;
}> = [
  {
    regex:
      /\b(decompos(?:e|ed|ing|ition)|rott(?:ing|en)|charred remains|dismember(?:ed|ment)?|behead(?:ed|ing)?|decapitat(?:ed|ion))\b/i,
    severity: "severe",
    impact: "no_ads",
    policyName: "Graphic Violence and Gore",
    reason:
      "Detected extreme trauma or post-mortem detail (decomposition/dismemberment/beheading class language).",
  },
  {
    regex:
      /\b(brain matter|guts|entrails|intestines|blood[- ]soaked|pool of blood|severed (head|limb|arm|leg)|open wound|exposed bone)\b/i,
    severity: "high",
    impact: "limited_ads",
    policyName: "Graphic Injury Detail",
    reason:
      "Detected highly graphic bodily injury detail likely to trigger reduced ad suitability.",
  },
  {
    regex:
      /\b(torture(?:d)?|agon(?:y|izing)|screamed in pain|multiple stab wounds|stabbed (him|her|them) (again|repeatedly)|bludgeoned|strangled to death)\b/i,
    severity: "medium",
    impact: "limited_ads",
    policyName: "Trauma/Violence Intensity",
    reason:
      "Detected vivid trauma/violence phrasing that can increase age-restriction and monetization risk.",
  },
];

function severityForProfanity(word: string): "low" | "medium" | "high" {
  if (word === "damn") return "low";
  if (word === "shit" || word === "bitch" || word === "bastard") return "medium";
  return "high";
}

function excerptAroundAddress(text: string): string {
  const WINDOW = 90;
  for (const rx of ADDRESS_REGEXES) {
    const match = text.match(rx);
    if (!match || match.index === undefined) continue;
    const start = Math.max(0, match.index - WINDOW);
    const end = Math.min(text.length, match.index + match[0].length + WINDOW);
    const prefix = start > 0 ? "..." : "";
    const suffix = end < text.length ? "..." : "";
    return `${prefix}${text.slice(start, end).trim()}${suffix}`;
  }
  return text.length > 220 ? `${text.slice(0, 220).trim()}...` : text;
}

export function heuristicPolicyFlags(script: string): PolicyFlag[] {
  const lines = script.split("\n");
  const flags: PolicyFlag[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const text = lines[i].trim();
    if (!text) continue;

    if (ADDRESS_REGEXES.some((rx) => rx.test(text))) {
      const key = `addr:${lineNumber}`;
      if (!seen.has(key)) {
        seen.add(key);
        const excerpt = excerptAroundAddress(text);
        flags.push({
          line: lineNumber,
          text: excerpt,
          category: "community_guidelines",
          severity: "high",
          policyName: "Privacy Guidelines (PII)",
          policyQuote:
            "Content sharing non-public personal info such as home addresses is not allowed.",
          impact: "removal_risk",
          saferRewrite:
            "Remove exact address and use a broad location reference (city/area) instead.",
          reasoning:
            "This line appears to contain a specific street address, which can expose private identifying information.",
        });
      }
    }

    for (const { word, regex } of PROFANITY_REGEXES) {
      if (!regex.test(text)) continue;
      const key = `curse:${lineNumber}:${word}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const severity = severityForProfanity(word);
      flags.push({
        line: lineNumber,
        text,
        category: "monetization",
        severity,
        policyName: "Advertiser-Friendly Language",
        policyQuote:
          "Frequent or strong profanity can reduce ad suitability.",
        impact: severity === "high" ? "limited_ads" : "full_ads",
        saferRewrite:
          "Use toned-down language or bleep/remove the strongest profanity in narration.",
        reasoning:
          `Detected explicit or censored profanity pattern ("${word}") in transcript text.`,
      });
    }

    for (const pattern of TRAUMA_PATTERNS) {
      if (!pattern.regex.test(text)) continue;
      const key = `trauma:${lineNumber}:${pattern.policyName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      flags.push({
        line: lineNumber,
        text,
        category: "age_restriction",
        severity: pattern.severity,
        policyName: pattern.policyName,
        policyQuote:
          "Graphic or gory violence detail may be age-restricted or receive limited/no ads depending on intensity.",
        impact: pattern.impact,
        saferRewrite:
          "Use less graphic phrasing and focus on verified facts without vivid bodily detail.",
        reasoning: pattern.reason,
      });
    }
  }

  return flags;
}

export function heuristicLegalFlags(script: string): LegalFlag[] {
  const lines = script.split("\n");
  const flags: LegalFlag[] = [];
  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const text = lines[i].trim();
    if (!text) continue;
    if (!ADDRESS_REGEXES.some((rx) => rx.test(text))) continue;
    const excerpt = excerptAroundAddress(text);

    flags.push({
      line: lineNumber,
      text: excerpt,
      person: "Identifiable individual",
      riskType: "privacy",
      severity: "high",
      reasoning:
        "This appears to disclose an exact street address. Publishing specific residential addresses creates privacy and doxxing exposure.",
      saferRewrite:
        "Remove the exact address and use a non-identifying location description.",
      counselReview: false,
      confidence: 0.85,
    });
  }
  return flags;
}

export function videoFindingsToPolicyFlags(
  findings: VideoFrameFinding[]
): PolicyFlag[] {
  const flags: PolicyFlag[] = [];
  const recentByCategory = new Map<
    string,
    Array<{ second: number; tokens: Set<string> }>
  >();

  for (const finding of findings) {
    for (const risk of finding.risks ?? []) {
      if (risk.category === "privacy" && !hasStrongPrivacyEvidenceFromVideoRisk(risk)) {
        continue;
      }

      const text = `[Video ${finding.timecode}] ${risk.detectedText ?? risk.policyName}`;
      const tokens = tokenSet(`${text} ${risk.reasoning} ${risk.policyName}`);
      const bucket = recentByCategory.get(risk.category) ?? [];

      const isNearDuplicate = bucket.some((b) => {
        if (Math.abs(finding.second - b.second) > VIDEO_DEDUPE_WINDOW_SECONDS) {
          return false;
        }
        return jaccard(tokens, b.tokens) >= 0.58;
      });
      if (isNearDuplicate) continue;

      bucket.push({ second: finding.second, tokens });
      recentByCategory.set(
        risk.category,
        bucket.filter((b) => Math.abs(finding.second - b.second) <= VIDEO_DEDUPE_WINDOW_SECONDS)
      );

      flags.push({
        text,
        category:
          risk.category === "privacy" ? "community_guidelines" : risk.category,
        severity: risk.severity,
        policyName: `${risk.policyName} (Video Frame)`,
        policyQuote:
          "Flag derived from frame-level visual analysis of uploaded video.",
        impact: risk.impact,
        saferRewrite:
          "Blur/crop sensitive visuals or replace with non-graphic and non-identifying alternatives.",
        reasoning: `${risk.reasoning} Timecode: ${finding.timecode}.`,
      });
    }
  }

  return flags;
}

export function videoFindingsToLegalFlags(
  findings: VideoFrameFinding[]
): LegalFlag[] {
  const flags: LegalFlag[] = [];
  const recent: Array<{ second: number; tokens: Set<string> }> = [];

  for (const finding of findings) {
    for (const risk of finding.risks ?? []) {
      if (risk.category !== "privacy") continue;
      if (!hasStrongPrivacyEvidenceFromVideoRisk(risk)) continue;
      const text = `[Video ${finding.timecode}] ${risk.detectedText ?? "Sensitive visual detail"}`;
      const tokens = tokenSet(`${text} ${risk.reasoning} ${risk.policyName}`);

      const isNearDuplicate = recent.some((prev) => {
        if (Math.abs(finding.second - prev.second) > VIDEO_DEDUPE_WINDOW_SECONDS) {
          return false;
        }
        return jaccard(tokens, prev.tokens) >= 0.58;
      });
      if (isNearDuplicate) continue;
      recent.push({ second: finding.second, tokens });

      flags.push({
        text,
        person: "Identifiable individual",
        riskType: "privacy",
        severity:
          risk.severity === "severe"
            ? "severe"
            : risk.severity === "high"
            ? "high"
            : "medium",
        reasoning: `${risk.reasoning} Timecode: ${finding.timecode}.`,
        saferRewrite:
          "Blur or remove identifying visual information before publication.",
        counselReview: risk.severity === "severe",
        confidence: 0.75,
      });
    }
  }

  return flags;
}
