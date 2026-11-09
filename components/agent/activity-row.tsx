import { useEffect, useState } from "react";
import {
  FileSearch,
  ListChecks,
  Pencil,
  PlugZap,
  RotateCcw,
  Send,
  Upload,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { isRunningPart, partState } from "@/components/agent/parts";
import { ShimmerText } from "@/components/agent/shimmer";

export const TOOL_ICONS: Record<string, LucideIcon> = {
  get_connection_status: PlugZap,
  create_submission: Upload,
  get_submission: FileSearch,
  list_submissions: ListChecks,
  update_score: Pencil,
  resolve_name_match: Pencil,
  approve_submission: Send,
  cancel_submission: XCircle,
  retry_submission: RotateCcw,
};

function stringArg(input: unknown, key: string): string {
  if (typeof input !== "object" || input === null) return "";
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

export function toolLabel(
  toolName: string,
  input: unknown,
): { active: string; done: string } {
  switch (toolName) {
    case "get_connection_status":
      return {
        active: "Checking portal connection…",
        done: "Checked portal connection",
      };
    case "create_submission":
      return { active: "Starting submission…", done: "Started submission" };
    case "get_submission":
      return { active: "Reading submission…", done: "Read submission" };
    case "list_submissions":
      return { active: "Listing submissions…", done: "Listed submissions" };
    case "update_score": {
      const name = stringArg(input, "studentName");
      const object = name ? `${name}'s score` : "a score";
      return {
        active: `Updating ${object}…`,
        done: `Updated ${object}`,
      };
    }
    case "resolve_name_match":
      return { active: "Fixing a name match…", done: "Fixed a name match" };
    case "approve_submission":
      return { active: "Approving submission…", done: "Approved submission" };
    case "cancel_submission":
      return { active: "Cancelling submission…", done: "Cancelled submission" };
    case "retry_submission":
      return { active: "Retrying submission…", done: "Retried submission" };
    default: {
      const name = toolName.replace(/_/g, " ");
      return { active: `Using ${name}…`, done: `Used ${name}` };
    }
  }
}

export function formatElapsed(ms: number): string {
  if (ms < 1000) return "<1s";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function useElapsed(start: number, running: boolean): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [running]);
  return formatElapsed(Math.max(0, now - start));
}

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
      className="flex items-center gap-2 text-[13px] leading-[20px]"
      title={errored ? errorText || undefined : undefined}
    >
      <Icon
        aria-hidden="true"
        className="size-4 shrink-0 text-[#85878e]"
        strokeWidth={2}
      />
      <span className="font-mono text-[11px] text-[#85878e]">
        {toolName}
      </span>
      <span className={errored ? "text-[#d64545]" : "text-[#45474e]"}>
        {running ? <ShimmerText>{labels.active}</ShimmerText> : labels.done}
      </span>
    </div>
  );
}
