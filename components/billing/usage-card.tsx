import { ChevronRight } from "lucide-react";

export function UsageCard() {
  return (
    <button
      type="button"
      aria-label="Usage settings"
      className="flex h-[65px] w-full items-center justify-between gap-4 rounded-[10px] bg-white px-4 text-left shadow-[0_0_0_0.5px_rgba(0,0,0,0.088),0_3px_6px_-2px_rgba(0,0,0,0.02),0_1px_1px_rgba(0,0,0,0.04)] transition-colors hover:bg-[#fcfcfc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/40"
    >
      <span className="flex min-w-0 flex-col gap-[3px]">
        <span className="text-[13px] leading-[15.5px] font-medium text-[#292a30]">
          Usage
        </span>
        <span className="text-[12px] leading-[14.5px] font-[450] text-[#777a82]">
          $0.00 remaining
        </span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="size-4 shrink-0 text-[#777a82]"
        strokeWidth={2}
      />
    </button>
  );
}
