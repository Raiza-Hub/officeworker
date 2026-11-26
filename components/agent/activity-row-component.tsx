import { Wrench } from "lucide-react";
import { isRunningPart, partState } from "@/components/agent/parts";
import { ShimmerText } from "@/components/agent/shimmer";
import { TOOL_ICONS, toolLabel } from "./activity-row-utils";

export function ActivityRow({
  part,
  toolName,
}: {
  part: { [key: string]: unknown };
  toolName: string;
}) {
  const running = isRunningPart(part);
  const errored = partState(part) === "output-error";
  const labels = toolLabel(toolName, part.input);
  const Icon = TOOL_ICONS[toolName] ?? Wrench;
  const errorText = typeof part.errorText === "string" ? part.errorText : "";

  return (
    <div
      className="flex items-center gap-2 text-[13px] leading-5"
      title={errored ? errorText || undefined : undefined}
    >
      <Icon
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
        strokeWidth={2}
      />
      <span className="font-mono text-[11px] text-muted-foreground">
        {toolName}
      </span>
      <span className={errored ? "text-[#d64545]" : "text-text-secondary"}>
        {running ? <ShimmerText>{labels.active}</ShimmerText> : labels.done}
      </span>
    </div>
  );
}
