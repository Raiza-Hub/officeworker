"use client";

import { SlideCommitSurface } from "./slide-commit-parts";
import { useSlideCommitSession } from "./slide-commit-session";
import type { SlideCommitProps } from "./slide-commit-utils";

export default function SlideCommit({
  label = "Slide to pay",
  doneLabel = "Paid",
  errorLabel = "Payment failed",
  onConfirm,
  onDone,
  onError,
  trackColor = "#626bd9",
  handleColor = "#f5f5f5",
  successColor = "#22c55e",
  dangerColor = "#e5484d",
  width = 280,
  height = 56,
  radius = 28,
  speed = 50,
  returnBounce = 0.38,
  landingDip = 0.026,
  holdMs = 1500,
  disabled = false,
  icon,
  className = "",
}: SlideCommitProps) {
  const session = useSlideCommitSession({
    label,
    doneLabel,
    errorLabel,
    width,
    height,
    radius,
    speed,
    returnBounce,
    landingDip,
    holdMs,
    disabled,
    trackColor,
    handleColor,
    successColor,
    dangerColor,
    className,
    onConfirm,
    onDone,
    onError,
  });

  return (
    <SlideCommitSurface
      session={session}
      label={label}
      doneLabel={doneLabel}
      errorLabel={errorLabel}
      trackColor={trackColor}
      successColor={successColor}
      dangerColor={dangerColor}
      handleColor={handleColor}
      width={width}
      height={height}
      disabled={disabled}
      className={className}
      icon={icon}
    />
  );
}
