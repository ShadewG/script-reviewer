import { NextRequest } from "next/server";
import { processVideoFile } from "@/lib/video/process";

export const dynamic = "force-dynamic";
export const maxDuration = 900;
export const runtime = "nodejs";

const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
const ALLOWED_MIME = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
]);

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No video file uploaded" }, { status: 400 });
  }

  if (file.size > MAX_VIDEO_SIZE) {
    return Response.json({ error: "Video too large (max 500MB)" }, { status: 400 });
  }

  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return Response.json(
      { error: "Unsupported video type. Use MP4, MOV, WEBM, or MKV." },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await processVideoFile(buffer, file.name);
    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Video processing failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
