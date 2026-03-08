import type { LegalFlag, PolicyFlag, VideoFrameFinding } from "./types";

const ADDRESS_SUFFIX =
  "(street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd|court|ct|way|place|pl|terrace|ter|parkway|pkwy)";

const PHONE_REGEX =
  /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b/;
const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const DIRECT_ID_REGEX =
  /\b(ssn|social security|passport|driver'?s license|account number|routing number|bank account|credit card|debit card)\b/i;
const BLURRED_VISUAL_REGEX =
  /\b(blurred|pixelated|redacted|obscured|censored)\b/i;
const PUBLIC_RECORD_TECHNICAL_REGEX =
  /\b(ip address|ipv4|ipv6|meta platforms business record|business record|device fingerprint|agent string|user agent|login(?: action)?|photo uploaded|timestamp|geolocation|license plate)\b/i;
const ADDRESS_STOPWORDS = new Set([
  "am",
  "pm",
  "a",
  "an",
  "the",
  "of",
  "on",
  "in",
  "at",
  "to",
  "for",
  "from",
  "mile",
  "miles",
  "minute",
  "minutes",
  "hour",
  "hours",
  "day",
  "days",
  "year",
  "years",
  "o'clock",
  "oclock",
]);

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

function extractStreetAddress(text: string): string | null {
  const addressRegex = new RegExp(
    `\\b\\d{1,6}\\s+(?:[a-z0-9.'-]+\\s+){1,5}${ADDRESS_SUFFIX}\\b`,
    "ig"
  );

  for (const match of text.matchAll(addressRegex)) {
    const candidate = match[0].trim();
    const tokens = candidate
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const middle = tokens.slice(1, -1);
    const informative = middle.filter(
      (token) => !ADDRESS_STOPWORDS.has(token) && /[a-z]/.test(token)
    );
    if (informative.length === 0) continue;
    if (
      middle.length > 0 &&
      (ADDRESS_STOPWORDS.has(middle[0]) || middle[0].includes("'")) &&
      informative.length < 2
    ) {
      continue;
    }
    return candidate;
  }

  return null;
}

function hasHardYoutubePrivacyEvidenceFromVideoRisk(
  risk: VideoFrameFinding["risks"][number]
): boolean {
  const joined = `${risk.policyName} ${risk.reasoning} ${risk.detectedText ?? ""}`;
  if (PUBLIC_RECORD_TECHNICAL_REGEX.test(joined)) return false;
  if (extractStreetAddress(joined)) return true;
  if (PHONE_REGEX.test(joined)) return true;
  if (EMAIL_REGEX.test(joined)) return true;
  if (DIRECT_ID_REGEX.test(joined)) return true;
  if (
    MINOR_VISUAL_REGEX.test(joined) &&
    FACE_VISUAL_REGEX.test(joined) &&
    !BLURRED_VISUAL_REGEX.test(joined)
  ) {
    return true;
  }
  return false;
}

function hasHardLegalPrivacyEvidenceFromVideoRisk(
  risk: VideoFrameFinding["risks"][number]
): boolean {
  return hasHardYoutubePrivacyEvidenceFromVideoRisk(risk);
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
      /\b(maggots|rotting flesh|skin sloughing|body fluids|liquefied remains|dismember(?:ed|ment)?|behead(?:ed|ing)?|decapitat(?:ed|ion)|severed (?:head|limb|arm|leg)|brain matter|guts|entrails|intestines|exposed bone)\b/i,
    severity: "severe",
    impact: "no_ads",
    policyName: "Graphic Violence and Gore",
    reason:
      "Detected explicit gore or extreme post-mortem detail far beyond standard true-crime narration.",
  },
  {
    regex:
      /\b(mold beginning to form|blood[- ]soaked|pool of blood|open wound|charred remains)\b/i,
    severity: "high",
    impact: "limited_ads",
    policyName: "Graphic Injury Detail",
    reason:
      "Detected unusually graphic bodily-detail phrasing that can reduce ad suitability.",
  },
];

function severityForProfanity(word: string): "low" | "medium" | "high" {
  if (word === "damn") return "low";
  if (word === "shit" || word === "bitch" || word === "bastard") return "medium";
  return "high";
}

function excerptAroundAddress(text: string): string {
  const WINDOW = 90;
  const address = extractStreetAddress(text);
  if (address) {
    const idx = text.toLowerCase().indexOf(address.toLowerCase());
    const start = Math.max(0, idx - WINDOW);
    const end = Math.min(text.length, idx + address.length + WINDOW);
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

    if (extractStreetAddress(text)) {
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

    const profanityHits = PROFANITY_REGEXES.filter(({ regex }) => regex.test(text));
    const strongProfanityHits = profanityHits.filter(
      ({ word }) => severityForProfanity(word) === "high"
    );
    if (
      strongProfanityHits.length >= 2 ||
      strongProfanityHits.some(
        ({ word }) => word === "motherfucker" || word === "cunt"
      )
    ) {
      const key = `curse:${lineNumber}`;
      if (seen.has(key)) continue;
      seen.add(key);
      flags.push({
        line: lineNumber,
        text,
        category: "monetization",
        severity: "medium",
        policyName: "Advertiser-Friendly Language",
        policyQuote:
          "Frequent or strong profanity can reduce ad suitability.",
        impact: "limited_ads",
        saferRewrite:
          "Use toned-down language or bleep/remove the strongest profanity in narration.",
        reasoning:
          "Detected multiple strong profanity hits in a single line, which is more likely to matter than isolated quoted profanity.",
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
    if (!extractStreetAddress(text)) continue;
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
      const joined = `${risk.policyName} ${risk.reasoning} ${risk.detectedText ?? ""}`;
      if (BLURRED_VISUAL_REGEX.test(joined) && risk.category !== "privacy") {
        continue;
      }
      if (
        PUBLIC_RECORD_TECHNICAL_REGEX.test(joined) &&
        !hasHardYoutubePrivacyEvidenceFromVideoRisk(risk)
      ) {
        continue;
      }
      if (risk.category === "privacy" && !hasHardYoutubePrivacyEvidenceFromVideoRisk(risk)) {
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
      if (!hasHardLegalPrivacyEvidenceFromVideoRisk(risk)) continue;
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
