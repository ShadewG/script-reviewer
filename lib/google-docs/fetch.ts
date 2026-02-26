export function parseGoogleDocsUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("google.com")) return null;
    if (!parsed.protocol.startsWith("http")) return null;
  } catch {
    return null;
  }
  const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

export async function fetchGoogleDocText(documentId: string): Promise<string> {
  const exportUrl = `https://docs.google.com/document/d/${documentId}/export?format=txt`;
  const res = await fetch(exportUrl, { redirect: "follow" });

  if (res.status === 404) {
    throw new Error("Document not found. Check the URL.");
  }
  if (res.status === 403) {
    throw new Error(
      "Document is not public. Set sharing to 'Anyone with the link can view'."
    );
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch document (HTTP ${res.status})`);
  }

  const text = await res.text();
  if (text.length > 500_000) {
    throw new Error("Document too large (max 500KB of text).");
  }
  return text;
}
