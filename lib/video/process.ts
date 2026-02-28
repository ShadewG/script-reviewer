import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import ffmpegStatic from "ffmpeg-static";
import type { VideoFrameFinding, VideoFrameRisk } from "../pipeline/types";

const execFileAsync = promisify(execFile);
const FRAME_INTERVAL_SECONDS = 10;
const MAX_ANALYZED_FRAMES = 8;
const ANALYSIS_RETRIES = 2;

const FRAME_SYSTEM = `You are a strict YouTube risk reviewer for true-crime content.
Analyze ONE video frame and return ONLY JSON:
{
  "risks": [
    {
      "category": "community_guidelines|age_restriction|monetization|privacy",
      "severity": "low|medium|high|severe",
      "impact": "full_ads|limited_ads|no_ads|age_restricted|removal_risk",
      "policyName": "short policy label",
      "reasoning": "why this frame is risky",
      "detectedText": "visible text if any"
    }
  ]
}
If no visible risk, return {"risks": []}.
Flag only visible issues in this frame: graphic gore/trauma, nudity, sexual content, visible addresses/license plates/PII, explicit hate symbols/slurs, obvious drug use/paraphernalia.`;

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

function parseJsonSafe<T>(text: string): T | null {
  const cleaned = text
    .trim()
    .replace(/^```[\w]*\s*\n?/, "")
    .replace(/\n?```\s*$/, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

function toTimecode(second: number): string {
  const h = String(Math.floor(second / 3600)).padStart(2, "0");
  const m = String(Math.floor((second % 3600) / 60)).padStart(2, "0");
  const s = String(second % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

async function extractFrames(videoPath: string, outputDir: string): Promise<void> {
  const ffmpegPath = ffmpegStatic || "ffmpeg";
  const pattern = join(outputDir, "frame-%05d.jpg");
  await execFileAsync(ffmpegPath, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    videoPath,
    "-vf",
    `fps=1/${FRAME_INTERVAL_SECONDS}`,
    "-q:v",
    "3",
    pattern,
  ]);
}

async function analyzeFrame(base64: string): Promise<VideoFrameRisk[]> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await getAnthropic().messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        temperature: 0.1,
        system: FRAME_SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: base64,
                },
              },
              {
                type: "text",
                text: "Review this frame for policy/privacy risks.",
              },
            ],
          },
        ],
      });
      const textBlock = response.content.find((c) => c.type === "text");
      const parsed = textBlock ? parseJsonSafe<{ risks?: VideoFrameRisk[] }>(textBlock.text) : null;
      const risks = (parsed?.risks ?? []).filter((r) => r && r.reasoning && r.policyName);
      return risks;
    } catch (err) {
      if (attempt >= ANALYSIS_RETRIES) {
        throw err;
      }
    }
  }
}

export interface ProcessVideoResult {
  findings: VideoFrameFinding[];
  sampledFrames: number;
  intervalSeconds: number;
}

export async function processVideoFile(
  videoBuffer: Buffer,
  fileName: string
): Promise<ProcessVideoResult> {
  const dir = await mkdtemp(join(tmpdir(), "video-scan-"));
  const videoPath = join(dir, fileName.replace(/[^\w\-_.]/g, "_") || "upload.mp4");
  try {
    await writeFile(videoPath, videoBuffer);
    await extractFrames(videoPath, dir);

    const allFrames = (await readdir(dir))
      .filter((f) => f.startsWith("frame-") && f.endsWith(".jpg"))
      .sort();
    if (allFrames.length === 0) {
      return { findings: [], sampledFrames: 0, intervalSeconds: FRAME_INTERVAL_SECONDS };
    }

    const step = Math.max(1, Math.ceil(allFrames.length / MAX_ANALYZED_FRAMES));
    const selected = allFrames.filter((_, idx) => idx % step === 0).slice(0, MAX_ANALYZED_FRAMES);

    const analyzed = await Promise.all(
      selected.map(async (frameFile) => {
        const match = frameFile.match(/frame-(\d+)\.jpg$/);
        const frameIndex = match ? Number(match[1]) : 1;
        const second = Math.max(0, (frameIndex - 1) * FRAME_INTERVAL_SECONDS);
        const framePath = join(dir, frameFile);
        const data = await readFile(framePath);
        const risks = await analyzeFrame(data.toString("base64"));
        if (risks.length === 0) return null;
        return {
          second,
          timecode: toTimecode(second),
          risks,
        } satisfies VideoFrameFinding;
      })
    );
    const findings: VideoFrameFinding[] = analyzed
      .filter((f): f is VideoFrameFinding => Boolean(f))
      .sort((a, b) => a.second - b.second);

    return {
      findings,
      sampledFrames: selected.length,
      intervalSeconds: FRAME_INTERVAL_SECONDS * step,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
