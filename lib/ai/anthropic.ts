import Anthropic from "@anthropic-ai/sdk";

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

export async function callClaude(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const res = await getAnthropic().messages.create({
    model: "claude-opus-4-20250514",
    max_tokens: 16000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    temperature: 0.2,
  });
  const block = res.content[0];
  if (block.type === "text") return block.text;
  return "";
}
