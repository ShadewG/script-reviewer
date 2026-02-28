import type { LegalFlag, PolicyFlag } from "./types";

const ADDRESS_SUFFIX =
  "(street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd|court|ct|way|place|pl|terrace|ter|parkway|pkwy)";

const ADDRESS_REGEXES = [
  new RegExp(
    `\\b\\d{1,6}\\s+(?:[a-z0-9.'-]+\\s+){0,5}${ADDRESS_SUFFIX}\\b`,
    "i"
  ),
  new RegExp(`\\b${ADDRESS_SUFFIX}\\s+\\d{1,6}\\b`, "i"),
];

const PROFANITY_WORDS = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "motherfucker",
  "cunt",
  "damn",
  "bastard",
  "dick",
];

function buildObfuscatedProfanityRegex(word: string): RegExp {
  const chars = word.split("");
  const pattern = chars
    .map((ch) => {
      const isVowel = /[aeiou]/.test(ch);
      return isVowel ? `${ch}?[^a-z\\n\\r]*` : `${ch}[^a-z\\n\\r]*`;
    })
    .join("");
  return new RegExp(`\\b${pattern}\\b`, "i");
}

const PROFANITY_REGEXES = PROFANITY_WORDS.map((word) => ({
  word,
  regex: buildObfuscatedProfanityRegex(word),
}));

function severityForProfanity(word: string): "low" | "medium" | "high" {
  if (word === "damn") return "low";
  if (word === "shit" || word === "bitch" || word === "bastard") return "medium";
  return "high";
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
        flags.push({
          line: lineNumber,
          text,
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

    flags.push({
      line: lineNumber,
      text,
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
