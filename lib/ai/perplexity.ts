import OpenAI from "openai";
import type { AITextResult } from "./shared";
import { withModelRetry } from "./shared";

let _perplexity: OpenAI | null = null;
function getPerplexity(): OpenAI {
  if (!_perplexity) {
    _perplexity = new OpenAI({
      apiKey: process.env.PERPLEXITY_API_KEY,
      baseURL: "https://api.perplexity.ai",
    });
  }
  return _perplexity;
}

export async function callSonar(query: string): Promise<string> {
  const res = await callSonarDetailed(query);
  return res.text;
}

export async function callSonarLegal(prompt: string): Promise<string> {
  const res = await callSonarDetailed(prompt);
  return res.text;
}

export async function callSonarDetailed(query: string): Promise<AITextResult> {
  return withModelRetry(async () => {
    const res = await getPerplexity().chat.completions.create({
      model: "sonar-pro",
      messages: [{ role: "user", content: query }],
      temperature: 0.1,
    });
    return {
      text: res.choices[0]?.message?.content ?? "",
      model: "sonar-pro",
      usage: {
        inputTokens: res.usage?.prompt_tokens,
        outputTokens: res.usage?.completion_tokens,
      },
    };
  });
}
