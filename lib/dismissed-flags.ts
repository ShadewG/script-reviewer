"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@/lib/user";

export type DismissReason =
  | "Accepted risk"
  | "Already addressed"
  | "False positive"
  | "Cleared by counsel";

export const DISMISS_REASONS: DismissReason[] = [
  "Accepted risk",
  "Already addressed",
  "False positive",
  "Cleared by counsel",
];

export interface DismissedEntry {
  key: string;
  reason: DismissReason;
  note?: string;
  at: number;
  userId?: string;
  displayName?: string;
  avatarUrl?: string;
}

interface DismissedStore {
  version: 1;
  reviewId: string;
  dismissed: DismissedEntry[];
}

function storageKey(reviewId: string) {
  return `script-shield-dismissed:${reviewId}`;
}

function simpleHash(text: string): string {
  let hash = 0;
  const str = text.slice(0, 120);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}

export function flagKey(type: string, line: number | undefined | null, text: string): string {
  return `${type}:${line ?? "na"}:${simpleHash(text)}`;
}

function loadStore(reviewId: string): DismissedStore {
  try {
    const raw = localStorage.getItem(storageKey(reviewId));
    if (!raw) return { version: 1, reviewId, dismissed: [] };
    const parsed = JSON.parse(raw);
    if (parsed.version === 1 && parsed.reviewId === reviewId) return parsed;
  } catch {}
  return { version: 1, reviewId, dismissed: [] };
}

function saveStore(store: DismissedStore) {
  try {
    localStorage.setItem(storageKey(store.reviewId), JSON.stringify(store));
  } catch {}
}

/** Sync dismissed flags to server; returns adjusted score/verdict */
async function syncToServer(
  reviewId: string,
  dismissed: DismissedEntry[],
): Promise<{ riskScore: number; verdict: string } | null> {
  try {
    const res = await fetch(`/api/reviews/${reviewId}/dismiss`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissed }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export interface AdjustedScore {
  riskScore: number;
  verdict: string;
  originalRiskScore: number;
  originalVerdict: string;
}

export function useDismissedFlags(reviewId: string) {
  const user = useUser();
  const [dismissed, setDismissed] = useState<DismissedEntry[]>([]);
  const [adjustedScore, setAdjustedScore] = useState<AdjustedScore | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const store = loadStore(reviewId);
    setDismissed(store.dismissed);

    // Load server-side dismissals on mount
    if (reviewId) {
      fetch(`/api/reviews/${reviewId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (!data) return;
          // If server has dismissals and local doesn't, use server
          const serverDismissed = (data.dismissedFlags as DismissedEntry[] | null) ?? [];
          const localStore = loadStore(reviewId);
          if (serverDismissed.length > 0 && localStore.dismissed.length === 0) {
            setDismissed(serverDismissed);
            saveStore({ version: 1, reviewId, dismissed: serverDismissed });
          }
          if (data.originalRiskScore != null) {
            setAdjustedScore({
              riskScore: data.riskScore,
              verdict: data.verdict,
              originalRiskScore: data.originalRiskScore,
              originalVerdict: data.originalVerdict,
            });
          }
        })
        .catch(() => {});
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey(reviewId)) {
        const store = loadStore(reviewId);
        setDismissed(store.dismissed);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [reviewId]);

  const scheduleSync = useCallback(
    (entries: DismissedEntry[]) => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(async () => {
        const result = await syncToServer(reviewId, entries);
        if (result) {
          setAdjustedScore(result as AdjustedScore);
        }
      }, 300);
    },
    [reviewId],
  );

  const isDismissed = useCallback(
    (key: string) => dismissed.some((d) => d.key === key),
    [dismissed],
  );

  const getDismissal = useCallback(
    (key: string) => dismissed.find((d) => d.key === key),
    [dismissed],
  );

  const dismiss = useCallback(
    (key: string, reason: DismissReason, note?: string) => {
      setDismissed((prev) => {
        if (prev.some((d) => d.key === key)) return prev;
        const entry: DismissedEntry = {
          key,
          reason,
          note,
          at: Date.now(),
          userId: user?.id,
          displayName: user?.username ?? undefined,
          avatarUrl: user?.avatar ?? undefined,
        };
        const next = [...prev, entry];
        saveStore({ version: 1, reviewId, dismissed: next });
        scheduleSync(next);
        return next;
      });
    },
    [reviewId, scheduleSync, user],
  );

  const restore = useCallback(
    (key: string) => {
      setDismissed((prev) => {
        const next = prev.filter((d) => d.key !== key);
        saveStore({ version: 1, reviewId, dismissed: next });
        scheduleSync(next);
        return next;
      });
    },
    [reviewId, scheduleSync],
  );

  const dismissedCount = dismissed.length;

  return { isDismissed, getDismissal, dismiss, restore, dismissedCount, adjustedScore };
}
