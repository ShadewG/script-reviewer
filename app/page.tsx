"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { DocumentFacts } from "@/lib/documents/types";
import type { VideoFrameFinding } from "@/lib/pipeline/types";
import { useTheme } from "@/lib/theme";
import { useOnboarding, OnboardingOverlay } from "@/lib/onboarding";

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire",
  "New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio",
  "Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota",
  "Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia",
  "Wisconsin","Wyoming","District of Columbia",
];

const CASE_STATUSES = [
  { value: "convicted", label: "CONVICTED" },
  { value: "charged", label: "CHARGED / ON TRIAL" },
  { value: "suspect", label: "SUSPECT / POI" },
  { value: "acquitted", label: "ACQUITTED / EXONERATED" },
  { value: "unsolved", label: "UNSOLVED" },
];

const FOOTAGE_TYPES = [
  "Bodycam", "911 Calls", "Court Footage", "Interrogation",
  "Surveillance", "News Clips", "Photos", "Reenactment",
];
type VideoScanMode = "quick" | "balanced" | "deep" | "exhaustive";
const VIDEO_SCAN_MODES: Array<{
  value: VideoScanMode;
  label: string;
  baseIntervalSeconds: number;
  floorIntervalSeconds: number;
  sceneProbeSeconds: number;
  maxFrames: number;
  warning?: string;
}> = [
  {
    value: "quick",
    label: "QUICK (~120 frames max)",
    baseIntervalSeconds: 10,
    floorIntervalSeconds: 8,
    sceneProbeSeconds: 3,
    maxFrames: 120,
  },
  {
    value: "balanced",
    label: "BALANCED (~220 frames max)",
    baseIntervalSeconds: 8,
    floorIntervalSeconds: 5,
    sceneProbeSeconds: 2,
    maxFrames: 220,
  },
  {
    value: "deep",
    label: "DEEP (~420 frames max)",
    baseIntervalSeconds: 6,
    floorIntervalSeconds: 3,
    sceneProbeSeconds: 1,
    maxFrames: 420,
  },
  {
    value: "exhaustive",
    label: "EXHAUSTIVE (~2000 frames max)",
    baseIntervalSeconds: 2,
    floorIntervalSeconds: 1,
    sceneProbeSeconds: 0.5,
    maxFrames: 2000,
    warning: "Analyzes nearly every second of video. This will use significant API credits (~$3-8 depending on video length) and can take 15-30+ minutes. Use only when you need frame-level coverage for high-stakes content.",
  },
];

type AnalysisMode = "full" | "legal_only" | "monetization_only";


const ANALYSIS_MODES: Array<{ value: AnalysisMode; label: string }> = [
  { value: "full", label: "FULL (LEGAL + MONETIZATION)" },
  { value: "legal_only", label: "LEGAL ONLY" },
  { value: "monetization_only", label: "MONETIZATION ONLY" },
];

interface StageStatus {
  stage: number;
  name: string;
  status: "pending" | "running" | "complete" | "error";
  error?: string;
}

type FrameSignature = {
  values: Uint8ClampedArray;
  hash: string;
};

type SceneSegment = {
  id: number;
  start: number;
  end: number;
};

function frameDistance(a: FrameSignature | null, b: FrameSignature | null): number {
  if (!a || !b || a.values.length !== b.values.length) return 1;
  let sum = 0;
  for (let i = 0; i < a.values.length; i++) {
    sum += Math.abs(a.values[i] - b.values[i]);
  }
  return sum / (a.values.length * 255);
}

function normalizeRiskText(text?: string): string {
  return (text || "")
    .toLowerCase()
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
  risk: { category: string; severity: string; policyName: string; reasoning: string; detectedText?: string }
): boolean {
  if (risk.severity === "high" || risk.severity === "severe") return true;
  const joined = normalizeRiskText(
    `${risk.policyName} ${risk.reasoning} ${risk.detectedText ?? ""}`
  );
  return /\b(address|street|license plate|plate number|phone number|email|ssn|passport|driver|minor|child|gore|graphic|blood|corpse|drug|cocaine|heroin|meth|weapon|gun|rifle|knife)\b/.test(
    joined
  );
}

