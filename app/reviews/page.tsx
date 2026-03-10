"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme";
import { PORTAL_BASE_URL } from "@/lib/portal-url";

interface ReviewListItem {
  id: string;
  createdAt: string;
  scriptTitle: string | null;
  caseState: string;
  caseStatus: string;
  status: string;
  verdict: string | null;
  riskScore: number | null;
}

function verdictColor(v: string | null) {
  if (v === "publishable") return "var(--green)";
  if (v === "borderline") return "var(--yellow)";
  if (v === "not_publishable") return "var(--red)";
  return "var(--text-dim)";
}

function statusBadge(s: string) {
  if (s === "completed") return { color: "var(--green)", label: "DONE" };
  if (s === "processing") return { color: "var(--yellow)", label: "RUNNING" };
  if (s === "failed") return { color: "var(--red)", label: "FAILED" };
  return { color: "var(--text-dim)", label: s.toUpperCase() };
}

export default function ReviewsPage() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [reviews, setReviews] = useState<ReviewListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verdictFilter, setVerdictFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  const saveTitle = useCallback(async (id: string, title: string) => {
    setEditingId(null);
    const trimmed = title.trim();
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, scriptTitle: trimmed || null } : r))
    );
    await fetch(`/api/reviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scriptTitle: trimmed }),
    });
  }, []);

  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    fetch("/api/reviews")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load reviews");
        return r.json();
      })
      .then((data) => {
        setReviews(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const states = useMemo(() => {
    const s = new Set(reviews.map((r) => r.caseState));
    return [...s].sort();
  }, [reviews]);

  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      if (verdictFilter !== "all" && r.verdict !== verdictFilter) return false;
      if (stateFilter !== "all" && r.caseState !== stateFilter) return false;
      return true;
    });
  }, [reviews, verdictFilter, stateFilter]);

  return (
    <div className="min-h-screen p-4 max-w-6xl mx-auto">
      <header className="border-b border-[var(--border)] pb-4 mb-6 flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-[var(--green)]" />
            <h1 className="text-lg tracking-widest text-[var(--text-bright)] uppercase">
              Review History
            </h1>
          </div>
          <p className="text-xs text-[var(--text-dim)] mt-1 tracking-wide">
            {reviews.length} ANALYSES ON RECORD
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={PORTAL_BASE_URL}
            className="text-xs uppercase tracking-wider border border-[var(--border)] px-4 py-2 hover:bg-[var(--bg-elevated)]"
          >
            Portal
          </a>
          <button
            onClick={toggle}
            className="text-xs uppercase tracking-wider border border-[var(--border)] px-4 py-2 hover:bg-[var(--bg-elevated)]"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "SUN" : "MOON"}
          </button>
          <button
            onClick={() => router.push("/")}
            className="text-xs uppercase tracking-wider border border-[var(--border)] px-4 py-2 hover:bg-[var(--bg-elevated)]"
          >
            New Analysis
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">Verdict:</span>
          <select
            value={verdictFilter}
            onChange={(e) => setVerdictFilter(e.target.value)}
            className="text-xs"
          >
            <option value="all">All</option>
            <option value="publishable">Publishable</option>
            <option value="borderline">Borderline</option>
            <option value="not_publishable">Not Publishable</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">State:</span>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="text-xs"
          >
            <option value="all">All</option>
            {states.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse bg-[var(--bg-surface)] rounded" />
          ))}
        </div>
      )}

      {error && (
        <div className="border border-[var(--red)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--red)]">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="border border-[var(--border)] bg-[var(--bg-surface)] p-8 text-center">
          <p className="text-sm text-[var(--text-dim)]">
            {reviews.length === 0 ? "No reviews yet. Run your first analysis." : "No reviews match filters."}
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_120px_100px_80px_80px_60px] gap-3 px-4 py-2.5 border-b border-[var(--border)] text-[10px] text-[var(--text-dim)] uppercase tracking-wider bg-[var(--bg)]">
            <span>Title</span>
            <span>Date</span>
            <span>State</span>
            <span>Status</span>
            <span>Verdict</span>
            <span className="text-right">Risk</span>
          </div>

          {filtered.map((review) => {
            const badge = statusBadge(review.status);
            const isEditing = editingId === review.id;
            return (
              <div
                key={review.id}
                onClick={() => {
                  if (!isEditing) router.push(`/results?id=${review.id}`);
                }}
                className="grid grid-cols-[1fr_120px_100px_80px_80px_60px] gap-3 px-4 py-3 border-t border-[var(--border)] cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors"
              >
                {isEditing ? (
                  <input
                    ref={editRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveTitle(review.id, editValue);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => saveTitle(review.id, editValue)}
                    onClick={(e) => e.stopPropagation()}
                    maxLength={200}
                    className="text-sm bg-[var(--bg)] text-[var(--text-bright)] border border-[var(--accent)] px-2 py-0.5 outline-none w-full"
                  />
                ) : (
                  <span
                    className="text-sm text-[var(--text)] truncate"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingId(review.id);
                      setEditValue(review.scriptTitle || "");
                    }}
                    title="Double-click to rename"
                  >
                    {review.scriptTitle || "Untitled"}
                  </span>
                )}
                <span className="text-xs text-[var(--text-dim)] self-center">
                  {new Date(review.createdAt).toLocaleDateString()}
                </span>
                <span className="text-xs text-[var(--text-dim)] self-center truncate">
                  {review.caseState}
                </span>
                <span
                  className="text-[10px] uppercase self-center"
                  style={{ color: badge.color }}
                >
                  {badge.label}
                </span>
                <span
                  className="text-xs uppercase font-bold self-center"
                  style={{ color: verdictColor(review.verdict) }}
                >
                  {review.verdict ? review.verdict.replaceAll("_", " ") : "--"}
                </span>
                <span className="text-right self-center">
                  {review.riskScore != null ? (
                    <span className="text-sm text-[var(--text-bright)]">{review.riskScore}</span>
                  ) : (
                    <span className="text-xs text-[var(--text-dim)]">--</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
