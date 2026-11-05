import { PlanBenefits } from "@/components/billing/plan-benefits";

export function UpgradePlanCard() {
  return (
    <section
      aria-label="Upgrade to Pro plan"
      className="overflow-hidden rounded-[10px] bg-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.088),0_3px_6px_-2px_rgba(0,0,0,0.02),0_1px_1px_rgba(0,0,0,0.04)]"
    >
      <div className="flex h-[74px] items-center justify-between gap-3 pr-5 pl-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="m-0 truncate text-[13px] leading-[15.5px] font-medium text-[#292a30]">
            Upgrade to Pro plan
          </h2>
          <p className="m-0 text-[12px] leading-[14.5px] font-[450] text-[#777a82]">
            ₦1,000 per subject
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-full bg-[lch(53%_52.26_286.91)] px-3 text-[13px] leading-none font-medium text-white transition-colors hover:bg-[#626bd9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/40 focus-visible:ring-offset-2"
        >
          Upgrade now
        </button>
      </div>
      <PlanBenefits />
    </section>
  );
}
