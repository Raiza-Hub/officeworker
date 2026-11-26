"use client";

import type { SlideCommitPhase } from "./slide-commit-utils";

export type SlideCommitStatusProps = {
  phase: SlideCommitPhase;
  doneLabel: string;
  errorLabel: string;
};

export function SlideCommitStatus({ phase, doneLabel, errorLabel }: SlideCommitStatusProps) {
  return (
    <span className="sr-only" aria-live="polite">
      {phase === "pending"
        ? "Working"
        : phase === "done"
          ? doneLabel
          : phase === "error"
            ? errorLabel
            : ""}
    </span>
  );
}