const STAGE_ESTIMATES: Record<number, number> = { 0: 5, 1: 20, 2: 10, 3: 25, 4: 15 };

export default function Home() {
  const router = useRouter();
  const { theme, toggle: toggleTheme } = useTheme();
  const onboarding = useOnboarding("homepage");
  const [inputMode, setInputMode] = useState<"paste" | "gdoc">("paste");
  const [script, setScript] = useState("");
  const [gdocUrl, setGdocUrl] = useState("");
  const [gdocFetching, setGdocFetching] = useState(false);
  const [gdocPreview, setGdocPreview] = useState<{ text: string; lineCount: number; charCount: number } | null>(null);
  const [state, setState] = useState("California");
  const [caseStatus, setCaseStatus] = useState("convicted");
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("full");
  const [hasMinors, setHasMinors] = useState(false);
  const [footageTypes, setFootageTypes] = useState<string[]>([]);
  const [videoTitle, setVideoTitle] = useState("");
  const [thumbnailDesc, setThumbnailDesc] = useState("");
  const [documentFacts, setDocumentFacts] = useState<DocumentFacts[]>([]);
  const [videoFindings, setVideoFindings] = useState<VideoFrameFinding[]>([]);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState<string>("");
  const [videoScanMode, setVideoScanMode] = useState<VideoScanMode>("balanced");
  const [videoMeta, setVideoMeta] = useState<{ sampledFrames: number; intervalSeconds: number } | null>(null);
  const [videoTranscript, setVideoTranscript] = useState<string>("");
  const [videoTranscribing, setVideoTranscribing] = useState(false);
  const [videoTranscriptError, setVideoTranscriptError] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState<StageStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stageStartTimes = useRef<Record<number, number>>({});

  const toggleFootage = (type: string) => {
    setFootageTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };


  const fetchGdoc = async () => {
    if (!gdocUrl.trim()) return;
    setGdocFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/gdoc-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: gdocUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGdocPreview(data);
      setScript(data.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch doc");
    } finally {
      setGdocFetching(false);
    }
  };

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadErrors([]);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
      const res = await fetch("/api/upload-docs", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = `Upload failed (${res.status})`;
        try { msg = JSON.parse(text).error || msg; } catch { /* not JSON */ }
        throw new Error(msg);
      }
      const data = await res.json();
      if (data.documents?.length > 0) {
        setDocumentFacts((prev) => [...prev, ...data.documents]);
      }
      if (data.errors?.length > 0) {
        setUploadErrors(data.errors);
      }
    } catch (err) {
      setUploadErrors([err instanceof Error ? err.message : "Upload failed"]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  const removeDoc = (index: number) => {
    setDocumentFacts((prev) => prev.filter((_, i) => i !== index));
  };

  const transcribeVideo = useCallback(async (file: File) => {
    setVideoTranscribing(true);
    setVideoTranscriptError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/transcribe-video", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transcription failed");
      setVideoTranscript(data.text || "");
    } catch (err) {
      setVideoTranscript("");
      setVideoTranscriptError(
        err instanceof Error ? err.message : "Video transcription failed"
      );
    } finally {
      setVideoTranscribing(false);
    }
  }, []);

  const handleVideoUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setVideoUploading(true);
    setVideoError(null);
    setVideoProgress("Uploading video for backend scan...");
    setVideoTranscript("");
    setVideoTranscriptError(null);

    const transcriptionPromise = transcribeVideo(file);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", videoScanMode);
      const res = await fetch("/api/upload-video", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Video upload failed");

      await transcriptionPromise;
      const findings = Array.isArray(data.findings) ? data.findings : [];
      setVideoFindings(findings);
      setVideoMeta({
        sampledFrames: typeof data.sampledFrames === "number" ? data.sampledFrames : findings.length,
        intervalSeconds: typeof data.intervalSeconds === "number" ? data.intervalSeconds : 0,
      });
      const sceneCount = typeof data.sceneCount === "number" ? data.sceneCount : null;
      const candidateFrames = typeof data.candidateFrames === "number" ? data.candidateFrames : null;
      setVideoProgress(
        `Backend scan complete (${findings.length} risky timecodes, ${data.sampledFrames ?? findings.length} analyzed frames${sceneCount ? `, ${sceneCount} scenes` : ""}${candidateFrames ? `, ${candidateFrames} initial candidates` : ""}).`
      );
    } catch (err) {
      setVideoFindings([]);
      setVideoMeta(null);
      setVideoProgress("");
      setVideoError(err instanceof Error ? err.message : "Video upload failed");
    } finally {
      await transcriptionPromise;
      setVideoUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  }, [transcribeVideo, videoScanMode]);

  const handleSubmit = async () => {
    const baseScript = inputMode === "gdoc" ? gdocPreview?.text || script : script;
    const scriptText = [baseScript.trim(), videoTranscript.trim()]
      .filter(Boolean)
      .join("\n\n--- VIDEO TRANSCRIPT ---\n\n");
    if (!scriptText.trim()) return;
    setRunning(true);
    setError(null);
    setStages([
      { stage: 0, name: "SCRIPT PARSER", status: "pending" },
      {
        stage: 1,
        name:
          analysisMode === "monetization_only"
            ? "LEGAL REVIEW (SKIPPED)"
            : "LEGAL REVIEW (CROSS-CHECK)",
        status: analysisMode === "monetization_only" ? "complete" : "pending",
      },
      {
        stage: 2,
        name:
          analysisMode === "legal_only"
            ? "YOUTUBE POLICY (SKIPPED)"
            : "YOUTUBE POLICY",
        status: analysisMode === "legal_only" ? "complete" : "pending",
      },
      {
        stage: 3,
        name:
          analysisMode === "monetization_only"
            ? "CASE RESEARCH (SKIPPED)"
            : "CASE RESEARCH",
        status: analysisMode === "monetization_only" ? "complete" : "pending",
      },
      { stage: 4, name: "SYNTHESIS", status: "pending" },
    ]);

    abortRef.current = new AbortController();

    try {
      const body: Record<string, unknown> = {
        state,
        caseStatus,
        hasMinors,
        footageTypes,
        videoTitle: videoTitle || undefined,
        thumbnailDesc: thumbnailDesc || undefined,
        analysisMode,
        documentFacts: documentFacts.length > 0 ? documentFacts : undefined,
        videoFindings: videoFindings.length > 0 ? videoFindings : undefined,
      };

      if (inputMode === "gdoc" && gdocUrl && !gdocPreview && !videoTranscript.trim()) {
        body.gdocUrl = gdocUrl;
      } else {
        body.script = scriptText;
      }

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Request failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "stage") {
              if (data.status === "running") {
                stageStartTimes.current[data.stage] = Date.now();
              }
              setStages((prev) =>
                prev.map((s) =>
                  s.stage === data.stage
                    ? { ...s, status: data.status, name: data.name || s.name, error: data.error }
                    : s
                )
              );
            } else if (data.type === "complete") {
              router.push(`/results?id=${data.reviewId}`);
              return;
            } else if (data.type === "error") {
              setError(data.error);
            }
          } catch {
            // skip malformed SSE
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message);
      }
    } finally {
      setRunning(false);
    }
  };

  const currentScript = (() => {
    const baseScript = inputMode === "gdoc" ? gdocPreview?.text || "" : script;
    return [baseScript.trim(), videoTranscript.trim()].filter(Boolean).join("\n");
  })();

  return (
    <div className="min-h-screen p-4 max-w-5xl mx-auto">
      <header className="border-b border-[var(--border)] pb-4 mb-6 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-[var(--green)]" />
            <h1 className="text-lg tracking-widest text-[var(--text-bright)] uppercase">
              Script Shield
            </h1>
          </div>
          <p className="text-xs text-[var(--text-dim)] mt-1 tracking-wide">
            TRUE CRIME SCRIPT REVIEW // LEGAL RISK + YOUTUBE POLICY COMPLIANCE
          </p>
        </div>
        <div className="flex gap-2" data-no-print>
          <button
            onClick={() => router.push("/reviews")}
            className="text-xs uppercase tracking-wider border border-[var(--border)] px-4 py-2 hover:bg-[var(--bg-elevated)]"
          >
            History
          </button>
          <button
            onClick={toggleTheme}
            className="text-xs uppercase tracking-wider border border-[var(--border)] px-4 py-2 hover:bg-[var(--bg-elevated)]"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "SUN" : "MOON"}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Script Input */}
        <div className="md:col-span-2" data-tour="script-input">
          {/* Input Mode Toggle */}
          <div className="flex items-center gap-0 mb-3">
            <button
              onClick={() => setInputMode("paste")}
              disabled={running}
              className={`px-4 py-1.5 text-xs uppercase tracking-wider border border-[var(--border)] ${
                inputMode === "paste"
                  ? "bg-[var(--bg-elevated)] text-[var(--text-bright)] border-[var(--text-dim)]"
                  : "text-[var(--text-dim)] hover:text-[var(--text)]"
              }`}
            >
              Paste
            </button>
            <button
              onClick={() => setInputMode("gdoc")}
              disabled={running}
              className={`px-4 py-1.5 text-xs uppercase tracking-wider border border-[var(--border)] border-l-0 ${
                inputMode === "gdoc"
                  ? "bg-[var(--bg-elevated)] text-[var(--text-bright)] border-[var(--text-dim)]"
                  : "text-[var(--text-dim)] hover:text-[var(--text)]"
              }`}
            >
              Google Doc
            </button>
          </div>

          {inputMode === "paste" ? (
            <>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Paste your documentary script here..."
                className="w-full h-[500px] resize-none text-sm leading-relaxed"
                disabled={running}
              />
              <div className="flex justify-between mt-2 text-xs text-[var(--text-dim)]">
                <span>{script.split("\n").length} lines</span>
                <span>{script.length.toLocaleString()} chars</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-2 mb-3">
                <input
                  value={gdocUrl}
                  onChange={(e) => { setGdocUrl(e.target.value); setGdocPreview(null); }}
                  placeholder="https://docs.google.com/document/d/..."
                  className="flex-1"
                  disabled={running || gdocFetching}
                />
                <button
                  onClick={fetchGdoc}
                  disabled={running || gdocFetching || !gdocUrl.trim()}
                  className="px-4 py-2 text-xs uppercase tracking-wider border border-[var(--border)] hover:bg-[var(--bg-elevated)] disabled:opacity-30"
                >
                  {gdocFetching ? "FETCHING..." : "FETCH"}
                </button>
              </div>
              {gdocPreview ? (
                <>
                  <div className="text-xs text-[var(--green)] mb-2">
                    Document loaded: {gdocPreview.lineCount} lines, {gdocPreview.charCount.toLocaleString()} chars
                  </div>
                  <textarea
                    value={gdocPreview.text}
                    readOnly
                    className="w-full h-[460px] resize-none text-sm leading-relaxed opacity-70"
                  />
                </>
              ) : (
                <div className="w-full h-[460px] border border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-center text-xs text-[var(--text-dim)]">
                  Enter a Google Docs URL and click FETCH to load the script
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: Metadata */}
        <div className="space-y-4" data-tour="metadata">
          <div>
            <label className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-2 block">
              Jurisdiction
            </label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full"
              disabled={running}
            >
              {US_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-2 block">
              Case Status
            </label>
            <select
              value={caseStatus}
              onChange={(e) => setCaseStatus(e.target.value)}
              className="w-full"
              disabled={running}
            >
              {CASE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-2 block">
              Analysis Scope
            </label>
            <select
              value={analysisMode}
              onChange={(e) => setAnalysisMode(e.target.value as AnalysisMode)}
              className="w-full"
              disabled={running}
            >
              {ANALYSIS_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-2 block">
              Video Title
            </label>
            <input
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              placeholder="Optional"
              className="w-full"
              disabled={running}
            />
          </div>

          <div>
            <label className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-2 block">
              Thumbnail Description
            </label>
            <input
              value={thumbnailDesc}
              onChange={(e) => setThumbnailDesc(e.target.value)}
              placeholder="Optional"
              className="w-full"
              disabled={running}
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs uppercase tracking-wider cursor-pointer">
              <input
                type="checkbox"
                checked={hasMinors}
                onChange={(e) => setHasMinors(e.target.checked)}
                className="accent-[var(--amber)]"
                disabled={running}
              />
              <span className="text-[var(--text-dim)]">Minors Involved</span>
            </label>
          </div>

          <div>
            <label className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-2 block">
              Footage Types
            </label>
            <div className="grid grid-cols-2 gap-1">
              {FOOTAGE_TYPES.map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-1.5 text-xs cursor-pointer py-1"
                >
                  <input
                    type="checkbox"
                    checked={footageTypes.includes(type)}
                    onChange={() => toggleFootage(type)}
                    className="accent-[var(--text-dim)]"
                    disabled={running}
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-2 block">
              Supplemental Docs
            </label>
            <p className="text-[10px] text-[var(--text-dim)] mb-2">
              Upload police reports, court filings, autopsy reports to verify script claims and reduce false flags
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={(e) => handleFileUpload(e.target.files)}
              disabled={running || uploading}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={running || uploading}
              className="w-full py-2 text-xs uppercase tracking-wider border border-dashed border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--text-dim)] disabled:opacity-30 transition-colors"
            >
              {uploading ? "PROCESSING..." : "UPLOAD DOCUMENTS"}
            </button>
            {uploadErrors.length > 0 && (
              <div className="mt-2 space-y-1">
                {uploadErrors.map((err, i) => (
                  <div key={i} className="text-[10px] text-[var(--red)]">{err}</div>
                ))}
              </div>
            )}
            {documentFacts.length > 0 && (
              <div className="mt-2 space-y-2">
                {documentFacts.map((doc, i) => (
                  <div
                    key={i}
                    className="border border-[var(--border)] bg-[var(--bg-surface)] p-2 text-[10px]"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[var(--text-bright)] font-medium truncate">
                        {doc.fileName}
                      </span>
                      <button
                        onClick={() => removeDoc(i)}
                        disabled={running}
                        className="text-[var(--text-dim)] hover:text-[var(--red)] ml-2 flex-shrink-0"
                      >
                        X
                      </button>
                    </div>
                    <div className="text-[var(--text-dim)]">
                      {doc.docType} / {doc.verifiableFacts.length} facts / {doc.people.length} people
                    </div>
                    <div className="text-[var(--text-dim)] mt-1 line-clamp-2">
                      {doc.summary}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-2 block">
              Video Scan (MVP)
            </label>
            <p className="text-[10px] text-[var(--text-dim)] mb-2">
              Upload one video. We transcribe audio with ElevenLabs and scan adaptive scene frames (1s during rapid cuts, sparse in stable scenes).
            </p>
            <select
              value={videoScanMode}
              onChange={(e) => setVideoScanMode(e.target.value as VideoScanMode)}
              disabled={running || videoUploading}
              className="w-full mb-2"
            >
              {VIDEO_SCAN_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            {VIDEO_SCAN_MODES.find((m) => m.value === videoScanMode)?.warning && (
              <div className="border border-[var(--red)] bg-[var(--bg-surface)] p-2 mb-2 text-[10px] text-[var(--red)] leading-relaxed">
                {VIDEO_SCAN_MODES.find((m) => m.value === videoScanMode)!.warning}
              </div>
            )}
            <input
              ref={videoInputRef}
              type="file"
              accept=".mp4,.mov,.webm,.mkv,video/mp4,video/quicktime,video/webm,video/x-matroska"
              onChange={(e) => handleVideoUpload(e.target.files)}
              disabled={running || videoUploading}
              className="hidden"
            />
            <button
              onClick={() => videoInputRef.current?.click()}
              disabled={running || videoUploading}
              className="w-full py-2 text-xs uppercase tracking-wider border border-dashed border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--text-dim)] disabled:opacity-30 transition-colors"
            >
              {videoUploading ? "SCANNING VIDEO..." : "UPLOAD VIDEO"}
            </button>
            {videoError && (
              <div className="mt-2 text-[10px] text-[var(--red)]">{videoError}</div>
            )}
            {videoUploading && videoProgress && (
              <div className="mt-2 text-[10px] text-[var(--text-dim)]">{videoProgress}</div>
            )}
            {videoTranscribing && (
              <div className="mt-2 text-[10px] text-[var(--text-dim)]">Transcribing audio with ElevenLabs...</div>
            )}
            {videoTranscriptError && (
              <div className="mt-2 text-[10px] text-[var(--red)]">{videoTranscriptError}</div>
            )}
            {videoTranscript && (
              <div className="mt-2 border border-[var(--border)] bg-[var(--bg-surface)] p-2 text-[10px]">
                <div className="text-[var(--text-bright)] mb-1">
                  Transcript captured ({videoTranscript.length.toLocaleString()} chars)
                </div>
                <div className="text-[var(--text-dim)] max-h-20 overflow-auto whitespace-pre-wrap">
                  {videoTranscript.slice(0, 700)}
                  {videoTranscript.length > 700 ? "..." : ""}
                </div>
              </div>
            )}
            {videoMeta && (
              <div className="mt-2 text-[10px] text-[var(--text-dim)]">
                Sampled {videoMeta.sampledFrames} scene frames (average step ~{videoMeta.intervalSeconds}s)
              </div>
            )}
            {videoFindings.length > 0 && (
              <div className="mt-2 border border-[var(--border)] bg-[var(--bg-surface)] p-2 text-[10px]">
                <div className="text-[var(--text-bright)] mb-1">
                  {videoFindings.length} risky timecodes detected
                </div>
                <div className="space-y-1 max-h-24 overflow-auto">
                  {videoFindings.slice(0, 20).map((f, i) => (
                    <div key={`${f.timecode}-${i}`} className="text-[var(--text-dim)]">
                      {f.timecode} — {f.risks[0]?.policyName ?? "Risk"}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            data-tour="analyze-btn"
            onClick={handleSubmit}
            disabled={running || uploading || videoUploading || videoTranscribing || !currentScript.trim()}
            className="w-full py-3 text-sm uppercase tracking-widest border border-[var(--border)] text-[var(--text-bright)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {running ? "ANALYZING..." : "ANALYZE SCRIPT"}
          </button>

          {stages.length > 0 && (
            <div className="border border-[var(--border)] bg-[var(--bg-surface)] p-3 space-y-3">
              <div className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-1">
                Pipeline Status
              </div>
              {stages.map((s) => {
                const estimate = STAGE_ESTIMATES[s.stage] ?? 10;
                const startTime = stageStartTimes.current[s.stage];
                const elapsed = s.status === "running" && startTime
                  ? Math.floor((Date.now() - startTime) / 1000)
                  : 0;
                return (
                  <div key={s.stage}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 text-xs">
                        {s.status === "complete" && (
                          <span className="text-[var(--green)] text-sm">&#10003;</span>
                        )}
                        {s.status === "error" && (
                          <span className="text-[var(--red)] text-sm">&#10007;</span>
                        )}
                        {s.status === "pending" && (
                          <span className="w-2 h-2 bg-[var(--border)]" />
                        )}
                        {s.status === "running" && (
                          <span className="w-2 h-2 bg-[var(--amber)] progress-active" />
                        )}
                        <span className={s.status === "running" ? "text-[var(--text-bright)]" : ""}>
                          {s.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-[var(--text-dim)]">
                        {s.status === "running" ? `~${estimate}s` : ""}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--bg)] overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          s.status === "running" ? "progress-active" : ""
                        }`}
                        style={{
                          width:
                            s.status === "complete" ? "100%" :
                            s.status === "running" ? `${Math.min(90, (elapsed / estimate) * 100)}%` :
                            s.status === "error" ? "100%" : "0%",
                          background:
                            s.status === "complete" ? "var(--green)" :
                            s.status === "running" ? "var(--amber)" :
                            s.status === "error" ? "var(--red)" : "transparent",
                        }}
                      />
                    </div>
                    {s.status === "error" && s.error && (
                      <div className="text-[10px] text-[var(--red)] mt-0.5 truncate">
                        {s.error}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div className="border border-[var(--red)] bg-[var(--bg-surface)] p-3 text-xs text-[var(--red)]">
              {error}
            </div>
          )}
        </div>
      </div>

      <OnboardingOverlay
        active={onboarding.active}
        currentStep={onboarding.currentStep}
        step={onboarding.step}
        total={onboarding.steps.length}
        onNext={onboarding.next}
        onSkip={onboarding.skip}
      />
    </div>
  );
}
