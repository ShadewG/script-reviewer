"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { DocumentFacts } from "@/lib/documents/types";
import type { VideoFrameFinding } from "@/lib/pipeline/types";

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
const VIDEO_BASE_INTERVAL_SECONDS = 10;
const VIDEO_MAX_FRAMES = 40;

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

export default function Home() {
  const router = useRouter();
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
  const [videoMeta, setVideoMeta] = useState<{ sampledFrames: number; intervalSeconds: number } | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState<StageStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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

  const handleVideoUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    let objectUrl: string | null = null;
    setVideoUploading(true);
    setVideoError(null);
    setVideoProgress("Loading video metadata...");
    try {
      objectUrl = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.src = objectUrl;
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Could not read video metadata"));
      });

      const duration = Number.isFinite(video.duration) ? Math.max(1, Math.floor(video.duration)) : 0;
      if (duration <= 0) throw new Error("Invalid video duration");

      const step = Math.max(
        VIDEO_BASE_INTERVAL_SECONDS,
        Math.ceil(duration / VIDEO_MAX_FRAMES)
      );
      const times: number[] = [];
      for (let t = 0; t < duration; t += step) times.push(t);
      if (times.length === 0) times.push(0);

      const canvas = document.createElement("canvas");
      const findings: VideoFrameFinding[] = [];

      const seekTo = (sec: number) =>
        new Promise<void>((resolve, reject) => {
          const onSeeked = () => {
            video.removeEventListener("seeked", onSeeked);
            resolve();
          };
          const onError = () => {
            video.removeEventListener("error", onError);
            reject(new Error(`Failed seeking to ${sec}s`));
          };
          video.addEventListener("seeked", onSeeked, { once: true });
          video.addEventListener("error", onError, { once: true });
          video.currentTime = Math.min(sec, Math.max(0, video.duration - 0.1));
        });

      for (let i = 0; i < times.length; i++) {
        const second = times[i];
        setVideoProgress(`Scanning frame ${i + 1}/${times.length}...`);
        await seekTo(second);

        const srcW = video.videoWidth || 1280;
        const srcH = video.videoHeight || 720;
        const targetW = Math.min(960, srcW);
        const targetH = Math.max(1, Math.round((srcH / srcW) * targetW));
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not initialize canvas");
        ctx.drawImage(video, 0, 0, targetW, targetH);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
        const base64 = dataUrl.split(",")[1];
        const h = String(Math.floor(second / 3600)).padStart(2, "0");
        const m = String(Math.floor((second % 3600) / 60)).padStart(2, "0");
        const s = String(second % 60).padStart(2, "0");
        const timecode = `${h}:${m}:${s}`;

        const res = await fetch("/api/analyze-video-frame", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            second,
            timecode,
            imageBase64: base64,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Frame analysis failed");
        }
        if (Array.isArray(data.risks) && data.risks.length > 0) {
          findings.push({
            second: data.second,
            timecode: data.timecode,
            risks: data.risks,
          });
        }
      }

      setVideoFindings(findings);
      setVideoMeta({
        sampledFrames: times.length,
        intervalSeconds: step,
      });
      setVideoProgress(`Scan complete (${findings.length} risky timecodes).`);
    } catch (err) {
      setVideoFindings([]);
      setVideoMeta(null);
      setVideoProgress("");
      setVideoError(err instanceof Error ? err.message : "Video upload failed");
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setVideoUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  }, []);

  const handleSubmit = async () => {
    const scriptText = inputMode === "gdoc" ? gdocPreview?.text || script : script;
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

      if (inputMode === "gdoc" && gdocUrl && !gdocPreview) {
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

  const currentScript = inputMode === "gdoc" ? gdocPreview?.text || "" : script;

  return (
    <div className="min-h-screen p-4 max-w-5xl mx-auto">
      <header className="border-b border-[var(--border)] pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-[var(--green)]" />
          <h1 className="text-lg tracking-widest text-[var(--text-bright)] uppercase">
            Script Shield
          </h1>
        </div>
        <p className="text-xs text-[var(--text-dim)] mt-1 tracking-wide">
          TRUE CRIME SCRIPT REVIEW // LEGAL RISK + YOUTUBE POLICY COMPLIANCE
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Script Input */}
        <div className="lg:col-span-2">
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
        <div className="space-y-4">
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
              Upload one video. Frames are sampled ~every 10s and scanned for privacy/graphic/profanity risks.
            </p>
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
            {videoMeta && (
              <div className="mt-2 text-[10px] text-[var(--text-dim)]">
                Sampled {videoMeta.sampledFrames} frames (about every {videoMeta.intervalSeconds}s)
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
            onClick={handleSubmit}
            disabled={running || uploading || videoUploading || !currentScript.trim()}
            className="w-full py-3 text-sm uppercase tracking-widest border border-[var(--border)] text-[var(--text-bright)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {running ? "ANALYZING..." : "ANALYZE SCRIPT"}
          </button>

          {stages.length > 0 && (
            <div className="border border-[var(--border)] bg-[var(--bg-surface)] p-3 space-y-2">
              <div className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-2">
                Pipeline Status
              </div>
              {stages.map((s) => (
                <div key={s.stage} className="flex items-center gap-2 text-xs">
                  <span
                    className="w-2 h-2 flex-shrink-0"
                    style={{
                      background:
                        s.status === "complete"
                          ? "var(--green)"
                          : s.status === "running"
                          ? "var(--yellow)"
                          : s.status === "error"
                          ? "var(--red)"
                          : "var(--border)",
                    }}
                  />
                  <span className={s.status === "running" ? "text-[var(--text-bright)]" : ""}>
                    {s.name}
                  </span>
                  {s.status === "running" && (
                    <span className="text-[var(--yellow)] animate-pulse">...</span>
                  )}
                  {s.status === "error" && (
                    <span className="text-[var(--red)] text-[10px] truncate max-w-[120px]">
                      {s.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="border border-[var(--red)] bg-[var(--bg-surface)] p-3 text-xs text-[var(--red)]">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
