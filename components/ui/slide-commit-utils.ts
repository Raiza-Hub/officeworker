import type { ReactNode } from "react";

export const PAD = 4;
export const SQUASH_MAX = 0.08;
export const SQUASH_DIV = 110;
export const SWELL = 1.03;
export const MIN_PENDING = 300;
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const SHAKE = [0, -5, 5, -3, 3, -1, 0];

export type SlideCommitPhase = "idle" | "pending" | "done" | "error";

export type SlideCommitProps = {
  label?: string;
  doneLabel?: string;
  errorLabel?: string;
  onConfirm?: () => void | Promise<unknown>;
  onDone?: () => void;
  onError?: (reason: unknown) => void;
  trackColor?: string;
  handleColor?: string;
  successColor?: string;
  dangerColor?: string;
  width?: number;
  height?: number;
  radius?: number;
  speed?: number;
  returnBounce?: number;
  landingDip?: number;
  holdMs?: number;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
};

export type SlideCommitResolvedProps = SlideCommitProps & {
  label: string;
  doneLabel: string;
  errorLabel: string;
  trackColor: string;
  handleColor: string;
  successColor: string;
  dangerColor: string;
  width: number;
  height: number;
  radius: number;
  speed: number;
  returnBounce: number;
  landingDip: number;
  holdMs: number;
  disabled: boolean;
  className: string;
};

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const onColor = (hex: string) => {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? [...raw].map((ch) => ch + ch).join("")
      : raw.slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return "#ffffff";
  const yiq =
    (((n >> 16) & 255) * 299 +
      ((n >> 8) & 255) * 587 +
      (n & 255) * 114) /
    1000;
  return yiq >= 128 ? "#111111" : "#ffffff";
};

export const velocityOf = (hist: [number, number][]) => {
  if (hist.length < 2) return 0;
  const [t0, x0] = hist[0];
  const [t1, x1] = hist[hist.length - 1];
  return ((x1 - x0) / Math.max(1, t1 - t0)) * 1000;
};

export const finePointer = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
