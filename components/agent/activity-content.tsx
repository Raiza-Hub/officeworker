"use client";

import { useSmoothText } from "@convex-dev/agent/react";
import { ActivityRow } from "@/components/agent/activity-row";
import { isToolPart, partText, type UIMessagePartList } from "@/components/agent/parts";

export function ActivityText({ text }: { text: string }) {
  const [visibleText] = useSmoothText(text.trimStart());
  const displayText = visibleText.trim();
  if (!displayText) return null;

  return (
    <p className="m-0 max-w-none whitespace-pre-wrap text-sm leading-5.5 text-ink">
      {displayText}
    </p>
  );
}

export function ActivityContent({ parts }: { parts: UIMessagePartList }) {
  let textOrdinal = 0;
  let toolOrdinal = 0;
  return (
    <div className="mt-2 flex flex-col gap-2 border-l border-border pl-3">
      {parts.map((part) => {
        if (part.type === "text") {
          const text = partText(part);
          const key = `text-${textOrdinal++}`;
          return text ? <ActivityText key={key} text={text} /> : null;
        }
        if (isToolPart(part)) {
          let toolCallId =
            typeof part.toolCallId === "string"
              ? part.toolCallId
              : typeof part.id === "string"
                ? part.id
                : null;
          if (!toolCallId) toolCallId = `tool-${toolOrdinal++}`;
          return (
            <ActivityRow
              key={`${part.type}-${toolCallId}`}
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
