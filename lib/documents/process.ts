import Anthropic from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";
import type { DocumentFacts } from "./types";

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

  // Parse JSON response
  let cleaned = result.trim();
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
    return {
      fileName,
      docType: (parsed.docType as string) ?? "other",
      summary: (parsed.summary as string) ?? "",
      people: (parsed.people as DocumentFacts["people"]) ?? [],
      events: (parsed.events as DocumentFacts["events"]) ?? [],
      evidence: (parsed.evidence as DocumentFacts["evidence"]) ?? [],
      quotes: (parsed.quotes as DocumentFacts["quotes"]) ?? [],
      verifiableFacts:
        (parsed.verifiableFacts as DocumentFacts["verifiableFacts"]) ?? [],
    };
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
    return {
      fileName,
      docType: (parsed.docType as string) ?? "other",
      summary: (parsed.summary as string) ?? "",
      people: (parsed.people as DocumentFacts["people"]) ?? [],
      events: (parsed.events as DocumentFacts["events"]) ?? [],
      evidence: (parsed.evidence as DocumentFacts["evidence"]) ?? [],
      quotes: (parsed.quotes as DocumentFacts["quotes"]) ?? [],
      verifiableFacts:
        (parsed.verifiableFacts as DocumentFacts["verifiableFacts"]) ?? [],
    };
  }

  console.log(
    `[upload-docs] Merging ${parts.length}/${chunks.length} chunks for "${fileName}" (${totalPages} pages)`
  );
  return mergeExtractions(parts, fileName);
}
