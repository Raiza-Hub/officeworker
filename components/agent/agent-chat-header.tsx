import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

type AgentChatHeaderProps = {
  actions?: ReactNode;
  title?: string;
  showDropdown?: boolean;
};

export function AgentChatHeader({
  actions,
  title = "New chat",
  showDropdown = true,
}: AgentChatHeaderProps) {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-[#eeeeef] px-2">
      {showDropdown ? (
        <button
          type="button"
          aria-label={`${title} options`}
          className="inline-flex h-7 items-center gap-1 rounded-full px-[10px] text-left text-[13px] leading-none font-medium text-[#292a30] transition-colors hover:bg-[#f5f5f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/35"
        >
          {title}
          <ChevronDown aria-hidden="true" className="size-3 text-[#777a82]" strokeWidth={2} />
        </button>
      ) : (
        <span className="inline-flex h-7 items-center px-[10px] text-[13px] leading-none font-medium text-[#292a30]">
          {title}
        </span>
      )}
      {actions}
    </header>
  );
}
