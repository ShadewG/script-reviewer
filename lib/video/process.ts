import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegStatic from "ffmpeg-static";
import type { VideoFrameFinding, VideoFrameRisk, VideoFrameSelectionMeta } from "../pipeline/types";
import { analyzeFrameWindowBase64 } from "./analyze-frame";

type VideoScanMode = "quick" | "balanced" | "deep" | "exhaustive";

type SceneSegment = {
  id: number;
  start: number;
  end: number;
};

type CandidateReason =
  | "floor_sample"
  | "scene_boundary"
  | "scene_midpoint"
  | "scene_interior"
  | "risk_neighbor"
  | "text_overlay"
  | "high_detail"
  | "high_contrast"
  | "mostly_dark"
  | "low_information";

type CandidateFrame = {
  second: number;
  sceneId: number;
  sceneStart: number;
  sceneEnd: number;
  score: number;
  reasons: Set<CandidateReason>;
};

type ScanConfig = {
  baseIntervalSeconds: number;
  floorIntervalSeconds: number;
  sceneProbeSeconds: number;
  sceneDiffThreshold: number;
  maxFrames: number;
  neighborOffsets: number[];
};

type ExecResult = {
  stdout: Buffer;
  stderr: Buffer;
};

type ProcessExecutionError = Error & {
  stdout?: Buffer;
  stderr?: Buffer;
  code?: number | string | null;
};

const MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const SIGNATURE_WIDTH = 48;
const SIGNATURE_HEIGHT = 27;
const SIGNATURE_BYTES = SIGNATURE_WIDTH * SIGNATURE_HEIGHT;
const FEATURE_WIDTH = 96;
const FEATURE_HEIGHT = 54;
const FEATURE_BYTES = FEATURE_WIDTH * FEATURE_HEIGHT;
const TARGET_FRAME_WIDTH = 960;
const DEFAULT_SCAN_MODE: VideoScanMode = "balanced";
const FEATURE_CONCURRENCY = 6;
const WINDOW_OFFSETS = [-1, 0, 1] as const;

const SCAN_MODES: Record<VideoScanMode, ScanConfig> = {
  quick: {
    baseIntervalSeconds: 10,
    floorIntervalSeconds: 8,
    sceneProbeSeconds: 3,
    sceneDiffThreshold: 0.17,
    maxFrames: 60,
    neighborOffsets: [-1, 1],
  },
  balanced: {
    baseIntervalSeconds: 8,
    floorIntervalSeconds: 5,
    sceneProbeSeconds: 2,
    sceneDiffThreshold: 0.17,
    maxFrames: 120,
    neighborOffsets: [-2, -1, 1, 2],
  },
  deep: {
    baseIntervalSeconds: 6,
    floorIntervalSeconds: 3,
    sceneProbeSeconds: 1,
    sceneDiffThreshold: 0.16,
    maxFrames: 220,
    neighborOffsets: [-2, -1, 1, 2],
  },
  exhaustive: {
    baseIntervalSeconds: 2,
    floorIntervalSeconds: 1,
    sceneProbeSeconds: 0.5,
    sceneDiffThreshold: 0.15,
    maxFrames: 420,
    neighborOffsets: [-2, -1, 1, 2],
  },
};

const REASON_SCORES: Record<CandidateReason, number> = {
  floor_sample: 0.2,
  scene_boundary: 0.7,
  scene_midpoint: 0.45,
  scene_interior: 0.3,
  risk_neighbor: 0.95,
  text_overlay: 0.55,
  high_detail: 0.4,
  high_contrast: 0.2,
  mostly_dark: -0.35,
  low_information: -0.5,
};

function isVideoScanMode(value: string | null): value is VideoScanMode {
  return value === "quick" || value === "balanced" || value === "deep" || value === "exhaustive";
}

