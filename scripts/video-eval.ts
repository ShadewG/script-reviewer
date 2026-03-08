import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { processVideoFile } from "../lib/video/process";
import { clusterVideoFindings } from "../lib/video/cluster";
import type { VideoFrameFinding } from "../lib/pipeline/types";

type EvalMode = "quick" | "balanced" | "deep" | "exhaustive";

type ExpectedIncident = {
  at: string | number;
  label?: string;
  windowSeconds?: number;
};

type FalsePositiveWindow = {
  start: string | number;
  end: string | number;
  label?: string;
};

type EvalFixture = {
  expectedIncidents?: ExpectedIncident[];
  falsePositiveWindows?: FalsePositiveWindow[];
  defaultWindowSeconds?: number;
};

type Args = {
  videoPath: string;
  fixturePath?: string;
  mode: EvalMode;
};

function usage(): never {
  console.error(
    [
      "Usage:",
      "  npm run video:eval -- --video /abs/path/to/video.mp4 [--fixture /abs/path/to/fixture.json] [--mode balanced]",
      "",
      "Fixture JSON shape:",
      '{ "expectedIncidents": [{ "at": "00:05:22", "label": "daughter face" }], "falsePositiveWindows": [{ "start": "00:04:00", "end": "00:04:30" }] }',
    ].join("\n")
  );
  process.exit(1);
}

function parseArgs(argv: string[]): Args {
  let videoPath: string | undefined;
  let fixturePath: string | undefined;
  let mode: EvalMode = "balanced";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--video") {
      videoPath = argv[++i];
      continue;
    }
    if (arg === "--fixture") {
      fixturePath = argv[++i];
      continue;
    }
    if (arg === "--mode") {
      const value = argv[++i];
      if (value === "quick" || value === "balanced" || value === "deep" || value === "exhaustive") {
        mode = value;
        continue;
      }
      console.error(`Invalid mode: ${value}`);
      usage();
    }
  }

  if (!videoPath) usage();
  return { videoPath, fixturePath, mode };
}

function parseSecond(input: string | number): number {
  if (typeof input === "number") return input;
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const match = trimmed.match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) throw new Error(`Invalid time value: ${input}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function summarizeFinding(finding: VideoFrameFinding) {
  return {
    timecode: finding.timecode,
    second: finding.second,
    incidentCount: finding.selectionMeta?.incidentCount ?? 1,
    incidentEndSecond: finding.selectionMeta?.incidentEndSecond ?? finding.second,
    incidentSignature: finding.selectionMeta?.incidentSignature ?? null,
    candidateScore: finding.selectionMeta?.candidateScore ?? null,
    selectionReasons: finding.selectionMeta?.selectionReasons ?? [],
    risks: (finding.risks ?? []).map((risk) => ({
      category: risk.category,
      severity: risk.severity,
      impact: risk.impact,
      policyName: risk.policyName,
      detectedText: risk.detectedText ?? null,
    })),
  };
}

function incidentMatches(
  finding: VideoFrameFinding,
  targetSecond: number,
  windowSeconds: number
): boolean {
  const start = finding.selectionMeta?.incidentStartSecond ?? finding.second;
  const end = finding.selectionMeta?.incidentEndSecond ?? finding.second;
  return targetSecond >= start - windowSeconds && targetSecond <= end + windowSeconds;
}

function evaluateFixture(findings: VideoFrameFinding[], fixture: EvalFixture) {
  const defaultWindow = fixture.defaultWindowSeconds ?? 15;

  const expected = (fixture.expectedIncidents ?? []).map((incident) => {
    const target = parseSecond(incident.at);
    const windowSeconds = incident.windowSeconds ?? defaultWindow;
    const match = findings.find((finding) => incidentMatches(finding, target, windowSeconds));
    return {
      label: incident.label ?? null,
      targetSecond: target,
      targetTimecode: toTimecode(target),
      windowSeconds,
      hit: Boolean(match),
      matchedFinding: match ? summarizeFinding(match) : null,
    };
  });

  const falsePositives = (fixture.falsePositiveWindows ?? []).map((window) => {
    const start = parseSecond(window.start);
    const end = parseSecond(window.end);
    const matches = findings.filter((finding) => {
      const findingStart = finding.selectionMeta?.incidentStartSecond ?? finding.second;
      const findingEnd = finding.selectionMeta?.incidentEndSecond ?? finding.second;
      return findingEnd >= start && findingStart <= end;
    });
    return {
      label: window.label ?? null,
      startSecond: start,
      endSecond: end,
      startTimecode: toTimecode(start),
      endTimecode: toTimecode(end),
      hitCount: matches.length,
      matches: matches.map(summarizeFinding),
    };
  });

  return {
    expectedHitRate:
      expected.length > 0 ? expected.filter((entry) => entry.hit).length / expected.length : null,
    falsePositiveHitRate:
      falsePositives.length > 0
        ? falsePositives.filter((entry) => entry.hitCount > 0).length / falsePositives.length
        : null,
    expected,
    falsePositives,
  };
}

function toTimecode(second: number): string {
  const h = String(Math.floor(second / 3600)).padStart(2, "0");
  const m = String(Math.floor((second % 3600) / 60)).padStart(2, "0");
  const s = String(second % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const videoPath = resolve(args.videoPath);
  const fixturePath = args.fixturePath ? resolve(args.fixturePath) : undefined;

  const videoBuffer = await readFile(videoPath);
  const result = await processVideoFile(videoBuffer, videoPath.split(/[\\/]/).pop() || "video.mp4", {
    mode: args.mode,
  });
  const clustered = clusterVideoFindings(result.findings);

  let fixtureResult = null;
  if (fixturePath) {
    const fixture = JSON.parse(await readFile(fixturePath, "utf8")) as EvalFixture;
    fixtureResult = evaluateFixture(clustered, fixture);
  }

  const summary = {
    videoPath,
    mode: args.mode,
    sampledFrames: result.sampledFrames,
    candidateFrames: result.candidateFrames,
    sceneCount: result.sceneCount,
    rawFindingCount: result.findings.length,
    clusteredFindingCount: clustered.length,
    duplicateReduction:
      result.findings.length > 0
        ? 1 - clustered.length / Math.max(1, result.findings.length)
        : 0,
    findings: clustered.map(summarizeFinding),
    fixture: fixtureResult,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
