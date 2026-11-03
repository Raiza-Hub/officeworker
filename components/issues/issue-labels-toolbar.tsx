import { Search, SlidersHorizontal } from "lucide-react";

const toolbarButtonClassName =
  "inline-flex size-7 items-center justify-center rounded-full border border-[#e7e7ea] bg-white text-[#73767e] shadow-[0_0.5px_1px_rgba(0,0,0,0.04)] transition-colors hover:bg-[#f7f7f8] hover:text-[#34363c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6069d9]/40";

export function IssueLabelsToolbar() {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between px-[18px]">
      <form role="search" className="relative flex h-7 w-[300px] items-center">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 size-4 text-[#5f6269]"
          strokeWidth={2}
        />
        <input
          type="search"
          aria-label="Filter by name"
          placeholder="Filter by name…"
          className="h-7 w-full rounded-full border-[0.5px] border-transparent bg-[#f9f9fa] pl-8 pr-2 text-[13px] leading-normal font-medium text-[#3f4148] outline-none transition-colors duration-150 placeholder:text-[#a1a2a7] hover:border-[#d8d9df] focus:border-[#6069d9] focus:ring-0"
        />
      </form>

      <div className="flex items-center gap-2">
        <button type="button" aria-label="Display options" className={toolbarButtonClassName}>
          <SlidersHorizontal aria-hidden="true" className="size-3.5" strokeWidth={1.9} />
        </button>
      </div>
    </div>
  );
}