function toTimecode(second: number): string {
  const h = String(Math.floor(second / 3600)).padStart(2, "0");
  const m = String(Math.floor((second % 3600) / 60)).padStart(2, "0");
  const s = String(second % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function normalizeRiskText(input: string | undefined): string {
  return (input ?? "")
    .toLowerCase()
    .replace(/\[video\s+\d\d:\d\d:\d\d\]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function riskSemanticKey(risk: { category: string; policyName: string; detectedText?: string }): string {
  const policy = normalizeRiskText(risk.policyName);
  const detected = normalizeRiskText(risk.detectedText).slice(0, 80);
  return `${risk.category}|${policy}|${detected}`;
}

function hasHardSignal(
  risk: Pick<VideoFrameRisk, "severity" | "policyName" | "reasoning" | "detectedText">
): boolean {
  if (risk.severity === "high" || risk.severity === "severe") return true;
  const joined = normalizeRiskText(
    `${risk.policyName} ${risk.reasoning} ${risk.detectedText ?? ""}`
  );
  return /\b(address|street|license plate|plate number|phone number|email|ssn|passport|driver|minor|child|gore|graphic|blood|corpse|drug|cocaine|heroin|meth|weapon|gun|rifle|knife|watermark|lower third|player ui|network logo)\b/.test(
    joined
  );
}

function frameDistance(a: Buffer | null, b: Buffer | null): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 1;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i] - b[i]);
  }
  return sum / (a.length * 255);
}

function averageStep(seconds: number[], fallback: number): number {
  if (seconds.length <= 1) return fallback;
  return Math.max(1, Math.round((seconds[seconds.length - 1] - seconds[0]) / (seconds.length - 1)));
}

function parseDurationSeconds(stderr: string): number {
  const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) {
    throw new Error("Could not determine video duration");
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  return Math.max(1, Math.floor(hours * 3600 + minutes * 60 + seconds));
}

function buildScenes(boundaries: number[], durationSeconds: number): SceneSegment[] {
  const sorted = [...new Set(boundaries)]
    .map((second) => Math.max(0, Math.min(durationSeconds - 1, Math.round(second))))
    .sort((a, b) => a - b);

  const scenes: SceneSegment[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    const end = i + 1 < sorted.length ? sorted[i + 1] : durationSeconds - 1;
    if (end <= start) continue;
    scenes.push({ id: scenes.length, start, end });
  }

  if (scenes.length === 0) {
    scenes.push({ id: 0, start: 0, end: Math.max(0, durationSeconds - 1) });
  }

  return scenes;
}

function buildSelectionMeta(candidate: CandidateFrame | undefined): VideoFrameSelectionMeta | undefined {
  if (!candidate) return undefined;
  return {
    sceneId: candidate.sceneId >= 0 ? candidate.sceneId : undefined,
    sceneStart: candidate.sceneStart,
    sceneEnd: candidate.sceneEnd,
    candidateScore: Number(candidate.score.toFixed(2)),
    selectionReasons: [...candidate.reasons].sort(),
  };
}

function sceneBySecond(second: number, scenes: SceneSegment[], durationSeconds: number): SceneSegment {
  return (
    scenes.find((scene) => second >= scene.start && second <= scene.end) ?? {
      id: -1,
      start: 0,
      end: Math.max(0, durationSeconds - 1),
    }
  );
}

function upsertCandidate(
  map: Map<number, CandidateFrame>,
  second: number,
  scene: SceneSegment,
  reason: CandidateReason,
  durationSeconds: number
): CandidateFrame {
  const clamped = Math.max(0, Math.min(durationSeconds - 1, Math.round(second)));
  const existing = map.get(clamped);
  if (existing) {
    if (!existing.reasons.has(reason)) {
      existing.reasons.add(reason);
      existing.score += REASON_SCORES[reason];
    }
    return existing;
  }

  const candidate: CandidateFrame = {
    second: clamped,
    sceneId: scene.id,
    sceneStart: scene.start,
    sceneEnd: scene.end,
    score: REASON_SCORES[reason],
    reasons: new Set([reason]),
  };
  map.set(clamped, candidate);
  return candidate;
}

