"use client";

import { Check } from "lucide-react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import type { NormalizedOption } from "./glide-select-utils";

type GlideSelectMenuProps = {
  id: string;
  items: NormalizedOption[];
  active: number | null;
  selected: number;
  showTags: boolean;
  side: "top" | "bottom";
  align: "left" | "right";
  ariaLabel: string;
  menuRef: RefObject<HTMLDivElement | null>;
  pillRef: RefObject<HTMLSpanElement | null>;
  onPointerOver: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerLeave: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onLostPointerCapture: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

export function GlideSelectMenu({
  id,
  items,
  active,
  selected,
  showTags,
  side,
  align,
  ariaLabel,
  menuRef,
  pillRef,
  onPointerOver,
  onPointerLeave,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
}: GlideSelectMenuProps) {
  return (
    <div
      ref={menuRef}
      className="glide-select__menu"
      data-state="open"
      data-side={side}
      data-align={align}
    >
      <div
        id={`${id}-list`}
        role="listbox"
        aria-label={ariaLabel}
        className="glide-select__list"
        data-live={active !== null ? "" : undefined}
        onPointerOver={onPointerOver}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onLostPointerCapture}
      >
        <span ref={pillRef} className="glide-select__pill" aria-hidden="true" />
        {items.map((it, i) => (
          <div
            key={it.value}
            id={`${id}-${i}`}
            role="option"
            aria-selected={i === selected}
            data-index={i}
            className="glide-select__option"
          >
            <span className="glide-select__name">{it.label}</span>
            {showTags && it.tag ? <span className="glide-select__tag">{it.tag}</span> : null}
            <span
              className="glide-select__check"
              data-on={i === selected ? "" : undefined}
              aria-hidden="true"
            >
              <Check size={13} strokeWidth={2.5} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
