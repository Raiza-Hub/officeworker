import { BillingHeading } from "@/components/billing/billing-heading";
import { UsageHistorySection } from "@/components/billing/usage-history-section";
import { BillingHistorySection } from "@/components/billing/billing-history-section";
import { WalletBalance } from "@/components/billing/wallet-balance";

export function BillingPage() {
  return (
    <div
      className="h-full overflow-y-auto overscroll-contain px-6 pb-12 pt-16"
      data-billing-scroll=""
    >
      <div className="mx-auto w-full max-w-160">
        <BillingHeading />
        <WalletBalance />
        <div className="mt-8 flex flex-col gap-3">
          <UsageHistorySection />
        </div>
        <BillingHistorySection />
      </div>
    </div>
  );
}
