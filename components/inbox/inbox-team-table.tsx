import { MoreHorizontal } from "lucide-react";
import { InboxTableHeader } from "@/components/inbox/inbox-table-header";

const tableColumns = "grid-cols-[minmax(0,1fr)_120px_92px_82px_82px_28px]";

export function InboxTeamTable() {
  return (
    <div className="-mx-[18px] mt-5 w-[calc(100%+36px)] overflow-hidden text-[#24252a]">
      <InboxTableHeader columnsClassName={tableColumns} />

      <div className="mx-2 flex h-8 items-center rounded-[9px] bg-[#e5e5e7] px-[52px] text-[12px] leading-4 font-medium text-[#656870]">
        <div className="flex h-full items-center gap-2">
          <span>Active</span>
          <span className="font-medium text-[#a0a2a8]">1</span>
        </div>
      </div>

      <div
        role="row"
        className={`group grid h-11 items-center ${tableColumns} pl-[60px] pr-8 text-[12px] leading-4 text-[#3f4148] transition-colors hover:bg-[#f7f7f8]`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="flex size-[18px] shrink-0 items-center justify-center">
            <svg viewBox="0 0 14 14" className="size-3.5" fill="none">
              <rect x="1.5" y="3" width="11" height="8" rx="1.5" fill="#5f7cf0" />
              <path d="M3.75 6.25h6.5M3.75 8.5h6.5" stroke="white" strokeWidth="1" strokeLinecap="round" />
            </svg>
          </span>
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-[#292a30]">Wisdom Adebola</span>
            <span className="text-[13px] font-medium text-[#a0a2a8]">WIS</span>
          </div>
        </div>
        <span className="font-medium">Workspace</span>
        <span>1</span>
        <span>4</span>
        <span>Oct 29</span>
        <button
          type="button"
          aria-label="More team actions"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#656870] opacity-0 transition-[background-color,opacity] group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[#f1f1f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/30"
        >
          <MoreHorizontal aria-hidden="true" className="size-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
