"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate,
  m,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { ArrowRight, Check } from "lucide-react";

const PAD = 4;
const SQUASH_MAX = 0.08;
const SQUASH_DIV = 110;
const SWELL = 1.03;
const MIN_PENDING = 300;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const SHAKE = [0, -5, 5, -3, 3, -1, 0];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const onColor = (hex: string) => {
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

const velocityOf = (hist: [number, number][]) => {
  if (hist.length < 2) return 0;
  const [t0, x0] = hist[0];
  const [t1, x1] = hist[hist.length - 1];
  return ((x1 - x0) / Math.max(1, t1 - t0)) * 1000;
};

const finePointer = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

function Spinner({ size }: { size: number }) {
  return (
    <svg
      className="motion-safe:animate-[slide-commit-spin_1s_linear_infinite] motion-reduce:animate-[slide-commit-breathe_1.4s_ease-in-out_infinite]"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeOpacity="0.25"
      />
      <path
        d="M12 3a9 9 0 0 1 9 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

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
}: {
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
  icon?: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<"idle" | "pending" | "done" | "error">(
    "idle",
  );
  const [held, setHeld] = useState(false);
  const [hot, setHot] = useState(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const capsuleRef = useRef<HTMLDivElement>(null);
  const grip = useRef<{
    id: number;
    grab: number | null;
    moved: boolean;
    hist: [number, number][];
  } | null>(null);
  const timer = useRef(0);
  const homeTimer = useRef(0);
  const run = useRef(0);
  const unwatch = useRef<(() => void) | null>(null);
  const live = useRef({
    move: (_e: PointerEvent) => {
      void _e;
    },
    up: (_e: PointerEvent) => {
      void _e;
    },
  });
  const lastPercent = useRef(0);

  const GRIP = height - PAD * 2;
  const INNER = width - PAD * 2;
  const TRAVEL = Math.max(1, INNER - GRIP);
  const r = clamp(radius, 0, height / 2);
  const gripR = Math.max(0, r - PAD);
  const k = 260 + (clamp(speed, 0, 100) / 100) * 640;
  const mass = 0.9;
  const critical = 2 * Math.sqrt(k * mass);
  const commitSpring = { type: "spring" as const, stiffness: k, damping: critical, mass };
  const homeSpring = {
    ...commitSpring,
    damping: critical * (1 - clamp(returnBounce, 0, 0.5)),
  };

  const x = useMotionValue(0);
  const anchor = useMotionValue(0);
  const shown = useMotionValue(1);
  const spin = useMotionValue(0);
  const pulse = useMotionValue(1);
  const shake = useMotionValue(0);
  const seen = useTransform(x, (v) => clamp(v, 0, TRAVEL));
  const edge = useTransform([seen, anchor], (values) => {
    const [v, a] = values as number[];
    return v + GRIP + clamp(a - v, 0, TRAVEL);
  });
  const clip = useTransform(
    edge,
    (R) => `inset(0 ${INNER - R}px 0 0 round ${gripR}px)`,
  );
  const content = useTransform([seen, edge], (values) => {
    const [v, R] = values as number[];
    return `translateX(${(v + R) / 2 - INNER / 2}px)`;
  });
  const swell = hot && !held && phase === "idle" && !reduce ? SWELL : 1;
  const shape = useTransform(x, (v) => {
    const q = 1 - Math.min(SQUASH_MAX, Math.max(0, -v) / SQUASH_DIV);
    return `scale(${q * swell}, ${swell / q})`;
  });
  const origin = useTransform(seen, (v) => `${v}px 50%`);
  const say = useTransform(seen, [0, TRAVEL * 0.55], [1, 0]);
  const arrow = useTransform([seen, shown], (values) => {
    const [v, on] = values as number[];
    return on * clamp(1 - (v - TRAVEL * 0.55) / (TRAVEL * 0.4), 0, 1);
  });
  const trackTransform = useTransform([shake, pulse], (values) => {
    const [s, p] = values as number[];
    return `translateX(${s}px) scale(${p})`;
  });

  useMotionValueEvent(seen, "change", (v) => {
    const percent = Math.round((v / TRAVEL) * 100);
    if (percent === lastPercent.current || !capsuleRef.current) return;
    lastPercent.current = percent;
    capsuleRef.current.setAttribute("aria-valuenow", String(percent));
    capsuleRef.current.setAttribute(
      "aria-valuetext",
      `${label}, ${percent}%`,
    );
  });

  useEffect(() => {
    return () => {
      clearTimeout(timer.current);
      clearTimeout(homeTimer.current);
      unwatch.current?.();
      run.current += 1;
    };
  }, []);

  const local = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return (clientX - rect.left) / (rect.width / width || 1);
  };

  const goHome = (velocity: number) => {
    if (reduce) animate(x, 0, { duration: 0.2, ease: EASE_OUT });
    else animate(x, 0, { ...homeSpring, velocity: Math.min(0, velocity) });
  };

  const settle = () => {
    setPhase("idle");
    animate(shown, 1, { duration: 0.2, delay: 0.12 });
    if (reduce) anchor.set(0);
    else animate(anchor, 0, { type: "spring", duration: 0.3, bounce: 0 });
  };

  const resolve = (viaKey: boolean) => {
    setPhase("done");
    anchor.set(x.get());
    animate(spin, 0, { duration: 0.12 });
    if (reduce) x.set(0);
    else {
      animate(x, 0, commitSpring);
      if (!viaKey && landingDip > 0) {
        animate(pulse, [1, 1 - landingDip, 1], {
          duration: 0.46,
          times: [0, 0.62, 1],
          ease: EASE_OUT,
          delay: 0.1,
        });
      }
    }
    onDone?.();
    if (holdMs > 0) timer.current = window.setTimeout(settle, holdMs);
  };

  const reject = (reason: unknown) => {
    setPhase("error");
    onError?.(reason);
    animate(spin, 0, { duration: 0.12 });
    animate(shown, 1, { duration: 0.2, delay: 0.12 });
    if (reduce) goHome(0);
    else {
      animate(shake, SHAKE, { duration: 0.45, ease: EASE_OUT });
      homeTimer.current = window.setTimeout(() => {
        if (!grip.current) goHome(0);
      }, 300);
    }
    timer.current = window.setTimeout(
      () => setPhase("idle"),
      Math.max(holdMs, 1500),
    );
  };

  const commit = (viaKey: boolean) => {
    clearTimeout(timer.current);
    clearTimeout(homeTimer.current);
    setPhase("pending");
    x.set(TRAVEL);
    let out: void | Promise<unknown>;
    try {
      out = onConfirm?.();
    } catch (reason) {
      reject(reason);
      return;
    }
    const pending =
      out && typeof (out as Promise<unknown>).then === "function"
        ? (out as Promise<unknown>)
        : null;
    if (!pending) {
      animate(shown, 0, { duration: 0.12 });
      resolve(viaKey);
      return;
    }
    setPhase("pending");
    animate(shown, 0, { duration: 0.2 });
    animate(spin, 1, { duration: 0.2 });
    const id = run.current;
    const t0 = performance.now();
    const later = (fn: () => void) => {
      window.setTimeout(
        () => {
          if (id === run.current) fn();
        },
        Math.max(0, MIN_PENDING - (performance.now() - t0)),
      );
    };
    pending.then(
      () => later(() => resolve(viaKey)),
      (reason) => later(() => reject(reason)),
    );
  };

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (
      disabled ||
      grip.current ||
      phase === "pending" ||
      phase === "done" ||
      e.button !== 0
    )
      return;
    x.stop();
    grip.current = { id: e.pointerId, grab: null, moved: false, hist: [] };
    setHeld(true);
    try {
      trackRef.current?.setPointerCapture(e.pointerId);
    } catch {}
    unwatch.current?.();
    const onMove = (ev: PointerEvent) => ev.isTrusted && live.current.move(ev);
    const onUp = (ev: PointerEvent) => ev.isTrusted && live.current.up(ev);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    unwatch.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      unwatch.current = null;
    };
  };

  const move = (e: PointerEvent) => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    const at = local(e.clientX);
    if (g.grab === null) {
      g.grab = at - x.get();
      return;
    }
    const next = clamp(at - g.grab, 0, TRAVEL);
    if (Math.abs(next - x.get()) > 0.5) g.moved = true;
    g.hist.push([e.timeStamp, next]);
    if (g.hist.length > 4) g.hist.shift();
    x.set(next);
  };

  const up = (e: PointerEvent) => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    grip.current = null;
    unwatch.current?.();
    try {
      trackRef.current?.releasePointerCapture(e.pointerId);
    } catch {}
    setHeld(false);
    if (x.get() >= TRAVEL) commit(false);
    else if (g.moved) goHome(velocityOf(g.hist));
  };
  useEffect(() => {
    live.current = { move, up };
  });

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || phase === "pending" || phase === "done") return;
    const step = TRAVEL / 10;
    if (e.key === "End") {
      e.preventDefault();
      commit(true);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(TRAVEL, x.get() + step);
      x.set(next);
      if (next >= TRAVEL) commit(true);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      x.set(Math.max(0, x.get() - step));
    } else if (e.key === "Home" || e.key === "Escape") {
      e.preventDefault();
      if (grip.current) up({ pointerId: grip.current.id } as PointerEvent);
      else x.set(0);
    }
  };

  const fontSize = clamp(Math.round(height * 0.25), 13, 17);
  const iconSize = Math.round(GRIP * 0.42);
  const done = phase === "done";
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
        onPointerDown={down}
      >
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
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse" && finePointer()) setHot(true);
          }}
          onPointerLeave={() => setHot(false)}
          onKeyDown={onKeyDown}
        >
          <m.div
            className="absolute inset-0"
            style={{ transform: content }}
          >
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
          </m.div>
        </m.div>

        <span className="sr-only" aria-live="polite">
          {phase === "pending"
            ? "Working"
            : phase === "done"
              ? doneLabel
              : phase === "error"
                ? errorLabel
                : ""}
        </span>
      </m.div>
    </div>
  );
}
