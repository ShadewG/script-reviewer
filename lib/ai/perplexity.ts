import OpenAI from "openai";

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
  const res = await getPerplexity().chat.completions.create({
    model: "sonar-pro",
    messages: [{ role: "user", content: query }],
    temperature: 0.1,
  });
  return res.choices[0]?.message?.content ?? "";
}

export async function callSonarLegal(prompt: string): Promise<string> {
  const res = await getPerplexity().chat.completions.create({
    model: "sonar-pro",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
  });
  return res.choices[0]?.message?.content ?? "";
}
