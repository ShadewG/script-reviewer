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
