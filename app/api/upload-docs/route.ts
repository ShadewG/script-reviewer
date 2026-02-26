import { NextRequest } from "next/server";
import { processDocument } from "@/lib/documents/process";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_TOTAL_SIZE = 30 * 1024 * 1024; // 30MB total

function detectMimeType(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;
  // PDF: %PDF
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46)
    return "application/pdf";
  // PNG: \x89PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47)
    return "image/png";
  // JPEG: \xFF\xD8\xFF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
    return "image/jpeg";
  // WEBP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer.slice(0, 4).toString() === "RIFF" &&
    buffer.slice(8, 12).toString() === "WEBP"
  )
    return "image/webp";
  return null;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w\s\-_.()]/g, "").slice(0, 200) || "document";
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }
  const files = formData.getAll("files") as File[];

  if (!files.length) {
    return Response.json({ error: "No files uploaded" }, { status: 400 });
  }

  if (files.length > 5) {
    return Response.json(
      { error: "Maximum 5 files allowed" },
      { status: 400 }
    );
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > MAX_TOTAL_SIZE) {
    return Response.json(
      { error: "Total upload size exceeds 30MB" },
      { status: 400 }
    );
  }

  const errors: string[] = [];

  // Validate all files first, then process in parallel
  const validFiles: Array<{ buffer: Buffer; safeName: string; mime: string }> = [];
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`${file.name}: File too large (max 10MB)`);
      continue;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detectedMime = detectMimeType(buffer);
    if (!detectedMime) {
      errors.push(
        `${file.name}: Unsupported file type. Use PDF, PNG, JPG, or WEBP.`
      );
      continue;
    }

    validFiles.push({
      buffer,
      safeName: sanitizeFileName(file.name),
      mime: detectedMime,
    });
  }

  // Process all files in parallel
  const settled = await Promise.allSettled(
    validFiles.map(({ buffer, safeName, mime }) =>
      processDocument(buffer, safeName, mime)
    )
  );

  const results = [];
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status === "fulfilled") {
      results.push(result.value);
    } else {
      const msg =
        result.reason instanceof Error
          ? result.reason.message
          : "Processing failed";
      errors.push(`${validFiles[i].safeName}: ${msg}`);
    }
  }

  return Response.json({ documents: results, errors });
}
