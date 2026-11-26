import type { ReactNode } from "react";

export type NormalizedOption = { value: string; label: ReactNode; tag?: string };
export type GlideSelectOption = string | NormalizedOption;

export const SIZES = {
  sm: { chip: 28, row: 26, font: 12 },
  md: { chip: 32, row: 30, font: 13 },
  lg: { chip: 44, row: 40, font: 14 },
} as const;

export const PAD = 4;
export const GAP = 1;
export const MENU_GAP = 6;
export const DEFAULT_OPTIONS = ["One", "Two", "Three"];

export type GlideSelectProps = {
  options?: GlideSelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string, option: NormalizedOption) => void;
  placeholder?: string;
  showTags?: boolean;
  accentColor?: string;
  surfaceColor?: string;
  highlightColor?: string;
  textColor?: string;
  size?: "sm" | "md" | "lg";
  radius?: number;
  menuWidth?: number;
  placement?: "top" | "bottom";
  align?: "left" | "right";
  popDuration?: number;
  glideDuration?: number;
  rememberPosition?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
};

export const norm = (o: GlideSelectOption): NormalizedOption =>
  typeof o === "string" ? { value: o, label: o } : o;

export const textOf = (it: NormalizedOption) =>
  typeof it.label === "string" ? it.label : it.value;

export const typeaheadIndex = (
  items: NormalizedOption[],
  from: number,
  ch: string,
) => {
  const c = ch.toLowerCase();
  const n = items.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (textOf(items[i]).toLowerCase().startsWith(c)) return i;
  }
  return from;
};
