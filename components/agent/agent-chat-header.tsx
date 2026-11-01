import { ChevronDown } from "lucide-react";

export function AgentChatHeader() {
  return (
    <header className="flex h-11 shrink-0 items-center border-b border-[#eeeeef] px-2">
      <button
        type="button"
        aria-label="New chat options"
        className="inline-flex h-7 items-center gap-1 rounded-full px-[10px] text-left text-[13px] leading-none font-medium text-[#292a30] transition-colors hover:bg-[#f5f5f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/35"
      >
        New chat
        <ChevronDown aria-hidden="true" className="size-3 text-[#777a82]" strokeWidth={2} />
      </button>
    </header>
  );
}
