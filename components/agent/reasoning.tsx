import { useEffect, useState } from "react";
import { ChevronDown, Loader } from "lucide-react";
import { isToolPart, partText, type UIMessagePartList } from "@/components/agent/parts";
import { ActivityContent } from "./activity-content";
import { ReasoningLabel } from "./reasoning-label";

export function Reasoning({
  parts,
  isStreaming,
  isResponseStreaming = false,
  startedAt,
  durationMs,
  cancelled = false,
  reconnecting = false,
  connectionRetries = 0,
}: {
  parts: UIMessagePartList;
  isStreaming: boolean;
  isResponseStreaming?: boolean;
  startedAt?: number;
  durationMs?: number;
  cancelled?: boolean;
  reconnecting?: boolean;
  connectionRetries?: number;
}) {
  const lastToolIndex = parts.reduce(
    (lastIndex, part, index) => (isToolPart(part) ? index : lastIndex),
    -1,
  );
  const activityParts = lastToolIndex < 0 ? [] : parts.slice(0, lastToolIndex + 1);
  const hasNarration = activityParts.some(
    (part) => part.type === "text" && partText(part).trim().length > 0,
  );
  const toolParts = activityParts.filter(isToolPart);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(0);
  const streaming = isStreaming && durationMs === undefined;
  const elapsed =
    startedAt === undefined ? undefined : Math.max(0, now - startedAt);

  useEffect(() => {
    if (!streaming || startedAt === undefined) return;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [startedAt, streaming]);

  const label = (
    <ReasoningLabel
      streaming={streaming}
      reconnecting={reconnecting}
      connectionRetries={connectionRetries}
      isResponseStreaming={isResponseStreaming}
      elapsed={elapsed}
      cancelled={cancelled}
      durationMs={durationMs}
    />
  );

  const showDisclosure = hasNarration && !streaming;

  return (
    <div className="w-full">
      {showDisclosure ? (
        <>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex items-center gap-1.5 text-left text-xs leading-none text-muted-foreground transition-colors hover:text-ink"
          >
            <span>{label}</span>
            <ChevronDown
              aria-hidden="true"
              className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
              strokeWidth={2}
            />
          </button>
          {open && <ActivityContent parts={activityParts} />}
        </>
      ) : (
        <div className="flex flex-col items-start gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs leading-none text-muted-foreground">
            {streaming && (
              <Loader
                aria-hidden="true"
                className="size-3.5 shrink-0 animate-spin [animation-duration:0.7s]"
                strokeWidth={2}
              />
            )}
            <span>{label}</span>
          </div>
          {(streaming && hasNarration) || (!hasNarration && toolParts.length > 0) ? (
            <ActivityContent parts={activityParts} />
          ) : null}
        </div>
      )}
    </div>
  );
}
