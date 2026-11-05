export function UsageCard() {
  return (
    <section
      aria-label="Usage settings"
      className="flex h-[65px] w-full items-center justify-between gap-4 rounded-[10px] bg-white pr-6 pl-4 shadow-[0_0_0_0.5px_rgba(0,0,0,0.088),0_3px_6px_-2px_rgba(0,0,0,0.02),0_1px_1px_rgba(0,0,0,0.04)]"
    >
      <div className="flex min-w-0 flex-col gap-[3px]">
        <h2 className="m-0 text-[13px] leading-[15.5px] font-medium text-[#292a30]">
          Usage
        </h2>
        <p className="m-0 text-[12px] leading-[14.5px] font-[450] text-[#777a82]">
          ₦0.00 remaining
        </p>
      </div>
      <button
        type="button"
        className="inline-flex h-6 shrink-0 items-center rounded-full px-2 text-[12px] leading-none font-medium text-[#292a30] transition-colors hover:bg-[#f2f2f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/40"
      >
        Add credits
      </button>
    </section>
  );
}
