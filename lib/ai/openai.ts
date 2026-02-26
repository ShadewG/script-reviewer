import OpenAI from "openai";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

export async function callGPTMini(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
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
  return res.choices[0]?.message?.content ?? "";
}

export async function callGPT(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const res = await getOpenAI().chat.completions.create({
    model: "gpt-5.2",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
    max_completion_tokens: 16000,
  });
  return res.choices[0]?.message?.content ?? "";
}
