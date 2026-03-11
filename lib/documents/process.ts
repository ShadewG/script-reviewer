import Anthropic from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import type { DocumentFacts } from "./types";
import { callGPTMiniDetailed } from "@/lib/ai/openai";

const require = createRequire(import.meta.url);

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic)
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

const EXTRACTION_SYSTEM = `You are analyzing a legal document (police report, court filing, autopsy report, witness statement, etc.) related to a criminal case. Extract ALL factual information that could verify or contradict claims in a documentary script.

Return ONLY valid JSON in this exact format:
{
  "docType": "police_report|autopsy|court_filing|witness_statement|other",
  "summary": "2-3 sentence summary of what this document contains",
  "people": [
    {
      "name": "Full Name",
      "role": "suspect|victim|witness|officer|attorney|medical_examiner|other",
      "actions": ["specific actions documented"],
      "pageRefs": [1, 3]
    }
  ],
  "events": [
    {
      "description": "What happened",
      "date": "YYYY-MM-DD if mentioned",
      "time": "HH:MM if mentioned",
      "page": 1
    }
  ],
  "evidence": [
    {
      "type": "bodycam|surveillance|911_call|photo|forensic|testimony|physical|digital|other",
      "description": "Description of the evidence",
      "page": 1
    }
  ],
  "quotes": [
    {
      "text": "Exact quote from the document",
      "speaker": "Name or role of speaker",
      "page": 1
    }
  ],
  "verifiableFacts": [
    {
      "claim": "A specific factual claim that can verify or contradict script statements",
      "source": "Where in the document (e.g. 'Police report p.3', 'Autopsy findings')",
      "confidence": "confirmed|likely|uncertain"
    }
  ]
}

Focus on facts relevant to defamation and legal review:
- Confirmed identities and roles (who is officially named as suspect, victim, etc.)
- Official case status and charges
- Cause of death / injuries (official findings)
- Timeline of events with dates
- What is documented fact vs. allegation
- Evidence that exists (bodycam footage, 911 recordings, etc.)
- Official statements from officers, witnesses
- Case disposition or outcome

Be thorough but CONCISE — extract every verifiable fact, but keep descriptions SHORT (1-2 sentences max per item). Do NOT include long narrative summaries of individual events. Focus on extractable facts: names, dates, charges, cause of death, evidence types, key quotes. These will be cross-referenced against a documentary script to reduce false legal flags.`;

// Anthropic hard-limits PDFs to 100 pages. Keep headroom to avoid edge-case counting mismatches.
const MAX_PDF_PAGES = 90;
const EXTRACTION_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1200;
const MAX_TEXT_CHARS_PER_CHUNK = 60_000;
const MIN_PDF_TEXT_CHARS = 500;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientAnthropicError(message: string): boolean {
  const msg = message.toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("overloaded") ||
    msg.includes("timeout") ||
    msg.includes("503") ||
    msg.includes("529") ||
    msg.includes("econnreset")
  );
}

/** Split a PDF into chunks of ≤ MAX_PDF_PAGES, returning each as a Buffer */
async function splitPdf(
  fileBuffer: Buffer
): Promise<{ chunks: Buffer[]; totalPages: number }> {
  const srcDoc = await PDFDocument.load(fileBuffer);
  const totalPages = srcDoc.getPageCount();

  if (totalPages <= MAX_PDF_PAGES) {
    return { chunks: [fileBuffer], totalPages };
  }

  const chunks: Buffer[] = [];
  for (let start = 0; start < totalPages; start += MAX_PDF_PAGES) {
    const end = Math.min(start + MAX_PDF_PAGES, totalPages);
    const chunkDoc = await PDFDocument.create();
    const copied = await chunkDoc.copyPages(
      srcDoc,
      Array.from({ length: end - start }, (_, i) => start + i)
    );
    for (const page of copied) chunkDoc.addPage(page);
    const bytes = await chunkDoc.save();
    chunks.push(Buffer.from(bytes));
  }

  console.log(
    `[upload-docs] Split ${totalPages}-page PDF into ${chunks.length} chunks`
  );
  return { chunks, totalPages };
}

