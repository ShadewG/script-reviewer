import OpenAI from "openai";

const perplexity = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY,
  baseURL: "https://api.perplexity.ai",
});

export async function callSonar(query: string): Promise<string> {
  const res = await perplexity.chat.completions.create({
    model: "sonar-pro",
    messages: [{ role: "user", content: query }],
    temperature: 0.1,
  });
  return res.choices[0]?.message?.content ?? "";
}

export { perplexity };
