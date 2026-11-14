import { MousePointer2 } from "lucide-react";

export function AgentStatusBar() {
  return (
    <footer className="flex h-9 shrink-0 items-center justify-end gap-3 px-3 text-[#71747c]">
      <span className="inline-flex items-center gap-1.5 text-[12px] leading-none">
        <MousePointer2 aria-hidden="true" className="size-3.5" strokeWidth={2} />
        Agent
      </span>
    </footer>
  );
}
