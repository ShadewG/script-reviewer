import { NextRequest } from "next/server";
import {
  parseGoogleDocsUrl,
  fetchGoogleDocText,
} from "@/lib/google-docs/fetch";
import { extractLatestVersion } from "@/lib/utils/extract-latest-version";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url || typeof url !== "string") {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  const docId = parseGoogleDocsUrl(url);
  if (!docId) {
    return Response.json(
      { error: "Invalid Google Docs URL. Expected format: docs.google.com/document/d/..." },
      { status: 400 }
    );
  }

  try {
    const raw = await fetchGoogleDocText(docId);
    const text = extractLatestVersion(raw);
    return Response.json({
      text,
      lineCount: text.split("\n").length,
      charCount: text.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch document";
    return Response.json({ error: msg }, { status: 422 });
  }
}
