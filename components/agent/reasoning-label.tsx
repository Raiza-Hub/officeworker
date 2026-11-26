"use client";

import { Wifi } from "lucide-react";
import { ShimmerText } from "@/components/agent/shimmer";
import { formatDuration } from "./reasoning-utils";

export function ReasoningLabel({
  streaming,
  reconnecting,
  connectionRetries,
  isResponseStreaming,
  elapsed,
  cancelled,
  durationMs,
}: {
  streaming: boolean;
  reconnecting: boolean;
  connectionRetries: number;
  isResponseStreaming: boolean;
  elapsed: number | undefined;
  cancelled: boolean;
  durationMs: number | undefined;
}) {
  if (streaming) {
    if (reconnecting) {
      return (
        <span className="inline-flex items-center gap-1.5">
          <Wifi aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
          <ShimmerText>
            {connectionRetries > 0
              ? `Reconnecting · retry ${connectionRetries}`
              : "Reconnecting…"}
          </ShimmerText>
        </span>
      );
    }
    if (isResponseStreaming) {
      return <span>Working for {formatDuration(elapsed ?? 0)}</span>;
    }
    return <ShimmerText>Thinking…</ShimmerText>;
  }
  if (cancelled) return <span>User cancelled</span>;
  if (durationMs !== undefined) {
    return <span>Worked for {formatDuration(durationMs)}</span>;
  }
  return <ShimmerText>Thinking…</ShimmerText>;
}
