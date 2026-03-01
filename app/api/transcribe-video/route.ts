import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 900;
export const runtime = "nodejs";

const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_TRANSCRIPT_CHARS = 120_000;
const ALLOWED_MIME = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "application/octet-stream",
]);
const ALLOWED_EXT = [".mp4", ".mov", ".webm", ".mkv"];

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ELEVENLABS_API_KEY is not configured" },
      { status: 500 }
    );
  }

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

  const lowerName = file.name.toLowerCase();
  const hasAllowedExt = ALLOWED_EXT.some((ext) => lowerName.endsWith(ext));
  if (file.type && !ALLOWED_MIME.has(file.type) && !hasAllowedExt) {
    return Response.json(
      { error: "Unsupported video type. Use MP4, MOV, WEBM, or MKV." },
      { status: 400 }
    );
  }

  try {
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const body = new FormData();
    body.append(
      "file",
      new Blob([fileBuffer], { type: file.type || "video/mp4" }),
      file.name || "video.mp4"
    );
    body.append("model_id", "scribe_v1");

    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
      },
      body,
    });

    const raw = await res.text();
    if (!res.ok) {
      let detail = raw;
      try {
        const parsed = JSON.parse(raw);
        detail = parsed?.detail || parsed?.message || raw;
      } catch {
        // keep raw
      }
      return Response.json(
        { error: `ElevenLabs transcription failed: ${detail}` },
        { status: 502 }
      );
    }

    let parsed: { text?: string; language_code?: string };
    try {
      parsed = JSON.parse(raw) as { text?: string; language_code?: string };
    } catch {
      return Response.json(
        { error: "Invalid transcription response from ElevenLabs" },
        { status: 502 }
      );
    }

    const text = (parsed.text || "").trim();
    if (!text) {
      return Response.json({ error: "No transcript text returned" }, { status: 422 });
    }

    return Response.json({
      text: text.slice(0, MAX_TRANSCRIPT_CHARS),
      truncated: text.length > MAX_TRANSCRIPT_CHARS,
      languageCode: parsed.language_code || null,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Transcription failed" },
      { status: 500 }
    );
  }
}
