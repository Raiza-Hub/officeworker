import { useEffect, useState } from "react";
import { useSmoothText } from "@convex-dev/agent/react";
import { ChevronDown, Loader, Wifi } from "lucide-react";
import { ActivityRow } from "@/components/agent/activity-row";
import { isToolPart, partText, type UIMessagePartList } from "@/components/agent/parts";
import { ShimmerText } from "@/components/agent/shimmer";

function formatDuration(milliseconds: number) {
  const seconds = Math.round(milliseconds / 1000);
  return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
}

function ActivityText({ text }: { text: string }) {
  const [visibleText] = useSmoothText(text.trimStart());
  const displayText = visibleText.trim();
  if (!displayText) return null;

  return (
    <p className="m-0 max-w-none whitespace-pre-wrap text-[14px] leading-[22px] text-[#24252a]">
      {displayText}
    </p>
  );
}

function ActivityContent({ parts }: { parts: UIMessagePartList }) {
  return (
    <div className="mt-2 flex flex-col gap-2 border-l border-[#e7e7e9] pl-3">
      {parts.map((part, index) => {
        if (part.type === "text") {
          const text = partText(part);
          return text ? <ActivityText key={`text-${index}`} text={text} /> : null;
        }
        if (isToolPart(part)) {
          return (
            <ActivityRow
              key={`${part.type}-${index}`}
              part={part}
              toolName={part.type.replace("tool-", "")}
            />
          );
        }
        return null;
      })}
    </div>
  );
}

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

  const label = streaming ? (
    <>
      {reconnecting ? (
        <span className="inline-flex items-center gap-1.5">
          <Wifi aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
          <ShimmerText>
            {connectionRetries > 0
              ? `Reconnecting · retry ${connectionRetries}`
              : "Reconnecting…"}
          </ShimmerText>
        </span>
      ) : isResponseStreaming ? (
        <span>Working for {formatDuration(elapsed ?? 0)}</span>
      ) : (
        <ShimmerText>Thinking…</ShimmerText>
      )}
    </>
  ) : cancelled ? (
    <span>User cancelled</span>
  ) : durationMs !== undefined ? (
    <span>Worked for {formatDuration(durationMs)}</span>
  ) : (
    <ShimmerText>Thinking…</ShimmerText>
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
            className="inline-flex items-center gap-1.5 text-left text-[12px] leading-none text-[#85878e] transition-colors hover:text-[#24252a]"
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
          <div className="inline-flex items-center gap-1.5 text-[12px] leading-none text-[#85878e]">
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
