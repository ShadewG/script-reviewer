import { processDocument } from "./process";
import type { DocumentFacts } from "./types";

export const MAX_DOCUMENT_FILE_SIZE = 500 * 1024 * 1024;
export const MAX_DOCUMENT_TOTAL_SIZE = 500 * 1024 * 1024;
export const DOCUMENT_TIMEOUT_MS = 840_000;

export interface DocumentUploadProgress {
  fileName: string;
  index: number;
  total: number;
  status: "running" | "complete" | "error";
  note?: string;
}

export interface ProcessUploadedDocumentsResult {
  documents: DocumentFacts[];
  errors: string[];
}

export function formatDocumentSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MB`;
  }
  return `${Math.round(bytes / 1024)}KB`;
}

export function detectDocumentMimeType(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return "application/pdf";
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 12 &&
    buffer.slice(0, 4).toString() === "RIFF" &&
    buffer.slice(8, 12).toString() === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function sanitizeDocumentFileName(name: string): string {
  return name.replace(/[^\w\s\-_.()]/g, "").slice(0, 200) || "document";
}

function sanitizeDocumentProcessingError(message: string): string {
  if (/credit balance is too low/i.test(message)) {
    return "AI document fallback is temporarily unavailable";
  }
  if (/invalid api key|unauthorized|authentication/i.test(message)) {
    return "AI document fallback is misconfigured";
  }
  return message;
}

async function processDocumentWithTimeout(
  buffer: Buffer,
  safeName: string,
  mime: string
) {
  return await Promise.race([
    processDocument(buffer, safeName, mime),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `Processing timed out after ${Math.round(DOCUMENT_TIMEOUT_MS / 1000)}s`
          )
        );
      }, DOCUMENT_TIMEOUT_MS);
    }),
  ]);
}

export async function processUploadedDocuments(
  files: File[],
  options: {
    onProgress?: (progress: DocumentUploadProgress) => void;
  } = {}
): Promise<ProcessUploadedDocumentsResult> {
  const errors: string[] = [];
  const documents: DocumentFacts[] = [];

  if (!files.length) {
    return { documents, errors };
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_DOCUMENT_TOTAL_SIZE) {
    throw new Error(
      `Total upload size exceeds ${formatDocumentSize(MAX_DOCUMENT_TOTAL_SIZE)}`
    );
  }

  const validFiles: Array<{
    buffer: Buffer;
    safeName: string;
    mime: string;
    size: number;
  }> = [];

  for (const file of files) {
    if (file.size > MAX_DOCUMENT_FILE_SIZE) {
      errors.push(
        `${file.name}: File too large (max ${formatDocumentSize(MAX_DOCUMENT_FILE_SIZE)})`
      );
      continue;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = detectDocumentMimeType(buffer);
    if (!mime) {
      errors.push(
        `${file.name}: Unsupported file type. Use PDF, PNG, JPG, or WEBP.`
      );
      continue;
    }

    validFiles.push({
      buffer,
      safeName: sanitizeDocumentFileName(file.name),
      mime,
      size: file.size,
    });
  }

  for (let i = 0; i < validFiles.length; i++) {
    const file = validFiles[i];
    options.onProgress?.({
      fileName: file.safeName,
      index: i + 1,
      total: validFiles.length,
      status: "running",
      note: `Processing ${file.safeName} (${formatDocumentSize(file.size)})`,
    });

    try {
      const document = await processDocumentWithTimeout(
        file.buffer,
        file.safeName,
        file.mime
      );
      documents.push(document);
      options.onProgress?.({
        fileName: file.safeName,
        index: i + 1,
        total: validFiles.length,
        status: "complete",
        note: `${file.safeName} ready (${document.verifiableFacts.length} facts)`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Processing failed";
      const safeMessage = sanitizeDocumentProcessingError(msg);
      errors.push(`${file.safeName}: ${safeMessage}`);
      options.onProgress?.({
        fileName: file.safeName,
        index: i + 1,
        total: validFiles.length,
        status: "error",
        note: `${file.safeName} failed: ${safeMessage}`,
      });
    }
  }

  return { documents, errors };
}
