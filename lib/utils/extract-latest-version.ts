/**
 * Extracts the latest (first) version from a script document that contains
 * multiple draft versions. Detects common version markers like
 * "Version X", "Draft X", "Script Revisions X", "Revision X".
 *
 * If no version markers are found, returns the full text.
 */
export function extractLatestVersion(text: string): string {
  const lines = text.split("\n");

  // Pattern that matches version/draft headers
  const versionPattern = /^(version|draft|script\s*revision|revision)\s*\d/i;

  // Find all version header line indices
  const versionStarts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (versionPattern.test(lines[i].trim())) {
      versionStarts.push(i);
    }
  }

  // No version markers or only one — return full text
  if (versionStarts.length <= 1) return text;

  // Take from the first version header to the second version header
  const latestEnd = versionStarts[1];
  return lines.slice(0, latestEnd).join("\n").trim();
}
