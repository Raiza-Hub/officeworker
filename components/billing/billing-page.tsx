import { BillingHeading } from "@/components/billing/billing-heading";
import { CurrentPlanCard } from "@/components/billing/current-plan-card";
import { RecentInvoicesSection } from "@/components/billing/recent-invoices-section";
import { UpgradePlanCard } from "@/components/billing/upgrade-plan-card";
import { UsageCard } from "@/components/billing/usage-card";

export function BillingPage() {
  return (
    <div className="h-full overflow-y-auto px-6 pb-12 pt-16">
      <div className="mx-auto w-full max-w-[640px]">
        <BillingHeading />
        <div className="mt-8 flex flex-col gap-3">
          <CurrentPlanCard />
          <UpgradePlanCard />
          <div className="mt-2">
            <UsageCard />
          </div>
        </div>
        <RecentInvoicesSection />
      </div>
    </div>
  );
}
