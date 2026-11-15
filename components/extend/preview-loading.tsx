"use client";

import { LoaderCircle } from "lucide-react";

export function PreviewSpinner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading preview"
      className={`flex h-full min-h-full w-full items-center justify-center ${className ?? ""}`}
    >
      <LoaderCircle
        aria-hidden="true"
        className="size-6 shrink-0 animate-spin text-primary"
      />
    </div>
  );
}

export function PreviewLoading({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={`flex h-full min-h-full w-full items-center justify-center gap-2 text-[13px] text-muted-foreground ${className ?? ""}`}
    >
      <LoaderCircle
        aria-hidden="true"
        className="size-4 shrink-0 animate-spin text-primary"
      />
      <span>Loading preview…</span>
    </div>
  );
}
