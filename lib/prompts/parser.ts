import { numberLines } from "../utils/line-numbers";

export const PARSER_SYSTEM = `You are a script parser for true crime documentary content. Extract structured data from the script exactly as instructed. The script is provided with line numbers (e.g. "1: text"). ALWAYS include accurate line numbers in your output. Return ONLY valid JSON, no markdown fences, no explanation.`;

export function buildParserPrompt(script: string): string {
  return `Parse this crime documentary script and extract. Line numbers are provided — use them EXACTLY in your output.

1. ALL named individuals (full names, partial names, nicknames):
   - role: suspect | victim | witness | officer | attorney | family | other
   - allegations: statements made ABOUT them
   - labels: any labels used (killer, murderer, rapist, abuser, etc.)

2. ALL locations (cities, states, addresses, places)

3. ALL dates and timeline references

4. ALL profanity instances:
   - word, approximate line number
   - severity: mild (damn, hell) | moderate (shit, ass, bitch) | strong (fuck, n-word, c-word)

5. ALL graphic content descriptions:
   - description, approximate line number
   - type: violence | blood | body | injury | sexual | other

6. ALL claims/assertions:
   - text, approximate line number
   - type: fact (stated as definitive) | attributed (credited to source) | opinion (clearly opinion) | speculation (guessing/theorizing)
   - source (if attributed)

7. Timeline of events mentioned

Return this exact JSON structure:
{
  "entities": [{ "name": "", "role": "", "allegations": [], "labels": [] }],
  "profanity": [{ "word": "", "line": 0, "severity": "" }],
  "graphicContent": [{ "description": "", "line": 0, "type": "" }],
  "claims": [{ "text": "", "line": 0, "type": "", "source": "" }],
  "locations": [],
  "dates": [],
  "timeline": []
}

SCRIPT (with line numbers):
${numberLines(script)}`;
}
