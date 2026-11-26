"use client";

import { m, type MotionValue } from "motion/react";
import { ArrowRight, Check } from "lucide-react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  RefObject,
} from "react";
import { Spinner } from "./slide-commit-spinner";
import {
  EASE_OUT,
  PAD,
  onColor,
  type SlideCommitPhase,
} from "./slide-commit-utils";

export type SlideCommitLabelProps = {
  phase: SlideCommitPhase;
  label: string;
  errorLabel: string;
  say: MotionValue<number>;
  fontSize: number;
  dangerColor: string;
};

export function SlideCommitLabel({
  phase,
  label,
  errorLabel,
  say,
  fontSize,
  dangerColor,
}: SlideCommitLabelProps) {
  return (
    <m.span
      className="pointer-events-none absolute inset-0 grid place-items-center font-medium leading-none tracking-tight whitespace-nowrap"
      style={{ opacity: say, fontSize }}
      aria-hidden="true"
    >
      <span
        className={`col-start-1 row-start-1 text-white transition-all duration-200 ${
          phase === "error" ? "opacity-0 blur-[2px]" : "opacity-100 blur-0"
        }`}
      >
        {label}
      </span>
      <span
        className={`col-start-1 row-start-1 transition-all duration-200 ${
          phase === "error" ? "opacity-100 blur-0" : "opacity-0 blur-[2px]"
        }`}
        style={{ color: dangerColor }}
      >
        {errorLabel}
      </span>
    </m.span>
  );
}

export type SlideCommitCapsuleProps = {
  capsuleRef: RefObject<HTMLDivElement | null>;
  phase: SlideCommitPhase;
  label: string;
  doneLabel: string;
  clip: MotionValue<string>;
  shape: MotionValue<string>;
  origin: MotionValue<string>;
  content: MotionValue<string>;
  spin: MotionValue<number>;
  arrow: MotionValue<number>;
  reduce: boolean | null;
  GRIP: number;
  fontSize: number;
  iconSize: number;
  handleColor: string;
  successColor: string;
  dangerColor: string;
  disabled: boolean;
  icon?: ReactNode;
  onPointerEnter: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerLeave: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
};

export function SlideCommitCapsule({
  capsuleRef,
  phase,
  label,
  doneLabel,
  clip,
  shape,
  origin,
  content,
  spin,
  arrow,
  reduce,
  GRIP,
  fontSize,
  iconSize,
  handleColor,
  successColor,
  dangerColor,
  disabled,
  icon,
  onPointerEnter,
  onPointerLeave,
  onKeyDown,
}: SlideCommitCapsuleProps) {
  const onInk = onColor(handleColor);
  const onOk = onColor(successColor);
  const onNo = onColor(dangerColor);
  const capsuleBg =
    phase === "done"
      ? successColor
      : phase === "error"
        ? dangerColor
        : handleColor;
  const capsuleFg =
    phase === "done" ? onOk : phase === "error" ? onNo : onInk;

  return (
    <m.div
      ref={capsuleRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
      aria-busy={phase === "pending" || undefined}
      aria-disabled={disabled || undefined}
      className="absolute outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-inset"
      style={{
        top: PAD,
        left: PAD,
        width: `calc(100% - ${PAD * 2}px)`,
        height: `calc(100% - ${PAD * 2}px)`,
        backgroundColor: capsuleBg,
        color: capsuleFg,
        clipPath: clip,
        transform: shape,
        transformOrigin: origin,
      }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onKeyDown={onKeyDown}
    >
      <m.div className="absolute inset-0" style={{ transform: content }}>
        <SlideCommitCapsuleContent
          phase={phase}
          doneLabel={doneLabel}
          icon={icon}
          iconSize={iconSize}
          fontSize={fontSize}
          GRIP={GRIP}
          reduce={reduce}
          spin={spin}
          arrow={arrow}
        />
      </m.div>
    </m.div>
  );
}

export type SlideCommitCapsuleContentProps = {
  phase: SlideCommitPhase;
  doneLabel: string;
  icon?: ReactNode;
  iconSize: number;
  fontSize: number;
  GRIP: number;
  reduce: boolean | null;
  spin: MotionValue<number>;
  arrow: MotionValue<number>;
};

export function SlideCommitCapsuleContent({
  phase,
  doneLabel,
  icon,
  iconSize,
  fontSize,
  GRIP,
  reduce,
  spin,
  arrow,
}: SlideCommitCapsuleContentProps) {
  const done = phase === "done";

  return (
    <>
      <m.span
        className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 transition-[filter] duration-200"
        style={{
          opacity: arrow,
          filter: phase === "pending" ? "blur(2px)" : "none",
        }}
        aria-hidden="true"
      >
        {icon ?? (
          <ArrowRight
            size={iconSize}
            strokeWidth={2}
            className="block"
          />
        )}
      </m.span>

      <m.span
        className="pointer-events-none absolute inset-0 flex items-center justify-center transition-[filter] duration-200"
        style={{
          opacity: spin,
          filter: phase !== "pending" ? "blur(2px)" : "none",
        }}
        aria-hidden="true"
      >
        <Spinner size={iconSize} />
      </m.span>

      <m.span
        className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-sm font-semibold leading-none tracking-tight whitespace-nowrap"
        aria-hidden="true"
        initial={false}
        animate={{ opacity: done ? 1 : 0, scale: done || reduce ? 1 : 0.95 }}
        transition={{ duration: 0.2, ease: EASE_OUT }}
        style={{ fontSize }}
      >
        <Check
          size={Math.round(GRIP * 0.38)}
          strokeWidth={2.5}
          className="block"
        />
        {doneLabel}
      </m.span>
    </>
  );
}