function trimCandidates(candidates: CandidateFrame[], maxFrames: number): CandidateFrame[] {
  if (candidates.length <= maxFrames) {
    return [...candidates].sort((a, b) => a.second - b.second);
  }

  const mustKeep = candidates
    .filter((candidate) => candidate.score >= 0.65)
    .sort((a, b) => b.score - a.score || a.second - b.second)
    .slice(0, maxFrames);

  const selected = new Map<number, CandidateFrame>();
  for (const candidate of mustKeep) {
    selected.set(candidate.second, candidate);
  }

  const remaining = candidates
    .filter((candidate) => !selected.has(candidate.second))
    .sort((a, b) => a.second - b.second);

  const slots = maxFrames - selected.size;
  if (slots > 0 && remaining.length > 0) {
    const stride = Math.max(1, Math.ceil(remaining.length / slots));
    for (let i = 0; i < remaining.length && selected.size < maxFrames; i += stride) {
      selected.set(remaining[i].second, remaining[i]);
    }
  }

  return [...selected.values()].sort((a, b) => a.second - b.second);
}

function buildCandidateFrames(
  durationSeconds: number,
  scenes: SceneSegment[],
  config: ScanConfig
): CandidateFrame[] {
  const map = new Map<number, CandidateFrame>();

  for (let second = 0; second < durationSeconds; second += config.floorIntervalSeconds) {
    upsertCandidate(
      map,
      second,
      sceneBySecond(second, scenes, durationSeconds),
      "floor_sample",
      durationSeconds
    );
  }

  for (const scene of scenes) {
    const sceneLength = Math.max(1, scene.end - scene.start);
    let targetCount = 1;
    if (sceneLength > 60) targetCount = 6;
    else if (sceneLength > 20) targetCount = 4;
    else if (sceneLength > 5) targetCount = 2;

    upsertCandidate(map, scene.start, scene, "scene_boundary", durationSeconds);
    upsertCandidate(map, scene.end, scene, "scene_boundary", durationSeconds);

    for (let i = 1; i <= targetCount; i++) {
      const ratio = i / (targetCount + 1);
      const second = Math.round(scene.start + sceneLength * ratio);
      upsertCandidate(map, second, scene, i === Math.ceil(targetCount / 2) ? "scene_midpoint" : "scene_interior", durationSeconds);
    }
  }

  return [...map.values()].sort((a, b) => a.second - b.second);
}

async function execCapture(command: string, args: string[]): Promise<ExecResult> {
  return await new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { maxBuffer: MAX_BUFFER_BYTES, encoding: "buffer" as never },
      (error, stdout, stderr) => {
        const result: ExecResult = {
          stdout: Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout ?? ""),
          stderr: Buffer.isBuffer(stderr) ? stderr : Buffer.from(stderr ?? ""),
        };
        if (error) {
          const wrapped = error as ProcessExecutionError;
          wrapped.stdout = result.stdout;
          wrapped.stderr = result.stderr;
          reject(wrapped);
          return;
        }
        resolve(result);
      }
    );
  });
}

async function execFfmpeg(args: string[]): Promise<ExecResult> {
  try {
    return await execCapture("ffmpeg", args);
  } catch (err) {
    const code = (err as ProcessExecutionError).code;
    if (code !== "ENOENT") throw err;
  }

  if (ffmpegStatic && existsSync(ffmpegStatic)) {
    return await execCapture(ffmpegStatic, args);
  }

  throw new Error("ffmpeg not found in runtime");
}

async function readVideoDurationSeconds(videoPath: string): Promise<number> {
  try {
    await execFfmpeg(["-hide_banner", "-i", videoPath]);
    return 1;
  } catch (err) {
    const stderr = ((err as ProcessExecutionError).stderr ?? Buffer.alloc(0)).toString("utf8");
    return parseDurationSeconds(stderr);
  }
}

async function extractProbeFrames(videoPath: string, intervalSeconds: number): Promise<Buffer[]> {
  const fpsExpr = intervalSeconds >= 1 ? `fps=1/${intervalSeconds}` : `fps=${Math.round(1 / intervalSeconds)}`;
  const { stdout } = await execFfmpeg([
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    videoPath,
    "-vf",
    `${fpsExpr},scale=${SIGNATURE_WIDTH}:${SIGNATURE_HEIGHT},format=gray`,
    "-pix_fmt",
    "gray",
    "-f",
    "rawvideo",
    "-",
  ]);

  const frames: Buffer[] = [];
  for (let offset = 0; offset + SIGNATURE_BYTES <= stdout.length; offset += SIGNATURE_BYTES) {
    frames.push(stdout.subarray(offset, offset + SIGNATURE_BYTES));
  }
  return frames;
}

