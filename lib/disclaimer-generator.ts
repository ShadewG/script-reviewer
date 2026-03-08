import type { SynthesisReport, LegalFlag, PolicyFlag } from "@/lib/pipeline/types";

export function generateDisclaimers(
  report: SynthesisReport | null,
  legalFlags: LegalFlag[],
  policyFlags: PolicyFlag[],
  hasMinors: boolean
): string[] {
  const disclaimers: string[] = [];

  const hasCounselReview = legalFlags.some((f) => f.counselReview);
  const hasDefamation = legalFlags.some((f) =>
    f.riskType.includes("defamation") || f.riskType.includes("libel")
  );
  const hasPrivacy = legalFlags.some((f) =>
    f.riskType.includes("privacy") || f.riskType.includes("false_light")
  );
  const hasGraphic = policyFlags.some((f) =>
    f.category === "community_guidelines" &&
    (f.policyName.toLowerCase().includes("graphic") ||
      f.policyName.toLowerCase().includes("violence") ||
      f.policyName.toLowerCase().includes("disturbing"))
  );
  const hasUnsolved = report?.riskDashboard?.legal === "high" ||
    legalFlags.some((f) => f.reasoning.toLowerCase().includes("unsolved") ||
      f.reasoning.toLowerCase().includes("not charged") ||
      f.reasoning.toLowerCase().includes("suspect"));

  if (hasCounselReview) {
    disclaimers.push(
      "The allegations discussed in this video are based on publicly available court records and official proceedings. All individuals are presumed innocent until proven guilty in a court of law."
    );
  }

  if (hasDefamation) {
    disclaimers.push(
      "This content is based on official public records, court filings, and verified news reports. All factual claims are sourced from documented proceedings."
    );
  }

  if (hasPrivacy) {
    disclaimers.push(
      "Certain names, locations, and identifying details may have been changed or omitted to protect the privacy of individuals not directly involved in public proceedings."
    );
  }

  if (hasMinors) {
    disclaimers.push(
      "The identities of minors referenced in this case have been protected. No identifying information about individuals under 18 has been disclosed."
    );
  }

  if (hasGraphic) {
    disclaimers.push(
      "Viewer discretion is advised. This video contains descriptions of violent crimes and disturbing subject matter that may not be suitable for all audiences."
    );
  }

  if (hasUnsolved) {
    disclaimers.push(
      "This case remains under investigation. No individual discussed in this video has been charged with or convicted of any crime unless explicitly stated."
    );
  }

  if (disclaimers.length === 0) {
    disclaimers.push(
      "This content is presented for informational and educational purposes. All information is based on publicly available sources."
    );
  }

  return disclaimers;
}
