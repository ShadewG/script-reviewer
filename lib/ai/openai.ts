import OpenAI from "openai";
import type { AITextResult } from "./shared";
import { withModelRetry } from "./shared";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

export async function callGPTMini(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const res = await callGPTMiniDetailed(systemPrompt, userPrompt);
  return res.text;
}

export async function callGPT(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const res = await callGPTDetailed(systemPrompt, userPrompt);
  return res.text;
}

export async function callGPTMiniDetailed(
  systemPrompt: string,
  userPrompt: string
): Promise<AITextResult> {
  return withModelRetry(async () => {
    const res = await getOpenAI().chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_completion_tokens: 16000,
      response_format: { type: "json_object" },
    });
    return {
      text: res.choices[0]?.message?.content ?? "",
      model: "gpt-4.1-mini",
      usage: {
        inputTokens: res.usage?.prompt_tokens,
        outputTokens: res.usage?.completion_tokens,
      },
    };
  });
}

export async function callGPTDetailed(
  systemPrompt: string,
  userPrompt: string
): Promise<AITextResult> {
  return withModelRetry(async () => {
    const res = await getOpenAI().chat.completions.create({
      model: "gpt-5.4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_completion_tokens: 16000,
    });
    return {
      text: res.choices[0]?.message?.content ?? "",
      model: "gpt-5.4",
      usage: {
        inputTokens: res.usage?.prompt_tokens,
        outputTokens: res.usage?.completion_tokens,
      },
    };
  });
}
