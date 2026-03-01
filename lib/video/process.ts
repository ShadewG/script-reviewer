import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegStatic from "ffmpeg-static";
import type { VideoFrameFinding } from "../pipeline/types";
import { analyzeFrameBase64 } from "./analyze-frame";

const execFileAsync = promisify(execFile);
const FRAME_INTERVAL_SECONDS = 10;
const MAX_ANALYZED_FRAMES = 8;

function toTimecode(second: number): string {
  const h = String(Math.floor(second / 3600)).padStart(2, "0");
  const m = String(Math.floor((second % 3600) / 60)).padStart(2, "0");
  const s = String(second % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

async function extractFrames(videoPath: string, outputDir: string): Promise<void> {
  const pattern = join(outputDir, "frame-%05d.jpg");
  const args = [
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
  ];

  try {
    // Prefer system ffmpeg in containers (more reliable on Alpine)
    await execFileAsync("ffmpeg", args);
    return;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "ENOENT") throw err;
  }

  if (ffmpegStatic && existsSync(ffmpegStatic)) {
    await execFileAsync(ffmpegStatic, args);
    return;
  }

  throw new Error("ffmpeg not found in runtime");
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
        const risks = await analyzeFrameBase64(data.toString("base64"));
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
