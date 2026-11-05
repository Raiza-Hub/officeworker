import { Bell, Plus } from "lucide-react";

export function ActivityHeader() {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-[#e9e9ec] px-[18px]">
      <h1 className="text-[13px] leading-4 font-semibold tracking-[-0.01em] text-[#27282d]">
        Activity
      </h1>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label="Setup activity notifications"
          className="inline-flex size-7 items-center justify-center rounded-md text-[#646770] transition-colors hover:bg-[#f0f0f2] hover:text-[#303137] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6069d9]/40"
        >
          <Bell aria-hidden="true" className="size-3.5" strokeWidth={1.9} />
        </button>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] leading-4 font-medium text-[#5c5f67] transition-colors hover:bg-[#f0f0f2] hover:text-[#292a30] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6069d9]/40"
        >
          <Plus aria-hidden="true" className="size-3.5" strokeWidth={2} />
          New chat
        </button>
      </div>
    </header>
  );
}
