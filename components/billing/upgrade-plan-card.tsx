"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { LoaderCircle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import {
  PlanBenefits,
  basicBenefitColumns,
} from "@/components/billing/plan-benefits";

export function UpgradePlanCard() {
  const wallet = useQuery(api.billing.currentWallet, {});
  const setPlan = useMutation(api.billing.setPlan);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPro = wallet?.plan === "pro";

  async function changePlan() {
    if (isSaving || !wallet) return;
    setIsSaving(true);
    setError(null);
    try {
      await setPlan({ plan: isPro ? "basic" : "pro" });
    } catch (upgradeError) {
      setError(upgradeError instanceof Error ? upgradeError.message : "Could not update your plan.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section
      aria-label={isPro ? "Basic plan details" : "Upgrade to Pro plan"}
      className="overflow-hidden rounded-[10px] bg-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.088),0_3px_6px_-2px_rgba(0,0,0,0.02),0_1px_1px_rgba(0,0,0,0.04)]"
    >
      <div className="flex h-[74px] items-center justify-between gap-3 pr-5 pl-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="m-0 truncate text-[13px] leading-[15.5px] font-medium text-[#292a30]">
            {isPro ? "Basic plan" : "Upgrade to Pro plan"}
          </h2>
          <p className="m-0 text-[12px] leading-[14.5px] font-[450] text-[#777a82]">
            ₦{isPro ? "500" : "1,000"} per successful subject-term upload
          </p>
        </div>
        <button
          type="button"
          onClick={() => void changePlan()}
          disabled={isSaving || !wallet}
          aria-label={
            isSaving
              ? "Updating plan"
              : isPro
                ? "Switch to basic"
                : "Upgrade now"
          }
          aria-busy={isSaving}
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-full bg-[lch(53%_52.26_286.91)] px-3 text-[13px] leading-none font-medium text-white transition-colors hover:bg-[#626bd9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/40 focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-60"
        >
          {isSaving && (
            <LoaderCircle
              aria-hidden="true"
              className="size-3.5 animate-spin"
              strokeWidth={2}
            />
          )}
          {!isSaving && (isPro ? "Switch to basic" : "Upgrade now")}
        </button>
      </div>
      {error && <p role="alert" className="m-0 px-4 pb-2 text-[12px] text-[#b42318]">{error}</p>}
      <PlanBenefits columns={isPro ? basicBenefitColumns : undefined} />
    </section>
  );
}
