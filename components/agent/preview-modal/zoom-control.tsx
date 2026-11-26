"use client";

import { CircleMinus, CirclePlusIcon, Maximize } from "lucide-react";

export function ZoomControl({
  zoom,
  canZoomIn = true,
  canZoomOut = true,
  onZoomIn,
  onZoomOut,
  onFit,
  fitLabel = "Fit",
}: {
  zoom: number;
  canZoomIn?: boolean;
  canZoomOut?: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit?: () => void;
  fitLabel?: string;
}) {
  return (
    <div className="mr-1 flex items-center gap-0.5 border-r border-[#eeeeef] pr-2">
      <button
        type="button"
        aria-label="Zoom out"
        title="Zoom out"
        disabled={!canZoomOut}
        onClick={onZoomOut}
        className="inline-flex size-7 items-center justify-center rounded-full text-text-dim-soft transition-colors hover:bg-[#f1f3f4] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <CircleMinus aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
      <span className="min-w-[2.5rem] text-center text-xs tabular-nums text-text-dim-soft">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        aria-label="Zoom in"
        title="Zoom in"
        disabled={!canZoomIn}
        onClick={onZoomIn}
        className="inline-flex size-7 items-center justify-center rounded-full text-text-dim-soft transition-colors hover:bg-[#f1f3f4] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <CirclePlusIcon aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
      {onFit ? (
        <button
          type="button"
          aria-label={fitLabel}
          title={fitLabel}
          onClick={onFit}
          className="inline-flex size-7 items-center justify-center rounded-full text-text-dim-soft transition-colors hover:bg-[#f1f3f4] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Maximize aria-hidden="true" className="size-3.5 shrink-0" />
        </button>
      ) : null}
    </div>
  );
}
