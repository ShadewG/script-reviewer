import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { runPipeline } from "@/lib/pipeline/orchestrator";
import { parseGoogleDocsUrl, fetchGoogleDocText } from "@/lib/google-docs/fetch";
import type { CaseMetadata, StageUpdate } from "@/lib/pipeline/types";

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

  if (!script || !state || !caseStatus) {
    return Response.json(
      { error: "script (or gdocUrl), state, and caseStatus are required" },
      { status: 400 }
    );
  }

  const metadata: CaseMetadata = {
    state,
    caseStatus,
    hasMinors: hasMinors ?? false,
    footageTypes: footageTypes ?? [],
    videoTitle,
    thumbnailDesc,
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
