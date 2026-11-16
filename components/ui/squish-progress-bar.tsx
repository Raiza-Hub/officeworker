"use client";

import { useEffect } from "react";
import {
  animate,
  m,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
} from "motion/react";

const FLOW_SPRING = { stiffness: 320, damping: 40, mass: 0.6 };
const MAX_STRETCH = 0.4;
const STRETCH_SPEED = 600;

export function SquishProgressBar({
  progress,
  ariaLabel,
  stretch = 36,
}: {
  progress: number;
  ariaLabel: string;
  stretch?: number;
}) {
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, progress));
  const w = useMotionValue(clamped);

  useEffect(() => {
    const target = Math.max(0, Math.min(100, progress));
    if (reduce) {
      w.jump(target);
      return undefined;
    }
    const controls = animate(w, target, {
      type: "spring",
      stiffness: 170,
      damping: 21.5,
      mass: 0.9,
      restDelta: 0.001,
      restSpeed: 0.01,
    });
    return () => controls.stop();
  }, [progress, reduce, w]);

  const flow = useSpring(useVelocity(w), FLOW_SPRING);
  const gain = reduce ? 0 : Math.min(100, Math.max(0, stretch)) / 100;
  const stretchOf = (v: number) =>
    1 + Math.min(MAX_STRETCH, Math.abs(v) / STRETCH_SPEED) * gain;
  const scaleX = useTransform(flow, (v) => stretchOf(v));
  const scaleY = useTransform(flow, (v) => 1 / stretchOf(v));
  const width = useMotionTemplate`${w}%`;

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-border-muted"
    >
      <m.div
        className="h-full rounded-full bg-primary"
        style={{ width, scaleX, scaleY, transformOrigin: "left center" }}
      />
    </div>
  );
}