/** Call Claude to extract facts from a single document (≤100 page PDF or image) */
async function extractFromContent(
  contentBlocks: Anthropic.Messages.ContentBlockParam[],
  fileName: string
): Promise<Record<string, unknown>> {
  let result: string;
  for (let attempt = 1; ; attempt++) {
    try {
      const stream = getAnthropic().messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 32000,
        system: EXTRACTION_SYSTEM,
        messages: [{ role: "user", content: contentBlocks }],
        temperature: 0.1,
      });
      const response = await stream.finalMessage();
      result =
        response.content[0].type === "text" ? response.content[0].text : "";
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        attempt < EXTRACTION_RETRIES && isTransientAnthropicError(msg);
      console.error(
        `[upload-docs] Claude API error for "${fileName}" (attempt ${attempt}/${EXTRACTION_RETRIES}):`,
        msg
      );
      if (!isTransient) {
        throw new Error(`Claude API error: ${msg}`);
      }
      await wait(RETRY_BASE_DELAY_MS * attempt);
    }
  }

  if (!result) {
    throw new Error(`Claude returned empty response for "${fileName}"`);
  }

  return parseExtractionJson(result, fileName);
}

function parseExtractionJson(
  rawResult: string,
  fileName: string
): Record<string, unknown> {
  let cleaned = rawResult.trim();
  cleaned = cleaned
    .replace(/^```[\w]*\s*\n?/, "")
    .replace(/\n?```\s*$/, "");

  if (!cleaned.startsWith("{")) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) cleaned = match[0];
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    // Fix truncated JSON: find last complete entry, close brackets
    try {
      let fixed = cleaned;
      const lastGoodPoints = [
        fixed.lastIndexOf("},"),
        fixed.lastIndexOf("],"),
        fixed.lastIndexOf('"],'),
        fixed.lastIndexOf("true,"),
        fixed.lastIndexOf("false,"),
      ].filter((i) => i > 0);

      if (lastGoodPoints.length > 0) {
        const cutAt = Math.max(...lastGoodPoints);
        fixed = fixed.slice(0, cutAt + 1);
      } else {
        const quoteCount = (fixed.match(/(?<!\\)"/g) || []).length;
        if (quoteCount % 2 !== 0) fixed += '"';
      }

      fixed = fixed.replace(/,\s*$/, "");
      const braceOpens = (fixed.match(/\{/g) || []).length;
      const braceCloses = (fixed.match(/\}/g) || []).length;
      const bracketOpens = (fixed.match(/\[/g) || []).length;
      const bracketCloses = (fixed.match(/\]/g) || []).length;
      for (let i = 0; i < braceOpens - braceCloses; i++) fixed += "}";
      for (let i = 0; i < bracketOpens - bracketCloses; i++) fixed += "]";
      const parsed = JSON.parse(fixed);
      console.log(
        `[upload-docs] Recovered truncated JSON for "${fileName}" (${Object.keys(parsed).length} keys)`
      );
      return parsed;
    } catch {
      console.error(
        `[upload-docs] JSON parse failed for "${fileName}". Last 300 chars:`,
        cleaned.slice(-300)
      );
      throw new Error(
        `Failed to parse document extraction result for "${fileName}"`
      );
    }
  }
}

async function extractFromPlainText(
  text: string,
  fileName: string
): Promise<Record<string, unknown>> {
  const prompt = `Extract all factual information from this document. File: ${fileName}

DOCUMENT TEXT:
${text}`;
  const result = await callGPTMiniDetailed(EXTRACTION_SYSTEM, prompt);
  if (!result.text) {
    throw new Error(`OpenAI returned empty response for "${fileName}"`);
  }
  return parseExtractionJson(result.text, fileName);
}

async function runPdftotext(fileBuffer: Buffer): Promise<string> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "script-reviewer-pdf-"));
  const inputPath = path.join(tempDir, "input.pdf");
  try {
    await writeFile(inputPath, fileBuffer);
    return await new Promise<string>((resolve, reject) => {
      execFile(
        "pdftotext",
        ["-layout", "-enc", "UTF-8", inputPath, "-"],
        { maxBuffer: 64 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message));
            return;
          }
          resolve(stdout);
        }
      );
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function runPdfParseText(fileBuffer: Buffer): Promise<string> {
  const { PDFParse } = require("pdf-parse") as {
    PDFParse: new (input: { data: Buffer }) => {
      getText: () => Promise<{ text?: string }>;
      destroy: () => Promise<void>;
    };
  };
  const parser = new PDFParse({ data: fileBuffer });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    try {
      await parser.destroy();
    } catch {
      // Best-effort cleanup only.
    }
  }
}

