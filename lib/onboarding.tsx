"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const ONBOARDING_KEY = "script-shield:onboarding";

interface Step {
  target: string; // CSS selector or data attribute
  title: string;
  body: string;
  position?: "top" | "bottom" | "left" | "right";
}

const HOMEPAGE_STEPS: Step[] = [
  {
    target: "[data-tour='script-input']",
    title: "1. Paste Your Script",
    body: "Paste a true crime script or enter a Google Docs URL. The analyzer works with any documentary format.",
  },
  {
    target: "[data-tour='metadata']",
    title: "2. Set Case Details",
    body: "Select the state jurisdiction, case status, and content flags. These affect which laws and policies are checked.",
  },
  {
    target: "[data-tour='analyze-btn']",
    title: "3. Run Analysis",
    body: "Click to start the 5-stage pipeline: parsing, legal review, YouTube policy check, case research, and synthesis.",
  },
];

const RESULTS_STEPS: Step[] = [
  {
    target: "[data-tour='verdict-banner']",
    title: "Verdict & Risk Score",
    body: "The overall verdict (publishable / borderline / not publishable) and risk score. Based on combined legal and policy analysis.",
  },
  {
    target: "[data-tour='tabs']",
    title: "Tab Navigation",
    body: "Switch between Overview, Legal Flags, YouTube Policy, Video Analysis, Script, and Research tabs. Use keyboard shortcuts j/k to navigate items.",
  },
  {
    target: "[data-tour='dismiss-flags']",
    title: "Dismiss Flags",
    body: "Dismiss flags you've addressed with a reason. Dismissed flags persist across sessions and can be restored anytime.",
    position: "bottom",
  },
];

function getOnboardingState(): { homepage: boolean; results: boolean } {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { homepage: false, results: false };
}

function markComplete(page: "homepage" | "results") {
  const state = getOnboardingState();
  state[page] = true;
  try {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state));
  } catch {}
}

export function useOnboarding(page: "homepage" | "results") {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);

  const steps = page === "homepage" ? HOMEPAGE_STEPS : RESULTS_STEPS;

  useEffect(() => {
    const state = getOnboardingState();
    if (!state[page]) {
      // Delay to let the page render targets
      const t = setTimeout(() => setActive(true), 800);
      return () => clearTimeout(t);
    }
  }, [page]);

  const next = useCallback(() => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      markComplete(page);
      setActive(false);
      setStep(0);
    }
  }, [step, steps.length, page]);

  const skip = useCallback(() => {
    markComplete(page);
    setActive(false);
    setStep(0);
  }, [page]);

  const restart = useCallback(() => {
    setStep(0);
    setActive(true);
  }, []);

  return { active, step, steps, currentStep: steps[step], next, skip, restart };
}

export function OnboardingOverlay({
  active,
  currentStep,
  step,
  total,
  onNext,
  onSkip,
}: {
  active: boolean;
  currentStep: Step | undefined;
  step: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!active || !currentStep) return;
    const el = document.querySelector(currentStep.target);
    if (!el) {
      // Target not found, auto-advance
      onNext();
      return;
    }
    const rect = el.getBoundingClientRect();
    // Position below target by default
    setPos({
      top: rect.bottom + window.scrollY + 12,
      left: Math.max(16, rect.left + window.scrollX),
    });
    // Highlight target
    el.classList.add("ring-2", "ring-[var(--accent)]", "ring-offset-2", "ring-offset-[var(--bg)]", "relative", "z-[60]");
    return () => {
      el.classList.remove("ring-2", "ring-[var(--accent)]", "ring-offset-2", "ring-offset-[var(--bg)]", "relative", "z-[60]");
    };
  }, [active, currentStep, step, onNext]);

  if (!active || !currentStep || !pos) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onSkip}
      />
      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute z-[70] border border-[var(--accent)] bg-[var(--bg-surface)] p-4 max-w-sm"
        style={{ top: pos.top, left: pos.left }}
      >
        <p className="text-xs uppercase tracking-wider text-[var(--accent)] mb-1">
          {currentStep.title}
        </p>
        <p className="text-sm text-[var(--text)] mb-3">
          {currentStep.body}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">
            {step + 1} / {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onSkip}
              className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] hover:text-[var(--text)] px-2 py-1"
            >
              Skip
            </button>
            <button
              onClick={onNext}
              className="text-[10px] uppercase tracking-wider border border-[var(--accent)] text-[var(--accent)] px-3 py-1 hover:bg-[var(--accent)] hover:text-[var(--bg)]"
            >
              {step === total - 1 ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
