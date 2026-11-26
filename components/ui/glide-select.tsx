"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { ChevronDown } from "lucide-react";
import "./glide-select.css";
import { GlideSelectMenu } from "./glide-select-menu";
import {
  norm,
  typeaheadIndex,
  SIZES,
  PAD,
  GAP,
  MENU_GAP,
  DEFAULT_OPTIONS,
} from "./glide-select-utils";
import type { GlideSelectProps } from "./glide-select-utils";

export type { GlideSelectOption, GlideSelectProps } from "./glide-select-utils";

export default function GlideSelect({
  options = DEFAULT_OPTIONS,
  value,
  defaultValue,
  onChange,
  placeholder = "Select…",
  showTags = true,
  accentColor = "#f5f5f5",
  surfaceColor = "#27272a",
  highlightColor = "#3f3f46",
  textColor = "#f5f5f5",
  size = "md",
  radius = 10,
  menuWidth = 176,
  placement = "bottom",
  align = "left",
  popDuration = 180,
  glideDuration = 220,
  rememberPosition = true,
  disabled = false,
  ariaLabel = "Select",
  className = "",
}: GlideSelectProps) {
  const items = options.map(norm);
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = value ?? inner;
  const selected = items.findIndex((it) => it.value === current);
  const [phase, setPhase] = useState<"closed" | "open" | "closing">("closed");
  const [active, setActive] = useState<number | null>(null);
  const [side, setSide] = useState(placement);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const instant = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scrub = useRef<{ id: number; top: number } | null>(null);
  const id = useId();
  const S = SIZES[size] ?? SIZES.md;
  const step = S.row + GAP;
  const popOut = Math.round((popDuration * 2) / 3);

  useLayoutEffect(() => {
    if (phase !== "open") return;
    const el = menuRef.current;
    const root = rootRef.current;
    if (!el || !root) return;
    const r = root.getBoundingClientRect();
    const need = el.offsetHeight + MENU_GAP;
    setSide(
      placement === "bottom" && r.bottom + need > window.innerHeight
        ? "top"
        : placement === "top" && r.top - need < 0
          ? "bottom"
          : placement,
    );
    el.style.transitionDuration = instant.current ? "0ms" : "";
    el.dataset.state = "closed";
    void el.offsetHeight;
    el.dataset.state = "open";
    const p = pillRef.current;
    if (p) {
      p.style.transition = "none";
      p.style.transform = `translateY(${Math.max(0, selected) * step}px)`;
      p.style.opacity = "0";
      void p.offsetHeight;
      p.style.transition = "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useLayoutEffect(() => {
    const p = pillRef.current;
    if (!p || phase !== "open") return;
    if (active === null) {
      p.style.opacity = "0";
      return;
    }
    const jump = instant.current || p.style.opacity !== "1";
    p.style.transitionDuration = jump ? "0ms, 150ms" : "";
    p.style.transform = `translateY(${active * step}px)`;
    p.style.opacity = "1";
    instant.current = false;
  }, [active, phase, step]);

  const open = (viaKey: boolean) => {
    if (disabled) return;
    clearTimeout(closeTimer.current);
    instant.current = true;
    setActive(selected >= 0 ? selected : viaKey ? 0 : null);
    setPhase("open");
  };
  const close = (mode: "pop" | "instant") => {
    setActive(null);
    clearTimeout(closeTimer.current);
    const el = menuRef.current;
    if (mode === "instant" || !el) {
      setPhase("closed");
      return;
    }
    el.style.transitionDuration = "";
    el.dataset.state = "closed";
    setPhase("closing");
    closeTimer.current = setTimeout(() => setPhase("closed"), popOut + 20);
  };
  const pick = (i: number, viaKey: boolean) => {
    const it = items[i];
    if (!it) {
      close("instant");
      return;
    }
    if (it.value !== current) {
      if (value === undefined) setInner(it.value);
      onChange?.(it.value, it);
      if (!viaKey && rootRef.current) rootRef.current.dataset.swap = "";
    }
    close("instant");
    triggerRef.current?.focus({ preventScroll: true });
  };

  const onTriggerKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    const k = e.key;
    const n = items.length;
    const cur = active ?? Math.max(0, selected);
    if (phase !== "open") {
      if (k === "Enter" || k === " " || k === "ArrowDown" || k === "ArrowUp") {
        e.preventDefault();
        open(true);
      }
      return;
    }
    const go = (i: number) => {
      e.preventDefault();
      instant.current = true;
      setActive(Math.min(n - 1, Math.max(0, i)));
    };
    if (k === "ArrowDown" || k === "ArrowUp")
      go(active === null ? cur : cur + (k === "ArrowDown" ? 1 : -1));
    else if (k === "Home" || k === "End") go(k === "Home" ? 0 : n - 1);
    else if (k === "Enter" || k === " ") {
      e.preventDefault();
      pick(cur, true);
    } else if (k === "Escape" || k === "Tab") {
      if (k === "Escape") e.preventDefault();
      close("instant");
    } else if (k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey)
      go(typeaheadIndex(items, cur, k));
  };

  useEffect(() => {
    if (phase === "closed") return undefined;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        close("pop");
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const rowAt = (y: number) => {
    const s = scrub.current;
    if (!s) return null;
    const i = Math.floor((y - s.top - PAD) / step);
    return i >= 0 && i < items.length ? i : null;
  };
  const onListDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (scrub.current) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    scrub.current = { id: e.pointerId, top: e.currentTarget.getBoundingClientRect().top };
    instant.current = true;
    setActive(rowAt(e.clientY));
  };
  const onListMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!scrub.current || scrub.current.id !== e.pointerId) return;
    const i = rowAt(e.clientY);
    if (i !== active) setActive(i);
  };
  const onListUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!scrub.current || scrub.current.id !== e.pointerId) return;
    const i = e.type === "pointerup" ? rowAt(e.clientY) : null;
    scrub.current = null;
    if (i !== null) pick(i, false);
    else if (!rememberPosition) setActive(null);
  };
  const onListOver = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch" || scrub.current) return;
    const row = (e.target as HTMLElement).closest("[data-index]") as HTMLElement | null;
    if (!row) return;
    const i = Number(row.dataset.index);
    if (i !== active) setActive(i);
  };

  const origin = `${side === "bottom" ? "top" : "bottom"} ${align}`;
  return (
    <div
      ref={rootRef}
      className={`glide-select${className ? ` ${className}` : ""}`}
      data-size={size}
      data-disabled={disabled ? "" : undefined}
      style={{
        "--gs-accent": accentColor,
        "--gs-surface": surfaceColor,
        "--gs-highlight": highlightColor,
        "--gs-text": textColor,
        "--gs-radius": `${radius}px`,
        "--gs-inner-radius": `${Math.max(3, radius - 4)}px`,
        "--gs-chip": `${S.chip}px`,
        "--gs-row": `${S.row}px`,
        "--gs-font": `${S.font}px`,
        "--gs-menu-w": `${menuWidth}px`,
        "--gs-pop": `${popDuration}ms`,
        "--gs-pop-out": `${popOut}ms`,
        "--gs-glide": `${glideDuration}ms`,
        "--gs-origin": origin,
      } as CSSProperties}
      onAnimationEnd={(e) => {
        if (e.animationName === "gs-swap" && rootRef.current)
          delete rootRef.current.dataset.swap;
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={phase === "open"}
        aria-controls={`${id}-list`}
        aria-activedescendant={active !== null ? `${id}-${active}` : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        className="glide-select__trigger"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.focus({ preventScroll: true });
          if (phase === "open") close("pop");
          else open(false);
        }}
        onKeyDown={onTriggerKey}
      >
        <span className="glide-select__label" key={current} data-empty={selected < 0 ? "" : undefined}>
          {selected >= 0 ? items[selected].label : placeholder}
        </span>
        <span className="glide-select__chevron" aria-hidden="true">
          <ChevronDown size={12} strokeWidth={2.5} />
        </span>
      </button>
      {phase !== "closed" ? (
        <GlideSelectMenu
          id={id}
          items={items}
          active={active}
          selected={selected}
          showTags={showTags}
          side={side}
          align={align}
          ariaLabel={ariaLabel}
          menuRef={menuRef}
          pillRef={pillRef}
          onPointerOver={onListOver}
          onPointerLeave={() => {
            if (!scrub.current && !rememberPosition) setActive(null);
          }}
          onPointerDown={onListDown}
          onPointerMove={onListMove}
          onPointerUp={onListUp}
          onPointerCancel={onListUp}
          onLostPointerCapture={onListUp}
        />
      ) : null}
    </div>
  );
}
