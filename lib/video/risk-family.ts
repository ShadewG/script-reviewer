import type { VideoFrameRisk } from "@/lib/pipeline/types";

const SEVERITY_ORDER: Record<VideoFrameRisk["severity"], number> = {
  low: 1,
  medium: 2,
  high: 3,
  severe: 4,
};

export function normalizeVideoRiskText(input: string): string {
  return input
    .toLowerCase()
    .replace(/\[video\s+\d\d:\d\d:\d\d\]/g, " ")
    .replace(/\b\d{2}:\d{2}:\d{2}\b/g, " ")
    .replace(/\b\d{1,4}[-/:]\d{1,4}[-/:]?\d{0,4}\b/g, " ")
    .replace(/\b[0-9a-f]{2,}\b/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function videoRiskFamilyKey(risk: VideoFrameRisk): string {
  const joined = normalizeVideoRiskText(
    `${risk.policyName} ${risk.reasoning} ${risk.detectedText ?? ""}`
  );

  if (
    risk.category === "privacy" &&
    /\b(minor|child|daughter|son|grandchild|juvenile|face|portrait|unblurred)\b/.test(joined)
  ) {
    return "privacy:minor_identity";
  }
  if (
    risk.category === "privacy" &&
    /\b(ip address|ipv4|ipv6|meta platforms|device identifier|device fingerprint|user agent|agent string|login|account activity)\b/.test(joined)
  ) {
    return "privacy:technical_record";
  }
  if (
    risk.category === "privacy" &&
    /\b(personal overview|possible relatives|possible neighbors|possible neighbours|possible associates|possible address history|possible social media|possible usernames|possible owned properties|contact info|aliases|best match|people search|background report|data broker|dossier|doxxing)\b/.test(joined)
  ) {
    return "privacy:pii_dossier";
  }
  if (
    risk.category === "privacy" &&
    /\b(instagram|facebook|social media|followers|following|digital creator|profile photo|profile)\b/.test(joined)
  ) {
    return "privacy:social_profile";
  }
  if (
    risk.category === "privacy" &&
    /\b(phone|email|address|street|license plate|plate number|contact|home|property)\b/.test(joined)
  ) {
    return "privacy:contact_or_address";
  }
  if (/\b(casefile|communication doc|agency|phone field|in person|e mail|notes|report form)\b/.test(joined)) {
    return `${risk.category}:casefile_document`;
  }
  if (/\b(graphic|corpse|body|blood|decomposition|remains|gore|injury|grave)\b/.test(joined)) {
    return `${risk.category}:graphic_detail`;
  }

  return `${risk.category}:${normalizeVideoRiskText(risk.policyName).slice(0, 40) || "unknown"}`;
}

export function collapseVideoRisks(risks: VideoFrameRisk[]): VideoFrameRisk[] {
  const map = new Map<string, VideoFrameRisk>();

  for (const risk of risks) {
    const key = videoRiskFamilyKey(risk);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, risk);
      continue;
    }

    const severityDelta =
      (SEVERITY_ORDER[risk.severity] ?? 0) - (SEVERITY_ORDER[existing.severity] ?? 0);
    const detectedLength = (risk.detectedText ?? "").length - (existing.detectedText ?? "").length;
    const reasoningLength = risk.reasoning.length - existing.reasoning.length;

    if (severityDelta > 0 || (severityDelta === 0 && (detectedLength > 0 || reasoningLength > 0))) {
      map.set(key, risk);
    }
  }

  return [...map.values()].sort(
    (a, b) => (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0)
  );
}
