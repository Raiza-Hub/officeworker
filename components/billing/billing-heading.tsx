import { SidebarTrigger } from "@/components/sidebar/sidebar-trigger";

export function BillingHeading() {
  return (
    <header className="flex h-[60px] flex-col gap-1 px-4">
      <div className="flex h-8 items-center gap-2">
        <SidebarTrigger />
        <h1 className="m-0 text-[24px] leading-8 font-medium tracking-[-0.03em] text-[#24252a]">
          Billing
        </h1>
      </div>
      <div className="flex h-6 items-center justify-between gap-4">
        <p className="m-0 h-6 text-[13px] leading-[22px] font-[450] text-[#777a82]">
          For questions about billing,{" "}
          <button
            type="button"
            className="rounded-lg px-1 py-px text-[13px] leading-[22px] font-[450] text-[#292a30] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/40"
          >
            contact us
          </button>
        </p>
      </div>
    </header>
  );
}
