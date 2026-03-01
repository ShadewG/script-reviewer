import { NextRequest } from "next/server";
import { z } from "zod";
import { analyzeFrameBase64 } from "@/lib/video/analyze-frame";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const BodySchema = z.object({
  second: z.number().min(0),
  timecode: z.string().max(20),
  imageBase64: z.string().min(100),
});

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.parse(await req.json());
    const risks = await analyzeFrameBase64(body.imageBase64);
    return Response.json({
      second: body.second,
      timecode: body.timecode,
      risks,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Frame analysis failed";
    return Response.json({ error: msg }, { status: 400 });
  }
}
