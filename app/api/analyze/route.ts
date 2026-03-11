import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { runPipeline } from "@/lib/pipeline/orchestrator";
import { parseGoogleDocsUrl, fetchGoogleDocText } from "@/lib/google-docs/fetch";
import { extractLatestVersion } from "@/lib/utils/extract-latest-version";
import { normalizeScriptForAnalysis } from "@/lib/utils/normalize-script";
import {
  MAX_DOCUMENT_TOTAL_SIZE,
  formatDocumentSize,
  processUploadedDocuments,
} from "@/lib/documents/upload";
import type { CaseMetadata, StageUpdate } from "@/lib/pipeline/types";
import type { DocumentFacts } from "@/lib/documents/types";
import type { VideoFrameFinding } from "@/lib/pipeline/types";

const optStr = (max: number) => z.string().max(max).nullable().optional();
const optNum = () => z.number().nullable().optional();

const DocumentFactsSchema = z.array(
  z.object({
    fileName: z.string().max(255),
    docType: z.string().max(50),
    summary: z.string().max(5000),
    people: z
      .array(
        z.object({
          name: z.string().max(200),
          role: z.string().max(100),
          actions: z.array(z.string().max(500)).max(50),
          pageRefs: z.array(z.number()).max(100),
        })
      )
      .max(100),
    events: z
      .array(
        z.object({
          description: z.string().max(1000),
          date: optStr(20),
          time: optStr(20),
          page: optNum(),
        })
      )
      .max(200),
    evidence: z
      .array(
        z.object({
          type: z.string().max(100),
          description: z.string().max(1000),
          page: optNum(),
        })
      )
      .max(100),
    quotes: z
      .array(
        z.object({
          text: z.string().max(2000),
          speaker: z.string().max(200),
          page: optNum(),
        })
      )
      .max(100),
    verifiableFacts: z
      .array(
        z.object({
          claim: z.string().max(2000),
          source: z.string().max(500),
          confidence: z.enum(["confirmed", "likely", "uncertain"]),
        })
      )
      .max(300),
    rawTextPreview: z.string().max(5000).nullable().optional(),
  })
).max(25);

const AnalysisModeSchema = z
  .enum(["full", "legal_only", "monetization_only"])
  .optional();
const CaseStatusSchema = z.enum(["convicted", "charged", "suspect", "acquitted", "unsolved"]);

const VideoFindingsSchema = z.array(
  z.object({
    second: z.number().int().min(0),
    timecode: z.string().max(20),
    thumbnailDataUrl: z.string().max(600000).optional(),
    selectionMeta: z.object({
      sceneId: z.number().int().min(0).optional(),
      sceneStart: z.number().int().min(0).optional(),
      sceneEnd: z.number().int().min(0).optional(),
      candidateScore: z.number().min(0).max(10).optional(),
      selectionReasons: z.array(z.string().max(50)).max(10).optional(),
      incidentStartSecond: z.number().int().min(0).optional(),
      incidentEndSecond: z.number().int().min(0).optional(),
      incidentCount: z.number().int().min(1).max(999).optional(),
      incidentSignature: z.string().max(120).optional(),
    }).optional(),
    risks: z.array(
      z.object({
        category: z.enum(["community_guidelines", "age_restriction", "monetization", "privacy"]),
        severity: z.enum(["low", "medium", "high", "severe"]),
        impact: z.enum(["full_ads", "limited_ads", "no_ads", "age_restricted", "removal_risk"]),
        policyName: z.string().max(200),
        reasoning: z.string().max(1000),
        detectedText: z.string().max(500).optional(),
      })
    ).max(20),
  })
).max(200);

type ParsedAnalyzeRequest = {
  script?: string;
  gdocUrl?: string;
  state?: string;
  caseStatus?: string;
  hasMinors?: boolean;
  footageTypes?: unknown;
  videoTitle?: string;
  thumbnailDesc?: string;
  documentFacts?: unknown;
  videoFindings?: unknown;
  videoTranscript?: string;
  analysisMode?: unknown;
  rawDocumentFiles: File[];
};

export const dynamic = "force-dynamic";
export const maxDuration = 900;

function extractVideoTranscript(input: string): string | undefined {
  const marker = "\n\n--- VIDEO TRANSCRIPT ---\n\n";
  const idx = input.indexOf(marker);
  if (idx === -1) return undefined;
  const transcript = input.slice(idx + marker.length).trim();
  return transcript || undefined;
}

