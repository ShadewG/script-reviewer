import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function callClaude(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    temperature: 0.2,
  });
  const block = res.content[0];
  if (block.type === "text") return block.text;
  return "";
}

export { anthropic };
