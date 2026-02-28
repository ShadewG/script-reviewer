import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { runPipeline } from "@/lib/pipeline/orchestrator";
import { parseGoogleDocsUrl, fetchGoogleDocText } from "@/lib/google-docs/fetch";
import { extractLatestVersion } from "@/lib/utils/extract-latest-version";
import type { CaseMetadata, StageUpdate } from "@/lib/pipeline/types";
import type { DocumentFacts } from "@/lib/documents/types";
import type { VideoFrameFinding } from "@/lib/pipeline/types";

// nullable() handles Claude returning null for optional fields
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
      .max(200),
    rawTextPreview: z.string().max(5000).nullable().optional(),
  })
).max(10);

const AnalysisModeSchema = z
  .enum(["full", "legal_only", "monetization_only"])
  .optional();

const VideoFindingsSchema = z.array(
  z.object({
    second: z.number().int().min(0),
    timecode: z.string().max(20),
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

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = await req.json();
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
    analysisMode,
  } = body;

  // Resolve script text from either direct paste or Google Doc URL
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

  // Extract only the latest version if the doc contains multiple drafts
  if (script) {
    script = extractLatestVersion(script);
  }

  if (!script || !state || !caseStatus) {
    return Response.json(
      { error: "script (or gdocUrl), state, and caseStatus are required" },
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

  // Validate documentFacts if provided
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
    caseStatus,
    hasMinors: hasMinors ?? false,
    footageTypes: footageTypes ?? [],
    videoTitle,
    thumbnailDesc,
    analysisMode: parsedAnalysisMode.data ?? "full",
    documentFacts: validatedFacts,
    videoFindings: validatedVideoFindings,
  };

  const review = await prisma.review.create({
    data: {
      scriptText: script,
      sourceUrl,
      caseState: state,
      caseStatus,
      hasMinors: metadata.hasMinors,
      footageTypes: metadata.footageTypes,
      videoTitle,
      thumbnailDesc,
      supplementalDocs: validatedFacts as never ?? undefined,
      status: "processing",
    },
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const onProgress = (update: StageUpdate) => {
        send({ type: "stage", ...update });
      };

      try {
        const report = await runPipeline(review.id, script, metadata, onProgress);
        send({ type: "complete", reviewId: review.id, report });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Pipeline failed";
        await prisma.review.update({
          where: { id: review.id },
          data: { status: "failed", error: msg },
        });
        send({ type: "error", error: msg });
      } finally {
        controller.close();
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