async function extractPdfText(fileBuffer: Buffer, fileName: string): Promise<string | null> {
  try {
    return await runPdftotext(fileBuffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[upload-docs] pdftotext failed for "${fileName}": ${msg}`);
  }

  try {
    const fallbackText = await runPdfParseText(fileBuffer);
    if (fallbackText.trim()) {
      console.log(`[upload-docs] pdf-parse fallback succeeded for "${fileName}"`);
      return fallbackText;
    }
    console.warn(`[upload-docs] pdf-parse returned no text for "${fileName}"`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[upload-docs] pdf-parse failed for "${fileName}": ${msg}`);
  }

  return null;
}

function splitPdfTextIntoChunks(
  text: string
): Array<{ label: string; text: string }> {
  const pages = text
    .split("\f")
    .map((page) => page.trim())
    .filter(Boolean);

  if (pages.length === 0) return [];

  const chunks: Array<{ label: string; text: string }> = [];
  let chunkStartPage = 1;
  let currentPages: string[] = [];
  let currentLength = 0;

  const flush = (endPage: number) => {
    if (!currentPages.length) return;
    const label =
      chunkStartPage === endPage
        ? `page ${chunkStartPage}`
        : `pages ${chunkStartPage}-${endPage}`;
    chunks.push({ label, text: currentPages.join("\n\n") });
    currentPages = [];
    currentLength = 0;
  };

  pages.forEach((pageText, index) => {
    const pageNumber = index + 1;
    const pageBlock = `Page ${pageNumber}\n${pageText}`;
    if (
      currentPages.length > 0 &&
      currentLength + pageBlock.length + 2 > MAX_TEXT_CHARS_PER_CHUNK
    ) {
      flush(pageNumber - 1);
      chunkStartPage = pageNumber;
    }
    currentPages.push(pageBlock);
    currentLength += pageBlock.length + 2;
  });

  flush(pages.length);
  return chunks;
}

function splitChunkTextIntoPages(text: string): string[] {
  return text
    .split(/(?=Page \d+\n)/)
    .map((page) => page.trim())
    .filter(Boolean);
}

function deriveChunkLabelFromPages(pages: string[]): string {
  const numbers = pages
    .map((page) => {
      const match = page.match(/^Page (\d+)\n/);
      return match ? Number(match[1]) : null;
    })
    .filter((value): value is number => value !== null);

  if (numbers.length === 0) return "partial";
  if (numbers[0] === numbers[numbers.length - 1]) return `page ${numbers[0]}`;
  return `pages ${numbers[0]}-${numbers[numbers.length - 1]}`;
}

