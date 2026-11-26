"use client";

import { m } from "motion/react";
import type { SlideCommitSession } from "./slide-commit-session";
import { SlideCommitCapsule } from "./slide-commit-capsule";
import { SlideCommitLabel } from "./slide-commit-capsule";
import { SlideCommitStatus } from "./slide-commit-status";
import type { SlideCommitProps } from "./slide-commit-utils";

type SlideCommitSurfaceProps = SlideCommitProps & {
  session: SlideCommitSession;
  label: string;
  doneLabel: string;
  errorLabel: string;
  trackColor: string;
  successColor: string;
  dangerColor: string;
  handleColor: string;
  width: number;
  height: number;
  disabled: boolean;
  className: string;
};

export function SlideCommitSurface({
  session,
  label,
  doneLabel,
  errorLabel,
  trackColor,
  successColor,
  dangerColor,
  handleColor,
  width,
  height,
  disabled,
  className,
  icon,
}: SlideCommitSurfaceProps) {
  const {
    trackRef,
    phase,
    held,
    trackTransform,
    say,
    clip,
    shape,
    origin,
    content,
    spin,
    arrow,
    reduce,
    GRIP,
    r,
    fontSize,
    iconSize,
    capsuleRef,
    onPointerDown,
    onCapsulePointerEnter,
    onCapsulePointerLeave,
    onKeyDown,
  } = session;
  const trackCursor =
    phase === "pending" || phase === "done"
      ? "cursor-default"
      : held
        ? "cursor-grabbing"
        : "cursor-grab";

  return (
    <div
      className={`relative inline-block align-middle ${disabled ? "pointer-events-none opacity-55" : ""} ${className}`}
      style={{ width, height, fontFamily: "inherit" }}
    >
      <m.div
        ref={trackRef}
        className={`relative h-full w-full touch-none select-none ${trackCursor}`}
        style={{
          borderRadius: r,
          backgroundColor: trackColor,
          transform: trackTransform,
          WebkitTapHighlightColor: "transparent",
          WebkitTouchCallout: "none",
        }}
        onPointerDown={onPointerDown}
      >
        <SlideCommitLabel
          phase={phase}
          label={label}
          errorLabel={errorLabel}
          say={say}
          fontSize={fontSize}
          dangerColor={dangerColor}
        />

        <SlideCommitCapsule
          capsuleRef={capsuleRef}
          phase={phase}
          label={label}
          doneLabel={doneLabel}
          clip={clip}
          shape={shape}
          origin={origin}
          content={content}
          spin={spin}
          arrow={arrow}
          reduce={reduce}
          GRIP={GRIP}
          fontSize={fontSize}
          iconSize={iconSize}
          handleColor={handleColor}
          successColor={successColor}
          dangerColor={dangerColor}
          disabled={disabled}
          icon={icon}
          onPointerEnter={onCapsulePointerEnter}
          onPointerLeave={onCapsulePointerLeave}
          onKeyDown={onKeyDown}
        />

        <SlideCommitStatus phase={phase} doneLabel={doneLabel} errorLabel={errorLabel} />
      </m.div>
    </div>
  );
}
