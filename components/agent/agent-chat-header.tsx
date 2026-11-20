import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { HeaderSidebarTrigger } from "@/components/sidebar/sidebar-trigger";

type AgentChatHeaderProps = {
  actions?: ReactNode;
  title?: string;
  showDropdown?: boolean;
  titleLoading?: boolean;
};

export function AgentChatHeader({
  actions,
  title = "New chat",
  showDropdown = true,
  titleLoading = false,
}: AgentChatHeaderProps) {
  const titleContent = titleLoading ? (
    <span className="h-3.5 w-24 animate-pulse rounded bg-secondary" />
  ) : (
    <span className="truncate">{title}</span>
  );

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-[#eeeeef] px-2">
      <div className="flex min-w-0 items-center gap-1">
        <HeaderSidebarTrigger />
        {showDropdown ? (
          <button
            type="button"
            aria-label={`${title} options`}
            className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-left text-[13px] leading-none font-medium text-ink-soft transition-colors hover:bg-app-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            {titleContent}
            <ChevronDown aria-hidden="true" className="size-3 shrink-0 text-text-tertiary" strokeWidth={2} />
          </button>
        ) : (
          <span className="inline-flex h-7 min-w-0 items-center px-2.5 text-[13px] leading-none font-medium text-ink-soft">
            {titleContent}
          </span>
        )}
      </div>
      {actions}
    </header>
  );
}
