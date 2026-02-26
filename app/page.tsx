"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

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

interface StageStatus {
  stage: number;
  name: string;
  status: "pending" | "running" | "complete" | "error";
  error?: string;
}

export default function Home() {
  const router = useRouter();
  const [script, setScript] = useState("");
  const [state, setState] = useState("California");
  const [caseStatus, setCaseStatus] = useState("convicted");
  const [hasMinors, setHasMinors] = useState(false);
  const [footageTypes, setFootageTypes] = useState<string[]>([]);
  const [videoTitle, setVideoTitle] = useState("");
  const [thumbnailDesc, setThumbnailDesc] = useState("");
  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState<StageStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const toggleFootage = (type: string) => {
    setFootageTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = async () => {
    if (!script.trim()) return;
    setRunning(true);
    setError(null);
    setStages([
      { stage: 0, name: "SCRIPT PARSER", status: "pending" },
      { stage: 1, name: "LEGAL REVIEW", status: "pending" },
      { stage: 2, name: "YOUTUBE POLICY", status: "pending" },
      { stage: 3, name: "CASE RESEARCH", status: "pending" },
      { stage: 4, name: "SYNTHESIS", status: "pending" },
    ]);

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script,
          state,
          caseStatus,
          hasMinors,
          footageTypes,
          videoTitle: videoTitle || undefined,
          thumbnailDesc: thumbnailDesc || undefined,
        }),
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
                    ? { ...s, status: data.status, error: data.error }
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

  return (
    <div className="min-h-screen p-4 max-w-5xl mx-auto">
      {/* Header */}
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
          <label className="text-xs text-[var(--text-dim)] uppercase tracking-wider mb-2 block">
            Script Content
          </label>
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

          <button
            onClick={handleSubmit}
            disabled={running || !script.trim()}
            className="w-full py-3 text-sm uppercase tracking-widest border border-[var(--border)] text-[var(--text-bright)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {running ? "ANALYZING..." : "ANALYZE SCRIPT"}
          </button>

          {/* Stage Progress */}
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
