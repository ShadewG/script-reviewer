export function numberLines(script: string): string {
  return script
    .split("\n")
    .map((line, i) => `${i + 1}: ${line}`)
    .join("\n");
}

export function extractSurroundingContext(
  script: string,
  lineNumber: number,
  contextLines = 3
): string {
  const lines = script.split("\n");
  const start = Math.max(0, lineNumber - 1 - contextLines);
  const end = Math.min(lines.length, lineNumber + contextLines);
  return lines
    .slice(start, end)
    .map((line, i) => `${start + i + 1}: ${line}`)
    .join("\n");
}
