import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { runPipeline } from "@/lib/pipeline/orchestrator";
import type { CaseMetadata, StageUpdate, VideoFrameFinding } from "@/lib/pipeline/types";
import type { DocumentFacts } from "@/lib/documents/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const metadata: CaseMetadata = {
    state: review.caseState as CaseMetadata["state"],
    caseStatus: review.caseStatus as CaseMetadata["caseStatus"],
    hasMinors: review.hasMinors,
    footageTypes: Array.isArray(review.footageTypes) ? (review.footageTypes as string[]) : [],
    videoTitle: review.videoTitle ?? undefined,
    thumbnailDesc: review.thumbnailDesc ?? undefined,
    videoTranscript: review.videoTranscript ?? undefined,
    analysisMode: "full",
    documentFacts: Array.isArray(review.supplementalDocs)
      ? (review.supplementalDocs as unknown as DocumentFacts[])
      : undefined,
    videoFindings: Array.isArray(review.videoFindings)
      ? (review.videoFindings as unknown as VideoFrameFinding[])
      : undefined,
  };

  await prisma.review.update({
    where: { id },
    data: { status: "processing", error: null },
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
        const report = await runPipeline(review.id, review.scriptText, metadata, onProgress);
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
