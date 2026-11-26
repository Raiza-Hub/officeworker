import { useEffect, useRef, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import {
  animate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import {
  EASE_OUT,
  MIN_PENDING,
  PAD,
  SHAKE,
  SQUASH_DIV,
  SQUASH_MAX,
  SWELL,
  clamp,
  finePointer,
  velocityOf,
  type SlideCommitPhase,
  type SlideCommitResolvedProps,
} from "./slide-commit-utils";

export type SlideCommitSession = {
  trackRef: RefObject<HTMLDivElement | null>;
  capsuleRef: RefObject<HTMLDivElement | null>;
  phase: SlideCommitPhase;
  held: boolean;
  reduce: boolean | null;
  trackTransform: MotionValue<string>;
  say: MotionValue<number>;
  clip: MotionValue<string>;
  shape: MotionValue<string>;
  origin: MotionValue<string>;
  content: MotionValue<string>;
  shown: MotionValue<number>;
  spin: MotionValue<number>;
  arrow: MotionValue<number>;
  GRIP: number;
  TRAVEL: number;
  r: number;
  fontSize: number;
  iconSize: number;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCapsulePointerEnter: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCapsulePointerLeave: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
};

export function useSlideCommitSession({
  label,
  width,
  height,
  radius,
  speed,
  returnBounce,
  landingDip,
  holdMs,
  disabled,
  onConfirm,
  onDone,
  onError,
}: SlideCommitResolvedProps): SlideCommitSession {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<SlideCommitPhase>("idle");
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

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
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

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
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

  return {
    trackRef,
    capsuleRef,
    phase,
    held,
    reduce,
    trackTransform,
    say,
    clip,
    shape,
    origin,
    content,
    shown,
    spin,
    arrow,
    GRIP,
    TRAVEL,
    r,
    fontSize,
    iconSize,
    onPointerDown: down,
    onCapsulePointerEnter: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse" && finePointer()) setHot(true);
    },
    onCapsulePointerLeave: () => setHot(false),
    onKeyDown,
  };
}
