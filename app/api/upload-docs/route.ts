import { NextRequest } from "next/server";
import { processUploadedDocuments } from "@/lib/documents/upload";

export const dynamic = "force-dynamic";
export const maxDuration = 900;

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown parser error";
    console.error("[upload-docs] Failed to parse multipart form data:", detail);
    return Response.json(
      { error: "Invalid form data", detail },
      { status: 400 }
    );
  }
  const files = formData.getAll("files") as File[];

  if (!files.length) {
    return Response.json({ error: "No files uploaded" }, { status: 400 });
  }

  try {
    const { documents, errors } = await processUploadedDocuments(files);
    return Response.json({ documents, errors });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Upload failed";
    return Response.json({ error: detail }, { status: 400 });
  }
}