function parseOptionalString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseOptionalBoolean(value: FormDataEntryValue | null): boolean | undefined {
  if (typeof value !== "string") return undefined;
  return value === "true" || value === "1";
}

function parseOptionalJson(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return JSON.parse(value);
}

async function parseAnalyzeRequest(req: NextRequest): Promise<ParsedAnalyzeRequest> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    const body = await req.json();
    return {
      ...body,
      rawDocumentFiles: [],
    };
  }

  const formData = await req.formData();
  return {
    script: parseOptionalString(formData.get("script")),
    gdocUrl: parseOptionalString(formData.get("gdocUrl")),
    state: parseOptionalString(formData.get("state")),
    caseStatus: parseOptionalString(formData.get("caseStatus")),
    hasMinors: parseOptionalBoolean(formData.get("hasMinors")),
    footageTypes: parseOptionalJson(formData.get("footageTypes")),
    videoTitle: parseOptionalString(formData.get("videoTitle")),
    thumbnailDesc: parseOptionalString(formData.get("thumbnailDesc")),
    documentFacts: parseOptionalJson(formData.get("documentFacts")),
    videoFindings: parseOptionalJson(formData.get("videoFindings")),
    videoTranscript: parseOptionalString(formData.get("videoTranscript")),
    analysisMode: parseOptionalString(formData.get("analysisMode")),
    rawDocumentFiles: formData
      .getAll("files")
      .filter((value): value is File => value instanceof File && value.size > 0),
  };
}

function formatDocumentStageNote(documents: DocumentFacts[], errors: string[]) {
  if (documents.length === 0 && errors.length === 0) {
    return "No supplemental documents queued";
  }
  if (documents.length === 0) {
    return `No supplemental documents extracted (${errors.length} warning${errors.length === 1 ? "" : "s"})`;
  }
  const factCount = documents.reduce((sum, doc) => sum + doc.verifiableFacts.length, 0);
  const warningSuffix =
    errors.length > 0 ? `, ${errors.length} warning${errors.length === 1 ? "" : "s"}` : "";
  return `${documents.length} document${documents.length === 1 ? "" : "s"} ready (${factCount} facts${warningSuffix})`;
}

