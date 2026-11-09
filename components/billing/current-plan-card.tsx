"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PlanBenefits, basicBenefitColumns } from "@/components/billing/plan-benefits";

export function CurrentPlanCard() {
  const [showPlan, setShowPlan] = useState(false);
  const wallet = useQuery(api.billing.currentWallet, {});
  const planName = wallet?.plan === "pro" ? "Pro" : "Basic";
  const price = wallet?.pricePerUpload ?? 500;

  return (
    <section
      aria-label="Current plan"
      className="overflow-hidden rounded-[10px] bg-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.088),0_3px_6px_-2px_rgba(0,0,0,0.02),0_1px_1px_rgba(0,0,0,0.04)]"
    >
      <div className="flex h-[74px] items-center justify-between gap-4 pr-6 pl-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="m-0 text-[15px] leading-6 font-medium text-[#292a30]">
            {planName} plan
          </h2>
          <p className="m-0 text-[12px] leading-[14.5px] font-[450] text-[#777a82]">
            Current plan · ₦{price.toLocaleString("en-NG")} per successful subject-term upload
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowPlan((open) => !open)}
          aria-expanded={showPlan}
          className="inline-flex h-6 shrink-0 items-center rounded-full px-2 text-[12px] leading-none font-medium text-[#292a30] transition-colors hover:bg-[#f2f2f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/40"
        >
          {showPlan ? "Hide plan" : "Show plan"}
        </button>
      </div>
      {showPlan && <PlanBenefits columns={wallet?.plan === "pro" ? undefined : basicBenefitColumns} />}
    </section>
  );
}
