const MAX_ANALYSIS_LINE_LENGTH = 280;

function splitLongChunkByWords(text: string, maxLen = MAX_ANALYSIS_LINE_LENGTH): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const word of words) {
    if (current && current.length + word.length + 1 > maxLen) {
      chunks.push(current.trim());
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function splitSentenceLikeBoundaries(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const parts: string[] = [];
  let current = "";

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    current += char;

    if (!/[.!?…]/.test(char)) continue;

    let j = i + 1;
    while (j < normalized.length && /["')\]]/.test(normalized[j])) {
      current += normalized[j];
      i = j;
      j++;
    }

    while (j < normalized.length && /\s/.test(normalized[j])) {
      j++;
    }

    const next = normalized[j];
    if (!next || /[A-Z0-9"'(\[]/.test(next)) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      i = j - 1;
    }
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

function splitLongLine(text: string, maxLen = MAX_ANALYSIS_LINE_LENGTH): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  if (normalized.length <= maxLen) return [normalized];

  const sentenceParts = splitSentenceLikeBoundaries(normalized);
  if (sentenceParts.length <= 1) {
    return splitLongChunkByWords(normalized, maxLen);
  }

  const chunks: string[] = [];
  let current = "";

  for (const part of sentenceParts) {
    if (part.length > maxLen) {
      if (current) {
        chunks.push(current.trim());
        current = "";
      }
      chunks.push(...splitLongChunkByWords(part, maxLen));
      continue;
    }

    if (current && current.length + part.length + 1 > maxLen) {
      chunks.push(current.trim());
      current = part;
    } else {
      current = current ? `${current} ${part}` : part;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function normalizeScriptForAnalysis(input: string): string {
  const normalizedNewlines = input.replace(/\r\n?/g, "\n");
  const lines = normalizedNewlines.split("\n");
  const out: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push("");
      continue;
    }

    if (trimmed.length > MAX_ANALYSIS_LINE_LENGTH) {
      const chunks = splitLongLine(trimmed, MAX_ANALYSIS_LINE_LENGTH);
      if (chunks.length > 1) {
        out.push(...chunks);
        continue;
      }
    }

    out.push(trimmed.replace(/\s+/g, " "));
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
