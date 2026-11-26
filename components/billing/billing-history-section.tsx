"use client";

import { useState } from "react";
import { useReducedMotion } from "motion/react";
import { useConvexAuth } from "convex/react";
import {
  InvoicesHistoryView,
  ReportsHistoryView,
} from "./billing-history-views";
import {
  useBillingHistoryData,
  useBillingHistoryEffects,
} from "@/hooks/use-billing-history";

export function BillingHistorySection() {
  const { isAuthenticated } = useConvexAuth();
  const reduceMotion = useReducedMotion();
  const [view, setView] = useState<"invoices" | "reports">("invoices");
  const {
    transactions,
    invoiceStatus,
    loadMoreInvoices,
    reports,
    reportStatus,
    loadMoreReports,
  } = useBillingHistoryData(isAuthenticated);
  const activeStatus = view === "reports" ? reportStatus : invoiceStatus;
  const activeLoadMore =
    view === "reports" ? loadMoreReports : loadMoreInvoices;
  const isLoading = invoiceStatus === "LoadingFirstPage";
  const isLoadingReports = reportStatus === "LoadingFirstPage";
  const { sentinelRef, sectionRef, pendingScrollRef } = useBillingHistoryEffects(
    activeStatus,
    activeLoadMore,
    view,
    isLoadingReports,
    isLoading,
    reduceMotion,
  );

  function handleToggleView() {
    pendingScrollRef.current = true;
    setView((current) => (current === "reports" ? "invoices" : "reports"));
  }

  return (
    <section
      ref={sectionRef}
      aria-labelledby="billing-history-heading"
      className="mt-9 scroll-mt-4"
    >
      <div className="flex items-center justify-between gap-4 border-b border-border-soft px-4 pb-2">
        <h2
          id="billing-history-heading"
          className="m-0 text-[15px] leading-[23px] font-medium text-ink-soft"
        >
          Billing history
        </h2>
        <button
          aria-label={view === "reports" ? "Show invoices" : "Show reports"}
          aria-pressed={view === "reports"}
          className="inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs leading-none font-medium text-ink-soft transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          onClick={handleToggleView}
          type="button"
        >
          {view === "reports" ? "Invoices" : "Reports"}
        </button>
      </div>
      {view === "reports" ? (
        <ReportsHistoryView
          reports={reports}
          status={reportStatus}
          isLoading={isLoadingReports}
          sentinelRef={sentinelRef}
        />
      ) : (
        <InvoicesHistoryView
          transactions={transactions}
          status={invoiceStatus}
          isLoading={isLoading}
          sentinelRef={sentinelRef}
        />
      )}
    </section>
  );
}
