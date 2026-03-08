import type { VideoFrameFinding, VideoFrameRisk } from "@/lib/pipeline/types";

const CLUSTER_WINDOW_SECONDS = 180;
const SEVERITY_ORDER: Record<VideoFrameRisk["severity"], number> = {
  low: 1,
  medium: 2,
  high: 3,
  severe: 4,
};

type FindingCluster = {
  signature: string;
  startSecond: number;
  endSecond: number;
  count: number;
  representative: VideoFrameFinding;
  risks: Map<string, VideoFrameRisk>;
  selectionReasons: Set<string>;
  candidateScore: number;
};

function normalizeLoose(input: string): string {
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

function riskTokens(input: string): Set<string> {
  return new Set(
    normalizeLoose(input)
      .split(" ")
      .filter((token) => token.length >= 4)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union <= 0 ? 0 : intersection / union;
}

function dominantRisk(finding: VideoFrameFinding): VideoFrameRisk | null {
  const risks = finding.risks ?? [];
  if (risks.length === 0) return null;
  return [...risks].sort((a, b) => {
    const sev = (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0);
    if (sev !== 0) return sev;
    return a.category.localeCompare(b.category);
  })[0];
}

function riskFamilyKey(risk: VideoFrameRisk): string {
  const joined = normalizeLoose(
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
    /\b(personal overview|possible relatives|possible neighbors|possible neighbours|possible associates|possible address history|possible social media|possible usernames|possible owned properties|contact info|aliases|best match|people search|background report|data broker|dossier|doxxing)\b/.test(joined)
  ) {
    return "privacy:pii_dossier";
  }
  if (
    risk.category === "privacy" &&
    /\b(ip address|ipv4|ipv6|meta platforms|device identifier|device fingerprint|user agent|agent string|login|account activity)\b/.test(joined)
  ) {
    return "privacy:technical_record";
  }
  if (
    risk.category === "privacy" &&
    /\b(phone|email|address|street|license plate|plate number|contact|home|property)\b/.test(joined)
  ) {
    return "privacy:contact_or_address";
  }
  if (
    risk.category === "privacy" &&
    /\b(instagram|facebook|social media|followers|following|digital creator|profile photo|profile)\b/.test(joined)
  ) {
    return "privacy:social_profile";
  }
  if (/\b(casefile|communication doc|agency|phone field|in person|e mail|notes|report form)\b/.test(joined)) {
    return `${risk.category}:casefile_document`;
  }
  if (/\b(graphic|corpse|body|blood|decomposition|remains|gore|injury|grave)\b/.test(joined)) {
    return `${risk.category}:graphic_detail`;
  }

  const policy = normalizeLoose(risk.policyName).slice(0, 60);
  return `${risk.category}|${policy}`;
}

function buildFindingSignature(finding: VideoFrameFinding): string {
  const joined = normalizeLoose(
    (finding.risks ?? [])
      .map((risk) => `${risk.policyName} ${risk.reasoning} ${risk.detectedText ?? ""}`)
      .join(" ")
  );
  const dominant = dominantRisk(finding);
  if (!dominant) return "other:unknown";

  if (
    dominant.category === "privacy" &&
    /\b(ip address|ipv4|ipv6|meta platforms|device fingerprint|agent string|user agent|login|account)\b/.test(joined)
  ) {
    return "privacy:technical_record";
  }
  if (
    dominant.category === "privacy" &&
    /\b(phone|email|address|street|license plate|plate number|contact|passport|driver)\b/.test(joined)
  ) {
    return "privacy:contact_or_address";
  }
  if (
    dominant.category === "privacy" &&
    /\b(minor|child|daughter|son|grandchild|juvenile|unblurred|portrait|face)\b/.test(joined)
  ) {
    return "privacy:minor_identity";
  }
  if (
    /\b(gore|graphic|corpse|dead body|decomposition|blood|body|injury|wound)\b/.test(joined)
  ) {
    return `${dominant.category}:graphic_detail`;
  }
  if (
    /\b(network|watermark|player ui|lower third|news clip|tv clip|tiktok|instagram|youtube player|broadcast)\b/.test(joined)
  ) {
    return `${dominant.category}:third_party_footage`;
  }

  return `${dominant.category}:${normalizeLoose(dominant.policyName).slice(0, 40) || "unknown"}`;
}

function findingPriority(finding: VideoFrameFinding): number {
  const dominant = dominantRisk(finding);
  const severity = dominant ? SEVERITY_ORDER[dominant.severity] ?? 0 : 0;
  const candidate = finding.selectionMeta?.candidateScore ?? 0;
  const thumbnail = finding.thumbnailDataUrl ? 0.1 : 0;
  return severity * 10 + candidate + thumbnail;
}

function mergeRisks(target: Map<string, VideoFrameRisk>, source: VideoFrameFinding): void {
  for (const risk of source.risks ?? []) {
    const key = riskFamilyKey(risk);
    const existing = target.get(key);
    if (!existing) {
      target.set(key, risk);
      continue;
    }

    const severityDelta =
      (SEVERITY_ORDER[risk.severity] ?? 0) - (SEVERITY_ORDER[existing.severity] ?? 0);
    const detectedLength = (risk.detectedText ?? "").length - (existing.detectedText ?? "").length;
    const reasoningLength = risk.reasoning.length - existing.reasoning.length;

    if (severityDelta > 0 || (severityDelta === 0 && (detectedLength > 0 || reasoningLength > 0))) {
      target.set(key, risk);
    }
  }
}

export function clusterVideoFindings(findings: VideoFrameFinding[]): VideoFrameFinding[] {
  const clusters: FindingCluster[] = [];
  const sorted = [...findings].sort((a, b) => a.second - b.second);

  for (const finding of sorted) {
    if (!Array.isArray(finding.risks) || finding.risks.length === 0) continue;
    const signature = buildFindingSignature(finding);
    const findingTokens = riskTokens(
      (finding.risks ?? [])
        .map((risk) => `${risk.policyName} ${risk.reasoning} ${risk.detectedText ?? ""}`)
        .join(" ")
    );

    const cluster = clusters.find((candidate) => {
      if (candidate.signature !== signature) return false;
      if (finding.second - candidate.endSecond > CLUSTER_WINDOW_SECONDS) return false;
      const clusterTokens = riskTokens(
        [...candidate.risks.values()]
          .map((risk) => `${risk.policyName} ${risk.reasoning} ${risk.detectedText ?? ""}`)
          .join(" ")
      );
      if (findingTokens.size === 0 || clusterTokens.size === 0) return true;
      return jaccard(findingTokens, clusterTokens) >= 0.45;
    });

    if (!cluster) {
      const risks = new Map<string, VideoFrameRisk>();
      mergeRisks(risks, finding);
      clusters.push({
        signature,
        startSecond: finding.second,
        endSecond: finding.second,
        count: 1,
        representative: finding,
        risks,
        selectionReasons: new Set(finding.selectionMeta?.selectionReasons ?? []),
        candidateScore: finding.selectionMeta?.candidateScore ?? 0,
      });
      continue;
    }

    cluster.endSecond = Math.max(cluster.endSecond, finding.second);
    cluster.count += 1;
    mergeRisks(cluster.risks, finding);
    for (const reason of finding.selectionMeta?.selectionReasons ?? []) {
      cluster.selectionReasons.add(reason);
    }
    cluster.candidateScore = Math.max(cluster.candidateScore, finding.selectionMeta?.candidateScore ?? 0);
    if (findingPriority(finding) > findingPriority(cluster.representative)) {
      cluster.representative = finding;
    }
  }

  return clusters.map((cluster) => ({
    ...cluster.representative,
    second: cluster.startSecond,
    timecode: toTimecode(cluster.startSecond),
    risks: [...cluster.risks.values()].sort((a, b) => (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0)),
    selectionMeta: {
      ...cluster.representative.selectionMeta,
      candidateScore: cluster.candidateScore,
      selectionReasons: [...cluster.selectionReasons].sort(),
      incidentStartSecond: cluster.startSecond,
      incidentEndSecond: cluster.endSecond,
      incidentCount: cluster.count,
      incidentSignature: cluster.signature,
    },
  }));
}

function toTimecode(second: number): string {
  const h = String(Math.floor(second / 3600)).padStart(2, "0");
  const m = String(Math.floor((second % 3600) / 60)).padStart(2, "0");
  const s = String(second % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}