async function extractChunkWithRetry(
  fileName: string,
  chunkLabel: string,
  chunkText: string
): Promise<Record<string, unknown>[]> {
  const label = `${fileName} (${chunkLabel})`;
  try {
    return [await extractFromPlainText(chunkText, label)];
  } catch (err) {
    const pages = splitChunkTextIntoPages(chunkText);
    if (pages.length <= 1) throw err;

    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[upload-docs] Retrying "${label}" as smaller text chunks after error: ${msg}`
    );

    const midpoint = Math.ceil(pages.length / 2);
    const leftPages = pages.slice(0, midpoint);
    const rightPages = pages.slice(midpoint);

    const left = await extractChunkWithRetry(
      fileName,
      deriveChunkLabelFromPages(leftPages),
      leftPages.join("\n\n")
    );
    const right = await extractChunkWithRetry(
      fileName,
      deriveChunkLabelFromPages(rightPages),
      rightPages.join("\n\n")
    );
    return [...left, ...right];
  }
}

async function extractFromPdfText(
  fileBuffer: Buffer,
  fileName: string
): Promise<DocumentFacts | null> {
  const text = await extractPdfText(fileBuffer, fileName);
  if (!text) return null;

  const trimmed = text.trim();
  if (trimmed.length < MIN_PDF_TEXT_CHARS) {
    console.warn(
      `[upload-docs] pdftotext output too small for "${fileName}" (${trimmed.length} chars)`
    );
    return null;
  }

  const textChunks = splitPdfTextIntoChunks(trimmed);
  if (textChunks.length === 0) return null;

  const parts: Record<string, unknown>[] = [];
  for (const chunk of textChunks) {
    if (textChunks.length === 1) {
      parts.push(await extractFromPlainText(chunk.text, fileName));
      continue;
    }
    parts.push(...(await extractChunkWithRetry(fileName, chunk.label, chunk.text)));
  }

  const merged = normalizeDocumentFacts(mergeExtractions(parts, fileName));
  merged.rawTextPreview = trimToMax(trimmed, 5000);
  return merged;
}

/** Merge multiple extraction results into a single DocumentFacts, deduplicating people by name */
function mergeExtractions(
  parts: Record<string, unknown>[],
  fileName: string
): DocumentFacts {
  const people = new Map<string, DocumentFacts["people"][number]>();
  const events: DocumentFacts["events"] = [];
  const evidence: DocumentFacts["evidence"] = [];
  const quotes: DocumentFacts["quotes"] = [];
  const verifiableFacts: DocumentFacts["verifiableFacts"] = [];
  const summaries: string[] = [];
  let docType = "other";

  for (const part of parts) {
    if (part.docType && typeof part.docType === "string") docType = part.docType;
    if (part.summary && typeof part.summary === "string")
      summaries.push(part.summary);

    for (const p of (part.people as DocumentFacts["people"]) ?? []) {
      const existing = people.get(p.name);
      if (existing) {
        // Merge actions and pageRefs
        const actionSet = new Set([...existing.actions, ...p.actions]);
        existing.actions = [...actionSet];
        existing.pageRefs = [
          ...new Set([...existing.pageRefs, ...p.pageRefs]),
        ].sort((a, b) => a - b);
      } else {
        people.set(p.name, { ...p });
      }
    }

    events.push(...((part.events as DocumentFacts["events"]) ?? []));
    evidence.push(...((part.evidence as DocumentFacts["evidence"]) ?? []));
    quotes.push(...((part.quotes as DocumentFacts["quotes"]) ?? []));
    verifiableFacts.push(
      ...((part.verifiableFacts as DocumentFacts["verifiableFacts"]) ?? [])
    );
  }

  // Deduplicate verifiable facts by claim text
  const seenClaims = new Set<string>();
  const uniqueFacts = verifiableFacts.filter((f) => {
    const key = f.claim.toLowerCase().trim();
    if (seenClaims.has(key)) return false;
    seenClaims.add(key);
    return true;
  });

  return {
    fileName,
    docType,
    summary: summaries.join(" "),
    people: [...people.values()],
    events,
    evidence,
    quotes,
    verifiableFacts: uniqueFacts,
  };
}

function trimToMax(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.slice(0, max);
}

function toNullableNumber(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return value as null | undefined;
  if (typeof value !== "number" || Number.isNaN(value)) return undefined;
  return value;
}

function normalizeDocumentFacts(input: DocumentFacts): DocumentFacts {
  const allowedConfidence = new Set(["confirmed", "likely", "uncertain"]);

  return {
    fileName: trimToMax(input.fileName, 255),
    docType: trimToMax(input.docType, 50),
    summary: trimToMax(input.summary, 5000),
    people: (input.people ?? []).slice(0, 100).map((p) => ({
      name: trimToMax(p.name, 200),
      role: trimToMax(p.role, 100),
      actions: (p.actions ?? []).slice(0, 50).map((a) => trimToMax(a, 500)),
      pageRefs: (p.pageRefs ?? [])
        .filter((n): n is number => typeof n === "number" && !Number.isNaN(n))
        .slice(0, 100),
    })),
    events: (input.events ?? []).slice(0, 200).map((e) => ({
      description: trimToMax(e.description, 1000),
      date:
        e.date === null || e.date === undefined
          ? e.date
          : trimToMax(e.date, 20),
      time:
        e.time === null || e.time === undefined
          ? e.time
          : trimToMax(e.time, 20),
      page: toNullableNumber(e.page),
    })),
    evidence: (input.evidence ?? []).slice(0, 100).map((e) => ({
      type: trimToMax(e.type, 100),
      description: trimToMax(e.description, 1000),
      page: toNullableNumber(e.page),
    })),
    quotes: (input.quotes ?? []).slice(0, 100).map((q) => ({
      text: trimToMax(q.text, 2000),
      speaker: trimToMax(q.speaker, 200),
      page: toNullableNumber(q.page),
    })),
    verifiableFacts: (input.verifiableFacts ?? []).slice(0, 200).map((f) => ({
      claim: trimToMax(f.claim, 2000),
      source: trimToMax(f.source, 500),
      confidence: allowedConfidence.has(f.confidence)
        ? f.confidence
        : "uncertain",
    })),
    rawTextPreview:
      input.rawTextPreview === null || input.rawTextPreview === undefined
        ? input.rawTextPreview
        : trimToMax(input.rawTextPreview, 5000),
  };
}

export async function processDocument(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<DocumentFacts> {
  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";

  if (!isImage && !isPdf) {
    throw new Error(
      `Unsupported file type: ${mimeType}. Accepts PDF, PNG, JPG, WEBP.`
    );
  }

  // Images: single extraction call
  if (isImage) {
    const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: mimeType as
            | "image/png"
            | "image/jpeg"
            | "image/webp"
            | "image/gif",
          data: fileBuffer.toString("base64"),
        },
      },
      {
        type: "text",
        text: `Extract all factual information from this document. File: ${fileName}`,
      },
    ];
    const parsed = await extractFromContent(contentBlocks, fileName);
    return normalizeDocumentFacts({
      fileName,
      docType: (parsed.docType as string) ?? "other",
      summary: (parsed.summary as string) ?? "",
      people: (parsed.people as DocumentFacts["people"]) ?? [],
      events: (parsed.events as DocumentFacts["events"]) ?? [],
      evidence: (parsed.evidence as DocumentFacts["evidence"]) ?? [],
      quotes: (parsed.quotes as DocumentFacts["quotes"]) ?? [],
      verifiableFacts:
        (parsed.verifiableFacts as DocumentFacts["verifiableFacts"]) ?? [],
    });
  }

  const textExtractedFacts = await extractFromPdfText(fileBuffer, fileName);
  if (textExtractedFacts) {
    console.log(
      `[upload-docs] Extracted "${fileName}" from PDF text (${textExtractedFacts.verifiableFacts.length} facts)`
    );
    return textExtractedFacts;
  }

  // PDF: split if > 100 pages and process chunks sequentially to reduce rate-limit failures
  const { chunks, totalPages } = await splitPdf(fileBuffer);

  const parts: Record<string, unknown>[] = [];
  const errors: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const pageStart = i * MAX_PDF_PAGES + 1;
    const pageEnd = Math.min((i + 1) * MAX_PDF_PAGES, totalPages);
    const label =
      chunks.length > 1 ? `${fileName} (pages ${pageStart}-${pageEnd})` : fileName;

    const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: chunk.toString("base64"),
        },
      } as Anthropic.Messages.ContentBlockParam,
      {
        type: "text",
        text: `Extract all factual information from this document. File: ${label}`,
      },
    ];

    try {
      const parsed = await extractFromContent(contentBlocks, label);
      parts.push(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Chunk processing failed";
      errors.push(msg);
      console.error(
        `[upload-docs] Chunk ${i + 1}/${chunks.length} failed for "${fileName}": ${msg}`
      );
    }
  }

  if (parts.length === 0) {
    throw new Error(
      `All chunks failed for "${fileName}": ${errors.join("; ")}`
    );
  }

  if (parts.length === 1 && chunks.length === 1) {
    const parsed = parts[0];
    return normalizeDocumentFacts({
      fileName,
      docType: (parsed.docType as string) ?? "other",
      summary: (parsed.summary as string) ?? "",
      people: (parsed.people as DocumentFacts["people"]) ?? [],
      events: (parsed.events as DocumentFacts["events"]) ?? [],
      evidence: (parsed.evidence as DocumentFacts["evidence"]) ?? [],
      quotes: (parsed.quotes as DocumentFacts["quotes"]) ?? [],
      verifiableFacts:
        (parsed.verifiableFacts as DocumentFacts["verifiableFacts"]) ?? [],
    });
  }

  console.log(
    `[upload-docs] Merging ${parts.length}/${chunks.length} chunks for "${fileName}" (${totalPages} pages)`
  );
  return normalizeDocumentFacts(mergeExtractions(parts, fileName));
}
