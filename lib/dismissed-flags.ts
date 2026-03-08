"use client";

import { useState, useEffect, useCallback } from "react";

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

interface DismissedEntry {
  key: string;
  reason: DismissReason;
  note?: string;
  at: number;
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

export function useDismissedFlags(reviewId: string) {
  const [dismissed, setDismissed] = useState<DismissedEntry[]>([]);

  useEffect(() => {
    const store = loadStore(reviewId);
    setDismissed(store.dismissed);

    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey(reviewId)) {
        const store = loadStore(reviewId);
        setDismissed(store.dismissed);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [reviewId]);

  const isDismissed = useCallback(
    (key: string) => dismissed.some((d) => d.key === key),
    [dismissed]
  );

  const getDismissal = useCallback(
    (key: string) => dismissed.find((d) => d.key === key),
    [dismissed]
  );

  const dismiss = useCallback(
    (key: string, reason: DismissReason, note?: string) => {
      setDismissed((prev) => {
        if (prev.some((d) => d.key === key)) return prev;
        const next = [...prev, { key, reason, note, at: Date.now() }];
        saveStore({ version: 1, reviewId, dismissed: next });
        return next;
      });
    },
    [reviewId]
  );

  const restore = useCallback(
    (key: string) => {
      setDismissed((prev) => {
        const next = prev.filter((d) => d.key !== key);
        saveStore({ version: 1, reviewId, dismissed: next });
        return next;
      });
    },
    [reviewId]
  );

  const dismissedCount = dismissed.length;

  return { isDismissed, getDismissal, dismiss, restore, dismissedCount };
}
