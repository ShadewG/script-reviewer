import Anthropic from "@anthropic-ai/sdk";
import type { AITextResult } from "./shared";
import { withModelRetry } from "./shared";

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

export async function callClaude(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const res = await callClaudeDetailed(systemPrompt, userPrompt);
  return res.text;
}

export async function callClaudeDetailed(
  systemPrompt: string,
  userPrompt: string
): Promise<AITextResult> {
  return withModelRetry(async () => {
    const stream = getAnthropic().messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 16000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.2,
    });
    const response = await stream.finalMessage();
    const block = response.content[0];
    return {
      text: block.type === "text" ? block.text : "",
      model: "claude-opus-4-6",
      usage: {
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
      },
    };
  });
}