export async function POST(req: NextRequest) {
  let parsedRequest: ParsedAnalyzeRequest;
  try {
    parsedRequest = await parseAnalyzeRequest(req);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Invalid request payload";
    return Response.json({ error: "Invalid request payload", detail }, { status: 400 });
  }

  const {
    script: rawScript,
    gdocUrl,
    state,
    caseStatus,
    hasMinors,
    footageTypes,
    videoTitle,
    thumbnailDesc,
    documentFacts,
    videoFindings,
    videoTranscript: rawVideoTranscript,
    analysisMode,
    rawDocumentFiles,
  } = parsedRequest;

  const totalQueuedDocumentSize = rawDocumentFiles.reduce((sum, file) => sum + file.size, 0);
  if (totalQueuedDocumentSize > MAX_DOCUMENT_TOTAL_SIZE) {
    return Response.json(
      { error: `Total upload size exceeds ${formatDocumentSize(MAX_DOCUMENT_TOTAL_SIZE)}` },
      { status: 400 }
    );
  }

  let script = rawScript;
  let sourceUrl: string | undefined;

  if (!script && gdocUrl) {
    const docId = parseGoogleDocsUrl(gdocUrl);
    if (!docId) {
      return Response.json(
        { error: "Invalid Google Docs URL" },
        { status: 400 }
      );
    }
    try {
      script = await fetchGoogleDocText(docId);
      sourceUrl = gdocUrl;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch document";
      return Response.json({ error: msg }, { status: 422 });
    }
  }

  if (script) {
    script = extractLatestVersion(script);
    script = normalizeScriptForAnalysis(script);
  }

  if (!script || !state || !caseStatus) {
    return Response.json(
      { error: "script (or gdocUrl), state, and caseStatus are required" },
      { status: 400 }
    );
  }

  const parsedCaseStatus = CaseStatusSchema.safeParse(caseStatus);
  if (!parsedCaseStatus.success) {
    return Response.json(
      { error: "Invalid caseStatus" },
      { status: 400 }
    );
  }

  const parsedAnalysisMode = AnalysisModeSchema.safeParse(analysisMode);
  if (!parsedAnalysisMode.success) {
    return Response.json(
      { error: "Invalid analysisMode" },
      { status: 400 }
    );
  }

  let validatedFacts: DocumentFacts[] | undefined;
  if (Array.isArray(documentFacts) && documentFacts.length > 0) {
    try {
      validatedFacts = DocumentFactsSchema.parse(documentFacts);
    } catch (err) {
      const detail =
        err instanceof z.ZodError
          ? err.issues[0]
            ? `${err.issues[0].path.join(".")}: ${err.issues[0].message}`
            : "Validation failed"
          : "Validation failed";
      return Response.json(
        { error: "Invalid documentFacts format", detail },
        { status: 400 }
      );
    }
  }

  let validatedVideoFindings: VideoFrameFinding[] | undefined;
  if (Array.isArray(videoFindings) && videoFindings.length > 0) {
    try {
      validatedVideoFindings = VideoFindingsSchema.parse(videoFindings);
    } catch {
      return Response.json(
        { error: "Invalid videoFindings format" },
        { status: 400 }
      );
    }
  }

  const metadata: CaseMetadata = {
    state,
    caseStatus: parsedCaseStatus.data,
    hasMinors: hasMinors ?? false,
    footageTypes: Array.isArray(footageTypes) ? footageTypes as string[] : [],
    videoTitle,
    thumbnailDesc,
    videoTranscript:
      typeof rawVideoTranscript === "string" && rawVideoTranscript.trim()
        ? rawVideoTranscript.trim()
        : extractVideoTranscript(script),
    analysisMode: parsedAnalysisMode.data ?? "full",
    documentFacts: validatedFacts,
    videoFindings: validatedVideoFindings,
  };

  const derivedTitle = script
    .split("\n")
    .map((l: string) => l.trim())
    .find((l: string) => l.length > 0 && l.length <= 200)
    ?.slice(0, 120) || null;

  const review = await prisma.review.create({
    data: {
      scriptTitle: videoTitle || derivedTitle,
      scriptText: script,
      sourceUrl,
      caseState: state,
      caseStatus: parsedCaseStatus.data,
      hasMinors: metadata.hasMinors,
      footageTypes: metadata.footageTypes,
      videoTitle,
      thumbnailDesc,
      videoTranscript: metadata.videoTranscript,
      supplementalDocs: validatedFacts ? (validatedFacts as never) : undefined,
      videoFindings: validatedVideoFindings ? (validatedVideoFindings as never) : undefined,
      status: "processing",
    },
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let streamClosed = false;
      const send = (data: unknown) => {
        if (streamClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          streamClosed = true;
        }
      };

      const forwardPipelineProgress = (update: StageUpdate) => {
        send({ type: "stage", ...update, stage: update.stage + 1 });
      };

      try {
        let extractedDocs = validatedFacts ?? [];
        let analysisWarnings: string[] = [];

        if (rawDocumentFiles.length > 0) {
          send({
            type: "stage",
            stage: 0,
            name: "Document Extraction",
            status: "running",
            note: `Queued ${rawDocumentFiles.length} document${rawDocumentFiles.length === 1 ? "" : "s"} for extraction`,
          });

          const result = await processUploadedDocuments(rawDocumentFiles, {
            onProgress: (progress) => {
              send({
                type: "stage",
                stage: 0,
                name: "Document Extraction",
                status: "running",
                note: `${progress.index}/${progress.total} — ${progress.note ?? progress.fileName}`,
              });
            },
          });

          extractedDocs = [...(validatedFacts ?? []), ...result.documents];
          analysisWarnings = result.errors.map((error) => `Supplemental document warning: ${error}`);

          await prisma.review.update({
            where: { id: review.id },
            data: {
              supplementalDocs: extractedDocs.length > 0 ? (extractedDocs as never) : undefined,
              analysisWarnings: analysisWarnings as never,
            },
          });

          send({
            type: "stage",
            stage: 0,
            name: "Document Extraction",
            status: "complete",
            note: formatDocumentStageNote(extractedDocs, result.errors),
          });
        } else {
          send({
            type: "stage",
            stage: 0,
            name: "Document Extraction",
            status: "complete",
            note: formatDocumentStageNote(extractedDocs, []),
          });
        }

        const report = await runPipeline(
          review.id,
          script,
          {
            ...metadata,
            documentFacts: extractedDocs.length > 0 ? extractedDocs : undefined,
          },
          forwardPipelineProgress
        );
        send({ type: "complete", reviewId: review.id, report });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Pipeline failed";
        await prisma.review.update({
          where: { id: review.id },
          data: { status: "failed", error: msg },
        });
        send({ type: "error", error: msg });
      } finally {
        if (!streamClosed) {
          controller.close();
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
