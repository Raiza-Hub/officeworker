import { History, MousePointer2 } from "lucide-react";

export function AgentStatusBar() {
  return (
    <footer className="flex h-9 shrink-0 items-center justify-end gap-3 px-3 text-[#71747c]">
      <span className="inline-flex items-center gap-1.5 text-[12px] leading-none">
        <MousePointer2 aria-hidden="true" className="size-3.5" strokeWidth={2} />
        Agent
      </span>
      <button
        type="button"
        aria-label="Recent agent activity"
        className="inline-flex size-7 items-center justify-center rounded-md text-[#777a82] transition-colors hover:bg-[#f3f3f4] hover:text-[#303137] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/35"
      >
        <History aria-hidden="true" className="size-4" strokeWidth={2} />
      </button>
    </footer>
  );
}
