import { createHash } from "crypto";

export interface AIUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface AITextResult {
  text: string;
  model: string;
  usage?: AIUsage;
}

const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_BASE_DELAY_MS = 800;

export function hashPrompt(systemPrompt: string, userPrompt: string): string {
  return createHash("sha256")
    .update(systemPrompt)
    .update("\n---\n")
    .update(userPrompt)
    .digest("hex");
}

export function isRetryableModelError(error: unknown): boolean {
  const msg = String(error ?? "").toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("overloaded") ||
    msg.includes("temporar") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("503") ||
    msg.includes("502") ||
    msg.includes("529") ||
    msg.includes("econnreset") ||
    msg.includes("network")
  );
}

function jitteredDelay(attempt: number, baseDelayMs: number): number {
  const exp = Math.max(1, attempt - 1);
  const raw = baseDelayMs * 2 ** exp;
  const jitter = 0.75 + Math.random() * 0.5;
  return Math.round(raw * jitter);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withModelRetry<T>(
  fn: () => Promise<T>,
  opts?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
  }
): Promise<T> {
  const maxAttempts = opts?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = opts?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const shouldRetry = opts?.shouldRetry ?? isRetryableModelError;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const retryable = attempt < maxAttempts && shouldRetry(error);
      if (!retryable) throw error;
      await wait(jitteredDelay(attempt, baseDelayMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
