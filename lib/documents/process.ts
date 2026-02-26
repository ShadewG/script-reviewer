import Anthropic from "@anthropic-ai/sdk";
import { PDFParse } from "pdf-parse";
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

Be thorough — extract EVERY verifiable fact. These will be cross-referenced against a documentary script to reduce false legal flags.`;

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

  let textContent: string | null = null;

  // For PDFs, try text extraction first (cheaper than vision)
  if (isPdf) {
    let parser: PDFParse | null = null;
    try {
      parser = new PDFParse({ data: fileBuffer });
      const textResult = await parser.getText();
      const totalPages = textResult.total || 1;
      const charsPerPage = textResult.text.length / totalPages;
      if (charsPerPage > 50) {
        textContent = textResult.text;
      }
    } catch {
      // pdf-parse failed — fall back to vision
    } finally {
      if (parser) await parser.destroy().catch(() => {});
    }
  }

  let result: string;

  if (textContent) {
    // Text-based extraction — no vision needed
    const truncated = textContent.slice(0, 30000);
    const stream = getAnthropic().messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      system: EXTRACTION_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Extract all facts from this document.\n\nFILE: ${fileName}\n\n${truncated}`,
        },
      ],
      temperature: 0.1,
    });
    const response = await stream.finalMessage();
    result =
      response.content[0].type === "text" ? response.content[0].text : "";
  } else {
    // Vision-based extraction — for scanned PDFs and images
    const base64 = fileBuffer.toString("base64");

    const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [];

    if (isPdf) {
      contentBlocks.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: base64,
        },
      } as Anthropic.Messages.ContentBlockParam);
    } else {
      contentBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mimeType as
            | "image/png"
            | "image/jpeg"
            | "image/webp"
            | "image/gif",
          data: base64,
        },
      });
    }

    contentBlocks.push({
      type: "text",
      text: `Extract all factual information from this document. File: ${fileName}`,
    });

    const stream = getAnthropic().messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      system: EXTRACTION_SYSTEM,
      messages: [{ role: "user", content: contentBlocks }],
      temperature: 0.1,
    });
    const response = await stream.finalMessage();
    result =
      response.content[0].type === "text" ? response.content[0].text : "";
  }

  // Parse JSON response
  let cleaned = result.trim();
  cleaned = cleaned
    .replace(/^```[\w]*\s*\n?/, "")
    .replace(/\n?```\s*$/, "");

  // Find JSON object in response
  if (!cleaned.startsWith("{")) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) cleaned = match[0];
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try fixing truncated JSON
    try {
      let fixed = cleaned.replace(/,\s*$/, "");
      const braceOpens = (fixed.match(/\{/g) || []).length;
      const braceCloses = (fixed.match(/\}/g) || []).length;
      const bracketOpens = (fixed.match(/\[/g) || []).length;
      const bracketCloses = (fixed.match(/\]/g) || []).length;
      for (let i = 0; i < braceOpens - braceCloses; i++) fixed += "}";
      for (let i = 0; i < bracketOpens - bracketCloses; i++) fixed += "]";
      parsed = JSON.parse(fixed);
    } catch {
      throw new Error(
        `Failed to parse document extraction result for "${fileName}"`
      );
    }
  }

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
    rawTextPreview: textContent?.slice(0, 3000),
  };
}