async function extractFeatureFrame(videoPath: string, second: number): Promise<Buffer> {
  const { stdout } = await execFfmpeg([
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    String(second),
    "-i",
    videoPath,
    "-frames:v",
    "1",
    "-vf",
    `scale=${FEATURE_WIDTH}:${FEATURE_HEIGHT},format=gray`,
    "-pix_fmt",
    "gray",
    "-f",
    "rawvideo",
    "-",
  ]);

  if (!stdout || stdout.length < FEATURE_BYTES) {
    throw new Error(`No feature frame output at ${second}s`);
  }

  return stdout.subarray(0, FEATURE_BYTES);
}

function bandAverage(
  values: Float64Array,
  width: number,
  startRow: number,
  endRow: number
): number {
  const safeStart = Math.max(0, startRow);
  const safeEnd = Math.min(Math.floor(values.length / width), endRow);
  if (safeEnd <= safeStart) return 0;
  let sum = 0;
  let count = 0;
  for (let y = safeStart; y < safeEnd; y++) {
    for (let x = 0; x < width; x++) {
      sum += values[y * width + x];
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

function scoreFeatureFrame(buffer: Buffer): {
  scoreDelta: number;
  reasons: CandidateReason[];
} {
  const gradient = new Float64Array(FEATURE_WIDTH * FEATURE_HEIGHT);
  let sum = 0;
  let sumSquares = 0;
  let darkPixels = 0;

  for (let y = 0; y < FEATURE_HEIGHT; y++) {
    for (let x = 0; x < FEATURE_WIDTH; x++) {
      const idx = y * FEATURE_WIDTH + x;
      const current = buffer[idx];
      sum += current;
      sumSquares += current * current;
      if (current <= 18) darkPixels++;

      if (x === FEATURE_WIDTH - 1 || y === FEATURE_HEIGHT - 1) continue;
      const dx = Math.abs(current - buffer[idx + 1]);
      const dy = Math.abs(current - buffer[idx + FEATURE_WIDTH]);
      gradient[idx] = (dx + dy) / (2 * 255);
    }
  }

  const totalPixels = FEATURE_WIDTH * FEATURE_HEIGHT;
  const mean = sum / totalPixels;
  const variance = Math.max(0, sumSquares / totalPixels - mean * mean);
  const varianceNorm = Math.min(1, variance / 2200);
  const edgeDensity = bandAverage(gradient, FEATURE_WIDTH, 0, FEATURE_HEIGHT);
  const topEdge = bandAverage(gradient, FEATURE_WIDTH, 0, Math.round(FEATURE_HEIGHT * 0.2));
  const bottomEdge = bandAverage(
    gradient,
    FEATURE_WIDTH,
    Math.round(FEATURE_HEIGHT * 0.7),
    FEATURE_HEIGHT
  );
  const centerEdge = bandAverage(
    gradient,
    FEATURE_WIDTH,
    Math.round(FEATURE_HEIGHT * 0.25),
    Math.round(FEATURE_HEIGHT * 0.75)
  );
  const darkRatio = darkPixels / totalPixels;
  const overlayScore = Math.max(topEdge, bottomEdge) - centerEdge * 0.6;
  const detailScore = varianceNorm * 0.7 + edgeDensity * 1.8;

  const reasons: CandidateReason[] = [];
  let scoreDelta = 0;

  if (overlayScore >= 0.08 && Math.max(topEdge, bottomEdge) >= 0.09) {
    reasons.push("text_overlay");
    scoreDelta += REASON_SCORES.text_overlay;
  }
  if (detailScore >= 0.48) {
    reasons.push("high_detail");
    scoreDelta += REASON_SCORES.high_detail;
  }
  if (varianceNorm >= 0.4 && edgeDensity >= 0.07) {
    reasons.push("high_contrast");
    scoreDelta += REASON_SCORES.high_contrast;
  }
  if (darkRatio >= 0.72 || mean <= 24) {
    reasons.push("mostly_dark");
    scoreDelta += REASON_SCORES.mostly_dark;
  }
  if (detailScore < 0.18 && overlayScore < 0.04) {
    reasons.push("low_information");
    scoreDelta += REASON_SCORES.low_information;
  }

  return { scoreDelta, reasons };
}

async function scoreCandidatesByFeatures(
  videoPath: string,
  candidates: CandidateFrame[]
): Promise<CandidateFrame[]> {
  const scored = [...candidates];
  let index = 0;

  const worker = async () => {
    while (index < scored.length) {
      const currentIndex = index++;
      const candidate = scored[currentIndex];
      try {
        const featureFrame = await extractFeatureFrame(videoPath, candidate.second);
        const featureScore = scoreFeatureFrame(featureFrame);
        candidate.score += featureScore.scoreDelta;
        for (const reason of featureScore.reasons) {
          if (!candidate.reasons.has(reason)) {
            candidate.reasons.add(reason);
          }
        }
      } catch {
        // Feature scoring is best-effort. Candidate remains eligible on base score alone.
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(FEATURE_CONCURRENCY, Math.max(1, scored.length)) }, () => worker())
  );

  return scored;
}

async function detectSceneBoundaries(
  videoPath: string,
  durationSeconds: number,
  config: ScanConfig
): Promise<number[]> {
  const frames = await extractProbeFrames(videoPath, config.sceneProbeSeconds);
  const boundaries = new Set<number>([0, Math.max(0, durationSeconds - 1)]);
  let previous: Buffer | null = null;

  for (let i = 0; i < frames.length; i++) {
    const current = frames[i];
    const diff = frameDistance(previous, current);
    if (previous && diff >= config.sceneDiffThreshold) {
      const second = Math.min(durationSeconds - 1, Math.max(0, Math.round(i * config.sceneProbeSeconds)));
      boundaries.add(second);
    }
    previous = current;
  }

  return [...boundaries].sort((a, b) => a - b);
}

async function extractFrameJpeg(videoPath: string, second: number): Promise<Buffer> {
  const { stdout } = await execFfmpeg([
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    String(second),
    "-i",
    videoPath,
    "-frames:v",
    "1",
    "-vf",
    `scale=${TARGET_FRAME_WIDTH}:-2:force_original_aspect_ratio=decrease`,
    "-q:v",
    "5",
    "-f",
    "image2pipe",
    "-vcodec",
    "mjpeg",
    "-",
  ]);

  if (!stdout || stdout.length === 0) {
    throw new Error(`No frame output at ${second}s`);
  }

  return stdout;
}

async function extractFrameWindow(
  videoPath: string,
  second: number,
  durationSeconds: number
): Promise<Array<{ second: number; base64: string }>> {
  const seconds = [...new Set(
    WINDOW_OFFSETS.map((offset) =>
      Math.max(0, Math.min(durationSeconds - 1, Math.round(second + offset)))
    )
  )].sort((a, b) => a - b);

  const buffers = await Promise.all(
    seconds.map(async (frameSecond) => ({
      second: frameSecond,
      base64: (await extractFrameJpeg(videoPath, frameSecond)).toString("base64"),
    }))
  );

  return buffers;
}

function appendNeighborCandidate(
  queue: number[],
  candidateMap: Map<number, CandidateFrame>,
  second: number,
  scenes: SceneSegment[],
  durationSeconds: number
): void {
  if (second < 0 || second >= durationSeconds) return;
  const clamped = Math.round(second);
  upsertCandidate(
    candidateMap,
    clamped,
    sceneBySecond(clamped, scenes, durationSeconds),
    "risk_neighbor",
    durationSeconds
  );
  if (!queue.includes(clamped)) queue.push(clamped);
}

export interface ProcessVideoResult {
  findings: VideoFrameFinding[];
  sampledFrames: number;
  intervalSeconds: number;
  candidateFrames: number;
  sceneCount: number;
  scanMode: VideoScanMode;
}

export async function processVideoFile(
  videoBuffer: Buffer,
  fileName: string,
  options?: { mode?: string | null }
): Promise<ProcessVideoResult> {
  const dir = await mkdtemp(join(tmpdir(), "video-scan-"));
  const videoPath = join(dir, fileName.replace(/[^\w\-_.]/g, "_") || "upload.mp4");
  const requestedMode = options?.mode ?? null;
  const scanMode: VideoScanMode = isVideoScanMode(requestedMode) ? requestedMode : DEFAULT_SCAN_MODE;
  const config = SCAN_MODES[scanMode];

  try {
    await writeFile(videoPath, videoBuffer);
    const durationSeconds = await readVideoDurationSeconds(videoPath);
    const sceneBoundaries = await detectSceneBoundaries(videoPath, durationSeconds, config);
    const scenes = buildScenes(sceneBoundaries, durationSeconds);
    const baseCandidates = buildCandidateFrames(durationSeconds, scenes, config);
    const scoredCandidates = await scoreCandidatesByFeatures(videoPath, baseCandidates);
    const initialCandidates = trimCandidates(scoredCandidates, config.maxFrames);
    const candidateMap = new Map<number, CandidateFrame>(
      initialCandidates.map((candidate) => [candidate.second, candidate])
    );
    const queue = initialCandidates.map((candidate) => candidate.second);

    const findings: VideoFrameFinding[] = [];
    const sampledSeconds: number[] = [];
    const semanticSeen = new Map<string, number>();
    const pendingWeak = new Map<string, Array<{ second: number; risk: VideoFrameRisk }>>();
    const sceneCounts = new Map<number, number>();
    const sceneCategories = new Map<number, Set<string>>();
    const visitedSeconds = new Set<number>();

    while (sampledSeconds.length < config.maxFrames) {
      queue.sort((a, b) => a - b);
      const second = queue.find((value) => !visitedSeconds.has(value));
      if (typeof second !== "number") break;

      visitedSeconds.add(second);
      sampledSeconds.push(second);

      const frameWindow = await extractFrameWindow(videoPath, second, durationSeconds);
      const centerFrame =
        frameWindow.find((frame) => frame.second === second) ?? frameWindow[Math.floor(frameWindow.length / 2)];
      const risks = await analyzeFrameWindowBase64(
        frameWindow.map((frame, index) => ({
          label:
            frame.second === second
              ? `Primary frame (${toTimecode(frame.second)})`
              : `Neighbor frame ${index + 1} (${toTimecode(frame.second)})`,
          base64: frame.base64,
        }))
      );
      if (!Array.isArray(risks) || risks.length === 0) continue;

      for (const delta of config.neighborOffsets) {
        appendNeighborCandidate(queue, candidateMap, second + delta, scenes, durationSeconds);
      }

      const scene = sceneBySecond(second, scenes, durationSeconds);
      const sceneCount = sceneCounts.get(scene.id) ?? 0;
      const categories = sceneCategories.get(scene.id) ?? new Set<string>();
      sceneCategories.set(scene.id, categories);

      const keptRisks: VideoFrameRisk[] = [];
      for (const risk of risks) {
        const key = riskSemanticKey(risk);
        const previous = semanticSeen.get(key);
        if (typeof previous === "number" && Math.abs(previous - second) <= 12) continue;

        const isWeak = !hasHardSignal(risk) && (risk.severity === "low" || risk.severity === "medium");
        if (isWeak) {
          const pending = pendingWeak.get(key) ?? [];
          pending.push({ second, risk });
          pendingWeak.set(key, pending);
          const confirmed = pending.some((entry) => entry !== pending[0] && Math.abs(entry.second - second) <= 12);
          if (!confirmed) continue;
        }

        if (sceneCount >= 3 && categories.has(risk.category)) continue;
        semanticSeen.set(key, second);
        categories.add(risk.category);
        keptRisks.push(risk);
      }

      if (keptRisks.length === 0) continue;
      findings.push({
        second,
        timecode: toTimecode(second),
        risks: keptRisks,
        thumbnailDataUrl: centerFrame ? `data:image/jpeg;base64,${centerFrame.base64}` : undefined,
        selectionMeta: buildSelectionMeta(candidateMap.get(second)),
      });
      sceneCounts.set(scene.id, sceneCount + 1);
    }

    return {
      findings: findings.sort((a, b) => a.second - b.second),
      sampledFrames: sampledSeconds.length,
      intervalSeconds: averageStep(sampledSeconds, config.baseIntervalSeconds),
      candidateFrames: baseCandidates.length,
      sceneCount: scenes.length,
      scanMode,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
